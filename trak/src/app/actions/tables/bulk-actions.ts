"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { aiTiming, aiDebug, isAITimingEnabled } from "@/lib/ai/debug";
import { requireTableAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { recomputeFormulasForRow } from "./formula-actions";
import { recomputeRollupsForRow, recomputeRollupsForTargetRowChanged } from "./rollup-actions";

type ActionResult<T> = { data: T } | { error: string };

const RPC_BULK_UPDATE_ROWS = "bulk_update_rows";
const RPC_BULK_DELETE_ROWS = "bulk_delete_rows";
const RPC_BULK_DUPLICATE_ROWS = "bulk_duplicate_rows";
const RPC_BULK_INSERT_ROWS = "bulk_insert_rows";

const RPC_DISABLED = process.env.DISABLE_RPC === "true";

function unwrapRpcData<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function sanitizeRowData(rowData: Record<string, unknown>, validIds: Set<string>) {
  const cleaned: Record<string, unknown> = {};
  Object.entries(rowData || {}).forEach(([key, value]) => {
    if (key.endsWith("_computed_at")) {
      cleaned[key] = value;
      return;
    }
    if (validIds.has(key)) {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

export async function bulkUpdateRows(input: {
  tableId: string;
  rowIds: string[];
  updates: Record<string, unknown>;
}): Promise<ActionResult<null>> {
  const timingEnabled = isAITimingEnabled();
  const timingStart = timingEnabled ? Date.now() : 0;
  let t_access_ms = 0;
  let t_fetch_fields_ms = 0;
  let t_fetch_rows_ms = 0;
  let t_fetch_rollup_fields_ms = 0;
  let t_upsert_ms = 0;
  let t_recompute_formulas_ms = 0;
  let t_recompute_rollups_ms = 0;
  let rowsCount = 0;
  let skippedFormulas = false;
  let skippedRollups = false;

  const accessStart = timingEnabled ? Date.now() : 0;
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };
  const userId = user.id;

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  if (timingEnabled) t_access_ms = Date.now() - accessStart;

  if (input.rowIds.length === 0) return { data: null };

  if (!RPC_DISABLED) {
    const rpcResult = await supabase.rpc(RPC_BULK_UPDATE_ROWS, {
      p_table_id: input.tableId,
      p_row_ids: input.rowIds,
      p_updates: input.updates,
      p_updated_by: userId,
    });
    aiDebug("rpc:result", { name: RPC_BULK_UPDATE_ROWS, ok: !rpcResult.error, table: "table_rows" });
    if (!rpcResult.error) {
      return { data: null };
    }
  } else {
    aiDebug("rpc:skip", { name: RPC_BULK_UPDATE_ROWS, reason: "disabled" });
  }

  const fetchFieldsStart = timingEnabled ? Date.now() : 0;
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, type, config")
    .eq("table_id", input.tableId);
  if (timingEnabled) t_fetch_fields_ms = Date.now() - fetchFieldsStart;
  const validIds = new Set((fields || []).map((f) => f.id));

  const fetchRowsStart = timingEnabled ? Date.now() : 0;
  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, data, source_entity_id")
    .eq("table_id", input.tableId)
    .in("id", input.rowIds);
  if (timingEnabled) t_fetch_rows_ms = Date.now() - fetchRowsStart;
  rowsCount = rows?.length ?? 0;

  const payload = (rows || []).map((row) => {
    const cleanedData = sanitizeRowData((row.data as Record<string, unknown>) || {}, validIds);
    const updateItem: Record<string, unknown> = {
      id: row.id,
      table_id: input.tableId,
      data: {
        ...cleanedData,
        ...input.updates,
      },
      updated_by: user.id,
    };

    // Mark as edited if this is a snapshot
    if ((row as any).source_entity_id) {
      updateItem.edited = true;
    }

    return updateItem;
  });

  const changedFieldIds = Object.keys(input.updates || {}).filter((key) => key.length > 0);
  const changedFieldIdSet = new Set(changedFieldIds);
  let shouldRecomputeFormulas = false;
  let shouldRecomputeRollups = false;
  let rollupTargetFieldIds: string[] = [];
  let formulaHasUnknownDeps = false;

  if (changedFieldIdSet.size > 0) {
    const formulaFields = (fields || []).filter((field) => field.type === "formula");
    if (formulaFields.length > 0) {
      for (const field of formulaFields) {
        const deps = (field.config as any)?.dependencies as string[] | undefined;
        if (!deps || deps.length === 0) {
          formulaHasUnknownDeps = true;
          shouldRecomputeFormulas = true;
          break;
        }
        if (deps.some((dep) => changedFieldIdSet.has(dep))) {
          shouldRecomputeFormulas = true;
          break;
        }
      }
    }

    const rollupFieldsStart = timingEnabled ? Date.now() : 0;
    const { data: rollupFields } = await supabase
      .from("table_fields")
      .select("id, config")
      .eq("type", "rollup");
    if (timingEnabled) t_fetch_rollup_fields_ms = Date.now() - rollupFieldsStart;

    if (rollupFields && rollupFields.length > 0) {
      const targets = new Set<string>();
      for (const field of rollupFields) {
        const cfg = (field.config || {}) as Record<string, unknown>;
        const targetFieldId =
          (cfg.target_field_id as string | undefined) ||
          (cfg.relatedFieldId as string | undefined) ||
          (cfg.targetFieldId as string | undefined) ||
          null;
        if (targetFieldId && changedFieldIdSet.has(targetFieldId)) {
          targets.add(targetFieldId);
        }
      }
      if (targets.size > 0) {
        rollupTargetFieldIds = Array.from(targets);
        shouldRecomputeRollups = true;
      }
    }
  }

  if (payload.length > 0) {
    const upsertStart = timingEnabled ? Date.now() : 0;
    const { error } = await supabase.from("table_rows").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error("bulkUpdateRows: failed to update rows:", error);
      return { error: error.message || "Failed to update rows" };
    }
    if (timingEnabled) t_upsert_ms = Date.now() - upsertStart;
  }

  const recomputeStart = timingEnabled ? Date.now() : 0;
  if (shouldRecomputeFormulas) {
    const changedFieldIdForFormula =
      !formulaHasUnknownDeps && changedFieldIds.length === 1 ? changedFieldIds[0] : undefined;
    for (const row of rows || []) {
      await recomputeFormulasForRow(input.tableId, row.id, changedFieldIdForFormula);
    }
  } else {
    skippedFormulas = true;
  }
  if (timingEnabled) t_recompute_formulas_ms = Date.now() - recomputeStart;

  const rollupStart = timingEnabled ? Date.now() : 0;
  if (shouldRecomputeRollups) {
    for (const row of rows || []) {
      if (rollupTargetFieldIds.length <= 1) {
        await recomputeRollupsForTargetRowChanged(
          row.id,
          input.tableId,
          rollupTargetFieldIds[0]
        );
      } else {
        for (const targetFieldId of rollupTargetFieldIds) {
          await recomputeRollupsForTargetRowChanged(row.id, input.tableId, targetFieldId);
        }
      }
    }
  } else {
    skippedRollups = true;
  }
  if (timingEnabled) t_recompute_rollups_ms = Date.now() - rollupStart;

  if (timingEnabled) {
    aiTiming({
      event: "bulkUpdateRows",
      tableId: input.tableId,
      rows: rowsCount,
      t_access_ms,
      t_fetch_fields_ms,
      t_fetch_rows_ms,
      t_fetch_rollup_fields_ms,
      t_upsert_ms,
      t_recompute_formulas_ms,
      t_recompute_rollups_ms,
      skipped_formulas: skippedFormulas,
      skipped_rollups: skippedRollups,
      t_total_ms: Date.now() - timingStart,
    });
  }

  return { data: null };
}

export async function bulkDeleteRows(input: {
  tableId: string;
  rowIds: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string | null = null;
  if (input.authContext) {
    supabase = input.authContext.supabase;
    userId = input.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.rowIds.length === 0) return { data: null };

  if (!RPC_DISABLED) {
    const rpcResult = await supabase.rpc(RPC_BULK_DELETE_ROWS, {
      p_table_id: input.tableId,
      p_row_ids: input.rowIds,
      p_updated_by: userId,
    });
    aiDebug("rpc:result", { name: RPC_BULK_DELETE_ROWS, ok: !rpcResult.error, table: "table_rows" });
    if (!rpcResult.error) {
      return { data: null };
    }
  } else {
    aiDebug("rpc:skip", { name: RPC_BULK_DELETE_ROWS, reason: "disabled" });
  }

  const quotedIds = input.rowIds.map((id) => `"${id}"`).join(",");
  const { data: relationLinks } = await supabase
    .from("table_relations")
    .select("from_row_id, from_field_id, from_table_id, to_row_id")
    .or(`to_row_id.in.(${quotedIds})`);

  const { error } = await supabase
    .from("table_rows")
    .delete()
    .eq("table_id", input.tableId)
    .in("id", input.rowIds);

  if (error) return { error: "Failed to delete rows" };

  const affectedByRow = new Map<string, { tableId: string; fieldIds: Set<string>; removeIds: Set<string> }>();
  (relationLinks || []).forEach((rel) => {
    if (!rel.from_row_id || !rel.from_field_id) return;
    const entry = affectedByRow.get(rel.from_row_id) || {
      tableId: rel.from_table_id,
      fieldIds: new Set<string>(),
      removeIds: new Set<string>(),
    };
    entry.fieldIds.add(rel.from_field_id);
    entry.removeIds.add(rel.to_row_id);
    affectedByRow.set(rel.from_row_id, entry);
  });

  for (const [rowId, payload] of affectedByRow.entries()) {
    const { data: row } = await supabase
      .from("table_rows")
      .select("data")
      .eq("id", rowId)
      .single();
    if (!row) continue;

    const updatedData = { ...(row.data || {}) };
    payload.fieldIds.forEach((fieldId) => {
      const existing = Array.isArray(updatedData[fieldId]) ? (updatedData[fieldId] as string[]) : [];
      updatedData[fieldId] = existing.filter((id) => !payload.removeIds.has(id));
    });

    await supabase
      .from("table_rows")
      .update({
        data: updatedData,
        updated_by: userId,
      })
      .eq("id", rowId);

    await recomputeFormulasForRow(payload.tableId, rowId);
    await recomputeRollupsForRow(payload.tableId, rowId);
  }

  return { data: null };
}

export async function bulkDuplicateRows(input: {
  tableId: string;
  rowIds: string[];
}): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };
  const userId = user.id;

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.rowIds.length === 0) return { data: null };

  if (!RPC_DISABLED) {
    const rpcResult = await supabase.rpc(RPC_BULK_DUPLICATE_ROWS, {
      p_table_id: input.tableId,
      p_row_ids: input.rowIds,
      p_created_by: userId,
    });
    aiDebug("rpc:result", { name: RPC_BULK_DUPLICATE_ROWS, ok: !rpcResult.error, table: "table_rows" });
    if (!rpcResult.error) {
      return { data: null };
    }
  } else {
    aiDebug("rpc:skip", { name: RPC_BULK_DUPLICATE_ROWS, reason: "disabled" });
  }

  const { data: rows } = await supabase
    .from("table_rows")
    .select("*")
    .eq("table_id", input.tableId)
    .in("id", input.rowIds);

  if (!rows || rows.length === 0) return { data: null };

  const payload = rows.map((row, idx) => {
    const sourceEntityId = normalizeSourceEntityId(row.source_entity_id ?? null);
    return {
      table_id: row.table_id,
      data: row.data,
      order: Number(row.order) + 0.001 * (idx + 1),
      source_entity_type: sourceEntityId ? normalizeSourceEntityType(row.source_entity_type ?? null) : null,
      source_entity_id: sourceEntityId,
      source_sync_mode: row.source_sync_mode ?? "snapshot",
      created_by: userId,
      updated_by: userId,
    };
  });

  const { error } = await supabase.from("table_rows").insert(payload);
  if (error) return { error: "Failed to duplicate rows" };
  return { data: null };
}

export async function bulkInsertRows(input: {
  tableId: string;
  rows: Array<{
    data: Record<string, unknown>;
    order?: number | string | null;
    source_entity_type?: "task" | "timeline_event" | null;
    source_entity_id?: string | null;
    source_sync_mode?: "snapshot" | "live" | null;
  }>;
}): Promise<ActionResult<{ insertedIds: string[] }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };
  const userId = user.id;

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (!input.rows.length) return { data: { insertedIds: [] } };

  const hasSourceMetadata = input.rows.some(
    (row) => Boolean(row.source_entity_type && row.source_entity_id)
  );

  if (!RPC_DISABLED && !hasSourceMetadata) {
    const rpcResult = await supabase.rpc(RPC_BULK_INSERT_ROWS, {
      p_table_id: input.tableId,
      p_rows: input.rows,
      p_created_by: userId,
    });
    aiDebug("rpc:result", { name: RPC_BULK_INSERT_ROWS, ok: !rpcResult.error, table: "table_rows" });
    if (!rpcResult.error) {
      const payload = unwrapRpcData<Record<string, unknown>>(rpcResult.data as any) ?? {};
      const insertedIds = (payload.inserted_ids ?? payload.insertedIds ?? []) as string[];
      return { data: { insertedIds } };
    }
  } else {
    aiDebug("rpc:skip", { name: RPC_BULK_INSERT_ROWS, reason: "disabled" });
  }

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, type")
    .eq("table_id", input.tableId);

  const readOnlyTypes = new Set([
    "rollup",
    "formula",
    "created_time",
    "last_edited_time",
    "created_by",
    "last_edited_by",
  ]);
  const validIds = new Set(
    (fields || []).filter((field) => !readOnlyTypes.has(field.type)).map((field) => field.id)
  );

  const cleanedRows = input.rows.map((row) => {
    const sourceEntityId = normalizeSourceEntityId(row.source_entity_id);
    return {
      table_id: input.tableId,
      data: sanitizeRowData(row.data || {}, validIds),
      order: row.order ?? null,
      source_entity_type: sourceEntityId ? normalizeSourceEntityType(row.source_entity_type) : null,
      source_entity_id: sourceEntityId,
      source_sync_mode: sourceEntityId ? normalizeSourceSyncMode(row.source_sync_mode) : null,
      created_by: userId,
      updated_by: userId,
    };
  });

  const chunkSize = 100;
  const insertedIds: string[] = [];
  for (let i = 0; i < cleanedRows.length; i += chunkSize) {
    const chunk = cleanedRows.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("table_rows")
      .insert(chunk)
      .select("id");
    if (error) {
      console.error("bulkInsertRows: failed to insert rows:", error);
      return { error: error.message || "Failed to insert rows" };
    }
    if (data) {
      data.forEach((row) => insertedIds.push(row.id));
    }
  }

  await Promise.all(
    insertedIds.map(async (rowId) => {
      await recomputeFormulasForRow(input.tableId, rowId);
      await recomputeRollupsForRow(input.tableId, rowId);
    })
  );

  return { data: { insertedIds } };
}

function normalizeSourceEntityType(value: unknown): "task" | "timeline_event" | null {
  if (value === "task" || value === "timeline_event") return value;
  return null;
}

function normalizeSourceSyncMode(value: unknown): "snapshot" | "live" | null {
  if (value === "live") return "live";
  if (value === "snapshot") return "snapshot";
  // Default to snapshot when a value is provided but not explicitly "live"
  return "snapshot";
}

function normalizeSourceEntityId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
