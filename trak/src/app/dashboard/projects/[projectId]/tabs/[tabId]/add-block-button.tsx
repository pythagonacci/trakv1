"use client";

import { useState } from "react";
import { Plus, FileText, CheckSquare, Link2, Minus, Table, Calendar, Upload, Video, Maximize2, Image, Images, Layout, Copy, AlertCircle } from "lucide-react";
import { createBlock, type Block, type BlockType } from "@/app/actions/block";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import DocSelectorDialog from "./doc-selector-dialog";
import BlockReferenceSelector from "./block-reference-selector";

interface AddBlockButtonProps {
  tabId: string;
  projectId: string;
  variant?: "default" | "large";
  parentBlockId?: string | null;
  onBlockCreated?: (block: any) => void;
  onBlockResolved?: (tempId: string, savedBlock: Block) => void;
  onBlockError?: (tempId: string) => void;
  getNextPosition?: () => number;
}

interface OptimisticBlockState {
  id: string;
  status: 'creating' | 'failed';
  error?: string;
  retry?: () => void;
}

const blockTypes: Array<{ type: BlockType; label: string; icon: React.ReactNode; description: string }> = [
  {
    type: "text",
    label: "Text",
    icon: <FileText className="w-4 h-4" />,
    description: "Rich text content with formatting",
  },
  {
    type: "task",
    label: "Tasks",
    icon: <CheckSquare className="w-4 h-4" />,
    description: "Task list with checkboxes",
  },
  {
    type: "link",
    label: "Link",
    icon: <Link2 className="w-4 h-4" />,
    description: "External link with preview",
  },
  {
    type: "divider",
    label: "Divider",
    icon: <Minus className="w-4 h-4" />,
    description: "Horizontal divider line",
  },
  {
    type: "table",
    label: "Table",
    icon: <Table className="w-4 h-4" />,
    description: "Editable table with rows and columns",
  },
  {
    type: "timeline",
    label: "Timeline",
    icon: <Calendar className="w-4 h-4" />,
    description: "Timeline for project milestones and events",
  },
  {
    type: "file",
    label: "File",
    icon: <Upload className="w-4 h-4" />,
    description: "Upload and manage files",
  },
  {
    type: "video",
    label: "Video",
    icon: <Video className="w-4 h-4" />,
    description: "Upload and play MP4 videos",
  },
  {
    type: "image",
    label: "Image",
    icon: <Image className="w-4 h-4" />,
    description: "Upload and display images with captions",
  },
  {
    type: "gallery",
    label: "Gallery",
    icon: <Images className="w-4 h-4" />,
    description: "Grid of images with a scrollable layout",
  },
  {
    type: "embed",
    label: "Embed",
    icon: <Maximize2 className="w-4 h-4" />,
    description: "Embed external content (YouTube, Figma, etc.)",
  },
  {
    type: "section",
    label: "Section",
    icon: <Layout className="w-4 h-4" />,
    description: "Scrollable container for grouping blocks",
  },
  {
    type: "doc_reference",
    label: "Document",
    icon: <FileText className="w-4 h-4" />,
    description: "Link to an existing document",
  },
];

export default function AddBlockButton({ tabId, projectId, variant = "default", parentBlockId, onBlockCreated, onBlockResolved, onBlockError, getNextPosition }: AddBlockButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [docSelectorOpen, setDocSelectorOpen] = useState(false);
  const [blockReferenceSelectorOpen, setBlockReferenceSelectorOpen] = useState(false);
  const [failedBlocks, setFailedBlocks] = useState<Map<string, OptimisticBlockState>>(new Map());

  const handleCreateBlock = async (type: BlockType) => {
    // Special handling for doc_reference - open doc selector instead
    if (type === "doc_reference") {
      setDocSelectorOpen(true);
      return;
    }

    setIsCreating(true);

    const nextPosition = getNextPosition?.() ?? 0;

    // Create optimistic block IMMEDIATELY (before server call)
    const optimisticBlockId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticBlock = {
      id: optimisticBlockId, // Temporary ID
      tab_id: tabId,
      parent_block_id: parentBlockId || null,
      type: type,
      content: getDefaultContent(type),
      position: nextPosition, // Aim for next row
      column: 0,
      is_template: false,
      template_name: null,
      original_block_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Show block INSTANTLY
    if (onBlockCreated) {
      onBlockCreated(optimisticBlock);
    }
    
    setIsCreating(false);

    // Now make server call in background
    try {
      const result = await createBlock({
        tabId,
        type,
        position: nextPosition,
        parentBlockId: parentBlockId || null,
      });

      if (result.error) {
        console.error("Failed to create block:", result.error);
        // Mark block as failed instead of removing it immediately
        setFailedBlocks(prev => new Map(prev.set(optimisticBlockId, {
          id: optimisticBlockId,
          status: 'failed',
          error: result.error,
          retry: () => handleCreateBlock(type)
        })));
        // Call error callback to allow parent to handle UI state
        onBlockError?.(optimisticBlockId);
        return;
      }

      if (result.data) {
        onBlockResolved?.(optimisticBlockId, result.data);
      }
    } catch (error) {
      console.error("Create block exception:", error);
      // Remove optimistic block on error using callback
      if (onBlockError) {
        onBlockError(optimisticBlockId);
      } else {
        // Fallback to router refresh if callback not available
        router.refresh();
      }
    }
  };

  // Helper to get default content for each block type
  const getDefaultContent = (type: BlockType) => {
    switch (type) {
      case "text": return { text: "" };
      case "task": return { title: "New Task List", hideIcons: false, viewMode: "list", boardGroupBy: "status" };
      case "link": return { title: null, url: null, caption: "" };
      case "divider": return {};
      case "table": 
        // Note: The actual tableId will be set by the server when createBlock is called
        // For optimistic rendering, we use an empty object - the server will create the table
        // and return the block with tableId in content
        return {};
      case "timeline": {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30);
        return {
          viewConfig: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            zoomLevel: "day",
            filters: {},
            groupBy: "none",
          },
        };
      }
      case "file": return { files: [] };
      case "video": return { files: [] };
      case "image": return { fileId: null, caption: "", width: 400 };
      case "gallery": return { layout: null, items: [] };
      case "embed": return { url: "", displayMode: "inline" };
      case "section": return { height: 400 };
      case "doc_reference": return { doc_id: "", doc_title: "" };
      case "chart": return { code: "", chartType: "bar", title: "Chart" };
      default: return {};
    }
  };

  const handleSelectDoc = async (docId: string, docTitle: string) => {
    setIsCreating(true);
    const nextPosition = getNextPosition?.() ?? 0;

    // Create optimistic block IMMEDIATELY
    const optimisticBlockId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticBlock = {
      id: optimisticBlockId,
      tab_id: tabId,
      parent_block_id: parentBlockId || null,
      type: "doc_reference" as BlockType,
      content: { doc_id: docId, doc_title: docTitle },
      position: nextPosition,
      column: 0,
      is_template: false,
      template_name: null,
      original_block_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Show block INSTANTLY
    if (onBlockCreated) {
      onBlockCreated(optimisticBlock);
    }
    
    setIsCreating(false);

    // Server call in background
    try {
      const result = await createBlock({
        tabId,
        type: "doc_reference",
        position: nextPosition,
        content: {
          doc_id: docId,
          doc_title: docTitle,
        },
        parentBlockId: parentBlockId || null,
      });

      if (result.error) {
        console.error("Failed to create doc reference:", result.error);
        // Mark block as failed instead of removing it immediately
        setFailedBlocks(prev => new Map(prev.set(optimisticBlockId, {
          id: optimisticBlockId,
          status: 'failed',
          error: result.error,
          retry: () => handleSelectDoc(docId, docTitle)
        })));
        // Call error callback to allow parent to handle UI state
        onBlockError?.(optimisticBlockId);
        return;
      }

      if (result.data) {
        onBlockResolved?.(optimisticBlockId, result.data);
      }
    } catch (error) {
      console.error("Create doc reference exception:", error);
      router.refresh();
    }
  };

  const triggerButton = (
    <div className="flex items-center gap-2">
      <button
        disabled={isCreating}
        className={cn(
          variant === "large"
            ? "px-3 py-1.75 text-sm font-medium"
            : "px-3 py-1.5 text-sm",
          "flex items-center gap-2 border border-dashed border-[var(--border)] text-[var(--muted-foreground)] transition-all duration-150 ease-out hover:border-[var(--foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
        )}
      >
        <Plus className={variant === "large" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        <span>{variant === "large" ? "Add block" : "Add"}</span>
      </button>

      {/* Show failed blocks with retry options */}
      {failedBlocks.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-300">
            {failedBlocks.size} block{failedBlocks.size > 1 ? 's' : ''} failed to save
          </span>
          <button
            onClick={() => {
              // Retry all failed blocks
              failedBlocks.forEach((failedBlock) => {
                if (failedBlock.retry) {
                  failedBlock.retry();
                  setFailedBlocks(prev => {
                    const next = new Map(prev);
                    next.delete(failedBlock.id);
                    return next;
                  });
                }
              });
            }}
            className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors"
          >
            Retry All
          </button>
          <button
            onClick={() => {
              // Clear all failed blocks (rollback)
              failedBlocks.forEach((failedBlock) => {
                onBlockError?.(failedBlock.id);
              });
              setFailedBlocks(new Map());
            }}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {triggerButton}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={12}
          alignOffset={-140}
          collisionPadding={12}
          className="w-60 max-h-[min(40vh,20rem,var(--radix-popper-available-height))]"
        >
          <DropdownMenuItem
            onClick={() => setBlockReferenceSelectorOpen(true)}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            {/* Velvet Purple for references/links */}
            <div className="flex h-7 w-7 items-center justify-center bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)]">
              <Copy className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[var(--foreground)]">Reference Block</div>
              <div className="text-xs text-[var(--tertiary-foreground)]">Link to a reusable block</div>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {blockTypes.map((blockType) => (
            <DropdownMenuItem
              key={blockType.type}
              onClick={() => handleCreateBlock(blockType.type)}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <div className="flex h-7 w-7 items-center justify-center bg-[var(--surface-muted)] text-[var(--foreground)]">
                {blockType.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-[var(--foreground)]">{blockType.label}</div>
                <div className="text-xs text-[var(--tertiary-foreground)]">{blockType.description}</div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DocSelectorDialog
        isOpen={docSelectorOpen}
        onClose={() => setDocSelectorOpen(false)}
        onSelectDoc={handleSelectDoc}
      />

      <BlockReferenceSelector
        isOpen={blockReferenceSelectorOpen}
        onClose={() => setBlockReferenceSelectorOpen(false)}
        tabId={tabId}
        onBlockCreated={onBlockCreated}
        onBlockError={onBlockError}
      />
    </>
  );
}
