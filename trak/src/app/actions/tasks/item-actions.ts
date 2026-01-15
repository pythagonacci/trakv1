"use server";

import { requireTaskBlockAccess, requireTaskItemAccess } from "./context";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function createTaskItem(input: {
  taskBlockId: string;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  hideIcons?: boolean;
  recurring?: {
    enabled: boolean;
    frequency?: "daily" | "weekly" | "monthly";
    interval?: number;
  };
}): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskBlockAccess(input.taskBlockId);
  if ("error" in access) return access;
  const { supabase, userId, block } = access;

  const { data: maxOrder } = await supabase
    .from("task_items")
    .select("display_order")
    .eq("task_block_id", block.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = maxOrder?.display_order !== undefined ? maxOrder.display_order + 1 : 0;

  const { data, error } = await supabase
    .from("task_items")
    .insert({
      task_block_id: block.id,
      workspace_id: block.workspace_id,
      project_id: block.project_id,
      tab_id: block.tab_id,
      title: input.title,
      status: input.status ?? "todo",
      priority: input.priority ?? "none",
      description: input.description ?? null,
      due_date: input.dueDate ?? null,
      due_time: input.dueTime ?? null,
      start_date: input.startDate ?? null,
      hide_icons: input.hideIcons ?? false,
      display_order: nextOrder,
      recurring_enabled: input.recurring?.enabled ?? false,
      recurring_frequency: input.recurring?.frequency ?? null,
      recurring_interval: input.recurring?.interval ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create task" };
  return { data: data as TaskItem };
}

export async function updateTaskItem(
  taskId: string,
  updates: Partial<{
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    description: string | null;
    dueDate: string | null;
    dueTime: string | null;
    startDate: string | null;
    hideIcons: boolean;
    recurringEnabled: boolean;
    recurringFrequency: "daily" | "weekly" | "monthly" | null;
    recurringInterval: number | null;
  }>
): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return access;
  const { supabase, userId } = access;

  const payload: Record<string, any> = {
    updated_by: userId,
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.dueTime !== undefined) payload.due_time = updates.dueTime;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.hideIcons !== undefined) payload.hide_icons = updates.hideIcons;
  if (updates.recurringEnabled !== undefined) payload.recurring_enabled = updates.recurringEnabled;
  if (updates.recurringFrequency !== undefined) payload.recurring_frequency = updates.recurringFrequency;
  if (updates.recurringInterval !== undefined) payload.recurring_interval = updates.recurringInterval;

  const { data, error } = await supabase
    .from("task_items")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to update task" };
  return { data: data as TaskItem };
}

export async function deleteTaskItem(taskId: string): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { error } = await supabase.from("task_items").delete().eq("id", taskId);
  if (error) return { error: "Failed to delete task" };
  return { data: null };
}

export async function reorderTaskItems(taskBlockId: string, orderedIds: string[]): Promise<ActionResult<null>> {
  const access = await requireTaskBlockAccess(taskBlockId);
  if ("error" in access) return access;
  const { supabase } = access;

  const updates = orderedIds.map((id, idx) => ({ id, display_order: idx }));
  const { error } = await supabase.from("task_items").upsert(updates, { onConflict: "id" });
  if (error) return { error: "Failed to reorder tasks" };
  return { data: null };
}
