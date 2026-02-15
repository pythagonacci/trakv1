"use server";

import type { AuthContext } from "@/lib/auth-context";
import { aiDebug } from "@/lib/ai/debug";
import { requireTableAccess, requireWorkspaceAccessForTables } from "./context";

type ActionResult<T> = { data: T } | { error: string };

const RPC_CREATE_TABLE_FULL = "create_table_full";
const RPC_UPDATE_TABLE_FULL = "update_table_full";
const RPC_UPDATE_ROWS_BY_FIELD_NAMES = "update_table_rows_by_field_names";
const RPC_BULK_UPDATE_ROWS_BY_FIELD_NAMES = "bulk_update_rows_by_field_names";

const RPC_DISABLED = process.env.DISABLE_RPC === "true";

function unwrapRpcData<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function createTableFullRpc(input: {
  workspaceId: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  tabId?: string | null;
  fields?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  authContext?: AuthContext;
}): Promise<ActionResult<{ tableId: string; fieldsCreated: number; rowsInserted: number }>> {
  const access = await requireWorkspaceAccessForTables(input.workspaceId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_CREATE_TABLE_FULL, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_CREATE_TABLE_FULL, table: "tables" });
  const { data, error } = await supabase.rpc(RPC_CREATE_TABLE_FULL, {
    p_workspace_id: input.workspaceId,
    p_title: input.title,
    p_created_by: userId,
    p_project_id: input.projectId ?? null,
    p_tab_id: input.tabId ?? null,
    p_description: input.description ?? null,
    p_fields: input.fields ?? [],
    p_rows: input.rows ?? [],
  });

  // Log full error details for debugging
  aiDebug("rpc:result", {
    name: RPC_CREATE_TABLE_FULL,
    ok: !error,
    ms: Math.round(performance.now() - t0),
    error: error ? {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    } : undefined,
    dataReceived: !!data
  });

  if (error) {
    return { error: error.message || "RPC create_table_full failed" };
  }

  const payload = unwrapRpcData<Record<string, unknown>>(data as any);
  const tableId = (payload?.result_table_id ?? payload?.table_id ?? payload?.tableId) as string | undefined;
  if (!tableId) {
    return { error: "RPC create_table_full returned invalid table_id" };
  }

  const fieldsCreatedRaw = payload?.result_fields_created ?? payload?.fields_created ?? payload?.fieldsCreated ?? 0;
  const rowsInsertedRaw = payload?.result_rows_inserted ?? payload?.rows_inserted ?? payload?.rowsInserted ?? 0;

  return {
    data: {
      tableId,
      fieldsCreated: Number(fieldsCreatedRaw) || 0,
      rowsInserted: Number(rowsInsertedRaw) || 0,
    },
  };
}

export async function updateTableFullRpc(input: {
  tableId: string;
  title?: string;
  description?: string | null;
  addFields?: Array<Record<string, unknown>>;
  updateFields?: Array<Record<string, unknown>>;
  deleteFields?: string[];
  insertRows?: Array<Record<string, unknown>>;
  updateRows?: Record<string, unknown>;
  deleteRowIds?: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<Record<string, number>>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_UPDATE_TABLE_FULL, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_UPDATE_TABLE_FULL, table: "tables" });
  const { data, error } = await supabase.rpc(RPC_UPDATE_TABLE_FULL, {
    p_table_id: input.tableId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_updated_by: userId,
    p_add_fields: input.addFields ?? [],
    p_update_fields: input.updateFields ?? [],
    p_delete_fields: input.deleteFields ?? [],
    p_insert_rows: input.insertRows ?? [],
    p_update_rows: input.updateRows ?? null,
    p_delete_row_ids: input.deleteRowIds ?? [],
  });
  aiDebug("rpc:result", {
    name: RPC_UPDATE_TABLE_FULL,
    ok: !error,
    ms: Math.round(performance.now() - t0),
    error: error ? error.message : undefined
  });

  if (error) {
    return { error: error.message || "RPC update_table_full failed" };
  }

  const payload = unwrapRpcData<Record<string, unknown>>(data as any);
  if (!payload || typeof payload !== "object") {
    return { error: "RPC update_table_full returned invalid payload" };
  }

  const summary: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "number") summary[key] = value;
  }

  return { data: summary };
}

export async function updateTableRowsByFieldNamesRpc(input: {
  tableId: string;
  filters?: Record<string, unknown>;
  updates: Record<string, unknown>;
  limit?: number;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updated: number; rowIds: string[] }>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_UPDATE_ROWS_BY_FIELD_NAMES, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_UPDATE_ROWS_BY_FIELD_NAMES, table: "table_rows" });
  const { data, error } = await supabase.rpc(RPC_UPDATE_ROWS_BY_FIELD_NAMES, {
    p_table_id: input.tableId,
    p_filters: input.filters ?? null,
    p_updates: input.updates,
    p_limit: input.limit ?? null,
    p_updated_by: userId,
  });
  aiDebug("rpc:result", {
    name: RPC_UPDATE_ROWS_BY_FIELD_NAMES,
    ok: !error,
    ms: Math.round(performance.now() - t0),
    error: error ? error.message : undefined
  });

  if (error) {
    return { error: error.message || "RPC update_table_rows_by_field_names failed" };
  }

  const payload = unwrapRpcData<Record<string, unknown>>(data as any) ?? {};
  return {
    data: {
      updated: Number(payload.updated ?? payload.updated_count ?? 0),
      rowIds: (payload.row_ids ?? payload.rowIds ?? []) as string[],
    },
  };
}

export async function bulkUpdateRowsByFieldNamesRpc(input: {
  tableId: string;
  rows: Array<Record<string, unknown>>;
  limit?: number;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updated: number; rowIds: string[] }>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  if (RPC_DISABLED) {
    aiDebug("rpc:skip", { name: RPC_BULK_UPDATE_ROWS_BY_FIELD_NAMES, reason: "disabled" });
    return { error: "RPC disabled" };
  }

  const t0 = performance.now();
  aiDebug("rpc:start", { name: RPC_BULK_UPDATE_ROWS_BY_FIELD_NAMES, table: "table_rows" });
  const { data, error } = await supabase.rpc(RPC_BULK_UPDATE_ROWS_BY_FIELD_NAMES, {
    p_table_id: input.tableId,
    p_rows: input.rows,
    p_limit: input.limit ?? null,
    p_updated_by: userId,
  });
  aiDebug("rpc:result", {
    name: RPC_BULK_UPDATE_ROWS_BY_FIELD_NAMES,
    ok: !error,
    ms: Math.round(performance.now() - t0),
    error: error ? error.message : undefined
  });

  if (error) {
    return { error: error.message || "RPC bulk_update_rows_by_field_names failed" };
  }

  const payload = unwrapRpcData<Record<string, unknown>>(data as any) ?? {};
  return {
    data: {
      updated: Number(payload.updated ?? payload.updated_count ?? 0),
      rowIds: (payload.row_ids ?? payload.rowIds ?? []) as string[],
    },
  };
}
