"use server";

import { safeRevalidatePath } from "@/app/actions/workspace";
import type { AuthContext } from "@/lib/auth-context";
import {
  buildProjectOverviewPath,
  buildProjectPath,
  buildProjectTabPath,
} from "@/lib/dashboard-routes";
import { createClient } from "@/lib/supabase/server";

async function getSupabase(authContext?: AuthContext) {
  return authContext?.supabase ?? (await createClient());
}

async function resolveProjectName(projectId: string, authContext?: AuthContext): Promise<string | null> {
  const supabase = await getSupabase(authContext);
  const { data } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();

  return typeof data?.name === "string" && data.name.trim().length > 0 ? data.name : null;
}

async function resolveProjectTabNames(
  projectId: string,
  tabId: string,
  authContext?: AuthContext
): Promise<{ projectName: string | null; tabName: string | null }> {
  const supabase = await getSupabase(authContext);
  const { data } = await supabase
    .from("tabs")
    .select("name, projects!inner(id, name)")
    .eq("id", tabId)
    .eq("project_id", projectId)
    .maybeSingle();

  const projectRecord = Array.isArray(data?.projects) ? data.projects[0] : data?.projects;
  return {
    projectName:
      typeof projectRecord?.name === "string" && projectRecord.name.trim().length > 0
        ? projectRecord.name
        : null,
    tabName: typeof data?.name === "string" && data.name.trim().length > 0 ? data.name : null,
  };
}

export async function revalidateDashboardProjectPath(params: {
  projectId: string;
  projectName?: string | null;
  authContext?: AuthContext;
}) {
  await safeRevalidatePath(`/dashboard/projects/${params.projectId}`);

  const projectName =
    typeof params.projectName === "string" && params.projectName.trim().length > 0
      ? params.projectName
      : await resolveProjectName(params.projectId, params.authContext);

  if (!projectName) return;

  await safeRevalidatePath(buildProjectPath(params.projectId, projectName));
  await safeRevalidatePath(buildProjectOverviewPath(params.projectId, projectName));
}

export async function revalidateDashboardProjectTabPath(params: {
  projectId: string;
  tabId: string;
  projectName?: string | null;
  tabName?: string | null;
  authContext?: AuthContext;
}) {
  await safeRevalidatePath(`/dashboard/projects/${params.projectId}/tabs/${params.tabId}`);

  let projectName =
    typeof params.projectName === "string" && params.projectName.trim().length > 0
      ? params.projectName
      : null;
  let tabName =
    typeof params.tabName === "string" && params.tabName.trim().length > 0
      ? params.tabName
      : null;

  if (!projectName || !tabName) {
    const resolved = await resolveProjectTabNames(params.projectId, params.tabId, params.authContext);
    projectName = projectName ?? resolved.projectName;
    tabName = tabName ?? resolved.tabName;
  }

  if (!projectName || !tabName) return;

  await safeRevalidatePath(buildProjectTabPath(params.projectId, params.tabId, projectName, tabName));
}
