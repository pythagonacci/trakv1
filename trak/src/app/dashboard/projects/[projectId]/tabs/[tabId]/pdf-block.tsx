"use client";

import { useState, useRef, useEffect } from "react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { getFileUrl } from "@/app/actions/file";
import { Upload, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, FileText } from "lucide-react";

interface PdfBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

export default function PdfBlock({ block, workspaceId, projectId, onUpdate }: PdfBlockProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pdfLoadingError, setPdfLoadingError] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);

  const loadPdf = async () => {
    const fileId = block.content?.fileId as string;
    if (!fileId) return;

    setLoading(true);
    setPdfLoadingError(false);
    const result = await getFileUrl(fileId);
    if (result.data?.url) {
      setPdfUrl(result.data.url);
    } else {
      setPdfLoadingError(true);
    }
    setLoading(false);
  };

  // Load PDF URL if fileId exists
  useEffect(() => {
    if (block.content?.fileId) {
      loadPdf();
    }
  }, [block.content?.fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 50MB limit");
      return;
    }

    await uploadPdf(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 50MB limit");
      return;
    }

    await uploadPdf(file);
  };

  const uploadPdf = async (file: File) => {
    if (!workspaceId || !projectId) return;

    setUploading(true);
    const supabase = createClient();

    try {
      // Generate file ID and storage path
      const fileId = crypto.randomUUID();
      const fileExtension = file.name.split(".").pop() || "pdf";
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
      await updateBlock({
        blockId: block.id,
        content: { 
          fileId,
        },
      });

      // Load the new PDF
      await loadPdf();
      onUpdate?.();
      setUploading(false);
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Upload failed: " + error.message);
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;

    const fileId = block.content?.fileId as string;
    if (!fileId) return;

    const result = await getFileUrl(fileId);
    if (result.data?.url) {
      const link = document.createElement("a");
      link.href = result.data.url;
      link.download = `document.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
          accept="application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <FileText className="w-12 h-12 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Drop PDF here or click to browse
          </p>
          <p className="text-xs text-neutral-500">
            Maximum 50MB
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (uploading || loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  // PDF display
  return (
    <div className="p-4">
      {/* Controls Bar */}
      {pdfUrl && (
        <div className="flex items-center justify-between mb-4 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
          {/* Pagination */}
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
              {currentPage} / {totalPages || '?'}
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

          {/* Zoom Controls */}
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

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Download PDF"
          >
            <Download className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>
      )}

      {/* PDF Viewer */}
      {pdfUrl ? (
        iframeError ? (
          // Fallback: Browser doesn't support embedded PDF
          <div className="p-8 text-center border rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
              Your browser doesn't support embedded PDF viewing
            </p>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        ) : (
          <div className="w-full border rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div ref={pdfViewerRef} style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', minHeight: '800px' }}>
              <iframe
                src={`${pdfUrl}#page=${currentPage}`}
                className="w-full border-0"
                style={{ minHeight: '800px' }}
                title="PDF Viewer"
                onLoad={() => {
                  // Iframe loaded successfully - pagination controls work via URL hash
                  // Browser's native PDF viewer doesn't expose page count
                }}
                onError={() => {
                  setIframeError(true);
                }}
              />
            </div>
          </div>
        )
      ) : pdfLoadingError ? (
        <div className="p-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            Failed to load PDF
          </p>
          <button
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Upload a different PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}

