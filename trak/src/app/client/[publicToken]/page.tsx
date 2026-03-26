import { notFound } from "next/navigation";
import { getProjectByPublicToken } from "@/app/actions/client-page";
import { getTabBlocksPublic } from "@/app/actions/block";
import type { Block } from "@/app/actions/block";
import { getBatchFileUrlsPublic } from "@/app/actions/file";
import ClientPageHeader from "./client-page-header";
import ClientPageTabBar from "./client-page-tab-bar";
import ClientPageContent from "./client-page-content";
import ClientPageBanner from "./client-page-banner";
import ClientPageTracker from "./client-page-tracker";
import AutoRefresh from "./auto-refresh";
import type { EntityProperties } from "@/types/properties";

// Public page - no auth required
export const dynamic = "force-dynamic";

interface PublicBlockPayload {
  blocks: Block[];
  blockPropertiesById: Record<string, EntityProperties>;
}

interface PublicGalleryItem {
  fileId?: string;
}

interface PublicAttachedFile {
  id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  created_at: string | null;
}

interface PublicFileAttachment {
  id: string;
  block_id: string;
  display_mode: string | null;
  file: PublicAttachedFile | PublicAttachedFile[] | null;
}

interface PublicInitialFileAttachment {
  id: string;
  display_mode: string;
  file: {
    id: string;
    file_name: string;
    file_size: number;
    file_type: string;
    storage_path: string;
    created_at: string;
  };
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;

  // Get project and tabs by public token (no auth)
  const result = await getProjectByPublicToken(publicToken);

  if (result.error || !result.data) {
    console.error('Client page error:', result.error);
    notFound();
  }

  const { project, tabs } = result.data;
  
  // If no visible tabs, show message
  if (tabs.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            No Content Available
          </h1>
          <p className="text-[var(--muted-foreground)]">
            This project has no public tabs to display.
          </p>
        </div>
      </div>
    );
  }

  // Get the first tab as default
  const firstTab = tabs[0];

  // Fetch blocks for first tab (public access - no auth required)
  const blocksResult = await getTabBlocksPublic(firstTab.id, publicToken);

  if (blocksResult.error) {
    console.error('Failed to fetch blocks:', blocksResult.error);
    notFound();
  }

  const blocksPayload = blocksResult.data as
    | Block[]
    | PublicBlockPayload
    | undefined;
  const blocks = Array.isArray(blocksPayload) ? blocksPayload : blocksPayload?.blocks || [];
  const blockPropertiesById = Array.isArray(blocksPayload)
    ? {}
    : blocksPayload?.blockPropertiesById || {};

  // Extract all file IDs from all blocks for prefetching
  const fileIds: string[] = [];
  const initialFilesByBlockId: Record<string, PublicInitialFileAttachment[]> = {};

  blocks.forEach(block => {
    // Image blocks
    if (block.type === 'image' && block.content?.fileId) {
      fileIds.push(block.content.fileId as string);
    }

    // Gallery blocks
    if (block.type === 'gallery' && Array.isArray(block.content?.items)) {
      block.content.items.forEach((item: PublicGalleryItem) => {
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
      (fileAttachments as PublicFileAttachment[]).forEach((attachment) => {
        if (!initialFilesByBlockId[attachment.block_id]) {
          initialFilesByBlockId[attachment.block_id] = [];
        }
        const file = Array.isArray(attachment.file) ? attachment.file[0] : attachment.file;
        if (file) {
          initialFilesByBlockId[attachment.block_id].push({
            id: attachment.id,
            display_mode: attachment.display_mode ?? "list",
            file: {
              id: file.id,
              file_name: file.file_name,
              file_size: file.file_size ?? 0,
              file_type: file.file_type ?? "",
              storage_path: file.storage_path,
              created_at: file.created_at ?? "",
            },
          });
        }

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
    <div className="min-h-screen bg-transparent">
      <ClientPageBanner />
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        {/* Project Header - Minimal, elegant */}
        <div className="pt-4 pb-2">
          <ClientPageHeader project={project} tabId={firstTab.id} />
        </div>

        {/* Tab Navigation - Sticky */}
        <div className="sticky top-0 z-40 bg-transparent backdrop-blur-sm">
          <ClientPageTabBar
            tabs={tabs}
            publicToken={publicToken}
            activeTabId={firstTab.id}
          />
        </div>

        {/* Canvas Content */}
        <div className="py-3 md:py-4 lg:py-5">
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

      {/* Hidden analytics tracker - doesn't affect layout */}
      <ClientPageTracker publicToken={publicToken} tabId={firstTab.id} />
      <AutoRefresh />
    </div>
  );
}
