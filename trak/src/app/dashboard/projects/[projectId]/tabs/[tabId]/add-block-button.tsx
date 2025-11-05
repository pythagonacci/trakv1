"use client";

import { useState } from "react";
import { Plus, FileText, CheckSquare, Link2, Minus, Table, Calendar, Upload, Video, Maximize2, Image, Layout } from "lucide-react";
import { createBlock, type BlockType } from "@/app/actions/block";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
];

export default function AddBlockButton({ tabId, projectId, variant = "default", parentBlockId, onBlockCreated }: AddBlockButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBlock = async (type: BlockType) => {
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

  const triggerButton = (
    <button
      disabled={isCreating}
      className={cn(
        variant === "large"
          ? "px-4 py-2.5 text-sm font-medium"
          : "px-3 py-1.5 text-sm",
        "text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 rounded-md flex items-center gap-2 transition-all disabled:opacity-50 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800"
      )}
    >
      <Plus className={variant === "large" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      <span>{variant === "large" ? "Add block" : "Add"}</span>
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerButton}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {blockTypes.map((blockType) => (
          <DropdownMenuItem
            key={blockType.type}
            onClick={() => handleCreateBlock(blockType.type)}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer"
          >
            <div className="text-neutral-500 dark:text-neutral-400">{blockType.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-neutral-900 dark:text-white">{blockType.label}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{blockType.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

