"use server";

import { createClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/get-server-user";
import { revalidatePath } from "next/cache";

export interface StandaloneTask {
  id: string;
  workspace_id: string;
  text: string;
  status: "todo" | "in-progress" | "done";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignees?: string[];
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

// Create a standalone task
export async function createStandaloneTask(workspaceId: string, taskData: {
  text: string;
  status?: "todo" | "in-progress" | "done";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignees?: string[];
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  description?: string;
}) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase, user } = authResult;

  // Check workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "You must be a workspace member to create tasks" };
  }

  const { data: task, error } = await supabase
    .from("standalone_tasks")
    .insert({
      workspace_id: workspaceId,
      text: taskData.text,
      status: taskData.status || "todo",
      priority: taskData.priority || "none",
      assignees: taskData.assignees || [],
      due_date: taskData.dueDate || null,
      due_time: taskData.dueTime || null,
      tags: taskData.tags || [],
      description: taskData.description || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
  return { data: task };
}

// Get all standalone tasks for a workspace
export async function getStandaloneTasks(workspaceId: string) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase, user } = authResult;

  // Check workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "You must be a workspace member to view tasks" };
  }

  const { data: tasks, error } = await supabase
    .from("standalone_tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  // Transform to match expected format
  const transformedTasks = (tasks || []).map((task: any) => ({
    id: task.id,
    workspace_id: task.workspace_id,
    text: task.text,
    status: task.status,
    priority: task.priority,
    assignees: task.assignees || [],
    dueDate: task.due_date,
    dueTime: task.due_time,
    tags: task.tags || [],
    description: task.description,
    created_at: task.created_at,
    updated_at: task.updated_at,
  }));

  return { data: transformedTasks };
}

// Update a standalone task
export async function updateStandaloneTask(taskId: string, updates: Partial<StandaloneTask>) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase, user } = authResult;

  // Verify task exists and user has access
  const { data: task, error: fetchError } = await supabase
    .from("standalone_tasks")
    .select("workspace_id")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return { error: "Task not found" };
  }

  // Check workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", task.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "You must be a workspace member to update tasks" };
  }

  // Prepare update data
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.text !== undefined) updateData.text = updates.text;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.assignees !== undefined) updateData.assignees = updates.assignees;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate || null;
  if (updates.dueTime !== undefined) updateData.due_time = updates.dueTime || null;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.description !== undefined) updateData.description = updates.description || null;

  const { data: updatedTask, error } = await supabase
    .from("standalone_tasks")
    .update(updateData)
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
  return { data: updatedTask };
}

// Delete a standalone task
export async function deleteStandaloneTask(taskId: string) {
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Unauthorized" };
  }
  const { supabase, user } = authResult;

  // Verify task exists and user has access
  const { data: task, error: fetchError } = await supabase
    .from("standalone_tasks")
    .select("workspace_id")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return { error: "Task not found" };
  }

  // Check workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", task.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "You must be a workspace member to delete tasks" };
  }

  const { error } = await supabase
    .from("standalone_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tasks");
  return { success: true };
}

