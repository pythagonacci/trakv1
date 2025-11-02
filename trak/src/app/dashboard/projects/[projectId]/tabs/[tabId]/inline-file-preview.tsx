"use client";

import { useState, useEffect } from "react";
import { FileText, Image, Video, Music, Archive, File, Download, Trash2 } from "lucide-react";
import { getFileUrl, detachFileFromBlock } from "@/app/actions/file";
import { cn } from "@/lib/utils";

interface InlineFilePreviewProps {
  attachmentId: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  onUpdate?: () => void;
  compact?: boolean; // Compact mode for inline display
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.startsWith("video/")) return Video;
  if (fileType.startsWith("audio/")) return Music;
  if (fileType === "application/pdf" || fileType.includes("document") || fileType.includes("text")) return FileText;
  if (fileType.includes("zip") || fileType.includes("archive")) return Archive;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

export default function InlineFilePreview({
  attachmentId,
  fileId,
  fileName,
  fileType,
  fileSize,
  onUpdate,
  compact = true,
}: InlineFilePreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isImage = fileType.startsWith("image/");
  const FileIcon = getFileIcon(fileType);

  // Load image URL if it's an image
  useEffect(() => {
    if (isImage) {
      const loadImageUrl = async () => {
        const result = await getFileUrl(fileId);
        if (result.data?.url) {
          setImageUrl(result.data.url);
        } else {
          setImageError(true);
        }
      };
      loadImageUrl();
    }
  }, [fileId, isImage]);

  const handleDownload = async () => {
    const result = await getFileUrl(fileId);
    if (result.data?.url) {
      const link = document.createElement("a");
      link.href = result.data.url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async () => {
    const result = await detachFileFromBlock(attachmentId);
    if (!result.error) {
      onUpdate?.();
    }
  };

  if (compact) {
    // Compact inline mode - simple row layout
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 my-2 group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Icon or thumbnail */}
        {isImage && imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={fileName}
            className="w-10 h-10 rounded object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <FileIcon className="w-5 h-5 text-neutral-600 dark:text-neutral-400 shrink-0" />
        )}

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {fileName}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatFileSize(fileSize)}
          </div>
        </div>

        {/* Hover actions */}
        {hovered && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleDownload}
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Remove"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full-size mode (similar to current grid cards)
  return (
    <div
      className="group relative border rounded-lg overflow-hidden bg-white dark:bg-neutral-900 hover:shadow-md transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image Thumbnail or Icon */}
      {isImage && imageUrl && !imageError ? (
        <div className="aspect-square relative bg-neutral-100 dark:bg-neutral-800">
          <img
            src={imageUrl}
            alt={fileName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="aspect-square flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
          <FileIcon className="w-8 h-8 text-neutral-400" />
        </div>
      )}

      {/* File Info */}
      <div className="p-2">
        <p className="text-xs font-medium truncate mb-1">{fileName}</p>
        <p className="text-xs text-neutral-500">{formatFileSize(fileSize)}</p>
      </div>

      {/* Hover Actions */}
      {hovered && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 bg-white/90 rounded hover:bg-white transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-neutral-700" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 bg-white/90 rounded hover:bg-white transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}

