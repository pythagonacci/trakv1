"use client";

import { useState, useRef, useEffect } from "react";
import { Link2, ExternalLink, Edit3 } from "lucide-react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";

interface LinkBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
}

export default function LinkBlock({ block, onUpdate }: LinkBlockProps) {
  const content = (block.content || {}) as {
    title?: string;
    url?: string;
    caption?: string;
  };

  const [title, setTitle] = useState(content.title || "");
  const [url, setUrl] = useState(content.url || "");
  const [caption, setCaption] = useState(content.caption || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isCaptionEditing, setIsCaptionEditing] = useState(false);
  const [savingCaption, setSavingCaption] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-open editing mode for empty links
  useEffect(() => {
    if (!content.title && !content.url && !isEditing) {
      setIsEditing(true);
    }
  }, [content.title, content.url, isEditing]);

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

  const handleCaptionBlur = () => {
    setIsCaptionEditing(false);
  };

  const handleSaveLink = async () => {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    // Basic URL validation
    let finalUrl = trimmedUrl;
    if (trimmedUrl && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      finalUrl = `https://${trimmedUrl}`;
    }

    const newContent = {
      ...content,
      title: trimmedTitle || null,
      url: finalUrl || null,
      description: null,
    };

    // Optimistic update: close modal and update parent immediately so saved UI shows right away
    setIsEditing(false);
    onUpdate?.({ ...block, content: newContent, updated_at: new Date().toISOString() });

    const result = await updateBlock({
      blockId: block.id,
      content: newContent,
    });

    // Sync with server response (in case of any server-side transforms)
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      // Revert on error by refetching
      onUpdate?.();
    }
  };

  const handleCancelEdit = () => {
    setTitle(content.title || "");
    setUrl(content.url || "");
    setIsEditing(false);
  };

  const displayTitle = content.title || "Untitled Link";
  const displayUrl = content.url || "#";
  const isValidUrl = content.url && (content.url.startsWith('http://') || content.url.startsWith('https://'));

  useEffect(() => {
    if (isCaptionEditing) {
      captionInputRef.current?.focus();
    }
  }, [isCaptionEditing]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
    };
  }, []);

  if (isEditing) {
    return (
      <div className="space-y-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <Link2 className="h-4 w-4" />
          Edit Link
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--ring)] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Link title..."
              className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--ring)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            onClick={handleCancelEdit}
            className="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveLink}
            disabled={!url.trim()}
            className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-[4px] transition-colors"
          >
            Save Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="group relative">
        <a
          href={isValidUrl ? displayUrl : "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!isValidUrl) {
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          className="flex items-start gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition-colors hover:border-[var(--foreground)]/20 hover:text-[var(--foreground)]"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[var(--surface-hover)] text-[var(--foreground)]/70 shrink-0">
            <Link2 className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium text-[var(--foreground)]">
                {displayTitle}
              </div>
              {isValidUrl && (
                <ExternalLink className="h-3 w-3 text-[var(--tertiary-foreground)] shrink-0" />
              )}
            </div>
            <div className="text-[11px] text-[var(--tertiary-foreground)]">
              {isValidUrl ? displayUrl : "Click to add URL"}
            </div>
          </div>
        </a>

        {/* Edit button */}
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[3px] hover:bg-[var(--surface-hover)]"
          title="Edit link"
        >
          <Edit3 className="h-3 w-3 text-[var(--muted-foreground)]" />
        </button>
      </div>

      <div className="group px-1">
        {isCaptionEditing ? (
          <div className="flex items-center gap-2">
            <input
              ref={captionInputRef}
              type="text"
              value={caption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              onBlur={handleCaptionBlur}
              placeholder="Add caption..."
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-[4px] border border-[var(--border)] px-2 py-1 text-sm text-[var(--muted-foreground)] transition-colors focus:outline-none focus:border-[var(--ring)]"
            />
            {savingCaption && (
              <span className="text-[11px] text-[var(--tertiary-foreground)]">Saving...</span>
            )}
          </div>
        ) : caption ? (
          <button
            type="button"
            onClick={() => setIsCaptionEditing(true)}
            className="w-full text-left rounded-[4px] border border-transparent px-2 py-1 text-sm text-[var(--muted-foreground)] transition-colors hover:border-[var(--border)] hover:text-[var(--foreground)]"
          >
            {caption}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsCaptionEditing(true)}
            className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto w-full text-left rounded-[4px] border border-transparent px-2 py-1 text-sm text-[var(--muted-foreground)] transition-opacity hover:border-[var(--border)]"
          >
            Add caption
          </button>
        )}
      </div>
    </div>
  );
}
