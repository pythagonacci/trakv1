"use client";

import { useState, useRef, useEffect } from "react";
import { Link2 } from "lucide-react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";

interface LinkBlockProps {
  block: Block;
  onUpdate?: () => void;
}

export default function LinkBlock({ block, onUpdate }: LinkBlockProps) {
  const content = (block.content || {}) as {
    title?: string;
    url?: string;
    description?: string;
    caption?: string;
  };

  const title = content.title || "Untitled Link";
  const url = content.url || "#";
  const description = content.description;
  const [caption, setCaption] = useState(content.caption || "");
  const [savingCaption, setSavingCaption] = useState(false);
  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    
    // Clear existing timeout
    if (captionTimeoutRef.current) {
      clearTimeout(captionTimeoutRef.current);
    }
    
    // Debounce save
    setSavingCaption(true);
    captionTimeoutRef.current = setTimeout(async () => {
      await updateBlock({
        blockId: block.id,
        content: {
          ...content,
          caption: value,
        },
      });
      setSavingCaption(false);
      onUpdate?.();
    }, 1000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition-colors hover:border-[var(--foreground)]/20 hover:text-[var(--foreground)]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[var(--surface-hover)] text-[var(--foreground)]/70 shrink-0">
          <Link2 className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="truncate text-sm font-medium text-[var(--foreground)]">
            {title}
          </div>
          {description && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {description}
            </div>
          )}
          <div className="text-[11px] text-[var(--tertiary-foreground)]">
            {url}
          </div>
        </div>
      </a>

      <div className="px-1">
        <input
          type="text"
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="Add caption..."
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-[4px] border border-transparent px-2 py-1 text-sm text-[var(--muted-foreground)] transition-colors hover:border-[var(--border)] focus:border-[var(--foreground)] focus:outline-none"
        />
        {savingCaption && (
          <span className="ml-2 text-[11px] text-[var(--tertiary-foreground)]">Saving...</span>
        )}
      </div>
    </div>
  );
}

