# Source-Linked Task Sync Fix Plan

## Goal

Fix the asymmetric sync behavior for source-linked tasks with `source_sync_mode = "live"`:

- Editing a linked task copy currently updates the source task.
- Editing the source task does **not** reliably update linked task copies.

This document explains why that happens, what the intended behavior should be, and the implementation plan to fix it.

---

## User-Visible Bug

### Repro

1. Create a task block containing source-linked copies of tasks from another tab or block.
2. Turn on sync edits so the copied tasks are `live`.
3. Edit the status of a linked copy in the derived task block.
4. Verify the source task updates correctly.
5. Edit the status of the source task in its original tab.
6. Observe that the linked copy does **not** update.

### Expected behavior

For `live` source-linked tasks:

- Editing the linked copy should update the source.
- Editing the source should update all linked copies.
- The source should act as the canonical hub for propagation.

### Non-goal

Do **not** change snapshot behavior. For `source_sync_mode = "snapshot"`, edits should remain local.

---

## Root Cause Summary

There are two different update pipelines for task edits:

1. `task_items` / `updateTaskItem(...)`
2. `entity_properties` / `setEntityProperties(...)`

The source-linked task block status UI uses the universal properties path, not `updateTaskItem(...)`.

That matters because:

- child-copy -> source propagation exists in DB triggers and source writeback code
- source -> derived-copy propagation exists only in app-level task fanout code
- the task `entity_properties` path does not call the same derived fanout logic as `updateTaskItem(...)`

As a result, linked-copy edits can reach the source, but source edits made through the task property UI stop before they propagate back out to derived task copies.

---

## Current Architecture

## 1. Task block status editing uses universal properties

Inline task status editing in the task block goes through `PropertyFieldDropdown`, which calls `useSetEntityProperties(...)`.

Relevant files:

- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx`
- `trak/src/components/properties/property-field-dropdown.tsx`
- `trak/src/lib/hooks/use-property-queries.ts`
- `trak/src/app/actions/entity-properties.ts`

Key references:

- task block inline status dropdown:
  - `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx`
  - around the inline status badge rendering
- property dropdown mutation:
  - `trak/src/components/properties/property-field-dropdown.tsx`
  - `useSetEntityProperties(...)`

Implication:

- many task status edits do **not** go through `updateTaskItem(...)`
- they go through `setEntityProperties(...)`

## 2. Copy -> source sync exists today

When a linked task copy is edited and is `live`, the system can sync back to its source.

This is implemented in two places:

- DB trigger for `task_items` updates:
  - `trak/supabase/migrations/20260226000003_fix_sync_live_task_trigger_drop_status.sql`
- DB trigger for `entity_properties` updates:
  - `trak/supabase/migrations/20260221000000_remove_property_definitions.sql`

These triggers read the edited row's `source_entity_type`, `source_entity_id`, and `source_sync_mode`.

Important limitation:

- they only work when the edited row itself is a linked copy with source metadata
- they do not help when the edited row is the original source task

## 3. Source -> derived fanout exists only in server action code

`updateTaskItem(...)` contains explicit fanout logic:

- sync derived task copies
- sync derived timeline events
- sync derived table rows

Relevant file:

- `trak/src/app/actions/tasks/item-actions.ts`

Important helper calls inside that path:

- `syncTaskUpdateToDerivedTasks(...)`
- `syncTaskUpdateToDerivedTimelineEvents(...)`
- `syncTaskUpdateToDerivedRows(...)`

This is the correct forward-propagation path for source task edits.

## 4. The task property path does not call the same fanout logic

In `setEntityProperties(...)`, when `entity_type === "task"`:

1. property rows are written
2. canonical task fields on `task_items` are updated
3. task assignees are synced
4. derived table rows are updated manually

But it does **not** fan out to:

- derived task copies
- derived timeline events

That is the missing piece.

Relevant file:

- `trak/src/app/actions/entity-properties.ts`

---

## Why the Existing Behavior Looks Partially Correct

If there is only one linked copy, editing that copy appears to work because:

1. the copy updates
2. the copy writes back to the source
3. the user sees the source reflect the change

But that is only `copy -> source`.

The missing behavior is:

- `source -> linked task copies`

That is why the bug becomes obvious when editing the original source task directly.

This also means the current system is not truly canonicalized around the source task. It only supports one half of the propagation model reliably.

---

## Intended Sync Model

For `live` source-linked tasks, the desired model should be:

1. Any edit to a linked copy may write back to the source.
2. The source becomes the canonical state.
3. The canonical source state fans out to all live-linked derivatives:
   - other linked task copies
   - linked timeline events
   - linked table rows

For `snapshot` source-linked tasks:

- no propagation in either direction

This means there should be one shared forward-fanout implementation for source task changes, regardless of whether the original edit entered through:

- `updateTaskItem(...)`
- `setEntityProperties(...)`

---

## Proposed Fix

## High-level approach

Unify source-task fanout into a shared helper and call it from both task mutation entry points.

Do **not** make the DB triggers bidirectional.

Reason:

- DB triggers are currently good for child-copy -> source writeback
- source -> all-derived propagation is broader and better handled in application logic
- making DB triggers perform full bidirectional graph sync would increase recursion risk and make behavior harder to reason about

## Concrete change

Extract the existing task fanout block from `updateTaskItem(...)` into a reusable helper, then reuse it from `setEntityProperties(...)` after canonical task state is written.

---

## Detailed Implementation Plan

## Step 1. Extract shared task fanout helper

Create a helper responsible only for propagating a canonical task state from a source task to live-linked derived entities.

Suggested responsibilities:

- sync derived task copies
- sync derived timeline events
- sync derived table rows

Suggested source location:

- either keep the helper in `trak/src/app/actions/tasks/item-actions.ts`
- or move it into a small task-sync utility module if that makes circular dependencies cleaner

Suggested helper shape:

```ts
async function fanOutSourceTaskUpdate(params: {
  supabase: any;
  sourceTaskId: string;
  userId: string;
  task: TaskItem;
}): Promise<void>
```

Internally it should call:

- `syncTaskUpdateToDerivedTasks(...)`
- `syncTaskUpdateToDerivedTimelineEvents(...)`
- `syncTaskUpdateToDerivedRows(...)`

## Step 2. Make `updateTaskItem(...)` use the shared helper

Refactor `updateTaskItem(...)` so it no longer directly owns the fanout sequence inline.

Instead:

1. normalize the updated task
2. perform any source writeback for non-task sources
3. call the shared task fanout helper unless `skipDerivedFanout` is set

This should be a refactor-only behavioral no-op for this path.

Files:

- `trak/src/app/actions/tasks/item-actions.ts`

## Step 3. Make `setEntityProperties(...)` call the same helper for task entities

In the `input.entity_type === "task"` branch of `setEntityProperties(...)`:

1. keep writing property rows as today
2. keep syncing canonical `task_items` columns as today
3. keep syncing `task_assignees` as today
4. remove the idea that this path is only responsible for derived table rows
5. after canonical task state is written, load or construct the normalized canonical task row
6. call the shared task fanout helper

Important:

- the helper should only run when the updated entity is the source task
- however it is safe if it runs generally, because the helper queries rows where `source_entity_id = sourceTaskId`
- the main point is that this path must now fan out to derived task copies and timeline events, not just rows

Files:

- `trak/src/app/actions/entity-properties.ts`

## Step 4. Prevent loops and duplicate work

There are already guard concepts in the codebase:

- `skipDerivedFanout`
- `skipSourceWriteback`
- trigger-level `pg_trigger_depth()`

Preserve that model.

Guidance:

- keep child-copy -> source behavior where it is today
- when source writeback lands on the source task, that source task should perform forward fanout once
- avoid a second redundant source writeback from that same source update

The current task and timeline action patterns already support this style, so follow the same model instead of inventing a new one.

## Step 5. Normalize around canonical task state

When `setEntityProperties(...)` updates a task, the fanout should use the final canonical task state, not the raw input payload.

That means the derived copies should receive:

- resolved `statuses`
- resolved `priorities`
- resolved `assignees`
- resolved due/start dates
- resolved tags

This avoids drift between:

- `entity_properties`
- denormalized `task_items` columns
- derived entities

Implementation note:

- after `task_items` is updated in `setEntityProperties(...)`, either:
  - fetch the updated task row and normalize it using the same normalization helper as `updateTaskItem(...)`, or
  - build a canonical task object in one place and reuse it

Do not fan out based only on `updates` input.

## Step 6. Keep table-row sync logic, but deduplicate if possible

Today `setEntityProperties(...)` already contains task -> derived row sync logic.

Once the shared task fanout helper exists, decide between:

- Option A: move that row-sync logic fully into the shared helper
- Option B: keep it where it is and have the helper call into it

Preferred direction:

- move all source-task fanout logic under the shared helper so there is a single source of truth

This reduces the chance that future task fields sync to one derivative type but not others.

## Step 7. Tighten client invalidation

The property mutation path already invalidates `["taskItems"]` broadly, which is good.

`useUpdateTaskItem(...)` only refreshes the current block's query and some table/chart queries. That can leave other task blocks stale in-session.

Improve that path so task updates also invalidate broader task block queries when appropriate.

Relevant file:

- `trak/src/lib/hooks/use-task-queries.ts`

This is not the root cause of the bug described above, but it is worth fixing because it can still create stale UIs across multiple open task blocks.

---

## Files to Read Before Implementing

Core task mutation flow:

- `trak/src/app/actions/tasks/item-actions.ts`

Task universal properties flow:

- `trak/src/app/actions/entity-properties.ts`
- `trak/src/lib/hooks/use-property-queries.ts`
- `trak/src/components/properties/property-field-dropdown.tsx`
- `trak/src/components/properties/property-menu.tsx`

Task block UI entry points:

- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx`

Related timeline pattern to mirror:

- `trak/src/app/actions/timelines/event-actions.ts`

DB triggers and source-link metadata behavior:

- `trak/supabase/migrations/20260226000003_fix_sync_live_task_trigger_drop_status.sql`
- `trak/supabase/migrations/20260221000000_remove_property_definitions.sql`
- `trak/supabase/migrations/20260211130000_add_task_source_sync_mode.sql`

---

## Implementation Notes and Constraints

## 1. Keep snapshot semantics unchanged

If `source_sync_mode !== "live"`, there should be no propagation.

## 2. Do not rely on DB triggers for full forward fanout

The current bug exists because forward fanout is not centralized.

Expanding DB triggers to handle all source -> derivative propagation would be riskier than centralizing app-level fanout.

## 3. Preserve existing behavior for non-task sources

Tasks can be sourced from:

- `task`
- `timeline_event`
- `table_row`
- `block`

This fix is specifically about task-source fanout.

Do not regress:

- task copy -> timeline event source writeback
- task copy -> table row source writeback
- existing restrictions around block/table-row snapshot-only semantics where applicable

## 4. Avoid partial fanout ownership

Right now:

- `updateTaskItem(...)` owns broad task fanout
- `setEntityProperties(...)` owns only table-row fanout

That split is the structural problem. After the fix, task-source fanout should have one owner.

---

## Acceptance Criteria

All of the following should pass:

### A. Source task to linked task copy

1. Create a live-linked task copy from a source task.
2. Edit the source task status via the property UI.
3. Confirm the linked task copy updates.

### B. Linked task copy to source task

1. Edit the linked task copy status via the property UI.
2. Confirm the source task updates.

### C. One source, multiple linked task copies

1. Create at least two live-linked task copies from the same source task.
2. Edit one linked copy.
3. Confirm the source updates.
4. Confirm the sibling linked copy also updates.

### D. Source task to derived timeline event

1. Create a live-linked timeline event from a task.
2. Edit the source task status/priority/dates.
3. Confirm the derived timeline event updates as expected.

### E. Source task to derived table row

1. Create a live-linked table row from a task.
2. Edit the source task status/priority/dates/tags/assignee.
3. Confirm the derived row updates.

### F. Snapshot mode remains local

1. Create a snapshot-linked task copy.
2. Edit the source task.
3. Confirm the snapshot copy does not update.
4. Edit the snapshot copy.
5. Confirm the source does not update.

### G. No sync loops

1. Edit a linked copy.
2. Confirm the system settles in one final state without repeated bouncing updates.
3. Check logs for repeated sync churn if logging is available.

---

## Suggested Test Coverage

There does not appear to be dedicated test coverage for this exact path today. Add focused tests around the shared fanout helper and task property mutation flow.

At minimum, cover:

- source task property update fans out to derived tasks
- source task property update fans out to derived timeline events
- source task property update fans out to derived rows
- linked task copy update still writes back to source
- `snapshot` mode does not fan out

If integration tests are expensive, start with server-action-level tests around the extracted helper and the task branch of `setEntityProperties(...)`.

---

## Short Version for the Implementing Agent

The bug is not in the task block UI and not mainly in React Query.

The bug is that:

- `updateTaskItem(...)` has task-source forward fanout
- `setEntityProperties(...)` does not

Since task status edits in the task block use `setEntityProperties(...)`, source task edits made through the property UI never fan out to linked task copies.

### The fix

1. extract shared source-task fanout logic
2. call it from `updateTaskItem(...)`
3. call it from the `task` branch of `setEntityProperties(...)`
4. keep child-copy -> source DB-trigger behavior as-is
5. verify `live` works both directions and `snapshot` remains local

