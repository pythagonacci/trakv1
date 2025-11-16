import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { getTabBlocks } from "@/app/actions/block";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import ProjectHeader from "../../project-header";
import TabBar from "../../tab-bar";
import TabCanvas from "./tab-canvas";

// 🔒 Force dynamic - user-specific data shouldn't be cached across users
export const dynamic = "force-dynamic";

export default async function TabPage({
  params,
}: {
  params: Promise<{ projectId: string; tabId: string }>;
}) {
  const supabase = await createClient();

  // Await params in Next.js 15
  const { projectId, tabId } = await params;

  // 🔒 STEP 1: Auth & workspace verification FIRST (before any data fetch)
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/dashboard");
  }

  const authResult = await requireWorkspaceAccess(workspaceId);
  if ('error' in authResult) {
    redirect("/login");
  }

  // 🚀 STEP 2: Parallel queries (auth already verified, safe to fetch)
  // getProjectTabs and getTabBlocks have their own auth checks (cached)
  const [
    projectResult,
    tabResult,
    tabsResult,
    blocksResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(`id, name, status, client:clients(id, name, company)`)
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("tabs")
      .select("id, name, project_id")
      .eq("id", tabId)
      .eq("project_id", projectId)
      .single(),
    getProjectTabs(projectId),
    getTabBlocks(tabId),
  ]);

  // Validate results
  if (projectResult.error || !projectResult.data) {
    notFound();
  }

  if (tabResult.error || !tabResult.data) {
    notFound();
  }

  // Handle Supabase foreign key quirk (client might be array)
  const rawProject = projectResult.data;
  const project = {
    ...rawProject,
    client: Array.isArray(rawProject.client) ? rawProject.client[0] : rawProject.client,
  };
  
  const tab = tabResult.data;
  const hierarchicalTabs = tabsResult.data || [];
  const blocks = blocksResult.data || [];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Project Header - Minimal, elegant */}
        <div className="pt-4 pb-2">
          <ProjectHeader project={project} />
        </div>

        {/* Tab Navigation - Seamless */}
        <div>
          <TabBar tabs={hierarchicalTabs} projectId={projectId} />
        </div>

        {/* Canvas Content - Fluid, borderless */}
        <div className="py-3 md:py-4 lg:py-5">
          <TabCanvas 
            tabId={tabId} 
            projectId={projectId} 
            workspaceId={workspaceId} 
            blocks={blocks} 
          />
        </div>
      </div>
    </div>
  );
}
