"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Filter, ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableView, TableField, FilterCondition, GroupByConfig, ViewType } from "@/types/table";

interface Props {
  tableId: string;
  tableTitle?: string;
  views: TableView[];
  activeViewId?: string;
  fields: TableField[];
  filters: FilterCondition[];
  onSearch?: (q: string) => void;
  onColumnSearch?: (fieldId: string) => void;
  onFiltersChange: (filters: FilterCondition[]) => void;
  onCreateView: (type: ViewType) => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onSetDefault: (viewId: string) => void;
  onSwitchView: (viewId: string) => void;
  onUpdateTableTitle?: (title: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  openSearchTick?: number;
  groupBy?: GroupByConfig;
  onGroupByChange: (groupBy: GroupByConfig | undefined) => void;
  hasDateFields?: boolean;
}

export function TableHeaderCompact({
  tableId,
  tableTitle,
  views,
  activeViewId,
  fields,
  filters,
  onSearch,
  onColumnSearch,
  onFiltersChange,
  onCreateView,
  onRenameView,
  onDeleteView,
  onSetDefault,
  onSwitchView,
  onUpdateTableTitle,
  searchInputRef,
  openSearchTick,
  groupBy,
  onGroupByChange,
  hasDateFields,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [showGroupBy, setShowGroupBy] = useState(false);
  const [editingView, setEditingView] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(tableTitle || "Untitled Table");
  const viewsButtonRef = useRef<HTMLButtonElement>(null);
  const viewsDropdownRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const filtersDropdownRef = useRef<HTMLDivElement>(null);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  const [groupDropdownStyle, setGroupDropdownStyle] = useState<React.CSSProperties | null>(null);
  const prevOpenSearchTickRef = useRef<number | undefined>(openSearchTick);

  const activeView = views.find((v) => v.id === activeViewId);
  const viewLabel = activeView?.is_default ? "Default view" : activeView?.name || "Default view";
  const viewTypeLabel = activeView?.type ? activeView.type.toUpperCase() : "";
  const timelineEnabled = Boolean(hasDateFields);
  const viewTypeOptions: Array<{ type: ViewType; label: string; disabled?: boolean }> = [
    { type: "table", label: "Table" },
    { type: "board", label: "Board" },
    { type: "timeline", label: "Timeline", disabled: !timelineEnabled },
    { type: "list", label: "List" },
    { type: "gallery", label: "Gallery" },
    { type: "calendar", label: "Calendar" },
  ];

  useEffect(() => {
    setDraftTitle(tableTitle || "Untitled Table");
  }, [tableTitle]);

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== tableTitle && onUpdateTableTitle) {
      onUpdateTableTitle(trimmed);
    } else if (!trimmed) {
      setDraftTitle(tableTitle || "Untitled Table");
    }
    setEditingTitle(false);
  };

  // Removed views positioning useEffect - using absolute positioning instead

  // Removed filters positioning useEffect - using absolute positioning instead
  useEffect(() => {
    if (!showGroupBy) return;
    const updatePosition = () => {
      const anchor = groupButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 224;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const maxHeight = 320;
      const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
      const height = Math.min(maxHeight, openUpward ? spaceAbove : spaceBelow);
      const top = openUpward ? rect.top - height : rect.bottom;
      const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
      setGroupDropdownStyle({
        position: "fixed",
        top,
        left,
        width,
        maxHeight: Math.max(160, height),
        zIndex: 200,
      });
    };

    updatePosition();
    const handleScroll = () => requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [showGroupBy]);

  const addFilter = (fieldId: string) => {
    const next: FilterCondition = {
      fieldId,
      operator: "contains",
      value: "",
    };
    onFiltersChange([...filters, next]);
  };

  // Open search bar when requested externally (e.g., Cmd/Ctrl+F hotkey)
  useEffect(() => {
    if (openSearchTick === undefined) return;
    // Only open search if tick actually increased (not on initial mount)
    if (prevOpenSearchTickRef.current !== undefined && openSearchTick > prevOpenSearchTickRef.current) {
      setShowSearch(true);
      // Slight delay to ensure input is in DOM
      setTimeout(() => {
        if (searchInputRef?.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select?.();
        }
      }, 0);
    }
    prevOpenSearchTickRef.current = openSearchTick;
  }, [openSearchTick, searchInputRef]);

  return (
    <div className="flex items-center justify-between gap-2 relative z-50">
      {/* Left: Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {editingTitle ? (
          <input
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setDraftTitle(tableTitle || "Untitled Table");
                setEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <h1
            className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)] truncate cursor-text"
            onDoubleClick={() => setEditingTitle(true)}
            onClick={() => setEditingTitle(true)}
            title="Double-click to edit"
          >
            {tableTitle ?? "Untitled Table"}
          </h1>
        )}
        {views.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-0.5 overflow-x-auto max-w-[420px]">
            {views.map((view) => {
              const isActive = view.id === activeViewId;
              const groupFieldId = view.config?.groupBy?.fieldId;
              const groupField = groupFieldId ? fields.find((f) => f.id === groupFieldId) : undefined;
              const groupLabel = groupField ? groupField.name : "Group";
              const tabMeta =
                view.type === "board" && groupField
                  ? `Board • ${groupLabel}`
                  : view.type === "timeline"
                  ? "Timeline"
                  : view.type === "table"
                  ? "Table"
                  : view.type;
              return (
                <div
                  key={view.id}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 transition-colors duration-150",
                    isActive
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  )}
                  title={tabMeta}
                >
                  <button
                    onClick={() => onSwitchView(view.id)}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-[10px] font-medium">{view.name}</span>
                    {view.type === "board" && groupField && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                        {groupLabel}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteView(view.id);
                    }}
                    className={cn(
                      "text-[10px] opacity-0 group-hover:opacity-100 transition",
                      isActive
                        ? "text-[var(--background)]/70 hover:text-[var(--background)]"
                        : "text-[var(--muted-foreground)] hover:text-[var(--error)]"
                    )}
                    title="Delete view"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Center: Search bar (only when showSearch is true) */}
      {showSearch && (
        <div className="flex items-center gap-2 flex-1 max-w-md mx-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              className="w-full pl-9 pr-3 py-1.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--border-strong)]"
              placeholder="Search table..."
              value={search}
              ref={searchInputRef}
              onChange={(e) => {
                const q = e.target.value;
                setSearch(q);
                onSearch?.(q);
              }}
            />
          </div>
          <div className="relative">
            <input
              className="w-40 pl-3 pr-3 py-1.5 rounded-[6px] bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--border-strong)]"
              placeholder="Jump to column..."
              value={columnSearch}
              onChange={(e) => {
                setColumnSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && columnSearch && onColumnSearch) {
                  const matchingField = fields.find((f) =>
                    f.name.toLowerCase().includes(columnSearch.toLowerCase())
                  );
                  if (matchingField) {
                    onColumnSearch(matchingField.id);
                  }
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              setShowSearch(false);
              setSearch("");
              setColumnSearch("");
              onSearch?.("");
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Right: Icons */}
      <div className="flex items-center gap-2">
        {/* Group by */}
        <div className="relative">
          <button
            ref={groupButtonRef}
            onClick={() => setShowGroupBy(!showGroupBy)}
            className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Group by"
          >
            Group {groupBy?.fieldId ? "•" : ""}
          </button>
          {showGroupBy &&
            groupDropdownStyle &&
            createPortal(
              <div
                ref={groupDropdownRef}
                style={groupDropdownStyle}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-popover py-1 overflow-y-auto"
              >
                <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Group by</div>
                <button
                  onClick={() => {
                    onGroupByChange(undefined);
                    setShowGroupBy(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)] ${!groupBy ? "bg-[var(--surface-muted)]" : ""}`}
                >
                  None
                </button>
                <div className="mt-1 border-t border-[var(--border)]" />
                {fields
                  .filter((f) => ["select", "multi_select", "status", "priority", "person", "checkbox", "subtask"].includes(f.type))
                  .map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onGroupByChange({ fieldId: f.id, showEmptyGroups: groupBy?.showEmptyGroups ?? true, sortOrder: groupBy?.sortOrder ?? "asc" });
                        setShowGroupBy(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)] ${groupBy?.fieldId === f.id ? "bg-[var(--surface-muted)]" : ""}`}
                    >
                      {f.name}
                    </button>
                  ))}
                {groupBy?.fieldId && (
                  <div className="mt-2 border-t border-[var(--border)] pt-2 space-y-2 px-3">
                    <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={groupBy.showEmptyGroups ?? true}
                        onChange={(e) =>
                          onGroupByChange({
                            ...groupBy,
                            showEmptyGroups: e.target.checked,
                          })
                        }
                      />
                      Show empty groups
                    </label>
                    <div className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                      <span className="text-[var(--muted-foreground)]">Group order</span>
                      <button
                        className={`px-2 py-1 rounded-[4px] border text-[11px] ${
                          (groupBy.sortOrder ?? "asc") === "asc"
                            ? "border-[var(--border-strong)] text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                        onClick={() => onGroupByChange({ ...groupBy, sortOrder: "asc" })}
                      >
                        A→Z
                      </button>
                      <button
                        className={`px-2 py-1 rounded-[4px] border text-[11px] ${
                          groupBy.sortOrder === "desc"
                            ? "border-[var(--border-strong)] text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                        onClick={() => onGroupByChange({ ...groupBy, sortOrder: "desc" })}
                      >
                        Z→A
                      </button>
                    </div>
                  </div>
                )}
              </div>,
              document.body
            )}
        </div>

        {/* Search icon */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Views dropdown */}
        <div className="relative">
          <button
            ref={viewsButtonRef}
            onClick={() => setShowViews(!showViews)}
            className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Views"
          >
            <span>{viewLabel}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showViews && (
            <div 
              ref={viewsDropdownRef}
              className="absolute right-0 top-full mt-1 w-48 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-popover z-[200] py-1"
            >
                {views.map((view) => (
                  <div
                    key={view.id}
                    className="px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] cursor-pointer flex items-center justify-between group"
                    onClick={() => {
                      onSwitchView(view.id);
                      setShowViews(false);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {editingView === view.id ? (
                        <input
                          className="flex-1 bg-[var(--surface)] border border-[var(--border-strong)] outline-none text-[var(--foreground)] text-xs rounded-[4px] px-1"
                          defaultValue={view.name}
                          onBlur={(e) => {
                            setEditingView(null);
                            if (e.target.value && e.target.value !== view.name) {
                              onRenameView(view.id, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="truncate"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingView(view.id);
                          }}
                        >
                          {view.name}
                        </span>
                      )}
                      {view.is_default && <span className="text-[10px] text-[var(--dome-teal)]">★</span>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                      {view.type}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetDefault(view.id);
                        }}
                        title="Set default"
                      >
                        ☆
                      </button>
                      <button
                        className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--error)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        title="Delete view"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-[var(--border)] mt-1 pt-1">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                    New view
                  </div>
                  {viewTypeOptions.map((option) => (
                    <button
                      key={option.type}
                      disabled={option.disabled}
                      className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      onClick={() => {
                        onCreateView(option.type);
                        setShowViews(false);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      {option.label}
                      {option.type === "timeline" && !timelineEnabled && (
                        <span className="ml-auto text-[10px] text-[var(--tertiary-foreground)]">Needs date field</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
          )}
        </div>

        {/* Filters button */}
        <div className="relative">
          <button
            ref={filtersButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowFilters(!showFilters);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] relative"
            title="Filters"
          >
            <Filter className="h-4 w-4" />
            {filters.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--dome-teal)] text-[10px] text-[var(--success-foreground)] flex items-center justify-center">
                {filters.length}
              </span>
            )}
          </button>
          {showFilters && (
            <div 
              ref={filtersDropdownRef}
              className="absolute right-0 top-full mt-1 w-80 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-popover z-[200] p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--foreground)]">Filters</span>
                <button
                  onClick={() => onFiltersChange([])}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150"
                >
                  Clear all
                </button>
              </div>
              {filters.length > 0 && (
                <div className="space-y-2 mb-3">
                  {filters.map((f, idx) => {
                    const field = fields.find((fld) => fld.id === f.fieldId);
                    return (
                      <div key={`${f.fieldId}-${idx}`} className="rounded-[6px] bg-[var(--surface)] border border-[var(--border)] p-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-xs font-medium text-[var(--foreground)]">{field?.name ?? "Field"}</div>
                          <button
                            className="text-[var(--muted-foreground)] hover:text-[var(--error)] transition-colors duration-150"
                            onClick={() => {
                              const next = filters.filter((_, i) => i !== idx);
                              onFiltersChange(next);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--border-strong)]"
                            value={f.operator}
                            onChange={(e) => {
                              const next = [...filters];
                              next[idx] = { ...f, operator: e.target.value as FilterCondition["operator"] };
                              onFiltersChange(next);
                            }}
                          >
                            <option value="contains">contains</option>
                            <option value="equals">is</option>
                            <option value="not_equals">is not</option>
                            <option value="is_empty">is empty</option>
                            <option value="is_not_empty">is not empty</option>
                          </select>
                          {f.operator !== "is_empty" && f.operator !== "is_not_empty" && (
                            <input
                              className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--border-strong)] placeholder:text-[var(--tertiary-foreground)]"
                              value={String(f.value ?? "")}
                              onChange={(e) => {
                                const next = [...filters];
                                next[idx] = { ...f, value: e.target.value };
                                onFiltersChange(next);
                              }}
                              placeholder="Value"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <select
                className="w-full rounded-[6px] bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--border-strong)]"
                onChange={(e) => {
                  if (!e.target.value) return;
                  addFilter(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="">Add filter</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showViews || showFilters || showGroupBy) && (
        <div
          className="fixed inset-0 z-[199]"
          onClick={(e) => {
            // Don't close if clicking inside the dropdown
            if (e.target === e.currentTarget) {
              setShowViews(false);
              setShowFilters(false);
              setShowGroupBy(false);
            }
          }}
        />
      )}
    </div>
  );
}
