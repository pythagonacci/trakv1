"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { type Block, updateBlock } from "@/app/actions/block";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { useFileUrls } from "./tab-canvas";
import { Loader2, X, Image as ImageIcon, Images } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
}

type GalleryLayout = "3x3" | "2x3";

type GalleryItem = {
  fileId: string | null;
  caption?: string;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const GALLERY_LAYOUTS: Record<GalleryLayout, { label: string; columns: number; rows: number }> = {
  "3x3": { label: "3x3", columns: 3, rows: 3 },
  "2x3": { label: "2x3", columns: 2, rows: 3 },
};

const CELL_WIDTH = 220;
const CELL_HEIGHT = 165;
const CELL_GAP = 12;

const buildItems = (rawItems: unknown, layout: GalleryLayout | null): GalleryItem[] => {
  if (!layout) return [];
  const size = GALLERY_LAYOUTS[layout].columns * GALLERY_LAYOUTS[layout].rows;
  const items = Array.isArray(rawItems) ? rawItems : [];
  const normalized: GalleryItem[] = [];

  for (let i = 0; i < size; i += 1) {
    const item = items[i] as GalleryItem | undefined;
    normalized.push({
      fileId: typeof item?.fileId === "string" ? item.fileId : null,
      caption: typeof item?.caption === "string" ? item.caption : "",
    });
  }

  return normalized;
};

export default function GalleryBlock({ block, workspaceId, projectId, onUpdate }: GalleryBlockProps) {
  const fileUrls = useFileUrls();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const [layout, setLayout] = useState<GalleryLayout | null>(
    (block.content?.layout as GalleryLayout) || null
  );
  const [items, setItems] = useState<GalleryItem[]>(
    buildItems(block.content?.items, (block.content?.layout as GalleryLayout) || null)
  );
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [uploadingSlots, setUploadingSlots] = useState<Set<number>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    const nextLayout = (block.content?.layout as GalleryLayout) || null;
    setLayout(nextLayout);
    setItems(buildItems(block.content?.items, nextLayout));
  }, [block.content]);

  useEffect(() => {
    return () => {
      captionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const persistItems = async (nextItems: GalleryItem[], nextLayout = layout) => {
    if (!nextLayout) return;
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...(block.content || {}),
        layout: nextLayout,
        items: nextItems,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    }
  };

  const handleLayoutChange = async (nextLayout: GalleryLayout) => {
    captionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    captionTimeoutsRef.current.clear();
    const nextItems = buildItems(items, nextLayout);
    setLayout(nextLayout);
    setItems(nextItems);
    await persistItems(nextItems, nextLayout);
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

  const uploadImage = async (file: File, index: number) => {
    if (!workspaceId || !projectId) return;

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

      const nextItems = items.map((item, idx) =>
        idx === index ? { ...item, fileId } : item
      );
      setItems(nextItems);
      await persistItems(nextItems);
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

  if (!layout) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Choose a gallery layout
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(GALLERY_LAYOUTS) as GalleryLayout[]).map((option) => {
            const layoutConfig = GALLERY_LAYOUTS[option];
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
                <div
                  className="mt-3 grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${layoutConfig.columns}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: layoutConfig.columns * layoutConfig.rows }).map((_, index) => (
                    <span
                      key={`${option}-${index}`}
                      className="block h-3 w-3 rounded-sm bg-neutral-200 dark:bg-neutral-700"
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const { columns, rows } = GALLERY_LAYOUTS[layout];
  const gridWidth = columns * CELL_WIDTH + (columns - 1) * CELL_GAP;
  const gridHeight = rows * CELL_HEIGHT + (rows - 1) * CELL_GAP;
  const lightboxItem = lightboxIndex !== null ? items[lightboxIndex] : null;
  const lightboxUrl = lightboxItem?.fileId ? fileUrls[lightboxItem.fileId] : null;

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Gallery layout
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Current:</span>
          <select
            value={layout}
            onChange={(e) => handleLayoutChange(e.target.value as GalleryLayout)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300"
          >
            {(Object.keys(GALLERY_LAYOUTS) as GalleryLayout[]).map((option) => (
              <option key={option} value={option}>
                {GALLERY_LAYOUTS[option].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40">
        <div className="h-[280px] md:h-[360px] overflow-auto p-3">
          <div
            className="grid"
            style={{
              gap: `${CELL_GAP}px`,
              gridTemplateColumns: `repeat(${columns}, ${CELL_WIDTH}px)`,
              gridTemplateRows: `repeat(${rows}, ${CELL_HEIGHT}px)`,
              width: `${gridWidth}px`,
              height: `${gridHeight}px`,
            }}
          >
            {items.map((item, index) => {
              const fileId = item.fileId;
              const imageUrl = fileId ? fileUrls[fileId] : null;
              const hasFile = Boolean(fileId);
              const isUploading = uploadingSlots.has(index);
              const isPendingUrl = hasFile && !imageUrl;

              return (
                <div
                  key={`gallery-slot-${index}`}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/60",
                    isUploading && "border-solid"
                  )}
                  onClick={() => {
                    if (hasFile) {
                      if (imageUrl) {
                        setLightboxIndex(index);
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
                  {isUploading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-neutral-900/70">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                    </div>
                  )}

                  {imageUrl ? (
                    <>
                      <div className="relative h-full w-full">
                        <Image
                          src={imageUrl}
                          alt={item.caption || `Gallery image ${index + 1}`}
                          width={CELL_WIDTH}
                          height={CELL_HEIGHT}
                          className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                          loading="lazy"
                          unoptimized
                        />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFilePicker(index);
                        }}
                        className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Replace
                      </button>
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <input
                          type="text"
                          value={item.caption || ""}
                          onChange={(e) => handleCaptionChange(index, e.target.value)}
                          placeholder="Add caption..."
                          className="w-full rounded-md bg-white/80 px-2 py-1 text-[11px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </>
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
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

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
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
