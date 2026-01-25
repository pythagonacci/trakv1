# Trak — Claude Code Reference

We are building Trak. Trak is a project management software. A high level overview is that once you sign in, you have a workspace. Within a workspace, you can have multiple projects. Within a project, you can add tabs. Within each tab, you can add blocks. We have text blocks, file upload, embed, image gallery, image, section (a group of blocks), timeline, task block, table, link and video. We have entity properties, which are universal properties that can be applied to any block. They are assignee, due-date, priority, status, and then custom tags. One important thing we are optimizing for is prompt to action AI, which allows an AI to execute and complete actions from a natural language command from the user. It can also ask questions about the workspace. 

## Quick commands (run from repo root)
- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — start production server (`PORT` optional)
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run test:prod` — build + start (smoke test)
- `npm run build:analyze` — bundle analyzer (`ANALYZE=true`)

## Project structure (mental map)
- `src/app` — App Router routes + layouts
  - `actions/` — server actions (Supabase access + auth)
  - `api/` — API routes (public endpoints, utilities)
  - `dashboard/` — authenticated app UI
  - `client/` — public client pages (token-based)
  - `login/`, `signup/`, `auth/` — auth routes
- `src/components` — shared UI + domain components
  - `ui/` (Radix/shadcn-style primitives), `editor/`, `tables/`, `timelines/`, `properties/`
- `src/lib` — core utilities
  - `supabase/` (server/client/service clients)
  - `auth-utils.ts`, `auth/`, `react-query/`, `logger.ts`, `utils.ts`
  - `lib/hooks/` — React Query feature hooks (tasks/tables/timelines/properties)
- `src/hooks` — small client hooks (`useUser`, `useWorkspaces`)
- `supabase/` — `schema.sql` + `migrations/`
- `scripts/` — data migrations/seed helpers

## Tech stack
- Next.js **16** (App Router), React **19**, TypeScript **strict**
- Supabase SSR (`@supabase/ssr`) + `@supabase/supabase-js`
- React Query v5 (global defaults in `src/lib/react-query/query-client.ts`)
- Tailwind CSS v4, Radix UI, dnd-kit, TipTap, lucide icons

## Core patterns (do this every time)
### Server Actions (writes + secure reads)
- Always add `'use server'` at top.
- Use `createClient()` from `@/lib/supabase/server`.
- **Auth first**, then data: `getServerUser()` or `auth-utils` (`requireWorkspaceAccess`, `requireTaskBlockAccess`, etc.).
- Return `{ data } | { error }` (ActionResult pattern). Keep error messages user-safe.

### Server Components
- For user-specific pages: `export const dynamic = "force-dynamic";`
- `params` and `searchParams` are awaited (project already uses `Promise<...>` typing).
- Pull workspace from cookie via `getCurrentWorkspaceId()` and verify access before querying.

### Client data (React Query)
- Use `queryKeys` from `src/lib/react-query/query-client.ts`.
- Prefer existing hooks in `src/lib/hooks/*` — extend them instead of new ad‑hoc queries.
- Optimistic updates use `onMutate` + rollback (see `use-table-queries.ts`, `use-property-queries.ts`).

### Blocks
- Block type union lives in **two places**:
  - `src/app/actions/block.ts` (`BlockType`)
  - `src/app/actions/client-tab-block.ts` (`ClientTabBlockType`)
- Renderer mapping is in `src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-renderer.tsx`.
- Default content lives in `add-block-button.tsx`, `tab-canvas.tsx`, and `section-block.tsx` (+ client equivalents).
- `content` is JSONB and varies by block type — keep shapes consistent.

#### Blocks — how the system actually works
- **Storage**: `blocks` table is the source of truth for project tabs. Each row is a block with JSONB `content`.
- **Placement**: `position` is an integer row index; `column` is 0–2 for multi‑column rows. `parent_block_id` nests blocks inside a **section**.
- **Templates & references**:
  - `is_template=true` marks a reusable block.
  - `original_block_id` turns a block into a **reference** (renderer uses `BlockReferenceRenderer`).
- **Related tables**:
  - **Tasks**: task blocks store list metadata in `blocks.content`, but actual items live in `task_items` (linked by `task_block_id`).
  - **Tables**: table blocks reference a `tables` row (table rows in `table_rows`, fields in `table_fields`).
  - **Timelines**: timeline blocks reference `timeline_events` / `timeline_dependencies`.
  - **Files**: file/image/video/pdf/gallery blocks reference `files` via `file_attachments` or `content.fileId`.
- **Client pages**: client-facing blocks live in **separate tables** (`client_tabs`, `client_tab_blocks`) and have their own type union + renderer.

#### Canonical block content shapes (server-created defaults)
```ts
// text
{ text: "" }
// task
{ title: "New Task List", hideIcons: false, viewMode: "list", boardGroupBy: "status" }
// link
{ title: null, url: null, caption: "" }
// table (server fills in tableId)
{ }
// timeline
{
  viewConfig: {
    startDate: ISOString,
    endDate: ISOString,
    zoomLevel: "day",
    filters: {},
    groupBy: "none",
  },
}
// file / video
{ files: [] }
// image
{ fileId: null, caption: "", width: 400 }
// gallery
{ layout: null, items: [] }
// embed
{ url: "", displayMode: "inline" }
// section
{ height: 400 }
// doc_reference
{ doc_id: "", doc_title: "" }
```

## “Do this, not that” rules (Trak-specific)
- ✅ Use `@/lib/supabase/server` / `client` / `service` helpers. ❌ Don’t instantiate Supabase clients ad‑hoc.
- ✅ Check membership **before** reading workspace data. ❌ Don’t query then check.
- ✅ Use React Query invalidation (or local state updates) for client UIs. ❌ Don’t spam `router.refresh()`.
- ✅ Normalize Supabase relationship selects that sometimes return arrays (see `TabPage`).
- ✅ Keep block positions as integer row indexes and columns in `[0..2]`.
- ✅ Use `task_items.status` values (`"todo" | "in-progress" | "done"`). ❌ Don’t mix with properties’ `"in_progress"`.

## Canonical snippets
### 1) Create a new page (App Router)
```tsx
// src/app/dashboard/example/page.tsx
import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { requireWorkspaceAccess } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function ExamplePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) redirect("/login");

  // ...fetch data with Supabase
  return <div>Project {projectId}</div>;
}
```

### 2) Add a Server Action (pattern)
```ts
// src/app/actions/projects.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth-utils";

type ActionResult<T> = { data: T } | { error: string };

export async function createProject(input: {
  workspaceId: string;
  name: string;
}): Promise<ActionResult<{ id: string }>> {
  const access = await requireWorkspaceAccess(input.workspaceId);
  if ("error" in access) return { error: access.error ?? "Unauthorized" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ workspace_id: input.workspaceId, name: input.name })
    .select("id")
    .single();

  if (error || !data) return { error: "Failed to create project" };
  return { data };
}
```

### 3) Supabase query with relations (server)
```ts
const { data, error } = await supabase
  .from("tabs")
  .select("id, name, project_id, projects!inner(workspace_id)")
  .eq("id", tabId)
  .single();

// Supabase can return arrays for relations — normalize:
const workspaceId = Array.isArray(data?.projects)
  ? data.projects[0]?.workspace_id
  : (data?.projects as any)?.workspace_id;
```

### 4) React Query optimistic update (example)
```ts
export function useSetEntityProperties(entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates) => setEntityProperties({ entity_type: entityType, entity_id: entityId, updates }),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: queryKeys.entityProperties(entityType, entityId) });
      const previous = qc.getQueryData(queryKeys.entityProperties(entityType, entityId));
      if (previous) qc.setQueryData(queryKeys.entityProperties(entityType, entityId), { ...previous, ...updates });
      return { previous };
    },
    onError: (_err, _updates, ctx) => ctx?.previous && qc.setQueryData(queryKeys.entityProperties(entityType, entityId), ctx.previous),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.entityProperties(entityType, entityId) }),
  });
}
```

### 5) Add a new block type (checklist)
- **DB**: add to `public.block_type` enum in a Supabase migration.
- **Types**: update `BlockType` in `src/app/actions/block.ts` **and** `ClientTabBlockType` in `src/app/actions/client-tab-block.ts`.
- **UI**: add renderer entry in `block-renderer.tsx` + create a component.
- **Default content**: update `add-block-button.tsx`, `tab-canvas.tsx`, `section-block.tsx` (+ client equivalents).
- **Client pages**: update `client-add-block-button.tsx` + `client-tab-block-renderer.tsx`.

## Database schema overview (key relationships)
- **workspaces** → **workspace_members** (roles) → `auth.users`
  - `profiles` mirrors user identity (id/email/name)
  - `workspace_invitations` for invites
- **clients** → **projects** → **tabs** → **blocks**
  - `blocks.parent_block_id` enables nested blocks (sections)
  - `block_highlights` stores highlight metadata
- **client pages**
  - `client_tabs` → `client_tab_blocks` (client-facing layout)
  - `client_page_views` (+ `client_page_analytics_summary` view)
  - `tab_shares` for sharing tabs
- **docs** (workspace documents)
- **tables** → **table_fields** → **table_rows**
  - Plus `table_views`, `table_relations`, `table_comments`, `table_rollups`
- **tasks**
  - `task_items` (linked to `blocks`, `projects`, `tabs`)
  - `task_assignees`, `task_tags`, `task_tag_links`, `task_comments`, `task_subtasks`, `task_references`
- **timelines**
  - `timeline_events`, `timeline_dependencies`, `timeline_references`
- **properties & links**
  - `property_definitions`, `entity_properties` (JSONB values)
  - legacy: `entity_properties_legacy`
  - `entity_links`, `entity_inherited_display`
- **files** + **file_attachments** (file blocks attach here)
- **payments** + **payment_events** (Stripe-linked workflow)
- **comments** (generic comment targets via `comments.target_type/target_id`)

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for public client page file access)
- `ANALYZE=true` (optional for `build:analyze`)
- `PORT` (optional for `npm run start`)

## Common pitfalls (and how to avoid them)
- **Workspace is null**: `getCurrentWorkspaceId()` can return `null` — redirect or show empty state.
- **Supabase relation arrays**: normalize joins that sometimes return arrays (`projects!inner`, `clients`, etc.).
- **Status enums**: tasks use `in-progress` (dash), properties use `in_progress` (underscore).
- **Block content shape**: every block renderer assumes specific JSON keys; keep defaults in sync.
- **Over-refreshing**: prefer local state updates + React Query invalidation over `router.refresh()`.

## Performance considerations already in place
- **DB indexes** on hot paths (workspace/project/tab lookups, block ordering, task filters).
- **GIN indexes** on JSONB columns (`blocks.content`, `table_rows.data`, `entity_properties.value`).
- **Query limits** (e.g., `BLOCKS_PER_TAB_LIMIT = 500`).
- **Dynamic imports** for heavy block components (table/timeline/task/file media).
- **React Query caching** with 5‑min stale time and 10‑min GC time.
- **Prefetch file URLs** in server components (batch fetch once per page).
- **Next config optimizations**: `optimizePackageImports`, compressed output, and image remote patterns for Supabase.

