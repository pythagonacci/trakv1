"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTableAccess } from "./context";
import { recomputeFormulasForRow } from "./formula-actions";
import { recomputeRollupsForRow, recomputeRollupsForTargetRowChanged } from "./rollup-actions";

type ActionResult<T> = { data: T } | { error: string };

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
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.rowIds.length === 0) return { data: null };

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id")
    .eq("table_id", input.tableId);
  const validIds = new Set((fields || []).map((f) => f.id));

  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, data")
    .eq("table_id", input.tableId)
    .in("id", input.rowIds);

  const payload = (rows || []).map((row) => {
    const cleanedData = sanitizeRowData((row.data as Record<string, unknown>) || {}, validIds);
    return {
      id: row.id,
      table_id: input.tableId,
      data: {
        ...cleanedData,
        ...input.updates,
      },
      updated_by: user.id,
    };
  });

  if (payload.length > 0) {
    const { error } = await supabase.from("table_rows").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error("bulkUpdateRows: failed to update rows:", error);
      return { error: error.message || "Failed to update rows" };
    }
  }

  for (const row of rows || []) {
    await recomputeFormulasForRow(input.tableId, row.id);
    await recomputeRollupsForTargetRowChanged(row.id, input.tableId);
  }

  return { data: null };
}

export async function bulkDeleteRows(input: {
  tableId: string;
  rowIds: string[];
}): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.rowIds.length === 0) return { data: null };

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
        updated_by: user.id,
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

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.rowIds.length === 0) return { data: null };

  const { data: rows } = await supabase
    .from("table_rows")
    .select("*")
    .eq("table_id", input.tableId)
    .in("id", input.rowIds);

  if (!rows || rows.length === 0) return { data: null };

  const payload = rows.map((row, idx) => ({
    table_id: row.table_id,
    data: row.data,
    order: Number(row.order) + 0.001 * (idx + 1),
    created_by: user.id,
    updated_by: user.id,
  }));

  const { error } = await supabase.from("table_rows").insert(payload);
  if (error) return { error: "Failed to duplicate rows" };
  return { data: null };
}
