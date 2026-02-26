# Chart Tracking Implementation Plan

## 1. Context and goals

### What we're building

Charts in this app are created by the AI: the model runs a search (e.g. `searchTasks`), gets results, normalizes them into rows, and calls `createSpecChartBlock` with a `ChartSpec` and a `rows` array. The block stores that data and renders it via `buildChartData` and `TrakChart`. Today the chart is a **one-time snapshot**: the stored rows never change unless the user edits the block.

We are adding:

1. **Refresh** – Re-run the data source and update the chart with current data.
2. **Two tracking modes** – Control whether the chart stays tied to the initial set of items or keeps including new items that match the original criteria:
   - **Track only these items** – Chart is tied to the exact entities that were in the result when the chart was created (or when the user switched to this mode). Refresh only re-fetches those same entities by ID; we never add new entities that later match the same filters.
   - **Track future items that meet these requirements** – Chart is driven by the stored query. Refresh re-runs the query, so new entities that match the same parameters (e.g. priority, status) appear on the next refresh.
3. **Save as snapshot** – Remove the data source so the chart becomes static (no refresh, no scope switching). Current rows are kept.
4. **UI** – Scope selector with the two labels above; when in “track only these items” mode, show a list of the items being tracked; Refresh and Save as snapshot buttons where applicable.

### Why

- Users want charts to stay up to date (e.g. “tasks by status” should reflect current state).
- Some users want a fixed cohort (e.g. “only these 20 tasks”) without pulling in future tasks that match the same filters, to avoid noise and unnecessary data.
- Giving an explicit “save as snapshot” option lets users lock a chart when they’re done with live/refresh behavior.

### Out of scope for this plan

- Migrating existing chart blocks (dev environment, no users; treat missing `dataSource` as snapshot).
- Charts built from mixed sources (e.g. tasks + timeline in one chart); those remain snapshot-only (no `dataSource`).
- True real-time / push updates; “live” here means refresh-on-demand (and optionally future: refresh on interval or tab focus).

---

## 2. Codebase reference

The implementing agent should use the codebase to resolve types, APIs, and file paths. Key areas:

- **Chart types and content** – `trak/src/types/chart.ts` defines `SpecChartBlockContent` (spec, rows, universeTotal, chartType, title, metadata). `ChartRow` is in `trak/src/lib/charts/chartSpec.ts` (id + index signature). No `dataSource` exists yet.
- **Chart creation** – `trak/src/app/actions/chart-actions.ts`: `createSpecChartBlock` takes tabId, spec, rows, universeTotal, title, prompt, and optional simulation fields. It validates the spec with `parseChartSpec` / `applySpecFallbacks` from `trak/src/lib/charts/chartSpec.ts`, builds content, and calls `createBlock`. `updateChartBlock` in the same file updates block content via `updateBlock`.
- **Chart rendering** – `trak/src/components/blocks/ChartBlock.tsx`: `SpecChartBlock` reads `block.content` as `SpecChartBlockContent`, builds chart data with `buildChartData` from `trak/src/lib/charts/transform.ts`, and renders `TrakChart` and `ChartConfigPanel`. No refresh or scope UI yet.
- **Transform** – `trak/src/lib/charts/transform.ts`: `buildChartData` accepts `focusRows` (ChartRow[]), `universeTotal`, and `spec`; it expects rows to have fields matching the spec (breakdown field, series field if present, measure field). ChartRow is id + arbitrary fields (status, priority, assignee, tags, etc.).
- **Search APIs** – `trak/src/app/actions/ai-search.ts`: `searchTasks`, `searchTimelineEvents`, and table row search (e.g. `searchTableRows` or equivalent) return workspace-scoped results. Signatures and return shapes should be used to define the serializable query params and to implement the normalizer and refresh.
- **Task/table normalization** – `trak/src/lib/ai/workflow-executor.ts` has helpers like `coerceTaskRows`, `normalizeTaskStatusForTable`, `normalizeTaskPriorityForTable`, `toDateOnly`, `extractAssigneeIds` (or similar) that map task-like objects to a consistent row shape (e.g. “Task Title”, Status, Priority, Due Date, Assignee). The chart normalizer should reuse or mirror these so chart rows match what `buildChartData` and the AI expect (e.g. status, priority, assignee, tags as used in the chart spec).
- **Blocks** – Block content is JSON stored on the block; no DB schema change is required for `dataSource`. Use `trak/src/app/actions/block.ts` (or equivalent) for `createBlock` / `updateBlock` if needed.
- **Auth** – Chart actions use `getAuthContext`, `getTabMetadata`, and `checkWorkspaceMembership` so all new actions must run with the same auth context and workspace/tab checks.

---

## 3. Data model

### 3.1 ChartDataQuery (query scope)

A discriminated union describing the query to re-run on refresh. Each variant has a `type` and a `params` object that matches the corresponding search API (serializable only; no functions or non-JSON values).

- **tasks** – Params compatible with the `searchTasks` arguments in `ai-search.ts` (e.g. searchText, status, priority, projectId, tabId, limit, etc.).
- **timeline_events** – Params compatible with `searchTimelineEvents` (e.g. searchText, status, projectId, startDate, endDate, limit, etc.).
- **table_rows** – Params compatible with whatever table-row search the app uses (e.g. tableId, searchText, limit, fieldFilters if applicable).

Exact shapes should be derived from the existing search function signatures; the plan does not mandate specific property names beyond “serializable and matching the API.”

### 3.2 ChartDataSource

One of:

- **Refreshable, query scope** – `mode: "refreshable"`, `scope: "query"`, `query: ChartDataQuery`. Optional: `previousQuery?: ChartDataQuery` for restoring when switching back from fixed to query.
- **Refreshable, fixed scope** – `mode: "refreshable"`, `scope: "fixed"`, `entityType: "task" | "timeline_event" | "table_row"`, `entityIds: string[]`. Optional: `previousQuery?: ChartDataQuery` so the UI can offer “Track future items that meet these requirements” again.
- **Snapshot** – `mode: "snapshot"` or absence of `dataSource`. No refresh, no scope selector.

All of this lives in block content; no new tables or columns.

### 3.3 SpecChartBlockContent

Add an optional field: `dataSource?: ChartDataSource`. If missing, the chart is snapshot-only (current behavior). Existing blocks without `dataSource` require no migration.

---

## 4. Normalizer (search/entity result → ChartRow[])

### 4.1 Purpose

Today the AI turns search results into chart rows in its turn. When we refresh, we re-run the search (or fetch by ID) on the server and get raw API results; there is no AI in the loop. We need a single place that converts those results into the same `ChartRow[]` shape the chart spec and `buildChartData` expect (id plus fields like status, priority, assignee, tags, and any title-like field). That ensures refreshed charts look correct and don’t break the transform.

### 4.2 Location and signature

Add a new module (e.g. under `trak/src/lib/charts/` or next to chart-actions) that exports a function (or a small set of functions) that:

- Accept the **source type** (tasks | timeline_events | table_rows) and the **raw results** (array of task-like, event-like, or table-row-like objects as returned by the existing search or “get by ID” APIs).
- Return **ChartRow[]** with a consistent field set: at least `id`, and the fields used by chart specs (e.g. status, priority, assignee, tags, and a title-like field). Field names and value formats must match what `buildChartData` and the chart spec use (see `chartSpec.ts` and `transform.ts`).

If the app supports universe-normalized charts, the same module (or the caller) may need to support computing a universe total (e.g. count from the same query without limit, or a separate count call); the plan leaves that to the implementer based on how `buildChartData` and `createSpecChartBlock` use `universeTotal`.

### 4.3 Implementation approach

- Reuse existing normalization logic where possible: e.g. status/priority/assignee/tags/date helpers from `workflow-executor.ts` or from the table/task layers. The goal is one canonical mapping from API shape to chart row shape, not a second set of rules.
- The normalizer should not depend on a specific ChartSpec; it should produce a fixed set of fields that chart specs already use (status, priority, assignee, tags, title/task title, etc.). If the chart spec uses different field names, the AI and the normalizer should both use the same canonical names (e.g. as documented in the tool description for `createSpecChartBlock`).
- Add unit tests: given a small fixture (e.g. one or two task-like objects with status, assignees, tags), assert the output is ChartRow[] with the expected keys and value types. Optionally, run that output through `buildChartData` with a simple spec to ensure compatibility.

---

## 5. Server actions

All in or next to `trak/src/app/actions/chart-actions.ts`, with the same auth and membership checks used by `createSpecChartBlock` and `updateChartBlock`.

### 5.1 createSpecChartBlock

- Add an optional parameter: `dataSource?: ChartDataSource` (only refreshable variants; do not pass snapshot).
- When `dataSource` is provided (typically with `scope: "query"` and `query`), persist it on the new block’s content. When omitted, do not set `dataSource` (snapshot-only).
- No change to existing behavior when `dataSource` is not provided.

### 5.2 refreshChartBlock(blockId)

- Load the block; verify it is a spec chart and has `dataSource` with `mode === "refreshable"`. Otherwise return an error.
- **If scope is "query":** Run the appropriate search (searchTasks, searchTimelineEvents, or table row search) using `dataSource.query.params` and the current auth context. Pass the result array to the normalizer to get ChartRow[]. If the spec uses `normalizeTo: "universe"`, compute `universeTotal` using the same query (e.g. count or same search with limit removed) as needed by the existing chart logic.
- **If scope is "fixed":** Fetch entities by `dataSource.entityIds` and `dataSource.entityType`. Use existing APIs (e.g. search with id filter) or add minimal helpers (e.g. fetch tasks/timeline events/table rows by ID list) that return the same shape as the search APIs for those IDs. Normalize the result to ChartRow[]. Do not run the original query; only the listed IDs are included. If an ID no longer exists or is inaccessible, the implementer may either omit it (fewer rows) or surface a minimal warning; the plan does not prescribe which.
- Update the block with `updateBlock(blockId, { ...content, rows: newRows, universeTotal })`. Keep `spec` and `dataSource` unchanged so future refreshes behave the same.

### 5.3 saveChartAsSnapshot(blockId)

- Load the block; verify it is a spec chart. Set `dataSource` to `undefined` (or `{ mode: "snapshot" }`) while keeping `spec`, `rows`, `universeTotal`, `title`, `metadata` unchanged. Call `updateChartBlock` (or `updateBlock`) with the new content. After this, the chart no longer has a refresh or scope UI.

### 5.4 setChartDataScope(blockId, scope: "fixed" | "query")

- **Switch to "fixed":** Read current `content.rows` and set `entityIds = rows.map(r => r.id)`. Infer `entityType` from the current `dataSource.query.type` (e.g. "tasks" → "task"). Optionally store the current query in `dataSource.previousQuery` so the user can switch back. Persist `dataSource: { mode: "refreshable", scope: "fixed", entityType, entityIds, previousQuery? }`.
- **Switch to "query":** Only valid when `dataSource` has a `query` or `previousQuery`. Set `dataSource` to the refreshable query variant using `previousQuery ?? query`, and clear fixed-specific fields. Persist via `updateChartBlock`.
- In both cases, keep `rows`, `spec`, and the rest of the content unchanged; only `dataSource` changes.

---

## 6. ChartBlock UI

File: `trak/src/components/blocks/ChartBlock.tsx`.

### 6.1 When to show scope and refresh UI

- Show the scope selector and Refresh / Save as snapshot only when `content.dataSource` exists and `mode === "refreshable"`. If `dataSource` is missing or `mode === "snapshot"`, do not show these controls (chart is static).

### 6.2 Scope selector

- Two options, with this exact copy:
  - **"Track only these items"** – Fixed scope. On select, call `setChartDataScope(blockId, "fixed")` (and persist entityIds/entityType/previousQuery as in 5.4).
  - **"Track future items that meet these requirements"** – Query scope. On select, call `setChartDataScope(blockId, "query")` when a stored query (or previousQuery) exists.
- Control type (dropdown, segmented control, or radio) is up to the implementer; selection must reflect `content.dataSource.scope`.

### 6.3 Tracked-items list (fixed scope only)

- When `dataSource.scope === "fixed"`, show a section with a heading like “Tracking N items” (N = length of `content.rows` or `content.dataSource.entityIds`).
- Below it, list the tracked items. Use the current `content.rows` as the source: for each row, show a single line. Prefer a title-like field for the label (e.g. row["Task Title"], row["title"], or row["Title"]), with fallback to `row.id` or a short truncation of it. No extra server fetch is required; the list is derived from the same rows the chart uses.
- If the list is long, make it scrollable or collapsible (e.g. show first N items and “and M more” or an expandable block).

### 6.4 Refresh and Save as snapshot

- **Refresh** – Visible when `dataSource.mode === "refreshable"`. On click, call `refreshChartBlock(block.id)`, then refetch or invalidate the block (e.g. via the same mechanism used after spec change) so the chart and, when in fixed scope, the tracked-items list update.
- **Save as snapshot** – Visible when `dataSource.mode === "refreshable"`. On click, call `saveChartAsSnapshot(block.id)`, then refetch so the scope/refresh UI is hidden.

Place the scope selector and tracked-items list in the chart header/card area (e.g. below the title, near the config gear). Place Refresh and Save as snapshot in the same toolbar or next to the config button.

---

## 7. AI / tools integration

So that new charts can be refreshable and default to “track future items that meet these requirements.”

### 7.1 createSpecChartBlock tool

- In `trak/src/lib/ai/tool-definitions.ts`, add an optional parameter to the `createSpecChartBlock` tool: `dataSource` (or a structured object with `scope` and `query`). The `query` should match the ChartDataQuery shape (type + params). Document that when the AI creates a chart from search results, it should pass the same search parameters it used in `dataSource.query` so the chart can be refreshed and can track future matching items until the user switches to “Track only these items.”
- In the tool executor (e.g. `trak/src/lib/ai/tool-executor.ts`), pass the `dataSource` argument through to `createSpecChartBlock`.

### 7.2 System prompt / tool description

- In the workflow executor and/or system prompt (e.g. `trak/src/lib/ai/workflow-executor.ts`, `trak/src/lib/ai/system-prompt.ts`), add instructions that when the AI creates a chart from `searchTasks`, `searchTimelineEvents`, or table row search, it must include `dataSource.query` with the exact same parameters used for that search. Clarify that the user can later choose “Track only these items” in the UI to lock the chart to the current set.

---

## 8. Implementation order

1. **Types** – In `trak/src/types/chart.ts`, define ChartDataQuery, ChartDataSource, and add `dataSource?: ChartDataSource` to SpecChartBlockContent.
2. **Normalizer** – Implement the search/entity → ChartRow[] normalizer, reuse existing status/priority/assignee/tags helpers, and add unit tests.
3. **createSpecChartBlock** – Accept optional `dataSource` and persist it on the new block.
4. **refreshChartBlock** – Implement for both scope "query" (run query, normalize, update) and scope "fixed" (fetch by entityIds, normalize, update). Ensure universe total is updated when the spec uses normalizeTo "universe".
5. **saveChartAsSnapshot** – Clear dataSource and update block.
6. **setChartDataScope** – Implement switching between "fixed" and "query" with entityIds/previousQuery as above.
7. **ChartBlock UI** – Scope selector (“Track only these items” / “Track future items that meet these requirements”), tracked-items list when scope is fixed, Refresh and Save as snapshot buttons, wired to the new actions. Refetch/invalidate block after each action so the UI updates.
8. **Tool definition and executor** – Add dataSource parameter to createSpecChartBlock and pass it through; update prompts so the AI sends dataSource.query when creating charts from search results.

---

## 9. Edge cases and notes

- **Charts from mixed sources** – If the chart was built from more than one entity type or query, do not add a dataSource; leave the chart snapshot-only.
- **Fixed scope and deleted/inaccessible entities** – Refresh fetches by ID; missing IDs can result in fewer rows. Optionally filter out missing IDs and show “N items no longer available” or similar; the plan leaves the exact UX to the implementer.
- **Permissions** – All new actions must use the same auth context and workspace/tab checks as existing chart actions; reuse existing search and (if added) fetch-by-ID APIs so RLS and permissions stay unchanged.
- **Display label for rows** – ChartRow has `id` and optional fields. The tracked-items list should use a consistent rule for “title” (e.g. try "Task Title", "title", "Title" then fall back to id). The normalizer should set the same title-like field so the list and the chart stay in sync after refresh.

This document is the single source of truth for the feature; the implementing agent should follow it and use the codebase to fill in types, API names, and file paths.
