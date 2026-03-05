# Trak — Exhaustive Functionality Spec (Audit Ground Truth)

Implementation-accurate, testable specification of every user-facing and system-facing functionality. Use as the ground-truth checklist for manual and automated functionality audit.

**Evidence base:** Routes, components, server actions, API routes, DB schema (`trak/supabase/schema.sql`), migrations, and `trak/docs/CAPABILITIES_AND_CONSTRAINTS_SPEC.md`.

---

## 1) Executive Inventory

### 1.1 Routes list (Next.js App Router)

| Route | Purpose | File |
|-------|---------|------|
| `/` | Root (redirect/landing) | `trak/src/app/page.tsx` |
| `/login` | Sign in (email/password) | `trak/src/app/login/page.tsx` |
| `/signup` | Create account | `trak/src/app/signup/page.tsx` |
| `/invite/accept` | Accept workspace invite (token in query) | `trak/src/app/invite/accept/page.tsx` |
| `/auth/callback` | OAuth code exchange (GET) | `trak/src/app/auth/callback/route.ts` |
| `/profile` | User profile + list all workspaces | `trak/src/app/profile/page.tsx` |
| `/dashboard` | Home / dashboard overview | `trak/src/app/dashboard/page.tsx` |
| `/dashboard/projects` | Projects list (table/grid, filters) | `trak/src/app/dashboard/projects/page.tsx` |
| `/dashboard/projects/[projectId]` | Project default (redirect to first tab or overview) | `trak/src/app/dashboard/projects/[projectId]/page.tsx` |
| `/dashboard/projects/[projectId]/overview` | Project overview | `trak/src/app/dashboard/projects/[projectId]/overview/page.tsx` |
| `/dashboard/projects/[projectId]/tabs/[tabId]` | Tab canvas (blocks) | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx` |
| `/dashboard/workspace/everything` | Everything view (unified search) | `trak/src/app/dashboard/workspace/everything/page.tsx` |
| `/dashboard/workflow` | Workflow pages list | `trak/src/app/dashboard/workflow/page.tsx` |
| `/dashboard/workflow/[workflowPageId]` | Single workflow page (AI chat) | `trak/src/app/dashboard/workflow/[workflowPageId]/page.tsx` |
| `/dashboard/clients` | Clients list | `trak/src/app/dashboard/clients/page.tsx` |
| `/dashboard/clients/[clientId]` | Client detail | `trak/src/app/dashboard/clients/[clientId]/page.tsx` |
| `/dashboard/clients/[clientId]/tabs/[tabId]` | Client tab view (dashboard UI) | `trak/src/app/dashboard/clients/[clientId]/tabs/[tabId]/page.tsx` |
| `/dashboard/internal` | Internal spaces list | `trak/src/app/dashboard/internal/page.tsx` |
| `/dashboard/internal/[spaceId]` | Internal space | `trak/src/app/dashboard/internal/[spaceId]/page.tsx` |
| `/dashboard/internal/[spaceId]/tabs/[tabId]` | Internal space tab | `trak/src/app/dashboard/internal/[spaceId]/tabs/[tabId]/page.tsx` |
| `/dashboard/docs` | Docs list | `trak/src/app/dashboard/docs/page.tsx` |
| `/dashboard/docs/[docId]` | Single doc editor | `trak/src/app/dashboard/docs/[docId]/page.tsx` |
| `/dashboard/calendar` | Calendar view | `trak/src/app/dashboard/calendar/page.tsx` |
| `/dashboard/shopify/products` | Shopify products | `trak/src/app/dashboard/shopify/products/page.tsx` |
| `/dashboard/shopify/stores` | Shopify stores | `trak/src/app/dashboard/shopify/stores/page.tsx` |
| `/dashboard/shopify` | Shopify root | `trak/src/app/dashboard/shopify/page.tsx` (if exists) or layout |
| `/dashboard/settings` | Settings root | `trak/src/app/dashboard/settings/page.tsx` |
| `/dashboard/settings/integrations` | Integrations | `trak/src/app/dashboard/settings/integrations/page.tsx` |
| `/dashboard/settings/integrations/slack` | Slack integration | `trak/src/app/dashboard/settings/integrations/slack/page.tsx` |
| `/dashboard/settings/integrations/slack/link` | Slack link | `trak/src/app/dashboard/settings/integrations/slack/link/page.tsx` |
| `/dashboard/payments` | Payments/billing | `trak/src/app/dashboard/payments/page.tsx` |
| `/client/[publicToken]` | Client portal landing (public) | `trak/src/app/client/[publicToken]/page.tsx` |
| `/client/[publicToken]/[tabId]` | Client tab (public) | `trak/src/app/client/[publicToken]/[tabId]/page.tsx` |
| `/client/[publicToken]/workflow/[workflowPageId]` | Client workflow (public) | `trak/src/app/client/[publicToken]/workflow/[workflowPageId]/page.tsx` |
| `/app/[[...legacy]]` | Legacy catch-all | `trak/src/app/app/[[...legacy]]/page.tsx` |
| Test/mock routes | `test/*`, `mock/*`, `dashboard/qa`, `dashboard/populate-buckeye`, `dashboard/search-test`, `dashboard/personal-mockup`, `test-search` | Various under `trak/src/app/` |

**Count (production user-facing):** ~32 distinct route patterns (excluding test/mock).

### 1.2 Feature areas list

1. **Auth** — Sign up, sign in, sign out, invite accept, OAuth callback
2. **Workspace** — Switch workspace, create workspace, profile “View All Workspaces”
3. **Projects** — List, create, edit, delete, archive (if any), filter/sort, folders, project permissions
4. **Tabs** — Create, rename, reorder, delete, client visibility, client title, hierarchy
5. **Blocks** — Add (all types), convert, delete, lock, reorder (drag), make template, block reference, comments, properties, “add above/below”
6. **Task blocks** — Task list/board/table views, add/edit/delete tasks, assignees, due dates, status, priority, tags, subtasks, comments, filters, sync mode
7. **Table blocks** — Table/board/timeline/calendar/list/gallery views, schema (fields), rows (CRUD), cells, sort/filter/group, relations, rollups, formulas, row comments, bulk ops
8. **Timeline blocks** — Events CRUD, dependencies, references, view config
9. **File/Image/Video/PDF/Gallery blocks** — Upload, attach, remove, resize (image), layout (gallery)
10. **Text/Link/Embed/Divider/Section/Doc reference/Chart/Shopify product blocks** — Inline edit, convert, link URL, section children
11. **Docs** — List, create, edit (ProseMirror), folder, archive, delete
12. **AI** — Command palette (⌘K), workflow chat, tool calling, confirmations, undo, file analysis mode, search mode
13. **Clients** — List, create, edit, delete, link to project
14. **Client page** — Public token, enable/disable, tab visibility, client title, comments/editing toggles, analytics
15. **Workflow** — Create workflow page, list, rename, delete, sharing (public link), AI chat panel
16. **Calendar** — Calendar view of tasks/events
17. **Everything** — Unified search/view
18. **Internal** — Internal spaces/groups, tabs
19. **Shopify** — Connect, disconnect, sync, products list, product block
20. **Slack** — Install, disconnect, link, commands, interactive
21. **Settings** — General, members (invite, role, remove, display name), teams (create, edit), integrations
22. **Payments** — Plan, usage, upgrade/downgrade (per implementation)
23. **Notifications** — In-app, email, badges (per implementation)
24. **Global UI** — Sidebar nav, header, theme toggle, user dropdown, global search, AI command palette

### 1.3 Summary counts

| Metric | Count |
|--------|--------|
| Production route patterns | ~32 |
| Feature areas | 24 |
| API route files | 45 |
| Server action files (with "use server" or createServerAction) | 60+ |
| Public DB tables (public.*) | ~55 (see Appendix) |
| Block types | 16 (text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, chart, doc_reference, shopify_product) |

---

## 2) System Map (Text Diagram)

```
ROUTES (examples)
  /login, /signup, /invite/accept
    → lib/auth/actions.ts (login, signup, signupWithInvite)
    → auth.users, profiles, workspace_members, workspace_invitations

  /dashboard
    → layout: dashboard/layout.tsx → layout-client.tsx (Sidebar, Header, AICommandPalette)
    → page: dashboard/page.tsx → getDashboardData (dashboard-actions.ts)
    → DB: projects, docs, task_items, comments, workspace_members, dashboard_ai_insights, etc.

  /dashboard/projects
    → projects/page.tsx → getAllProjects, getAllClients, getAllFolders
    → ProjectsTable | ProjectsGrid, FilterBar, ProjectsViewToggle
    → DB: projects, clients, project_folders

  /dashboard/projects/[projectId]
    → layout: projects/[projectId]/layout.tsx (auth: getServerUser → redirect /login)
    → project header, tab bar, project permissions dialog, project dialog (edit)

  /dashboard/projects/[projectId]/tabs/[tabId]
    → tabs/[tabId]/page.tsx → getTabBlocks, block-renderer, tab-canvas
    → AddBlockButton → createBlock (block.ts)
    → BlockWrapper → updateBlock, deleteBlock, makeBlockTemplate, block comments, properties
    → block-renderer → *-block.tsx (task-block, table-block, timeline-block, …)
    → DB: blocks, task_items, tables, table_rows, table_fields, table_views, timeline_events, file_attachments, files, comments, entity_properties

  /dashboard/workflow/[workflowPageId]
    → workflow page + WorkflowAIChatPanel
    → API: /api/workflow/stream, /api/workflow/execute, /api/workflow/messages
    → DB: workflow_sessions, workflow_messages

  /dashboard/settings
    → settings/page.tsx → workspace, members, access check
    → settings-client.tsx → Members (invite, edit, remove), Teams, Integrations, General
    → workspace.ts (inviteMember, updateMemberRole, removeMember), workspace_teams, etc.

  /client/[publicToken]/*
    → getProjectByPublicToken, client_tabs, client_tab_blocks (no auth; public_token)

API ROUTES (selected)
  /api/ai/stream, /api/ai/route → AI stream/execute
  /api/workflow/stream, /api/workflow/execute, /api/workflow/messages → workflow AI
  /api/blocks/single, /api/blocks/tab, /api/blocks/templates, /api/blocks/children → blocks
  /api/tables/bootstrap, /api/tables/data → tables
  /api/task-blocks/[blockId]/items, /api/client-task-blocks/[blockId]/items → task items
  /api/files/batch-urls, /api/files/block → files
  /api/shopify/*, /api/slack/* → integrations
  /api/invite/[token] → invite info
  /api/auth/current-user → current user
```

---

## 3) Functionality Catalog

Organized by **Route/Page** then **Feature Area**. Each item uses the schema: Location, User role(s), Preconditions, Trigger, User-visible behavior (success), Backend behavior, Data touched, Permission model, Validation rules, Loading states, Error states, Side effects, Edge cases, Test cases.

---

### 3.1 Auth

#### [FI-0001] Sign in (email/password)
- **Location:** `/login` | `login/page.tsx` | form submit
- **User role(s):** Unauthenticated
- **Preconditions:** None
- **Trigger:** Submit form (email, password, hidden redirectTo)
- **User-visible behavior (success):** Redirect to `redirectTo` (default `/`) or `/dashboard`; session established
- **Backend behavior:** `login(formData)` in `trak/src/lib/auth/actions.ts`; `supabase.auth.signInWithPassword(data)`; 12s timeout
- **Data touched:** `auth.sessions`, `auth.users` (read)
- **Permission model:** None (public page)
- **Validation rules:** Email and password required; redirectTo from form
- **Loading states:** Button submit (no explicit spinner in spec; may be native)
- **Error states:** Redirect `/login?error=...` with normalized message (timeout, invalid JSON, 522, failed to fetch)
- **Side effects:** Session cookie set
- **Edge cases:** NEXT_REDIRECT in error path; redirectedFrom preserved; prefilled email via ?email=
- **Test cases:**
  - Positive: Valid credentials → redirect to dashboard
  - Negative: Wrong password → error message on login page
  - Regression: Timeout → user-friendly timeout message

#### [FI-0002] Sign up (new account)
- **Location:** `/signup` | `signup/page.tsx` | form submit
- **Trigger:** Submit (firstName, lastName, email, password)
- **User-visible behavior (success):** Redirect to `/login?message=Check your email to confirm your account`
- **Backend behavior:** `signup(formData)` in `trak/src/lib/auth/actions.ts`; `supabase.auth.signUp(data)` with user_metadata first_name/last_name
- **Data touched:** `auth.users`, `profiles` (Supabase may create profile on signup)
- **Validation rules:** Password 8+ chars, number and symbol (hint in UI)
- **Error states:** Redirect `/signup?error=...`
- **Test cases:** Success → login message; duplicate email → error

#### [FI-0003] Sign up with invite (accept invite)
- **Location:** `/invite/accept` | `invite/accept/page.tsx` | form submit with inviteToken, email (read-only), firstName, lastName, password
- **Preconditions:** Valid token in query; invite not expired (7 days)
- **Trigger:** Submit “Create account & join {workspaceName}”
- **User-visible behavior (success):** New user: create user + workspace_members insert, delete invitation, sign in, set workspace cookie, redirect `/dashboard`. Existing user: add to workspace_members, delete invitation, sign in, redirect `/dashboard`
- **Backend behavior:** `signupWithInvite(formData)` in `trak/src/lib/auth/actions.ts`; service client; lookup `workspace_invitations` by token; check expiry; if existing profile → insert workspace_members, else admin.createUser + workspace_members; delete invitation
- **Data touched:** `workspace_invitations`, `workspace_members`, `auth.users`, `profiles`
- **Permission model:** Token must match; email must match invite
- **Error states:** No token → “Invalid invitation”; invite not found/expired → “Invitation not found or expired”; password < 8 → error; email mismatch → error
- **Test cases:** New user → account + join; existing user → join only; expired token → message

#### [FI-0004] Sign out
- **Location:** Dashboard sidebar | user dropdown | “Log out”
- **Trigger:** Click “Log out”
- **User-visible behavior (success):** Redirect to `/login` (or root)
- **Backend behavior:** `logout()` in `trak/src/app/actions/auth.ts`; `getServerUser()`; `supabase.auth.signOut()`; `redirect("/login")`
- **Data touched:** Session cleared client/server
- **Test cases:** Click logout → session cleared, redirect login

#### [FI-0005] OAuth callback
- **Location:** GET `/auth/callback?code=...&next=...`
- **Trigger:** Redirect from OAuth provider with code
- **Backend behavior:** `trak/src/app/auth/callback/route.ts`; `exchangeCodeForSession(code)`; redirect to `origin + next` or `/auth/auth-code-error`
- **Data touched:** auth.sessions
- **Test cases:** Valid code → redirect to next; invalid → auth-code-error

---

### 3.2 Global UI (Sidebar, Header, Theme, User, Search, AI)

#### [FI-0010] Navigate to Home
- **Location:** Sidebar | “Home” link
- **Trigger:** Click “Home”
- **User-visible behavior (success):** Navigate to `/dashboard`
- **Backend behavior:** Client-side navigation
- **Test cases:** Click → /dashboard

#### [FI-0011] Navigate to Projects / Docs / Calendar / etc.
- **Location:** Sidebar | NavLink to Projects, Everything, Workflow, Clients, Internal, Docs, Calendar, Products, Settings
- **Trigger:** Click each link
- **User-visible behavior (success):** Navigate to corresponding route
- **File:** `trak/src/app/dashboard/layout-client.tsx` (Sidebar, NavLink hrefs)

#### [FI-0012] Toggle theme (light/dark)
- **Location:** Sidebar footer | “Theme: Light” / “Theme: Dark” or icon when collapsed
- **Trigger:** Click theme button
- **User-visible behavior (success):** Theme toggles between default and dark; label/icon updates
- **Backend behavior:** `setTheme(theme === "default" ? "dark" : "default")` from `theme-context`
- **Data touched:** Local state/context only (no DB)
- **Test cases:** Toggle → theme persists for session

#### [FI-0013] Open user dropdown (workspace switcher, profile, logout)
- **Location:** Sidebar footer | User initials/name area
- **Trigger:** Click user button
- **User-visible behavior (success):** Dropdown opens: list of workspaces (switch), “View All Workspaces” (→ /profile), “Log out”
- **Backend behavior:** Workspace switch calls `switchWorkspace(workspace)` (workspace-context); “View All Workspaces” is Link to /profile
- **Data touched:** Cookie for current workspace on switch
- **File:** `trak/src/app/dashboard/layout-client.tsx`

#### [FI-0014] Switch workspace
- **Location:** Sidebar | User dropdown | workspace item
- **Trigger:** Click a workspace in dropdown
- **User-visible behavior (success):** Current workspace updates; UI re-renders with new workspace (e.g. projects)
- **Backend behavior:** `updateCurrentWorkspace(workspaceId)` in `trak/src/app/actions/workspace.ts`; cookie set; revalidate
- **Data touched:** Cookie; no DB write
- **Loading states:** `isSwitching`; loader on selected workspace
- **Test cases:** Switch → dashboard shows new workspace’s data

#### [FI-0015] Collapse/expand sidebar
- **Location:** Sidebar edge | Menu/X icon
- **Trigger:** Click collapse button
- **User-visible behavior (success):** Sidebar collapses to icons only or expands; state in component
- **File:** `trak/src/app/dashboard/layout-client.tsx` (toggleSidebar)

#### [FI-0016] Open AI command palette (⌘K)
- **Location:** Global | Keyboard ⌘K or sidebar “⌘K” button
- **Trigger:** Shortcut or click AI button
- **User-visible behavior (success):** AI command palette opens (assistant / file / search modes)
- **File:** `trak/src/components/ai/ai-command-palette.tsx`, `useAI()` openCommandPalette
- **Test cases:** ⌘K opens; closing works

#### [FI-0017] Global search (sidebar)
- **Location:** Sidebar | GlobalSearch component (input)
- **Trigger:** Type in search (min 2 chars); debounced
- **User-visible behavior (success):** Results from projects, tasks, docs, blocks (text), tabs; click result → navigate to URL
- **Backend behavior:** `searchProjects`, `searchTasks`, `searchDocs`, `searchBlocks`, `searchTabs` from `trak/src/app/actions/ai-search.ts`
- **Data touched:** Read-only queries across projects, task_items, docs, blocks, tabs
- **File:** `trak/src/app/dashboard/global-search.tsx`
- **Test cases:** Query → results; click → navigation

---

### 3.3 Projects (list, create, edit, delete, filters, folders)

#### [FI-0020] View projects list (table view)
- **Location:** `/dashboard/projects` | ProjectsTable
- **Preconditions:** Authenticated; current workspace set
- **Trigger:** Page load or return to route
- **User-visible behavior (success):** Table of projects with name, status, client, etc.; sort by sort_by/sort_order
- **Backend behavior:** `getAllProjects(workspaceId, filters, { includeFirstTabPreview })` in `trak/src/app/actions/project.ts`
- **Data touched:** `projects`, optionally first tab preview
- **Permission model:** `getCurrentWorkspaceId()` then RLS via workspace
- **File:** `trak/src/app/dashboard/projects/page.tsx`, `projects-table.tsx`

#### [FI-0021] View projects grid
- **Location:** `/dashboard/projects` | FilterBar + ProjectsViewToggle; view=grid
- **Trigger:** Toggle to grid view (URL searchParams view=grid)
- **User-visible behavior (success):** ProjectsGrid with cards; includePreview true
- **Backend behavior:** Same getAllProjects with includeFirstTabPreview
- **File:** `trak/src/app/dashboard/projects-grid.tsx`

#### [FI-0022] Filter projects (status, client, search, sort)
- **Location:** `/dashboard/projects` | FilterBar
- **Trigger:** Change status/client/search or sort
- **User-visible behavior (success):** URL params update; list/grid refetches with filters
- **Backend behavior:** getAllProjects(workspaceId, { project_type, status, client_id, search, sort_by, sort_order })
- **Data touched:** projects (read)
- **File:** `trak/src/app/dashboard/projects/filter-bar.tsx`

#### [FI-0023] Create project
- **Location:** `/dashboard/projects` | “New project” (or similar) button opening ProjectDialog
- **Trigger:** Submit create form (name, status, due date, client, etc.)
- **User-visible behavior (success):** Project created; navigate or refresh list
- **Backend behavior:** `createProject(workspaceId, projectData)` in `trak/src/app/actions/project.ts`; insert `projects`
- **Data touched:** `projects`
- **Permission model:** getServerUser; workspace member
- **Validation rules:** Name required; workspace must exist
- **Error states:** ActionResult.error; toast or inline
- **File:** `trak/src/app/dashboard/projects/project-dialog.tsx` (mode create)

#### [FI-0024] Edit project (details)
- **Location:** Project header | Settings dropdown | “Edit details”
- **Trigger:** Open ProjectDialog (mode edit), submit
- **User-visible behavior (success):** Project name, status, due_date_date/due_date_text, priority, client_id updated; dialog closes; refresh
- **Backend behavior:** `updateProject(projectId, updates)` in `trak/src/app/actions/project.ts`
- **Data touched:** `projects`
- **File:** `trak/src/app/dashboard/projects/[projectId]/project-header.tsx`, ProjectDialog

#### [FI-0025] Delete project
- **Location:** Projects list or project settings (where implemented)
- **Trigger:** Delete action + confirm
- **User-visible behavior (success):** Project and cascaded tabs/blocks removed; redirect or refresh list
- **Backend behavior:** `deleteProject(projectId)` in `trak/src/app/actions/project.ts`; cascade deletes
- **Data touched:** projects, tabs, blocks, task_items, etc. (cascade)
- **Permission model:** can_access_project; owner/admin for destructive
- **File:** project.ts deleteProject

#### [FI-0026] Manage project access (members)
- **Location:** Project header | Settings | “Manage Access”
- **Trigger:** Open ProjectPermissionsDialog; set member list or “all”
- **User-visible behavior (success):** project_members updated; only listed users (+ owner) can access when list not empty
- **Backend behavior:** `updateProjectMembers(projectId, memberIds | 'all')` in `trak/src/app/actions/project-permissions.ts`
- **Data touched:** `project_members`
- **Permission model:** getServerUser; owner/admin
- **File:** `trak/src/app/dashboard/projects/project-permissions-dialog.tsx`

#### [FI-0027] Move project to folder
- **Location:** Projects list/table (if folder column or context menu)
- **Trigger:** Select folder or “Move to folder”
- **Backend behavior:** `moveProjectToFolder(projectId, folderId)` in `trak/src/app/actions/folder.ts`
- **Data touched:** `projects.folder_id`
- **File:** folder.ts

---

### 3.4 Tabs (create, rename, delete, reorder, client visibility)

#### [FI-0030] Create tab
- **Location:** Tab bar | “+” or “Add tab”
- **Trigger:** Click add; CreateTabDialog submit with name, optional parent
- **User-visible behavior (success):** New tab appears; position = max(position)+1 at same level; navigate to new tab or stay
- **Backend behavior:** `createTab({ projectId, name, parentTabId? })` in `trak/src/app/actions/tab.ts`; TABS_PER_PROJECT_LIMIT = 1000
- **Data touched:** `tabs`
- **Permission model:** can_access_project
- **File:** `trak/src/app/dashboard/projects/[projectId]/tab-bar.tsx`, create-tab-dialog.tsx, tab.ts

#### [FI-0031] Rename tab
- **Location:** Tab bar | Single click on active tab or double-click
- **Trigger:** Inline edit; blur or Enter to save
- **User-visible behavior (success):** Tab name updated in DB and UI
- **Backend behavior:** `updateTab({ tabId, name })` in `trak/src/app/actions/tab.ts`
- **Data touched:** `tabs.name`
- **Loading states:** isSaving
- **Error states:** alert on result.error
- **File:** tab-bar.tsx handleSaveRename

#### [FI-0032] Delete tab
- **Location:** Tab bar | Tab dropdown | Delete; DeleteTabDialog confirm
- **Trigger:** Confirm delete
- **User-visible behavior (success):** Tab and its blocks removed; if active tab deleted, navigate to /dashboard/projects/[projectId]
- **Backend behavior:** `deleteTab(tabId)` in tab.ts; cascade blocks
- **Data touched:** tabs, blocks (cascade)
- **Permission model:** owner/admin (canDeleteTabs in tab-bar)
- **File:** tab-bar.tsx, delete-tab-dialog.tsx

#### [FI-0033] Toggle tab client visibility
- **Location:** Tab bar | Tab dropdown | “Show to client” / “Hide from client”
- **Trigger:** Click toggle
- **User-visible behavior (success):** Tab visibility for client page updated; refresh
- **Backend behavior:** `toggleTabVisibility(tabId, isVisible)` in `trak/src/app/actions/client-page.ts`
- **Data touched:** client_tabs or project/tab client visibility flag
- **File:** tab-bar.tsx handleToggleClientVisibility

#### [FI-0034] Update tab client title
- **Location:** Tab bar | Tab dropdown | Set client-facing title
- **Trigger:** Prompt for title; submit
- **Backend behavior:** `updateTabClientTitle(tabId, clientTitle)` in client-page.ts
- **Data touched:** client_tabs or equivalent
- **File:** tab-bar.tsx handleUpdateClientTitle

---

### 3.5 Blocks (add, convert, delete, lock, reorder, template, comments, properties)

#### [FI-0040] Add block (any type from dropdown)
- **Location:** Tab canvas | AddBlockButton (“+”); dropdown with Text, Task list, Link, Table, Timeline, File, Video, Image, Gallery, Embed, PDF, Section, Document, Shopify product; or “Block reference”
- **Trigger:** Select type (or doc for doc_reference, template for reference)
- **User-visible behavior (success):** Block appears at next position (getNextPosition); for table, createTable may be called then content.tableId set
- **Backend behavior:** `createBlock(tabId, projectId, type, content, position, column, parentBlockId?)` in `trak/src/app/actions/block.ts`; BLOCKS_PER_TAB_LIMIT = 500
- **Data touched:** `blocks`; for table type, `tables`, `table_fields`, `table_views`
- **Permission model:** can_access_project
- **Loading states:** isCreating; optimistic block then resolve/replace
- **Error states:** onBlockError; failedBlocks map; toast
- **File:** `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/add-block-button.tsx`, block.ts

#### [FI-0041] Add block reference
- **Location:** AddBlockButton | “Block reference” → block reference selector
- **Trigger:** Pick template block from workspace
- **User-visible behavior (success):** New block with original_block_id set; renders as reference
- **Backend behavior:** createBlock with type same as original and reference; or createBlockReference in blocks/reference-actions.ts
- **Data touched:** blocks (original_block_id), block_references if separate
- **File:** add-block-button.tsx, block-reference-selector

#### [FI-0042] Convert block to another type
- **Location:** Block wrapper | Dropdown (⋯) | “Convert to” submenu (Text, Task list, Link, Table, Timeline, File, Video, Image, Section)
- **Trigger:** Select target type
- **User-visible behavior (success):** Block type and content updated; UI re-renders new type
- **Backend behavior:** `updateBlock(blockId, { type, content })` in block.ts; tab-canvas handleConvert
- **Data touched:** blocks.type, blocks.content
- **Error states:** alert on result.error
- **File:** block-wrapper.tsx (blockTypeOptions), tab-canvas.tsx

#### [FI-0043] Delete block
- **Location:** Block wrapper | Dropdown | “Delete”
- **Trigger:** Click Delete
- **User-visible behavior (success):** Block removed from canvas and DB
- **Backend behavior:** `deleteBlock(blockId)` in block.ts
- **Data touched:** blocks (and cascade: task_items for task block, etc.)
- **File:** block-wrapper.tsx onDelete

#### [FI-0044] Lock / unlock block
- **Location:** Block wrapper | Lock/Unlock icon
- **Trigger:** Click lock icon
- **User-visible behavior (success):** blocks.locked toggled; UI shows locked state (no edit)
- **Backend behavior:** updateBlock(blockId, { locked: !locked })
- **Data touched:** blocks.locked
- **Loading states:** isTogglingLock
- **File:** block-wrapper.tsx handleToggleLock

#### [FI-0045] Reorder blocks (drag and drop)
- **Location:** Tab canvas | Block drag handle (GripVertical)
- **Trigger:** Drag block to new position
- **User-visible behavior (success):** Block order/column updated; other blocks shift
- **Backend behavior:** updateBlock for position/column or bulk reorder in tab-canvas
- **Data touched:** blocks.position, blocks.column
- **File:** tab-canvas.tsx (DndContext, onDragEnd), block.ts

#### [FI-0046] Make block reusable (template)
- **Location:** Block wrapper | Dropdown | “Make Reusable”
- **Trigger:** Click; MakeTemplateDialog submit with template name
- **User-visible behavior (success):** Block appears in block reference picker
- **Backend behavior:** `makeBlockTemplate(blockId, templateName)` in block-templates.ts; blocks.is_template = true, template_name set
- **Data touched:** blocks.is_template, blocks.template_name
- **File:** block-wrapper.tsx, make-template-dialog.tsx

#### [FI-0047] Add comment on block
- **Location:** Block wrapper | Comment icon or dropdown “Add comment”
- **Trigger:** Click; BlockComments panel open; submit comment
- **User-visible behavior (success):** Comment saved; count badge updates
- **Backend behavior:** createComment (entity_type=block, entity_id=blockId) or comments table block_id
- **Data touched:** comments (or file_comments/table_comments by entity)
- **File:** block-wrapper.tsx, block-comments.tsx; trak/src/app/actions/file-comments.ts or comments

#### [FI-0048] Open properties for block
- **Location:** Block wrapper | Dropdown | “Properties”
- **Trigger:** Click Properties
- **User-visible behavior (success):** PropertyMenu opens; set/remove status, priority, assignee, due date, tags
- **Backend behavior:** setEntityProperty / removeEntityProperty (entity_type=block, entity_id=blockId)
- **Data touched:** entity_properties
- **File:** block-wrapper.tsx, PropertyMenu, entity-property-actions

#### [FI-0049] Use block as AI context
- **Location:** Block wrapper | Sparkles icon
- **Trigger:** Click Sparkles
- **User-visible behavior (success):** contextBlock set in AI context; palette uses this block for scope
- **Backend behavior:** Client state only (useAI setContextBlock)
- **File:** block-wrapper.tsx, ai-context

#### [FI-0050] Attach reference to block
- **Location:** Block wrapper | @ (AtSign) button
- **Trigger:** Click; reference picker opens; select entity (doc, task, etc.)
- **User-visible behavior (success):** entity_links or task_references etc. created
- **Backend behavior:** entity-link-actions or task reference actions
- **Data touched:** entity_links, task_references, etc.
- **File:** block-wrapper.tsx, block-reference-picker-provider

#### [FI-0051] Add block above / below (from block menu)
- **Location:** Block wrapper (table block) | Dropdown | “Above” / “Below” submenus with block types
- **Trigger:** Select type (or gallery layout)
- **User-visible behavior (success):** New block inserted above or below current; position computed
- **Backend behavior:** createBlock with position/column from parent; onAddBlockAbove/onAddBlockBelow in tab-canvas
- **Data touched:** blocks
- **File:** block-wrapper.tsx (DropdownMenuSub “Above”/“Below”)

---

### 3.6 Task block (tasks, views, assignees, due dates, status, priority, subtasks, comments)

#### [FI-0060] Add task to task block
- **Location:** Task block | “Add task” or inline new row
- **Trigger:** Submit title (and optional status/priority)
- **User-visible behavior (success):** Task row appears in list/board/table
- **Backend behavior:** `createTaskItem(taskBlockId, { title, statuses?, priorities?, ... })` in tasks/item-actions.ts
- **Data touched:** task_items
- **File:** task-block.tsx

#### [FI-0061] Edit task (title, status, priority, due date, assignees, tags)
- **Location:** Task block | Inline edit or task detail
- **Trigger:** Change field and blur/submit
- **User-visible behavior (success):** task_items and entity_properties/task_assignees/task_tag_links updated
- **Backend behavior:** updateTaskItem, setTaskAssignees, setTaskTags, etc.
- **Data touched:** task_items, task_assignees, task_tag_links, entity_properties
- **File:** task-block.tsx, tasks/item-actions.ts, assignee-actions, tag-actions

#### [FI-0062] Delete task
- **Location:** Task block | Task menu or checkbox “delete”
- **Trigger:** Confirm delete
- **Backend behavior:** deleteTaskItem(taskId)
- **Data touched:** task_items (cascade subtasks, assignees, tags, comments)
- **File:** tasks/item-actions.ts

#### [FI-0063] Task list/board/table view switch
- **Location:** Task block | View mode toggle (list / board / table)
- **Trigger:** Select view
- **User-visible behavior (success):** Same tasks rendered in list, board (groupBy), or table layout
- **Backend behavior:** updateBlock(blockId, { content: { ...content, viewMode, boardGroupBy? } })
- **Data touched:** blocks.content
- **File:** task-block.tsx

#### [FI-0064] Add subtask to task
- **Location:** Task block | Task expand | “Add subtask”
- **Trigger:** Submit subtask title
- **Backend behavior:** createTaskSubtask(taskId, title, …) in tasks/subtask-actions.ts
- **Data touched:** task_subtasks
- **File:** task-block.tsx

#### [FI-0065] Add comment on task
- **Location:** Task block | Task comment icon or panel
- **Trigger:** Submit comment
- **Backend behavior:** createTaskComment in tasks/comment-actions.ts
- **Data touched:** task_comments
- **File:** task-block.tsx

#### [FI-0066] Bulk update / bulk move tasks
- **Location:** Task block (table/list) | Multi-select then bulk action
- **Trigger:** Select tasks; choose status/assignee/etc. or move to block
- **Backend behavior:** bulkUpdateTaskItems, bulkMoveTaskItems in tasks/item-actions.ts
- **Data touched:** task_items, task_assignees, etc.
- **File:** tasks/item-actions.ts

---

### 3.7 Table block (views, schema, rows, cells, relations, rollups)

#### [FI-0070] Create table (from table block)
- **Location:** Add block → Table; or table block create flow
- **Trigger:** Create block type “table”
- **User-visible behavior (success):** New table + default view created; block content.tableId set
- **Backend behavior:** createTable(workspaceId, projectId?, title) or createTableFull; createBlock with tableId
- **Data touched:** tables, table_fields (primary), table_views (default)
- **File:** block.ts (createBlock table), table-actions.ts

#### [FI-0071] Add row (table)
- **Location:** Table view | “Add row” or context menu “Add row below/above”
- **Trigger:** Click add row
- **Backend behavior:** createRow(tableId, data?) in tables/row-actions.ts
- **Data touched:** table_rows
- **File:** table-view.tsx, row-actions.ts

#### [FI-0072] Edit cell
- **Location:** Table view | Cell click/edit
- **Trigger:** Change value; blur or Enter
- **Backend behavior:** updateCell(rowId, fieldId, value) or updateRow
- **Data touched:** table_rows.data (JSONB)
- **File:** table-view.tsx, row-actions.ts

#### [FI-0073] Delete row(s)
- **Location:** Table view | Row context menu or multi-select delete
- **Trigger:** Delete
- **Backend behavior:** deleteRow(rowId) or deleteRows(rowIds)
- **Data touched:** table_rows
- **File:** row-actions.ts

#### [FI-0074] Add column (field)
- **Location:** Table view | Header “+” or context menu “Add column left/right”
- **Trigger:** Select field type and name
- **Backend behavior:** createField(tableId, name, type, config) in tables/field-actions.ts
- **Data touched:** table_fields
- **File:** table-context-menu.tsx (onAddColumnLeft/Right), field-actions.ts

#### [FI-0075] Sort / filter / group (table view)
- **Location:** Table view | Header or view config
- **Trigger:** Set sort/filter/group
- **User-visible behavior (success):** Rows displayed according to view config
- **Backend behavior:** getTableData with filters/sort; view config stored in table_views.config
- **Data touched:** table_views.config (read/write); table_rows (read)
- **File:** table-view.tsx, query-actions.ts

#### [FI-0076] Add row comment
- **Location:** Table view | Cell context menu “Add comment”
- **Trigger:** Submit comment
- **Backend behavior:** createComment for table row (table_comments or entity)
- **Data touched:** table_comments
- **File:** table-context-menu.tsx, tables/comment-actions.ts

#### [FI-0077] Open row properties
- **Location:** Table view | Cell context menu “Properties”
- **Trigger:** Click Properties
- **Backend behavior:** Entity properties for source_entity_type/source_entity_id or table_row entity
- **Data touched:** entity_properties
- **File:** table-context-menu.tsx

#### [FI-0078] Bulk insert / bulk update / bulk delete rows
- **Location:** Table view | Bulk actions
- **Trigger:** Select rows; bulk insert/update/delete
- **Backend behavior:** bulkInsertRows, bulkUpdateRows, bulkDeleteRows in tables/bulk-actions.ts
- **Data touched:** table_rows
- **File:** bulk-actions.ts

#### [FI-0079] Relation field / rollup
- **Location:** Table field config | Relation to another table; rollup on relation
- **Backend behavior:** createField type relation; createRollupField; computeRollupValue
- **Data touched:** table_fields, table_relations, table_rows (rollup cache)
- **File:** relation-actions.ts, rollup-actions.ts, rollups.ts

---

### 3.8 Workflow (workflow page, AI chat, sharing)

#### [FI-0080] Create workflow page
- **Location:** `/dashboard/workflow` | “New workflow” or similar
- **Trigger:** Submit name
- **User-visible behavior (success):** New tab with is_workflow_page=true in a project (or workspace analysis project); workflow_sessions row
- **Backend behavior:** createWorkflowPage in workflow-page.ts; createTab + createBlock or similar
- **Data touched:** tabs, blocks, workflow_sessions
- **File:** workflow/page.tsx, workflow-page.ts

#### [FI-0081] Send message in workflow AI chat
- **Location:** `/dashboard/workflow/[workflowPageId]` | WorkflowAIChatPanel input
- **Trigger:** Type and Send
- **User-visible behavior (success):** Message appended; streamed reply; tool calls executed; created_block_ids in message
- **Backend behavior:** POST /api/workflow/stream or execute; workflow-executor; workflow_sessions, workflow_messages
- **Data touched:** workflow_messages, workflow_sessions; blocks, task_items, etc. via tools
- **File:** workflow-ai-chat-panel.tsx, api/workflow/stream, workflow-executor.ts

#### [FI-0082] Undo workflow AI message
- **Location:** Workflow AI chat | Message “Undo”
- **Trigger:** Click Undo
- **User-visible behavior (success):** undoBatches applied (undoAIAction); message may be removed or marked undone
- **Backend behavior:** undoAIAction in ai-undo.ts; revert created entities
- **Data touched:** Depends on undo batch (e.g. delete created blocks/tasks)
- **File:** workflow-ai-chat-panel.tsx, ai-undo.ts

#### [FI-0083] Enable workflow page sharing
- **Location:** Workflow page | Share button or settings
- **Trigger:** Enable sharing
- **User-visible behavior (success):** Public URL /client/{publicToken}/workflow/{tabId}; client can open workflow and chat
- **Backend behavior:** enableWorkflowPageSharing(tabId) in workflow-page.ts; project client_page_enabled, public_token
- **Data touched:** projects, tab_shares or equivalent
- **File:** workflow-page.ts

#### [FI-0084] Clear workflow chat
- **Location:** Workflow AI chat | Clear/Trash
- **Trigger:** Click clear
- **Backend behavior:** Delete workflow_messages for session or create new session
- **Data touched:** workflow_messages or workflow_sessions
- **File:** workflow-ai-chat-panel.tsx

---

### 3.9 AI command palette (dashboard)

#### [FI-0090] Send assistant message (AI palette)
- **Location:** AI command palette (⌘K) | Assistant mode; input + Send
- **Trigger:** Submit message
- **User-visible behavior (success):** Streamed reply; tool calls; optional write confirmation; undo batches
- **Backend behavior:** /api/ai/stream or similar; executor with BuildContext (workspace, project, tab, contextBlock); tool-definitions.ts tools
- **Data touched:** Various (projects, blocks, tasks, tables, docs, etc.) via tools
- **File:** ai-command-palette.tsx, api/ai/stream, executor.ts

#### [FI-0091] File analysis mode (AI palette)
- **Location:** AI palette | File mode; upload files; ask question
- **Trigger:** Send with file context
- **User-visible behavior (success):** Answer with citations; optional save as block/comment
- **Backend behavior:** getOrCreateFileAnalysisSession; file analysis API or tool; saveFileAnalysisAsBlock, saveFileAnalysisAsComment, convertFileAnalysisToWorkflowPage
- **Data touched:** file_analysis_sessions, file_analysis_messages, file_analysis_session_files; blocks, comments
- **File:** ai-command-palette.tsx, file-analysis.ts

#### [FI-0092] Search mode (AI palette)
- **Location:** AI palette | Search mode
- **Trigger:** Query
- **User-visible behavior (success):** Search results (answer or list)
- **Backend behavior:** searchDocs, searchTasks, etc. or unstructured search
- **Data touched:** Read-only
- **File:** ai-command-palette.tsx

#### [FI-0093] Write confirmation (AI)
- **Location:** AI palette or workflow chat | When tool would mutate; requireWriteConfirmation
- **Trigger:** User approves or clarifies
- **User-visible behavior (success):** Tool run after approval
- **Backend behavior:** Pending state in executor; resume after approval
- **File:** write-confirmation, executor

---

### 3.10 Client page (public)

#### [FI-0100] View client portal landing
- **Location:** `/client/[publicToken]`
- **Preconditions:** project.public_token valid; client_page_enabled
- **Trigger:** Open URL (unauthenticated)
- **User-visible behavior (success):** List of client-visible tabs or redirect to first tab
- **Backend behavior:** getProjectByPublicToken(publicToken); client_tabs / client_tab_blocks
- **Data touched:** projects, client_tabs, client_tab_blocks (read)
- **Permission model:** No auth; token grants read
- **File:** client/[publicToken]/page.tsx, client-page.ts

#### [FI-0101] View client tab content
- **Location:** `/client/[publicToken]/[tabId]`
- **Trigger:** Click tab or open link
- **User-visible behavior (success):** Rendered blocks (read-only or editable per client_editing_enabled)
- **Backend behavior:** getProjectByPublicToken; get client tab blocks; getBatchFileUrlsPublic for files
- **Data touched:** blocks, file_attachments, files (signed URLs via service role)
- **File:** client/[publicToken]/[tabId]/page.tsx

#### [FI-0102] Client add comment (if enabled)
- **Location:** Client tab | Block or row comment
- **Trigger:** Submit comment
- **Backend behavior:** API or action that accepts publicToken + entity; insert comment (e.g. client_comments)
- **Data touched:** comments or client-specific comment store
- **File:** api/client-comments, client-page.ts

#### [FI-0103] Enable/disable client page (dashboard)
- **Location:** Project header | ClientPageToggle
- **Trigger:** Toggle on/off
- **User-visible behavior (success):** public_token generated/revoked; client URL shareable or disabled
- **Backend behavior:** enableClientPage(projectId) / disableClientPage(projectId); updateClientPageSettings
- **Data touched:** projects.client_page_enabled, projects.public_token
- **File:** client-page-toggle.tsx, client-page.ts

---

### 3.11 Docs

#### [FI-0110] List docs
- **Location:** `/dashboard/docs` | Docs list
- **Trigger:** Page load
- **Backend behavior:** getAllDocs(workspaceId, filters) in doc.ts
- **Data touched:** docs, doc_folders
- **File:** docs/page.tsx, doc.ts

#### [FI-0111] Create doc
- **Location:** `/dashboard/docs` | “New doc”
- **Trigger:** Submit title
- **Backend behavior:** createDoc(workspaceId, title)
- **Data touched:** docs
- **File:** doc.ts

#### [FI-0112] Edit doc (rich text)
- **Location:** `/dashboard/docs/[docId]` | Editor (ProseMirror/TipTap)
- **Trigger:** Edit content; save (auto or explicit)
- **Backend behavior:** updateDoc(docId, { title?, content? })
- **Data touched:** docs.content, docs title
- **File:** docs/[docId]/page.tsx, doc.ts

#### [FI-0113] Delete / archive doc
- **Location:** Doc list or editor | Delete / Archive
- **Backend behavior:** deleteDoc(docId) or archiveDoc (if implemented)
- **Data touched:** docs (is_archived or delete)
- **File:** doc.ts

#### [FI-0114] Move doc to folder
- **Location:** Docs list | Folder action
- **Backend behavior:** moveDocToFolder(docId, folderId) in doc-folder.ts
- **Data touched:** docs.folder_id
- **File:** doc-folder.ts

---

### 3.12 Settings (workspace, members, teams, integrations)

#### [FI-0120] Invite member
- **Location:** `/dashboard/settings` | Members | Invite member dialog
- **Trigger:** Submit email + role (admin/teammate)
- **User-visible behavior (success):** Invitation created; email sent (Resend); invite row in workspace_invitations
- **Backend behavior:** inviteMember(workspaceId, email, role) in workspace.ts; insert workspace_invitations; send email
- **Data touched:** workspace_invitations
- **Permission model:** owner/admin
- **File:** invite-member-dialog.tsx, workspace.ts

#### [FI-0121] Update member role
- **Location:** Settings | Members | Edit member dialog
- **Trigger:** Change role (owner/admin/teammate); save
- **Backend behavior:** updateMemberRole(workspaceId, memberId, newRole) in workspace.ts
- **Data touched:** workspace_members.role
- **Permission model:** owner/admin; cannot demote self from owner if only owner
- **File:** edit-member-dialog.tsx, members-table.tsx, workspace.ts

#### [FI-0122] Remove member
- **Location:** Settings | Members | Remove
- **Trigger:** Confirm remove
- **Backend behavior:** removeMember(workspaceId, memberId)
- **Data touched:** workspace_members
- **Permission model:** owner/admin; cannot remove self if only owner
- **File:** workspace.ts

#### [FI-0123] Update member display name
- **Location:** Settings | Members | Edit display name
- **Backend behavior:** updateMemberDisplayName(workspaceId, memberId, displayName)
- **Data touched:** profiles (name) or workspace_members display name if stored
- **File:** workspace.ts

#### [FI-0124] Create workspace
- **Location:** Profile (“View All Workspaces”) or onboarding
- **Trigger:** Submit name
- **Backend behavior:** createWorkspace(name) in workspace.ts; insert workspaces, workspace_members (owner)
- **Data touched:** workspaces, workspace_members
- **File:** workspace.ts, profile-content.tsx

#### [FI-0125] General settings (workspace name, etc.)
- **Location:** `/dashboard/settings` | General tab
- **Trigger:** Submit form
- **Backend behavior:** updateWorkspace or similar (if implemented)
- **Data touched:** workspaces
- **File:** general-settings-form.tsx

#### [FI-0126] Slack connect / disconnect
- **Location:** `/dashboard/settings/integrations/slack` | Install / Disconnect
- **Trigger:** OAuth or disconnect
- **Backend behavior:** /api/slack/install, /api/slack/callback; slack_workspace_connections, slack_user_links; disconnect API
- **Data touched:** slack_workspace_connections, slack_user_links
- **File:** slack-client.tsx, slack-connection.ts

#### [FI-0127] Shopify connect / disconnect
- **Location:** `/dashboard/shopify` or settings | Install / Disconnect
- **Trigger:** OAuth or disconnect
- **Backend behavior:** /api/shopify/install, /api/shopify/callback; shopify_connections; disconnect
- **Data touched:** shopify_connections
- **File:** shopify-connection.ts

---

### 3.13 Clients (CRUD)

#### [FI-0130] List clients
- **Location:** `/dashboard/clients`
- **Backend behavior:** getAllClients(workspaceId) in client.ts
- **Data touched:** clients
- **File:** clients/page.tsx, client.ts

#### [FI-0131] Create client
- **Location:** Clients | New client
- **Backend behavior:** createClient(workspaceId, { name, company? })
- **Data touched:** clients
- **File:** client.ts

#### [FI-0132] Update client
- **Location:** Client detail or list edit
- **Backend behavior:** updateClient(clientId, updates)
- **Data touched:** clients
- **File:** client.ts

#### [FI-0133] Delete client
- **Location:** Client detail/list | Delete
- **Backend behavior:** deleteClient(clientId)
- **Data touched:** clients
- **File:** client.ts

---

### 3.14 Project header and layout

#### [FI-0140] Back to projects
- **Location:** Project header | “Back to projects”
- **Trigger:** Click
- **User-visible behavior (success):** Navigate to /dashboard/projects
- **File:** project-header.tsx

#### [FI-0141] Go to project overview
- **Location:** Project header | “Overview”
- **Trigger:** Click
- **User-visible behavior (success):** Navigate to /dashboard/projects/[projectId]/overview
- **File:** project-header.tsx

#### [FI-0142] Collapse / expand project header
- **Location:** Project header | “Collapse” / “Expand”
- **Trigger:** Click
- **User-visible behavior (success):** Header collapses to one line (tab name + Expand) or expands; state in localStorage per project
- **File:** project-header.tsx handleCollapseToggle

#### [FI-0143] Toggle table of contents (Contents)
- **Location:** Project header | “Contents” button (when tab has blocks)
- **Trigger:** Click
- **User-visible behavior (success):** TOC sidebar opens/closes (tocExpanded in tab-contents-context)
- **File:** project-header.tsx, tab-contents-context

---

### 3.15 Timeline block

#### [FI-0150] Add timeline event
- **Location:** Timeline block | Add event
- **Trigger:** Submit start/end, title, etc.
- **Backend behavior:** createTimelineEvent(timelineBlockId, data) in timelines/event-actions.ts
- **Data touched:** timeline_events
- **File:** timeline-block.tsx, event-actions.ts

#### [FI-0151] Edit / delete timeline event
- **Location:** Timeline block | Event menu
- **Backend behavior:** updateTimelineEvent, deleteTimelineEvent
- **Data touched:** timeline_events
- **File:** event-actions.ts

#### [FI-0152] Create timeline dependency
- **Location:** Timeline block | Link two events
- **Backend behavior:** createTimelineDependency in dependency-actions.ts
- **Data touched:** timeline_dependencies
- **File:** dependency-actions.ts

---

### 3.16 File / Image / Video / PDF / Gallery blocks

#### [FI-0160] Upload file to file block
- **Location:** File block | Upload
- **Trigger:** Select file(s)
- **Backend behavior:** uploadFile then attachFileToBlock; 50MB limit; bucket "files"
- **Data touched:** files, file_attachments
- **File:** file-block.tsx, file.ts

#### [FI-0161] Remove file from block
- **Location:** File/Image/Video/PDF block | Remove
- **Backend behavior:** detachFileFromBlock(attachmentId)
- **Data touched:** file_attachments
- **File:** file.ts

#### [FI-0162] Image block: caption, resize
- **Location:** Image block | Caption edit; width control
- **Backend behavior:** updateBlock(blockId, { content: { caption, width } })
- **Data touched:** blocks.content
- **File:** image-block.tsx

#### [FI-0163] Gallery block: add/remove images, layout (array/collage)
- **Location:** Gallery block | Add image; layout switch
- **Backend behavior:** updateBlock content.items; layout, arrayColumns, arrayRows
- **Data touched:** blocks.content; file_attachments if files linked
- **File:** gallery-block.tsx

---

### 3.17 Calendar & Everything

#### [FI-0170] View calendar
- **Location:** `/dashboard/calendar`
- **Trigger:** Page load
- **User-visible behavior (success):** Calendar view of tasks/timeline events with due dates
- **Backend behavior:** getDashboardData or calendar-specific fetch; tasks/timeline_events with dates
- **Data touched:** task_items, timeline_events (read)
- **File:** calendar/page.tsx, calendar-view.tsx

#### [FI-0171] Everything view (unified search)
- **Location:** `/dashboard/workspace/everything`
- **Trigger:** Page load; optional query
- **Backend behavior:** everything-view actions; search across projects, tabs, blocks, tasks, docs
- **Data touched:** Multiple (read)
- **File:** workspace/everything/page.tsx, everything-view.ts

---

### 3.18 Payments (if implemented)

#### [FI-0180] View payments / billing
- **Location:** `/dashboard/payments`
- **Trigger:** Page load
- **Backend behavior:** getPayments or similar in payments.ts; Stripe or payment_events
- **Data touched:** payments, payment_events
- **File:** payments/page.tsx, payments.ts

#### [FI-0181] Upgrade / downgrade plan
- **Location:** Payments page | Plan change
- **Trigger:** Select plan; confirm
- **Backend behavior:** Stripe checkout or update subscription (per implementation)
- **Data touched:** payments, workspace or plan table
- **File:** payments.ts (TBD in codebase)

---

## 4) Ambiguous / Needs Confirmation

- **Password reset / magic link:** No password-reset or magic-link route found under `trak/src/app`. Confirm if “Forgot password?” exists and which flow (Supabase magic link vs custom).
- **Guest role:** CAPABILITIES_AND_CONSTRAINTS_SPEC says “No guest role in workspace_members.” Confirm if any UI or RLS uses “guest.”
- **Project archive:** No “archive” project action found; only delete. Confirm if “archive” is intended and where it would appear.
- **Tab reorder:** Tab bar shows position; no explicit “reorder tabs” UI found. Confirm if drag-to-reorder tabs exists.
- **Recurrence UI for tasks:** task_items has recurring_* fields; confirm if full recurrence UI exists in task-block.
- **Task dependencies:** No task-to-task dependency table; confirm if feature is planned and where it would appear.
- **Calendar view for tasks:** Spec says no native task calendar view; calendar page may show tasks. Confirm scope of calendar data source.
- **AI token gating / per-workspace limits:** No token tracking found in codebase. Confirm where usage is measured or gated.
- **Generic AI audit log:** Slack has slack_command_audit_log; confirm if workspace-wide AI audit log exists.
- **Export/share docs:** No export or share behavior for docs in explored code. Confirm if implemented.
- **Notifications (in-app, email, badges):** Confirm which notification channels exist and where they are triggered.
- **Auth code error page:** Callback redirects to `/auth/auth-code-error` (`trak/src/app/auth/callback/route.ts`); no `auth/auth-code-error` page found in repo — route may be missing or under different path.

---

## 5) Known Gaps / TODOs

- **Not built (from spec):** Calendar view as native task view; task-to-task dependencies; approvals; automations; “apply template” one-click; org-level (only workspace).
- **Stubbed or partial:** Recurrence UI; token/usage gating for AI; generic AI audit log; doc export/share.
- **Limits:** TABS_PER_PROJECT_LIMIT = 1000; BLOCKS_PER_TAB_LIMIT = 500; 50MB per file; no explicit table row limit.
- **Test/mock routes:** test/*, mock/*, dashboard/qa, populate-buckeye, search-test, personal-mockup — exclude from production audit or mark as dev-only.

---

## 6) Test Surface Summary

| Metric | Count |
|--------|--------|
| **# Routes (production)** | ~32 |
| **# Feature areas** | 24 |
| **# Functionality items (catalogued)** | 90+ (FI-0001–FI-0181) |
| **# Backend operations (server actions + API routes)** | 60+ action files; 45 API route files |
| **# DB tables (public)** | ~55 (see Appendix) |

**Highest-risk areas (by evidence):**

1. **Auth & invite flow** — Sign up/in, invite accept, OAuth callback; session and redirect handling; timeouts and error normalization.
2. **Project & tab access** — can_access_project, project_members, RLS; delete project/tab cascade.
3. **Block create/update/delete** — Optimistic UI and rollback; BLOCKS_PER_TAB_LIMIT; table block creating table + default view.
4. **Task and table bulk operations** — bulkUpdateTaskItems, bulkMoveTaskItems, bulkUpdateRows, bulkDeleteRows; consistency and RLS.
5. **AI (stream, tools, undo)** — Tool execution, write confirmation, undo batches; workflow_sessions/messages.
6. **Client page (public)** — Unauthenticated access; public_token; getBatchFileUrlsPublic (service role); client_comments_enabled/client_editing_enabled.
7. **Workspace switch & membership** — Cookie and revalidation; invite expiry; role changes and remove member.
8. **File upload and storage** — 50MB limit; RLS on storage; signed URLs for client page.

---

## 7) Appendix

### 7.1 File path index (selected)

| Area | Path(s) |
|------|--------|
| Auth actions | `trak/src/lib/auth/actions.ts` |
| Auth callback | `trak/src/app/auth/callback/route.ts` |
| Login/Signup/Invite pages | `trak/src/app/login/page.tsx`, `signup/page.tsx`, `invite/accept/page.tsx` |
| Dashboard layout | `trak/src/app/dashboard/layout.tsx`, `layout-client.tsx` |
| Sidebar nav | `trak/src/app/dashboard/layout-client.tsx` (Sidebar, NavLink) |
| Global search | `trak/src/app/dashboard/global-search.tsx` |
| AI command palette | `trak/src/components/ai/ai-command-palette.tsx` |
| Projects list | `trak/src/app/dashboard/projects/page.tsx`, `projects-table.tsx`, `projects-grid.tsx`, `filter-bar.tsx` |
| Project header | `trak/src/app/dashboard/projects/[projectId]/project-header.tsx` |
| Tab bar | `trak/src/app/dashboard/projects/[projectId]/tab-bar.tsx` |
| Tab canvas | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx` |
| Add block button | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/add-block-button.tsx` |
| Block wrapper | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx` |
| Block renderer | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer.tsx` |
| Block actions | `trak/src/app/actions/block.ts`, `block-templates.ts`, `blocks/reference-actions.ts` |
| Task block | `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx` |
| Task actions | `trak/src/app/actions/tasks/item-actions.ts`, `assignee-actions.ts`, `tag-actions.ts`, `comment-actions.ts`, `subtask-actions.ts` |
| Table view | `trak/src/components/tables/table-view.tsx`, `table-context-menu.tsx` |
| Table actions | `trak/src/app/actions/tables/table-actions.ts`, `row-actions.ts`, `field-actions.ts`, `bulk-actions.ts`, `query-actions.ts` |
| Timeline actions | `trak/src/app/actions/timelines/event-actions.ts`, `dependency-actions.ts` |
| Workflow page | `trak/src/app/dashboard/workflow/[workflowPageId]/page.tsx`, `workflow-ai-chat-panel.tsx` |
| Workflow actions | `trak/src/app/actions/workflow-page.ts`, `workflow-session.ts` |
| Client page | `trak/src/app/client/[publicToken]/page.tsx`, `[tabId]/page.tsx`, `workflow/[workflowPageId]/page.tsx` |
| Client actions | `trak/src/app/actions/client-page.ts`, `client-tab.ts`, `client-tab-block.ts` |
| Docs | `trak/src/app/dashboard/docs/page.tsx`, `docs/[docId]/page.tsx`; `trak/src/app/actions/doc.ts`, `doc-folder.ts` |
| Settings | `trak/src/app/dashboard/settings/page.tsx`, `settings-client.tsx`, `members/members-table.tsx`, `teams/*`, `integrations/*` |
| Workspace actions | `trak/src/app/actions/workspace.ts` |
| Client (CRUD) | `trak/src/app/actions/client.ts` |
| Project actions | `trak/src/app/actions/project.ts`, `project-permissions.ts`, `folder.ts` |
| Tab actions | `trak/src/app/actions/tab.ts` |
| File actions | `trak/src/app/actions/file.ts` |
| AI tools & executor | `trak/src/lib/ai/tool-definitions.ts`, `tool-executor.ts`, `executor.ts`, `workflow-executor.ts` |
| API routes | `trak/src/app/api/**/route.ts` (45 files) |
| DB schema | `trak/supabase/schema.sql` |

### 7.2 DB schema summary (public tables)

From `trak/supabase/schema.sql` (CREATE TABLE public.*):

- **Core:** workspaces, workspace_members, workspace_invitations, workspace_teams, workspace_team_members
- **Projects:** projects, project_folders, project_members, project_tags
- **Tabs/Blocks:** tabs, blocks, block_references, block_highlights
- **Tasks:** task_items, task_assignees, task_subtasks, task_tags, task_tag_links, task_comments, task_references, task_subtask_references
- **Tables:** tables, table_fields, table_rows, table_views, table_relations, table_comments
- **Timeline:** timeline_events, timeline_dependencies, timeline_references
- **Docs:** docs, doc_folders
- **Files:** files, file_attachments, file_comments
- **Entities:** entity_properties, entity_links, entity_properties_legacy, entity_inherited_display
- **Comments:** comments
- **Client:** clients, client_tabs, client_tab_blocks, client_page_views
- **Workflow:** workflow_sessions, workflow_messages
- **File analysis:** file_analysis_sessions, file_analysis_messages, file_analysis_session_files, file_analysis_chunks, file_analysis_citations, file_analysis_artifacts
- **Shopify:** shopify_connections, shopify_sync_jobs, trak_products, trak_product_variants, trak_product_inventory, trak_product_sales_cache
- **Slack:** slack_workspace_connections, slack_user_links, slack_command_audit_log, slack_rate_limits, slack_idempotency_keys
- **Other:** profiles, payments, payment_events, app_config, app_settings, indexing_jobs, unstructured_parents, unstructured_chunks, internal_space_groups, tab_shares, organizations, organization_members, oauth_states, google_calendar_connections, dashboard_ai_insights

### 7.3 External services and env vars (inferred)

- **Supabase:** URL, anon key, service role key (auth, DB, storage, realtime)
- **Resend (or email):** Sending invite emails
- **Stripe:** Payments (if billing enabled)
- **Shopify:** OAuth and API for products/sync
- **Slack:** OAuth and API for commands/interactive
- **OpenAI / AI provider:** For AI stream and tool calling (model, API key)
- **Unstructured (or search):** If used for searchDocs / indexing (unstructured_parents, unstructured_chunks)

---

*End of Functionality Spec. Use with CAPABILITIES_AND_CONSTRAINTS_SPEC.md for full product and data-model context.*
