"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getProductUnitsSold, type ProductSalesData } from "@/app/actions/shopify-sales";
import { cn } from "@/lib/utils";

interface UnitsSoldWidgetProps {
  productId: string;
}

type DateRange = "7d" | "30d" | "60d" | "custom";

export function UnitsSoldWidget({ productId }: UnitsSoldWidgetProps) {
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<ProductSalesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = useCallback((range: DateRange): { start: string; end: string } => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "60d":
        start.setDate(end.getDate() - 60);
        break;
      default:
        return { start: customStart, end: customEnd };
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  }, [customEnd, customStart]);

  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);

    const { start, end } = getDateRange(range);

    if (!start || !end) {
      setLoading(false);
      return;
    }

    const result = await getProductUnitsSold(productId, start, end);

    if ("error" in result) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data);
    }

    setLoading(false);
  }, [getDateRange, productId]);

  useEffect(() => {
    if (dateRange !== "custom") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadData(dateRange);
    }
  }, [dateRange, loadData]);

  const handleCustomSearch = () => {
    if (customStart && customEnd) {
      void loadData("custom");
    }
  };

  const rangeOptions: Array<{ value: DateRange; label: string }> = [
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "60d", label: "Last 60 Days" },
    { value: "custom", label: "Custom Range" },
  ];

  return (
    <div className="space-y-4">
      {/* Date Range Buttons */}
      <div className="flex flex-wrap gap-2">
        {rangeOptions.map((option) => {
          const isActive = dateRange === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setDateRange(option.value)}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-[8px] border px-3 text-xs font-medium transition-colors",
                isActive
                  ? "border-[var(--primary)]/20 bg-[var(--primary)]/8 text-[var(--primary)] hover:bg-[var(--primary)]/12"
                  : "border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Range Inputs */}
      {dateRange === "custom" && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm text-[var(--muted-foreground)] mb-1 block">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm text-[var(--muted-foreground)] mb-1 block">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <Button onClick={handleCustomSearch} disabled={!customStart || !customEnd}>
            Search
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-[var(--tertiary-foreground)]">Loading sales data...</div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Data Display */}
      {data && !loading && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[var(--radius-lg)] p-6 border border-blue-100">
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-900 mb-2">{data.unitsSold}</div>
            <div className="text-sm text-blue-700 font-medium">units sold</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-2">
              {data.cached ? (
                <>
                  Cached result from {new Date(data.computedAt).toLocaleString()}
                </>
              ) : (
                <>Computed just now</>
              )}
            </div>
            {data.warning && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                ⚠️ {data.warning}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!data && !loading && !error && (
        <div className="text-center py-8 text-[var(--tertiary-foreground)] text-sm">
          Select a date range to view sales data
        </div>
      )}
    </div>
  );
}
