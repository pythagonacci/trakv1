# Code Snippets — Security Audit Reference

All files verbatim from the Trak codebase, grouped by audit area.

---

## 1. Supabase Client Constructors (Critical — C-1, C-2)

### `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Test mode flag - set this to true when running outside of Next.js request context
let isTestMode = false;
let testUserId: string | null = null;

export function enableTestMode() {
  isTestMode = true;
}

export function disableTestMode() {
  isTestMode = false;
  testUserId = null;
}

export function setTestUserId(userId: string) {
  testUserId = userId;
}

export async function createClient() {
  const supabaseEnv = getSupabaseEnv();

  // In test mode, use service role client instead of SSR client (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MODE === 'true';
  if (isTestMode && isTestEnvironment) {
    const supabaseUrl = supabaseEnv.url;
    const supabaseKey = supabaseEnv.serviceRoleKey;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables for test mode");
    }

    const client = createServiceClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Mock getUser if testUserId is set
    if (testUserId) {
      const originalGetUser = client.auth.getUser.bind(client.auth);
      type GetUserResponse = Awaited<ReturnType<typeof originalGetUser>>;
      client.auth.getUser = async (token?: string): Promise<GetUserResponse> => {
        if (!token && testUserId) {
          const { data: { user }, error } = await client.auth.admin.getUserById(testUserId);
          return { data: { user: user ?? null }, error: error ?? null } as GetUserResponse;
        }
        return originalGetUser(token);
      };
    }

    return client;
  }

  // Normal Next.js request flow
  try {
    if (!supabaseEnv.url || !supabaseEnv.anonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    const cookieStore = await cookies();

    return createServerClient(
      supabaseEnv.url,
      supabaseEnv.anonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // The `set` method was called from a Server Component.
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.delete({ name, ...options });
            } catch {
              // The `remove` method was called from a Server Component.
            }
          },
        },
      }
    );
  } catch {
    // If cookies() fails, we're not in a request context
    // Fall back to service client (useful for scripts)
    const supabaseUrl = supabaseEnv.url;
    const supabaseKey = supabaseEnv.serviceRoleKey;

    if (!supabaseUrl || !supabaseKey) {
      const missing = [
        !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
        !supabaseKey && "SUPABASE_SERVICE_ROLE_KEY",
      ].filter(Boolean);
      throw new Error(
        `Not in request context and missing env: ${missing.join(", ")}. Set these in .env.local.`
      );
    }

    const client = createServiceClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Mock getUser if testUserId is set (for scripts outside test environment)
    if (testUserId) {
      const originalGetUser = client.auth.getUser.bind(client.auth);
      type GetUserResponse = Awaited<ReturnType<typeof originalGetUser>>;
      client.auth.getUser = async (token?: string): Promise<GetUserResponse> => {
        if (!token && testUserId) {
          const { data: { user }, error } = await client.auth.admin.getUserById(testUserId);
          return { data: { user: user ?? null }, error: error ?? null } as GetUserResponse;
        }
        return originalGetUser(token);
      };
    }

    return client;
  }
}
```

---

### `src/lib/supabase/service.ts`

```typescript
"use server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClientPromise: Promise<SupabaseClient<any, "public", any>> | null = null;

async function initServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createServiceClient(): Promise<SupabaseClient<any, "public", any>> {
  if (!cachedClientPromise) {
    cachedClientPromise = initServiceClient();
  }

  return cachedClientPromise!;
}
```

---

### `src/lib/supabase/env.ts`

```typescript
function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function getEnv(name: string) {
  const raw = process.env[name];
  if (!raw) {
    return "";
  }
  return stripWrappingQuotes(raw);
}

export function getSupabaseEnv() {
  return {
    url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
```

---

## 2. Test Mode / Test Context Plumbing (Critical — C-1)

### `src/lib/auth-utils.ts`

```typescript
"use server";

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Test context for running outside of Next.js request scope
let testUserContext: { userId: string } | null = null;

// Set test user context (used by test harness)
export async function setTestUserContext(userId: string) {
  testUserContext = { userId };
}

// Clear test user context
export async function clearTestUserContext() {
  testUserContext = null;
}

export const getAuthenticatedUser = cache(async () => {
  // Check if running in test context first (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MODE === 'true';
  if (testUserContext && isTestEnvironment) {
    // In test mode, create a service client to fetch user data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseKey);
      const { data: { user }, error } = await serviceClient.auth.admin.getUserById(testUserContext.userId);
      if (error || !user) return null;
      return user;
    }
  }

  // Normal Next.js request flow
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (error) {
    return null;
  }
});

export const checkWorkspaceMembership = cache(async (workspaceId: string, userId: string) => {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return membership;
});

// ... (requireWorkspaceAccess, requireProjectAccess, getProjectPermissions follow same pattern)
```

---

### `src/lib/auth/get-server-user.ts`

```typescript
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Test context for running outside of Next.js request scope
let testUserContext: { userId: string } | null = null;

export function setTestUserContext(userId: string) {
  testUserContext = { userId };
}

export function clearTestUserContext() {
  testUserContext = null;
}

export const getServerUser = cache(async () => {
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MODE === 'true';
  if (testUserContext && isTestEnvironment) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseKey);
      const { data: { user }, error } = await serviceClient.auth.admin.getUserById(testUserContext.userId);
      if (error || !user) return null;
      return { supabase: serviceClient, user };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { supabase, user: data.user };
});
```

> **Note:** `setTestUserContext` in `get-server-user.ts` is a plain exported function (not async), NOT a server action.  
> `setTestUserContext` in `auth-utils.ts` IS async and `"use server"` — making it a callable server action.

---

## 3. Slack Executor + Slack Auth Context (Critical — C-3)

### `src/lib/ai/slack-executor.ts`

```typescript
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { executeAICommand, type ExecutionResult, type AIMessage } from "@/lib/ai/executor";
import type { AuthContext } from "@/lib/auth-context";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ... (types omitted for brevity)

export async function executeSlackAICommand(
  params: SlackAICommandParams
): Promise<SlackExecutionResult> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Get workspace metadata
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", params.workspaceId)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", params.userId)
      .single();

    // ... (context detection omitted)

    // 4. Create AuthContext with service client (bypasses RLS for Slack commands)
    const authContext: AuthContext = {
      supabase,
      userId: params.userId,
      workspaceId: params.workspaceId,
    };

    // 5. Execute AI command with restricted tool groups
    const result = await executeAICommand(
      params.command,
      {
        workspaceId: params.workspaceId,
        workspaceName: workspace?.name,
        userId: params.userId,
        userName: profile?.name || profile?.email,
        currentProjectId: params.projectId,
        currentTabId: params.tabId,
        authContext, // Pass service client for Slack commands
      },
      // ... (system prompt, options)
    );

    return { success: result.success, response: result.response, toolCallsMade: result.toolCallsMade, error: result.error };
  } catch (error) {
    // ...
  }
}
```

## Slack Commands Route, Helpers, Debug Routes, Worker Endpoints

---

### `src/app/api/slack/commands/route.ts` (full)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/signature";
import { checkBothRateLimits } from "@/lib/slack/rate-limiter";
import { checkIdempotency, saveIdempotency, generateIdempotencyKey } from "@/lib/slack/idempotency";
import { executeSlackAICommand } from "@/lib/ai/slack-executor";
import { logSlackCommand } from "@/lib/slack/audit";
import { buildSlackResponse, buildProcessingMessage } from "@/lib/slack/block-kit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. VERIFY SLACK SIGNATURE
    const body = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");
    if (!signature || !timestamp) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
    }
    if (!verifySlackSignature(body, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. PARSE FORM DATA
    const params = new URLSearchParams(body);
    const teamId = params.get("team_id")!;
    const slackUserId = params.get("user_id")!;
    const channelId = params.get("channel_id")!;
    const channelName = params.get("channel_name") || undefined;
    const text = params.get("text") || "";
    const responseUrl = params.get("response_url")!;
    const slackRequestId = request.headers.get("x-slack-request-id") || undefined;

    // 3. CHECK IDEMPOTENCY
    if (slackRequestId) {
      const idempotencyKey = generateIdempotencyKey(teamId, slackRequestId);
      const cachedResponse = await checkIdempotency(idempotencyKey);
      if (cachedResponse) {
        return NextResponse.json(cachedResponse);
      }
    }

    // 4. RATE LIMITING
    const rateLimit = await checkBothRateLimits(teamId, slackUserId);
    if (!rateLimit.success) {
      const errorResponse = { response_type: "ephemeral", text: rateLimit.message };
      if (slackRequestId) {
        await saveIdempotency(generateIdempotencyKey(teamId, slackRequestId), errorResponse);
      }
      return NextResponse.json(errorResponse);
    }

    // 5. GET TRAK WORKSPACE AND CONNECTION
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: connection } = await supabase
      .from("slack_workspace_connections")
      .select("id, workspace_id")
      .eq("slack_team_id", teamId)
      .eq("connection_status", "active")
      .single();

    if (!connection) {
      const errorResponse = { response_type: "ephemeral", text: "❌ Slack integration not configured." };
      if (slackRequestId) await saveIdempotency(generateIdempotencyKey(teamId, slackRequestId), errorResponse);
      return NextResponse.json(errorResponse);
    }

    // 6. CHECK IF SLACK USER IS LINKED TO TRAK ACCOUNT
    const { data: userLink } = await supabase
      .from("slack_user_links")
      .select("trak_user_id")
      .eq("slack_connection_id", connection.id)
      .eq("slack_user_id", slackUserId)
      .eq("link_status", "active")
      .single();

    if (!userLink) {
      const linkUrl = `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations/slack/link?team_id=${teamId}&slack_user_id=${slackUserId}`;
      const errorResponse = { response_type: "ephemeral", text: `🔗 Please link your Slack account first:\n${linkUrl}` };
      if (slackRequestId) await saveIdempotency(generateIdempotencyKey(teamId, slackRequestId), errorResponse);
      await logSlackCommand({ connectionId: connection.id, slackUserId, trakUserId: null, commandText: text, channelId, channelName, requestId: slackRequestId, status: "unauthorized", errorMessage: "User not linked" });
      return NextResponse.json(errorResponse);
    }

    // 7. SEND IMMEDIATE ACKNOWLEDGMENT
    const ackResponse = buildProcessingMessage();

    // 8. PROCESS COMMAND ASYNCHRONOUSLY (don't await)
    processSlackCommandAsync({ connectionId: connection.id, workspaceId: connection.workspace_id, trakUserId: userLink.trak_user_id, slackUserId, teamId, channelId, channelName, text, responseUrl, requestId: slackRequestId, startTime });

    return NextResponse.json(ackResponse);
  } catch (error) {
    return NextResponse.json({ response_type: "ephemeral", text: "❌ An error occurred." }, { status: 500 });
  }
}

async function processSlackCommandAsync(params: {
  connectionId: string; workspaceId: string; trakUserId: string; slackUserId: string;
  teamId: string; channelId: string; channelName?: string; text: string;
  responseUrl: string; requestId?: string; startTime: number;
}) {
  try {
    const result = await executeSlackAICommand({ command: params.text, workspaceId: params.workspaceId, userId: params.trakUserId });
    const slackResponse = buildSlackResponse(result);
    await fetch(params.responseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slackResponse) });
    if (params.requestId) await saveIdempotency(generateIdempotencyKey(params.teamId, params.requestId), slackResponse);
    await logSlackCommand({ connectionId: params.connectionId, slackUserId: params.slackUserId, trakUserId: params.trakUserId, commandText: params.text, channelId: params.channelId, channelName: params.channelName, requestId: params.requestId, status: "success", responseSummary: result.response, executionTimeMs: Date.now() - params.startTime, toolsUsed: result.toolCallsMade?.map((t) => t.tool) });
  } catch (error) {
    await fetch(params.responseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response_type: "ephemeral", text: "❌ Failed to process your command." }) });
    await logSlackCommand({ connectionId: params.connectionId, slackUserId: params.slackUserId, trakUserId: params.trakUserId, commandText: params.text, channelId: params.channelId, channelName: params.channelName, requestId: params.requestId, status: "error", errorMessage: error instanceof Error ? error.message : "Unknown error", executionTimeMs: Date.now() - params.startTime });
  }
}
```

---

### `src/app/api/slack/interactive/route.ts` (full)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/signature";
import { executeSlackAICommand } from "@/lib/ai/slack-executor";
import { buildSlackResponse } from "@/lib/slack/block-kit";
import type { SlackInteractivePayload } from "@/lib/slack/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");
    if (!signature || !timestamp || !verifySlackSignature(body, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const params = new URLSearchParams(body);
    const payloadJson = params.get("payload");
    if (!payloadJson) return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    const payload: SlackInteractivePayload = JSON.parse(payloadJson);

    if (payload.type === "block_actions" && payload.actions && payload.actions.length > 0) {
      const action = payload.actions[0];
      if (action.action_id === "select_project" && action.selected_option) {
        return await handleProjectSelection({ payload, projectId: action.selected_option.value, projectName: action.selected_option.text.text });
      }
      if (action.action_id === "select_tab" && action.selected_option) {
        return await handleTabSelection({ payload, tabId: action.selected_option.value, tabName: action.selected_option.text.text });
      }
    }
    return NextResponse.json({ response_type: "ephemeral", text: "Unknown action type" });
  } catch (error) {
    return NextResponse.json({ response_type: "ephemeral", text: "❌ An error occurred." }, { status: 500 });
  }
}

async function handleProjectSelection(params: { payload: SlackInteractivePayload; projectId: string; projectName: string }) {
  const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const teamId = params.payload.team.id;
  const slackUserId = params.payload.user.id;
  const { data: connection } = await supabase.from("slack_workspace_connections").select("id, workspace_id").eq("slack_team_id", teamId).eq("connection_status", "active").single();
  if (!connection) return NextResponse.json({ response_type: "ephemeral", replace_original: true, text: "❌ Workspace not connected" });
  const { data: userLink } = await supabase.from("slack_user_links").select("trak_user_id").eq("slack_connection_id", connection.id).eq("slack_user_id", slackUserId).eq("link_status", "active").single();
  if (!userLink) return NextResponse.json({ response_type: "ephemeral", replace_original: true, text: "❌ Account not linked" });
  const result = await executeSlackAICommand({ command: `create task in project ${params.projectName}`, workspaceId: connection.workspace_id, userId: userLink.trak_user_id, projectId: params.projectId });
  return NextResponse.json({ ...buildSlackResponse(result), replace_original: true });
}

async function handleTabSelection(params: { payload: SlackInteractivePayload; tabId: string; tabName: string }) {
  // Same pattern as handleProjectSelection — resolves connection + userLink, then calls executeSlackAICommand
  const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const teamId = params.payload.team.id;
  const slackUserId = params.payload.user.id;
  const { data: connection } = await supabase.from("slack_workspace_connections").select("id, workspace_id").eq("slack_team_id", teamId).eq("connection_status", "active").single();
  if (!connection) return NextResponse.json({ response_type: "ephemeral", replace_original: true, text: "❌ Workspace not connected" });
  const { data: userLink } = await supabase.from("slack_user_links").select("trak_user_id").eq("slack_connection_id", connection.id).eq("slack_user_id", slackUserId).eq("link_status", "active").single();
  if (!userLink) return NextResponse.json({ response_type: "ephemeral", replace_original: true, text: "❌ Account not linked" });
  const result = await executeSlackAICommand({ command: `in tab ${params.tabName}`, workspaceId: connection.workspace_id, userId: userLink.trak_user_id, tabId: params.tabId });
  return NextResponse.json({ ...buildSlackResponse(result), replace_original: true });
}
```

---

### `src/lib/slack/signature.ts` (full)

```typescript
import crypto from "crypto";
import { timingSafeEqual } from "./encryption";

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const REPLAY_WINDOW_SECONDS = 60 * 5;

export function verifySlackSignature(body: string, signature: string, timestamp: string): boolean {
  try {
    if (!SLACK_SIGNING_SECRET) { console.error("SLACK_SIGNING_SECRET not set"); return false; }
    if (!signature || !timestamp) return false;
    const now = Math.floor(Date.now() / 1000);
    const requestTimestamp = parseInt(timestamp, 10);
    if (isNaN(requestTimestamp)) return false;
    if (Math.abs(now - requestTimestamp) > REPLAY_WINDOW_SECONDS) return false;

    const sigBasestring = `v0:${timestamp}:${body}`;
    const computedSignature = `v0=${crypto.createHmac("sha256", SLACK_SIGNING_SECRET).update(sigBasestring, "utf8").digest("hex")}`;
    return timingSafeEqual(computedSignature, signature);
  } catch { return false; }
}

export function extractSlackHeaders(headers: Headers): { signature: string; timestamp: string } | null {
  const signature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");
  if (!signature || !timestamp) return null;
  return { signature, timestamp };
}
```

---

### `src/lib/slack/encryption.ts` (full)

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_ID = "v1";

export async function encryptToken(plaintext: string): Promise<{ encrypted: string; keyId: string }> {
  const encryptionKeyBase64 = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!encryptionKeyBase64) throw new Error("SLACK_TOKEN_ENCRYPTION_KEY not set");
  const key = Buffer.from(encryptionKeyBase64, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedString = [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
  return { encrypted: encryptedString, keyId: KEY_ID };
}

export async function decryptToken(encrypted: string, keyId: string): Promise<string> {
  const encryptionKeyBase64 = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!encryptionKeyBase64) throw new Error("SLACK_TOKEN_ENCRYPTION_KEY not set");
  const key = Buffer.from(encryptionKeyBase64, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");
  if (iv.length !== IV_LENGTH) throw new Error("Invalid IV length");
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error("Invalid auth tag length");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

export function generateEncryptionKey(): string { return crypto.randomBytes(32).toString("base64"); }
export function generateRandomString(bytes: number = 32): string { return crypto.randomBytes(bytes).toString("hex"); }

export function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false; // ← early return leaks length info
    return crypto.timingSafeEqual(bufA, bufB);
  } catch { return false; }
}
```

---

### `src/lib/slack/idempotency.ts` (full)

```typescript
import { createClient as createServiceClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const IDEMPOTENCY_TTL_HOURS = 24;

export async function checkIdempotency(key: string): Promise<any | null> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase.from("slack_idempotency_keys").select("response_payload").eq("idempotency_key", key).gt("expires_at", new Date().toISOString()).single();
    if (error) { if (error.code === "PGRST116") return null; return null; }
    return data?.response_payload || null;
  } catch { return null; }
}

export async function saveIdempotency(key: string, response: any): Promise<void> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
    await supabase.from("slack_idempotency_keys").upsert({ idempotency_key: key, response_payload: response, expires_at: expiresAt.toISOString() }, { onConflict: "idempotency_key" });
  } catch {}
}

export function generateIdempotencyKey(teamId: string, requestId: string): string {
  return `team:${teamId}:request:${requestId}`;
}
```

---

### `src/lib/slack/rate-limiter.ts` (full)

```typescript
import { createClient as createServiceClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER_LIMIT = parseInt(process.env.SLACK_RATE_LIMIT_PER_USER_PER_MINUTE || "20", 10);
const TEAM_LIMIT = parseInt(process.env.SLACK_RATE_LIMIT_PER_TEAM_PER_MINUTE || "100", 10);
const WINDOW_MS = 60 * 1000;

export interface RateLimitResult { success: boolean; remaining: number; message?: string; }

export function getRateLimitIdentifier(teamId: string, userId?: string): string {
  return userId ? `team:${teamId}:user:${userId}` : `team:${teamId}`;
}

export async function checkRateLimit(identifier: string, limit: number = USER_LIMIT): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();
    const { data: existing, error: fetchError } = await supabase.from("slack_rate_limits").select("*").eq("identifier", identifier).single();
    if (fetchError && fetchError.code !== "PGRST116") { return { success: true, remaining: limit - 1 }; } // Fail open
    if (!existing) {
      await supabase.from("slack_rate_limits").insert({ identifier, request_count: 1, window_start: now.toISOString(), last_request_at: now.toISOString() });
      return { success: true, remaining: limit - 1 };
    }
    const existingWindowStart = new Date(existing.window_start);
    if (now.getTime() - existingWindowStart.getTime() > WINDOW_MS) {
      await supabase.from("slack_rate_limits").update({ request_count: 1, window_start: now.toISOString(), last_request_at: now.toISOString() }).eq("identifier", identifier);
      return { success: true, remaining: limit - 1 };
    }
    if (existing.request_count >= limit) {
      const resetAt = new Date(existingWindowStart.getTime() + WINDOW_MS);
      return { success: false, remaining: 0, message: `⏱️ Rate limit exceeded. Try again in ${Math.ceil((resetAt.getTime() - now.getTime()) / 1000)} seconds.` };
    }
    await supabase.from("slack_rate_limits").update({ request_count: existing.request_count + 1, last_request_at: now.toISOString() }).eq("identifier", identifier);
    return { success: true, remaining: limit - existing.request_count - 1 };
  } catch { return { success: true, remaining: limit - 1 }; } // Fail open
}

export async function checkBothRateLimits(teamId: string, userId: string): Promise<RateLimitResult> {
  const userResult = await checkRateLimit(getRateLimitIdentifier(teamId, userId), USER_LIMIT);
  if (!userResult.success) return userResult;
  const teamResult = await checkRateLimit(getRateLimitIdentifier(teamId), TEAM_LIMIT);
  if (!teamResult.success) return { ...teamResult, message: `⏱️ Team rate limit exceeded. ${teamResult.message}` };
  return userResult;
}
```

---

### `src/lib/slack/audit.ts` (full)

```typescript
import { createClient as createServiceClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function logSlackCommand(params: SlackCommandLogParams): Promise<void> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await supabase.from("slack_command_audit_log").insert({
      slack_connection_id: params.connectionId, slack_user_id: params.slackUserId,
      trak_user_id: params.trakUserId, command_text: params.commandText,
      channel_id: params.channelId, channel_name: params.channelName,
      request_id: params.requestId, ip_address: params.ipAddress,
      user_agent: params.userAgent, response_status: params.status,
      response_summary: params.responseSummary, error_message: params.errorMessage,
      execution_time_ms: params.executionTimeMs, tools_used: params.toolsUsed,
    });
  } catch {} // Don't throw — audit failures shouldn't break requests
}

export async function updateSlackCommandLog(requestId: string, updates: Partial<SlackCommandLogParams>): Promise<void> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const updateData: Record<string, any> = {};
    if (updates.status) updateData.response_status = updates.status;
    if (updates.responseSummary) updateData.response_summary = updates.responseSummary;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.executionTimeMs) updateData.execution_time_ms = updates.executionTimeMs;
    if (updates.toolsUsed) updateData.tools_used = updates.toolsUsed;
    await supabase.from("slack_command_audit_log").update(updateData).eq("request_id", requestId);
  } catch {}
}
```

---

## 4. "Delete Before Launch" Routes (H-1, H-2)

### `src/app/api/debug-workspaces/route.ts` (full — 17 lines)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: workspaces, error: wsError } = await supabase.from('workspaces').select('id, name');
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email').limit(1);
    return NextResponse.json({ workspaces, profiles, wsError, pError });
}
// NO AUTH CHECK. NO RATE LIMIT.
```

### `src/app/api/supabase-ping/route.ts` (full — 21 lines)

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return NextResponse.json({ ok: false, where: "server-route", error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, where: "server-route", sessionPresent: !!data.session });
}
// NO AUTH CHECK. Leaks session presence.
```

### `src/app/api/test-ai-search/route.ts` (summary — 142 lines)

```typescript
// NO AUTH CHECK. Runs searchTasks, searchProjects, searchBlocks, getTaskWithContext, getProjectWithContext.
// Returns pass/fail counts as JSON. Development test harness.
export async function GET(_request: NextRequest) { /* ... 7 test cases ... */ }
```

### `src/app/api/test-search/route.ts` (full — 20 lines)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { searchProjects, resolveEntityByName } from "@/app/actions/ai-search";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";

export async function GET(request: NextRequest) {
    const workspaceId = await getCurrentWorkspaceId();
    const searchResult = await searchProjects({ searchText: "Byblos" });
    const resolveResult = await resolveEntityByName({ entityType: "project", name: "Byblos" });
    const allProjects = await searchProjects({ limit: 100 });
    return NextResponse.json({ workspaceId, searchResult, resolveResult, allProjectsSummary: allProjects.data?.map(p => p.name) });
}
// NO AUTH CHECK. Leaks project names.
```

### `src/app/api/qa/route.ts` (summary — 120 lines)

```typescript
// HAS AUTH (getAuthenticatedUser). Generic LLM proxy — forwards any question to OpenAI/DeepSeek.
// No rate limiting. No workspace scoping. Dev/test endpoint.
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { question } = await request.json();
  // Forwards to OpenAI or DeepSeek based on AI_PROVIDER env var
}
```

### `src/app/api/populate-buckeye/route.ts` (summary — 442 lines)

```typescript
// NO AUTH CHECK. Creates subtabs, text blocks, task blocks, table blocks, link blocks
// in any workspace containing a project matching "%buckeye%".
export async function POST() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id, name").ilike("name", "%buckeye%").limit(1);
  // Creates 6 subtabs, ~15 blocks, ~11 task items of seed data
}
```

---

## 5. Worker Endpoints + CRON_SECRET (H-3, H-4)

### `src/app/api/internal/indexing/worker/route.ts` (full — 73 lines)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IndexingQueue } from "@/lib/search/job-queue";
import { ResourceIndexer } from "@/lib/search/indexer";
import { isUnauthorizedApiError, requireUser, unauthorizedJsonResponse } from "@/lib/auth/require-user";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const manualTrigger = req.headers.get("x-manual-trigger");
  const expectedAuth = process.env.CRON_SECRET;

  try {
    const isCronRequest = Boolean(expectedAuth) && authHeader === `Bearer ${expectedAuth}`;
    const isDevNoSecret = !expectedAuth;  // ← If CRON_SECRET not set, ANYONE can call this
    const isManualTrigger = manualTrigger === "true";  // ← Trivially spoofable header

    let supabase: Awaited<ReturnType<typeof createClient>>;
    if (isCronRequest || isDevNoSecret) {
      supabase = await createClient();  // ← May fallback to service role (C-2)
    } else if (isManualTrigger) {
      const auth = await requireUser();
      supabase = auth.supabase;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queue = new IndexingQueue(supabase);
    const indexer = new ResourceIndexer(supabase);
    const processed: string[] = [];
    const failed: string[] = [];
    const LIMIT = 10;
    for (let i = 0; i < LIMIT; i++) {
      const job = await queue.pickNextJob();
      if (!job) break;
      try { await indexer.processJob(job); await queue.completeJob(job.id); processed.push(job.id); }
      catch (err) { const msg = err instanceof Error ? err.message : "Unknown error"; await queue.failJob(job.id, msg); failed.push(job.id); }
    }
    return NextResponse.json({ message: `Processed ${processed.length} jobs, ${failed.length} failed`, processed, failed, remaining: processed.length === LIMIT }, { status: 200 });
  } catch (error) {
    if (isUnauthorizedApiError(error)) return unauthorizedJsonResponse();
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

### `src/app/api/shopify/sync/worker/route.ts` (full — 153 lines)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ShopifySyncQueue, processSyncJob } from "@/lib/shopify/sync-worker";

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_JOBS_PER_RUN = 10;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${CRON_SECRET}`;
    const isDevelopment = process.env.NODE_ENV === "development";
    const isAuthorized = authHeader === expectedAuth;

    if (!isAuthorized && !isDevelopment) {  // ← Dev mode bypasses auth entirely
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isDevelopment && !CRON_SECRET) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json({ error: "Worker not configured" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    const queue = new ShopifySyncQueue(supabase);
    let processed = 0, failed = 0;
    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const job = await queue.pickNextJob();
      if (!job) break;
      try { await processSyncJob(job); processed++; }
      catch (error) { failed++; }
    }
    const { count: remaining } = await supabase.from("shopify_sync_jobs").select("*", { count: "exact", head: true }).eq("status", "pending");
    return NextResponse.json({ success: true, processed, failed, remaining: remaining || 0 });
  } catch (error) {
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}

// GET endpoint — NO AUTH AT ALL
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    const { data: jobs, error } = await supabase.from("shopify_sync_jobs").select("status").order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });

    const statusCounts = jobs.reduce((acc: any, job: any) => { acc[job.status] = (acc[job.status] || 0) + 1; return acc; }, {});
    return NextResponse.json({ status: "operational", jobs: statusCounts, timestamp: new Date().toISOString() });
    // ← Leaks Shopify integration state to anyone
  } catch (error) {
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
```

> **Note:** There is no shared/centralized `CRON_SECRET` auth helper. Each worker reads `process.env.CRON_SECRET` independently and implements its own auth logic.
