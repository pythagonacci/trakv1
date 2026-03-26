"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  GripVertical,
  Trash2,
  MoreHorizontal,
  FileText,
  CheckSquare,
  LayoutGrid,
  Link2,
  AtSign,
  Table,
  Calendar,
  Paperclip,
  Video,
  Image,
  Images,
  Maximize2,
  Layout,
  Heading,
  Copy,
  Plus,
  Tags,
  Sparkles,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Package,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { hasDueDate, normalizeDueDateRange } from "@/lib/due-date";
import { type Block, updateBlock } from "@/app/actions/block";
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
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import { useAI } from "@/components/ai";
import BlockReferencesPanel from "@/components/blocks/block-references-panel";
import { useBlockReferencePicker } from "@/components/blocks/block-reference-picker-provider";
import type { EntityProperties } from "@/types/properties";
interface BlockWrapperProps {
  block: Block;
  children: React.ReactNode;
  workspaceId?: string;
  projectId?: string;
  properties?: EntityProperties | null;
  onDelete?: (blockId: string) => void;
  onConvert?: (blockId: string, newType: Block["type"], content?: Record<string, unknown>) => void;
  onUpdate?: (updatedBlock?: Block) => void;
  onAddBlockAbove?: (blockId: string, type?: Block["type"], content?: Record<string, unknown>) => void;
  onAddBlockBelow?: (blockId: string, type?: Block["type"], content?: Record<string, unknown>) => void;
  isDragging?: boolean;
  readOnly?: boolean;
  onOpenChartCustomize?: () => void;
  isPlanLocked?: boolean;
}

export default function BlockWrapper({
  block,
  children,
  workspaceId,
  projectId,
  properties,
  onDelete,
  onConvert,
  onUpdate,
  onAddBlockAbove,
  onAddBlockBelow,
  isDragging: externalIsDragging,
  readOnly = false,
  onOpenChartCustomize,
  isPlanLocked = false,
}: BlockWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [makeTemplateDialogOpen, setMakeTemplateDialogOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsAnchorRect, setCommentsAnchorRect] = useState<DOMRect | null>(null);
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<{ side: "left" | "right"; top: number }>({
    side: "right",
    top: 8,
  });
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesAnchorRect, setPropertiesAnchorRect] = useState<DOMRect | null>(null);
  const blockCardRef = useRef<HTMLDivElement>(null);
  const blockMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const attachmentTriggerRef = useRef<HTMLButtonElement>(null);
  const commentsAnchorElRef = useRef<HTMLElement | null>(null);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  const openPropertiesMenu = () => {
    const rect = blockMenuTriggerRef.current?.getBoundingClientRect();
    if (rect) setPropertiesAnchorRect(rect);
    setPropertiesOpen(true);
    setMenuOpen(false);
  };
  const computeCommentsPanelPosition = useCallback((triggerRect?: DOMRect | null) => {
    const blockRect = blockCardRef.current?.getBoundingClientRect();
    if (!blockRect || typeof window === "undefined") {
      return { side: "right" as const, top: 8 };
    }

    const panelWidth = 320;
    const edgeMargin = 10;
    const blockGap = 12;
    const anchor = triggerRect ?? blockRect;
    const hasRoomOnRight = blockRect.right + blockGap + panelWidth + edgeMargin <= window.innerWidth;
    const side: "right" | "left" = hasRoomOnRight ? "right" : "left";

    const rawTop = anchor.top - blockRect.top - 12;
    const maxTop = Math.max(8, blockRect.height - 140);
    const top = Math.min(Math.max(8, rawTop), maxTop);

    return { side, top };
  }, []);
  const openComments = useCallback((trigger?: HTMLElement | null) => {
    const anchorElement = trigger ?? blockMenuTriggerRef.current ?? blockCardRef.current;
    commentsAnchorElRef.current = anchorElement;
    const rect = anchorElement?.getBoundingClientRect() ?? null;
    setCommentsAnchorRect(rect);
    setCommentsPanelPosition(computeCommentsPanelPosition(rect));
    setCommentsOpen(true);
  }, [computeCommentsPanelPosition]);
  const toggleComments = useCallback((trigger?: HTMLElement | null) => {
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    openComments(trigger);
  }, [commentsOpen, openComments]);
  const closeComments = useCallback(() => {
    setCommentsOpen(false);
  }, []);
  useEffect(() => {
    if (!commentsOpen) return;

    const updatePanelPosition = () => {
      const latestAnchorRect = commentsAnchorElRef.current?.getBoundingClientRect() ?? commentsAnchorRect;
      setCommentsPanelPosition(computeCommentsPanelPosition(latestAnchorRect));
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [commentsOpen, commentsAnchorRect, computeCommentsPanelPosition]);
  const { contextBlock, setContextBlock, openCommandPalette } = useAI();
  const referencePicker = useBlockReferencePicker();

  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const direct = properties ?? null;

  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return undefined;
    const member = workspaceMembers.find((m) => m.id === assigneeId || m.user_id === assigneeId);
    return member?.name || member?.email;
  };
  const getMemberNames = (props: { assignee_id?: string | null; assignee_ids?: string[] }) => {
    const ids: Array<string | null> = props.assignee_ids?.length
      ? props.assignee_ids
      : props.assignee_id
        ? [props.assignee_id]
        : [];
    return ids.map((id) => getMemberName(id)).filter((n): n is string => Boolean(n));
  };

  const totalPropertiesCount = countEntityProperties(direct);
  const hasProperties = totalPropertiesCount > 0;

  // Check if block has comments
  const blockContent = block.content || {};
  const comments = blockContent._blockComments || [];
  const hasComments = comments.length > 0;

  const isLocked = Boolean((block as any).locked) || isPlanLocked;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isDraggingInternal } = useSortable({
    id: block.id,
    disabled: readOnly || block.type === "divider" || isLocked,
  });

  const isDragging = externalIsDragging || isDraggingInternal;
  const borderless = Boolean((block.content as Record<string, unknown> | undefined)?.borderless) || block.type === "section_header";
  const isTempBlock = block.id.startsWith("temp-");
  const initialEmbedHeight =
    block.type === "embed" &&
    typeof (block.content as any)?.heightPx === "number" &&
    (block.content as any).heightPx > 0
      ? (block.content as any).heightPx
      : null;
  const [embedHeightPx, setEmbedHeightPx] = useState<number | null>(initialEmbedHeight);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDraggingInternal ? 0 : 1,
    ...(block.type === "embed" && embedHeightPx
      ? ({ ["--embed-height-px" as string]: `${embedHeightPx}px` } as Record<string, string>)
      : {}),
  };

  const contextLabel = (() => {
    if (block.type === "text") {
      const text = String((block.content as any)?.text || "").trim();
      const preview = text ? text.slice(0, 60) : "Text block";
      return `Text: ${preview}`;
    }
    if (block.type === "table") return "Table block";
    if (block.type === "task") return "Task list";
    if (block.type === "cards") return "Cards block";
    if (block.type === "timeline") return "Timeline block";
    if (block.type === "file") return "File block";
    if (block.type === "image") return "Image block";
    if (block.type === "video") return "Video block";
    if (block.type === "gallery") return "Gallery block";
    if (block.type === "embed") return "Embed block";
    if (block.type === "section") return "Section block";
    if (block.type === "section_header") return "Section Header block";
    if (block.type === "link") return "Link block";
    if (block.type === "pdf") return "PDF block";
    if (block.type === "chart") return "Chart block";
    if (block.type === "shopify_product") return "Shopify product";
    return `${block.type} block`;
  })();

  const isContextBlock = contextBlock?.blockId === block.id;

  const embedResizeStateRef = useRef<{
    startY: number;
    startHeight: number;
    latestHeight: number;
  } | null>(null);

  const handleEmbedResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (block.type !== "embed" || readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const MIN_HEIGHT = 240;
    const MAX_HEIGHT = 1400;

    const currentContent = (block.content || {}) as Record<string, any>;
    const existingHeight =
      typeof currentContent.heightPx === "number" && currentContent.heightPx > 0
        ? currentContent.heightPx
        : 600;

    embedResizeStateRef.current = {
      startY: e.clientY,
      startHeight: existingHeight,
      latestHeight: existingHeight,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!embedResizeStateRef.current) return;
      const delta = ev.clientY - embedResizeStateRef.current.startY;
      const next = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, embedResizeStateRef.current.startHeight + delta),
      );
      embedResizeStateRef.current = {
        ...embedResizeStateRef.current,
        latestHeight: next,
      };
      setEmbedHeightPx(next);
    };

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (!embedResizeStateRef.current) return;

      const finalHeight = embedResizeStateRef.current.latestHeight ?? embedResizeStateRef.current.startHeight;
      const clamped = Math.round(
        Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, finalHeight),
        ),
      );

      try {
        const result = await updateBlock({
          blockId: block.id,
          content: {
            ...currentContent,
            heightPx: clamped,
          },
        });

        if ("data" in result && result.data) {
          onUpdate?.(result.data);
        } else if ("error" in result && result.error) {
          console.error("Failed to update embed block height:", result.error);
        } else {
          onUpdate?.();
        }
      } finally {
        embedResizeStateRef.current = null;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleToggleLock = async () => {
    if (isTogglingLock) return;
    setIsTogglingLock(true);
    try {
      // Optimistic: immediately notify parent to refetch/update, but rely on server as source of truth
      const result = await updateBlock({
        blockId: block.id,
        locked: !isLocked,
      });

      if ("error" in result && result.error) {
        console.error("Failed to toggle block lock:", result.error);
        if (typeof window !== "undefined") {
          alert(result.error);
        }
        return;
      }

      if ("data" in result && result.data) {
        onUpdate?.(result.data);
      } else {
        onUpdate?.();
      }
    } finally {
      setIsTogglingLock(false);
    }
  };

  if (block.type === "divider") {
    return <div ref={setNodeRef} style={style}>{children}</div>;
  }

  const blockTypeOptions: Array<{ type: Block["type"]; label: string; icon: React.ReactNode }> = [
    { type: "text", label: "Text", icon: <FileText className="h-4 w-4" /> },
    { type: "task", label: "Task list", icon: <CheckSquare className="h-4 w-4" /> },
    { type: "link", label: "Link", icon: <Link2 className="h-4 w-4" /> },
    { type: "section_header", label: "Section Header", icon: <Heading className="h-4 w-4" /> },
    { type: "table", label: "Table", icon: <Table className="h-4 w-4" /> },
    { type: "timeline", label: "Timeline", icon: <Calendar className="h-4 w-4" /> },
    { type: "file", label: "File", icon: <Paperclip className="h-4 w-4" /> },
    { type: "video", label: "Video", icon: <Video className="h-4 w-4" /> },
    { type: "image", label: "Image", icon: <Image className="h-4 w-4" /> },
    { type: "embed", label: "Embed", icon: <Maximize2 className="h-4 w-4" /> },
    { type: "section", label: "Section", icon: <Layout className="h-4 w-4" /> },
  ];
  const galleryLayouts = [
    { layout: "collage" as const, label: "Collage" },
    { layout: "array" as const, label: "Array" },
  ];
  const getGalleryContentPreset = (layout: "collage" | "array") =>
    layout === "array"
      ? { layout: "array" as const, arrayColumns: 2, arrayRows: 2, items: [] }
      : { layout: "collage" as const, items: [] };

  const cardsLayouts = [
    { label: "Single card", content: { title: "Cards", viewMode: "grid", initialCardCount: 1 } },
    { label: "Array (2×2)", content: { title: "Cards", viewMode: "grid", initialCardCount: 4 } },
    { label: "Array (2×3)", content: { title: "Cards", viewMode: "grid", initialCardCount: 6 } },
  ];

  const isTextBlock = block.type === "text";

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group relative w-full"
      )}
    >
      {!readOnly && !isPlanLocked && (
        <div
          className={cn(
            "absolute -left-7 top-2 hidden border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--tertiary-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 ease-out",
            "group-hover:flex group-focus-within:flex"
          )}
        >
          <button
            {...(!readOnly ? attributes : {})}
            {...(!readOnly ? listeners : {})}
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
        ref={blockCardRef}
        className={cn(
          "relative flex min-w-0 flex-col w-full rounded-[var(--radius-sm)] transition-all duration-150 ease-out",
          borderless
            ? "border-none bg-transparent px-0 py-0 shadow-none"
            : isTextBlock
              ? "border-y border-[var(--primary)]/35 bg-transparent px-3 py-2.5 shadow-none rounded-none"
              : "border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[var(--primary)]/20"
        )}
        onDoubleClick={() => {
          if (block.type === "chart" && !readOnly && onOpenChartCustomize) {
            onOpenChartCustomize();
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
          <div className="absolute top-2 -right-4 flex flex-col items-center gap-1.5 z-[70]">
            {!readOnly && !isPlanLocked && (block.type === "table" ? (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={blockMenuTriggerRef}
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-popover space-y-0.5"
                >
                  <div className="flex items-center gap-1">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="flex-1 justify-center rounded-[6px] px-1.5 py-1 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Above
                        </span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                        {blockTypeOptions.map((option) => (
                          <DropdownMenuItem
                            key={`add-above-${option.type}`}
                            onClick={() => {
                              onAddBlockAbove?.(block.id, option.type);
                              setMenuOpen(false);
                            }}
                            className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <Images className="h-3 w-3" />
                            <span>Gallery</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {galleryLayouts.map((g) => (
                              <DropdownMenuItem
                                key={`add-above-gallery-${g.layout}`}
                                onClick={() => {
                                  onAddBlockAbove?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{g.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <LayoutGrid className="h-3 w-3" />
                            <span>Cards</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {cardsLayouts.map((c) => (
                              <DropdownMenuItem
                                key={`add-above-cards-${c.label}`}
                                onClick={() => {
                                  onAddBlockAbove?.(block.id, "cards", c.content);
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{c.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="flex-1 justify-center rounded-[6px] px-1.5 py-1 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Below
                        </span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                        {blockTypeOptions.map((option) => (
                          <DropdownMenuItem
                            key={`add-below-${option.type}`}
                            onClick={() => {
                              onAddBlockBelow?.(block.id, option.type);
                              setMenuOpen(false);
                            }}
                            className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <Images className="h-3 w-3" />
                            <span>Gallery</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {galleryLayouts.map((g) => (
                              <DropdownMenuItem
                                key={`add-below-gallery-${g.layout}`}
                                onClick={() => {
                                  onAddBlockBelow?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{g.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <LayoutGrid className="h-3 w-3" />
                            <span>Cards</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {cardsLayouts.map((c) => (
                              <DropdownMenuItem
                                key={`add-below-cards-${c.label}`}
                                onClick={() => {
                                  onAddBlockBelow?.(block.id, "cards", c.content);
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{c.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </div>

                  {!block.is_template && !block.original_block_id && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setMakeTemplateDialogOpen(true);
                          setMenuOpen(false);
                        }}
                        className="text-[11px]"
                      >
                        <Copy className="h-3.5 w-3.5" /> Make Reusable
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => {
                      openComments(blockMenuTriggerRef.current);
                      setMenuOpen(false);
                    }}
                    className="text-[11px]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{hasComments ? "Comments" : "Add comment"}</span>
                    {hasComments && (
                      <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
                        ({comments.length})
                      </span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={openPropertiesMenu} className="text-[11px]">
                    <Tags className="h-3.5 w-3.5" />
                    <span>Properties</span>
                    {hasProperties && (
                      <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
                        ({totalPropertiesCount})
                      </span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(block.id)}
                    className="text-[11px] text-red-500 focus:bg-red-50 focus:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={blockMenuTriggerRef}
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-popover space-y-0.5"
                >
                  <div className="flex items-center gap-1">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="flex-1 justify-center rounded-[6px] px-1.5 py-1 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Above
                        </span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                        {blockTypeOptions.map((option) => (
                          <DropdownMenuItem
                            key={`add-above-${option.type}`}
                            onClick={() => {
                              onAddBlockAbove?.(block.id, option.type);
                              setMenuOpen(false);
                            }}
                            className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <Images className="h-3 w-3" />
                            <span>Gallery</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {galleryLayouts.map((g) => (
                              <DropdownMenuItem
                                key={`add-above-gallery-${g.layout}`}
                                onClick={() => {
                                  onAddBlockAbove?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{g.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <LayoutGrid className="h-3 w-3" />
                            <span>Cards</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {cardsLayouts.map((c) => (
                              <DropdownMenuItem
                                key={`add-above-cards-${c.label}`}
                                onClick={() => {
                                  onAddBlockAbove?.(block.id, "cards", c.content);
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{c.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="flex-1 justify-center rounded-[6px] px-1.5 py-1 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Plus className="h-3 w-3" />
                          Below
                        </span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                        {blockTypeOptions.map((option) => (
                          <DropdownMenuItem
                            key={`add-below-${option.type}`}
                            onClick={() => {
                              onAddBlockBelow?.(block.id, option.type);
                              setMenuOpen(false);
                            }}
                            className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <Images className="h-3 w-3" />
                            <span>Gallery</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {galleryLayouts.map((g) => (
                              <DropdownMenuItem
                                key={`add-below-gallery-${g.layout}`}
                                onClick={() => {
                                  onAddBlockBelow?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{g.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <LayoutGrid className="h-3 w-3" />
                            <span>Cards</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {cardsLayouts.map((c) => (
                              <DropdownMenuItem
                                key={`add-below-cards-${c.label}`}
                                onClick={() => {
                                  onAddBlockBelow?.(block.id, "cards", c.content);
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{c.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </div>

                  {block.type === "task" && (() => {
                    const taskContent = (block.content || {}) as Record<string, unknown>;
                    const hideIcons = taskContent.hideIcons === true;
                    const showRollup = taskContent.showRollup === true;
                    const isTempBlock = block.id.startsWith("temp-");
                    const handleToggleIcons = async () => {
                      const next = !hideIcons;
                      const updatedContent = { ...taskContent, hideIcons: next };
                      onUpdate?.({ ...block, content: updatedContent, updated_at: new Date().toISOString() });
                      setMenuOpen(false);
                      if (!isTempBlock) {
                        const result = await updateBlock({ blockId: block.id, content: updatedContent });
                        if (result.data) onUpdate?.(result.data);
                      }
                    };
                    const handleToggleRollup = async () => {
                      const next = !showRollup;
                      const updatedContent = { ...taskContent, showRollup: next };
                      onUpdate?.({ ...block, content: updatedContent, updated_at: new Date().toISOString() });
                      setMenuOpen(false);
                      if (!isTempBlock) {
                        const result = await updateBlock({ blockId: block.id, content: updatedContent });
                        if (result.data) onUpdate?.(result.data);
                      }
                    };
                    return (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleToggleIcons} className="text-[11px]">
                          {hideIcons ? (
                            <>
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              Show Icons
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3.5 w-3.5 mr-2" />
                              Hide Icons
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleToggleRollup} className="text-[11px]">
                          {showRollup ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5 mr-2" />
                              Hide Rollup
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              Show Rollup
                            </>
                          )}
                        </DropdownMenuItem>
                      </>
                    );
                  })()}

                  {!block.is_template && !block.original_block_id && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setMakeTemplateDialogOpen(true);
                          setMenuOpen(false);
                        }}
                        className="text-[11px]"
                      >
                        <Copy className="h-3.5 w-3.5" /> Make Reusable
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => {
                      openComments(blockMenuTriggerRef.current);
                      setMenuOpen(false);
                    }}
                    className="text-[11px]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{hasComments ? "Comments" : "Add comment"}</span>
                    {hasComments && (
                      <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">({comments.length})</span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={openPropertiesMenu} className="text-[11px]">
                    <Tags className="h-3.5 w-3.5" />
                    <span>Properties</span>
                    {hasProperties && (
                      <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
                        ({totalPropertiesCount})
                      </span>
                    )}
                  </DropdownMenuItem>

                  {block.type === "shopify_product" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("shopify-product-block-open-picker", { detail: { blockId: block.id } }));
                          setMenuOpen(false);
                        }}
                        className="text-[11px]"
                      >
                        <Package className="h-3.5 w-3.5 mr-2" />
                        <span>Change product</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(block.id)}
                    className="text-[11px] text-red-500 focus:bg-red-50 focus:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleToggleLock();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isTogglingLock}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md border text-[var(--tertiary-foreground)] transition-colors",
                isLocked
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-[var(--border)] bg-[var(--surface)] hover:text-[var(--foreground)]"
              )}
              title={isLocked ? "Unlock block for editing" : "Lock block to prevent edits"}
            >
              {isLocked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
            </button>
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
                    "inline-flex h-7 w-7 items-center justify-center rounded-md border text-[var(--tertiary-foreground)] transition-colors",
                    isContextBlock
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:text-[var(--foreground)]"
                  )}
                  title={isContextBlock ? "AI context selected" : "Use as AI context"}
                  aria-pressed={isContextBlock}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleComments(e.currentTarget);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
                    commentsOpen
                      ? "border-[var(--primary)]/30 bg-[var(--primary)]/8 text-[var(--foreground)]"
                      : hasComments
                        ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                  )}
                  title={hasComments ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
                  aria-pressed={commentsOpen}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {hasComments && !commentsOpen && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--surface)] text-[8px] font-medium leading-none">
                      {comments.length > 9 ? "9+" : comments.length}
                    </span>
                  )}
                </button>
                {workspaceId && projectId && referencePicker && !isTempBlock && (
                  <button
                    ref={attachmentTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = e.currentTarget as HTMLElement;
                      referencePicker.openPicker({
                        anchorRect: el.getBoundingClientRect(),
                        getAnchorRect: () => attachmentTriggerRef.current?.getBoundingClientRect() ?? null,
                      });
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    title="Attach reference"
                    aria-label="Attach reference"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {borderless && !readOnly && !isPlanLocked && (
          <div className="absolute top-2 -right-4 z-[70] flex flex-col items-center gap-1.5">
            {block.type === "table" && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={blockMenuTriggerRef}
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
                    <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                      {blockTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={`add-above-${option.type}`}
                          onClick={() => {
                            onAddBlockAbove?.(block.id, option.type);
                            setMenuOpen(false);
                          }}
                          className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                          <Images className="h-3 w-3" />
                          <span>Gallery</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                          {galleryLayouts.map((g) => (
                            <DropdownMenuItem
                              key={`add-above-gallery-${g.layout}`}
                              onClick={() => {
                                onAddBlockAbove?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                setMenuOpen(false);
                              }}
                              className="!py-1 !px-1.5 !text-[10px]"
                            >
                              <span>{g.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                          <LayoutGrid className="h-3 w-3" />
                          <span>Cards</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                          {cardsLayouts.map((c) => (
                            <DropdownMenuItem
                              key={`add-above-cards-${c.label}`}
                              onClick={() => {
                                onAddBlockAbove?.(block.id, "cards", c.content);
                                setMenuOpen(false);
                              }}
                              className="!py-1 !px-1.5 !text-[10px]"
                            >
                              <span>{c.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add block below
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                      {blockTypeOptions.map((option) => (
                        <DropdownMenuItem
                          key={`add-below-${option.type}`}
                          onClick={() => {
                            onAddBlockBelow?.(block.id, option.type);
                            setMenuOpen(false);
                          }}
                          className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                          <Images className="h-3 w-3" />
                          <span>Gallery</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                          {galleryLayouts.map((g) => (
                            <DropdownMenuItem
                              key={`add-below-gallery-${g.layout}`}
                              onClick={() => {
                                onAddBlockBelow?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                setMenuOpen(false);
                              }}
                              className="!py-1 !px-1.5 !text-[10px]"
                            >
                              <span>{g.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                          <LayoutGrid className="h-3 w-3" />
                          <span>Cards</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                          {cardsLayouts.map((c) => (
                            <DropdownMenuItem
                              key={`add-below-cards-${c.label}`}
                              onClick={() => {
                                onAddBlockBelow?.(block.id, "cards", c.content);
                                setMenuOpen(false);
                              }}
                              className="!py-1 !px-1.5 !text-[10px]"
                            >
                              <span>{c.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
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
                    <DropdownMenuSubContent className="min-w-0 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                      {blockTypeOptions
                        .filter((option) => option.type !== block.type)
                        .map((option) => (
                          <DropdownMenuItem
                            key={option.type}
                            onClick={() => {
                              onConvert?.(block.id, option.type);
                              setMenuOpen(false);
                            }}
                            className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3"
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </DropdownMenuItem>
                        ))}
                      {(block.type as Block["type"]) !== "gallery" && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <Images className="h-3 w-3" />
                            <span>Gallery</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {galleryLayouts.map((g) => (
                              <DropdownMenuItem
                                key={`convert-gallery-${g.layout}`}
                                onClick={() => {
                                  onConvert?.(block.id, "gallery", getGalleryContentPreset(g.layout));
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{g.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      {(block.type as Block["type"]) !== "cards" && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="!py-1 !px-1.5 !text-[10px] !gap-1 [&_svg]:h-3 [&_svg]:w-3">
                            <LayoutGrid className="h-3 w-3" />
                            <span>Cards</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-0 w-32 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 shadow-popover">
                            {cardsLayouts.map((c) => (
                              <DropdownMenuItem
                                key={`convert-cards-${c.label}`}
                                onClick={() => {
                                  onConvert?.(block.id, "cards", c.content);
                                  setMenuOpen(false);
                                }}
                                className="!py-1 !px-1.5 !text-[10px]"
                              >
                                <span>{c.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
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
                      openComments(blockMenuTriggerRef.current);
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
                    onClick={openPropertiesMenu}
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
            {!isPlanLocked && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleLock();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isTogglingLock}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md border text-[var(--tertiary-foreground)] transition-colors",
                    isLocked
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-[var(--border)] bg-[var(--surface)] hover:text-[var(--foreground)]"
                  )}
                  title={isLocked ? "Unlock block for editing" : "Lock block to prevent edits"}
                >
                  {isLocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleComments(e.currentTarget);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
                    commentsOpen
                      ? "border-[var(--primary)]/30 bg-[var(--primary)]/8 text-[var(--foreground)]"
                      : hasComments
                        ? "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)]"
                  )}
                  title={hasComments ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
                  aria-pressed={commentsOpen}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {hasComments && !commentsOpen && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--surface)] text-[8px] font-medium leading-none">
                      {comments.length > 9 ? "9+" : comments.length}
                    </span>
                  )}
                </button>
                {workspaceId && projectId && referencePicker && !isTempBlock && (
                  <button
                    ref={attachmentTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = e.currentTarget as HTMLElement;
                      referencePicker.openPicker({
                        anchorRect: el.getBoundingClientRect(),
                        getAnchorRect: () => attachmentTriggerRef.current?.getBoundingClientRect() ?? null,
                      });
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    title="Attach reference"
                    aria-label="Attach reference"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {block.is_template && (
          <div className="absolute -top-3 left-3 flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-green-700 shadow-sm">
            <Copy className="h-2.5 w-2.5" />
            {block.template_name || "REUSABLE"}
          </div>
        )}

        <div className={cn("relative flex items-start gap-0", borderless && "space-y-3")}>
          <div className={cn("flex-1 min-w-0 space-y-2.5", borderless && "space-y-3", isPlanLocked && "pointer-events-none select-none blur-[10px]")}>
            {children}

            {/* Property Badges */}
            {!isPlanLocked && (workspaceId || readOnly) && hasProperties && direct && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--border)]/50">
                <PropertyBadges
                  properties={direct}
                  onClick={openPropertiesMenu}
                  memberNames={getMemberNames(direct)}
                />
              </div>
            )}

            {!isPlanLocked && workspaceId && projectId && !isTempBlock && (
              <div className="pt-2">
                <BlockReferencesPanel blockId={block.id} readOnly={readOnly} />
              </div>
            )}
          </div>

          {/* Block Comments popup */}
          {commentsOpen && !readOnly && !isPlanLocked && (
            <BlockComments
              block={block}
              onUpdate={onUpdate}
              isOpen={commentsOpen ? true : undefined}
              onToggle={closeComments}
              side={commentsPanelPosition.side}
              anchorRect={commentsAnchorRect}
            />
          )}
          {isPlanLocked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--background)]/35">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm">
                <Lock className="h-3.5 w-3.5" />
                Locked on Free
              </div>
            </div>
          )}
        </div>
        {block.type === "embed" && !readOnly && !isPlanLocked && (
          <div
            className="mt-1 flex justify-end cursor-row-resize select-none"
            onMouseDown={handleEmbedResizeMouseDown}
          >
            <div className="h-1 w-10 rounded-full bg-[var(--border)] hover:bg-[var(--foreground)]" />
          </div>
        )}
      </div>

      {!readOnly && !isPlanLocked && (
        <MakeTemplateDialog
          isOpen={makeTemplateDialogOpen}
          onClose={() => setMakeTemplateDialogOpen(false)}
          blockId={block.id}
          blockType={block.type}
          onSuccess={() => onUpdate?.()}
        />
      )}

      {/* Properties Panel */}
      {!readOnly && workspaceId && !isPlanLocked && (
        <PropertyMenu
          open={propertiesOpen}
          onOpenChange={(open) => {
            setPropertiesOpen(open);
            if (!open) setPropertiesAnchorRect(null);
          }}
          anchorRef={blockMenuTriggerRef}
          anchorRect={propertiesAnchorRect}
          entityType="block"
          entityId={block.id}
          workspaceId={workspaceId}
          entityTitle={getBlockTitle(block)}
          projectId={projectId}
          disabledFields={
            isLocked
              ? {
                  status: true,
                  priority: true,
                  assignees: true,
                  dueDate: true,
                  tags: true,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function countEntityProperties(
  props: { status?: unknown; priority?: unknown; assignee_id?: unknown; assignee_ids?: unknown[]; due_date?: unknown; tags?: unknown } | null | undefined
): number {
  if (!props) return 0;
  const tags = Array.isArray(props.tags) ? props.tags : [];
  const assigneeCount = Array.isArray((props as any).assignee_ids)
    ? (props as any).assignee_ids.length
    : (props.assignee_id ? 1 : 0);
  const dueDate = hasDueDate(normalizeDueDateRange(props.due_date));
  return (
    (props.status ? 1 : 0) +
    (props.priority ? 1 : 0) +
    assigneeCount +
    (dueDate ? 1 : 0) +
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
      return (content.title as string) ?? "Timeline";

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

    case "section_header":
      return (content.title as string) ?? "Section Header";

    case "doc_reference":
      return (content.title as string) ?? "Document reference";

    case "shopify_product":
      return (content.title as string) ?? "Shopify product";

    case "pdf":
      return (content.filename as string) ?? "File";

    case "chart":
      return (content.title as string) ?? "Chart";

    default:
      return `${block.type} block`;
  }
}
