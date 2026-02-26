# Trak Security Surface Mapping

**Purpose:** Extract security-critical architecture for external security audit. No fixes applied.

---

## 1. AUTHENTICATION ARCHITECTURE

### Auth provider
- **Supabase Auth (GoTrue)** — primary and only auth provider.
- **File:** `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/actions.ts`.

### Session model
- **JWT:** Supabase issues JWTs; session is maintained via cookies.
- **Cookies:** Handled by `@supabase/ssr`:
  - `createServerClient` (server/middleware) and `createBrowserClient` (client) use cookie get/set/remove.
  - Current-workspace cookie: `trak_current_workspace` — **httpOnly: true**, **secure** in production, **sameSite: "lax"**, maxAge 1 year.
- **Refresh:** Supabase client handles refresh; middleware does not explicitly implement refresh (relies on Supabase SSR).
- **Code:** `middleware.ts` uses `createServerClient` with cookie API; `src/lib/supabase/server.ts` uses `cookies()` from `next/headers` for get/set/remove.

### Where sessions are verified
- **Middleware** (`middleware.ts`):
  - Does **not** run on API routes (`pathname.startsWith("/api/")` → `NextResponse.next()`).
  - Runs on page routes; uses `supabase.auth.getSession()` and redirects to `/login` if no session.
  - Comment: "Route handlers/components do authoritative auth via getUser()."
- **Server actions:** Use `getServerUser()` (from `@/lib/auth/get-server-user`) or `getAuthenticatedUser()` (from `@/lib/auth-utils`) or direct `supabase.auth.getUser()`.
- **API routes:** Each route decides; many use `requireUser()` from `@/lib/auth/require-user` (throws `UnauthorizedApiError`), others use `createClient()` + `getUser()` or `getAuthenticatedUser()`.

### Workspace access
- **Determination:** `getCurrentWorkspaceId()` reads `trak_current_workspace` cookie (or test context). Workspace list comes from `getUserWorkspaces()` which queries `workspace_members` for the authenticated user.
- **Enforcement:** `updateCurrentWorkspace(workspaceId)` verifies membership via `workspace_members` before setting the cookie. `requireWorkspaceAccess(workspaceId)` and `requireProjectAccess(projectId)` in `src/lib/auth-utils.ts` check membership and project permissions.

### User → workspace membership
- **Enforcement:** App layer: `checkWorkspaceMembership(workspaceId, userId)` in `auth-utils.ts` (queries `workspace_members`). DB layer: RLS uses `is_member_of_workspace(ws_id)` which checks `workspace_members` and `auth.uid()`.

### Custom role system
- **Type:** `public.role` enum: `owner`, `admin`, `teammate` (schema.sql).
- **Usage:** `workspace_members.role`; Slack connection policies restrict insert/update/delete to `owner` or `admin`. Project members: `project_members` table; when present, only listed users + workspace owner have access.

### Row-level security at app layer
- **Pattern:** Server actions and API routes use Supabase client created from request (cookies); RLS runs with `auth.uid()`. No separate “app-layer RLS” beyond membership checks (e.g. `requireWorkspaceAccess`, `requireProjectAccess`, `requireTableAccess`).

### Magic link
- **Not implemented** in codebase. Login uses `signInWithPassword`; signup uses `signUp` with email (email confirmation flow possible via Supabase config, not visible in code).

### OAuth integrations
- **Shopify:** OAuth flow in `src/app/api/shopify/install/route.ts` and `src/app/api/shopify/callback/route.ts`. Tokens stored in `shopify_connections`; access token encrypted (see Section 7).
- **Slack:** OAuth in `src/app/api/slack/install/route.ts`, `src/app/api/slack/callback/route.ts`. Tokens stored in `slack_workspace_connections`; encryption in `src/lib/slack/encryption.ts` (SLACK_TOKEN_ENCRYPTION_KEY).

### Supabase auth config
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). From `src/lib/supabase/env.ts`: `getSupabaseEnv()` returns url, anonKey, serviceRoleKey.

---

## 2. MULTI-TENANCY MODEL

### Workspace isolation
- **Primary key:** `workspace_id` on most tenant tables (projects, tables, blocks, clients, etc.). RLS policies use `is_member_of_workspace(workspace_id)` or `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`.
- **Project-level:** `can_access_project(project_id)` / `can_access_project(project_id, workspace_id)` — workspace membership + either workspace owner, or no project_members (open to all), or in project_members.

### Where workspaceId comes from
- **Client:** Dashboard gets current workspace from `/api/workspaces/current` (returns cookie value); cookie is set only after `updateCurrentWorkspace(workspaceId)` which verifies membership.
- **Server actions:** Typically use `getCurrentWorkspaceId()` (cookie) or receive `workspaceId` as argument; actions that accept `workspaceId` should validate membership (e.g. `checkWorkspaceMembership`, or RLS when using user-scoped client).

### Where workspaceId is trusted
- **Trusted after check:** When setting cookie (`updateCurrentWorkspace`) and in server actions that call `requireWorkspaceAccess(workspaceId)` or equivalent. RLS does not trust client-supplied workspaceId; it uses `auth.uid()` and `workspace_members`.
- **API routes:** e.g. Shopify install validates membership before storing state; AI stream uses `getCurrentWorkspaceId()` (cookie) then runs tools with that context — RLS still applies to DB calls.

### Cross-workspace access prevention
- **DB:** RLS ensures rows are visible/editable only when `is_member_of_workspace(workspace_id)` (or project equivalent). Service role bypasses RLS — used only in controlled server paths (Slack, client-comments, bootstrap fallback, etc.).
- **App:** Membership checked before setting workspace cookie and in `requireWorkspaceAccess` / `requireProjectAccess`.

### Edge cases
- **Service role usage:** Any use of `createServiceClient()` bypasses RLS; must be audited per call site (see Section 3).
- **Client page (public token):** Access to projects/tabs/blocks is by `public_token` + `client_page_enabled`; RLS has “Public can view …” policies for blocks/tabs/projects when `is_client_visible` / `client_page_enabled` and `public_token` match. Service role used for some client-page file fetches.

### RLS helper (full SQL)
```sql
-- is_member_of_workspace (schema.sql)
CREATE FUNCTION public.is_member_of_workspace(ws_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  );
$$;

-- can_access_project (two-arg and one-arg)
CREATE FUNCTION public.can_access_project(project_id_param uuid, workspace_id_param uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT
    public.is_member_of_workspace(workspace_id_param)
    AND (
      EXISTS (SELECT 1 FROM public.workspaces ws WHERE ws.id = workspace_id_param AND ws.owner_id = auth.uid())
      OR NOT EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_id_param)
      OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_id_param AND pm.user_id = auth.uid())
    );
$$;

CREATE FUNCTION public.can_access_project(project_id_param uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id_param AND public.can_access_project(p.id, p.workspace_id)
  );
$$;
```

### Schema relationships
- **FKs:** projects.workspace_id → workspaces.id; tabs.project_id → projects.id; blocks.tab_id → tabs.id; tables.project_id → projects.id; etc. Cascade deletes used (e.g. ON DELETE CASCADE on project_members, workspace_teams).

---

## 3. DATABASE SECURITY

### Full list of public tables (from schema.sql)
- app_config, app_settings, block_highlights, block_references, blocks, client_page_views, client_tab_blocks, client_tabs, clients, comments, dashboard_ai_insights, doc_folders, docs, entity_inherited_display, entity_links, entity_properties, entity_properties_legacy, file_analysis_artifacts, file_analysis_chunks, file_analysis_citations, file_analysis_messages, file_analysis_session_files, file_analysis_sessions, file_attachments, file_comments, files, google_calendar_connections, indexing_jobs, internal_space_groups, oauth_states, payment_events, payments, profiles, project_folders, project_members, project_tags, projects, shopify_connections, shopify_sync_jobs, slack_command_audit_log, slack_idempotency_keys, slack_rate_limits, slack_user_links, slack_workspace_connections, tab_shares, table_comments, table_fields, table_relations, table_rows, table_views, tables, tabs, task_assignees, task_comments, task_items, task_references, task_subtask_references, task_subtasks, task_tag_links, task_tags, timeline_dependencies, timeline_events, timeline_references, trak_product_inventory, trak_product_sales_cache, trak_product_variants, trak_products, unstructured_chunks, unstructured_parents, workflow_messages, workflow_sessions, workspace_invitations, workspace_members, workspace_team_members, workspace_teams, workspaces.

### Tables with RLS enabled (from schema.sql ALTER TABLE list)
- All auth.* tables listed in schema; public: block_highlights, block_references, blocks, client_page_views, client_tab_blocks, client_tabs, clients, comments, dashboard_ai_insights, docs, entity_inherited_display, entity_links, entity_properties, entity_properties_legacy, file_analysis_*, file_attachments, file_comments, files, google_calendar_connections, indexing_jobs, payment_events, payments, profiles, project_folders, project_members, project_tags, projects, shopify_*, slack_*, tab_shares, table_*, task_*, timeline_*, trak_product_*, unstructured_*, workflow_*, workspace_invitations, workspace_members, workspaces (policies exist for workspace_members and workspaces; RLS enabled).
- storage.*: buckets, objects, etc. have RLS.

### Tables that may NOT have RLS (present in CREATE TABLE but not in ALTER RLS list in schema / no policies found in grep)
- **app_config** — no RLS policy found; stores key/value (e.g. shopify_sync_url, cron_secret).
- **app_settings** — no RLS policy found; stores indexing_worker_url, cron_secret, etc.
- **doc_folders** — migration creates table; RLS not found in migrations grep.
- **internal_space_groups** — no RLS policy found.
- **oauth_states** — no RLS policy found; stores state for OAuth flows.
- **workspace_teams** — migration does not enable RLS.
- **workspace_team_members** — migration does not enable RLS.

**Recommendation for auditor:** Run on DB:
```sql
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY c.relname;
```

### RLS policies (representative; full set in schema.sql)
- **workspaces:** sel_workspaces (SELECT USING is_member_of_workspace(id)), ins_workspaces (INSERT WITH CHECK auth.uid() = owner_id), upd_workspaces (USING is_member_of_workspace(id)), del_workspaces (USING auth.uid() = owner_id).
- **workspace_members:** sel_wm (SELECT USING is_member_of_workspace(workspace_id)), ins_wm (INSERT WITH CHECK exists workspace and inviter is owner/admin), upd_wm, del_wm (USING is_member_of_workspace(workspace_id)).
- **projects:** can_access_project(id, workspace_id) for SELECT/UPDATE/DELETE; INSERT by workspace members.
- **blocks:** Via tabs → can_access_project(t.project_id) for SELECT/INSERT/UPDATE/DELETE; plus “Public can view blocks in client-visible tabs” when project has client_page_enabled and public_token.
- **client_page_views:** “Anyone can track client page views” FOR INSERT WITH CHECK (true) — intentional for analytics.
- **slack_command_audit_log:** “Service can insert audit logs” WITH CHECK (true); “Admins can view audit logs for their workspace” via connection + workspace_members.

### Service role usage (where used)
- **src/lib/supabase/service.ts** — `createServiceClient()` used by:
  - **tables/bootstrap** — when user has access but RLS returns “Table not found”, fallback to service to load table and re-check membership.
  - **client-comments** — POST/PATCH/DELETE for unauthenticated client comments (validated by publicToken + block → tab → project, comments enabled).
  - **revalidate-client-page** — resolve project by publicToken.
  - **file.ts** — `getBatchFileUrlsPublic` (signed URLs for client page files).
  - **block.ts** — `getTabBlocksPublic`, `getBatchFileUrlsPublic` (public token flows).
  - **client/[publicToken]/page.tsx** and **client/[publicToken]/[tabId]/page.tsx** — file attachments for client page.
  - **client/[publicToken]/workflow/[workflowPageId]/page.tsx** — project/tab for workflow client page.
- **Slack:** `src/app/api/slack/commands/route.ts`, `src/app/api/slack/interactive/route.ts`, `src/lib/slack/rate-limiter.ts`, `src/lib/slack/idempotency.ts`, `src/lib/slack/audit.ts`, `src/lib/ai/slack-executor.ts` — service client for Slack-to-workspace resolution and AI execution.
- **Shopify:** `src/lib/shopify/sync-worker.ts`, `src/app/api/shopify/sync/worker/route.ts` — background sync with service client.
- **Auth test mode:** `get-server-user.ts`, `auth-utils.ts`, `server.ts` — when ENABLE_TEST_MODE/test context, service client used to resolve user by ID.

### Anon vs service key
- **Anon:** Browser client (`createBrowserClient`), server client in request context (`createServerClient` with cookies). All DB access subject to RLS with auth.uid().
- **Service:** Only in server-side code paths listed above; never exposed to client.

### Direct SQL execution
- No raw SQL execution found in app code; all DB access via Supabase client (PostgREST). RPCs called via `supabase.rpc(...)`.

### RPC functions and SECURITY DEFINER- **Actual SECURITY DEFINER functions (from live DB query):**

| Schema            | Function name                         | Notes |
|-------------------|----------------------------------------|--------|
| graphql           | get_schema_version                     | Extension |
| graphql           | increment_schema_version               | Extension |
| pgbouncer         | get_auth                               | Connection auth |
| public            | cleanup_expired_oauth_states           | Deletes from oauth_states |
| public            | cleanup_expired_slack_idempotency_keys | Slack idempotency cleanup |
| public            | cleanup_unstructured_on_source_delete  | Trigger; deletes unstructured_* rows |
| public            | handle_new_user                        | Trigger on auth.users (e.g. create profile) |
| public            | match_unstructured_parents             | Search/embedding (2 overloads) |
| public            | set_task_item_display_order            | Trigger |
| public            | trigger_indexing_worker_http           | Calls HTTP worker (indexing) |
| public            | trigger_shopify_sync_worker            | Calls HTTP worker (Shopify sync) |
| storage           | delete_leaf_prefixes                   | Storage extension |
| supabase_functions| http_request                           | Edge/HTTP |
| vault             | create_secret, update_secret           | Vault extension |

- **Audit focus (public schema):** `trigger_indexing_worker_http` and `trigger_shopify_sync_worker` invoke external URLs (from app_settings/app_config); ensure URL and cron_secret are not user-controllable. `handle_new_user` runs as definer on signup. `cleanup_*` and `match_unstructured_parents` run with definer rights — confirm they only touch intended rows (e.g. cleanup by expiry/source, match by RLS or internal IDs).

---

## 4. API & SERVER ACTION SURFACE

### Next.js API routes (all under src/app/api)

| Path | Auth | Input validation | Rate limit | workspaceId | Role |
|------|------|------------------|------------|-------------|------|
| auth/current-user | getServerUser() | — | — | — | — |
| ai/route | requireUser() | body (command, etc.) | — | from getCurrentWorkspaceId() | — |
| ai/stream | requireUser() | body command, projectId, tabId, contextBlockId | — | cookie | — |
| ai/search | requireUser() | — | — | — | — |
| ai/warmup | requireUser() | — | — | — | — |
| ai/undo | requireUser() | — | — | — | — |
| blocks/children | createClient + getUser() | — | — | — | — |
| blocks/single | — | — | — | — | — |
| blocks/tab | createClient + getUser() | — | — | — | — |
| blocks/templates | — | — | — | — | — |
| client-comments | **None** (public) | publicToken, blockId, text, authorName, visitorId; length 2000 | 10/5min per visitorId+IP | — | Validated via block→tab→project + public_token |
| docs/all | supabase.auth.getUser() | — | — | — | — |
| docs/single | supabase.auth.getUser() | — | — | — | — |
| entities/properties | — | — | — | — | — |
| file-analysis/route | getAuthenticatedUser, getCurrentWorkspaceId | sessionId, message, tabId, projectId, fileIds, mode | — | cookie | — |
| file-analysis/comments | — | — | — | — | — |
| files/batch-urls | supabase.auth.getUser() | — | — | — | — |
| files/block | supabase.auth.getUser() | — | — | — | — |
| internal/indexing/status | requireUser() | — | — | — | — |
| internal/indexing/worker | Bearer CRON_SECRET or dev | — | — | — | — |
| internal/indexing/backfill | requireUser() | — | — | — | — |
| projects | requireUser() | — | — | — | — |
| slack/install | getAuthenticatedUser | — | — | — | — |
| slack/callback | state in DB | code, state | — | — | — |
| slack/commands | **No user auth** — verifySlackSignature + rate limit | body | Slack rate limit (user/team) | from connection | — |
| slack/interactive | **No user auth** — verifySlackSignature | body | — | from connection | — |
| slack/disconnect | — | — | — | — | — |
| shopify/install | getAuthenticatedUser | shop, workspace_id | — | validated membership | — |
| shopify/callback | **No session** — HMAC + state from DB | code, hmac, shop, state | — | from oauth_states | — |
| shopify/disconnect | — | — | — | — | — |
| shopify/sync/worker | Bearer CRON_SECRET or dev | — | — | — | — |
| tab-blocks/[tabId] | createClient + getUser() | tabId path | — | — | — |
| tables/bootstrap | getUser() then requireTableAccess | tableId query | — | via table | — |
| tables/data | — | — | — | — | — |
| task-blocks/[blockId]/items | — | — | — | — | — |
| tabs/project | — | — | — | — | — |
| weather | **None** | lat, lon query | — | — | — |
| workflow/execute | requireUser() | — | — | — | — |
| workflow/stream | requireUser() | — | — | — | — |
| workflow/messages | requireUser() | — | — | — | — |
| workspaces/current | **None** | — | — | Returns cookie value | — |
| workspaces/members | getServerUser() + workspaceId param | — | — | validated | — |
| debug-workspaces | createClient() (session) | — | — | — | Exposes workspaces + profiles (RLS filters) |
| supabase-ping | createClient(); getSession() | — | — | — | Debug |
| populate-buckeye | createClient() (session) | — | — | — | Dev/seed |
| test-search | — | — | — | — | — |
| qa | — | — | — | — | — |

**Notes:**
- **workspaces/current:** No auth check; returns `{ data: { workspaceId: cookie value } }`. Cookie is httpOnly and set only after membership check elsewhere.
- **client-comments:** Public; auth is publicToken + block→project validation and rate limit.
- **weather:** No auth; proxies to open-meteo (lat/lon).
- **Slack/Shopify webhooks:** Authenticated by signature/HMAC and state, not user session.

### Server actions
- **Location:** `src/app/actions/` (e.g. workspace.ts, block.ts, file.ts, project.ts, tab.ts, tasks/*, tables/*, timelines/*, properties/*, client.ts, doc.ts, etc.).
- **Auth:** Almost all use `getServerUser()` or `getAuthenticatedUser()` or direct `createClient()` + `getUser()` at start; many then check workspace or project access.
- **workspaceId:** Usually from `getCurrentWorkspaceId()` (cookie) or passed in and validated (e.g. `checkWorkspaceMembership`).

### Edge functions
- None in this repo (Next.js API routes and server actions only).

### Webhooks
- **Slack:** `/api/slack/commands`, `/api/slack/interactive` — verified by `verifySlackSignature(body, signature, timestamp)` (HMAC-SHA256, replay window 5 min).
- **Shopify:** No inbound webhook route found; outbound: sync worker called by cron or manually.

### AI tool invocation
- **Paths:** POST /api/ai/stream, POST /api/ai/route; workflow execute/stream/messages. All require `requireUser()`. Tools executed in `tool-executor.ts` with context.workspaceId (from cookie) and authContext (user’s supabase or Slack service client).

---

## 5. INPUT VALIDATION & SANITIZATION

### Validation libraries
- **Zod:** Used in some places (e.g. `src/app/actions/tables/validators.ts`, file-analysis route, slack interactive). Not uniformly applied to all API routes.
- **Custom:** Many routes check `typeof x === "string"`, presence of params, length limits (e.g. comment 2000 chars).

### Where validation happens
- **client-comments:** `validateIncomingComment` (trim, length ≤ 2000); body fields checked for string type.
- **File upload (server action):** `validateFileType(file)` allowlist MIME + extensions; BLOCKED_EXTENSIONS list; max size 50MB.
- **Shopify install:** `isValidShopDomain(shop)` (*.myshopify.com); workspace_id required; membership check.
- **Shopify callback:** HMAC verification; state from DB; shop match.
- **Slack:** Signature verification; body parsed as JSON.

### Endpoints with minimal or no validation
- **workspaces/current:** No body; no auth.
- **weather:** Only lat/lon presence; no range or format check.
- **debug-workspaces:** No input.
- **Several GET routes:** Only query param presence (e.g. tableId); type/length not always validated.

### Rich text sanitization
- **Text block:** `src/app/dashboard/projects/[projectId]/tabs/[tabId]/text-block.tsx` uses DOMPurify: `DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong','em','code','u','h1','h2','h3','p','div','span','br','a'], ALLOWED_ATTR: ['class','href','title','data-ref-link','data-ref-id','target','rel'], KEEP_CONTENT: true })`.

### File uploads
- **Max size:** 50MB (`MAX_FILE_SIZE = 50 * 1024 * 1024` in file.ts).
- **Validation:** Allowlist of MIME types and extensions; BLOCKED_EXTENSIONS (e.g. .exe, .js, .sh, .ps1, .dll).
- **Storage:** Supabase Storage bucket `files`; path `{workspaceId}/{projectId}/{fileId}.{ext}`. Upload uses user-scoped Supabase client (RLS on storage applies if configured).
- **Signed URLs:** `getBatchFileUrlsPublic` uses service client to create signed URLs (e.g. 5 min expiry) for client page file access after validating project by public token.

### Storage bucket permissions
- Not fully visible in repo; RLS on storage.objects is enabled in schema. Recommend checking Supabase dashboard / storage policies.

---

## 6. AI EXECUTION SURFACE

### How AI tools are defined
- **File:** `src/lib/ai/tool-definitions.ts`. Tools grouped by category (search, control, task, project, table, timeline, block, tab, doc, property, file, comment, client, workspace, payment, shopify). Each tool has name, description, parameters, requiredParams. Converted to OpenAI format via `toOpenAIFormat` / `getToolsByGroups`.

### Where tool permissions are enforced
- **Intent / tool groups:** Executor uses intent classification and tool groups; not all tools are exposed every time (e.g. “requestToolGroups” can request more). No separate permission layer beyond “user is authenticated and has a workspace.”
- **Execution:** `executeTool` in `tool-executor.ts` receives `ToolExecutionContext` (workspaceId, userId, authContext). workspaceId from `getCurrentWorkspaceId()` (cookie) or context; authContext from `getAuthContext()` (user’s supabase) or from Slack (service client). All tool implementations are server actions or internal functions that use this authContext/supabase; RLS applies when using user-scoped client.

### Can AI call privileged APIs?
- **No direct service-role in tool path for normal dashboard flow:** Dashboard AI uses `requireUser()` then `getCurrentWorkspaceId()` and user’s supabase (from cookies). So AI uses the same RLS as the user.
- **Slack flow:** `slack-executor.ts` uses service client and builds AuthContext with it (“bypasses RLS for Slack commands”); workspace and user are resolved from Slack connection and slack_user_links. So AI in Slack context runs with elevated DB access for that workspace’s data.

### Can AI access cross-workspace data?
- **Dashboard:** No; workspaceId is from cookie (user’s current workspace). No tool accepts arbitrary workspaceId from the model.
- **Slack:** Workspace is determined by Slack team_id → slack_workspace_connections → workspace_id; not user-supplied.

### Tool-to-database flow
- Tools call server actions (e.g. searchTasks, createTaskItem, updateBlock). Those use `authContext.supabase` or create client from request. So DB access is either user-scoped (RLS) or Slack service client (one workspace per command).

### Guardrails
- **Write confirmation:** Optional `requireWriteConfirmation` and `approvedWriteAction` in stream route.
- **Max tool iterations:** MAX_TOOL_ITERATIONS = 25 in executor.
- **JSON repair:** repairJSONArguments for enum-like params. No explicit prompt injection mitigation in code (no documented escaping/sandboxing of user command before sending to LLM).

### User identity in AI execution
- **Dashboard:** user.id and workspaceId from requireUser() and getCurrentWorkspaceId(); passed into ExecutionContext and then to executeTool. authContext carries userId and supabase.
- **Slack:** User resolved via is_slack_user_linked(team_id, slack_user_id); workspace from connection; AuthContext built with service client and that user.

---

## 7. SHOPIFY INTEGRATION

### OAuth flow
- **Install:** GET `/api/shopify/install?shop=&workspace_id=`. Authenticated user; validate shop domain; check workspace membership; store state in `oauth_states` (state, nonce, workspace_id, user_id, provider, metadata.shop, expires_at 5 min); redirect to Shopify authorize URL with client_id, scope, redirect_uri, state.
- **Callback:** GET `/api/shopify/callback`. Verify HMAC; load state from DB; check expiry and shop match; exchange code for token; fetch shop metadata; encrypt token; upsert `shopify_connections`; delete state; enqueue sync job; redirect to integrations page.

### Token storage
- **Table:** `shopify_connections` (workspace_id, shop_domain, access_token_encrypted, encryption_key_id, scopes, etc.).
- **Encryption:** `src/lib/shopify/encryption.ts` — AES-256-GCM; key from `SHOPIFY_TOKEN_ENCRYPTION_KEY` (env, base64 32 bytes). Format: base64(iv):base64(authTag):base64(ciphertext). decryptToken / encryptToken.

### Webhook verification
- No inbound Shopify webhook route in repo (only OAuth callback).

### HMAC validation
- **File:** `src/app/api/shopify/callback/route.ts`. `verifyHmac(query, hmacToVerify)`: build message from query params (exclude hmac/signature, sort, key=value&); HMAC-SHA256 with SHOPIFY_CLIENT_SECRET; timing-safe compare with `timingSafeEqual` from encryption.ts.

### Token refresh
- Not implemented in code (Shopify access tokens are long-lived; no refresh flow in repo).

### Scopes
- `read_products,read_inventory,read_orders` in install route.

---

## 8. DASHBOARD & ROLLUP SECURITY

### Aggregation scoping
- **Dashboard overview:** Data passed as props (projects, docs, tasks, dueAwareItems) from parent; parent typically uses server components and getServerUser() and workspace-scoped queries.
- **Dashboard insights:** `getDashboardInsights(workspaceId)` and `generateDashboardInsights(context)` use getServerUser() and supabase; queries `dashboard_ai_insights` by workspace_id. `gatherDashboardOverviewData` uses search-style actions (searchTasks, searchTimelineEvents, searchProjects) with same auth; workspaceId from context.

### Cross-project / cross-workspace leak
- **Design:** Dashboard and rollups use current workspace (cookie) or workspaceId from context; no arbitrary workspace selection in aggregation endpoints. Rollup actions (e.g. computeRollupValue in tables/rollups) operate on table/row; table access should be gated by project/workspace (requireTableAccess / RLS).

### Initiative rollups
- Rollups are table-field-level (formula/rollup fields). Scope is the table’s project/workspace via RLS and requireTableAccess.

### Configurable dashboards
- No configurable “arbitrary table” dashboard found; dashboard shows fixed overview and AI insights. Table views and charts are scoped to tables user can access.

---

## 9. RATE LIMITING & ABUSE PROTECTION

### Implemented
- **client-comments:** 10 requests per (visitorId + IP) per 5 minutes (`src/lib/rate-limit.ts` checkRateLimit). In-memory sliding window.
- **Slack:** `src/lib/slack/rate-limiter.ts` — per user and per team limits (SLACK_RATE_LIMIT_PER_USER_PER_MINUTE, SLACK_RATE_LIMIT_PER_TEAM_PER_MINUTE; default 20 and 100). Uses Supabase (slack_rate_limits table) with service client.

### Not implemented (as seen in code)
- No rate limiting on login/signup.
- No rate limiting on AI stream/route.
- No rate limiting on file upload (beyond single-request size).
- No global API rate limit.

### Comment in code
- `src/app/actions/dashboard-insights.ts`: “TODO: Add rate limiting check here” (generateDashboardInsights).

---

## 10. ENVIRONMENT & DEPLOYMENT SECURITY

### Environment variables (redact secrets)
- **NEXT_PUBLIC_SUPABASE_URL** — exposed to client.
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** — exposed to client.
- **SUPABASE_SERVICE_ROLE_KEY** — server only.
- **NEXT_PUBLIC_APP_URL** — exposed; used for redirects.
- **SHOPIFY_CLIENT_ID**, **SHOPIFY_CLIENT_SECRET** — server.
- **SHOPIFY_TOKEN_ENCRYPTION_KEY** — server (32-byte base64).
- **SLACK_CLIENT_ID**, **SLACK_CLIENT_SECRET**, **SLACK_SIGNING_SECRET** — server.
- **SLACK_TOKEN_ENCRYPTION_KEY** — server.
- **CRON_SECRET** — server (Shopify sync worker, indexing worker).
- **OPENAI_API_KEY**, **DEEPSEEK_API_KEY** — server (AI).
- **PERF_DEBUG**, **AI_DEBUG**, **AI_TIMING**, **NODE_ENV**, **ENABLE_TEST_MODE**, **DISABLE_RPC**, **AI_*** (various) — server/config.
- **DEEPSEEK_MODEL**, **OPENAI_MODEL**, **FILE_ANALYSIS_***, etc. — server.

### Exposed to client
- NEXT_PUBLIC_* only (URL, anon key, APP_URL). Service role and all secrets are server-only.

### Vercel config
- Not present in repo; next.config.mjs has no security headers. **CSP/CORS:** No Content-Security-Policy or CORS configuration found in codebase.

### Service role in client code
- None; createServiceClient and SUPABASE_SERVICE_ROLE_KEY are only used in server-side files.

### Logging
- `src/lib/logger.ts`; console.error/console.log in many routes. Some logs include projectId, tableId, userId, workspaceId; no systematic redaction of PII in the code reviewed.

---

## 11. KNOWN SECURITY WEAKNESSES / NOTES

- **TODO rate limiting:** dashboard-insights.ts: “TODO: Add rate limiting check here.”
- **TODO invitation email:** workspace.ts: “TODO: Send invitation email (placeholder).”
- **Debug routes:** `/api/debug-workspaces` returns workspaces and profiles (RLS limits to current user’s data but route does not requireUser()). `/api/supabase-ping` exposes session presence. `/api/populate-buckeye` mutates DB with session client (dev/seed).
- **Weather API:** No auth; public proxy to open-meteo (low sensitivity).
- **workspaces/current:** No explicit auth; relies on cookie (httpOnly) and prior membership check when cookie was set.
- **Development bypass:** Shopify sync worker: “Allow manual trigger in development” when NODE_ENV === "development" without CRON_SECRET. Same pattern in internal indexing worker.
- **Service role fallback in tables/bootstrap:** When RLS returns “Table not found”, route falls back to service client and re-checks membership; intended to handle RLS edge cases but increases service-role surface.
- **Slack executor:** Comment “Create AuthContext with service client (bypasses RLS for Slack commands)” — intended but worth auditing that workspace/user are never taken from untrusted input.
- **File action comment:** “Uses service role client to bypass RLS” in file.ts for getBatchFileUrlsPublic — ensure callers only pass project/token that have been validated.
- **Tables without RLS (candidate):** app_config, app_settings, doc_folders, internal_space_groups, oauth_states, workspace_teams, workspace_team_members — recommend DB check and, if confirmed, add RLS or restrict access.
- **No CSP/CORS documented** — recommend defining security headers for production.

---

## APPENDIX: SQL FOR REMOTE SUPABASE AUDIT

Run these on the target Supabase (public schema) to confirm RLS and function security.

### Tables without RLS
```sql
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;
```

### All RLS policies (names and definitions)
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### SECURITY DEFINER functions
```sql
SELECT n.nspname AS schema_name, p.proname AS function_name, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
ORDER BY n.nspname, p.proname;
```

### Tables with RLS enabled (list)
```sql
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
ORDER BY c.relname;
```

---

**End of security surface mapping.** Use this document together with code and live DB checks for a full audit.
