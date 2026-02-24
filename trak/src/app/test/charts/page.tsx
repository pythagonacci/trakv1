"use client";

import React, { useState } from "react";
import { TrakChart } from "@/components/blocks/chart/TrakChart";
import { ChartConfigPanel } from "@/components/blocks/chart/ChartConfigPanel";
import { buildChartData } from "@/lib/charts/transform";
import { applySpecFallbacks, type ChartSpec } from "@/lib/charts/chartSpec";

// ─── Mock datasets ────────────────────────────────────────────────────────────

const TASK_ROWS = [
  { id: "1", status: "todo",        priority: "high",   assignee: "Alice", tags: ["frontend"] },
  { id: "2", status: "todo",        priority: "low",    assignee: "Bob",   tags: ["backend"] },
  { id: "3", status: "todo",        priority: "medium", assignee: "Alice", tags: ["frontend", "bug"] },
  { id: "4", status: "in-progress", priority: "high",   assignee: "Alice", tags: ["backend"] },
  { id: "5", status: "in-progress", priority: "medium", assignee: "Carol", tags: ["frontend"] },
  { id: "6", status: "in-progress", priority: "low",    assignee: "Bob",   tags: ["bug"] },
  { id: "7", status: "done",        priority: "low",    assignee: "Bob",   tags: ["backend"] },
  { id: "8", status: "done",        priority: "high",   assignee: "Carol", tags: ["frontend"] },
  { id: "9", status: "done",        priority: "medium", assignee: "Dave",  tags: ["bug", "frontend"] },
];

const FIGMA_ROWS = [
  { id: "f1", type: "Figma", status: "Active"  },
  { id: "f2", type: "Figma", status: "Active"  },
  { id: "f3", type: "Figma", status: "Draft"   },
];
const ALL_FILES_TOTAL = 10;

// ─── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIOS: Array<{
  label: string;
  description: string;
  spec: Partial<ChartSpec>;
  rows: Array<Record<string, string | string[]> & { id: string }>;
  universeTotal?: number;
  availableFields: string[];
}> = [
  {
    label: "1. Pie — tasks by status (focus)",
    description: "Acceptance: pie chart, Figma files by status, focus-normalised",
    spec: { chartType: "pie", breakdown: { field: "status" }, normalizeTo: "focus" },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
  {
    label: "2. Doughnut — tasks by status",
    description: "Acceptance: same as pie but doughnut",
    spec: { chartType: "doughnut", breakdown: { field: "status" }, normalizeTo: "focus" },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
  {
    label: "3. Pie — Figma by status (universe + rest slice)",
    description: "Acceptance: Figma files by status out of all files — universe normalised + rest slice",
    spec: {
      chartType: "pie",
      breakdown: { field: "status" },
      normalizeTo: "universe",
      pieComposition: "focusPlusRest",
      restLabel: "Non-Figma",
    },
    rows: FIGMA_ROWS,
    universeTotal: ALL_FILES_TOTAL,
    availableFields: ["type", "status"],
  },
  {
    label: "4. Horizontal bar — tasks by status (single-series)",
    description: "Acceptance: horizontal bar, tasks by status",
    spec: {
      chartType: "bar",
      orientation: "horizontal",
      breakdown: { field: "status" },
    },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
  {
    label: "5. Horizontal bar — tasks by assignee × status (multi-series)",
    description: "Acceptance: horizontal multi-series bar, tasks by assignee split by status",
    spec: {
      chartType: "bar",
      orientation: "horizontal",
      breakdown: { field: "assignee" },
      series: { field: "status" },
    },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
  {
    label: "6. Vertical bar — tasks by assignee × status (multi-series)",
    description: "Acceptance: vertical multi-series bar, tasks by assignee split by status",
    spec: {
      chartType: "bar",
      orientation: "vertical",
      breakdown: { field: "assignee" },
      series: { field: "status" },
    },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
  {
    label: "7. Pie — tasks by tags (multi-value field)",
    description: "Each row contributes to each of its tag values",
    spec: { chartType: "pie", breakdown: { field: "tags" }, sort: "value_desc" },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
  {
    label: "8. Bar + topN=2 + Other bucket",
    description: "Only top 2 assignees shown, rest bucketed into Other",
    spec: {
      chartType: "bar",
      orientation: "horizontal",
      breakdown: { field: "assignee" },
      topN: 2,
      includeOtherBucket: true,
      otherLabel: "Others",
    },
    rows: TASK_ROWS,
    availableFields: ["status", "priority", "assignee", "tags"],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartTestPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editedSpec, setEditedSpec] = useState<ChartSpec | null>(null);

  const scenario = SCENARIOS[selectedIdx]!;

  const activeSpec = applySpecFallbacks({
    version: 1,
    chartType: "pie",
    orientation: "horizontal",
    measure: { type: "count" },
    normalizeTo: "focus",
    pieComposition: "breakdownOnly",
    restLabel: "Rest",
    includeOtherBucket: false,
    otherLabel: "Other",
    sort: "value_desc",
    breakdown: { field: "status" },
    ...scenario.spec,
    ...(editedSpec ?? {}),
  } as ChartSpec);

  const chartData = (() => {
    try {
      return buildChartData({
        focusRows: scenario.rows,
        universeTotal: scenario.universeTotal,
        spec: activeSpec,
      });
    } catch (e) {
      return null;
    }
  })();

  return (
    <div className="min-h-screen bg-[var(--background)] p-8 text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">Chart System — Visual Test</h1>
        <p className="mb-8 text-sm text-[var(--muted-foreground)]">
          All 6 acceptance scenarios + extras. Use the config panel to tweak live.
        </p>

        {/* Scenario selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {SCENARIOS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setSelectedIdx(i); setEditedSpec(null); }}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                i === selectedIdx
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {s.label.split("—")[0].trim()}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Chart */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-3">
              <h2 className="text-base font-semibold">{scenario.label}</h2>
              <p className="text-xs text-[var(--muted-foreground)]">{scenario.description}</p>
              {scenario.universeTotal && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Universe total: {scenario.universeTotal} — focus rows: {scenario.rows.length}
                </p>
              )}
            </div>

            {chartData ? (
              <TrakChart spec={activeSpec} data={chartData} height={340} />
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-[var(--error)]">
                Transform error — check console
              </div>
            )}

            {chartData && (
              <div className="mt-4 rounded-md bg-[var(--background)] p-3 text-xs text-[var(--muted-foreground)]">
                <strong className="text-[var(--foreground)]">Meta:</strong>{" "}
                type={chartData.type} | focus={chartData.meta.totalFocus} | universe={chartData.meta.totalUniverse ?? "n/a"}
                {chartData.meta.normalizationWarning && (
                  <span className="ml-2 text-[var(--warning)]">⚠ {chartData.meta.normalizationWarning}</span>
                )}
                {chartData.type === "series" && (
                  <> | series: [{chartData.meta.seriesKeys?.join(", ")}]</>
                )}
              </div>
            )}
          </div>

          {/* Config */}
          <div>
            <ChartConfigPanel
              spec={activeSpec}
              availableFields={scenario.availableFields}
              onChange={(next) => setEditedSpec(next)}
            />
          </div>
        </div>

        {/* Raw data */}
        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            View active spec + raw data
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <pre className="overflow-auto rounded-md bg-[var(--surface)] p-4 text-xs">
              {JSON.stringify(activeSpec, null, 2)}
            </pre>
            <pre className="overflow-auto rounded-md bg-[var(--surface)] p-4 text-xs">
              {JSON.stringify(chartData?.data?.slice(0, 10), null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}
