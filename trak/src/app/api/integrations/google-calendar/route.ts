import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceMember } from "@/lib/google-drive/assets";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }

    await requireWorkspaceMember(workspaceId, user.id);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("google_calendar_connections")
      .select("id, workspace_id, google_account_email, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      connected: !!data,
      connection: data
        ? {
            id: data.id,
            workspace_id: data.workspace_id,
            google_account_email: data.google_account_email,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let workspaceId: string | null = null;
    try {
      const body = await request.json();
      workspaceId = typeof body?.workspace_id === "string" ? body.workspace_id : body?.workspaceId;
    } catch {
      // no body
    }
    if (!workspaceId) {
      workspaceId = request.nextUrl.searchParams.get("workspace_id");
    }
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });
    }

    await requireWorkspaceMember(workspaceId, user.id);

    const supabase = await createClient();
    const { error } = await supabase
      .from("google_calendar_connections")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
