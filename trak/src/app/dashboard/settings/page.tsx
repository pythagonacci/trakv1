import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import { getAllTeams } from "@/app/actions/workspace-teams";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings - TWOD",
  description: "Manage workspace settings and team members",
};

export default async function SettingsPage() {
  // 1. Get current workspace
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  // 2. Verify access and get user role
  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) redirect("/login");

  const { user, membership } = access;

  // 3. Fetch workspace details
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, owner_id, created_at")
    .eq("id", workspaceId)
    .single();

  if (!workspace) redirect("/dashboard");

  // 4. Fetch members and teams
  const [membersResult, teamsResult] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    getAllTeams(workspaceId),
  ]);
  const members = "data" in membersResult ? membersResult.data : [];
  const teams = "data" in teamsResult ? teamsResult.data : [];

  return (
    <SettingsClient
      workspace={workspace}
      members={members || []}
      teams={teams || []}
      currentUserRole={membership.role}
      currentUserId={user.id}
    />
  );
}
