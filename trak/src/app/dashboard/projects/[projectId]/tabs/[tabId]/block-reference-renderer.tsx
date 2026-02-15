"use client";

import { useEffect, useState } from "react";
import { Link, ExternalLink } from "lucide-react";
import { getSingleBlock } from "@/app/actions/block-templates";
import { type Block } from "@/app/actions/block";
import TextBlock from "./text-block";
import TaskBlock from "./task-block";
import LinkBlock from "./link-block";
import TableBlock from "./table-block";
import TimelineBlock from "./timeline-block";
import FileBlock from "./file-block";
import VideoBlock from "./video-block";
import ImageBlock from "./image-block";
import GalleryBlock from "./gallery-block";
import EmbedBlock from "./embed-block";
import PdfBlock from "./pdf-block";
import SectionBlock from "./section-block";
import ChartBlock from "@/components/blocks/ChartBlock";
import ShopifyProductBlock from "./shopify-product-block";
import { useRouter } from "next/navigation";

interface BlockReferenceRendererProps {
  originalBlockId: string;
  workspaceId: string;
  projectId: string;
  tabId?: string;
  onUpdate?: () => void;
}

export default function BlockReferenceRenderer({
  originalBlockId,
  workspaceId,
  projectId,
  tabId,
  onUpdate,
}: BlockReferenceRendererProps) {
  const router = useRouter();
  const [originalBlock, setOriginalBlock] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOriginalBlock();
  }, [originalBlockId]);

  const loadOriginalBlock = async () => {
    setIsLoading(true);
    setError(null);

    const result = await getSingleBlock(originalBlockId);

    if (result.error || !result.data) {
      setError("Could not load referenced block");
      setIsLoading(false);
      return;
    }

    setOriginalBlock(result.data);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 border border-dashed border-[var(--border)] rounded-lg">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <div className="h-4 w-4 border-2 border-[var(--border)] border-t-[var(--foreground)] rounded-full animate-spin" />
          Loading referenced block...
        </div>
      </div>
    );
  }

  if (error || !originalBlock) {
    return (
      <div className="p-4 border border-dashed border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <Link className="h-4 w-4" />
          {error || "Referenced block not found"}
        </div>
      </div>
    );
  }

  const handleNavigateToOriginal = () => {
    if (!originalBlock?.tab?.project_id || !originalBlock?.tab_id) {
      return;
    }
    
    // Navigate to the original block's location using the ORIGINAL project ID
    const originalProjectId = originalBlock.tab.project_id;
    const projectType = originalBlock.tab.project?.project_type;
    
    // Determine the correct base path (projects vs internal)
    const basePath = projectType === 'internal' ? '/dashboard/internal' : '/dashboard/projects';
    router.push(`${basePath}/${originalProjectId}/tabs/${originalBlock.tab_id}`);
  };

  const renderBlockContent = () => {
    switch (originalBlock.type) {
      case "text":
        return <TextBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "task":
        return <TaskBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "link":
        return <LinkBlock block={originalBlock} onUpdate={() => { loadOriginalBlock(); onUpdate?.(); }} />;
      case "table":
        return <TableBlock block={originalBlock} onUpdate={onUpdate} />;
      case "timeline":
        return <TimelineBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "file":
        return <FileBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "image":
        return <ImageBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "gallery":
        return <GalleryBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "video":
        return <VideoBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "embed":
        return <EmbedBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "pdf":
        return <PdfBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "chart":
        return <ChartBlock block={originalBlock} />;
      case "section":
        return tabId ? (
          <SectionBlock block={originalBlock} workspaceId={workspaceId} projectId={projectId} tabId={tabId} onUpdate={onUpdate} />
        ) : (
          <div className="p-5 text-sm text-neutral-500">Section requires tabId</div>
        );
      case "shopify_product":
        return <ShopifyProductBlock block={originalBlock} onUpdate={onUpdate} />;
      default:
        return (
          <div className="p-5 text-sm text-neutral-500">
            Unknown block type: {originalBlock.type}
          </div>
        );
    }
  };

  return (
    <div className="relative">
      {/* Reference Badge */}
      <div className="absolute -top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 shadow-sm">
        <Link className="h-3 w-3" />
        <span>Referenced {originalBlock.template_name ? `"${originalBlock.template_name}"` : "Block"}</span>
        <button
          onClick={handleNavigateToOriginal}
          className="ml-0.5 hover:text-blue-900 transition-colors"
          title="Go to original"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Referenced Content */}
      <div className="pointer-events-none opacity-90">
        {renderBlockContent()}
      </div>
      
      {/* Overlay to prevent editing */}
      <div className="absolute inset-0 cursor-not-allowed" title="This is a referenced block. Changes must be made to the original." />
    </div>
  );
}
