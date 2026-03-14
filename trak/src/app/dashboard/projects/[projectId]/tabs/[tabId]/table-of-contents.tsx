"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { List, PanelRightClose, PanelLeftClose, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { useTabContents } from "./tab-contents-context";
import { useTable } from "@/lib/hooks/use-table-queries";
import { buildProjectTabPath, matchesReadableEntity } from "@/lib/dashboard-routes";

const BLOCK_TYPE_LABELS: Partial<Record<Block["type"], string>> = {
  text: "Text",
  task: "Task list",
  link: "Link",
  divider: "Divider",
  section_header: "Section Header",
  table: "Table",
  timeline: "Timeline",
  file: "File",
  video: "Video",
  image: "Image",
  gallery: "Gallery",
  embed: "Embed",
  section: "Section",
  chart: "Chart",
  doc_reference: "Doc reference",
  shopify_product: "Product",
  pdf: "PDF",
};

function getBlockTypeLabel(type: Block["type"]): string {
  return BLOCK_TYPE_LABELS[type] ?? type;
}

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
    case "section_header":
      return (content.title as string) ?? "Section Header";
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

function BlockTitle({ block }: { block: Block }) {
  if (block.type === "table") {
    const content = (block.content ?? {}) as Record<string, unknown>;
    const rawTableId =
      (content as any).tableId ??
      (content as any).table_id ??
      (content as any).table ??
      null;

    const tableId =
      typeof rawTableId === "string" && rawTableId.length > 0
        ? rawTableId
        : null;

    // Fallback to block content title if no tableId is present
    if (!tableId) {
      const titleFromBlock = (content.title as string) ?? "Table";
      return <>{titleFromBlock}</>;
    }

    const { data: tableData } = useTable(tableId);
    const titleFromBlock = (content.title as string) || "";
    const effectiveTitle =
      (typeof titleFromBlock === "string" && titleFromBlock.trim()
        ? titleFromBlock
        : tableData?.table?.title) || "Table";

    return <>{effectiveTitle}</>;
  }

  return <>{getBlockTitle(block)}</>;
}

interface TableOfContentsProps {
  blocks: Block[];
  isExpanded: boolean;
  onToggle: () => void;
  projectId: string;
  projectName?: string;
  className?: string;
}

export default function TableOfContents({
  blocks,
  isExpanded,
  onToggle,
  projectId,
  projectName,
  className,
}: TableOfContentsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTabParam = pathname.split("/tabs/")[1]?.split("/")[0];
  const isActiveTab = (tabId: string, tabName: string) =>
    !!activeTabParam && matchesReadableEntity(activeTabParam, tabName);
  const tabContents = useTabContents();
  const subtabConfig = tabContents?.subtabConfig ?? null;

  const handleBlockClick = (blockId: string) => {
    const el = document.getElementById(`block-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const navigateToTab = (tabId: string, tabName: string) => {
    if (!projectName) return;
    router.push(buildProjectTabPath(projectId, tabId, projectName, tabName));
  };

  const hasSubtabs = subtabConfig && subtabConfig.subtabs.length > 0;
  const hasBlocks = blocks.length > 0;

  if (!hasSubtabs && !hasBlocks) return null;

  return (
    <>
      {/* Collapsed: show a sticky open button */}
      {!isExpanded && (
        <div className="hidden lg:flex shrink-0 w-4 items-start pt-1 -ml-8 mr-4">
          <div className="sticky top-20">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Open table of contents"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded sidebar */}
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

            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Subtab navigation section */}
              {hasSubtabs && (
                <div className={cn("p-2", hasBlocks && "border-b border-[var(--border)]")}>
                  {/* Back to parent tab */}
                  <button
                    onClick={() => navigateToTab(subtabConfig.parentTabId, subtabConfig.parentTabName)}
                    className={cn(
                      "flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-xs font-medium transition-colors mb-1",
                      isActiveTab(subtabConfig.parentTabId, subtabConfig.parentTabName)
                        ? "text-[var(--foreground)] bg-[var(--surface-hover)]"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                    )}
                  >
                    <ChevronLeft className="h-3 w-3 shrink-0" />
                    {subtabConfig.parentTabName}
                  </button>

                  {/* Subtab list */}
                  <div className="space-y-0.5 pl-2">
                    {subtabConfig.subtabs.map((subtab) => (
                      <button
                        key={subtab.id}
                        onClick={() => navigateToTab(subtab.id, subtab.name)}
                        className={cn(
                          "block w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors truncate",
                          isActiveTab(subtab.id, subtab.name)
                            ? "text-[var(--foreground)] font-medium bg-[var(--surface-hover)]"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                        )}
                        title={subtab.name}
                      >
                        {subtab.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Block contents list */}
              {hasBlocks && (
                <nav className="p-2 space-y-0.5">
                  {blocks.map((block) => {
                    const title =
                      block.type === "table" ? undefined : getBlockTitle(block);
                    return (
                      <button
                        key={block.id}
                        onClick={() => handleBlockClick(block.id)}
                        className="block w-full text-left text-sm text-[var(--foreground)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] rounded-md px-2 py-1.5 transition-colors"
                        title={title}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate">
                            <BlockTitle block={block} />
                          </span>
                          <span className="text-[10px] leading-tight text-[var(--muted-foreground)] truncate">
                            {getBlockTypeLabel(block.type)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
