"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Code,
  Type,
  Square,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setIsEditing(false);
    if (content !== (block.content?.text as string)) {
      await saveContent(content);
    }
  };

  const toggleBorderless = async () => {
    const next = !isBorderless;
    setIsBorderless(next);
    try {
      await updateBlock({
        blockId: block.id,
        content: {
          ...(block.content as Record<string, unknown> | undefined),
          text: content,
          borderless: next,
        },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update text block appearance:", error);
    }
  };

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
      }, 0);
    } else {
      const newText = content.substring(0, start) + before + after + content.substring(end);
      setContent(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length);
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
    }, 0);
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("**");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("*");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("__", "__");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("`");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            title="Code"
          >
            <Code className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]">
                <Type className="h-4 w-4" /> Headings
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => insertHeading(1)}>Heading 1</DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(2)}>Heading 2</DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(3)}>Heading 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBorderless();
            }}
            className={cn(
              "ml-1 flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]",
              isBorderless && "bg-[var(--surface-hover)] text-[var(--foreground)]"
            )}
            title={isBorderless ? "Show block border" : "Hide block border"}
          >
            <Square className="h-4 w-4" />
          </button>

          <span className="ml-auto text-xs text-[var(--tertiary-foreground)]">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setContent((block.content?.text as string) || "");
              setIsEditing(false);
            }
          }}
          className="min-h-[100px] w-full resize-none rounded-b-[4px] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none"
          placeholder="Start typing…"
        />
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