"use client";

import { useState, useMemo, useEffect } from "react";
import { useWorkspaceEverything } from "@/lib/hooks/use-everything-queries";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import { useWorkspaceMembers } from "@/lib/hooks/use-property-queries";
import { applyFilters } from "@/lib/everything-filtering";
import { getDueDateEnd } from "@/lib/due-date";
import { EverythingHeader } from "./everything-header";
import { EverythingTableView } from "./everything-table-view";
import { EverythingBoardView } from "./everything-board-view";
import { EverythingFilters } from "./everything-filters";
import type { EverythingViewType, EverythingViewConfig, FilterConfig, SortConfig, GroupByField } from "@/types/everything";

interface EverythingViewProps {
  workspaceId: string;
}

const DEFAULT_SORT: SortConfig = {
  field: "updated_at",
  direction: "desc",
};

const DEFAULT_FILTERS: FilterConfig = {};

export function EverythingView({ workspaceId }: EverythingViewProps) {
  const { setHeaderHidden } = useDashboardHeader();

  // Load view config from localStorage
  const [viewType, setViewType] = useState<EverythingViewType>("table");
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);
  const [groupBy, setGroupBy] = useState<GroupByField>("status");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Hide dashboard header on this page
  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  // Fetch data
  const { data, isLoading, error } = useWorkspaceEverything(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  // Extract unique projects
  const projects = useMemo(() => {
    if (!data) return [];
    const projectMap = new Map<string, { id: string; name: string }>();
    data.items.forEach((item) => {
      if (!projectMap.has(item.source.projectId)) {
        projectMap.set(item.source.projectId, {
          id: item.source.projectId,
          name: item.source.projectName,
        });
      }
    });
    return Array.from(projectMap.values());
  }, [data]);

  // Apply filters and search
  const filteredItems = useMemo(() => {
    if (!data) return [];

    let items = data.items;

    // Apply search
    if (searchQuery.trim()) {
      items = applyFilters(items, { ...filters, searchQuery });
    } else {
      items = applyFilters(items, filters);
    }

    // Apply sort
    items.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sort.field) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "status":
          aVal = a.properties.status || "";
          bVal = b.properties.status || "";
          break;
        case "priority":
          aVal = a.properties.priority || "";
          bVal = b.properties.priority || "";
          break;
        case "due_date":
          aVal = getDueDateEnd(a.properties.due_date) || "";
          bVal = getDueDateEnd(b.properties.due_date) || "";
          break;
        case "created_at":
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        case "updated_at":
          aVal = a.updated_at;
          bVal = b.updated_at;
          break;
        default:
          aVal = a.updated_at;
          bVal = b.updated_at;
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sort.direction === "asc" ? comparison : -comparison;
    });

    return items;
  }, [data, filters, searchQuery, sort]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            Loading everything...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load items</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            No items with properties found in your workspace
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
            Items will appear here when they have status, priority, assignees, due dates, or tags
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <EverythingHeader
        viewType={viewType}
        onViewTypeChange={setViewType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilters(!showFilters)}
        totalCount={data.items.length}
        filteredCount={filteredItems.length}
      />

      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center min-h-[300px] border border-neutral-300 dark:border-neutral-700 rounded-lg">
          <div className="text-center">
            <p className="text-neutral-600 dark:text-neutral-400">
              No items match your filters
            </p>
            <button
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setSearchQuery("");
              }}
              className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
          {viewType === "table" ? (
            <EverythingTableView
              items={filteredItems}
              workspaceId={workspaceId}
              sort={sort}
              onSortChange={setSort}
            />
          ) : (
            <EverythingBoardView
              items={filteredItems}
              workspaceId={workspaceId}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
            />
          )}
        </div>
      )}

      {/* Filter Panel */}
      <EverythingFilters
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        projects={projects}
        members={members || []}
      />
    </div>
  );
}
