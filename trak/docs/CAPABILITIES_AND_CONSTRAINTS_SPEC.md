# Trak — Capabilities & Constraints Spec

Implementation-accurate specification of Trak’s project, tab, block, task, table, and AI systems for designing pre-seeded templates that map 1:1 to what Trak can create and render.

---

## 1) Product primitives (data model)

### Organization
- **Not present as a first-class entity.** Trak has no “Organization” table. The top-level tenant is **Workspace**.

### Workspace
- **Primary key:** `id` (UUID).
- **Important fields:** `owner_id` (references `auth.users`), name/slug if present (see migrations for full columns). Workspace is the billing and membership boundary.
- **Relationships:** `workspace_members` (user_id, workspace_id, role); `workspace_invitations`; `workspace_teams`; all projects, docs, tables, clients belong to a workspace.
- **Constraints:** RLS via `is_member_of_workspace(workspace_id)`. No soft delete observed at workspace level.

### Client
- **Primary key:** `id` (UUID).
- **Important fields:** `workspace_id`, `name`, `company` (and any other columns in migrations).
- **Relationships:** Projects can optionally link to a client via `client_id` (project has `client:clients(id, name, company)`). Used for client-facing project pages.
- **Constraints:** Belongs to one workspace. See schema for FKs.

### Project
- **Primary key:** `id` (UUID).
- **Important fields:** `workspace_id`, `name`, `status` (e.g. `not_started` | `in_progress` | `complete`), `due_date_date`, `due_date_text`, `priority`, `tags` (array), `client_id` (optional), `client_page_enabled`, `client_comments_enabled`, `client_editing_enabled`, `public_token`, `project_type` (e.g. `project` | `internal`), `is_workspace_analysis_project`, `internal_group_id` (for internal spaces).
- **Relationships:** `tabs` (project_id); `project_members` (optional project-level access); `project_tags`, `project_folders`; `blocks` via tabs.
- **Constraints:** One workspace. If `project_members` has any rows for a project, only those users plus workspace owner can access; otherwise all workspace members can access. Cascade deletes to tabs, then blocks. No soft delete on project.

### Tab
- **Primary key:** `id` (UUID).
- **Important fields:** `project_id`, `parent_tab_id` (nullable, for hierarchy), `name`, `position` (integer, for ordering), `is_workflow_page` (boolean), `workflow_metadata` (jsonb).
- **Relationships:** Parent/children via `parent_tab_id`; `blocks` (tab_id, parent_block_id null for root-level blocks); workflow: `workflow_sessions` (one per tab when used as workflow page).
- **Constraints:** TABS_PER_PROJECT_LIMIT = 1000 (`tab.ts`). Ordering by position. No soft delete.

### Block
- **Primary key:** `id` (UUID).
- **Important fields:** `tab_id`, `parent_block_id` (null = root; non-null = child of a section block), `type` (BlockType), `content` (JSONB, shape by type), `position` (integer row), `column` (0, 1, or 2), `is_template`, `template_name`, `original_block_id` (if set, block is a reference to another block), `locked` (boolean).
- **Relationships:** A block belongs to exactly one tab. It can optionally reference one “original” block (reference block). Nested blocks only under section blocks via `parent_block_id`.
- **Constraints:** BLOCKS_PER_TAB_LIMIT = 500 (`block.ts`). Column in [0, 2]. Ordering: column ascending, then position ascending. No soft delete; delete is hard. Tasks are not stored in block content—they live in `task_items` linked by `task_block_id`.

### Workflow vs Project
- **Workflow is not a separate entity from Project.** A “workflow” is a **tab** with `is_workflow_page = true`. That tab can live in any project (including the workspace’s “Workspace Analysis” internal project). Workflow AI state is stored in `workflow_sessions` (one per tab) and `workflow_messages`. So: **Workflow = Tab (is_workflow_page=true) + workflow_sessions + workflow_messages.**

### Other primitives
- **Page/Doc:** “Doc” is a workspace-level document: `docs` table (id, workspace_id, title, content ProseMirror JSON, created_by, is_archived, folder_id). Not inside a project/tab; listed at `/dashboard/docs`.
- **Entity (for properties):** Not a table. “Entity” is a polymorphic concept: `entity_type` + `entity_id` where entity_type ∈ { block, task, subtask, timeline_event, table_row }. Stored in `entity_properties`, `entity_links`.
- **Table:** First-class table: `tables` (id, workspace_id, project_id, title, description, icon, etc.). Rows in `table_rows`, schema in `table_fields`, views in `table_views`.
- **Task:** A row in `task_items`, linked to a task **block** via `task_block_id`. So “task” = task block (block type "task") + task_items.

---

## 2) Project structure & navigation

### Views inside a project
- **Tab bar:** List of tabs (with hierarchy if `parent_tab_id` used). Tabs are created, renamed, reordered; no “archived” tab state in code (TBD if any).
- **Tab content (canvas):** Root-level blocks in a grid (columns 0–2, position ordering). Section blocks contain child blocks. Add-block UI (dropdown) per row and inside sections.
- **Side panels:** Workflow AI chat panel on workflow pages (`workflow-ai-chat-panel.tsx`). No other project-level side panels specified here.
- **Modals/dialogs:** Block conversion, make template, block reference picker, doc selector, confirm delete, etc.

### Tab creation, ordering, rename
- **Create:** `createTab({ projectId, name, parentTabId? })`. Position = max(position) + 1 at same level.
- **Ordering:** By `position` (integer). Reorder via update of position values.
- **Rename:** `updateTab` (tab.ts). No “archive” in current tab actions (TBD).

### Tab types
- **Default tabs:** Regular tabs (`is_workflow_page = false`).
- **Workflow pages:** Tabs with `is_workflow_page = true`; get workflow AI chat and optional sharing (public token + client page).
- **Client tabs:** For client-facing projects, `client_tabs` / `client_tab_blocks` define the client view; they are separate from dashboard tabs and can differ.

### Limits
- **Tabs per project:** 1000 (`TABS_PER_PROJECT_LIMIT` in tab.ts).
- **Blocks per tab:** 500 (`BLOCKS_PER_TAB_LIMIT` in block.ts). Root-level only; section children are additional.
- **Columns:** 0, 1, 2 (three columns per row).
- Performance: Large block counts may degrade; no explicit pagination of blocks in current getTabBlocks.

---

## 3) Block system overview (canonical list)

Block type union in code: `BlockType = "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "video" | "image" | "gallery" | "embed" | "pdf" | "section" | "chart" | "doc_reference" | "shopify_product"` (`src/app/actions/block.ts`). Renderer: `src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer.tsx`.

| Block type | Purpose | Data schema (content JSONB) | Renderer path | Interactions | Comments / attachments / assignees / due / status / priority / tags | References | Constraints |
|------------|---------|-----------------------------|---------------|--------------|---------------------------------------------------------------------|------------|-------------|
| **text** | Rich text | `{ text: string }` (TipTap/ProseMirror or plain) | `text-block.tsx` | Edit inline, convert | Properties (entity_properties) on block | @mentions, entity_links | — |
| **task** | Task list | `{ title, hideIcons?, viewMode?: "list" \| "board" \| "table", boardGroupBy?: "status" \| "priority" \| "assignee" \| "dueDate" \| "tags", heightPx?, filters?, search?, showDone?, rollups?, showRollup? }`. Items in `task_items`. | `task-block.tsx` | Add/edit/delete tasks, subtasks, assignees, due dates, status, priority, tags; list/board/table view; filters | Tasks: comments (task_comments), assignees (task_assignees), due dates, status, priority, tags (task_tag_links) | Tasks can reference docs, table_row, task, block, tab via task_references | Task status: todo \| in-progress \| done (task_items); property status: in_progress (underscore) |
| **link** | External link | `{ title: string \| null, url: string \| null, caption?: string }` or `description` in some places | `link-block.tsx` | Edit title/url/caption, preview | Block properties | — | — |
| **divider** | Horizontal rule | `{}` | `divider-block.tsx` | None | — | — | — |
| **table** | Data table | `{ tableId: string }` (UUID of `tables` row). Table schema in `table_fields`, rows in `table_rows`. | `table-block.tsx` | Edit cells, add/remove rows/columns, sort/filter/group; table_views (default view type "table") | Table rows can have entity_properties; table_comments on rows | Rows can reference tasks/timeline/table_row/block (source_entity_*) | Table block create creates real table + default view |
| **timeline** | Timeline of events | Server createBlock: `{ startDate, endDate, events: [] }`. UI getDefaultContent: `{ viewConfig: { startDate, endDate, zoomLevel?, filters?, groupBy? } }`. Both shapes may exist; events in `timeline_events`. | `timeline-block.tsx` | Add/edit/delete events, dependencies; view config | Events: status, priority, assignees (entity_properties / named fields) | Events can source from task/timeline_event/table_row/block (snapshot/live) | timeline_events have status (todo \| in_progress \| done \| blocked) |
| **file** | File list | `{ files: array }` (file IDs). Attachments via `file_attachments` (block_id, file_id). | `file-block.tsx` | Upload, remove, open; display mode | Files in `files` table; file_attachments link to block | — | 50MB per file; Supabase Storage bucket "files" |
| **video** | Video player | `{ files: [] }` (same as file) | `video-block.tsx` | Upload, play | Same as file | — | — |
| **image** | Single image | `{ fileId: string \| null, caption: string, width: number }` | `image-block.tsx` | Upload, caption, resize | file_attachments | — | — |
| **gallery** | Image grid | `{ layout?: "array" \| "collage", arrayColumns?, arrayRows?, items: [] }` | `gallery-block.tsx` | Add/remove images, layout | Items reference files | — | — |
| **embed** | External embed | `{ url: string, displayMode?: "inline" }` | `embed-block.tsx` | Edit URL, display mode | — | — | — |
| **pdf** | PDF viewer | `{ fileId: string \| null }` | `pdf-block.tsx` | Upload PDF, view | file_attachments | — | — |
| **section** | Collapsible container | `{ height?: number }` (pixels) | `section-block.tsx` | Add child blocks, resize height, collapse | Child blocks can have properties | Child blocks only under section | — |
| **chart** | Chart/spec | `{ code?: string, chartType?: string, title?: string }` or spec-based | `@/components/blocks/ChartBlock` | Edit spec/code, what-if (createSpecChartBlock) | — | Can reference chart block for simulation | — |
| **doc_reference** | Link to workspace doc | `{ doc_id: string, doc_title: string }` | `blocks/doc-reference-block.tsx` | Pick doc, open in docs | — | Points to docs.id | — |
| **shopify_product** | Shopify product card | `{ product_id?: string, heightPx?: number }` (product_id = trak_products.id) | `shopify-product-block.tsx` | Pick product, refresh, expand | — | Requires Shopify connection; trak_products | Workspace must have Shopify connected |

### Block reference
- Blocks with `original_block_id` set render via `BlockReferenceRenderer` (lazy load original block). No separate “block type” for reference; same type as original, with reference wrapper.

### Templates and references
- **Template:** Any block with `is_template = true` and optional `template_name`. Used by “block reference” picker to insert a reference. Templates are normal blocks in a tab; no separate template store.
- **Apply template:** No “apply template to project” flow. User inserts a “block reference” from template blocks (same workspace). Seeding: create blocks with desired content; optionally set `is_template` on some for reuse.

### Universal properties (all applicable entity types)
- **Entity types:** block, task, subtask, timeline_event, table_row.
- **Fields:** status, priority, assignee(s), due_date, tags. Stored in `entity_properties` (entity_type, entity_id, field_name, field_type, value). Status: todo \| in_progress \| done \| blocked. Priority: low \| medium \| high \| urgent. Multiple assignees via assignee_ids / named assignee fields.

---

## 4) Task & status model

### What is a “task”
- A **task** is a row in `task_items`, always tied to a **task block** via `task_block_id`. The task block is a block of type `"task"`; it holds list/view config in `content`, not the items. So: task = task block (block) + task_items (rows).

### Task item fields (task_items + entity_properties)
- **Core:** title, description, display_order, hide_icons, created_by, updated_by.
- **Status:** `statuses` JSONB array of `{ field_name, value }`; canonical values todo \| in-progress \| done \| blocked. (Note: task_items use "in-progress" with dash; entity_properties use "in_progress" with underscore.)
- **Priority:** `priorities` JSONB array of `{ field_name, value }`; values low \| medium \| high \| urgent.
- **Assignees:** task_assignees (task_id, assignee_id, assignee_name); also synced to entity_properties “Assignee” field (value = array of { id, name }).
- **Due dates:** due_date, due_time, due_time_end, start_date (on task_items); plus named due_dates in entity_properties (start/end).
- **Recurrence:** recurring_enabled, recurring_frequency (daily \| weekly \| monthly), recurring_interval.
- **Dependencies:** Not implemented as task-to-task dependencies. Timeline has timeline_dependencies (event-to-event). TBD: task dependencies.
- **Subtasks:** task_subtasks (task_id, title, description, completed, display_order). Supported.
- **Tags:** task_tags + task_tag_links (task_id, tag_id). Tags are workspace-level (task_tags.workspace_id).
- **Source/sync:** source_task_id, source_entity_type, source_entity_id, source_sync_mode (snapshot \| live) for “synced” tasks from table row / block / etc.

### Task views
- **List:** viewMode "list" (default).
- **Board:** viewMode "board", boardGroupBy status \| priority \| assignee \| dueDate \| tags. Real.
- **Table:** viewMode "table". Real.
- **Timeline/Calendar:** Tasks can be represented on timeline (timeline events) or linked; no native “task calendar view” in task block. Timeline block is separate (timeline_events). TBD: dedicated calendar view for tasks.

---

## 5) Table model

### What is a table
- **tables:** id, workspace_id, project_id (nullable), title, description, icon, created_at, updated_at, created_by. Optional tab_id (for scoping).
- **table_fields:** id, table_id, name, type, config (JSONB), order, is_primary, width. Field types: text, long_text, number, select, multi_select, date, checkbox, subtask, url, email, phone, person, files, created_time, last_edited_time, created_by, last_edited_by, formula, relation, rollup, status, priority, tags.
- **table_rows:** id, table_id, source_entity_type, source_entity_id, source_sync_mode, data (JSONB, keyed by field id), order (fractional), created_at, updated_at, created_by, updated_by, edited (for snapshots).
- **table_views:** id, table_id, name, type (table \| board \| timeline \| calendar \| list \| gallery), config (JSONB), is_default, created_by. One “Default view” (type "table") created with each new table.
- **table_relations, table_comments, table_rollups** exist per schema.

### Column/field types supported
- text, long_text, number, select, multi_select, date, checkbox, subtask, url, email, phone, person, files, created_time, last_edited_time, created_by, last_edited_by, formula, relation, rollup, status, priority, tags (from `src/types/table.ts`).

### Sorting / filtering / grouping
- Implemented in UI and RPCs (e.g. bulk update by field names, filters). table_views.config stores view state (TBD exact shape for sort/filter/group).

### Row limits & performance
- No explicit row limit found in code. Large tables may impact performance; no pagination specified for table_rows in this spec.

### Saved views
- table_views: each table has at least one view (default "Default view", type "table"). Views are stored in DB; config is JSONB.

---

## 6) Docs / rich text

### Where docs live
- **docs** table: workspace-scoped; not inside projects/tabs. List at `/dashboard/docs`. Can be in doc_folders (folder_id).

### Block embedding / mentions
- **doc_reference** block: content.doc_id links to docs.id; opens doc. No inline doc embedding in rich text (TBD).
- **Mentions:** entity_links and @-mentions in properties/editor; doc can be referenced from blocks.

### Search
- Docs are indexed for unstructured/semantic search (unstructured_parents, unstructured_chunks). searchDocs AI tool.

### Export / share
- No export/share behavior specified in explored code (TBD).

---

## 7) Files & attachments

### Where attachments can be added
- **File block:** multiple files via file_attachments (block_id, file_id).
- **Image block:** single file (content.fileId).
- **Video block:** files array.
- **PDF block:** single file (content.fileId).
- **Gallery block:** items reference files.
- **Standalone files:** uploadStandaloneFile (project-scoped, no block); stored in `files` with project_id.

### Storage backend
- **Supabase Storage,** bucket name **"files"**. Path pattern: `{workspaceId}/{projectId}/{fileId}.{ext}`.

### Metadata (files table)
- id, workspace_id, project_id, uploaded_by, file_name, file_size, file_type, storage_path. file_attachments link file to block (block_id, file_id, display_mode inline \| linked).

### Permissions & public link
- RLS on storage; signed URLs for access. Client page: when project has client_page_enabled and public_token, service role used for getBatchFileUrlsPublic so client can view attached files.

### Preview types
- Images, video (MP4), PDF (pdf-block). File type validation in upload (e.g. validateFileType). 50MB max file size.

---

## 8) External collaborators & sharing

### Workspace invites
- **workspace_invitations** table. Invite flow exists; role likely in invitation (TBD exact roles for invitees).

### Project sharing
- **project_members:** if rows exist, only listed users + workspace owner can access project. No “share project link” to external users without account (TBD).

### Client page (magic link / public)
- Projects can have **client_id** and **client_page_enabled**. **public_token** on project. Public URL pattern: `/client/[publicToken]/[tabId]` for client-facing tab content. Uses client_tabs / client_tab_blocks (can differ from dashboard tabs). **client_comments_enabled**, **client_editing_enabled** control features. Unauthenticated clients access via token; service role used for file URLs and comments.

### Workflow page sharing
- **enableWorkflowPageSharing(tabId):** enables client page for the project and returns public URL `/client/{publicToken}/workflow/{tabId}`. External user can open workflow tab (and AI chat) via link.

### Guest access
- No “guest” role in workspace_members in explored code. External access is via client page (public token) or workflow share link, not as a logged-in guest role. TBD: guest role.

---

## 9) Integrations

### Current integrations
- **Shopify:** OAuth (shopify_connections), products/variants/inventory synced into trak_products, trak_product_variants, trak_product_inventory. trak_product_sales_cache for sales data. shopify_sync_jobs for background sync. Sync: pull (API); frequency TBD (sync worker in code).
- **Slack:** slack_workspace_connections, slack_user_links; commands and interactive; AI execution from Slack (slack-executor). Audit and rate limits in DB.
- **Google Calendar:** google_calendar_connections (migration). TBD usage in app.
- **Stripe:** payments, payment_events (for workflow/billing). TBD scope.

### Shopify objects synced
- Products (trak_products: title, description, product_type, vendor, tags, featured_image_url, status, etc.).
- Variants (trak_product_variants: price, sku, options, inventory_item_id, etc.).
- Inventory (trak_product_inventory: location_id, available).
- Sales cache (trak_product_sales_cache). Collections: TBD. Orders: not stored as first-class sync in listed tables (TBD).

### Where stored and linked
- All Shopify data is workspace-scoped (connection_id → workspace_id). Projects/tabs/blocks reference Shopify only via **shopify_product** block (content.product_id = trak_products.id). No project-level “Shopify project”;
- Products table can be created from Shopify (AI tool createProductsTable).

---

## 10) AI capabilities (Prompt-to-Action)

### How AI is invoked
- **Dashboard:** AI command palette (e.g. ai-command-palette.tsx); per-tab or global command.
- **Workflow page:** Workflow AI chat panel (workflow-ai-chat-panel, workflow executor); conversation persisted in workflow_sessions + workflow_messages.
- **Slack:** Commands trigger AI (slack-executor).
- **API:** `/api/ai/stream`, `/api/workflow/execute`, `/api/workflow/stream`, `/api/workflow/messages` (and non-stream execute).

### Tool calling — list of tools (exact names)
- **Control:** requestToolGroups
- **Search:** unstructuredSearchWorkspace, searchTasks, searchSubtasks, getSubtaskDetails, searchProjects, searchTabs, searchClients, searchWorkspaceMembers, searchTables, searchTableRows, searchTimelineEvents, searchBlocks, searchDocs, searchDocContent, searchFiles, searchTags, searchEntitiesByProperties, searchAll, resolveEntityByName, getEntityById, getEntityContext, getTableSchema
- **Task:** createTaskItem, updateTaskItem, bulkUpdateTaskItems, bulkMoveTaskItems, duplicateTasksToBlock, createTaskBoardFromTasks, deleteTaskItem, bulkCreateTasks, setTaskAssignees, bulkSetTaskAssignees, setTaskTags, createTaskSubtask, updateTaskSubtask, deleteTaskSubtask, createTaskComment
- **Project/Tab:** createProject, updateProject, deleteProject, createTab, updateTab, deleteTab
- **Block:** createSpecChartBlock, createBlock, updateBlock, deleteBlock
- **Table:** createTable, createField, bulkCreateFields, updateField, deleteField, createRow, updateRow, updateCell, deleteRow, deleteRows, bulkInsertRows, bulkUpdateRows, updateTableRowsByFieldNames, bulkUpdateRowsByFieldNames, createTableFull, updateTableFull, deleteTable
- **Timeline:** createTimelineEvent, createTimelineSubEvent, updateTimelineEvent, deleteTimelineEvent, createTimelineDependency, deleteTimelineDependency
- **Property:** setEntityProperty, removeEntityProperty
- **Client:** createClient, updateClient, deleteClient
- **Doc:** createDoc, updateDoc, archiveDoc, deleteDoc
- **File:** fileAnalysisQuery, renameFile
- **Comment:** createComment, updateComment, deleteComment
- **Workspace:** reindexWorkspaceContent
- **Shopify:** searchShopifyProducts, getShopifyProductDetails, getShopifyProductSales, createProductsTable, refreshShopifyProduct

(Full list from `src/lib/ai/tool-definitions.ts`; createBlock enum includes text, task, table, timeline, image, file, video, embed, gallery, section, link, pdf, chart, doc_reference.)

### Data access (AI context)
- Workspace, project, tab, blocks, tasks, tables/rows, timeline events, docs, files, entity properties, Shopify products. BuildContext / getEntityContext / search tools provide scope (workspace, project, tab). Workflow executor has tab/project context.

### Safety: confirmation, undo, audit
- **Confirmation:** Optional requireWriteConfirmation; some flows ask user to confirm.
- **Undo:** Undo tracker in executor (captureUndoStepsBefore); undoBatches returned in result. Not all tools participate (skippedTools).
- **Audit:** Slack: slack_command_audit_log. No generic AI audit log per workspace/user in explored code (TBD).

### Token tracking & gating
- No per-workspace or per-user token/usage tracking found in codebase. TBD: where usage is measured or gated.

---

## 11) Permissions & roles

### Workspace roles
- **workspace_members.role:** owner, admin, member (from RLS policies: `wm.role IN ('owner', 'admin')` for certain actions). Guest: TBD.
- **Owner:** workspace.owner_id; full access; can manage members.
- **Admin:** Can add/remove project members, manage workspace (policies reference owner/admin).
- **Member:** Standard access; project access by can_access_project (all members if no project_members, else explicit list + owner).

### Project-level
- **project_members:** If any row exists for a project, only those user_ids plus workspace owner can access. Otherwise all workspace members can access. RLS uses can_access_project(project_id).

### RLS overview
- Workspace: is_member_of_workspace(workspace_id).
- Projects: can_access_project(project_id) for SELECT/UPDATE/DELETE; INSERT by workspace members.
- Blocks: via tab → project access; plus public can view blocks when project has client_page_enabled and public_token (for client page).
- Tables, task_items, timeline_events, docs, files, etc.: scoped by workspace (or project) and membership. See SECURITY_SURFACE_MAPPING.md and migrations for full policies.

### Advanced permissions
- No “custom roles” or permission matrix beyond owner/admin/member and project_members. TBD: advanced permissions.

---

## 12) Template support

### Do templates exist?
- **Block-level only.** A block can be marked `is_template = true` with optional `template_name`. Template blocks are normal blocks in a tab; they appear in the “block reference” picker (same workspace). No project or tab templates in DB.

### Where defined
- **DB:** blocks.is_template, blocks.template_name. Template blocks live in regular tabs.
- **Code:** getTemplateBlocks(workspaceId), makeBlockTemplate(blockId, templateName), removeBlockTemplate(blockId). API: `/api/blocks/templates?workspaceId=...` (block-reference-selector).

### Can we seed projects, tabs, blocks, tables, default rows, default statuses?
- **Yes.** Create via server actions or RPCs: createProject, createTab, createBlock, createTable (and createTableFull with fields/rows), createTaskItem, createTimelineEvent, etc. Default statuses: task_items use statuses JSONB (e.g. Status = todo); entity_properties and table status/priority fields use workspace/project defaults where applicable. No “seed template” JSON format in code; seeding would be custom scripts or API calls.

### Apply template to existing workspace?
- **No “apply template” action.** To mimic: create project/tabs/blocks/tables/tasks with same structure and content (script or tool calls). Block references can be used to point to existing template blocks.

### Modify templates after creation
- **Yes.** Templates are normal blocks; updateBlock, updateTab, etc. work. Rename via template_name update.

### Migration/seed scripts
- **scripts/** contains data migrations/seed helpers (e.g. CODE_SNIPPETS.md references “Creates 6 subtabs, ~15 blocks, ~11 task items of seed data”). No standard “template JSON” loader; populate-buckeye and similar are dev/seed (SECURITY_SURFACE_MAPPING.md). TBD: canonical seed format for Product Launch etc.

---

## 13) Known constraints & roadmap assumptions

### Not built yet (assumptions to avoid)
- **Calendar view** for tasks: not a native task view; timeline block is separate. Don’t assume task calendar.
- **Task dependencies:** No task-to-task dependency table; timeline has event dependencies only.
- **Approvals:** No approval workflow in explored code.
- **Automations:** No automation engine (e.g. “when status changes, do X”) in explored code.
- **Recurrence UI:** task_items has recurring_* fields; UI completeness TBD.
- **Org-level:** No organization; only workspace.

### Scaling constraints
- Blocks per tab: 500 (hard limit in getTabBlocks).
- Tabs per project: 1000. Large tables: no defined row limit; performance not guaranteed.
- Realtime: Supabase realtime may be used; no spec of subscription limits here.

### Product Launch template
- Don’t assume: calendar view, task dependencies, approvals, automations, or “apply template” one-click. Do assume: create project → create tabs → create blocks (text, task, table, timeline, link, etc.) and optionally task_items, table_rows, timeline_events via existing APIs/actions. Table block requires createTable (or createTableFull) and content.tableId. Task block requires task block + createTaskItem for each task. Status/priority/tags: use canonical values (todo, in-progress, done, blocked; low, medium, high, urgent).

---

## Appendix A) Code pointers

| Area | Path(s) |
|------|--------|
| DB schema / migrations | `trak/supabase/migrations/` (all `.sql`); no single schema.sql — infer from migrations. Key: 20260204141000 (workflow_pages), 20260208000000 (Shopify), 20260203120000 (RPC super/bulk), 20260212000000 (project_permissions), 20260221174000 (status JSONB), 20260226150000 (table create_table_full), etc. |
| Block type & defaults | `trak/src/app/actions/block.ts` (BlockType, Block, createBlock default content, BLOCKS_PER_TAB_LIMIT) |
| Block renderer registry | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer.tsx` |
| Block components | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/*-block.tsx`, `trak/src/components/blocks/ChartBlock.tsx`, `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/blocks/doc-reference-block.tsx`, `shopify-product-block.tsx` |
| Tab / project layout | `trak/src/app/dashboard/projects/[projectId]/layout.tsx`, `tab-bar.tsx`, `trak/src/app/actions/tab.ts` (TABS_PER_PROJECT_LIMIT, createTab, getProjectTabs) |
| AI tool definitions | `trak/src/lib/ai/tool-definitions.ts` |
| AI tool executor | `trak/src/lib/ai/tool-executor.ts` |
| AI executor (stream/command) | `trak/src/lib/ai/executor.ts`, `trak/src/lib/ai/workflow-executor.ts` |
| Shopify integration | `trak/supabase/migrations/20260208000000_add_shopify_integration.sql`, `trak/src/app/actions/shopify-products.ts`, `trak/src/lib/shopify/` |
| Permissions / RLS | `trak/supabase/migrations/20260212000000_add_project_permissions.sql` (can_access_project, project_members), SECURITY_SURFACE_MAPPING.md, is_member_of_workspace in migrations |
| Properties (entity) | `trak/src/types/properties.ts`, `trak/src/app/actions/properties/`, entity_properties in migrations |
| Task types & RPCs | `trak/src/types/task.ts`, `trak/src/app/actions/tasks/`, migrations (create_task_full, task_items, task_assignees, statuses/priorities) |
| Table types & RPCs | `trak/src/types/table.ts`, `trak/src/app/actions/tables/`, create_table_full in migrations |
| Block templates | `trak/src/app/actions/block-templates.ts`, `trak/src/app/api/blocks/templates` |

---

## Appendix B) Example JSON payloads

### Project with tabs (conceptual; API uses server actions, not single JSON)

```json
{
  "project": {
    "name": "Product Launch",
    "status": "in_progress",
    "tags": ["launch", "Q1"]
  },
  "tabs": [
    { "name": "Overview", "position": 0 },
    { "name": "Tasks", "position": 1 },
    { "name": "Timeline", "position": 2 }
  ]
}
```

(Actual creation: createProject(...), then createTab(...) per tab. Tab IDs are generated.)

### Block: task block (content only; block has id, tab_id, position, column, etc.)

```json
{
  "type": "task",
  "content": {
    "title": "Launch tasks",
    "hideIcons": false,
    "viewMode": "list",
    "boardGroupBy": "status"
  }
}
```

Task items are created separately via createTaskItem(taskBlockId, title, status?, priorities?, assignees?, dueDate?, ...).

### Block: table block (content only)

```json
{
  "type": "table",
  "content": {
    "tableId": "uuid-from-createTable-or-createTableFull"
  }
}
```

Table must be created first; createBlock with type "table" without tableId triggers createTable("Untitled Table") and sets content.tableId.

### Block: file block

```json
{
  "type": "file",
  "content": {
    "files": []
  }
}
```

Files are added by upload + attachFileToBlock(fileId, blockId).

### Block: doc_reference

```json
{
  "type": "doc_reference",
  "content": {
    "doc_id": "uuid-of-doc",
    "doc_title": "My Doc"
  }
}
```

### Block: shopify_product

```json
{
  "type": "shopify_product",
  "content": {
    "product_id": "uuid-of-trak_products-row",
    "heightPx": 320
  }
}
```

---

*End of spec. Where something is unknown or unfinished, it is marked TBD.*
