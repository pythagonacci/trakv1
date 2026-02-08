"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getProductUnitsSold } from "@/app/actions/shopify-sales";

interface UnitsSoldWidgetProps {
  productId: string;
}

type DateRange = "7d" | "30d" | "60d" | "custom";

export function UnitsSoldWidget({ productId }: UnitsSoldWidgetProps) {
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dateRange !== "custom") {
      loadData(dateRange);
    }
  }, [dateRange, productId]);

  const getDateRange = (range: DateRange): { start: string; end: string } => {
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
  };

  const loadData = async (range: DateRange) => {
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
  };

  const handleCustomSearch = () => {
    if (customStart && customEnd) {
      loadData("custom");
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Range Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={dateRange === "7d" ? "default" : "outline"}
          onClick={() => setDateRange("7d")}
        >
          Last 7 Days
        </Button>
        <Button
          size="sm"
          variant={dateRange === "30d" ? "default" : "outline"}
          onClick={() => setDateRange("30d")}
        >
          Last 30 Days
        </Button>
        <Button
          size="sm"
          variant={dateRange === "60d" ? "default" : "outline"}
          onClick={() => setDateRange("60d")}
        >
          Last 60 Days
        </Button>
        <Button
          size="sm"
          variant={dateRange === "custom" ? "default" : "outline"}
          onClick={() => setDateRange("custom")}
        >
          Custom Range
        </Button>
      </div>

      {/* Custom Date Range Inputs */}
      {dateRange === "custom" && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm text-gray-600 mb-1 block">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-600 mb-1 block">End Date</label>
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
        <div className="text-center py-8 text-gray-500">Loading sales data...</div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Data Display */}
      {data && !loading && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-900 mb-2">{data.unitsSold}</div>
            <div className="text-sm text-blue-700 font-medium">units sold</div>
            <div className="text-xs text-gray-600 mt-2">
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
        <div className="text-center py-8 text-gray-500 text-sm">
          Select a date range to view sales data
        </div>
      )}
    </div>
  );
}
