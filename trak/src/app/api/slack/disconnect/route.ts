import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/slack/disconnect
 *
 * Disconnects a Slack workspace integration
 * - Soft deletes the connection (sets status to 'disconnected')
 * - Revokes all user account links
 * - Requires admin/owner permissions
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get connection ID from request body
    const { connection_id } = await request.json();
    if (!connection_id) {
      return NextResponse.json(
        { error: "Missing connection_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 3. Verify connection exists and user has admin access
    const { data: connection, error: fetchError } = await supabase
      .from("slack_workspace_connections")
      .select("workspace_id")
      .eq("id", connection_id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // 4. Check if user is admin/owner of the workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", connection.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only workspace admins can disconnect Slack" },
        { status: 403 }
      );
    }

    // 5. Soft delete: Update connection status to 'disconnected'
    const { error: updateError } = await supabase
      .from("slack_workspace_connections")
      .update({ connection_status: "disconnected" })
      .eq("id", connection_id);

    if (updateError) {
      console.error("Error disconnecting Slack:", updateError);
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 }
      );
    }

    // 6. Revoke all user links
    const { error: revokeError } = await supabase
      .from("slack_user_links")
      .update({ link_status: "revoked" })
      .eq("slack_connection_id", connection_id);

    if (revokeError) {
      console.error("Error revoking user links:", revokeError);
      // Don't fail the request - connection is already disconnected
    }

    // 7. Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in disconnect route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
