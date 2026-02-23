"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChartSpec } from "@/lib/charts/chartSpec";
import { applySpecFallbacks } from "@/lib/charts/chartSpec";

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

function Select({ label, id, className, children, ...rest }: SelectProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-xs font-medium text-[var(--muted-foreground)]"
      >
        {label}
      </label>
      <select
        id={inputId}
        className={cn(
          "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]",
          className
        )}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--foreground)]">
      <input
        type="checkbox"
        className="rounded border-[var(--border)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function TextField({ label, value, onChange, placeholder }: TextFieldProps) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
      />
    </div>
  );
}

// ─── ChartConfigPanel ─────────────────────────────────────────────────────────

export interface ChartConfigPanelProps {
  spec: ChartSpec;
  /** All field keys available in the current dataset */
  availableFields: string[];
  /** Numeric fields available for sum measure */
  numericFields?: string[];
  onChange: (spec: ChartSpec) => void;
  onClose?: () => void;
  className?: string;
}

export function ChartConfigPanel({
  spec,
  availableFields,
  numericFields = [],
  onChange,
  onClose,
  className,
}: ChartConfigPanelProps) {
  const update = useCallback(
    (patch: Partial<ChartSpec>) => {
      onChange(applySpecFallbacks({ ...spec, ...patch } as ChartSpec));
    },
    [spec, onChange]
  );

  const hasSeriesCapability =
    spec.chartType === "bar" && availableFields.length > 1;

  const showOrientationPicker =
    spec.chartType === "bar";

  const showPieComposition =
    (spec.chartType === "pie" || spec.chartType === "doughnut") &&
    spec.normalizeTo === "universe";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-md",
        className
      )}
      aria-label="Chart configuration panel"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--foreground)]">Chart Settings</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart settings"
            className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid gap-3">
        {/* Chart type */}
        <Select
          label="Chart type"
          value={spec.chartType}
          onChange={(e) =>
            update({ chartType: e.target.value as ChartSpec["chartType"] })
          }
        >
          <option value="pie">Pie</option>
          <option value="doughnut">Doughnut</option>
          <option value="bar">Bar</option>
        </Select>

        {/* Bar orientation */}
        {showOrientationPicker && (
          <Select
            label="Orientation"
            value={spec.orientation ?? "horizontal"}
            onChange={(e) =>
              update({ orientation: e.target.value as ChartSpec["orientation"] })
            }
          >
            <option value="horizontal">Horizontal</option>
            {spec.series && <option value="vertical">Vertical (multi-series)</option>}
          </Select>
        )}

        {/* Breakdown field */}
        <Select
          label="Breakdown by"
          value={spec.breakdown.field}
          onChange={(e) =>
            update({ breakdown: { ...spec.breakdown, field: e.target.value } })
          }
        >
          {availableFields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </Select>

        {/* Series field (bar only) */}
        {hasSeriesCapability && (
          <Select
            label="Series (optional)"
            value={spec.series?.field ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              update({ series: v ? { field: v } : undefined });
            }}
          >
            <option value="">None (single-series)</option>
            {availableFields
              .filter((f) => f !== spec.breakdown.field)
              .map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
          </Select>
        )}

        {/* Measure */}
        <Select
          label="Measure"
          value={
            spec.measure.type === "count"
              ? "count"
              : `${spec.measure.type}:${(spec.measure as any).field}`
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "count") {
              update({ measure: { type: "count" } });
            } else {
              const [type, field] = v.split(":") as ["sum" | "avg", string];
              update({ measure: { type, field } });
            }
          }}
        >
          <option value="count">Count</option>
          {numericFields.map((f) => (
            <React.Fragment key={f}>
              <option value={`sum:${f}`}>Sum of {f}</option>
              <option value={`avg:${f}`}>Avg of {f}</option>
            </React.Fragment>
          ))}
        </Select>

        {/* Divider */}
        <hr className="border-[var(--border)]" />

        {/* Normalisation */}
        <Select
          label="100% equals"
          value={spec.normalizeTo}
          onChange={(e) =>
            update({ normalizeTo: e.target.value as ChartSpec["normalizeTo"] })
          }
        >
          <option value="focus">Focus data only</option>
          <option value="universe">Universe (full denominator)</option>
        </Select>

        {/* Pie composition — only when universe normalisation */}
        {showPieComposition && (
          <>
            <CheckboxRow
              label='Include "Rest of universe" slice'
              checked={spec.pieComposition === "focusPlusRest"}
              onChange={(v) =>
                update({ pieComposition: v ? "focusPlusRest" : "breakdownOnly" })
              }
            />
            {spec.pieComposition === "focusPlusRest" && (
              <TextField
                label='Remainder slice label'
                value={spec.restLabel}
                onChange={(v) => update({ restLabel: v || "Rest" })}
              />
            )}
          </>
        )}

        {/* Divider */}
        <hr className="border-[var(--border)]" />

        {/* Sort */}
        <Select
          label="Sort"
          value={spec.sort}
          onChange={(e) => update({ sort: e.target.value as ChartSpec["sort"] })}
        >
          <option value="value_desc">Value: high → low</option>
          <option value="value_asc">Value: low → high</option>
          <option value="label_asc">Label: A → Z</option>
          <option value="label_desc">Label: Z → A</option>
        </Select>

        {/* Top N */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Top N categories{spec.topN ? ` (${spec.topN})` : " (all)"}
          </label>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={spec.topN ?? 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ topN: v === 0 ? undefined : v });
            }}
            className="w-full"
            aria-label="Top N categories slider"
          />
        </div>

        {spec.topN !== undefined && (
          <CheckboxRow
            label="Bucket remaining into 'Other'"
            checked={spec.includeOtherBucket}
            onChange={(v) => update({ includeOtherBucket: v })}
          />
        )}

        {spec.topN !== undefined && spec.includeOtherBucket && (
          <TextField
            label="Other bucket label"
            value={spec.otherLabel}
            onChange={(v) => update({ otherLabel: v || "Other" })}
          />
        )}
      </div>
    </div>
  );
}
