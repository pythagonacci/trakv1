import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getSingleClient } from "@/app/actions/client";
import { getClientTabs } from "@/app/actions/client-tab";
import { getClientTabBlocks, getClientTabBlockFileUrls } from "@/app/actions/client-tab-block";
import ClientHeader from "../../client-header";
import ClientTabs from "../../client-tabs";
import ClientTabCanvasWrapper from "./client-tab-canvas-wrapper";

export const dynamic = "force-dynamic";

export default async function ClientTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string; tabId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { clientId, tabId } = await params;
  const searchParamsData = await searchParams;
  const taskId = typeof searchParamsData.taskId === 'string' ? searchParamsData.taskId : null;

  const workspaceId = await getCurrentWorkspaceId();

  if (!workspaceId) {
    redirect("/dashboard");
  }

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  // Get client details
  const clientResult = await getSingleClient(clientId);
  if (clientResult.error || !clientResult.data) {
    notFound();
  }

  const client = clientResult.data;

  // Verify client belongs to current workspace
  if (client.workspace_id !== workspaceId) {
    notFound();
  }

  // Get tab, tabs, and blocks in parallel
  const [tabResult, tabsResult, blocksResult] = await Promise.all([
    supabase
      .from("client_tabs")
      .select("id, name, client_id")
      .eq("id", tabId)
      .eq("client_id", clientId)
      .single(),
    getClientTabs(clientId),
    getClientTabBlocks(tabId),
  ]);

  if (tabResult.error || !tabResult.data) {
    notFound();
  }

  if (blocksResult.error) {
    notFound();
  }

  const tab = tabResult.data;
  const tabs = tabsResult.data || [];
  const blocks = blocksResult.data || [];

  // Extract all file IDs from all blocks for prefetching
  const fileIds: string[] = [];

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

  // For file blocks, fetch file attachments to get file IDs
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
    ? await getClientTabBlockFileUrls(fileIds, tabId)
    : { data: {} };

  const initialFileUrls = fileUrlsResult.data || {};

  console.log(`🎯 Client Tab: Prefetched ${Object.keys(initialFileUrls).length} file URLs for ${blocks.length} blocks`);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Client Header */}
        <div className="pt-4 pb-2">
          <ClientHeader client={client} />
        </div>

        {/* Client Tabs */}
        <div className="sticky top-0 z-40 bg-transparent backdrop-blur-sm">
          <ClientTabs
            clientId={clientId}
            tabs={tabs}
            activeTabId={tabId}
          />
        </div>

        {/* Tab Canvas Content */}
        <div className="py-3 md:py-4 lg:py-5">
          <ClientTabCanvasWrapper
            tabId={tabId}
            clientId={clientId}
            workspaceId={workspaceId}
            blocks={blocks}
            scrollToTaskId={taskId}
            initialFileUrls={initialFileUrls}
          />
        </div>
      </div>
    </div>
  );
}
