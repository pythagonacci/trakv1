## Trak Project Capability Inventory

### 1. Executive Summary

Projects in Trak are workspace-scoped containers that combine: project metadata (status, due dates, priority, tags, client linkage), a tabbed canvas of rich “blocks” (text, tasks, assets, tables, timelines, Shopify products, etc.), an overview dashboard of tasks and comments, a first-class Drive integration, and optional public client-facing pages (magic-link style) with per-tab visibility and commenting.  
Inside a project, users can create and organize tabs (including hierarchical subtabs and “workflow” AI pages), compose pages from block types (including task lists with properties, file/image/video/pdf/gallery blocks with uploads and attachments, tables powered by Supabase-backed tables, timelines, embeds, doc references, and Shopify product analytics), and collaborate via inline block comments and client comments on public pages.  
Projects also integrate with Google Drive (canonical per-project folder mapping and in-app browser), Shopify products (project creation from products plus a Shopify product block with analytics and inventory), and AI workflows (sidebar AI panel, workflow pages, AI-created blocks, indexing for AI search).  
Most functionality is confirmed in active UI components under `src/app/dashboard/projects/...` and server actions in `src/app/actions/...`, with public client experiences under `src/app/client/[publicToken]/...` and AI/workflow behavior under `src/app/dashboard/workflow/...` and `src/lib/ai/...`.

---

### 2. Project Structure

**What a Project is**

- **Definition**:  
  - A row in the `projects` table with fields including: `id`, `workspace_id`, `name`, `status`, `project_type`, `client_id`, `due_date_date`, `due_date_text`, `priority`, `tags`, `client_page_enabled`, `client_comments_enabled`, `client_editing_enabled`, `public_token`.  
  - Evidence: `src/app/dashboard/projects/[projectId]/overview/page.tsx`, `src/app/actions/project.ts`, `supabase/schema.sql`.
- **Types**:  
  - `project_type` supports at least `'project'` and `'internal'`.  
  - `project_type='internal'` is used for “spaces” (e.g. Files space, internal spaces).  
  - Evidence: `getAllProjects` filters, `getOrCreateFilesSpace` in `src/app/actions/project.ts`, internal routes under `src/app/dashboard/internal/...`.

**Project-level pages/views**

- **Projects index page** (grid/list, filters):  
  - Route: `src/app/dashboard/projects/page.tsx` (not fully read but referenced by headers/navigation).  
  - Components: `projects-grid.tsx`, `projects-table.tsx`, `filter-bar.tsx`, `projects-view-toggle.tsx`, `status-badge.tsx`, `project-dialog.tsx`, `project-permissions-dialog.tsx`, `confirm-dialog.tsx`, `toast.tsx`.  
  - Capabilities (deduced from these components and `getAllProjects`):
    - Project listing with status, due dates, client, internal group, tags and probably created/updated dates.
    - Switch between grid/table views (view toggle).
    - Filtering by:
      - `project_type` (project vs internal),
      - `status`,
      - `client_id`,
      - `internal_group_id`,
      - due date ranges (`due_date_start`, `due_date_end`),
      - text search on project name/client name/company.
    - Sorting by `created_at`, `updated_at`, `due_date_date`, or `name` (asc/desc).
    - Evidence: `getAllProjects` filters in `src/app/actions/project.ts`, grid/table/filter components in `src/app/dashboard/projects/`.
- **Project detail layout**:
  - Route: `src/app/dashboard/projects/[projectId]/layout.tsx`.  
  - Layout provides:
    - Persistent `ProjectHeaderWrapper` showing project metadata and controls.
    - Tab bar (`TabBar`) below the header for per-project tabs, sticky at top when present.
    - Content area where overview, tabs, drive, integrations pages render.
  - Evidence: `layout.tsx` lines around the `ProjectHeaderWrapper` and `TabBar` usage.

- **Project overview page**:
  - Route: `src/app/dashboard/projects/[projectId]/overview/page.tsx`.  
  - Uses `ProjectOverview` component (`project-overview.tsx`).  
  - Shows:
    - Project name, tagline (“What’s due, overdue…”) and counts:
      - Open tasks (numeric).
      - Team comments & feedback count.
    - Cards:
      - **Due today**: list of tasks with priority, due date/time, and tab name; clicking navigates to that tab and optional `taskId` in query.  
      - **Due soon**: similar, for next 7 days.  
      - **Overdue**: similar, flagged in orange.
    - **Team comments & feedback**:
      - List of recent comments referencing blocks within the project, with text snippet, author, tab name, relative time; clicking navigates to the tab.  
  - Evidence: `project-overview.tsx`.

- **Project drive page**:
  - Route: `src/app/dashboard/projects/[projectId]/drive/page.tsx` (not fully read) with client component `project-drive-client.tsx`.  
  - Shows canonical Drive folder mapping and its contents (Google Drive integration).  
  - Evidence: `project-drive-client.tsx`.

- **Google Drive project settings**:
  - Route: `src/app/dashboard/projects/[projectId]/integrations/google-drive/page.tsx` with client `project-settings-client.tsx`.  
  - Lets users set up or change the canonical Drive folder mapping.  
  - Evidence: `project-settings-client.tsx`.

- **Public client project pages (magic links)**:
  - Routes:
    - `src/app/client/[publicToken]/page.tsx` – default first tab view.
    - `src/app/client/[publicToken]/[tabId]/page.tsx` – specific tab view.  
  - These pages render:
    - `ClientPageHeader` (project info).
    - `ClientPageTabBar` (only tabs marked as client-visible).
    - `ClientPageContent` with read-only blocks for that tab.
    - Optional client comments if `client_comments_enabled` is true.
  - Evidence: the two client routes and `getProjectByPublicToken` / `getTabBlocksPublic`.

**Project-level entities/objects**

- **Project core fields (editable in header dialog)**:
  - `name` (title).  
  - `status`: `'not_started' | 'in_progress' | 'complete'`.  
  - `due_date_date` or `due_date_text` (parsed and formatted; user can enter a date or free text).  
  - `priority`: `'low' | 'medium' | 'high' | 'urgent' | null`.  
  - `tags`: array of strings.  
  - `client_id` / `client` (with `name`, `company`).  
  - Evidence: `ProjectHeader` props and `ProjectDialog` initialData & submit handler, `createProject` / `updateProject` in `src/app/actions/project.ts`.

- **Project metadata displayed in header**:
  - Status badge (`StatusBadge`).
  - Due date text (“Due {date}”).
  - Priority pill.
  - Tag chips.
  - Client pill (client name and optional company).
  - Evidence: `project-header.tsx`.

- **Client project properties**:
  - `client_page_enabled`: toggles public/magic link.  
  - `client_comments_enabled`: allows comments from client on public pages.  
  - `client_editing_enabled`: likely controls client editing rights on public pages (present as a flag, but editing UI on client pages is not evident here).  
  - `public_token`: unique token used for URLs like `/client/[publicToken]/...`.  
  - Evidence: `ProjectHeader` and `ClientPageToggle` props, `overview/page.tsx` select, `getProjectByPublicToken`.

- **Project tags/tag bank**:
  - Project-level tags: `projects.tags` field, edited via project dialogs.  
  - Project “tag bank” for tasks: `project_tags` table plus helper actions:
    - `getProjectTags`, `addProjectTag`, `removeProjectTag` in `src/app/actions/project.ts`.  
  - These are used to configure tag fields on tasks/blocks via `syncTagsFieldConfigsForProject`.  
  - Evidence: actions and `tag-field-config.ts`.

- **Project permissions and members**:
  - If `project_members` has rows, project is restricted to specific user IDs; otherwise “All” workspace members can access.  
  - `ProjectPermissionsDialog` and actions:
    - `getProjectMembers`, `updateProjectMembers` to manage `memberIds` or `'all'`.  
  - Evidence: `src/app/actions/project-permissions.ts`, `project-permissions-dialog.tsx`, `createProject` / `updateProject` logic.

- **Internal “spaces” as projects**:
  - `project_type='internal'` used to represent special spaces:
    - Files space (`getOrCreateFilesSpace` creates project named “Files”).
    - Other internal spaces under `/dashboard/internal/[spaceId]`.  
  - Internal tabs use the same tab/block system.  
  - Evidence: `getOrCreateFilesSpace` and `src/app/dashboard/internal/[spaceId]/...`.

- **Project creation flows**

  - **Standard create project**:
    - Initiated from projects index via `ProjectDialog` in “create” mode (implementation in `project-dialog.tsx`).  
    - Server side: `createProject(workspaceId, ProjectData, opts)`:
      - Validates workspace membership.
      - Optionally creates new client on the fly if `client_name` provided.
      - Inserts project row with name, type, client, status, due dates, priority, tags.
      - Inserts initial project tags from `tag_bank`.
      - Automatically creates a default “Untitled” tab.  
      - Optionally inserts project-specific members if `member_ids` is not `'all'`.  
    - Evidence: `createProject` in `src/app/actions/project.ts`.

  - **Create project from Shopify product**:
    - `createProjectFromProduct(workspaceId, productId, opts)`:
      - Looks up `trak_products` row.
      - Ensures/creates a default “Product” client.
      - Creates a project named after the product, attached to that client.
      - Finds first root tab and inserts a `shopify_product` block for that product.  
    - Evidence: `createProjectFromProduct` in `src/app/actions/project.ts`, Shopify product block & actions.

  - **Files space creation**:
    - `getOrCreateFilesSpace(workspaceId)`:
      - Ensures an internal project named “Files” with a default "All Files" tab.  
      - Used for standalone file uploads, not necessarily tied to a client/launch.  
    - Evidence: same file.

- **Deletion**:
  - `deleteProject(projectId)` restricted to workspace admins/owners.  
  - Deletes project row; comment says dependencies (tasks/files) not yet checked in this function.  
  - Evidence: `deleteProject` in `src/app/actions/project.ts`.

---

### 3. Tab System

**Tab objects and hierarchy**

- **Tab model**:
  - `tabs` table with fields like `id`, `project_id`, `name`, `position`, `parent_tab_id`, `is_workflow_page`, `is_client_visible`, `client_title`.  
  - Evidence: queries in `overview/page.tsx`, `getProjectTabs`, `tab-bar.tsx`, and `InternalTabPage`.

- **Tab hierarchy**:
  - Tabs can have parent/child relationships via `parent_tab_id`.  
  - `getProjectTabs` (not fully inspected) returns hierarchical structures used by `TabBar` and tab sidebar.  
  - `TabBar` renders parents with expandable lists of subtabs, and indicates active child under parent.  
  - `TabPage`’s `sidebarConfig` calculates a “subtab sidebar” when a tab is parent or child, showing parent and siblings.  
  - Evidence: `tab-bar.tsx`, `tabs/[tabId]/page.tsx` (sidebarConfig).

**Tab-level views/pages**

- **Overview pseudo-tab**:
  - In TabBar, “Overview” is always shown as a pseudotab button that navigates to `/projects/[projectId]/overview`.  
  - It appears as a tab in UI but is not stored in `tabs`.  
  - Evidence: `TabBar` uses `buildProjectOverviewPath`.

- **Standard tab page (canvas)**:
  - Route: `/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx`.  
  - Layout:
    - `TabPageLayout` wraps content with header and optional subtab sidebar.
    - For standard tabs (not workflow pages), renders `TabCanvasWrapper` which drives `TabCanvas` and the block system.  
  - Data loading:
    - Fetches project row (id, name, status, due dates, flags, client, public_token).
    - Fetches tab row (including `is_workflow_page`).
    - Fetches hierarchical tabs (`getProjectTabs`) and blocks (`getTabBlocks`).
    - Pre-resolves block file URLs and file attachments, plus entity properties.  
  - Evidence: `tabs/[tabId]/page.tsx`.

- **Workflow tab page**:
  - `tabs.is_workflow_page` flag.  
  - If `is_workflow_page`, `TabPage` uses `WorkflowPageLayout` instead of a normal canvas:
    - Same underlying blocks, but with special AI sidebar and header behavior.
    - When in project context, AI chat is in a right-side panel integrated with the project tab content.  
  - Evidence: `tabs/[tabId]/page.tsx`, `workflow-page-layout.tsx`.

- **Internal spaces tabs**:
  - `/dashboard/internal/[spaceId]/tabs/[tabId]/page.tsx` uses `TabBar` and `TabCanvas` similarly but with `projects.project_type='internal'`.  
  - Evidence: `internal/[spaceId]/tabs/[tabId]/page.tsx`.

**Tab creation and management**

- **Tab creation**:
  - Triggered via:
    - “New tab” button in TabBar (inline + floating bar).
    - “Add sub-tab” from tab dropdown menu.  
  - Client:
    - `CreateTabDialog` handles the form and calls server action `createTab`.  
  - Behavior:
    - Creates a child tab when `initialParentTabId` provided.
    - New tab appears in TabBar and in hierarchical structure.  
  - Evidence: `TabBar.tsx` (“New tab” button & `CreateTabDialog` usage), `create-tab-dialog.tsx`, `api/tabs/project/route.ts`.

- **Tab renaming**:
  - Clicking on the active tab again or double-clicking a tab enters inline rename mode.
  - New name is saved on blur or Enter via `updateTab({ tabId, name })`.
  - Evidence: `TabBar.tsx` (editingTabId logic, `handleSaveRename` calling `updateTab`).

- **Tab reordering & hierarchy**:
  - Tabs have `position` field; TabBar uses `getProjectTabs` to present hierarchical order.  
  - There is no visible drag-reorder logic in `TabBar.tsx` itself (no dnd kit), so reordering is likely not user-facing (or is elsewhere).  
  - Evidence: `TabBar` uses static `tabs` prop in order; no reorder actions present.

- **Tab deletion**:
  - Through tab dropdown “Delete” (only if user has role owner/admin via workspace context).
  - Opens `DeleteTabDialog` (modal confirm).
  - On delete success, if currently active tab was deleted, TabBar navigates back to project page (`buildProjectPath`).  
  - Evidence: `TabBar.tsx` (`canDeleteTabs`, `DeleteTabDialog`).

- **Client visibility & client titles per tab (magic link behavior)**:
  - In TabBar dropdown (when `clientPageEnabled` true):
    - “Make Public/Make Private” toggles `is_client_visible` via `toggleTabVisibility`.
    - “Set/Edit public title” sets `client_title` via `updateTabClientTitle`.
  - These determine which tabs show on public client tab bar and what label the client sees.  
  - Evidence: `TabBar.tsx` `handleToggleClientVisibility`, `handleUpdateClientTitle`; public client routes call `getProjectByPublicToken` to get only visible tabs.

- **Workflow tabs and AI labeling**:
  - Tabs have `is_workflow_page` boolean; such tabs show a Sparkles icon (`<Sparkles />`) in TabBar.  
  - Evidence: `TabBar.tsx` uses `tab.is_workflow_page` to show icon.

- **Responsive/UX details** (small but user-facing):

  - Floating tab bar that appears when user scrolls down, with hover zones at top of viewport.  
  - Mobile tab menu with nested child tabs.  
  - Evidence: `TabBar.tsx` (`shouldShowFloating`, `mobileMenuOpen`, top reveal bar).

---

### 4. Block System

Blocks are the core unit of content within a tab. Each block is a row in `blocks` and is rendered via `BlockRenderer` inside `TabCanvas`. Blocks can be created, updated, deleted, dragged, duplicated, moved between tabs, referenced, grouped into rows/columns and sections, and enriched with entity properties (tags, status, due date, assignee).

Below are block types and capabilities, based on `BlockRenderer`, `AddBlockButton`, `TabCanvas`, and individual block components.

#### 4.1 Common Block Infrastructure

- **Block schema** (`Block` interface in `src/app/actions/block.ts`):
  - `id`, `tab_id`, `parent_block_id`, `type`, `content` (JSONB), `position`, `column`, `is_template`, `template_name`, `original_block_id`, `locked`, plus derived fields: `tags`, `status`, `priority`, `due_date`, `assignee_id`, `entity_properties`, `created_at`, `updated_at`.
- **Where blocks exist**:
  - Inside project tabs (`/dashboard/projects/[projectId]/tabs/[tabId]`) and internal spaces’ tabs.
  - Public client pages render a subset in read-only mode (`getTabBlocksPublic`).
- **Block actions**:
  - `createBlock`, `getTabBlocks`, `getChildBlocks`, `updateBlock`, `deleteBlock`, `moveBlock`, `duplicateBlock`, `getBlockLocation`, `getTabBlocksPublic` (and workflow variant).
- **Block manipulation in UI**:
  - Add via `AddBlockButton` (dropdown and empty canvas call to action).
  - Drag blocks into rows/columns.
  - Insert blocks above/below.
  - Convert block types.
  - Lock/unlock blocks.
- **Block layout & grouping**:
  - `TabCanvas` groups blocks into “rows” by integer `position` and columns by `column` (0–2), resulting in 1–3 columns per row.
  - Rows can be split/combined via drag; row-above/row-below drop “ghosts” support rearranging vertical grouping.
  - Sections (block type `section`) can contain child blocks (via `parent_block_id`).
- **Block-level menus and side panels**:
  - `BlockWrapper` provides block toolbar (e.g. convert, delete, comments).
  - `BlockComments` renders a floating side panel anchored next to a block for inline comments.
  - Table of Contents (`TableOfContents`) built from blocks (esp. `section_header`, maybe other headings).
- **Block references**:
  - `original_block_id` indicates ref blocks.
  - `BlockReferenceSelector` in `AddBlockButton` lets user insert references to existing blocks.
  - `LazyBlockWrapper` + `BlockReferenceRenderer` render referenced content; `BlockReferencePickerProvider` provides reference context.
- **Entity properties / record-like behavior**:
  - `getTabBlocks` enriches each block with `entity_properties`, providing:
    - `tags` (array),
    - `status`,
    - `priority`,
    - `due_date` (start/end),
    - `assignee_id`.
  - These underpin record-like functionality and are used for AI/search, filtering, and overview surfaces.

#### 4.2 Block Types

##### 4.2.1 Text Block (`type: "text"`)

- **User-facing behavior**:
  - Rich text content with formatting.
- **Creation**:
  - From “Text” in AddBlock dropdown or automatically when clicking empty canvas.
- **Content model**:
  - `content.text` string (can be empty).
- **Capabilities**:
  - Inline editing.
  - Drag/drop repositioning.
  - Can be converted to/from other types via `onConvert`.

##### 4.2.2 Task Block (`type: "task"`)

- **User-facing behavior**:
  - A task list / task table block for managing tasks within a tab.
  - Can display tasks in different views (list, board/kanban).  
- **Creation**:
  - Block type “Tasks” in AddBlockButton.
  - When created, server also auto-creates at least one `task_items` row (`createTaskItem`).
- **Content model**:
  - Includes: `title`, `hideIcons`, `viewMode`, `boardGroupBy`.
  - Task items stored separately in `task_items` table and joined for previews and operations.
- **Capabilities**:
  - Create tasks (rows) within the block.
  - Mark tasks complete.
  - Task properties: `title`, `status`, tags, due dates, assignee, priority (via entity properties).  
  - Views:
    - List view (default).
    - Board view (grouped by `status`).  
  - Overview integration:
    - Tasks appear in project overview sections (Due today / Due soon / Overdue).
- Evidence: `TaskBlock` dynamic import, `BlockRenderer`, `summarizeBlockPreview` for `"task"`, `ProjectOverviewTask`, `getTabBlocks` + `task_items`.

##### 4.2.3 Link Block (`type: "link"`)

- **User-facing behavior**:
  - A block representing an external link with preview.
- **Creation**:
  - “Link” option in AddBlockButton.
- **Content model**:
  - `content` includes: `title`, `url`, `caption` or `description`.
- **Capabilities**:
  - Inline editing of link title and URL and caption/description.
  - Click to open external URL.

##### 4.2.4 Divider Block (`type: "divider"`)

- **User-facing behavior**:
  - Horizontal rule dividing sections of a page.
- **Creation**:
  - “Divider” option in AddBlockButton.
- **Content model**:
  - Empty object.
- **Capabilities**:
  - No editing beyond position; can be moved, deleted.

##### 4.2.5 Section Header Block (`type: "section_header"`)

- **User-facing behavior**:
  - A labeled header row to visually separate groups of blocks, often used for TOC.
- **Creation**:
  - “Section Header” in AddBlockButton.
- **Content model**:
  - `title`, `subtitle`.
- **Capabilities**:
  - Editable title/subtitle.
  - Contributes to Table of Contents.

##### 4.2.6 Table Block (`type: "table"`)

- **User-facing behavior**:
  - Embedded table view with rows and columns for structured data (records/rows).
  - Backed by dedicated Supabase `tables` (via `tableId`).
- **Creation**:
  - “Table” option in AddBlockButton.
  - `createBlock` for table type automatically creates a new table and sets `content.tableId`.
- **Content model**:
  - `content.tableId`, `content.heightPx`.
- **Capabilities**:
  - Renders `<TableView tableId={connectedTableId} maxHeightPx={...} />` for interactive table UI.
  - Resizing via block-level handle, persisting height.

##### 4.2.7 Timeline Block (`type: "timeline"`)

- **User-facing behavior**:
  - A timeline view for project milestones/events.
- **Creation**:
  - “Timeline” option in AddBlockButton.
- **Content model**:
  - `viewConfig` with `startDate`, `endDate`, `zoomLevel`, `filters`, `groupBy`.
- **Capabilities**:
  - Visual timeline across a time range; events representing tasks/milestones.

##### 4.2.8 File Block (`type: "file"`)

- **User-facing behavior**:
  - Dedicated block for managing files associated with a tab.
- **Creation**:
  - “File” option in AddBlockButton.
- **Content model**:
  - `content.files` plus attachments via `file_attachments`.
- **Capabilities**:
  - Upload files, attach existing files, preview/download via signed URLs.

##### 4.2.9 Image Block (`type: "image"`)

- **User-facing behavior**:
  - Display a single image with optional caption and adjustable width.
- **Creation**:
  - “Image” option in AddBlockButton.
- **Content model**:
  - `content.fileId`, `caption`, `width`.
- **Capabilities**:
  - Upload/select image, adjust caption and width, preview with signed URLs.

##### 4.2.10 Gallery Block (`type: "gallery"`)

- **User-facing behavior**:
  - Grid/collage of multiple images.
- **Creation**:
  - Gallery sub-menu in AddBlockButton: “Collage” and “Array”.
- **Content model**:
  - `layout`, `arrayColumns`, `arrayRows`, `items` with `fileId` etc.
- **Capabilities**:
  - Arrange images as collage or array, scrollable layout, preview each item.

##### 4.2.11 Video Block (`type: "video"`)

- **User-facing behavior**:
  - Inline video player.
- **Creation**:
  - “Video” option in AddBlockButton.
- **Content model**:
  - `content.fileId` or `content.files`.
- **Capabilities**:
  - Upload or attach videos, play inline via custom player.

##### 4.2.12 Embed Block (`type: "embed"`)

- **User-facing behavior**:
  - Embed external content (YouTube, Figma, etc.).
- **Creation**:
  - “Embed” in AddBlockButton.
- **Content model**:
  - `url`, `displayMode`.
- **Capabilities**:
  - Inline editing of URL; show embed frame.

##### 4.2.13 PDF Block (`type: "pdf"`)

- **User-facing behavior**:
  - Display a PDF.
- **Creation**:
  - As its own block type.
- **Content model**:
  - `fileId`, `title`/`fileName`.
- **Capabilities**:
  - View or link PDF via signed URL, using names from `files` table.

##### 4.2.14 Section Block (`type: "section"`)

- **User-facing behavior**:
  - Scrollable container grouping multiple blocks within a tab.
- **Creation**:
  - “Section” in AddBlockButton.
- **Content model**:
  - `height`.
- **Capabilities**:
  - Contain child blocks (`parent_block_id`), with independent scroll area and layout.

##### 4.2.15 Chart Block (`type: "chart"`)

- **User-facing behavior**:
  - Custom chart visual using code-defined chart config.
- **Creation**:
  - Not in manual blockTypes menu; probably created via AI or chart-specific flows.
- **Content model**:
  - `code`, `chartType`, `title`, `metadata`.
- **Capabilities**:
  - Render charts via `ChartBlock` based on `code`.

##### 4.2.16 Doc Reference Block (`type: "doc_reference"`)

- **User-facing behavior**:
  - Link to an existing document, opened in a side panel.
- **Creation**:
  - “Document” in AddBlockButton; opens `DocSelectorDialog`.
- **Content model**:
  - `doc_id`, `doc_title`, optional `description`.
- **Capabilities**:
  - Click card to open `DocSidebar` with doc content.

##### 4.2.17 Shopify Product Block (`type: "shopify_product"`)

- **User-facing behavior**:
  - Rich product card for a Shopify product with analytics.
- **Creation**:
  - From AddBlock menu or automatically when creating project from product.
- **Content model**:
  - `product_id`, `title`, `heightPx`, `shopifyExpanded`.
- **Capabilities**:
  - Search workspace Shopify products and attach one.
  - Refresh product data from Shopify.
  - Expand/collapse detailed view (variants, inventory, tags, description).
  - Resize block height, persisted in content.
  - Display sales analytics via `UnitsSoldWidget`.

---

### 5. Objects and Records Inside Projects

**5.1 Tasks / Task Items**

- **What it is**:  
  - Task items stored in `task_items` table, linked to `task` blocks.
- **Where**:  
  - Inside task blocks and in Project Overview lists.
- **Fields**:  
  - `id`, `title`, `status`, `display_order`, `task_block_id`, plus possible due dates, tags, priority, assignee via entity properties.
- **Actions**:  
  - Create tasks, edit titles, mark complete, set properties, navigate from overview to specific task.

**5.2 Files / Assets**

- **What**:  
  - Files in Supabase Storage backed by `files` table.
- **Where**:  
  - File/image/video/pdf/gallery blocks; project/internal file browsers; Files space.
- **Fields**:  
  - `id`, `workspace_id`, `project_id`, `uploaded_by`, `file_name`, `file_size`, `file_type`, `storage_path`, `created_at`.
- **Actions**:  
  - Upload, attach to blocks, detach, rename, delete, list by project/workspace, preview/download via signed URLs.

**5.3 Comments**

- **Block comments**:  
  - Inline `BlockComment` objects stored in `block.content._blockComments`, with `author`, `timestamp`, `source` (internal/client).
- **Client comments**:  
  - On public client pages where `client_comments_enabled`, saved as block comments with `source="external"`.
- **Actions**:  
  - Add, reply, delete (own/external with restrictions), mention via `@` and reference picker.

**5.4 Products (Shopify)**

- **Objects**:  
  - `trak_products` rows with title, images, status, vendor, type, tags, variants and inventory.
- **Where**:  
  - Shopify product blocks and `createProjectFromProduct`.
- **Actions**:  
  - Search, attach product to block, refresh data, view analytics and inventory.

**5.5 Tables / Rows / Records**

- **Records**:  
  - Table rows from Supabase tables created for table blocks.
- **Where**:  
  - Inside table blocks rendered by `TableView`.
- **Actions**:  
  - Add/edit rows and columns, manage relations and properties.

**5.6 Timeline Events**

- **Objects**:  
  - Events in timeline blocks, structured with names/titles and dates.
- **Where**:  
  - In timeline blocks; referenced in summarizer as `events`.

**5.7 Entity Properties (tags/status/priority/due/assignee)**

- **What**:  
  - Generic per-block/record properties stored in `entity_properties`.
- **Where**:  
  - Exposed on blocks via `getTabBlocks` and `getTabBlocksPublic`.
- **Fields**:  
  - `field_name`, `field_type`, `value`, used for `tags`, `status`, `priority`, `due_date`, `assignee_id`.

**5.8 Clients**

- **Objects**:  
  - `clients` table with `id`, `name`, `company`, `email`, etc.
- **Where**:  
  - Linked to projects and shown in headers and client pages.

---

### 6. Views and Layouts

**6.1 Canvas View (default tab layout)**

- Mixed block layout with rows and up to three columns.
- Drag-and-drop reordering, grouping, and sectioning.
- Integration with AddBlock button, Table of Contents, DocSidebar, and Undo.

**6.2 Table View**

- Within table blocks, `TableView` presents tabular data from `tables` with interactive editing and configuration.
- Resizable height via drag handle.

**6.3 Timeline View**

- Timeline blocks visualizing events/milestones between `startDate` and `endDate`.

**6.4 Gallery / Collage View**

- Gallery blocks supporting collage and array layouts of images.

**6.5 Document / Doc Sidebar View**

- Doc reference blocks opening doc details in `DocSidebar` as a side panel.

**6.6 Project Overview View**

- Overview page showing open tasks metrics, due windows, and recent comments, with deep-links into tabs.

**6.7 Public Client Page Layout**

- Minimal project header, sticky client-visible tab bar, read-only canvas, optional client comment input, refresh and tracking.

**6.8 Workflow Page Layout (AI view)**

- Split view of canvas + AI sidebar, with New and Share workflow controls, used both at workspace-level and project-level.

---

### 7. Collaboration Features

**7.1 Internal Collaboration**

- Workspace membership and project-level member restrictions.
- Block-level comment threads with reply, delete, and mentions.

**7.2 External Collaboration (Magic Links / Client Pages)**

- Magic link style public client pages controlled by `client_page_enabled` and `public_token`.
- Per-tab visibility settings with `is_client_visible`.
- Optional client comments surfaced internally as external comments.
- `ClientPageTracker` for analytics and `AutoRefresh` for live updates.

---

### 8. Asset / File / Media Capabilities

- File uploads via `uploadFile` and `createFileRecord`, with security checks and size limits.
- Standalone uploads for internal Files space and per-project standalone files.
- File attachments via `file_attachments` with display modes.
- Preview and metadata for images, videos, PDFs, and generic files using signed URLs.
- Batch URL signing and public URL signing for client pages.
- Google Drive integration mapping canonical project folders, listing contents, and previewing via modals.

---

### 9. D2C-Relevant Workflow Capabilities

- Product-linked projects from Shopify with default client and product block.
- Shopify product block with rich analytics and inventory, relevant to launch performance and inventory planning.
- Timeline and task blocks used for launch and campaign planning.
- Creative review workflows with image/video/gallery blocks, inline and external comments, and canonical Drive folders.
- Tagging and properties for organizing tasks and records by campaign, channel, and priority.

---

### 10. Integrations Used in Project Contexts

- **Shopify**: Product-based project creation; Shopify product block; units sold and inventory analytics; product search and refresh.
- **Google Drive**: Canonical project folder mapping; in-app folder browsing and preview; folder attach/create flows via DrivePicker.
- **Supabase Storage**: All file uploads, attachments, signed URLs, and cleanup for blocks and standalone files.
- **AI/Workflow APIs**: Workflow execution routes, workflow executor, and AI streaming endpoints used by `AIPanel` for project/workflow tabs.

---

### 11. AI Capabilities Inside Projects

- AI sidebar (`AIPanel`) in workflow tabs, with project/tab context passed into AI tools.
- Workflow pages as AI-first canvases for planning and automation, including New and Share actions.
- AI-generated blocks signaled via `ai-created-blocks` events with automatic scrolling to new content.
- Block and file indexing into a search index for AI retrieval and global search.
- AI chart generation via chart blocks and `chart-actions`.

---

### 12. Master User Action Inventory

**Project-level actions**

- Create/edit/delete projects; filter, sort, and switch project views.
- Manage project tags, clients, permissions, and client page toggles.
- Open project overview, drive, and Google Drive settings.

**Tab-level actions**

- Create new tabs and subtabs, open tabs, rename, delete, and control client visibility and client titles.
- Navigate to overview via TabBar and use floating/mobile tab bars.

**Block-level actions**

- Add blocks of various types; drag and drop; insert above/below; convert types; delete; undo; duplicate; move between tabs; lock/unlock.
- Type-specific actions such as editing text, managing tasks, configuring tables, timelines, files, images, galleries, videos, embeds, sections, doc references, and Shopify products.

**Record/object-level actions**

- Create/edit tasks; manage file uploads and attachments; add/reply/delete comments; search and attach products; manage timeline events; adjust entity properties.

**Collaboration actions**

- Manage project member lists, internal comments, external client page access, and client comments.

**AI actions**

- Use AI in workflow tabs to generate and transform content, summarize, search, and create charts or tables.

**Integration actions**

- Configure and browse project Drive folders; create and map Drive folders; create projects from Shopify products; attach Shopify products to blocks; refresh Shopify data.

---

### 13. Capability Confidence Matrix

| Capability | User-facing description | Evidence | Confidence | Notes |
|-----------|-------------------------|----------|-----------|-------|
| Project creation & metadata editing | Create/edit projects with name, status, due date (date/text), priority, tags, client | `project.ts`, `project-header.tsx`, `project-dialog.tsx` | Confirmed in active UI | Fully wired through server actions and header/UI |
| Project-level filtering & sorting | Filter/sort project list by type, status, client, internal group, due date, search | `getAllProjects` in `project.ts`, `projects-grid.tsx`, `filter-bar.tsx` | Confirmed in active UI | Table/grid components + actions align |
| Project permissions | Restrict project to specific members or All workspace members | `project-permissions.ts`, `project-permissions-dialog.tsx` | Confirmed in active UI | Only admins/owners can manage |
| Tabs with hierarchy | Create tabs and subtabs; navigate between them | `tab-bar.tsx`, `create-tab-dialog.tsx`, `getProjectTabs` | Confirmed in active UI | Hierarchical structure present, used in layout and subtab sidebar |
| Tab rename/delete | Rename tabs inline; delete tabs with confirmation | `tab-bar.tsx`, `delete-tab-dialog.tsx` | Confirmed in active UI | Role checks present for delete |
| Client-visible tabs & titles | Mark tabs public/private, set client-facing titles | `tab-bar.tsx`, `client/[publicToken]/...` routes | Confirmed in active UI | Public routes filter tabs by `is_client_visible` |
| Public client pages (magic links) | Share read-only views of project tabs with clients, optionally with comments | `client/[publicToken]/page.tsx`, `/[tabId]/page.tsx`, `getProjectByPublicToken` | Confirmed in active UI | Comments for clients toggled by `client_comments_enabled` |
| Block-based canvas | Compose tab pages from heterogeneous blocks arranged in rows/columns | `TabCanvas`, `BlockRenderer`, block components | Confirmed in active UI | DnD + layout code fully implemented |
| Text/task/link/divider/section-header blocks | Basic content and structure blocks | `BlockRenderer`, `add-block-button.tsx` | Confirmed in active UI | All referenced in dropdown and renderer |
| Table blocks with Supabase-backed tables | Insert table views, edit rows/columns | `table-block.tsx`, `createBlock` table code, `table-view.tsx` | Strongly supported by code | TableView full UI not shown but is integrated and prefetched |
| Timeline blocks | Show timeline for milestones/events | `timeline-block.tsx`, `AddBlockButton`, summarizer | Strongly supported by code | Exact rendering not inspected, but clearly present |
| File/image/video/pdf/gallery blocks | Upload and preview media/assets in-line | `file-block.tsx`, `image-block.tsx`, `video-block.tsx`, `pdf-block.tsx`, `gallery-block.tsx`, `file.ts` | Confirmed in active UI | Signed URL plumbing + attachments + public support |
| Embed blocks | Embed external content (YouTube, Figma, etc.) | `embed-block.tsx`, AddBlock description | Confirmed in active UI | Generic embed with URL |
| Section blocks | Group blocks inside scrollable sections | `section-block.tsx`, `AddBlockButton`, `getChildBlocks` | Strongly supported by code | UI details not fully inspected; but nested `parent_block_id` used |
| Doc reference blocks & doc sidebar | Link and open docs in a side panel | `doc-reference-block.tsx`, `DocSidebar`, `DocSelectorDialog` | Confirmed in active UI | Document selection and sidebar present |
| Shopify product block | Embed Shopify product with details and analytics | `shopify-product-block.tsx`, `shopify-products` actions | Confirmed in active UI | Extensive UI + data fetch/refresh |
| Block comments with mentions & client flag | Comment per block, reply, delete, client vs internal labeling, mentions | `block-comments.tsx` | Confirmed in active UI | Uses `/api/auth/current-user` and `BlockReferencePicker` |
| Google Drive canonical project folder | Map project to a Drive folder, browse contents, preview assets | `project-drive-client.tsx`, `project-settings-client.tsx`, Drive API routes | Confirmed in active UI | Mapping and listing/preview implemented |
| Files storage & attachments | Upload, rename, delete, attach/detach files; generate signed URLs | `file.ts`, `file-block.tsx`, `inline-file-preview.tsx` | Confirmed in active UI | Security constraints and RAG cleanup included |
| Project overview dashboard | Show open tasks count, due windows, comments feed | `project-overview.tsx`, `overview/page.tsx` | Confirmed in active UI | Links back to tabs/tasks |
| Workflow pages with AI sidebar | AI-first tab/page layout with chat and canvas | `workflow-page-layout.tsx`, `AIPanel`, workflow APIs | Confirmed in active UI | Sharing + new workflow pages supported |
| AI-created blocks & scroll behavior | After AI creates blocks, canvas scrolls to them | `TabCanvasWrapper` `ai-created-blocks` event listener | Confirmed in active UI | Heavily logged; indicates real use |
| Block indexing and AI search | Blocks are indexed for AI search and retrieval | `IndexingQueue` usage in block create/update/delete | Strongly supported by code | User UI for AI search not fully shown, but AIPanel/tool definitions exist |
| Project-based internal Files space | Central internal project “Files” with tabs and standalone files | `getOrCreateFilesSpace`, file listing actions | Strongly supported by code | UI exists under `/dashboard/internal` |

---

### 14. Capabilities That May Exist But Need Verification

- **Client editing on public pages**:
  - Flags `client_editing_enabled` exist and are surfaced in `ClientPageToggle`, but no concrete UI in `client/[publicToken]` routes shows editing capabilities.
- **Drag-and-drop tab reordering**:
  - Tabs have `position` but no explicit DnD code in `TabBar.tsx`.
- **Global AI search from within projects**:
  - AI search and indexing infrastructure is present; `AIPanel` is wired to AI APIs, but specific project-level UI entry points for AI search are not fully visible.
- **Advanced table features**:
  - `TableView` likely supports filters, grouping, saved views and relations, but exact capabilities need UI verification.
- **Timeline event linking to tasks or other records**:
  - Timeline blocks reference `events`, but clear UI integration with tasks or other objects isn’t fully shown.
- **Slack notifications / integrations per project**:
  - Slack interactive API route exists; whether specific project events trigger Slack messages is not evident in the project UIs reviewed.

---

### 15. Appendix: Evidence by File/Area

- **`src/app/dashboard/projects/[projectId]/project-header.tsx`**  
  - Project header UI: name, status, due date, priority, tags, client, navigation, client page toggle, permissions dialog, and edit dialog.

- **`src/app/dashboard/projects/[projectId]/layout.tsx`**  
  - Project layout wrapping header and tab bar, fetching project and tabs for all project subroutes.

- **`src/app/dashboard/projects/[projectId]/overview/page.tsx` & `overview/project-overview.tsx`**  
  - Project overview page: aggregated tasks due today/soon/overdue and team comments & feedback, linking back to tabs and tasks.

- **`src/app/dashboard/projects/[projectId]/tab-bar.tsx`**  
  - Tab bar and controls: new tabs, subtabs, rename, delete, client visibility/title controls, overview tab, floating and mobile variants.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx`**  
  - Tab page route: fetches project, tab, tabs hierarchy, blocks, file URLs, and block properties; chooses workflow vs standard layout.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas-wrapper.tsx`**  
  - Client wrapper around `TabCanvas` using React Query, file URL fetching, block properties, tab theme, and AI-created-blocks scrolling.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx`**  
  - Core drag-and-drop canvas, block grouping into rows/columns, undo stack, inline block operations, and integration with `AddBlockButton`, `BlockRenderer`, ToC, and DocSidebar.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/add-block-button.tsx`**  
  - Add block dropdown and gallery sub-menu; optimistic creation and error handling for all block types.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer.tsx`**  
  - Block rendering registry mapping types to components, including task, table, timeline, file, media, embed, chart, section, doc_reference, and shopify_product.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-comments.tsx`**  
  - Block comments side panel for internal and client comments, mentions, replies, and deletion.

- **`src/app/actions/project.ts`**  
  - Server logic for project creation, updating, deletion, listing with filters/search, tag bank, Shopify-based project creation, Files space creation, and project previews.

- **`src/app/actions/project-permissions.ts`**  
  - Get and update project members, enforcing workspace admin/owner roles.

- **`src/app/actions/block.ts`**  
  - Block CRUD actions with workspace access checks, default content for block types, table integration, task item defaults, public access variants, and AI indexing hooks.

- **`src/app/actions/file.ts`**  
  - File upload, security validation, attachment, detachment, rename, delete, signed URLs (batch and public), and standalone file listing for projects and workspaces.

- **`src/app/dashboard/projects/[projectId]/drive/project-drive-client.tsx` & `/integrations/google-drive/project-settings-client.tsx`**  
  - Project-level Google Drive integration: canonical folder mapping, in-app browsing, preview, and settings/attach/create flows.

- **`src/app/dashboard/projects/[projectId]/tabs/[tabId]/shopify-product-block.tsx`**  
  - Shopify product block UI and interactions: product details, units sold, inventory, variant details, and product search/attach/refresh flows.

- **`src/app/client/[publicToken]/page.tsx` and `/[tabId]/page.tsx`**  
  - Public project pages: load project and client-visible tabs by token; fetch blocks via `getTabBlocksPublic`; prefetch file URLs; render header, tab bar, content, tracker, and auto-refresh.

- **`src/app/dashboard/workflow/[workflowPageId]/workflow-page-layout.tsx`**  
  - Workflow page layout combining TabCanvasWrapper with `AIPanel`, including controls for new workflow pages and public sharing.

