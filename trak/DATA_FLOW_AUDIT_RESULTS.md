# Data Flow & Format Consistency Audit — Results

**Audited**: February 2026
**Method**: Full code trace (tool-definitions → executor → actions → RPCs) + live DB schema queries
**Status**: Read-only audit — updated with remote DB verification on February 27, 2026

---

## Quick Summary

| Severity | Count | Topic |
|---|---|---|
| Critical | 0 | No currently confirmed critical issues |
| High | 3 | Task updates/bulk updates never sync status/priority to entity_properties; multi-assignee data truncated |
| Medium | 3 | Stale caches after tag/assignee mutations; latent `toStatuses` bug |
| Low | 2 | Misleading TypeScript type; duplicate `invalidateQueries` calls |

---

## Critical Issues

### CRIT-1: Three table RPCs called by the code don't exist in the database

**Verification update (February 27, 2026)**: **Not reproducible on remote DB**.

Remote query results confirm all three RPCs exist with expected signatures:

| RPC name | Signature (remote) | Status |
|---|---|---|
| `update_table_full` | `p_table_id uuid, p_title text, p_description text, p_updated_by uuid, p_add_fields jsonb, p_update_fields jsonb, p_delete_fields jsonb, p_insert_rows jsonb, p_update_rows jsonb, p_delete_row_ids jsonb` | Present |
| `update_table_rows_by_field_names` | `p_table_id uuid, p_filters jsonb, p_updates jsonb, p_limit integer, p_updated_by uuid, OUT updated integer, OUT row_ids uuid[]` | Present |
| `bulk_update_rows_by_field_names` | `p_table_id uuid, p_rows jsonb, p_limit integer, p_updated_by uuid` | Present |

**Conclusion**: This should be treated as **resolved/stale** for the current remote environment.

**Recommended follow-up (optional)**:
Run one end-to-end call for each AI tool path (`updateTable`, `updateTableRowsByFieldNames`, `bulkUpdateRowsByFieldNames`) to confirm runtime behavior, not just function existence.

---

## High Severity Issues

### HIGH-1: Task status/priority entity_properties are never updated after an AI task update

**Background**: Status and priority for tasks live in two places:
- `task_items.statuses` / `task_items.priorities` — the source of truth for the task list UI
- `entity_properties` — the secondary index used by the Everything view, property badges, and cross-entity queries

When a task is **created** via AI, `syncTaskEntityPropertiesAfterCreate` is called to write status/priority into `entity_properties`. This is correct.

When a task is **updated** via AI, `updateTaskFullRpc` is called. The `update_task_full` RPC updates `task_items.statuses` and `task_items.priorities` correctly — but it does **not** write to `entity_properties` for status or priority. The executor also does not call any sync function after `updateTaskFullRpc`.

**What it means**: After any AI-driven task status or priority update:
- The task list shows the correct new status/priority (reads from `task_items`) ✓
- The Everything view, property badges, and any cross-entity query still show the **old** status/priority (reads from `entity_properties`) ✗
- This persists until something else triggers an entity_properties write for that task.

**Files involved:**
- `src/lib/ai/tool-executor.ts` — `updateTaskItem` case, ~line 1498: `updateTaskFullRpc` called, no sync after
- `src/app/actions/tasks/super-actions.ts` — `update_task_full` RPC confirmed to not write status/priority to `entity_properties`

**What needs to be done:**

Option A (recommended): Call `syncTaskEntityPropertiesAfterCreate` after `updateTaskFullRpc` succeeds in tool-executor, just like the create path does:
```typescript
// After updateTaskFullRpc succeeds:
await syncTaskEntityPropertiesAfterCreate({
  taskId: rpcResult.data.id,
  statuses: updatedTask.statuses,
  priorities: updatedTask.priorities,
  // don't pass dueDate/tags/assignees here unless the update touched them
});
```

Option B: Add entity_properties writes for status/priority inside the `update_task_full` DB function itself (mirrors how `create_task_full` handles assignees).

---

### HIGH-2: Bulk task status/priority updates via AI never reach entity_properties

**Background**: Same two-store problem as HIGH-1, but for bulk operations.

`bulk_update_task_items` RPC updates `task_items.statuses` and `task_items.priorities` for all task IDs. Confirmed from the DB function body — it does **not** write to `entity_properties` at all. The executor also calls no sync after `bulkUpdateTaskItemsRpc`.

**What it means**: After an AI bulk status/priority update (e.g. "mark all these tasks as done"):
- The task list reflects the new values ✓
- The Everything view and property badges are permanently stale for all affected tasks ✗

**Files involved:**
- `src/lib/ai/tool-executor.ts` — `bulkUpdateTaskItems` case, ~line 1636: no entity_properties sync
- `src/app/actions/tasks/super-actions.ts` — `bulk_update_task_items` confirmed no entity_properties writes

**What needs to be done:**

After `bulkUpdateTaskItemsRpc` succeeds, iterate over the returned updated tasks and call `setEntityProperties` for each, or add a batch sync helper. At minimum, sync status and priority for the affected task IDs:
```typescript
// After bulkUpdateTaskItemsRpc succeeds:
for (const taskId of successfulTaskIds) {
  await syncTaskEntityPropertiesAfterCreate({
    taskId,
    statuses: updates.statuses,
    priorities: updates.priorities,
  });
}
```
Or add an `entity_properties` update loop inside the `bulk_update_task_items` RPC (more efficient — single DB round-trip).

---

### HIGH-3: `update_task_full` truncates multi-assignee data in entity_properties

**What it means**: When `update_task_full` is called with `p_assignees_set = true` and multiple assignees, it correctly writes all assignees to the `task_assignees` table. However, it only writes the **first** assignee into `entity_properties`, as a single object `{id, name}`:

```sql
-- In update_task_full RPC:
select * into v_primary_assignee
from jsonb_array_elements(p_assignees) limit 1;   -- only takes first

insert into entity_properties (..., 'Assignee', 'assignee',
  jsonb_build_object('id', ..., 'name', ...)        -- single object, not array
)
```

Contrast with `create_task_full` which stores the full array:
```sql
-- In create_task_full RPC:
values (..., 'Assignee', 'assignee', v_assignee_payload)  -- full [{id,name},...]
```

The reader (`extractAssigneeIdsFromValue`) handles the single-object format and won't crash — but for tasks with multiple assignees, only the first assignee appears in any UI that reads from `entity_properties` (Everything view, property badges). The task detail panel (which reads from `task_assignees` directly) will still show all assignees correctly.

This also means that after an AI update sets two assignees on a task, the entity_properties entry gets overwritten from a correct array to a single-person object.

**Files involved:**
- `update_task_full` DB function — the `p_assignees_set` block

**What needs to be done:**

Fix the RPC to store all assignees as an array, matching `create_task_full`:
```sql
-- Replace the current single-object insert with:
insert into entity_properties (workspace_id, entity_type, entity_id, field_name, field_type, value)
values (
  v_workspace_id, 'task', p_task_id, 'Assignee', 'assignee',
  coalesce(p_assignees, '[]'::jsonb)   -- full array, same as create_task_full
)
on conflict (entity_type, entity_id, field_name)
do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
```

---

## Medium Severity Issues

### MED-1: `toStatuses()` silently rejects the canonical `"in_progress"` status

**File**: `src/app/actions/tasks/super-actions.ts`, lines 31–35

The `toStatuses` helper accepts the hyphen form `"in-progress"` but rejects the canonical underscore form `"in_progress"`:

```typescript
function toStatuses(status?: string | null): any {
  if (!status) return [];
  // only accepts "in-progress" (hyphen), not "in_progress" (underscore):
  if (status !== "todo" && status !== "in-progress" && status !== "blocked" && status !== "done") return [];
  const validStatus = status === "in-progress" ? "in_progress" : status;
  return [{ field_name: "Status", value: validStatus }];
}
```

The canonical `Status` type is `"in_progress"` (underscore). Today the AI task tool definitions expose `"in-progress"` (hyphen), so the current path works. But:
- Any future code or test that calls `createTaskFullRpc({ status: "in_progress" })` without also providing a `statuses` array will silently get status set to empty.
- The inconsistency between task tools (`"in-progress"`) and timeline tools (`"in_progress"`) is an ongoing source of confusion.

**What needs to be done:**

Fix `toStatuses` to accept both forms, and standardize all AI tool definitions to the canonical `"in_progress"`:
```typescript
function toStatuses(status?: string | null): any {
  if (!status) return [];
  const normalized = status === "in-progress" || status === "in progress"
    ? "in_progress"
    : status;
  if (normalized !== "todo" && normalized !== "in_progress" && normalized !== "blocked" && normalized !== "done") return [];
  return [{ field_name: "Status", value: normalized }];
}
```
Then update tool-definitions.ts task tool enums from `"in-progress"` to `"in_progress"` to match canonical form and all other tools.

---

### MED-2: `useAddTag` and `useRemoveTag` don't invalidate the bulk entity_properties cache

**File**: `src/lib/hooks/use-property-queries.ts`

After a tag is added or removed, the hooks invalidate the per-entity cache key:
```typescript
qc.invalidateQueries({ queryKey: queryKeys.entityProperties(entityType, entityId) });
```

But they do **not** invalidate the bulk cache:
```typescript
// Missing:
qc.invalidateQueries({ queryKey: ["entitiesProperties", entityType, workspaceId] });
```

**What it means**: Entity lists that load properties in bulk via `useEntitiesProperties` (e.g., task lists, board views) will show stale tags until the next full page invalidation. The per-entity property panel will update immediately, but the list view won't.

**What needs to be done:**

Add the bulk cache invalidation to both `useAddTag` and `useRemoveTag` `onSuccess` handlers, passing the `workspaceId` (which needs to be added as a parameter to those hooks if not already present).

---

### MED-3: `useUpdateTaskItem`, `useTaskAssignees`, and `useTaskTags` have no server sync after mutation

**File**: `src/lib/hooks/use-task-queries.ts`

These three hooks use optimistic updates (`onMutate`) and have **no** `onSettled` or `onSuccess` invalidation:

```typescript
// useUpdateTaskItem — comment says "No invalidation needed":
onMutate: async ({ taskId, updates }) => { ... optimistic patch ... },
onError: ...,
// no onSettled/onSuccess
```

**What it means**: If the server applies any transformation the client didn't anticipate — a DB trigger normalizing the status, a server action that modifies additional fields — the client cache will permanently diverge from the DB until the user refreshes or a different mutation triggers a broader invalidation. This also means failed mutations leave the optimistic state in the cache even after rollback in some edge cases.

**What needs to be done:**

Add `onSettled` (fires on both success and error) to refetch from server:
```typescript
onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.items(blockId) }),
```
This is especially important for `useTaskAssignees` since the optimistic update stores names/IDs as a flat string array, which may not match the actual server response shape.

---

### MED-4: Deleting timeline events and table rows leaves orphaned entity_properties rows

**Files**: `src/app/actions/timelines/event-actions.ts` (line 505–513), `src/app/actions/tables/row-actions.ts`

`deleteTimelineEvent`, `deleteRow`, and `bulkDeleteRows` do delete only the primary record in application code, but the DB has cleanup triggers that delete `entity_properties` rows on parent delete (timeline events/table rows).

**Verification update (February 27, 2026)**: Treat this as **resolved/stale** unless trigger deployment drift is found in a specific environment.

**What to keep an eye on:** If an environment is missing the cleanup trigger migration, this issue can reappear there.

---

## Low Severity Issues

### LOW-1: `SetEntityPropertiesInput.workspace_id` is typed as required but is ignored at runtime

**File**: `src/types/properties.ts`, `src/app/actions/entity-properties.ts`

`SetEntityPropertiesInput` declares `workspace_id: string` as a required field. But `setEntityProperties` ignores the passed value — it always derives the workspace from `requireEntityAccess` internally. The DB insert uses the derived value, not the one the caller passed.

**What it means**: Callers passing a wrong `workspace_id` won't see an error — the correct workspace is used anyway. Callers omitting it use `as any` to bypass TypeScript, which hides real type errors elsewhere.

**What needs to be done:**

Change the type to `workspace_id?: string` (optional) to match the actual behavior. Or better: make the implementation actually validate and use the passed value, failing if it doesn't match the derived workspace.

---

### LOW-2: `useAddTag`, `useRemoveTag`, and `useClearEntityProperties` call `invalidateQueries` twice with the same key

**File**: `src/lib/hooks/use-property-queries.ts`

Each of these hooks' `onSuccess` handlers calls the same `invalidateQueries` twice in a row:
```typescript
onSuccess: () => {
  qc.invalidateQueries({ queryKey: queryKeys.entityProperties(entityType, entityId) });
  qc.invalidateQueries({ queryKey: queryKeys.entityProperties(entityType, entityId) }); // duplicate
},
```

No functional impact — React Query deduplicates in-flight refetches — but it's dead code that adds noise.

**What needs to be done:** Remove the duplicate call in each of the three hooks.

---

## Additional Notes from SQL

### `create_table_full` has three overloaded versions in the DB

The three versions have different return column names (`table_id` vs `result_table_id`). The code defensively handles all variants:
```typescript
tableId: payload.table_id ?? payload.result_table_id ?? payload.tableId
```
This works but is fragile. The legacy versions should be dropped from the DB when it's safe to do so (after confirming no other callers rely on them).

### `bulk_update_task_items` still writes to a legacy `status` (text) column

The RPC body contains:
```sql
status = coalesce(p_updates->>'status', status),
```
alongside the current `statuses` JSONB column. If `task_items.status` is intended to be retired, this line should be removed to avoid writing to a column that is no longer read anywhere.

### All status values in entity_properties are canonical

Confirmed from DB query: only `"todo"`, `"in_progress"`, `"done"`, `"blocked"` are stored. No `"in-progress"` (hyphen) values in the DB. The recent normalization work is effective. ✓

### `blocks.content` is NOT NULL in the DB

The `blocks` table enforces `content jsonb NOT NULL`. `client_tab_blocks.content` is nullable. Block write paths must always provide a content value; a missing content would cause a DB constraint error caught at the action level.

---

## Recommended Fix Order

1. **Add entity_properties sync after `updateTaskFullRpc`** (HIGH-1) — one-liner in tool-executor
2. **Fix `update_task_full` RPC to store full assignee array** (HIGH-3) — one-line SQL change
3. **Add entity_properties sync after `bulkUpdateTaskItemsRpc`** (HIGH-2) — loop in executor or RPC-level fix
4. **Fix `toStatuses` to accept both hyphen and underscore** (MED-1) — four-line fix, also update tool-definition enums
5. **Add bulk cache invalidation to `useAddTag`/`useRemoveTag`** (MED-2) — two extra `invalidateQueries` calls
6. **Add `onSettled` to `useUpdateTaskItem`, `useTaskAssignees`, `useTaskTags`** (MED-3)
7. **Fix `SetEntityPropertiesInput.workspace_id` type** (LOW-1)
8. **Remove duplicate `invalidateQueries` calls** (LOW-2)
