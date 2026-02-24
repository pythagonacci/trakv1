# Trak — Context Dump (Performance Audit)

## 1) Product surface / runtime

- **Framework**: Next.js 16 (App Router only). No `pages/` directory; all routes under `src/app/`.
- **Entry**: `trak/src/app/page.tsx` (root), `trak/src/app/dashboard/page.tsx` (dashboard home).
- **Router**: App Router with dynamic segments: `dashboard/projects/[projectId]/tabs/[tabId]/page.tsx`, `dashboard/clients/[clientId]/tabs/[tabId]/page.tsx`, `dashboard/internal/[spaceId]/tabs/[tabId]/page.tsx`, etc.
- **Edge**: Middleware runs on Edge (`trak/middleware.ts`): Supabase SSR cookie refresh, path rewrites (`/app/*` → `/*`), no route-specific `export const runtime = 'edge'` in app routes.
- **Server actions**: Heavy use. Search for `"use server"` — 70+ files under `trak/src/app/actions/` and `trak/src/lib/`. Key namespaces: `block.ts`, `tab.ts`, `entity-properties.ts`, `tasks/*`, `tables/*`, `timelines/*`, `ai-search.ts`, `dashboard-insights.ts`, `file.ts`, `workflow-session.ts`.
- **API routes**: All under `trak/src/app/api/`. Key routes:
  - `api/ai/route.ts`, `api/ai/stream/route.ts` — AI completion (streaming).
  - `api/workflow/execute/route.ts`, `api/workflow/stream/route.ts` — Workflow AI.
  - `api/ai/search/route.ts`, `api/ai/warmup/route.ts`, `api/ai/undo/route.ts`.
  - `api/internal/indexing/worker/route.ts`, `api/internal/indexing/backfill/route.ts`, `api/internal/indexing/status/route.ts` — Indexing jobs.
  - `api/shopify/sync/worker/route.ts` — Shopify sync.
  - `api/slack/commands/route.ts`, `api/slack/interactive/route.ts`, `api/slack/install/route.ts`, `api/slack/callback/route.ts`, `api/slack/disconnect/route.ts`.
  - `auth/callback/route.ts` — Auth callback.
  - Others: `api/projects/route.ts`, `api/client-comments/route.ts`, `api/file-analysis/route.ts`, `api/qa/route.ts`, `api/weather/route.ts`, `api/test-search/route.ts`, `api/test-ai-search/route.ts`, `api/debug-workspaces/route.ts`, `api/supabase-ping/route.ts`, `api/populate-buckeye/route.ts`.
- **Background / cron**: Indexing cron referenced in migration `20260206130200_setup_indexing_cron_http.sql` (pg_cron → HTTP to indexing worker). No in-repo cron runner; Supabase/Postgres cron assumed.
- **Deployment**: 
  - **Docker**: `trak/Dockerfile` — Node 20 Alpine, multi-stage build, standalone Next output, `start.sh` for runtime. No `vercel.json` in repo.
  - **Vercel**: Not explicitly configured in repo; standard Next on Vercel implied if deployed there.
  - **Config**: `trak/next.config.mjs` — Turbopack when `DISABLE_TURBOPACK !== '1'`, `optimizePackageImports`, image config, bundle analyzer when `ANALYZE=true`.

---

## 2) Architecture map (high-level)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UI SHELL                                                                   │
│  layout-client.tsx (sidebar, workspace, theme, global search)               │
│  dashboard/layout.tsx (no server data fetch)                                │
│  workspace-context, header-visibility-context, theme-context                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKSPACE / PROJECT / TAB                                                   │
│  dashboard/page.tsx → getCurrentWorkspaceId, getServerUser, Promise.allSettled │
│  projects/[projectId]/page.tsx → projects + redirect                         │
│  projects/[projectId]/tabs/[tabId]/page.tsx → project, tab, getProjectTabs,│
│    getTabBlocks, getBatchFileUrls → TabPageLayout / TabCanvasWrapper        │
│  block-renderer.tsx → dynamic() TaskBlock, TimelineBlock, TableBlock, etc.  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├──► TASKS: task-block.tsx, useTaskItems → getTaskItemsByBlock (query-actions)
         │    item-actions, super-actions (RPC create_task_full, update_task_full, bulk_*)
         │    assignee-actions, tag-actions, comment-actions, subtask-actions
         │
         ├──► TIMELINE: timeline-block.tsx, timeline-view.tsx, useTimelineItems
         │    getResolvedTimelineItems → timelines/query-actions, event-actions
         │
         ├──► TABLE: table-block.tsx, table-view.tsx, useTableBootstrap / useTableRows
         │    tables/query-actions (getTableBootstrap, getTableData, getFilteredRows)
         │    row-actions, bulk-actions, view-actions, field-actions, super-actions (RPC)
         │
         ├──► FILES / GALLERY: image-block, gallery-block, file-block, video-block, pdf-block
         │    getBatchFileUrls (server), createClient() client-side for uploads
         │
         └──► BLOCKS: block.ts (getTabBlocks, getChildBlocks, updateBlock, createBlock, …)
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPERTIES (universal)                                                     │
│  entity-properties.ts (setEntityProperties, buildEntityPropertiesFromRows…)  │
│  properties/query-actions, entity-property-actions, context.ts               │
│  use-property-queries.ts → useEntitiesProperties, useSetEntityProperties…   │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI SUBSYSTEM                                                               │
│  api/ai/stream/route.ts → executeAICommandStream (lib/ai/executor.ts)        │
│  api/workflow/stream/route.ts, workflow-executor.ts                          │
│  ai-context.ts (getBlockWithContext), tool-definitions.ts, tool-executor.ts  │
│  ai-search.ts (searchTasks, searchTimelineEvents, searchProjects, …)         │
│  dashboard-insights.ts (gatherDashboardOverviewData, getDashboardInsights)  │
│  ai-command-palette.tsx, workflow-ai-chat-panel.tsx (client streaming UI) │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│  SEARCH / INDEXING                                                          │
│  lib/search/query.ts (match_unstructured_parents RPC, embeddings)           │
│  actions/indexing.ts, api/internal/indexing/* (worker, backfill, status)     │
│  unstructured_parents, unstructured_chunks, indexing_jobs (migrations)       │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│  UPLOADS / FILES                                                            │
│  file.ts: uploadFile, getBatchFileUrls (files + workspace_members + N       │
│    createSignedUrl in parallel), getBlockFiles, deleteFile                  │
│  Storage: supabase.storage.from('files')                                    │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│  REALTIME / SYNC                                                            │
│  No Supabase Realtime subscriptions found in app code (only realtime-js    │
│  in package-lock). Updates driven by server actions + React Query            │
│  invalidation (invalidateQueries). No WebSocket or polling layer in UI.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Server vs client**: Pages under `app/` are Server Components by default. Client boundaries: `"use client"` in layout-client.tsx, block-renderer, table-view, timeline-view, task-block, ai-command-palette, workflow-ai-chat-panel, and most hooks (use-table-queries, use-timeline-queries, use-task-queries, use-property-queries).
- **DB access**: Supabase client from `@/lib/supabase/server` (createClient) in server actions and server components; `@/lib/supabase/client` (createClient) in client components (e.g. image-block, gallery-block, timeline-view, ai-command-palette). Service role: `@/lib/supabase/service` (createServiceClient) for indexing, Slack idempotency/rate-limiter, auth get-server-user fallback, client public token flow.
- **Cache**: React Query only (no separate Redis/cache layer). Query client: `trak/src/lib/react-query/query-client.ts` (makeQueryClient, queryKeys). Stale 5m, gc 10m, refetchOnWindowFocus/refetchOnMount false.

---

## 3) Data layer

- **Provider**: Supabase (Postgres). Client: `@supabase/supabase-js`, SSR: `@supabase/ssr`. Env: `getSupabaseEnv()` in `trak/src/lib/supabase/env` (assumed).
- **RLS**: Used on many tables. Policies reference `workspace_members` and helpers:
  - `can_access_project(project_id)` — `trak/supabase/migrations/20260212000000_add_project_permissions.sql` (JOIN workspace_members, auth.uid()). Used by projects, tabs, blocks, task_items, timeline_events, tables, etc.
  - Project tags: `sel_project_tags` / `ins_project_tags` / `del_project_tags` use `can_access_project(project_id)` — `20260222000000_add_project_tags.sql`.
  - Dashboard AI insights: workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()) — `20260210000008_create_dashboard_ai_insights.sql`.
  - Unstructured search: RLS on unstructured_parents, unstructured_chunks, indexing_jobs — `20260130235900_unstructured_search_v1.sql`.
  - Slack, Shopify, block_references: workspace-scoped or user-scoped policies.
- **Core tables (performance-relevant)**:
  - **tasks**: `task_items` (task_block_id, display_order, workspace_id), `task_subtasks`, `task_comments`, `task_tag_links`, `task_assignees`, `task_tags`. High read/write on task_items.
  - **table**: `tables`, `table_fields`, `table_rows`, `table_views`. `table_rows` can be wide (data JSONB) and high write.
  - **entity_properties**: workspace_id, property_definition_id, entity_type, entity_id, value (JSONB). Hot for property filters and universal properties; sync triggers from task_items, timeline_events, table_rows (migrations 20260210000004, 20260210000007, 20260213200000).
  - **timeline**: `timeline_events` (timeline_block_id, display_order, start_date).
  - **blocks**: `blocks` (tab_id, parent_block_id, position, column, content JSONB). Content can be large.
  - **files**: `files`, `file_attachments` (block_id, file_id).
  - **search**: `unstructured_parents`, `unstructured_chunks`, `indexing_jobs`.
  - **dashboard**: `dashboard_ai_insights`.
- **Indexes**: Inspect under `trak/supabase/migrations/`:
  - `20260123130000_add_entity_properties_indexes.sql`: idx_entity_props_workspace_propdef_entity, idx_property_defs_workspace_name, idx_entity_props_value_gin, idx_entity_props_entity, idx_entity_props_entity_id.
  - Other migrations add indexes per feature; search migrations for `CREATE INDEX`.
- **RPCs (Supabase)** and where called:
  - `get_next_block_position` — `trak/src/app/actions/block.ts` (insert block position).
  - `get_workspace_everything` — `trak/src/app/actions/everything-view.ts` (dashboard “everything” + due-aware items).
  - `match_unstructured_parents` — `trak/src/lib/search/query.ts` (vector/search).
  - `bulk_delete_rows`, `bulk_update_rows`, `bulk_duplicate_rows`, `bulk_insert_rows` (constants in bulk-actions) — `trak/src/app/actions/tables/bulk-actions.ts`.
  - `create_task_full`, `update_task_full`, `bulk_update_task_items`, `bulk_move_task_items`, `bulk_set_task_assignees`, `duplicate_tasks_to_block` — `trak/src/app/actions/tasks/super-actions.ts`.
  - `create_table_full`, `update_table_full`, `update_rows_by_field_names`, `bulk_update_rows_by_field_names` — `trak/src/app/actions/tables/super-actions.ts`.
  - `get_or_create_workspace_analysis_project` — `trak/src/app/actions/workflow-page.ts`.
  - `generate_public_token` — `trak/src/app/actions/client-page.ts`.

---

## 4) Performance-sensitive flows (by code)

| FLOW | USER ACTION | ENTRYPOINT FILE | SERVER/CLIENT | DB QUERIES CALLED | NETWORK CALLS | SUSPECT BOTTLENECKS |
|------|-------------|-----------------|---------------|-------------------|---------------|---------------------|
| Workspace home / dashboard | Open `/dashboard` | `trak/src/app/dashboard/page.tsx` | Server | projects (limit 5), docs (5), task_items (100 + join tab/project), completed task_items (6), blocks with _blockComments (40 + tabs/projects), getDashboardInsights → dashboard_ai_insights + AI search helpers; then getWorkspaceEverything(500) RPC for due-aware items | getServerUser, getCurrentWorkspaceId; getDashboardInsights (internal searchTasks/searchTimelineEvents/searchProjects); getWorkspaceEverything | Many parallel queries; getWorkspaceEverything(500); dashboard insights fixed searches + possible LLM; comment blocks join |
| Project page with tasks | Open project tab with task block | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx` | Server then client | projects.single, tabs.single, getProjectTabs(projectId), getTabBlocks(tabId); file_attachments for file blocks; getBatchFileUrls(fileIds) | getProjectTabs → tab.ts getProjectTabs; getTabBlocks → block.ts getTabBlocks; getBatchFileUrls | getTabBlocks (blocks + auth chain); getBatchFileUrls does 1 files query + N signed URL generations (Promise.all) |
| Load tab (blocks only) | Same as above | Same page | Server | As above | As above | Blocks limit 500; file URL batch size |
| Table view (rows + properties) | Open tab with table block | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/table-block.tsx` → useTableBootstrap | Client | getTableBootstrap(tableId) → requireTableAccess + Promise.all: tables.single, table_fields, table_views (default); then table_rows with filters/sorts (query-actions.ts getTableBootstrap) | Server action getTableBootstrap | Single bootstrap but full rows in one go; no pagination in bootstrap; in-memory filter/sort fallback |
| Timeline view | Open tab with timeline block | `timeline-block.tsx` → useTimelineItems → getResolvedTimelineItems | Client | requireTimelineAccess; timeline_events by block; getTimelineItems then getResolvedTimelineItems (same file) | Server action getResolvedTimelineItems | All events for block in one query |
| Create/update task (live update) | Add/edit task in task block | Task block → useCreateTaskItem / useUpdateTaskItem | Client | createTaskItem / updateTaskItem (item-actions) or createTaskFullRpc / updateTaskFullRpc (super-actions); getTaskItemsByBlock on invalidation | Server action; then refetch via React Query | RPC or multi-table writes; getTaskItemsByBlock does task_items + task_subtasks + task_comments + task_tag_links + task_assignees + task_tags + profiles (2x) — N+1 risk per block |
| Add/remove universal properties | Set status/priority/assignee/tags/due on task/timeline/row | Property UI → setEntityProperties / entity-property-actions | Server | entity_properties upserts/deletes; possible multi-row in entity-properties | Server action | Fan-out: one UI change can touch many entity_properties rows; sync triggers from table_rows/task_items/timeline_events |
| AI workflow / dashboard insights | Open dashboard or workflow AI | `trak/src/app/dashboard/page.tsx` (insights), `dashboard/workflow/[workflowPageId]/page.tsx`, `workflow-ai-chat-panel.tsx` | Server + Client | getDashboardInsights: dashboard_ai_insights read or generate (searchTasks, searchTimelineEvents, searchProjects × 7 + LLM); workflow: getBlockWithContext, then POST api/workflow/stream | fetch /api/ai/stream or /api/workflow/stream; getDashboardInsights | Many search calls in gatherDashboardOverviewData; LLM + tool calls; streaming response |
| AI command palette | Run AI command from palette | `ai-command-palette.tsx` → fetch /api/ai/stream | Client | Depends on command; getBlockWithContext if contextBlockId; executor tool calls (DB via tool-executor) | POST /api/ai/stream | Tool round-trips; large context |
| Search/filter/sort (large datasets) | Table view filter/sort | table-view.tsx, useTableRows / useSearchTableRows / getFilteredRows | Client | getTableBootstrap or getTableRows / getFilteredRows; searchTableRows does full table_rows select then in-memory filter (query-actions.ts) | Server actions | searchTableRows loads all rows then filters in memory; getTableRows has limit 50 default |
| File/gallery load | Open tab with image/gallery blocks | page.tsx prefetches file IDs → getBatchFileUrls; image-block / gallery-block use client createClient for replace/delete | Server then client | getBatchFileUrls: files.in(id), workspace_members.single, then N× createSignedUrl (parallel) | One server action for batch | N signed URL calls (parallel); gallery block also fetches on client for uploads |

---

## 5) Instrumentation currently in place

- **Timing / debug**:
  - `trak/src/lib/ai/debug.ts`: `aiDebug()` gated by `AI_DEBUG=1` or non-production; `aiTiming()` currently always on (`isAITimingEnabled()` returns true). Used for AI and RPC timing.
  - `trak/src/app/actions/tasks/item-actions.ts`: `performance.now()` around task insert, `opts.timing.t_insert_task_ms`.
  - `trak/src/app/actions/tasks/assignee-actions.ts`: multiple `performance.now()` for assignee set (tDel0, tIns0, tEp0, tEpDel0), `opts.timing.t_insert_assignees_ms`, `aiDebug("setTaskAssignees:db_calls_summary", …)`.
  - `trak/src/app/actions/tasks/context.ts`: `t_auth_ms`, `t_ctx_ms`, task_items select timing, `opts.dbCalls`.
  - `trak/src/app/actions/tasks/super-actions.ts`: `performance.now()` + `aiDebug("rpc:result", { name, ok, ms })` for each RPC (create_task_full, update_task_full, bulk_*, duplicate_*).
  - `trak/src/lib/ai/executor.ts`: `performance.now()` around callDeepseek, response logging with `ms`.
  - `trak/src/lib/ai/tool-executor.ts`: `t0` around executeTool, assignee resolve timing, `aiDebug("executeTool:done", { tool, ms })`.
  - `trak/src/lib/ai/simple-commands.ts`, `deterministic-parser.ts`, `intent-classifier.ts`: `performance.now()` and aiDebug/aiTiming.
  - `trak/src/app/actions/tables/super-actions.ts`: `performance.now()` for create/update table and row RPCs.
- **OpenTelemetry / Sentry / Datadog / Vercel**: Not found. Error boundary in `trak/src/components/error-boundary.tsx` has TODO: “Send error to error tracking service (e.g., Sentry)”. No `@sentry/*`, `dd-trace`, or OTEL imports.
- **Custom perf endpoints**: None found.
- **Local profiling**: `npm run dev` (NODE_OPTIONS='--max-old-space-size=4096' next dev) in `trak/package.json`. Bundle analysis: `ANALYZE=true next build` (script `build:analyze`). No explicit Node inspector or profiling script.

---

## 6) Rendering + state management

- **State libraries**: React Query only (`@tanstack/react-query`, `@tanstack/react-query-devtools`). No Zustand, Redux, or SWR.
- **Caches / invalidation**:
  - Query keys: `trak/src/lib/react-query/query-client.ts` — currentUser, userWorkspaces, projectTabs, tabBlocks, fileUrls, workspace, table, tableBootstrap, tableRows, tableView, tableComments, propertyDefinitions, entityProperties, entityPropertiesWithInheritance, entityLinks, projectTags, workspaceEverything.
  - Invalidation: tabBlocks on block create/update (tab-canvas.tsx); taskItems on task mutations (use-task-queries.ts); tableRows/tableBootstrap/tableFields on table/field/row/view mutations (use-table-queries.ts); timeline items and entity properties on timeline mutations (use-timeline-queries.ts); entity/property invalidation (use-property-queries.ts); workflow/ai full invalidate (workflow-ai-chat-panel, ai-command-palette).
- **Suspense / streaming**: No `Suspense` boundaries or React streaming used in the listed flows. Loading UI: `dashboard/loading.tsx`, `dashboard/projects/loading.tsx`, `dashboard/projects/[projectId]/loading.tsx`, `dashboard/projects/[projectId]/tabs/[tabId]/loading.tsx`; table-view has local `TableViewLoadingState`; block-renderer uses dynamic() with `BlockLoadingState` for heavy blocks.
- **Big list renderers**: No virtualization (no react-window, react-virtual, or “virtual” in codebase). Table and timeline render full lists.

---

## 7) Build tooling / bundle behavior

- **Next config**: `trak/next.config.mjs`. Turbopack when `DISABLE_TURBOPACK !== '1'`. `experimental.optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']`. Images: avif/webp, deviceSizes, imageSizes, remotePatterns for `**.supabase.co`. `poweredByHeader: false`, `compress: true`. Bundle analyzer: `@next/bundle-analyzer` with `enabled: process.env.ANALYZE === 'true'`.
- **Largest client bundles**: Measure with `npm run build:analyze` (ANALYZE=true next build); analyzer output location not customized in snippet (default .next/analyze). Heavy dynamic blocks: task-block, timeline-block, table-block, file-block, video-block, image-block, gallery-block, embed-block, pdf-block, ChartBlock, section-block (all in block-renderer.tsx).
- **Images/fonts**: next/image with remote Supabase; some blocks use `unoptimized` (image-block.tsx, gallery-block.tsx). README references `next/font` and Geist (not seen in snippet).

---

## 8) Realtime / sync

- **WebSockets / Supabase Realtime**: No app-level `channel()` or `subscribe()` usage. Realtime present only as dependency (`@supabase/realtime-js` in package-lock). Updates are request/response + React Query invalidation.
- **Polling / refetch**: Default React Query: refetchOnWindowFocus false, refetchOnMount false; no aggressive polling found.
- **Fan-out**: Sync from table_rows / task_items / timeline_events to entity_properties via DB triggers (migrations 20260210000004_sync_table_rows_to_entity_properties, 20260210000007_sync_timeline_events_to_entity_properties, 20260213200000_fix_sync_trigger_for_universal_source_tracking). One source row/event can write multiple entity_properties rows.

---

## 9) AI subsystem performance

- **Model / provider**: Deepseek (executor: DEEPSEEK_MODEL, DEEPSEEK_API_URL) for main chat/tools; OpenAI for completion-only (callOpenAICompletion, OPENAI_MODEL / OPENAI_DEFAULT_MODEL). Keys from env.
- **Tool calling**: Tools defined in `trak/src/lib/ai/tool-definitions.ts`; execution in `trak/src/lib/ai/tool-executor.ts` (createClient, updateTask, searchTasks, etc.). Executor in `trak/src/lib/ai/executor.ts` (executeAICommandStream, callDeepseek, parallel_tool_calls, temperature 0.1).
- **Streaming**: POST /api/ai/stream and /api/workflow/stream return SSE; client state in ai-command-palette.tsx and workflow-ai-chat-panel.tsx (streamingStatus, streamingResponse).
- **Retries / tokens**: Executor has tool repeat/error/empty-arg guards; max_tokens capped (DEEPSEEK_MAX_TOKENS_LIMIT). No explicit retry or token usage logging in snippet.
- **Persistence**: Tool results feed back via messages in executor; workflow messages in workflow_sessions / workflow_messages (workflow-session.ts, workflow-executor.ts). No separate “tool results” table; context built from blocks and search (getBlockWithContext, ai-context).
- **Vector / RAG**: `match_unstructured_parents` RPC (embeddings); tables unstructured_parents, unstructured_chunks, indexing_jobs. Indexing in actions/indexing.ts and api/internal/indexing. File analysis and cleanup in file.ts (cleanupChunksForDeletedSource).

---

## 10) Known pain points / TODOs

- **Search**: `TODO(perf)` / `FIXME` / “perf” / “slow” / “n+1” / “optimize”:
  - `trak/src/lib/search/query.ts`: comment “I should probably have done that for performance” (line 38).
  - `trak/docs/AI_SEARCH_TESTING.md`: “Issue: Slow queries (>1s)”.
  - `trak/Entity Search Functions - AI Data Access Layer.txt`: “Slower: Full scan”.
  - `trak/Source_Data_Population_and_Assignee_Population_Fix.md`: “Slow path — createTable → bulkCreateFields → bulkInsertRows”.
- **Optimize mentions**: `trak/src/app/actions/block.ts`: “GET TAB BLOCKS - OPTIMIZED”; `trak/src/app/actions/project.ts`: “GET ALL PROJECTS - OPTIMIZED”, “Optimized search”, “could be optimized by only selecting specific keys”; `trak/src/app/actions/tab.ts`: “GET PROJECT TABS - OPTIMIZED”; `trak/src/app/dashboard/page.tsx`: “optimized with inner joins”; `trak/src/app/actions/client.ts`: “GET ALL CLIENTS - OPTIMIZED”; `trak/src/app/dashboard/layout.tsx`: “Optimized Dashboard Layout”; query-client.ts “Optimized for tab navigation and block data caching”.
- **Other**: `trak/src/app/dashboard/projects/[projectId]/client-page-toggle.tsx`: “TODO: Open analytics modal”. `trak/src/components/error-boundary.tsx`: “TODO: Send error to error tracking service (e.g., Sentry)”. `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/video-block.tsx`: “Consider compressing for better performance” for large video. Image/gallery blocks use `unoptimized` on next/image in several places.

---

## Top 10 likely bottlenecks (with code locations)

1. **Dashboard load (many parallel queries + RPC)** — `trak/src/app/dashboard/page.tsx`: Promise.allSettled of 6+ queries plus getWorkspaceEverything(500) and getDashboardInsights; getDashboardInsights runs 7 fixed searches + optional LLM.
2. **getTaskItemsByBlock (N+1-style joins)** — `trak/src/app/actions/tasks/query-actions.ts` getTaskItemsByBlock: task_items then 4× .in(taskIds) (subtasks, comments, tag_links, assignees), then task_tags by tag_ids, profiles for authors, profiles for assignees; no single RPC to return full shape.
3. **getTableBootstrap (full rows in one shot)** — `trak/src/app/actions/tables/query-actions.ts` getTableBootstrap: table + fields + default view + all table_rows (filtered/sorted); no pagination.
4. **searchTableRows (full scan in memory)** — `trak/src/app/actions/tables/query-actions.ts` searchTableRows: select all rows for table then filter in JS; large tables will be slow.
5. **getBatchFileUrls (N signed URLs)** — `trak/src/app/actions/file.ts` getBatchFileUrls: one files query + one workspace_members check + N× createSignedUrl in parallel; many images on a tab = many storage calls.
6. **getWorkspaceEverything RPC (500 items)** — `trak/src/app/actions/everything-view.ts`: single RPC get_workspace_everything with p_limit 500; used on every dashboard load for due-aware items.
7. **Dashboard insights (7 search calls + LLM)** — `trak/src/app/actions/dashboard-insights.ts` gatherDashboardOverviewData: 7 parallel searchTasks/searchTimelineEvents/searchProjects; then getDashboardInsights may call LLM and write dashboard_ai_insights.
8. **RLS can_access_project recursion risk** — `trak/supabase/migrations/20260212001000_fix_can_access_project_rls_recursion.sql` suggests past recursion; policies on projects/tabs/blocks/task_items/timeline_events/tables all use can_access_project — hot path.
9. **Block content size** — `trak/src/app/actions/block.ts` getTabBlocks selects full `content` JSONB for up to 500 blocks; large content (e.g. table snapshot, rich text) increases payload and parse time.
10. **AI stream tool round-trips** — `trak/src/lib/ai/executor.ts` + tool-executor: each tool call does DB work (e.g. createTaskFullRpc, searchTasks); multiple rounds of tool calls before final response.

---

## How to reproduce slowness

- **Dashboard (workspace home)**  
  - Path: Log in → select workspace → open `/dashboard`.  
  - Data: Workspace with many projects, 100+ open tasks, many docs, blocks with comments, and 500+ “everything” items.  
  - Observe: Time to first paint and until “Today/Upcoming/Past due” and AI insights are ready; check network for getWorkspaceEverything and getDashboardInsights.

- **Project tab with tasks**  
  - Path: Dashboard → project → tab that contains one or more task blocks with many tasks.  
  - Data: Tab with 100+ tasks in one block; optional file/image/gallery blocks (dozens of file IDs).  
  - Observe: Tab load (getTabBlocks + getProjectTabs + getBatchFileUrls); then opening a task block triggers getTaskItemsByBlock (task_items + subtasks/comments/tags/assignees/profiles).

- **Table view (large table)**  
  - Path: Dashboard → project → tab with table block → open table.  
  - Data: Table with 1k+ rows and 20+ columns (wide data JSONB).  
  - Observe: getTableBootstrap (table + fields + view + all rows); then search/filter (searchTableRows or getFilteredRows) and sort.

- **Timeline view**  
  - Path: Dashboard → project → tab with timeline block.  
  - Data: Block with 200+ events.  
  - Observe: getResolvedTimelineItems (all events in one query).

- **AI dashboard insights**  
  - Path: Dashboard with no cached insights or after cache expiry.  
  - Data: Workspace with many tasks and timeline events.  
  - Observe: getDashboardInsights → 7 search calls + optional LLM + write to dashboard_ai_insights.

- **AI command with tools**  
  - Path: Open AI command palette → run “Add task X to project Y” or “Summarize my tasks”.  
  - Data: Workspace with many projects/tabs/tasks.  
  - Observe: Stream latency and number of tool_call/tool_result round-trips in network or [AI TIMING] logs.

- **File-heavy tab**  
  - Path: Open tab with 20+ image blocks or one gallery with 50+ images.  
  - Data: Many file IDs passed to getBatchFileUrls.  
  - Observe: Server action duration and N× createSignedUrl (parallel but still N round-trips to storage).

---

*End of context dump.*
