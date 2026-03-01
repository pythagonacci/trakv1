"use server";

import type { AuthContext } from "@/lib/auth-context";
import { aiDebug } from "@/lib/ai/debug";
import type { TaskItem, TaskItemPriority, TaskPriority } from "@/types/task";
import { requireTaskBlockAccess, requireTaskItemAccess } from "./context";
import { deriveTaskSeedFromTableRowSource } from "@/lib/tasks/table-row-task-derivation";

type ActionResult<T> = { data: T } | { error: string };

const RPC_CREATE_TASK_FULL = "create_task_full";
const RPC_UPDATE_TASK_FULL = "update_task_full";
const RPC_BULK_UPDATE_TASK_ITEMS = "bulk_update_task_items";
const RPC_BULK_MOVE_TASK_ITEMS = "bulk_move_task_items";
const RPC_BULK_SET_TASK_ASSIGNEES = "bulk_set_task_assignees";
const RPC_DUPLICATE_TASKS_TO_BLOCK = "duplicate_tasks_to_block";

const RPC_DISABLED = process.env.DISABLE_RPC === "true";

function unwrapRpcData<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function toPriorities(priority?: string | null): TaskItemPriority[] {
  if (!priority || priority === "none") return [];
  if (priority !== "low" && priority !== "medium" && priority !== "high" && priority !== "urgent") return [];
  return [{ field_name: "Priority", value: priority }];
}

function toStatuses(status?: string | null): any {
  if (!status) return [];
  const normalizedStatus =
    status === "in-progress" || status === "in progress"
      ? "in_progress"
      : status;
  if (
    normalizedStatus !== "todo" &&
    normalizedStatus !== "in_progress" &&
    normalizedStatus !== "blocked" &&
    normalizedStatus !== "done"
  ) {
    return [];
  }
  return [{ field_name: "Status", value: normalizedStatus }];
}

function normalizeTaskRow(row: any): TaskItem {
  const priorities = Array.isArray(row?.priorities) ? row.priorities : toPriorities(row?.priority);
  return {
    ...(row as TaskItem),
    priorities: priorities as TaskItemPriority[],
  };
}

export async function createTaskFullRpc(input: {
  taskBlockId: string;
  title: string;
  status?: string;
  statuses?: any[];
  priority?: string;
  priorities?: TaskItemPriority[];
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  hideIcons?: boolean;
  recurring?: { enabled: boolean; frequency?: "daily" | "weekly" | "monthly"; interval?: number };
  sourceEntityType?: "task" | "timeline_event" | "table_row" | "block";
  sourceEntityId?: string | null;
  sourceSyncMode?: "snapshot" | "live";
  assignees?: Array<{ id?: string | null; name?: string | null }>;
  tags?: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskBlockAccess(input.taskBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;
  const isTableRowSource = input.sourceEntityType === "table_row" && Boolean(input.sourceEntityId);
  const derivedRowSeed = isTableRowSource && input.sourceEntityId
    ? await deriveTaskSeedFromTableRowSource(supabase, input.sourceEntityId)
    : null;
  const resolvedTitle = derivedRowSeed?.title?.trim() || input.title;
  const resolvedStatuses = input.statuses && input.statuses.length > 0
    ? input.statuses
    : (derivedRowSeed?.statuses?.length ? derivedRowSeed.statuses : toStatuses(input.status ?? null));
  const resolvedPriorities =
    input.priorities && input.priorities.length > 0
      ? input.priorities
      : derivedRowSeed?.priorities?.length
        ? derivedRowSeed.priorities
        : isTableRowSource
          ? []
          : toPriorities(input.priority ?? null);
  const resolvedStartDate = input.startDate ?? derivedRowSeed?.preferred_start_date ?? null;
  const resolvedDueDate = input.dueDate ?? derivedRowSeed?.preferred_due_date ?? null;
  const resolvedAssignees =
    input.assignees && input.assignees.length > 0
      ? input.assignees
      : (derivedRowSeed?.preferred_assignee_ids ?? []).map((id) => ({ id, name: null }));
  const resolvedTags = input.tags && input.tags.length > 0 ? input.tags : (derivedRowSeed?.tags ?? []);

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_CREATE_TASK_FULL, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_CREATE_TASK_FULL, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_CREATE_TASK_FULL, {
    p_task_block_id: input.taskBlockId,
    p_title: resolvedTitle,
    p_status: input.status ?? null,
    p_statuses: resolvedStatuses,
    p_priorities: resolvedPriorities,
    p_description: input.description ?? null,
    p_due_date: resolvedDueDate,
    p_due_time: input.dueTime ?? null,
    p_start_date: resolvedStartDate,
    p_hide_icons: input.hideIcons ?? null,
    p_recurring_enabled: input.recurring?.enabled ?? false,
    p_recurring_frequency: input.recurring?.frequency ?? null,
    p_recurring_interval: input.recurring?.interval ?? null,
    p_source_entity_type: input.sourceEntityType ?? null,
    p_source_entity_id: input.sourceEntityId ?? null,
    p_source_sync_mode: input.sourceSyncMode ?? null,
    p_assignees: resolvedAssignees,
    p_tags: resolvedTags,
    p_created_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_CREATE_TASK_FULL, ok: !error, ms: Math.round(performance.now() - t0) });

  if (error) {
    aiDebug("rpc:error", {
      name: RPC_CREATE_TASK_FULL,
      message: error.message,
      code: (error as any).code,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    return { error: error.message || "RPC create_task_full failed" };
  }

  const payload = unwrapRpcData<Record<string, unknown>>(data as any);
  if (!payload) return { error: "RPC create_task_full returned empty payload" };

  const task = normalizeTaskRow(payload.task ?? payload);

  if (isTableRowSource && task?.id && derivedRowSeed) {
    try {
      const { setEntityProperties } = await import("@/app/actions/entity-properties");
      const updates: Record<string, unknown> = {};
      if (derivedRowSeed.statuses.length > 0) updates.statuses = derivedRowSeed.statuses;
      if (derivedRowSeed.priorities.length > 0) updates.priorities = derivedRowSeed.priorities;
      if (derivedRowSeed.assignees.length > 0) updates.assignees = derivedRowSeed.assignees;
      if (derivedRowSeed.due_dates.length > 0) updates.due_dates = derivedRowSeed.due_dates;
      if (derivedRowSeed.tags.length > 0) updates.tags = derivedRowSeed.tags;

      if (Object.keys(updates).length > 0) {
        await setEntityProperties({
          entity_type: "task",
          entity_id: task.id,
          workspace_id: block.workspace_id,
          updates: updates as any,
        });
      }

      if (derivedRowSeed.tag_fields.length > 0) {
        await supabase
          .from("entity_properties")
          .upsert(
            derivedRowSeed.tag_fields.map((entry) => ({
              workspace_id: block.workspace_id,
              entity_type: "task",
              entity_id: task.id,
              field_name: entry.field_name,
              field_type: "tags",
              value: entry.value,
            })),
            { onConflict: "entity_type,entity_id,field_name" }
          );
      }
    } catch (syncError) {
      console.error("createTaskFullRpc table-row derivation sync failed", {
        taskId: task.id,
        error: syncError,
      });
    }
  }

  return { data: task };
}

export async function updateTaskFullRpc(input: {
  taskId: string;
  updates: Record<string, unknown>;
  assignees?: Array<{ id?: string | null; name?: string | null }>;
  assigneesSet?: boolean;
  tags?: string[];
  tagsSet?: boolean;
  authContext?: AuthContext;
}): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskItemAccess(input.taskId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_UPDATE_TASK_FULL, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const rpcUpdates = { ...(input.updates || {}) } as Record<string, unknown>;

  if (!("priorities" in rpcUpdates) && typeof rpcUpdates.priority === "string") {
    rpcUpdates.priorities = toPriorities(rpcUpdates.priority);
  }
  delete (rpcUpdates as any).priority;

  if (!("statuses" in rpcUpdates) && typeof rpcUpdates.status === "string") {
    rpcUpdates.statuses = toStatuses(rpcUpdates.status);
  }
  delete (rpcUpdates as any).status;

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_UPDATE_TASK_FULL, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_UPDATE_TASK_FULL, {
    p_task_id: input.taskId,
    p_updates: rpcUpdates,
    p_assignees: input.assignees ?? [],
    p_assignees_set: input.assigneesSet ?? false,
    p_tags: input.tags ?? [],
    p_tags_set: input.tagsSet ?? false,
    p_updated_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_UPDATE_TASK_FULL, ok: !error, ms: Math.round(performance.now() - t0) });

  if (error) return { error: error.message || "RPC update_task_full failed" };

  const payload = unwrapRpcData<Record<string, unknown>>(data as any);
  if (!payload) return { error: "RPC update_task_full returned empty payload" };

  const task = normalizeTaskRow(payload.task ?? payload);
  return { data: task };
}

export async function bulkUpdateTaskItemsRpc(input: {
  taskIds: string[];
  updates: Record<string, unknown>;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updatedCount: number; skipped: string[] }>> {
  if (input.taskIds.length === 0) return { data: { updatedCount: 0, skipped: [] } };

  const access = await requireTaskItemAccess(input.taskIds[0], { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_BULK_UPDATE_TASK_ITEMS, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const rpcUpdates = { ...(input.updates || {}) } as Record<string, unknown>;

  if (!("priorities" in rpcUpdates) && typeof rpcUpdates.priority === "string") {
    rpcUpdates.priorities = toPriorities(rpcUpdates.priority);
  }
  delete (rpcUpdates as any).priority;

  if (!("statuses" in rpcUpdates) && typeof rpcUpdates.status === "string") {
    rpcUpdates.statuses = toStatuses(rpcUpdates.status);
  }
  delete (rpcUpdates as any).status;

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_BULK_UPDATE_TASK_ITEMS, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_BULK_UPDATE_TASK_ITEMS, {
    p_task_ids: input.taskIds,
    p_updates: rpcUpdates,
    p_updated_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_BULK_UPDATE_TASK_ITEMS, ok: !error, ms: Math.round(performance.now() - t0) });

  if (error) return { error: error.message || "RPC bulk_update_task_items failed" };

  const payload = unwrapRpcData<Record<string, unknown>>(data as any) ?? {};
  return {
    data: {
      updatedCount: Number(payload.updated_count ?? payload.updatedCount ?? 0),
      skipped: (payload.skipped ?? []) as string[],
    },
  };
}

export async function bulkMoveTaskItemsRpc(input: {
  taskIds: string[];
  targetBlockId: string;
  authContext?: AuthContext;
}): Promise<ActionResult<{ movedCount: number; skipped: string[] }>> {
  if (input.taskIds.length === 0) return { data: { movedCount: 0, skipped: [] } };

  const access = await requireTaskBlockAccess(input.targetBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_BULK_MOVE_TASK_ITEMS, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_BULK_MOVE_TASK_ITEMS, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_BULK_MOVE_TASK_ITEMS, {
    p_task_ids: input.taskIds,
    p_target_block_id: block.id,
    p_tab_id: block.tab_id,
    p_project_id: block.project_id,
    p_workspace_id: block.workspace_id,
    p_updated_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_BULK_MOVE_TASK_ITEMS, ok: !error, ms: Math.round(performance.now() - t0) });

  if (error) return { error: error.message || "RPC bulk_move_task_items failed" };

  const payload = unwrapRpcData<Record<string, unknown>>(data as any) ?? {};
  return {
    data: {
      movedCount: Number(payload.moved_count ?? payload.movedCount ?? 0),
      skipped: (payload.skipped ?? []) as string[],
    },
  };
}

export async function bulkSetTaskAssigneesRpc(input: {
  taskIds: string[];
  assignees: Array<{ id?: string | null; name?: string | null }>;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updatedCount: number; failures?: Array<{ taskId: string; error: string }> }>> {
  if (input.taskIds.length === 0) return { data: { updatedCount: 0 } };

  const access = await requireTaskItemAccess(input.taskIds[0], { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_BULK_SET_TASK_ASSIGNEES, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_BULK_SET_TASK_ASSIGNEES, table: "task_assignees" });
  const { data, error } = await supabase.rpc(RPC_BULK_SET_TASK_ASSIGNEES, {
    p_task_ids: input.taskIds,
    p_assignees: input.assignees,
    p_updated_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_BULK_SET_TASK_ASSIGNEES, ok: !error, ms: Math.round(performance.now() - t0) });

  if (error) return { error: error.message || "RPC bulk_set_task_assignees failed" };

  const payload = unwrapRpcData<Record<string, unknown>>(data as any) ?? {};
  return {
    data: {
      updatedCount: Number(payload.updated_count ?? payload.updatedCount ?? 0),
      failures: (payload.failures ?? undefined) as Array<{ taskId: string; error: string }> | undefined,
    },
  };
}

export async function duplicateTasksToBlockRpc(input: {
  taskIds: string[];
  targetBlockId: string;
  includeAssignees?: boolean;
  includeTags?: boolean;
  authContext?: AuthContext;
}): Promise<ActionResult<{ createdCount: number; createdTaskIds: string[]; skipped: string[] }>> {
  if (input.taskIds.length === 0) return { data: { createdCount: 0, createdTaskIds: [], skipped: [] } };

  const access = await requireTaskBlockAccess(input.targetBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_DUPLICATE_TASKS_TO_BLOCK, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_DUPLICATE_TASKS_TO_BLOCK, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_DUPLICATE_TASKS_TO_BLOCK, {
    p_task_ids: input.taskIds,
    p_target_block_id: block.id,
    p_tab_id: block.tab_id,
    p_project_id: block.project_id,
    p_workspace_id: block.workspace_id,
    p_include_assignees: input.includeAssignees ?? true,
    p_include_tags: input.includeTags ?? true,
    p_created_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_DUPLICATE_TASKS_TO_BLOCK, ok: !error, ms: Math.round(performance.now() - t0), error: error?.message ?? null, blockWorkspaceId: block.workspace_id, taskIdCount: input.taskIds.length });

  if (error) return { error: error.message || "RPC duplicate_tasks_to_block failed" };

  const payload = unwrapRpcData<Record<string, unknown>>(data as any) ?? {};
  return {
    data: {
      createdCount: Number(payload.created_count ?? payload.createdCount ?? 0),
      createdTaskIds: (payload.created_task_ids ?? payload.createdTaskIds ?? []) as string[],
      skipped: (payload.skipped ?? []) as string[],
    },
  };
}
