"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTableAccess } from "./context";
import { getRelatedRows } from "./relation-actions";
import type { FilterCondition, TableField } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface NormalizedRollupConfig {
  relationFieldId: string | null;
  targetFieldId: string | null;
  aggregation: string;
  filter?: {
    field_id: string;
    operator: FilterCondition["operator"];
    value: unknown;
  };
}

function normalizeRollupConfig(config: TableField["config"]): NormalizedRollupConfig {
  const cfg = (config || {}) as Record<string, unknown>;
  return {
    relationFieldId:
      (cfg.relation_field_id as string | undefined) ||
      (cfg.relationFieldId as string | undefined) ||
      null,
    targetFieldId:
      (cfg.target_field_id as string | undefined) ||
      (cfg.relatedFieldId as string | undefined) ||
      null,
    aggregation: (cfg.aggregation as string | undefined) || "count",
    filter: cfg.filter as NormalizedRollupConfig["filter"],
  };
}

function applyFilterOperator(value: unknown, operator: FilterCondition["operator"], filterValue: unknown) {
  switch (operator) {
    case "equals":
      return value === filterValue;
    case "not_equals":
      return value !== filterValue;
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase());
    case "not_contains":
      return !String(value ?? "").toLowerCase().includes(String(filterValue ?? "").toLowerCase());
    case "greater_than":
      return Number(value) > Number(filterValue);
    case "less_than":
      return Number(value) < Number(filterValue);
    case "greater_or_equal":
      return Number(value) >= Number(filterValue);
    case "less_or_equal":
      return Number(value) <= Number(filterValue);
    case "is_empty":
      return value === null || value === undefined || value === "";
    case "is_not_empty":
      return value !== null && value !== undefined && value !== "";
    default:
      return true;
  }
}

/**
 * Aggregate values based on aggregation type.
 *
 * Counting:
 * - count, count_values, count_unique, count_empty, percent_empty, percent_not_empty
 * Numbers:
 * - sum, average, median, min, max, range
 * Dates:
 * - earliest_date, latest_date, date_range
 * Checkboxes:
 * - checked, unchecked, percent_checked
 * Text:
 * - show_unique, show_original
 */
function aggregateValues(values: unknown[], aggregation: string) {
  const cleanValues = values.filter((v) => v !== null && v !== undefined);
  const numericValues = cleanValues
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => !Number.isNaN(v));

  switch (aggregation) {
    case "count":
      return values.length;
    case "count_values":
      return cleanValues.filter((v) => v !== "").length;
    case "count_unique":
      return new Set(cleanValues.map((v) => JSON.stringify(v))).size;
    case "count_empty":
      return values.filter((v) => v === null || v === undefined || v === "").length;
    case "percent_empty": {
      const empty = values.filter((v) => v === null || v === undefined || v === "").length;
      return values.length > 0 ? Math.round((empty / values.length) * 100) : 0;
    }
    case "percent_not_empty": {
      const filled = cleanValues.filter((v) => v !== "").length;
      return values.length > 0 ? Math.round((filled / values.length) * 100) : 0;
    }
    case "sum":
      return numericValues.reduce((sum, v) => sum + v, 0);
    case "average":
      return numericValues.length ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length : null;
    case "median": {
      if (!numericValues.length) return null;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    case "min":
      return numericValues.length ? Math.min(...numericValues) : null;
    case "max":
      return numericValues.length ? Math.max(...numericValues) : null;
    case "range":
      return numericValues.length ? Math.max(...numericValues) - Math.min(...numericValues) : null;
    case "earliest_date": {
      const dates = cleanValues.map((v) => new Date(String(v))).filter((d) => !Number.isNaN(d.getTime()));
      return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : null;
    }
    case "latest_date": {
      const dates = cleanValues.map((v) => new Date(String(v))).filter((d) => !Number.isNaN(d.getTime()));
      return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null;
    }
    case "date_range": {
      const dates = cleanValues.map((v) => new Date(String(v))).filter((d) => !Number.isNaN(d.getTime()));
      if (!dates.length) return null;
      const earliest = Math.min(...dates.map((d) => d.getTime()));
      const latest = Math.max(...dates.map((d) => d.getTime()));
      return Math.round((latest - earliest) / (1000 * 60 * 60 * 24));
    }
    case "checked":
      return values.filter((v) => v === true).length;
    case "unchecked":
      return values.filter((v) => v === false || v === null || v === undefined).length;
    case "percent_checked": {
      const checked = values.filter((v) => v === true).length;
      return values.length > 0 ? Math.round((checked / values.length) * 100) : 0;
    }
    case "show_unique":
      return Array.from(new Set(cleanValues.map((v) => String(v)))).join(", ");
    case "show_original":
      return cleanValues.map((v) => String(v)).join(", ");
    default:
      return null;
  }
}

function formatRollupErrorValue(message?: string) {
  if (!message) return "#ERROR";
  return `#ERROR: ${message}`;
}

async function sanitizeRowData(supabase: ReturnType<typeof createClient>, tableId: string, data: Record<string, unknown>) {
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id")
    .eq("table_id", tableId);

  const validIds = new Set((fields || []).map((f) => f.id));
  const cleaned: Record<string, unknown> = {};

  Object.entries(data || {}).forEach(([key, value]) => {
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

export async function computeRollupValue(
  rowId: string,
  fieldId: string
): Promise<ActionResult<{ value: unknown; error?: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: field } = await supabase
    .from("table_fields")
    .select("id, table_id, config, type")
    .eq("id", fieldId)
    .maybeSingle();

  if (!field || field.type !== "rollup") {
    return { error: "Rollup field not found" };
  }

  const access = await requireTableAccess(field.table_id);
  if ("error" in access) return access;

  const config = normalizeRollupConfig(field.config as TableField["config"]);
  if (!config.relationFieldId || !config.targetFieldId) {
    const message = "Rollup field is missing configuration";
    const { data: row } = await supabase
      .from("table_rows")
      .select("data")
      .eq("id", rowId)
      .single();
    await supabase
      .from("table_rows")
      .update({
        data: {
          ...(row?.data || {}),
          [fieldId]: formatRollupErrorValue(message),
        },
        updated_by: user.id,
      })
      .eq("id", rowId);
    return { data: { value: null, error: message } };
  }

  try {
    const related = await getRelatedRows(rowId, config.relationFieldId);
    if ("error" in related) {
      const message = related.error || "Failed to load related rows";
      const { data: row } = await supabase
        .from("table_rows")
        .select("data")
        .eq("id", rowId)
        .single();
      await supabase
        .from("table_rows")
        .update({
          data: {
            ...(row?.data || {}),
            [fieldId]: formatRollupErrorValue(message),
          },
          updated_by: user.id,
        })
        .eq("id", rowId);
      return { data: { value: null, error: message } };
    }

    let values = (related.data.rows || []).map((row) => row.data?.[config.targetFieldId as string]);

    if (config.filter) {
      values = (related.data.rows || [])
        .filter((row) =>
          applyFilterOperator(
            row.data?.[config.filter!.field_id],
            config.filter!.operator,
            config.filter!.value
          )
        )
        .map((row) => row.data?.[config.targetFieldId as string]);
    }

    const result = aggregateValues(values, config.aggregation);

    const { data: row } = await supabase
      .from("table_rows")
      .select("data")
      .eq("id", rowId)
      .single();

    const cleanedData = await sanitizeRowData(supabase, field.table_id, (row?.data as Record<string, unknown>) || {});

    const { error: updateError } = await supabase
      .from("table_rows")
      .update({
        data: {
          ...cleanedData,
          [fieldId]: result,
          [`${fieldId}_computed_at`]: new Date().toISOString(),
        },
        updated_by: user.id,
      })
      .eq("id", rowId);

    if (updateError) {
      console.error("computeRollupValue: failed to save rollup value:", updateError);
      return { data: { value: null, error: updateError.message || "Failed to save rollup value" } };
    }

    return { data: { value: result } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to compute rollup";
    const { data: row } = await supabase
      .from("table_rows")
      .select("data")
      .eq("id", rowId)
      .single();
    const cleanedData = await sanitizeRowData(supabase, field.table_id, (row?.data as Record<string, unknown>) || {});
    const { error: updateError } = await supabase
      .from("table_rows")
      .update({
        data: {
          ...cleanedData,
          [fieldId]: formatRollupErrorValue(message),
        },
        updated_by: user.id,
      })
      .eq("id", rowId);
    if (updateError) {
      console.error("computeRollupValue: failed to save rollup error:", updateError);
      return { data: { value: null, error: updateError.message || "Failed to save rollup error" } };
    }
    return { data: { value: null, error: message } };
  }
}

export async function recomputeRollupField(fieldId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: field } = await supabase
    .from("table_fields")
    .select("id, table_id, type")
    .eq("id", fieldId)
    .maybeSingle();

  if (!field || field.type !== "rollup") {
    return { error: "Rollup field not found" };
  }

  const access = await requireTableAccess(field.table_id);
  if ("error" in access) return access;

  const { data: rows } = await supabase
    .from("table_rows")
    .select("id")
    .eq("table_id", field.table_id);

  for (const row of rows || []) {
    await computeRollupValue(row.id, fieldId);
  }

  return { data: null };
}

export async function recomputeRollupsForRow(tableId: string, rowId: string, relationFieldId?: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error } as const;

  const { data: rollupFields } = await supabase
    .from("table_fields")
    .select("id, config")
    .eq("table_id", tableId)
    .eq("type", "rollup");

  const relevant = (rollupFields || []).filter((field) => {
    if (!relationFieldId) return true;
    const config = normalizeRollupConfig(field.config as TableField["config"]);
    return config.relationFieldId === relationFieldId;
  });

  for (const field of relevant) {
    await computeRollupValue(rowId, field.id);
  }

  return { data: null } as const;
}

export async function recomputeRollupsForTargetRowChanged(
  targetRowId: string,
  targetTableId: string,
  changedFieldId?: string
) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const access = await requireTableAccess(targetTableId);
  if ("error" in access) return { error: access.error } as const;

  const { data: relations } = await supabase
    .from("table_relations")
    .select("from_row_id, from_field_id, from_table_id")
    .eq("to_row_id", targetRowId);

  if (!relations || relations.length === 0) return { data: null } as const;

  const grouped = new Map<string, { fromRowId: string; fromFieldId: string }[]>();
  relations.forEach((rel) => {
    const key = rel.from_table_id;
    const arr = grouped.get(key) ?? [];
    arr.push({ fromRowId: rel.from_row_id, fromFieldId: rel.from_field_id });
    grouped.set(key, arr);
  });

  for (const [fromTableId, rels] of grouped.entries()) {
    const { data: rollupFields } = await supabase
      .from("table_fields")
      .select("id, config")
      .eq("table_id", fromTableId)
      .eq("type", "rollup");

    for (const rel of rels) {
      const relevant = (rollupFields || []).filter((field) => {
        const config = normalizeRollupConfig(field.config as TableField["config"]);
        if (config.relationFieldId !== rel.fromFieldId) return false;
        if (!changedFieldId) return true;
        return config.targetFieldId === changedFieldId;
      });

      for (const field of relevant) {
        await computeRollupValue(rel.fromRowId, field.id);
      }
    }
  }

  return { data: null } as const;
}
