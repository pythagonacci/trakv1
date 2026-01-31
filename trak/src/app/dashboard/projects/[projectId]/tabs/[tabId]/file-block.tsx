"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Block } from "@/app/actions/block";
import { getBatchFileUrls, getBlockFiles, detachFileFromBlock } from "@/app/actions/file";
import { deleteFileAnalysisComment, getFileAnalysisComments } from "@/app/actions/file-analysis";
import { getCurrentUser } from "@/app/actions/auth";
import { useFileUrls } from "./tab-canvas";
import { FileText, Image, Video, Music, Archive, File, Download, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import FileUploadZone from "./file-upload-zone";
import { useAI } from "@/components/ai";

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

interface FileComment {
  id: string;
  file_id: string;
  text: string;
  created_at: string;
  user_id: string | null;
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

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

const isPdfFile = (file?: BlockFile["file"]) => {
  if (!file) return false;
  const fileType = file.file_type?.toLowerCase() || "";
  if (fileType === "application/pdf") return true;
  return file.file_name?.toLowerCase().endsWith(".pdf") || false;
};

interface PdfAttachmentProps {
  attachmentId: string;
  file: BlockFile["file"];
  pdfUrl?: string;
  isLoadingUrl?: boolean;
  onDownload: (fileId: string, fileName: string) => void;
  onDelete: (attachmentId: string) => void;
  onAnalyze: (fileId: string) => void;
  comments?: FileComment[];
  commentsExpanded?: boolean;
  onToggleComments?: () => void;
  currentUserId?: string | null;
  deletingCommentIds?: Set<string>;
  onDeleteComment?: (commentId: string, fileId: string) => void;
}

function PdfAttachment({
  attachmentId,
  file,
  pdfUrl,
  isLoadingUrl = false,
  onDownload,
  onDelete,
  onAnalyze,
  comments = [],
  commentsExpanded = false,
  onToggleComments,
  currentUserId,
  deletingCommentIds,
  onDeleteComment,
}: PdfAttachmentProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [iframeError, setIframeError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const pdfViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage(1);
    setTotalPages(0);
    setZoom(100);
    setIframeError(false);
  }, [file.id, pdfUrl]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{file.file_name}</p>
          <p className="text-xs text-[var(--tertiary-foreground)]">{formatFileSize(file.file_size)}</p>
          {comments.length > 0 && (
            <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              <button
                type="button"
                onClick={onToggleComments}
                className="hover:text-[var(--foreground)]"
              >
                {commentsExpanded ? "Hide comments" : `Comments (${comments.length})`}
              </button>
              {commentsExpanded && (
                <div className="mt-1 space-y-1">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-[11px] leading-snug whitespace-pre-wrap">{comment.text}</p>
                          <p className="text-[10px] text-[var(--tertiary-foreground)]">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                        {currentUserId && comment.user_id === currentUserId && onDeleteComment && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(comment.id, file.id)}
                            className="text-[10px] text-red-600 hover:text-red-700"
                            title="Delete comment"
                            disabled={Boolean(deletingCommentIds?.has(comment.id))}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAnalyze(file.id)}
            className="rounded-[4px] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Analyze file"
          >
            Analyze
          </button>
          {!isExpanded && (
            <button
              onClick={() => onDownload(file.id, file.file_name)}
              className="rounded-[4px] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              title="Download PDF"
              disabled={!pdfUrl}
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="rounded-[4px] border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-pressed={isExpanded}
          >
            {isExpanded ? "Hide preview" : "Show preview"}
          </button>
          <button
            onClick={() => onDelete(attachmentId)}
            className="rounded-[4px] p-2 text-red-600 transition-colors hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && pdfUrl && (
        <div className="flex items-center justify-between p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
            <span className="text-sm text-neutral-700 dark:text-neutral-300 min-w-[80px] text-center">
              {currentPage} / {totalPages || "?"}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
            <span className="text-sm text-neutral-700 dark:text-neutral-300 min-w-[50px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>

          <button
            onClick={() => onDownload(file.id, file.file_name)}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Download PDF"
            disabled={!pdfUrl}
          >
            <Download className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>
      )}

      {isExpanded && pdfUrl ? (
        iframeError ? (
          <div className="p-8 text-center border rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
              Your browser doesn't support embedded PDF viewing
            </p>
            <button
              onClick={() => onDownload(file.id, file.file_name)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        ) : (
          <div className="w-full border rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800" style={{ maxHeight: "600px", overflowY: "auto" }}>
            <div
              ref={pdfViewerRef}
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", minHeight: "800px" }}
            >
              <iframe
                src={`${pdfUrl}#page=${currentPage}`}
                className="w-full border-0"
                style={{ minHeight: "800px" }}
                title={`PDF Viewer - ${file.file_name}`}
                loading="lazy"
                onError={() => {
                  setIframeError(true);
                }}
              />
            </div>
          </div>
        )
      ) : isExpanded ? (
        <div className="p-8 text-center border rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <p className="text-sm text-[var(--muted-foreground)]">
            {isLoadingUrl ? "Loading PDF..." : "Failed to load PDF"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function FileBlock({ block, workspaceId, projectId, onUpdate }: FileBlockProps) {
  const { openCommandPalette, queueFileIds } = useAI();
  // Get file URLs from context (prefetched at page level)
  const fileUrls = useFileUrls();
  
  const [files, setFiles] = useState<BlockFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [resolvedFileUrls, setResolvedFileUrls] = useState<Record<string, string>>({});
  const [loadingFileIds, setLoadingFileIds] = useState<Set<string>>(new Set());
  const [fileComments, setFileComments] = useState<Record<string, FileComment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(new Set());

  const loadComments = useCallback(async (fileIds: string[]) => {
    const uniqueIds = Array.from(new Set(fileIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;
    const commentsResult = await getFileAnalysisComments({ fileIds: uniqueIds });
    if ("data" in commentsResult) {
      const grouped: Record<string, FileComment[]> = {};
      commentsResult.data.forEach((comment) => {
        if (!grouped[comment.file_id]) grouped[comment.file_id] = [];
        grouped[comment.file_id].push(comment);
      });
      setFileComments((prev) => {
        const next = { ...prev };
        uniqueIds.forEach((id) => {
          next[id] = grouped[id] || [];
        });
        return next;
      });
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [block.id]);

  useEffect(() => {
    let isMounted = true;
    getCurrentUser().then((result) => {
      if (!isMounted) return;
      if ("data" in result && result.data) {
        setCurrentUserId(result.data.id);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleCommentSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ fileId?: string }>).detail;
      if (!detail?.fileId) return;
      const hasFile = files.some((item) => item.file?.id === detail.fileId);
      if (!hasFile) return;
      loadComments([detail.fileId]);
    };
    const handleCommentDeleted = (event: Event) => {
      const detail = (event as CustomEvent<{ fileId?: string }>).detail;
      if (!detail?.fileId) return;
      const hasFile = files.some((item) => item.file?.id === detail.fileId);
      if (!hasFile) return;
      loadComments([detail.fileId]);
    };
    window.addEventListener("file-analysis-comment-saved", handleCommentSaved as EventListener);
    window.addEventListener("file-analysis-comment-deleted", handleCommentDeleted as EventListener);
    return () => {
      window.removeEventListener("file-analysis-comment-saved", handleCommentSaved as EventListener);
      window.removeEventListener("file-analysis-comment-deleted", handleCommentDeleted as EventListener);
    };
  }, [files, loadComments]);

  const ensureFileUrls = async (blockFiles: BlockFile[]) => {
    const combinedUrls = { ...fileUrls, ...resolvedFileUrls };
    const missingIds = blockFiles
      .map((blockFile) => blockFile.file?.id)
      .filter((id): id is string => Boolean(id))
      .filter((id) => !combinedUrls[id]);

    if (missingIds.length === 0) return;

    setLoadingFileIds((prev) => {
      const next = new Set(prev);
      missingIds.forEach((id) => next.add(id));
      return next;
    });

    const result = await getBatchFileUrls(missingIds);
    if (result.data) {
      setResolvedFileUrls((prev) => ({
        ...prev,
        ...result.data,
      }));
    }

    setLoadingFileIds((prev) => {
      const next = new Set(prev);
      missingIds.forEach((id) => next.delete(id));
      return next;
    });
  };

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
      // URLs are already loaded from context - no need to fetch them
      await ensureFileUrls(normalizedFiles);

      const fileIds = normalizedFiles
        .map((item) => item.file?.id)
        .filter((id): id is string => Boolean(id));
      await loadComments(fileIds);
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
    const mergedFileUrls = { ...fileUrls, ...resolvedFileUrls };
    const url = mergedFileUrls[fileId];
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleAnalyzeFile = (fileId: string) => {
    queueFileIds([fileId]);
    openCommandPalette();
  };

  const handleImageError = (fileId: string) => {
    setImageErrors((prev) => ({ ...prev, [fileId]: true }));
  };

  const handleUploadComplete = () => {
    setShowUploadZone(false);
    loadFiles();
    onUpdate?.();
  };

  const toggleComments = (fileId: string) => {
    setExpandedComments((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  const handleDeleteComment = async (commentId: string, fileId: string) => {
    if (deletingCommentIds.has(commentId)) return;
    setDeletingCommentIds((prev) => new Set(prev).add(commentId));
    const result = await deleteFileAnalysisComment({ commentId });
    if ("data" in result) {
      await loadComments([fileId]);
      window.dispatchEvent(
        new CustomEvent("file-analysis-comment-deleted", { detail: { fileId } })
      );
    } else {
      console.error("Failed to delete comment:", result.error);
    }
    setDeletingCommentIds((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted-foreground)]">Loading files…</div>;
  }

  if (block.id.startsWith('temp-')) {
    return (
      <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
        Saving block... You can upload files once it's ready.
      </div>
    );
  }

  const mergedFileUrls = { ...fileUrls, ...resolvedFileUrls };
  const pdfFiles = files.filter((blockFile) => isPdfFile(blockFile.file));
  const otherFiles = files.filter((blockFile) => !isPdfFile(blockFile.file));

  // Show empty state if no files
  if (files.length === 0) {
    return (
      <div className="space-y-3">
        <FileUploadZone
          workspaceId={workspaceId}
          projectId={projectId}
          blockId={block.id}
          onUploadComplete={handleUploadComplete}
          compact={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[var(--tertiary-foreground)]">
        <span className="uppercase tracking-wide">Files</span>
        <span>{files.length} attached</span>
      </div>

      {pdfFiles.length > 0 && (
        <div className="space-y-4">
          {pdfFiles.map((blockFile) => {
            const file = blockFile.file;
            const pdfUrl = mergedFileUrls[file.id];
            const isLoadingUrl = loadingFileIds.has(file.id);
            return (
                <PdfAttachment
                  key={blockFile.id}
                  attachmentId={blockFile.id}
                  file={file}
                  pdfUrl={pdfUrl}
                  isLoadingUrl={isLoadingUrl}
                  onDownload={handleDownloadFile}
                  onDelete={handleDeleteFile}
                  onAnalyze={handleAnalyzeFile}
                  comments={fileComments[file.id] || []}
                  commentsExpanded={Boolean(expandedComments[file.id])}
                  onToggleComments={() => toggleComments(file.id)}
                  currentUserId={currentUserId}
                  deletingCommentIds={deletingCommentIds}
                  onDeleteComment={handleDeleteComment}
                />
            );
          })}
        </div>
      )}

      {otherFiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {otherFiles.map((blockFile) => {
            const file = blockFile.file;
            const FileIcon = getFileIcon(file.file_type);
            const isImage = file.file_type.startsWith("image/");
            const imageUrl = mergedFileUrls[file.id];
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
                    {fileComments[file.id]?.length ? (
                      <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                        <button
                          type="button"
                          onClick={() => toggleComments(file.id)}
                          className="hover:text-[var(--foreground)]"
                        >
                          {expandedComments[file.id] ? "Hide comments" : `Comments (${fileComments[file.id].length})`}
                        </button>
                        {expandedComments[file.id] && (
                          <div className="mt-1 space-y-1">
                            {fileComments[file.id].map((comment) => (
                              <div
                                key={comment.id}
                                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-[11px] leading-snug whitespace-pre-wrap">{comment.text}</p>
                                    <p className="text-[10px] text-[var(--tertiary-foreground)]">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  {currentUserId && comment.user_id === currentUserId && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(comment.id, file.id)}
                                      className="text-[10px] text-red-600 hover:text-red-700"
                                      title="Delete comment"
                                      disabled={deletingCommentIds.has(comment.id)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
 
                {/* Hover Actions */}
                <div className="absolute right-2 top-2 z-10 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleAnalyzeFile(file.id)}
                    className="rounded-[4px] bg-white/90 p-2 text-neutral-700 transition-colors hover:bg-white"
                    title="Analyze"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
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
      )}

      {!showUploadZone ? (
        <button
          onClick={() => setShowUploadZone(true)}
          className="w-full rounded-[6px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          + Add files
        </button>
      ) : (
        <div className="space-y-2">
          <FileUploadZone
            workspaceId={workspaceId}
            projectId={projectId}
            blockId={block.id}
            onUploadComplete={handleUploadComplete}
            compact={true}
          />
          <button
            onClick={() => setShowUploadZone(false)}
            className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
