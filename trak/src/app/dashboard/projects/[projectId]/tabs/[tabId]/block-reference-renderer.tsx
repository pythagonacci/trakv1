"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, ExternalLink } from "lucide-react";
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
  showReferenceBadge?: boolean;
  previewMode?: boolean;
}

export default function BlockReferenceRenderer({
  originalBlockId,
  workspaceId,
  projectId,
  tabId,
  onUpdate,
  showReferenceBadge = true,
  previewMode = false,
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

    const response = await fetch(`/api/blocks/single?blockId=${encodeURIComponent(originalBlockId)}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || result.error || !result.data) {
      setError("Could not load referenced block");
      setIsLoading(false);
      return;
    }

    setOriginalBlock(result.data);
    setIsLoading(false);
  };

  const renderBlock = useMemo(() => {
    if (!previewMode || !originalBlock) return originalBlock;
    const content = { ...((originalBlock.content || {}) as Record<string, unknown>) };
    // Prevent oversized fixed-height blocks from leaving mostly empty space in miniature previews.
    delete (content as any).heightPx;
    delete (content as any).previewHeightPx;
    return {
      ...originalBlock,
      content,
    };
  }, [originalBlock, previewMode]);

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
    if (!renderBlock?.tab?.project_id || !renderBlock?.tab_id) {
      return;
    }
    
    // Navigate to the original block's location using the ORIGINAL project ID
    const originalProjectId = renderBlock.tab.project_id;
    const projectType = renderBlock.tab.project?.project_type;
    
    // Determine the correct base path (projects vs internal)
    const basePath = projectType === 'internal' ? '/dashboard/internal' : '/dashboard/projects';
    router.push(`${basePath}/${originalProjectId}/tabs/${renderBlock.tab_id}`);
  };

  const renderBlockContent = () => {
    switch (renderBlock.type) {
      case "text":
        return <TextBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "task":
        return <TaskBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} previewMode={previewMode} />;
      case "link":
        return <LinkBlock block={renderBlock} onUpdate={() => { loadOriginalBlock(); onUpdate?.(); }} />;
      case "table":
        return <TableBlock block={renderBlock} onUpdate={onUpdate} previewMode={previewMode} />;
      case "timeline":
        return <TimelineBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "file":
        return <FileBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "image":
        return <ImageBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "gallery":
        return <GalleryBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "video":
        return <VideoBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "embed":
        return <EmbedBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "pdf":
        return <PdfBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} onUpdate={onUpdate} />;
      case "chart":
        return <ChartBlock block={renderBlock} />;
      case "section":
        return tabId ? (
          <SectionBlock block={renderBlock} workspaceId={workspaceId} projectId={projectId} tabId={tabId} onUpdate={onUpdate} />
        ) : (
          <div className="p-5 text-sm text-neutral-500">Section requires tabId</div>
        );
      case "shopify_product":
        return <ShopifyProductBlock block={renderBlock} onUpdate={onUpdate} />;
      default:
        return (
          <div className="p-5 text-sm text-neutral-500">
            Unknown block type: {renderBlock.type}
          </div>
        );
    }
  };

  return (
    <div className="relative">
      {showReferenceBadge && (
        <div className="absolute -top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 shadow-sm">
          <Link className="h-3 w-3" />
          <span>Referenced {renderBlock.template_name ? `"${renderBlock.template_name}"` : "Block"}</span>
          <button
            onClick={handleNavigateToOriginal}
            className="ml-0.5 hover:text-blue-900 transition-colors"
            title="Go to original"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Referenced Content */}
      <div className="pointer-events-none opacity-90">
        {renderBlockContent()}
      </div>
      
      {/* Overlay to prevent editing */}
      <div className="absolute inset-0 cursor-not-allowed" title="This is a referenced block. Changes must be made to the original." />
    </div>
  );
}
