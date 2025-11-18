"use client";

import { useState } from "react";
import { Plus, FileText, CheckSquare, Link2, Minus, Table, Calendar, Upload, Video, Maximize2, Image, Layout, Copy } from "lucide-react";
import { createBlock, type BlockType } from "@/app/actions/block";
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
    type: "embed",
    label: "Embed",
    icon: <Maximize2 className="w-4 h-4" />,
    description: "Embed external content (YouTube, Figma, etc.)",
  },
  {
    type: "pdf",
    label: "PDF",
    icon: <FileText className="w-4 h-4" />,
    description: "Upload and view PDF documents",
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

export default function AddBlockButton({ tabId, projectId, variant = "default", parentBlockId, onBlockCreated }: AddBlockButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [docSelectorOpen, setDocSelectorOpen] = useState(false);
  const [blockReferenceSelectorOpen, setBlockReferenceSelectorOpen] = useState(false);

  const handleCreateBlock = async (type: BlockType) => {
    // Special handling for doc_reference - open doc selector instead
    if (type === "doc_reference") {
      setDocSelectorOpen(true);
      return;
    }

    setIsCreating(true);

    // Create optimistic block IMMEDIATELY (before server call)
    const optimisticBlock = {
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
      tab_id: tabId,
      parent_block_id: parentBlockId || null,
      type: type,
      content: getDefaultContent(type),
      position: 9999, // Will be corrected by server
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
        parentBlockId: parentBlockId || null,
      });

      if (result.error) {
        console.error("Failed to create block:", result.error);
        alert(`Error creating block: ${result.error}`);
        // Remove optimistic block on error
        router.refresh();
        return;
      }

      // Server succeeded - data will sync in background
    } catch (error) {
      console.error("Create block exception:", error);
      // Remove optimistic block on error
      router.refresh();
    }
  };

  // Helper to get default content for each block type
  const getDefaultContent = (type: BlockType) => {
    switch (type) {
      case "text": return { text: "" };
      case "task": return { title: "New Task List", tasks: [] };
      case "link": return { title: "", url: "", description: "" };
      case "divider": return {};
      case "table": return { rows: 3, cols: 3, cells: [["", "", ""], ["", "", ""], ["", "", ""]], columnWidths: [150, 150, 150] };
      case "timeline": {
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30);
        return { startDate: startDate.toISOString(), endDate: endDate.toISOString(), events: [] };
      }
      case "file": return { files: [] };
      case "video": return { files: [] };
      case "image": return { fileId: null, caption: "", width: 400 };
      case "embed": return { url: "", displayMode: "inline" };
      case "pdf": return { fileId: null };
      case "section": return { height: 400 };
      case "doc_reference": return { doc_id: "", doc_title: "" };
      default: return {};
    }
  };

  const handleSelectDoc = async (docId: string, docTitle: string) => {
    setIsCreating(true);

    // Create optimistic block IMMEDIATELY
    const optimisticBlock = {
      id: `temp-${Date.now()}-${Math.random()}`,
      tab_id: tabId,
      parent_block_id: parentBlockId || null,
      type: "doc_reference" as BlockType,
      content: { doc_id: docId, doc_title: docTitle },
      position: 9999,
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
        content: {
          doc_id: docId,
          doc_title: docTitle,
        },
        parentBlockId: parentBlockId || null,
      });

      if (result.error) {
        console.error("Failed to create doc reference:", result.error);
        alert(`Error creating doc reference: ${result.error}`);
        router.refresh();
        return;
      }

      // Server succeeded - data will sync in background
    } catch (error) {
      console.error("Create doc reference exception:", error);
      router.refresh();
    }
  };

  const triggerButton = (
    <button
      disabled={isCreating}
      className={cn(
        variant === "large"
          ? "px-3 py-1.75 text-sm font-medium"
          : "px-3 py-1.5 text-sm",
        "flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--muted-foreground)] transition-all duration-150 ease-out hover:border-[var(--foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
      )}
    >
      <Plus className={variant === "large" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      <span>{variant === "large" ? "Add block" : "Add"}</span>
    </button>
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
          avoidCollisions={false}
          className="w-60"
        >
          <DropdownMenuItem
            onClick={() => setBlockReferenceSelectorOpen(true)}
            className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-blue-50 text-blue-600">
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
              className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[var(--surface-muted)] text-[var(--foreground)]">
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
      />
    </>
  );
}

