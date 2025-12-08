"use client";

import { type Block } from "@/app/actions/block";
import dynamic from "next/dynamic";
import BlockWrapper from "./block-wrapper";
import LazyBlockWrapper from "./lazy-block-wrapper";

// Lightweight components - static import (always used)
import TextBlock from "./text-block";
import LinkBlock from "./link-block";
import DividerBlock from "./divider-block";

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
const TaskBlock = dynamic(() => import("./task-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const TimelineBlock = dynamic(() => import("./timeline-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const TableBlock = dynamic(() => import("./table-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const FileBlock = dynamic(() => import("./file-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const VideoBlock = dynamic(() => import("./video-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const ImageBlock = dynamic(() => import("./image-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const EmbedBlock = dynamic(() => import("./embed-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const PdfBlock = dynamic(() => import("./pdf-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const SectionBlock = dynamic(() => import("./section-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const DocReferenceBlock = dynamic(() => import("./blocks/doc-reference-block"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

const BlockReferenceRenderer = dynamic(() => import("./block-reference-renderer"), {
  loading: () => <BlockLoadingState />,
  ssr: true,
});

interface BlockRendererProps {
  block: Block;
  workspaceId: string;
  projectId: string;
  tabId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
  onDelete?: (blockId: string) => void;
  onConvert?: (blockId: string, newType: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "image" | "video" | "embed" | "pdf" | "section" | "doc_reference") => void;
  onOpenDoc?: (docId: string) => void;
  isDragging?: boolean;
  scrollToTaskId?: string | null;
}

export default function BlockRenderer({ block, workspaceId, projectId, tabId, onUpdate, onDelete, onConvert, onOpenDoc, isDragging, scrollToTaskId }: BlockRendererProps) {
  // If this block is a reference to another block, render the reference component
  if (block.original_block_id) {
    return (
      <LazyBlockWrapper blockId={block.id}>
        <BlockWrapper 
          block={block} 
          workspaceId={workspaceId}
          projectId={projectId}
          onDelete={onDelete} 
          onConvert={onConvert} 
          onUpdate={onUpdate}
          isDragging={isDragging}
        >
          <BlockReferenceRenderer
            originalBlockId={block.original_block_id}
            workspaceId={workspaceId}
            projectId={projectId}
            tabId={tabId}
            onUpdate={onUpdate}
          />
        </BlockWrapper>
      </LazyBlockWrapper>
    );
  }

  const renderBlockContent = () => {
    switch (block.type) {
      case "text":
        return <TextBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "task":
        return <TaskBlock block={block} workspaceId={workspaceId} onUpdate={onUpdate} scrollToTaskId={scrollToTaskId} />;
      case "link":
        return <LinkBlock block={block} />;
      case "divider":
        return <DividerBlock block={block} />;
      case "table":
        return <TableBlock block={block} onUpdate={onUpdate} />;
      case "timeline":
        return <TimelineBlock block={block} workspaceId={workspaceId} onUpdate={onUpdate} />;
      case "file":
        return <FileBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "image":
        return <ImageBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "video":
        return <VideoBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "embed":
        return <EmbedBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "pdf":
        return <PdfBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "section":
        return tabId ? (
          <SectionBlock block={block} workspaceId={workspaceId} projectId={projectId} tabId={tabId} onUpdate={onUpdate} />
        ) : (
          <div className="p-5 text-sm text-neutral-500">Section requires tabId</div>
        );
      case "doc_reference":
        return <DocReferenceBlock block={block} onDelete={() => onDelete?.(block.id)} onOpenDoc={onOpenDoc} />;
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
        block={block} 
        workspaceId={workspaceId}
        projectId={projectId}
        onDelete={onDelete} 
        onConvert={onConvert} 
        onUpdate={onUpdate}
        isDragging={isDragging}
      >
        {renderBlockContent()}
      </BlockWrapper>
    </LazyBlockWrapper>
  );
}