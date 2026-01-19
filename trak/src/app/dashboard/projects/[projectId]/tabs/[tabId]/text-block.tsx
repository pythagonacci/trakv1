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
import DOMPurify from "isomorphic-dompurify";

interface TextBlockProps {
  block: Block;
  workspaceId?: string;
  projectId?: string;
  onUpdate?: () => void;
  autoFocus?: boolean;
}

type SaveStatus = "idle" | "saving" | "saved";

// Format markdown text to HTML
const formatText = (text: string): string => {
  if (!text || text.trim() === "") {
    return '<span class="text-[var(--tertiary-foreground)] italic">Click to add text…</span>';
  }

  const normalizeUnmatchedBold = (input: string) => {
    let result = input;
    let boldTokens = (result.match(/\*\*/g) || []).length;

    // If there's an unmatched ** token, drop the last occurrence so it doesn't render literally
    if (boldTokens % 2 !== 0) {
      const lastIndex = result.lastIndexOf("**");
      if (lastIndex !== -1) {
        result = result.slice(0, lastIndex) + result.slice(lastIndex + 2);
      }
    }

    return result;
  };

  const lines = text.split("\n");
  const formattedLines = lines.map((rawLine) => {
    const line = normalizeUnmatchedBold(rawLine);
    if (!line.trim()) return "<br/>";

    let formatted = line;
    // Handle HTML underline tags - preserve them as-is (they'll be rendered properly)
    // Check if line contains HTML tags (like <u>), if so, don't process markdown on that part
    if (/<u>.*?<\/u>/.test(formatted)) {
      // Replace underline tags with styled version
      formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="underline text-[var(--foreground)]">$1</u>');
    }
    // Process markdown formatting (do this before HTML tag replacement to avoid conflicts)
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
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'code', 'u', 'h1', 'h2', 'h3', 'p', 'div', 'span', 'br'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
  });
};

export default function TextBlock({ block, workspaceId, projectId, onUpdate, autoFocus = false }: TextBlockProps) {
  const blockContent = (block.content || {}) as { text?: string; borderless?: boolean };
  const initialContent = blockContent.text || "";
  const isEmpty = !initialContent || initialContent.trim() === "";
  const [isEditing, setIsEditing] = useState(autoFocus || isEmpty);
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isBorderless, setIsBorderless] = useState(Boolean(blockContent.borderless));
  const [activeFormatting, setActiveFormatting] = useState({ bold: false, italic: false, underline: false });
  const textareaRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const next = Boolean((block.content as Record<string, unknown> | undefined)?.borderless);
    if (next !== isBorderless) {
      const raf = requestAnimationFrame(() => setIsBorderless(next));
      return () => cancelAnimationFrame(raf);
    }
  }, [block.content, isBorderless]);

  const editingRef = useRef(false);

  useEffect(() => {
    if (isEditing && textareaRef.current && !editingRef.current) {
      const editableDiv = textareaRef.current as HTMLDivElement;
      
      // Only initialize HTML content when first entering edit mode
      const formattedHTML = formatText(content) || '<span class="text-[var(--tertiary-foreground)] italic">Start typing…</span>';
      editableDiv.innerHTML = formattedHTML;
      editingRef.current = true;
      
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
      const newHeight = Math.max(20, editableDiv.scrollHeight); // Minimum 20px height (1 line)
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

  const insertHeading = (level: number) => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const headingMarker = "#".repeat(level) + " ";
    
    // Expand range to include the entire line by finding line boundaries
    // Get the editable div's text content to find line boundaries
    const editableText = editableDiv.textContent || "";
    const editableRange = document.createRange();
    editableRange.selectNodeContents(editableDiv);
    
    // Find the character offset of the selection within the editable div
    const preRange = document.createRange();
    preRange.setStart(editableDiv, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    
    // Find start of line (look backwards for newline)
    let lineStart = 0;
    for (let i = startOffset - 1; i >= 0; i--) {
      if (editableText[i] === '\n') {
        lineStart = i + 1;
        break;
      }
    }
    
    // Find end of line (look forwards for newline)
    let lineEnd = editableText.length;
    for (let i = startOffset; i < editableText.length; i++) {
      if (editableText[i] === '\n') {
        lineEnd = i;
        break;
      }
    }
    
    // Create range for the entire line
    const lineRange = document.createRange();
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
    
    const lineText = range.toString();
    const cleanedLine = lineText.replace(/^#{1,3} /, "").replace(/\n$/, "");
    
    // Replace line with heading
    range.deleteContents();
    const textNode = document.createTextNode(headingMarker + cleanedLine);
    range.insertNode(textNode);
    
    // Position cursor at end of line
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    syncContentFromHTML();
    updateActiveFormatting();
  };

  // Convert HTML back to markdown
  const htmlToMarkdown = (html: string): string => {
    if (!html || html.trim() === '') return '';
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let md = '';
    
    const processNode = (node: Node): string => {
      let result = '';
      
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
        case 'br':
            return '\n';
        case 'p':
            return childText + '\n';
        case 'div':
            return childText + '\n';
          default:
            return childText;
        }
      }
      
      return '';
    };
    
    md = Array.from(tempDiv.childNodes).map(processNode).join('');
    
    // Clean up extra newlines
    md = md.replace(/\n{3,}/g, '\n\n');
    
    return md.trim();
  };

  // Sync content from HTML in contenteditable
  const syncContentFromHTML = () => {
    const editableDiv = textareaRef.current as HTMLDivElement | null;
    if (!editableDiv) return;
    
    const html = editableDiv.innerHTML;
    const markdown = htmlToMarkdown(html);
    setContent(markdown);
  };

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
        <div className="absolute top-0 left-0 right-0 h-6 flex items-center gap-0.5 px-1 bg-[var(--surface)] rounded-t-lg z-10">
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
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              insertMarkdown("`");
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Code"
          >
            <Code className="h-3 w-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-5 w-5 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                <Type className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
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
            // Stop propagation to prevent block dragging
            e.stopPropagation();
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
            if (e.key === "Escape") {
              setContent((block.content?.text as string) || "");
              setIsEditing(false);
            }
          }}
          onInput={(e) => {
            const editableDiv = e.currentTarget as HTMLDivElement;
            // Clear placeholder on first input
            const textContent = editableDiv.textContent?.trim() || '';
            if (textContent === 'Click to add text…' || textContent === 'Start typing…') {
              editableDiv.innerHTML = '';
            }
            syncContentFromHTML();
          }}
          className="w-full resize-none rounded-lg bg-[var(--surface)] px-2 py-1 pt-7 text-sm leading-normal text-[var(--foreground)] focus:outline-none overflow-hidden min-h-[20px] [&_strong]:font-bold [&_b]:font-bold"
          style={{ minHeight: '20px', height: 'auto' }}
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

  const formatted = formatText(content);

  return (
    <div className="space-y-2">
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-text text-sm leading-normal text-[var(--foreground)]"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
      {workspaceId && projectId && <AttachedFilesList blockId={block.id} onUpdate={onUpdate} />}
    </div>
  );
}