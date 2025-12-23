"use server";

// Table refactor baseline (Sept 2024):
// - Existing table UX is block-scoped in src/app/dashboard/projects/[projectId]/tabs/[tabId]/table-block.tsx, persisting rows/cols/cells in blocks.content via updateBlock/getTabBlocks.
// - No Supabase-backed tables/fields/rows/views/comments exist yet; this helper centralizes membership and table lookups for the new schema.
// - Data fetching today is block-based through React Query hooks in src/lib/hooks/use-tab-data.ts; these helpers will be used by server actions to enforce RLS-friendly access before querying new tables.

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TableAccessContext {
  supabase: SupabaseClient;
  userId: string;
  table: {
    id: string;
    workspace_id: string;
    project_id: string | null;
  };
}

/**
 * Fetches table metadata and ensures the requesting user belongs to the table's workspace.
 * Returns an error string if unauthorized or missing.
 */
export async function requireTableAccess(tableId: string): Promise<
  | { error: string }
  | TableAccessContext
> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: table, error: tableError } = await supabase
    .from("tables")
    .select("id, workspace_id, project_id")
    .eq("id", tableId)
    .maybeSingle();

  if (tableError || !table) {
    return { error: "Table not found" };
  }

  const membership = await checkWorkspaceMembership(table.workspace_id, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return { supabase, userId: user.id, table };
}

/**
 * Ensures a user can act within a workspace (used for create flows).
 */
export async function requireWorkspaceAccessForTables(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return { supabase, userId: user.id };
}
