"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { useFileUrls } from "./tab-canvas";
import { Upload, Loader2, Maximize2, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function ImageBlock({ block, workspaceId, projectId, onUpdate }: ImageBlockProps) {
  // Get file URLs from context (prefetched at page level)
  const fileUrls = useFileUrls();
  const fileId = block.content?.fileId as string;
  const imageUrl = fileId ? fileUrls[fileId] : null;
  
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [caption, setCaption] = useState((block.content?.caption as string) || "");
  const [savingCaption, setSavingCaption] = useState(false);
  const [width, setWidth] = useState((block.content?.width as number) || 400);
  const [dragInfo, setDragInfo] = useState<{ startX: number; startWidth: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 50MB limit");
      return;
    }

    await uploadImage(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 50MB limit");
      return;
    }

    await uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    if (!workspaceId || !projectId) return;

    setUploading(true);
    const supabase = createClient();

    try {
      // Generate file ID and storage path
      const fileId = crypto.randomUUID();
      const fileExtension = file.name.split(".").pop() || "";
      const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("files")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Upload failed: " + uploadError.message);
        setUploading(false);
        return;
      }

      // Create database record via server action
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
        // Cleanup: delete uploaded file from storage
        await supabase.storage.from("files").remove([storagePath]);
        alert("Failed to create file record: " + result.error);
        setUploading(false);
        return;
      }

      // Update block content with fileId
      const updateResult = await updateBlock({
        blockId: block.id,
        content: { 
          fileId,
          caption: "",
          width: 400,
        },
      });

      if (updateResult.error) {
        alert("Failed to update image block: " + updateResult.error);
      } else {
        onUpdate?.(updateResult.data);
      }
      setUploading(false);
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Upload failed: " + error.message);
      setUploading(false);
    }
  };

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    
    // Clear existing timeout
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current);
    }
    
    // Debounce save
    setSavingCaption(true);
    captionTimeoutRef.current = setTimeout(async () => {
      const result = await updateBlock({
        blockId: block.id,
        content: {
          ...block.content,
          caption: value,
        },
      });
      setSavingCaption(false);
      if (result.data) {
        onUpdate?.(result.data);
      }
    }, 1000);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragInfo({ startX: e.clientX, startWidth: width });
  };

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!dragInfo) return;
      
      const delta = e.clientX - dragInfo.startX;
      const newWidth = Math.max(100, Math.min(800, dragInfo.startWidth + delta));
      setWidth(newWidth);
    };

    const handleResizeEnd = () => {
      if (!dragInfo) return;
      
      // Save width to block
      updateBlock({
        blockId: block.id,
        content: {
          ...block.content,
          width: width,
        },
      }).then((result) => {
        if (result.data) {
          onUpdate?.(result.data);
        }
      });
      
      setDragInfo(null);
    };

    if (dragInfo) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [dragInfo, width, block.id, block.content, onUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
    };
  }, []);

  // Empty state - show upload zone
  if (!block.content?.fileId && !uploading) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="p-8 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg cursor-pointer transition-colors hover:border-neutral-400 dark:hover:border-neutral-600"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <ImageIcon className="w-12 h-12 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Drop image here or click to browse
          </p>
          <p className="text-xs text-neutral-500">
            Maximum 50MB
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (uploading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  // Image display
  return (
    <div className="p-4">
      <div className="relative inline-block group" style={{ maxWidth: "100%" }}>
        {/* Image Container with Resize Handle */}
        <div
          className="relative"
          style={{ width: `${width}px`, maxWidth: "100%" }}
        >
          {imageUrl ? (
            <div className="relative w-full" style={{ minHeight: '200px' }}>
              <Image
                src={imageUrl}
                alt={caption || "Image"}
                width={width}
                height={Math.round(width * 0.75)}
                onClick={() => setLightboxOpen(true)}
                className="w-full h-auto rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                loading="lazy"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-full h-48 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-neutral-400" />
            </div>
          )}
          
          {/* Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 rounded-tl-lg cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      {/* Caption Input */}
      <div className="mt-2">
        <input
          type="text"
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="Add caption..."
          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-400 dark:focus:border-neutral-600 focus:outline-none bg-transparent text-neutral-600 dark:text-neutral-400"
        />
        {savingCaption && (
          <span className="text-xs text-neutral-500 ml-2">Saving...</span>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            className="absolute top-4 right-4 text-white hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Full-Size Image */}
          <Image
            src={imageUrl}
            alt={caption || "Image"}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg"
            width={1920}
            height={1080}
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
