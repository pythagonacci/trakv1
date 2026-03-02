"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lock,
  RefreshCw,
  MoreHorizontal,
  Sparkles,
  Save,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Block } from "@/app/actions/block";
import type { ChartBlockContent, SpecChartBlockContent } from "@/types/chart";
import { isSpecChart, isRefreshableDataSource } from "@/types/chart";
import { cn } from "@/lib/utils";
import { updateChartBlock, refreshChartBlock, saveChartAsSnapshot, setChartDataScope } from "@/app/actions/chart-actions";
import { TrakChart } from "@/components/blocks/chart/TrakChart";
import { ChartConfigPanel } from "@/components/blocks/chart/ChartConfigPanel";
import { buildChartData, groupRowsByBreakdown } from "@/lib/charts/transform";
import { applySpecFallbacks, type ChartSpec } from "@/lib/charts/chartSpec";
import { resolveColor } from "@/lib/charts/palette";
import { getLinkableItemHref } from "@/lib/references/navigation";
import { queryKeys } from "@/lib/react-query/query-client";
import type { ChartRow } from "@/lib/charts/chartSpec";

interface ChartBlockProps {
  block: Block;
  className?: string;
  /** When true, hide config/refresh/save UI (e.g. for dashboard embedding) */
  readOnly?: boolean;
}

/** Pick display label for a chart row (tracked-items list) */
function rowLabel(row: ChartRow): string {
  const titleCandidates = ["Task Title", "Title", "title", "Name", "name"] as const;
  for (const key of titleCandidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const [key, value] of Object.entries(row)) {
    if (key === "id" || key === "status" || key === "priority" || key === "assignee" || key === "tags") continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Item";
}

/** Short meta line for a row (e.g. project name) */
function rowMeta(row: ChartRow): string {
  const metaCandidates = ["Project", "project", "meta", "assignee", "Assignee"] as const;
  for (const key of metaCandidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

/** Expandable breakdown section: category label + list of item cards */
function ExpandableBreakdownRow({
  label,
  color,
  count,
  percent,
  isOpen,
  onToggle,
  rows,
  readOnly,
  getTaskHref,
}: {
  label: string;
  color: string;
  count: number;
  percent: number;
  isOpen: boolean;
  onToggle: () => void;
  rows: ChartRow[];
  readOnly?: boolean;
  getTaskHref?: (row: ChartRow) => string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-hover)]"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-[6px] shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="truncate text-[12px] font-medium text-[var(--foreground)]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--foreground)] tabular-nums">
            {count} ({pct(percent)})
          </span>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </div>
      </button>
      <div
        className={cn(
          "overflow-hidden border-t border-[var(--border)] transition-[max-height,opacity] duration-200 ease-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
        aria-hidden={!isOpen}
      >
        <div className="px-3 py-2">
          {rows.length === 0 ? (
            <div className="py-2 text-[12px] text-[var(--muted-foreground)]">No items.</div>
          ) : (
            <div className="space-y-1">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-hover)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-[var(--foreground)]">
                      {rowLabel(row)}
                    </div>
                    {rowMeta(row) && (
                      <div className="truncate text-[11px] text-[var(--muted-foreground)]">
                        {rowMeta(row)}
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <a
                      href={getTaskHref?.(row) ?? `#task-${row.id}`}
                      className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                    >
                      Open
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecChartBlock({ block, className, readOnly }: ChartBlockProps) {
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
  const [compact, setCompact] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

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
  const title = localSpec.title ?? rawContent.title ?? "Chart";
  const normWarn = chartData?.meta.normalizationWarning;
  const showTrackingUi = rawContent.dataSource && isRefreshableDataSource(rawContent.dataSource);
  const scope = showTrackingUi && rawContent.dataSource && "scope" in rawContent.dataSource ? rawContent.dataSource.scope : null;
  const rows = rawContent.rows ?? [];

  const breakdownLabel = chartData?.meta?.labelLabel ?? localSpec.breakdown?.fieldLabel ?? localSpec.breakdown?.field ?? "Distribution";
  const categoryLabels = useMemo(() => {
    if (!chartData || chartData.data.length === 0) return [];
    return chartData.data.map((d: { label: string }) => d.label);
  }, [chartData]);
  const breakdownGroups = useMemo(() => {
    if (categoryLabels.length === 0 || rows.length === 0) return new Map<string, ChartRow[]>();
    return groupRowsByBreakdown(rows, localSpec, categoryLabels);
  }, [rows, localSpec, categoryLabels]);
  const totalCount = rows.length;
  useEffect(() => {
    if (openCategory === null && categoryLabels.length > 0) {
      setOpenCategory(categoryLabels[0]);
    }
  }, [categoryLabels, openCategory]);

  const hasBreakdown = chartData && categoryLabels.length > 0;

  const getTaskHrefForRow = useCallback(
    (row: ChartRow): string | null => {
      const projectId = (row as any).projectId as string | undefined;
      const tabId = (row as any).tabId as string | undefined;
      const href = getLinkableItemHref({
        referenceType: "task",
        id: String(row.id),
        tabId: tabId ?? block.tab_id,
        projectId: projectId ?? null,
        isWorkflow: false,
      });
      return href ?? `#task-${row.id}`;
    },
    [block.tab_id]
  );

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        isSimulation && "ring-1 ring-[var(--warning)]/25",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            {!readOnly && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
                Chart
              </span>
            )}
          </div>
          {!readOnly && showTrackingUi && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[var(--muted-foreground)]">Scope:</span>
              <label className="flex items-center gap-2 text-[var(--foreground)]">
                <input
                  type="radio"
                  name={`chart-scope-${block.id}`}
                  checked={scope === "fixed"}
                  onChange={() => handleSetScope("fixed")}
                  disabled={isSettingScope}
                  className="h-3.5 w-3.5 accent-[var(--foreground)]"
                />
                Track only these items
              </label>
              <label className="flex items-center gap-2 text-[var(--foreground)]">
                <input
                  type="radio"
                  name={`chart-scope-${block.id}`}
                  checked={scope === "query"}
                  onChange={() => handleSetScope("query")}
                  disabled={isSettingScope}
                  className="h-3.5 w-3.5 accent-[var(--foreground)]"
                />
                Track future items that meet requirements
              </label>
            </div>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)]"
              aria-label="Lock chart"
            >
              <Lock className="h-4 w-4" />
              Lock
            </button>
            {showTrackingUi && (
              <>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {isRefreshing ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsSnapshot}
                  disabled={isSavingSnapshot}
                  className="hidden md:inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save snapshot
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              aria-label="More options"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)]",
                showConfig && "bg-[var(--surface-hover)]"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className={cn("px-5 py-4", !compact && "pb-6")}>
        {isSaving && (
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">Saving…</p>
        )}
        {normWarn && (
          <span
            className="mb-2 inline-block rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] text-[var(--warning)]"
            title={normWarn}
          >
            Normalisation estimate
          </span>
        )}
        {isSimulation && (
          <span className="mb-2 inline-block rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
            Simulation
          </span>
        )}
        {actionError && (
          <p className="mb-2 text-xs text-[var(--error)]">{actionError}</p>
        )}
        {saveError && (
          <p className="mb-2 text-xs text-[var(--error)]">{saveError}</p>
        )}

        {!readOnly && showConfig && (
          <div className="mb-4">
            <ChartConfigPanel
              spec={localSpec}
              availableFields={availableFields}
              numericFields={numericFields}
              onChange={handleSpecChange}
              onClose={() => setShowConfig(false)}
            />
          </div>
        )}

        {chartData ? (
          <>
            {/* Subheader */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                <Filter className="h-4 w-4" />
                <span className="font-medium text-[var(--foreground)]">{breakdownLabel}</span>
                <span className="text-[var(--border)]">•</span>
                <span>
                  {scope === "query"
                    ? "Tracking future items"
                    : scope === "fixed"
                      ? "Tracking only selected items"
                      : "Snapshot"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompact((v) => !v)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                >
                  {compact ? "Expand" : "Compact"}
                </button>
                {hasBreakdown && (
                  <button
                    type="button"
                    onClick={() => setShowBreakdown((v) => !v)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  >
                    {showBreakdown ? "Hide breakdown" : "Show breakdown"}
                  </button>
                )}
              </div>
            </div>

            {/* Chart (left) + Breakdown (right) — chart-dominant split */}
            <div
              className={cn(
                "grid grid-cols-1 gap-4 min-w-0",
                showBreakdown && hasBreakdown
                  ? "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"
                  : "lg:grid-cols-1"
              )}
            >
              {/* Left: Overview + chart only */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 min-w-0 flex flex-col">
                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--foreground)]">Overview</div>
                    <div className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                      {localSpec.chartType === "doughnut" || localSpec.chartType === "pie"
                        ? "Donut + breakdown"
                        : "Chart + breakdown"}
                    </div>
                  </div>
                  <div className="text-[12px] font-medium text-[var(--muted-foreground)] tabular-nums">
                    {totalCount} {chartData.meta?.valueLabel?.toLowerCase() === "count" ? "items" : "total"}
                  </div>
                </div>
                <div className={cn("mt-3 flex-1 min-h-0 flex items-center justify-center", compact ? "min-h-[200px]" : "min-h-[260px]")}>
                  <div className="w-full h-full max-h-[280px] min-h-[200px]">
                    <TrakChart spec={localSpec} data={chartData} height={compact ? 220 : 260} />
                  </div>
                </div>
              </div>
              {/* Right: Breakdown panel */}
              {hasBreakdown && showBreakdown && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 min-w-0 flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="text-[12px] font-semibold text-[var(--foreground)]">Breakdown</div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">Tracked items</div>
                  </div>
                  <div className="mt-3 space-y-2 overflow-auto min-h-0 flex-1">
                    {categoryLabels.map((label, idx) => {
                      const groupRows = breakdownGroups.get(label) ?? [];
                      const datum = chartData.data[idx];
                      const value =
                        datum && typeof datum === "object" && "value" in datum
                          ? (datum as { value: number }).value
                          : groupRows.length;
                      const percent = totalCount > 0 ? (value / totalCount) * 100 : 0;
                      const color = resolveColor(label, idx);
                      return (
                        <ExpandableBreakdownRow
                          key={label}
                          label={label}
                          color={color}
                          count={typeof value === "number" ? value : groupRows.length}
                          percent={percent}
                          isOpen={openCategory === label}
                          onToggle={() => setOpenCategory((cur) => (cur === label ? null : label))}
                          rows={groupRows}
                          readOnly={readOnly}
                          getTaskHref={getTaskHrefForRow}
                        />
                      );
                    })}
                  </div>
                  <div className="my-3 h-px w-full bg-[var(--border)] shrink-0" />
                  <div className="grid grid-cols-3 gap-2 shrink-0">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                      <div className="text-[10px] font-medium text-[var(--muted-foreground)]">Total</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-[var(--foreground)] tabular-nums">
                        {totalCount}
                      </div>
                    </div>
                    {categoryLabels.slice(0, 2).map((label) => {
                      const groupRows = breakdownGroups.get(label) ?? [];
                      return (
                        <div
                          key={label}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-2"
                        >
                          <div className="text-[10px] font-medium text-[var(--muted-foreground)] truncate" title={label}>
                            {label}
                          </div>
                          <div className="mt-0.5 text-[13px] font-semibold text-[var(--foreground)] tabular-nums">
                            {groupRows.length}
                          </div>
                        </div>
                      );
                    })}
                    {categoryLabels.length < 2 && (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                        <div className="text-[10px] font-medium text-[var(--muted-foreground)]">—</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-[var(--foreground)] tabular-nums">—</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Filters bar */}
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <Filter className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-[var(--foreground)]">Filters</span>
                  <span className="text-[var(--border)]">•</span>
                  <span className="truncate">
                    {scope === "query" ? "Tracking future items" : scope === "fixed" ? `${totalCount} items` : "Snapshot"}
                  </span>
                  {categoryLabels.length > 0 && (
                    <>
                      <span className="text-[var(--border)]">|</span>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {categoryLabels.map((label, idx) => (
                          <span key={label} className="inline-flex items-center gap-1 text-[var(--foreground)]">
                            <span
                              className="h-2 w-2 rounded-[5px] shrink-0"
                              style={{ backgroundColor: resolveColor(label, idx) }}
                            />
                            {label}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setShowConfig(true)}
                    className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted-foreground)]">
              <div>Updated just now • Source: Chart data</div>
              <div className="tabular-nums">Chart v2</div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            Chart unavailable.
          </div>
        )}
      </div>
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

export default function ChartBlock({ block, className, readOnly }: ChartBlockProps) {
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
    return <SpecChartBlock block={block} className={className} readOnly={readOnly} />;
  }
  return <LegacyUnsupportedMessage className={className} />;
}
