import { createClient } from "@/lib/supabase/server";
import { slugifyUrlSegment } from "@/lib/dashboard-routes";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveProjectIdFromParam(
  supabase: ServerSupabaseClient,
  workspaceId: string,
  projectParam: string
): Promise<string | null> {
  const targetSlug = slugifyUrlSegment(projectParam);
  const { data: candidates } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .limit(2000);

  const match = (candidates ?? []).find((project) => slugifyUrlSegment(project.name ?? "") === targetSlug);
  return match?.id ?? null;
}

export async function resolveTabIdFromParam(
  supabase: ServerSupabaseClient,
  projectId: string,
  tabParam: string
): Promise<string | null> {
  const targetSlug = slugifyUrlSegment(tabParam);
  const { data: candidates } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .limit(2000);

  const match = (candidates ?? []).find((tab) => slugifyUrlSegment(tab.name ?? "") === targetSlug);
  return match?.id ?? null;
}
