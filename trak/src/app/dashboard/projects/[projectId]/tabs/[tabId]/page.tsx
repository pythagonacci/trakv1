import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { getTabBlocks } from "@/app/actions/block";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import ProjectHeader from "../../project-header";
import TabBar from "../../tab-bar";
import TabCanvasWrapper from "./tab-canvas-wrapper";
import SubtabSidebarWrapper from "./subtab-sidebar-wrapper";

// 🔒 Force dynamic - user-specific data shouldn't be cached across users
export const dynamic = "force-dynamic";

export default async function TabPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; tabId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();

  // Await params in Next.js 15
  const { projectId, tabId } = await params;
  const searchParamsData = await searchParams;
  const taskId = typeof searchParamsData.taskId === 'string' ? searchParamsData.taskId : null;

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
      .select(`id, name, status, client_page_enabled, public_token, client:clients(id, name, company)`)
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

  // Determine if we should show subtab sidebar
  let sidebarConfig: { parentTabId: string; parentTabName: string; subtabs: any[] } | null = null;
  
  // Check if current tab is a child
  for (const parentTab of hierarchicalTabs) {
    if (parentTab.children && parentTab.children.length > 0) {
      const isChild = parentTab.children.some((child) => child.id === tabId);
      if (isChild) {
        // Current tab is a child, show parent + all siblings
        sidebarConfig = {
          parentTabId: parentTab.id,
          parentTabName: parentTab.name,
          subtabs: parentTab.children,
        };
        break;
      }
      // Check if current tab is the parent with children
      if (parentTab.id === tabId) {
        sidebarConfig = {
          parentTabId: parentTab.id,
          parentTabName: parentTab.name,
          subtabs: parentTab.children,
        };
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Project Header - Minimal, elegant */}
        <div className="pt-4 pb-2">
          <ProjectHeader project={project} tabId={tabId} />
        </div>

        {/* Tab Navigation - Sticky */}
        <div className="sticky top-0 z-40 bg-transparent backdrop-blur-sm">
          <TabBar 
            tabs={hierarchicalTabs} 
            projectId={projectId}
            isClientProject={!!project.client}
            clientPageEnabled={project.client_page_enabled || false}
          />
        </div>

        {/* Canvas Content with Subtab Navigation */}
        <div className="py-3 md:py-4 lg:py-5">
          <SubtabSidebarWrapper
            sidebarConfig={sidebarConfig}
            projectId={projectId}
          >
            <TabCanvasWrapper 
              tabId={tabId}
              projectId={projectId}
              workspaceId={workspaceId}
              blocks={blocks}
              scrollToTaskId={taskId}
            />
          </SubtabSidebarWrapper>
        </div>
      </div>
    </div>
  );
}
