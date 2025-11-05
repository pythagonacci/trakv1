import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { getTabBlocks } from "@/app/actions/block";
import ProjectHeader from "../../project-header";
import TabBar from "../../tab-bar";
import TabCanvas from "./tab-canvas";

export default async function TabPage({
  params,
}: {
  params: Promise<{ projectId: string; tabId: string }>;
}) {
  const supabase = await createClient();

  // Await params in Next.js 15
  const { projectId, tabId } = await params;

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Get workspace from cookie
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/dashboard");
  }

  // 3. Fetch project with client details
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      `
      *,
      client:clients(*)
    `
    )
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // 4. Verify tab exists and belongs to this project
  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, name, project_id")
    .eq("id", tabId)
    .eq("project_id", projectId)
    .single();

  if (tabError || !tab) {
    notFound();
  }

  // 5. Fetch hierarchical tabs for tab bar
  const tabsResult = await getProjectTabs(projectId);
  const hierarchicalTabs = tabsResult.data || [];

  // 6. Fetch blocks for this tab
  const blocksResult = await getTabBlocks(tabId);
  const blocks = blocksResult.data || [];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto">
        {/* Project Header - Minimal, elegant */}
        <ProjectHeader project={project} />

        {/* Tab Navigation - Seamless */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-100 dark:border-neutral-900">
          <TabBar tabs={hierarchicalTabs} projectId={projectId} />
        </div>

        {/* Canvas Content - Fluid, borderless */}
        <div className="px-16 py-12">
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
