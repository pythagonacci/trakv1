# Table Row Sourcing: Implementation Review and Fixes

## Scope
This document summarizes:
1. What the coding agent implemented for `SOURCING FROM TABLE_ROWS.md`.
2. What review findings were identified.
3. What follow-up fixes were applied.

---

## What the Agent Implemented
The agent implemented the core spec across migrations, actions, AI tooling, and query surfaces.

### 1) Database and constraints
- Added migration: `supabase/migrations/20260216130000_allow_table_row_source_for_tasks_and_timelines.sql`
  - Updated `task_items_source_metadata_consistency` to allow `source_entity_type IN ('task', 'timeline_event', 'table_row')`.
  - Updated `timeline_events_source_metadata_consistency` similarly.
- Updated RPC create function in `supabase/migrations/20260203120000_add_rpc_super_and_bulk.sql`:
  - `create_task_full` now accepts `p_source_entity_type`, `p_source_entity_id`, `p_source_sync_mode`.
  - Persists universal source metadata and preserves legacy `source_task_id` compatibility when source type is `task`.

### 2) Create paths now persist source metadata
- `src/app/actions/tasks/item-actions.ts`
  - `createTaskItem` now accepts/persists `sourceEntityType`, `sourceEntityId`, `sourceSyncMode`.
  - Clamps `table_row`-sourced sync mode to `snapshot`.
- `src/app/actions/timelines/event-actions.ts`
  - `createTimelineEvent` now accepts/persists equivalent source metadata.
  - Clamps `table_row`-sourced sync mode to `snapshot`.
- `src/app/actions/tasks/super-actions.ts`
  - `createTaskFullRpc` now passes source metadata through RPC.

### 3) AI tool definitions and execution wiring
- `src/lib/ai/tool-definitions.ts`
  - Added source metadata fields to `createTaskItem` and `createTimelineEvent` schemas.
  - Added source metadata mention for `bulkCreateTasks` (later structurally improved; see fixes section).
- `src/lib/ai/tool-executor.ts`
  - `createTaskItem` path: passes source metadata to RPC, direct fallback, and retries.
  - `bulkCreateTasks` path: passes per-task source metadata to RPC and direct fallback.
  - `createTimelineEvent` path: passes source metadata.

### 4) Duplication behavior
- Task duplication (fallback): `src/app/actions/tasks/item-actions.ts`
  - Preserves row lineage only when original is row-sourced.
  - Keeps existing behavior for non-row sources.
- Task duplication (RPC): `supabase/migrations/20260216062500_fix_duplicate_tasks_rpc_source_metadata.sql`
  - Matches fallback conditional logic.
- Timeline duplication:
  - Single: `src/app/actions/timelines/event-actions.ts`
  - Bulk: `src/app/actions/timelines/bulk-actions.ts`
  - Both now propagate row lineage only for row-sourced originals.

### 5) Sync policy and toggles
- Chosen policy: snapshot-only for `source_entity_type='table_row'` on tasks.
- Enforced in DB trigger migration:
  - `supabase/migrations/20260213200000_fix_sync_trigger_for_universal_source_tracking.sql`
- Enforced in create paths by sync-mode clamping to `snapshot` for row-sourced task/timeline creates.
- Updated block toggle logic in `src/app/actions/tasks/item-actions.ts`:
  - Uses universal source metadata with legacy fallback.
  - Prevents enabling live sync for unsupported row-sourced copies.

### 6) Query/filter/type/UI/prompt updates
- Replaced legacy `source_task_id`-only assumptions with universal metadata (plus fallback) in:
  - `src/app/actions/ai-search.ts`
  - `src/app/actions/properties/query-actions.ts`
  - `src/app/actions/tasks/query-actions.ts`
  - `src/app/actions/everything-view.ts`
- Updated types/context/UI to include universal source fields:
  - `src/types/task.ts`
  - `src/types/timeline.ts`
  - `src/app/actions/ai-context.ts`
  - `src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx`
- Updated prompt/executor guidance to require table-row source propagation for task/timeline creation from rows/results:
  - `src/lib/ai/system-prompt.ts`
  - `src/lib/ai/workflow-executor.ts`
  - `src/lib/ai/executor.ts`

### 7) Edited snapshot helper expansion
- `src/app/actions/ai-search.ts`
  - `getEditedTaskSnapshotsFromTaskItems`
  - `getEditedTimelineEventSnapshotsFromTimelineEvents`
- Expanded to include row-sourced snapshots and row/table context shaping.

---

## Review Findings

### Finding P1 (behavior regression)
- In `ai-search` snapshot helpers, newly added row-sourced edited snapshot queries were workspace-wide (not scoped to current source result set).
- Effect: unrelated edited row-sourced snapshots could be appended to search results.

### Finding P2 (schema gap)
- `bulkCreateTasks` had source metadata only in description text while `tasks.items` remained a generic object schema.
- Effect: weaker structured guidance/validation for per-task source fields.

---

## What I Fixed

### Fix for P1: scope row-sourced edited snapshots to related lineage
Updated `src/app/actions/ai-search.ts`:
- `getEditedTaskSnapshotsFromTaskItems`
  - Added early return if no source task IDs.
  - Added lineage scoping step:
    - Find related `table_rows.id` where `table_rows.source_entity_type='task'` and `source_entity_id IN current task IDs`.
    - Fetch edited row-sourced task snapshots only when `task_items.source_entity_id IN relatedRowIds`.
- `getEditedTimelineEventSnapshotsFromTimelineEvents`
  - Same lineage scoping flow for timeline events via related table rows.

Result:
- Table-row support is preserved.
- Only related edited snapshots are included.
- Unrelated workspace snapshots are no longer leaked into arbitrary search results.

### Fix for P2: make `bulkCreateTasks` item schema structural
Updated `src/lib/ai/tool-definitions.ts`:
- Extended `ToolParameter.items` typing to support nested schema (`properties`, `required`, nested `items`).
- Replaced `bulkCreateTasks.tasks.items: { type: "object" }` with explicit object properties:
  - `title` (required)
  - `assignees`, `tags`, `status`, `priority`, `description`, `dueDate`, `dueTime`, `startDate`
  - `source_entity_type`, `source_entity_id`, `source_sync_mode`

Result:
- Source metadata for `bulkCreateTasks` is now machine-structured in schema, not only mentioned in prose.

---

## Validation Performed
- Ran targeted lint after P1 fix:
  - `npm run lint -- src/app/actions/ai-search.ts`
  - File still has pre-existing lint issues (`no-explicit-any`, etc.), not specific to this fix path.
- Ran targeted lint after P2 fix:
  - `npm run lint -- src/lib/ai/tool-definitions.ts`
  - Passed.

---

## Notes
- No migration execution was performed as part of this review/fix pass.
- `src/app/actions/tables/row-actions.ts` remained unchanged.
