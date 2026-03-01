"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";
import type { TableSourceOrigin } from "@/app/actions/tables/query-actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SourceOriginLinkProps {
  origin: TableSourceOrigin;
  workspaceId: string;
  fallbackProjectId?: string | null;
}

const SOURCE_TYPE_LABELS: Record<TableSourceOrigin["sourceEntityType"], string> = {
  task: "Task source",
  timeline_event: "Timeline source",
  table_row: "Table source",
  block: "Block source",
};

const BlockReferenceRenderer = dynamic(
  () => import("@/app/dashboard/projects/[projectId]/tabs/[tabId]/block-reference-renderer"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted-foreground)]">
        Loading source preview...
      </div>
    ),
  }
);

const MiniTableView = dynamic(
  () => import("./table-view").then((mod) => mod.TableView),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted-foreground)]">
        Loading source preview...
      </div>
    ),
  }
);

// Content is rendered at this reference width (matching a typical desktop tab canvas),
// then scaled down uniformly to fill the preview pane width.
const REFERENCE_CONTENT_WIDTH = 900;
const PREVIEW_PANE_WIDTH = 420; // matches w-[420px] on TooltipContent
const PREVIEW_PANE_HEIGHT = 220;
const PREVIEW_SCALE = PREVIEW_PANE_WIDTH / REFERENCE_CONTENT_WIDTH;
// Pre-scale height budget so content fills the preview pane vertically after scaling.
const MAX_CONTENT_HEIGHT = Math.round(PREVIEW_PANE_HEIGHT / PREVIEW_SCALE);

export function SourceOriginLink({ origin, workspaceId, fallbackProjectId }: SourceOriginLinkProps) {
  const [open, setOpen] = React.useState(false);

  const baseLinkClass = "underline hover:text-[var(--foreground)]";
  const linkNode = origin.sourceHref ? (
    <Link href={origin.sourceHref} className={baseLinkClass}>
      {origin.sourceName}
    </Link>
  ) : (
    <span className="underline">{origin.sourceName}</span>
  );

  if (!origin.sourceHref) {
    return linkNode;
  }

  const contextParts = [origin.projectName, origin.tabName].filter((value): value is string => Boolean(value));
  const contextLabel = contextParts.length > 0 ? contextParts.join(" / ") : "Project and tab unavailable";

  return (
    <TooltipProvider delayDuration={180}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="w-[420px] max-w-[calc(100vw-2rem)] p-0 shadow-xl"
        >
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-[var(--foreground)]">{origin.sourceName}</p>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{SOURCE_TYPE_LABELS[origin.sourceEntityType]}</p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">{contextLabel}</p>
            </div>

            <div className="relative h-[220px] overflow-hidden bg-[var(--background)]">
              {open && origin.previewEntityType === "block" ? (
                <div
                  className="pointer-events-none absolute left-0 top-0"
                  style={{
                    transform: `scale(${PREVIEW_SCALE})`,
                    transformOrigin: "top left",
                    width: REFERENCE_CONTENT_WIDTH,
                  }}
                >
                  <BlockReferenceRenderer
                    originalBlockId={origin.previewEntityId}
                    workspaceId={workspaceId}
                    projectId={origin.projectId ?? fallbackProjectId ?? ""}
                    tabId={origin.tabId ?? undefined}
                    showReferenceBadge={false}
                    previewMode
                  />
                </div>
              ) : open && origin.previewEntityType === "table" ? (
                <div
                  className="pointer-events-none absolute left-0 top-0"
                  style={{
                    transform: `scale(${PREVIEW_SCALE})`,
                    transformOrigin: "top left",
                    width: REFERENCE_CONTENT_WIDTH,
                  }}
                >
                  <MiniTableView tableId={origin.previewEntityId} maxHeightPx={MAX_CONTENT_HEIGHT} />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-[var(--muted-foreground)]">
                  Source preview is unavailable for this link.
                </div>
              )}
              <div className="pointer-events-none absolute inset-0" />
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
