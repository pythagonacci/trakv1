"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Calculator, Loader2, RotateCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { recomputeFormulasForRow } from "@/app/actions/tables/formula-actions";
import type { TableField } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  rowId: string;
  tableId: string;
}

function formatFormulaValue(value: unknown, returnType?: string) {
  if (value === "#ERROR") return "#ERROR";
  if (value === null || value === undefined || value === "") return "-";
  if (returnType === "number") {
    const num = Number(value);
    return Number.isNaN(num) ? String(value) : num.toLocaleString();
  }
  if (returnType === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (returnType === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

export function FormulaCell({ field, value, rowId, tableId }: Props) {
  const config = (field.config || {}) as Record<string, unknown>;
  const returnType = config.return_type as string | undefined;
  const formula = config.formula as string | undefined;
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const errorMessage =
    typeof value === "string" && value.startsWith("#ERROR")
      ? value.replace(/^#ERROR:?\s*/, "") || "Unable to evaluate formula"
      : null;
  const formatted = errorMessage ? "#ERROR" : formatFormulaValue(value, returnType);
  const isError = Boolean(errorMessage);

  useEffect(() => {
    const checkPosition = () => {
      if (!cellRef.current) return;
      const rect = cellRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const tooltipHeight = 200; // Approximate height
      const spaceBelow = viewportHeight - rect.bottom;
      const showAbove = spaceBelow < tooltipHeight && rect.top > tooltipHeight;
      setTooltipPosition({
        top: showAbove ? rect.top - tooltipHeight - 4 : rect.bottom + 4,
        left: rect.left,
      });
    };

    const handleMouseEnter = () => checkPosition();
    const handleMouseLeave = () => setTooltipPosition(null);

    const cell = cellRef.current;
    if (cell) {
      cell.addEventListener("mouseenter", handleMouseEnter);
      cell.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        cell.removeEventListener("mouseenter", handleMouseEnter);
        cell.removeEventListener("mouseleave", handleMouseLeave);
      };
    }
  }, []);

  const handleRetry = async () => {
    if (!formula) return;
    setRetrying(true);
    try {
      await recomputeFormulasForRow(tableId, rowId, undefined);
    } catch (error) {
      console.error("Formula retry failed:", error);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["tableRows", tableId] });
      setRetrying(false);
    }
  };

  return (
    <div ref={cellRef} className="relative group inline-flex items-center gap-2 text-xs">
      <span className={`${isError ? "text-[var(--error)]" : "text-[var(--foreground)]"} font-mono`}>
        {formatted}
      </span>
      {formula && !isError && (
        <Calculator className="h-3 w-3 text-[var(--muted-foreground)]" />
      )}
      {isError && <AlertTriangle className="h-3 w-3 text-[var(--error)]" />}

      {formula && tooltipPosition && (
        <div
          className="fixed w-64 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--foreground)] shadow-popover z-[9999]"
          style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
        >
          {isError ? (
            <>
              <div className="text-[var(--error)] font-semibold">Formula error</div>
              <div className="text-[var(--muted-foreground)] mt-1">{errorMessage}</div>
              <div className="text-[var(--muted-foreground)] mt-2">
                Formula: <span className="font-mono">{formula}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="mt-2 inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
              >
                {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="text-[var(--muted-foreground)]">Formula</div>
              <div className="font-mono">{formula}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
