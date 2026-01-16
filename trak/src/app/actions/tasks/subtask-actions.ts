"use server";

import { requireTaskItemAccess } from "./context";
import type { TaskSubtask } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function createTaskSubtask(input: {
  taskId: string;
  title: string;
  completed?: boolean;
  displayOrder?: number;
}): Promise<ActionResult<TaskSubtask>> {
  const access = await requireTaskItemAccess(input.taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_subtasks")
    .insert({
      task_id: input.taskId,
      title: input.title,
      completed: input.completed ?? false,
      display_order: input.displayOrder ?? 0,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create subtask" };
  return { data: data as TaskSubtask };
}

export async function updateTaskSubtask(
  subtaskId: string,
  updates: Partial<{ title: string; completed: boolean; displayOrder: number }>
): Promise<ActionResult<TaskSubtask>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: subtask, error: subtaskError } = await supabase
    .from("task_subtasks")
    .select("id, task_id")
    .eq("id", subtaskId)
    .single();

  if (subtaskError || !subtask) return { error: "Subtask not found" };

  const { data: task } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", subtask.task_id)
    .single();

  if (!task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;

  const { data, error } = await supabase
    .from("task_subtasks")
    .update(payload)
    .eq("id", subtaskId)
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to update subtask" };
  return { data: data as TaskSubtask };
}

export async function deleteTaskSubtask(subtaskId: string): Promise<ActionResult<null>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: subtask, error: subtaskError } = await supabase
    .from("task_subtasks")
    .select("id, task_id")
    .eq("id", subtaskId)
    .single();

  if (subtaskError || !subtask) return { error: "Subtask not found" };

  const { data: task } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", subtask.task_id)
    .single();

  if (!task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("task_subtasks").delete().eq("id", subtaskId);
  if (error) return { error: "Failed to delete subtask" };
  return { data: null };
}
