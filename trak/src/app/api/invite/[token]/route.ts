import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: invite, error } = await supabase
    .from("workspace_invitations")
    .select("id, email, role, expires_at, workspace_id")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  let workspaceName = "Unknown";
  if (invite.workspace_id) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", invite.workspace_id)
      .single();
    if (ws?.name) workspaceName = ws.name;
  }

  const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
  const expired = Date.now() > expiresAt;

  return NextResponse.json({
    email: invite.email,
    workspaceName,
    role: invite.role,
    expired,
  });
}
