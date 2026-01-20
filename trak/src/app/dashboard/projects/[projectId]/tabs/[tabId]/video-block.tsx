"use client";

import { useState, useEffect, useRef } from "react";
import { type Block } from "@/app/actions/block";
import { getBlockFiles, detachFileFromBlock } from "@/app/actions/file";
import { useFileUrls } from "./tab-canvas";
import { Video, Download, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import VideoPlayer from "./video-player";
import FileUploadZone, { type FileUploadZoneHandle } from "./file-upload-zone";

interface VideoBlockProps {
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

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB - warning threshold
const LARGE_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB - suggest embedding

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// Generate thumbnail from video first frame
const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      video.remove();
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Set timeout to prevent hanging
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Thumbnail generation timeout"));
    }, 10000); // 10 second timeout

    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.5, video.duration * 0.1); // Seek to 10% or 0.5s, whichever is smaller
        
        video.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            const maxWidth = 320;
            const maxHeight = 180;
            
            // Calculate dimensions maintaining aspect ratio
            let width = video.videoWidth;
            let height = video.videoHeight;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.8);
              cleanup();
              resolve(thumbnailUrl);
            } else {
              cleanup();
              reject(new Error("Failed to get canvas context"));
            }
          } catch (error) {
            cleanup();
            reject(error);
          }
        };

        video.onerror = () => {
          cleanup();
          reject(new Error("Failed to seek video"));
        };
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video metadata"));
    };

    video.src = videoUrl;
  });
};

export default function VideoBlock({ block, workspaceId, projectId, onUpdate }: VideoBlockProps) {
  // Get file URLs from context (prefetched at page level)
  const fileUrls = useFileUrls();
  
  const [files, setFiles] = useState<BlockFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [showUploadZone, setShowUploadZone] = useState(false);
  const uploadZoneRef = useRef<FileUploadZoneHandle | null>(null);

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
      // Filter only video files
      const videoFiles = normalizedFiles.filter((f) => f.file?.file_type?.startsWith("video/"));
      setFiles(videoFiles);

      // URLs are already loaded from context - just extract them for video files
      const videoFileIds = videoFiles.map(f => f.file.id).filter(Boolean);
      
      if (videoFileIds.length > 0) {
        // Generate thumbnails for all videos in parallel using URLs from context
        const thumbPromises = videoFileIds.map(async (fileId) => {
          const url = fileUrls[fileId];
          if (!url) return { fileId, thumbnail: null };
          
          try {
            const thumbnail = await generateVideoThumbnail(url);
            return { fileId, thumbnail };
          } catch (error) {
            console.error(`Failed to generate thumbnail for file ${fileId}:`, error);
            return { fileId, thumbnail: null };
          }
        });
        
        const thumbResults = await Promise.all(thumbPromises);
        const thumbs: Record<string, string> = {};
        thumbResults.forEach(result => {
          if (result.thumbnail) {
            thumbs[result.fileId] = result.thumbnail;
          }
        });
        setThumbnails(thumbs);
      }
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

  const handleUploadComplete = () => {
    setShowUploadZone(false);
    loadFiles();
    onUpdate?.();
  };

  const handleStartUpload = () => {
    setShowUploadZone(true);
    uploadZoneRef.current?.openFileDialog();
  };

  if (loading) {
    return (
      <div className="p-5 text-sm text-neutral-500">Loading videos...</div>
    );
  }

  // Show empty state if no videos
  if (files.length === 0) {
    return (
      <div className="p-5 space-y-4">
        <div className="text-sm text-neutral-500 text-center">
          No videos uploaded. Upload MP4 files to display here.
        </div>
        {!showUploadZone && (
          <div className="flex justify-center">
            <button
              onClick={handleStartUpload}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
            >
              Upload Video
            </button>
          </div>
        )}
        <div className={showUploadZone ? "space-y-4" : "hidden"}>
            <FileUploadZone
              ref={uploadZoneRef}
              workspaceId={workspaceId}
              projectId={projectId}
              blockId={block.id}
              onUploadComplete={handleUploadComplete}
              compact={true}
              accept="video/*"
              hideDropZone={true}
            />
            <button
              onClick={() => setShowUploadZone(false)}
              className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Videos List */}
      <div className="space-y-4">
        {files.map((blockFile) => {
          const file = blockFile.file;
          const videoUrl = fileUrls[file.id];
          const thumbnailUrl = thumbnails[file.id];
          const isLarge = file.file_size > MAX_VIDEO_SIZE;
          const isVeryLarge = file.file_size > LARGE_VIDEO_SIZE;

          return (
            <div key={blockFile.id} className="space-y-2">
              {/* Video Player */}
              {videoUrl ? (
                <div className="relative">
                  <VideoPlayer
                    videoUrl={videoUrl}
                    thumbnailUrl={thumbnailUrl}
                    className="w-full aspect-video"
                  />
                </div>
              ) : (
                <div className="w-full aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">Loading video...</p>
                  </div>
                </div>
              )}

              {/* File Info & Actions */}
              <div className="flex items-start justify-between gap-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                  </div>
                  <p className="text-xs text-neutral-500">{formatFileSize(file.file_size)}</p>

                  {/* Large Video Warning */}
                  {isLarge && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded text-xs">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          {isVeryLarge ? (
                            <>
                              <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                                Very large video ({formatFileSize(file.file_size)})
                              </p>
                              <p className="text-yellow-700 dark:text-yellow-400 mb-2">
                                Consider embedding from YouTube, Vimeo, or other platforms for better performance.
                              </p>
                              <button
                                onClick={() => {
                                  // Could open a dialog to convert to link block with embed
                                  window.open("https://youtube.com", "_blank");
                                }}
                                className="text-yellow-700 dark:text-yellow-400 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Learn about embedding
                              </button>
                            </>
                          ) : (
                            <p className="text-yellow-700 dark:text-yellow-400">
                              Large video file. Consider compressing for better performance.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDownloadFile(file.id, file.file_name)}
                    className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(blockFile.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add More Videos Button */}
      {!showUploadZone && (
        <button
          onClick={handleStartUpload}
          className="w-full px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors"
        >
          + Add Another Video
        </button>
      )}

      {/* Upload Zone */}
      <div className={showUploadZone ? "space-y-2" : "hidden"}>
        <FileUploadZone
          ref={uploadZoneRef}
          workspaceId={workspaceId}
          projectId={projectId}
          blockId={block.id}
          onUploadComplete={handleUploadComplete}
          compact={true}
          accept="video/*"
          hideDropZone={true}
        />
        <button
          onClick={() => setShowUploadZone(false)}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
