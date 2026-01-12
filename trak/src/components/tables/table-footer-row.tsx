"use client";

import { useMemo } from "react";
import type { CalculationType, TableField, TableRow } from "@/types/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  fields: TableField[];
  rows: TableRow[];
  calculations: Record<string, CalculationType | undefined>;
  columnTemplate: string;
  pinnedFields?: string[];
  widths?: Record<string, number>;
  selectionWidth?: number;
  onUpdateCalculation: (fieldId: string, calc: CalculationType | null) => void;
}

function availableCalculations(type: string): CalculationType[] {
  switch (type) {
    case "number":
      return ["sum", "average", "median", "min", "max", "range"];
    case "checkbox":
      return ["checked", "unchecked", "percent_checked"];
    case "text":
    case "long_text":
    case "url":
    case "email":
      return ["count_values", "count_empty", "count_unique"];
    case "select":
    case "multi_select":
    case "status":
    case "priority":
      return ["count_values", "count_unique"];
    default:
      return ["count_all", "count_values"];
  }
}

function calculateValue(values: unknown[], type: CalculationType) {
  const cleanValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericValues = cleanValues
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => !Number.isNaN(v));

  switch (type) {
    case "sum":
      return numericValues.reduce((sum, v) => sum + v, 0);
    case "average":
      return numericValues.length ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length : 0;
    case "median": {
      if (!numericValues.length) return 0;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    case "min":
      return numericValues.length ? Math.min(...numericValues) : null;
    case "max":
      return numericValues.length ? Math.max(...numericValues) : null;
    case "range":
      return numericValues.length ? Math.max(...numericValues) - Math.min(...numericValues) : null;
    case "count_all":
      return values.length;
    case "count_values":
      return cleanValues.length;
    case "count_empty":
      return values.length - cleanValues.length;
    case "count_unique":
      return new Set(cleanValues.map((v) => JSON.stringify(v))).size;
    case "percent_empty": {
      const empty = values.length - cleanValues.length;
      return values.length ? Math.round((empty / values.length) * 100) : 0;
    }
    case "percent_filled": {
      return values.length ? Math.round((cleanValues.length / values.length) * 100) : 0;
    }
    case "checked": {
      return values.filter((v) => v === true).length;
    }
    case "unchecked": {
      return values.filter((v) => v === false || v === null || v === undefined).length;
    }
    case "percent_checked": {
      const checked = values.filter((v) => v === true).length;
      return values.length ? Math.round((checked / values.length) * 100) : 0;
    }
    default:
      return null;
  }
}

function formatCalcValue(value: unknown, fieldType: string, calcType?: CalculationType) {
  if (value === null || value === undefined) return "-";
  if (calcType && calcType.includes("percent")) return `${value}%`;
  if (fieldType === "number" && typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function TableFooterRow({
  fields,
  rows,
  calculations,
  columnTemplate,
  pinnedFields = [],
  widths,
  selectionWidth = 0,
  onUpdateCalculation,
}: Props) {
  const values = useMemo(() => {
    const result: Record<string, unknown> = {};
    fields.forEach((field) => {
      const calc = calculations[field.id];
      if (!calc) return;
      const columnValues = rows.map((row) => row.data?.[field.id]);
      result[field.id] = calculateValue(columnValues, calc);
    });
    return result;
  }, [fields, rows, calculations]);

  const pinnedOffsets = useMemo(() => {
    let acc = selectionWidth;
    const offsets: Record<string, number> = {};
    fields.forEach((f) => {
      offsets[f.id] = acc;
      acc += widths?.[f.id] ?? f.width ?? 180;
    });
    return offsets;
  }, [fields, widths, selectionWidth]);

  return (
    <div className="sticky bottom-0 z-10 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="grid w-full" style={{ gridTemplateColumns: columnTemplate }}>
        <div className="border-r border-[var(--border)] bg-[var(--surface-muted)] sticky left-0 z-20" />
        {fields.map((field) => {
          const calc = calculations[field.id];
          const value = calc ? values[field.id] : null;
          const options = availableCalculations(field.type);
          const isPinned = pinnedFields.includes(field.id);
          return (
            <div
              key={field.id}
              className={`px-3 py-2 border-r border-[var(--border)] text-xs text-[var(--muted-foreground)] flex items-center gap-2 ${isPinned ? "sticky z-20 bg-[var(--surface)]" : ""}`}
              style={isPinned ? { left: `${pinnedOffsets[field.id]}px` } : {}}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-[2px] border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
                    {calc ? calc.replace(/_/g, " ") : "Calculate"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <DropdownMenuItem onSelect={() => onUpdateCalculation(field.id, null)}>
                    None
                  </DropdownMenuItem>
                  {options.map((opt) => (
                    <DropdownMenuItem key={opt} onSelect={() => onUpdateCalculation(field.id, opt)}>
                      {opt.replace(/_/g, " ")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {calc && (
                <span className="text-[var(--foreground)] font-mono text-xs">
                  {formatCalcValue(value, field.type, calc)}
                </span>
              )}
            </div>
          );
        })}
        <div className="border-l border-[var(--border)] bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}
