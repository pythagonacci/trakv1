"use client";

import { useState, useEffect } from "react";
import { type Block } from "@/app/actions/block";
import { getBlockFiles, getFileUrl, detachFileFromBlock } from "@/app/actions/file";
import { FileText, Image, Video, Music, Archive, File, Download, Trash2 } from "lucide-react";

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
    setLoading(true);
    const result = await getBlockFiles(block.id);
    
    if (result.data) {
      setFiles(result.data);
      
      // Load signed URLs for images
      const imageFiles = result.data.filter((f) => f.file.file_type.startsWith("image/"));
      
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
    return (
      <div className="p-5 text-sm text-neutral-500">Loading files...</div>
    );
  }

  // Show empty state if no files
  if (files.length === 0) {
    return (
      <div className="p-5 text-sm text-neutral-500 text-center">
        No files attached. Use the three-dot menu to attach files.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Uploaded Files Grid */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
          Uploaded Files ({files.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((blockFile) => {
            const file = blockFile.file;
            const FileIcon = getFileIcon(file.file_type);
            const isImage = file.file_type.startsWith("image/");
            const imageUrl = fileUrls[file.id];
            const imageFailed = imageErrors[file.id];

            return (
              <div
                key={blockFile.id}
                className="group relative border rounded-lg overflow-hidden bg-white dark:bg-neutral-900 hover:shadow-md transition-shadow"
              >
                {/* Image Thumbnail - only show for images */}
                {isImage && imageUrl && !imageFailed ? (
                  <div className="aspect-square relative bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={imageUrl}
                      alt={file.file_name}
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(file.id)}
                    />
                  </div>
                ) : isImage && !imageUrl ? (
                  <div className="aspect-square flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                    <div className="text-xs text-neutral-500 p-2 text-center">
                      {imageFailed ? "❌ Failed" : "⏳ Loading..."}
                    </div>
                  </div>
                ) : null}

                {/* File Info */}
                <div className={`p-2 ${!isImage ? 'flex items-center gap-2' : ''}`}>
                  {!isImage && (
                    <FileIcon className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate mb-1">{file.file_name}</p>
                    <p className="text-xs text-neutral-500">{formatFileSize(file.file_size)}</p>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleDownloadFile(file.id, file.file_name)}
                    className="p-2 bg-white/90 rounded hover:bg-white transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-neutral-700" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(blockFile.id)}
                    className="p-2 bg-white/90 rounded hover:bg-white transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

