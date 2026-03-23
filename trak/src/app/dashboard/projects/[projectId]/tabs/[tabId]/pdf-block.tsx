"use client";

import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { createClient } from "@/lib/supabase/client";
import { createFileRecord } from "@/app/actions/file";
import { useFileUrls } from "./tab-canvas";
import { Upload, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, FileText, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  // Get file URLs from context (prefetched at page level)
  const fileUrls = useFileUrls();
  const fileId = block.content?.fileId as string;
  const pdfUrl = fileId ? fileUrls[fileId] : null;

  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [showSidebar, setShowSidebar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
  }, []);

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

      // Trigger update - page will refresh and prefetch new file URL
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

    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
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
  if (uploading) {
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar((prev) => !prev)}
              className={cn(
                "p-1.5 rounded transition-colors",
                showSidebar
                  ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                  : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
              )}
              title={showSidebar ? "Hide page sidebar" : "Show page sidebar"}
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-neutral-300 dark:bg-neutral-600" />
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
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
          }
          error={
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                Failed to load PDF
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          }
        >
          <div
            className="flex w-full border rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800"
            style={{ height: '700px' }}
          >
            {/* Thumbnail sidebar */}
            {showSidebar && totalPages > 0 && (
              <div className="w-[200px] min-w-[200px] overflow-y-auto border-r border-neutral-300 dark:border-neutral-600 bg-neutral-200/50 dark:bg-neutral-900/50 p-2 space-y-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-full rounded-md overflow-hidden border-2 transition-colors cursor-pointer",
                      currentPage === pageNum
                        ? "border-blue-500 dark:border-blue-400"
                        : "border-transparent hover:border-neutral-400 dark:hover:border-neutral-500"
                    )}
                  >
                    <div className="bg-white dark:bg-neutral-800">
                      <Page
                        pageNumber={pageNum}
                        width={180}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </div>
                    <div className={cn(
                      "text-[10px] py-0.5 text-center",
                      currentPage === pageNum
                        ? "text-blue-600 dark:text-blue-400 font-medium"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}>
                      {pageNum}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Main page view */}
            <div className="flex-1 overflow-auto">
              <div className="flex justify-center p-4">
                <Page
                  pageNumber={currentPage}
                  scale={zoom / 100}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </Document>
      ) : !pdfUrl ? (
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
