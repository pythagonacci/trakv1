import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { getTabBlocks } from "@/app/actions/block";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getBatchFileUrls } from "@/app/actions/file";
import { getEntitiesProperties } from "@/app/actions/entity-properties";
import TabPageLayout from "./tab-page-layout";
import TabCanvasWrapper from "./tab-canvas-wrapper";
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
  const renderId = Math.random().toString(36).slice(2, 10);

  // Await params in Next.js 15
  const { projectId, tabId } = await params;
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] TAB_PAGE_RENDER id=${renderId} projectId=${projectId} tabId=${tabId}`);
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

  const _tPage0 = process.env.PERF_DEBUG === '1' ? performance.now() : 0;

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
      .select(`id, name, status, due_date_date, due_date_text, priority, tags, client_page_enabled, client_comments_enabled, client_editing_enabled, public_token, client:clients(id, name, company)`)
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

  // Handle Supabase foreign key quirk (client might be array); ensure tags array
  const rawProject = projectData;
  const project = {
    ...rawProject,
    client: Array.isArray(rawProject.client) ? rawProject.client[0] : rawProject.client,
    tags: rawProject.tags ?? [],
  };

  const tab = tabData as { id: string; name: string; project_id: string; is_workflow_page?: boolean };
  const hierarchicalTabs = tabsData;
  const blocks = blocksData as Block[];
  const isWorkflowTab = Boolean(tab?.is_workflow_page);

  const blockIds = blocks.map((block) => String(block.id));
  const blockPropertiesResult =
    blockIds.length > 0
      ? await getEntitiesProperties("block", blockIds, workspaceId)
      : { data: {} };
  const blockPropertiesById =
    "data" in blockPropertiesResult ? blockPropertiesResult.data : {};

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

  if (process.env.PERF_DEBUG === '1') {
    console.log(`[PERF] page.tsx allSettled ms=${Math.round(performance.now() - _tPage0)} blocks=${blocks.length} projectId=${projectId} tabId=${tabId}`);
  }

  // 🚀 PHASE 1c: Run file_attachments + getBatchFileUrls concurrently (not serially)
  // file_attachments fetches IDs for "file" type blocks (stored in join table, not content)
  // These two are now parallel with each other instead of sequential
  const _tFilePrefetch = process.env.PERF_DEBUG === '1' ? performance.now() : 0;

  const fileBlockIds = blocks.filter(b => b.type === 'file').map(b => b.id);

  // Fetch file attachment IDs (for file blocks) concurrently with signing inline fileIds
  const [fileAttachmentsResult, inlineFileUrlsResult] = await Promise.all([
    // Leg A: fetch attachment IDs for 'file' type blocks (join table)
    fileBlockIds.length > 0
      ? supabase
          .from('file_attachments')
          .select('file:files(id)')
          .in('block_id', fileBlockIds)
      : Promise.resolve({ data: null }),
    // Leg B: sign URLs for inline file IDs already extracted from block content (image/gallery/pdf/video)
    fileIds.length > 0
      ? getBatchFileUrls(fileIds)
      : Promise.resolve({ data: {} as Record<string, string> }),
  ]);

  // Collect any additional file IDs from file_attachments result
  const attachmentFileIds: string[] = [];
  if (fileAttachmentsResult.data) {
    fileAttachmentsResult.data.forEach((attachment: any) => {
      const file = Array.isArray(attachment.file) ? attachment.file[0] : attachment.file;
      if (file?.id) {
        attachmentFileIds.push(file.id);
      }
    });
  }

  // Sign URLs for attachment-sourced file IDs (second parallel batch if needed)
  const attachmentFileUrlsResult = attachmentFileIds.length > 0
    ? await getBatchFileUrls(attachmentFileIds)
    : { data: {} as Record<string, string> };

  // Merge both URL maps
  const initialFileUrls: Record<string, string> = {
    ...(inlineFileUrlsResult.data || {}),
    ...(attachmentFileUrlsResult.data || {}),
  };

  if (process.env.PERF_DEBUG === '1') {
    const blockPayloadBytes = Buffer.byteLength(JSON.stringify(blocks), 'utf8');
    const fileUrlBytes = Buffer.byteLength(JSON.stringify(initialFileUrls), 'utf8');
    console.log(`[PERF] page.tsx filePrefetch ms=${Math.round(performance.now() - _tFilePrefetch)} inlineIds=${fileIds.length} attachmentIds=${attachmentFileIds.length} urlsResolved=${Object.keys(initialFileUrls).length}`);
    console.log(`[PERF] page.tsx TOTAL ms=${Math.round(performance.now() - _tPage0)} blockPayloadBytes=${blockPayloadBytes} fileUrlBytes=${fileUrlBytes}`);
    blocks.forEach(b => {
      const contentBytes = Buffer.byteLength(JSON.stringify(b.content ?? {}), 'utf8');
      if (contentBytes > 5000) {
        console.log(`[PERF] heavy block type=${b.type} id=${b.id} contentBytes=${contentBytes}`);
      }
    });
  } else {
    console.log(`🎯 Prefetched ${Object.keys(initialFileUrls).length} file URLs for ${blocks.length} blocks`);
  }

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
    <TabPageLayout
      project={project}
      tabId={tabId}
      tabs={hierarchicalTabs}
      isWorkflowTab={isWorkflowTab}
      blocks={isWorkflowTab ? [] : blocks}
      workspaceId={workspaceId}
      subtabConfig={sidebarConfig}
    >
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
        <TabCanvasWrapper
          tabId={tabId}
          projectId={projectId}
          workspaceId={workspaceId}
          blocks={blocks}
          initialBlockPropertiesById={blockPropertiesById}
          scrollToTaskId={taskId}
          initialFileUrls={initialFileUrls}
        />
      )}
    </TabPageLayout>
  );
}
