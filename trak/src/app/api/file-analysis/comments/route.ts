import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const ids = url.searchParams.getAll("fileIds");
  const idsParam = url.searchParams.get("fileIds");
  const fileIds = (ids.length > 0 ? ids : (idsParam ? idsParam.split(",") : []))
    .map((id) => id.trim())
    .filter(Boolean);

  if (fileIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("id, workspace_id")
    .in("id", fileIds);

  if (filesError) {
    return NextResponse.json({ error: "Failed to load files" }, { status: 500 });
  }

  const workspaceIds = Array.from(new Set((files || []).map((file: any) => file.workspace_id)));
  for (const workspaceId of workspaceIds) {
    const membership = await checkWorkspaceMembership(workspaceId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }
  }

  const { data: comments, error } = await supabase
    .from("file_comments")
    .select("id, file_id, text, created_at, user_id, parent_id")
    .in("file_id", fileIds)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load file comments" }, { status: 500 });
  }

  const userIds = Array.from(new Set((comments || []).map((c: { user_id?: string }) => c.user_id).filter(Boolean)));
  const profileMap = new Map<string, { name?: string; email?: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    (profiles || []).forEach((p: { id: string; name?: string; email?: string }) => {
      profileMap.set(p.id, { name: p.name, email: p.email });
    });
  }

  const enriched = (comments || []).map((c: { user_id?: string; [k: string]: unknown }) => ({
    ...c,
    author_name: c.user_id ? (profileMap.get(c.user_id)?.name || profileMap.get(c.user_id)?.email?.split("@")[0] || "User") : "Unknown",
  }));

  return NextResponse.json({ data: enriched });
}
