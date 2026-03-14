# Trak Template Context — Product & Design Reference

This document describes the Trak project workspace from a **product and design perspective** — what exists, how it works, and how it looks from a user's point of view. Use this as a reference when designing templates so you can leverage the full potential of the product.

---

## 1. Project Page Structure

### 1.1 Overall Layout

A project page consists of:

- **Project header** — Collapsible area at the top showing project name, status, due date, priority, tags, client association, and navigation controls
- **Tab bar** — Horizontal list of tabs for navigating between project sections
- **Main content area** — The tab canvas where blocks are displayed
- **Optional table of contents** — Right-hand panel listing blocks for quick navigation (toggleable)
- **Optional doc sidebar** — Slides in when a document reference is opened

### 1.2 Project Header

**Expanded state:**
- Breadcrumb-style navigation: "Back to projects" → "Overview" → "Drive"
- Client badge (if project is linked to a client): client name and company
- Project title (large, bold)
- Metadata row: status badge, due date, priority pill, tags
- Action buttons: Collapse, Client Page toggle (public link), Project settings (Edit details, Manage Access, Google Drive)
- "Contents" button (when tab has blocks) — toggles the table of contents panel

**Collapsed state:**
- Single compact row: project name · current tab name
- Dropdown to show/hide tab bar
- Contents toggle
- Expand button

The collapse state is persisted per project in localStorage.

### 1.3 Tab Structure

**Tab types:**
- **Standard tabs** — Regular project pages with blocks
- **Workflow tabs** — Same block system but presented with a workflow-oriented layout (e.g., step-by-step, pipeline); indicated by a sparkle icon
- **Client tabs** — Tabs that can be made visible to clients on the public client page

**Hierarchy:**
- Tabs can have **parent** and **child** (subtab) relationships
- Parent tabs show a chevron to expand/collapse subtabs
- When viewing a subtab, the parent tab name is shown with the active subtab name beneath it
- Subtabs appear in a dropdown or indented list when expanded

**Tab bar behavior:**
- Fixed at top when at top of scroll; becomes a floating bar when user scrolls down (revealed on hover near top of viewport)
- "Overview" is always the first tab (links to project overview page)
- Tabs are followed by a "+" button to add new tabs
- On mobile: tabs collapse into a dropdown menu
- Click a tab to navigate; double-click to rename inline

**Tab actions (per-tab dropdown):**
- Rename
- Add sub-tab
- Make Public / Make Private (when client page is enabled)
- Edit public title (when tab is public)
- Delete (workspace owners/admins only)

**Number of tabs:** There is no explicit limit. Tabs are created on demand.

### 1.4 Tab Content Area

**Layout:**
- Full-width canvas with padding (`pl-2 pr-12 pt-2 pb-6`)
- Rounded container with optional theme-based background
- Blocks are arranged in **rows**; each row can have 1, 2, or 3 blocks side by side
- Rows are stacked vertically with consistent spacing (`space-y-5`, `gap-6 md:gap-8` between columns)
- Responsive: multi-column rows collapse to single column on smaller screens (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)

**Empty state:**
- When a tab has no blocks: a large clickable area with dashed border
- "Click to start typing" prompt
- Add block button available
- Clicking the empty area creates a new text block

**Table of Contents:**
- Right-hand panel listing all blocks by type and title
- Clicking an item scrolls to that block
- Can be expanded/collapsed via "Contents" button in header
- Hidden on smaller screens (lg breakpoint)

### 1.5 Workflow Tabs

Workflow tabs use the same block system but may have different layout or AI chat integration. The structure is flexible for step-by-step or pipeline-style views.

---

## 2. Block Types — Exhaustive Reference

### 2.1 Text Block

**Purpose:** Rich text content — project briefs, notes, instructions, narrative context.

**User input:**
- Free-form text with formatting
- Supports Markdown-style syntax: `**bold**`, `*italic*`, `` `code` ``, `# ` `## ` `### ` for headings
- List styles: `• `, `→ `, `✅ `, `⚠️ `, `💬 `, `🔄 `, `⭐`
- Links: `[label](url)`
- HTML underline: `<u>text</u>`

**Configuration:**
- **borderless** — Toggle to hide card border/background (borderless mode)

**Visual appearance:**
- Borderless card with subtle top/bottom border (`border-y border-[var(--primary)]/35`)
- Transparent background
- Padding, rounded corners
- Formatting toolbar on focus: Bold, Italic, Underline, Highlight (yellow, green, blue, pink)

**Empty state:** Placeholder text "Click to add text…" in muted italic

**Behavior:** Inline editing; supports @mentions and entity references; can attach files

---

### 2.2 Task Block

**Purpose:** Task list within a tab. Tasks integrate with Calendar, Dashboard, and project overview.

**User input:**
- Task title and description
- Due date and optional due time
- Priority (urgent, high, medium, low, none)
- Assignee (user or team)
- Status (todo, in_progress, blocked, done)

**Configuration (block-level):**
- **Title** — Block title (e.g., "New Task List")
- **hideIcons** — Show/hide icons on tasks
- **showRollup** — Show/hide rollup summary
- **viewMode** — "list" or "board" (Kanban)
- **boardGroupBy** — When in board view: "status" or other grouping

**Visual appearance:**
- Bordered card with surface background
- List or board layout
- Task rows with checkbox, title, metadata badges (status, priority, assignee, due date)

**Empty state:** Empty list with prompt to add tasks

**Behavior:** Add, edit, delete, reorder tasks; drag-and-drop in board view; tasks sync to Calendar and Dashboard

---

### 2.3 Link Block

**Purpose:** External link with optional preview and caption.

**User input:**
- **URL** — Required; auto-prefixed with `https://` if missing
- **Title** — Optional display title (defaults to "Untitled Link")
- **Caption** — Optional text below the link

**Configuration:** None beyond URL, title, caption

**Visual appearance:**
- Card with link icon, title, and URL
- External link icon when URL is valid
- Hover: edit button appears
- Caption area below (click to add/edit)

**Empty state:** "Click to add URL" — opens edit mode

**Behavior:** Click to open in new tab; click edit to change URL/title; caption is debounced-saved

---

### 2.4 Divider Block

**Purpose:** Horizontal divider line to separate content.

**User input:** None

**Configuration:** None

**Visual appearance:** Single thin horizontal line (`h-px`), neutral color

**Behavior:** Not draggable; no hover actions; purely visual

---

### 2.5 Section Header Block

**Purpose:** Structural label to separate groups of blocks. Creates visual hierarchy.

**User input:**
- **Title** — Required; single line, large type
- **Subtitle** — Optional; up to 2 lines, smaller muted text

**Configuration:** None

**Visual appearance:**
- **Borderless** — No card border or background
- Thin horizontal line above
- Rounded container with subtle border, left accent rail (3px)
- Title: ~3xl font, normal weight
- Subtitle: small, muted, line-clamp-2

**Empty state:** "New Section" placeholder; "Add subtitle" when no subtitle

**Behavior:** Click title or subtitle to edit inline; saves on blur/Enter

---

### 2.6 Table Block

**Purpose:** Editable table with rows and columns. Full spreadsheet-like data entry.

**User input:**
- Rows and columns of cells
- Cell content (text, numbers, etc.)

**Configuration:**
- **heightPx** — Resizable height (240–1400px); drag handle at bottom

**Visual appearance:**
- Bordered card
- Table with resizable columns
- Resize handle (small pill) at bottom for height

**Empty state:** Empty table or loading state

**Behavior:** Add/remove rows and columns; edit cells; resize height via drag; has dedicated "Add block above/below" menu; can be made reusable (template)

---

### 2.7 Timeline Block

**Purpose:** Timeline of project milestones and events. Events sync to Calendar.

**User input (per event):**
- Title
- Start and end date/time
- Priority
- Assignee (user or team)
- Status
- Notes
- Progress (0–100)
- Optional: link to task, baseline dates

**Configuration (block-level):**
- **viewConfig** — startDate, endDate, zoomLevel (day/week/month/quarter/year), filters, groupBy

**Visual appearance:**
- Horizontal timeline with events as bars or milestones
- Zoom controls, date range
- Color-coded by priority or status

**Empty state:** Empty timeline with add-event prompt

**Behavior:** Add, edit, delete, drag events; zoom in/out; filter; events appear on Calendar

---

### 2.8 File Block

**Purpose:** Upload and manage multiple file attachments.

**User input:**
- Multiple files (upload or drag-and-drop)
- Per-file: display mode (grid/list), optional AI analysis

**Configuration:** None

**Visual appearance:**
- Bordered card
- File cards with icon by type (image, video, audio, PDF, document, archive, generic)
- File name, size, download, delete
- PDFs: inline viewer with page navigation, zoom
- Upload zone when empty

**Empty state:** Upload zone with drag-and-drop

**Behavior:** Upload, download, delete files; PDF viewer with zoom and page navigation; AI analysis for files; file comments

---

### 2.9 Video Block

**Purpose:** Upload and play MP4 videos inline.

**User input:**
- Single video file (upload or drag-and-drop)
- Max ~100MB recommended; 200MB+ suggests embedding instead

**Configuration:** None

**Visual appearance:**
- Video player with controls
- Thumbnail generated from first frame
- Download, delete options

**Empty state:** Upload zone

**Behavior:** Play, pause, seek; download; delete; thumbnail auto-generated

---

### 2.10 Image Block

**Purpose:** Single image with optional caption.

**User input:**
- Image file (upload, drag-and-drop, or paste)
- Caption (supports @mentions)
- **Width** — Resizable (drag handle); default 400px

**Configuration:**
- **fileId** — Reference to uploaded file
- **caption** — Optional caption
- **width** — Display width in pixels (resizable)

**Visual appearance:**
- Image with optional caption below
- Lightbox on click for full-size view
- Resize handle for width

**Empty state:** Upload zone

**Behavior:** Upload, resize width, edit caption, lightbox, delete

---

### 2.11 Gallery Block

**Purpose:** Grid of images with flexible layout. Ideal for creative assets, mood boards.

**User input:**
- Multiple images (upload per slot)
- Per-image: caption, fit mode, (collage) width and aspect ratio

**Configuration:**
- **layout** — "collage" or "array"
- **Collage:** Natural shapes, resizable items; free-form arrangement
- **Array:** Grid with configurable dimensions
- **arrayColumns** — 1–8 (default 2)
- **arrayRows** — 1–8 (default 2)
- **title** — Optional block title
- **hideEmptySlots** — Show/hide empty slots
- **captionsMode** — How captions are shown (always, on hover, etc.)
- **imageFitMode** — Cover, contain, etc.

**Visual appearance:**
- Collage: varied sizes, organic layout
- Array: uniform grid (e.g., 2×2, 3×4)
- Optional title above
- Add-slot buttons

**Empty state:** Empty slots with upload prompts

**Behavior:** Add/remove images; reorder; resize (collage); edit captions; fit mode; hide empty slots

**Add-block presets:** Collage, Array (2×2)

---

### 2.12 Embed Block

**Purpose:** Embed external content (YouTube, Figma, Google Docs/Sheets/Slides, Loom, Calendly, etc.).

**User input:**
- **URL** — Embed URL; auto-detects type
- **displayMode** — "inline" (iframe) or "linked" (link preview card)
- **caption** — Optional
- **heightPx** — Custom height for inline embed (240–1400px); resizable

**Supported embed types:** Figma, Google Docs, Google Sheets, Google Slides, YouTube, Loom, Calendly, generic

**Visual appearance:**
- **Inline:** iframe with content; resize handle at bottom
- **Linked:** Card with thumbnail, title, "Open" link

**Empty state:** URL input field

**Behavior:** Paste or type URL; auto-fetch metadata (title, thumbnail); toggle inline/linked; resize height (inline)

---

### 2.13 PDF Block

**Purpose:** Embed a single PDF for inline viewing.

**User input:**
- PDF file (upload or drag-and-drop)
- Max 50MB

**Configuration:** None

**Visual appearance:**
- PDF viewer with page navigation (prev/next)
- Zoom controls (50–200%)
- Download, delete

**Empty state:** Upload zone

**Behavior:** Upload, view, zoom, navigate pages, download, delete

**Note:** PDF block is not in the main Add Block menu; can be created via Convert Block or templates.

---

### 2.14 Chart Block

**Purpose:** Data visualization — bar, pie, doughnut, etc. Summarizes task or project data.

**User input:**
- Data source (tasks, etc.)
- Chart type: bar, pie, doughnut
- Configuration: breakdown field, measure, orientation, filters

**Configuration:**
- **chartType** — bar, pie, doughnut
- **title** — Chart title
- **code** / spec — Chart specification (can be AI-generated)
- Filters, breakdown, measure, orientation

**Visual appearance:**
- Chart with title
- Config panel (double-click or customize)
- Refresh, lock, save as snapshot

**Empty state:** Empty chart with configure prompt

**Behavior:** Double-click to customize; refresh data; lock; save snapshot; AI can generate charts

**Note:** Chart block is not in the main Add Block menu; can be created via Convert Block, AI, or templates.

---

### 2.15 Section Block

**Purpose:** Scrollable container that groups child blocks. Creates nested structure.

**User input:**
- **Title** — Section title
- **Description** — Optional
- **height** — Resizable height (pixels)
- **Child blocks** — Any block types, added via Add Block inside section

**Configuration:**
- **height** — Scrollable height; resize handle at bottom
- **title**, **description**

**Visual appearance:**
- Bordered card with title/description
- Scrollable area for child blocks
- Add Block button inside
- Resize handle at bottom

**Empty state:** Empty scroll area with Add Block

**Behavior:** Add child blocks; resize height; child blocks have same capabilities as top-level blocks

---

### 2.16 Document Reference Block

**Purpose:** Link to an existing Trak document. Opens in sidebar or navigates to doc.

**User input:**
- Document selection (picker dialog)
- No inline editing of doc content

**Configuration:**
- **doc_id**, **doc_title** — Set via document picker

**Visual appearance:**
- Card with document icon
- Document title
- "Click to view in sidebar" or similar

**Empty state:** N/A — created via document picker

**Behavior:** Click to open document in sidebar or navigate; delete to remove reference

---

### 2.17 Shopify Product Block

**Purpose:** Embed a Shopify product with analytics (e.g., units sold).

**User input:**
- Product selection from connected Shopify store(s)
- Product picker opened via block menu "Change product"

**Configuration:**
- **product_id** — Selected product ID

**Visual appearance:**
- Product card: image, title, vendor, type, status badge
- Price range
- Variants count
- Units sold widget (if available)
- Expandable details

**Empty state:** "Select product" or similar

**Behavior:** Pick product from workspace products; refresh data; change product via menu

---

### 2.18 Cards Block

**Purpose:** Visual asset cards with structured metadata. For creative reviews, asset tracking.

**User input (per card):**
- Title
- Notes
- Asset (image/video/file)
- Status, priority, assignee, due date, tags (via properties)

**Configuration:**
- **title** — Block title
- **viewMode** — "grid" or "list"
- **heightPx** — Resizable height for list view

**Card dimensions:**
- **width:** "half" (50%) or "full" (100%)
- **height:** "compact" or "tall"

**Visual appearance:**
- Grid or list of cards
- Each card: image/asset, title, metadata badges
- Slide show for multiple assets per card

**Empty state:** Empty grid/list with add card prompt

**Behavior:** Add, edit, delete cards; upload assets; properties (status, priority, assignee, due date, tags); comments; grid/list toggle; resize height (list)

**Add-block presets:** Single card, Array (2×2), Array (2×3)

---

### 2.19 Reference Block

**Purpose:** Link to a reusable block (template). Renders the referenced block's content.

**User input:**
- Block selection via Reference Block picker
- References a block from the workspace (can be a template block)

**Configuration:**
- **original_block_id** — ID of referenced block

**Visual appearance:** Same as the referenced block type

**Behavior:** Displays referenced block; updates when source updates; can be used to reuse common blocks across tabs/projects

---

## 3. Block Arrangement and Layout

### 3.1 Row and Column Model

- Blocks are organized into **rows**
- Each block has **position** (row index) and **column** (0, 1, or 2)
- **Single block per row:** Full width
- **Two blocks per row:** 50/50 split on md+ screens
- **Three blocks per row:** 33/33/33 split on xl screens
- **Maximum 3 blocks per row**
- Rows stack vertically with `space-y-5` (20px)
- Columns have `gap-6 md:gap-8` (24–32px)

### 3.2 Special Layout Rules

- **Cards block with 1 card:** Treated as half-width (can sit next to another block)
- **Cards block with 2+ cards:** Full width
- **Section header:** Has negative bottom margin (`-mb-3`) for tighter grouping with following content

### 3.3 Adding Blocks

**Primary method:** "Add" button (or "Add block") — opens dropdown with all block types

**Block types in Add menu:**
- Text, Tasks, Link, Divider, Section Header, Table, Timeline, File, Video, Image, Embed, Section, Document, Shopify product
- Reference Block (links to reusable block)
- Cards (submenu: Single card, 2×2, 2×3)
- Gallery (submenu: Collage, Array)

**Secondary methods:**
- Click empty canvas → creates text block
- Block menu → "Add block above" / "Add block below" (with type submenu)
- Convert block → change block type (limited types in convert menu)

**Blocks not in Add menu:** Chart, PDF — available via Convert Block, AI, or templates

### 3.4 Reordering and Moving Blocks

**Drag and drop:**
- Drag handle (grip icon) on left of block — appears on hover
- **Drop modes:**
  - **Inline:** Drop into same row (if row has &lt; 3 blocks) or into target row
  - **Row above:** Drag to top edge of block → creates new row above
  - **Row below:** Drag to bottom edge of block → creates new row below
- Ghost preview shows where block will land
- Divider blocks are not draggable

### 3.5 Removing Blocks

- Block menu → Delete
- Undo available for delete (Undo button or ⌘Z)

### 3.6 Block Conversion

- Block menu → Convert block
- Converts to: Text, Task list, Link, Section Header, Table, Timeline, File, Video, Image, Embed, Section, Gallery (Collage/Array), Cards (presets)
- Chart, PDF, Document, Shopify Product not in convert menu

### 3.7 Constraints

- Max 3 columns per row
- Blocks cannot be placed inside arbitrary blocks except Section (which has child blocks)
- Divider cannot be dragged
- Locked blocks cannot be dragged or edited

---

## 4. Visual and Aesthetic Details

### 4.1 Block Card Styling

**Standard blocks (with border):**
- Border: `border-[var(--border)]`
- Background: `bg-[var(--surface)]`
- Padding: `px-3 py-2.5`
- Shadow: `shadow-[0_1px_2px_rgba(0,0,0,0.02)]`
- Hover: `hover:border-[var(--primary)]/20`
- Rounded: `rounded-[var(--radius-sm)]`

**Borderless blocks:**
- Section Header: no border, no background, no shadow
- Text block: `border-y border-[var(--primary)]/35`, transparent background
- Any block with `content.borderless: true`

### 4.2 Block Actions (Hover)

When not read-only, each block shows on hover:
- **Left:** Drag handle (grip icon)
- **Right:** Lock/Unlock, AI context, Comments, Attach reference, More menu (or table-specific menu)

### 4.3 Typography

- **Section header title:** ~3xl, normal weight, tight tracking
- **Section header subtitle:** sm, muted
- **Block titles:** sm–base, medium–semibold
- **Body text:** sm, relaxed leading
- **Captions/labels:** xs–11px, muted

### 4.4 Spacing

- Row gap: 20px (`space-y-5`)
- Column gap: 24px (gap-6), 32px on md+ (gap-8)
- Block internal padding: ~10–12px (py-2.5, px-3)
- Canvas padding: pl-2, pr-12, pt-2, pb-6

### 4.5 Visual Hierarchy

- Section headers create major breaks
- Dividers create subtle breaks
- Reusable blocks show green "REUSABLE" badge
- Locked blocks show amber lock indicator
- Comments show count badge when present

### 4.6 Responsive Behavior

- Multi-column rows collapse to single column on small screens
- Tab bar collapses to dropdown on mobile
- Table of contents hidden on smaller screens
- Sticky/floating tab bar on scroll

### 4.7 Themes

- Tabs can have themes affecting container background
- Theme persisted per tab in localStorage

### 4.8 Empty States

- Empty canvas: "Click to start typing", Add button
- Empty blocks: Type-specific prompts (e.g., "Click to add URL", "Upload asset", "Add caption")
- Loading: Spinner or skeleton

---

## 5. Block-Level Features (Cross-Cutting)

### 5.1 Comments

- Any block can have comments
- Comment count badge on block
- Threaded replies
- @mentions for references
- Internal vs client comments distinguished

### 5.2 Properties

- Blocks can have properties: status, priority, assignees, due date, tags
- Property badges shown below block content
- Property menu for editing

### 5.3 Lock

- Blocks can be locked to prevent edits
- Locked blocks: no drag, no edit, amber lock icon

### 5.4 Make Reusable

- Non-template, non-reference blocks can be "Made Reusable"
- Creates a template that can be referenced via Reference Block

### 5.5 AI Context

- Blocks can be selected as AI context
- Sparkles icon indicates selection
- Used for AI-assisted editing and generation

### 5.6 References

- Blocks can attach references to tasks, blocks, docs, etc.
- Reference picker via @ button
- Block References panel shows attached refs

---

## 6. Summary: Block Type Quick Reference

| Block Type        | Add Menu | Convert | Resizable | Borderless | Nested |
|-------------------|----------|---------|-----------|------------|--------|
| Text              | ✓        | ✓       | —         | Special    | —      |
| Task              | ✓        | ✓       | —         | —          | —      |
| Link              | ✓        | ✓       | —         | —          | —      |
| Divider           | ✓        | —       | —         | —          | —      |
| Section Header    | ✓        | ✓       | —         | ✓          | —      |
| Table             | ✓        | ✓       | Height    | —          | —      |
| Timeline          | ✓        | ✓       | —         | —          | —      |
| File              | ✓        | ✓       | —         | —          | —      |
| Video             | ✓        | ✓       | —         | —          | —      |
| Image             | ✓        | ✓       | Width     | —          | —      |
| Gallery           | ✓        | ✓       | —         | —          | —      |
| Embed             | ✓        | ✓       | Height    | —          | —      |
| PDF               | —        | —       | —         | —          | —      |
| Chart             | —        | —       | —         | —          | —      |
| Section           | ✓        | ✓       | Height    | —          | ✓      |
| Document          | ✓        | —       | —         | —          | —      |
| Shopify Product   | ✓        | —       | —         | —          | —      |
| Cards             | ✓        | ✓       | Height    | —          | —      |
| Reference Block   | ✓        | —       | —         | Varies     | —      |

---

*This document reflects the Trak product as of the codebase snapshot. Use it to design templates that leverage every block type, layout option, and configuration available.*
