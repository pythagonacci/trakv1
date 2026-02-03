"use server";

import type { AuthContext } from "@/lib/auth-context";
import { aiDebug } from "@/lib/ai/debug";
import type { TaskItem } from "@/types/task";
import { requireTaskBlockAccess, requireTaskItemAccess } from "./context";

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

export async function createTaskFullRpc(input: {
  taskBlockId: string;
  title: string;
  status?: string;
  priority?: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  hideIcons?: boolean;
  recurring?: { enabled: boolean; frequency?: "daily" | "weekly" | "monthly"; interval?: number };
  assignees?: Array<{ id?: string | null; name?: string | null }>;
  tags?: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskBlockAccess(input.taskBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_CREATE_TASK_FULL, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_CREATE_TASK_FULL, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_CREATE_TASK_FULL, {
    p_task_block_id: input.taskBlockId,
    p_title: input.title,
    p_status: input.status ?? null,
    p_priority: input.priority ?? null,
    p_description: input.description ?? null,
    p_due_date: input.dueDate ?? null,
    p_due_time: input.dueTime ?? null,
    p_start_date: input.startDate ?? null,
    p_hide_icons: input.hideIcons ?? null,
    p_recurring_enabled: input.recurring?.enabled ?? false,
    p_recurring_frequency: input.recurring?.frequency ?? null,
    p_recurring_interval: input.recurring?.interval ?? null,
    p_assignees: input.assignees ?? [],
    p_tags: input.tags ?? [],
    p_created_by: userId,
  });
  aiDebug("rpc:result", { name: RPC_CREATE_TASK_FULL, ok: !error, ms: Math.round(performance.now() - t0) });

  if (error) return { error: error.message || "RPC create_task_full failed" };

  const payload = unwrapRpcData<Record<string, unknown>>(data as any);
  if (!payload) return { error: "RPC create_task_full returned empty payload" };

  const task = (payload.task ?? payload) as TaskItem;
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

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_UPDATE_TASK_FULL, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_UPDATE_TASK_FULL, {
    p_task_id: input.taskId,
    p_updates: input.updates,
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

  const task = (payload.task ?? payload) as TaskItem;
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

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_BULK_UPDATE_TASK_ITEMS, table: "task_items" });
  const { data, error } = await supabase.rpc(RPC_BULK_UPDATE_TASK_ITEMS, {
    p_task_ids: input.taskIds,
    p_updates: input.updates,
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
  aiDebug("rpc:result", { name: RPC_DUPLICATE_TASKS_TO_BLOCK, ok: !error, ms: Math.round(performance.now() - t0) });

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
