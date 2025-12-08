"use client";

import { type ClientTabBlock, type ClientTabBlockType } from "@/app/actions/client-tab-block";
import dynamic from "next/dynamic";
import BlockWrapper from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/block-wrapper";
import LazyBlockWrapper from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/lazy-block-wrapper";

// Lightweight components - static import (always used)
import TextBlock from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/text-block";
import LinkBlock from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/link-block";
import DividerBlock from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/divider-block";

// Loading placeholder for dynamically imported blocks
function BlockLoadingState() {
  return (
    <div className="p-5 flex items-center justify-center">
      <div className="flex items-center gap-2 text-neutral-400">
        <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

// Heavy components - dynamic import (load on demand)
const TaskBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/task-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const TimelineBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/timeline-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const TableBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/table-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const FileBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/file-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const VideoBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/video-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const ImageBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/image-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const EmbedBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/embed-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const PdfBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/pdf-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const SectionBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/section-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const DocReferenceBlock = dynamic(() => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/blocks/doc-reference-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

interface ClientTabBlockRendererProps {
  block: ClientTabBlock;
  workspaceId: string;
  clientId: string;
  tabId?: string;
  onUpdate?: (updatedBlock?: ClientTabBlock) => void;
  onDelete?: (blockId: string) => void;
  onConvert?: (blockId: string, newType: ClientTabBlockType) => void;
  onOpenDoc?: (docId: string) => void;
  isDragging?: boolean;
  scrollToTaskId?: string | null;
}

export default function ClientTabBlockRenderer({ 
  block, 
  workspaceId, 
  clientId, 
  tabId, 
  onUpdate, 
  onDelete, 
  onConvert, 
  onOpenDoc, 
  isDragging, 
  scrollToTaskId 
}: ClientTabBlockRendererProps) {
  // Convert ClientTabBlock to Block format for compatibility with existing block components
  const blockForComponents = {
    ...block,
    parent_block_id: null, // Client tabs don't support nested blocks yet
    is_template: false,
    template_name: null,
    original_block_id: null,
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "text":
        return <TextBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} onUpdate={() => onUpdate?.()} />;
      case "task":
        return <TaskBlock block={blockForComponents} workspaceId={workspaceId} onUpdate={(b) => onUpdate?.(b as any)} scrollToTaskId={scrollToTaskId} />;
      case "link":
        return <LinkBlock block={blockForComponents} />;
      case "divider":
        return <DividerBlock block={blockForComponents} />;
      case "table":
        return <TableBlock block={blockForComponents} onUpdate={(b) => onUpdate?.(b as any)} />;
      case "timeline":
        return <TimelineBlock block={blockForComponents} workspaceId={workspaceId} onUpdate={(b) => onUpdate?.(b as any)} />;
      case "file":
        return <FileBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} onUpdate={() => onUpdate?.()} />;
      case "image":
        return <ImageBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} onUpdate={() => onUpdate?.()} />;
      case "video":
        return <VideoBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} onUpdate={() => onUpdate?.()} />;
      case "embed":
        return <EmbedBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} onUpdate={() => onUpdate?.()} />;
      case "pdf":
        return <PdfBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} onUpdate={() => onUpdate?.()} />;
      case "section":
        return tabId ? (
          <SectionBlock block={blockForComponents} workspaceId={workspaceId} projectId={clientId} tabId={tabId} onUpdate={() => onUpdate?.()} />
        ) : (
          <div className="p-5 text-sm text-neutral-500">Section requires tabId</div>
        );
      case "doc_reference":
        return <DocReferenceBlock block={blockForComponents} onDelete={() => onDelete?.(block.id)} onOpenDoc={onOpenDoc} />;
      default:
        return (
          <div className="p-5 text-sm text-neutral-500">
            Unknown block type: {block.type}
          </div>
        );
    }
  };

  return (
    <LazyBlockWrapper blockId={block.id}>
      <BlockWrapper 
        block={blockForComponents} 
        workspaceId={workspaceId}
        projectId={clientId}
        onDelete={onDelete} 
        onConvert={onConvert as any} 
        onUpdate={onUpdate as any}
        isDragging={isDragging}
      >
        {renderBlockContent()}
      </BlockWrapper>
    </LazyBlockWrapper>
  );
}
