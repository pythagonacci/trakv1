# Pre-Launch Feature & Data Consistency Audit — Trak

**Purpose**: Use this prompt to systematically find bugs, input/output mismatches, and display-vs-database inconsistencies before launch. The audit is tailored to Trak’s architecture: Next.js 16, Supabase, server actions, React Query, and block/tab/table/task/timeline/properties features.

**How to use**: Run this as a checklist (yourself or with an AI agent). For each section, trace code paths, compare types and payloads, and document any mismatches or missing error handling.

---

## 1. Architecture Quick Reference

- **Data layer**: Supabase (Postgres). Tables include `blocks`, `tabs`, `projects`, `clients`, `client_tabs`, `client_tab_blocks`, `tables`, `table_fields`, `table_rows`, `table_views`, `table_comments`, `task_items`, `entity_properties`, `entity_links`, `workspace_members`, and others.
- **Server**: Next.js App Router. Server actions in `src/app/actions/` (e.g. `block.ts`, `client.ts`, `tab.ts`, `client-tab.ts`, `client-tab-block.ts`, `tables/*`, `tasks/*`, `timelines/*`, `properties/*`, `entity-properties.ts`). API routes in `src/app/api/` (e.g. `/api/blocks/tab`, `/api/tables/bootstrap`, `/api/entities/properties`, `/api/files/batch-urls`).
- **Client**: React 19, React Query (TanStack) in `src/lib/hooks/` (e.g. `use-tab-data.ts`, `use-table-queries.ts`, `use-property-queries.ts`, `use-task-queries.ts`, `use-timeline-queries.ts`). Query keys in `src/lib/react-query/query-client.ts`.
- **Types**: `src/types/` (`table.ts`, `properties.ts`, `task.ts`, `timeline.ts`, `block-reference.ts`, etc.). Block type from `@/app/actions/block`; tab from `@/app/actions/tab`.
- **Flow**: Pages often pass server-fetched data as `initialData`/`initialBlocks`/`initialFileUrls`/`initialBlockPropertiesById`; hooks use that only when cache is empty, then refetch via API or server actions. Mutations call server actions and invalidate/update React Query cache.

---

## 2. Server Action Return Shape Consistency

**Goal**: Every caller expects either `{ data: T }` or `{ error: string }`. Find actions that return a different shape or inconsistent keys.

**Check**:

1. **All actions in `src/app/actions/`**  
   - Ensure success is always `return { data: ... }` and failure `return { error: string }`.  
   - Search for `return {` in action files and confirm no `return { success: true }`, `return { result }`, or mixed shapes.

2. **Call sites**  
   - Grep for `"error" in result` and `"data" in result`.  
   - For each, confirm the action actually returns that shape (and that `result.data` / `result.error` types match usage).

3. **Edge cases**  
   - Actions that return `{ data: null }` (e.g. some tag-actions): ensure callers handle `data === null` and don’t treat it as an error.

**Files to audit**: All under `src/app/actions/` (including `blocks/`, `properties/`, `tables/`, `tasks/`, `timelines/`).

---

## 3. API Route Response Shape vs Client Expectation

**Goal**: API routes return JSON; hooks/components parse them. Ensure response shape and status codes match what the client expects.

**Check**:

1. **`/api/blocks/tab`**  
   - Route returns `NextResponse.json({ data: Block[] })?`  
   - `useTabBlocks` in `use-tab-data.ts` does `json.data || []`. Confirm the route always returns `{ data: ... }` on success and that `json.error` is set on failure.

2. **`/api/tables/bootstrap`**  
   - Route returns `{ table, fields, view, rows, totalRows, hasMore, nextOffset }`.  
   - `useTableBootstrap` in `use-table-queries.ts` uses `payload` from `response.json()`. Confirm the client uses exactly these keys (no typos like `totalRow` or `row` instead of `rows`).

3. **`/api/entities/properties`**  
   - GET expects `entityType`, `ids`, `workspaceId` query params; returns `{ data: Record<string, EntityProperties> }`.  
   - `useEntitiesProperties` in `use-property-queries.ts` builds params and expects `json.data`. Confirm param names and that `buildEntityPropertiesFromRows` in `entity-properties` produces the same `EntityProperties` shape that `property-field-dropdown.tsx` and other UI expect (e.g. `priorities`, `statuses`, `priority`, `status`).

4. **`/api/files/batch-urls`**  
   - Returns a map of fileId → URL.  
   - `useBatchFileUrls` expects `json` to have that shape. Confirm the route returns a single object keyed by id, not an array.

5. **`/api/tabs/project`**  
   - Used by `useProjectTabs`; expect `{ data: TabWithChildren[] }`. Verify route and type alignment.

6. **Error responses**  
   - All API routes: on error, return `{ error: string }` and appropriate status (401, 403, 404, 500).  
   - Clients use `!response.ok || json?.error`. Ensure no success path sets `response.ok` with an `error` field or vice versa.

---

## 4. Block Content: Write vs Read and Display

**Goal**: Block content is stored in `blocks.content` (and `client_tab_blocks.content` for client tabs). Ensure every block type writes a content shape that the same (or another) code path reads and renders correctly.

**Check**:

1. **Per block type** (text, link, image, pdf, video, gallery, embed, file, task, table, timeline, chart, section, divider):  
   - **Write**: Where is `updateBlock({ blockId, content: ... })` or `createBlock` called? What exact `content` object is sent (e.g. `{ fileId }`, `{ url }`, `{ items: [...] }`)?  
   - **Read**: In the block component (e.g. `image-block.tsx`, `pdf-block.tsx`), what does it read from `block.content`?  
   - **Match**: Confirm the keys and types (string, array, nested object) written are the same as those read. No `content.fileId` write with `content.file_id` read, no `content.items` vs `content.images`.

2. **Table block**  
   - Content has `tableId`. Creation flow in `createBlock` for type `table` creates a table and sets `content = { tableId }`.  
   - Table block and table hooks load by `tableId`. Confirm the same id is used everywhere and that a missing `tableId` is handled (no silent blank table).

3. **Task block**  
   - Task items live in `task_items`; block content may have config. Confirm task block reads task items from the correct source (query/action) and that creating/updating a task block creates/updates task items in DB with correct `task_block_id`.

4. **Client tab blocks**  
   - Same audit for `client_tab_blocks` and `updateClientTabBlock`: content shape written in client tab UI vs content shape read in client tab block renderer.

5. **Block comments**  
   - Stored inside `blocks.content._blockComments` or similar. Verify the path used when saving (e.g. client-comments route) matches the path used when reading in block-comments UI.

---

## 5. Database Write vs Schema and Types

**Goal**: Inserts/updates use the correct columns and value types; no missing required columns or wrong types that could cause DB errors or silent wrong data.

**Check**:

1. **Supabase writes**  
   - For each `.insert()` and `.update()` in `src/app/actions/` and `src/app/api/`, list the payload keys.  
   - Confirm column names match DB (snake_case vs camelCase if applicable).  
   - Confirm required columns (e.g. `workspace_id`, `project_id`, `tab_id`) are always set.  
   - Confirm enums (e.g. field types, status, priority) use values that exist in DB/type definitions.

2. **Types vs DB**  
   - In `src/types/table.ts`, `properties.ts`, `task.ts`, `timeline.ts`: do the types reflect the actual DB/API shape?  
   - e.g. `EntityProperties` and `SetEntityPropertiesInput`: do they align with `entity_properties` table and `setEntityProperties` / `getEntityProperties` payloads?

3. **JSONB columns**  
   - `blocks.content`, `table_rows.data`, view `config`, etc. Document the expected JSON shape for each. Ensure code that builds these objects doesn’t inject undefined or non-serializable values that could break storage or reads.

---

## 6. Properties System: End-to-End

**Goal**: Entity properties (status, priority, assignee, due date, tags, links) are written and read consistently across server actions, API, hooks, and UI.

**Check**:

1. **Entity types**  
   - Used in `entity_properties` and `entity_links`: e.g. `block`, `task`, `table_row`, `timeline_event`.  
   - Every place that writes or reads by `entity_type` + `entity_id` must use the same string (same casing, no typo).

2. **Field names and value shapes**  
   - `property-field-dropdown.tsx` uses `buildPriorityDrafts` / `buildStatusDrafts` and expects `direct.priorities` / `direct.statuses` arrays or fallback `direct.priority` / `direct.status`.  
   - Trace back: `getEntityProperties` / `buildEntityPropertiesFromRows` and `/api/entities/properties` + `buildEntityPropertiesFromRows`.  
   - Confirm the shape written to DB (or returned from `buildEntityPropertiesFromRows`) matches what `buildPriorityDrafts` / `buildStatusDrafts` expect (including `field_name`, `value`, valid enum values).

3. **Set entity properties**  
   - `setEntityProperties` / `useSetEntityProperties`: input shape (e.g. `SetEntityPropertiesInput`) must match what the action and DB expect.  
   - After a successful set, cache invalidation: `entityProperties(entityType, entityId)` and any bulk keys used by `useEntitiesProperties` should be invalidated so the UI shows the new value.

4. **Tags and links**  
   - Add/remove tag and create/remove entity link: same check — input/output and cache invalidation.

---

## 7. Tables: Rows, Cells, and Sync

**Goal**: Table rows and cell values are written correctly to `table_rows` and optionally synced to block content; filters/sorts and views use the same field ids and value types.

**Check**:

1. **Row and cell writes**  
   - `updateCell`, `updateRow`, bulk actions: payload (e.g. `data` field, field ids) must match `table_rows.data` JSONB and field definitions.  
   - Ensure `source_entity_type` / `source_entity_id` / `source_sync_mode` are set and used correctly when rows are linked to blocks or other entities.

2. **Sync to block**  
   - `syncTableRowEditToBlock` (and any reverse sync): confirm the block content shape written matches what the block or table block expects when reading.

3. **Formulas and rollups**  
   - Formula result type and stored/displayed value type (number, text, boolean, date).  
   - Rollup source field and aggregation: input/output types and where they’re read in the UI (e.g. formula-cell, rollup-cell).

4. **Views and filters**  
   - View `config.filters` and `config.sorts`: filter condition shape (e.g. `fieldId`, `operator`, `value`) must match what the bootstrap/query-actions and UI use.  
   - No mismatch between client-side filter types and server-side `applyServerFilters` / `applyFilters`.

---

## 8. React Query: Cache Keys and Invalidation

**Goal**: After any mutation that changes data, the right queries are invalidated or updated so the UI shows fresh data without stale or wrong state.

**Check**:

1. **Mutation → invalidation**  
   - For each mutation in hooks (e.g. `useCreateTable`, `useUpdateRow`, `useSetEntityProperties`, block create/update from tab-canvas):  
   - List which server action or API is called.  
   - List which query keys are invalidated or updated (`invalidateQueries`, `setQueryData`).  
   - Confirm that every place that displays that data is covered by one of those keys (e.g. `tabBlocks(tabId)` after block create/update/delete, `entityProperties(entityType, entityId)` after set entity properties).

2. **Optimistic updates**  
   - If any mutation does optimistic update with `setQueryData`, confirm the rolled-back shape on error matches the previous data shape and that no duplicate or wrong key is used.

3. **Bulk vs single key**  
   - `useEntitiesProperties` uses a key that includes many entity ids. When one entity’s properties change, is the bulk key invalidated or only the single-entity key? If only single-entity, ensure the bulk query doesn’t serve stale data for that entity (e.g. shared key or invalidation of the list key when any entity in the list is updated).

---

## 9. Initial Data vs Refetched Data Shape

**Goal**: Server-passed `initialBlocks`, `initialFileUrls`, `initialBlockPropertiesById`, etc., have the same shape as the data returned by the hook’s `queryFn` (API or action). Otherwise, the first render can be correct and a refetch can “break” the UI or vice versa.

**Check**:

1. **Tab page**  
   - Page fetches blocks (and optionally file URLs, block properties) and passes to `TabCanvasWrapper`.  
   - `useTabBlocks(tabId, initialBlocks)` and `useBatchFileUrls(fileIds, initialFileUrls)` and `useEntitiesProperties(..., initialBlockPropertiesById)` (or equivalent).  
   - Compare: shape of server-fetched blocks vs `/api/blocks/tab` response `data`; server-fetched file URLs vs `/api/files/batch-urls`; server-fetched entity properties vs `/api/entities/properties` and `getEntityProperties`.  
   - Align so that when the hook switches from initial to refetched data, the component receives the same structure (e.g. same block content keys, same file url map, same EntityProperties shape).

2. **Table bootstrap**  
   - If any page preloads table data and passes it in, its shape must match `useTableBootstrap` / `/api/tables/bootstrap` response.

---

## 10. Types and Function Signatures

**Goal**: No caller passes the wrong type or shape to an action/API/hook; no callee assumes a shape that isn’t guaranteed by the type.

**Check**:

1. **Action parameters**  
   - For each exported action, the first argument (or options object) type.  
   - Find all call sites and ensure they pass the right keys and types (e.g. `blockId` string, `entityId` string, `workspaceId` string).  
   - Pay attention to optional vs required (e.g. `authContext` optional; `content` optional in updateBlock).

2. **Hook parameters**  
   - `useEntityProperties(entityType, entityId)`, `useTable(tableId)`, etc.: ensure `entityId`/`tableId` are always defined when the query is enabled, or that the hook correctly handles undefined (e.g. `enabled: Boolean(entityId)`).

3. **Generic types**  
   - e.g. `Record<string, EntityProperties>`, `Block[]`, `TableRow[]`: ensure API/action return types are actually assignable to these where used (no `any` that hides mismatches).

---

## 11. Error Handling and Loading States

**Goal**: Failed actions/API calls are surfaced to the user where appropriate; loading states don’t flash wrong content.

**Check**:

1. **Mutations**  
   - After `mutation.mutateAsync` or action call, code checks `"error" in result` and shows a toast or message.  
   - No silent failure where the UI assumes success and updates optimistically while the server returned an error.

2. **Queries**  
   - Components that use `data` from a query handle `isLoading` / `isPending` and `isError` where it matters (e.g. don’t render a table with `data?.rows` when `isError` and show nothing).

3. **Missing data**  
   - Optional relations: e.g. block with `content.tableId` but table deleted. Confirm the table block (or table hooks) handle missing table gracefully (error message or empty state), and don’t throw or render garbage.

---

## 12. Feature-Specific Spot Checks

**Goal**: High-value features are explicitly verified for correct read/write and display.

**Check**:

1. **Tasks**  
   - Create task, update title/status/dates/assignee/tags, reorder, delete.  
   - Confirm task items in DB and in UI stay in sync; confirm task block content and task_items relationship.

2. **Timelines**  
   - Create/update events, dependencies, references; confirm timeline event fields and dependency links are written and read with the same ids and structure.

3. **Files and attachments**  
   - Upload to block, attach to row/cell: confirm `file_records` and storage path, and that batch URL resolution returns URLs for exactly those file ids used in blocks/rows.

4. **Client page**  
   - Public client tab: data loaded with public token; only allowed blocks/tabs visible; comments (if any) follow same content path as dashboard.

5. **Integrations**  
   - Slack, Shopify, etc.: any write from the integration (e.g. sync job, webhook) uses the same entity/table/block shapes as the main app; no separate code path that writes a different schema.

---

## 13. Output of the Audit

For each section, document:

- **OK**: No issues found.  
- **FIX**: List file:line or area and the specific mismatch (e.g. “Action X returns `result` but caller expects `data`”, “Block content key `file_id` read but write uses `fileId`”).  
- **TODO**: Suggest a concrete fix (e.g. normalize return shape, align key names, add invalidation).

Run the audit section by section; fix or ticket each FIX; then re-run the relevant section to confirm. Use this prompt with the codebase so that all file paths, hook names, and type names stay accurate.
