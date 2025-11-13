"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Code,
  Type,
} from "lucide-react";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AttachedFilesList from "./attached-files-list";
import { cn } from "@/lib/utils";

interface TextBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: () => void;
  autoFocus?: boolean;
}

type SaveStatus = "idle" | "saving" | "saved";

export default function TextBlock({ block, workspaceId, projectId, onUpdate, autoFocus = false }: TextBlockProps) {
  const blockContent = (block.content || {}) as { text?: string; borderless?: boolean };
  const initialContent = blockContent.text || "";
  const isEmpty = !initialContent || initialContent.trim() === "";
  const [isEditing, setIsEditing] = useState(autoFocus || isEmpty);
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isBorderless, setIsBorderless] = useState(Boolean(blockContent.borderless));
  const [hasSelection, setHasSelection] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = Boolean((block.content as Record<string, unknown> | undefined)?.borderless);
    if (next !== isBorderless) {
      const raf = requestAnimationFrame(() => setIsBorderless(next));
      return () => cancelAnimationFrame(raf);
    }
  }, [block.content, isBorderless]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isEditing) return;

    const resizeTextarea = () => {
      textarea.style.height = "auto";
      const newHeight = Math.max(40, textarea.scrollHeight); // Minimum 40px height
      textarea.style.height = `${newHeight}px`;
    };

    resizeTextarea();
    
    // Resize on input
    textarea.addEventListener("input", resizeTextarea);
    
    return () => {
      textarea.removeEventListener("input", resizeTextarea);
    };
  }, [isEditing, content]);

  const saveContent = useCallback(
    async (textToSave: string) => {
      setSaveStatus("saving");
      try {
        await updateBlock({
          blockId: block.id,
          content: {
            ...(block.content as Record<string, unknown> | undefined),
            text: textToSave,
            borderless: isBorderless,
          },
        });
        setSaveStatus("saved");
        onUpdate?.();
        setTimeout(() => setSaveStatus("idle"), 1000);
      } catch (error) {
        console.error("Failed to update text block:", error);
        setSaveStatus("idle");
      }
    },
    [block.id, onUpdate, isBorderless, block.content]
  );

  useEffect(() => {
    if (isEditing && content !== (block.content?.text as string)) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveContent(content);
      }, 800);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, isEditing, block.content?.text, saveContent]);

  const handleBlur = async () => {
    // Small delay to allow clicking on toolbar buttons
    setTimeout(async () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setShowToolbar(false);
      setIsEditing(false);
      if (content !== (block.content?.text as string)) {
        await saveContent(content);
      }
    }, 200);
  };

  const updateToolbarPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasTextSelected = start !== end;
    
    const rect = textarea.getBoundingClientRect();
    const toolbarWidth = 100; // Approximate width of compact square toolbar (3 columns)
    
    if (hasTextSelected) {
      // When text is selected, follow the selection
      const cursorPosition = start;
      const textBeforeCursor = content.substring(0, cursorPosition);
      const lines = textBeforeCursor.split("\n");
      const lineNumber = lines.length - 1;
      
      const styles = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(styles.lineHeight) || 20;
      const paddingTop = parseFloat(styles.paddingTop) || 10;
      const scrollTop = textarea.scrollTop;
      const lineTop = paddingTop + (lineNumber * lineHeight) - scrollTop;
      
      // Position toolbar aligned with the selected line
      const top = rect.top + lineTop + (lineHeight / 2);
      const left = rect.left - toolbarWidth - 16; // 16px gap from textarea
      
      setToolbarPosition({ top, left });
    } else {
      // When just typing, keep toolbar in a fixed position at top-left of textarea
      const top = rect.top + 12; // Small offset from top
      const left = rect.left - toolbarWidth - 16; // 16px gap from textarea
      
      setToolbarPosition({ top, left });
    }
    
    setHasSelection(hasTextSelected);
  }, [content]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isEditing) return;

    const handleEvents = () => {
      // Small delay to ensure selection/cursor position is updated
      setTimeout(() => {
        updateToolbarPosition();
        setShowToolbar(true);
      }, 10);
    };

    const handleFocus = () => {
      setShowToolbar(true);
      setTimeout(updateToolbarPosition, 10);
    };

    const handleBlur = () => {
      // Don't hide immediately on blur - let the textarea's onBlur handle it
      // This prevents toolbar from disappearing when clicking on it
    };

    textarea.addEventListener("focus", handleFocus);
    textarea.addEventListener("blur", handleBlur);
    textarea.addEventListener("mouseup", handleEvents);
    textarea.addEventListener("keyup", handleEvents);
    textarea.addEventListener("keydown", handleEvents);
    textarea.addEventListener("select", handleEvents);
    textarea.addEventListener("input", handleEvents);
    document.addEventListener("selectionchange", handleEvents);

    // Initial position when editing starts
    if (document.activeElement === textarea) {
      handleFocus();
    }

    return () => {
      textarea.removeEventListener("focus", handleFocus);
      textarea.removeEventListener("blur", handleBlur);
      textarea.removeEventListener("mouseup", handleEvents);
      textarea.removeEventListener("keyup", handleEvents);
      textarea.removeEventListener("keydown", handleEvents);
      textarea.removeEventListener("select", handleEvents);
      textarea.removeEventListener("input", handleEvents);
      document.removeEventListener("selectionchange", handleEvents);
    };
  }, [isEditing, updateToolbarPosition]);

  const insertMarkdown = (before: string, after: string = before) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText) {
      const newText =
        content.substring(0, start) + before + selectedText + after + content.substring(end);
      setContent(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, end + before.length);
        updateToolbarPosition();
      }, 0);
    } else {
      const newText = content.substring(0, start) + before + after + content.substring(end);
      setContent(newText);
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + before.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        updateToolbarPosition();
      }, 0);
    }
  };

  const insertHeading = (level: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = content.indexOf("\n", start);
    const lineContent = content.substring(lineStart, lineEnd >= 0 ? lineEnd : undefined);
    const cleanedLine = lineContent.replace(/^#{1,3} /, "");
    const headingMarker = "#".repeat(level) + " ";
    const newText =
      content.substring(0, lineStart) + headingMarker + cleanedLine + (lineEnd >= 0 ? content.substring(lineEnd) : "");

    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lineStart + headingMarker.length + cleanedLine.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      updateToolbarPosition();
    }, 0);
  };

  if (isEditing) {
    return (
      <div className="relative">
        {/* Floating bubble toolbar */}
        {showToolbar && toolbarPosition.top > 0 && (
          <div
            ref={toolbarRef}
            className="fixed z-[100] grid grid-cols-3 gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            style={{
              top: `${toolbarPosition.top}px`,
              left: `${toolbarPosition.left}px`,
              transform: "translateY(-50%)",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Keep textarea focused
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertMarkdown("**");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertMarkdown("*");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertMarkdown("__", "__");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              title="Underline"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                insertMarkdown("`");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              title="Code"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                  <Type className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => insertHeading(1)}>Heading 1</DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertHeading(2)}>Heading 2</DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertHeading(3)}>Heading 3</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="h-7 w-7" /> {/* Empty space for grid alignment */}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setContent((block.content?.text as string) || "");
              setShowToolbar(false);
              setIsEditing(false);
            }
          }}
          className="w-full resize-none rounded-[4px] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none overflow-hidden"
          placeholder="Start typing…"
        />
        {saveStatus !== "idle" && (
          <div className="absolute bottom-2 right-2 text-xs text-[var(--tertiary-foreground)]">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
          </div>
        )}
      </div>
    );
  }

  const formatText = (text: string): string => {
    if (!text || text.trim() === "") {
      return '<span class="text-[var(--tertiary-foreground)] italic">Click to add text…</span>';
    }

    const lines = text.split("\n");
    const formattedLines = lines.map((line) => {
      if (!line.trim()) return "<br/>";

      let formatted = line;
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-medium text-[var(--foreground)]">$1</strong>');
      formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-[var(--foreground)]/90">$1</em>');
      formatted = formatted.replace(/`([^`]+)`/g, '<code class="rounded-sm bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]">$1</code>');

      if (/^### /.test(formatted)) {
        return `<h3 class="text-base font-medium text-[var(--foreground)] mb-2">${formatted.replace(/^### /, "")}</h3>`;
      }
      if (/^## /.test(formatted)) {
        return `<h2 class="text-lg font-semibold text-[var(--foreground)] mb-2">${formatted.replace(/^## /, "")}</h2>`;
      }
      if (/^# /.test(formatted)) {
        return `<h1 class="text-xl font-semibold text-[var(--foreground)] mb-3">${formatted.replace(/^# /, "")}</h1>`;
      }

      // Specific list item styles
      if (/^• /.test(formatted)) {
        return `<div class="flex items-start gap-2 mb-1.5"><span class="text-[var(--muted-foreground)]">•</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/^• /, '')}</span></div>`;
      }
      if (/^→ /.test(formatted)) {
        return `<div class="flex items-start gap-2 mb-1.5 text-[var(--info)]"><span>→</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/^→ /, '')}</span></div>`;
      }
      if (/✅ /.test(formatted)) {
        return `<div class="flex items-start gap-2 mb-1.5 text-[var(--success)]"><span>✅</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/✅ /, '')}</span></div>`;
      }
      if (/⚠️ /.test(formatted)) {
        return `<div class="flex items-start gap-2 mb-1.5 text-[var(--warning)]"><span>⚠️</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/⚠️ /, '')}</span></div>`;
      }
      if (/💬 /.test(formatted)) {
        return `<div class="flex items-start gap-2 mb-1.5 text-[var(--muted-foreground)]"><span>💬</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/💬 /, '')}</span></div>`;
      }
      if (/🔄 /.test(formatted)) {
        return `<div class="flex items-start gap-2 mb-1.5 text-[var(--info)]"><span>🔄</span><span class="text-sm text-[var(--foreground)]">${formatted.replace(/🔄 /, '')}</span></div>`;
      }
      if (/⭐/.test(formatted)) {
        return `<div class="mb-1.5 text-sm text-[var(--foreground)]">${formatted}</div>`;
      }

      return `<p class="mb-1.5 text-sm leading-relaxed text-[var(--foreground)]">${formatted}</p>`;
    });

    return formattedLines.join("");
  };

  const formatted = formatText(content);

  return (
    <div className="space-y-3">
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-text text-sm leading-relaxed text-[var(--foreground)]"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
      {workspaceId && projectId && <AttachedFilesList blockId={block.id} onUpdate={onUpdate} />}
    </div>
  );
}