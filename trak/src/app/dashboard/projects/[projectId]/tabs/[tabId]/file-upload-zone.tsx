"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { Upload, X, FileText, Image, Video, Music, Archive, File, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  workspaceId: string;
  projectId: string;
  blockId: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
  compact?: boolean;
  maxFiles?: number;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
  preview?: string;
  abortController?: AbortController;
}

interface UploadedFile {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Get file type icon
const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.startsWith("video/")) return Video;
  if (fileType.startsWith("audio/")) return Music;
  if (fileType === "application/pdf" || fileType.includes("document") || fileType.includes("text")) return FileText;
  if (fileType.includes("zip") || fileType.includes("archive")) return Archive;
  return File;
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// Generate preview for image files
const generatePreview = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    } else {
      resolve("");
    }
  });
};

export default function FileUploadZone({
  workspaceId,
  projectId,
  blockId,
  onUploadComplete,
  compact = false,
  maxFiles,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef<Promise<void>[]>([]);

  const updateUploadingFile = useCallback((id: string, updates: Partial<UploadingFile>) => {
    setUploadingFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, ...updates } : file))
    );
  }, []);

  const removeUploadingFile = useCallback((id: string) => {
    setUploadingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.abortController) {
        // Note: Supabase doesn't support abort in the same way, but we mark it as cancelled
        file.abortController.abort();
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const uploadFileWithProgress = useCallback(
    async (file: File, fileId: string): Promise<void> => {
      const supabase = createClient();

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        updateUploadingFile(fileId, {
          status: "error",
          error: "File exceeds 50MB limit",
        });
        return;
      }

      // Generate preview
      const preview = await generatePreview(file);
      updateUploadingFile(fileId, { preview });

      // Generate storage path
      const fileExtension = file.name.split(".").pop() || "";
      const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

      try {
        // Simulate progress (Supabase Storage doesn't support onUploadProgress in JS client)
        // Start progress at 10%
        updateUploadingFile(fileId, { progress: 10 });
        
        // Simulate progress updates during upload
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) =>
            prev.map((f) => {
              if (f.id === fileId && f.status === "uploading" && f.progress < 90) {
                return { ...f, progress: Math.min(f.progress + 10, 90) };
              }
              return f;
            })
          );
        }, 500);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("files")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        clearInterval(progressInterval);

        if (uploadError) {
          updateUploadingFile(fileId, {
            status: "error",
            error: uploadError.message || "Upload failed",
          });
          return;
        }

        // Update to 95% before DB operation
        updateUploadingFile(fileId, { progress: 95 });

        // Create database record via server action
        const result = await createFileRecord({
          fileId,
          workspaceId,
          projectId,
          blockId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath,
        });

        if (result.error) {
          // Cleanup: delete uploaded file from storage
          await supabase.storage.from("files").remove([storagePath]);
          updateUploadingFile(fileId, {
            status: "error",
            error: result.error,
          });
          return;
        }

        // Success
        updateUploadingFile(fileId, {
          status: "success",
          progress: 100,
        });

        // Call completion callback
        if (result.data && onUploadComplete) {
          onUploadComplete([result.data]);
        }
      } catch (error: any) {
        updateUploadingFile(fileId, {
          status: "error",
          error: error.message || "Upload failed",
        });
      }
    },
    [workspaceId, projectId, blockId, updateUploadingFile, onUploadComplete]
  );

  const uploadMultipleFiles = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          // Add as error immediately
          const fileId = crypto.randomUUID();
          setUploadingFiles((prev) => [
            ...prev,
            {
              id: fileId,
              file,
              progress: 0,
              status: "error",
              error: "File exceeds 50MB limit",
            },
          ]);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      // Generate previews and add to uploading state
      const filesToUpload: Array<{ id: string; file: File; preview?: string }> = [];
      for (const file of validFiles) {
        const fileId = crypto.randomUUID();
        const preview = await generatePreview(file);
        filesToUpload.push({ id: fileId, file, preview });
        setUploadingFiles((prev) => [
          ...prev,
          {
            id: fileId,
            file,
            progress: 0,
            status: "uploading",
            preview,
          },
        ]);
      }

      // Upload with concurrency limit (3 concurrent)
      const maxConcurrent = 3;
      const queue = [...filesToUpload];
      const active: Promise<void>[] = [];

      while (queue.length > 0 || active.length > 0) {
        // Start new uploads up to concurrency limit
        while (active.length < maxConcurrent && queue.length > 0) {
          const { id, file } = queue.shift()!;
          const promise = uploadFileWithProgress(file, id).finally(() => {
            active.splice(active.indexOf(promise), 1);
          });
          active.push(promise);
        }

        // Wait for at least one to complete
        if (active.length > 0) {
          await Promise.race(active);
        }
      }
    },
    [uploadFileWithProgress]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (maxFiles && files.length > maxFiles) {
      // Show error for too many files
      return;
    }

    await uploadMultipleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (maxFiles && files.length > maxFiles) {
      // Show error for too many files
      return;
    }

    await uploadMultipleFiles(files);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRetry = (fileId: string) => {
    const uploadingFile = uploadingFiles.find((f) => f.id === fileId);
    if (!uploadingFile) return;

    updateUploadingFile(fileId, {
      status: "uploading",
      progress: 0,
      error: undefined,
    });

    uploadFileWithProgress(uploadingFile.file, fileId);
  };

  const hasActiveUploads = uploadingFiles.length > 0;
  const isUploading = uploadingFiles.some((f) => f.status === "uploading");

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!hasActiveUploads && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg transition-all cursor-pointer",
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600",
            compact ? "p-4" : "p-8"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <Upload
              className={cn(
                "text-neutral-400",
                compact ? "w-6 h-6" : "w-8 h-8"
              )}
            />
            <div>
              <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
                Drop files here or click to browse
              </p>
              <p className={cn("text-neutral-500", compact ? "text-xs" : "text-sm")}>
                Maximum 50MB per file
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Uploading Files List */}
      {hasActiveUploads && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile) => {
            const FileIcon = getFileIcon(uploadingFile.file.type);
            const isImage = uploadingFile.file.type.startsWith("image/");

            return (
              <div
                key={uploadingFile.id}
                className={cn(
                  "border rounded-lg p-3",
                  uploadingFile.status === "error"
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail/Icon */}
                  {isImage && uploadingFile.preview ? (
                    <img
                      src={uploadingFile.preview}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded">
                      <FileIcon className="w-6 h-6 text-neutral-500" />
                    </div>
                  )}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {uploadingFile.file.name}
                      </p>
                      {uploadingFile.status !== "uploading" && (
                        <button
                          onClick={() => removeUploadingFile(uploadingFile.id)}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mb-2">
                      {formatFileSize(uploadingFile.file.size)}
                    </p>

                    {/* Progress Bar */}
                    {uploadingFile.status === "uploading" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-600 dark:text-neutral-400">
                            Uploading...
                          </span>
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {uploadingFile.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadingFile.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error State */}
                    {uploadingFile.status === "error" && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="text-xs text-red-600 dark:text-red-400 flex-1">
                          {uploadingFile.error || "Upload failed"}
                        </p>
                        <button
                          onClick={() => handleRetry(uploadingFile.id)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Success State */}
                    {uploadingFile.status === "success" && (
                      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                        <span>✓ Uploaded successfully</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add More Files Button (when uploading) */}
      {isUploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add more files
        </button>
      )}
    </div>
  );
}

