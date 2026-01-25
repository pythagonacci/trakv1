"use server";

import { requireTaskItemAccess } from "./context";
import type { TaskAssignee } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function setTaskAssignees(
  taskId: string,
  assignees: Array<{ id?: string | null; name?: string | null }>
): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, task } = access;
  const workspaceId = task.workspace_id;

  // Validate assignees array
  if (!Array.isArray(assignees)) {
    return { error: "Assignees must be an array. Example: [{id: 'user-uuid', name: 'User Name'}]" };
  }

  const normalized = assignees
    .map((a) => ({
      id: a.id ?? null,
      name: a.name ?? null,
    }))
    .filter((a) => a.id || a.name);

  // Warn about potential issues (for debugging)
  const missingNames = normalized.filter((a) => a.id && !a.name);
  if (missingNames.length > 0) {
    console.warn(
      `[setTaskAssignees] Warning: ${missingNames.length} assignee(s) have ID but no name. ` +
      `This may indicate the AI didn't fetch user details from searchWorkspaceMembers.`
    );
  }

  // Step 1: Clear existing assignees from task_assignees table
  const { error: clearError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId);

  if (clearError) return { error: "Failed to update assignees" };

  // Step 2: Insert new assignees into task_assignees table
  if (normalized.length > 0) {
    // Ensure assignee_name is always populated (required by schema)
    const payload = normalized.map((assignee) => {
      const name = assignee.name?.trim();
      const id = assignee.id;

      // If we have a name, use it; otherwise use a placeholder
      // This handles cases where only an ID is provided
      return {
        task_id: taskId,
        assignee_id: id,
        assignee_name: name || id || "Unknown",
      };
    });

    const { error } = await supabase.from("task_assignees").insert(payload);
    if (error) return { error: "Failed to update assignees" };
  }

  // Step 3: Sync to entity_properties table for AI search
  // Find the "Assignee" property definition
  const { data: assigneePropertyDef } = await supabase
    .from("property_definitions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Assignee")
    .eq("type", "person")
    .single();

  if (assigneePropertyDef) {
    // Remove existing assignee property
    await supabase
      .from("entity_properties")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("entity_type", "task")
      .eq("entity_id", taskId)
      .eq("property_definition_id", assigneePropertyDef.id);

    // Insert new assignee property if there are assignees
    // Note: entity_properties stores a single assignee as {id, name}
    // If there are multiple assignees, we store the first one
    if (normalized.length > 0) {
      const primaryAssignee = normalized[0];
      const assigneeValue = {
        id: primaryAssignee.id,
        name: primaryAssignee.name || primaryAssignee.id || "Unknown",
      };

      await supabase.from("entity_properties").insert({
        workspace_id: workspaceId,
        entity_type: "task",
        entity_id: taskId,
        property_definition_id: assigneePropertyDef.id,
        value: assigneeValue,
      });
    }
  }

  return { data: null };
}

export async function listTaskAssignees(taskId: string): Promise<ActionResult<TaskAssignee[]>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_assignees")
    .select("*")
    .eq("task_id", taskId);

  if (error || !data) return { error: "Failed to load assignees" };
  return { data: data as TaskAssignee[] };
}
