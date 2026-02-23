"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Block } from "@/app/actions/block";
import type { ChartBlockContent, SpecChartBlockContent } from "@/types/chart";
import { isSpecChart } from "@/types/chart";
import { cn } from "@/lib/utils";
import { updateChartBlock } from "@/app/actions/chart-actions";
import { TrakChart } from "@/components/blocks/chart/TrakChart";
import { ChartConfigPanel } from "@/components/blocks/chart/ChartConfigPanel";
import { buildChartData } from "@/lib/charts/transform";
import { applySpecFallbacks, type ChartSpec } from "@/lib/charts/chartSpec";

interface ChartBlockProps {
  block: Block;
  className?: string;
}

function SpecChartBlock({ block, className }: ChartBlockProps) {
  const rawContent = (block.content || {}) as SpecChartBlockContent;
  const [localSpec, setLocalSpec] = useState<ChartSpec>(() =>
    applySpecFallbacks(rawContent.spec)
  );
  const [showConfig, setShowConfig] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const isSimulation = Boolean(rawContent.metadata?.isSimulation);
  const title = localSpec.title ?? rawContent.title;
  const normWarn = chartData?.meta.normalizationWarning;

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
