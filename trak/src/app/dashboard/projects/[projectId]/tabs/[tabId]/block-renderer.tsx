"use client";

import { type Block } from "@/app/actions/block";
import BlockWrapper from "./block-wrapper";
import TextBlock from "./text-block";
import TaskBlock from "./task-block";
import LinkBlock from "./link-block";
import DividerBlock from "./divider-block";
import TableBlock from "./table-block";
import TimelineBlock from "./timeline-block";
import FileBlock from "./file-block";
import VideoBlock from "./video-block";
import ImageBlock from "./image-block";
import EmbedBlock from "./embed-block";

interface BlockRendererProps {
  block: Block;
  workspaceId: string;
  projectId: string;
  onUpdate?: () => void;
  onDelete?: (blockId: string) => void;
  onConvert?: (blockId: string, newType: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "image" | "video" | "embed") => void;
  isDragging?: boolean;
}

export default function BlockRenderer({ block, workspaceId, projectId, onUpdate, onDelete, onConvert, isDragging }: BlockRendererProps) {
  const renderBlockContent = () => {
    switch (block.type) {
      case "text":
        return <TextBlock block={block} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "task":
        return <TaskBlock block={block} workspaceId={workspaceId} onUpdate={onUpdate} />; // NEW: Pass workspaceId
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
      default:
        return (
          <div className="p-5 text-sm text-neutral-500">
            Unknown block type: {block.type}
          </div>
        );
    }
  };

  return (
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
  );
}