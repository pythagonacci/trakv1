"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bold, Italic, Underline, Code, Type } from "lucide-react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TextBlockProps {
  block: Block;
  onUpdate?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved";

export default function TextBlock({ block, onUpdate }: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState((block.content?.text as string) || "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Auto-save with debounce
  const saveContent = useCallback(async (textToSave: string) => {
    setSaveStatus("saving");
    try {
      await updateBlock({
        blockId: block.id,
        content: { text: textToSave },
      });
      setSaveStatus("saved");
      onUpdate?.();
      // Reset to idle after showing "Saved" for 1 second
      setTimeout(() => setSaveStatus("idle"), 1000);
    } catch (error) {
      console.error("Failed to update text block:", error);
      setSaveStatus("idle");
    }
  }, [block.id, onUpdate]);

  // Debounced auto-save on content change
  useEffect(() => {
    if (isEditing && content !== (block.content?.text as string)) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Set new timeout to save after 1 second
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(content);
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, isEditing, block.content?.text, saveContent]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleBlur = async () => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setIsEditing(false);
    
    // Save immediately on blur if there are changes
    if (content !== (block.content?.text as string)) {
      await saveContent(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Revert changes
      setContent((block.content?.text as string) || "");
      setIsEditing(false);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  // Insert markdown syntax at cursor position
  const insertMarkdown = (before: string, after: string = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    // If text is selected, wrap it
    if (selectedText) {
      const newText = 
        content.substring(0, start) + 
        before + selectedText + after + 
        content.substring(end);
      setContent(newText);
      
      // Set cursor position after the insertion
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + before.length,
          end + before.length
        );
      }, 0);
    } else {
      // No selection, insert markers and place cursor between them
      const newText = 
        content.substring(0, start) + 
        before + after + 
        content.substring(end);
      setContent(newText);
      
      // Place cursor between the markers
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + before.length,
          start + before.length
        );
      }, 0);
    }
  };

  // Insert heading at start of line
  const insertHeading = (level: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    
    // Find start of current line
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    
    // Remove existing heading markers at start of line
    const lineContent = content.substring(lineStart, content.indexOf('\n', start) >= 0 ? content.indexOf('\n', start) : undefined);
    const cleanedLine = lineContent.replace(/^#{1,3} /, '');
    
    // Insert heading marker
    const headingMarker = '#'.repeat(level) + ' ';
    const lineEnd = content.indexOf('\n', start);
    const newText = 
      content.substring(0, lineStart) + 
      headingMarker + cleanedLine +
      (lineEnd >= 0 ? content.substring(lineEnd) : '');
    
    setContent(newText);
    
    // Move cursor to end of heading text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lineStart + headingMarker.length + cleanedLine.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  if (isEditing) {
    return (
      <div className="relative">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          {/* Bold */}
          <button
            onMouseDown={(e) => {
              e.preventDefault(); // Prevents textarea blur
              insertMarkdown('**');
            }}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
            title="Bold (Cmd/Ctrl+B)"
          >
            <Bold className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>

          {/* Italic */}
          <button
            onMouseDown={(e) => {
              e.preventDefault(); // Prevents textarea blur
              insertMarkdown('*');
            }}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
            title="Italic (Cmd/Ctrl+I)"
          >
            <Italic className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>

          {/* Code */}
          <button
            onMouseDown={(e) => {
              e.preventDefault(); // Prevents textarea blur
              insertMarkdown('`');
            }}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
            title="Code"
          >
            <Code className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>

          <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-1" />

          {/* Heading Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors text-sm text-neutral-700 dark:text-neutral-300"
                title="Heading"
              >
                <Type className="w-4 h-4" />
                <span>Heading</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onSelect={() => insertHeading(1)}
              >
                <span className="text-xl font-bold">Heading 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onSelect={() => insertHeading(2)}
              >
                <span className="text-lg font-bold">Heading 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onSelect={() => insertHeading(3)}
              >
                <span className="text-base font-bold">Heading 3</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save Status */}
          <div className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && "Saved"}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full p-5 bg-transparent border-none focus:outline-none resize-none min-h-[200px] text-sm text-neutral-900 dark:text-white leading-relaxed"
          placeholder="Start writing..."
        />
      </div>
    );
  }

  // Format text with markdown-like formatting (display mode)
  const formatText = (text: string): string => {
    if (!text || text.trim() === "") {
      return '<span class="text-neutral-400 italic">Click to add text...</span>';
    }

    // Split into lines to handle formatting per line
    const lines = text.split('\n');
    const formattedLines = lines.map((line) => {
      // Skip empty lines (will be handled by paragraph breaks)
      if (!line.trim()) return '<br/>';
      
      // Apply inline formatting first
      let formatted = line;
      
      // Bold: **text**
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-neutral-900 dark:text-white">$1</strong>');
      
      // Italic: *text*
      formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
      
      // Code: `text`
      formatted = formatted.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">$1</code>');
      
      // Headings: # H1, ## H2, ### H3
      if (/^### /.test(formatted)) {
        return `<h3 class="text-lg font-bold text-neutral-900 dark:text-white mb-2 mt-4">${formatted.replace(/^### /, '')}</h3>`;
      }
      if (/^## /.test(formatted)) {
        return `<h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-2 mt-4">${formatted.replace(/^## /, '')}</h2>`;
      }
      if (/^# /.test(formatted)) {
        return `<h1 class="text-2xl font-bold text-neutral-900 dark:text-white mb-3 mt-4">${formatted.replace(/^# /, '')}</h1>`;
      }
      
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