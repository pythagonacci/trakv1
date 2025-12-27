"use client";

import { Sigma } from "lucide-react";
import { type TableField, type RollupFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  computedValue?: unknown;
}

export function RollupCell({ field, computedValue }: Props) {
  const config = (field.config || {}) as RollupFieldConfig;
  const aggregation = config.aggregation || "count";

  // Format the rollup value based on aggregation type
  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "0";

    switch (aggregation) {
      case "count":
        return String(val);
      case "sum":
      case "average":
      case "min":
      case "max":
        return typeof val === "number" ? val.toFixed(2) : String(val);
      default:
        return String(val);
    }
  };

  const displayValue = formatValue(computedValue);

  // Get aggregation label
  const getAggregationLabel = (): string => {
    switch (aggregation) {
      case "count": return "Count";
      case "sum": return "Sum";
      case "average": return "Avg";
      case "min": return "Min";
      case "max": return "Max";
      default: return aggregation;
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 w-full text-sm text-[var(--foreground)] min-h-[18px]"
      title={`${getAggregationLabel()} of related records`}
    >
      <Sigma className="h-3 w-3 text-[var(--muted-foreground)] flex-shrink-0" />
      <span className="truncate font-medium">{displayValue}</span>
      <span className="text-xs text-[var(--muted-foreground)]">({getAggregationLabel()})</span>
    </div>
  );
}
