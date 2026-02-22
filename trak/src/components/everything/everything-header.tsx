"use client";

import { useState, useRef, useEffect } from "react";
import { Search, LayoutGrid, List, Filter, ChevronDown, Save, Settings2, X } from "lucide-react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";
import type { EverythingViewType, FilterConfig } from "@/types/everything";
import type { SavedEverythingView } from "@/types/everything";

interface ProjectOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  timeline_event: "Timeline Events",
  task: "Tasks",
  subtask: "Subtasks",
  table_row: "Table Rows",
  block: "Blocks",
};

const DUE_DATE_PRESET_LABELS: Record<string, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  next_week: "Next Week",
  this_month: "This Month",
  next_month: "Next Month",
  no_date: "No Date",
};

/** Pill background/border/text classes by status/priority color name (Tailwind safe) */
const PILL_COLOR_CLASSES: Record<string, string> = {
  gray:
    "bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200",
  blue:
    "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-200",
  green:
    "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200",
  red:
    "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200",
  yellow:
    "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/40 dark:border-yellow-700 dark:text-yellow-200",
  orange:
    "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:border-orange-700 dark:text-orange-200",
};

const DEFAULT_PILL_CLASSES =
  "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-200";

interface EverythingHeaderProps {
  viewType: EverythingViewType;
  onViewTypeChange: (viewType: EverythingViewType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterClick: () => void;
  totalCount: number;
  filteredCount: number;
  projects: ProjectOption[];
  members: MemberOption[];
  filters: FilterConfig;
  onFiltersChange: (patch: Partial<FilterConfig>) => void;
  savedViews: SavedEverythingView[];
  activeViewId: string | null;
  onSelectView: (viewId: string | null) => void;
  onSaveCurrentView: () => void;
  onManageViews: () => void;
}

export function EverythingHeader({
  viewType,
  onViewTypeChange,
  searchQuery,
  onSearchChange,
  onFilterClick,
  totalCount,
  filteredCount,
  projects,
  members,
  filters,
  onFiltersChange,
  savedViews,
  activeViewId,
  onSelectView,
  onSaveCurrentView,
  onManageViews,
}: EverythingHeaderProps) {
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setViewDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeView = activeViewId ? savedViews.find((v) => v.id === activeViewId) : null;
  const viewLabel = activeView ? activeView.name : "Default view";

  // Build flat list of active filter pills: { id, label, onRemove, pillClassName? }
  const activeFilterPills: {
    id: string;
    label: string;
    onRemove: () => void;
    pillClassName?: string;
  }[] = [];

  (filters.entityTypes ?? []).forEach((value) => {
    activeFilterPills.push({
      id: `entity-${value}`,
      label: ENTITY_TYPE_LABELS[value] ?? value,
      onRemove: () => {
        const next = (filters.entityTypes ?? []).filter((v) => v !== value);
        onFiltersChange({ entityTypes: next.length ? next : undefined });
      },
    });
  });
  (filters.status ?? []).forEach((value) => {
    const option = STATUS_OPTIONS.find((o) => o.value === value);
    const label = option?.label ?? value;
    activeFilterPills.push({
      id: `status-${value}`,
      label,
      pillClassName: PILL_COLOR_CLASSES[option?.color ?? "gray"] ?? DEFAULT_PILL_CLASSES,
      onRemove: () => {
        const next = (filters.status ?? []).filter((v) => v !== value);
        onFiltersChange({ status: next.length ? next : undefined });
      },
    });
  });
  (filters.priority ?? []).forEach((value) => {
    const option = PRIORITY_OPTIONS.find((o) => o.value === value);
    const label = option?.label ?? value;
    activeFilterPills.push({
      id: `priority-${value}`,
      label,
      pillClassName: PILL_COLOR_CLASSES[option?.color ?? "gray"] ?? DEFAULT_PILL_CLASSES,
      onRemove: () => {
        const next = (filters.priority ?? []).filter((v) => v !== value);
        onFiltersChange({ priority: next.length ? next : undefined });
      },
    });
  });
  (filters.assigneeIds ?? []).forEach((userId) => {
    const member = members.find((m) => (m.user_id ?? m.id) === userId);
    const label = member?.name || member?.email || "Unknown";
    activeFilterPills.push({
      id: `assignee-${userId}`,
      label,
      onRemove: () => {
        const next = (filters.assigneeIds ?? []).filter((id) => id !== userId);
        onFiltersChange({ assigneeIds: next.length ? next : undefined });
      },
    });
  });
  if (filters.dueDatePreset) {
    activeFilterPills.push({
      id: "dueDatePreset",
      label: DUE_DATE_PRESET_LABELS[filters.dueDatePreset] ?? filters.dueDatePreset,
      onRemove: () => onFiltersChange({ dueDatePreset: undefined }),
    });
  }
  (filters.projectIds ?? []).forEach((projectId) => {
    const project = projects.find((p) => p.id === projectId);
    activeFilterPills.push({
      id: `project-${projectId}`,
      label: project?.name ?? "Project",
      onRemove: () => {
        const next = (filters.projectIds ?? []).filter((id) => id !== projectId);
        onFiltersChange({ projectIds: next.length ? next : undefined });
      },
    });
  });
  if (searchQuery.trim()) {
    activeFilterPills.push({
      id: "search",
      label: `Search: "${searchQuery.trim().slice(0, 20)}${searchQuery.trim().length > 20 ? "…" : ""}"`,
      onRemove: () => onSearchChange(""),
    });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-[var(--foreground)]">
            Everything
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {filteredCount === totalCount
              ? `${totalCount} items across your workspace`
              : `${filteredCount} of ${totalCount} items`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Saved view selector */}
          <div className="relative" ref={viewDropdownRef}>
            <button
              type="button"
              onClick={() => setViewDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium min-w-[140px] justify-between"
            >
              <span className="truncate">{viewLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </button>
            {viewDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 w-56 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    onSelectView(null);
                    setViewDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm ${!activeViewId ? "bg-neutral-100 dark:bg-neutral-800 font-medium" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}
                >
                  Default view
                </button>
                {savedViews.length > 0 && (
                  <>
                    <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
                    {savedViews.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          onSelectView(v.id);
                          setViewDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm truncate ${activeViewId === v.id ? "bg-neutral-100 dark:bg-neutral-800 font-medium" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </>
                )}
                <div className="border-t border-neutral-200 dark:border-neutral-700 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onSaveCurrentView();
                    setViewDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-blue-600 dark:text-blue-400"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save current view
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onManageViews();
                    setViewDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage views
                </button>
              </div>
            )}
          </div>

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

      {/* Active filters: all filters as pills with X (add/change via Filters panel) */}
      {activeFilterPills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Filters:</span>
          {activeFilterPills.map((pill) => (
            <span
              key={pill.id}
              className={`inline-flex items-center gap-1 rounded-full text-xs border pl-2 py-0.5 pr-0.5 ${
                pill.pillClassName ?? DEFAULT_PILL_CLASSES
              }`}
            >
              <span className="truncate max-w-[180px]">{pill.label}</span>
              <button
                type="button"
                onClick={pill.onRemove}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-current shrink-0 -mr-0.5"
                aria-label={`Remove ${pill.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

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
