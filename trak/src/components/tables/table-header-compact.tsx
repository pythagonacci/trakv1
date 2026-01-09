"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Filter, ChevronDown, X, Plus } from "lucide-react";
import type { TableView, TableField, FilterCondition, GroupByConfig } from "@/types/table";

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
  onCreateView: () => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onSetDefault: (viewId: string) => void;
  onSwitchView: (viewId: string) => void;
  onUpdateTableTitle?: (title: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  openSearchTick?: number;
  groupBy?: GroupByConfig;
  onGroupByChange: (groupBy: GroupByConfig | undefined) => void;
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

  const activeView = views.find((v) => v.id === activeViewId);

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
    setShowSearch(true);
    // Slight delay to ensure input is in DOM
    setTimeout(() => {
      if (searchInputRef?.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select?.();
      }
    }, 0);
  }, [openSearchTick, searchInputRef]);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--background)] relative z-50">
      {/* Left: Title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {editingTitle ? (
          <input
            className="text-base font-semibold text-[var(--foreground)] bg-[var(--surface)] outline-none border border-[var(--border-strong)] rounded-[2px] px-2 py-1 flex-1 min-w-0"
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
            className="text-base font-semibold text-[var(--foreground)] truncate cursor-pointer hover:text-[var(--primary)] transition-colors duration-150"
            onDoubleClick={() => setEditingTitle(true)}
            onClick={() => setEditingTitle(true)}
            title="Double-click to edit"
          >
            {tableTitle ?? "Untitled Table"}
          </h1>
        )}
      </div>

      {/* Center: Search bar (only when showSearch is true) */}
      {showSearch && (
        <div className="flex items-center gap-2 flex-1 max-w-md mx-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              className="w-full pl-9 pr-3 py-1.5 rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--border-strong)]"
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
              className="w-40 pl-3 pr-3 py-1.5 rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--border-strong)]"
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
        </div>
      )}

      {/* Right: Icons */}
      <div className="flex items-center gap-2">
        {/* Group by */}
        <div className="relative">
          <button
            onClick={() => setShowGroupBy(!showGroupBy)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-colors duration-150 text-xs"
            title="Group by"
          >
            Group {groupBy?.fieldId ? "•" : ""}
          </button>
          {showGroupBy && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-popover z-[200] py-1">
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
                .filter((f) => ["select", "multi_select", "status", "priority", "person"].includes(f.type))
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
                      className={`px-2 py-1 rounded-[2px] border text-[11px] ${
                        (groupBy.sortOrder ?? "asc") === "asc"
                          ? "border-[var(--border-strong)] text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)]"
                      }`}
                      onClick={() => onGroupByChange({ ...groupBy, sortOrder: "asc" })}
                    >
                      A→Z
                    </button>
                    <button
                      className={`px-2 py-1 rounded-[2px] border text-[11px] ${
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
            </div>
          )}
        </div>

        {/* Search icon */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="h-8 w-8 inline-flex items-center justify-center rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors duration-150"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Views dropdown */}
        <div className="relative">
          <button
            ref={viewsButtonRef}
            onClick={() => setShowViews(!showViews)}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-colors duration-150 text-xs"
            title="Views"
          >
            {activeView?.name || "Views"}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showViews && (
            <div 
              ref={viewsDropdownRef}
              className="absolute right-0 top-full mt-1 w-48 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-popover z-[200] py-1"
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
                          className="flex-1 bg-[var(--surface)] border border-[var(--border-strong)] outline-none text-[var(--foreground)] text-xs rounded-[2px] px-1"
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
                  <button
                    className="w-full px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] text-left flex items-center gap-2 transition-colors duration-150"
                    onClick={() => {
                      onCreateView();
                      setShowViews(false);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    New view
                  </button>
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
            className="h-8 w-8 inline-flex items-center justify-center rounded-[2px] bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors duration-150 relative"
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
              className="absolute right-0 top-full mt-1 w-80 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-popover z-[200] p-3"
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
                      <div key={`${f.fieldId}-${idx}`} className="rounded-[2px] bg-[var(--surface-muted)] border border-[var(--border)] p-2">
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
                            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--border-strong)]"
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
                              className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[2px] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--border-strong)] placeholder:text-[var(--tertiary-foreground)]"
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
                className="w-full rounded-[2px] bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--border-strong)]"
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
      {(showViews || showFilters) && (
        <div
          className="fixed inset-0 z-[199]"
          onClick={(e) => {
            // Don't close if clicking inside the dropdown
            if (e.target === e.currentTarget) {
              setShowViews(false);
              setShowFilters(false);
            }
          }}
        />
      )}
    </div>
  );
}
