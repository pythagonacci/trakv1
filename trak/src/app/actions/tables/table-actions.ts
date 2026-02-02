"use server";

// Table refactor baseline (Sept 2024):
// - Current table experience is a block stored in blocks.content; no dedicated Supabase tables/fields/rows/views/comments are live yet.
// - These server actions target the new schema in add_tables_schema.sql and enforce workspace membership before writes.
// - Data fetching today is via getTabBlocks/useTabBlocks; future React Query table hooks should call these actions once the UI is migrated.

import { createClient } from "@/lib/supabase/server";
import { requireTableAccess, requireWorkspaceAccessForTables } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { Table, TableField } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface CreateTableInput {
  workspaceId: string;
  projectId?: string | null;
  title?: string;
  description?: string | null;
  icon?: string | null;
  authContext?: AuthContext;
}

export async function createTable(input: CreateTableInput): Promise<ActionResult<{ table: Table; primaryField: TableField }>> {
  const { workspaceId, projectId = null, title = "Untitled Table", description = null, icon = null, authContext } = input;
  const access = await requireWorkspaceAccessForTables(workspaceId, { authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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

  // Create 3 default fields
  const defaultFields = [
    { name: "Name", type: "text", is_primary: true, order: 1 },
    { name: "Column 2", type: "text", is_primary: false, order: 2 },
    { name: "Column 3", type: "text", is_primary: false, order: 3 },
  ];

  const fieldsPayload = defaultFields.map((field) => ({
    table_id: table.id,
    name: field.name,
    type: field.type,
    is_primary: field.is_primary,
    order: field.order,
  }));

  const { data: fields, error: fieldsError } = await supabase
    .from("table_fields")
    .insert(fieldsPayload)
    .select("*");

  if (fieldsError || !fields || fields.length === 0) {
    return { error: "Table created but failed to create fields" };
  }

  const primaryField = fields.find((f) => f.is_primary) || fields[0];

  // Create 3 default rows
  const rowsPayload = [
    { data: {}, order: 1 },
    { data: {}, order: 2 },
    { data: {}, order: 3 },
  ].map((row) => ({
    table_id: table.id,
    data: row.data,
    order: row.order,
    created_by: userId,
    updated_by: userId,
  }));

  const { error: rowsError } = await supabase
    .from("table_rows")
    .insert(rowsPayload);

  if (rowsError) {
    // Don't fail table creation if rows fail, just log it
    console.error("Failed to create default rows:", rowsError);
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

  return { data: { table, primaryField } };
}

export async function getTable(tableId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<{ table: Table; fields: TableField[] }>> {
  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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

export async function updateTable(tableId: string, updates: Partial<Pick<Table, "title" | "description" | "icon" | "project_id">>, opts?: { authContext?: AuthContext }): Promise<ActionResult<Table>> {
  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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

export async function deleteTable(tableId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("tables").delete().eq("id", tableId);
  if (error) {
    return { error: "Failed to delete table" };
  }
  return { data: null };
}

export async function duplicateTable(tableId: string, options?: { includeRows?: boolean }, opts?: { authContext?: AuthContext }): Promise<ActionResult<{ table: Table; fields: TableField[] }>> {
  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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

export async function listWorkspaceTables(workspaceId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<Table[]>> {
  const access = await requireWorkspaceAccessForTables(workspaceId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { error: "Failed to load tables" };
  }

  return { data };
}
