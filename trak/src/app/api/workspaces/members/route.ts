import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing workspaceId" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getWorkspaceMembers workspaceId=${workspaceId} error=Unauthorized ms=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getWorkspaceMembers workspaceId=${workspaceId} error=NotMember ms=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json(
      { error: "Not a member of this workspace" },
      { status: 403 }
    );
  }

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("getWorkspaceMembers route error:", error);
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getWorkspaceMembers workspaceId=${workspaceId} error=Query ms=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json(
      { error: "Failed to fetch workspace members" },
      { status: 500 }
    );
  }

  if (!members || members.length === 0) {
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getWorkspaceMembers workspaceId=${workspaceId} ms=${Math.round(Date.now() - t0)} count=0`);
    }
    return NextResponse.json({ data: [] });
  }

  const userIds = members.map((member: any) => member.user_id).filter(Boolean);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  let transformed: any[] = [];
  if (profilesError) {
    console.error("getWorkspaceMembers route profiles error:", profilesError);
    transformed = members.map((member: any) => ({
      id: member.user_id || member.id,
      member_id: member.id || null,
      user_id: member.user_id || member.id,
      workspace_id: member.workspace_id ?? workspaceId,
      name: member.name || member.email || "Unknown",
      email: member.email || "",
      avatar_url: member.avatar_url ?? null,
      role: member.role,
    }));
  } else {
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    transformed = members.map((member: any) => {
      const profile = profileMap.get(member.user_id);
      const name =
        profile?.name ||
        profile?.full_name ||
        profile?.display_name ||
        profile?.username ||
        member.name ||
        profile?.email ||
        member.email ||
        "Unknown";
      return {
        id: member.user_id || member.id,
        member_id: member.id || null,
        user_id: member.user_id || member.id,
        workspace_id: member.workspace_id ?? workspaceId,
        name,
        email: profile?.email || member.email || "",
        avatar_url: profile?.avatar_url ?? member.avatar_url ?? null,
        role: member.role,
      };
    });
  }

  if (process.env.PERF_DEBUG === "1") {
    console.log(`[PERF] route getWorkspaceMembers workspaceId=${workspaceId} ms=${Math.round(Date.now() - t0)} count=${transformed.length}`);
  }

  return NextResponse.json({ data: transformed });
}
