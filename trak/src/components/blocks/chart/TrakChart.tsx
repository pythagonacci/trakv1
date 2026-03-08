"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import { cn } from "@/lib/utils";
import { buildColorMap, resolveColor } from "@/lib/charts/palette";
import type {
  CategoricalChartData,
  ChartData,
  ChartSpec,
  SeriesChartData,
} from "@/lib/charts/chartSpec";
import { ChartEmptyState } from "./ChartEmptyState";

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

function formatChartLabel(label: string): string {
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

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload?: Record<string, unknown>;
  fill?: string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  showPercent?: boolean;
  totalDenominator?: number;
  valueLabel?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  showPercent,
  totalDenominator,
  valueLabel = "Count",
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 shadow-md"
      role="tooltip"
    >
      {label && (
        <p className="mb-1 text-xs font-medium text-[var(--foreground)]">{formatChartLabel(label)}</p>
      )}
      {payload.map((entry, i) => {
        const pct =
          showPercent && totalDenominator && totalDenominator > 0
            ? ((entry.value / totalDenominator) * 100).toFixed(1)
            : null;
        return (
          <div key={i} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.fill ?? entry.color ?? "#94a3b8" }}
              aria-hidden="true"
            />
            <span className="font-medium text-[var(--foreground)]">
              {formatChartLabel(entry.name)}:
            </span>
            <span>
              {entry.value} {valueLabel.toLowerCase()}
              {pct !== null && ` (${pct}%)`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pie / Doughnut ──────────────────────────────────────────────────────────

interface PieChartRendererProps {
  data: CategoricalChartData;
  spec: ChartSpec;
  height: number;
}

function PieChartRenderer({ data, spec, height }: PieChartRendererProps) {
  const isDoughnut = spec.chartType === "doughnut";
  const labels = data.data.map((d) => d.label);
  const colorMap = useMemo(() => buildColorMap(labels), [labels.join(",")]);

  const totalDenominator =
    spec.normalizeTo === "universe"
      ? (data.meta.totalUniverse ?? data.meta.totalFocus)
      : data.meta.totalFocus;

  // Custom SVG label — shows "Name (pct%)" outside the slice.
  // Returns null for tiny slices (< 6%) to avoid clutter.
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name } = props;
    if (typeof percent !== "number" || percent < 0.06) return null;

    const RADIAN = Math.PI / 180;
    // Position label just outside the outer edge
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? "start" : "end";

    return (
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={11}
        fill="var(--foreground)"
      >
        {formatChartLabel(String(name))} ({(percent * 100).toFixed(0)}%)
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height} aria-label={spec.title ?? "Pie chart"}>
      <PieChart margin={{ top: 16, right: 80, bottom: 16, left: 80 }}>
        <Pie
          data={data.data.map((d) => ({ name: d.label, value: d.value }))}
          cx="50%"
          cy="50%"
          outerRadius={isDoughnut ? "75%" : "80%"}
          innerRadius={isDoughnut ? "46%" : 0}
          dataKey="value"
          label={renderCustomLabel}
          labelLine={{ stroke: "var(--border)", strokeWidth: 1 }}
          aria-label="Chart slices"
          isAnimationActive={false}
        >
          {data.data.map((entry, index) => (
            <Cell
              key={`cell-${entry.label}-${index}`}
              fill={resolveColor(entry.label, index)}
            />
          ))}
        </Pie>
        <Tooltip
          content={
            <CustomTooltip
              showPercent
              totalDenominator={totalDenominator}
              valueLabel={data.meta.valueLabel}
            />
          }
        />
        {/* Legend helps identify slices too small for on-chart labels */}
        <Legend
          formatter={(value) => (
            <span className="text-xs text-[var(--foreground)]" aria-label={`Legend: ${value}`}>
              {formatChartLabel(String(value))}
            </span>
          )}
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Single-series horizontal bar ────────────────────────────────────────────

interface SingleBarRendererProps {
  data: CategoricalChartData;
  spec: ChartSpec;
  height: number;
  orientation: "horizontal" | "vertical";
}

function SingleBarRenderer({ data, spec, height, orientation }: SingleBarRendererProps) {
  const labels = data.data.map((d) => d.label);
  const colorMap = useMemo(() => buildColorMap(labels), [labels.join(",")]);

  const chartData = data.data.map((d) => ({ name: d.label, value: d.value }));

  if (orientation === "vertical") {
    // Fallback handled by applySpecFallbacks; this branch shouldn't be reached
    // without a series field, but render safely anyway
    return <SingleBarRenderer data={data} spec={spec} height={height} orientation="horizontal" />;
  }

  // Horizontal bar: layout="vertical" in Recharts terminology
  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(height, data.data.length * 36 + 40)}
      aria-label={spec.title ?? "Bar chart"}
    >
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          label={
            spec.valueLabel
              ? { value: spec.valueLabel, position: "insideBottom", offset: -4, fontSize: 11 }
              : undefined
          }
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tickFormatter={(value) => formatChartLabel(String(value))}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          content={<CustomTooltip valueLabel={data.meta.valueLabel} />}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={28} isAnimationActive={false}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${entry.name}-${index}`}
              fill={resolveColor(entry.name, index)}
              aria-label={`${entry.name}: ${entry.value}`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Multi-series bar (horizontal + vertical) ────────────────────────────────

interface MultiSeriesBarRendererProps {
  data: SeriesChartData;
  spec: ChartSpec;
  height: number;
  orientation: "horizontal" | "vertical";
}

function MultiSeriesBarRenderer({
  data,
  spec,
  height,
  orientation,
}: MultiSeriesBarRendererProps) {
  const seriesKeys = data.meta.seriesKeys ?? [];
  const seriesColorMap = useMemo(() => buildColorMap(seriesKeys), [seriesKeys.join(",")]);

  const chartData = data.data;

  if (orientation === "vertical") {
    // Standard vertical BarChart (categories on X, values on Y)
    return (
      <ResponsiveContainer width="100%" height={height} aria-label={spec.title ?? "Bar chart"}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 8, bottom: 32 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickFormatter={(value) => formatChartLabel(String(value))}
            tick={{ fontSize: 11, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={chartData.length > 5 ? -35 : 0}
            textAnchor={chartData.length > 5 ? "end" : "middle"}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            label={
              spec.valueLabel
                ? { value: spec.valueLabel, angle: -90, position: "insideLeft", fontSize: 11 }
                : undefined
            }
          />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            content={<CustomTooltip valueLabel={data.meta.valueLabel} />}
          />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-[var(--foreground)]" aria-label={`Legend: ${value}`}>
                {formatChartLabel(String(value))}
              </span>
            )}
          />
          {seriesKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={resolveColor(key, i)}
              radius={[2, 2, 0, 0]}
              maxBarSize={24}
              aria-label={key}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Horizontal multi-series
  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(height, chartData.length * 44 + 60)}
      aria-label={spec.title ?? "Bar chart"}
    >
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tickFormatter={(value) => formatChartLabel(String(value))}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          content={<CustomTooltip valueLabel={data.meta.valueLabel} />}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-[var(--foreground)]" aria-label={`Legend: ${value}`}>
              {formatChartLabel(String(value))}
            </span>
          )}
          wrapperStyle={{ paddingTop: 8 }}
        />
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={resolveColor(key, i)}
            radius={[0, 2, 2, 0]}
            maxBarSize={18}
            aria-label={key}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── TrakChart root ──────────────────────────────────────────────────────────

interface TrakChartProps {
  spec: ChartSpec;
  data: ChartData;
  height?: number;
  className?: string;
}

export function TrakChart({ spec, data, height = 300, className }: TrakChartProps) {
  const isEmpty = data.data.length === 0;

  if (isEmpty) {
    return <ChartEmptyState className={className} />;
  }

  const orientation = spec.orientation ?? "horizontal";

  if (spec.chartType === "pie" || spec.chartType === "doughnut") {
    if (data.type !== "categorical") {
      return <ChartEmptyState message="Unexpected data format." className={className} />;
    }
    return (
      <div className={cn("w-full", className)} role="img" aria-label={spec.title ?? "Chart"}>
        <PieChartRenderer data={data} spec={spec} height={height} />
      </div>
    );
  }

  if (spec.chartType === "bar") {
    if (data.type === "series") {
      return (
        <div className={cn("w-full", className)} role="img" aria-label={spec.title ?? "Chart"}>
          <MultiSeriesBarRenderer
            data={data}
            spec={spec}
            height={height}
            orientation={orientation}
          />
        </div>
      );
    }
    if (data.type === "categorical") {
      return (
        <div className={cn("w-full", className)} role="img" aria-label={spec.title ?? "Chart"}>
          <SingleBarRenderer
            data={data}
            spec={spec}
            height={height}
            orientation={orientation}
          />
        </div>
      );
    }
  }

  return <ChartEmptyState message="Unsupported chart type." className={className} />;
}
