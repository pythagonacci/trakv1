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
  onBlockCreated?: () => void;
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
    try {
      const result = await createBlock({
        tabId,
        type,
        parentBlockId: parentBlockId || null,
      });

      if (result.error) {
        console.error("Failed to create block:", result.error);
        // Show error to user
        alert(`Error creating block: ${result.error}`);
        setIsCreating(false);
        return;
      }

      // Call callback if provided, otherwise refresh
      if (onBlockCreated) {
        onBlockCreated();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Create block exception:", error);
      setIsCreating(false);
    }
  };

  const handleSelectDoc = async (docId: string, docTitle: string) => {
    setIsCreating(true);
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
        setIsCreating(false);
        return;
      }

      // Call callback if provided, otherwise refresh
      if (onBlockCreated) {
        onBlockCreated();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Create doc reference exception:", error);
      setIsCreating(false);
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

