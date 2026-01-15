"use server";

import { requireTaskItemAccess } from "./context";
import type { TaskAssignee } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function setTaskAssignees(
  taskId: string,
  assignees: Array<{ id?: string | null; name?: string | null }>
): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return access;
  const { supabase } = access;

  const normalized = assignees
    .map((a) => ({
      id: a.id ?? null,
      name: a.name ?? null,
    }))
    .filter((a) => a.id || a.name);

  const { error: clearError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId);

  if (clearError) return { error: "Failed to update assignees" };

  if (normalized.length === 0) return { data: null };

  const payload = normalized.map((assignee) => ({
    task_id: taskId,
    assignee_id: assignee.id,
    assignee_name: assignee.name,
  }));

  const { error } = await supabase.from("task_assignees").insert(payload);
  if (error) return { error: "Failed to update assignees" };

  return { data: null };
}

export async function listTaskAssignees(taskId: string): Promise<ActionResult<TaskAssignee[]>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_assignees")
    .select("*")
    .eq("task_id", taskId);

  if (error || !data) return { error: "Failed to load assignees" };
  return { data: data as TaskAssignee[] };
}
