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

export async function createRow(input: CreateRowInput): Promise<ActionResult<TableRow>> {
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;
  const sourceEntityId = isUuidString(input.sourceEntityId) ? input.sourceEntityId : null;
  const sourceEntityType = sourceEntityId ? input.sourceEntityType ?? null : null;

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      table_id: input.tableId,
      data: input.data || {},
      order: input.order ?? null,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      source_sync_mode: input.sourceSyncMode ?? "snapshot",
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
    .select("id, name, type, config, is_primary, property_definition_id")
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

  // Validate canonical IDs for priority/status fields
  if ((field.type === "priority" || field.type === "status") && value) {
    const fieldWithPropDef = field as TableField & { property_definition_id?: string };

    if (fieldWithPropDef.property_definition_id) {
      // Fetch property definition options to validate
      const { data: propDef } = await supabase
        .from("property_definitions")
        .select("options")
        .eq("id", fieldWithPropDef.property_definition_id)
        .maybeSingle();

      if (propDef) {
        const options = (propDef.options as Array<{ id: string; label: string }>) || [];
        const validIds = options.map(opt => opt.id);

        if (!validIds.includes(String(value))) {
          const fieldTypeName = field.type === "priority" ? "Priority" : "Status";
          return {
            error: `Invalid ${fieldTypeName.toLowerCase()} value "${value}". Must be one of: ${validIds.join(", ")}`
          };
        }
      }
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
        return { error: syncResult.error ?? "Unknown error" };
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

  // Sync priority/status updates to entity_properties
  if ((field.type === "priority" || field.type === "status") && field.property_definition_id) {
    const { data: tableData } = await supabase
      .from("tables")
      .select("workspace_id")
      .eq("id", row.table_id)
      .single();

    if (tableData?.workspace_id) {
      // Upsert to entity_properties
      if (value === null || value === undefined || value === "") {
        // Delete entity_property if value is cleared
        await supabase
          .from("entity_properties")
          .delete()
          .eq("entity_type", "table_row")
          .eq("entity_id", rowId)
          .eq("property_definition_id", field.property_definition_id);
      } else {
        // Insert or update entity_property
        await supabase
          .from("entity_properties")
          .upsert({
            entity_type: "table_row",
            entity_id: rowId,
            property_definition_id: field.property_definition_id,
            value: value,
            workspace_id: tableData.workspace_id,
          }, {
            onConflict: "entity_type,entity_id,property_definition_id"
          });
      }
    }
  }

  // Best-effort source sync for editable workflow representations.
  await syncTableRowEditToSource({
    row,
    field,
    value,
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
      source_sync_mode: row.source_sync_mode ?? "snapshot",
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
      await updateTimelineEvent(row.source_entity_id, timelineUpdates, { authContext });
    }
  } catch (error) {
    console.error("syncTableRowEditToSource error:", error);
  }
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
      priority: "low" | "medium" | "high" | "urgent" | null;
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
    return priority !== undefined ? { priority } : null;
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
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
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
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
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
  const match = options.find((option) => option.id === raw);
  return match?.label ?? value;
}

function isUuidString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
