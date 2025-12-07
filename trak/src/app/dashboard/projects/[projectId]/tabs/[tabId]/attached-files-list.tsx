"use client";

import { useState, useEffect, useCallback } from "react";
import { getBlockFiles, detachFileFromBlock } from "@/app/actions/file";
import { useFileUrls } from "./tab-canvas";
import { FileText, Image, Video, Music, Archive, File, Download, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface AttachedFilesListProps {
  blockId: string;
  onUpdate?: () => void;
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

export default function AttachedFilesList({ blockId, onUpdate }: AttachedFilesListProps) {
  // Get file URLs from context (prefetched at page level)
  const fileUrls = useFileUrls();
  
  const [files, setFiles] = useState<BlockFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(true);

  const loadFiles = useCallback(async () => {
    // Skip loading if this is a temporary block (not yet saved to database)
    if (blockId.startsWith('temp-')) {
      console.log("📁 Skipping file load for temporary block:", blockId);
      setLoading(false);
      setFiles([]);
      return;
    }
    
    setLoading(true);
    const result = await getBlockFiles(blockId);
    console.log("📁 Attached Files List - Load files result:", result);
    console.log("📁 Raw result.data structure:", JSON.stringify(result.data, null, 2));
    
    if (result.data) {
      // Log first file structure to understand the data shape
      if (result.data.length > 0) {
        console.log("📁 First file item structure:", result.data[0]);
        console.log("📁 First file.item.file:", result.data[0]?.file);
        console.log("📁 First file.item.file type:", typeof result.data[0]?.file);
        console.log("📁 Is file an array?:", Array.isArray(result.data[0]?.file));
        if (result.data[0]?.file) {
          if (Array.isArray(result.data[0].file)) {
            console.log("📁 File is an array, first element:", result.data[0].file[0]);
            console.log("📁 File array length:", result.data[0].file.length);
            if (result.data[0].file[0]) {
              console.log("📁 First array element file_type:", (result.data[0].file[0] as { file_type?: string })?.file_type);
            }
          } else {
            const fileObj = result.data[0].file as { file_type?: string };
            console.log("📁 File is an object:", result.data[0].file);
            console.log("📁 File file_type:", fileObj?.file_type);
          }
        }
      }
      
      // Handle Supabase nested query: file might be an array or object
      const processedFiles = result.data.map((item: { id: string; display_mode: string; file: unknown }) => {
        // If file is an array (Supabase sometimes returns it that way), take the first element
        const fileData = Array.isArray(item.file) ? item.file[0] : item.file;
        return {
          ...item,
          file: fileData
        };
      }) as BlockFile[];
      
      setFiles(processedFiles);
      console.log("📁 Total files loaded:", processedFiles.length);
      console.log("📁 Processed files:", processedFiles.map(f => ({
        id: f.id,
        fileName: f.file?.file_name,
        fileType: f.file?.file_type,
        hasFile: !!f.file
      })));
      
      // Load signed URLs for images
      const imageFiles = processedFiles.filter((f) => {
        let fileType = f.file?.file_type || "";
        
        // Fallback: detect image by file extension if file_type is missing or generic
        if (!fileType || fileType === 'application/octet-stream' || fileType === '') {
          const fileName = f.file?.file_name || "";
          const extension = fileName.split('.').pop()?.toLowerCase() || "";
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
          if (imageExtensions.includes(extension)) {
            // Map extension to MIME type
            const extensionMap: Record<string, string> = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp',
              'svg': 'image/svg+xml',
              'bmp': 'image/bmp',
              'ico': 'image/x-icon',
            };
            fileType = extensionMap[extension] || `image/${extension}`;
            console.log(`🔧 Detected image by extension: ${fileName} -> ${fileType}`);
          }
        }
        
        const isImage = fileType.startsWith("image/");
        console.log(`🔍 Checking file ${f.file?.file_name}: type="${fileType}", isImage=${isImage}`);
        return isImage;
      });
      
      console.log("🖼️ Image files found:", imageFiles.length, imageFiles.map(f => ({
        id: f.file?.id,
        name: f.file?.file_name,
        type: f.file?.file_type
      })));
      
      // URLs are already loaded from context - no need to fetch them
      const imageFileIds = imageFiles
        .map(f => f.file?.id)
        .filter((id): id is string => Boolean(id));
      
      const loadedUrlsCount = imageFileIds.filter(id => fileUrls[id]).length;
      console.log(`🖼️ Using ${loadedUrlsCount} prefetched URLs for ${imageFiles.length} images`);
      
      if (loadedUrlsCount === 0 && imageFiles.length > 0) {
        console.warn("⚠️ No URLs found in context for images. They may not have been prefetched.");
      }
    } else if (result.error) {
      console.error("❌ Error loading files:", result.error);
    }
    setLoading(false);
  }, [blockId]);

  useEffect(() => {
    // Load files when component mounts or blockId changes
    loadFiles().catch((error) => {
      console.error("❌ Error in loadFiles:", error);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  const handleDeleteFile = async (attachmentId: string) => {
    const result = await detachFileFromBlock(attachmentId);
    if (!result.error) {
      await loadFiles();
      onUpdate?.();
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    const url = fileUrls[fileId];
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return null;
  }

  if (files.length === 0) {
    return null;
  }

  const handleImageError = (fileId: string) => {
    setImageErrors((prev) => ({ ...prev, [fileId]: true }));
  };

  return (
    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white mb-3"
      >
        <span>Attached Files ({files.length})</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map((blockFile) => {
          const file = blockFile.file;
          if (!file) {
            console.warn("⚠️ BlockFile missing file data:", blockFile);
            return null;
          }
          
          const FileIcon = getFileIcon(file.file_type);
          const isImage = file.file_type?.startsWith("image/") || false;
          const imageUrl = fileUrls[file.id];
          const imageFailed = imageErrors[file.id];

          // Debug logging for image rendering
          if (isImage) {
            console.log(`🖼️ Rendering file: ${file.file_name}`, {
              isImage,
              hasUrl: !!imageUrl,
              url: imageUrl?.substring(0, 50) + "...",
              failed: imageFailed,
              fileType: file.file_type,
              fileId: file.id
            });
          }

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
                    onLoad={() => console.log(`✅ Image loaded successfully: ${file.file_name}`)}
                    onError={(e) => {
                      console.error(`❌ Image failed to load: ${file.file_name}`, {
                        src: imageUrl.substring(0, 100),
                        error: e
                      });
                      handleImageError(file.id);
                    }}
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
          }).filter(Boolean)}
        </div>
      )}
    </div>
  );
}

