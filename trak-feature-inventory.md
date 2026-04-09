# Trak — Full feature inventory

This document is a **codebase-grounded** inventory of what Trak implements today: main user-facing surfaces, data concepts, integrations, AI, and plan-gated behavior. It is meant to replace or extend ad-hoc feature lists that may have been edited down over time.

---

## 1. Product shape

- **Workspace-scoped product**: projects, clients, docs, files, integrations, and billing are scoped to a **workspace**. Users can belong to multiple workspaces and **switch workspace** from the sidebar user menu.
- **Two project flavors**: **`project`** (client-facing work) and **`internal`** (“Internal” spaces). Both use the same tab/block model; internal spaces can be grouped via **internal groups**.
- **Primary UI shell**: dashboard layout with **collapsible sidebar**, **global search**, **Ask AI (⌘K)** command palette (on most routes), **notification bell**, **theme toggle** (light/dark), optional **session splash screen**, and workspace branding in the shell.

---

## 2. Authentication, access, and onboarding

- **Login** and **logout** (server actions).
- **Multi-step signup** (`/signup/*`): verify, password, account setup.
- **Start free trial** flow (`/start-free-trial/*`): verify, password, account setup (parallel onboarding path).
- **Invite acceptance** (`/invite/accept`).
- **Profile** page (`/profile`).
- **Workspace access checks** on dashboard routes; roles from membership control capabilities (see §4).

---

## 3. Main navigation (sidebar)

Primary destinations:

| Area | Route (typical) | Notes |
|------|-----------------|--------|
| Home | `/dashboard` | Dashboard overview |
| Projects | `/dashboard/projects` | Client projects + filters; grid/list |
| Everything | `/dashboard/workspace/everything` | **Business plan only** (hidden if not entitled) |
| Workflow | `/dashboard/workflow` | Workspace-level workflow pages index |
| Clients | `/dashboard/clients` | Client directory |
| Shared with me | `/dashboard/shared` | Magic links shared to the user’s email |
| Internal | `/dashboard/internal` | Internal spaces + groups + standalone files |
| Docs | `/dashboard/docs` | Workspace docs + folders |
| Calendar | `/dashboard/calendar` | Tasks, projects, timelines, Google |
| Products | `/dashboard/shopify/products` | Aggregated Shopify catalog |
| Settings | `/dashboard/settings` | Members, teams, general, notifications; links to Slack & Drive |

**Project drill-in** uses nested routes such as `/dashboard/projects/[projectId]/overview`, `/dashboard/projects/[projectId]/tabs/[tabId]`, optional **Google Drive** under the project, etc.

---

## 4. Workspace membership, teams, and settings

### 4.1 Roles

- **`owner`**, **`admin`**, **`teammate`** — admins/owners manage members and many workspace settings.

### 4.2 Settings tabs (in-app)

- **Members**: invite and manage workspace members.
- **Teams**: workspace teams; members can be grouped for assignment and filtering (e.g. calendar “mine”, timeline assignees).
- **General**: workspace name; surfaces **billing summary** (plan, trial, usage, seats) and (for authorized users) **manual billing overrides**.
- **Notifications**: per-user **notification preferences** panel.
- **Slack** and **Google Drive**: dedicated integration subpages under settings (OAuth / linking flows).

---

## 5. Billing, trials, and entitlements

Plans are modeled as **`free`**, **`standard`**, and **`business`** with a **`billing_status`** lifecycle (trialing, active, past_due, canceled, etc.).

### 5.1 Limits and flags (from plan templates)

- **Free**: caps on **workspaces**, **projects per workspace**, **top-level tabs per project**, **top-level blocks per tab**, and a **daily AI command limit**. Cross-project analytics/AI and several advanced surfaces are off.
- **Standard**: **unlimited** projects/tabs/blocks (null limits in template) and **project templates** enabled; still no Everything page / workspace-scope dashboard charts / cross-project analytics / cross-project AI in the template.
- **Business**: adds **Everything** page, **dashboard configuration**, **workspace-scoped dashboard charts**, **cross-project analytics**, **cross-project AI**, plus project templates.

### 5.2 Other billing-related behavior

- **Standard trial** (14-day style constants in config): **one-time standard trial** per workspace billing row; **app-managed trial** support in data model.
- **Seat quantity** tracked; enforcement hooks exist for paid seat limits (migrations / server logic).
- **Manual plan overrides** for operators who can manage them.
- **AI usage** tracked per workspace per day (`workspace_ai_daily_usage`) against entitlements.
- **Plan locks**: on stricter plans, some **existing** projects may be marked locked when limits are exceeded (internal page shows `is_plan_locked`).

---

## 6. Dashboard (Home)

### 6.1 Data surfaced

Server-side aggregation includes **recent projects**, **recent docs**, **open tasks**, **blocks with comment activity** (team + client feedback channels), **client edit activity**, **AI insights** row for the overview, and unified **due-aware items** for “Today”.

### 6.2 Built-in sections

- **Notifications** card: client feedback + team comment snippets with navigation into project tabs.
- **AI overview**: regeneratable narrative insight using gathered workspace signals.
- **Today**: buckets such as **past due**, **due today**, **upcoming** (from due-aware items or tasks).

### 6.3 Customizable dashboard (Business)

- **Per-workspace layout** stored client-side (localStorage) via **dashboard config** types:
  - **Project card** (pinned project).
  - **Project group** with filters: status, team, initiative, due this week, recently updated; views **compact list** or **kanban snapshot**.
  - **Task list** widget: due soon / my tasks / all.
  - **Chart** widget: pie/bar/doughnut with **workspace or project scope** and breakdown by status, priority, assignee, or tags (uses same conceptual model as AI/spec charts).
- **Free/Standard** templates disable dashboard configuration and workspace-scope charts at the entitlement layer.

### 6.4 Other dashboard UX

- **Free trial banner** component on the dashboard when applicable.
- **Customize dashboard** entry opens a config modal when entitled.

---

## 7. Projects list and project overview

### 7.1 Projects index (`/dashboard/projects`)

- **Filters**: status, client, search, sort.
- **Views**: **list** and **grid** (grid can fetch **first-tab preview**).
- **Folders** for organizing projects (folder model wired on this page).
- **Create project** event bus from sidebar for quick create.

### 7.2 Project detail & overview

- **Overview** route summarizes project health, tasks, timelines, and activity (composite overview client).
- **Per-project Google Drive** integration area and **Drive linking** routes under the project.
- **Tabs** are the main working surface; see §9–§11.

### 7.3 Project templates (Standard+)

- **Entitlement-gated** (`assertCanUseProjectTemplates`).
- **Template cloning** logic in project actions: deep clone of tabs, blocks, tables, fields, rows, timelines, cards, references, with sanitization (e.g. strip files, remap UUIDs, clear source sync metadata where appropriate).
- UI affordances such as **“Make template”** from blocks and template-based project creation flows.

---

## 8. Clients and client-facing experiences

### 8.1 Client records

- **Clients list** and **client detail** with their own **tab sets** parallel to projects.

### 8.2 Magic links (public client pages)

- **Public token** URLs under `/client/[publicToken]` (and tab-specific client URLs).
- Renders **client tab bar**, **blocks**, **file attachments** with **batch signed URLs**, **auto-refresh**, tracking, and banners.
- **Client editing** can be enabled per project: only certain block types are editable from the client API (`text`, `link`, `section_header`). Edits produce **activity** visible internally.

### 8.3 Sharing & “Shared with me”

- **Client page shares**: record when a magic link is shared **to an email**; listed on **`/dashboard/shared`** for that user with project name, tabs in link, sharer, timestamp, and link.

### 8.4 Client workflow routes

- **`/client/[publicToken]/workflow/[workflowPageId]`** for client-visible workflow-style pages when exposed.

---

## 9. Tabs, layout, and blocks

### 9.1 Tab model

- **Hierarchical tabs**: parent tabs and **subtabs**; sidebar context for parent/siblings when drilling into subtabs.
- **Workflow tabs / pages**: special metadata; **workflow pages** can exist at workspace level (see §15) or be tied to projects.
- Tabs belong to a **project** (or internal space) and have a **name** and ordering.

### 9.2 Block layout

- Blocks sit in **rows** with **up to three columns** on large screens.
- **Section** blocks act as **scrollable containers** for nested blocks (`parentBlockId`).
- **Block references**: `originalBlockId` supports referencing another block’s content.
- **Block lock** exists at the data layer (concurrent editing / guardrails).

### 9.3 Block types (project tabs)

From `BlockType` in code:

`text`, `task`, `cards`, `link`, `divider`, `table`, `timeline`, `file`, `video`, `image`, `gallery`, `embed`, `pdf`, `section`, `section_header`, `chart`, `doc_reference`, `shopify_product`

**Capabilities (high level)**

- **Text / section / section_header / divider / link**: narrative structure and navigation.
- **Task blocks**: task lists tied to `task_items`, subtasks, assignees (users + teams), priorities, statuses, due dates/times, tags, comments — integrated with calendar, dashboard, charts, and AI tools.
- **Table blocks**: full **dynamic tables** with fields, rows, typed columns (including tags, dates, relations, subtask-backed fields, etc.), **universal properties** for rows, bulk RPCs, and **source linking** of rows to tasks/timelines with sync modes.
- **Timeline blocks**: events with optional **sub-events**, **dependencies**, assignees (including **teams**), priorities, tags; events participate in **calendar** and chart queries.
- **File / image / gallery / pdf / video**: attachments with storage-backed files and signed URLs; gallery supports multiple assets; **cards** block supports richer card entities (including slideshow-related migrations).
- **Embed**: external embeds (YouTube, Figma, etc., depending on embed handler).
- **Chart blocks**: charts driven by **refreshable queries** or fixed entity sets over **tasks, subtasks, timeline events, table rows, cards**; chart types include **bar, line, pie, doughnut** in types; dashboard widgets use pie/bar/doughnut.
- **Doc reference**: link a workspace **doc** into a tab canvas.
- **Shopify product**: embed a connected-store product with product detail/analytics hooks.

### 9.4 Properties & metadata

- **Entity properties** power unified status/priority/assignee/due/tags across tasks, timeline rows, table rows, etc., for **Everything**, charts, AI, and search indexing.

---

## 10. Tasks, subtasks, and checklist behavior

- **Statuses**: `todo`, `in_progress`, `blocked`, `done` (used in AI search tools and UI).
- **Priorities**: including `urgent`, `high`, `medium`, `low`, and legacy/none handling.
- **Assignees**: multiple assignees via join tables; **team assignees** on tasks and timelines.
- **Subtasks** as first-class entities with CRUD, completion, properties, and AI tools (`searchSubtasks`, `getSubtaskDetails`, bulk operations).
- **Comments** on task blocks / threads (see §17).
- **References** from tasks/timelines to files and other blocks (linkable/reference actions).

---

## 11. Tables (database-like blocks)

- **Schema**: create/update/delete **fields** with types including text, number, select, tags, dates/date ranges, **relation** fields (linked tables, reverse fields, display fields), **subtask** field type, etc.
- **Rows**: create/update/**bulk** insert/update, delete single or many, **update by field names** helpers for AI and imports.
- **Universal row properties** enforced at DB level (migration history): align row metadata with the same property system as tasks/timelines for analytics.
- **Source tracking**: rows (and tasks/timelines) can reference a **source** entity with **sync modes**; **edited** flags protect user overrides.
- **AI tools** cover full table lifecycle (`createTableFull`, `updateTableFull`, `createField`, …) and search.

---

## 12. Timelines

- **Events** with start/end, priority, assignee user/team, tags.
- **Sub-events** nested under events.
- **Dependencies** between events (create/delete).
- **Linking** timeline events to files and other blocks for titles/navigation.
- **Calendar integration** alongside tasks and projects.

---

## 13. Docs

- **Workspace docs** with **title**, **archival**, sorting, search.
- **Folders** (`doc_folders`) for organizing docs in list/grid UI.
- **Per-doc editor** route (`/dashboard/docs/[docId]`).
- **Doc reference blocks** embed docs into project/client canvases.
- **AI tools**: create/update/archive/delete docs; search doc content.

---

## 14. Internal spaces

- **Listing** with grid/list views, filters (status, search, sort).
- **Internal groups** to cluster internal spaces.
- **Standalone workspace files** surface (files not tied to a specific block context on this page).
- Same **tab/block** capabilities as client projects once inside a space.

---

## 15. Workflow pages

- **Index** at `/dashboard/workflow`: lists workspace-level **workflow pages** described in UI as “permanent, AI-powered analysis documents.”
- **Create** workflow page (server action) and navigate to `/dashboard/workflow/[workflowPageId]`.
- **Dedicated layout behavior**: workflow routes adjust shell (AI sidebar/palette suppression rules differ).
- **Project-level** workflow tabs also exist in the tab metadata model.

---

## 16. Calendar

- **Views**: `all` vs **`mine`** (query param) — “mine” restricts to tasks assigned to the user (including legacy assignee column + `task_assignees`) and timelines relevant to the user’s **teams**.
- **Event sources**: **tasks**, **projects** (due milestones), **timeline** events, **Google Calendar** (external events with URLs/locations).
- Client calendar page is **dynamic** (force-dynamic) for fresh data.

---

## 17. Everything (Business)

- **Unified workspace view** of tasks, timeline items, table rows, etc., as **`EverythingItem`** with **source** (project, tab, container) and **universal properties**.
- **Table and board** modes; **group by** status, priority, assignee, due date, tags, project, source type, entity type.
- **Filters**, **sort**, **search**, with **saved views** persisted in **localStorage** per workspace (save/manage modals).
- **Entitlement check** redirects non-Business workspaces to the dashboard.

---

## 18. Shopify

- **Multi-store** connection model at workspace level.
- **Products** page: search, per-store filter, product cards (title, image, vendor, type, store, variant count, status), **detail** views.
- **Shopify product block** on canvases.
- **AI tools**: search products, product details, sales data, create products table, refresh product.
- Onboarding-style **empty state** when no products synced.

---

## 19. Integrations

### 19.1 Slack

- Workspace-level **OAuth** connection and callback routes under settings.
- **Slash commands / outbound** integration paths (API route and AI executor) to query or act on workspace data from Slack.

### 19.2 Google Drive

- Workspace-level OAuth.
- **Project-level** Drive browsing/linking.
- **External assets** model in migrations (Google Drive file references).

### 19.3 Shopify

- Covered in §18.

---

## 20. Search

### 20.1 Global sidebar search

- Debounced search across **projects, tasks, docs, text blocks, tabs** via `ai-search` actions (keyword-oriented, limit 10 per channel).

### 20.2 Semantic / RAG search

- **Embeddings indexer** (with cron-driven reindexing when pending work exists) indexes blocks, docs, files.
- **AI tool** `unstructuredSearchWorkspace` returns parent sources + chunks.
- Tool **`reindexWorkspaceContent`** for operators/AI to trigger reindex.

### 20.3 Fuzzy DB support

- **pg_trgm** migration exists for fuzzy text search at the database layer.

---

## 21. AI and automation

### 21.1 Surfaces

- **Ask AI command palette** (⌘K) on dashboard routes except workflow-specific layout cases.
- **Dashboard AI overview** narrative card.
- **Inline / tab context** for AI (block-aware prompts in workflow executor and API routes): AI knows **block type** and can scope task operations to **task blocks**.
- **AI stream API** (`/api/ai/stream`) and related tests.
- **File analysis** tool (`fileAnalysisQuery`) and README-documented **DeepSeek**-based file analysis sidebar (env vars for DeepSeek/OpenAI embeddings).

### 21.2 Tooling breadth

The **tool definition registry** includes dozens of tools grouped into categories such as **search, control, task, project, table, timeline, block, tab, doc, property, file, comment, client, workspace, payment, shopify**. Representative capabilities:

- Search: tasks, subtasks, projects, tabs, clients, members, tables, rows, timeline events, blocks, cards, docs, doc content, files, tags, unified property search, **`searchAll`**, entity resolution.
- Mutations: full CRUD patterns for tasks/subtasks/comments, projects/tabs/blocks/cards, tables/fields/rows/bulk, timelines including sub-events and dependencies, clients, docs, comments, chart block creation, Shopify helpers.
- **Dynamic tool group expansion** via `requestToolGroups` for staged capability loading in long runs.

### 21.3 Charts + AI

- **Chart suggestion** action takes a natural-language prompt and returns suggested chart type and summary for chart blocks.

### 21.4 Plan gating (recap)

- **Free**: daily AI command cap.
- **Business**: cross-project AI + analytics entitlements aligned with Everything and dashboard chart scopes.

---

## 22. Collaboration: comments, mentions, notifications

- **Threaded block comments** with author, timestamps, permissions for edit/delete.
- **Mentions / reference picker** in comments to link tasks, blocks, and related entities (inline references).
- **Distinction** between internal team comments and **client-originated** feedback on public pages.
- **Notifications system** (DB migrations): bell UI + **notification preferences**; comments and client activity feed dashboard cards.

---

## 23. Files and attachments

- **Upload** and attach to blocks; **multiple attachments** per block.
- **Signed URLs** for secure reads (including **public client** views).
- **File comments** (including threading/parent linkage per migrations).
- **Rename** file tool for AI/ops.
- **Standalone** workspace files visible from Internal hub.

---

## 24. Analytics and reporting (in-app)

- **Chart blocks** and **dashboard chart widgets** for distributions/breakdowns.
- **Cross-project analytics** flagged **Business** entitlement (server-side assertions accompany dashboard chart scope).
- **Shopify product sales** tool for AI-driven commerce questions.

---

## 25. Payments page

- **`/dashboard/payments`** exists with a **payments table UI** backed by **mock data** in code comments as a placeholder until payment tables are wired.

---

## 26. Developer, QA, and demo routes (non-product)

The app includes routes such as **`/test/*`**, **`/dashboard/search-test`**, **`/dashboard/qa`**, **`/dashboard/personal-mockup`**, **`/mock/*`**, **`/dashboard/populate-buckeye`**, and **`/app/[[...legacy]]`** — useful for development and demos, not part of the core end-user feature promise.

---

## 27. Summary

Trak is a **workspace-based** operating system for client and internal work: **projects and internal spaces** with rich **tabs and blocks** (tasks, tables, timelines, media, charts, docs, Shopify), **client magic links** with optional **client editing**, **calendar** and **notifications**, **Shopify** and **Google Drive** and **Slack** integrations, **semantic + keyword search**, and deep **AI** (command palette, dashboard narrative, file analysis, and a large structured tool layer). **Standard/Business billing** unlocks templates, higher limits, and **Business-only** workspace-wide **Everything** and **dashboard customization / cross-project analytics**.

---

*Generated from repository inspection (April 2026). For entitlement numbers and exact limits, treat `trak/src/lib/billing/config.ts` and related billing data as the source of truth.*
