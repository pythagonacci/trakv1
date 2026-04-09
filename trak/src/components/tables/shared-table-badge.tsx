"use client";

import Link from "next/link";
import { LayoutGrid, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getTableBlockReferences, type TableBlockReference } from "@/app/actions/tables/query-actions";
import { queryKeys } from "@/lib/react-query/query-client";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SharedTableBadgeProps {
  tableId: string;
  /** Exclude this block when listing "other" locations (e.g. current block) */
  currentBlockId?: string;
}

function buildTabHref(loc: TableBlockReference): string | null {
  if (!loc.tabId) return null;
  if (loc.projectId && loc.projectName && loc.tabName) {
    return buildProjectTabPath(loc.projectId, loc.tabId, loc.projectName, loc.tabName);
  }
  if (loc.projectId) return null;
  return `/dashboard/workflow/${loc.tabId}`;
}

export function SharedTableBadge({ tableId, currentBlockId }: SharedTableBadgeProps) {
  const { data } = useQuery({
    queryKey: queryKeys.tableBlockReferences(tableId, currentBlockId),
    queryFn: async () => {
      const result = await getTableBlockReferences(tableId, { excludeBlockId: currentBlockId });
      if ("error" in result) return null;
      return result.data;
    },
    staleTime: 60_000,
  });

  if (!data || data.count < 2) return null;

  const otherLocations = data.locations;
  if (otherLocations.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mb-1.5 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]/80 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
            <LayoutGrid className="h-3 w-3" />
            <span>Also in {otherLocations.length} {otherLocations.length === 1 ? "tab" : "tabs"}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs">
          <p className="mb-1.5 text-xs font-medium text-[var(--foreground)]">
            This table is shown in multiple tabs
          </p>
          <ul className="space-y-1">
            {otherLocations.map((loc) => {
              const href = buildTabHref(loc);
              const label = [loc.projectName, loc.tabName].filter(Boolean).join(" / ") || loc.tabName;
              return (
                <li key={loc.blockId}>
                  {href ? (
                    <Link
                      href={href}
                      prefetch={false}
                      className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline"
                    >
                      {label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
