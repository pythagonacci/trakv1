"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import type { ClientCommentIdentity } from "@/app/client/[publicToken]/use-client-comment-identity";
import {
  Upload,
  X,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  File,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FileUploadZoneProps {
  workspaceId: string;
  projectId: string;
  blockId: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
  compact?: boolean;
  maxFiles?: number;
  accept?: string;
  hideDropZone?: boolean;
  publicUpload?: {
    publicToken: string;
    identity: ClientCommentIdentity | null;
    setIdentityName: (name: string) => void;
  };
}

export interface FileUploadZoneHandle {
  openFileDialog: () => void;
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

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.startsWith("video/")) return Video;
  if (fileType.startsWith("audio/")) return Music;
  if (
    fileType === "application/pdf" ||
    fileType.includes("document") ||
    fileType.includes("text")
  ) {
    return FileText;
  }
  if (fileType.includes("zip") || fileType.includes("archive")) return Archive;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const generatePreview = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    resolve("");
  });
};

const FileUploadZone = forwardRef<FileUploadZoneHandle, FileUploadZoneProps>(
  function FileUploadZone(
    {
      workspaceId,
      projectId,
      blockId,
      onUploadComplete,
      compact = false,
      maxFiles,
      accept = "*/*",
      hideDropZone = false,
      publicUpload,
    },
    ref
  ) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [showNameDialog, setShowNameDialog] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
    const [openPickerAfterName, setOpenPickerAfterName] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      openFileDialog: () => fileInputRef.current?.click(),
    }));

    const updateUploadingFile = useCallback(
      (id: string, updates: Partial<UploadingFile>) => {
        setUploadingFiles((prev) =>
          prev.map((file) => (file.id === id ? { ...file, ...updates } : file))
        );
      },
      []
    );

    const removeUploadingFile = useCallback((id: string) => {
      setUploadingFiles((prev) => {
        const file = prev.find((item) => item.id === id);
        if (file?.abortController) {
          file.abortController.abort();
        }
        return prev.filter((item) => item.id !== id);
      });
    }, []);

    const ensureIdentityForUpload = useCallback(
      (files?: File[], shouldOpenPicker = false) => {
        if (!publicUpload) return true;
        if (publicUpload.identity?.name?.trim()) return true;

        setNameDraft(publicUpload.identity?.name ?? "");
        setPendingFiles(files ?? null);
        setOpenPickerAfterName(shouldOpenPicker);
        setShowNameDialog(true);
        return false;
      },
      [publicUpload]
    );

    const uploadFileWithProgress = useCallback(
      async (file: File, fileId: string): Promise<void> => {
        if (file.size > MAX_FILE_SIZE) {
          updateUploadingFile(fileId, {
            status: "error",
            error: "File exceeds 50MB limit",
          });
          return;
        }

        const preview = await generatePreview(file);
        updateUploadingFile(fileId, { preview });

        const fileExtension = file.name.split(".").pop() || "";
        const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

        try {
          updateUploadingFile(fileId, { progress: 10 });

          const progressInterval = setInterval(() => {
            setUploadingFiles((prev) =>
              prev.map((uploadingFile) => {
                if (
                  uploadingFile.id === fileId &&
                  uploadingFile.status === "uploading" &&
                  uploadingFile.progress < 90
                ) {
                  return {
                    ...uploadingFile,
                    progress: Math.min(uploadingFile.progress + 10, 90),
                  };
                }
                return uploadingFile;
              })
            );
          }, 500);

          let result: { error?: string; data?: UploadedFile };

          if (publicUpload) {
            const visitorId = publicUpload.identity?.id;
            const visitorName = publicUpload.identity?.name?.trim();

            if (!visitorId || !visitorName) {
              clearInterval(progressInterval);
              updateUploadingFile(fileId, {
                status: "error",
                error: "Please add your name before uploading.",
              });
              return;
            }

            const formData = new FormData();
            formData.set("file", file);
            formData.set("blockId", blockId);
            formData.set("publicToken", publicUpload.publicToken);
            formData.set("visitorId", visitorId);
            formData.set("visitorName", visitorName);

            const response = await fetch("/api/client-files", {
              method: "POST",
              body: formData,
            });
            const payload = await response.json();

            clearInterval(progressInterval);

            if (!response.ok) {
              updateUploadingFile(fileId, {
                status: "error",
                error: payload?.error || "Upload failed",
              });
              return;
            }

            result = payload?.file
              ? { data: payload.file as UploadedFile }
              : { error: "Upload failed" };
          } else {
            const supabase = createClient();
            const { error: uploadError } = await supabase.storage
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

            updateUploadingFile(fileId, { progress: 95 });

            result = await createFileRecord({
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
              await supabase.storage.from("files").remove([storagePath]);
            }
          }

          if (result.error) {
            updateUploadingFile(fileId, {
              status: "error",
              error: result.error,
            });
            return;
          }

          if (result.data) {
            onUploadComplete?.([result.data]);
          }
          // Row would only duplicate the block's file list; remove local entry once persisted.
          setUploadingFiles((prev) => prev.filter((item) => item.id !== fileId));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload failed";
          updateUploadingFile(fileId, {
            status: "error",
            error: message,
          });
        }
      },
      [
        workspaceId,
        projectId,
        blockId,
        updateUploadingFile,
        onUploadComplete,
        publicUpload,
      ]
    );

    const uploadMultipleFiles = useCallback(
      async (files: File[]) => {
        const validFiles = files.filter((file) => {
          if (file.size > MAX_FILE_SIZE) {
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

          if (accept && accept !== "*/*") {
            const acceptedTypes = accept.split(",").map((type) => type.trim());
            const matches = acceptedTypes.some((type) => {
              if (type.endsWith("/*")) {
                const baseType = type.slice(0, -2);
                return file.type.startsWith(baseType);
              }
              return file.type === type;
            });

            if (!matches) {
              const fileId = crypto.randomUUID();
              setUploadingFiles((prev) => [
                ...prev,
                {
                  id: fileId,
                  file,
                  progress: 0,
                  status: "error",
                  error: `File type not accepted. Expected: ${accept}`,
                },
              ]);
              return false;
            }
          }

          return true;
        });

        if (validFiles.length === 0) return;

        const filesToUpload: Array<{ id: string; file: File }> = [];
        for (const file of validFiles) {
          const fileId = crypto.randomUUID();
          const preview = await generatePreview(file);
          filesToUpload.push({ id: fileId, file });
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

        const maxConcurrent = 3;
        const queue = [...filesToUpload];
        const active: Promise<void>[] = [];

        while (queue.length > 0 || active.length > 0) {
          while (active.length < maxConcurrent && queue.length > 0) {
            const nextUpload = queue.shift();
            if (!nextUpload) break;

            const promise = uploadFileWithProgress(
              nextUpload.file,
              nextUpload.id
            ).finally(() => {
              active.splice(active.indexOf(promise), 1);
            });
            active.push(promise);
          }

          if (active.length > 0) {
            await Promise.race(active);
          }
        }
      },
      [accept, uploadFileWithProgress]
    );

    const handleDragOver = (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
    };

    const handleDrop = async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const files = Array.from(event.dataTransfer.files);
      if (maxFiles && files.length > maxFiles) {
        return;
      }

      if (!ensureIdentityForUpload(files)) {
        return;
      }

      await uploadMultipleFiles(files);
    };

    const handleFileSelect = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (maxFiles && files.length > maxFiles) {
        return;
      }

      if (!ensureIdentityForUpload(files)) {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      await uploadMultipleFiles(files);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const handleRetry = (fileId: string) => {
      const uploadingFile = uploadingFiles.find((file) => file.id === fileId);
      if (!uploadingFile) return;

      updateUploadingFile(fileId, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });

      void uploadFileWithProgress(uploadingFile.file, fileId);
    };

    const handleBrowseClick = () => {
      if (!ensureIdentityForUpload(undefined, true)) {
        return;
      }

      fileInputRef.current?.click();
    };

    const handleNameSubmit = async () => {
      const cleaned = nameDraft.trim();
      if (!cleaned || !publicUpload) {
        return;
      }

      publicUpload.setIdentityName(cleaned);
      const filesToUpload = pendingFiles;
      const shouldOpenPicker = openPickerAfterName;

      setShowNameDialog(false);
      setPendingFiles(null);
      setOpenPickerAfterName(false);

      if (filesToUpload?.length) {
        await uploadMultipleFiles(filesToUpload);
        return;
      }

      if (shouldOpenPicker) {
        fileInputRef.current?.click();
      }
    };

    const hasActiveUploads = uploadingFiles.length > 0;
    const isUploading = uploadingFiles.some(
      (file) => file.status === "uploading"
    );
    const showDropZone = !hasActiveUploads && !hideDropZone;

    return (
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept={accept}
        />

        {showDropZone && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            className={cn(
              "relative cursor-pointer rounded-lg border-2 border-dashed transition-all",
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600",
              compact ? "p-4" : "p-8"
            )}
          >
            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <Upload
                className={cn(
                  "text-neutral-400",
                  compact ? "h-6 w-6" : "h-8 w-8"
                )}
              />
              <div>
                <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
                  Drop files here or click to browse
                </p>
                <p
                  className={cn(
                    "text-neutral-500",
                    compact ? "text-xs" : "text-sm"
                  )}
                >
                  Maximum 50MB per file
                </p>
              </div>
            </div>
          </div>
        )}

        {hasActiveUploads && (
          <div className="space-y-2">
            {uploadingFiles.map((uploadingFile) => {
              const FileIcon = getFileIcon(uploadingFile.file.type);
              const isImage = uploadingFile.file.type.startsWith("image/");

              return (
                <div
                  key={uploadingFile.id}
                  className={cn(
                    "rounded-lg border p-3",
                    uploadingFile.status === "error"
                      ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                      : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {isImage && uploadingFile.preview ? (
                      <img
                        src={uploadingFile.preview}
                        alt="Preview"
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-800">
                        <FileIcon className="h-6 w-6 text-neutral-500" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {uploadingFile.file.name}
                        </p>
                        {uploadingFile.status !== "uploading" && (
                          <button
                            onClick={() => removeUploadingFile(uploadingFile.id)}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="mb-2 text-xs text-neutral-500">
                        {formatFileSize(uploadingFile.file.size)}
                      </p>

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
                          <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
                            <div
                              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${uploadingFile.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {uploadingFile.status === "error" && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <p className="flex-1 text-xs text-red-600 dark:text-red-400">
                            {uploadingFile.error || "Upload failed"}
                          </p>
                          <button
                            onClick={() => handleRetry(uploadingFile.id)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                          </button>
                        </div>
                      )}

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

        {isUploading && (
          <button
            onClick={handleBrowseClick}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add more files
          </button>
        )}

        <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Share your name</DialogTitle>
              <DialogDescription>
                We’ll use this name for uploads, comments, and edits on this client page.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="e.g. Taylor (Acme Co.)"
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowNameDialog(false);
                    setPendingFiles(null);
                    setOpenPickerAfterName(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleNameSubmit()}>
                  Save name
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

export default FileUploadZone;
