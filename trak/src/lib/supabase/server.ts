import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Test mode flag - set this to true when running outside of Next.js request context
let isTestMode = false;

export function enableTestMode() {
  isTestMode = true;
}

export function disableTestMode() {
  isTestMode = false;
}

export async function createClient() {
  // In test mode, use service role client instead of SSR client (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MODE === 'true';
  if (isTestMode && isTestEnvironment) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables for test mode");
    }

    return createServiceClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  // Normal Next.js request flow
  try {
    const cookieStore = await cookies();

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
          remove(name: string, options: any) {
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
  } catch (error) {
    // If cookies() fails, we're not in a request context
    // Fall back to service client (useful for scripts)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Not in request context and missing service role key");
    }

    return createServiceClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
}
