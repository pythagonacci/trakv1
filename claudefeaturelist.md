## Trak – Feature & Capability Inventory

This document describes, in plain language, the major features and capabilities of the Trak web app as it exists today. It is written for a non-technical project manager and focuses on what users can do, how the product behaves, and how different pieces fit together.

---

## 1. Dashboard

The dashboard is the “home” view for a workspace. It is designed to give each user a fast understanding of what matters right now, what is coming up, and where there are risks or feedback to respond to.

- **Workspace summary**
  - Shows the current workspace name and acts as the main entry point into projects and work.
  - Provides a clear call to action to create new projects directly from the dashboard.

- **AI Overview block**
  - The AI Overview is a smart summary of the workspace.
  - It reads activity across projects, tasks, due dates, comments, and client feedback, and produces a human‑readable narrative of what is going on.
  - It automatically refreshes on a schedule and also refreshes when the user comes back to the tab after some time away, so the content doesn’t go stale.
  - Users can manually regenerate the AI summary at any time to get an up‑to‑date interpretation.
  - The AI output highlights trends, risks, areas that are stuck, and things that look on track, not just a list of items.

- **“Today” / time‑based task overview**
  - The dashboard groups all due‑aware items into:
    - Items due today.
    - Upcoming items.
    - Past‑due items.
  - This grouping works across tasks and other date‑driven items, not just a single list.
  - Each item clearly shows:
    - The task name.
    - The project it belongs to.
    - The tab or area where it lives.
    - Priority (urgent, high, medium, low, none) as color‑coded badges.
    - When it is due, with smart labels like “Today”, “Tomorrow”, or a calendar date.
  - Clicking an item jumps the user directly into the correct project tab, with the task pre‑focused so they can act immediately.

- **Notifications: client feedback and team updates**
  - The dashboard has a notifications card that consolidates:
    - Client feedback on shared content.
    - Internal teammate comments and updates.
  - Each update includes:
    - The comment text.
    - Who wrote it (client vs team member).
    - Which project and tab it relates to.
    - How long ago it was left.
  - Clicking a notification opens the exact project and tab where the comment lives, making it easy to respond or adjust the work.
  - This gives a single place to review conversations across the workspace instead of hunting through individual tabs.

- **Configurable dashboard widgets**
  - The dashboard supports a configurable set of widgets, including:
    - AI overview.
    - Notifications.
    - Time‑based task groupings (today, upcoming, past due).
    - Project‑based widgets (individual project cards, grouped views).
    - Task list widgets.
    - Chart widgets (explained below).
  - Workspaces can tailor which widgets are shown and how prominent they are, turning the dashboard into a control center rather than a static page.

- **Dashboard charts and analytics**
  - The dashboard supports powerful chart widgets that visualize work across the workspace or within a single project.
  - Each chart:
    - Has a title and a defined “scope” (entire workspace vs a specific project).
    - Can group items by categories such as status, priority, or other fields.
    - Shows the total count of tracked items.
    - Displays an at‑a‑glance view (for example, a donut or other chart) plus a detailed breakdown list.
  - The breakdown panel:
    - Groups items by category (for example “Not Started”, “In Progress”, “Done” or priority levels).
    - Displays the count and percentage for each category.
    - Lets the user expand a category to see individual items and open them directly.
  - Users can quickly refresh a chart to pull in the latest data.
  - A “Lock” behavior is available to stabilize a chart configuration so that it does not change accidentally.
  - The chart area also lists the active filters and categories, so users always understand what the chart represents.

---

## 2. Clients Page

The Clients page is where teams manage all of their external clients in one place.

- **Client list and overview**
  - Shows all clients in the current workspace in a clean list.
  - For each client, the page surfaces:
    - Client name.
    - Company name.
    - When they were added.
    - How many projects are associated with that client.
  - The list is sorted for quick scanning and supports workspaces with many clients.

- **Workspace‑aware**
  - The clients that appear on this page are scoped to the active workspace, so multi‑workspace organizations can keep accounts logically separated.

- **Direct navigation into client work**
  - From a client entry, users can navigate into deeper client‑specific project and tab views (detailed later under the Tab Structure and Public Client Sharing sections).

---

## 3. Internal Page

The Internal page is for managing internal spaces and internal work that is not directly tied to external clients.

- **Internal “spaces” instead of client projects**
  - Internal work is handled as projects of type “internal”, but presented as internal spaces.
  - Each internal space has:
    - A name.
    - A status (not started, in progress, complete).
    - A created date.
    - An optional internal group it belongs to.

- **Views and filters**
  - The Internal page supports both a grid view and a list view:
    - Grid view is optimized for browsing internal spaces visually.
    - List view is more compact and table‑like.
  - Users can filter internal spaces by:
    - Status (not started, in progress, complete).
    - Search text.
    - Sort options such as created date, updated date, due date, or name.

- **Internal groups**
  - Internal spaces can be grouped into internal “groups” (for example, “Operations”, “Marketing”, “Product”).
  - These groups allow teams to cluster internal initiatives that don’t map to individual paying clients.

- **Standalone internal files**
  - The Internal page also surfaces standalone files that belong to the workspace but are not attached to a specific project.
  - This enables internal resources like reference docs, templates, or internal guidelines to live alongside internal projects.

---

## 4. Docs Page

The Docs page is a central library for documents, separate from project‑specific tabs.

- **Document library**
  - Shows all docs in the workspace.
  - Each doc has:
    - A title.
    - Created and last‑updated timestamps.
    - Optional folder placement.

- **Flexible views**
  - List view: table‑style, great for sorting and scanning.
  - Grid view: more visual, good for browsing and recognizing documents.

- **Filters and sorting**
  - Filter by:
    - Archived vs non‑archived docs (or show both).
    - Search across titles.
  - Sort by:
    - When the doc was created.
    - When it was last updated.
    - Title.

- **Folder organization**
  - Docs can be organized into folders to mirror how a team thinks about their knowledge base (for example “Playbooks”, “SOPs”, “Brand”).
  - Folders are available in both list and grid views so users can quickly jump into a specific section of the library.

---

## 5. Calendar Page

The Calendar page is a unified calendar across projects, tasks, and timelines.

- **Unified view of work**
  - Combines:
    - Tasks with due dates.
    - Projects with due dates.
    - Timeline events.
    - Integrated external calendar sources (for example Google events, when available).
  - Everything shows up as “calendar events” with:
    - A title.
    - Date (and optional start and end times).
    - A type (task, project, external calendar entry, or timeline).
    - Links back to the project, tab, and block where it lives.

- **“Mine” vs “All”**
  - Users can choose between:
    - “All”: see everything in the workspace calendar.
    - “Mine”: see only:
      - Tasks where they are an assignee (across different assignment tables).
      - Timeline events assigned directly to them.
      - Timeline events assigned to teams they are part of.
  - This makes it possible to switch between a personal calendar view and an overall team view.

- **Task events**
  - Task events include:
    - Task title.
    - Due date and optional due time and end time.
    - Priority level.
    - The project and tab context where the task lives.
  - Clicking an event takes users straight into the relevant project and tab.

- **Project events**
  - Projects with due dates also show up on the calendar.
  - This allows teams to see major delivery deadlines alongside individual tasks.

- **Timeline events**
  - Timeline events from specialized “timeline blocks” are also converted into calendar events.
  - Each timeline event:
    - Has a start date (and optional end date and time range).
    - Can be assigned to individuals or teams.
    - Carries priority and is tied back into the project and tab where the timeline lives.

- **Different event types, single surface**
  - Users do not need to understand the underlying structure; they just see a full picture of commitments, by day, across the workspace.

---

## 6. Products Page (Shopify Products)

The Products page is dedicated to products pulled in from Shopify.

- **Multi‑store product library**
  - Shows all imported products from connected Shopify stores.
  - Each product card includes:
    - Title.
    - Main image (or a clean placeholder if there is no image).
    - Vendor.
    - Product type.
    - The store it came from.
    - How many variants it has.
    - Product status (for example active vs other states).

- **Searching and filtering**
  - Users can search products by name to quickly locate a specific item.
  - When multiple Shopify connections exist, users can:
    - Filter the list by a specific store.
    - Or show products from all stores together.

- **Product drill‑down**
  - Selecting a product opens a detailed product view (via a product detail component).
  - The detail view provides deeper information about the product, such as variants and store data, without leaving the Trak environment.

- **Onboarding state**
  - If no products have been imported yet:
    - The page clearly explains that there are no products.
    - Offers a direct action to connect a store and start syncing products.

---

## 7. Integrations We Support

Trak integrates with several external tools, both at the workspace and project level. The integrations today focus on communication, e‑commerce, and file storage.

- **Slack**
  - **Workspace‑level Slack connection**
    - Teams can connect Slack from the Integrations area under Settings.
    - Supports installing the Slack app and handling OAuth callbacks.
    - Connections are stored per workspace so multiple workspaces can link to different Slack environments.
  - **Capabilities**
    - Send updates from Trak into Slack channels (for example activity, tasks, or notifications).
    - Handle incoming Slack commands to pull information from Trak (for example slash commands).
    - Disconnect Slack when needed without affecting the rest of the workspace.

- **Shopify**
  - **Workspace‑level Shopify connections**
    - Multiple Shopify stores can be connected to a single workspace.
    - The Integrations page shows all connected stores for the workspace.
  - **Capabilities**
    - Import products from Shopify into the Trak Products page.
    - Track metadata such as:
      - Shop domain and shop name.
      - Product descriptions, product types, status.
      - Variants and variant counts.
      - Last sync time.
    - Filter and work with products at a per‑store level or across all stores.
  - **Future‑friendly structure**
    - The integration is structured so that more Shopify‑driven workflows (orders, campaigns, etc.) can be layered on top in a consistent way.

- **Google Drive**
  - **Workspace‑level Google Drive integration**
    - Connect a Google Drive account to the workspace from Settings.
    - OAuth callback flow is fully supported.
  - **Project‑level Drive integration**
    - At the project level, there is a dedicated area to view and manage Google Drive files related to that project.
  - **Capabilities**
    - Attach Google Drive files to project tabs and blocks using signed URLs.
    - Centralize access to important drive documents from within Trak rather than jumping in and out of different tools.

- **Other internal integration hooks**
  - The integration framework is shared across different types of content (for example standard tabs, client‑facing tabs, workflow pages), making it possible to surface external content in the same canvas as Trak‑native blocks.

---

## 8. Projects Page

The Projects page is the core hub for managing client‑facing and internal projects.

- **Workspace‑scoped projects list**
  - Shows all projects in the current workspace that match the selected filters.
  - Each project includes:
    - Name.
    - Status (not started, in progress, complete).
    - Due date (as a concrete date and optional descriptive text).
    - Associated client, if any.
    - Associated folder or group, if any.
    - Created date.
    - A preview of the first tab when in grid view, to give a visual sense of the project contents.

- **Views**
  - List view:
    - Ideal for power users who need to sort and scan.
    - Shows multiple columns including status, due dates, client, folder, and created date.
  - Grid view:
    - More visual, highlighting key information about each project and showing content previews.

- **Filtering and sorting**
  - Filters include:
    - Project type (for example client projects vs internal projects).
    - Status (not started, in progress, complete).
    - Client (to see all projects for a specific client).
    - Text search across project names.
  - Sorting includes:
    - Created date.
    - Updated date.
    - Due date.
    - Project name.
  - Combinations of filters and sorts can be used to narrow large project lists to a manageable set.

- **Folders for organization**
  - Projects can belong to folders, enabling teams to organize projects into categories such as “Active”, “On Hold”, “Completed”, or by vertical.

- **Project overview page**
  - Each project has an overview that:
    - Summarizes key metrics like open task count and number of recent team comments.
    - Breaks down tasks into:
      - Due today.
      - Due soon.
      - Overdue.
    - Surfaces recent team comments and feedback for that specific project.
  - The overview links directly into the appropriate tabs when users click on tasks or comments.

---

## 9. Tab Structure and Blocks

Tabs and blocks are at the heart of how Trak organizes and displays work.

### 9.1 Tab Structure

- **Project tabs**
  - Each project is made up of multiple tabs.
  - Tabs act like flexible pages or canvases where work is organized into blocks.
  - Tabs have:
    - A name.
    - A clear relationship to a project.
    - A type (for example a standard tab or a workflow tab).

- **Hierarchical tabs and subtabs**
  - Tabs can be arranged hierarchically:
    - Parent tabs.
    - Child subtabs.
  - When users are viewing a tab that is part of a hierarchy, a sidebar shows:
    - The parent tab.
    - All sibling subtabs.
  - This makes it easy to break complex work into sub‑pages (for example “Strategy”, “Assets”, “Reporting” under one parent).

- **Workflow tabs**
  - Some tabs are designated as workflow pages.
  - Workflow tabs can reuse the same block system but are presented with a workflow‑oriented layout (for example for step‑by‑step or pipeline‑style views).

- **Client tabs**
  - Clients have their own tab sets, parallel to project tabs.
  - Each client tab can host blocks designed specifically for external consumption (or internal content mirrored to clients).

### 9.2 Block System (within Tabs)

Within each tab, content is built from a library of “blocks”. Blocks are modular sections of content that can be arranged in rows and columns on the canvas.

- **Layout behavior**
  - Blocks are grouped into rows, and each row can have:
    - One column (full‑width blocks).
    - Two columns.
    - Up to three columns on larger screens.
  - This flexible grid allows for balanced layouts, such as:
    - A large overview section with smaller supporting cards.
    - Side‑by‑side comparisons.

- **Key block types and capabilities**
  - **Task blocks**
    - Represent task lists within a tab.
    - Support:
      - Task titles and descriptions.
      - Due dates and times.
      - Priority levels.
      - Association with a project and tab.
      - Integration with the calendar and dashboard views, so tasks appear in the right places.
  - **Timeline blocks**
    - Represent sequences of work over time.
    - Each timeline event has:
      - Title.
      - Start and optional end date/time.
      - Priority.
      - Assignee (individual or team).
    - Timeline events feed into the Calendar page as events.
  - **File blocks**
    - Allow attaching files stored within Trak’s file system.
    - Support linking multiple attachments (for example, multiple PDFs) to a single block.
    - Automatically handle fetching the URLs needed to display or download files.
  - **Image blocks**
    - Display a single image file.
    - Commonly used for design mockups, screenshots, or visuals.
  - **Gallery blocks**
    - Show a set of images as a gallery, ideal for presenting multiple creative assets.
  - **PDF blocks**
    - Embed PDF documents directly in the canvas so users can review them without leaving the page.
  - **Video blocks**
    - Render video content attached as files, so stakeholders can watch clips (for example ads, walkthroughs) inline.
  - **Chart blocks / analytics blocks**
    - Blocks can render charts (similar to dashboard chart widgets) directly inside a tab.
    - These chart blocks summarize task or project data, helping teams see progress or distribution without going back to the main dashboard.
  - **Rich content / text‑based blocks**
    - Support titles, descriptive text, instructions, and narrative context surrounding more structured elements.
    - Often used for project briefs, notes, and explanations that frame the more structured content.

- **Properties and metadata on blocks**
  - Blocks support additional properties and metadata per block (for example tags, extra attributes).
  - This metadata is used by AI, search, and analytics features to better understand and surface relevant content.

- **Client‑visible block behavior**
  - On client‑facing tabs (public or authenticated), the same blocks render, but with:
    - Read‑only behavior for clients (unless client editing is explicitly enabled).
    - Optional comment controls tailored for clients.

---

## 10. AI Capabilities

AI is woven throughout the product to help teams understand their work, find information, and iterate faster.

- **AI Overview on the dashboard**
  - As described earlier, AI produces a narrative summary of what is happening across the workspace.
  - It surfaces:
    - What is on track vs at risk.
    - Deadlines to pay attention to.
    - Areas with a lot of conversation or client feedback.
  - Users can regenerate the overview on demand, and it also refreshes automatically on a schedule.

- **AI‑powered search and context**
  - There is an AI search capability that understands the context of tasks, documents, files, and comments.
  - Instead of searching only for exact keywords, users can ask more natural questions about their work.
  - AI can link related content across blocks, projects, and docs, so results feel more “aware” of the workspace.

- **AI within blocks and canvases**
  - Tabs and client pages include an AI context provider that allows:
    - Inline AI assistance on content blocks.
    - Context‑aware suggestions, rewrites, and summarization inside the canvas.
  - AI understands:
    - What block it is operating on (for example tasks vs notes vs assets).
    - Surrounding content in the same tab.

- **File analysis and AI comments**
  - Uploaded files can be analyzed by AI:
    - Extracting key points from long documents.
    - Suggesting next steps based on content.
    - Supporting AI‑driven comments attached to specific files.
  - There is infrastructure for AI‑generated comments and notes, which can show up side by side with human comments.

- **AI undo / history‑aware behavior**
  - There is support for AI “undo” operations, allowing users to revert AI‑generated changes when needed.
  - This builds trust by making AI actions reversible rather than permanent.

Overall, AI is positioned as:
- A summarizer (dashboard overviews, project snapshots).
- A search assistant (finding relevant items across the workspace).
- A writing and analysis helper (within blocks, comments, and files).

---

## 11. Public Client Sharing Links

Trak supports public client pages for sharing curated project content through secure links.

- **Project‑level public settings**
  - Projects can be configured with:
    - Whether a public client page is enabled.
    - Whether clients are allowed to comment.
    - Whether clients are allowed to edit content.
    - A unique public token used to generate the shareable link.

- **Public client page experience**
  - Clients access a dedicated client view of the project via a link based on the public token.
  - They see:
    - A simple, elegant project header.
    - A set of tabs curated for them (not necessarily all internal tabs).
    - A clean canvas of blocks on each tab, mirroring the internal experience.
  - The public client page does not require a login, but respects project‑level permissions (for example which tabs are public).

- **Tab navigation**
  - Clients can move between tabs from a sticky tab bar.
  - The first tab is loaded by default when they open the link.

- **Client comments**
  - If comments are enabled for the project:
    - Clients can leave comments on specific blocks.
    - Client comments are clearly distinguished from internal comments (labeled as “Client”).
    - Comments carry timestamps and names, so internal teams can see when and who gave what feedback.
    - Comments appear in internal notifications and project overviews, so teams don’t miss them.

- **File and media handling**
  - The same block types (images, galleries, PDFs, videos, and file attachments) are available on public pages.
  - File URLs are signed and handled in a way suitable for public consumption while keeping access scoped to the shared content.

- **Lightweight tracking**
  - There is an invisible tracker component on public pages to record basic analytics (for example page/tab access), which can be used to understand client engagement over time.

---

## 12. Misc Capabilities (Collaboration, Comments, Mentions, and More)

This section covers cross‑cutting capabilities that do not belong to only one page.

- **Commenting system on blocks**
  - Any block in a project tab can have comments attached to it.
  - Comments support:
    - Author identity (name and email).
    - Timestamps with human‑friendly “time ago” formatting.
    - The ability to reply to specific comments, creating threaded conversations.
    - Permission rules so only relevant users can delete or edit comments.
  - Comments stay attached to their block even as layouts change, ensuring context is preserved.

- **@‑style mentions and references**
  - While writing a comment, users can invoke a mention picker (similar to typing “@”).
  - This opens a reference picker that lets the user link to other items (for example tasks or blocks).
  - Mentions are inserted inline into the comment text, making it clear who or what is being referenced.

- **Client vs internal comments**
  - The system distinguishes:
    - Internal team comments.
    - External client comments (from public client pages).
  - Client comments are labeled clearly so that:
    - Teams can immediately see which feedback came from clients.
    - Permissions for deleting or editing comments respect whether the comment was external or internal.

- **Notifications tied to comments**
  - Comments feed into:
    - The Dashboard notifications card (for both client and team comments).
    - Project overviews (for team comments specific to a project).
  - This ensures conversations are surfaced in the places where people are planning and reviewing work.

- **Workspace structure and access**
  - Everything is scoped to a workspace:
    - Projects, internal spaces, docs, clients, and integrations all live under a workspace.
  - Users must be part of a workspace to see its dashboard, calendar, and other pages.
  - Roles (such as owner or admin) control who can manage integrations and certain workspace‑level settings.

- **Task management basics**
  - Tasks across the app support:
    - Titles and text descriptions.
    - Due dates and optional due times/time ranges.
    - Priority levels (urgent, high, medium, low, none).
    - Optional assignees (users or teams).
  - Tasks automatically integrate into:
    - The Calendar view.
    - Project overview.
    - Dashboard time‑based widgets.

- **Tagging and metadata**
  - Projects support tags and priorities, which can be used to categorize and later query or visualize work.
  - Blocks and tasks can also have additional properties stored behind the scenes, which power charts, AI, and search.

- **File handling**
  - The system supports:
    - Uploading and attaching files to blocks.
    - Attaching multiple files to a single block (via an attachment table).
    - Serving files safely with signed URLs, including in public client views.

- **Layout polish and usability**
  - Many components use sticky headers and tab bars so key navigation is always visible while content scrolls.
  - Grid layouts adapt across screen sizes, collapsing multi‑column layouts into single columns on smaller devices.
  - Empty states are thoughtfully designed to guide users (for example prompting to connect a store or create content rather than just showing “empty” screens).

---

## 13. Summary

In summary, Trak provides:
- A configurable dashboard that surfaces AI insights, time‑sensitive work, notifications, and charts.
- A structured way to manage clients, projects, internal spaces, docs, and products.
- A flexible tab and block system that can host tasks, timelines, rich content, files, media, and charts.
- Deep calendar, analytics, and AI integrations to understand and act on work.
- Robust client‑sharing links and a rich commenting system that bring external and internal feedback into one place.

This document reflects the capabilities currently present in the application and can be used as a working reference for planning, prioritization, and stakeholder communication.

