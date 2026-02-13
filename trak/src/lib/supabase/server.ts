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
