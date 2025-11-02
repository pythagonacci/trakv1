"use client";

import { useState } from "react";
import { Plus, FileText, CheckSquare, Link2, Minus, Table, Calendar, Upload, Video, Maximize2, Image } from "lucide-react";
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
];

export default function AddBlockButton({ tabId, projectId, variant = "default" }: AddBlockButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBlock = async (type: BlockType) => {
    setIsCreating(true);
    try {
      const result = await createBlock({
        tabId,
        type,
      });

      if (result.error) {
        console.error("Failed to create block:", result.error);
        // Show error to user
        alert(`Error creating block: ${result.error}`);
        setIsCreating(false);
        return;
      }

      // Refresh the page to show the new block
      router.refresh();
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
          ? "px-6 py-3 text-base font-medium"
          : "px-3 py-2 text-sm",
        "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 transition-colors border border-neutral-200 dark:border-neutral-700 disabled:opacity-50"
      )}
    >
      <Plus className={variant === "large" ? "w-5 h-5" : "w-4 h-4"} />
      Add Block
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

