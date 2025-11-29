import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Cached per-request helper to return both Supabase client and user.
 * Prevents multiple auth.getUser() calls from hammering GoTrue.
 */
export const getServerUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { supabase, user: data.user };
});
