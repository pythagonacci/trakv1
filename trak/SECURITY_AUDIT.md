# Pre-Launch Security Hardening Audit

**Date**: 2026-02-24  
**Scope**: Full codebase audit of `/Users/amnaahmad/devwt/trak`  
**Threat Model**: Authenticated attacker with free account, cross-workspace access attempts, crafted API calls, prompt injection, Slack payload manipulation

---

## 🔴 CRITICAL — Data Exfiltration / Cross-Tenant Access / Privilege Escalation

---

### C-1: `ENABLE_TEST_MODE` Env Var Creates Full Service-Role Auth Bypass

**Attack scenario**: If `ENABLE_TEST_MODE=true` is set in production (or remains in `.env.local` during deployment), `server.ts` returns a **service-role Supabase client** (bypasses ALL RLS) instead of a user-scoped one. Combined with the `testUserContext` module-level variable in `auth-utils.ts`, an attacker who can trigger any code path that calls `setTestUserContext()` can impersonate any user.

**Code paths**:
- [server.ts:28-58](file:///Users/amnaahmad/devwt/trak/src/lib/supabase/server.ts#L28-L58) — `isTestMode && isTestEnvironment` returns service client
- [auth-utils.ts:27-38](file:///Users/amnaahmad/devwt/trak/src/lib/auth-utils.ts#L27-L38) — `ENABLE_TEST_MODE` check in `getAuthenticatedUser`
- [tool-executor.ts:240](file:///Users/amnaahmad/devwt/trak/src/lib/ai/tool-executor.ts#L240) — `shouldUseTestContext` is module-level constant
- [workspace.ts:36,54](file:///Users/amnaahmad/devwt/trak/src/app/actions/workspace.ts#L36) — workspace actions also check this

**Why it works**: The `ENABLE_TEST_MODE` env var is checked against `process.env` at runtime, not compile-time. If deployed with this var set, *every* request gets service-role access. The `setTestUserContext()` and `enableTestMode()` functions are exported server actions — if they can be called via form submission or RPC, the attacker controls which userId is impersonated.

**Severity justification**: Full RLS bypass + user impersonation = complete data exfiltration across all tenants.

**Remediation**:
1. **Remove `ENABLE_TEST_MODE` from all deployed environments** — verify `.env.local` is never copied to production
2. Gate test mode behind `NODE_ENV === 'test'` only (not an additional env var)
3. **Remove the exported `setTestUserContext()` and `enableTestMode()` functions** or make them non-exported, non-server-action utilities that only work in test harnesses
4. Add a startup assertion: `if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TEST_MODE) throw new Error('...')`

---

### C-2: `server.ts` Silent Fallback to Service-Role Client on Cookie Failure

**Attack scenario**: When `createClient()` in `server.ts` fails to read cookies (line 95-132), it silently falls back to a **service-role client**. Any code path that calls `createClient()` outside a proper Next.js request context (scripts, edge cases, race conditions) gets full database access bypassing RLS.

**Code path**: [server.ts:95-132](file:///Users/amnaahmad/devwt/trak/src/lib/supabase/server.ts#L95-L132)

```typescript
} catch {
  // If cookies() fails, we're not in a request context
  // Fall back to service client (useful for scripts)
  const client = createServiceClient(supabaseUrl, supabaseKey, { ... });
  return client;
}
```

**Why it works**: The catch block wraps `cookies()` which can throw in various contexts. If any API route or server action runs in a context where `cookies()` is unavailable, it silently escalates to service role. There's no logging distinguishing this from normal operation.

**Severity justification**: Silent privilege escalation to full database access, bypassing all RLS policies.

**Remediation**:
1. **Remove the service-role fallback entirely** from `createClient()` — it should throw on cookie failure
2. Move script-only service-client usage to `createServiceClient()` from `service.ts` explicitly
3. Add error logging when the fallback triggers, so you detect it in production

---

### C-3: Slack Executor Uses Service Role to Bypass All RLS

**Attack scenario**: The Slack executor at [slack-executor.ts:39](file:///Users/amnaahmad/devwt/trak/src/lib/ai/slack-executor.ts#L39) creates a raw service-role Supabase client and passes it as `authContext` to `executeAICommand`. This means every tool call from a Slack command runs with **zero RLS enforcement**. A malicious Slack user (linked to any Trak account) can execute AI commands that read/write data across all workspaces.

**Code path**: [slack-executor.ts:39,131-134](file:///Users/amnaahmad/devwt/trak/src/lib/ai/slack-executor.ts#L39)

```typescript
const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// ...
const authContext: AuthContext = {
  supabase, // SERVICE ROLE — bypasses RLS
  userId: params.userId,
  workspaceId: params.workspaceId,
};
```

**Why it works**: The `authContext.supabase` is a service-role client, but `tool-executor.ts` uses this client for ALL database operations when `authContext` is provided. There's no secondary RLS enforcement in the tool executor — it trusts the provided Supabase client.

**Exploit example**: Linked Slack user sends `/trak search all tasks` — the service-role client returns tasks from ALL workspaces, not just the linked one. Since the `workspaceId` filter is applied via `WHERE` clauses in some search functions but not all, cross-tenant data could leak.

**Severity justification**: Cross-tenant data access via Slack integration with service-role bypass.

**Remediation**:
1. Create a **workspace-scoped service client** that adds automatic `workspace_id` filtering to all queries
2. Or use an anon-role client with the user's JWT (create a session for the linked Trak user)
3. Audit every search/write function called by the executor to ensure it filters by `workspaceId` when using service client

---

## 🟠 HIGH — Service Role Misuse / Token Compromise / Write Escalation

---

### H-1: `/api/debug-workspaces` Leaks Workspace and Profile Data Without Auth

**Attack scenario**: The route at [debug-workspaces/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/debug-workspaces/route.ts) has NO authentication check. It calls `createClient()` and queries `workspaces` and `profiles` tables. Due to the service-role fallback in `server.ts` (C-2), this could return data from ALL workspaces.

**Code path**: [debug-workspaces/route.ts:5-16](file:///Users/amnaahmad/devwt/trak/src/app/api/debug-workspaces/route.ts#L5-L16)

**Why it works**: No `requireUser()`, no auth check, no rate limiting. Middleware skips all `/api/` routes (line 36-38 in `middleware.ts`).

**Severity justification**: Information disclosure of workspace names/IDs and user profile data.

**Remediation**: **Delete this route entirely** before launch. It is a development debugging endpoint.

---

### H-2: `/api/populate-buckeye` Seed Endpoint Exposed Without Auth

**Attack scenario**: [populate-buckeye/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/populate-buckeye/route.ts) creates subtabs, blocks, and task items in any workspace containing a "buckeye" project — with no authentication check. An attacker can POST to this endpoint to create spam data.

**Code path**: [populate-buckeye/route.ts:7](file:///Users/amnaahmad/devwt/trak/src/app/api/populate-buckeye/route.ts#L7) — `POST()` with no auth

**Severity justification**: Unauthenticated write to user data / spam injection.

**Remediation**: **Delete this route entirely** — it's a development seed script.

---

### H-3: Shopify Sync Worker GET Endpoint — No Auth, Leaks Job Status

**Attack scenario**: The GET handler at [shopify/sync/worker/route.ts:103-152](file:///Users/amnaahmad/devwt/trak/src/app/api/shopify/sync/worker/route.ts#L103-L152) has **no authentication**. It creates a service-role client and returns Shopify sync job status for ALL workspaces. An attacker can:
1. Enumerate sync job states
2. Determine which workspaces have Shopify integrations
3. Infer business information from sync patterns

**Code path**: [shopify/sync/worker/route.ts:103-152](file:///Users/amnaahmad/devwt/trak/src/app/api/shopify/sync/worker/route.ts#L103-L152)

**Severity justification**: Unauthenticated information leakage + service role exposure.

**Remediation**: Add `CRON_SECRET` auth check to the GET handler, or delete it.

---

### H-4: Indexing Worker Allows Unauthenticated Access When `CRON_SECRET` Is Not Set

**Attack scenario**: At [indexing/worker/route.ts:19](file:///Users/amnaahmad/devwt/trak/src/app/api/internal/indexing/worker/route.ts#L19), `isDevNoSecret = !expectedAuth` — if `CRON_SECRET` is not set in production, ANY request passes the auth check. Similarly, `isManualTrigger` only checks the header `x-manual-trigger === "true"`, which any attacker can set.

**Code path**: [internal/indexing/worker/route.ts:18-29](file:///Users/amnaahmad/devwt/trak/src/app/api/internal/indexing/worker/route.ts#L18-L29)

**Why it works**: The `isDevNoSecret` path was designed for development but will trigger in any environment where `CRON_SECRET` is not set. Since it uses `createClient()` with the service-role fallback, it gets full database access.

**Severity justification**: If `CRON_SECRET` is not set in prod, unauthenticated users can trigger indexing operations with service-role access.

**Remediation**:
1. **Require `CRON_SECRET` to be set** — fail hard if it's missing in production
2. Remove `isDevNoSecret` path entirely, replace with explicit `NODE_ENV === 'development'` check
3. For `isManualTrigger`, always require `requireUser()` AND workspace admin role validation

---

### H-5: `tables/bootstrap` Route Falls Back to Service Role on RLS Miss

**Attack scenario**: At [tables/bootstrap/route.ts:33](file:///Users/amnaahmad/devwt/trak/src/app/api/tables/bootstrap/route.ts#L33), when `requireTableAccess` returns "Table not found" (which could be an RLS denial), the code falls back to `createServiceClient()` and re-checks membership manually. This creates a trust boundary issue — the user gets a service-role client for all subsequent queries on that table.

**Code path**: [tables/bootstrap/route.ts:29-57](file:///Users/amnaahmad/devwt/trak/src/app/api/tables/bootstrap/route.ts#L29-L57)

**Why it works**: If RLS denies access (returns nothing), the code assumes "not found" and escalates to service role. While it does check `workspace_members`, this bypasses any project-level permissions.

**Remediation**: Don't fall back to service role — if RLS denies access, the user shouldn't access the table period.

---

### H-6: `/api/workspaces/current` Leaks Workspace ID Without Auth

**Attack scenario**: [workspaces/current/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/workspaces/current/route.ts) reads the `trak_current_workspace` cookie and returns the workspace ID with **no authentication check**. While the data is from the user's own cookie, the endpoint itself has no auth guard.

**Code path**: [workspaces/current/route.ts:8-26](file:///Users/amnaahmad/devwt/trak/src/app/api/workspaces/current/route.ts#L8-L26)

**Remediation**: Add `requireUser()` check, or document this as intentionally public.

---

## 🟡 MEDIUM — DoS, Brute Force, Rate Limiting Gaps, Mis-Scoped Endpoints

---

### M-1: In-Memory Rate Limiter Resets on Server Restart and Doesn't Scale

**Attack scenario**: The rate limiter in [rate-limit.ts](file:///Users/amnaahmad/devwt/trak/src/lib/rate-limit.ts) uses an in-memory `Map`. In a serverless/multi-instance deployment:
1. Each instance has its own rate limit state — attacker distributes requests across instances
2. Server restarts clear all rate limit state
3. An attacker can bypass rate limits on the client-comments endpoint

**Code path**: [rate-limit.ts:10](file:///Users/amnaahmad/devwt/trak/src/lib/rate-limit.ts#L10)

**Severity justification**: Rate limiting is ineffective at scale, enabling comment spam and abuse of client-facing endpoints.

**Remediation**: Use Redis, Upstash, or Supabase-based rate limiting (like the Slack rate limiter already does via the `slack_rate_limits` table).

---

### M-2: AI Routes Have No Rate Limiting

**Attack scenario**: The `/api/ai` route ([ai/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/ai/route.ts)) has **no rate limiting**. An authenticated user can spam AI requests, consuming DeepSeek API tokens and causing significant cost. Similarly, `/api/workflow/execute` and `/api/file-analysis` have no rate limits.

**Code paths**:
- [api/ai/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/ai/route.ts) — no rate limit
- [api/workflow/execute/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/workflow/execute/route.ts) — no rate limit
- [api/file-analysis/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/file-analysis/route.ts) — no rate limit

**Severity justification**: Financial DoS via API cost abuse, potential resource exhaustion.

**Remediation**: Add per-user rate limiting (e.g., 30 AI requests per minute, 100 per hour) to all AI endpoints.

---

### M-3: AI Tool Loop Has 25 Iteration Limit But No Timeout

**Attack scenario**: `MAX_TOOL_ITERATIONS = 25` in [executor.ts:165](file:///Users/amnaahmad/devwt/trak/src/lib/ai/executor.ts#L165). A prompt-injected command that manipulates the LLM into calling tools that always return "need more data" could force 25 sequential LLM + tool call roundtrips, each taking seconds. Total wall clock time could exceed minutes, holding the request open.

**Code path**: [executor.ts:1420](file:///Users/amnaahmad/devwt/trak/src/lib/ai/executor.ts#L1420) — `while (iterations < MAX_TOOL_ITERATIONS)`

**Remediation**: Add a wall-clock timeout (e.g., 60 seconds) in addition to iteration count. Return partial results if timeout is hit.

---

### M-4: `publicToken` Brute-Force on Client Pages

**Attack scenario**: The `[publicToken]` route ([client/[publicToken]/page.tsx](file:///Users/amnaahmad/devwt/trak/src/app/client/%5BpublicToken%5D/page.tsx)) is entirely public with no rate limiting. If `publicToken` is a short/predictable value (e.g., 8-character alphanumeric), an attacker can enumerate all client pages.

**Code path**: [client/[publicToken]/page.tsx:22](file:///Users/amnaahmad/devwt/trak/src/app/client/%5BpublicToken%5D/page.tsx#L22) — `getProjectByPublicToken(publicToken)` with no rate limit

**Severity justification**: If tokens are short, brute-force enumeration of client-facing project pages.

**Remediation**:
1. Verify `publicToken` is at least 32+ characters of cryptographic randomness (UUID v4 or `crypto.randomBytes`)
2. Add rate limiting on the client page route (by IP)
3. Consider requiring an additional user identifier (visitor cookie + token)

---

### M-5: `/api/weather` Is an Open SSRF Vector

**Attack scenario**: [weather/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/weather/route.ts) accepts `lat` and `lon` parameters and passes them directly to external API URLs. While the target URLs are hardcoded, malicious values could cause parameter injection into the query strings. More critically, this endpoint has no auth — it can be used as a proxy to make requests from your server's IP.

**Code path**: [weather/route.ts:3-18](file:///Users/amnaahmad/devwt/trak/src/app/api/weather/route.ts#L3-L18)

**Remediation**: Add auth check, validate `lat`/`lon` as numeric within valid ranges, add rate limiting.

---

### M-6: `client-comments` Route Uses Attacker-Controlled `visitorId` in Rate Limit Key

**Attack scenario**: The rate limit key at [client-comments/route.ts:156](file:///Users/amnaahmad/devwt/trak/src/app/api/client-comments/route.ts#L156) is `comment:create:${visitorId}:${clientIp}`. Since `visitorId` comes from the request body (attacker controlled), the attacker can rotate `visitorId` values to bypass the per-visitor rate limit entirely.

**Code path**: [client-comments/route.ts:141-175](file:///Users/amnaahmad/devwt/trak/src/app/api/client-comments/route.ts#L141-L175)

**Remediation**: Rate limit by client IP only (not visitor ID), or add a secondary hard IP-based limit.

---

### M-7: Workflow Execute Route Missing Workspace Access Verification

**Attack scenario**: [workflow/execute/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/workflow/execute/route.ts) calls `requireUser()` but does NOT verify that the authenticated user has access to the workspace containing the target `tabId`. An attacker with a valid account could potentially execute workflow commands on tabs belonging to other workspaces.

**Code path**: [workflow/execute/route.ts:9-24](file:///Users/amnaahmad/devwt/trak/src/app/api/workflow/execute/route.ts#L9-L24)

**Why it works**: `requireUser()` only validates the user is logged in. The `tabId` from the request body is passed directly to `executeWorkflowAICommand` which uses `getAuthenticatedUser()` but never checks workspace membership for the target tab.

**Remediation**: Add `requireTabAccess(tabId)` or `requireWorkspaceAccess(workspace_id_from_tab)` before executing the workflow.

---

### M-8: AI Route Accepts `workspaceId` From Cookie Without Cross-Check

**Attack scenario**: In [ai/route.ts:49](file:///Users/amnaahmad/devwt/trak/src/app/api/ai/route.ts#L49), `getCurrentWorkspaceId()` reads from a cookie. An attacker can manipulate this cookie to point to another workspace. While RLS should prevent cross-tenant access via the user-scoped client, the `workspaceId` is passed throughout the AI executor and used in many queries — if any use service client, it leaks.

**Code path**: [ai/route.ts:49](file:///Users/amnaahmad/devwt/trak/src/app/api/ai/route.ts#L49) and [workspace.ts](file:///Users/amnaahmad/devwt/trak/src/app/actions/workspace.ts)

**Remediation**: After reading `workspaceId` from cookie, validate membership via `checkWorkspaceMembership(workspaceId, user.id)`.

---

## 🔵 LOW — Hardening Improvements

---

### L-1: Tables Without RLS — `app_config`, `app_settings`, `doc_folders`, `oauth_states`, etc.

**Finding**: The following tables may lack RLS policies:
- `app_config`, `app_settings` — if user-editable, attacker could modify app URLs
- `doc_folders` — document folder access
- `internal_space_groups` — internal grouping
- `oauth_states` — OAuth flow states
- `workspace_teams`, `workspace_team_members` — team management

**Risk**: If these tables lack RLS and a code path uses the anon client to query them, an authenticated user could read/write records from other tenants.

**Remediation**: Requires manual DB verification. Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` to audit. Enable RLS on all multi-tenant tables.

---

### L-2: No CSP / Security Headers Configured

**Finding**: [next.config.mjs](file:///Users/amnaahmad/devwt/trak/next.config.mjs) has `poweredByHeader: false` but no Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, or X-Content-Type-Options headers.

**Remediation**: Add security headers via `next.config.mjs` `headers()` function or middleware.

---

### L-3: `/api/ai` GET Endpoint Reveals Configuration

**Finding**: [ai/route.ts:217-227](file:///Users/amnaahmad/devwt/trak/src/app/api/ai/route.ts#L217-L227) — The GET handler reveals whether `DEEPSEEK_API_KEY` is configured. This is minor information disclosure.

**Remediation**: Remove or restrict this health check endpoint.

---

### L-4: `/api/supabase-ping` Leaks Session Presence

**Finding**: [supabase-ping/route.ts](file:///Users/amnaahmad/devwt/trak/src/app/api/supabase-ping/route.ts) — No auth check, reveals session state. Development diagnostic endpoint.

**Remediation**: Delete or restrict to admin-only.

---

### L-5: Test Routes Exposed — `/api/test-ai-search`, `/api/test-search`, `/api/qa`

**Finding**: Multiple test/debug routes exist in the API directory that may be accessible in production.

**Remediation**: Delete all test routes before launch or gate behind `NODE_ENV === 'development'`.

---

### L-6: OAuth State Cleanup — No Automatic Expiry Sweep

**Finding**: OAuth states ([oauth_states table](file:///Users/amnaahmad/devwt/trak/src/app/api/slack/install/route.ts#L72-L84)) have a 5-minute TTL stored as `expires_at`, but there's no cron job or trigger to clean up expired states. Over time, this table will accumulate stale rows.

**Remediation**: Add a pg_cron job to `DELETE FROM oauth_states WHERE expires_at < now()` periodically.

---

### L-7: Slack Token Encryption Key Rotation Not Implemented

**Finding**: [encryption.ts:6](file:///Users/amnaahmad/devwt/trak/src/lib/slack/encryption.ts#L6) — `KEY_ID = "v1"` is hardcoded. `decryptToken()` accepts a `keyId` parameter but always uses the same env var `SLACK_TOKEN_ENCRYPTION_KEY`. Key rotation is not actually functional.

**Remediation**: Implement proper key rotation by supporting `SLACK_TOKEN_ENCRYPTION_KEY_V1`, `_V2`, etc. and dispatching based on `keyId`.

---

### L-8: `timingSafeEqual` Returns `false` on Length Mismatch Without Constant-Time Path

**Finding**: [encryption.ts:146-148](file:///Users/amnaahmad/devwt/trak/src/lib/slack/encryption.ts#L146-L148) — When buffer lengths differ, it returns `false` immediately, which leaks length information via timing.

**Remediation**: Hash both values to equal length before comparison, or pad to equal length.

---

### L-9: Shopify Sync Worker POST Skips Auth in Development Mode

**Finding**: [shopify/sync/worker/route.ts:20-23](file:///Users/amnaahmad/devwt/trak/src/app/api/shopify/sync/worker/route.ts#L20-L23) — `isDevelopment` check uses `process.env.NODE_ENV === "development"`. If somehow deployed in dev mode, the auth check is bypassed.

**Remediation**: Use `CRON_SECRET` check exclusively, remove the development bypass.

---

### L-10: `file-analysis` Route Lacks Workspace Boundary Validation

**Finding**: [file-analysis/route.ts:211-218](file:///Users/amnaahmad/devwt/trak/src/app/api/file-analysis/route.ts#L211-L218) — Gets `workspaceId` from `getCurrentWorkspaceId()` (cookie) and uses it to scope file queries, but never validates that the authenticated user is a member of that workspace.

**Remediation**: Add workspace membership check after reading `workspaceId`.

---

## Summary Table

| # | Severity | Title | Type |
|---|----------|-------|------|
| C-1 | 🔴 CRITICAL | `ENABLE_TEST_MODE` auth bypass | Privilege Escalation |
| C-2 | 🔴 CRITICAL | `server.ts` silent service-role fallback | Privilege Escalation |
| C-3 | 🔴 CRITICAL | Slack executor bypasses all RLS | Cross-Tenant Access |
| H-1 | 🟠 HIGH | `/api/debug-workspaces` no auth | Data Leak |
| H-2 | 🟠 HIGH | `/api/populate-buckeye` no auth | Write Abuse |
| H-3 | 🟠 HIGH | Shopify worker GET no auth | Info Leak |
| H-4 | 🟠 HIGH | Indexing worker no auth when no `CRON_SECRET` | Service Role Exposure |
| H-5 | 🟠 HIGH | `tables/bootstrap` service-role fallback | Write Escalation |
| H-6 | 🟠 HIGH | `/api/workspaces/current` no auth | Info Leak |
| M-1 | 🟡 MEDIUM | In-memory rate limiter | DoS |
| M-2 | 🟡 MEDIUM | AI routes no rate limiting | Financial DoS |
| M-3 | 🟡 MEDIUM | AI tool loop no timeout | DoS |
| M-4 | 🟡 MEDIUM | `publicToken` brute force | Enumeration |
| M-5 | 🟡 MEDIUM | Weather endpoint SSRF risk | SSRF |
| M-6 | 🟡 MEDIUM | `visitorId` in rate limit key | Rate Limit Bypass |
| M-7 | 🟡 MEDIUM | Workflow execute missing workspace check | Cross-Tenant Risk |
| M-8 | 🟡 MEDIUM | AI route `workspaceId` from cookie | Cross-Tenant Risk |
| L-1 | 🔵 LOW | Tables without RLS | Hardening |
| L-2 | 🔵 LOW | No CSP/security headers | Hardening |
| L-3 | 🔵 LOW | AI GET reveals config | Info Leak |
| L-4 | 🔵 LOW | supabase-ping leaks session | Info Leak |
| L-5 | 🔵 LOW | Test routes exposed | Attack Surface |
| L-6 | 🔵 LOW | OAuth state no auto-cleanup | Resource Leak |
| L-7 | 🔵 LOW | Slack key rotation not functional | Crypto |
| L-8 | 🔵 LOW | timingSafeEqual length leak | Crypto |
| L-9 | 🔵 LOW | Shopify dev mode bypass | Auth Bypass |
| L-10 | 🔵 LOW | File analysis no workspace check | Cross-Tenant Risk |

---

## Recommended Priority for Launch

1. **Immediately fix** C-1, C-2, C-3 — these are exploitable data exfiltration paths
2. **Delete before launch** H-1, H-2, L-4, L-5 — development/test routes
3. **Fix before launch** H-3, H-4, H-5, M-7, M-8 — auth gaps on production routes
4. **Fix within first week** M-1, M-2, M-3, M-4, M-6 — abuse prevention
5. **Schedule for hardening sprint** L-1 through L-10
