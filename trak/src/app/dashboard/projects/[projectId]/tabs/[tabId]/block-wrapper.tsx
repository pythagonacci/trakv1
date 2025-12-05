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
import BlockComments from "./block-comments";
import { MessageSquare } from "lucide-react";
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
  readOnly?: boolean;
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
  readOnly = false,
}: BlockWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [makeTemplateDialogOpen, setMakeTemplateDialogOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  
  // Check if block has comments
  const blockContent = block.content || {};
  const comments = blockContent._blockComments || [];
  const hasComments = comments.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isDraggingInternal } = useSortable({
    id: block.id,
    disabled: readOnly || block.type === "divider",
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

  // Only apply drag listeners to non-text blocks
  const isTextBlock = block.type === "text";
  
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group relative w-full",
        !isTextBlock && !readOnly && "cursor-move"
      )}
      {...(!readOnly ? attributes : {})}
      {...(!readOnly && !isTextBlock ? listeners : {})}
    >
      {!readOnly && (
        <div
          className={cn(
            "absolute -left-7 top-2 hidden border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--tertiary-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 ease-out",
            "group-hover:flex group-focus-within:flex"
          )}
        >
          <button
            {...listeners}
            {...attributes}
            className="flex h-6 w-6 items-center justify-center transition-colors hover:bg-[var(--surface-hover)] cursor-move"
            aria-label="Drag block"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative flex min-w-0 flex-col w-full transition-all duration-150 ease-out",
          borderless
            ? "border-none bg-transparent px-0 py-0 shadow-none"
            : "border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[var(--foreground)]/20"
        )}
        onMouseDown={(e) => {
          // Stop drag from starting if clicking on contenteditable or interactive elements
          const target = e.target as HTMLElement;
          if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => {
          // Prevent drag on the content area
          const target = e.target as HTMLElement;
          if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {!borderless && (
          <div className="absolute -top-3 right-3 flex items-center gap-2">
            {!readOnly && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentsOpen((prev) => !prev);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "inline-flex items-center justify-center border p-1.5 transition-colors",
                  hasComments || commentsOpen
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                )}
                title={hasComments ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
                aria-pressed={commentsOpen}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {borderless && !readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCommentsOpen((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(
              "absolute right-2 top-2 inline-flex items-center justify-center border p-1.5 transition-colors",
              hasComments || commentsOpen
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
            )}
            title={hasComments ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
            aria-pressed={commentsOpen}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )}
        
        {block.is_template && (
          <div className="absolute -top-3 left-3 flex items-center gap-1 border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-green-700 shadow-sm">
            <Copy className="h-2.5 w-2.5" />
            {block.template_name || "REUSABLE"}
          </div>
        )}

        {!readOnly && (
          <div
            className={cn(
              "absolute right-2.5 top-2 hidden items-center gap-1 text-[var(--tertiary-foreground)] transition-opacity duration-150 ease-out z-30",
              "group-hover:flex group-focus-within:flex",
              menuOpen && "flex"
            )}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
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
                  onClick={() => {
                    setCommentsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <MessageSquare className="h-4 w-4" /> 
                  <span>{hasComments ? "Comments" : "Add comment"}</span>
                  {hasComments && (
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">({comments.length})</span>
                  )}
                </DropdownMenuItem>
                
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
        )}

        <div className={cn("flex items-start gap-0", borderless && "space-y-3")}>
          <div className={cn("flex-1 min-w-0 space-y-2.5", borderless && "space-y-3")}>
            {children}
          </div>

          {/* Block Comments - positioned on the side (only show when open) */}
          {!borderless && commentsOpen && !readOnly && (
            <BlockComments 
              block={block} 
              onUpdate={onUpdate}
              isOpen={commentsOpen ? true : undefined}
              onToggle={() => setCommentsOpen(!commentsOpen)}
            />
          )}
        </div>
      </div>
      
      {!readOnly && (
        <MakeTemplateDialog
          isOpen={makeTemplateDialogOpen}
          onClose={() => setMakeTemplateDialogOpen(false)}
          blockId={block.id}
          blockType={block.type}
          onSuccess={() => onUpdate?.()}
        />
      )}
    </div>
  );
}

