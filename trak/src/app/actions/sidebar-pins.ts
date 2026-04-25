"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPinnedProjectIds(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { data: null, error: "Unauthorized" };

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return { data: null, error: "You don't have access to this workspace" };
  }

  const { data, error } = await supabase
    .from("user_pinned_projects")
    .select("project_id, projects!inner(workspace_id)")
    .eq("user_id", user.id)
    .eq("projects.workspace_id", workspaceId);

  if (error) return { data: null, error: error.message };
  return {
    data: (data ?? []).map((row) => row.project_id as string),
    error: null,
  };
}

export async function setProjectPinned(projectId: string, pinned: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized" };

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) return { error: "Project not found" };

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) return { error: "You don't have access to this project" };

  if (pinned) {
    const { error } = await supabase
      .from("user_pinned_projects")
      .upsert(
        {
          user_id: user.id,
          project_id: projectId,
          pinned_at: new Date().toISOString(),
        },
        { onConflict: "user_id,project_id" }
      );
    if (error) return { error: error.message };
    return { error: null };
  }

  const { error } = await supabase
    .from("user_pinned_projects")
    .delete()
    .eq("user_id", user.id)
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  return { error: null };
}
