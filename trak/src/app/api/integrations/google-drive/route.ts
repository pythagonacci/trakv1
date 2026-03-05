import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createServiceClient } from "@/lib/supabase/service";
import { logDriveAuditEvent, requireWorkspaceAdmin, requireWorkspaceMember } from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }

    await requireWorkspaceMember(workspaceId, user.id);

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("drive_connections")
      .select("id, workspace_id, google_account_email, scopes, created_at, updated_at, token_expiry")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      connected: !!data,
      connection: data || null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body.workspaceId || "");
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    await requireWorkspaceAdmin(workspaceId, user.id);

    const supabase = await createServiceClient();
    const { error } = await supabase.from("drive_connections").delete().eq("workspace_id", workspaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logDriveAuditEvent({
      workspaceId,
      userId: user.id,
      eventType: "disconnected",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}
