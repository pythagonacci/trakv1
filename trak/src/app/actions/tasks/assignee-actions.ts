"use server";

import { requireTaskItemAccess, type TaskTimingSink, type DbCallLog } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { aiDebug } from "@/lib/ai/debug";
import type { TaskAssignee } from "@/types/task";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult<T> = { data: T } | { error: string };

function logDbCall(table: string, op: string, ms: number) {
  aiDebug("setTaskAssignees:db", { table, op, ms });
}

export async function setTaskAssignees(
  taskId: string,
  assignees: Array<{ id?: string | null; name?: string | null }>,
  opts?: { timing?: TaskTimingSink; replaceExisting?: boolean; authContext?: AuthContext }
): Promise<ActionResult<null>> {
  const t0 = performance.now();
  const dbCalls: DbCallLog[] = [];
  const access = await requireTaskItemAccess(taskId, { dbCalls, authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  for (const c of dbCalls) logDbCall(c.table, c.op, c.ms);
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

  // Step 1: Clear existing assignees only when replacing (skip for newly created tasks — they have none)
  const replaceExisting = opts?.replaceExisting !== false;
  if (replaceExisting) {
    const tDel0 = performance.now();
    const { error: clearError } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId);
    const tDelMs = Math.round(performance.now() - tDel0);
    dbCalls.push({ table: "task_assignees", op: "delete", ms: tDelMs });
    logDbCall("task_assignees", "delete", tDelMs);
    if (clearError) return { error: "Failed to update assignees" };
  }

  // Step 2: Insert new assignees into task_assignees table
  if (normalized.length > 0) {
    const payload = normalized.map((assignee) => {
      const name = assignee.name?.trim();
      const id = assignee.id;
      return {
        task_id: taskId,
        assignee_id: id,
        assignee_name: name || id || "Unknown",
      };
    });

    const tIns0 = performance.now();
    const { error } = await supabase.from("task_assignees").insert(payload);
    const tInsMs = Math.round(performance.now() - tIns0);
    dbCalls.push({ table: "task_assignees", op: "insert", ms: tInsMs });
    logDbCall("task_assignees", "insert", tInsMs);
    if (error) return { error: "Failed to update assignees" };
  }

  // Step 3: Sync to entity_properties table for AI search.
  if (normalized.length > 0) {
    const assigneeValue = normalized.map((a) => ({
      id: a.id,
      name: a.name || a.id || "Unknown",
    }));
    const tEp0 = performance.now();
    const { error: epError } = await supabase
      .from("entity_properties")
      .upsert(
        {
          workspace_id: workspaceId,
          entity_type: "task",
          entity_id: taskId,
          field_name: "Assignee",
          field_type: "assignee",
          value: assigneeValue,
        },
        { onConflict: "entity_type,entity_id,field_name" }
      );
    const tEpMs = Math.round(performance.now() - tEp0);
    dbCalls.push({ table: "entity_properties", op: "upsert", ms: tEpMs });
    logDbCall("entity_properties", "upsert", tEpMs);
    if (epError) return { error: "Failed to update assignees" };
  } else {
    const tEpDel0 = performance.now();
    await supabase
      .from("entity_properties")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("entity_type", "task")
      .eq("entity_id", taskId)
      .eq("field_name", "Assignee");
    const tEpDelMs = Math.round(performance.now() - tEpDel0);
    dbCalls.push({ table: "entity_properties", op: "delete", ms: tEpDelMs });
    logDbCall("entity_properties", "delete", tEpDelMs);
  }

  // Step 4: Keep task_items.assignee_id in sync (denormalized first assignee) so task_items is consistent
  // regardless of whether assignee was set via Property menu (setEntityProperties) or via setTaskAssignees (e.g. AI).
  const firstAssigneeId = normalized.length > 0 ? (normalized[0].id ?? null) : null;
  const namedAssignees =
    normalized.length > 0
      ? [{
          field_name: "Assignee",
          value: normalized
            .map((assignee) => assignee.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        }]
      : [];
  const tTi0 = performance.now();
  const { error: tiError } = await supabase
    .from("task_items")
    .update({ assignee_id: firstAssigneeId, assignees: namedAssignees })
    .eq("id", taskId);
  const tTiMs = Math.round(performance.now() - tTi0);
  if (tiError) {
    console.error("setTaskAssignees task_items.assignee_id sync error:", tiError);
    // Non-fatal: task_assignees and entity_properties are already correct; UI and AI use those.
  } else {
    dbCalls.push({ table: "task_items", op: "update", ms: tTiMs });
    logDbCall("task_items", "update", tTiMs);
  }

  if (opts?.timing) opts.timing.t_insert_assignees_ms = Math.round(performance.now() - t0);
  aiDebug("setTaskAssignees:db_calls_summary", { count: dbCalls.length, calls: dbCalls, total_ms: Math.round(performance.now() - t0) });
  return { data: null };
}

export async function listTaskAssignees(taskId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TaskAssignee[]>> {
  const access = await requireTaskItemAccess(taskId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_assignees")
    .select("*")
    .eq("task_id", taskId);

  if (error || !data) return { error: "Failed to load assignees" };
  return { data: data as TaskAssignee[] };
}
