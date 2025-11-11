"use client";

import React, { useState } from "react";
import {
  GripVertical,
  Trash2,
  MoreHorizontal,
  FileText,
  CheckSquare,
  Link2,
  Table,
  Calendar,
  Paperclip,
  Video,
  Image,
  Maximize2,
  Layout,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FileAttachmentDialog from "./file-attachment-dialog";

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
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);

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

  return (
    <div ref={setNodeRef} style={style} className="group relative w-full">
      <div
        className={cn(
          "absolute -left-7 top-2 hidden rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--tertiary-foreground)] shadow-sm transition-all duration-150 ease-out",
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
            : "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-sm hover:border-[var(--foreground)]/20"
        )}
      >
        {!borderless && (
          <div className="absolute -top-3 right-3 hidden items-center gap-1 rounded-[999px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--tertiary-foreground)] shadow-sm transition-opacity duration-150 ease-out group-hover:flex">
            {block.type}
          </div>
        )}

        <div className="absolute right-2.5 top-2 hidden items-center gap-1 text-[var(--tertiary-foreground)] transition-opacity duration-150 ease-out group-hover:flex">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-[4px] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "text")}> <FileText className="h-4 w-4" /> Text </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "task")}> <CheckSquare className="h-4 w-4" /> Task </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "link")}> <Link2 className="h-4 w-4" /> Link </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "table")}> <Table className="h-4 w-4" /> Table </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "timeline")}> <Calendar className="h-4 w-4" /> Timeline </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "video")}> <Video className="h-4 w-4" /> Video </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "image")}> <Image className="h-4 w-4" /> Image </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "embed")}> <Maximize2 className="h-4 w-4" /> Embed </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "pdf")}> <FileText className="h-4 w-4" /> PDF </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConvert?.(block.id, "section")}> <Layout className="h-4 w-4" /> Section </DropdownMenuItem>
              {workspaceId && projectId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setAttachmentDialogOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Paperclip className="h-4 w-4" /> Attach file
                  </DropdownMenuItem>
                </>
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

      {workspaceId && projectId && (
        <FileAttachmentDialog
          isOpen={attachmentDialogOpen}
          onClose={() => setAttachmentDialogOpen(false)}
          workspaceId={workspaceId}
          projectId={projectId}
          blockId={block.id}
          onUploadComplete={() => onUpdate?.()}
        />
      )}
    </div>
  );
}

