"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/auth-context";

export interface TimelineAccessContext {
  supabase: SupabaseClient;
  userId: string;
  block: {
    id: string;
    tab_id: string;
    workspace_id: string;
    project_id: string | null;
  };
}

export async function requireTimelineAccess(timelineBlockId: string, opts?: { authContext?: AuthContext }): Promise<{ error: string } | TimelineAccessContext> {
  let supabase: SupabaseClient;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, tab_id, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
    .eq("id", timelineBlockId)
    .maybeSingle();

  if (blockError || !block) {
    return { error: "Timeline block not found" };
  }

  const workspaceId = (block.tabs as any)?.projects?.workspace_id as string | undefined;
  const projectId = (block.tabs as any)?.projects?.id as string | undefined;

  if (!workspaceId) {
    return { error: "Timeline block is missing workspace" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return {
    supabase,
    userId,
    block: {
      id: block.id,
      tab_id: block.tab_id,
      workspace_id: workspaceId,
      project_id: projectId ?? null,
    },
  };
}

export async function requireWorkspaceAccessForTimeline(workspaceId: string, opts?: { authContext?: AuthContext }) {
  let supabase: SupabaseClient;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId };
}
