"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function requireTimelineAccess(timelineBlockId: string): Promise<{ error: string } | TimelineAccessContext> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

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

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return {
    supabase,
    userId: user.id,
    block: {
      id: block.id,
      tab_id: block.tab_id,
      workspace_id: workspaceId,
      project_id: projectId ?? null,
    },
  };
}

export async function requireWorkspaceAccessForTimeline(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId: user.id };
}
