"use server";

// Table refactor baseline (Sept 2024):
// - Rows are currently stored inside blocks.content; this file introduces Supabase-backed row CRUD for the new table_rows schema.
// - Triggers set ordering/updated_at and validate JSON; we still validate membership via requireTableAccess.

import { requireTableAccess } from "./context";
import { syncRelationLinks } from "./relation-actions";
import { recomputeFormulasForRow } from "./formula-actions";
import { recomputeRollupsForRow, recomputeRollupsForTargetRowChanged } from "./rollup-actions";
import type { TableField } from "@/types/table";
import type { TableRow } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface CreateRowInput {
  tableId: string;
  data?: Record<string, unknown>;
  order?: string | number | null;
}

export async function createRow(input: CreateRowInput): Promise<ActionResult<TableRow>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return access;
  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      table_id: input.tableId,
      data: input.data || {},
      order: input.order ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create row" };
  }

  await recomputeFormulasForRow(input.tableId, data.id);
  await recomputeRollupsForRow(input.tableId, data.id);

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", data.id)
    .single();

  return { data: (refreshed as TableRow) || data };
}

export async function updateRow(rowId: string, updates: { data?: Record<string, unknown> }): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId);
  if ("error" in access) return access;
  const { supabase, userId, row } = access;

  const mergedData = { ...(row?.data || {}), ...(updates.data || {}) };

  const { data, error } = await supabase
    .from("table_rows")
    .update({
      data: mergedData,
      updated_by: userId,
    })
    .eq("id", rowId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update row" };
  }

  await recomputeFormulasForRow(row.table_id, rowId);
  await recomputeRollupsForTargetRowChanged(rowId, row.table_id);

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", rowId)
    .single();

  return { data: (refreshed as TableRow) || data };
}

export async function updateCell(rowId: string, fieldId: string, value: unknown): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId);
  if ("error" in access) {
    console.error("updateCell: getRowContext error:", access.error);
    return access;
  }
  const { supabase, userId, row } = access;

  // Get all valid field IDs for this table to filter out deleted fields
  const { data: fields, error: fieldsError } = await supabase
    .from("table_fields")
    .select("id, type, config")
    .eq("table_id", row.table_id);

  if (fieldsError) {
    console.error("updateCell: Failed to fetch fields:", fieldsError);
    return { error: "Failed to validate field" };
  }

  // Check if the field being updated exists
  const field = (fields || []).find((f) => f.id === fieldId) as TableField | undefined;
  if (!field) {
    return { error: `Field ${fieldId} does not exist in this table` };
  }

  if (["rollup", "formula", "created_time", "last_edited_time", "created_by", "last_edited_by"].includes(field.type)) {
    return { error: "This field is read-only" };
  }

  // Get set of valid field IDs for filtering
  const validFieldIds = new Set(fields?.map((f) => f.id) || []);

  // Filter existing row data to only include valid fields, then merge with new value
  const existingData = row?.data || {};
  const filteredData: Record<string, unknown> = {};
  
  // Only keep data for fields that still exist
  for (const [key, val] of Object.entries(existingData)) {
    if (validFieldIds.has(key)) {
      filteredData[key] = val;
    }
  }

  // Add/update the field being edited
  const mergedData = { ...filteredData, [fieldId]: value };

  if (field.type === "relation") {
    /**
     * Relation update cascade:
     * 1) Sync relation links in table_relations (delta-based add/remove).
     * 2) Update cached relation ids in table_rows.data[fieldId].
     * 3) Recompute formulas on this row that depend on the relation.
     * 4) Recompute rollups on this row that use the relation.
     * 5) Recompute rollups on related rows (bidirectional reverse field).
     */
    try {
      // Validate relation field config
      const relationConfig = field.config as any;
      if (!relationConfig?.relation_table_id && !relationConfig?.linkedTableId) {
        console.error("updateCell: Relation field missing related table config:", field.config);
        return { error: "Relation field is not properly configured. Please reconfigure the relation field." };
      }

      const nextRowIds = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
        : typeof value === "string" && value.length > 0
          ? [value]
          : [];

      const syncResult = await syncRelationLinks({
        fromRowId: rowId,
        fromField: { id: field.id, table_id: row.table_id, config: field.config },
        nextRowIds,
        userId,
      });

      if ("error" in syncResult) {
        console.error("updateCell: syncRelationLinks error:", syncResult.error);
        return { error: syncResult.error };
      }

      // Update row data with relation IDs immediately
      const updatedData = { ...mergedData, [fieldId]: nextRowIds };
      await supabase
        .from("table_rows")
        .update({
          data: updatedData,
          updated_by: userId,
        })
        .eq("id", rowId);

      // Recompute formulas and rollups (non-blocking)
      Promise.all([
        recomputeFormulasForRow(row.table_id, rowId, fieldId),
        recomputeRollupsForRow(row.table_id, rowId, fieldId),
      ]).catch((err) => {
        console.error("Error recomputing formulas/rollups:", err);
      });

      if (syncResult.data.reverseFieldId && syncResult.data.relatedTableId) {
        const impacted = [...(syncResult.data.added || []), ...(syncResult.data.removed || [])];
        Promise.all(
          impacted.map((relatedRowId) =>
            recomputeRollupsForRow(
              syncResult.data.relatedTableId,
              relatedRowId,
              syncResult.data.reverseFieldId
            )
          )
        ).catch((err) => {
          console.error("Error recomputing reverse rollups:", err);
        });
      }

      const { data: refreshed } = await supabase
        .from("table_rows")
        .select("*")
        .eq("id", rowId)
        .single();

      return { data: (refreshed as TableRow) || row };
    } catch (error) {
      console.error("updateCell: Relation update error:", error);
      return { error: error instanceof Error ? error.message : "Failed to update relation" };
    }
  }

  const { data, error } = await supabase
    .from("table_rows")
    .update({
      data: mergedData,
      updated_by: userId,
    })
    .eq("id", rowId)
    .select("*")
    .single();

  if (error) {
    console.error("updateCell: Supabase error:", error);
    return { error: `Failed to update cell: ${error.message || error.code || "Unknown error"}` };
  }

  if (!data) {
    console.error("updateCell: No data returned from update");
    return { error: "Failed to update cell: No data returned" };
  }

  await recomputeFormulasForRow(row.table_id, rowId, fieldId);
  await recomputeRollupsForTargetRowChanged(rowId, row.table_id, fieldId);

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", rowId)
    .single();

  return { data: (refreshed as TableRow) || data };
}

export async function deleteRow(rowId: string): Promise<ActionResult<null>> {
  const access = await getRowContext(rowId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { error } = await supabase.from("table_rows").delete().eq("id", rowId);
  if (error) {
    return { error: "Failed to delete row" };
  }
  return { data: null };
}

export async function deleteRows(rowIds: string[]): Promise<ActionResult<null>> {
  if (rowIds.length === 0) return { data: null };
  const access = await getRowContext(rowIds[0]);
  if ("error" in access) return access;
  const { supabase } = access;

  const { error } = await supabase.from("table_rows").delete().in("id", rowIds);
  if (error) {
    return { error: "Failed to delete rows" };
  }
  return { data: null };
}

export async function reorderRows(tableId: string, orders: Array<{ rowId: string; order: number | string }>): Promise<ActionResult<TableRow[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const payload = orders.map((o) => ({
    id: o.rowId,
    table_id: tableId,
    order: o.order,
  }));

  const { data, error } = await supabase.from("table_rows").upsert(payload, { onConflict: "id" }).select("*");
  if (error || !data) {
    return { error: "Failed to reorder rows" };
  }
  return { data };
}

export async function duplicateRow(rowId: string): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId);
  if ("error" in access) return access;
  const { supabase, userId, row } = access;

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      table_id: row.table_id,
      data: row.data,
      order: Number(row.order) + 0.001,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to duplicate row" };
  }
  return { data };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRowContext(rowId: string) {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("getRowContext: Auth error:", authError);
    return { error: "Unauthorized" } as const;
  }

  const { data: row, error } = await supabase
    .from("table_rows")
    .select("id, table_id, data, order")
    .eq("id", rowId)
    .maybeSingle();

  if (error) {
    console.error("getRowContext: Row fetch error:", error);
    return { error: `Row not found: ${error.message}` } as const;
  }
  
  if (!row) {
    console.error("getRowContext: Row not found for id:", rowId);
    return { error: "Row not found" } as const;
  }

  const access = await requireTableAccess(row.table_id);
  if ("error" in access) {
    console.error("getRowContext: Table access error:", access.error);
    return access;
  }

  return { supabase: access.supabase, userId: user.id, row };
}
