"use server";

// Table refactor baseline (Sept 2024):
// - Rows are currently stored inside blocks.content; this file introduces Supabase-backed row CRUD for the new table_rows schema.
// - Triggers set ordering/updated_at and validate JSON; we still validate membership via requireTableAccess.

import { requireTableAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { syncRelationLinks } from "./relation-actions";
import { recomputeFormulasForRow } from "./formula-actions";
import { recomputeRollupsForRow, recomputeRollupsForTargetRowChanged } from "./rollup-actions";
import type { TableField } from "@/types/table";
import type { TableRow } from "@/types/table";
import type { TableRowSourceEntityType, TableRowSourceSyncMode } from "@/types/table";
import { updateTaskItem } from "@/app/actions/tasks/item-actions";
import { updateTimelineEvent } from "@/app/actions/timelines/event-actions";
import { validateEventPriority, validateEventStatus } from "@/app/actions/timelines/validators";
import {
  mergeTimelinePriorityField,
  normalizeTimelinePriorities,
  syncTimelinePriorityFieldsToEntityProperties,
} from "@/lib/timeline-priority-sync";
import { syncTimelineStatusFieldsToEntityProperties } from "@/lib/timeline-status-sync";
import { setEntityProperties } from "@/app/actions/entity-properties";
import { parseDateSafe } from "@/lib/due-date";
import type { Status, Priority } from "@/types/properties";
import type { TimelineNamedPriority } from "@/types/timeline";
import type { TaskStatus } from "@/types/task";
import {
  isUniversalPropertyFieldType,
  normalizeUniversalPropertyValue,
} from "@/lib/tables/universal-property";
import { mapOptionIdsToTagNames, type TagFieldOption } from "@/lib/tables/tag-field-config";
import { deriveTaskSeedFromTableRowData } from "@/lib/tasks/table-row-task-derivation";

type ActionResult<T> = { data: T } | { error: string };

interface CreateRowInput {
  id?: string;
  tableId: string;
  data?: Record<string, unknown>;
  order?: string | number | null;
  sourceEntityType?: TableRowSourceEntityType | null;
  sourceEntityId?: string | null;
  sourceSyncMode?: TableRowSourceSyncMode;
  authContext?: AuthContext;
}

function normalizeUniversalPropertyRowData(
  inputData: Record<string, unknown> | undefined,
  fields: Array<Pick<TableField, "id" | "name" | "type" | "config">>
): { data: Record<string, unknown>; invalidValues: string[] } {
  const data = inputData || {};
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const normalized: Record<string, unknown> = {};
  const invalidValues: string[] = [];

  for (const [fieldId, rawValue] of Object.entries(data)) {
    const field = fieldById.get(fieldId);
    if (!field) {
      normalized[fieldId] = rawValue;
      continue;
    }

    if (!isUniversalPropertyFieldType(field.type) && (field.type === "select" || field.type === "multi_select")) {
      const config = (field.config || {}) as Record<string, unknown>;
      const options = (config.options as Array<{ id?: string; label?: string }> | undefined) ?? [];
      const resolveLabel = (value: unknown): string | null => {
        if (value === null || value === undefined || value === "") return null;
        const raw = String(value).trim();
        if (!raw) return null;
        const matched = options.find((opt) => opt.label === raw || opt.id === raw);
        return matched?.label ?? raw;
      };

      if (field.type === "multi_select") {
        const input = Array.isArray(rawValue) ? rawValue : rawValue === null || rawValue === undefined ? [] : [rawValue];
        const labels = input
          .map((entry) => resolveLabel(entry))
          .filter((entry): entry is string => Boolean(entry));
        normalized[fieldId] = labels.length > 0 ? labels : null;
      } else {
        normalized[fieldId] = resolveLabel(rawValue);
      }
      continue;
    }

    if (field.type === "tags") {
      const values = Array.isArray(rawValue) ? rawValue : rawValue === null || rawValue === undefined ? [] : [rawValue];
      const tags = values
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0);
      normalized[fieldId] = tags.length > 0 ? tags : null;
      continue;
    }

    if (!isUniversalPropertyFieldType(field.type)) {
      normalized[fieldId] = rawValue;
      continue;
    }

    if (rawValue === null || rawValue === undefined || rawValue === "") {
      normalized[fieldId] = null;
      continue;
    }

    const canonical = normalizeUniversalPropertyValue(field.type, rawValue);
    if (!canonical) {
      invalidValues.push(`${field.name}: ${String(rawValue)}`);
      normalized[fieldId] = null;
      continue;
    }
    normalized[fieldId] = canonical;
  }

  return { data: normalized, invalidValues };
}

export async function createRow(input: CreateRowInput): Promise<ActionResult<TableRow>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;
  const sourceEntityId = isUuidString(input.sourceEntityId) ? input.sourceEntityId : null;
  const sourceEntityType = sourceEntityId ? input.sourceEntityType ?? null : null;
  const sourceSyncMode = sourceEntityId ? (input.sourceSyncMode ?? "live") : null;
  const rowId = isUuidString(input.id) ? input.id : undefined;
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config")
    .eq("table_id", input.tableId);
  const normalizedInput = normalizeUniversalPropertyRowData(
    input.data,
    (fields ?? []) as Array<Pick<TableField, "id" | "name" | "type" | "config">>
  );
  if (normalizedInput.invalidValues.length > 0) {
    return {
      error:
        `Invalid priority/status value(s): ${normalizedInput.invalidValues.join(", ")}. ` +
        "Allowed priority: low|medium|high|urgent. Allowed status: todo|in_progress|done|blocked.",
    };
  }

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      ...(rowId ? { id: rowId } : {}),
      table_id: input.tableId,
      data: normalizedInput.data,
      order: input.order ?? null,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      source_sync_mode: sourceSyncMode,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create row" };
  }

  const hasFormulaFields = (fields ?? []).some((field) => field.type === "formula");
  const hasRollupFields = (fields ?? []).some((field) => field.type === "rollup");
  if (!hasFormulaFields && !hasRollupFields) {
    return { data: data as TableRow };
  }

  if (hasFormulaFields) {
    await recomputeFormulasForRow(input.tableId, data.id);
  }
  if (hasRollupFields) {
    await recomputeRollupsForRow(input.tableId, data.id);
  }

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", data.id)
    .single();

  return { data: (refreshed as TableRow) || data };
}

export async function updateRow(rowId: string, updates: { data?: Record<string, unknown> }, opts?: { authContext?: AuthContext }): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, row } = access;
  const authContext: AuthContext = opts?.authContext ?? { supabase, userId };

  const mergedData = { ...(row?.data || {}), ...(updates.data || {}) };
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config")
    .eq("table_id", row.table_id);
  const normalizedInput = normalizeUniversalPropertyRowData(
    mergedData,
    (fields ?? []) as Array<Pick<TableField, "id" | "name" | "type" | "config">>
  );
  if (normalizedInput.invalidValues.length > 0) {
    return {
      error:
        `Invalid priority/status value(s): ${normalizedInput.invalidValues.join(", ")}. ` +
        "Allowed priority: low|medium|high|urgent. Allowed status: todo|in_progress|done|blocked.",
    };
  }

  const { data, error } = await supabase
    .from("table_rows")
    .update({
      data: normalizedInput.data,
      updated_by: userId,
    })
    .eq("id", rowId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update row" };
  }

  const fieldsById = new Map<string, TableField>(
    ((fields ?? []) as TableField[]).map((field) => [field.id, field])
  );
  for (const fieldId of Object.keys(updates.data ?? {})) {
    const field = fieldsById.get(fieldId);
    if (!field) continue;
    await syncTableRowEditToSource({
      row,
      field,
      value: normalizedInput.data[fieldId],
      authContext,
    });
  }

  await recomputeFormulasForRow(row.table_id, rowId);
  await recomputeRollupsForTargetRowChanged(rowId, row.table_id);
  await syncSourceRowToDerived({
    rowId,
    tableId: row.table_id,
    rowData: normalizedInput.data,
    userId,
    supabase,
  });

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", rowId)
    .single();

  return { data: (refreshed as TableRow) || data };
}

export async function updateCell(rowId: string, fieldId: string, value: unknown, opts?: { authContext?: AuthContext }): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId, opts);
  if ("error" in access) {
    console.error("updateCell: getRowContext error:", access.error);
    return { error: access.error ?? "Unknown error" };
  }
  const { supabase, userId, row } = access;

  // Get all valid field IDs for this table to filter out deleted fields
  const { data: fields, error: fieldsError } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
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

  let normalizedCellValue = value;
  if (isUniversalPropertyFieldType(field.type)) {
    if (value === null || value === undefined || value === "") {
      normalizedCellValue = null;
    } else {
      const canonical = normalizeUniversalPropertyValue(field.type, value);
      if (!canonical) {
        return {
          error:
            `Invalid ${field.type} value "${String(value)}". ` +
            (field.type === "priority"
              ? "Allowed: low, medium, high, urgent."
              : "Allowed: todo, in_progress, done, blocked."),
        };
      }
      normalizedCellValue = canonical;
    }
  } else if (field.type === "select" || field.type === "multi_select") {
    const config = (field.config || {}) as Record<string, unknown>;
    const options = (config.options as Array<{ id?: string; label?: string }> | undefined) ?? [];
    const resolveLabel = (entry: unknown): string | null => {
      if (entry === null || entry === undefined || entry === "") return null;
      const raw = String(entry).trim();
      if (!raw) return null;
      const matched = options.find((opt) => opt.label === raw || opt.id === raw);
      return matched?.label ?? raw;
    };

    if (field.type === "multi_select") {
      const input = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
      const labels = input
        .map((entry) => resolveLabel(entry))
        .filter((entry): entry is string => Boolean(entry));
      normalizedCellValue = labels.length > 0 ? labels : null;
    } else {
      normalizedCellValue = resolveLabel(value);
    }
  } else if (field.type === "tags") {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    const tags = values
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    normalizedCellValue = tags.length > 0 ? tags : null;
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
  const mergedData = { ...filteredData, [fieldId]: normalizedCellValue };

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

      const nextRowIds = Array.isArray(normalizedCellValue)
        ? normalizedCellValue.filter((v): v is string => typeof v === "string" && v.length > 0)
        : typeof normalizedCellValue === "string" && normalizedCellValue.length > 0
          ? [normalizedCellValue]
          : [];

      const syncResult = await syncRelationLinks({
        fromRowId: rowId,
        fromField: { id: field.id, table_id: row.table_id, config: field.config },
        nextRowIds,
        userId,
      });

      if ("error" in syncResult) {
        console.error("updateCell: syncRelationLinks error:", syncResult.error);
        return { error: syncResult.error ?? "Unknown error" };
      }

      // Update row data with relation IDs immediately
      const updatedData = { ...mergedData, [fieldId]: nextRowIds };
      const updatePayload: Record<string, unknown> = {
        data: updatedData,
        updated_by: userId,
      };

      // Mark as edited if this is a snapshot
      if (row.source_entity_id) {
        updatePayload.edited = true;
      }

      await supabase
        .from("table_rows")
        .update(updatePayload)
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
              syncResult.data.reverseFieldId ?? undefined
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

  const updatePayload: Record<string, unknown> = {
    data: mergedData,
    updated_by: userId,
  };

  // Mark as edited if this is a snapshot
  if (row.source_entity_id) {
    updatePayload.edited = true;
  }

  const { data, error } = await supabase
    .from("table_rows")
    .update(updatePayload)
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

  // Sync universal property field updates to entity_properties
  if (field.type === "priority" || field.type === "status" || field.type === "person" || field.type === "date" || field.type === "tags") {
    const { data: tableData } = await supabase
      .from("tables")
      .select("workspace_id")
      .eq("id", row.table_id)
      .single();

    if (tableData?.workspace_id) {
      if (field.type === "priority" || field.type === "status") {
        // Upsert to entity_properties
        if (normalizedCellValue === null || normalizedCellValue === undefined || normalizedCellValue === "") {
          await supabase
            .from("entity_properties")
            .delete()
            .eq("entity_type", "table_row")
            .eq("entity_id", rowId)
            .eq("field_name", field.name);
        } else {
          await supabase
            .from("entity_properties")
            .upsert({
              entity_type: "table_row",
              entity_id: rowId,
              field_name: field.name,
              field_type: field.type,
              value: normalizedCellValue,
              workspace_id: tableData.workspace_id,
            }, {
              onConflict: "entity_type,entity_id,field_name"
            });
        }
      }

      if (field.type === "person") {
        const rawId = typeof normalizedCellValue === "string" ? normalizedCellValue.trim() : null;
        const assigneeValue = rawId ? [{ id: rawId }] : null;
        if (!assigneeValue) {
          await supabase
            .from("entity_properties")
            .delete()
            .eq("entity_type", "table_row")
            .eq("entity_id", rowId)
            .eq("field_name", field.name);
        } else {
          await supabase
            .from("entity_properties")
            .upsert({
              entity_type: "table_row",
              entity_id: rowId,
              workspace_id: tableData.workspace_id,
              field_name: field.name,
              field_type: "assignee",
              value: assigneeValue,
            }, { onConflict: "entity_type,entity_id,field_name" });
        }
      }

      if (field.type === "date") {
        const dateRange = normalizeDateRangeForTask(normalizedCellValue);
        if (!dateRange) {
          await supabase
            .from("entity_properties")
            .delete()
            .eq("entity_type", "table_row")
            .eq("entity_id", rowId)
            .eq("field_name", field.name);
        } else {
          await supabase
            .from("entity_properties")
            .upsert({
              entity_type: "table_row",
              entity_id: rowId,
              workspace_id: tableData.workspace_id,
              field_name: field.name,
              field_type: "due_date",
              value: dateRange,
            }, { onConflict: "entity_type,entity_id,field_name" });
        }
      }

      if (field.type === "tags") {
        const tagNames = Array.isArray(normalizedCellValue) ? normalizedCellValue as string[] : [];
        if (tagNames.length === 0) {
          await supabase
            .from("entity_properties")
            .delete()
            .eq("entity_type", "table_row")
            .eq("entity_id", rowId)
            .eq("field_name", field.name);
        } else {
          await supabase
            .from("entity_properties")
            .upsert({
              entity_type: "table_row",
              entity_id: rowId,
              workspace_id: tableData.workspace_id,
              field_name: field.name,
              field_type: "tags",
              value: tagNames,
            }, { onConflict: "entity_type,entity_id,field_name" });
        }
      }
    }
  }

  // Best-effort source sync for editable workflow representations.
  await syncTableRowEditToSource({
    row,
    field,
    value: normalizedCellValue,
    authContext: { supabase, userId },
  });

  await recomputeFormulasForRow(row.table_id, rowId, fieldId);
  await recomputeRollupsForTargetRowChanged(rowId, row.table_id, fieldId);
  await syncSourceRowToDerived({
    rowId,
    tableId: row.table_id,
    rowData: mergedData,
    userId,
    supabase,
  });

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", rowId)
    .single();

  return { data: (refreshed as TableRow) || data };
}

export async function deleteRow(rowId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await getRowContext(rowId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("table_rows").delete().eq("id", rowId);
  if (error) {
    return { error: "Failed to delete row" };
  }
  return { data: null };
}

export async function deleteRows(rowIds: string[], opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  if (rowIds.length === 0) return { data: null };
  const access = await getRowContext(rowIds[0], opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, row } = access;

  if (process.env.DISABLE_RPC === "true") {
    try {
      const { aiDebug } = await import("@/lib/ai/debug");
      aiDebug("rpc:skip", { name: "bulk_delete_rows", reason: "disabled" });
    } catch {
      // ignore debug import failures
    }
  } else {
    const rpcResult = await supabase.rpc("bulk_delete_rows", {
      p_table_id: row.table_id,
      p_row_ids: rowIds,
      p_updated_by: userId,
    });
    try {
      const { aiDebug } = await import("@/lib/ai/debug");
      aiDebug("rpc:result", { name: "bulk_delete_rows", ok: !rpcResult.error, table: "table_rows" });
    } catch {
      // ignore debug import failures
    }
    if (!rpcResult.error) {
      return { data: null };
    }
  }

  const { error } = await supabase.from("table_rows").delete().in("id", rowIds);
  if (error) {
    return { error: "Failed to delete rows" };
  }
  return { data: null };
}

export async function reorderRows(tableId: string, orders: Array<{ rowId: string; order: number | string }>): Promise<ActionResult<TableRow[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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

export async function duplicateRow(rowId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, row } = access;
  const sourceEntityId = isUuidString(row.source_entity_id) ? row.source_entity_id : null;

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      table_id: row.table_id,
      data: row.data,
      order: Number(row.order) + 0.001,
      source_entity_type: sourceEntityId ? row.source_entity_type ?? null : null,
      source_entity_id: sourceEntityId,
      source_sync_mode: sourceEntityId ? (row.source_sync_mode ?? "live") : null,
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

export async function setTableRowsSourceSyncMode(input: {
  tableId: string;
  mode: TableRowSourceSyncMode;
  sourceEntityType?: TableRowSourceEntityType;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updatedCount: number }>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  let query = supabase
    .from("table_rows")
    .update({ source_sync_mode: input.mode })
    .eq("table_id", input.tableId)
    .not("source_entity_id", "is", null);

  if (input.sourceEntityType) {
    query = query.eq("source_entity_type", input.sourceEntityType);
  }

  const { data, error } = await query.select("id");

  if (error) {
    return { error: "Failed to update row source sync mode" };
  }

  return { data: { updatedCount: (data || []).length } };
}

// ---------------------------------------------------------------------------
// Push edited snapshot rows to source
// ---------------------------------------------------------------------------

export async function pushEditedSnapshotRowsToSource(input: {
  tableId: string;
  authContext?: AuthContext;
}): Promise<ActionResult<{ pushedCount: number; failedRowIds: string[] }>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  // Fetch all edited source-linked rows
  const { data: editedRows, error: fetchErr } = await supabase
    .from("table_rows")
    .select("id, table_id, data, source_entity_type, source_entity_id, source_sync_mode")
    .eq("table_id", input.tableId)
    .eq("edited", true)
    .not("source_entity_id", "is", null);

  if (fetchErr) return { error: "Failed to fetch edited rows" };
  if (!editedRows || editedRows.length === 0) return { data: { pushedCount: 0, failedRowIds: [] } };

  // Fetch table fields for mapping
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
    .eq("table_id", input.tableId);

  const tableFields = (fields ?? []) as TableField[];
  const authContext: AuthContext = input.authContext ?? { supabase, userId };
  const timelineSourceIds = Array.from(
    new Set(
      (editedRows ?? [])
        .filter((row) => row.source_entity_type === "timeline_event" && typeof row.source_entity_id === "string")
        .map((row) => row.source_entity_id as string)
    )
  );
  const sourceTimelinePriorities = new Map<string, TimelineNamedPriority[]>();
  if (timelineSourceIds.length > 0) {
    const { data: sourceEvents } = await supabase
      .from("timeline_events")
      .select("id, priorities")
      .in("id", timelineSourceIds);
    for (const sourceEvent of sourceEvents ?? []) {
      sourceTimelinePriorities.set(
        sourceEvent.id as string,
        normalizeTimelinePriorities((sourceEvent as any)?.priorities ?? [])
      );
    }
  }

  const failedRowIds: string[] = [];
  let pushedCount = 0;

  for (const row of editedRows) {
    try {
      const rowData = (row.data ?? {}) as Record<string, unknown>;

      if (row.source_entity_type === "task") {
        const updates: Record<string, unknown> = {};
        for (const field of tableFields) {
          if (rowData[field.id] === undefined) continue;
          const mapped = mapTaskUpdateFromField(field, rowData[field.id]);
          if (mapped) Object.assign(updates, mapped);
        }
        if (Object.keys(updates).length > 0) {
          const result = await updateTaskItem(row.source_entity_id!, updates as any, { authContext });
          if ("error" in result) { failedRowIds.push(row.id); continue; }
        }
      } else if (row.source_entity_type === "timeline_event") {
        const updates: Record<string, unknown> = {};
        const sourceEventId = row.source_entity_id as string;
        let nextPriorities = normalizeTimelinePriorities(sourceTimelinePriorities.get(sourceEventId) ?? []);
        let hasPriorityUpdate = false;
        for (const field of tableFields) {
          if (rowData[field.id] === undefined) continue;
          const mapped = mapTimelineUpdateFromField(field, rowData[field.id]);
          if (!mapped) continue;

          const priorityUpdates = (mapped as any).priorities as
            | Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" | null }>
            | undefined;
          if (Array.isArray(priorityUpdates)) {
            hasPriorityUpdate = true;
            for (const priorityUpdate of priorityUpdates) {
              nextPriorities = mergeTimelinePriorityField(
                nextPriorities,
                priorityUpdate.field_name,
                priorityUpdate.value
              );
            }
          }

          const { priorities: _ignoredPriorities, ...rest } = mapped as Record<string, unknown>;
          Object.assign(updates, rest);
        }
        if (hasPriorityUpdate) {
          updates.priorities = nextPriorities;
        }
        if (Object.keys(updates).length > 0) {
          const result = await updateTimelineEvent(row.source_entity_id!, updates as any, { authContext });
          if ("error" in result) { failedRowIds.push(row.id); continue; }
          sourceTimelinePriorities.set(sourceEventId, nextPriorities);
        }
      } else if (row.source_entity_type === "table_row") {
        // Push each mapped field to source table row
        for (const field of tableFields) {
          if (rowData[field.id] === undefined) continue;
          await syncTableRowEditToSourceTableRow(row.source_entity_id!, field, rowData[field.id], authContext);
        }
      }

      // Clear edited flag on success
      await supabase
        .from("table_rows")
        .update({ edited: false, updated_by: userId })
        .eq("id", row.id);

      pushedCount++;
    } catch (err) {
      console.error(`pushEditedSnapshotRowsToSource: failed for row ${row.id}`, err);
      failedRowIds.push(row.id);
    }
  }

  return { data: { pushedCount, failedRowIds } };
}

// ---------------------------------------------------------------------------
// Refresh edited snapshot rows from source
// ---------------------------------------------------------------------------

export async function refreshEditedSnapshotRowsFromSource(input: {
  tableId: string;
  authContext?: AuthContext;
}): Promise<ActionResult<{ refreshedCount: number; failedRowIds: string[] }>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  // Fetch all edited source-linked rows
  const { data: editedRows, error: fetchErr } = await supabase
    .from("table_rows")
    .select("id, table_id, data, source_entity_type, source_entity_id, source_sync_mode")
    .eq("table_id", input.tableId)
    .eq("edited", true)
    .not("source_entity_id", "is", null);

  if (fetchErr) return { error: "Failed to fetch edited rows" };
  if (!editedRows || editedRows.length === 0) return { data: { refreshedCount: 0, failedRowIds: [] } };

  // Fetch table fields for reverse mapping
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
    .eq("table_id", input.tableId);

  const tableFields = (fields ?? []) as TableField[];
  const failedRowIds: string[] = [];
  let refreshedCount = 0;

  for (const row of editedRows) {
    try {
      const rowData = { ...((row.data ?? {}) as Record<string, unknown>) };
      let refreshed = false;

      if (row.source_entity_type === "task") {
        const { data: task, error: taskErr } = await supabase
          .from("task_items")
          .select("*")
          .eq("id", row.source_entity_id!)
          .maybeSingle();

        if (taskErr || !task) { failedRowIds.push(row.id); continue; }
        const { data: taskTagsRow } = await supabase
          .from("entity_properties")
          .select("value")
          .eq("entity_type", "task")
          .eq("entity_id", row.source_entity_id!)
          .eq("field_type", "tags")
          .limit(1)
          .maybeSingle();
        const taskTags = Array.isArray((taskTagsRow as any)?.value)
          ? ((taskTagsRow as any).value as unknown[])
              .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
              .filter((entry) => entry.length > 0)
          : [];
        (task as any).tags = taskTags;

        // Map task fields back into row data
        for (const field of tableFields) {
          const value = mapTaskFieldToRowValue(field, task);
          if (value !== undefined) rowData[field.id] = value;
        }
        refreshed = true;
      } else if (row.source_entity_type === "timeline_event") {
        const { data: event, error: eventErr } = await supabase
          .from("timeline_events")
          .select("*")
          .eq("id", row.source_entity_id!)
          .maybeSingle();

        if (eventErr || !event) { failedRowIds.push(row.id); continue; }

        for (const field of tableFields) {
          const value = mapTimelineEventFieldToRowValue(field, event);
          if (value !== undefined) rowData[field.id] = value;
        }
        refreshed = true;
      } else if (row.source_entity_type === "table_row") {
        const { data: sourceRow, error: sourceErr } = await supabase
          .from("table_rows")
          .select("id, table_id, data")
          .eq("id", row.source_entity_id!)
          .maybeSingle();

        if (sourceErr || !sourceRow) { failedRowIds.push(row.id); continue; }

        // Get source table's fields and map by name
        const { data: sourceFields } = await supabase
          .from("table_fields")
          .select("id, name")
          .eq("table_id", sourceRow.table_id);

        const sourceData = (sourceRow.data ?? {}) as Record<string, unknown>;
        const sourceFieldList = sourceFields ?? [];

        for (const field of tableFields) {
          const sourceField = sourceFieldList.find((sf: any) => sf.name === field.name);
          if (sourceField && sourceData[sourceField.id] !== undefined) {
            rowData[field.id] = sourceData[sourceField.id];
          }
        }
        refreshed = true;
      }

      if (refreshed) {
        await supabase
          .from("table_rows")
          .update({ data: rowData, edited: false, updated_by: userId })
          .eq("id", row.id);
        refreshedCount++;
      } else {
        failedRowIds.push(row.id);
      }
    } catch (err) {
      console.error(`refreshEditedSnapshotRowsFromSource: failed for row ${row.id}`, err);
      failedRowIds.push(row.id);
    }
  }

  return { data: { refreshedCount, failedRowIds } };
}

// ---------------------------------------------------------------------------
// Reverse mapping helpers: source entity → row data value
// ---------------------------------------------------------------------------

function mapTaskFieldToRowValue(
  field: TableField,
  task: Record<string, unknown>
): unknown | undefined {
  const normalizedFieldName = normalizeFieldName(field.name);
  const taskPriorities = Array.isArray(task.priorities) ? task.priorities : [];
  const taskPriority =
    taskPriorities.find((entry: any) => String(entry?.field_name || "").trim().toLowerCase() === "priority")?.value ??
    taskPriorities[0]?.value ??
    null;

  if (field.is_primary || normalizedFieldName.includes("title") || normalizedFieldName === "task") {
    return task.title ?? "";
  }
  if (field.type === "status" || normalizedFieldName === "status") {
    const statuses = Array.isArray(task.statuses) ? task.statuses : [];
    return statuses[0]?.value ?? null;
  }
  if (field.type === "priority" || normalizedFieldName === "priority") {
    return taskPriority ?? null;
  }
  if (normalizedFieldName.includes("description") || normalizedFieldName.includes("notes")) {
    return task.description ?? null;
  }
  if (field.type === "person") {
    return (task as any).assignee_id ?? null;
  }
  if (field.type === "tags" || normalizedFieldName === "tags" || normalizedFieldName.includes("tag")) {
    const taskTags = Array.isArray((task as any).tags) ? ((task as any).tags as string[]) : [];
    const options = ((((field.config as any) ?? {}) as Record<string, unknown>).options ?? []) as TagFieldOption[];
    const byLabel = new Map<string, string>();
    for (const option of options) byLabel.set(option.label.trim().toLowerCase(), option.id);
    return taskTags
      .map((tag) => byLabel.get(String(tag).trim().toLowerCase()) ?? String(tag))
      .filter((tag) => typeof tag === "string" && tag.trim().length > 0);
  }
  if (field.type === "date" || normalizedFieldName.includes("date")) {
    if (normalizedFieldName.includes("start")) return task.start_date ?? null;
    if (normalizedFieldName.includes("due") || normalizedFieldName === "date") return task.due_date ?? null;
    const start = typeof task.start_date === "string" ? task.start_date : null;
    const end = typeof task.due_date === "string" ? task.due_date : null;
    if (start && end) return formatDateRangeCellValue(start, end);
    return end ?? start ?? null;
  }
  return undefined;
}

function mapTimelineEventFieldToRowValue(
  field: TableField,
  event: Record<string, unknown>
): unknown | undefined {
  const normalizedFieldName = normalizeFieldName(field.name);
  const eventPriorities = normalizeTimelinePriorities(event.priorities ?? []);
  const matchingPriority = eventPriorities.find(
    (entry) => entry.field_name.trim().toLowerCase() === field.name.trim().toLowerCase()
  );
  const shouldFallbackToCanonical = Boolean(
    (field.config as any)?.timelinePriorityFallbackToCanonical === true ||
      (field.config as any)?.useCanonicalTimelinePriorityFallback === true
  );
  const firstPriority = eventPriorities[0]?.value ?? null;

  if (field.is_primary || normalizedFieldName.includes("title") || normalizedFieldName === "event") {
    return event.title ?? "";
  }
  if (field.type === "status" || normalizedFieldName === "status") {
    const statuses = Array.isArray(event.statuses) ? event.statuses : [];
    return statuses[0]?.value ?? null;
  }
  if (field.type === "priority" || normalizedFieldName === "priority") {
    if (matchingPriority?.value) return matchingPriority.value;
    if (shouldFallbackToCanonical) return firstPriority ?? null;
    return null;
  }
  if (normalizedFieldName.includes("progress")) {
    return event.progress ?? null;
  }
  if (normalizedFieldName.includes("milestone")) {
    return event.is_milestone ?? null;
  }
  if (normalizedFieldName.includes("description") || normalizedFieldName.includes("notes")) {
    return event.notes ?? null;
  }
  if (field.type === "date" || normalizedFieldName.includes("date")) {
    const start = normalizeDateForTask(event.start_date);
    const end = normalizeDateForTask(event.end_date);
    if (normalizedFieldName.includes("end")) return end ?? null;
    if (normalizedFieldName.includes("start")) return start ?? null;
    if (normalizedFieldName === "date") {
      if (start && end) return formatDateRangeCellValue(start, end);
      return end ?? start ?? null;
    }
    if (start && end) return formatDateRangeCellValue(start, end);
    return end ?? start ?? null;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRowContext(rowId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await import("@/lib/supabase/server").then((m) => m.createClient());
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      console.error("getRowContext: Auth error:", authError);
      return { error: "Unauthorized" } as const;
    }
    supabase = client;
    userId = user.id;
  }

  const { data: row, error } = await supabase
    .from("table_rows")
    .select("id, table_id, data, order, source_entity_type, source_entity_id, source_sync_mode")
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

  const access = await requireTableAccess(row.table_id, { authContext: opts?.authContext });
  if ("error" in access) {
    console.error("getRowContext: Table access error:", access.error);
    return access;
  }

  return { supabase: access.supabase, userId, row };
}

async function syncTableRowEditToSource(params: {
  row: {
    source_entity_type?: string | null;
    source_entity_id?: string | null;
    source_sync_mode?: string | null;
  };
  field: TableField;
  value: unknown;
  authContext: AuthContext;
}): Promise<void> {
  const { row, field, value, authContext } = params;

  if (!row.source_entity_id || row.source_sync_mode !== "live") return;
  if (!row.source_entity_type) return;

  try {
    if (row.source_entity_type === "task") {
      const taskUpdates = mapTaskUpdateFromField(field, value);
      if (!taskUpdates) return;
      const priorityUpdates = (taskUpdates as any).priorities as
        | Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" }>
        | undefined;
      if (Array.isArray(priorityUpdates)) {
        const { data: sourceTask } = await authContext.supabase
          .from("task_items")
          .select("priorities")
          .eq("id", row.source_entity_id)
          .maybeSingle();
        const existing = Array.isArray((sourceTask as any)?.priorities)
          ? ((sourceTask as any).priorities as Array<{ field_name?: unknown; value?: unknown }>)
              .map((entry) => {
                const fieldName = typeof entry?.field_name === "string" ? entry.field_name : "";
                const value = entry?.value;
                if (!fieldName) return null;
                if (value !== "low" && value !== "medium" && value !== "high" && value !== "urgent") return null;
                return { field_name: fieldName, value };
              })
              .filter((entry): entry is { field_name: string; value: "low" | "medium" | "high" | "urgent" } => Boolean(entry))
          : [];
        const merged = new Map<string, { field_name: string; value: "low" | "medium" | "high" | "urgent" }>();
        for (const item of existing) merged.set(normalizeFieldName(item.field_name), item);
        for (const item of priorityUpdates) merged.set(normalizeFieldName(item.field_name), item);
        const { priorities: _ignoredPriorities, ...rest } = taskUpdates as Record<string, unknown>;
        await updateTaskItem(
          row.source_entity_id,
          {
            ...(rest as any),
            priorities: Array.from(merged.values()),
          },
          { authContext }
        );
        return;
      }
      await updateTaskItem(row.source_entity_id, taskUpdates, { authContext });
      return;
    }

    if (row.source_entity_type === "timeline_event") {
      const timelineUpdates = mapTimelineUpdateFromField(field, value);
      if (!timelineUpdates) return;
      const priorityUpdates = (timelineUpdates as any).priorities as
        | Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" | null }>
        | undefined;
      if (Array.isArray(priorityUpdates)) {
        const { data: sourceEvent } = await authContext.supabase
          .from("timeline_events")
          .select("priorities")
          .eq("id", row.source_entity_id)
          .maybeSingle();
        let mergedPriorities = normalizeTimelinePriorities((sourceEvent as any)?.priorities ?? []);
        for (const priorityUpdate of priorityUpdates) {
          mergedPriorities = mergeTimelinePriorityField(
            mergedPriorities,
            priorityUpdate.field_name,
            priorityUpdate.value
          );
        }
        const { priorities: _ignoredPriorities, ...rest } = timelineUpdates as Record<string, unknown>;
        await updateTimelineEvent(
          row.source_entity_id,
          {
            ...(rest as any),
            priorities: mergedPriorities,
          },
          { authContext }
        );
        return;
      }
      await updateTimelineEvent(row.source_entity_id, timelineUpdates as any, { authContext });
      return;
    }

    if (row.source_entity_type === "table_row") {
      await syncTableRowEditToSourceTableRow(row.source_entity_id, field, value, authContext);
      return;
    }

    if (row.source_entity_type === "block") {
      await syncTableRowEditToBlock(row.source_entity_id, field, value, authContext);
    }
  } catch (error) {
    console.error("syncTableRowEditToSource error:", error);
  }
}

async function syncSourceRowToDerived(params: {
  rowId: string;
  tableId: string;
  rowData: Record<string, unknown>;
  userId: string;
  supabase: any;
}): Promise<void> {
  const { rowId, tableId, rowData, userId, supabase } = params;
  const { data: sourceFields } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
    .eq("table_id", tableId);
  const fields = (sourceFields ?? []) as Array<{ id: string; name: string; type: string; config?: Record<string, unknown>; is_primary?: boolean }>;
  if (fields.length === 0) return;
  const { data: tableInfo } = await supabase
    .from("tables")
    .select("workspace_id")
    .eq("id", tableId)
    .maybeSingle();
  const tableWorkspaceId = (tableInfo as any)?.workspace_id as string | undefined;

  const primaryField = fields.find((f) => Boolean(f.is_primary))
    ?? fields.find((f) => normalizeFieldName(f.name).includes("title") || normalizeFieldName(f.name) === "task" || normalizeFieldName(f.name) === "event");
  const statusFields = fields.filter((f) => f.type === "status");
  const priorityFields = fields.filter((f) => f.type === "priority");
  const startField = fields.find((f) => f.type === "date" && normalizeFieldName(f.name).includes("start"))
    ?? fields.find((f) => normalizeFieldName(f.name).includes("start"));
  const endField = fields.find((f) => f.type === "date" && normalizeFieldName(f.name).includes("end"))
    ?? fields.find((f) => normalizeFieldName(f.name).includes("due") || normalizeFieldName(f.name).includes("end"));
  const singleDateField = fields.find((f) => f.type === "date");
  const derivedSeed = deriveTaskSeedFromTableRowData(rowData, fields);
  const title = derivedSeed.title ?? (primaryField ? valueToString(rowData[primaryField.id]) : null);
  let startDate = derivedSeed.preferred_start_date;
  let endDate = derivedSeed.preferred_due_date;
  if (!startDate && !endDate) {
    startDate = startField ? normalizeDateForTask(rowData[startField.id]) : null;
    endDate = endField ? normalizeDateForTask(rowData[endField.id]) : null;
    if (!startField && !endField && singleDateField) {
      const range = normalizeDateRangeForTask(rowData[singleDateField.id]);
      if (range) {
        startDate = range.start ?? null;
        endDate = range.end ?? range.start ?? null;
      }
    }
  }
  const namedTaskStatuses = derivedSeed.statuses
    .map((entry) => ({ field_name: entry.field_name, value: mapCanonicalToTaskStatus(entry.value) }))
    .filter((entry): entry is { field_name: string; value: TaskStatus } => Boolean(entry.field_name && entry.value));
  const namedTimelineStatuses = statusFields
    .map((field) => {
      const status = normalizeTimelineStatus(valueToString(rowData[field.id]));
      return status ? ({ field_name: field.name, value: status } as const) : null;
    })
    .filter((entry): entry is { field_name: string; value: "todo" | "in_progress" | "blocked" | "done" } => Boolean(entry));
  const namedTaskPriorities = derivedSeed.priorities
    .map((entry) => ({ field_name: entry.field_name, value: entry.value }))
    .filter((entry): entry is { field_name: string; value: "low" | "medium" | "high" | "urgent" } => Boolean(entry.field_name && entry.value));
  const namedTimelinePriorities = priorityFields
    .map((field) => {
      const priority = normalizeTimelinePriority(valueToString(rowData[field.id]));
      if (priority === undefined || priority === null) return null;
      return { field_name: field.name, value: priority } as const;
    })
    .filter((entry): entry is { field_name: string; value: "low" | "medium" | "high" | "urgent" } => Boolean(entry));
  const rowTagNames = derivedSeed.tags;

  const { data: derivedTasks } = await supabase
    .from("task_items")
    .select("id")
    .eq("source_entity_type", "table_row")
    .eq("source_entity_id", rowId)
    .eq("source_sync_mode", "live");
  for (const task of (derivedTasks ?? []) as Array<{ id: string }>) {
    const payload: Record<string, unknown> = { updated_by: userId };
    if (title !== null) payload.title = title;
    if (namedTaskStatuses.length > 0) payload.statuses = namedTaskStatuses;
    if (namedTaskPriorities.length > 0) payload.priorities = namedTaskPriorities;
    payload.assignees = derivedSeed.assignees;
    payload.due_dates = derivedSeed.due_dates;
    payload.assignee_id = derivedSeed.preferred_assignee_ids[0] ?? null;
    if (startDate !== null) payload.start_date = startDate;
    if (endDate !== null) payload.due_date = endDate;
    await supabase.from("task_items").update(payload).eq("id", task.id);
    // Keep derived task entity_properties aligned with source row universal properties.
    if (tableWorkspaceId) {
      const propUpdates: Record<string, unknown> = {};
      if (namedTaskStatuses.length > 0) propUpdates.statuses = namedTaskStatuses;
      if (namedTaskPriorities.length > 0) propUpdates.priorities = namedTaskPriorities;
      if (derivedSeed.assignees.length > 0) propUpdates.assignees = derivedSeed.assignees;
      if (derivedSeed.due_dates.length > 0) propUpdates.due_dates = derivedSeed.due_dates;
      if (rowTagNames.length > 0) propUpdates.tags = rowTagNames;
      if (Object.keys(propUpdates).length > 0) {
        await setEntityProperties({
          entity_type: "task",
          entity_id: task.id,
          workspace_id: tableWorkspaceId,
          updates: propUpdates as any,
        });
      }
      if (derivedSeed.tag_fields.length > 0) {
        await supabase
          .from("entity_properties")
          .upsert(
            derivedSeed.tag_fields.map((entry) => ({
              workspace_id: tableWorkspaceId,
              entity_type: "task",
              entity_id: task.id,
              field_name: entry.field_name,
              field_type: "tags",
              value: entry.value,
            })),
            { onConflict: "entity_type,entity_id,field_name" }
          );
      }
    }
  }

  const { data: derivedEvents } = await supabase
    .from("timeline_events")
    .select("id, workspace_id")
    .eq("source_entity_type", "table_row")
    .eq("source_entity_id", rowId)
    .eq("source_sync_mode", "live");
  for (const event of (derivedEvents ?? []) as Array<{ id: string; workspace_id?: string }>) {
    const payload: Record<string, unknown> = { updated_by: userId };
    const timelineAssignees = derivedSeed.assignees
      .map((entry) => ({
        field_name: entry.field_name,
        value: (entry.value ?? []).map((id) => ({ type: "user", id })),
      }))
      .filter((entry) => entry.value.length > 0);
    if (title !== null) payload.title = title;
    if (namedTimelineStatuses.length > 0) payload.statuses = namedTimelineStatuses;
    if (namedTimelinePriorities.length > 0) payload.priorities = namedTimelinePriorities;
    if (timelineAssignees.length > 0) {
      payload.assignees = timelineAssignees;
      payload.assignee_id = derivedSeed.preferred_assignee_ids[0] ?? null;
      payload.assignee_team_id = null;
    }
    if (startDate !== null) payload.start_date = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    if (endDate !== null) payload.end_date = new Date(`${endDate}T00:00:00.000Z`).toISOString();
    await supabase.from("timeline_events").update(payload).eq("id", event.id);
    // Bug 1.3 fix: sync entity_properties for derived timeline event
    if (event.workspace_id) {
      await syncTimelineStatusFieldsToEntityProperties(supabase, event.id, event.workspace_id, namedTimelineStatuses);
      await syncTimelinePriorityFieldsToEntityProperties(supabase, event.id, event.workspace_id, namedTimelinePriorities);
    }
  }
}

export async function syncBulkUpdatedRowToSourceAndDerived(params: {
  rowId: string;
  tableId: string;
  changedFieldIds: string[];
  authContext: AuthContext;
}): Promise<void> {
  const { rowId, tableId, changedFieldIds, authContext } = params;
  const { supabase, userId } = authContext;
  if (changedFieldIds.length === 0) return;

  const { data: row } = await supabase
    .from("table_rows")
    .select("id, table_id, data, source_entity_type, source_entity_id, source_sync_mode")
    .eq("id", rowId)
    .maybeSingle();
  if (!row || row.table_id !== tableId) return;

  const rowData = ((row.data ?? {}) as Record<string, unknown>);
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
    .eq("table_id", tableId);
  const fieldsById = new Map<string, TableField>();
  for (const field of (fields ?? []) as TableField[]) {
    fieldsById.set(field.id, field);
  }

  for (const fieldId of Array.from(new Set(changedFieldIds))) {
    const field = fieldsById.get(fieldId);
    if (!field) continue;
    await syncTableRowEditToSource({
      row,
      field,
      value: rowData[fieldId],
      authContext,
    });
  }

  await syncSourceRowToDerived({
    rowId,
    tableId,
    rowData,
    userId,
    supabase,
  });
}

async function syncTableRowEditToBlock(
  blockId: string,
  field: TableField,
  value: unknown,
  authContext: AuthContext
): Promise<void> {
  const supabase = authContext.supabase;
  const { data: blockRow } = await supabase
    .from("blocks")
    .select("id, tabs!inner(projects!inner(workspace_id))")
    .eq("id", blockId)
    .maybeSingle();

  const workspaceId = (blockRow as { tabs?: { projects?: { workspace_id?: string } } } | null)?.tabs?.projects?.workspace_id;
  if (!workspaceId) return;

  const updates = mapBlockUpdateFromField(field, value);
  if (!updates || Object.keys(updates).length === 0) return;

  // Preserve existing named priorities/statuses and merge by field_name.
  if ((updates as any).priorities || (updates as any).statuses) {
    const { data: existingRows } = await supabase
      .from("entity_properties")
      .select("field_type, field_name, value")
      .eq("entity_type", "block")
      .eq("entity_id", blockId)
      .in("field_type", ["priority", "status"]);

    if ((updates as any).priorities) {
      const existingPriorities = ((existingRows ?? []) as Array<{ field_type: string; field_name: string | null; value: unknown }>)
        .filter((row) => row.field_type === "priority" && typeof row.field_name === "string" && typeof row.value === "string")
        .map((row) => ({
          field_name: String(row.field_name),
          value: row.value as "low" | "medium" | "high" | "urgent",
        }));
      const nextPriorities = (updates as any).priorities as Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" }>;
      const merged = new Map<string, "low" | "medium" | "high" | "urgent">();
      for (const p of existingPriorities) merged.set(normalizeFieldName(p.field_name), p.value);
      for (const p of nextPriorities) merged.set(normalizeFieldName(p.field_name), p.value);
      (updates as any).priorities = Array.from(merged.entries()).map(([key, value]) => {
        const source =
          nextPriorities.find((p) => normalizeFieldName(p.field_name) === key)
          ?? existingPriorities.find((p) => normalizeFieldName(p.field_name) === key);
        return { field_name: source?.field_name ?? "Priority", value };
      });
    }

    if ((updates as any).statuses) {
      const existingStatuses = ((existingRows ?? []) as Array<{ field_type: string; field_name: string | null; value: unknown }>)
        .filter((row) => row.field_type === "status" && typeof row.field_name === "string" && typeof row.value === "string")
        .map((row) => ({
          field_name: String(row.field_name),
          value: row.value as "todo" | "in_progress" | "blocked" | "done",
        }));
      const nextStatuses = (updates as any).statuses as Array<{ field_name: string; value: "todo" | "in_progress" | "blocked" | "done" }>;
      const merged = new Map<string, "todo" | "in_progress" | "blocked" | "done">();
      for (const s of existingStatuses) merged.set(normalizeFieldName(s.field_name), s.value);
      for (const s of nextStatuses) merged.set(normalizeFieldName(s.field_name), s.value);
      (updates as any).statuses = Array.from(merged.entries()).map(([key, value]) => {
        const source =
          nextStatuses.find((s) => normalizeFieldName(s.field_name) === key)
          ?? existingStatuses.find((s) => normalizeFieldName(s.field_name) === key);
        return { field_name: source?.field_name ?? "Status", value };
      });
    }
  }

  const result = await setEntityProperties({
    entity_type: "block",
    entity_id: blockId,
    workspace_id: workspaceId,
    updates,
  });
  if ("error" in result) {
    console.error("syncTableRowEditToBlock error:", result.error);
  }
}

function mapBlockUpdateFromField(
  field: TableField,
  value: unknown
): Partial<{
  status: Status | null;
  statuses: Array<{ field_name: string; value: "todo" | "in_progress" | "blocked" | "done" }>;
  priority: Priority | null;
  priorities: Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" }>;
  assignee_id: string | null;
  assignee_ids: string[] | null;
  due_date: { start: string | null; end: string | null } | null;
  tags: string[];
}> | null {
  const normalizedFieldName = normalizeFieldName(field.name);
  const textValue = valueToString(value);

  if (field.type === "status" || normalizedFieldName === "status") {
    const status = normalizeTimelineStatus(resolveSelectLikeValue(field, value));
    return status !== null
      ? { statuses: [{ field_name: field.name, value: status }] }
      : null;
  }

  if (field.type === "priority" || normalizedFieldName === "priority") {
    const priority = normalizeTimelinePriority(resolveSelectLikeValue(field, value));
    return priority !== undefined && priority !== null
      ? { priorities: [{ field_name: field.name, value: priority }] }
      : null;
  }

  if (normalizedFieldName.includes("assignee") || field.type === "person") {
    const assigneeId = extractAssigneeIdFromValue(value);
    if (assigneeId !== undefined) {
      return assigneeId ? { assignee_id: assigneeId, assignee_ids: [assigneeId] } : { assignee_id: null, assignee_ids: [] };
    }
    return null;
  }

  if (field.type === "date" || normalizedFieldName.includes("due") || normalizedFieldName.includes("date")) {
    const range = normalizeDateRangeForTask(value);
    if (!range) return null;
    return { due_date: { start: range.start ?? null, end: range.end ?? range.start ?? null } };
  }

  if (normalizedFieldName.includes("tag")) {
    const tags = extractTagsFromValue(field, value);
    if (tags) return { tags };
    return null;
  }

  return null;
}

function extractAssigneeIdFromValue(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "object" && value !== null && "id" in (value as object)) {
    const id = (value as { id?: string }).id;
    return typeof id === "string" ? id : null;
  }
  return undefined;
}

function extractTagsFromValue(field: TableField, value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const options = ((((field.config as any) ?? {}) as Record<string, unknown>).options ?? []) as TagFieldOption[];
    const stringValues = value.map((t) => (typeof t === "string" ? t.trim() : null)).filter((t): t is string => Boolean(t));
    const tags = mapOptionIdsToTagNames(stringValues, options)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return tags.length ? tags : null;
  }
  const s = valueToString(value)?.trim();
  return s ? [s] : null;
}

async function syncTableRowEditToSourceTableRow(
  sourceRowId: string,
  field: TableField,
  value: unknown,
  authContext: AuthContext
): Promise<void> {
  const supabase = authContext.supabase;
  const { data: sourceRow } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("id", sourceRowId)
    .maybeSingle();
  if (!sourceRow?.table_id) return;

  const { data: sourceFields } = await supabase
    .from("table_fields")
    .select("id, name")
    .eq("table_id", sourceRow.table_id);
  const fieldByName = (sourceFields ?? []).find((f) => f.name === field.name);
  if (!fieldByName) return;

  const nextData = { ...(sourceRow.data as Record<string, unknown> || {}), [fieldByName.id]: value };
  await supabase
    .from("table_rows")
    .update({ data: nextData, updated_by: authContext.userId })
    .eq("id", sourceRowId);
}

function mapTaskUpdateFromField(
  field: TableField,
  value: unknown
):
  | Partial<{
      title: string;
      status: "todo" | "in-progress" | "done";
      statuses: Array<{ field_name: string; value: "todo" | "in_progress" | "done" }>;
      priority: "urgent" | "high" | "medium" | "low" | "none";
      priorities: Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" }>;
      description: string | null;
      dueDate: string | null;
      startDate: string | null;
      tags: string[];
      assignees: Array<{ field_name: string; value: string[] }>;
    }>
  | null {
  const normalizedFieldName = normalizeFieldName(field.name);
  const textValue = valueToString(value);

  if (field.is_primary || normalizedFieldName.includes("title") || normalizedFieldName === "task") {
    return { title: textValue ?? "" };
  }

  if (field.type === "status" || normalizedFieldName === "status") {
    const status = normalizeTaskStatus(resolveSelectLikeValue(field, value));
    if (!status) return null;
    const canonicalStatus: "todo" | "in_progress" | "done" =
      status === "in-progress" ? "in_progress" : status;
    return { statuses: [{ field_name: field.name, value: canonicalStatus }] };
  }

  if (field.type === "priority" || normalizedFieldName === "priority") {
    const priority = normalizeTaskPriority(resolveSelectLikeValue(field, value));
    if (!priority || priority === "none") return null;
    return { priorities: [{ field_name: field.name, value: priority }] };
  }

  if (normalizedFieldName.includes("description") || normalizedFieldName.includes("notes")) {
    return { description: textValue };
  }

  if (field.type === "tags" || normalizedFieldName === "tags" || normalizedFieldName.includes("tag")) {
    const tags = extractTagsFromValue(field, value);
    return tags ? { tags } : { tags: [] };
  }

  if (field.type === "date" || normalizedFieldName.includes("date")) {
    const range = normalizeDateRangeForTask(value);
    const startDate = range?.start ?? null;
    const dueDate = range?.end ?? range?.start ?? null;
    if (normalizedFieldName.includes("start")) {
      return { startDate };
    }
    if (normalizedFieldName.includes("due") || normalizedFieldName === "date") {
      if (normalizedFieldName === "date" && startDate && dueDate && startDate !== dueDate) {
        return { startDate, dueDate };
      }
      return { dueDate };
    }
    if (startDate && dueDate && startDate !== dueDate) return { startDate, dueDate };
    return { dueDate };
  }

  if (field.type === "person") {
    const idStr = typeof value === "string" ? value.trim() : null;
    return { assignees: idStr ? [{ field_name: field.name, value: [idStr] }] : [] };
  }

  return null;
}

function mapTimelineUpdateFromField(
  field: TableField,
  value: unknown
):
  | Partial<{
      title: string;
      status: "todo" | "in_progress" | "blocked" | "done";
      priorities: Array<{ field_name: string; value: "low" | "medium" | "high" | "urgent" | null }>;
      startDate: string;
      endDate: string;
      progress: number;
      notes: string | null;
      isMilestone: boolean;
      assignees: Array<{ field_name: string; value: Array<{ type: "user" | "team"; id: string }> }>;
      tags: string[];
    }>
  | null {
  const normalizedFieldName = normalizeFieldName(field.name);
  const textValue = valueToString(value);

  if (field.is_primary || normalizedFieldName.includes("title") || normalizedFieldName === "event") {
    return { title: textValue ?? "" };
  }

  if (field.type === "status" || normalizedFieldName === "status") {
    const status = normalizeTimelineStatus(resolveSelectLikeValue(field, value));
    return status ? { status } : null;
  }

  if (field.type === "priority" || normalizedFieldName === "priority") {
    const priority = normalizeTimelinePriority(resolveSelectLikeValue(field, value));
    return priority !== undefined ? { priorities: [{ field_name: field.name, value: priority }] } : null;
  }

  if (normalizedFieldName.includes("progress")) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return { progress: Math.max(0, Math.min(100, Math.round(parsed))) };
  }

  if (normalizedFieldName.includes("milestone")) {
    const bool = toBoolean(value);
    return typeof bool === "boolean" ? { isMilestone: bool } : null;
  }

  if (normalizedFieldName.includes("description") || normalizedFieldName.includes("notes")) {
    return { notes: textValue };
  }

  if (field.type === "date" || normalizedFieldName.includes("date")) {
    const range = normalizeDateRangeForTimeline(value);
    if (!range) return null;
    const startIso = range.start ?? null;
    const endIso = range.end ?? range.start ?? null;
    if (normalizedFieldName.includes("end")) return endIso ? { endDate: endIso } : null;
    if (normalizedFieldName.includes("start")) return startIso ? { startDate: startIso } : null;
    if (normalizedFieldName === "date") {
      if (startIso && endIso) return { startDate: startIso, endDate: endIso };
      if (startIso) return { startDate: startIso };
      if (endIso) return { endDate: endIso };
      return null;
    }
    if (startIso && endIso) return { startDate: startIso, endDate: endIso };
    if (startIso) return { startDate: startIso };
    if (endIso) return { endDate: endIso };
    return null;
  }

  if (field.type === "person") {
    const idStr = typeof value === "string" ? value.trim() : null;
    const values: Array<{ type: "user" | "team"; id: string }> = idStr ? [{ type: "user", id: idStr }] : [];
    return { assignees: [{ field_name: field.name, value: values }] };
  }

  if (field.type === "tags") {
    const tags = Array.isArray(value) ? (value as unknown[]).map(String).filter(Boolean) : [];
    return { tags };
  }

  return null;
}

function normalizeFieldName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
}

function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.id === "string") return obj.id;
  }
  return null;
}

function normalizeTaskStatus(value: unknown): "todo" | "in-progress" | "done" | null {
  const normalized = valueToString(value)?.toLowerCase().replace(/[\s_]+/g, "-");
  if (!normalized) return null;
  if (["todo", "to-do", "not-started", "notstarted"].includes(normalized)) return "todo";
  if (["in-progress", "inprogress", "doing"].includes(normalized)) return "in-progress";
  if (["done", "completed", "complete", "finished"].includes(normalized)) return "done";
  return null;
}

function normalizeTaskPriority(value: unknown): "urgent" | "high" | "medium" | "low" | "none" | null {
  const normalized = valueToString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["urgent", "high", "medium", "low", "none"].includes(normalized)) {
    return normalized as "urgent" | "high" | "medium" | "low" | "none";
  }
  return null;
}

function normalizeDateForTask(value: unknown): string | null {
  const range = normalizeDateRangeForTask(value);
  if (!range) return null;
  return range.end ?? range.start ?? null;
}

function mapCanonicalToTaskStatus(value: unknown): TaskStatus | null {
  if (value === "todo") return "todo";
  if (value === "in_progress" || value === "blocked") return "in-progress";
  if (value === "done") return "done";
  return null;
}

function normalizeTimelineStatus(value: unknown): "todo" | "in_progress" | "blocked" | "done" | null {
  const normalized = valueToString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["todo", "to_do", "not_started"].includes(normalized)) return "todo";
  if (["in_progress", "inprogress", "doing"].includes(normalized)) return "in_progress";
  if (["blocked", "on_hold"].includes(normalized)) return "blocked";
  if (["done", "complete", "completed", "finished"].includes(normalized)) return "done";
  return validateEventStatus(normalized) ? normalized : null;
}

function normalizeTimelinePriority(value: unknown): "low" | "medium" | "high" | "urgent" | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const normalized = valueToString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;
  return validateEventPriority(normalized) ? normalized : undefined;
}

function normalizeDateTimeForTimeline(value: unknown): string | null {
  const range = normalizeDateRangeForTimeline(value);
  if (!range) return null;
  return range.end ?? range.start ?? null;
}

function normalizeDateRangeForTask(value: unknown): { start: string | null; end: string | null } | null {
  const parsed = parseDateRangeInput(value);
  if (!parsed) return null;
  const start = parsed.start ? normalizeDateToken(parsed.start) : null;
  const end = parsed.end ? normalizeDateToken(parsed.end) : null;
  if (!start && !end) return null;
  return { start, end: end ?? start };
}

function normalizeDateRangeForTimeline(value: unknown): { start: string | null; end: string | null } | null {
  const parsed = parseDateRangeInput(value);
  if (!parsed) return null;
  const start = parsed.start ? normalizeDateTimeToken(parsed.start) : null;
  const end = parsed.end ? normalizeDateTimeToken(parsed.end) : null;
  if (!start && !end) return null;
  return { start, end: end ?? start };
}

function parseDateRangeInput(value: unknown): { start: unknown; end: unknown } | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/);
    if (rangeMatch) {
      return { start: rangeMatch[1], end: rangeMatch[2] };
    }
    return { start: trimmed, end: trimmed };
  }
  if (typeof value !== "object") return { start: value, end: value };
  const obj = value as Record<string, unknown>;
  const start = obj.start ?? obj.startDate ?? obj.from ?? obj.date ?? null;
  const end = obj.end ?? obj.endDate ?? obj.to ?? obj.dueDate ?? start ?? null;
  if (start === null && end === null) return null;
  return { start, end };
}

function formatDateRangeCellValue(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const resolvedStart = start ?? end;
  const resolvedEnd = end ?? start;
  if (!resolvedStart || !resolvedEnd) return resolvedStart ?? resolvedEnd ?? null;
  if (resolvedStart === resolvedEnd) return resolvedEnd;
  return `${resolvedStart}..${resolvedEnd}`;
}

function normalizeDateToken(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = parseDateSafe(String(value));
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDateTimeToken(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = parseDateSafe(str);
    if (!d) return null;
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const parsed = parseDateSafe(str);
  if (!parsed) return null;
  return parsed.toISOString();
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = valueToString(value)?.toLowerCase().trim();
  if (!normalized) return null;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}

function resolveSelectLikeValue(field: TableField, value: unknown): unknown {
  const raw = valueToString(value);
  if (!raw) return value;
  const config = (field.config || {}) as Record<string, unknown>;
  const options =
    field.type === "priority"
      ? ((config.levels as Array<{ id?: string; label?: string }> | undefined) ?? [])
      : ((config.options as Array<{ id?: string; label?: string }> | undefined) ?? []);
  const match = options.find((option) => option.id === raw || option.label === raw);
  return match?.label ?? value;
}

function isUuidString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
