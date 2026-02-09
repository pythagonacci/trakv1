"use server";

import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SlackConnection {
  id: string;
  workspace_id: string;
  slack_team_id: string;
  slack_team_name: string;
  scopes: string[];
  connection_status: string;
  created_at: string;
  updated_at: string;
}

export interface SlackUserLink {
  id: string;
  slack_user_id: string;
  trak_user_id: string;
  link_status: string;
  linked_at: string;
}

/**
 * Gets the Slack connection for a workspace
 */
export async function getSlackConnection(
  workspaceId: string
): Promise<{ data?: SlackConnection; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const supabase = await createClient();

    // Verify workspace membership
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { error: "Not a member of this workspace" };
    }

    // Get Slack connection (exclude encrypted token)
    const { data: connection, error } = await supabase
      .from("slack_workspace_connections")
      .select(
        `id, workspace_id, slack_team_id, slack_team_name, scopes, connection_status, created_at, updated_at`
      )
      .eq("workspace_id", workspaceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found - no connection exists
        return { data: undefined };
      }
      console.error("Error fetching Slack connection:", error);
      return { error: "Failed to fetch connection" };
    }

    return { data: connection as SlackConnection };
  } catch (error) {
    console.error("Unexpected error in getSlackConnection:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Gets the current user's Slack link status
 */
export async function getCurrentUserSlackLink(
  workspaceId: string
): Promise<{ data?: SlackUserLink; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const supabase = await createClient();

    // Get Slack connection for workspace
    const { data: connection } = await supabase
      .from("slack_workspace_connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("connection_status", "active")
      .single();

    if (!connection) {
      return { data: undefined };
    }

    // Get user's link
    const { data: link, error } = await supabase
      .from("slack_user_links")
      .select("id, slack_user_id, trak_user_id, link_status, linked_at")
      .eq("slack_connection_id", connection.id)
      .eq("trak_user_id", user.id)
      .eq("link_status", "active")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found - no link exists
        return { data: undefined };
      }
      console.error("Error fetching Slack user link:", error);
      return { error: "Failed to fetch link" };
    }

    return { data: link as SlackUserLink };
  } catch (error) {
    console.error("Unexpected error in getCurrentUserSlackLink:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Disconnects a Slack workspace integration
 */
export async function disconnectSlack(
  connectionId: string
): Promise<{ error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const supabase = await createClient();

    // Get connection + verify access via RLS
    const { data: connection, error: fetchError } = await supabase
      .from("slack_workspace_connections")
      .select("workspace_id")
      .eq("id", connectionId)
      .single();

    if (fetchError || !connection) {
      return { error: "Connection not found or access denied" };
    }

    // Check if user is admin/owner
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", connection.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Only workspace admins can disconnect Slack" };
    }

    // Soft delete
    const { error: updateError } = await supabase
      .from("slack_workspace_connections")
      .update({ connection_status: "disconnected" })
      .eq("id", connectionId);

    if (updateError) {
      console.error("Error disconnecting:", updateError);
      return { error: "Failed to disconnect" };
    }

    // Revoke all user links
    await supabase
      .from("slack_user_links")
      .update({ link_status: "revoked" })
      .eq("slack_connection_id", connectionId);

    // Revalidate UI
    revalidatePath("/dashboard/settings/integrations");
    return {};
  } catch (error) {
    console.error("Unexpected error in disconnectSlack:", error);
    return { error: "Internal server error" };
  }
}
