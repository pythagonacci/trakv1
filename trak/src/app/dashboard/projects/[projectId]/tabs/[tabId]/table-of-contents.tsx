"use client";

import React from "react";
import { List, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";

function getBlockTitle(block: Block): string {
  const content = (block.content ?? {}) as Record<string, unknown>;
  switch (block.type) {
    case "text": {
      const text = (content.text ?? content.content ?? "") as string;
      return typeof text === "string" && text.trim() ? text.slice(0, 60) : "Text block";
    }
    case "task":
      return (content.title as string) ?? "Task block";
    case "table":
      return (content.title as string) ?? "Table";
    case "image":
      return (content.alt as string) ?? (content.filename as string) ?? "Image";
    case "file":
      return (content.filename as string) ?? "File";
    case "video":
      return (content.title as string) ?? "Video";
    case "embed":
      return (content.title as string) ?? "Embed";
    case "link":
      return (content.title as string) ?? (content.url as string) ?? "Link";
    case "section":
      return (content.title as string) ?? "Section";
    case "chart":
      return (content.title as string) ?? "Chart";
    case "gallery":
      return (content.title as string) ?? "Gallery";
    case "pdf":
      return (content.filename as string) ?? "PDF";
    case "doc_reference":
      return (content.doc_title as string) ?? "Doc reference";
    case "divider":
      return "Divider";
    case "timeline":
      return (content.title as string) ?? "Timeline";
    case "shopify_product":
      return (content.title as string) ?? "Product";
    default:
      return `${block.type} block`;
  }
}

interface TableOfContentsProps {
  blocks: Block[];
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

export default function TableOfContents({
  blocks,
  isExpanded,
  onToggle,
  className,
}: TableOfContentsProps) {
  const handleBlockClick = (blockId: string) => {
    const el = document.getElementById(`block-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Sidebar panel - toggle button is in header */}
      {blocks.length > 0 && (
        <aside
          className={cn(
            "hidden lg:block shrink-0 transition-all duration-300 overflow-hidden",
            isExpanded ? "w-[240px]" : "w-0",
            className
          )}
          aria-hidden={!isExpanded}
        >
          {isExpanded && (
            <div
              className="sticky top-20 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm overflow-hidden max-h-[calc(100vh-7rem)] flex flex-col"
              role="navigation"
              aria-label="Table of contents"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--border)]">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  <List className="h-3.5 w-3.5" />
                  Contents
                </h3>
                <button
                  onClick={onToggle}
                  className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  aria-label="Collapse table of contents"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
                {blocks.map((block) => {
                  const title = getBlockTitle(block);
                  return (
                    <button
                      key={block.id}
                      onClick={() => handleBlockClick(block.id)}
                      className="block w-full text-left text-sm text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded-md px-2 py-1.5 truncate transition-colors"
                      title={title}
                    >
                      {title}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
