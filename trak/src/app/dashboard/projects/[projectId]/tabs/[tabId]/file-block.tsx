"use client";

import { useState, useEffect } from "react";
import { type Block } from "@/app/actions/block";
import { getBlockFiles, getFileUrl, detachFileFromBlock } from "@/app/actions/file";
import { FileText, Image, Video, Music, Archive, File, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileBlockProps {
  block: Block;
  workspaceId: string;
  projectId: string;
  onUpdate?: () => void;
}

interface BlockFile {
  id: string;
  display_mode: string;
  file: {
    id: string;
    file_name: string;
    file_size: number;
    file_type: string;
    storage_path: string;
    created_at: string;
  };
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

export default function FileBlock({ block, workspaceId, projectId, onUpdate }: FileBlockProps) {
  const [files, setFiles] = useState<BlockFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadFiles();
  }, [block.id]);

  const loadFiles = async () => {
    // Skip loading if this is a temporary block (not yet saved to database)
    if (block.id.startsWith('temp-')) {
      setLoading(false);
      setFiles([]);
      return;
    }
    
    setLoading(true);
    const result = await getBlockFiles(block.id);
    
    if (result.data) {
      // Handle Supabase foreign key returning array vs object
      const normalizedFiles = result.data.map((item: any) => ({
        ...item,
        file: Array.isArray(item.file) ? item.file[0] : item.file
      }));
      setFiles(normalizedFiles);
      
      // Load signed URLs for images
      const imageFiles = normalizedFiles.filter((f) => f.file?.file_type?.startsWith("image/"));
      
      const urls: Record<string, string> = {};
      for (const file of imageFiles) {
        try {
          const urlResult = await getFileUrl(file.file.id);
          
          if (urlResult.data?.url) {
            urls[file.file.id] = urlResult.data.url;
          }
        } catch (error) {
          // Silent fail - image won't display
        }
      }
      setFileUrls(urls);
    }
    setLoading(false);
  };

  const handleDeleteFile = async (attachmentId: string) => {
    const result = await detachFileFromBlock(attachmentId);
    if (!result.error) {
      await loadFiles();
      onUpdate?.();
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
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

  const handleImageError = (fileId: string) => {
    setImageErrors((prev) => ({ ...prev, [fileId]: true }));
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading files…</div>;
  }

  // Show empty state if no files
  if (files.length === 0) {
    return (
      <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
        No files attached. Use the block menu to upload files.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[var(--tertiary-foreground)]">
        <span className="uppercase tracking-wide">Files</span>
        <span>{files.length} attached</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {files.map((blockFile) => {
            const file = blockFile.file;
            const FileIcon = getFileIcon(file.file_type);
            const isImage = file.file_type.startsWith("image/");
            const imageUrl = fileUrls[file.id];
            const imageFailed = imageErrors[file.id];
 
            return (
              <div
                key={blockFile.id}
                className="group relative overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 ease-out hover:border-[var(--foreground)]/20"
              >
                {/* Image Thumbnail - only show for images */}
                {isImage && imageUrl && !imageFailed ? (
                  <div className="relative aspect-square bg-[var(--surface-hover)]">
                    <img
                      src={imageUrl}
                      alt={file.file_name}
                      className="h-full w-full object-cover"
                      onError={() => handleImageError(file.id)}
                    />
                  </div>
                ) : isImage && !imageUrl ? (
                  <div className="flex aspect-square items-center justify-center bg-[var(--surface-hover)]">
                    <div className="rounded-[4px] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--tertiary-foreground)]">
                      {imageFailed ? "❌ Failed" : "⏳ Loading..."}
                    </div>
                  </div>
                ) : null}
 
                {/* File Info */}
                <div className={cn("p-2.5", !isImage && "flex items-center gap-2")}> 
                  {!isImage && (
                    <FileIcon className="h-5 w-5 flex-shrink-0 text-[var(--muted-foreground)]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--foreground)]">{file.file_name}</p>
                    <p className="text-[11px] text-[var(--tertiary-foreground)]">{formatFileSize(file.file_size)}</p>
                  </div>
                </div>
 
                {/* Hover Actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleDownloadFile(file.id, file.file_name)}
                    className="rounded-[4px] bg-white/90 p-2 text-neutral-700 transition-colors hover:bg-white"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(blockFile.id)}
                    className="rounded-[4px] bg-white/90 p-2 text-red-600 transition-colors hover:bg-white"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

