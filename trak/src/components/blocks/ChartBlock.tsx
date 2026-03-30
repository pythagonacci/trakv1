"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { loadChartBlockData, updateChartBlock, refreshChartBlock, saveChartAsSnapshot, setChartDataScope } from "@/app/actions/chart-actions";
import { searchTasks } from "@/app/actions/ai-search";
import { SariaChart } from "@/components/blocks/chart/SariaChart";
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
  const id = (row as { id?: unknown }).id;
  const idStr = typeof id === "string" ? id.trim() : null;

  const titleCandidates = ["Task Title", "Title", "title", "Name", "name"] as const;
  for (const key of titleCandidates) {
    const v = row[key];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed && trimmed !== idStr) return trimmed;
    }
  }

  const excludedKeys = new Set(["id", "status", "priority", "assignee", "tags"]);

  // Prefer any other field whose key looks like a title/name
  for (const [key, value] of Object.entries(row)) {
    if (excludedKeys.has(key)) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed === idStr) continue;
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("title") || lowerKey.includes("name")) {
        return trimmed;
      }
    }
  }

  // Fallback: first non-empty string field
  for (const [key, value] of Object.entries(row)) {
    if (excludedKeys.has(key)) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed && trimmed !== idStr) return trimmed;
    }
  }

  return "Item";
}

/** Heuristic: does this row already have a human-readable title-like string (not just an id)? */
function hasReadableTitle(row: ChartRow): boolean {
  const id = (row as { id?: unknown }).id;
  const idStr = typeof id === "string" ? id.trim() : null;

  const titleCandidates = ["Task Title", "Title", "title", "Name", "name"] as const;
  for (const key of titleCandidates) {
    const v = row[key];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed && trimmed !== idStr) return true;
    }
  }

  const excludedKeys = new Set(["id", "status", "priority", "assignee", "tags"]);
  for (const [key, value] of Object.entries(row)) {
    if (excludedKeys.has(key)) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed && trimmed !== idStr) return true;
    }
  }

  return false;
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

const FRIENDLY_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  "in-progress": "In Progress",
  not_started: "Not Started",
  "not-started": "Not Started",
  done: "Done",
  blocked: "Blocked",
  high: "High",
  medium: "Medium",
  low: "Low",
  urgent: "Urgent",
  none: "None",
};

function formatCategoryLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return label;
  const lower = trimmed.toLowerCase();
  const known = FRIENDLY_LABELS[lower];
  if (known) return known;
  if (/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) {
    return trimmed
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : ""))
      .join(" ");
  }
  return label;
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
            {formatCategoryLabel(label)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--foreground)] tabular-nums">
            {count} ({pct(percent)})
          </span>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]">
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
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] px-2 py-1.5 hover:bg-[var(--surface-hover)]"
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
                      className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
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
  const rawRows = rawContent.rows ?? [];
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
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [hasTouchedOpenCategory, setHasTouchedOpenCategory] = useState(false);
  const [enhancedRows, setEnhancedRows] = useState<ChartRow[] | null>(null);
  const chartAreaRef = useRef<HTMLDivElement | null>(null);
  const [chartHeight, setChartHeight] = useState<number>(260);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    setLocalSpec(applySpecFallbacks(rawContent.spec));
  }, [block.id]);

  const showTrackingUi = rawContent.dataSource && isRefreshableDataSource(rawContent.dataSource);
  const liveChartSignature = useMemo(
    () =>
      showTrackingUi && rawContent.dataSource
        ? JSON.stringify({
            dataSource: rawContent.dataSource,
            normalizeTo: localSpec.normalizeTo ?? "focus",
          })
        : "",
    [showTrackingUi, rawContent.dataSource, localSpec.normalizeTo]
  );

  const liveChartDataQuery = useQuery({
    queryKey: queryKeys.chartLiveData(block.id, liveChartSignature),
    queryFn: async () => {
      const result = await loadChartBlockData(block.id);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(showTrackingUi && rawContent.dataSource && liveChartSignature),
    staleTime: 15 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const baseRows = liveChartDataQuery.data?.rows ?? rawRows;
  const effectiveUniverseTotal = liveChartDataQuery.data?.universeTotal ?? rawContent.universeTotal;

  const chartData = useMemo(() => {
    try {
      return buildChartData({
        focusRows: enhancedRows ?? baseRows,
        universeTotal: effectiveUniverseTotal,
        spec: localSpec,
      });
    } catch {
      return null;
    }
  }, [enhancedRows, baseRows, effectiveUniverseTotal, localSpec]);

  const availableFields = useMemo(() => {
    const rows = baseRows;
    if (!rows.length) return ["status", "priority", "assignee", "tags"];
    const keys = new Set<string>();
    for (const row of rows)
      Object.keys(row).forEach((k) => {
        if (k !== "id") keys.add(k);
      });
    return Array.from(keys);
  }, [baseRows]);

  const numericFields = useMemo(
    () =>
      availableFields.filter((f) =>
        baseRows.some((r) => typeof r[f] === "number")
      ),
    [baseRows, availableFields]
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

  const invalidateLiveChartData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.chartLiveData() });
  }, [queryClient]);

  const handleRefresh = useCallback(async () => {
    setActionError(null);
    setIsRefreshing(true);
    const result = await refreshChartBlock(block.id);
    setIsRefreshing(false);
    if ("error" in result) {
      setActionError(result.error);
    } else {
      invalidateLiveChartData();
      invalidateBlock();
    }
  }, [block.id, invalidateBlock, invalidateLiveChartData]);

  const handleSaveAsSnapshot = useCallback(async () => {
    setActionError(null);
    setIsSavingSnapshot(true);
    const result = await saveChartAsSnapshot(block.id);
    setIsSavingSnapshot(false);
    if ("error" in result) {
      setActionError(result.error);
    } else {
      invalidateLiveChartData();
      invalidateBlock();
    }
  }, [block.id, invalidateBlock, invalidateLiveChartData]);

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
        invalidateLiveChartData();
        invalidateBlock();
      }
    },
    [block.id, rawContent.dataSource, invalidateBlock, invalidateLiveChartData]
  );
  const isSimulation = Boolean(rawContent.metadata?.isSimulation);
  const title = localSpec.title ?? rawContent.title ?? "Chart";

  useEffect(() => {
    if (!editingTitle) {
      setTitleInput(title);
    }
  }, [title, editingTitle]);

  const handleTitleSave = useCallback(async () => {
    const trimmed = titleInput.trim();
    setEditingTitle(false);
    if (trimmed === title) return;

    await handleSpecChange({
      ...localSpec,
      title: trimmed || undefined,
    });
  }, [titleInput, title, handleSpecChange, localSpec]);

  const normWarn = chartData?.meta.normalizationWarning;
  const scope = showTrackingUi && rawContent.dataSource && "scope" in rawContent.dataSource ? rawContent.dataSource.scope : null;
  const rows = enhancedRows ?? baseRows;
  const liveDataError =
    liveChartDataQuery.error instanceof Error ? liveChartDataQuery.error.message : null;

  // When the chart rows come from a tasks query and don't already have any readable
  // title-like strings, fetch task titles by ID and enrich rows with "Task Title"
  // so the breakdown panel can show actual task names instead of generic labels.
  useEffect(() => {
    setEnhancedRows(null);

    const ds = rawContent.dataSource;
    if (!ds) return;
    if (!baseRows.length) return;

    let isTasksSource = false;
    if (ds.mode === "refreshable") {
      if (ds.scope === "query") {
        isTasksSource = ds.query.type === "tasks";
      } else {
        isTasksSource = ds.entityType === "task";
      }
    }
    if (!isTasksSource) return;

    const hasRowsMissingReadableTitle = baseRows.some((row) => !hasReadableTitle(row));
    if (!hasRowsMissingReadableTitle) return;

    const ids = Array.from(
      new Set(
        baseRows
          .map((r) => {
            const id = (r as { id?: unknown }).id;
            return id != null ? String(id) : "";
          })
          .filter((id) => id)
      )
    );
    if (!ids.length) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await searchTasks({ taskIds: ids, limit: ids.length });
        if (!res.data || res.error || cancelled) return;
        const titleById = new Map<string, string>();
        for (const task of res.data) {
          const title = (task as any).title;
          if (typeof title === "string" && title.trim()) {
            titleById.set(String((task as any).id), title.trim());
          }
        }
        if (!titleById.size) return;

        const nextRows = baseRows.map((row) => {
          const id = (row as { id?: unknown }).id;
          const idStr = id != null ? String(id) : "";
          const existingTitle = (row as any)["Task Title"];
          if (typeof existingTitle === "string" && existingTitle.trim() && existingTitle.trim() !== idStr) {
            return row;
          }
          const fetchedTitle = titleById.get(idStr);
          if (fetchedTitle && fetchedTitle !== idStr) {
            return { ...row, "Task Title": fetchedTitle } as ChartRow;
          }
          return row;
        });

        if (!cancelled) {
          setEnhancedRows(nextRows);
        }
      } catch {
        // Ignore fetch errors; fallback labels will continue to be used.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawContent.dataSource, baseRows, block.id]);

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
  const hasBreakdown = chartData && categoryLabels.length > 0;
  const minChartHeight = useMemo(() => {
    const base = 260;
    if (!hasBreakdown || !showBreakdown) return base;
    const buckets = categoryLabels.length;
    // Scale height up a bit as the breakdown grows, capped so it doesn't dominate the page.
    const extraSteps = Math.min(3, Math.floor(buckets / 4)); // +1 step per ~4 buckets, up to 3 steps
    return base + extraSteps * 80;
  }, [hasBreakdown, showBreakdown, categoryLabels.length]);

  const syncChartHeight = useCallback(() => {
    const el = chartAreaRef.current;
    if (!el) {
      setChartHeight((prev) => (prev === minChartHeight ? prev : minChartHeight));
      return;
    }

    const measuredHeight = Math.floor(el.getBoundingClientRect().height);
    const nextHeight = measuredHeight > 0 ? Math.max(minChartHeight, measuredHeight) : minChartHeight;
    setChartHeight((prev) => (Math.abs(prev - nextHeight) <= 1 ? prev : nextHeight));
  }, [minChartHeight]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncChartHeight();
    });

    const el = chartAreaRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(() => {
      syncChartHeight();
    });
    observer.observe(el);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [syncChartHeight]);

  const getTaskHrefForRow = useCallback(
    (row: ChartRow): string | null => {
      const projectId = typeof row.projectId === "string" ? row.projectId : undefined;
      const tabId = typeof row.tabId === "string" ? row.tabId : undefined;
      const href = getLinkableItemHref({
        referenceType: "task",
        id: String(row.id),
        tabId: tabId ?? block.tab_id,
        tabName:
          (typeof row.tabName === "string" ? row.tabName : undefined) ??
          (typeof row.Tab === "string" ? row.Tab : undefined),
        projectId: projectId ?? null,
        projectName:
          (typeof row.projectName === "string" ? row.projectName : undefined) ??
          (typeof row.Project === "string" ? row.Project : undefined),
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
            {editingTitle && !readOnly ? (
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleTitleSave();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingTitle(false);
                    setTitleInput(title);
                  }
                }}
                autoFocus
                className="w-full max-w-xs border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[15px] font-semibold tracking-tight text-[var(--foreground)] focus:outline-none rounded-[var(--radius-md)]"
                placeholder="Chart title"
              />
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  setEditingTitle(true);
                }}
                className="truncate text-left text-[15px] font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--foreground)]/90"
              >
                {title}
              </button>
            )}
            {!readOnly && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
                Chart
              </span>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)]"
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
                  className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {isRefreshing ? "Refreshing…" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsSnapshot}
                  disabled={isSavingSnapshot}
                  className="hidden md:inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)] whitespace-nowrap shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save snapshot
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 pb-6">
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
        {!actionError && liveDataError && (
          <p className="mb-2 text-xs text-[var(--error)]">
            Live chart data is unavailable right now. Showing the saved snapshot.
          </p>
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
                {showTrackingUi ? (
                  <select
                    value={scope ?? "fixed"}
                    onChange={(e) => handleSetScope(e.target.value as "fixed" | "query")}
                    disabled={isSettingScope}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--foreground)]"
                  >
                    <option value="fixed">Track only these items</option>
                    <option value="query">Track future items</option>
                  </select>
                ) : (
                  <span>
                    {scope === "query"
                      ? "Tracking future items"
                      : scope === "fixed"
                        ? "Tracking only selected items"
                        : "Snapshot"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasBreakdown && (
                  <button
                    type="button"
                    onClick={() => setShowBreakdown((v) => !v)}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
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
                <div
                  ref={chartAreaRef}
                  className="mt-3 flex-1 min-h-0 flex items-center justify-center min-h-[260px]"
                >
                  <div className="w-full h-full">
                    <SariaChart
                      spec={localSpec}
                      data={chartData}
                      height={chartHeight}
                    />
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
                          onToggle={() => {
                            setHasTouchedOpenCategory(true);
                            setOpenCategory((cur) => (cur === label ? null : label));
                          }}
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
                            {formatCategoryLabel(label)}
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
                            {formatCategoryLabel(label)}
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
                    className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
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
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted-foreground)]",
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
