"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Block } from "@/app/actions/block";
import type { ChartBlockContent, SpecChartBlockContent } from "@/types/chart";
import { isSpecChart, isRefreshableDataSource } from "@/types/chart";
import { cn } from "@/lib/utils";
import { updateChartBlock, refreshChartBlock, saveChartAsSnapshot, setChartDataScope } from "@/app/actions/chart-actions";
import { TrakChart } from "@/components/blocks/chart/TrakChart";
import { ChartConfigPanel } from "@/components/blocks/chart/ChartConfigPanel";
import { buildChartData } from "@/lib/charts/transform";
import { applySpecFallbacks, type ChartSpec } from "@/lib/charts/chartSpec";
import { queryKeys } from "@/lib/react-query/query-client";
import type { ChartRow } from "@/lib/charts/chartSpec";

interface ChartBlockProps {
  block: Block;
  className?: string;
}

/** Pick display label for a chart row (tracked-items list) */
function rowLabel(row: ChartRow): string {
  // Prefer common title/name fields
  const titleCandidates = ["Task Title", "Title", "title", "Name", "name"] as const;
  for (const key of titleCandidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  // Fallback: first non-metadata string field
  for (const [key, value] of Object.entries(row)) {
    if (key === "id" || key === "status" || key === "priority" || key === "assignee" || key === "tags") continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  // Final fallback: generic label (avoid exposing raw UUIDs)
  return "Item";
}

const TRACKED_ITEMS_VISIBLE = 8;

function SpecChartBlock({ block, className }: ChartBlockProps) {
  const rawContent = (block.content || {}) as SpecChartBlockContent;
  const queryClient = useQueryClient();
  const [localSpec, setLocalSpec] = useState<ChartSpec>(() =>
    applySpecFallbacks(rawContent.spec)
  );
  const [showConfig, setShowConfig] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isSettingScope, setIsSettingScope] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackedListExpanded, setTrackedListExpanded] = useState(false);

  useEffect(() => {
    setLocalSpec(applySpecFallbacks(rawContent.spec));
  }, [block.id]);

  const chartData = useMemo(() => {
    try {
      return buildChartData({
        focusRows: rawContent.rows ?? [],
        universeTotal: rawContent.universeTotal,
        spec: localSpec,
      });
    } catch {
      return null;
    }
  }, [rawContent.rows, rawContent.universeTotal, localSpec]);

  const availableFields = useMemo(() => {
    const rows = rawContent.rows ?? [];
    if (!rows.length) return ["status", "priority", "assignee", "tags"];
    const keys = new Set<string>();
    for (const row of rows)
      Object.keys(row).forEach((k) => {
        if (k !== "id") keys.add(k);
      });
    return Array.from(keys);
  }, [rawContent.rows]);

  const numericFields = useMemo(
    () =>
      availableFields.filter((f) =>
        (rawContent.rows ?? []).some((r) => typeof r[f] === "number")
      ),
    [rawContent.rows, availableFields]
  );

  const handleSpecChange = useCallback(
    async (nextSpec: ChartSpec) => {
      setLocalSpec(nextSpec);
      setSaveError(null);
      setIsSaving(true);
      const updatedContent: SpecChartBlockContent = {
        ...rawContent,
        spec: nextSpec,
        chartType: nextSpec.chartType as SpecChartBlockContent["chartType"],
        title: nextSpec.title ?? rawContent.title,
      };
      const result = await updateChartBlock({
        blockId: block.id,
        content: updatedContent,
      });
      setIsSaving(false);
      if ("error" in result) setSaveError(result.error);
    },
    [block.id, rawContent]
  );

  const invalidateBlock = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tabBlocks(block.tab_id) });
  }, [block.tab_id, queryClient]);

  const handleRefresh = useCallback(async () => {
    setActionError(null);
    setIsRefreshing(true);
    const result = await refreshChartBlock(block.id);
    setIsRefreshing(false);
    if ("error" in result) {
      setActionError(result.error);
    } else {
      invalidateBlock();
    }
  }, [block.id, invalidateBlock]);

  const handleSaveAsSnapshot = useCallback(async () => {
    setActionError(null);
    setIsSavingSnapshot(true);
    const result = await saveChartAsSnapshot(block.id);
    setIsSavingSnapshot(false);
    if ("error" in result) {
      setActionError(result.error);
    } else {
      invalidateBlock();
    }
  }, [block.id, invalidateBlock]);

  const handleSetScope = useCallback(
    async (scope: "fixed" | "query") => {
      if (rawContent.dataSource && (rawContent.dataSource as { scope?: string }).scope === scope) return;
      setActionError(null);
      setIsSettingScope(true);
      const result = await setChartDataScope(block.id, scope);
      setIsSettingScope(false);
      if ("error" in result) {
        setActionError(result.error);
      } else {
        invalidateBlock();
      }
    },
    [block.id, rawContent.dataSource, invalidateBlock]
  );

  const isSimulation = Boolean(rawContent.metadata?.isSimulation);
  const title = localSpec.title ?? rawContent.title;
  const normWarn = chartData?.meta.normalizationWarning;
  const showTrackingUi = rawContent.dataSource && isRefreshableDataSource(rawContent.dataSource);
  const scope = showTrackingUi && rawContent.dataSource && "scope" in rawContent.dataSource ? rawContent.dataSource.scope : null;
  const rows = rawContent.rows ?? [];
  const trackedCount = scope === "fixed" ? (rawContent.dataSource && "entityIds" in rawContent.dataSource ? rawContent.dataSource.entityIds.length : rows.length) : 0;
  const showTrackedList = scope === "fixed" && rows.length > 0;
  const trackedVisible = trackedListExpanded ? rows : rows.slice(0, TRACKED_ITEMS_VISIBLE);
  const trackedMore = rows.length - TRACKED_ITEMS_VISIBLE;

  return (
    <div
      className={cn(
        "relative",
        isSimulation && "rounded-lg ring-1 ring-[var(--warning)]/25",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {title && (
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h3>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {isSaving && (
            <span className="text-xs text-[var(--muted-foreground)]">
              Saving…
            </span>
          )}
          {normWarn && (
            <span
              className="rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] text-[var(--warning)]"
              title={normWarn}
            >
              Normalisation estimate
            </span>
          )}
          {isSimulation && (
            <span className="rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
              Simulation
            </span>
          )}
          {showTrackingUi && (
            <>
              <button
                type="button"
                onClick={() => handleRefresh()}
                disabled={isRefreshing}
                className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                {isRefreshing ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveAsSnapshot()}
                disabled={isSavingSnapshot}
                className="rounded px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                {isSavingSnapshot ? "Saving…" : "Save as snapshot"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            aria-label="Configure chart"
            className={cn(
              "rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
              showConfig && "bg-[var(--surface-hover)] text-[var(--foreground)]"
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      {showTrackingUi && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Scope:</span>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                name={`chart-scope-${block.id}`}
                checked={scope === "fixed"}
                onChange={() => handleSetScope("fixed")}
                disabled={isSettingScope}
                className="rounded-full border-[var(--border)] text-[var(--primary)]"
              />
              Track only these items
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="radio"
                name={`chart-scope-${block.id}`}
                checked={scope === "query"}
                onChange={() => handleSetScope("query")}
                disabled={isSettingScope}
                className="rounded-full border-[var(--border)] text-[var(--primary)]"
              />
              Track future items that meet these requirements
            </label>
          </div>
          {showTrackedList && (
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2">
              <h4 className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                Tracking {trackedCount} items
              </h4>
              <ul className="max-h-40 list-none space-y-0.5 overflow-y-auto text-xs text-[var(--foreground)]">
                {trackedVisible.map((row) => (
                  <li key={row.id} className="truncate">
                    {rowLabel(row)}
                  </li>
                ))}
              </ul>
              {trackedMore > 0 && !trackedListExpanded && (
                <button
                  type="button"
                  onClick={() => setTrackedListExpanded(true)}
                  className="mt-1 text-xs text-[var(--muted-foreground)] hover:underline"
                >
                  and {trackedMore} more
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <p className="mb-1 text-xs text-[var(--error)]">{actionError}</p>
      )}

      {showConfig && (
        <div className="mb-3">
          <ChartConfigPanel
            spec={localSpec}
            availableFields={availableFields}
            numericFields={numericFields}
            onChange={handleSpecChange}
            onClose={() => setShowConfig(false)}
          />
        </div>
      )}

      {saveError && (
        <p className="mb-1 text-xs text-[var(--error)]">{saveError}</p>
      )}

      {chartData ? (
        <TrakChart spec={localSpec} data={chartData} height={300} />
      ) : (
        <div className="text-sm text-[var(--muted-foreground)]">
          Chart unavailable.
        </div>
      )}
    </div>
  );
}

function LegacyUnsupportedMessage({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]",
        className
      )}
    >
      This chart uses a legacy format that is no longer supported. Create a new
      chart to visualize your data.
    </div>
  );
}

export default function ChartBlock({ block, className }: ChartBlockProps) {
  const content = block.content as ChartBlockContent | null;
  if (!content) {
    return (
      <div
        className={cn("text-sm text-[var(--muted-foreground)]", className)}
      >
        Chart unavailable.
      </div>
    );
  }
  if (isSpecChart(content)) {
    return <SpecChartBlock block={block} className={className} />;
  }
  return <LegacyUnsupportedMessage className={className} />;
}
