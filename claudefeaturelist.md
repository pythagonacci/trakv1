## Trak – Feature & Capability Inventory

This document describes, in plain language, the 

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

