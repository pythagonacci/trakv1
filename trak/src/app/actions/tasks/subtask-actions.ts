"use server";

import { requireTaskItemAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskSubtask } from "@/types/task";
import type { EntityProperties, Status } from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

export async function createTaskSubtask(input: {
  taskId: string;
  title: string;
  description?: string | null;
  completed?: boolean;
  displayOrder?: number;
  authContext?: AuthContext;
}): Promise<ActionResult<TaskSubtask>> {
  const access = await requireTaskItemAccess(input.taskId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_subtasks")
    .insert({
      task_id: input.taskId,
      title: input.title,
      description: input.description ?? null,
      completed: input.completed ?? false,
      display_order: input.displayOrder ?? 0,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create subtask" };
  const { setEntityProperties } = await import("@/app/actions/entity-properties");
  await setEntityProperties({
    entity_type: "subtask",
    entity_id: data.id,
    workspace_id: access.task.workspace_id,
    updates: { status: (input.completed ? "done" : "todo") as any },
  });
  return { data: data as TaskSubtask };
}

export async function updateTaskSubtask(
  subtaskId: string,
  updates: Partial<{
    title: string;
    description: string | null;
    completed: boolean;
    displayOrder: number;
    status: Status;
    priority: EntityProperties["priority"];
    assignee_ids: string[];
    assignee_id: string | null;
    due_date: EntityProperties["due_date"];
    tags: string[];
  }>,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<TaskSubtask>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const { getAuthenticatedUser } = await import("@/lib/auth-utils");
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }
  const { checkWorkspaceMembership } = await import("@/lib/auth-utils");

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

  const membership = await checkWorkspaceMembership(task.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;

  let data: TaskSubtask | null = null;
  if (Object.keys(payload).length > 0) {
    const { data: updated, error } = await supabase
      .from("task_subtasks")
      .update(payload)
      .eq("id", subtaskId)
      .select("*")
      .single();
    if (error || !updated) return { error: "Failed to update subtask" };
    data = updated as TaskSubtask;
  }

  const propertyUpdates: Partial<EntityProperties> = {};
  if (updates.status !== undefined) propertyUpdates.status = updates.status;
  if (updates.completed !== undefined && updates.status === undefined) {
    propertyUpdates.status = updates.completed ? "done" : "todo";
  }
  if (updates.priority !== undefined) propertyUpdates.priority = updates.priority;
  if (updates.assignee_ids !== undefined) propertyUpdates.assignee_ids = updates.assignee_ids;
  if (updates.assignee_id !== undefined) propertyUpdates.assignee_id = updates.assignee_id;
  if (updates.due_date !== undefined) propertyUpdates.due_date = updates.due_date;
  if (updates.tags !== undefined) propertyUpdates.tags = updates.tags;

  if (Object.keys(payload).length === 0 && Object.keys(propertyUpdates).length === 0) {
    return { error: "No updates provided" };
  }

  if (Object.keys(propertyUpdates).length > 0) {
    const { setEntityProperties } = await import("@/app/actions/entity-properties");
    await setEntityProperties({
      entity_type: "subtask",
      entity_id: subtaskId,
      workspace_id: task.workspace_id,
      updates: propertyUpdates,
    });
  }

  if (!data) {
    const { data: refreshed, error: refreshError } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("id", subtaskId)
      .single();
    if (refreshError || !refreshed) return { error: "Failed to load updated subtask" };
    data = refreshed as TaskSubtask;
  }

  return { data: data as TaskSubtask };
}

export async function deleteTaskSubtask(subtaskId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const { getAuthenticatedUser } = await import("@/lib/auth-utils");
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }
  const { checkWorkspaceMembership } = await import("@/lib/auth-utils");

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

  const membership = await checkWorkspaceMembership(task.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  // Delete entity_properties for this subtask
  await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", "subtask")
    .eq("entity_id", subtaskId);

  // Delete the subtask itself
  const { error } = await supabase.from("task_subtasks").delete().eq("id", subtaskId);
  if (error) return { error: "Failed to delete subtask" };

  // Recompute parent task properties from remaining subtasks
  const { recomputeTaskPropertiesFromSubtasks } = await import("@/app/actions/entity-properties");
  await recomputeTaskPropertiesFromSubtasks(subtask.task_id);
  return { data: null };
}

export async function reorderSubtasks(
  taskId: string,
  orderedSubtaskIds: string[],
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const { getAuthenticatedUser } = await import("@/lib/auth-utils");
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }
  const { checkWorkspaceMembership } = await import("@/lib/auth-utils");

  const { data: task, error: taskError } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  // Verify all subtasks belong to this task
  const { data: subtasks, error: subtasksError } = await supabase
    .from("task_subtasks")
    .select("id")
    .eq("task_id", taskId)
    .in("id", orderedSubtaskIds);

  if (subtasksError) return { error: "Failed to load subtasks" };
  if (subtasks.length !== orderedSubtaskIds.length) {
    return { error: "Some subtasks do not belong to this task" };
  }

  const updates = orderedSubtaskIds.map((id, idx) => ({
    id,
    display_order: idx,
    task_id: taskId,
  }));

  const { error: updateError } = await supabase
    .from("task_subtasks")
    .upsert(updates, { onConflict: "id" });

  if (updateError) return { error: "Failed to reorder subtasks" };
  return { data: null };
}
