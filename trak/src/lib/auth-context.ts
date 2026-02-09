"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspaceId?: string; // Optional for Slack/API contexts
};

/**
 * Single shared auth (createClient + getAuthenticatedUser).
 * Call once per request/tool run and pass to all actions that need auth
 * to avoid duplicate auth work.
 */
export async function getAuthContext(): Promise<
  AuthContext | { error: string }
> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };
  const supabase = await createClient();
  return { supabase, userId: user.id };
}
