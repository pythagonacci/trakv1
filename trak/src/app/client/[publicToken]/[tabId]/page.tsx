import { notFound } from "next/navigation";
import { getProjectByPublicToken } from "@/app/actions/client-page";
import { getTabBlocksPublic } from "@/app/actions/block";
import type { Block } from "@/app/actions/block";
import { getBatchFileUrlsPublic } from "@/app/actions/file";
import ClientPageHeader from "../client-page-header";
import ClientPageTabBar from "../client-page-tab-bar";
import ClientPageContent from "../client-page-content";
import ClientPageBanner from "../client-page-banner";
import ClientPageTracker from "../client-page-tracker";
import AutoRefresh from "../auto-refresh";

// Public page - no auth required
export const dynamic = "force-dynamic";

export default async function ClientTabPage({
  params,
}: {
  params: Promise<{ publicToken: string; tabId: string }>;
}) {
  const { publicToken, tabId } = await params;

  // Get project and tabs by public token (no auth)
  const result = await getProjectByPublicToken(publicToken);

  if (result.error || !result.data) {
    notFound();
  }

  const { project, tabs } = result.data;

  // Verify the tab exists and is visible
  const currentTab = tabs.find((t) => t.id === tabId);
  if (!currentTab) {
    notFound();
  }

  // Fetch blocks for this tab (public access - no auth required)
  const blocksResult = await getTabBlocksPublic(tabId, publicToken);

  if (blocksResult.error) {
    console.error('Failed to fetch blocks:', blocksResult.error);
    notFound();
  }

  const blocksPayload = blocksResult.data as
    | Block[]
    | { blocks: Block[]; blockPropertiesById: Record<string, any> }
    | undefined;
  const blocks = Array.isArray(blocksPayload) ? blocksPayload : blocksPayload?.blocks || [];
  const blockPropertiesById = Array.isArray(blocksPayload)
    ? {}
    : (blocksPayload?.blockPropertiesById as Record<string, any>) || {};

  // Extract all file IDs from all blocks for prefetching
  const fileIds: string[] = [];
  const initialFilesByBlockId: Record<string, any[]> = {};

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
    const { createServiceClient } = await import("@/lib/supabase/service");
    const serviceSupabase = await createServiceClient();
    
    const { data: fileAttachments } = await serviceSupabase
      .from('file_attachments')
      .select(`
        id,
        block_id,
        display_mode,
        file:files(
          id,
          file_name,
          file_size,
          file_type,
          storage_path,
          created_at
        )
      `)
      .in('block_id', fileBlockIds);

    if (fileAttachments) {
      fileAttachments.forEach((attachment: any) => {
        if (!initialFilesByBlockId[attachment.block_id]) {
          initialFilesByBlockId[attachment.block_id] = [];
        }
        initialFilesByBlockId[attachment.block_id].push({
          id: attachment.id,
          display_mode: attachment.display_mode,
          file: Array.isArray(attachment.file) ? attachment.file[0] : attachment.file,
        });

        const file = Array.isArray(attachment.file) ? attachment.file[0] : attachment.file;
        if (file?.id) {
          fileIds.push(file.id);
        }
      });
    }
  }

  fileBlockIds.forEach((blockId) => {
    if (!initialFilesByBlockId[blockId]) {
      initialFilesByBlockId[blockId] = [];
    }
  });

  // Batch fetch all file URLs in ONE call (public access)
  const fileUrlsResult = fileIds.length > 0 
    ? await getBatchFileUrlsPublic(fileIds, publicToken)
    : { data: {} };

  const initialFileUrls = fileUrlsResult.data || {};

  console.log(`🎯 Public: Prefetched ${Object.keys(initialFileUrls).length} file URLs for ${blocks.length} blocks`);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Client-side analytics tracker */}
      <ClientPageTracker publicToken={publicToken} tabId={tabId} />

      {/* Auto-refresh every 30 seconds */}
      <AutoRefresh />

      {/* "My Saria" Banner (placeholder CTA) */}
      <ClientPageBanner />

      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Project Header */}
        <div className="pt-6 pb-4">
          <ClientPageHeader project={project} />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <ClientPageTabBar 
            tabs={tabs} 
            publicToken={publicToken}
            activeTabId={tabId}
          />
        </div>

        {/* Tab Content (Read-only) */}
        <div className="pb-8">
          <ClientPageContent
            blocks={blocks}
            publicToken={publicToken}
            allowComments={project.client_comments_enabled ?? false}
            allowEditing={project.client_editing_enabled ?? false}
            initialFileUrls={initialFileUrls}
            initialFilesByBlockId={initialFilesByBlockId}
            blockPropertiesById={blockPropertiesById}
          />
        </div>
      </div>
    </div>
  );
}
