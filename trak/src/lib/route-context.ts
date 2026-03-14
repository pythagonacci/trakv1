import { resolveProjectIdFromParam, resolveTabIdFromParam } from "@/lib/dashboard-route-resolvers";
import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveRouteContextFromPathname(params: {
  supabase: ServerSupabaseClient;
  workspaceId: string;
  pathname: string;
}): Promise<{ projectId: string | null; tabId: string | null }> {
  const { supabase, workspaceId, pathname } = params;

  const projectTabMatch = pathname.match(/^\/dashboard\/projects\/([^/]+)\/tabs\/([^/]+)(?:\/|$)/);
  if (projectTabMatch) {
    const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectTabMatch[1]);
    if (!projectId) {
      return { projectId: null, tabId: null };
    }

    const tabId = await resolveTabIdFromParam(supabase, projectId, projectTabMatch[2]);
    return {
      projectId,
      tabId: tabId ?? null,
    };
  }

  const projectMatch = pathname.match(/^\/dashboard\/projects\/([^/]+)(?:\/|$)/);
  if (projectMatch) {
    const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectMatch[1]);
    return {
      projectId: projectId ?? null,
      tabId: null,
    };
  }

  const workflowMatch = pathname.match(/^\/dashboard\/workflow\/([^/]+)(?:\/|$)/);
  if (workflowMatch) {
    const workflowTabId = workflowMatch[1];
    const { data: tab } = await supabase
      .from("tabs")
      .select("id, project_id")
      .eq("id", workflowTabId)
      .maybeSingle();

    return {
      projectId: tab?.project_id ?? null,
      tabId: tab?.id ?? workflowTabId,
    };
  }

  return { projectId: null, tabId: null };
}
