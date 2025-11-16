"use client";

import React, { useState } from "react";
import {
  GripVertical,
  Trash2,
  MoreHorizontal,
  FileText,
  CheckSquare,
  Link2,
  Minus,
  Table,
  Calendar,
  Paperclip,
  Video,
  Image,
  Maximize2,
  Layout,
  Copy,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MakeTemplateDialog from "./make-template-dialog";
interface BlockWrapperProps {
  block: Block;
  children: React.ReactNode;
  workspaceId?: string;
  projectId?: string;
  onDelete?: (blockId: string) => void;
  onConvert?: (
    blockId: string,
    newType:
      | "text"
      | "task"
      | "link"
      | "divider"
      | "table"
      | "timeline"
      | "file"
      | "video"
      | "image"
      | "embed"
      | "pdf"
      | "doc_reference"
      | "section"
  ) => void;
  onUpdate?: () => void;
  isDragging?: boolean;
}

export default function BlockWrapper({
  block,
  children,
  workspaceId,
  projectId,
  onDelete,
  onConvert,
  onUpdate,
  isDragging: externalIsDragging,
}: BlockWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [makeTemplateDialogOpen, setMakeTemplateDialogOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isDraggingInternal } = useSortable({
    id: block.id,
    disabled: block.type === "divider",
  });

  const isDragging = externalIsDragging || isDraggingInternal;
  const borderless = Boolean((block.content as Record<string, unknown> | undefined)?.borderless);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  if (block.type === "divider") {
    return <div ref={setNodeRef} style={style}>{children}</div>;
  }

  const blockTypeOptions: Array<{ type: Block["type"]; label: string; icon: React.ReactNode }> = [
    { type: "text", label: "Text", icon: <FileText className="h-4 w-4" /> },
    { type: "task", label: "Task list", icon: <CheckSquare className="h-4 w-4" /> },
    { type: "link", label: "Link", icon: <Link2 className="h-4 w-4" /> },
    { type: "divider", label: "Divider", icon: <Minus className="h-4 w-4" /> },
    { type: "table", label: "Table", icon: <Table className="h-4 w-4" /> },
    { type: "timeline", label: "Timeline", icon: <Calendar className="h-4 w-4" /> },
    { type: "file", label: "File", icon: <Paperclip className="h-4 w-4" /> },
    { type: "video", label: "Video", icon: <Video className="h-4 w-4" /> },
    { type: "image", label: "Image", icon: <Image className="h-4 w-4" /> },
    { type: "embed", label: "Embed", icon: <Maximize2 className="h-4 w-4" /> },
    { type: "pdf", label: "PDF", icon: <FileText className="h-4 w-4" /> },
    { type: "section", label: "Section", icon: <Layout className="h-4 w-4" /> },
  ];

  return (
    <div ref={setNodeRef} style={style} className="group relative w-full">
      <div
        className={cn(
          "absolute -left-7 top-2 hidden rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--tertiary-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 ease-out",
          "group-hover:flex group-focus-within:flex"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="Drag block"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className={cn(
          "relative flex min-w-0 flex-col transition-all duration-150 ease-out",
          borderless
            ? "rounded-none border-none bg-transparent px-0 py-0 shadow-none"
            : "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[var(--foreground)]/20"
        )}
      >
        {!borderless && (
          <div className="absolute -top-3 right-3 hidden items-center gap-1 rounded-[999px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--tertiary-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-opacity duration-150 ease-out group-hover:flex">
            {block.type}
          </div>
        )}
        
        {block.is_template && (
          <div className="absolute -top-3 left-3 flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-green-700 shadow-sm">
            <Copy className="h-2.5 w-2.5" />
            {block.template_name || "REUSABLE"}
          </div>
        )}

        <div
          className={cn(
            "absolute right-2.5 top-2 hidden items-center gap-1 text-[var(--tertiary-foreground)] transition-opacity duration-150 ease-out",
            "group-hover:flex group-focus-within:flex",
            menuOpen && "flex"
          )}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-[4px] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span className="flex items-center gap-2">
                    <Maximize2 className="h-4 w-4" />
                    Convert block
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {blockTypeOptions
                    .filter((option) => option.type !== block.type)
                    .map((option) => (
                      <DropdownMenuItem
                        key={option.type}
                        onClick={() => {
                          onConvert?.(block.id, option.type);
                          setMenuOpen(false);
                        }}
                      >
                        {option.icon}
                        <span>{option.label}</span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              {!block.is_template && !block.original_block_id && (
                <DropdownMenuItem
                  onClick={() => {
                    setMakeTemplateDialogOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Copy className="h-4 w-4" /> Make Reusable
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete?.(block.id)}
                className="text-red-500 focus:bg-red-50 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className={cn("space-y-2.5", borderless && "space-y-3")}>{children}</div>
      </div>
      
      <MakeTemplateDialog
        isOpen={makeTemplateDialogOpen}
        onClose={() => setMakeTemplateDialogOpen(false)}
        blockId={block.id}
        blockType={block.type}
        onSuccess={() => onUpdate?.()}
      />
    </div>
  );
}

