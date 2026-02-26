h# Trak — Performance Audit V2
> Branch: `sdpropogation` · Audited: 2026-02-23
> Scope: Net-new findings beyond PERF_AUDIT.md — payload forensics, render churn, cache pathology, auth overhead, interaction micro-latency
> Method: Direct code reads across 30+ files + grep/ripgrep analysis of 130 `select("*")` calls, 98 `router.refresh()` occurrences, 56 `revalidatePath` calls

---

## Table of Contents
1. [New Findings](#1-new-findings-net-new-issues)
2. [RSC + Payload Forensics](#2-rsc--payload-forensics)
3. [React Render Churn Hunt](#3-react-render-churn-hunt)
4. [React Query / Caching Pathology Hunt](#4-react-query--caching-pathology-hunt)
5. [Auth/RLS/Permissions Cost](#5-authrls-permissions-cost-prove-it-with-explain)
6. [Instant Feel Interaction Latency](#6-instant-feel-interaction-latency-breakdown)
7. [Additional High-ROI Fix Candidates](#7-additional-high-roi-fix-candidates-pr-ideas)
8. [Top 7 Additional Issues Found in V2](#top-7-additional-issues-found-in-v2)

---

## 1. New Findings (net-new issues)

Issues below were **not explicitly covered** in V1 or reveal a new cost dimension.

---

### F1 — `getChildBlocks` uses non-cached `workspace_members` query + `select("*")` (CRITICAL — double-auth + overfetch)

**Symptom:** Section blocks (which call `getChildBlocks` on mount via `LazyBlockWrapper`) are slower than equivalent top-level blocks. Every section block opening fetches all child block columns including full `content` JSONB.

**Root cause:** `getChildBlocks` ([block.ts:100–155](trak/src/app/actions/block.ts#L100)) performs:
1. `getAuthenticatedUser()` (cached ✓)
2. `blocks.select("id, tab_id, tabs!inner(id, project_id, projects!inner(workspace_id))")` — joined query (good)
3. **Raw `workspace_members.select("role")` inline query (lines 128–133) — NOT using cached `checkWorkspaceMembership()`**
4. `blocks.select("*")` — **full wildcard select** on child blocks (line 142)

Compared to `getTabBlocks`, which uses the cached `checkWorkspaceMembership()` helper and a scoped column projection, `getChildBlocks` does an uncached membership lookup and fetches every column. A tab with 5 section blocks fires 5 uncached `workspace_members` lookups in parallel.

**Evidence to gather:**
```typescript
// Add to getChildBlocks before line 128:
const t0 = performance.now();
const { data: membership } = await supabase.from("workspace_members")...
console.log(`[PERF] getChildBlocks membership ms=${Math.round(performance.now()-t0)}`);
```

**Code location:** [block.ts:128–143](trak/src/app/actions/block.ts#L128)

**Fix direction:** Replace the inline `workspace_members` query with `await checkWorkspaceMembership(workspaceId, userId)` (the cached version). Replace `.select("*")` with the same explicit projection used in `getTabBlocks` (line 77).

---

### F2 — `file_attachments` query is SERIAL after the parallel block fetch (CRITICAL for file-heavy tabs)

**Symptom:** Tabs containing `file` blocks have a higher TTFB than tabs without them, even when the files themselves load quickly. The delay scales with the number of file blocks.

**Root cause:** In [page.tsx:136–152](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx#L136), after `Promise.allSettled([...blocks...])` completes:
```typescript
// SERIAL — runs after the parallel allSettled block
const fileBlockIds = blocks.filter(b => b.type === 'file').map(b => b.id);
if (fileBlockIds.length > 0) {
  const { data: fileAttachments } = await supabase
    .from('file_attachments')
    .select('file:files(id)')
    .in('block_id', fileBlockIds);
}
// THEN serial getBatchFileUrls
const fileUrlsResult = fileIds.length > 0 ? await getBatchFileUrls(fileIds) : { data: {} };
```

This creates a **3-step serial chain** after the initial parallel fetch: `allSettled` → `file_attachments query` → `getBatchFileUrls`. Each step waits for the previous. For a tab with 5 file blocks and 15 image files, this is ~3 sequential round trips on the critical HTML path before any bytes stream to the browser.

The `file_attachments` query result is only used to extract file IDs. This information could be embedded in `getTabBlocks` response without a separate query (blocks that are `file` type already have attachment metadata via the `content` field or could include it).

**Evidence to gather:** Add `[PERF]` timers around each serial step (line 138, line 155). Look for the `file_attachments` query adding 20–80ms serially after the parallel allSettled block.

**Code location:** [page.tsx:137–157](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx#L137)

**Fix direction:** Either (a) run `file_attachments` query inside the `Promise.allSettled` as a 5th parallel entry, or (b) join file attachment IDs into `getTabBlocks` select so no separate query is needed. The `getBatchFileUrls` call should then also be moved inside `allSettled`.

---

### F3 — 130 `select("*")` calls across 38 action files — systematic overfetch (HIGH)

**Symptom:** Network payloads for many operations are larger than necessary, causing longer wire times and higher JS deserialization cost.

**Root cause:** Grep confirmed 130 occurrences of `.select("*")` across 38 action files. The worst offenders by call frequency in hot paths:

| File | Count | Hot Path? | Risk |
|------|-------|-----------|------|
| `tables/row-actions.ts` | 11 | YES — every row edit | JSONB `data` column returned for all rows |
| `tables/table-actions.ts` | 10 | YES — table open | All table metadata columns |
| `tables/query-actions.ts` | 9 | YES — bootstrap + search | `data` JSONB on every row |
| `timelines/event-actions.ts` | 5 | YES — timeline load | All event columns |
| `entity-properties.ts` | 5 | YES — per-block property load | All property columns |
| `block.ts` | 2 | YES — `getChildBlocks` | Full block content JSONB |
| `tasks/subtask-actions.ts` | 3 | YES — task expand | All subtask columns |

Particularly dangerous: `table_rows.select("*")` in row-actions.ts returns the full `data` JSONB column (which contains all field values) on every single row mutation, even when the mutation only changed one field.

**Evidence to gather:** After any table row update, check the server action response payload size in Chrome DevTools → Network → Response. Expect response includes the full `data` JSONB of the row even though the mutation only changed one field value.

**Code location:** All 38 files (key ones: [tables/row-actions.ts](trak/src/app/actions/tables/row-actions.ts), [entity-properties.ts](trak/src/app/actions/entity-properties.ts), [block.ts:142](trak/src/app/actions/block.ts#L142))

**Fix direction:** Replace each `select("*")` with the minimal column set required by the consuming UI. For mutation responses (row update, task update), return only `id` + changed fields. Audit with: `grep -rn 'select("\*")' trak/src/app/actions/ | wc -l` — target: 0.

---

### F4 — `BlockWrapper` fires `useEntityPropertiesWithInheritance` + `useWorkspaceMembers` per block (HIGH)

**Symptom:** A tab with 10 blocks issues 10 separate `entity_properties` queries and 10 separate `workspace_members` queries. On a tab with 20 blocks, this is 40 queries fired simultaneously on mount — all for data that is workspace-wide (members) or could be batch-fetched (entity properties).

**Root cause:** [block-wrapper.tsx:89–90](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx#L89):
```typescript
// Fires for EVERY block rendered on the page
const { data: propertiesResult } = useEntityPropertiesWithInheritance("block", block.id);
const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
```

`useWorkspaceMembers` uses React Query with `staleTime: 60_000`, so after the first call it returns from cache — but the **first render of 10 blocks** still issues 10 parallel calls to `useWorkspaceMembers`, each checking cache independently and all missing simultaneously since they mount at the same time.

`useEntityPropertiesWithInheritance` is genuinely per-block and cannot be batched the same way, but it is called for every block including dividers and simple text blocks that never display property badges.

Additionally, `task-block.tsx` also calls `useWorkspaceMembers` independently (line 58 in task-block.tsx imports), meaning a task block fires a third independent workspace members query.

**Evidence to gather:** React Query Devtools on initial tab load — count how many `entityPropertiesInherited` queries fire simultaneously. Expect N queries where N = block count. Also check `useWorkspaceMembers` call count.

**Code location:** [block-wrapper.tsx:89–90](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx#L89), [task-block.tsx:58](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block.tsx#L58)

**Fix direction:** (a) Hoist `useWorkspaceMembers` to `TabCanvas` level and pass result down via context or props — one query instead of N. (b) Add a guard in `BlockWrapper` to skip `useEntityPropertiesWithInheritance` for block types that never show properties (divider, text). (c) Consider a batch properties query: `useEntitiesProperties("block", blockIds)` fetched once at `TabCanvas` level, distributed to children via context.

---

### F5 — `TabContentsContext.Provider` value object recreated on every render (HIGH — render churn multiplier)

**Symptom:** Any state change in `TabContentsProvider` (e.g., toggling `tocExpanded`, or the parent re-rendering with new `blocks` from server) causes every consumer of `useTabContents()` to re-render, even if `blocks` and `subtabConfig` are structurally identical.

**Root cause:** [tab-contents-context.tsx:48–52](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-contents-context.tsx#L48):
```typescript
return (
  <TabContentsContext.Provider value={{ blocks, tocExpanded, setTocExpanded, subtabConfig }}>
    {children}
  </TabContentsContext.Provider>
);
```

The `value` object `{ blocks, tocExpanded, setTocExpanded, subtabConfig }` is a **new object reference on every render** of `TabContentsProvider`. Since `setTocExpanded` is a stable `useState` setter (stable reference), but `blocks` is an array that changes on every server sync, and `subtabConfig` is an object literal created inline in `page.tsx`, every render of the provider triggers all consumers.

Consumers of `useTabContents()` include: `tab-canvas.tsx` (line 81), `table-of-contents.tsx`, and potentially others. Each consumer re-renders on every provider render.

**Evidence to gather:** Add `console.count("TabContentsContext render")` inside the provider. On a tab with normal editing, expect 3–5 renders per keystroke due to block state syncing.

**Code location:** [tab-contents-context.tsx:48](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-contents-context.tsx#L48)

**Fix direction:** Wrap the value in `useMemo`:
```typescript
const value = useMemo(
  () => ({ blocks, tocExpanded, setTocExpanded, subtabConfig }),
  [blocks, tocExpanded, subtabConfig]
);
return <TabContentsContext.Provider value={value}>{children}</TabContentsContext.Provider>;
```
Additionally, split the context into a "stable actions" context (setTocExpanded) and a "data" context (blocks, tocExpanded, subtabConfig) so consumers that only need actions don't re-render when data changes.

---

### F6 — `WorkspaceContext.Provider` value object not memoized (MEDIUM — top-of-tree churn)

**Symptom:** Any workspace-level state change causes the entire dashboard subtree to re-render unnecessarily.

**Root cause:** [workspace-context.tsx:73–83](trak/src/app/dashboard/workspace-context.tsx#L73):
```typescript
<WorkspaceContext.Provider
  value={{
    currentWorkspace,
    workspaces,
    switchWorkspace,
    isSwitching: isPending,
    isLoading,
  }}
>
```

The `value` object is a new object reference on every render. `switchWorkspace` is defined inside the component body (not wrapped in `useCallback`), so it gets a new reference on every render too. This means every consumer of `useWorkspace()` re-renders whenever any parent re-renders — including on `router.refresh()` which is the most common mutation pattern in this codebase (98 occurrences).

Since `WorkspaceContext` sits near the root of the dashboard layout, any `router.refresh()` call triggers a re-render cascade through all workspace context consumers.

**Evidence to gather:** React Profiler — record a `router.refresh()` call (e.g., after block delete). Look for `WorkspaceContext.Provider` re-render followed by all consuming components re-rendering.

**Code location:** [workspace-context.tsx:72–84](trak/src/app/dashboard/workspace-context.tsx#L72)

**Fix direction:** Wrap `value` in `useMemo` and `switchWorkspace` in `useCallback` with stable deps.

---

### F7 — `blockTypeOptions` and `galleryLayouts` arrays created inline in `BlockWrapper` render (MEDIUM — per-block GC pressure)

**Symptom:** Dropdown menus for block type conversion flicker or feel slightly unresponsive on tabs with many blocks. GC pressure from constant array allocation.

**Root cause:** [block-wrapper.tsx:157–174](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx#L157):
```typescript
const blockTypeOptions: Array<...> = [
  { type: "text", label: "Text", icon: <FileText className="h-4 w-4" /> },
  // ... 10 more entries with JSX icon nodes allocated per render
];
const galleryLayouts = [
  { layout: "collage" as const, label: "Collage" },
  // ... 2 more
];
```

These arrays are **recreated from scratch on every render** of every `BlockWrapper`. Each entry also allocates a new JSX element (`<FileText className="h-4 w-4" />`). For a tab with 20 blocks, this allocates 20 × 11 JSX elements = 220 React elements per render cycle, all of which are immediately discarded if the dropdown is not open.

**Evidence to gather:** Chrome DevTools Memory → Heap Snapshot before and after scrolling through a 20-block tab. Look for `ReactElement` objects in the diff; expect hundreds of short-lived allocations.

**Code location:** [block-wrapper.tsx:157–174](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx#L157)

**Fix direction:** Move `blockTypeOptions` and `galleryLayouts` to **module-level constants** outside the component. JSX icon elements can be module-level too. Zero allocation per render.

---

### F8 — `handleConvert` in `tab-canvas.tsx` calls `router.refresh()` unconditionally (MEDIUM — full RSC refetch on type change)

**Symptom:** Converting a text block to a task block causes a full page reload sensation — all blocks re-render and scroll position may reset.

**Root cause:** [tab-canvas.tsx:492–503](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L492):
```typescript
const result = await updateBlock({ blockId, type: newType, content: newContent });
if (result.error) { ... return; }
router.refresh();  // ← Full RSC refetch for a type change
```

`updateBlock` already returns the updated block in `result.data`. The `handleUpdate` function (line 291) knows how to merge a single updated block into local state via `setBlocks` + `queryClient.setQueryData` — but `handleConvert` bypasses this and goes straight to `router.refresh()`.

Similarly, `handleUndo` at [tab-canvas.tsx:414](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L414) calls `router.refresh()` after inserting the re-created block into both local state AND React Query cache — the `router.refresh()` is redundant since the data is already up to date.

**Evidence to gather:** Network tab — after block convert (e.g., text → task), look for an RSC fetch request to the current tab URL. Time it: expect 200–600ms round trip before the new block type renders.

**Code location:** [tab-canvas.tsx:503](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L503), [tab-canvas.tsx:414](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L414)

**Fix direction:** In `handleConvert`, call `handleUpdate(result.data)` instead of `router.refresh()` — this already handles merging the updated block into both local state and React Query cache. In `handleUndo`, remove the `router.refresh()` at line 414 since the block is already reconciled.

---

### F9 — `useTaskItems` has no `staleTime` override — uses global 5-minute default (MEDIUM — stale data on tab revisit)

**Symptom:** After editing tasks in a tab and navigating away, returning to the same tab within 5 minutes shows stale task data without refetching — but after 5 minutes, it re-runs all 5 round trips of `getTaskItemsByBlock`. There is no middle ground.

**Root cause:** [use-task-queries.ts:28–37](trak/src/lib/hooks/use-task-queries.ts#L28):
```typescript
export function useTaskItems(blockId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.items(blockId),
    queryFn: async () => { ... },
    enabled: options?.enabled ?? true,
    // NO staleTime — inherits global 5 * 60 * 1000
  });
}
```

Task data is inherently more volatile than blocks or tabs (tasks get edited frequently by multiple users). 5 minutes is too long for collaborative environments, too short for single-user sessions. There is no `select` transform to prevent re-renders when unrelated task data changes.

Additionally, `useReorderTaskItems` uses `onSuccess: invalidateQueries` (line 125) — a reorder (which is a drag-drop operation) triggers a full 5-round-trip refetch of all tasks, including subtasks/comments/tags/assignees, just to confirm the order was saved.

**Code location:** [use-task-queries.ts:28–37](trak/src/lib/hooks/use-task-queries.ts#L28), [use-task-queries.ts:125](trak/src/lib/hooks/use-task-queries.ts#L125)

**Fix direction:** Add `staleTime: 60_000` (1 minute — fast enough for collaborative feel, slow enough to avoid constant refetch). Add `select: (data) => data` with a stable reference via `useMemo` or React Query's `select` option to prevent re-renders when only unrelated tasks change. For `useReorderTaskItems`, the server only changes `display_order` — use `setQueryData` to update just the order locally instead of invalidating.

---

### F10 — `projects-grid.tsx` and `projects-table.tsx` each call `router.refresh()` 6 times (MEDIUM — redundant at list level)

**Symptom:** Creating, archiving, or deleting a project from the projects list causes the entire page to reload 6 times worth of refreshes (or 6 separate page refreshes for different operations), cascading through the full RSC render of the projects list.

**Root cause:** Grep confirmed 6 `router.refresh()` calls in [projects-grid.tsx](trak/src/app/dashboard/projects/projects-grid.tsx) and 6 in [projects-table.tsx](trak/src/app/dashboard/projects/projects-table.tsx). These fire on: project create, project update, project archive, project delete, project status change, and project tag change. Each fires a full RSC re-render for the entire `/dashboard/projects` route, re-executing `getProjects` (which itself has its own auth chain and full project fetch).

**Evidence to gather:** Network tab — after updating a project's status in the projects list, count how many RSC fetch requests appear. Expect 1 per `router.refresh()` call.

**Code location:** [projects-grid.tsx](trak/src/app/dashboard/projects/projects-grid.tsx), [projects-table.tsx](trak/src/app/dashboard/projects/projects-table.tsx)

**Fix direction:** Replace `router.refresh()` with React Query mutations that update the local projects list cache via `queryClient.setQueryData`. The projects list query key from `queryKeys` in query-client.ts should be used consistently.

---

### F11 — `internal-grid.tsx` and `internal-table.tsx` each have 7 `router.refresh()` calls — same pattern as projects (MEDIUM)

**Symptom:** Same as F10 but for internal spaces. All CRUD operations on internal items trigger full page reloads.

**Root cause:** Grep: 7 calls in [internal-grid.tsx](trak/src/app/dashboard/internal/internal-grid.tsx), 7 in [internal-table.tsx](trak/src/app/dashboard/internal/internal-table.tsx). Pattern is identical to projects.

**Code location:** [internal-grid.tsx](trak/src/app/dashboard/internal/internal-grid.tsx), [internal-table.tsx](trak/src/app/dashboard/internal/internal-table.tsx)

**Fix direction:** Same as F10 — React Query setQueryData instead of router.refresh().

---

### F12 — `docs-grid.tsx` (4 calls) + `docs-table.tsx` (5 calls) — same systemic `router.refresh()` pattern (MEDIUM)

**Symptom:** Docs CRUD operations all trigger full RSC re-renders of the docs list page.

**Root cause:** [docs-grid.tsx](trak/src/app/dashboard/docs/docs-grid.tsx) (4 calls), [docs-table.tsx](trak/src/app/dashboard/docs/docs-table.tsx) (5 calls). Total: 98 `router.refresh()` occurrences across 38 files. This is a **systemic codebase pattern** — everywhere a mutation completes, `router.refresh()` is called rather than updating the React Query cache.

**Code location:** [docs-grid.tsx](trak/src/app/dashboard/docs/docs-grid.tsx), [docs-table.tsx](trak/src/app/dashboard/docs/docs-table.tsx)

**Fix direction:** A codebase-wide migration from `router.refresh()` to React Query cache updates. Given the scope (38 files, 98 calls), this should be a dedicated PR with a migration guide.

---

### F13 — `FileUrlContext` is initialized with `initialFileUrls` but never refreshed when signed URLs expire (MEDIUM — broken images after 5 min)

**Symptom:** A user who opens a tab with images, leaves the tab open for more than 5 minutes (the `createSignedUrl` expiry), then scrolls to a previously off-screen image sees a broken image or auth error.

**Root cause:** [tab-canvas.tsx:1204](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L1204):
```typescript
<FileUrlContext.Provider value={initialFileUrls}>
```

`initialFileUrls` is set once on mount from the server-provided prop. The `FileUrlContext` is a plain `createContext<Record<string, string>>({})` — no refresh mechanism, no expiry tracking. The signed URLs from Supabase expire after 300 seconds (5 minutes), but there is no TTL check or automatic re-fetch.

Additionally, the React Query `fileUrls` key in `query-client.ts` (line 43) is defined with `staleTime: 10 * 60 * 1000` (10 minutes) in `use-tab-data.ts` — but `FileUrlContext` is not connected to React Query at all. The server-provided `initialFileUrls` bypasses React Query entirely.

**Evidence to gather:** Open a tab with images, wait 6 minutes, scroll to a new image block — observe the img src returns a 403 from Supabase Storage.

**Code location:** [tab-canvas.tsx:1204](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L1204), [tab-contents-context.tsx](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-contents-context.tsx)

**Fix direction:** Replace `FileUrlContext` with a React Query-backed hook (`useFileUrls`) that has `staleTime: 240_000` (4 min, before the 5-min URL expiry). On stale detection, it silently refetches signed URLs. The `use-tab-data.ts` hook already has this infrastructure with `staleTime: 10 * 60 * 1000` but it's too long.

---

### F14 — `revalidatePath("/dashboard")` in `dashboard-insights.ts` blows the entire ISR cache (MEDIUM)

**Symptom:** Any AI overview or insight regeneration causes the entire `/dashboard` page (and all cached variants) to be invalidated, forcing a full server re-render for the next visitor.

**Root cause:** [dashboard-insights.ts](trak/src/app/actions/dashboard-insights.ts) calls `revalidatePath("/dashboard")` (2 occurrences). This path covers the main dashboard landing page. Since the dashboard aggregates projects, tasks, timeline events, and workspace data, invalidating `/dashboard` causes a cold re-render of a very heavy page for all users on next visit.

Additionally, `block.ts` triggers `revalidatePath` on block mutations. `file.ts` triggers `revalidatePath('/dashboard/projects', 'layout')` on file operations — which invalidates the entire projects section for all tabs.

**Evidence to gather:** Count of `revalidatePath` calls across all server actions: 56 total across 17 files. Check if any revalidate broad paths like `/dashboard` or `/dashboard/projects` rather than specific tab/project paths.

**Code location:** [dashboard-insights.ts](trak/src/app/actions/dashboard-insights.ts), [file.ts](trak/src/app/actions/file.ts) (11 occurrences)

**Fix direction:** Replace broad `revalidatePath` with narrow, specific paths. For file operations, only revalidate the specific project/tab where the file lives. Use Next.js cache tags (`revalidateTag`) instead of paths for more targeted invalidation. For the AI overview, consider not revalidating at all if the result is returned directly to the client.

---

## 2. RSC + Payload Forensics

### 2.1 Top Payload Contributors on Project/Tab Navigation

#### Server component props passed through `page.tsx`

At [page.tsx:192–222](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx#L192), the following props are serialized into the RSC payload and transferred to the client:

| Prop | Source | Estimated Size | Risk |
|------|--------|---------------|------|
| `blocks` (array of Block) | `getTabBlocks(tabId)` | 50KB–2MB (depends on block count × content JSONB size) | HIGH — full `content` JSONB per block |
| `tabs` (hierarchical array) | `getProjectTabs(projectId)` | ~5–20KB (tab metadata only) | LOW |
| `project` (single object) | Direct Supabase select | ~1–2KB (selected columns) | LOW |
| `initialFileUrls` (Record<string,string>) | `getBatchFileUrls(fileIds)` | ~2–5KB (string map of URLs) | LOW |
| `subtabConfig` | Derived from `tabs` in-memory | <1KB | NONE |

**Key risk: `blocks.content` JSONB.** Every block's `content` field is a full JSONB object. For a tab with:
- 5 text blocks: ~5KB each = 25KB
- 2 task blocks (no inline content): ~1KB each = 2KB
- 1 gallery block with 20 images embedded in content: `items: [{fileId, caption, ...}×20]` = ~5–10KB
- 1 table block with embedded snapshot: potentially 50–200KB if the block content stores row data

**Audit-only payload logger to add to `page.tsx` after line 103:**
```typescript
if (process.env.PERF_DEBUG === '1') {
  const blockPayloadBytes = Buffer.byteLength(JSON.stringify(blocks), 'utf8');
  const fileUrlBytes = Buffer.byteLength(JSON.stringify(initialFileUrls), 'utf8');
  console.log(`[PERF] page.tsx payload blocks=${blocks.length} blockBytes=${blockPayloadBytes} fileUrls=${Object.keys(initialFileUrls).length} fileUrlBytes=${fileUrlBytes} totalEstimatedBytes=${blockPayloadBytes + fileUrlBytes}`);
  // Also log per-block content sizes
  blocks.forEach(b => {
    const contentBytes = Buffer.byteLength(JSON.stringify(b.content ?? {}), 'utf8');
    if (contentBytes > 5000) {
      console.log(`[PERF] heavy block type=${b.type} id=${b.id} contentBytes=${contentBytes}`);
    }
  });
}
```

#### Block types that embed large arrays in `blocks.content`

After reading `getTabBlocks` and the block type definitions:

| Block Type | Content Shape | Max Content Size |
|------------|---------------|-----------------|
| `gallery` | `{ layout, items: Array<{fileId, caption, width}> }` | ~500B × N items; 30 items = 15KB |
| `table` (legacy) | `{ rows: number, cols: number, cells: string[][] }` — old format | Could be 10–50KB for large legacy tables |
| `timeline` | `{ startDate, endDate, events: [] }` — events stored inline for legacy | Potentially 100+ events embedded |
| `text` | `{ text: string }` — tiptap/prosemirror JSON | Rich text: 5–50KB depending on length/formatting |
| `section` | `{ height: number }` | ~50B — safe |
| `image` | `{ fileId, caption, width }` | ~200B — safe |

**Worst case: a tab with 1 gallery block (30 items) + 1 legacy table + 1 rich text block = ~80–150KB of `content` JSONB alone, before any other block data.**

---

### 2.2 `select("*")` and Overfetch Audit

Full table of hot-path wildcard selects:

| LOCATION | QUERY | FIELDS RETURNED | EST PAYLOAD RISK | REPLACEMENT PROJECTION |
|----------|-------|----------------|-----------------|----------------------|
| [block.ts:142](trak/src/app/actions/block.ts#L142) `getChildBlocks` | `blocks.select("*")` | All 11 block columns including `content` JSONB | MEDIUM — child blocks are section contents | `"id, tab_id, parent_block_id, type, content, position, column, created_at, updated_at"` |
| [tables/row-actions.ts](trak/src/app/actions/tables/row-actions.ts) (11×) | `table_rows.select("*")` | `id, table_id, data (JSONB), created_at, updated_at, created_by` | HIGH — `data` JSONB contains all field values | `"id, data"` for updates; `"id"` for deletes |
| [tables/table-actions.ts](trak/src/app/actions/tables/table-actions.ts) (10×) | `tables.select("*")` | All table metadata columns | MEDIUM | `"id, name, description, created_at"` per use case |
| [tables/query-actions.ts](trak/src/app/actions/tables/query-actions.ts) (9×) | `table_rows.select("*")`, `table_fields.select("*")` | All rows with full JSONB | CRITICAL — no limit | See PERF_AUDIT.md B3 + add explicit column lists |
| [timelines/event-actions.ts](trak/src/app/actions/timelines/event-actions.ts) (5×) | `timeline_events.select("*")` | All event columns including `properties` JSONB | MEDIUM | `"id, block_id, title, start_date, end_date, status, priority, assignee_ids, properties"` |
| [entity-properties.ts](trak/src/app/actions/entity-properties.ts) (5×) | `entity_properties.select("*")` | `entity_id, entity_type, field_name, value, source_*` | MEDIUM | `"entity_id, entity_type, field_name, value"` |
| [tasks/subtask-actions.ts](trak/src/app/actions/tasks/subtask-actions.ts) (3×) | `task_subtasks.select("*")` | All subtask columns | LOW-MEDIUM | `"id, task_id, title, completed, display_order"` |
| [tasks/query-actions.ts:43](trak/src/app/actions/tasks/query-actions.ts#L43) | `task_items.select("*")` | All task columns including any JSONB fields | HIGH — for 100 tasks | `"id, task_block_id, title, status, priority, description, due_date_start, due_date_end, display_order, created_by, created_at"` |

---

### 2.3 JSON Serialization Double-Work

**Identified serialization chains:**

#### Chain 1: `getTaskItemsByBlock` → Client transformation
```
DB → JSON (Postgres) → Node.js parse → TypeScript map/join → JSON.stringify (server action) → HTTP → browser parse → React render
```
The `getTaskItemsByBlock` function at [query-actions.ts:36–190](trak/src/app/actions/tasks/query-actions.ts#L36) assembles `TaskItemView` objects by joining data from 5 queries in JavaScript. This means:
- 5 separate JSON parses (one per DB result)
- 1 JavaScript join/map operation over all results
- 1 final JSON.stringify for the server action response

**Measurement to add:**
```typescript
const t_serialize = performance.now();
const result = { data: taskViews };
console.log(`[PERF] getTaskItemsByBlock serialize ms=${Math.round(performance.now()-t_serialize)} bytes=${Buffer.byteLength(JSON.stringify(result))}`);
return result;
```

#### Chain 2: `getTableBootstrap` → Client
The bootstrap assembles: `table` + `fields` + `view` + ALL `rows`. At 1k rows × 20 fields, the serialization chain is:
- `rows.data` (JSONB, already parsed by Supabase client from PG wire)
- Re-serialized as server action response body
- Deserialized in browser
- Re-mapped by `table-view.tsx` into display model

Estimated per-serialization cost at 1k rows: `JSON.stringify(rows)` ≈ 2MB → **~15–50ms of CPU per serialize step** (V8 in Node.js: ~30MB/s for complex objects).

**Measurement to add:**
```typescript
const t0 = performance.now();
const payload = { data: { table, fields, view, rows } };
console.log(`[PERF] getTableBootstrap serialize bytes=${Buffer.byteLength(JSON.stringify(payload))} ms=${Math.round(performance.now()-t0)}`);
```

---

## 3. React Render Churn Hunt

### 3.1 Render Churn Report

#### How to measure
Open Chrome DevTools → Performance → Record. Perform the interaction. Stop recording. Look in the "Timings" row for React's `--react-mount` and `--react-update` marks. In the flame chart, select the "Commit" phases and inspect "Self Time" per component.

Alternatively, install React DevTools and use the Profiler tab: Settings → "Record why each component rendered."

#### a) Tab switch churn

**Expected top re-renderers:**

| Component | Why it Re-renders | Code Location | Estimated Commits |
|-----------|-------------------|---------------|-------------------|
| `TabCanvas` | New `initialBlocks` prop from server triggers `useEffect` sync (line 93–103) | [tab-canvas.tsx:93](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L93) | 1–2 |
| `TabContentsProvider` | New `blocks` prop → new context value object → all consumers | [tab-contents-context.tsx:48](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-contents-context.tsx#L48) | 2–3 per tab switch |
| `BlockWrapper` (×N) | N blocks × context update + `useEntityPropertiesWithInheritance` cache miss | [block-wrapper.tsx:89](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx#L89) | N (one per block) |
| `TableOfContents` | `useTabContents()` consumer → re-renders on every `TabContentsProvider` update | Depends on ToC consumer | 2–3 |

#### b) Edit task title churn

| Component | Why it Re-renders | Code Location | Estimated Commits |
|-----------|-------------------|---------------|-------------------|
| `TaskBlock` (whole) | `useTaskItems` data reference changes on invalidation + re-fetch | [use-task-queries.ts:96](trak/src/lib/hooks/use-task-queries.ts#L96) | 2 (optimistic + settle) |
| All 100 task rows | `tasks` array is new reference from `useTaskItems` → all rows re-render | [task-block.tsx passthrough] | 100× per mutation settle |
| `BlockWrapper` containing `TaskBlock` | `useEntityPropertiesWithInheritance` is independent query; may not re-render | n/a | 0–1 |

**Root cause:** `useTaskItems` returns a new array reference from React Query on every query result (even if data is identical). Without a `select` transform that performs structural equality, all task row components re-render when any task changes. At 100 tasks, this is 100 `React.createElement` calls per status/title change.

#### c) Change task status churn

Same as (b) — the optimistic update via `setQueryData` is fast (one commit), but the `invalidateQueries` on `onSettled` triggers a full refetch which produces a second commit touching all 100 rows.

**Quantified:** 2 render commits × 100 task rows = 200 component renders for a single status change. Of these, 199 are wasted — only 1 task actually changed.

#### d) Open table with 500 rows

| Component | Why it Re-renders | Code Location | Self Time (est) |
|-----------|-------------------|---------------|----------------|
| `TableView` | `useTableBootstrap` resolves with all 500 rows → new data reference | [table-view.tsx] | 5–20ms |
| 500 `TableRow` components | All rows rendered into DOM simultaneously | No virtualization | 50–200ms |
| Column headers (per view) | View data arrives simultaneously | — | 1–2ms |

Without virtualization, 500 rows = 500 `tr` elements × ~3 `td` each = 1,500 DOM mutations in one commit. Expected browser paint time: 100–500ms.

---

### 3.2 Context Invalidation / Provider Churn

#### Provider tree in the tab page:

```
WorkspaceContext.Provider     ← not memoized (F6) — root of churn
  └─ ThemeContext.Provider    ← has inline value={{ theme, setTheme, isDark }} (not memoized)
       └─ TabContentsProvider ← not memoized (F5) — per-tab churn source
            └─ FileUrlContext.Provider  ← value={initialFileUrls} — stable (set once on mount) ✓
                 └─ [DndContext, SortableContext, BlockWrapper×N]
```

**`ThemeContext.Provider` at [theme-context.tsx:66](trak/src/app/dashboard/theme-context.tsx#L66):**
```typescript
<ThemeContext.Provider value={{ theme, setTheme, isDark }}>
```
Same pattern as WorkspaceContext — inline object, not memoized. Any parent re-render causes all `useTheme()` consumers to re-render unnecessarily. `isDark` is derived from `theme` so it's stable within a session, but the object wrapper is not.

**Fix plan:**
1. `WorkspaceContext.Provider` — memoize value, useCallback on switchWorkspace
2. `ThemeContext.Provider` — memoize value, split into `ThemeDataContext` + `ThemeActionsContext`
3. `TabContentsProvider` — memoize value (see F5 fix)
4. Consider a single `useMemoizedContextValue` utility hook across the codebase

---

### 3.3 Reference Instability Hotspots

| Location | Pattern | Re-render Multiplier |
|----------|---------|---------------------|
| [block-wrapper.tsx:157–174](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx#L157) | `blockTypeOptions` array with JSX icons recreated per render | N blocks × every parent re-render |
| [tab-canvas.tsx:180–266](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L180) | `blockRows` useMemo — stable ✓ | N/A |
| [tab-canvas.tsx:268–289](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L268) | `previewInfo` useMemo — stable ✓ | N/A |
| [tab-canvas.tsx:1199–1201](trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx#L1199) | `tocBlocks` useMemo — stable ✓ | N/A |
| `BlockRenderer` callback props | `onDelete`, `onConvert`, `onUpdate` passed inline per row | N blocks × any TabCanvas state change |
| `useTaskItems` queryFn returns | New array reference every query → no structural equality | 100 rows × every mutation settle |
| `page.tsx:97–99` | `{ ...rawProject, client: ..., tags: rawProject.tags ?? [] }` — new object per RSC render | Passed as `project` prop to all children |

**Highest multiplier:** `BlockRenderer` callback props. In `tab-canvas.tsx`, the render of `SortableContext` passes `onDelete`, `onConvert`, `onUpdate`, `onAddBlockAbove`, `onAddBlockBelow` as inline function expressions or via `useCallback`. Each time `TabCanvas` state changes (e.g., `isDragging`, `isCreatingBlock`, `undoStack`), these callbacks get new references if not properly memoized, causing all `BlockWrapper` children to re-render.

**Verify:** Check whether `onDelete`, `onConvert`, etc. in `tab-canvas.tsx` are wrapped in `useCallback` with stable deps. If any depend on `blocks` state directly, they will be recreated on every blocks update.

---

## 4. React Query / Caching Pathology Hunt

### 4.1 Query Key Audit

**Keys invalidated during "task edit" (status/title/priority change):**

| Mutation Hook | Invalidated Key | Data Refetched |
|---------------|----------------|----------------|
| `useUpdateTaskItem` | `["taskItems", blockId]` | Full `getTaskItemsByBlock` (5 round trips) |
| Entity property sync (if applicable) | `["entityProperties", "task", taskId]` | Single entity properties |
| `useSetEntityPropertiesForType` (if called) | `["entityPropertiesInherited", "task", taskId]` | Inherited properties |

**Keys invalidated during "task comment add":**

| Mutation Hook | Invalidated Key | Data Refetched |
|---------------|----------------|----------------|
| `useTaskComments.create` | `["taskItems", blockId]` | Full `getTaskItemsByBlock` again |

A comment add should only need to refetch the comment count/list for the specific task — but it refetches the entire block's tasks (all 5 round trips). This is the same waste pattern as task edits.

**Keys invalidated during "block reorder" (drag-drop):**

| Mutation | Invalidated Keys | Cost |
|----------|-----------------|------|
| `updateBlock` (position update) | `queryKeys.tabBlocks(tabId)` via `handleUpdate` | React Query setQueryData ✓ (local only) |
| `router.refresh()` (also called in some reorder paths) | Server RSC cache → full re-render | Expensive |

**Keys invalidated during "tab switch":**
- No explicit invalidation — tab switch is handled by Next.js navigation
- `getProjectTabs` is re-fetched as a server component query on navigation (no React Query cache for this)
- `getTabBlocks` is re-fetched as a server component query — also not cached in React Query

**Query key instability detected:**

```typescript
// query-client.ts:43
fileUrls: (fileIds: string[]) => ['fileUrls', fileIds.sort().join(',')] as const,
```

This key is computed from `.sort().join(',')` which is correct — **but `.sort()` mutates the input array**. If `fileIds` is passed by reference from other code, this is a subtle mutation bug. Use `[...fileIds].sort().join(',')` instead.

---

### 4.2 StaleTime / gcTime Mismatches

**Current staleTime configuration:**

| Query | staleTime | gcTime | Is it right? |
|-------|-----------|--------|-------------|
| Global default | 5 min | 10 min | Reasonable but generic |
| `useTableBootstrap` | 30s | (default) | TOO SHORT for stable table metadata |
| `useTableFields` | 30s | (default) | TOO SHORT — fields rarely change |
| `useTableView` | 30s | (default) | TOO SHORT — view config rarely changes |
| `useTableRows` (paginated) | 10s | (default) | TOO SHORT for stable data |
| `usePropertyDefinitions` | 60s | (default) | REASONABLE |
| `useEntityProperties` | 30s | (default) | REASONABLE |
| `useWorkspaceEverything` | 30s | (default) | REASONABLE (real-time feel needed) |
| `useTabBlocks` (via tab-data.ts) | 5 min | (default) | CORRECT |
| `useFileUrls` (via tab-data.ts) | 10 min | (default) | TOO LONG — URLs expire at 5 min |
| `useTaskItems` | 5 min (global) | (default) | TOO LONG for collaborative edits |

**Recommended staleTime adjustments:**

| Query | Recommended staleTime | Reason |
|-------|-----------------------|--------|
| `useTableFields` | 10 min | Fields almost never change mid-session |
| `useTableView` | 5 min | View config changes are intentional |
| `useTableBootstrap` (table metadata only, not rows) | 5 min | Table structure rarely changes |
| `useFileUrls` | **3 min** | Signed URLs expire at 5 min; 3 min ensures refresh before expiry |
| `useTaskItems` | 60s | Tasks are collaborative — refresh every minute |
| `useProjectTabs` | 10 min | Tabs rarely change |
| `useWorkspaceMembers` (in property queries) | 15 min | Membership rarely changes |

---

### 4.3 Hidden Refetch Triggers

**`router.refresh()` inventory — confirmed hot paths:**

| File | Occurrences | Fires on | Data Refetched |
|------|------------|---------|----------------|
| `tab-canvas.tsx` | 8 | block delete, undo, convert, block create error | Full tab RSC render |
| `projects-grid.tsx` | 6 | project CRUD | Full projects list RSC render |
| `projects-table.tsx` | 6 | project CRUD | Full projects list RSC render |
| `internal-grid.tsx` | 7 | internal CRUD | Full internal RSC render |
| `internal-table.tsx` | 7 | internal CRUD | Full internal RSC render |
| `docs-grid.tsx` | 4 | docs CRUD | Full docs list RSC render |
| `docs-table.tsx` | 5 | docs CRUD | Full docs list RSC render |
| `client-tab-canvas.tsx` | 6 | client tab CRUD | Full client tab RSC render |
| Settings dialogs | ~8 | member/team CRUD | Settings page RSC render |
| **Total** | **98** | Various mutations | Various RSC re-renders |

**Accidental refetch loops via effects — check `tab-canvas.tsx` line 113–166:**

The `useEffect` at line 113 watches `[tabId, initialBlocks, isDragging, isCreatingBlock]`. When `initialBlocks` changes (from a `router.refresh()` RSC re-render), it syncs blocks. If any block mutation triggers both `queryClient.setQueryData` (line 309) AND `router.refresh()` (line 315), the server re-render pushes new `initialBlocks` which triggers the effect which calls `setBlocks` again — a **redundant double-update** (optimistic already applied → server data comes back identical → setBlocks is a no-op, but the comparison loop still runs for all N blocks).

**`revalidatePath` that fire broadly:**

```
file.ts: revalidatePath('/dashboard/projects', 'layout')  — invalidates ALL project routes
dashboard-insights.ts: revalidatePath('/dashboard')        — invalidates ROOT dashboard
block-templates.ts: revalidatePath('/dashboard')           — same
```

None of these use narrow, targeted paths or cache tags.

---

## 5. Auth/RLS/Permissions Cost: Prove It With EXPLAIN

### 5.1 Top 5 Hot DB Queries — EXPLAIN Statements

Run these in Supabase SQL Editor with your test user's JWT set (or as a role that mimics RLS):

#### Query 1: `getTabBlocks` — blocks by tab

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, tab_id, parent_block_id, type, content, position, column,
       is_template, template_name, original_block_id, created_at, updated_at
FROM blocks
WHERE tab_id = '<YOUR_TAB_ID>'
  AND parent_block_id IS NULL
ORDER BY column ASC, position ASC
LIMIT 500;
```

**What to look for:**
- `Index Scan using blocks_tab_id_idx` — if missing, RLS + seq scan on blocks is O(n)
- Any `Function Scan on can_access_project` per-row nodes
- `rows=500` estimate vs actual rows — check Postgres statistics are up to date

#### Query 2: `getTaskItemsByBlock` — task items with RLS

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM task_items
WHERE task_block_id = '<YOUR_BLOCK_ID>'
ORDER BY display_order ASC;
```

**What to look for:**
- `Seq Scan on task_items` with filter = bad; should be `Index Scan using task_items_task_block_id_idx`
- Per-row `can_access_project` function calls in the output
- Actual total time vs expected: target < 20ms for 100 rows

#### Query 3: `getTableBootstrap` — table rows (the worst case)

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM table_rows
WHERE table_id = '<YOUR_TABLE_ID>'
LIMIT 100;
```

**What to look for:**
- `Seq Scan on table_rows` even with LIMIT (because RLS filter applies first in most plans)
- Rows removed by filter (RLS cost)
- Total bytes: check `actual rows` × average row width in `EXPLAIN` output

#### Query 4: `timeline_events` fetch

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM timeline_events
WHERE block_id = '<YOUR_TIMELINE_BLOCK_ID>'
ORDER BY start_date ASC;
```

**What to look for:** Same RLS per-row evaluation pattern. Check for index on `timeline_events(block_id)`.

#### Query 5: `entity_properties` read

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM entity_properties
WHERE entity_type = 'block'
  AND entity_id = ANY(ARRAY['<block_id_1>', '<block_id_2>', '<block_id_3>']);
```

**What to look for:** Index on `entity_properties(entity_type, entity_id)` — if not present, every property lookup is a seq scan.

---

### 5.2 `can_access_project` Evaluation Pattern

**What the EXPLAIN output reveals:**

If `can_access_project` runs per-row, you will see a node like:

```
Filter: can_access_project(project_id, workspace_id)
Rows Removed by Filter: 0
```

For 100 task rows, this means the function is called 100 times. Each call to `can_access_project(project_id)` (the 1-arg variant) internally calls:
1. `SELECT workspace_id FROM projects WHERE id = project_id`
2. Then calls 2-arg variant which runs up to 3 EXISTS queries against `workspace_members` + `project_members`

**Total potential per-row cost:** 3–4 sub-queries × 100 rows = 300–400 additional DB operations hidden in the RLS evaluation.

**Index gaps to verify:**

```sql
-- Check existing indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('workspace_members', 'project_members', 'blocks', 'task_items', 'timeline_events', 'entity_properties');

-- Critical missing indexes to look for:
-- workspace_members(user_id, workspace_id) — for can_access_project EXISTS check
-- workspace_members(workspace_id, user_id) — composite for JOIN order
-- project_members(project_id, user_id)     — for project-level access check
-- task_items(task_block_id, display_order) — for task list query
-- entity_properties(entity_type, entity_id) — for property lookups
-- blocks(tab_id, parent_block_id)          — for getTabBlocks filter
```

**Function optimization opportunity:**

Mark the function `STABLE` (if not already) and add result caching pattern:
```sql
ALTER FUNCTION can_access_project(uuid) STABLE PARALLEL SAFE;
ALTER FUNCTION can_access_project(uuid, uuid) STABLE PARALLEL SAFE;
```

`STABLE` tells Postgres the function returns the same value for the same inputs within a single query, allowing it to cache the result across multiple rows that share the same `project_id`. This is the single highest-value DB optimization for tables with RLS.

---

### 5.3 Server Action Auth Chain Duplication Pattern

The auth audit found these functions with redundant auth queries:

| Function | File | Redundant Pattern | Extra Query Count |
|----------|------|-------------------|------------------|
| `updateBlock` | [block.ts:514](trak/src/app/actions/block.ts#L514) | Fetches block→tab→project→workspace TWICE; workspace_members checked twice | +4 queries (blocks×2, tabs×2, projects×2, workspace_members×1) |
| `getChildBlocks` | [block.ts:100](trak/src/app/actions/block.ts#L100) | Raw `workspace_members` query instead of cached helper | +1 uncached query (should use `checkWorkspaceMembership()`) |
| `createBlock` | [block.ts:208](trak/src/app/actions/block.ts#L208) | Separate project→workspace fetch then workspace_members, duplicating what `requireProjectAccess()` would do in one cached call | +2–3 queries vs cached pattern |
| `deleteBlock` | [block.ts:706](trak/src/app/actions/block.ts#L706) | 3 serial single-row fetches (block→tab→project→workspace_members) | Could be 1 joined query |
| `getEntityProperties` | [entity-property-actions.ts:21](trak/src/app/actions/properties/entity-property-actions.ts#L21) | Calls `getWorkspaceIdForEntity()` (1–2 queries) + `checkWorkspaceMembership()` | 3–4 queries per property read |
| `setEntityProperty` | [entity-property-actions.ts:46](trak/src/app/actions/properties/entity-property-actions.ts#L46) | Same as above — 3–4 auth queries for a single upsert | 3–4 queries per property write |

**Additionally — double auth (app-level AND RLS-level):**

For any server action that:
1. Calls `checkWorkspaceMembership()` → queries `workspace_members`
2. Then queries a table with RLS (blocks, task_items, etc.) → RLS calls `can_access_project()` → re-queries `workspace_members`

This means **every protected data query does at minimum 2 workspace_members lookups**: one app-level, one RLS-level.

**Proposed consolidation for `deleteBlock`:**
```typescript
// Current: 4 serial queries
const block = await supabase.from("blocks").select("tab_id").eq("id", blockId).single();
const tab = await supabase.from("tabs").select("project_id").eq("id", block.tab_id).single();
const project = await supabase.from("projects").select("workspace_id").eq("id", tab.project_id).single();
const member = await supabase.from("workspace_members").select("role").eq("workspace_id", project.workspace_id).single();

// Replace with: 1 joined query
const authCheck = await supabase
  .from("blocks")
  .select("id, tabs!inner(project_id, projects!inner(workspace_id, workspace_members!inner(role)))")
  .eq("id", blockId)
  .eq("tabs.projects.workspace_members.user_id", userId)
  .single();
```

---

## 6. "Instant Feel" Interaction Latency Breakdown

### 6.1 "Change task status"

| Phase | Current Duration | How to Measure | After Fix |
|-------|-----------------|----------------|-----------|
| **Click → UI shows new value (optimistic)** | ~0–16ms | `performance.mark("status-click")` → `performance.mark("status-ui-updated")` in `onMutate` | Same (already optimistic) |
| **Network: `updateTaskItem` server action** | ~80–200ms p50 | `[PERF]` timer in `item-actions.ts` | ~50–120ms (after auth consolidation) |
| **`onSettled` invalidateQueries** | ~0ms (fires, but is async) | React Query Devtools | Eliminated with setQueryData |
| **`getTaskItemsByBlock` refetch (5 round trips)** | ~100–250ms | `[PERF]` timer in query-actions.ts | Eliminated |
| **React re-render (100 rows)** | ~20–50ms | React Profiler "Commit" phase | ~5ms (1 row only, with setQueryData + select) |
| **TOTAL time until settled** | **~200–516ms** | | **~55–136ms** |

**Where time is wasted:** The `invalidateQueries` + full refetch (~200–300ms) for a field that was already updated optimistically is the largest waste. The UI looks correct immediately; the refetch only confirms what the user already sees.

---

### 6.2 "Type in task title"

| Phase | Current Duration | Notes |
|-------|-----------------|-------|
| **Keystroke → local state update** | ~0–5ms | Controlled input in TaskBlock |
| **Debounced `updateTaskItem` fires** | After 300–500ms debounce (if debounced) | Check if debounce exists — if not, fires on every keystroke |
| **Server action round trip** | ~80–200ms | Same as status change |
| **`invalidateQueries` + full refetch** | ~100–250ms | Same problem — refetches all 100 tasks for a title change |
| **100-row re-render** | ~20–50ms | Same problem |

**Key unknown:** Is title editing debounced? Search for `debounce` near `updateTaskItem` calls in `task-block.tsx`. If not debounced, every keystroke fires a server action.

**To measure:** Add `console.count("updateTaskItem fired")` in the mutation function. Type "hello" (5 keystrokes) — expect either 1 call (debounced) or 5 calls (not debounced).

---

### 6.3 "Drag reorder blocks"

| Phase | Current Duration | How to Measure |
|-------|-----------------|----------------|
| **Drag start → visual feedback** | ~0–16ms (pointer sensor requires 8px) | `performance.mark("dragstart")` in `handleDragStart` |
| **Drag over → ghost preview** | ~16ms per frame | React render of `previewInfo` useMemo |
| **Drop → optimistic reorder** | ~0–5ms | `setBlocks(arrayMove(...))` is synchronous |
| **`updateBlock` server action** | ~100–300ms | auth chain (see B1 in V1) |
| **`queryClient.setQueryData(tabBlocks)` on success** | ~0–2ms | Local only |
| **TOTAL until server confirm** | **~100–300ms** | |

**No `router.refresh()` in reorder path** — this is already handled correctly via `handleUpdate`. The main cost is the `updateBlock` auth chain (5 queries before the actual UPDATE).

---

### 6.4 "Switch tabs"

| Phase | Current Duration | How to Measure |
|-------|-----------------|----------------|
| **Click tab link → Next.js navigation start** | ~0–50ms | `performance.mark("tab-link-click")` |
| **Server: `requireWorkspaceAccess`** | ~10–25ms (2 cached queries) | `[PERF]` in page.tsx before allSettled |
| **Server: `Promise.allSettled` (4 parallel)** | ~30–80ms | `[PERF]` wrapping allSettled |
| **Server: `file_attachments` query (if file blocks)** | ~20–60ms SERIAL | `[PERF]` at line 138 |
| **Server: `getBatchFileUrls` (if N files)** | ~20–200ms SERIAL | `[PERF]` at line 155 |
| **HTML streaming starts** | After all serial steps above | |
| **Client hydration** | ~50–150ms | `performance.measure("hydration")` |
| **`useEntityPropertiesWithInheritance` × N blocks** | ~N × 10–30ms (parallel, but N queries) | React Query Devtools |
| **`useWorkspaceMembers` × N blocks (cache miss on first)** | ~1 × 20–50ms (cached after first) | React Query Devtools |
| **TOTAL to interactive** | **~200–800ms** | |

**Biggest opportunities:** The serial `file_attachments` + `getBatchFileUrls` chain adds 40–260ms to TTFB for file-heavy tabs. Moving these into the `Promise.allSettled` removes them from the critical path.

---

## 7. Additional High-ROI Fix Candidates (PR ideas)

### PR5 — Eliminate per-block `useWorkspaceMembers` / `useEntityProperties` calls: hoist to TabCanvas

**Title:** `perf: hoist workspace members + block properties fetch to tab level`

**Objective:** Reduce N parallel `useWorkspaceMembers` and `useEntityPropertiesWithInheritance` queries (one per block) to 1 workspace members query + 1 batch entity properties query at `TabCanvas` level.

**Files touched:**
- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx` — add `useWorkspaceMembers(workspaceId)` and `useEntitiesProperties("block", blockIds)` at top level; pass via new context or prop drilling
- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx` — consume from context instead of calling hooks directly
- `trak/src/lib/hooks/use-property-queries.ts` — ensure `useEntitiesProperties` returns a Map keyed by entityId for O(1) lookup
- New context file: `block-properties-context.tsx` — provides workspace members + block properties map

**Risk level:** Medium — requires new context and prop threading

**Verification checklist:**
- [ ] On tab load with 10 blocks: React Query Devtools shows 1 `workspaceMembers` query (not 10)
- [ ] On tab load: 1 `entitiesProperties` batch query (not N individual queries)
- [ ] Block property badges still display correctly
- [ ] `PropertyMenu` still opens and saves correctly per block
- [ ] Performance: `[PERF]` logs show entity_properties query count drops from N to 1

---

### PR6 — Fix `getChildBlocks`: use cached auth + explicit column projection

**Title:** `fix: getChildBlocks - use cached membership check and explicit columns`

**Objective:** Remove the uncached inline `workspace_members` query and replace `select("*")` with an explicit column projection matching `getTabBlocks`.

**Files touched:**
- `trak/src/app/actions/block.ts` lines 128–143 — replace raw membership query with `checkWorkspaceMembership()`; change `.select("*")` to explicit columns

**Risk level:** Low — behavior identical, only auth call changes from uncached to cached

**Verification checklist:**
- [ ] Section blocks still load their child blocks correctly
- [ ] `[PERF]` timer on `getChildBlocks` membership check drops from ~15ms (uncached) to ~5ms (cached)
- [ ] Response payload for `getChildBlocks` is smaller (no extra columns)
- [ ] Auth still blocks unauthorized users (same result, just uses cached helper)

---

### PR7 — Memoize all context provider values: TabContents, Workspace, Theme

**Title:** `perf: memoize context provider values to eliminate re-render cascades`

**Objective:** Add `useMemo` to all inline context value objects to prevent unnecessary re-renders of context consumers.

**Files touched:**
- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-contents-context.tsx` — wrap `value` in `useMemo`
- `trak/src/app/dashboard/workspace-context.tsx` — wrap `value` in `useMemo`, wrap `switchWorkspace` in `useCallback`
- `trak/src/app/dashboard/theme-context.tsx` — wrap `value` in `useMemo`

**Risk level:** Low — memoization is additive, no behavior change

**Verification checklist:**
- [ ] React Profiler: after toggling `tocExpanded`, only `TableOfContents` and `TabCanvas` re-render (not all context consumers)
- [ ] After workspace switch, only workspace-dependent components re-render
- [ ] `TabContentsProvider` render count (via `console.count`) decreases on block edits
- [ ] All existing functionality (TOC open/close, workspace switch, theme toggle) works correctly

---

### PR8 — Replace systemic `router.refresh()` with React Query cache updates: projects/docs/internal lists

**Title:** `perf: replace router.refresh() with queryClient.setQueryData in list pages`

**Objective:** Eliminate the 98 `router.refresh()` calls that cause full RSC re-renders on CRUD operations. Replace with targeted React Query cache updates for list pages (projects, docs, internal, settings).

**Files touched:**
- `trak/src/app/dashboard/projects/projects-grid.tsx` (6 calls)
- `trak/src/app/dashboard/projects/projects-table.tsx` (6 calls)
- `trak/src/app/dashboard/docs/docs-grid.tsx` (4 calls)
- `trak/src/app/dashboard/docs/docs-table.tsx` (5 calls)
- `trak/src/app/dashboard/internal/internal-grid.tsx` (7 calls)
- `trak/src/app/dashboard/internal/internal-table.tsx` (7 calls)
- `trak/src/lib/react-query/query-client.ts` — add `projectsList`, `docsList`, `internalList` query keys

**Risk level:** Medium — each mutation must correctly update the local cache structure

**Verification checklist:**
- [ ] Create project: appears immediately in list, no Network RSC fetch
- [ ] Delete project: disappears immediately, no Network RSC fetch
- [ ] Update project status/tags: updates in-place, no Network RSC fetch
- [ ] Reload page after mutation: data is consistent (server is source of truth on reload)
- [ ] Network tab: 0 RSC fetch requests after project CRUD operations

---

### PR9 — Move `file_attachments` query into `Promise.allSettled`; make `getBatchFileUrls` parallel

**Title:** `perf: parallelize file URL prefetch on tab page server component`

**Objective:** Remove the serial `file_attachments` → `getBatchFileUrls` chain from the critical TTFB path by extracting file IDs before the parallel fetch and running URL signing concurrently with block/tab/project fetches.

**Files touched:**
- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/page.tsx` — restructure file extraction into pre-pass on block types; add `getBatchFileUrls` as 5th member of `Promise.allSettled`
- `trak/src/app/actions/block.ts` — `getTabBlocks` — optionally include file attachment IDs in block select via join (eliminates separate `file_attachments` query entirely)

**Risk level:** Low-medium — timing change, behavior identical

**Verification checklist:**
- [ ] `[PERF]` log: `getBatchFileUrls` no longer appears after `allSettled` in TTFB timing
- [ ] TTFB drops by ~40–260ms for tabs with file blocks
- [ ] File images still display correctly on tab load
- [ ] File blocks still list their attached files correctly
- [ ] Tabs without file blocks: no regression (getBatchFileUrls skipped as before)

---

### PR10 — Fix `FileUrlContext` signed URL expiry: connect to React Query with 3-minute staleTime

**Title:** `perf/fix: replace static FileUrlContext with React Query-backed useFileUrls hook`

**Objective:** Prevent broken images after the 5-minute Supabase signed URL expiry by managing file URLs in React Query with automatic background refresh before expiry.

**Files touched:**
- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas.tsx` — replace `FileUrlContext.Provider value={initialFileUrls}` with a React Query hook that refetches before expiry
- `trak/src/lib/hooks/use-tab-data.ts` — change `fileUrls` staleTime from `10 * 60 * 1000` to `3 * 60 * 1000` (3 min, before 5-min URL expiry)
- `trak/src/lib/react-query/query-client.ts` — update `fileUrls` key docs

**Risk level:** Low — additive change; initialFileUrls still used as `initialData` in React Query

**Verification checklist:**
- [ ] Open tab with images. Wait 4 minutes. Scroll — no broken images (URLs refreshed at 3-min mark)
- [ ] React Query Devtools: `fileUrls` query shows as "stale" after 3 min, refetches automatically
- [ ] Tab revisit within 3 minutes: 0 `createSignedUrl` calls (served from cache)
- [ ] Tab revisit after 4 minutes: 1 `getBatchFileUrls` call, all URLs valid

---

### PR11 — Module-level constants for `blockTypeOptions` in `BlockWrapper`; eliminate per-render JSX allocation

**Title:** `perf: move blockTypeOptions and galleryLayouts to module-level constants`

**Objective:** Prevent repeated allocation of 11 JSX icon elements per `BlockWrapper` render by moving the arrays to module scope.

**Files touched:**
- `trak/src/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper.tsx` — move `blockTypeOptions` (line 157) and `galleryLayouts` (line 170) above the component function

**Risk level:** Very low — pure refactor, no behavior change

**Verification checklist:**
- [ ] Block type conversion dropdown still lists all block types with correct icons
- [ ] Gallery layout options still appear in gallery block menu
- [ ] Chrome Memory heap snapshot: no short-lived `ReactElement` objects from `blockTypeOptions` in allocation profile

---

### PR12 — Query key mutation fix: `fileIds.sort()` mutates input; stabilize with spread

**Title:** `fix: prevent fileIds array mutation in fileUrls query key`

**Objective:** Fix subtle array mutation bug in `queryKeys.fileUrls` that could cause downstream issues if `fileIds` arrays are reused.

**Files touched:**
- `trak/src/lib/react-query/query-client.ts` line 43 — change `fileIds.sort()` to `[...fileIds].sort()`

**Risk level:** Very low — one-line fix

**Verification checklist:**
- [ ] `fileUrls` query key correctly de-duplicates calls with same file IDs in different orders
- [ ] Original `fileIds` array passed to `queryKeys.fileUrls()` is not mutated after the call
- [ ] File URL queries still cache correctly between renders

---

### Summary Comparison: V1 PR Stack vs V2 PR Stack

| PR | Objective | Expected Latency Impact |
|----|-----------|------------------------|
| PR1 (V1) | Instrumentation + router.refresh() removal (tab-canvas only) | Baseline measurement |
| PR2 (V1) | Tab page critical path + file URL caching | TTFB -50–200ms |
| PR3 (V1) | TaskBlock single RPC + stop invalidations + virtualization | TaskBlock load -150–200ms |
| PR4 (V1) | Table pagination + server search + virtual rows | Table open -2–4s |
| **PR5 (V2)** | Hoist workspace members + block properties to tab level | 10-block tab: -9 redundant queries on mount |
| **PR6 (V2)** | Fix getChildBlocks auth + columns | Section blocks -10–25ms per block |
| **PR7 (V2)** | Memoize all context provider values | Eliminate re-render cascades across tab |
| **PR8 (V2)** | Replace router.refresh() in list pages (projects/docs/internal) | CRUD operations: -200–600ms per action |
| **PR9 (V2)** | Parallelize file URL prefetch in page.tsx | TTFB -40–260ms for file-heavy tabs |
| **PR10 (V2)** | Fix FileUrlContext signed URL expiry | Eliminate broken images after 5 min |
| **PR11 (V2)** | Module-level blockTypeOptions constants | GC pressure reduction on scroll/hover |
| **PR12 (V2)** | Fix fileIds.sort() mutation in query key | Bug fix, no latency impact |

---

## Top 7 Additional Issues Found in V2

Ranked by likely impact on "instant feel":

1. **F3 — 130 `select("*")` calls across 38 action files** — Every wildcard select sends unnecessary JSONB columns (`content`, `data`) over the wire. Fixing the top 10 hot-path calls (tables/row-actions.ts × 11, tasks/query-actions.ts × 2, block.ts × 2, entity-properties.ts × 5) reduces payload size by an estimated 30–60% on most operations.

2. **F4 — `BlockWrapper` fires N parallel `useWorkspaceMembers` + `useEntityPropertiesWithInheritance` per block** — A 10-block tab fires 20 redundant queries on mount. The workspace members query is identical for all blocks (same workspace) and should be fetched once at tab level.

3. **F5 — `TabContentsContext.Provider` value recreated on every render** — Causes cascading re-renders of all `useTabContents()` consumers on every `TabContentsProvider` re-render. A single `useMemo` fix eliminates this. Combined with `WorkspaceContext` (F6) and `ThemeContext`, the provider churn is the primary source of unaccounted re-render time in the profiler.

4. **F1 — `getChildBlocks` uses uncached `workspace_members` query + `select("*")`** — Section blocks are a common pattern; every section mount fires an uncached membership round-trip (~15ms) and fetches all block columns (~2–5× more data than needed). Easy fix with high frequency impact.

5. **F2 — `file_attachments` + `getBatchFileUrls` run serially after the parallel block fetch** — For tabs with file blocks, these 2 serial operations add 40–260ms to TTFB before any HTML streams to the client. Moving them into the existing `Promise.allSettled` call requires ~10 lines of code.

6. **F13 — `FileUrlContext` signed URLs expire after 5 minutes with no refresh mechanism** — A user who reads a long doc with embedded images will see broken images after 5 minutes. The fix (React Query with 3-min staleTime) is straightforward since the infrastructure (`use-tab-data.ts`) already has the `fileUrls` query key defined.

7. **F8 + F10–F12 — Systemic `router.refresh()` in list pages (98 total occurrences)** — Projects, docs, internal, clients, and settings all use `router.refresh()` after every mutation, triggering full RSC re-renders. This is the single most widespread performance pattern and affects every user on every CRUD operation outside the tab canvas. Fixing the 6 highest-traffic files (projects-grid, projects-table, docs-grid, docs-table, internal-grid, internal-table) eliminates ~35 calls and makes list-level mutations feel instant.
