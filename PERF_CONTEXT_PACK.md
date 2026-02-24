# Trak — Performance Context Pack (Tables & Task Blocks)
> Generated: 2026-02-23 · Codebase: `trak/` Next.js App Router + Supabase PostgREST

---

## 1) What "Tables" Means in Trak

### 1.1 Entry Points

| UI Entry Point | Route / Component | Top-level Renderer |
|---|---|---|
| Project tab (table block inside tab) | `/dashboard/projects/[projectId]/tabs/[tabId]` → `table-block.tsx` | `TableBlock` → dynamically imports `TableView` |
| Dashboard: Clients | `/dashboard/clients` → `clients-table.tsx` | `ClientsTable` (uses raw `<table>`, NOT the Supabase-backed `TableView`) |
| Dashboard: Docs | `/dashboard/docs` → `docs-table.tsx` | Same pattern — standalone, not Supabase-backed |
| Dashboard: Projects | `/dashboard/projects` → `projects-table.tsx` | Same pattern |
| Dashboard: Payments | `/dashboard/payments` → `payments-table.tsx` | Same pattern |
| Dashboard: Workflow | `/dashboard/workflow` → `workflow-pages-table.tsx` | Same pattern |
| Dashboard: Settings (members, teams) | `settings/members/members-table.tsx`, `settings/teams/teams-table.tsx` | Same pattern |
| Everything Table View | `components/everything/everything-table-view.tsx` | `EverythingTableView` — reads from `entity_properties`, NOT `table_rows` |

> **The perf issue applies to:** `table-block.tsx` → `TableView` (Supabase-backed). The dashboard tables are simple, non-paginated component tables and are NOT the slow path.

**Key files:**
- [table-block.tsx](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/table-block.tsx) — entry point, prefetches bootstrap
- [table-view.tsx](file:///Users/amnaahmad/devwt/trak/src/components/tables/table-view.tsx) — 2004 lines, main table renderer
- [use-table-queries.ts](file:///Users/amnaahmad/devwt/trak/src/lib/hooks/use-table-queries.ts) — TanStack Query hooks

### 1.2 Data Model + Schema

| DB Table | Purpose | Key Columns |
|---|---|---|
| `tables` | Table definitions | `id`, `workspace_id`, `project_id`, `title`, `description`, `icon` |
| `table_fields` | Column definitions | `id`, `table_id`, `name`, `type` (enum of 20+ types), `config` (JSONB), `order`, `is_primary`, `width` |
| `table_rows` | Row data | `id`, `table_id`, `data` (JSONB: `{fieldId: value}`), `order` (text), `source_entity_type`, `source_entity_id`, `source_sync_mode`, `edited` |
| `table_views` | Saved views (filters/sorts/grouping) | `id`, `table_id`, `type`, `config` (JSONB), `is_default` |
| `table_comments` | Row-level comments | `id`, `row_id`, ... |
| `entity_properties` | Universal cross-entity properties (used for some table cell data) | `entity_id`, `entity_type`, `field_type`, `value` (JSONB) |

> **Indexes:** UNKNOWN — need to run `\d table_rows`, `\d table_fields` etc. in Supabase SQL editor to verify composite indexes.

**Data is fetched via:** PostgREST `select` calls (`.from("table_rows").select("*")`). No RPCs or views for tables. Server-side filters use PostgREST operators where supported, with in-memory fallback for unsupported operators. Search uses `ILIKE` on `data::text`.

### 1.3 Fetch Pipeline (end-to-end for "open a table tab")

```
Step 1: table-block.tsx mounts
  └── useEffect: prefetchQuery(queryKeys.tableBootstrap(tableId))
       Calls server action: getTableBootstrap(tableId)
       Runs IN PARALLEL with dynamic import of TableView chunk

Step 2: TableView mounts
  └── useTableBootstrap(tableId) — uses TanStack Query
       If already prefetched → cache hit ✓
       If not → calls getTableBootstrap(tableId) server action

Step 3: getTableBootstrap (SERVER ACTION)
  └── 3a: requireTableAccess(tableId)        [Auth: 2 queries — tables.select + checkWorkspaceMembership]
  └── 3b: Promise.all([                       [PARALLEL — 1 wall-clock round trip]
           tables.select("*").eq("id", tableId).single(),
           table_fields.select("*").eq("table_id", tableId).order("order"),
           table_views.select("*").eq("table_id", tableId).eq("is_default", true).maybeSingle()
         ])
  └── 3c: table_rows.select("*", {count:"exact"})    [SERIAL after 3b]
           .eq("table_id", tableId)
           [+ server filters if view has them]
           .order("order")
           .limit(100)                                 // PAGE_LIMIT = 100

Step 4 (conditional): If table has person fields
  └── useQuery: getWorkspaceMembers(workspaceId) — separate Supabase call, staleTime=5min

Step 5 (conditional): Non-default view selected
  └── useTableRows(tableId, viewId) — calls getTableData() server action
       Similar structure to bootstrap but without table/fields metadata
```

**Literal Supabase queries in `getTableBootstrap`** ([query-actions.ts:271–330](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/query-actions.ts#L271)):

```typescript
// Auth (requireTableAccess — context.ts:26–63):
supabase.from("tables").select("id, workspace_id, project_id, title, description, icon").eq("id", tableId).maybeSingle()
// + checkWorkspaceMembership(table.workspace_id, userId) — workspace_members query

// Parallel metadata (line 279–283):
supabase.from("tables").select("*").eq("id", tableId).single()
supabase.from("table_fields").select("*").eq("table_id", tableId).order("order", { ascending: true })
supabase.from("table_views").select("*").eq("table_id", tableId).eq("is_default", true).maybeSingle()

// Rows (line 300–307):
supabase.from("table_rows").select("*", { count: "exact", head: false })
  .eq("table_id", tableId)
  [+ applyServerFilters if view has filters]
  [+ applyServerSorts if view has sorts]
  .order("order", { ascending: true })
  .limit(100)  // PAGE_LIMIT
```

**Total Supabase round-trips for a table open:** **2 (auth) + 1 (parallel metadata group) + 1 (rows) ≈ 4 sequential network hops**. The `tables` table is queried twice (once in auth, once in metadata parallel group) — redundant.

### 1.4 Rendering + Hydration

- **Not RSC:** `table-block.tsx` is `"use client"` → dynamically imports `table-view.tsx` (also `"use client"`)
- **Dynamic import with `ssr: true`:** `TableView` is code-split via `next/dynamic` but server-side rendered
- **NO virtualization:** Table rows are rendered as plain `<div>` elements with CSS grid. No `@tanstack/react-virtual`, no `react-window`. **All rows are in the DOM simultaneously.**
- **Initial rows:** Limited to 100 by `PAGE_LIMIT` in `getTableBootstrap`. A "Load More" pattern exists in `getTableRows` (limit/offset), but `table-view.tsx` **does not call it** — it only uses bootstrap data for the default view
- **Expensive derived computations:**
  - `buildSubtaskPresentation()` — O(n) per row, runs on every render via useMemo
  - `groupRows()` — sorting + grouping in JS if group-by is enabled
  - `applyFilters()` / `applySorts()` — in-memory fallback for unsupported filter operators
  - Column template recalculation on every field width change

### 1.5 Known Hotspots (Tables)

| # | Hotspot | Type | Location |
|---|---|---|---|
| T1 | Auth queries table TWICE (once in `requireTableAccess`, once in `Promise.all`) | N+1 / redundancy | [context.ts:47](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/context.ts#L47), [query-actions.ts:280](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/query-actions.ts#L280) |
| T2 | No row virtualization — DOM contains all 100 rows | Client rendering | [table-view.tsx](file:///Users/amnaahmad/devwt/trak/src/components/tables/table-view.tsx) (entire render) |
| T3 | `useUpdateCell` + relation field invalidation iterates all cached queries | Caching/refetch | [table-view.tsx:492–612](file:///Users/amnaahmad/devwt/trak/src/components/tables/table-view.tsx#L492) |
| T4 | `searchTableRows` uses server-side `ILIKE` on `data::text` — seq scan on large tables (no GIN index) | DB/query | [query-actions.ts:80–85](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/query-actions.ts#L80) |
| T5 | Bootstrap returns 100 rows max but **no infinite scroll / load-more** in `table-view.tsx` — tables with >100 rows are silently truncated | Network/payload gap | [table-view.tsx:210–217](file:///Users/amnaahmad/devwt/trak/src/components/tables/table-view.tsx#L210) |
| T6 | Each `table_rows.data` is a full JSONB blob (`{field1: val, field2: val, ...}`) — no column projection possible | DB/payload | Supabase schema constraint |

---

## 2) What "Task Blocks" Means in Trak

### 2.1 Entry Points

| UI Entry Point | Route / Component | Top-level Renderer |
|---|---|---|
| Project tab (task block inside tab) | `/dashboard/projects/[projectId]/tabs/[tabId]` → `task-block.tsx` | `TaskBlock` (4850 lines, monolithic component) |

> Task blocks are only rendered inside project tabs as blocks. There's no standalone task view page.

**Key files:**
- [task-block.tsx](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/task-block.tsx) — 4850 lines, the entire task list/board/table view
- [use-task-queries.ts](file:///Users/amnaahmad/devwt/trak/src/lib/hooks/use-task-queries.ts) — TanStack Query hooks
- [query-actions.ts (tasks)](file:///Users/amnaahmad/devwt/trak/src/app/actions/tasks/query-actions.ts) — `getTaskItemsByBlock` server action
- [item-actions.ts](file:///Users/amnaahmad/devwt/trak/src/app/actions/tasks/item-actions.ts) — CRUD mutations

### 2.2 Data Model

| DB Table | Purpose | Key Columns |
|---|---|---|
| `task_items` | Tasks | `id`, `task_block_id`, `workspace_id`, `project_id`, `tab_id`, `title`, `statuses` (JSONB array), `priorities` (JSONB array), `assignee_id`, `description`, `due_date`, `due_time`, `start_date`, `display_order`, `source_entity_type`, `source_entity_id`, `source_sync_mode`, `recurring_enabled/frequency/interval`, `hide_icons` |
| `task_subtasks` | Subtasks | `id`, `task_id`, `title`, `description`, `completed`, `display_order` |
| `task_comments` | Comments | `id`, `task_id`, `author_id`, `text`, `created_at` |
| `task_tag_links` | Task↔Tag junction | `task_id`, `tag_id` |
| `task_tags` | Tag definitions | `id`, `workspace_id`, `name`, `color` |
| `task_assignees` | Task↔Assignee junction | `task_id`, `assignee_id`, `assignee_name` |
| `profiles` | User profiles (for author/assignee display names) | `id`, `name`, `email` |
| `entity_properties` | Universal properties (status, priority, assignee, due_date, tags) per entity | `entity_id`, `entity_type`, `field_type`, `value` (JSONB) |
| `blocks` | Block container (parent of task block) | `id`, `tab_id`, `type`, `content` (JSONB — stores viewMode, filters, etc.) |

> **Blocks-to-tasks linkage:** Tasks reference their block via `task_items.task_block_id`. The block `content` JSONB stores UI config (`viewMode`, `boardGroupBy`, `filters`, `search`, `showDone`, `rollups`) — type `TaskBlockContent`.

**Indexes:** UNKNOWN — need `\d task_items`, `\d task_subtasks`, `\d task_tag_links` to verify if there are composite indexes on `(task_block_id, display_order)`, `(task_id)`, etc.

### 2.3 Fetch Pipeline (end-to-end for "open a task block")

```
Step 1: TaskBlock mounts (task-block.tsx:601)
  └── useTaskItems(block.id) — TanStack Query hook
       Calls server action: getTaskItemsByBlock(blockId)

Step 2: getTaskItemsByBlock (SERVER ACTION — query-actions.ts:36–205)
  ┌── Round-trip 0: requireTaskBlockAccess(taskBlockId)
  │     └── 0a: createClient() + getAuthenticatedUser()     [1 auth query]
  │     └── 0b: blocks.select("id, tab_id, type,
  │              tabs!inner(id, project_id,
  │              projects!inner(id, workspace_id))")
  │              .eq("id", taskBlockId).maybeSingle()        [1 join query]
  │     └── 0c: checkWorkspaceMembership(workspaceId, userId) [1 query]
  │
  ├── Round-trip 1: task_items.select("*")
  │     .eq("task_block_id", taskBlockId)
  │     .order("display_order", { ascending: true })
  │
  ├── Round-trip 2: Promise.all([                            [PARALLEL — 1 wall-clock RT]
  │     task_subtasks.select("id, task_id, title, description, completed")
  │       .in("task_id", taskIds).order("display_order"),
  │     task_comments.select("id, task_id, author_id, text, created_at")
  │       .in("task_id", taskIds).order("created_at"),
  │     task_tag_links.select("task_id, tag_id, tag:task_tags(id, name)")
  │       .in("task_id", taskIds),                          [embedded join — eliminates separate tags query!]
  │     task_assignees.select("task_id, assignee_id, assignee_name")
  │       .in("task_id", taskIds)
  │   ])
  │
  └── Round-trip 3: profiles.select("id, name, email")       [SERIAL after RT2]
        .in("id", allProfileIds)                              [union of author + assignee IDs]
        (skipped if no profiles needed)

Step 3 (PARALLEL with Step 2): useEntitiesProperties("task", taskIds, workspaceId)
  └── entity_properties.select("*")
        .eq("entity_type", "task")
        .in("entity_id", taskIds)                            [1 Supabase query]

Step 4 (PARALLEL with Step 2): useEntitiesProperties("subtask", subtaskIds, workspaceId)
  └── entity_properties.select("*")
        .eq("entity_type", "subtask")
        .in("entity_id", subtaskIds)                         [1 Supabase query]

Step 5 (PARALLEL with Step 2): useWorkspaceMembers(workspaceId)
  └── getWorkspaceMembers(workspaceId)                       [1 Supabase query]
```

**Total network round-trips for a task block open:**
- `getTaskItemsByBlock`: 3 auth queries + 1 items + 1 parallel (4 queries) + 1 profiles = **6 Supabase queries in 4 serial hops**
- `useEntitiesProperties` (tasks): 1 query
- `useEntitiesProperties` (subtasks): 1 query
- `useWorkspaceMembers`: 1 query (likely cached if another block already loaded it)
- **Total: 6 + 3 = 9 Supabase queries, in ~5-6 serial wallclock hops**

> [!IMPORTANT]
> Steps 3-5 run as **client-side TanStack Query hooks** in parallel with Step 2's server action. They each call their own server action, which each creates a new Supabase client and authenticates independently. This means **3 additional independent auth round-trips**.

### 2.4 UI Rendering Costs

- **Virtualization: YES** — `@tanstack/react-virtual` is used for list view ([task-block.tsx:700–706](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/task-block.tsx#L700)): `estimateSize: () => 60`, `overscan: 5`
- **Board view:** No virtualization (renders all task cards in all columns)
- **Expensive computations in JS:**
  - `orderedTasks` useMemo — re-sorts tasks by custom order on every render
  - `boardItems` useMemo — flattens tasks + subtasks for board view
  - `rollupTasks` useMemo — computes status/priority/assignee for each task (depends on `propertyOverrides`, `taskPropertiesById`, `subtaskPropertiesById`)
  - `getEffective*` functions — per-task property resolution merging entity_properties with inline task data, running for every task on every render of rollup bar
  - `getDerivedStatusFromSubtasks` — iterates all subtasks per task to compute parent status
- **TaskPropertyBadges component:** Each task row that shows property badges fires `useEntityPropertiesWithInheritance` — an ADDITIONAL per-entity server action call. This is **N+1 if badges are visible for many tasks**, though TanStack Query deduplication should help.
- **No Suspense boundaries:** No `<Suspense>` wrappers. The entire TaskBlock shows loading state until `useTaskItems` resolves.
- **4850-line monolith:** The entire task UI (list, board, table views, modals, DnD, editing, references) lives in one component file. State updates anywhere cause the full component tree to reconcile.

---

## 3) Performance Instrumentation

### 3.1 Existing Logs

`PERF_DEBUG` instrumentation exists, gated by `process.env.PERF_DEBUG === '1'`:

| File | What's Measured | Log Format |
|---|---|---|
| [query-actions.ts:37–58](file:///Users/amnaahmad/devwt/trak/src/app/actions/tasks/query-actions.ts#L37) | `getTaskItemsByBlock` total + items query timing | `[PERF] getTaskItemsByBlock items query ms=XX count=XX` |
| [query-actions.ts:199–202](file:///Users/amnaahmad/devwt/trak/src/app/actions/tasks/query-actions.ts#L199) | `getTaskItemsByBlock` final summary | `[PERF] getTaskItemsByBlock taskBlockId=XX tasks=XX payloadBytes=XX totalMs=XX` |
| [block.ts:46–95](file:///Users/amnaahmad/devwt/trak/src/app/actions/block.ts#L46) | `getTabBlocks` auth + query timing | `[PERF] getTabBlocks ...` |
| [block.ts:113–166](file:///Users/amnaahmad/devwt/trak/src/app/actions/block.ts#L113) | `getChildBlocks` timing | `[PERF] getChildBlocks ...` |
| [page.tsx:41–186](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/page.tsx#L41) | Tab page parallel fetch + file prefetch | `[PERF] tab-page ...` |
| [file.ts:491–575](file:///Users/amnaahmad/devwt/trak/src/app/actions/file.ts#L491) | `getBatchFileUrls` | `[PERF] getBatchFileUrls ...` |

**What's NOT instrumented:**
- `getTableBootstrap` — **NO timing instrumentation** (PERF_DEBUG not present in table query-actions)
- Per-round-trip breakdown within `getTaskItemsByBlock` (only total + items query; RT2 parallel group and RT3 profiles are NOT individually timed)
- Client-side component mount → interactive timing
- Entity properties queries (`getEntitiesProperties`)
- `requireTableAccess` and `requireTaskBlockAccess` auth overhead separately

### 3.2 How to Capture Timing Numbers

**Enable existing instrumentation:**
```bash
PERF_DEBUG=1 npm run dev
# Then in browser, open a project tab with a heavy task block or table
# Check server console (terminal) for [PERF] lines
```

**No client-side perf marks exist.** To add:
```typescript
// In task-block.tsx, after useTaskItems hook:
useEffect(() => {
  if (serverTasks.length > 0) {
    performance.mark('taskblock-rendered');
    console.log(`[PERF-CLIENT] TaskBlock rendered tasks=${serverTasks.length}`);
  }
}, [serverTasks]);
```

### 3.3 Sample Timing Data

**UNKNOWN** — `PERF_DEBUG=1` has not been run in this session. To obtain:

```bash
# In terminal where npm start is running, stop it and restart with:
PERF_DEBUG=1 npm run dev
# Navigate to a heavy table AND a heavy task block
# Copy [PERF] lines from terminal output
```

---

## 4) Supabase Query Details

### Tables — All Queries

| # | Table/RPC | Select | Filters | Order | Limit | Purpose | Expected Rows | RLS |
|---|---|---|---|---|---|---|---|---|
| T-Auth1 | `tables` | `id, workspace_id, project_id, title, description, icon` | `eq("id", tableId)` | — | 1 | Auth: find table | 1 | Yes (PostgREST) |
| T-Auth2 | `workspace_members` | via `checkWorkspaceMembership` | `eq("workspace_id", wsId).eq("user_id", userId)` | — | 1 | Auth: verify membership | 0-1 | Yes |
| T-Meta1 | `tables` | `*` | `eq("id", tableId)` | — | 1 (`.single()`) | Table metadata | 1 | Yes |
| T-Meta2 | `table_fields` | `*` | `eq("table_id", tableId)` | `order("order")` | All | Column definitions | 5–50 typical | Yes |
| T-Meta3 | `table_views` | `*` | `eq("table_id", tableId).eq("is_default", true)` | — | 1 (`.maybeSingle()`) | Default view config | 0-1 | Yes |
| T-Rows | `table_rows` | `*` + `count: "exact"` | `eq("table_id", tableId)` + server filters | `order("order")` | **100** (`PAGE_LIMIT`) | Row data | 0–100 (capped) | Yes |
| T-Search | `table_rows` | `*` | `eq("table_id", tableId).filter("data::text", "ilike", query)` | — | **50** | Search results | 0-50 | Yes |

### Task Blocks — All Queries

| # | Table/RPC | Select | Filters | Order | Limit | Purpose | Expected Rows | RLS |
|---|---|---|---|---|---|---|---|---|
| K-Auth1 | `auth.getUser()` | — | — | — | — | Get current user | 1 | N/A |
| K-Auth2 | `blocks` | `id, tab_id, type, tabs!inner(...)` | `eq("id", blockId)` | — | 1 | Auth: find block + workspace | 1 | Yes |
| K-Auth3 | `workspace_members` | via `checkWorkspaceMembership` | `eq("workspace_id", wsId).eq("user_id", userId)` | — | 1 | Auth: verify membership | 0-1 | Yes |
| K-Items | `task_items` | `*` | `eq("task_block_id", blockId)` | `order("display_order")` | All | All tasks in block | 10–500 typical | Yes |
| K-Subs | `task_subtasks` | `id, task_id, title, description, completed` | `.in("task_id", taskIds)` | `order("display_order")` | All | All subtasks | 0–1000 | Yes |
| K-Cmts | `task_comments` | `id, task_id, author_id, text, created_at` | `.in("task_id", taskIds)` | `order("created_at")` | All | All comments | 0–500 | Yes |
| K-Tags | `task_tag_links` | `task_id, tag_id, tag:task_tags(id, name)` | `.in("task_id", taskIds)` | — | All | Tags with embedded join | 0–500 | Yes |
| K-Asgn | `task_assignees` | `task_id, assignee_id, assignee_name` | `.in("task_id", taskIds)` | — | All | Assignees | 0–500 | Yes |
| K-Prof | `profiles` | `id, name, email` | `.in("id", allProfileIds)` | — | All | Display names | 0–50 | Yes |
| K-Props | `entity_properties` | `*` | `eq("entity_type", "task").in("entity_id", taskIds)` | — | All | Universal properties | 0–2500 (5 props × 500 tasks) | Yes |
| K-SubProps | `entity_properties` | `*` | `eq("entity_type", "subtask").in("entity_id", subtaskIds)` | — | All | Subtask properties | 0–5000 | Yes |
| K-Members | via `getWorkspaceMembers` | `*` | `eq("workspace_id", wsId)` | — | All | Workspace member list | 1–100 | Yes |

**RLS impact:** All queries go through PostgREST which applies RLS policies. The `can_access_project` policy on task-related tables performs sub-queries against `projects` and `workspace_members` per row candidate. For bulk `.in()` queries returning many rows, this could add significant overhead. **UNKNOWN** — needs `EXPLAIN ANALYZE` to quantify.

---

## 5) Network + Payload

**UNKNOWN — requires browser DevTools capture.** Steps to obtain:

```
1. Open Chrome DevTools → Network → filter "Fetch/XHR"
2. Clear network log
3. Navigate to a project tab with a heavy table/task block
4. Count requests, note blocking vs parallel, total transferred bytes
5. Look for any response > 100KB (likely table_rows or getTaskItemsByBlock)
```

**Estimates from code analysis:**
- `getTableBootstrap` (100 rows × 20 fields): ~50–150KB JSON payload
- `getTaskItemsByBlock` (100 tasks with subtasks/comments/tags): ~100–300KB JSON payload
- `getEntitiesProperties` (100 tasks × 5 properties): ~50–100KB
- Total for a task block load: **~200–500KB across 9 requests**
- Total for a table load: **~50–150KB across 6 requests**

---

## 6) Caching + Invalidation

### Cache Layer

| Layer | Technology | Configuration |
|---|---|---|
| Client data cache | TanStack Query (React Query v5) | `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`, `refetchOnMount: false`, `retry: 1` |
| Server cache | None — each server action creates a fresh Supabase client | No Next.js `fetch` cache, no `React.cache()` |
| Browser HTTP cache | Not applicable — server actions use POST | — |

**Configuration source:** [query-client.ts](file:///Users/amnaahmad/devwt/trak/src/lib/react-query/query-client.ts)

### What Causes Refetch

**Task Block mutations → refetch triggers:**

| Mutation Hook | Invalidation | Effect |
|---|---|---|
| `useCreateTaskItem` | `onSettled: invalidateQueries(taskKeys.items(blockId))` | Full block refetch |
| `useUpdateTaskItem` | **NONE** (onMutate optimistic only) | ✅ No refetch for updates |
| `useDeleteTaskItem` | `onSettled: invalidateQueries(taskKeys.items(blockId))` | Full block refetch |
| `useReorderTaskItems` | `onSuccess: invalidateQueries` | Full block refetch |
| `useTaskSubtasks.create/update/remove/reorder` | `onSuccess: invalidateQueries(taskKeys.items(blockId))` | Full block refetch — **ALL subtask ops trigger full block reload** |
| `useTaskComments.create/update/remove` | `onSuccess: invalidateQueries(taskKeys.items(blockId))` | Full block refetch — **ALL comment ops trigger full block reload** |
| `useTaskTags` | `onSuccess: invalidateQueries` | Full block refetch |
| `useTaskAssignees` | `onSuccess: invalidateQueries` | Full block refetch |

> [!IMPORTANT]
> `useUpdateTaskItem` is the ONLY mutation that avoids refetch (uses optimistic `setQueryData` only). **Every other mutation** triggers `getTaskItemsByBlock` again = 4 serial hops × 9 Supabase queries.

**Table mutations → refetch triggers:**
- `useUpdateCell` → invalidates `tableRows(tableId, viewId)` + complex relation cache logic
- `useCreateRow` → invalidates `tableRows` + `tableBootstrap`
- `useDeleteField` → invalidates `table(tableId)` + `tableRows` + `tableBootstrap`
- All mutations use some form of `invalidateQueries`

**Are results memoized?** TanStack Query provides structural sharing by default, so unchanged nested objects keep the same reference. Task block overrides `staleTime` to 30s for `useEntitiesProperties` but uses default (5min) for `useTaskItems`.

**Tab focus / route transition behavior:** `refetchOnWindowFocus: false` and `refetchOnMount: false` globally. Data is served from cache unless stale (>5min). **Route transitions between tabs are cheap if data was recently loaded.**

---

## 7) Repro Cases

**UNKNOWN — need workspace/project/table names from your instance.**

To identify worst cases:
1. **Worst-case Table:** Open Supabase Dashboard → SQL Editor → run `SELECT table_id, COUNT(*) as row_count FROM table_rows GROUP BY table_id ORDER BY row_count DESC LIMIT 5;` — pick the table with the most rows
2. **Worst-case Task Block:** Run `SELECT task_block_id, COUNT(*) as task_count FROM task_items GROUP BY task_block_id ORDER BY task_count DESC LIMIT 5;` — pick the block with the most tasks

Once identified, navigate to those project tabs and capture timings with `PERF_DEBUG=1`.

---

## 8) Output

### A) Pipeline Diagrams

#### Tables Pipeline
```
1. [AUTH]  requireTableAccess → tables.select + checkWorkspaceMembership    ~10-30ms
2. [META]  Promise.all(tables, table_fields, table_views)                  ~10-30ms
3. [DATA]  table_rows.select(*).eq(table_id).limit(100)                   ~10-200ms
4. [RENDER] table-view.tsx: build column template, render ALL rows (no virtualization)
5. [COND]  getWorkspaceMembers if person fields exist                     ~5-15ms
```

#### Task Blocks Pipeline
```
1. [AUTH]   requireTaskBlockAccess → getUser + blocks.select(join) + checkMembership  ~15-40ms
2. [ITEMS]  task_items.select(*).eq(task_block_id)                                   ~10-40ms
3. [RELATED] Promise.all(subtasks, comments, tag_links+join, assignees)              ~15-50ms
4. [PROFILES] profiles.select.in(allProfileIds) — SERIAL after #3                   ~5-20ms
5. [CLIENT-PARALLEL] useEntitiesProperties("task", taskIds) → entity_properties      ~10-30ms
6. [CLIENT-PARALLEL] useEntitiesProperties("subtask", subtaskIds) → entity_properties ~10-30ms
7. [CLIENT-PARALLEL] useWorkspaceMembers(workspaceId)                                ~5-15ms
8. [RENDER] task-block.tsx: orderedTasks → useVirtualizer (list), board items (no virt)
```

### B) Top 10 Likely Bottlenecks

| Rank | Suspect | Category | Location |
|------|---------|----------|----------|
| 1 | **`getTaskItemsByBlock` 4 serial round-trips** (auth → items → related∥ → profiles) — each hop adds 10-50ms latency | DB/query | [query-actions.ts:36–205](file:///Users/amnaahmad/devwt/trak/src/app/actions/tasks/query-actions.ts#L36) |
| 2 | **3 additional independent server action calls** for entity properties (tasks + subtasks) + members, each with their own auth overhead | Network/payload | [task-block.tsx:675–685](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/task-block.tsx#L675) |
| 3 | **Every subtask/comment/tag/assignee mutation invalidates full block** → re-runs all 9 queries | Caching/refetch | [use-task-queries.ts:139–197](file:///Users/amnaahmad/devwt/trak/src/lib/hooks/use-task-queries.ts#L139) |
| 4 | **Table: NO row virtualization** — all 100 rows in DOM | Client rendering | [table-view.tsx](file:///Users/amnaahmad/devwt/trak/src/components/tables/table-view.tsx) |
| 5 | **Table: no load-more / infinite scroll** — tables with >100 rows silently truncated by PAGE_LIMIT | Network/payload | [query-actions.ts:298](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/query-actions.ts#L298) |
| 6 | **Auth redundancy: `requireTableAccess` queries `tables` then bootstrap queries `tables` again** | DB/query | [context.ts:47](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/context.ts#L47) vs [query-actions.ts:280](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/query-actions.ts#L280) |
| 7 | **`entity_properties` is fetched with `select("*")` for ALL entity types** — no column projection, no server-side aggregation | DB/payload | [entity-property-actions.ts:148](file:///Users/amnaahmad/devwt/trak/src/app/actions/properties/entity-property-actions.ts#L148) |
| 8 | **Task board view: no virtualization** — all cards + all columns rendered | Client rendering | [task-block.tsx (board rendering sections)](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/task-block.tsx) |
| 9 | **`searchTableRows`: ILIKE on `data::text` without GIN index** — seq scan on large tables | DB/query | [query-actions.ts:80–85](file:///Users/amnaahmad/devwt/trak/src/app/actions/tables/query-actions.ts#L80) |
| 10 | **4850-line monolith component** — state changes in editing/board/references cause full reconciliation | Client rendering | [task-block.tsx](file:///Users/amnaahmad/devwt/trak/src/app/dashboard/projects/%5BprojectId%5D/tabs/%5BtabId%5D/task-block.tsx) |

### C) Raw Query Snippets (copy-pasteable)

```typescript
// === TABLE BOOTSTRAP ===
// Auth (context.ts:47-53)
supabase.from("tables")
  .select("id, workspace_id, project_id, title, description, icon")
  .eq("id", tableId).maybeSingle()

// Parallel metadata (query-actions.ts:279-283)
const [tableRes, fieldsRes, viewRes] = await Promise.all([
  supabase.from("tables").select("*").eq("id", tableId).single(),
  supabase.from("table_fields").select("*").eq("table_id", tableId).order("order", { ascending: true }),
  supabase.from("table_views").select("*").eq("table_id", tableId).eq("is_default", true).maybeSingle(),
]);

// Rows (query-actions.ts:300-307)
supabase.from("table_rows")
  .select("*", { count: "exact", head: false })
  .eq("table_id", tableId)
  .order("order", { ascending: true })
  .limit(100)

// Search (query-actions.ts:80-85)
supabase.from("table_rows")
  .select("*")
  .eq("table_id", tableId)
  .filter("data::text", "ilike", `%${query}%`)
  .limit(50)

// === TASK BLOCK ===
// Auth (context.ts:47-53)
supabase.from("blocks")
  .select("id, tab_id, type, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
  .eq("id", taskBlockId).maybeSingle()

// Items (query-actions.ts:43-47)
supabase.from("task_items")
  .select("*")
  .eq("task_block_id", taskBlockId)
  .order("display_order", { ascending: true })

// Related (query-actions.ts:64-83) — all in Promise.all
supabase.from("task_subtasks")
  .select("id, task_id, title, description, completed")
  .in("task_id", taskIds).order("display_order", { ascending: true })

supabase.from("task_comments")
  .select("id, task_id, author_id, text, created_at")
  .in("task_id", taskIds).order("created_at", { ascending: true })

supabase.from("task_tag_links")
  .select("task_id, tag_id, tag:task_tags(id, name)")
  .in("task_id", taskIds)

supabase.from("task_assignees")
  .select("task_id, assignee_id, assignee_name")
  .in("task_id", taskIds)

// Profiles (query-actions.ts:109-110)
supabase.from("profiles")
  .select("id, name, email")
  .in("id", allProfileIds)

// Entity properties (entity-property-actions.ts:148-151)
supabase.from("entity_properties")
  .select("*")
  .eq("entity_type", "task")
  .in("entity_id", taskIds)
```

### D) Timing Numbers

**NOT YET CAPTURED.** To obtain:

```bash
# Stop the running npm start, then:
cd /Users/amnaahmad/devwt/trak
PERF_DEBUG=1 npm run dev

# Navigate to a heavy task block and table block
# Copy [PERF] lines from terminal
```

Existing instrumentation will produce lines like:
```
[PERF] getTaskItemsByBlock items query ms=XX count=XX
[PERF] getTaskItemsByBlock taskBlockId=XX tasks=XX payloadBytes=XX totalMs=XX
```

**Missing instrumentation that should be added before benchmarking:**
- `getTableBootstrap` total + per-phase timing
- `getEntitiesProperties` timing
- `requireTableAccess` auth timing
- Client-side mount → interactive timing for both table-view and task-block
