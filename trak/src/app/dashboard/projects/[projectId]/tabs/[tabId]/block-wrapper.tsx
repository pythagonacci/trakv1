"use client";

import { useState } from "react";
import { GripVertical, Trash2, MoreHorizontal, FileText, CheckSquare, Link2, Table, Calendar, Paperclip, Video, Image, Maximize2, Layout } from "lucide-react";
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
  onConvert?: (blockId: string, newType: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "video" | "image" | "embed" | "pdf" | "section") => void;
  onUpdate?: () => void;
  isDragging?: boolean;
}

export default function BlockWrapper({ block, children, workspaceId, projectId, onDelete, onConvert, onUpdate, isDragging: externalIsDragging }: BlockWrapperProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);

  // Use sortable hook for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDraggingInternal,
  } = useSortable({
    id: block.id,
    disabled: block.type === "divider", // Disable dragging for divider blocks
  });

  const isDragging = externalIsDragging || isDraggingInternal;

  // Don't show hover UI if it's a divider or dragging
  const showHoverUI = block.type !== "divider" && hovered && !isDragging;

  // Apply transform styles for drag animation
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {block.type !== "divider" ? (
        <div
          ref={setNodeRef}
          style={style}
          className="relative"
        >
          <div className="flex gap-2 min-w-0 -ml-2">
            {/* Drag Handle - Left Side - Subtle */}
            <div
              className={cn(
                "flex items-start justify-center w-6 shrink-0 pt-2.5 opacity-0 transition-opacity",
                showHoverUI ? "opacity-100" : "opacity-0",
                isDragging && "opacity-100"
              )}
            >
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors touch-none"
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-700" />
              </button>
            </div>

            {/* Block Container - Subtle containerization */}
            <div
              className={cn(
                "flex-1 rounded-lg transition-all min-w-0 overflow-x-auto overflow-y-visible border",
                hovered
                  ? "bg-white dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 shadow-sm"
                  : "bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-900/50"
              )}
            >
              {/* Hover Actions - Right Side - Minimal */}
              <div
                className={cn(
                  "absolute -top-2 right-0 flex items-center gap-0.5 opacity-0 transition-opacity",
                  showHoverUI ? "opacity-100" : "opacity-0",
                  isDragging && "pointer-events-none"
                )}
              >

                {/* Three-dot Menu - Ghost button */}
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <div className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-200 dark:border-neutral-700">
                      Convert
                    </div>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "text");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Text
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "task");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Task
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "link");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "table");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Table className="w-4 h-4" />
                      Table
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "timeline");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Timeline
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "video");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Video
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "image");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Image className="w-4 h-4" />
                      Image
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "embed");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Embed
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "pdf");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "section");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Layout className="w-4 h-4" />
                      Section
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {workspaceId && projectId && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setAttachmentDialogOpen(true);
                            setMenuOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Paperclip className="w-4 h-4" />
                          Attach File
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        onDelete?.(block.id);
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Delete Button - Ghost */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(block.id);
                  }}
                  className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 dark:text-neutral-600 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Block Content */}
              {children}
            </div>
          </div>
          
          {/* File Attachment Dialog */}
          {workspaceId && projectId && (
            <FileAttachmentDialog
              isOpen={attachmentDialogOpen}
              onClose={() => setAttachmentDialogOpen(false)}
              workspaceId={workspaceId}
              projectId={projectId}
              blockId={block.id}
              onUploadComplete={() => {
                onUpdate?.();
              }}
            />
          )}
        </div>
      ) : (
        // Divider blocks render without wrapper
        children
      )}
    </div>
  );
}

