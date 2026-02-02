"use server";

import { requireTaskItemAccess, type TaskTimingSink, type DbCallLog } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { aiDebug } from "@/lib/ai/debug";
import type { TaskAssignee } from "@/types/task";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult<T> = { data: T } | { error: string };

/** Cache Assignee property_definition id per workspace to avoid repeated property_definitions select. */
const assigneePropertyDefCache = new Map<string, { id: string }>();

function logDbCall(table: string, op: string, ms: number) {
  aiDebug("setTaskAssignees:db", { table, op, ms });
}

async function getAssigneePropertyDefId(
  supabase: SupabaseClient,
  workspaceId: string,
  dbCalls: DbCallLog[]
): Promise<{ id: string } | null> {
  const cached = assigneePropertyDefCache.get(workspaceId);
  if (cached) return cached;

  const t0 = performance.now();
  const { data } = await supabase
    .from("property_definitions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Assignee")
    .eq("type", "person")
    .single();
  const ms = Math.round(performance.now() - t0);
  dbCalls.push({ table: "property_definitions", op: "select", ms });
  logDbCall("property_definitions", "select", ms);

  if (data) {
    assigneePropertyDefCache.set(workspaceId, { id: data.id });
    return { id: data.id };
  }
  return null;
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

  // Step 3: Sync to entity_properties table for AI search (property_def id cached per workspace)
  const assigneePropertyDef = await getAssigneePropertyDefId(supabase, workspaceId, dbCalls);

  if (assigneePropertyDef) {
    if (normalized.length > 0) {
      // Upsert: one round-trip instead of delete + insert (unique on entity_type, entity_id, property_definition_id)
      const primaryAssignee = normalized[0];
      const assigneeValue = {
        id: primaryAssignee.id,
        name: primaryAssignee.name || primaryAssignee.id || "Unknown",
      };
      const tEp0 = performance.now();
      const { error: epError } = await supabase
        .from("entity_properties")
        .upsert(
          {
            workspace_id: workspaceId,
            entity_type: "task",
            entity_id: taskId,
            property_definition_id: assigneePropertyDef.id,
            value: assigneeValue,
          },
          { onConflict: "entity_type,entity_id,property_definition_id" }
        );
      const tEpMs = Math.round(performance.now() - tEp0);
      dbCalls.push({ table: "entity_properties", op: "upsert", ms: tEpMs });
      logDbCall("entity_properties", "upsert", tEpMs);
      if (epError) return { error: "Failed to update assignees" };
    } else {
      // No assignees: remove the assignee property row
      const tEpDel0 = performance.now();
      await supabase
        .from("entity_properties")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("entity_type", "task")
        .eq("entity_id", taskId)
        .eq("property_definition_id", assigneePropertyDef.id);
      const tEpDelMs = Math.round(performance.now() - tEpDel0);
      dbCalls.push({ table: "entity_properties", op: "delete", ms: tEpDelMs });
      logDbCall("entity_properties", "delete", tEpDelMs);
    }
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
