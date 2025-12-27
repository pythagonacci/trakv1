"use client";

import { Calculator } from "lucide-react";
import { type TableField, type FormulaFieldConfig } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  computedValue?: unknown;
}

export function FormulaCell({ field, computedValue }: Props) {
  const config = (field.config || {}) as FormulaFieldConfig;
  const formula = config.formula || "";
  const resultType = config.resultType || "text";

  // Format the computed value based on result type
  const formatResult = (val: unknown): string => {
    if (val === null || val === undefined) return "";

    switch (resultType) {
      case "number":
        return typeof val === "number" ? val.toFixed(2) : String(val);
      case "date":
        return typeof val === "string" || val instanceof Date
          ? new Date(val).toLocaleDateString()
          : String(val);
      case "checkbox":
        return val ? "✓" : "✗";
      default:
        return String(val);
    }
  };

  const displayValue = formatResult(computedValue);

  return (
    <div
      className="flex items-center gap-1.5 w-full text-sm text-[var(--foreground)] min-h-[18px]"
      title={`Formula: ${formula}`}
    >
      <Calculator className="h-3 w-3 text-[var(--muted-foreground)] flex-shrink-0" />
      <span className="truncate">{displayValue || <span className="text-[var(--muted-foreground)]">No result</span>}</span>
    </div>
  );
}
