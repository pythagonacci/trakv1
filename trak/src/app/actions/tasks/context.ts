"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/auth-context";

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

/** Optional timing sink for createTaskItem flow: t_auth_ms, t_ctx_ms, etc. */
export type TaskTimingSink = Record<string, number>;

export async function requireTaskBlockAccess(
  taskBlockId: string,
  opts?: { timing?: TaskTimingSink; authContext?: AuthContext }
): Promise<{ error: string } | TaskAccessContext> {
  const timing = opts?.timing;

  let supabase: SupabaseClient;
  let userId: string;
  const tAuth0 = performance.now();
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
  if (timing) timing.t_auth_ms = Math.round(performance.now() - tAuth0);

  const tCtx0 = performance.now();
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

  const workspaceId = (block.tabs as { projects?: { workspace_id: string; id: string } })?.projects?.workspace_id as string | undefined;
  const projectId = (block.tabs as { projects?: { id: string } })?.projects?.id as string | undefined;

  if (!workspaceId) {
    return { error: "Task block is missing workspace" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (timing) timing.t_ctx_ms = Math.round(performance.now() - tCtx0);
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

export async function requireWorkspaceAccessForTasks(
  workspaceId: string,
  opts?: { authContext?: AuthContext }
) {
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

/** One DB call log entry for setTaskAssignees instrumentation */
export type DbCallLog = { table: string; op: string; ms: number };

export async function requireTaskItemAccess(
  taskId: string,
  opts?: { dbCalls?: DbCallLog[]; authContext?: AuthContext }
) {
  let supabase: SupabaseClient;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" } as const;
    supabase = client;
    userId = user.id;
  }

  const tTaskItems0 = performance.now();
  const { data: task, error: taskError } = await supabase
    .from("task_items")
    .select("id, workspace_id")
    .eq("id", taskId)
    .single();
  if (opts?.dbCalls) opts.dbCalls.push({ table: "task_items", op: "select", ms: Math.round(performance.now() - tTaskItems0) });

  if (taskError || !task) return { error: "Task not found" } as const;

  const membership = await checkWorkspaceMembership(task.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return { supabase, userId, task } as const;
}

export async function requireTaskSubtaskAccess(
  subtaskId: string,
  opts?: { authContext?: AuthContext }
) {
  let supabase: SupabaseClient;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" } as const;
    supabase = client;
    userId = user.id;
  }

  const { data: subtask, error: subtaskError } = await supabase
    .from("task_subtasks")
    .select("id, task_id")
    .eq("id", subtaskId)
    .single();
  if (subtaskError || !subtask) return { error: "Subtask not found" } as const;

  const { data: task } = await supabase
    .from("task_items")
    .select("id, workspace_id")
    .eq("id", subtask.task_id)
    .single();
  if (!task) return { error: "Task not found" } as const;

  const membership = await checkWorkspaceMembership(task.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return { supabase, userId, subtask, task } as const;
}
