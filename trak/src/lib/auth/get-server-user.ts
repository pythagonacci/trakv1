import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Test context for running outside of Next.js request scope
let testUserContext: { userId: string } | null = null;

export function setTestUserContext(userId: string) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setTestUserContext is only allowed when NODE_ENV === \"test\".");
  }
  testUserContext = { userId };
}

export function clearTestUserContext() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("clearTestUserContext is only allowed when NODE_ENV === \"test\".");
  }
  testUserContext = null;
}

/**
 * Cached per-request helper to return both Supabase client and user.
 * Prevents multiple auth.getUser() calls from hammering GoTrue.
 */
export const getServerUser = cache(async () => {
  // Check if running in test context first (only in test/dev environments)
  const isTestEnvironment = process.env.NODE_ENV === "test";
  if (testUserContext && isTestEnvironment) {
    // In test mode, create a service client to fetch user data
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
