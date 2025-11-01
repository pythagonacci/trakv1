"use client";

import { useState, useRef, useEffect } from "react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";

interface TextBlockProps {
  block: Block;
  onUpdate?: () => void;
}

export default function TextBlock({ block, onUpdate }: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState((block.content?.text as string) || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleBlur = async () => {
    setIsEditing(false);
    // Save changes
    if (content !== (block.content?.text as string)) {
      try {
        await updateBlock({
          blockId: block.id,
          content: { text: content },
        });
        onUpdate?.();
      } catch (error) {
        console.error("Failed to update text block:", error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Revert changes
      setContent((block.content?.text as string) || "");
      setIsEditing(false);
    }
    // Allow Enter for new lines (default behavior)
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full p-5 bg-transparent border-none focus:outline-none resize-none min-h-[200px] text-sm text-neutral-900 dark:text-white leading-relaxed"
        placeholder="Start writing..."
      />
    );
  }

  // Format text with simple markdown-like formatting
  const formatText = (text: string): string => {
    if (!text || text.trim() === "") {
      return '<span class="text-neutral-400 italic">Click to add text...</span>';
    }

    // Split into lines to handle formatting per line
    const lines = text.split('\n');
    const formattedLines = lines.map((line) => {
      // Skip empty lines (will be handled by paragraph breaks)
      if (!line.trim()) return '<br/>';
      
      // Apply inline formatting first (bold)
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-neutral-900 dark:text-white">$1</strong>');
      
      // Then check for special line prefixes
      if (/^• /.test(formatted)) {
        return `<div class="flex gap-2 mb-2"><span class="text-neutral-400">•</span><span>${formatted.replace(/^• /, '')}</span></div>`;
      }
      if (/^→ /.test(formatted)) {
        return `<div class="flex gap-2 mb-2 text-blue-600 dark:text-blue-400"><span>→</span><span>${formatted.replace(/^→ /, '')}</span></div>`;
      }
      if (/✅ /.test(formatted)) {
        return `<div class="flex gap-2 mb-2"><span>✅</span><span>${formatted.replace(/✅ /, '')}</span></div>`;
      }
      if (/⚠️ /.test(formatted)) {
        return `<div class="flex gap-2 mb-2"><span>⚠️</span><span>${formatted.replace(/⚠️ /, '')}</span></div>`;
      }
      if (/💬 /.test(formatted)) {
        return `<div class="flex gap-2 mb-2"><span>💬</span><span>${formatted.replace(/💬 /, '')}</span></div>`;
      }
      if (/🔄 /.test(formatted)) {
        return `<div class="flex gap-2 mb-2"><span>🔄</span><span>${formatted.replace(/🔄 /, '')}</span></div>`;
      }
      if (/⭐/.test(formatted)) {
        return `<div class="mb-2">${formatted}</div>`;
      }
      
      // Regular line - wrap in paragraph
      return `<div class="mb-2">${formatted}</div>`;
    });

    return formattedLines.join('');
  };

  const formatted = formatText(content);

  return (
    <div
      onClick={handleEdit}
      className="p-5 cursor-text text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}

