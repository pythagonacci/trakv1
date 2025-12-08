"use client";

import { useState } from "react";
import { Plus, FileText, CheckSquare, Link2, Minus, Table, Calendar, Upload, Video, Maximize2, Image, Layout } from "lucide-react";
import { createClientTabBlock, type ClientTabBlock, type ClientTabBlockType } from "@/app/actions/client-tab-block";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ClientAddBlockButtonProps {
  tabId: string;
  clientId: string;
  variant?: "default" | "large";
  onBlockCreated?: (block: ClientTabBlock) => void;
  onBlockResolved?: (tempId: string, savedBlock: ClientTabBlock) => void;
  getNextPosition?: () => number;
}

const blockTypes: Array<{ type: ClientTabBlockType; label: string; icon: React.ReactNode; description: string }> = [
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
    description: "Visual separator",
  },
  {
    type: "table",
    label: "Table",
    icon: <Table className="w-4 h-4" />,
    description: "Data table with rows and columns",
  },
  {
    type: "timeline",
    label: "Timeline",
    icon: <Calendar className="w-4 h-4" />,
    description: "Timeline of events",
  },
  {
    type: "file",
    label: "Files",
    icon: <Upload className="w-4 h-4" />,
    description: "File attachments",
  },
  {
    type: "image",
    label: "Image",
    icon: <Image className="w-4 h-4" />,
    description: "Image with caption",
  },
  {
    type: "video",
    label: "Video",
    icon: <Video className="w-4 h-4" />,
    description: "Video player",
  },
  {
    type: "pdf",
    label: "PDF",
    icon: <FileText className="w-4 h-4" />,
    description: "PDF viewer",
  },
  {
    type: "embed",
    label: "Embed",
    icon: <Maximize2 className="w-4 h-4" />,
    description: "Embed external content",
  },
  {
    type: "section",
    label: "Section",
    icon: <Layout className="w-4 h-4" />,
    description: "Collapsible section",
  },
];

export default function ClientAddBlockButton({ 
  tabId, 
  clientId, 
  variant = "default", 
  onBlockCreated, 
  onBlockResolved,
  getNextPosition 
}: ClientAddBlockButtonProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBlock = async (type: ClientTabBlockType, content: Record<string, any> = {}) => {
    if (isCreating) return;
    setIsCreating(true);

    // Calculate position
    const position = getNextPosition ? getNextPosition() : undefined;

    // Create optimistic block
    const optimisticBlockId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticBlock: ClientTabBlock = {
      id: optimisticBlockId,
      tab_id: tabId,
      type,
      content,
      position: position ?? 0,
      column: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Call callback immediately for optimistic update
    onBlockCreated?.(optimisticBlock);

    try {
      const result = await createClientTabBlock({
        tabId,
        type,
        content,
        position,
      });

      if (result.error) {
        console.error("Failed to create block:", result.error);
        alert(`Error creating block: ${result.error}`);
        router.refresh();
        setIsCreating(false);
        return;
      }

      if (result.data) {
        onBlockResolved?.(optimisticBlockId, result.data);
        router.refresh();
      }
    } catch (error) {
      console.error("Create block exception:", error);
      router.refresh();
    } finally {
      setIsCreating(false);
    }
  };

  const getDefaultContent = (type: ClientTabBlockType): Record<string, any> => {
    switch (type) {
      case "text":
        return { text: "" };
      case "task":
        return { title: "New Task List", tasks: [] };
      case "link":
        return { title: "", url: "", description: "" };
      case "divider":
        return {};
      case "table":
        return {
          rows: 3,
          cols: 3,
          cells: [["", "", ""], ["", "", ""], ["", "", ""]],
          columnWidths: [150, 150, 150],
        };
      case "timeline":
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30);
        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          events: [],
        };
      case "file":
        return { files: [] };
      case "image":
        return { fileId: null, caption: "", width: 400 };
      case "video":
        return { files: [] };
      case "embed":
        return { url: "", displayMode: "inline" };
      case "pdf":
        return { fileId: null };
      case "section":
        return { title: "", description: "", height: 400 };
      default:
        return {};
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]",
            variant === "large" && "px-4 py-2 text-base"
          )}
          disabled={isCreating}
        >
          <Plus className="h-4 w-4" />
          {variant === "large" ? "Add Block" : "Add"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {blockTypes.map((blockType) => (
          <DropdownMenuItem
            key={blockType.type}
            onClick={() => handleCreateBlock(blockType.type, getDefaultContent(blockType.type))}
            className="flex items-start gap-3 px-3 py-2"
          >
            <div className="mt-0.5 text-[var(--muted-foreground)]">
              {blockType.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-[var(--foreground)]">
                {blockType.label}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {blockType.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
