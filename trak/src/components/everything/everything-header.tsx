"use client";

import { Search, LayoutGrid, List, Filter } from "lucide-react";
import type { EverythingViewType } from "@/types/everything";

interface EverythingHeaderProps {
  viewType: EverythingViewType;
  onViewTypeChange: (viewType: EverythingViewType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterClick: () => void;
  totalCount: number;
  filteredCount: number;
}

export function EverythingHeader({
  viewType,
  onViewTypeChange,
  searchQuery,
  onSearchChange,
  onFilterClick,
  totalCount,
  filteredCount,
}: EverythingHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Everything
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {filteredCount === totalCount
              ? `${totalCount} items across your workspace`
              : `${filteredCount} of ${totalCount} items`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Type Toggle */}
          <div className="flex items-center rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
            <button
              onClick={() => onViewTypeChange("table")}
              className={`p-2 ${
                viewType === "table"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewTypeChange("board")}
              className={`p-2 ${
                viewType === "board"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
              title="Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={onFilterClick}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
        </button>
      </div>
    </div>
  );
}
