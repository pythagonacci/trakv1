# UI-only Interactions (Client-only Behavior)

This list captures UI behaviors that are handled entirely on the client (component state, local rendering, local sorting/filtering, opening dialogs/menus, toggling views) and do **not** directly call server actions or API routes. Where helpful, the likely component file is noted.

## Global UI & Navigation
- Open/close command UI, menus, and dropdowns (various `trak/src/components/ui/*`).
- Switch dashboard sections via client navigation tabs (e.g., `trak/src/app/dashboard/layout.tsx`, `trak/src/app/dashboard/layout-client.tsx`).
- Toggle theme/context UI state (e.g., `trak/src/app/dashboard/theme-context.tsx`, `trak/src/app/dashboard/header-visibility-context.tsx`).
- Client-side loading states and skeletons (e.g., `trak/src/app/dashboard/loading.tsx`).
- Expand/collapse panels and accordions in dashboard layouts.

## Projects & Tabs (UI State)
- Open/close project dialogs, confirmation dialogs, and empty states (e.g., `trak/src/app/dashboard/projects/project-dialog.tsx`, `trak/src/app/dashboard/projects/confirm-dialog.tsx`).
- Toggle project view modes (grid/table) (`trak/src/app/dashboard/projects/projects-view-toggle.tsx`).
- Filter and search UI controls without server call (client-side filtering panels, toggles) (`trak/src/app/dashboard/projects/filter-bar.tsx`).
- Tab bar navigation and subtab expansion/collapse (`trak/src/app/dashboard/projects/[projectId]/tab-bar.tsx`, `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/subtab-sidebar.tsx`).
- Toggle visibility of header sections in project pages (`trak/src/app/dashboard/projects/[projectId]/project-header.tsx`).

## Blocks & Canvas UI
- Open block add menus, pick block types, and close menus (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/add-block-button.tsx`).
- Client-only hover/selection state for blocks and inline menus (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx`).
- Expand/collapse section blocks and inline UI controls (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/section-block.tsx`).
- Switch between block variants (gallery, image, video, link) UI states (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/*-block.tsx`).
- Open attachment dialogs (UI state before upload) (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/file-attachment-dialog.tsx`).
- Inline file preview toggles and PDF viewer UI state (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/inline-file-preview.tsx`, `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/pdf-block.tsx`).
- Open/close block comment panels (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-comments.tsx`).

## Tables (UI State)
- Switch table view types (table/board/timeline) (`trak/src/components/tables/table-view.tsx`, `trak/src/components/tables/board-view.tsx`, `trak/src/components/tables/table-timeline-view.tsx`).
- Open/close table toolbar menus and contextual actions (`trak/src/components/tables/table-toolbar.tsx`, `trak/src/components/tables/table-context-menu.tsx`).
- Select/deselect rows, range selection, and bulk selection UI (`trak/src/components/tables/table-row.tsx`, `trak/src/components/tables/bulk-actions-toolbar.tsx`).
- Expand/collapse grouped rows and group headers (`trak/src/components/tables/group-header.tsx`).
- Open/close bulk delete dialog UI state (`trak/src/components/tables/bulk-delete-dialog.tsx`).
- Column resize/drag handles and layout changes (UI-only before save) (`trak/src/components/tables/table-header-row.tsx`, `trak/src/components/tables/table-header.tsx`).
- Open/close column detail panels and configuration modals (`trak/src/components/tables/column-detail-panel.tsx`, `trak/src/components/tables/formula-config-modal.tsx`, `trak/src/components/tables/relation-config-modal.tsx`, `trak/src/components/tables/rollup-config-modal.tsx`).
- Inline cell edit focus/blur state (text, number, select, checkbox, date, person, etc.) (`trak/src/components/tables/cells/*`).
- Local row sorting, grouping, and filtering UI state before server fetch (`trak/src/components/tables/table-header-compact.tsx`, `trak/src/components/tables/table-footer-row.tsx`).
- Open/close table import modal UI state (`trak/src/components/tables/table-import-modal.tsx`).

## Docs (UI State)
- Rich text editor formatting (bold/italic/lists/links) and selection state (`trak/src/components/editor/rich-text-editor.tsx`).
- Document grid/table view toggles (`trak/src/app/dashboard/docs/docs-view-toggle.tsx`).
- Docs filter/search UI state (`trak/src/app/dashboard/docs/docs-filter-bar.tsx`).
- Doc sidebar open/close (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/doc-sidebar.tsx`).

## Timelines (UI State)
- Timeline view navigation and UI toggles (`trak/src/components/timelines/timeline-view.tsx`).
- Reference picker open/close state (`trak/src/components/timelines/reference-picker.tsx`).
- Drag/resize UI state for timeline events (local preview before save) (`trak/src/lib/hooks/use-timeline-drag.ts`).
- Dependency/relationship UI highlighting and hover state (`trak/src/lib/hooks/use-timeline-dependencies.ts`).

## Calendar (UI State)
- Calendar day selection and navigation (`trak/src/app/dashboard/calendar/calendar-view.tsx`).
- Open/close event popup cards and add-event dialogs (`trak/src/app/dashboard/calendar/event-popup-card.tsx`, `trak/src/app/dashboard/calendar/add-event-dialog.tsx`).
- Day detail panel toggle (`trak/src/app/dashboard/calendar/day-details-panel.tsx`).

## Comments (UI State)
- Open/close row comment threads and inline comment input focus (`trak/src/components/tables/comments/*`).
- Client page comment display toggles (`trak/src/app/client/[publicToken]/client-block-comments.tsx`).

## Client Page (Public) UI
- Client page tab bar navigation (`trak/src/app/client/[publicToken]/client-page-tab-bar.tsx`).
- Client page banner interactions (dismiss/expand UI) (`trak/src/app/client/[publicToken]/client-page-banner.tsx`).
- Client page doc viewer open/close state (`trak/src/app/client/[publicToken]/client-doc-viewer.tsx`).
- Auto-refresh display indicators (`trak/src/app/client/[publicToken]/auto-refresh.tsx`).

## Uploads & Files (UI State)
- Drag-and-drop UI state for upload zones (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/file-upload-zone.tsx`).
- File selection UI state and preview lists (`trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/attached-files-list.tsx`).

## Misc UI
- Toast visibility and client-only notifications (`trak/src/app/dashboard/projects/toast.tsx`).
- Internal pages view toggles and filters (`trak/src/app/dashboard/internal/internal-view-toggle.tsx`, `trak/src/app/dashboard/internal/internal-filter-bar.tsx`).
- Mock pages and demo UI interactions (`trak/src/app/mock/*`).

If you want this list tied 1:1 to **specific event handlers** (e.g., `onClick`, `onChange`) with exact component/line references, tell me and I’ll produce a fully annotated version.
