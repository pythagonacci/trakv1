"use server";

import { requireTaskItemAccess } from "./context";
import type { TaskComment } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function createTaskComment(input: {
  taskId: string;
  text: string;
}): Promise<ActionResult<TaskComment>> {
  const access = await requireTaskItemAccess(input.taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: input.taskId,
      author_id: userId,
      text: input.text,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create comment" };
  return { data: data as TaskComment };
}

export async function updateTaskComment(
  commentId: string,
  updates: Partial<{ text: string }>
): Promise<ActionResult<TaskComment>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: comment, error: commentError } = await supabase
    .from("task_comments")
    .select("id, task_id")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) return { error: "Comment not found" };

  const { data: task } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", comment.task_id)
    .single();

  if (!task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const payload: Record<string, any> = {};
  if (updates.text !== undefined) payload.text = updates.text;

  const { data, error } = await supabase
    .from("task_comments")
    .update(payload)
    .eq("id", commentId)
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to update comment" };
  return { data: data as TaskComment };
}

export async function deleteTaskComment(commentId: string): Promise<ActionResult<null>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: comment, error: commentError } = await supabase
    .from("task_comments")
    .select("id, task_id")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) return { error: "Comment not found" };

  const { data: task } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", comment.task_id)
    .single();

  if (!task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  if (error) return { error: "Failed to delete comment" };
  return { data: null };
}
