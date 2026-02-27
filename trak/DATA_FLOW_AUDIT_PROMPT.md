# Data Flow & Format Consistency Audit — Trak

**Purpose**: One goal — ensure data is **received, sent, and updated as expected** everywhere: across all blocks, `entity_properties`, every server action, every AI tool (definitions + executor), bulk actions, and RPCs. Find missing data expectations, format mismatches, and drift from the database.

**Audience**: A coding agent with full codebase access. The agent should trace code paths, compare payloads and types, and **ask you to run SQL against the remote database** whenever it needs the real-time source of truth.

---

## Critical instruction: use the live database as source of truth

**You must not rely only on local schema files or migrations.** The deployed database is the authority. Whenever the agent needs to verify:

- Column names, types, and nullability for `entity_properties`, `task_items`, `table_rows`, `table_fields`, `blocks`, `client_tab_blocks`, and any table involved in properties or AI writes
- Existence and signatures of RPCs (e.g. `create_task_full`, `update_task_full`, `bulk_update_rows`, `bulk_update_task_items`, `create_table_full`, `update_table_full`, `bulk_update_rows_by_field_names`)
- Triggers, constraints, or views that affect how data is written or read

**the agent MUST ask the user to run the relevant SQL against the remote DB** and paste the results. Example asks:

- “Please run this against your remote Supabase (or production) and paste the result:  
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'entity_properties' ORDER BY ordinal_position;`”
- “Please run and paste:  
  `SELECT routine_name, pg_get_function_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND routine_name IN ('create_task_full','update_task_full');`”

The audit should explicitly list “SQL to run” items and wait for results before concluding on schema-dependent sections.

---

## What to audit for

1. **Missing data expectations**  
   One side expects a field or shape and the other never sends it (e.g. UI expects `priorities[]` with `field_name`/`value`, but an RPC or action returns only `priority`; or a tool sends `status` while the consumer expects `statuses`).

2. **Format mismatches**  
   Same concept, different format:
   - **Status**: e.g. `in-progress` (hyphen) in tool definitions vs `in_progress` (underscore) in DB and `src/types/properties.ts`. Every path that normalizes (e.g. `toStatuses` in super-actions, `normalizeUniversalPropertyValue` in tables) must be consistent with what the DB and `entity_properties` store.
   - **Priority**: same idea (e.g. `none` for subtasks vs tasks; canonical set `low|medium|high|urgent`).
   - **Named fields**: `status`/`priority` (single) vs `statuses`/`priorities` (array of `{ field_name, value }`). Tool definitions, executor, RPCs, and `buildEntityPropertiesFromRows` must agree on when to use which and the exact shape.
   - **IDs vs names**: e.g. assignees by `id` vs by `name`; field updates by `fieldId` vs `fieldName` in table row updates.

3. **Database alignment**  
   - All inserts/updates use column names and value types that match the **live** schema (including JSONB shapes for `entity_properties.value`, `table_rows.data`, `blocks.content`).
   - Enums (status, priority, field_type) match DB constraints and application types.

4. **Properties and AI creation**  
   This is a high-priority surface. Check:
   - **AI tools** (`tool-definitions.ts`): parameter shapes for `createTaskItem`, `updateTaskItem`, `bulkCreateTasks`, `bulkUpdateTaskItems`, `createTimelineEvent`, `updateTimelineEvent`, table row create/update, and any tool that sets status/priority/assignees/tags/due date.
   - **Tool executor** (`tool-executor.ts`): how it maps tool args to `createTaskFullRpc` / `updateTaskFullRpc` / `createTaskItem` / `updateTaskItem` and to table/timeline actions. Confirm it sends the same shapes the RPCs and actions expect (e.g. `statuses`/`priorities` arrays with `field_name` and canonical `value`).
   - **RPCs**: `create_task_full`, `update_task_full`, `bulk_update_task_items` — parameters and return shape vs what the executor and UI expect.
   - **entity_properties**: reads via `getEntityProperties` / `buildEntityPropertiesFromRows` and `/api/entities/properties`; writes via `setEntityProperties` and any RPC/trigger that writes to `entity_properties`. Confirm the built `EntityProperties` shape (e.g. `priorities`, `statuses`, `priority`, `status`) matches what `property-field-dropdown.tsx`, `property-badge.tsx`, and other UI and hooks expect.

---

## Scope (where to look)

### 1. Blocks

- **Content shape**: For each block type (text, link, image, pdf, video, gallery, embed, file, task, table, timeline, chart, section, divider), confirm every **write** (e.g. `updateBlock`, `createBlock`, client tab block updates) uses the same content keys and types as every **read** (block components and hooks). No `content.fileId` vs `content.file_id`, no `content.items` vs `content.images`.
- **Task block**: Content and relation to `task_items`; creation/update of task block vs creation of task items and any sync to `entity_properties`.
- **Table block**: `content.tableId` and how table data is loaded; no mismatch between block content and table hooks/API.

### 2. entity_properties

- **Schema**: Confirm with DB query that `entity_properties` columns (e.g. `entity_type`, `entity_id`, `workspace_id`, `field_name`, `field_type`, `value` (JSONB), `entity_subtype` if present) match what the code reads and writes.
- **Entity types**: Every use of `entity_type`/`entity_id` (e.g. `block`, `task`, `subtask`, `table_row`, `timeline_event`) is consistent in actions, API, and RPCs.
- **Value shape**: What is stored in `value` (string, object, array) for status, priority, assignee, due_date, tags — and that `buildEntityPropertiesFromRows` and `setEntityProperties` (and any RPC writing to this table) use the same shape.
- **Named vs single**: How `priorities`/`statuses` arrays and single `priority`/`status` are derived and that UI and AI tools agree.

### 3. Server actions

- **Return shape**: Every action returns either `{ data: T }` or `{ error: string }`. No mixed shapes (`result`, `success`, etc.). All call sites check `"error" in result` and use `result.data` or `result.error` accordingly.
- **Parameters**: For every exported action in `src/app/actions/` (including `entity-properties.ts`, `tasks/*`, `tables/*`, `timelines/*`, `properties/*`, `block.ts`, etc.), confirm that callers (UI, hooks, tool executor) pass the same keys and types the action expects (e.g. `taskId`, `entityId`, `workspaceId`, optional `content`, optional `authContext`).
- **DB writes**: Every `.insert()` and `.update()` uses column names and value types that match the **live** DB; required columns are always set; enums match.

### 4. AI: tool-definitions.ts and tool-executor.ts

- **Definitions**: For every tool that creates/updates entities (tasks, subtasks, table rows, timeline events, blocks, etc.), the parameter schema (types, enums, required/optional) must match what the executor and underlying actions/RPCs expect. Pay special attention to:
  - `createTaskItem`, `updateTaskItem`, `bulkCreateTasks`, `bulkUpdateTaskItems`: `status` vs `statuses`, `priority` vs `priorities`, and the exact enum values (e.g. if DB stores `in_progress`, definitions and executor must normalize to that).
  - Table row create/update tools: field identifiers (id vs name), canonical status/priority values.
  - Timeline event create/update: same status/priority/assignee shape as tasks where applicable.
- **Executor**: For each such tool, trace the mapping from tool args to the actual call (e.g. `createTaskFullRpc` vs `createTaskItem`). Confirm:
  - Status/priority are normalized to the format the RPC or action expects (e.g. `toStatuses` / `toPriorities` in super-actions).
  - Assignees: resolution by name vs id and that the payload matches what the RPC/action expects.
  - Return shape from RPC/action is what the executor returns to the AI (and that undo/cache invalidation use the same IDs/shapes).

### 5. Bulk actions

- **Tasks**: `bulkUpdateTaskItems`, `bulkUpdateTaskItemsRpc`, `bulkMoveTaskItems`, `bulkSetTaskAssigneesRpc`, `duplicateTasksToBlockRpc`. Input shape (e.g. `taskIds` + `updates` with status/priority/assignees) must match tool definitions and executor, and output shape must be consistent.
- **Tables**: `bulkUpdateRows`, `bulkInsertRows`, `bulkDeleteRows`, `bulkDuplicateRows` and their RPCs (`bulk_update_rows`, etc.). Payload (e.g. `updates` keyed by field id, universal property normalization via `normalizeUniversalPropertyValue`) must match `table_rows.data` and field types; confirm RPC parameter names and types with the DB.
- **Timelines**: Any bulk event create/update and their effect on `entity_properties` or event fields.

### 6. RPCs

- List every RPC used in the codebase (e.g. from grep for `supabase.rpc(`). For each:
  - **Signature**: Ask the user to run SQL to get the function signature (argument names and types) from the remote DB and confirm the code passes arguments with the correct names (e.g. `p_task_block_id`, `p_status`, `p_statuses`) and types (JSONB, text[], etc.).
  - **Return value**: What the RPC returns (single row, array, etc.) and how the code unwraps it (e.g. `unwrapRpcData`). Confirm callers don’t expect a different shape.
  - **Side effects**: If the RPC writes to `entity_properties` or other tables, confirm the written shape matches what the rest of the app reads.

### 7. API routes

- **Response shape**: Each route (e.g. `/api/blocks/tab`, `/api/tables/bootstrap`, `/api/entities/properties`, `/api/files/batch-urls`) returns a JSON shape that matches what the client hooks expect (e.g. `{ data }` on success, `{ error }` on failure; same key names and nesting).
- **Entity properties API**: GET expects `entityType`, `ids`, `workspaceId` and returns `{ data: Record<string, EntityProperties> }`. Confirm `buildEntityPropertiesFromRows` output matches the `EntityProperties` type and that UI (e.g. property dropdowns, badges) consumes it correctly.

### 8. Types and single source of truth

- **Status / Priority**: `src/types/properties.ts` defines `Status`, `Priority`, `EntityProperties`. Confirm that:
  - Tool definitions and executor use enums that normalize to these (e.g. `in-progress` → `in_progress` before hitting DB or RPC).
  - `src/lib/tables/universal-property.ts` (e.g. `normalizeCanonicalStatusValue`, `normalizeCanonicalPriorityValue`) is used wherever table/timeline/task data is written so that DB and UI see one canonical set.
- **EntityProperties**: All consumers (API, hooks, property UI) use the same interface; no ad-hoc shapes.

### 9. React Query and cache invalidation

- After any mutation that changes entity properties, task items, table rows, or block content, the correct query keys are invalidated (or updated) so the UI does not show stale data. No “one side updated, the other still shows old status/priority” due to missing invalidation.

---

## Output format

For each area (blocks, entity_properties, server actions, AI tools, bulk actions, RPCs, API routes, types, cache):

- **OK**: No issues found; data sent/received/updated consistently.
- **FIX**: File (and line/area) + short description of the mismatch (e.g. “Tool definition uses `in-progress`, RPC expects `in_progress`; normalization missing in executor for bulkCreateTasks”).
- **SQL requested**: List the exact SQL the user should run against the remote DB and what to confirm from the result.

Keep the audit **comprehensive**: the goal is to catch every place where data format or expectations diverge, especially around properties and AI-driven creation/updates. Prefer asking for one or two DB queries and then concluding, rather than assuming schema from migrations alone.
