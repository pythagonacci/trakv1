"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { getSingleDoc } from "@/app/actions/doc";
import RichTextEditor from "@/components/editor/rich-text-editor";
import { updateDoc } from "@/app/actions/doc";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface DocSidebarProps {
  docId: string | null;
  onClose: () => void;
}

export default function DocSidebar({ docId, onClose }: DocSidebarProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTimeoutRef, setSaveTimeoutRef] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (docId) {
      loadDoc();
    } else {
      setDoc(null);
      setContent(null);
    }
  }, [docId]);

  // Auto-save content
  useEffect(() => {
    if (!doc || !content) return;

    if (saveTimeoutRef) {
      clearTimeout(saveTimeoutRef);
    }

    // Don't save if content hasn't changed
    if (JSON.stringify(content) === JSON.stringify(doc.content)) {
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSaving(true);
      await updateDoc(doc.id, { content });
      setIsSaving(false);
    }, 1000);

    setSaveTimeoutRef(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [content, doc]);

  const loadDoc = async () => {
    if (!docId) return;

    setIsLoading(true);
    const result = await getSingleDoc(docId);

    if (!result.error && result.data) {
      setDoc(result.data);
      setContent(result.data.content);
    }
    setIsLoading(false);
  };

  const handleOpenInNewTab = () => {
    if (doc) {
      window.open(`/dashboard/docs/${doc.id}`, "_blank");
    }
  };

  if (!docId) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 z-40 transition-opacity duration-300",
          docId ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full md:w-[600px] lg:w-[700px] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl z-50 transition-transform duration-300 flex flex-col",
          docId ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="h-6 w-48 bg-[var(--surface-hover)] animate-pulse rounded" />
            ) : (
              <h2 className="text-base font-semibold text-[var(--foreground)] truncate">
                {doc?.title || "Untitled Document"}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSaving && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            
            <button
              onClick={handleOpenInNewTab}
              className="p-2 rounded hover:bg-[var(--surface-hover)] transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-[var(--surface-hover)] transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[var(--surface-muted)] p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : doc ? (
            <div className="max-w-[700px] mx-auto bg-[var(--background)] shadow-lg rounded-sm min-h-[800px]">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Start writing..."
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-[var(--muted-foreground)]">
              Document not found
            </div>
          )}
        </div>
      </div>
    </>
  );
}

