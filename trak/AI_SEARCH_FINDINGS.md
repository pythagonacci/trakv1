# Trak AI Search Findings (Session Summary)

## Purpose
This document summarizes answers to architectural questions asked during the AI search action design session. It references existing code and schema to ensure new Server Actions match current patterns.

## 1) Task Search Scope
- **Canonical data source**: `task_items` is the source of truth for task status, priority, due dates, etc.
- **Assignees**: stored in `task_assignees` (not in `blocks.content`).
- **Relationship**: `task_items.task_block_id` → `blocks.id` (tasks belong to a task block).
- **Conclusion**: For “tasks assigned to John,” query `task_items` joined to `task_assignees`. Join to `blocks/tabs/projects` only for context (project/tab location).

## 2) Workspace Context / Membership Check
- **Preferred helpers**: use cached auth helpers in `trak/src/lib/auth-utils.ts`.
  - `getAuthenticatedUser(): Promise<User | null>`
  - `checkWorkspaceMembership(workspaceId: string, userId: string): Promise<{ role: string } | null>`
  - `getTabMetadata(tabId: string): Promise<{ id; project_id; projects: { workspace_id } } | null>`
- **Cleanest approach**:
  - If you start from `task_items`, use `task_items.workspace_id` directly.
  - If you start from blocks, join `blocks → tabs → projects` to get workspace_id (matches RLS policy).

## 3) Auth Pattern in Server Actions
- **Typical flow**:
  - `const user = await getAuthenticatedUser(); if (!user) return { error: 'Unauthorized' }`
  - `const membership = await checkWorkspaceMembership(workspaceId, user.id); if (!membership) return { error: 'Not a member of this workspace' }`
- **Example**:
  - `trak/src/app/actions/client-tab.ts`
  - `trak/src/app/actions/block.ts`

## 4) Search Input Pattern
- **Existing pattern**: derive workspace from auth context via cookie.
  - `searchWorkspaceContent` uses `getCurrentWorkspaceId()` and `getAuthenticatedUser()`.
  - File: `trak/src/app/actions/search.ts`
- **Recommendation for new search actions**: follow the same pattern unless the API is explicitly admin‑scoped.

## 5) Table Cell Search Scope
- There are **two table systems**:
  1) **Legacy block tables** stored in `blocks.content` (JSONB). Used by `table-block.tsx`.
  2) **New schema tables** in `tables`, `table_rows`, `table_fields` with row data in `table_rows.data` (JSONB).
- **Conclusion**: search both if you want complete coverage (“bold all cells that say Italy”).

## 6) Blocks Table Schema (from `trak/supabase/schema.sql`)
- Columns: `id`, `tab_id`, `parent_block_id`, `type`, `content` (JSONB), `position`, `column`, `created_at`, `updated_at`, `is_template`, `template_name`, `original_block_id`.
- **No** `created_by` / `updated_by` on blocks.
- Index: `idx_blocks_gin_content` (GIN on `content`).
- RLS: `sel_blocks` policy requires membership via tabs → projects → workspace.

## 7) Task Tables (from `trak/supabase/schema.sql`)
- `task_items`: main task data (status, priority, due_date, etc.).
- `task_assignees`: task assignments (`task_id`, `assignee_id`, `assignee_name`).
- `task_tags`, `task_tag_links`: task tagging system.
- RLS policies exist for all task tables keyed by workspace membership.

## 8) Search Capabilities
- **No full‑text search (tsvector)** found in schema.
- JSONB GIN indexes exist:
  - `blocks.content` (idx_blocks_gin_content)
  - `table_rows.data` (idx_table_rows_data_gin)
- Current search implementation uses `ilike` + in‑memory parsing for docs (see `searchWorkspaceContent`).

## 9) Standalone Tasks vs Task Items
- **standalone_tasks**: workspace‑level tasks (not tied to blocks), used in `/dashboard/tasks`.
- **task_items**: tied to task blocks inside tabs.
- **Conclusion**: AI search should include both if it promises “all tasks.”

## 10) RLS Behavior
- With standard supabase client, RLS filters results by membership automatically.
- Existing actions still add `workspace_id` filters for performance and clarity (e.g., `searchWorkspaceContent`).

## 11) Full `searchWorkspaceContent` Reference
- Full implementation is in `trak/src/app/actions/search.ts` (uses `getCurrentWorkspaceId` + `getAuthenticatedUser`, and searches projects, docs, tasks, text blocks, tabs).

## 12) getCurrentWorkspaceId Reference
- Defined in `trak/src/app/actions/workspace.ts`:
  - Reads cookie `trak_current_workspace` and returns `string | null`.

## 13) Example Block Workspace Join
```ts
const { data: blocks } = await supabase
  .from('blocks')
  .select('id, type, content, tab:tabs!inner(id, project_id, projects!inner(workspace_id))')
  .eq('tabs.projects.workspace_id', workspaceId);
```

## 14) Table Row Data Shape (JSONB)
- `table_rows.data` is keyed by **table_field.id**.
- Example:
```json
{
  "field-id-1": "Italy",
  "field-id-2": 123,
  "field-id-3": "2025-01-15",
  "relation-field-id": ["row-id-1", "row-id-2"]
}
```

## Key File Paths
- Search action: `trak/src/app/actions/search.ts`
- Workspace helper: `trak/src/app/actions/workspace.ts`
- Auth helpers: `trak/src/lib/auth-utils.ts`
- Task actions: `trak/src/app/actions/tasks/*`
- Table actions: `trak/src/app/actions/tables/*`
- Schema dump: `trak/supabase/schema.sql`
