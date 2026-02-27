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
} from "@/lib/timeline-priority-sync";
import { setEntityProperties } from "@/app/actions/entity-properties";
import { parseDateSafe } from "@/lib/due-date";
import type { Status, Priority } from "@/types/properties";
import type { TimelineNamedPriority } from "@/types/timeline";
import {
  isUniversalPropertyFieldType,
  normalizeUniversalPropertyValue,
} from "@/lib/tables/universal-property";

type ActionResult<T> = { data: T } | { error: string };

interface CreateRowInput {
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
      table_id: input.tableId,
      data: normalizedInput.data,
      order: input.order ?? null,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      source_sync_mode: input.sourceSyncMode ?? "live",
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

export async function updateRow(rowId: string, updates: { data?: Record<string, unknown> }, opts?: { authContext?: AuthContext }): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, row } = access;

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

  await recomputeFormulasForRow(row.table_id, rowId);
  await recomputeRollupsForTargetRowChanged(rowId, row.table_id);

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

  // Sync priority/status updates to entity_properties
  if (field.type === "priority" || field.type === "status") {
    const { data: tableData } = await supabase
      .from("tables")
      .select("workspace_id")
      .eq("id", row.table_id)
      .single();

    if (tableData?.workspace_id) {
      // Upsert to entity_properties
      if (normalizedCellValue === null || normalizedCellValue === undefined || normalizedCellValue === "") {
        // Delete entity_property if value is cleared
        await supabase
          .from("entity_properties")
          .delete()
          .eq("entity_type", "table_row")
          .eq("entity_id", rowId)
          .eq("field_name", field.name);
      } else {
        // Insert or update entity_property
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
      source_sync_mode: row.source_sync_mode ?? "live",
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
  if (field.type === "date" || normalizedFieldName.includes("date")) {
    if (normalizedFieldName.includes("start")) return task.start_date ?? null;
    if (normalizedFieldName.includes("due") || normalizedFieldName === "date") return task.due_date ?? null;
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
    if (normalizedFieldName.includes("end")) return event.end_date ?? null;
    if (normalizedFieldName.includes("start") || normalizedFieldName === "date") return event.start_date ?? null;
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
  priority: Priority | null;
  assignee_id: string | null;
  assignee_ids: string[] | null;
  due_date: { start: string | null; end: string | null } | null;
  tags: string[];
}> | null {
  const normalizedFieldName = normalizeFieldName(field.name);
  const textValue = valueToString(value);

  if (field.type === "status" || normalizedFieldName === "status") {
    const status = normalizeTimelineStatus(resolveSelectLikeValue(field, value));
    return status !== null ? { status } : null;
  }

  if (field.type === "priority" || normalizedFieldName === "priority") {
    const priority = normalizeTimelinePriority(resolveSelectLikeValue(field, value));
    return priority !== undefined && priority !== null ? { priority } : null;
  }

  if (normalizedFieldName.includes("assignee") || field.type === "person") {
    const assigneeId = extractAssigneeIdFromValue(value);
    if (assigneeId !== undefined) {
      return assigneeId ? { assignee_id: assigneeId, assignee_ids: [assigneeId] } : { assignee_id: null, assignee_ids: [] };
    }
    return null;
  }

  if (field.type === "date" || normalizedFieldName.includes("due") || normalizedFieldName.includes("date")) {
    const dateValue = normalizeDateTimeForTimeline(value);
    if (!dateValue) return null;
    const dateOnly = dateValue.slice(0, 10);
    return { due_date: { start: dateOnly, end: dateOnly } };
  }

  if (normalizedFieldName.includes("tag")) {
    const tags = extractTagsFromValue(value);
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

function extractTagsFromValue(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const tags = value.map((t) => (typeof t === "string" ? t.trim() : null)).filter((t): t is string => Boolean(t));
    return tags.length ? tags : null;
  }
  const s = valueToString(value);
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
      priority: "urgent" | "high" | "medium" | "low" | "none";
      description: string | null;
      dueDate: string | null;
      startDate: string | null;
    }>
  | null {
  const normalizedFieldName = normalizeFieldName(field.name);
  const textValue = valueToString(value);

  if (field.is_primary || normalizedFieldName.includes("title") || normalizedFieldName === "task") {
    return { title: textValue ?? "" };
  }

  if (field.type === "status" || normalizedFieldName === "status") {
    const status = normalizeTaskStatus(resolveSelectLikeValue(field, value));
    return status ? { status } : null;
  }

  if (field.type === "priority" || normalizedFieldName === "priority") {
    const priority = normalizeTaskPriority(resolveSelectLikeValue(field, value));
    return priority ? { priority } : null;
  }

  if (normalizedFieldName.includes("description") || normalizedFieldName.includes("notes")) {
    return { description: textValue };
  }

  if (field.type === "date" || normalizedFieldName.includes("date")) {
    const dateValue = normalizeDateForTask(value);
    if (normalizedFieldName.includes("start")) {
      return { startDate: dateValue };
    }
    if (normalizedFieldName.includes("due") || normalizedFieldName === "date") {
      return { dueDate: dateValue };
    }
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
    const iso = normalizeDateTimeForTimeline(value);
    if (!iso) return null;
    if (normalizedFieldName.includes("end")) return { endDate: iso };
    if (normalizedFieldName.includes("start") || normalizedFieldName === "date") return { startDate: iso };
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
  if (value === null || value === undefined || value === "") return null;
  const str = String(value);
  // For date-only YYYY-MM-DD, treat as local midnight to avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) {
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
