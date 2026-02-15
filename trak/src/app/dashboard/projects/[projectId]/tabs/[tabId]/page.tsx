import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { getTabBlocks } from "@/app/actions/block";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getBatchFileUrls } from "@/app/actions/file";
import ProjectHeader from "../../project-header";
import TabBar from "../../tab-bar";
import TabCanvasWrapper from "./tab-canvas-wrapper";
import SubtabSidebarWrapper from "./subtab-sidebar-wrapper";
import WorkflowPageLayout from "@/app/dashboard/workflow/[workflowPageId]/workflow-page-layout";
import type { Block } from "@/app/actions/block";

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

  // 🚀 STEP 2: Parallel queries with individual error handling
  // getProjectTabs and getTabBlocks have their own auth checks (cached)
  const [
    projectResult,
    tabResult,
    tabsResult,
    blocksResult,
  ] = await Promise.allSettled([
    supabase
      .from("projects")
      .select(`id, name, status, due_date_date, due_date_text, client_page_enabled, client_comments_enabled, client_editing_enabled, public_token, client:clients(id, name, company)`)
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("tabs")
      .select("id, name, project_id, is_workflow_page")
      .eq("id", tabId)
      .eq("project_id", projectId)
      .single(),
    getProjectTabs(projectId),
    getTabBlocks(tabId),
  ]);

  // Extract results with error handling
  const projectData = projectResult.status === 'fulfilled' && !projectResult.value.error
    ? projectResult.value.data
    : null;

  const tabData = tabResult.status === 'fulfilled' && !tabResult.value.error
    ? tabResult.value.data
    : null;

  const tabsData = tabsResult.status === 'fulfilled'
    ? tabsResult.value.data || []
    : [];

  const blocksData = blocksResult.status === 'fulfilled'
    ? blocksResult.value.data || []
    : [];

  // Validate critical results - project and tab are required
  if (!projectData) {
    console.error("Failed to load project:", projectResult);
    notFound();
  }

  if (!tabData) {
    console.error("Failed to load tab:", tabResult);
    notFound();
  }

  // Handle Supabase foreign key quirk (client might be array)
  const rawProject = projectData;
  const project = {
    ...rawProject,
    client: Array.isArray(rawProject.client) ? rawProject.client[0] : rawProject.client,
  };

  const tab = tabData as { id: string; name: string; project_id: string; is_workflow_page?: boolean };
  const hierarchicalTabs = tabsData;
  const blocks = blocksData as Block[];
  const isWorkflowTab = Boolean(tab?.is_workflow_page);

  // Extract all file IDs from all blocks for prefetching
  const fileIds: string[] = [];

  // Extract file IDs from blocks that have fileId in content
  blocks.forEach(block => {
    // Image blocks
    if (block.type === 'image' && block.content?.fileId) {
      fileIds.push(block.content.fileId as string);
    }

    // Gallery blocks
    if (block.type === 'gallery' && Array.isArray(block.content?.items)) {
      block.content.items.forEach((item: any) => {
        if (item?.fileId) {
          fileIds.push(item.fileId as string);
        }
      });
    }
    
    // PDF blocks
    if (block.type === 'pdf' && block.content?.fileId) {
      fileIds.push(block.content.fileId as string);
    }
    
    // Video blocks
    if (block.type === 'video' && block.content?.fileId) {
      fileIds.push(block.content.fileId as string);
    }
  });

  // For file blocks, we need to fetch file attachments to get file IDs
  const fileBlockIds = blocks.filter(b => b.type === 'file').map(b => b.id);
  if (fileBlockIds.length > 0) {
    const { data: fileAttachments } = await supabase
      .from('file_attachments')
      .select('file:files(id)')
      .in('block_id', fileBlockIds);

    if (fileAttachments) {
      fileAttachments.forEach((attachment: any) => {
        const file = Array.isArray(attachment.file) ? attachment.file[0] : attachment.file;
        if (file?.id) {
          fileIds.push(file.id);
        }
      });
    }
  }

  // Batch fetch all file URLs in ONE call
  const fileUrlsResult = fileIds.length > 0 
    ? await getBatchFileUrls(fileIds)
    : { data: {} };

  const initialFileUrls = fileUrlsResult.data || {};

  console.log(`🎯 Prefetched ${Object.keys(initialFileUrls).length} file URLs for ${blocks.length} blocks`);

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
    <div className={isWorkflowTab ? "h-full flex flex-col min-h-0 bg-transparent" : "min-h-screen bg-transparent"}>
      <div className={isWorkflowTab ? "flex flex-col min-h-0 flex-1 w-full px-2 md:px-3 lg:px-4" : "w-full px-2 md:px-3 lg:px-4"}>
        {/* Project Header - Compact */}
        <div className="pt-2 pb-1 shrink-0">
          <ProjectHeader project={project} tabId={tabId} tabs={hierarchicalTabs} />
        </div>

        {/* Tab Navigation - Sticky */}
        <div className="sticky top-0 z-40 bg-transparent backdrop-blur-sm shrink-0">
          <TabBar 
            tabs={hierarchicalTabs} 
            projectId={projectId}
            isClientProject={!!project.client}
            clientPageEnabled={project.client_page_enabled || false}
          />
        </div>

        {/* Canvas Content with Subtab Navigation or Workflow Layout */}
        <div className={isWorkflowTab ? "flex flex-col min-h-0 flex-1" : "py-3 md:py-4 lg:py-5"}>
          {isWorkflowTab ? (
            <WorkflowPageLayout
              tabId={tabId}
              projectId={projectId}
              workspaceId={workspaceId}
              title={tab.name}
              blocks={blocks}
              initialFileUrls={initialFileUrls}
              inProjectContext
            />
          ) : (
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
                initialFileUrls={initialFileUrls}
              />
            </SubtabSidebarWrapper>
          )}
        </div>
      </div>
    </div>
  );
}
