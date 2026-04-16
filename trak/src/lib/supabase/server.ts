import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Test mode flag - set this to true when running outside of Next.js request context
let isTestMode = false;
let testUserId: string | null = null;

function assertTestEnvironment(caller: string) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(`${caller} is only allowed when NODE_ENV === "test".`);
  }
}

export function enableTestMode() {
  assertTestEnvironment("enableTestMode");
  isTestMode = true;
}

export function disableTestMode() {
  assertTestEnvironment("disableTestMode");
  isTestMode = false;
  testUserId = null;
}

export function setTestUserId(userId: string) {
  assertTestEnvironment("setTestUserId");
  testUserId = userId;
}

async function _createClientImpl() {
  const supabaseEnv = getSupabaseEnv();

  // In test mode, use service role client instead of SSR client (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === "test";
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
  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    throw new Error(
      "createClient() requires a Next.js request context; use createServiceClient() explicitly for scripts/workers."
    );
  }

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
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * React cache()-wrapped Supabase client — returns the same instance for
 * all callers within a single Next.js server request, eliminating redundant
 * cookie parsing and client construction.
 */
export const createClient = cache(_createClientImpl);
