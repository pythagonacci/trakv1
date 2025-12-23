"use server";

// Table refactor baseline (Sept 2024):
// - Table columns today live inside blocks.content; this file adds Supabase-backed CRUD for real table fields.
// - Triggers in add_tables_schema.sql set ordering and enforce RLS; we still gate by workspace membership before writes.

import { requireTableAccess } from "./context";
import type { FieldType, TableField } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface CreateFieldInput {
  tableId: string;
  name: string;
  type: FieldType;
  config?: Record<string, unknown>;
  order?: number | null;
  isPrimary?: boolean;
  width?: number | null;
}

export async function createField(input: CreateFieldInput): Promise<ActionResult<TableField>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_fields")
    .insert({
      table_id: input.tableId,
      name: input.name || "Untitled Field",
      type: input.type,
      config: input.config || {},
      order: input.order ?? null,
      is_primary: input.isPrimary ?? false,
      width: input.width ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create field" };
  }
  return { data };
}

export async function updateField(fieldId: string, updates: Partial<Pick<TableField, "name" | "type" | "config" | "is_primary" | "width">>): Promise<ActionResult<TableField>> {
  const { supabase, table, error } = await getFieldContext(fieldId);
  if (error) return { error };

  const { data, error: updateError } = await supabase
    .from("table_fields")
    .update({
      name: updates.name,
      type: updates.type,
      config: updates.config,
      is_primary: updates.is_primary,
      width: updates.width,
    })
    .eq("id", fieldId)
    .eq("table_id", table.id)
    .select("*")
    .single();

  if (updateError || !data) {
    return { error: "Failed to update field" };
  }
  return { data };
}

export async function deleteField(fieldId: string): Promise<ActionResult<null>> {
  const { supabase, table, error } = await getFieldContext(fieldId);
  if (error) return { error };

  const { error: deleteError } = await supabase
    .from("table_fields")
    .delete()
    .eq("id", fieldId)
    .eq("table_id", table.id);

  if (deleteError) {
    return { error: "Failed to delete field" };
  }
  return { data: null };
}

export async function reorderFields(tableId: string, orders: Array<{ fieldId: string; order: number }>): Promise<ActionResult<TableField[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  // Get max order to calculate safe temporary values
  const { data: existingFields } = await supabase
    .from("table_fields")
    .select("order")
    .eq("table_id", tableId);

  const maxOrder = existingFields?.reduce((max, f) => Math.max(max, f.order || 0), 0) || 0;
  const tempOffset = maxOrder + 1000;

  // Step 1: Set all to temporary negative values to free up order slots (batch update)
  const tempUpdates = orders.map((o) => ({
    id: o.fieldId,
    table_id: tableId,
    order: -(tempOffset + o.order),
  }));

  const { error: step1Error } = await supabase
    .from("table_fields")
    .upsert(tempUpdates, { onConflict: "id" });

  if (step1Error) {
    console.error("reorderFields: Step 1 error:", step1Error);
    return { error: `Failed to reorder fields: ${step1Error.message}` };
  }

  // Step 2: Set to correct values (batch update)
  const finalUpdates = orders.map((o) => ({
    id: o.fieldId,
    table_id: tableId,
    order: o.order,
  }));

  const { error: step2Error } = await supabase
    .from("table_fields")
    .upsert(finalUpdates, { onConflict: "id" });

  if (step2Error) {
    console.error("reorderFields: Step 2 error:", step2Error);
    return { error: `Failed to reorder fields: ${step2Error.message}` };
  }

  // Fetch updated fields
  const { data, error: fetchError } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", tableId)
    .order("order", { ascending: true });

  if (fetchError || !data) {
    return { error: "Failed to fetch reordered fields" };
  }

  return { data };
}

export async function updateFieldConfig(fieldId: string, config: Record<string, unknown>): Promise<ActionResult<TableField>> {
  const { supabase, table, error } = await getFieldContext(fieldId);
  if (error) return { error };

  const { data, error: updateError } = await supabase
    .from("table_fields")
    .update({ config })
    .eq("id", fieldId)
    .eq("table_id", table.id)
    .select("*")
    .single();

  if (updateError || !data) {
    return { error: "Failed to update field config" };
  }
  return { data };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFieldContext(fieldId: string) {
  const supabase = await requireFieldSupabase();
  if ("error" in supabase) return { error: supabase.error } as const;

  const { supabaseClient, userId } = supabase;
  const { data: field, error: fieldError } = await supabaseClient
    .from("table_fields")
    .select("id, table_id")
    .eq("id", fieldId)
    .maybeSingle();

  if (fieldError || !field) {
    return { error: "Field not found" } as const;
  }

  const access = await requireTableAccess(field.table_id);
  if ("error" in access) return access;

  return { supabase: access.supabase, table: access.table, userId };
}

async function requireFieldSupabase() {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" } as const;
  }
  return { supabaseClient: supabase, userId: user.id } as const;
}
