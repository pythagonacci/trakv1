"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Lock,
  RefreshCw,
  MoreHorizontal,
  Sparkles,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { generateDashboardChartData } from "@/app/actions/chart-actions";
import { buildChartData, groupRowsByBreakdown } from "@/lib/charts/transform";
import { TrakChart } from "@/components/blocks/chart/TrakChart";
import { resolveColor } from "@/lib/charts/palette";
import { cn } from "@/lib/utils";
import { getLinkableItemHref } from "@/lib/references/navigation";
import type { ChartRow } from "@/lib/charts/chartSpec";
import type { ChartWidgetConfig } from "../dashboard-config-types";

interface DashboardChartWidgetProps {
  config: ChartWidgetConfig;
}

/** Pick a readable label for a dashboard chart row */
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

interface ExpandableBreakdownRowProps {
  label: string;
  color: string;
  count: number;
  percent: number;
  isOpen: boolean;
  onToggle: () => void;
  rows: ChartRow[];
  getTaskHref?: (row: ChartRow) => string | null;
}

function ExpandableBreakdownRow({
  label,
  color,
  count,
  percent,
  isOpen,
  onToggle,
  rows,
  getTaskHref,
}: ExpandableBreakdownRowProps) {
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
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
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
                  <a
                    href={getTaskHref?.(row) ?? `#task-${row.id}`}
                    className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  >
                    Open
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardChartWidget({ config }: DashboardChartWidgetProps) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateDashboardChartData>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [hasTouchedOpenCategory, setHasTouchedOpenCategory] = useState(false);
  const [spinNonce, setSpinNonce] = useState(0);

  const query = "query" in config ? config.query : undefined;
  const isLegacy = !query;

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setError(null);
    setIsLoading(true);
    generateDashboardChartData(query).then((res) => {
      if (cancelled) return;
      setIsLoading(false);
      setResult(res);
      if ("error" in res) setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [
    query?.chartType,
    query?.scope,
    query?.projectId ?? "",
    query?.breakdownField,
    query?.title ?? "",
    refreshNonce,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSpinNonce((n) => n + 1);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  const chartData = useMemo(() => {
    if (!result || "error" in result || !result.data) return null;
    try {
      return buildChartData({
        focusRows: result.data.rows,
        spec: result.data.spec,
      });
    } catch {
      return null;
    }
  }, [result]);

  const rows: ChartRow[] = useMemo(
    () => (result && "data" in result && result.data?.rows ? result.data.rows : []),
    [result]
  );

  const spec = useMemo(() => {
    if (!result || "error" in result || !result.data) return null;
    return result.data.spec;
  }, [result]);

  const categoryLabels = useMemo(() => {
    if (!chartData || !chartData.data.length) return [];
    return (chartData.data as Array<{ label: string }>).map((d) => d.label);
  }, [chartData]);

  const breakdownGroups = useMemo(() => {
    if (!chartData || !categoryLabels.length || !rows.length || !spec) {
      return new Map<string, ChartRow[]>();
    }
    return groupRowsByBreakdown(rows, spec, categoryLabels);
  }, [chartData, categoryLabels, rows, spec]);

  const title = query?.title ?? (result && "data" in result ? result.data?.title : null) ?? "Chart";

  if (isLegacy) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="p-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Chart setup has changed. Use Configure dashboard to add a new chart (choose type, scope, and group by).
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !chartData) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
                Chart
              </span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    );
  }

  if (error || !result || "error" in result || !chartData || !spec) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                <Sparkles className="h-3.5 w-3.5" />
                Chart
              </span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            {error ?? ("error" in (result ?? {}) ? (result as any).error : "Failed to generate chart.")}
          </p>
        </div>
      </div>
    );
  }

  const totalCount = rows.length;
  const scopeLabel =
    query?.scope === "workspace"
      ? "Workspace scope"
      : query?.scope === "project"
        ? "Project scope"
        : "Snapshot";
  const breakdownLabel =
    chartData.meta?.labelLabel ?? spec.breakdown?.fieldLabel ?? spec.breakdown?.field ?? "Distribution";

  const getTaskHrefForRow = (row: ChartRow): string | null => {
    const projectIdFromRow = (row as any).projectId as string | undefined;
    const tabIdFromRow = (row as any).tabId as string | undefined;
    if (!tabIdFromRow) return `#task-${row.id}`;
    const href = getLinkableItemHref({
      referenceType: "task",
      id: String(row.id),
      tabId: tabIdFromRow,
      projectId: projectIdFromRow ?? (query?.projectId ?? null),
      isWorkflow: false,
    });
    return href ?? `#task-${row.id}`;
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
              <Sparkles className="h-3.5 w-3.5" />
              Chart
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
            <span>{scopeLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)]"
            aria-label="Lock chart"
          >
            <Lock className="h-4 w-4" />
            Lock
          </button>
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-[var(--surface-hover)]"
            aria-label="More chart options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {/* Subheader row */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
            <Filter className="h-4 w-4" />
            <span className="font-medium text-[var(--foreground)]">{breakdownLabel}</span>
            <span className="text-[var(--border)]">•</span>
            <span>{scopeLabel}</span>
          </div>
          {categoryLabels.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              {showBreakdown ? "Hide breakdown" : "Show breakdown"}
            </button>
          )}
        </div>

        {/* Main grid: chart (left) + breakdown (right) — chart-dominant split */}
        <div
          className={cn(
            "grid grid-cols-1 gap-4 min-w-0",
            showBreakdown && categoryLabels.length > 0
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
                  {spec.chartType === "doughnut" || spec.chartType === "pie"
                    ? "Donut + breakdown"
                    : "Chart + breakdown"}
                </div>
              </div>
              <div className="text-[12px] font-medium text-[var(--muted-foreground)] tabular-nums">
                {totalCount} items
              </div>
            </div>
            <div className="mt-3 flex-1 min-h-[220px] flex items-center justify-center">
              <div className="w-full h-full max-h-[280px]">
                <TrakChart key={spinNonce} spec={spec} data={chartData} height={260} />
              </div>
            </div>
          </div>
          {/* Right: Breakdown panel */}
          {categoryLabels.length > 0 && showBreakdown && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 min-w-0 flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <div className="text-[12px] font-semibold text-[var(--foreground)]">Breakdown</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">Tracked items</div>
              </div>
              <div className="mt-3 space-y-2 overflow-auto min-h-0 flex-1">
                {categoryLabels.map((label, idx) => {
                  const groupRows = breakdownGroups.get(label) ?? [];
                  const datum = (chartData.data as Array<any>)[idx];
                  const value =
                    datum && typeof datum === "object" && "value" in datum
                      ? (datum.value as number)
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
                      <div
                        className="text-[10px] font-medium text-[var(--muted-foreground)] truncate"
                        title={label}
                      >
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
              <span className="truncate">{scopeLabel}</span>
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
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--muted-foreground)]">
          <div>Updated just now • Dashboard chart</div>
          <div className="tabular-nums">Chart v2</div>
        </div>
      </div>
    </div>
  );
}
