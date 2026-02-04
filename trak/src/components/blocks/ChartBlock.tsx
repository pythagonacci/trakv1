"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JsxParser from "react-jsx-parser";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler,
} from "chart.js";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import type { Block } from "@/app/actions/block";
import type { ChartBlockContent } from "@/types/chart";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { updateChartCustomization } from "@/app/actions/chart-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

interface ChartBlockProps {
  block: Block;
  className?: string;
}

function normalizeJsx(code: string) {
  let cleaned = code.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
    cleaned = cleaned.replace(/```$/, "");
  }

  cleaned = cleaned.replace(/^\s*import .*$/gm, "");
  cleaned = cleaned.replace(/^\s*export default .*$/gm, "");

  const returnMatch = cleaned.match(/return\s*\((([\s\S]*))\)\s*;?/);
  if (returnMatch && returnMatch[1]) {
    cleaned = returnMatch[1].trim();
  }

  return cleaned.trim();
}

type ChartRow = {
  label: string;
  value: string;
  color: string;
};

function parseArrayLiteral(value: string) {
  try {
    const normalized = value.replace(/'/g, "\"");
    return JSON.parse(`[${normalized}]`);
  } catch {
    return null;
  }
}

function extractChartData(code: string) {
  const labelsMatch = code.match(/labels\s*:\s*\[([\s\S]*?)\]/);
  const dataMatch = code.match(/data\s*:\s*\[([\s\S]*?)\]/);
  const colorMatch = code.match(/backgroundColor\s*:\s*\[([\s\S]*?)\]/);

  const labels = labelsMatch ? parseArrayLiteral(labelsMatch[1]) : null;
  const values = dataMatch ? parseArrayLiteral(dataMatch[1]) : null;
  const colors = colorMatch ? parseArrayLiteral(colorMatch[1]) : null;

  return {
    labels: Array.isArray(labels) ? labels.map((entry) => String(entry)) : [],
    values: Array.isArray(values) ? values.map((entry) => Number(entry)) : [],
    colors: Array.isArray(colors) ? colors.map((entry) => String(entry)) : [],
  };
}

function buildRows(labels: string[], values: number[], colors: string[]) {
  const maxLen = Math.max(labels.length, values.length, colors.length, 1);
  return Array.from({ length: maxLen }).map((_, idx) => ({
    label: labels[idx] ?? "",
    value: values[idx] !== undefined ? String(values[idx]) : "",
    color: colors[idx] ?? "#3b82f6",
  }));
}

function parseNumeric(value: string) {
  const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

export default function ChartBlock({ block, className }: ChartBlockProps) {
  const content = (block.content || {}) as ChartBlockContent;
  const code = typeof content.code === "string" ? content.code : "";
  const isSimulation = Boolean(content.metadata?.isSimulation);
  const customization = content.metadata?.customization;

  const jsx = useMemo(() => normalizeJsx(code), [code]);
  const [labelEditIndex, setLabelEditIndex] = useState<number | null>(null);
  const [colorEditIndex, setColorEditIndex] = useState<number | null>(null);
  const [title, setTitle] = useState(customization?.title ?? content.title ?? "");
  const [rows, setRows] = useState<ChartRow[]>(() => {
    if (customization?.labels && customization?.values) {
      return buildRows(customization.labels, customization.values, customization.colors ?? []);
    }
    const extracted = extractChartData(code);
    return buildRows(extracted.labels, extracted.values, extracted.colors);
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const labelRefs = useRef<Array<HTMLInputElement | null>>([]);
  const chartRef = useRef<any>(null);

  const handleChartElementClick = useCallback((event: unknown, chartInstance: any) => {
    if (!chartInstance) return;
    const nativeEvent = (event as any)?.native ?? event;
    if (!nativeEvent) return;
    const elements = chartInstance.getElementsAtEventForMode(
      nativeEvent,
      "nearest",
      { intersect: true },
      true
    );
    if (!elements || elements.length === 0) return;
    const element = elements[0] as { index?: number };
    if (element.index === undefined) return;
    setColorEditIndex(element.index);
  }, []);

  const chartComponents = useMemo(() => {
    const wrap = (Component: React.ComponentType<any>) =>
      React.forwardRef<any, any>((props, ref) => {
        const { onClick, ...rest } = props;
        return (
          <Component
            ref={(instance: any) => {
              chartRef.current = instance;
              if (typeof ref === "function") ref(instance);
              else if (ref) (ref as React.MutableRefObject<any>).current = instance;
            }}
            {...rest}
            onClick={(event: unknown, elements: any[], chart: unknown) => {
              handleChartElementClick(event, chartRef.current || chart);
              if (typeof onClick === "function") {
                onClick(event, elements, chart);
              }
            }}
          />
        );
      });

    return {
      Bar: wrap(Bar),
      Line: wrap(Line),
      Pie: wrap(Pie),
      Doughnut: wrap(Doughnut),
    } as Record<string, React.ComponentType<any>>;
  }, [handleChartElementClick]);

  useEffect(() => {
    if (customization?.labels && customization?.values) {
      setRows(buildRows(customization.labels, customization.values, customization.colors ?? []));
    } else {
      const extracted = extractChartData(code);
      setRows(buildRows(extracted.labels, extracted.values, extracted.colors));
    }
    setTitle(customization?.title ?? content.title ?? "");
    setLabelEditIndex(null);
    setColorEditIndex(null);
  }, [block.id, code, customization?.labels, customization?.values, customization?.colors, customization?.title, content.title]);

  useEffect(() => {
    if (labelEditIndex === null) return;
    const target = labelRefs.current[labelEditIndex];
    if (target) {
      target.focus();
      target.select();
    }
  }, [labelEditIndex]);

  const persistChanges = async (nextRows: ChartRow[], nextTitle?: string) => {
    setError(null);
    const parsedLabels: string[] = [];
    const parsedValues: number[] = [];
    const parsedColors: string[] = [];

    nextRows.forEach((row) => {
      const label = row.label.trim();
      const numeric = parseNumeric(row.value);
      if (!label && numeric === null) return;
      if (!label || numeric === null) return;
      parsedLabels.push(label);
      parsedValues.push(numeric);
      parsedColors.push(row.color || "#3b82f6");
    });

    if (parsedLabels.length === 0 || parsedValues.length === 0) {
      setError("Add at least one label and value.");
      return;
    }

    setIsSaving(true);
    const result = await updateChartCustomization({
      blockId: block.id,
      title: nextTitle ?? (title.trim() ? title.trim() : null),
      labels: parsedLabels,
      values: parsedValues,
      colors: parsedColors,
    });

    if ("error" in result) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  if (!jsx) {
    return (
      <div className={cn("text-sm text-[var(--muted-foreground)]", className)}>
        Chart unavailable.
      </div>
    );
  }

  return (
    <div className={cn("relative", isSimulation && "rounded-lg ring-1 ring-[var(--warning)]/25", className)}>
      {isSimulation && (
        <div className="absolute right-2 top-2 z-10 rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
          Simulation
        </div>
      )}
      <Dialog open={colorEditIndex !== null} onOpenChange={(open) => !open && setColorEditIndex(null)}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Bar Color</DialogTitle>
          </DialogHeader>
          {colorEditIndex !== null && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--muted-foreground)]">
                  {rows[colorEditIndex]?.label || `Bar ${colorEditIndex + 1}`}
                </span>
                <input
                  type="color"
                  value={rows[colorEditIndex]?.color ?? "#3b82f6"}
                  onChange={(event) => {
                    const next = [...rows];
                    next[colorEditIndex] = { ...next[colorEditIndex], color: event.target.value };
                    setRows(next);
                  }}
                  className="h-9 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
                  aria-label="Pick bar color"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setColorEditIndex(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    persistChanges(rows);
                    setColorEditIndex(null);
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <JsxParser
        jsx={jsx}
        components={chartComponents as any}
        blacklistedTags={["script", "style", "iframe", "object"]}
        blacklistedAttrs={[
          "onClick",
          "onMouseOver",
          "onMouseEnter",
          "onMouseLeave",
          "onMouseMove",
          "onKeyDown",
          "onKeyUp",
          "onSubmit",
          "dangerouslySetInnerHTML",
        ]}
        renderError={(error) => (
          <div className="text-sm text-[var(--error)]">
            Failed to render chart: {String(error)}
          </div>
        )}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row, index) => (
          <div
            key={`chart-label-${index}`}
            className={cn(
              "flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs",
              labelEditIndex === index && "border-[var(--foreground)]/30"
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: row.color || "#3b82f6" }}
            />
            {labelEditIndex === index ? (
              <Input
                value={row.label}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...next[index], label: event.target.value };
                  setRows(next);
                }}
                onBlur={() => {
                  setLabelEditIndex(null);
                  persistChanges(rows);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setLabelEditIndex(null);
                    persistChanges(rows);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setLabelEditIndex(null);
                  }
                }}
                className="h-6 w-24 bg-transparent text-xs"
                ref={(el) => {
                  labelRefs.current[index] = el;
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setLabelEditIndex(index)}
                className="text-xs text-[var(--foreground)] hover:text-[var(--foreground)]"
              >
                {row.label || `Label ${index + 1}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
