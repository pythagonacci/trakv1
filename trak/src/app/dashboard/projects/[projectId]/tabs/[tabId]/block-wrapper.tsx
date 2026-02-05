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
  Images,
  Maximize2,
  Layout,
  Copy,
  Plus,
  Tags,
  Sparkles,
  SlidersHorizontal,
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
import { PropertyMenu, PropertyBadges } from "@/components/properties";
import {
  useEntityPropertiesWithInheritance,
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import { useAI } from "@/components/ai";
import ChartCustomizeDialog from "@/components/blocks/chart-customize-dialog";
interface BlockWrapperProps {
  block: Block;
  children: React.ReactNode;
  workspaceId?: string;
  projectId?: string;
  onDelete?: (blockId: string) => void;
  onConvert?: (blockId: string, newType: Block["type"]) => void;
  onUpdate?: () => void;
  onAddBlockAbove?: (blockId: string, type?: Block["type"]) => void;
  onAddBlockBelow?: (blockId: string, type?: Block["type"]) => void;
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
  onAddBlockAbove,
  onAddBlockBelow,
  isDragging: externalIsDragging,
  readOnly = false,
}: BlockWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [makeTemplateDialogOpen, setMakeTemplateDialogOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [chartCustomizeOpen, setChartCustomizeOpen] = useState(false);
  const { contextBlock, setContextBlock, openCommandPalette } = useAI();

  // Fetch properties for this block
  const { data: propertiesResult } = useEntityPropertiesWithInheritance("block", block.id);
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const direct = propertiesResult?.direct;
  const inherited = propertiesResult?.inherited?.filter((inh) => inh.visible) ?? [];

  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return undefined;
    const member = workspaceMembers.find((m) => m.id === assigneeId || m.user_id === assigneeId);
    return member?.name || member?.email;
  };

  const directCount = countEntityProperties(direct);
  const inheritedCount = inherited.reduce(
    (sum, inh) => sum + countEntityProperties(inh.properties),
    0
  );
  const totalPropertiesCount = directCount + inheritedCount;
  const hasProperties = totalPropertiesCount > 0;

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

  const contextLabel = (() => {
    if (block.type === "text") {
      const text = String((block.content as any)?.text || "").trim();
      const preview = text ? text.slice(0, 60) : "Text block";
      return `Text: ${preview}`;
    }
    if (block.type === "table") return "Table block";
    if (block.type === "task") return "Task list";
    if (block.type === "timeline") return "Timeline block";
    if (block.type === "file") return "File block";
    if (block.type === "image") return "Image block";
    if (block.type === "video") return "Video block";
    if (block.type === "gallery") return "Gallery block";
    if (block.type === "embed") return "Embed block";
    if (block.type === "section") return "Section block";
    if (block.type === "link") return "Link block";
    if (block.type === "pdf") return "PDF block";
    if (block.type === "chart") return "Chart block";
    return `${block.type} block`;
  })();

  const isContextBlock = contextBlock?.blockId === block.id;

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
    { type: "gallery", label: "Gallery", icon: <Images className="h-4 w-4" /> },
    { type: "embed", label: "Embed", icon: <Maximize2 className="h-4 w-4" /> },
    { type: "section", label: "Section", icon: <Layout className="h-4 w-4" /> },
  ];

  // Only apply drag listeners to non-text blocks
  const isTextBlock = block.type === "text";
  
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group relative w-full"
      )}
    >
      {!readOnly && (
        <div
          className={cn(
            "absolute -left-7 top-2 hidden border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--tertiary-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 ease-out",
            "group-hover:flex group-focus-within:flex"
          )}
        >
          <button
            {...(!readOnly ? attributes : {})}
            {...(!readOnly && !isTextBlock ? listeners : {})}
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
          "relative flex min-w-0 flex-col w-full rounded-lg transition-all duration-150 ease-out",
          borderless
            ? "border-none bg-transparent px-0 py-0 shadow-none"
            : isTextBlock
              ? "border-y border-[#3080a6]/35 bg-transparent px-3 py-2.5 shadow-none rounded-none"
              : "border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[var(--secondary)]/20"
        )}
        onDoubleClick={() => {
          if (block.type === "chart" && !readOnly) {
            setChartCustomizeOpen(true);
          }
        }}
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
          <div className="absolute -top-3 right-3 flex items-center gap-2 z-[60]">
            {!readOnly && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextBlock({
                      blockId: block.id,
                      type: block.type,
                      label: contextLabel,
                    });
                    openCommandPalette();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border p-1.5 transition-colors",
                    isContextBlock
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                  )}
                  title={isContextBlock ? "AI context selected" : "Use as AI context"}
                  aria-pressed={isContextBlock}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCommentsOpen((prev) => !prev);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md border p-1.5 transition-colors",
                    hasComments || commentsOpen
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                  )}
                  title={hasComments ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
                  aria-pressed={commentsOpen}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
                {block.type === "chart" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChartCustomizeOpen(true);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      title="Customize chart"
                      aria-label="Customize chart"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <ChartCustomizeDialog
                      block={block}
                      isOpen={chartCustomizeOpen}
                      onClose={() => setChartCustomizeOpen(false)}
                      onSuccess={onUpdate}
                    />
                  </>
                )}
                {block.type === "table" && (
                  <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add block above
                          </span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-52">
                          {blockTypeOptions.map((option) => (
                            <DropdownMenuItem
                              key={`add-above-${option.type}`}
                              onClick={() => {
                                onAddBlockAbove?.(block.id, option.type);
                                setMenuOpen(false);
                              }}
                            >
                              {option.icon}
                              <span>{option.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add block below
                          </span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-52">
                          {blockTypeOptions.map((option) => (
                            <DropdownMenuItem
                              key={`add-below-${option.type}`}
                              onClick={() => {
                                onAddBlockBelow?.(block.id, option.type);
                                setMenuOpen(false);
                              }}
                            >
                              {option.icon}
                              <span>{option.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
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

                      <DropdownMenuItem
                        onClick={() => {
                          setPropertiesOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        <Tags className="h-4 w-4" />
                        <span>Properties</span>
                        {hasProperties && (
                          <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                            ({totalPropertiesCount})
                          </span>
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
                )}
              </>
            )}
          </div>
        )}

        {borderless && !readOnly && (
          <div className="absolute right-2 top-2 z-[60] flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCommentsOpen((prev) => !prev);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center justify-center rounded-md border p-1.5 transition-colors",
                hasComments || commentsOpen
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
              )}
              title={hasComments ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
              aria-pressed={commentsOpen}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            {block.type === "table" && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add block above
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      {blockTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={`add-above-${option.type}`}
                          onClick={() => {
                            onAddBlockAbove?.(block.id, option.type);
                            setMenuOpen(false);
                          }}
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add block below
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      {blockTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={`add-below-${option.type}`}
                          onClick={() => {
                            onAddBlockBelow?.(block.id, option.type);
                            setMenuOpen(false);
                          }}
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
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

                  <DropdownMenuItem
                    onClick={() => {
                      setPropertiesOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Tags className="h-4 w-4" />
                    <span>Properties</span>
                    {hasProperties && (
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                      ({totalPropertiesCount})
                    </span>
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
            )}
          </div>
        )}

        {block.is_template && (
          <div className="absolute -top-3 left-3 flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-green-700 shadow-sm">
            <Copy className="h-2.5 w-2.5" />
            {block.template_name || "REUSABLE"}
          </div>
        )}

        {!readOnly && block.type !== "table" && (
          <div
            className={cn(
              "absolute right-2.5 top-2 hidden items-center gap-1 text-[var(--tertiary-foreground)] transition-opacity duration-150 ease-out z-[60]",
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
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add block above
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      {blockTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={`add-above-${option.type}`}
                          onClick={() => {
                            onAddBlockAbove?.(block.id, option.type);
                            setMenuOpen(false);
                          }}
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add block below
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      {blockTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={`add-below-${option.type}`}
                          onClick={() => {
                            onAddBlockBelow?.(block.id, option.type);
                            setMenuOpen(false);
                          }}
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                <DropdownMenuSeparator />
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

                <DropdownMenuItem
                  onClick={() => {
                    setPropertiesOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Tags className="h-4 w-4" />
                  <span>Properties</span>
                  {hasProperties && (
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">
                      ({totalPropertiesCount})
                    </span>
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

            {/* Property Badges */}
            {hasProperties && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--border)]/50">
                {direct && (
                  <PropertyBadges
                    properties={direct}
                    onClick={() => setPropertiesOpen(true)}
                    memberName={getMemberName(direct.assignee_id)}
                  />
                )}
                {inherited.map((inh) => (
                  <PropertyBadges
                    key={`inherited-${inh.source_entity_id}`}
                    properties={inh.properties}
                    inherited
                    onClick={() => setPropertiesOpen(true)}
                    memberName={getMemberName(inh.properties.assignee_id)}
                  />
                ))}
              </div>
            )}
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

      {/* Properties Panel */}
      {!readOnly && workspaceId && (
        <PropertyMenu
          open={propertiesOpen}
          onOpenChange={setPropertiesOpen}
          entityType="block"
          entityId={block.id}
          workspaceId={workspaceId}
          entityTitle={getBlockTitle(block)}
        />
      )}
    </div>
  );
}

function countEntityProperties(
  props: { status?: unknown; priority?: unknown; assignee_id?: unknown; due_date?: unknown; tags?: unknown } | null | undefined
): number {
  if (!props) return 0;
  const tags = Array.isArray(props.tags) ? props.tags : [];
  return (
    (props.status ? 1 : 0) +
    (props.priority ? 1 : 0) +
    (props.assignee_id ? 1 : 0) +
    (props.due_date ? 1 : 0) +
    tags.length
  );
}

/**
 * Get a display title for a block based on its type and content.
 */
function getBlockTitle(block: Block): string {
  const content = (block.content ?? {}) as Record<string, unknown>;

  switch (block.type) {
    case "text":
      const text = (content.text ?? content.content ?? "") as string;
      if (typeof text === "string" && text.trim()) {
        return text.slice(0, 50);
      }
      return "Text block";

    case "task":
      return (content.title as string) ?? "Task block";

    case "table":
      return (content.title as string) ?? "Table";

    case "timeline":
      return "Timeline";

    case "image":
      return (content.alt as string) ?? (content.filename as string) ?? "Image";

    case "file":
      return (content.filename as string) ?? "File";

    case "video":
      return (content.title as string) ?? "Video";

    case "embed":
      return (content.title as string) ?? "Embed";

    case "link":
      return (content.title as string) ?? (content.url as string) ?? "Link";

    case "divider":
      return "Divider";

    case "section":
      return (content.title as string) ?? "Section";

    case "doc_reference":
      return (content.title as string) ?? "Document reference";

    case "pdf":
      return (content.filename as string) ?? "File";

    case "chart":
      return (content.title as string) ?? "Chart";

    default:
      return `${block.type} block`;
  }
}
