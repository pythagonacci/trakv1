"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useWorkspaceEverything } from "@/lib/hooks/use-everything-queries";
import { useDashboardHeader } from "@/app/dashboard/header-visibility-context";
import { useWorkspaceMembers } from "@/lib/hooks/use-property-queries";
import { applyFilters } from "@/lib/everything-filtering";
import { getDueDateEnd } from "@/lib/due-date";
import {
  getSavedViews,
  setSavedViews,
  addSavedView,
  updateSavedView,
  deleteSavedView,
} from "@/lib/everything-saved-views";
import { EverythingHeader } from "./everything-header";
import { EverythingTableView } from "./everything-table-view";
import { EverythingBoardView } from "./everything-board-view";
import { EverythingFilters } from "./everything-filters";
import { SaveViewModal } from "./save-view-modal";
import { ManageViewsModal } from "./manage-views-modal";
import type {
  EverythingViewType,
  EverythingViewConfig,
  FilterConfig,
  SortConfig,
  GroupByField,
  SavedEverythingView,
} from "@/types/everything";

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

  const [viewType, setViewType] = useState<EverythingViewType>("table");
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT);
  const [groupBy, setGroupBy] = useState<GroupByField>("status");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [savedViews, setSavedViews] = useState<SavedEverythingView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [showManageViewsModal, setShowManageViewsModal] = useState(false);

  // Load saved views from localStorage when workspace changes
  useEffect(() => {
    setSavedViews(getSavedViews(workspaceId));
  }, [workspaceId]);

  // Apply saved view config when user selects a view
  useEffect(() => {
    if (!activeViewId) return;
    const view = savedViews.find((v) => v.id === activeViewId);
    if (!view) return;
    const c = view.config;
    setViewType(c.viewType);
    setFilters(c.filters ?? DEFAULT_FILTERS);
    setSort(c.sort ?? DEFAULT_SORT);
    setGroupBy(c.groupBy ?? "status");
    if (c.filters?.searchQuery !== undefined) setSearchQuery(c.filters.searchQuery ?? "");
  }, [activeViewId]); // intentionally not depending on savedViews to avoid re-applying when list refreshes

  // Hide dashboard header on this page
  useEffect(() => {
    setHeaderHidden(true);
    return () => setHeaderHidden(false);
  }, [setHeaderHidden]);

  const handleSaveCurrentView = useCallback(
    (name: string) => {
      const config: EverythingViewConfig = {
        viewType,
        filters: { ...filters, searchQuery: searchQuery || undefined },
        sort,
        groupBy,
      };
      const view = addSavedView(workspaceId, name, config);
      setSavedViews(getSavedViews(workspaceId));
      setActiveViewId(view.id);
    },
    [workspaceId, viewType, filters, searchQuery, sort, groupBy]
  );

  const handleRenameView = useCallback(
    (id: string, newName: string) => {
      updateSavedView(workspaceId, id, { name: newName });
      setSavedViews(getSavedViews(workspaceId));
    },
    [workspaceId]
  );

  const handleDeleteView = useCallback(
    (id: string) => {
      deleteSavedView(workspaceId, id);
      setSavedViews(getSavedViews(workspaceId));
      if (activeViewId === id) setActiveViewId(null);
    },
    [workspaceId, activeViewId]
  );

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
        projects={projects}
        members={members || []}
        filters={filters}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSelectView={setActiveViewId}
        onSaveCurrentView={() => setShowSaveViewModal(true)}
        onManageViews={() => setShowManageViewsModal(true)}
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

      <SaveViewModal
        isOpen={showSaveViewModal}
        onClose={() => setShowSaveViewModal(false)}
        onSave={handleSaveCurrentView}
      />
      <ManageViewsModal
        isOpen={showManageViewsModal}
        onClose={() => setShowManageViewsModal(false)}
        views={savedViews}
        onRename={handleRenameView}
        onDelete={handleDeleteView}
      />
    </div>
  );
}
