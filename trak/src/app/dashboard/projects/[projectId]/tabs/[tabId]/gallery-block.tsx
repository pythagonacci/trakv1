"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { type Block, updateBlock } from "@/app/actions/block";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { createFileComment } from "@/app/actions/file-comments";
import { useFileUrls } from "./tab-canvas";
import { Loader2, X, Image as ImageIcon, Images, Maximize2, Minimize2, Settings, Pencil, Plus, MessageSquare, Send, Replace, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useBlockReferencePicker } from "@/components/blocks/block-reference-picker-provider";
import type { LinkableItem } from "@/app/actions/timelines/linkable-actions";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GalleryBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
}

type GalleryLayout = "array" | "collage";
type ImageFitMode = "contain" | "cover";
type CaptionsMode = "always" | "hover" | "hidden";

type GalleryItem = {
  fileId: string | null;
  caption?: string;
  fitMode?: ImageFitMode;
  /** Collage-only: display width in px; height derived from aspectRatio */
  width?: number;
  /** Collage-only: width/height ratio */
  aspectRatio?: number;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const DEFAULT_ARRAY_COLUMNS = 2;
const DEFAULT_ARRAY_ROWS = 2;
const MIN_ARRAY_DIMENSION = 1;
const MAX_ARRAY_DIMENSION = 8;
const GALLERY_LAYOUTS: Record<GalleryLayout, { label: string }> = {
  collage: { label: "Collage" },
  array: { label: "Array" },
};

const CELL_WIDTH = 150;
const CELL_HEIGHT = 112;
const CELL_GAP = 12;
const ARRAY_ROW_HEIGHT_PX = 190;
const MAX_GALLERY_HEIGHT_PX = 520;
const COLLAGE_ROW_HEIGHT = 180;
const COLLAGE_GAP = 12;
const COLLAGE_MIN_WIDTH = 80;
const COLLAGE_MAX_WIDTH = 600;

interface CollageViewProps {
  items: GalleryItem[];
  fileUrls: Record<string, string>;
  fileCommentCounts?: Record<string, number>;
  uploadingSlots: Set<number>;
  hoveredImageIndex: number | null;
  setHoveredImageIndex: (v: number | null) => void;
  imageFitMode: ImageFitMode;
  captionsMode: CaptionsMode;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onAddImage: () => void;
  onDropOnAddSlot: (e: React.DragEvent) => void;
  onRemoveImage: (index: number) => void;
  onResize: (index: number, newWidth: number) => void;
  onResizeEnd: () => void;
  onAspectRatioLoaded: (index: number, aspectRatio: number) => void;
  onCaptionChange: (index: number, value: string) => void;
  openFilePicker: (index: number) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  onImageContextMenu?: (e: React.MouseEvent, index: number) => void;
  setSideModalIndex: (v: number | null) => void;
}

function CollageView({
  items,
  fileUrls,
  fileCommentCounts,
  uploadingSlots,
  hoveredImageIndex,
  setHoveredImageIndex,
  imageFitMode,
  captionsMode,
  onReorder,
  onAddImage,
  onDropOnAddSlot,
  onRemoveImage,
  onResize,
  onResizeEnd,
  onAspectRatioLoaded,
  onCaptionChange,
  openFilePicker,
  handleDrop,
  onImageContextMenu,
  setSideModalIndex,
}: CollageViewProps) {
  // Collage: only show images (no empty add slots). Click/drop anywhere on the block to add.
  const displayItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item, idx }) => item.fileId || uploadingSlots.has(idx));
  const sortableIds = displayItems.map(({ idx }) => `collage-${idx}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = parseInt(String(active.id).replace("collage-", ""), 10);
    const newIdx = parseInt(String(over.id).replace("collage-", ""), 10);
    if (!isNaN(oldIdx) && !isNaN(newIdx) && oldIdx !== newIdx) {
      onReorder(oldIdx, newIdx);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div
          className="relative min-h-[160px] rounded-lg border-2 border-dashed border-transparent hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 cursor-pointer transition-colors flex flex-wrap items-start content-start gap-3 py-2 group/collage"
          style={{ gap: COLLAGE_GAP }}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("[data-collage-image]")) {
              onAddImage();
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files?.length) {
              onDropOnAddSlot(e);
            }
            // Don't call onAddImage() for drops with no files - that opens the file picker
            // (e.g. when user tries to reorder but native img drag fires instead)
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          {displayItems.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none text-neutral-500 dark:text-neutral-400">
              <Plus className="h-8 w-8 opacity-50" />
              <span className="text-sm">Click or drop to add image</span>
            </div>
          )}
          {displayItems.map(({ item, idx: index }) => (
            <SortableCollageImage
              key={`collage-${index}`}
              id={`collage-${index}`}
              captionsMode={captionsMode}
              item={item}
              index={index}
              fileUrl={item.fileId ? fileUrls[item.fileId] : null}
              isUploading={uploadingSlots.has(index)}
              isHovered={hoveredImageIndex === index}
              onHover={() => setHoveredImageIndex(index)}
              onLeave={() => setHoveredImageIndex(null)}
              onRemove={() => onRemoveImage(index)}
              onResize={(w) => onResize(index, w)}
              onResizeEnd={onResizeEnd}
              onAspectRatioLoaded={(ar) => onAspectRatioLoaded(index, ar)}
              onCaptionChange={(v) => onCaptionChange(index, v)}
              onClick={() => item.fileId && setSideModalIndex(index)}
              onAddClick={() => openFilePicker(index)}
              onDrop={(e) => handleDrop(e, index)}
              onContextMenu={(e) => onImageContextMenu?.(e, index)}
              commentCount={item.fileId ? (fileCommentCounts?.[item.fileId] || 0) : 0}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCollageImage({
  id,
  captionsMode,
  item,
  index,
  fileUrl,
  isUploading,
  isHovered,
  onHover,
  onLeave,
  onRemove,
  onResize,
  onAspectRatioLoaded,
  onCaptionChange,
  onClick,
  onAddClick,
  onDrop,
  onResizeEnd,
  onContextMenu,
  commentCount,
}: {
  id: string;
  captionsMode: CaptionsMode;
  item: GalleryItem;
  index: number;
  fileUrl: string | null;
  isUploading: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onRemove: () => void;
  onResize: (width: number) => void;
  onResizeEnd: () => void;
  onAspectRatioLoaded: (aspectRatio: number) => void;
  onCaptionChange: (value: string) => void;
  onClick: () => void;
  onAddClick: () => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  commentCount?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} data-collage-image className={cn("shrink-0 flex flex-col", isDragging && "opacity-60 z-10")}>
      <CollageImage
        captionsMode={captionsMode}
        item={item}
        index={index}
        fileUrl={fileUrl}
        isUploading={isUploading}
        isHovered={isHovered}
        onHover={onHover}
        onLeave={onLeave}
        onRemove={onRemove}
        onResize={onResize}
        onAspectRatioLoaded={onAspectRatioLoaded}
        onCaptionChange={onCaptionChange}
        onClick={onClick}
        onAddClick={onAddClick}
        onDrop={onDrop}
        onResizeEnd={onResizeEnd}
        onContextMenu={onContextMenu}
        commentCount={commentCount}
        dragHandleProps={{ attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as unknown as Record<string, unknown> }}
      />
    </div>
  );
}

function CollageImage({
  item,
  index,
  fileUrl,
  isUploading,
  isHovered,
  captionsMode = "always",
  onHover,
  onLeave,
  onRemove,
  onResize,
  onAspectRatioLoaded,
  onCaptionChange,
  onClick,
  onAddClick,
  onDrop,
  onResizeEnd,
  onContextMenu,
  commentCount = 0,
  dragHandleProps,
}: {
  item: GalleryItem;
  index: number;
  fileUrl: string | null;
  isUploading: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onRemove: () => void;
  onResize: (width: number) => void;
  onResizeEnd: () => void;
  onAspectRatioLoaded: (aspectRatio: number) => void;
  onCaptionChange: (value: string) => void;
  onClick: () => void;
  onAddClick: () => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  commentCount?: number;
  captionsMode?: CaptionsMode;
  dragHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const width = item.width ?? 200;
  const aspectRatio = item.aspectRatio ?? 1;
  const height = width / aspectRatio;

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(COLLAGE_MIN_WIDTH, Math.min(COLLAGE_MAX_WIDTH, ev.clientX - rect.left));
      onResize(newWidth);
    };
    const onUp = () => {
      onResizeEnd();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  if (!fileUrl && !isUploading) {
    return (
      <div
        ref={containerRef}
        onClick={onAddClick}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(e);
        }}
        onDragOver={(e) => e.preventDefault()}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={cn(
          "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-800/30 transition-colors hover:border-neutral-400 dark:hover:border-neutral-600",
          isUploading && "border-solid"
        )}
        style={{ width: 120, height: 120 }}
      >
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        ) : (
          <>
            <ImageIcon className="h-8 w-8 text-neutral-400" />
            <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] text-neutral-500">Add image</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="group flex flex-col shrink-0"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div
        ref={containerRef}
        onClick={onClick}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop(e);
        }}
        onContextMenu={onContextMenu}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60 transition-all",
          isUploading && "border-solid"
        )}
        style={{ width, height }}
      >
        {isUploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-neutral-900/70">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        )}
        {commentCount > 0 && (
          <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white">
            <MessageSquare className="h-3 w-3" />
            {commentCount}
          </div>
        )}
        {fileUrl && (
          <Image
            src={fileUrl}
            alt={item.caption || `Collage image ${index + 1}`}
            width={Math.round(width)}
            height={Math.round(height)}
            className="h-full w-full object-contain"
            style={{ aspectRatio }}
            draggable={false}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.naturalWidth && img.naturalHeight) {
                onAspectRatioLoaded(img.naturalWidth / img.naturalHeight);
              }
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            loading={index === 0 ? "eager" : "lazy"}
            priority={index === 0}
            unoptimized
          />
        )}
        {dragHandleProps && (
          <div
            className="absolute inset-0 z-[5] cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          />
        )}
        {isHovered && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
        {captionsMode === "hover" && isHovered && (
          <div className="absolute bottom-1 left-1 right-1 z-10">
            <input
              type="text"
              value={item.caption || ""}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Add caption..."
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded bg-black/60 px-2 py-0.5 text-[10px] text-white placeholder:text-white/70 focus:outline-none"
            />
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-tl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
          title="Drag to resize"
        />
      </div>
      {captionsMode === "always" && (
        <div className="mt-1 min-w-0 w-full">
          {isHovered ? (
            <input
              type="text"
              value={item.caption || ""}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Add caption..."
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded bg-transparent border-b border-neutral-200 dark:border-neutral-600 px-0 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
            />
          ) : item.caption ? (
            <span className="block truncate text-[10px] text-neutral-500 dark:text-neutral-400">
              {item.caption}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

const getArrayDimension = (
  value: unknown,
  fallback: number,
) => {
  if (typeof value === "number" && value >= MIN_ARRAY_DIMENSION && value <= MAX_ARRAY_DIMENSION) {
    return Math.floor(value);
  }
  return fallback;
};

const getArrayConfig = (content: Record<string, unknown> | null | undefined) => {
  const columns = getArrayDimension(content?.arrayColumns, DEFAULT_ARRAY_COLUMNS);
  const rows = getArrayDimension(content?.arrayRows, DEFAULT_ARRAY_ROWS);
  return { columns, rows };
};

const buildArrayItems = (rawItems: unknown, columns: number, rows: number): GalleryItem[] => {
  const items = Array.isArray(rawItems) ? rawItems : [];
  const size = columns * rows;
  const normalized: GalleryItem[] = [];

  for (let i = 0; i < size; i += 1) {
    const item = items[i] as GalleryItem | undefined;
    normalized.push({
      fileId: typeof item?.fileId === "string" ? item.fileId : null,
      caption: typeof item?.caption === "string" ? item.caption : "",
      fitMode: item?.fitMode === "contain" || item?.fitMode === "cover" ? item.fitMode : undefined,
    });
  }

  return normalized;
};

const buildItems = (
  rawItems: unknown,
  layout: GalleryLayout | null,
  arrayColumns = DEFAULT_ARRAY_COLUMNS,
  arrayRows = DEFAULT_ARRAY_ROWS
): GalleryItem[] => {
  if (!layout) return [];
  if (layout === "collage") {
    const items = Array.isArray(rawItems) ? rawItems : [];
    return items.map((item) => {
      const i = item as GalleryItem | undefined;
      return {
        fileId: typeof i?.fileId === "string" ? i.fileId : null,
        caption: typeof i?.caption === "string" ? i.caption : "",
        fitMode: i?.fitMode === "contain" || i?.fitMode === "cover" ? i.fitMode : undefined,
        width: typeof i?.width === "number" && i.width > 0 ? i.width : 200,
        aspectRatio: typeof i?.aspectRatio === "number" && i.aspectRatio > 0 ? i.aspectRatio : 1,
      };
    });
  }
  return buildArrayItems(rawItems, arrayColumns, arrayRows);
};

export default function GalleryBlock({ block, workspaceId, projectId, onUpdate }: GalleryBlockProps) {
  const fileUrls = useFileUrls();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const initialRawLayout = (block.content?.layout as string | undefined) || null;
  const initialLayout: GalleryLayout | null =
    initialRawLayout === "3x3" || initialRawLayout === "2x3"
      ? "array"
      : (initialRawLayout as GalleryLayout | null);

  const [layout, setLayout] = useState<GalleryLayout | null>(
    initialLayout
  );
  const initialArrayConfig = getArrayConfig((block.content || {}) as Record<string, unknown>);
  const [arrayColumns, setArrayColumns] = useState<number>(initialArrayConfig.columns);
  const [arrayRows, setArrayRows] = useState<number>(initialArrayConfig.rows);
  const [items, setItems] = useState<GalleryItem[]>(
    buildItems(
      block.content?.items,
      initialLayout,
      initialArrayConfig.columns,
      initialArrayConfig.rows
    )
  );
  const [imageFitMode, setImageFitMode] = useState<ImageFitMode>(
    (block.content?.imageFitMode as ImageFitMode) || "contain"
  );
  const [hideEmptySlots, setHideEmptySlots] = useState<boolean>(
    (block.content?.hideEmptySlots as boolean) ?? false
  );
  const [captionsMode, setCaptionsMode] = useState<CaptionsMode>(
    (block.content?.captionsMode as CaptionsMode) || "always"
  );
  const [title, setTitle] = useState<string>(
    (block.content?.title as string) || "Gallery"
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [uploadingSlots, setUploadingSlots] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sideModalIndex, setSideModalIndex] = useState<number | null>(null);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(null);
  const [isSettingsHovered, setIsSettingsHovered] = useState(false);
  const [fileCommentCounts, setFileCommentCounts] = useState<Record<string, number>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  useEffect(() => {
    const rawLayout = (block.content?.layout as string | undefined) || null;
    const nextLayout: GalleryLayout | null =
      rawLayout === "3x3" || rawLayout === "2x3" ? "array" : (rawLayout as GalleryLayout | null);
    const nextArrayConfig = getArrayConfig((block.content || {}) as Record<string, unknown>);
    setLayout(nextLayout);
    setArrayColumns(nextArrayConfig.columns);
    setArrayRows(nextArrayConfig.rows);
    setItems(buildItems(block.content?.items, nextLayout, nextArrayConfig.columns, nextArrayConfig.rows));
    setImageFitMode((block.content?.imageFitMode as ImageFitMode) || "contain");
    setHideEmptySlots((block.content?.hideEmptySlots as boolean) ?? false);
    setCaptionsMode((block.content?.captionsMode as CaptionsMode) || "always");
    setTitle((block.content?.title as string) || "Gallery");
  }, [block.content]);


  useEffect(() => {
    return () => {
      captionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    const fileIds = Array.from(
      new Set(items.map((item) => item.fileId).filter((id): id is string => Boolean(id)))
    );
    if (fileIds.length === 0) {
      setFileCommentCounts({});
      return;
    }
    const params = new URLSearchParams({ fileIds: fileIds.join(",") });
    fetch(`/api/file-analysis/comments?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const next: Record<string, number> = {};
        (json?.data || []).forEach((comment: { file_id?: string }) => {
          const fileId = comment.file_id;
          if (!fileId) return;
          next[fileId] = (next[fileId] || 0) + 1;
        });
        setFileCommentCounts(next);
      })
      .catch(() => {
        setFileCommentCounts({});
      });
  }, [items]);

  const persistItems = async (
    nextItems: GalleryItem[],
    nextLayout = layout,
    nextArrayColumns = arrayColumns,
    nextArrayRows = arrayRows,
    nextFitMode = imageFitMode,
    nextTitle = title,
    nextHideEmptySlots = hideEmptySlots,
    nextCaptionsMode = captionsMode
  ) => {
    // If layout was never set (e.g. legacy block), use a default so we don't skip saving
    // and the new image persists and triggers file URL refresh via onUpdate
    const effectiveLayout = nextLayout || "collage";
    if (!nextLayout) {
      setLayout("collage");
    }
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...(block.content || {}),
        layout: effectiveLayout,
        arrayColumns: nextArrayColumns,
        arrayRows: nextArrayRows,
        items: nextItems,
        imageFitMode: nextFitMode,
        title: nextTitle,
        hideEmptySlots: nextHideEmptySlots,
        captionsMode: nextCaptionsMode,
      },
    });
    if (result.error) {
      console.error("Failed to persist gallery block content:", {
        blockId: block.id,
        error: result.error,
      });
      return false;
    }
    if (result.data) {
      onUpdate?.(result.data);
    }
    return true;
  };

  const handleFitModeChange = async (mode: ImageFitMode) => {
    setImageFitMode(mode);
    await persistItems(items, layout, arrayColumns, arrayRows, mode);
  };

  const handleHideEmptySlotsChange = async (value: boolean) => {
    setHideEmptySlots(value);
    await persistItems(items, layout, arrayColumns, arrayRows, imageFitMode, title, value);
  };

  const handleCaptionsModeChange = async (value: CaptionsMode) => {
    setCaptionsMode(value);
    await persistItems(items, layout, arrayColumns, arrayRows, imageFitMode, title, hideEmptySlots, value);
  };

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    await persistItems(items, layout, arrayColumns, arrayRows, imageFitMode, newTitle);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (!title.trim()) {
      setTitle("Gallery");
      handleTitleChange("Gallery");
    }
  };

  const handleLayoutChange = async (nextLayout: GalleryLayout) => {
    captionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    captionTimeoutsRef.current.clear();
    let nextItems: GalleryItem[];
    if (nextLayout === "collage") {
      nextItems = buildItems(items.filter((i) => i.fileId).length ? items : [], nextLayout);
    } else {
      nextItems = buildArrayItems(
        items
          .filter((i) => i.fileId)
          .map((item) => ({ fileId: item.fileId, caption: item.caption, fitMode: item.fitMode })),
        arrayColumns,
        arrayRows
      );
    }
    setLayout(nextLayout);
    setItems(nextItems);
    await persistItems(nextItems, nextLayout, arrayColumns, arrayRows);
  };

  const handleArrayColumnsChange = async (value: number) => {
    const nextColumns = getArrayDimension(value, DEFAULT_ARRAY_COLUMNS);
    const nextItems = buildArrayItems(items, nextColumns, arrayRows);
    setArrayColumns(nextColumns);
    setItems(nextItems);
    await persistItems(nextItems, layout, nextColumns, arrayRows);
  };

  const handleArrayRowsChange = async (value: number) => {
    const nextRows = getArrayDimension(value, DEFAULT_ARRAY_ROWS);
    const nextItems = buildArrayItems(items, arrayColumns, nextRows);
    setArrayRows(nextRows);
    setItems(nextItems);
    await persistItems(nextItems, layout, arrayColumns, nextRows);
  };

  const openFilePicker = (index: number) => {
    setActiveSlot(index);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeSlot === null) {
      return;
    }
    e.target.value = "";
    await uploadImage(file, activeSlot);
    setActiveSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadImage(file, index);
  };

  const handleImageContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const fileId = items[index]?.fileId;
    if (!fileId) return;
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  const handleSubmitImageComment = async (index: number, text: string) => {
    const fileId = items[index]?.fileId;
    if (!fileId || !text.trim()) return;
    const result = await createFileComment({ fileId, text: text.trim() });
    if ("error" in result) {
      alert(result.error || "Failed to add comment");
      return;
    }
    setFileCommentCounts((prev) => ({
      ...prev,
      [fileId]: (prev[fileId] || 0) + 1,
    }));
    window.dispatchEvent(
      new CustomEvent("file-analysis-comment-saved", {
        detail: { fileId },
      })
    );
  };

  const uploadImage = async (file: File, index: number, baseItems?: GalleryItem[]) => {
    if (!workspaceId || !projectId) return;
    if ((block as any).locked) {
      alert("This gallery block is locked. Unlock it before adding images.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 50MB limit");
      return;
    }

    setUploadingSlots((prev) => new Set(prev).add(index));
    const supabase = createClient();

    try {
      const fileId = crypto.randomUUID();
      const fileExtension = file.name.split(".").pop() || "";
      const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("files")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Upload failed: " + uploadError.message);
        return;
      }

      const result = await createFileRecord({
        fileId,
        workspaceId,
        projectId,
        blockId: block.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
      });

      if (result.error) {
        await supabase.storage.from("files").remove([storagePath]);
        alert("Failed to create file record: " + result.error);
        return;
      }

      const source = baseItems ?? items;
      const nextItems = source.map((item, idx) =>
        idx === index ? { ...item, fileId } : item
      );
      setItems(nextItems);
      const persisted = await persistItems(nextItems);
      if (!persisted) {
        setItems(source);
        alert("Image uploaded, but the gallery block couldn't be saved. If this block is locked, unlock it and try again.");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setUploadingSlots((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleCaptionChange = (index: number, value: string) => {
    const nextItems = items.map((item, idx) =>
      idx === index ? { ...item, caption: value } : item
    );
    setItems(nextItems);

    const existingTimeout = captionTimeoutsRef.current.get(index);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      persistItems(nextItems);
    }, 1000);
    captionTimeoutsRef.current.set(index, timeout);
  };

  const handleImageFitModeToggle = async (index: number) => {
    const item = items[index];
    const currentFitMode = item.fitMode || imageFitMode;
    const nextFitMode: ImageFitMode = currentFitMode === "contain" ? "cover" : "contain";

    const nextItems = items.map((it, idx) =>
      idx === index ? { ...it, fitMode: nextFitMode } : it
    );
    setItems(nextItems);
    await persistItems(nextItems);
  };

  const handleAddCollageImage = async () => {
    const newItem: GalleryItem = { fileId: null, caption: "", width: 200, aspectRatio: 1 };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    await persistItems(nextItems);
    openFilePicker(nextItems.length - 1);
  };

  const handleDropOnAddSlot = async (e: React.DragEvent) => {
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    e.preventDefault();
    const newItem: GalleryItem = { fileId: null, caption: "", width: 200, aspectRatio: 1 };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    await persistItems(nextItems);
    await uploadImage(file, nextItems.length - 1, nextItems);
  };

  const handleRemoveCollageImage = async (index: number) => {
    const nextItems = items.filter((_, i) => i !== index);
    setItems(nextItems);
    await persistItems(nextItems);
    if (sideModalIndex === index) setSideModalIndex(null);
    if (sideModalIndex !== null && sideModalIndex > index) setSideModalIndex(sideModalIndex - 1);
  };

  const handleCollageReorder = async (oldIndex: number, newIndex: number) => {
    const nextItems = arrayMove(items, oldIndex, newIndex);
    setItems(nextItems);
    await persistItems(nextItems);
    if (sideModalIndex === oldIndex) setSideModalIndex(newIndex);
    else if (sideModalIndex !== null && sideModalIndex > oldIndex && sideModalIndex <= newIndex)
      setSideModalIndex(sideModalIndex - 1);
    else if (sideModalIndex !== null && sideModalIndex < oldIndex && sideModalIndex >= newIndex)
      setSideModalIndex(sideModalIndex + 1);
  };

  const collageResizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collageItemsRef = useRef<GalleryItem[]>(items);
  collageItemsRef.current = items;

  const handleCollageResize = (index: number, newWidth: number) => {
    const w = Math.max(COLLAGE_MIN_WIDTH, Math.min(COLLAGE_MAX_WIDTH, newWidth));
    setItems((prev) => {
      const next = prev.map((it, i) => (i === index ? { ...it, width: w } : it));
      collageItemsRef.current = next;
      if (collageResizeTimeoutRef.current) clearTimeout(collageResizeTimeoutRef.current);
      collageResizeTimeoutRef.current = setTimeout(() => {
        collageResizeTimeoutRef.current = null;
        persistItems(next);
      }, 400);
      return next;
    });
  };

  const handleCollageResizeEnd = () => {
    if (collageResizeTimeoutRef.current) {
      clearTimeout(collageResizeTimeoutRef.current);
      collageResizeTimeoutRef.current = null;
      persistItems(collageItemsRef.current);
    }
  };

  const handleCollageAspectRatioLoaded = (index: number, aspectRatio: number) => {
    setItems((prev) => {
      if (prev[index]?.aspectRatio === aspectRatio) return prev;
      const next = prev.map((it, i) => (i === index ? { ...it, aspectRatio } : it));
      queueMicrotask(() => persistItems(next));
      return next;
    });
  };

  if (!layout) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Choose a gallery layout
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(GALLERY_LAYOUTS) as GalleryLayout[]).map((option) => {
            const layoutConfig = GALLERY_LAYOUTS[option];
            const isCollage = option === "collage";
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleLayoutChange(option)}
                className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-4 text-left transition-colors hover:border-neutral-400 dark:hover:border-neutral-600"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {layoutConfig.label}
                  </span>
                  <Images className="h-4 w-4 text-neutral-500" />
                </div>
                {isCollage ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[3, 2, 2, 4].map((w, i) => (
                      <span
                        key={`${option}-${i}`}
                        className="rounded-sm bg-neutral-200 dark:bg-neutral-700"
                        style={{ width: w * 8, height: 8 }}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className="mt-3 grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(2, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: 4 }).map((_, index) => (
                      <span
                        key={`${option}-${index}`}
                        className="block h-3 w-3 rounded-sm bg-neutral-200 dark:bg-neutral-700"
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isCollage = layout === "collage";
  const columns = isCollage ? 0 : arrayColumns;
  const rows = isCollage ? 0 : arrayRows;
  const lightboxItem = lightboxIndex !== null ? items[lightboxIndex] : null;
  const lightboxUrl = lightboxItem?.fileId ? fileUrls[lightboxItem.fileId] : null;

  // Grid: only show filled slots + add button; block resizes
  const gridDisplayItems = !isCollage
    ? items.map((item, idx) => ({ item, idx }))
    : items.map((item, idx) => ({ item, idx }));
  const displayRows = !isCollage ? rows : rows;
  const naturalHeight = displayRows * ARRAY_ROW_HEIGHT_PX + (displayRows - 1) * CELL_GAP;
  const galleryHeight = displayRows ? Math.min(MAX_GALLERY_HEIGHT_PX, naturalHeight) : 0;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 relative">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTitleBlur();
                }
              }}
              className="text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-transparent border-b border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-500 dark:focus:border-neutral-500 flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <div
              className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-2 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 group"
              onClick={() => setIsEditingTitle(true)}
            >
              <span>{title}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <div className="flex rounded-md border border-neutral-200 dark:border-neutral-700 p-0.5">
            <button
              type="button"
              onClick={() => handleLayoutChange("collage")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                isCollage
                  ? "bg-neutral-200 dark:bg-neutral-600 text-neutral-900 dark:text-white"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              )}
            >
              Collage
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange("array")}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                !isCollage
                  ? "bg-neutral-200 dark:bg-neutral-600 text-neutral-900 dark:text-white"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              )}
            >
              Array
            </button>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            title="Gallery settings"
            onMouseEnter={() => setIsSettingsHovered(true)}
            onMouseLeave={() => setIsSettingsHovered(false)}
          >
            <Settings className="h-4 w-4" />
          </button>
          <div
            className={cn(
              "absolute right-0 top-full pt-1 transition-all duration-200 z-10",
              isSettingsHovered ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
            )}
            onMouseEnter={() => setIsSettingsHovered(true)}
            onMouseLeave={() => setIsSettingsHovered(false)}
          >
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg p-3 min-w-[200px]">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                    Layout
                  </label>
                  <select
                    value={layout}
                    onChange={(e) => handleLayoutChange(e.target.value as GalleryLayout)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                  >
                    {(Object.keys(GALLERY_LAYOUTS) as GalleryLayout[]).map((option) => (
                      <option key={option} value={option}>
                        {GALLERY_LAYOUTS[option].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                    Captions
                  </label>
                  <select
                    value={captionsMode}
                    onChange={(e) => handleCaptionsModeChange(e.target.value as CaptionsMode)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                  >
                    <option value="always">Right underneath</option>
                    <option value="hover">On hover only</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                {!isCollage && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        Columns
                      </label>
                      <input
                        type="number"
                        min={MIN_ARRAY_DIMENSION}
                        max={MAX_ARRAY_DIMENSION}
                        value={arrayColumns}
                        onChange={(e) => void handleArrayColumnsChange(Number(e.target.value))}
                        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                        Rows
                      </label>
                      <input
                        type="number"
                        min={MIN_ARRAY_DIMENSION}
                        max={MAX_ARRAY_DIMENSION}
                        value={arrayRows}
                        onChange={(e) => void handleArrayRowsChange(Number(e.target.value))}
                        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                      />
                    </div>
                  </div>
                )}
                {!isCollage && (
                  <div>
                    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                      Default Image Fit
                    </label>
                    <select
                      value={imageFitMode}
                      onChange={(e) => handleFitModeChange(e.target.value as ImageFitMode)}
                      className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                    >
                      <option value="contain">Fit (show full image)</option>
                      <option value="cover">Fill (crop to fill)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40">
        <div className="p-3">
          {sideModalIndex !== null ? (
            <div className="flex gap-3 h-[500px]">
              {/* Compressed gallery on the left */}
              <div className="flex-shrink-0 overflow-y-auto" style={{ width: `${CELL_WIDTH * 2 + CELL_GAP}px` }}>
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(2, ${CELL_WIDTH}px)`,
                  }}
                >
                  {items
                    .map((item, index) => ({ item, index }))
                    .filter(({ item, index }) => index !== sideModalIndex && item.fileId)
                    .map(({ item, index }) => {
                      const fileId = item.fileId;
                      const imageUrl = fileId ? fileUrls[fileId] : null;
                      const isUploading = uploadingSlots.has(index);
                      const isPendingUrl = Boolean(fileId) && !imageUrl;
                      const itemFitMode = item.fitMode || imageFitMode;

                      return (
                        <div
                          key={`compressed-slot-${index}`}
                          className={cn(
                            "relative overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60 cursor-pointer transition-all hover:border-neutral-400 dark:hover:border-neutral-600",
                            isUploading && "border-solid"
                          )}
                          style={{ width: `${CELL_WIDTH}px`, height: `${CELL_HEIGHT}px` }}
                          onClick={() => setSideModalIndex(index)}
                          onContextMenu={(e) => {
                            void handleImageContextMenu(e, index);
                          }}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          {!!fileId && (fileCommentCounts[fileId] || 0) > 0 && (
                            <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white">
                              <MessageSquare className="h-3 w-3" />
                              {fileCommentCounts[fileId]}
                            </div>
                          )}
                          {isUploading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-neutral-900/70">
                              <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                            </div>
                          )}

                          {imageUrl ? (
                            <div className={cn(
                              "relative w-full h-full",
                              itemFitMode === "contain" && "flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/50"
                            )}>
                              <Image
                                src={imageUrl}
                                alt={item.caption || `Gallery image ${index + 1}`}
                                width={CELL_WIDTH}
                                height={CELL_HEIGHT}
                                className={cn(
                                  itemFitMode === "contain"
                                    ? "max-h-full max-w-full object-contain"
                                    : "h-full w-full object-cover"
                                )}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                                loading={index === 0 ? "eager" : "lazy"}
                                priority={index === 0}
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-xs text-neutral-500">
                              {isPendingUrl ? (
                                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-neutral-400" />
                              )}
                              <span>{isPendingUrl ? "Loading image..." : "Drop image or click to upload"}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Selected image on the right */}
              <div
                className="flex-1 relative bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
                onContextMenu={(e) => {
                  if (sideModalIndex !== null && items[sideModalIndex]?.fileId) {
                    handleImageContextMenu(e, sideModalIndex);
                  }
                }}
              >
                {sideModalIndex !== null && items[sideModalIndex]?.fileId && fileUrls[items[sideModalIndex].fileId!] ? (
                  <>
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const fileId = items[sideModalIndex]?.fileId;
                          const count = fileId ? (fileCommentCounts[fileId] || 0) : 0;
                          handleImageContextMenu(
                            { preventDefault: () => {}, stopPropagation: () => {}, clientX: e.clientX, clientY: e.clientY } as React.MouseEvent,
                            sideModalIndex
                          );
                        }}
                        className="rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                        title="Comment"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSideModalIndex(null)}
                        className="rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                        title="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="relative w-full h-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/50">
                      <Image
                        src={fileUrls[items[sideModalIndex].fileId!]}
                        alt={items[sideModalIndex].caption || `Gallery image ${sideModalIndex + 1}`}
                        fill
                        className="object-contain"
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                    {items[sideModalIndex].caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-3 text-sm">
                        {items[sideModalIndex].caption}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ) : isCollage ? (
            <CollageView
              items={items}
              fileUrls={fileUrls}
              fileCommentCounts={fileCommentCounts}
              uploadingSlots={uploadingSlots}
              hoveredImageIndex={hoveredImageIndex}
              setHoveredImageIndex={setHoveredImageIndex}
              imageFitMode={imageFitMode}
              captionsMode={captionsMode}
              onReorder={handleCollageReorder}
              onAddImage={handleAddCollageImage}
              onDropOnAddSlot={handleDropOnAddSlot}
              onRemoveImage={handleRemoveCollageImage}
              onResize={handleCollageResize}
              onResizeEnd={handleCollageResizeEnd}
              onAspectRatioLoaded={handleCollageAspectRatioLoaded}
              onCaptionChange={handleCaptionChange}
              openFilePicker={openFilePicker}
              handleDrop={handleDrop}
              onImageContextMenu={handleImageContextMenu}
              setSideModalIndex={setSideModalIndex}
            />
          ) : (
            <div
              className="grid w-full"
              style={{
                gap: `${CELL_GAP}px`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${displayRows}, minmax(0, 1fr))`,
                height: `${galleryHeight}px`,
                minHeight: `${ARRAY_ROW_HEIGHT_PX}px`,
                transition: 'height 150ms ease',
              }}
            >
              {gridDisplayItems.map(({ item, idx: index }) => {
                const fileId = item.fileId;
                const imageUrl = fileId ? fileUrls[fileId] : null;
                const hasFile = Boolean(fileId);
                const isUploading = uploadingSlots.has(index);
                const isPendingUrl = hasFile && !imageUrl;
                const itemFitMode = item.fitMode || imageFitMode;

                const isHovered = hoveredImageIndex === index;

                return (
                  <div
                    key={`gallery-slot-${index}`}
                    className={cn(
                      "group relative flex flex-col min-h-0 overflow-hidden rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60",
                      isUploading && "border-solid"
                    )}
                    onMouseEnter={() => setHoveredImageIndex(index)}
                    onMouseLeave={() => setHoveredImageIndex(null)}
                    onContextMenu={(e) => {
                      void handleImageContextMenu(e, index);
                    }}
                    onClick={() => {
                      if (hasFile) {
                        if (imageUrl) {
                          setSideModalIndex(index);
                        }
                        return;
                      }
                      if (!isUploading) {
                        openFilePicker(index);
                      }
                    }}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {!!fileId && (fileCommentCounts[fileId] || 0) > 0 && (
                      <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white">
                        <MessageSquare className="h-3 w-3" />
                        {fileCommentCounts[fileId]}
                      </div>
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-neutral-900/70">
                        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                      </div>
                    )}

                    {imageUrl ? (
                      <>
                        <div className={cn(
                          "relative flex-1 min-h-0 w-full",
                          itemFitMode === "contain" && "flex items-center justify-center bg-neutral-50 dark:bg-neutral-800/50"
                        )}>
                          <Image
                            src={imageUrl}
                            alt={item.caption || `Gallery image ${index + 1}`}
                            fill
                            className={cn(
                              itemFitMode === "contain"
                                ? "object-contain"
                                : "object-cover",
                              "transition-opacity",
                              hoveredImageIndex === index && "opacity-90"
                            )}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                            loading={index === 0 ? "eager" : "lazy"}
                            priority={index === 0}
                            unoptimized
                          />
                        </div>
                        <div className={cn(
                          "absolute right-2 top-2 flex gap-1 transition-opacity",
                          hoveredImageIndex === index ? "opacity-100" : "opacity-0"
                        )}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageFitModeToggle(index);
                            }}
                            className="rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                            title={itemFitMode === "contain" ? "Fill block (crop to fill)" : "Fit image (show full)"}
                          >
                            {itemFitMode === "contain" ? (
                              <Maximize2 className="h-3 w-3" />
                            ) : (
                              <Minimize2 className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilePicker(index);
                            }}
                            className="rounded-full bg-black/60 px-2 py-1 text-[10px] text-white transition-colors hover:bg-black/80"
                          >
                            Replace
                          </button>
                        </div>
                        {captionsMode === "always" && (
                          <div className="shrink-0 px-2 py-1 min-h-0">
                            {isHovered ? (
                              <input
                                type="text"
                                value={item.caption || ""}
                                onChange={(e) => handleCaptionChange(index, e.target.value)}
                                placeholder="Add caption..."
                                className="w-full rounded-md bg-transparent border-b border-neutral-200 dark:border-neutral-600 px-0 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : item.caption ? (
                              <span className="block truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                                {item.caption}
                              </span>
                            ) : null}
                          </div>
                        )}
                        {captionsMode === "hover" && isHovered && (
                          <div className="absolute bottom-2 left-2 right-2 z-10">
                            <input
                              type="text"
                              value={item.caption || ""}
                              onChange={(e) => handleCaptionChange(index, e.target.value)}
                              placeholder="Add caption..."
                              className="w-full rounded-md bg-black/60 px-2 py-1 text-[10px] text-white placeholder:text-white/70 focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300/90 bg-neutral-100/70 text-center text-xs text-neutral-500 dark:border-neutral-600 dark:bg-neutral-800/50">
                        {isPendingUrl ? (
                          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-neutral-400" />
                        )}
                        <span>{isPendingUrl ? "Loading image..." : "Drop image or click to upload"}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {contextMenu && (
        <GalleryImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          imageIndex={contextMenu.index}
          commentCount={items[contextMenu.index]?.fileId ? (fileCommentCounts[items[contextMenu.index].fileId!] || 0) : 0}
          onClose={() => setContextMenu(null)}
          onAddComment={async (text) => {
            await handleSubmitImageComment(contextMenu.index, text);
            setContextMenu(null);
          }}
          onReplace={() => {
            openFilePicker(contextMenu.index);
            setContextMenu(null);
          }}
          onRemove={() => {
            if (isCollage) {
              handleRemoveCollageImage(contextMenu.index);
            } else {
              const nextItems = items.map((item, idx) =>
                idx === contextMenu.index ? { ...item, fileId: null } : item
              );
              setItems(nextItems);
              persistItems(nextItems);
            }
            setContextMenu(null);
          }}
          onViewExpanded={() => {
            setSideModalIndex(contextMenu.index);
            setContextMenu(null);
          }}
        />
      )}

      {lightboxIndex !== null && lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-4 top-4 rounded-full p-2 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>

          <Image
            src={lightboxUrl}
            alt={lightboxItem?.caption || "Gallery image"}
            className="max-h-full max-w-full rounded-lg object-contain"
            width={1920}
            height={1080}
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function GalleryImageContextMenu({
  x,
  y,
  commentCount,
  onClose,
  onAddComment,
  onReplace,
  onRemove,
  onViewExpanded,
}: {
  x: number;
  y: number;
  imageIndex: number;
  commentCount: number;
  onClose: () => void;
  onAddComment: (text: string) => void;
  onReplace: () => void;
  onRemove: () => void;
  onViewExpanded: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const referencePicker = useBlockReferencePicker();
  const mentionStartIndexRef = useRef<number | null>(null);
  const mentionQueryRef = useRef("");

  const clearInlineMention = () => {
    mentionStartIndexRef.current = null;
    mentionQueryRef.current = "";
  };

  const insertInlineMention = (item: LinkableItem, searchQuery?: string) => {
    const mentionStart = mentionStartIndexRef.current;
    if (mentionStart === null) return;
    const activeQuery = mentionQueryRef.current || searchQuery || "";
    const replacement = `@${item.name}`;

    setCommentText((currentValue) => {
      const safeStart = Math.min(Math.max(mentionStart, 0), currentValue.length);
      const safeEnd = Math.min(currentValue.length, safeStart + 1 + activeQuery.length);
      return currentValue.slice(0, safeStart) + replacement + currentValue.slice(safeEnd);
    });

    clearInlineMention();
    requestAnimationFrame(() => {
      if (!commentInputRef.current) return;
      const cursorPosition = mentionStart + replacement.length;
      commentInputRef.current.focus();
      commentInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const closeInlineMentionPicker = () => {
    clearInlineMention();
    referencePicker?.closePicker();
  };

  const getMentionPopoverAnchorRect = () => {
    return menuRef.current?.getBoundingClientRect() ?? commentInputRef.current?.getBoundingClientRect() ?? null;
  };

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setAdjustedPosition({
        x: x + rect.width > vw ? Math.max(8, vw - rect.width - 8) : x,
        y: y + rect.height > vh ? Math.max(8, vh - rect.height - 8) : y,
      });
    }
  }, [x, y, showCommentInput]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeInlineMentionPicker();
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeInlineMentionPicker();
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (showCommentInput) {
      requestAnimationFrame(() => commentInputRef.current?.focus());
    }
  }, [showCommentInput]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[180px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-popover"
      style={{ top: adjustedPosition.y, left: adjustedPosition.x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!showCommentInput ? (
        <>
          <button
            onClick={() => setShowCommentInput(true)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5 text-[var(--tertiary-foreground)]" />
            <span>Add comment</span>
            {commentCount > 0 && (
              <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">({commentCount})</span>
            )}
          </button>
          <button
            onClick={onViewExpanded}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[var(--tertiary-foreground)]" />
            <span>View expanded</span>
          </button>
          <div className="my-1 h-px bg-[var(--border)]" />
          <button
            onClick={onReplace}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Replace className="h-3.5 w-3.5 text-[var(--tertiary-foreground)]" />
            <span>Replace image</span>
          </button>
          <button
            onClick={onRemove}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Remove</span>
          </button>
        </>
      ) : (
        <div className="p-1.5 space-y-2" style={{ width: 260 }}>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-[var(--tertiary-foreground)]" />
            <span className="text-xs font-medium text-[var(--foreground)]">Add comment</span>
          </div>
          <textarea
            ref={commentInputRef}
            value={commentText}
            onChange={(e) => {
              const nextValue = e.target.value;
              setCommentText(nextValue);

              const mentionStart = mentionStartIndexRef.current;
              if (mentionStart === null || !referencePicker) return;

              const cursorPosition = e.currentTarget.selectionStart ?? nextValue.length;
              const shouldStopMentioning =
                mentionStart >= nextValue.length ||
                nextValue[mentionStart] !== "@" ||
                cursorPosition <= mentionStart;

              if (shouldStopMentioning) {
                closeInlineMentionPicker();
                return;
              }

              const nextQuery = nextValue.slice(mentionStart + 1, cursorPosition);
              mentionQueryRef.current = nextQuery;
              referencePicker.updateQuery?.(nextQuery);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                closeInlineMentionPicker();
                if (commentText.trim()) onAddComment(commentText);
                return;
              }
              if (e.key === "@" && referencePicker) {
                e.preventDefault();
                e.stopPropagation();
                const currentValue = e.currentTarget.value;
                const selectionStart = e.currentTarget.selectionStart ?? currentValue.length;
                const selectionEnd = e.currentTarget.selectionEnd ?? selectionStart;
                const nextValue =
                  currentValue.slice(0, selectionStart) + "@" + currentValue.slice(selectionEnd);

                setCommentText(nextValue);
                mentionStartIndexRef.current = selectionStart;
                mentionQueryRef.current = "";

                requestAnimationFrame(() => {
                  if (!commentInputRef.current) return;
                  const nextCursor = selectionStart + 1;
                  commentInputRef.current.focus();
                  commentInputRef.current.setSelectionRange(nextCursor, nextCursor);
                  referencePicker.openPicker({
                    initialQuery: "",
                    anchorRect: getMentionPopoverAnchorRect(),
                    getAnchorRect: getMentionPopoverAnchorRect,
                    popoverGap: -6,
                    onSelect: insertInlineMention,
                    onClose: clearInlineMention,
                  });
                });
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                closeInlineMentionPicker();
                setShowCommentInput(false);
                setCommentText("");
                return;
              }
              e.stopPropagation();
            }}
            onKeyUp={(e) => e.stopPropagation()}
            placeholder="Write a comment... (@ to mention)"
            className="w-full min-h-[48px] rounded-md border border-[var(--border)] bg-[var(--surface-hover)]/50 px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:border-[var(--foreground)]/20 focus:bg-[var(--surface)] resize-none transition-colors"
            rows={2}
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                closeInlineMentionPicker();
                setShowCommentInput(false);
                setCommentText("");
              }}
              className="text-[10px] text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                closeInlineMentionPicker();
                if (commentText.trim()) onAddComment(commentText);
              }}
              disabled={!commentText.trim()}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                commentText.trim()
                  ? "bg-[var(--foreground)] text-[var(--surface)] hover:opacity-90"
                  : "bg-[var(--border)] text-[var(--tertiary-foreground)] cursor-not-allowed"
              )}
            >
              <Send className="h-3 w-3" />
              Send
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function galleryGetTextareaCaretRect(textarea: HTMLTextAreaElement): DOMRect | null {
  const selectionStart = textarea.selectionStart ?? 0;
  const rect = textarea.getBoundingClientRect();
  const style = window.getComputedStyle(textarea);

  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.top = `${rect.top}px`;
  mirror.style.left = `${rect.left}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.overflow = "hidden";

  mirror.textContent = textarea.value.slice(0, selectionStart);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  const lineHeight = Number.parseFloat(style.lineHeight) || 16;
  const caretRect = new DOMRect(
    markerRect.left - textarea.scrollLeft,
    markerRect.top - textarea.scrollTop,
    1,
    lineHeight
  );

  if (
    !Number.isFinite(caretRect.top) ||
    !Number.isFinite(caretRect.left) ||
    (caretRect.top === 0 && caretRect.left === 0 && caretRect.width === 0 && caretRect.height === 0)
  ) {
    return null;
  }

  return caretRect;
}
