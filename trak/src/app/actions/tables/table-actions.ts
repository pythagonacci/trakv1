"use server";

// Table refactor baseline (Sept 2024):
// - Current table experience is a block stored in blocks.content; no dedicated Supabase tables/fields/rows/views/comments are live yet.
// - These server actions target the new schema in add_tables_schema.sql and enforce workspace membership before writes.
// - Data fetching today is via getTabBlocks/useTabBlocks; future React Query table hooks should call these actions once the UI is migrated.

import { createClient } from "@/lib/supabase/server";
import { requireTableAccess, requireWorkspaceAccessForTables } from "./context";
import type { Table, TableField } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface CreateTableInput {
  workspaceId: string;
  projectId?: string | null;
  title?: string;
  description?: string | null;
  icon?: string | null;
}

export async function createTable(input: CreateTableInput): Promise<ActionResult<{ table: Table; primaryField: TableField }>> {
  const { workspaceId, projectId = null, title = "Untitled Table", description = null, icon = null } = input;
  const access = await requireWorkspaceAccessForTables(workspaceId);
  if ("error" in access) return access;
  const { supabase, userId } = access;

  const { data: table, error: tableError } = await supabase
    .from("tables")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      title,
      description,
      icon,
      created_by: userId,
    })
    .select("*")
    .single();

  if (tableError || !table) {
    return { error: "Failed to create table" };
  }

  const { data: field, error: fieldError } = await supabase
    .from("table_fields")
    .insert({
      table_id: table.id,
      name: "Name",
      type: "text",
      is_primary: true,
      order: 1,
    })
    .select("*")
    .single();

  if (fieldError || !field) {
    return { error: "Table created but failed to create primary field" };
  }

  // Seed a default view
  await supabase.from("table_views").insert({
    table_id: table.id,
    name: "Default view",
    type: "table",
    is_default: true,
    created_by: userId,
    config: {},
  });

  return { data: { table, primaryField: field } };
}

export async function getTable(tableId: string): Promise<ActionResult<{ table: Table; fields: TableField[] }>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("*")
    .eq("id", tableId)
    .single();

  if (tableError || !table) {
    return { error: "Table not found" };
  }

  const { data: fields, error: fieldsError } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", tableId)
    .order("order", { ascending: true });

  if (fieldsError || !fields) {
    return { error: "Failed to load fields" };
  }

  return { data: { table, fields } };
}

export async function updateTable(tableId: string, updates: Partial<Pick<Table, "title" | "description" | "icon" | "project_id">>): Promise<ActionResult<Table>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { data, error } = await supabase
    .from("tables")
    .update({
      title: updates.title,
      description: updates.description,
      icon: updates.icon,
      project_id: updates.project_id,
    })
    .eq("id", tableId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update table" };
  }

  return { data };
}

export async function deleteTable(tableId: string): Promise<ActionResult<null>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { error } = await supabase.from("tables").delete().eq("id", tableId);
  if (error) {
    return { error: "Failed to delete table" };
  }
  return { data: null };
}

export async function duplicateTable(tableId: string, options?: { includeRows?: boolean }): Promise<ActionResult<{ table: Table; fields: TableField[] }>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase, table, userId } = access;

  // Load source table + fields
  const { data: fields } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", tableId)
    .order("order", { ascending: true });

  // Create copy
  const { data: newTable, error: tableError } = await supabase
    .from("tables")
    .insert({
      workspace_id: table.workspace_id,
      project_id: table.project_id,
      title: `${table.title} (Copy)`,
      description: table.description,
      icon: table.icon,
      created_by: userId,
    })
    .select("*")
    .single();

  if (tableError || !newTable) {
    return { error: "Failed to duplicate table" };
  }

  const newFieldsPayload = (fields || []).map((field) => ({
    table_id: newTable.id,
    name: field.name,
    type: field.type,
    config: field.config,
    order: field.order,
    is_primary: field.is_primary,
    width: field.width,
  }));

  const { data: newFields, error: fieldsError } = await supabase
    .from("table_fields")
    .insert(newFieldsPayload)
    .select("*");

  if (fieldsError || !newFields) {
    return { error: "Table duplicated but fields failed to copy" };
  }

  if (options?.includeRows) {
    const { data: rows } = await supabase
      .from("table_rows")
      .select("*")
      .eq("table_id", tableId);

    if (rows && rows.length > 0) {
      const rowPayload = rows.map((row) => ({
        table_id: newTable.id,
        data: row.data,
        order: row.order,
        created_by: userId,
        updated_by: userId,
      }));
      await supabase.from("table_rows").insert(rowPayload);
    }
  }

  // Seed a default view for the duplicate
  await supabase.from("table_views").insert({
    table_id: newTable.id,
    name: "Default view",
    type: "table",
    is_default: true,
    created_by: userId,
    config: {},
  });

  return { data: { table: newTable, fields: newFields } };
}
