"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTableAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { evaluateFormula, extractDependencies } from "@/lib/formula-parser";
import type { TableField } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

function coerceFormulaValue(value: unknown, returnType?: string) {
  if (value === "#ERROR") return value;
  if (returnType === "number") {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }
  if (returnType === "boolean") {
    return Boolean(value);
  }
  if (returnType === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return value;
}

function formatFormulaErrorValue(message?: string) {
  if (!message) return "#ERROR";
  return `#ERROR: ${message}`;
}

function sanitizeRowData(rowData: Record<string, unknown>, fields: TableField[]) {
  const validIds = new Set(fields.map((f) => f.id));
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

export async function createFormulaField(input: {
  tableId: string;
  name: string;
  formula: string;
  returnType?: "number" | "text" | "boolean" | "date";
}): Promise<ActionResult<TableField>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { data: fields } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", input.tableId);

  const dependencies = extractDependencies(input.formula, (fields || []) as TableField[]);

  const { data: field, error } = await supabase
    .from("table_fields")
    .insert({
      table_id: input.tableId,
      name: input.name,
      type: "formula",
      config: {
        formula: input.formula,
        return_type: input.returnType ?? "text",
        dependencies,
      },
    })
    .select("*")
    .single();

  if (error || !field) {
    return { error: "Failed to create formula field" };
  }

  await recomputeFormulaField(field.id);

  return { data: field as TableField };
}

export async function recomputeFormulaField(fieldId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const { data: field } = await supabase
    .from("table_fields")
    .select("id, table_id, type, config")
    .eq("id", fieldId)
    .maybeSingle();

  if (!field || field.type !== "formula") {
    return { error: "Formula field not found" };
  }

  const access = await requireTableAccess(field.table_id, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { data: fields } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", field.table_id);

  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, data")
    .eq("table_id", field.table_id);

  const formula = (field.config as any)?.formula as string;
  const returnType = (field.config as any)?.return_type as string | undefined;

  const updates = (rows || []).map((row) => {
    const cleanedData = sanitizeRowData(row.data || {}, (fields || []) as TableField[]);
    const result = evaluateFormula(formula, row.data || {}, (fields || []) as TableField[]);
    const value = result.error
      ? formatFormulaErrorValue(result.error)
      : coerceFormulaValue(result.value, returnType);
    return {
      id: row.id,
      table_id: field.table_id,
      data: {
        ...cleanedData,
        [field.id]: value,
      },
      updated_by: userId,
    };
  });

  if (updates.length > 0) {
    const { error } = await supabase.from("table_rows").upsert(updates, { onConflict: "id" });
    if (error) {
      console.error("recomputeFormulaField: failed to write formula values:", error);
      return { error: error.message || "Failed to save formula values" };
    }
  }

  return { data: null };
}

export async function recomputeFormulasForRow(
  tableId: string,
  rowId: string,
  changedFieldId?: string
) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" } as const;

  const { data: formulaFields } = await supabase
    .from("table_fields")
    .select("id, config")
    .eq("table_id", tableId)
    .eq("type", "formula");

  if (!formulaFields || formulaFields.length === 0) return { data: null } as const;

  const relevant = formulaFields.filter((field) => {
    if (!changedFieldId) return true;
    const deps = (field.config as any)?.dependencies as string[] | undefined;
    if (!deps || deps.length === 0) return true;
    return deps.includes(changedFieldId);
  });

  if (relevant.length === 0) return { data: null } as const;

  const { data: fields } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", tableId);

  const { data: row } = await supabase
    .from("table_rows")
    .select("data")
    .eq("id", rowId)
    .single();

  if (!row) return { data: null } as const;

  const updatedData = sanitizeRowData(row.data || {}, (fields || []) as TableField[]);
  relevant.forEach((field) => {
    const formula = (field.config as any)?.formula as string;
    const returnType = (field.config as any)?.return_type as string | undefined;
    const result = evaluateFormula(formula, row.data || {}, (fields || []) as TableField[]);
    const value = result.error
      ? formatFormulaErrorValue(result.error)
      : coerceFormulaValue(result.value, returnType);
    updatedData[field.id] = value;
  });

  const { error } = await supabase
    .from("table_rows")
    .update({
      data: updatedData,
      updated_by: user.id,
    })
    .eq("id", rowId);
  if (error) {
    console.error("recomputeFormulasForRow: failed to update row:", error);
    return { error: error.message || "Failed to save formula values" } as const;
  }

  return { data: null } as const;
}
