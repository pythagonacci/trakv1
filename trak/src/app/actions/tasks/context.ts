"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TaskAccessContext {
  supabase: SupabaseClient;
  userId: string;
  block: {
    id: string;
    tab_id: string;
    workspace_id: string;
    project_id: string | null;
  };
}

export async function requireTaskBlockAccess(taskBlockId: string): Promise<{ error: string } | TaskAccessContext> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, tab_id, type, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
    .eq("id", taskBlockId)
    .maybeSingle();

  if (blockError || !block) {
    return { error: "Task block not found" };
  }

  if (block.type !== "task") {
    return { error: "Block is not a task block" };
  }

  const workspaceId = (block.tabs as any)?.projects?.workspace_id as string | undefined;
  const projectId = (block.tabs as any)?.projects?.id as string | undefined;

  if (!workspaceId) {
    return { error: "Task block is missing workspace" };
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

export async function requireWorkspaceAccessForTasks(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId: user.id };
}

export async function requireTaskItemAccess(taskId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const { data: task, error: taskError } = await supabase
    .from("task_items")
    .select("id, workspace_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) return { error: "Task not found" } as const;

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return { supabase, userId: user.id, task } as const;
}
