"use server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { safeRevalidatePath } from "./workspace";
import type { AuthContext } from "@/lib/auth-context";

export type ActionResult<T> = { data: T } | { error: string };

export interface WorkspaceTeam {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  member_ids: string[];
}

async function requireWorkspaceMember(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  workspaceId: string,
  userId: string
) {
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return membership;
}

export async function createTeam(
  workspaceId: string,
  name: string,
  memberUserIds: string[] = [],
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<WorkspaceTeam>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const authResult = await getServerUser();
    if (!authResult) return { error: "Unauthorized" };
    supabase = authResult.supabase;
    userId = authResult.user.id;
  }

  const membership = await requireWorkspaceMember(supabase, workspaceId, userId);
  if (!membership) return { error: "You must be a workspace member to create teams" };

  const { data: maxTeam } = await supabase
    .from("workspace_teams")
    .select("position")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newPosition = maxTeam ? maxTeam.position + 1 : 0;

  const { data: team, error: createError } = await supabase
    .from("workspace_teams")
    .insert({
      workspace_id: workspaceId,
      name: name.trim(),
      position: newPosition,
    })
    .select()
    .single();

  if (createError) return { error: createError.message };
  if (!team) return { error: "Failed to create team" };

  const memberIds = Array.from(new Set(memberUserIds.filter(Boolean)));
  if (memberIds.length > 0) {
    const { error: membersError } = await supabase.from("workspace_team_members").insert(
      memberIds.map((user_id) => ({ team_id: team.id, user_id }))
    );
    if (membersError) return { error: membersError.message };
  }

  await safeRevalidatePath("/dashboard/settings");
  return {
    data: {
      ...team,
      member_ids: memberIds,
    },
  };
}

export async function getAllTeams(workspaceId: string): Promise<ActionResult<WorkspaceTeam[]>> {
  const authResult = await getServerUser();
  if (!authResult) return { error: "Unauthorized" };
  const { supabase, user } = authResult;

  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id);
  if (!membership) return { error: "You must be a workspace member to view teams" };

  const { data: teams, error: teamsError } = await supabase
    .from("workspace_teams")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (teamsError) return { error: teamsError.message };
  if (!teams || teams.length === 0) return { data: [] };

  const { data: allMembers, error: membersError } = await supabase
    .from("workspace_team_members")
    .select("team_id, user_id")
    .in(
      "team_id",
      teams.map((t) => t.id)
    );

  if (membersError) return { error: membersError.message };

  const memberIdsByTeam = new Map<string, string[]>();
  for (const t of teams) memberIdsByTeam.set(t.id, []);
  for (const m of allMembers || []) {
    const arr = memberIdsByTeam.get(m.team_id) || [];
    arr.push(m.user_id);
    memberIdsByTeam.set(m.team_id, arr);
  }

  const result: WorkspaceTeam[] = teams.map((t) => ({
    ...t,
    member_ids: memberIdsByTeam.get(t.id) || [],
  }));

  return { data: result };
}

export async function updateTeam(
  teamId: string,
  updates: { name?: string; member_ids?: string[] },
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<WorkspaceTeam>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const authResult = await getServerUser();
    if (!authResult) return { error: "Unauthorized" };
    supabase = authResult.supabase;
    userId = authResult.user.id;
  }

  const { data: team, error: teamError } = await supabase
    .from("workspace_teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError || !team) return { error: "Team not found" };

  const membership = await requireWorkspaceMember(supabase, team.workspace_id, userId);
  if (!membership) return { error: "You must be a workspace member to update teams" };

  if (updates.name !== undefined) {
    const { error: updateError } = await supabase
      .from("workspace_teams")
      .update({ name: updates.name.trim(), updated_at: new Date().toISOString() })
      .eq("id", teamId);
    if (updateError) return { error: updateError.message };
  }

  if (updates.member_ids !== undefined) {
    const { error: deleteError } = await supabase
      .from("workspace_team_members")
      .delete()
      .eq("team_id", teamId);
    if (deleteError) return { error: deleteError.message };

    const memberIds = Array.from(new Set(updates.member_ids.filter(Boolean)));
    if (memberIds.length > 0) {
      const { error: insertError } = await supabase.from("workspace_team_members").insert(
        memberIds.map((user_id) => ({ team_id: teamId, user_id }))
      );
      if (insertError) return { error: insertError.message };
    }
  }

  await safeRevalidatePath("/dashboard/settings");
  const list = await getAllTeams(team.workspace_id);
  if ("error" in list) return list;
  const updated = list.data.find((t) => t.id === teamId);
  return updated ? { data: updated } : { error: "Team not found" };
}

export async function deleteTeam(
  teamId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const authResult = await getServerUser();
    if (!authResult) return { error: "Unauthorized" };
    supabase = authResult.supabase;
    userId = authResult.user.id;
  }

  const { data: team, error: teamError } = await supabase
    .from("workspace_teams")
    .select("workspace_id")
    .eq("id", teamId)
    .single();

  if (teamError || !team) return { error: "Team not found" };

  const membership = await requireWorkspaceMember(supabase, team.workspace_id, userId);
  if (!membership) return { error: "You must be a workspace member to delete teams" };

  const { error: deleteError } = await supabase.from("workspace_teams").delete().eq("id", teamId);
  if (deleteError) return { error: deleteError.message };

  await safeRevalidatePath("/dashboard/settings");
  return { data: null };
}
