"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { AlertTriangle, Info, Loader2, RotateCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { computeRollupValue } from "@/app/actions/tables/rollup-actions";
import { useTable } from "@/lib/hooks/use-table-queries";
import type { TableField } from "@/types/table";

interface Props {
  field: TableField;
  value: unknown;
  rowId: string;
  tableId: string;
  fieldMap?: Record<string, TableField>;
}

function formatRollupValue(value: unknown, aggregation?: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (aggregation && aggregation.includes("percent")) {
    return `${value}%`;
  }
  if (aggregation === "date_range") {
    return `${value} days`;
  }
  if (aggregation && aggregation.includes("date")) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function RollupCell({ field, value, rowId, tableId, fieldMap }: Props) {
  const config = (field.config || {}) as Record<string, unknown>;
  const aggregation = config.aggregation as string | undefined;
  const relationFieldId = (config.relation_field_id as string | undefined) || (config.relationFieldId as string | undefined);
  const targetFieldId = (config.target_field_id as string | undefined) || (config.relatedFieldId as string | undefined);
  const autoComputedRef = useRef(false);
  const relationField = relationFieldId ? fieldMap?.[relationFieldId] : undefined;
  const relationFieldName = relationField?.name ?? relationFieldId ?? "Unknown";
  const relatedTableId = useMemo(() => {
    if (!relationField) return "";
    const relConfig = (relationField.config || {}) as Record<string, unknown>;
    return (relConfig.relation_table_id as string) || (relConfig.linkedTableId as string) || "";
  }, [relationField]);
  const { data: relatedTable } = useTable(relatedTableId);
  const relatedFieldName = targetFieldId
    ? relatedTable?.fields?.find((f) => f.id === targetFieldId)?.name
    : undefined;
  const targetFieldName =
    relatedFieldName ||
    (config.target_field_name as string | undefined) ||
    targetFieldId ||
    "Unknown";
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; showAbove: boolean } | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const errorMessage =
    typeof value === "string" && value.startsWith("#ERROR")
      ? value.replace(/^#ERROR:?\s*/, "") || "Unable to compute rollup"
      : null;
  const effectiveError = errorMessage || runtimeError;
  const isError = Boolean(effectiveError);
  const displayValue = retrying ? "Computing..." : isError ? "#ERROR" : formatRollupValue(value, aggregation);

  useEffect(() => {
    if (autoComputedRef.current) return;
    if (retrying) return;
    if (!relationFieldId || !targetFieldId) return;
    if (value !== null && value !== undefined && value !== "") return;

    autoComputedRef.current = true;
    computeRollupValue(rowId, field.id)
      .then((result) => {
        if ("error" in result) {
          setRuntimeError(result.error || "Unable to compute rollup");
        } else if (result.data?.error) {
          setRuntimeError(result.data.error);
        }
      })
      .catch((error) => {
        console.error("Rollup auto-compute failed:", error);
        setRuntimeError("Unable to compute rollup");
      })
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ["tableRows", tableId] });
      });
  }, [value, relationFieldId, targetFieldId, retrying, rowId, field.id, tableId, queryClient]);

  useEffect(() => {
    const checkPosition = () => {
      if (!cellRef.current) return;
      const rect = cellRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const tooltipHeight = 200; // Approximate tooltip height
      
      // Show above if there's more space above or if we're near the bottom
      const showAbove = spaceBelow < tooltipHeight && spaceAbove > tooltipHeight;
      
      setTooltipPosition({
        top: showAbove ? rect.top - tooltipHeight - 4 : rect.bottom + 4,
        left: rect.left,
        showAbove,
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
    setRetrying(true);
    setRuntimeError(null);
    try {
      const result = await computeRollupValue(rowId, field.id);
      if ("error" in result) {
        setRuntimeError(result.error || "Unable to compute rollup");
      } else if (result.data?.error) {
        setRuntimeError(result.data.error);
      }
    } catch (error) {
      console.error("Rollup retry failed:", error);
      setRuntimeError("Unable to compute rollup");
    } finally {
      queryClient.invalidateQueries({ queryKey: ["tableRows", tableId] });
      setRetrying(false);
    }
  };

  return (
    <div ref={cellRef} className="relative group inline-flex items-center gap-2 text-sm text-[var(--foreground)] font-mono">
      <span className={isError ? "text-[var(--error)]" : "text-[var(--foreground)]"}>{displayValue}</span>
      {retrying && <Loader2 className="h-3 w-3 animate-spin text-[var(--muted-foreground)]" />}
      {!retrying &&
        (isError ? (
          <AlertTriangle className="h-3 w-3 text-[var(--error)]" />
        ) : (
          <Info className="h-3 w-3 text-[var(--muted-foreground)]" />
        ))}
      {tooltipPosition && (
        <div
          ref={tooltipRef}
          className="fixed w-72 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--foreground)] shadow-lg z-[9999]"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
        {isError ? (
          <>
            <div className="text-[var(--error)] font-semibold">Rollup error</div>
            <div className="text-[var(--muted-foreground)] mt-1">{effectiveError}</div>
          </>
        ) : (
          <div className="text-[var(--muted-foreground)]">Rollup details</div>
        )}
        <div className="mt-2 text-[var(--muted-foreground)]">
          Aggregation: <span className="text-[var(--foreground)]">{aggregation || "Unknown"}</span>
        </div>
        <div className="text-[var(--muted-foreground)]">
          Relation: <span className="text-[var(--foreground)]">{relationFieldName}</span>
        </div>
        <div className="text-[var(--muted-foreground)]">
          Target: <span className="text-[var(--foreground)]">{targetFieldName}</span>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="mt-2 inline-flex items-center gap-1 rounded-[2px] border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-60"
        >
          {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
          Retry
        </button>
        </div>
      )}
    </div>
  );
}
