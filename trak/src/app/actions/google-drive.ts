"use server";

import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

export async function getWorkspaceDriveConnection(workspaceId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Forbidden" };

  const { data, error } = await supabase
    .from("drive_connections")
    .select("id, workspace_id, google_account_email, scopes, created_at, updated_at, token_expiry")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return { error: error.message };

  return {
    data: data || null,
    canManage: membership.role === "owner" || membership.role === "admin",
  };
}

export async function getProjectDriveMapping(projectId: string, workspaceId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Forbidden" };

  const { data, error } = await supabase
    .from("project_drive_folders")
    .select(
      `
      id,
      project_id,
      workspace_id,
      drive_folder_asset_id,
      asset:external_assets (
        id,
        provider_item_id,
        name,
        web_view_link,
        mime_type,
        modified_time,
        owner_display
      )
    `
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) return { error: error.message };
  return { data: data || null };
}
