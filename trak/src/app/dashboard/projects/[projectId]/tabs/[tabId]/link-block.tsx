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
    <div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-5 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors rounded-lg"
      >
        <div className="w-10 h-10 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
          <Link2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
            {title}
          </div>
          {description && (
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              {description}
            </div>
          )}
          <div className="text-xs text-neutral-500 dark:text-neutral-500 font-mono truncate">
            {url}
          </div>
        </div>
      </a>
      
      {/* Caption Input */}
      <div className="px-5 pb-3">
        <input
          type="text"
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="Add caption..."
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-400 dark:focus:border-neutral-600 focus:outline-none bg-transparent text-neutral-600 dark:text-neutral-400"
        />
        {savingCaption && (
          <span className="text-xs text-neutral-500 ml-2">Saving...</span>
        )}
      </div>
    </div>
  );
}

