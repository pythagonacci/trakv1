import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

/**
 * Disconnect Shopify store route
 * POST /api/shopify/disconnect
 * Body: { connection_id: string }
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

    // 2. Get connection_id from body
    const body = await request.json();
    const { connection_id } = body;

    if (!connection_id) {
      return NextResponse.json(
        { error: "Missing connection_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 3. Verify the connection exists and user has access (RLS will handle this)
    const { data: connection, error: fetchError } = await supabase
      .from("shopify_connections")
      .select("workspace_id")
      .eq("id", connection_id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: "Connection not found or access denied" },
        { status: 404 }
      );
    }

    // 4. Soft delete: Update sync_status to 'disconnected'
    const { error: updateError } = await supabase
      .from("shopify_connections")
      .update({ sync_status: "disconnected" })
      .eq("id", connection_id);

    if (updateError) {
      console.error("Error disconnecting Shopify connection:", updateError);
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 }
      );
    }

    // 5. Delete all pending sync jobs for this connection
    const { error: jobsError } = await supabase
      .from("shopify_sync_jobs")
      .delete()
      .eq("connection_id", connection_id)
      .in("status", ["pending", "processing"]);

    if (jobsError) {
      console.error("Error deleting sync jobs:", jobsError);
      // Don't fail the request if job deletion fails
    }

    // 6. Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in Shopify disconnect route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
