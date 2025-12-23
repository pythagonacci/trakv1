"use server";

// Table refactor baseline (Sept 2024):
// - Views are not yet persisted; this file adds CRUD for table_views with single-default enforcement via trigger in add_tables_schema.sql.
// - Future UI (table-block replacement) should use these actions with React Query.

import { requireTableAccess } from "./context";
import type { TableView, ViewConfig, ViewType } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface CreateViewInput {
  tableId: string;
  name: string;
  type?: ViewType;
  config?: ViewConfig;
  isDefault?: boolean;
}

export async function createView(input: CreateViewInput): Promise<ActionResult<TableView>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return access;
  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("table_views")
    .insert({
      table_id: input.tableId,
      name: input.name || "Untitled View",
      type: input.type || "table",
      config: input.config || {},
      is_default: input.isDefault ?? false,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create view" };
  }
  return { data };
}

export async function listViews(tableId: string): Promise<ActionResult<TableView[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_views")
    .select("*")
    .eq("table_id", tableId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { error: "Failed to load views" };
  }
  return { data };
}

export async function getView(viewId: string): Promise<ActionResult<TableView>> {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: view, error } = await supabase
    .from("table_views")
    .select("*, tables!inner(id, workspace_id)")
    .eq("id", viewId)
    .maybeSingle();

  if (error || !view) {
    return { error: "View not found" };
  }

  const workspaceId = (view as any).tables.workspace_id as string;
  const access = await import("@/lib/auth-utils").then((m) => m.checkWorkspaceMembership(workspaceId, user.id));
  if (!access) return { error: "Not a member of this workspace" };

  const sanitized: TableView = {
    id: view.id,
    table_id: view.table_id,
    name: view.name,
    type: view.type,
    config: view.config,
    is_default: view.is_default,
    created_at: view.created_at,
    updated_at: view.updated_at,
    created_by: view.created_by,
  };

  return { data: sanitized };
}

export async function updateView(viewId: string, updates: Partial<Pick<TableView, "name" | "type" | "config" | "is_default">>): Promise<ActionResult<TableView>> {
  const access = await getViewContext(viewId);
  if ("error" in access) return access;
  const { supabase, view } = access;

  const { data, error } = await supabase
    .from("table_views")
    .update({
      name: updates.name,
      type: updates.type,
      config: updates.config,
      is_default: updates.is_default,
    })
    .eq("id", viewId)
    .eq("table_id", view.table_id)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update view" };
  }
  return { data };
}

export async function deleteView(viewId: string): Promise<ActionResult<null>> {
  const access = await getViewContext(viewId);
  if ("error" in access) return access;
  const { supabase, view } = access;

  const { error } = await supabase
    .from("table_views")
    .delete()
    .eq("id", viewId)
    .eq("table_id", view.table_id);

  if (error) {
    return { error: "Failed to delete view" };
  }
  return { data: null };
}

export async function setDefaultView(viewId: string): Promise<ActionResult<TableView>> {
  const access = await getViewContext(viewId);
  if ("error" in access) return access;
  const { supabase, view } = access;

  const { data, error } = await supabase
    .from("table_views")
    .update({ is_default: true })
    .eq("id", viewId)
    .eq("table_id", view.table_id)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to set default view" };
  }
  return { data };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getViewContext(viewId: string) {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" } as const;
  }

  const { data: view, error } = await supabase
    .from("table_views")
    .select("id, table_id")
    .eq("id", viewId)
    .maybeSingle();

  if (error || !view) {
    return { error: "View not found" } as const;
  }

  const access = await requireTableAccess(view.table_id);
  if ("error" in access) return access;

  return { supabase: access.supabase, view, userId: user.id };
}
