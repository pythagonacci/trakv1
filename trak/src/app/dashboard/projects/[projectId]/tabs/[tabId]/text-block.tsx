"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Type,
  Maximize2,
  Minimize2,
  List,
  ListTodo,
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
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useBlockReferencePicker } from "@/components/blocks/block-reference-picker-provider";
import { useBlockReferences, useDeleteBlockReference } from "@/lib/hooks/use-block-references";
import type { LinkableItem } from "@/app/actions/timelines/linkable-actions";
import { getLinkableItemHref } from "@/lib/references/navigation";

interface TextBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: (updatedBlock?: Block) => void;
  autoFocus?: boolean;
  readOnly?: boolean;
}

type SaveStatus = "idle" | "saving" | "saved";

type HighlightColor = "yellow" | "green" | "blue" | "pink";

const HIGHLIGHT_COLORS: Record<HighlightColor, { label: string; color: string }> = {
  yellow: { label: "Yellow", color: "rgba(250, 204, 21, 0.35)" },
  green: { label: "Green", color: "rgba(34, 197, 94, 0.30)" },
  blue: { label: "Blue", color: "rgba(59, 130, 246, 0.30)" },
  pink: { label: "Pink", color: "rgba(244, 114, 182, 0.30)" },
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Extract the entity reference_id from a ref-link anchor's href
function extractEntityIdFromAnchor(el: Element): string | null {
  const href = el.getAttribute("href") || "";
  const docMatch = href.match(/\/dashboard\/docs\/([a-zA-Z0-9_-]+)/);
  if (docMatch) return docMatch[1];
  const fragmentMatch = href.match(/#(?:block|task)-([a-zA-Z0-9_-]+)/);
  if (fragmentMatch) return fragmentMatch[1];
  return null;
}

const normalizeUnmatchedBold = (input: string) => {
  let result = input;
  const boldTokens = (result.match(/\*\*/g) || []).length;

  if (boldTokens % 2 !== 0) {
    const lastIndex = result.lastIndexOf("**");
    if (lastIndex !== -1) {
      result = result.slice(0, lastIndex) + result.slice(lastIndex + 2);
    }
  }

  return result;
};

/** Inline markdown → HTML for a single line segment (no block-level prefixes). */
const applyInlineFormatting = (segment: string): string => {
  let formatted = segment;
  if (/<u>.*?<\/u>/.test(formatted)) {
    formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="underline text-[var(--foreground)]">$1</u>');
  }
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" title="${safeLabel}" data-ref-link="true" class="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">${safeLabel}</a>`;
  });
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--foreground)]">$1</strong>');
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-[var(--foreground)]/90">$1</em>');
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code class="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]">$1</code>'
  );
  return formatted;
};

// Format markdown text to HTML
const formatText = (text: string): string => {
  if (!text || text.trim() === "") {
    return '<span class="text-[var(--tertiary-foreground)] italic">Click to add text…</span>';
  }

  const lines = text.split("\n");
  const formattedLines = lines.map((rawLine, lineIdx) => {
    const line = normalizeUnmatchedBold(rawLine);
    if (!line.trim()) return "<br/>";

    let formatted = line;
    if (/<u>.*?<\/u>/.test(formatted)) {
      formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="underline text-[var(--foreground)]">$1</u>');
    }
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const safeLabel = escapeHtml(label);
      const safeUrl = escapeHtml(url);
      return `<a href="${safeUrl}" title="${safeLabel}" data-ref-link="true" class="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">${safeLabel}</a>`;
    });
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--foreground)]">$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-[var(--foreground)]/90">$1</em>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[var(--foreground)]">$1</code>');

    if (/^### /.test(formatted)) {
      return `<h3 class="text-base font-medium text-[var(--foreground)] mb-2">${formatted.replace(/^### /, "")}</h3>`;
    }
    if (/^## /.test(formatted)) {
      return `<h2 class="text-lg font-semibold text-[var(--foreground)] mb-2">${formatted.replace(/^## /, "")}</h2>`;
    }
    if (/^# /.test(formatted)) {
      return `<h1 class="text-xl font-semibold text-[var(--foreground)] mb-3">${formatted.replace(/^# /, "")}</h1>`;
    }

    const taskMatch = formatted.match(/^- \[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].trim().toLowerCase() === "x";
      const bodyHtml = applyInlineFormatting(taskMatch[2]);
      const checkedAttr = checked ? "true" : "false";
      const boxClass = checked
        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
        : "border-[var(--border)] bg-[var(--surface)] text-transparent";
      return `<div class="flex items-start gap-2 mb-1.5" data-textblock-li="task" data-checked="${checkedAttr}" data-checklist-idx="${lineIdx}"><span contenteditable="false" data-checklist-toggle="true" role="checkbox" aria-checked="${checkedAttr}" tabindex="0" class="mt-0.5 flex h-3.5 w-3.5 shrink-0 cursor-pointer select-none items-center justify-center rounded-sm border text-[10px] leading-none ${boxClass}">${checked ? "&#10003;" : ""}</span><span data-task-body="true" class="min-w-0 flex-1 text-sm text-[var(--foreground)]">${bodyHtml}</span></div>`;
    }

    if (/^- /.test(formatted) && !/^- \[[ xX]\]\s+/i.test(formatted)) {
      const body = formatted.slice(2);
      const bodyHtml = applyInlineFormatting(body);
      return `<div class="flex items-start gap-2 mb-1.5" data-textblock-li="bullet" data-bullet-idx="${lineIdx}"><span class="mt-0.5 text-[var(--muted-foreground)] select-none" contenteditable="false">&#8226;</span><span data-bullet-body="true" class="min-w-0 flex-1 text-sm text-[var(--foreground)]">${bodyHtml}</span></div>`;
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

  const html = formattedLines.join("");

  // SECURITY: Sanitize HTML to prevent XSS attacks
  return sanitizeHtml(html);
};

function stripListAndHeadingPrefixes(line: string): string {
  const t = line;
  if (/^### /.test(t)) return t.slice(4);
  if (/^## /.test(t)) return t.slice(3);
  if (/^# /.test(t)) return t.slice(2);
  if (/^- \[[ xX]\]\s+/i.test(t)) return t.replace(/^- \[[ xX]\]\s+/i, "");
  if (/^- /.test(t)) return t.slice(2);
  if (/^• /.test(t)) return t.slice(2);
  return t;
}

/** Markdown line: `- item`; click again on a `-` bullet line removes the bullet. */
function applyBulletMarkdownLine(line: string): string {
  const t = line.trimStart();
  const isTask = /^- \[[ xX]\]\s+/i.test(t);
  const isDashOnly = /^- /.test(t) && !isTask;
  const core = stripListAndHeadingPrefixes(line);
  if (isDashOnly) {
    return core;
  }
  return `- ${core}`;
}

/** Markdown line: checklist item (unchecked). */
function applyChecklistMarkdownLine(line: string): string {
  const core = stripListAndHeadingPrefixes(line);
  return `- [ ] ${core}`;
}

export default function TextBlock({
  block,
  workspaceId,
  projectId,
  onUpdate,
  autoFocus = false,
  readOnly = false,
}: TextBlockProps) {
  const blockContent = (block.content || {}) as { text?: string; borderless?: boolean; heightPx?: number };
  const initialContent = blockContent.text || "";
  const isEmpty = !initialContent || initialContent.trim() === "";
  const initialHeightPx =
    typeof blockContent.heightPx === "number" && blockContent.heightPx > 0
      ? blockContent.heightPx
      : null;
  const [isEditing, setIsEditing] = useState(!readOnly && (autoFocus || isEmpty));
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isBorderless, setIsBorderless] = useState(Boolean(blockContent.borderless));
  const [minHeightPx, setMinHeightPx] = useState<number | null>(initialHeightPx);
  const [isHeightExpanded, setIsHeightExpanded] = useState(false);
  const [activeFormatting, setActiveFormatting] = useState({ bold: false, italic: false, underline: false });
  const [activeHighlightColor, setActiveHighlightColor] = useState<HighlightColor | null>(null);
  const textareaRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minHeightRef = useRef<number | null>(initialHeightPx);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const mentionRangeRef = useRef<Range | null>(null);
  const mentionStartRef = useRef<{ node: Node; offset: number } | null>(null);
  const mentionEndRef = useRef<{ node: Node; offset: number } | null>(null);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const referencePicker = useBlockReferencePicker();
  // Track which reference_ids were inserted as inline @mentions so we can
  // auto-delete their block references when the mention text is erased.
  const inlineMentionRefIds = useRef<Set<string>>(new Set());
  const { data: blockRefs } = useBlockReferences(block.id);
  const blockRefsRef = useRef(blockRefs ?? []);
  const deleteBlockRef = useDeleteBlockReference(block.id);

  useEffect(() => {
    blockRefsRef.current = blockRefs ?? [];
  }, [blockRefs]);

  useEffect(() => {
    const next = Boolean((block.content as Record<string, unknown> | undefined)?.borderless);
    if (next !== isBorderless) {
      const raf = requestAnimationFrame(() => setIsBorderless(next));
      return () => cancelAnimationFrame(raf);
    }
  }, [block.content, isBorderless]);

  useEffect(() => {
    const contentRecord = (block.content as Record<string, unknown> | undefined) ?? undefined;
    const heightPx = contentRecord?.heightPx;
    const next =
      typeof heightPx === "number" && heightPx > 0
        ? heightPx
        : null;
    minHeightRef.current = next;
    setMinHeightPx((current) => (current === next ? current : next));
    if (!next) {
      setIsHeightExpanded(false);
    }
  }, [block.content]);

  const editingRef = useRef(false);

  useEffect(() => {
    if (isEditing && textareaRef.current && !editingRef.current) {
      const editableDiv = textareaRef.current as HTMLDivElement;
      
      // Only initialize HTML content when first entering edit mode
      const formattedHTML = formatText(content) || '<span class="text-[var(--tertiary-foreground)] italic">Start typing…</span>';
      editableDiv.innerHTML = formattedHTML;
      editingRef.current = true;

      // Seed inlineMentionRefIds with any ref-links already present in the saved content
      // so that deleting them later will also remove their block references.
      inlineMentionRefIds.current = new Set();
      editableDiv.querySelectorAll('a[data-ref-link="true"]').forEach((link) => {
        const refId = extractEntityIdFromAnchor(link);
        if (refId) inlineMentionRefIds.current.add(refId);
      });
      
      editableDiv.focus();
      // Move cursor to end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(editableDiv);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else if (!isEditing) {
      // Reset flag when not editing
      editingRef.current = false;
    }
  }, [isEditing, content]);

  // Auto-resize contenteditable to fit content
  useEffect(() => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv || !isEditing) return;

    const resizeEditable = () => {
      editableDiv.style.height = "auto";
      const savedHeight = minHeightRef.current;
      const newHeight = savedHeight && !isHeightExpanded
        ? Math.max(20, savedHeight)
        : Math.max(20, savedHeight ?? 0, editableDiv.scrollHeight);
      editableDiv.style.height = `${newHeight}px`;
    };

    resizeEditable();
    
    // Resize on input
    const observer = new MutationObserver(resizeEditable);
    observer.observe(editableDiv, { childList: true, subtree: true, characterData: true });
    
    editableDiv.addEventListener("input", resizeEditable);
    
    return () => {
      observer.disconnect();
      editableDiv.removeEventListener("input", resizeEditable);
    };
  }, [isEditing, content, isHeightExpanded]);

  const saveContent = useCallback(
    async (textToSave: string) => {
      setSaveStatus("saving");
      try {
        const result = await updateBlock({
          blockId: block.id,
          content: {
            ...(block.content as Record<string, unknown> | undefined),
            text: textToSave,
            borderless: isBorderless,
            heightPx: minHeightRef.current,
          },
        });
        if ("error" in result) {
          throw new Error(result.error);
        }
        setSaveStatus("saved");
        onUpdate?.("data" in result ? result.data : undefined);
        setTimeout(() => setSaveStatus("idle"), 1000);
      } catch (error) {
        console.error("Failed to update text block:", error);
        setSaveStatus("idle");
      }
    },
    [block.id, onUpdate, isBorderless, block.content]
  );

  const toggleChecklistLineAtIndex = useCallback(
    (lineIdx: number) => {
      setContent((prev) => {
        const lines = prev.split("\n");
        if (lineIdx < 0 || lineIdx >= lines.length) return prev;
        const line = lines[lineIdx];
        const m = line.match(/^- \[([ xX])\]\s+(.*)$/);
        if (!m) return prev;
        const checked = m[1].trim().toLowerCase() === "x";
        lines[lineIdx] = (checked ? "- [ ] " : "- [x] ") + m[2];
        const next = lines.join("\n");

        queueMicrotask(() => {
          const ed = textareaRef.current;
          if (ed) {
            const html = formatText(next);
            ed.innerHTML =
              html && html.trim() !== ""
                ? html
                : '<span class="text-[var(--tertiary-foreground)] italic">Start typing…</span>';
            inlineMentionRefIds.current = new Set();
            ed.querySelectorAll('a[data-ref-link="true"]').forEach((link) => {
              const refId = link.getAttribute("data-ref-id") || extractEntityIdFromAnchor(link);
              if (refId) inlineMentionRefIds.current.add(refId);
            });
          }
          void saveContent(next);
        });

        return next;
      });
    },
    [saveContent]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly) return;
      e.preventDefault();
      e.stopPropagation();

      const measuredHeight =
        textareaRef.current?.getBoundingClientRect().height ??
        displayRef.current?.getBoundingClientRect().height ??
        minHeightRef.current ??
        20;

      resizeStateRef.current = {
        startY: e.clientY,
        startHeight: Math.max(20, Math.round(measuredHeight)),
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizeStateRef.current) return;
        const delta = ev.clientY - resizeStateRef.current.startY;
        const nextHeight = Math.max(20, Math.round(resizeStateRef.current.startHeight + delta));
        minHeightRef.current = nextHeight;
        setMinHeightPx(nextHeight);
      };

      const handleMouseUp = async () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        const finalHeight = Math.max(20, Math.round(minHeightRef.current ?? resizeStateRef.current?.startHeight ?? 20));
        minHeightRef.current = finalHeight;
        setMinHeightPx(finalHeight);
        setIsHeightExpanded(false);
        resizeStateRef.current = null;

        if (!block.id.startsWith("temp-")) {
          try {
            const result = await updateBlock({
              blockId: block.id,
              content: {
                ...(block.content as Record<string, unknown> | undefined),
                text: content,
                borderless: isBorderless,
                heightPx: finalHeight,
              },
            });

            if ("data" in result && result.data) {
              onUpdate?.(result.data);
            } else if ("error" in result && result.error) {
              console.error("Failed to update text block height:", result.error);
            } else {
              onUpdate?.();
            }
          } catch (error) {
            console.error("Failed to update text block height:", error);
          }
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [block.content, block.id, content, isBorderless, onUpdate, readOnly]
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
    // Small delay to allow clicking on toolbar buttons / dropdowns
    setTimeout(async () => {
      // Don't exit editing if a mention/reference picker selection is in progress
      if (mentionStartRef.current) return;

      // If focus moved into the text block toolbar or its dropdown menus, stay in edit mode
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.closest('[data-textblock-toolbar="true"]')) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setIsEditing(false);
      if (content !== (block.content?.text as string)) {
        await saveContent(content);
      }
    }, 200);
  };

  const updateActiveFormatting = useCallback(() => {
    // Check active formatting states
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');
    setActiveFormatting({ bold: isBold, italic: isItalic, underline: isUnderline });
  }, []);

  useEffect(() => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv || !isEditing) return;

    const handleEvents = () => {
      // Small delay to ensure selection/cursor position is updated
      setTimeout(() => {
        updateActiveFormatting();
        syncContentFromHTML();
      }, 10);
    };

    const handleFocus = () => {
      setTimeout(updateActiveFormatting, 10);
    };

    const handleBlur = () => {
      // Don't hide immediately on blur - let the editable div's onBlur handle it
      // This prevents toolbar from disappearing when clicking on it
    };

    editableDiv.addEventListener("focus", handleFocus);
    editableDiv.addEventListener("blur", handleBlur);
    editableDiv.addEventListener("mouseup", handleEvents);
    editableDiv.addEventListener("keyup", handleEvents);
    editableDiv.addEventListener("keydown", handleEvents);
      editableDiv.addEventListener("input", handleEvents);
      document.addEventListener("selectionchange", handleEvents);

      // Initial formatting state when editing starts
      if (document.activeElement === editableDiv) {
        handleFocus();
      }

      return () => {
        editableDiv.removeEventListener("focus", handleFocus);
        editableDiv.removeEventListener("blur", handleBlur);
        editableDiv.removeEventListener("mouseup", handleEvents);
        editableDiv.removeEventListener("keyup", handleEvents);
        editableDiv.removeEventListener("keydown", handleEvents);
        editableDiv.removeEventListener("input", handleEvents);
        document.removeEventListener("selectionchange", handleEvents);
      };
    }, [isEditing, updateActiveFormatting]);

  const insertMarkdown = (before: string, after: string = before) => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (selectedText) {
      // Wrap selected text
      const markdownText = before + selectedText + after;
      range.deleteContents();
      const textNode = document.createTextNode(markdownText);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Insert markdown at cursor
      const textNode = document.createTextNode(before + after);
      range.insertNode(textNode);
      // Position cursor between before and after
      range.setStart(textNode, before.length);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Update content from HTML
    syncContentFromHTML();
    updateActiveFormatting();
  };

  const insertIndentAtSelection = () => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      range.collapse(true);
    }
    const indentNode = document.createTextNode("    ");
    range.deleteContents();
    range.insertNode(indentNode);
    range.setStartAfter(indentNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    syncContentFromHTML();
    updateActiveFormatting();
  };

  const mutateCurrentLine = (transform: (lineText: string) => string) => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const editableText = editableDiv.textContent || "";

    const preRange = document.createRange();
    preRange.setStart(editableDiv, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    let lineStart = 0;
    for (let i = startOffset - 1; i >= 0; i--) {
      if (editableText[i] === "\n") {
        lineStart = i + 1;
        break;
      }
    }

    let lineEnd = editableText.length;
    for (let i = startOffset; i < editableText.length; i++) {
      if (editableText[i] === "\n") {
        lineEnd = i;
        break;
      }
    }

    let charCount = 0;
    let startNode: Node | null = null;
    let startNodeOffset = 0;
    let endNode: Node | null = null;
    let endNodeOffset = 0;

    const walker = document.createTreeWalker(editableDiv, NodeFilter.SHOW_TEXT, null);
    let node;

    while ((node = walker.nextNode())) {
      const textLength = node.textContent?.length || 0;
      if (!startNode && charCount + textLength >= lineStart) {
        startNode = node;
        startNodeOffset = lineStart - charCount;
      }
      if (charCount + textLength >= lineEnd) {
        endNode = node;
        endNodeOffset = lineEnd - charCount;
        break;
      }
      charCount += textLength;
    }

    if (startNode && endNode) {
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
    }

    const lineText = range.toString().replace(/\n$/, "");
    const newLine = transform(lineText);

    range.deleteContents();
    const textNode = document.createTextNode(newLine);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    syncContentFromHTML();
    updateActiveFormatting();
  };

  const insertHeading = (level: number) => {
    const headingMarker = "#".repeat(level) + " ";
    mutateCurrentLine((lineText) => {
      const cleanedLine = lineText.replace(/^#{1,3} /, "");
      return headingMarker + cleanedLine;
    });
  };

  const insertBulletLine = () => {
    mutateCurrentLine(applyBulletMarkdownLine);
  };

  const insertChecklistLine = () => {
    mutateCurrentLine(applyChecklistMarkdownLine);
  };

  // Convert HTML back to markdown
  const htmlToMarkdown = (html: string): string => {
    if (!html || html.trim() === '') return '';
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let md = '';
    
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        const children = Array.from(node.childNodes);
        const childText = children.map(processNode).join('');
        
        switch (tagName) {
          case 'h1':
            return '# ' + childText + '\n';
          case 'h2':
            return '## ' + childText + '\n';
          case 'h3':
            return '### ' + childText + '\n';
          case 'strong':
          case 'b':
            return '**' + childText + '**';
          case 'em':
          case 'i':
            return '*' + childText + '*';
          case 'u':
            return '<u>' + childText + '</u>';
          case 'code':
            return '`' + childText + '`';
          case 'mark':
            // Preserve highlight markup (including color/style) as raw HTML in markdown
            return el.outerHTML;
          case 'a': {
            const href = el.getAttribute('href');
            if (!href) return childText;
            return `[${childText}](${href})`;
          }
        case 'br':
            return '\n';
        case 'p':
            return childText + '\n';
        case 'ul':
        case 'ol':
          return Array.from(el.childNodes)
            .map((child) => processNode(child))
            .join('');
        case 'li':
          return '- ' + childText.replace(/\n+$/g, '') + '\n';
        case 'div': {
          const liKind = el.getAttribute('data-textblock-li');
          if (liKind === 'task') {
            const checked = el.getAttribute('data-checked') === 'true';
            const bodyEl = el.querySelector('[data-task-body="true"]');
            const body =
              bodyEl && bodyEl.childNodes.length
                ? Array.from(bodyEl.childNodes).map(processNode).join('')
                : childText;
            return (checked ? '- [x] ' : '- [ ] ') + body.replace(/\n+$/g, '') + '\n';
          }
          if (liKind === 'bullet') {
            const bodyEl = el.querySelector('[data-bullet-body="true"]');
            const body =
              bodyEl && bodyEl.childNodes.length
                ? Array.from(bodyEl.childNodes).map(processNode).join('')
                : childText;
            return '- ' + body.replace(/\n+$/g, '') + '\n';
          }
          return childText + '\n';
        }
          default:
            return childText;
        }
      }
      
      return '';
    };
    
    md = Array.from(tempDiv.childNodes).map(processNode).join('');
    
    // Clean up extra newlines
    md = md.replace(/\n{3,}/g, '\n\n');
    
    return md.replace(/\n+$/g, '');
  };

  // Sync content from HTML in contenteditable
  const syncContentFromHTML = () => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;
    
    const html = editableDiv.innerHTML;
    const markdown = htmlToMarkdown(html);
    setContent(markdown);
  };

  // When inline mention links are deleted from the contenteditable, remove their block references.
  const checkRemovedMentions = useCallback(() => {
    if (inlineMentionRefIds.current.size === 0) return;
    const editableDiv = textareaRef.current;
    if (!editableDiv) return;

    const presentRefIds = new Set<string>();
    editableDiv.querySelectorAll('a[data-ref-link="true"]').forEach((link) => {
      // Prefer data-ref-id; fall back to parsing the href for restored-from-markdown links
      const stored = link.getAttribute("data-ref-id");
      const refId = stored || extractEntityIdFromAnchor(link);
      if (refId) presentRefIds.add(refId);
    });

    for (const refId of [...inlineMentionRefIds.current]) {
      if (!presentRefIds.has(refId)) {
        inlineMentionRefIds.current.delete(refId);
        const ref = blockRefsRef.current.find((r) => r.reference_id === refId);
        if (ref) void deleteBlockRef.mutateAsync(ref.id);
      }
    }
  }, [deleteBlockRef]);

  // Helper function to apply formatting
  const applyFormatting = (command: string) => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (editableDiv) {
      editableDiv.focus();
      document.execCommand(command, false);
      syncContentFromHTML();
      updateActiveFormatting();
    }
  };

  const applyHighlight = (color: HighlightColor) => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;

    editableDiv.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const highlightDef = HIGHLIGHT_COLORS[color];
    if (!highlightDef) return;

    // If selection is already inside a highlight, just update its color
    const commonAncestor = range.commonAncestorContainer;
    const existingMark =
      (commonAncestor instanceof Element
        ? commonAncestor.closest("mark[data-highlight-color]")
        : commonAncestor.parentElement?.closest?.("mark[data-highlight-color]")) || null;

    if (existingMark) {
      existingMark.setAttribute("data-highlight-color", color);
      existingMark.setAttribute(
        "style",
        `background-color: ${highlightDef.color}; border-radius: 2px; padding: 0 1px;`
      );
      syncContentFromHTML();
      setActiveHighlightColor(color);
      return;
    }

    // If there's a text selection, wrap it in a <mark>.
    // If the selection is collapsed (e.g. empty block), create an empty <mark>
    // and place the caret inside so the next characters are highlighted.
    const markEl = document.createElement("mark");
    markEl.setAttribute("data-highlight-color", color);
    markEl.setAttribute(
      "style",
      `background-color: ${highlightDef.color}; border-radius: 2px; padding: 0 1px;`
    );

    if (range.collapsed) {
      // Insert empty highlight at caret and move cursor inside it.
      range.insertNode(markEl);
      const newRange = document.createRange();
      newRange.setStart(markEl, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      const contents = range.extractContents();
      markEl.appendChild(contents);
      range.insertNode(markEl);

      const newRange = document.createRange();
      newRange.selectNodeContents(markEl);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    syncContentFromHTML();
    setActiveHighlightColor(color);
  };

  const clearHighlight = () => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;

    editableDiv.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;

    const markEl =
      (node instanceof Element
        ? node.closest("mark[data-highlight-color]")
        : node.parentElement?.closest?.("mark[data-highlight-color]")) || null;

    if (!markEl || !markEl.parentNode) return;

    // Unwrap the mark, keeping its children
    while (markEl.firstChild) {
      markEl.parentNode.insertBefore(markEl.firstChild, markEl);
    }
    markEl.parentNode.removeChild(markEl);

    syncContentFromHTML();
  };

  const insertInlineReference = useCallback(
    (item: LinkableItem, searchQuery?: string) => {
      const href = getLinkableItemHref({
        referenceType: item.referenceType,
        id: item.id,
        tabId: item.tabId,
        tabName: item.tabName,
        projectId: item.projectId,
        projectName: item.projectName,
        isWorkflow: item.isWorkflow,
      });
      if (!href) return;

      const editableDiv = textareaRef.current;
      if (!editableDiv) return;

      const label = `@${item.name}`;
      const markdown = `[${label}](${href})`;
      // Create HTML link element for immediate display
      const linkHtml = `<a href="${escapeHtml(href)}" title="${escapeHtml(label)}" data-ref-link="true" data-ref-id="${escapeHtml(item.id)}" class="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">${escapeHtml(label)}</a>`;
      // Track this ref ID so deletion of the mention text removes the attachment
      inlineMentionRefIds.current.add(item.id);

      // Use the tracked start and end ranges if available
      if (mentionStartRef.current && mentionEndRef.current) {
        try {
          // Verify the nodes are still in the DOM
          if (editableDiv.contains(mentionStartRef.current.node) && 
              editableDiv.contains(mentionEndRef.current.node)) {
            const range = document.createRange();
            range.setStart(mentionStartRef.current.node, mentionStartRef.current.offset);
            range.setEnd(mentionEndRef.current.node, mentionEndRef.current.offset);
            
            // Verify the range is valid
            if (range.toString().startsWith("@")) {
              range.deleteContents();
              // Insert HTML link element directly for immediate visual feedback
              const tempDiv = document.createElement("div");
              tempDiv.innerHTML = linkHtml;
              const linkElement = tempDiv.firstChild;
              if (linkElement) {
                range.insertNode(linkElement);
                range.setStartAfter(linkElement);
                range.collapse(true);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
                
                mentionStartRef.current = null;
                mentionEndRef.current = null;
                mentionRangeRef.current = null;
                setMentionSearchQuery("");
                // Sync immediately to update state
                syncContentFromHTML();
                editableDiv.focus();
                return;
              }
            }
          }
        } catch (e) {
          console.error("Error replacing mention with tracked range:", e);
        }
      }

      // Fallback: try to find "@" + search query in text content by finding current cursor
      const query = mentionSearchQuery || searchQuery || "";
      const selection = window.getSelection();
      if (mentionStartRef.current && selection && selection.rangeCount > 0) {
        try {
          // Get current cursor position
          const cursorRange = selection.getRangeAt(0);
          const cursorNode = cursorRange.startContainer;
          const cursorOffset = cursorRange.startOffset;
          
          // Try to create range from "@" to cursor
          if (editableDiv.contains(mentionStartRef.current.node) && editableDiv.contains(cursorNode)) {
            const range = document.createRange();
            range.setStart(mentionStartRef.current.node, mentionStartRef.current.offset);
            range.setEnd(cursorNode, cursorOffset);
            
            const rangeText = range.toString();
            if (rangeText.startsWith("@")) {
              range.deleteContents();
              const textNode = document.createTextNode(markdown);
              range.insertNode(textNode);
              range.setStartAfter(textNode);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              
              mentionStartRef.current = null;
              mentionEndRef.current = null;
              mentionRangeRef.current = null;
              setMentionSearchQuery("");
              syncContentFromHTML();
              editableDiv.focus();
              return;
            }
          }
        } catch (e) {
          console.error("Error replacing mention with cursor range:", e);
        }
      }
      
      // Another fallback: try to find "@" + search query in text content
      if (mentionStartRef.current && query) {
        try {
          const textContent = editableDiv.textContent || "";
          const atIndex = textContent.indexOf("@");
          
          if (atIndex !== -1) {
            // Find the "@" node
            const walker = document.createTreeWalker(
              editableDiv,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let charCount = 0;
            let atNode: Node | null = null;
            let atOffset = 0;
            
            while (walker.nextNode()) {
              const node = walker.currentNode;
              const text = node.textContent || "";
              const nodeStart = charCount;
              const nodeEnd = charCount + text.length;
              
              if (atIndex >= nodeStart && atIndex < nodeEnd) {
                atNode = node;
                atOffset = atIndex - nodeStart;
                break;
              }
              charCount = nodeEnd;
            }
            
            if (atNode) {
              const range = document.createRange();
              range.setStart(atNode, atOffset);
              
              // Calculate end position: "@" + query length
              const endPos = atIndex + 1 + query.length;
              let remaining = query.length + 1;
              let endNode: Node | null = atNode;
              let endOffset = atOffset;
              
              // Reset walker and find end node
              walker.currentNode = editableDiv;
              charCount = 0;
              let foundStart = false;
              
              while (walker.nextNode()) {
                const node = walker.currentNode;
                const text = node.textContent || "";
                const nodeStart = charCount;
                const nodeEnd = charCount + text.length;
                
                if (!foundStart && node === atNode) {
                  foundStart = true;
                  const charsInNode = text.length - atOffset;
                  if (remaining <= charsInNode) {
                    endNode = node;
                    endOffset = atOffset + remaining;
                    break;
                  }
                  remaining -= charsInNode;
                } else if (foundStart) {
                  if (remaining <= text.length) {
                    endNode = node;
                    endOffset = remaining;
                    break;
                  }
                  remaining -= text.length;
                }
                charCount = nodeEnd;
              }
              
              if (endNode) {
                range.setEnd(endNode, endOffset);
                range.deleteContents();
                // Insert HTML link element directly for immediate visual feedback
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = linkHtml;
                const linkElement = tempDiv.firstChild;
                if (linkElement) {
                  range.insertNode(linkElement);
                  range.setStartAfter(linkElement);
                  range.collapse(true);
                  const selection = window.getSelection();
                  selection?.removeAllRanges();
                  selection?.addRange(range);
                  mentionStartRef.current = null;
                  mentionEndRef.current = null;
                  mentionRangeRef.current = null;
                  setMentionSearchQuery("");
                  // Sync immediately to update state
                  syncContentFromHTML();
                  editableDiv.focus();
                  return;
                }
              }
            }
          }
        } catch (e) {
          console.error("Error replacing mention:", e);
        }
      }

      // Fallback: use the stored range if available (just "@")
      const range = mentionRangeRef.current;
      if (range) {
        range.deleteContents();
        // Insert HTML link element directly for immediate visual feedback
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = linkHtml;
        const linkElement = tempDiv.firstChild;
        if (linkElement) {
          range.insertNode(linkElement);
          range.setStartAfter(linkElement);
          range.collapse(true);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } else {
        // Insert HTML link element directly
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = linkHtml;
        const linkElement = tempDiv.firstChild;
        if (linkElement) {
          editableDiv.appendChild(linkElement);
        }
      }

      mentionRangeRef.current = null;
      mentionStartRef.current = null;
      mentionEndRef.current = null;
      setMentionSearchQuery("");
      syncContentFromHTML();
      editableDiv.focus();
    },
    [syncContentFromHTML, mentionSearchQuery]
  );

  const getCaretRect = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length > 0) return rects[0];

    // Fallback: insert a temporary marker to measure caret position
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    range.insertNode(marker);
    const rect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    // Restore caret after removing marker
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return rect;
  };

  // Helper to get text offset from a node/offset position
  const getTextOffset = (container: Node, targetNode: Node, targetOffset: number): number => {
    let offset = 0;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while ((node = walker.nextNode())) {
      if (node === targetNode) {
        return offset + targetOffset;
      }
      offset += (node.textContent || "").length;
    }
    return offset;
  };

  if (isEditing) {
    return (
      <div 
        className="relative overflow-visible"
        onMouseDown={(e) => {
          // Prevent drag events from propagating when interacting with text
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          // Prevent dragging the block when editing text
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Thin top toolbar */}
        <div
          className="absolute top-0 left-0 right-0 h-6 flex items-center gap-0.5 px-1 bg-[var(--surface)] rounded-t-lg z-10"
          data-textblock-toolbar="true"
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormatting('bold');
            }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded transition-colors",
              activeFormatting.bold
                ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            )}
            title="Bold"
          >
            <Bold className="h-3 w-3" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormatting('italic');
            }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded transition-colors",
              activeFormatting.italic
                ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            )}
            title="Italic"
          >
            <Italic className="h-3 w-3" />
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormatting('underline');
            }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded transition-colors",
              activeFormatting.underline
                ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            )}
            title="Underline"
          >
            <Underline className="h-3 w-3" />
          </button>
          <div className="h-4 w-px bg-[var(--border)] mx-0.5" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                  activeHighlightColor
                    ? "border-[var(--border)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                )}
                style={
                  activeHighlightColor
                    ? { backgroundColor: HIGHLIGHT_COLORS[activeHighlightColor].color }
                    : undefined
                }
                title="Highlight"
                onClick={(e) => {
                  if (activeHighlightColor) {
                    // Toggle highlight typing mode off and move caret out of any current mark
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveHighlightColor(null);

                    const editableDiv = textareaRef.current as HTMLDivElement | null;
                    if (!editableDiv) return;
                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) return;
                    const range = selection.getRangeAt(0);
                    const node = range.startContainer;
                    const markEl =
                      (node instanceof Element
                        ? node.closest("mark[data-highlight-color]")
                        : node.parentElement?.closest?.("mark[data-highlight-color]")) || null;
                    if (markEl && markEl.parentNode) {
                      const newRange = document.createRange();
                      newRange.setStartAfter(markEl);
                      newRange.collapse(true);
                      selection.removeAllRanges();
                      selection.addRange(newRange);
                    }
                  }
                }}
              >
                <Highlighter className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" data-textblock-toolbar="true">
              {(
                Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]
              ).map((key) => {
                const { label, color } = HIGHLIGHT_COLORS[key];
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={(e) => {
                      e.preventDefault();
                      applyHighlight(key);
                    }}
                  >
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-sm border border-[var(--border)]"
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  clearHighlight();
                }}
              >
                <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-dashed border-[var(--border)]" />
                <span>Remove highlight</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-4 w-px bg-[var(--border)] mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertBulletLine();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Bullet list"
          >
            <List className="h-3 w-3" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertChecklistLine();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Checklist"
          >
            <ListTodo className="h-3 w-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                <Type className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" data-textblock-toolbar="true">
              <DropdownMenuItem onClick={() => insertHeading(1)}>Heading 1</DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(2)}>Heading 2</DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(3)}>Heading 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          ref={textareaRef}
          contentEditable
          suppressContentEditableWarning
          onMouseDown={(e) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;
            if (target.closest('[data-checklist-toggle="true"]')) {
              e.preventDefault();
              const row = target.closest("[data-checklist-idx]");
              const idxStr = row?.getAttribute("data-checklist-idx");
              if (idxStr != null) {
                toggleChecklistLineAtIndex(Number(idxStr));
              }
            }
          }}
          onDragStart={(e) => {
            // Prevent dragging when selecting text
            e.preventDefault();
            e.stopPropagation();
          }}
          onSelect={(e) => {
            // Stop propagation when selecting text
            e.stopPropagation();
          }}
          onFocus={(e) => {
            const editableDiv = e.currentTarget;
            // Clear placeholder if it's present
            const textContent = editableDiv.textContent?.trim() || '';
            if (textContent === 'Click to add text…' || textContent === 'Start typing…') {
              editableDiv.innerHTML = '';
              // Position cursor at start
              const range = document.createRange();
              range.selectNodeContents(editableDiv);
              range.collapse(true);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              e.stopPropagation();
              insertIndentAtSelection();
              return;
            }

            // Delete an inline mention link as a single atomic unit
            if (e.key === "Backspace" || e.key === "Delete") {
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                // Only act on a collapsed caret (no text selected)
                if (range.collapsed) {
                  let targetAnchor: Element | null = null;
                  if (e.key === "Backspace") {
                    // Look for a ref-link anchor immediately before the caret
                    const { startContainer, startOffset } = range;
                    if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
                      const prev = startContainer.previousSibling;
                      if (prev instanceof Element && prev.getAttribute("data-ref-link") === "true") {
                        targetAnchor = prev;
                      }
                    } else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
                      const child = (startContainer as Element).childNodes[startOffset - 1];
                      if (child instanceof Element && child.getAttribute("data-ref-link") === "true") {
                        targetAnchor = child;
                      }
                    }
                    // Also handle caret sitting inside the anchor itself
                    if (!targetAnchor) {
                      const anchor = (range.startContainer as Element).closest?.('a[data-ref-link="true"]')
                        ?? (range.startContainer.parentElement?.closest?.('a[data-ref-link="true"]') ?? null);
                      if (anchor) targetAnchor = anchor;
                    }
                  } else {
                    // Delete key — look for a ref-link anchor immediately after the caret
                    const { startContainer, startOffset } = range;
                    if (startContainer.nodeType === Node.TEXT_NODE &&
                      startOffset === (startContainer.textContent?.length ?? 0)) {
                      const next = startContainer.nextSibling;
                      if (next instanceof Element && next.getAttribute("data-ref-link") === "true") {
                        targetAnchor = next;
                      }
                    } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
                      const child = (startContainer as Element).childNodes[startOffset];
                      if (child instanceof Element && child.getAttribute("data-ref-link") === "true") {
                        targetAnchor = child;
                      }
                    }
                  }

                  if (targetAnchor) {
                    e.preventDefault();
                    // Place caret where the anchor was before removing it
                    const newRange = document.createRange();
                    if (targetAnchor.previousSibling) {
                      newRange.setStartAfter(targetAnchor.previousSibling);
                    } else if (targetAnchor.parentNode) {
                      newRange.setStart(targetAnchor.parentNode, 0);
                    }
                    newRange.collapse(true);
                    targetAnchor.parentNode?.removeChild(targetAnchor);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    syncContentFromHTML();
                    checkRemovedMentions();
                    return;
                  }
                }
              }
            }

            if (e.key === "@" && referencePicker && projectId && workspaceId) {
              e.preventDefault();
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const textNode = document.createTextNode("@");
                range.insertNode(textNode);
                // Store the start position for later replacement
                mentionStartRef.current = { node: textNode, offset: 0 };
                mentionEndRef.current = { node: textNode, offset: 1 }; // Initially just after "@"
                // Create a range that selects the inserted "@"
                const mentionRange = document.createRange();
                mentionRange.setStart(textNode, 0);
                mentionRange.setEnd(textNode, 1);
                mentionRangeRef.current = mentionRange;
                // Move caret after the "@"
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);

                // Get the cursor position (after the "@") for better positioning
                const cursorRect = range.getBoundingClientRect();
                // Use cursor position instead of "@" position for better alignment
                const rect = cursorRect.width > 0 ? cursorRect : mentionRange.getBoundingClientRect();

                setMentionSearchQuery("");
                referencePicker.openPicker({
                  onSelect: insertInlineReference,
                  onClose: () => {
                    mentionStartRef.current = null;
                    mentionEndRef.current = null;
                    mentionRangeRef.current = null;
                    setMentionSearchQuery("");
                  },
                  anchorRect: rect,
                  initialQuery: ""
                });
              } else {
                mentionRangeRef.current = null;
                mentionStartRef.current = null;
                mentionEndRef.current = null;
                setMentionSearchQuery("");
                referencePicker.openPicker({ onSelect: insertInlineReference });
              }
              return;
            }
            if (e.key === "Escape") {
              setContent((block.content?.text as string) || "");
              setIsEditing(false);
              mentionStartRef.current = null;
              mentionEndRef.current = null;
              mentionRangeRef.current = null;
              setMentionSearchQuery("");
            }
          }}
          onInput={(e) => {
            const editableDiv = e.currentTarget as HTMLDivElement;
            // Clear placeholder on first input
            const textContent = editableDiv.textContent?.trim() || '';
            if (textContent === 'Click to add text…' || textContent === 'Start typing…') {
              editableDiv.innerHTML = '';
            }
            
            // Sync search query if we're in mention mode and update the end range
            if (mentionStartRef.current && referencePicker) {
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const cursorRange = selection.getRangeAt(0);

                // Compute query using DOM positions rather than textContent.indexOf("@"),
                // which would incorrectly match "@" inside previously inserted mention links.
                const atPos = getTextOffset(editableDiv, mentionStartRef.current.node, mentionStartRef.current.offset);
                const cursorPos = getTextOffset(editableDiv, cursorRange.startContainer, cursorRange.startOffset);

                if (cursorPos >= atPos + 1) {
                  // Text between the "@" node and the current cursor (excludes the "@" itself)
                  const fullText = editableDiv.textContent || "";
                  const query = fullText.slice(atPos + 1, cursorPos);
                  setMentionSearchQuery(query);

                  // Update the end range to current cursor position
                  mentionEndRef.current = {
                    node: cursorRange.startContainer,
                    offset: cursorRange.startOffset,
                  };

                  // Update the picker's search query
                  if (referencePicker.updateQuery) {
                    referencePicker.updateQuery(query);
                  }
                } else {
                  // Cursor moved before the "@" — cancel mention mode
                  mentionStartRef.current = null;
                  mentionEndRef.current = null;
                  mentionRangeRef.current = null;
                  setMentionSearchQuery("");
                  referencePicker.closePicker();
                }
              }
            }
            
            syncContentFromHTML();
            // If not mid-mention, check whether any inline mention links were removed
            if (!mentionStartRef.current) {
              checkRemovedMentions();
            }
          }}
          className="w-full resize-none whitespace-pre-wrap bg-transparent px-2 py-1 pt-7 text-sm leading-normal text-[var(--foreground)] focus:outline-none overflow-hidden min-h-[20px] [&_strong]:font-bold [&_b]:font-bold"
          style={{ minHeight: `${Math.max(20, minHeightPx ?? 20)}px`, height: 'auto' }}
        />
        {saveStatus !== "idle" && (
          <div className="absolute bottom-2 right-2 text-xs text-[var(--tertiary-foreground)]">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
          </div>
        )}
        {!readOnly && (
          <div
            className="mt-1 flex justify-end cursor-row-resize select-none"
            onMouseDown={handleResizeMouseDown}
          >
            <div className="h-1 w-10 rounded-full bg-[var(--border)] hover:bg-[var(--foreground)]" />
          </div>
        )}
      </div>
    );
  }

  const formatted = formatText(content);
  const hasAdjustedHeight = Boolean(minHeightPx && minHeightPx > 0);
  const heightToggle = hasAdjustedHeight ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsHeightExpanded((value) => !value);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      title={isHeightExpanded ? "Return to adjusted height" : "Show all content"}
      aria-pressed={isHeightExpanded}
    >
      {isHeightExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      <span>{isHeightExpanded ? "Shrink" : "Expand"}</span>
    </button>
  ) : null;

  return (
    <div className="space-y-2">
      {heightToggle && <div className="flex justify-end">{heightToggle}</div>}
      <div
        ref={displayRef}
        onClick={(e) => {
          if (readOnly) return;
          const target = e.target as HTMLElement;
          if (target.closest('a[data-ref-link=\"true\"]')) {
            return;
          }
          const toggleEl = target.closest('[data-checklist-toggle="true"]');
          if (toggleEl) {
            const row = toggleEl.closest("[data-checklist-idx]");
            const idxStr = row?.getAttribute("data-checklist-idx");
            if (idxStr != null) {
              e.preventDefault();
              e.stopPropagation();
              toggleChecklistLineAtIndex(Number(idxStr));
              return;
            }
          }
          setIsEditing(true);
        }}
        className={cn(
          "whitespace-pre-wrap text-sm leading-normal text-[var(--foreground)]",
          readOnly ? "" : "cursor-text",
          hasAdjustedHeight && !isHeightExpanded && "overflow-y-auto"
        )}
        style={
          hasAdjustedHeight
            ? isHeightExpanded
              ? { minHeight: `${minHeightPx}px` }
              : { height: `${minHeightPx}px`, maxHeight: `${minHeightPx}px` }
            : undefined
        }
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
      {workspaceId && projectId && <AttachedFilesList blockId={block.id} onUpdate={onUpdate} />}
      {!readOnly && (
        <div
          className="flex justify-end cursor-row-resize select-none"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="h-1 w-10 rounded-full bg-[var(--border)] hover:bg-[var(--foreground)]" />
        </div>
      )}
    </div>
  );
}
