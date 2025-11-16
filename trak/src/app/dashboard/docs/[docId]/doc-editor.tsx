"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/editor/rich-text-editor";
import { updateDoc } from "@/app/actions/doc";
import { cn } from "@/lib/utils";

interface Doc {
  id: string;
  title: string;
  content: any;
  updated_at: string;
}

interface DocEditorProps {
  doc: Doc;
}

export default function DocEditor({ doc }: DocEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date(doc.updated_at));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save content
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Don't save if content hasn't changed
    if (JSON.stringify(content) === JSON.stringify(doc.content)) {
      return;
    }

    setHasUnsavedChanges(true);

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      const result = await updateDoc(doc.id, { content });
      
      if (!result.error) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
      
      setIsSaving(false);
    }, 1000); // Auto-save after 1 second of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, doc.id]);

  // Auto-save title
  useEffect(() => {
    if (titleTimeoutRef.current) {
      clearTimeout(titleTimeoutRef.current);
    }

    // Don't save if title hasn't changed
    if (title === doc.title) {
      return;
    }

    setHasUnsavedChanges(true);

    titleTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      const result = await updateDoc(doc.id, { title });
      
      if (!result.error) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        router.refresh();
      }
      
      setIsSaving(false);
    }, 500); // Save title after 500ms of inactivity

    return () => {
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
      }
    };
  }, [title, doc.id, doc.title, router]);

  const formatLastSaved = () => {
    if (!lastSaved) return "";
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    return lastSaved.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--surface-muted)]">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-3">
        <div className="max-w-[850px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => router.push("/dashboard/docs")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)] flex-shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-base font-semibold bg-transparent border-none outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] min-w-0"
              placeholder="Untitled Document"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] flex-shrink-0">
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <span className="hidden sm:inline">Unsaved changes</span>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span className="hidden sm:inline">Saved {formatLastSaved()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page Container */}
      <div className="py-8 px-4">
        {/* Paper-like Document */}
        <div className="max-w-[850px] mx-auto bg-[var(--background)] shadow-lg rounded-sm min-h-[1100px]">
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your document..."
          />
        </div>
      </div>
    </div>
  );
}

