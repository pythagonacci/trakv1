"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Download, ChevronDown, Pin, PinOff } from "lucide-react";
import RichTextEditor from "@/components/editor/rich-text-editor";
import { updateDoc } from "@/app/actions/doc";
import { cn } from "@/lib/utils";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Doc {
  id: string;
  title: string;
  content: any;
  updated_at: string;
}

interface DocEditorProps {
  doc: Doc;
}

const DOC_THEMES = [
  {
    id: "sand",
    label: "Sand",
    pageBg: "linear-gradient(135deg, #fdfbf5 0%, #f7fbff 50%, #eef6ff 100%)",
    paperBg: "linear-gradient(180deg, #ffffff 0%, #fbfcff 35%, #f7fbff 100%)",
  },
  {
    id: "foam",
    label: "Foam",
    pageBg: "linear-gradient(135deg, #f8fffd 0%, #f5fbff 50%, #eef5ff 100%)",
    paperBg: "linear-gradient(180deg, #ffffff 0%, #f8feff 40%, #f1f7ff 100%)",
  },
  {
    id: "cloud",
    label: "Cloud",
    pageBg: "linear-gradient(135deg, #f9fbff 0%, #f5f7fb 50%, #eef1f6 100%)",
    paperBg: "linear-gradient(180deg, #ffffff 0%, #f8f9fc 45%, #f2f4f8 100%)",
  },
];

export default function DocEditor({ doc }: DocEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date(doc.updated_at));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [docTheme, setDocTheme] = useState<string>("sand");
  const [isToolbarPinned, setIsToolbarPinned] = useState<boolean>(false);
  const [floatingToolbarVisible, setFloatingToolbarVisible] = useState<boolean>(false);
  const [topBarHeight, setTopBarHeight] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const { setHeaderHidden } = useDashboardHeader();

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const headerHideTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Mount state to prevent hydration mismatch with Radix UI
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Theme persistence (local only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("trak-doc-theme");
    if (saved && DOC_THEMES.some((t) => t.id === saved)) {
      setDocTheme(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("trak-doc-theme", docTheme);
  }, [docTheme]);

  // Pin persistence (local only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedPin = localStorage.getItem("trak-doc-toolbar-pinned");
    if (savedPin === "true") {
      setIsToolbarPinned(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("trak-doc-toolbar-pinned", isToolbarPinned ? "true" : "false");
  }, [isToolbarPinned]);

  const theme = useMemo(
    () => DOC_THEMES.find((t) => t.id === docTheme) || DOC_THEMES[0],
    [docTheme]
  );

  // Measure top bar height for toolbar offset
  useEffect(() => {
    if (!topBarRef.current) return;
    const measure = () => {
      setTopBarHeight(topBarRef.current?.offsetHeight || 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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

  const cancelHeaderHide = () => {
    if (headerHideTimerRef.current) {
      clearTimeout(headerHideTimerRef.current);
      headerHideTimerRef.current = null;
    }
  };

  const showHeader = () => {
    if (isToolbarPinned) return;
    cancelHeaderHide();
    setHeaderHidden(false);
  };

  const scheduleHeaderHide = () => {
    if (isToolbarPinned) return;
    cancelHeaderHide();
    headerHideTimerRef.current = setTimeout(() => {
      setHeaderHidden(true);
      headerHideTimerRef.current = null;
    }, 250);
  };

  useEffect(() => {
    if (isToolbarPinned) {
      cancelHeaderHide();
      setHeaderHidden(true);
    } else if (floatingToolbarVisible) {
      cancelHeaderHide();
      setHeaderHidden(false);
    } else {
      scheduleHeaderHide();
    }

    return () => {
      cancelHeaderHide();
      setHeaderHidden(false);
    };
  }, [floatingToolbarVisible, isToolbarPinned, setHeaderHidden]);

  const handleHoverZoneEnter = () => {
    if (isToolbarPinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setFloatingToolbarVisible(true);
    showHeader();
  };

  const handleHoverZoneLeave = () => {
    if (isToolbarPinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setFloatingToolbarVisible(false);
      scheduleHeaderHide();
    }, 250);
  };

  const handleToolbarEnter = () => {
    if (isToolbarPinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setFloatingToolbarVisible(true);
    showHeader();
  };

  const handleToolbarLeave = () => {
    if (isToolbarPinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setFloatingToolbarVisible(false);
      scheduleHeaderHide();
    }, 250);
  };

  // Convert TipTap JSON content to plain text
  const contentToPlainText = (content: any): string => {
    if (!content || !content.content) return "";
    
    let text = "";
    const traverse = (node: any) => {
      if (node.type === "text") {
        text += node.text;
      } else if (node.content) {
        node.content.forEach(traverse);
      }
      
      // Add newlines for block elements
      if (["paragraph", "heading", "listItem"].includes(node.type)) {
        text += "\n";
      }
    };
    
    traverse(content);
    return text.trim();
  };

  // Convert TipTap JSON content to markdown
  const contentToMarkdown = (content: any): string => {
    if (!content || !content.content) return "";
    
    let markdown = "";
    
    const traverse = (node: any, level = 0) => {
      if (node.type === "text") {
        let text = node.text;
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            if (mark.type === "bold") text = `**${text}**`;
            if (mark.type === "italic") text = `*${text}*`;
            if (mark.type === "code") text = `\`${text}\``;
          });
        }
        markdown += text;
      } else if (node.type === "paragraph") {
        if (node.content) node.content.forEach((n: any) => traverse(n, level));
        markdown += "\n\n";
      } else if (node.type === "heading") {
        const level = node.attrs?.level || 1;
        markdown += "#".repeat(level) + " ";
        if (node.content) node.content.forEach((n: any) => traverse(n, level));
        markdown += "\n\n";
      } else if (node.type === "bulletList") {
        if (node.content) node.content.forEach((n: any) => traverse(n, level + 1));
      } else if (node.type === "listItem") {
        markdown += "  ".repeat(level - 1) + "- ";
        if (node.content) node.content.forEach((n: any) => traverse(n, level));
        markdown += "\n";
      } else if (node.content) {
        node.content.forEach((n: any) => traverse(n, level));
      }
    };
    
    traverse(content);
    return markdown.trim();
  };

  const handleExport = (format: "txt" | "md" | "pdf") => {
    const filename = title || "Untitled Document";
    
    if (format === "txt") {
      const text = contentToPlainText(content);
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "md") {
      const markdown = contentToMarkdown(content);
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      // Open print dialog for PDF export
      window.print();
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: theme.pageBg }}
    >
      {/* Hover zone to surface toolbar when unpinned */}
      {!isToolbarPinned && (
        <div
          className="fixed top-0 left-0 right-0 h-10 z-30 pointer-events-auto"
          onMouseEnter={handleHoverZoneEnter}
          onMouseLeave={handleHoverZoneLeave}
        />
      )}

      {/* Top Bar */}
      <div
        ref={topBarRef}
        className={cn(
          "bg-[var(--surface)] border-b border-[var(--border)] px-6 py-3 transition-shadow",
          isToolbarPinned ? "sticky z-20 shadow-sm" : "relative z-10"
        )}
        style={isToolbarPinned ? { top: 0 } : undefined}
      >
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

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {DOC_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDocTheme(t.id)}
                  type="button"
                  className={cn(
                    "h-6 w-6 rounded-md border flex-shrink-0 transition-all",
                    docTheme === t.id ? "ring-2 ring-[var(--foreground)] border-transparent" : "border-[var(--border)]"
                  )}
                  style={{ background: t.paperBg }}
                  title={t.label}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !isToolbarPinned;
                setIsToolbarPinned(next);
                if (!next) {
                  setFloatingToolbarVisible(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {isToolbarPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isToolbarPinned ? "Unpin" : "Pin"}</span>
            </button>
            {/* Export Dropdown - Only render after mount to prevent hydration mismatch */}
            {isMounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <Download className="h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("md")}>
                    <Download className="h-4 w-4" />
                    Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("txt")}>
                    <Download className="h-4 w-4" />
                    Export as Text
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] opacity-50" disabled>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            )}

            {/* Save Status */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
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
      </div>

      {/* Page Container */}
      <div className={cn("px-4", isToolbarPinned ? "pt-0 pb-8" : "py-8")}>
        {/* Paper-like Document */}
        <div
          className="max-w-[850px] mx-auto shadow-lg rounded-sm min-h-[1100px] border border-[var(--border)]"
          style={{ background: theme.paperBg }}
        >
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your document..."
            className="bg-transparent"
            pinnedToolbar={isToolbarPinned}
            floatingToolbarVisible={!isToolbarPinned && floatingToolbarVisible}
            pinnedToolbarOffset={
              isToolbarPinned
                ? topBarHeight
                : undefined
            }
            onToolbarHoverStart={handleToolbarEnter}
            onToolbarHoverEnd={handleToolbarLeave}
          />
        </div>
      </div>
    </div>
  );
}
