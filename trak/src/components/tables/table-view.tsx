"use client";

// Table refactor baseline (Sept 2024):
// - Uses new Supabase-backed schema (tables/table_fields/table_rows/table_views) and React Query hooks in src/lib/hooks/use-table-queries.ts.
// - Only table view is implemented here; other view types (board/list/gallery/calendar) intentionally omitted per scope.

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Plus, EyeOff, Eye } from "lucide-react";
import {
  useTable,
  useTableRows,
  useCreateRow,
  useUpdateCell,
  useUpdateView,
  useUpdateTable,
  useCreateField,
  useUpdateField,
  useDeleteField,
  useReorderFields,
  useSearchTableRows,
  useTableViews,
  useCreateView,
  useDeleteView,
  useSetDefaultView,
} from "@/lib/hooks/use-table-queries";
import { TableHeaderRow } from "./table-header-row";
import { TableRow } from "./table-row";
import { TableHeaderCompact } from "./table-header-compact";
import { RowComments } from "./comments/row-comments";
import { ColumnDetailPanel } from "./column-detail-panel";
import { TableContextMenu } from "./table-context-menu";
import type { SortCondition, FilterCondition, FieldType, ViewConfig, GroupByConfig, TableField } from "@/types/table";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { groupRows, canGroupByField, GroupedData } from "@/lib/table-grouping";
import { GroupHeader } from "./group-header";

const isFocusableElement = (el: HTMLElement | null) => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  const focusableTags = ["input", "textarea", "select", "button"];
  if (focusableTags.includes(tag)) return true;
  const contentEditable = (el as HTMLElement).getAttribute("contenteditable");
  return contentEditable === "true";
};

interface Props {
  tableId: string;
}

export function TableView({ tableId }: Props) {
  const { data: tableData, isLoading: metaLoading } = useTable(tableId);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [commentsRowId, setCommentsRowId] = useState<string | null>(null);
  const [detailColumnId, setDetailColumnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "cell" | "column"; rowId?: string; fieldId?: string } | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingWidths, setPendingWidths] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [openSearchTick, setOpenSearchTick] = useState(0);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  // Fetch workspace members for person fields
  const { data: workspaceMembers } = useQuery({
    queryKey: ['workspaceMembers', tableData?.table.workspace_id],
    queryFn: async () => {
      if (!tableData?.table.workspace_id) return [];
      const result = await getWorkspaceMembers(tableData.table.workspace_id);
      if ('error' in result) return [];
      return result.data || [];
    },
    enabled: !!tableData?.table.workspace_id,
    staleTime: 5 * 60 * 1000, // 5 minutes - workspace members don't change often
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Always use a single source of truth for view id to keep query keys aligned
  const { data: rowData, isLoading: rowsLoading } = useTableRows(tableId, activeViewId || undefined);
  const view = rowData?.view;
  const effectiveViewId = activeViewId || view?.id || undefined;

  const createRow = useCreateRow(tableId, effectiveViewId);
  const updateCell = useUpdateCell(tableId, effectiveViewId);
  const updateView = useUpdateView(tableId, effectiveViewId || "");
  const updateTable = useUpdateTable(tableId);
  const createField = useCreateField(tableId);
  const updateField = useUpdateField(tableId);
  const deleteField = useDeleteField(tableId);
  const reorderFields = useReorderFields(tableId);
  const [search, setSearch] = useState("");
  const searchResult = useSearchTableRows(tableId, search);
  const { data: views } = useTableViews(tableId);
  const createView = useCreateView(tableId);
  const deleteView = useDeleteView(tableId);
  const setDefaultView = useSetDefaultView(tableId);

  const allFields = useMemo(() => tableData?.fields ?? [], [tableData]);
  const hiddenFields = useMemo(() => view?.config?.hiddenFields ?? [], [view?.config?.hiddenFields]);
  const pinnedFields = useMemo(() => view?.config?.pinnedFields ?? [], [view?.config?.pinnedFields]);
  
  // Order fields: pinned first, then others
  const fields = useMemo(() => {
    const visible = allFields.filter((f) => !hiddenFields.includes(f.id));
    const pinned = visible.filter((f) => pinnedFields.includes(f.id));
    const unpinned = visible.filter((f) => !pinnedFields.includes(f.id));
    return [...pinned, ...unpinned];
  }, [allFields, pinnedFields, hiddenFields]);
  
  const getWidthForField = useCallback(
    (fieldId: string) => {
      if (pendingWidths[fieldId]) return pendingWidths[fieldId];
      const f = allFields.find((fld) => fld.id === fieldId);
      return f?.width || 180;
    },
    [pendingWidths, allFields]
  );
  
  const columnTemplate = useMemo(() => {
    if (!fields.length) return "1fr 40px";
    // Use explicit widths per field; append thin add-column slot
    const base = fields.map((f) => `${getWidthForField(f.id)}px`).join(" ");
    return `${base} 40px`;
  }, [fields, getWidthForField]);

  const widthMap = useMemo(() => {
    const acc: Record<string, number> = {};
    fields.forEach((f) => {
      acc[f.id] = getWidthForField(f.id);
    });
    return acc;
  }, [fields, getWidthForField]);
  const rows = search ? (searchResult.data ?? []) : (rowData?.rows ?? []);

  const [sorts, setSorts] = useState<SortCondition[]>(view?.config?.sorts || []);
  const [filters, setFilters] = useState<FilterCondition[]>(view?.config?.filters || []);
  const [savingRows] = useState<Set<string>>(new Set());

  const persistViewConfig = (nextSorts: SortCondition[], nextFilters: FilterCondition[], nextPinnedFields?: string[]) => {
    if (!view?.id) return;
    const nextConfig: ViewConfig = {
      ...(view.config || {}),
      sorts: nextSorts,
      filters: nextFilters,
      ...(nextPinnedFields !== undefined && { pinnedFields: nextPinnedFields }),
    };
    updateView.mutate({ config: nextConfig });
  };

  const persistGroupByConfig = (groupBy: GroupByConfig | undefined) => {
    if (!view?.id) return;
    const nextConfig: ViewConfig = {
      ...(view.config || {}),
      groupBy,
    };
    updateView.mutate({ config: nextConfig });
  };

  const handlePinColumn = (fieldId: string) => {
    const isPinned = pinnedFields.includes(fieldId);
    const nextPinned = isPinned
      ? pinnedFields.filter((id) => id !== fieldId)
      : [...pinnedFields, fieldId];
    persistViewConfig(sorts, filters, nextPinned);
  };

  const handleColumnSearch = (fieldId: string) => {
    const element = columnRefs.current[fieldId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  // Rows arrive filtered/sorted from the server based on view config
  const sortedRows = rows || [];
  const groupByConfig = view?.config?.groupBy;
  const groupByField = groupByConfig
    ? fields.find((f) => f.id === groupByConfig.fieldId)
    : undefined;

  const groupedData = useMemo(() => {
    if (!groupByField || !groupByConfig) {
      return { grouped: false as const, rows: sortedRows };
    }
    if (!canGroupByField(groupByField.type)) {
      return { grouped: false as const, rows: sortedRows };
    }
    const groups = groupRows(sortedRows, groupByField, collapsedGroups, {
      members: workspaceMembers,
      showEmptyGroups: groupByConfig.showEmptyGroups ?? true,
      sortOrder: groupByConfig.sortOrder,
    });
    return { grouped: true as const, groups };
  }, [sortedRows, groupByField, groupByConfig, collapsedGroups, workspaceMembers]);

  const handleCellChange = (rowId: string, fieldId: string, value: unknown) => {
    savingRows.add(rowId);
    updateCell.mutate(
      { rowId, fieldId, value },
      {
        onSuccess: () => {
          savingRows.delete(rowId);
        },
        onError: (err) => {
          console.error("Cell update error:", err);
          savingRows.delete(rowId);
          setError(err instanceof Error ? err.message : "Failed to save cell");
        },
        onSettled: () => {
          savingRows.delete(rowId);
        },
      }
    );
  };

  const handleAddField = useCallback(() => {
    setError(null);
    createField.mutate({ name: "New Field", type: "text" }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to add field"),
    });
  }, [createField]);

  const handleRenameField = useCallback((fieldId: string, name: string) => {
    const target = fields.find((f) => f.id === fieldId);
    if (!target || target.name === name) return;
    setError(null);
    updateField.mutate({ id: fieldId, updates: { name } }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to rename field"),
    });
  }, [fields, updateField]);

  const handleDeleteField = useCallback((fieldId: string) => {
    // prevent deleting last field
    if (fields.length <= 1) return;
    setError(null);
    deleteField.mutate(fieldId, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to delete field"),
    });
  }, [fields.length, deleteField]);

  const getDefaultConfig = (type: FieldType) => {
    switch (type) {
      case "status":
        return {
          options: [
            { id: "status_1", label: "Not Started", color: "#6b7280" },
            { id: "status_2", label: "In Progress", color: "#3b82f6" },
            { id: "status_3", label: "Completed", color: "#10b981" },
            { id: "status_4", label: "Blocked", color: "#ef4444" },
          ],
        };
      case "priority":
        return {
          levels: [
            { id: "pri_1", label: "Critical", color: "#ef4444", order: 4 },
            { id: "pri_2", label: "High", color: "#f59e0b", order: 3 },
            { id: "pri_3", label: "Medium", color: "#3b82f6", order: 2 },
            { id: "pri_4", label: "Low", color: "#6b7280", order: 1 },
          ],
        };
      default:
        return {};
    }
  };

  const handleChangeType = useCallback((fieldId: string, type: string) => {
    const target = fields.find((f) => f.id === fieldId);
    if (!target || target.type === type) return;
    setError(null);

    const config = getDefaultConfig(type as FieldType);
    const updates: Partial<TableField> = { type: type as FieldType };

    // Only set config if this type needs default config
    if (Object.keys(config).length > 0) {
      updates.config = config;
    }

    updateField.mutate({ id: fieldId, updates }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to change field type"),
    });
  }, [fields, updateField]);

  const handleUpdateFieldConfig = useCallback((fieldId: string, config: any) => {
    setError(null);
    updateField.mutate({ id: fieldId, updates: { config } }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to update field config"),
    });
  }, [updateField]);

  const handleReorderField = (fieldId: string, direction: "left" | "right") => {
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx === -1) return;
    const swapWith = direction === "left" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= fields.length) return;
    const newOrder = [...fields];
    [newOrder[idx], newOrder[swapWith]] = [newOrder[swapWith], newOrder[idx]];
    const payload = newOrder.map((f, i) => ({ fieldId: f.id, order: i + 1 }));
    setError(null);
    reorderFields.mutate(payload, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to reorder fields"),
    });
  };

  const handleSetSort = (fieldId: string, direction: "asc" | "desc" | null) => {
    const next = direction ? [{ fieldId, direction }] : [];
    setSorts(next);
    persistViewConfig(next, filters);
  };

const handleGroupByChange = (groupBy: GroupByConfig | undefined) => {
    setCollapsedGroups([]);
    persistGroupByConfig(groupBy);
  };

  const handleToggleGroup = (groupId: string) => {
    if (!groupByConfig) return;
    setCollapsedGroups((prev) => {
      const next = prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      persistGroupByConfig({ ...groupByConfig, collapsed: next });
      return next;
    });
  };

  const handleResizeWidth = useCallback((fieldId: string, width: number, persist: boolean) => {
    setPendingWidths((prev) => ({ ...prev, [fieldId]: width }));
    if (persist) {
      const target = allFields.find((f) => f.id === fieldId);
      if (!target || target.width === width) return;
      updateField.mutate({ id: fieldId, updates: { width } }, {
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to resize column"),
      });
    }
  }, [allFields, updateField]);

  const handleHideField = (fieldId: string) => {
    if (!view?.id) return;
    if (fields.length <= 1) return; // avoid hiding last visible column
    const nextHidden = Array.from(new Set([...(view.config?.hiddenFields ?? []), fieldId]));
    const nextConfig: ViewConfig = { ...(view.config || {}), hiddenFields: nextHidden };
    updateView.mutate({ config: nextConfig });
  };

  const handleShowField = (fieldId: string) => {
    if (!view?.id) return;
    const nextHidden = (view.config?.hiddenFields ?? []).filter((id) => id !== fieldId);
    const nextConfig: ViewConfig = { ...(view.config || {}), hiddenFields: nextHidden };
    updateView.mutate({ config: nextConfig });
  };

  const hiddenFieldList = useMemo(
    () => hiddenFields.map((id) => allFields.find((f) => f.id === id)).filter(Boolean),
    [hiddenFields, allFields]
  );

  const handleCellContextMenu = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "cell", rowId });
  };

  const handleColumnContextMenu = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "column", fieldId });
  };

  const handleAddRowAbove = () => {
    if (!contextMenu?.rowId || !rowData?.rows) return;
    
    const targetRow = rowData.rows.find(r => r.id === contextMenu.rowId);
    if (!targetRow) return;

    const targetOrder = typeof targetRow.order === 'number' ? targetRow.order : parseFloat(String(targetRow.order || 0));
    const newOrder = targetOrder - 0.5;

    setError(null);
    createRow.mutate({ data: {}, order: newOrder }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to add row"),
    });
    setContextMenu(null);
  };

  const handleAddRowBelow = () => {
    if (!contextMenu?.rowId || !rowData?.rows) return;
    
    const targetRow = rowData.rows.find(r => r.id === contextMenu.rowId);
    if (!targetRow) return;

    const targetOrder = typeof targetRow.order === 'number' ? targetRow.order : parseFloat(String(targetRow.order || 0));
    const newOrder = targetOrder + 0.5;

    setError(null);
    createRow.mutate({ data: {}, order: newOrder }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to add row"),
    });
    setContextMenu(null);
  };

  const handleAddColumnLeft = () => {
    if (!contextMenu?.fieldId || !tableData?.fields) return;

    const targetField = tableData.fields.find(f => f.id === contextMenu.fieldId);
    if (!targetField) return;

    const targetOrder = targetField.order || 0;
    const newOrder = Math.max(0, targetOrder - 0.5);

    setError(null);
    createField.mutate({ name: "New Field", type: "text", order: newOrder }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to add column"),
    });
    setContextMenu(null);
  };

  const handleAddColumnRight = () => {
    if (!contextMenu?.fieldId || !tableData?.fields) return;

    const targetField = tableData.fields.find(f => f.id === contextMenu.fieldId);
    if (!targetField) return;

    const targetOrder = targetField.order || 0;
    const newOrder = targetOrder + 0.5;

    setError(null);
    createField.mutate({ name: "New Field", type: "text", order: newOrder }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to add column"),
    });
    setContextMenu(null);
  };

  const handleDropRowInGroup = (rowId: string, targetGroupId: string) => {
    if (!groupByField) return;
    const value = targetGroupId === "__ungrouped__" ? null : targetGroupId;
    updateCell.mutate({ rowId, fieldId: groupByField.id, value });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (isFocusableElement(e.target as HTMLElement)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Cmd/Ctrl + Enter => add row
      if (e.key === "Enter") {
        e.preventDefault();
        setError(null);
        createRow.mutate(undefined, {
          onError: (err) => setError(err instanceof Error ? err.message : "Failed to create row"),
        });
        return;
      }

      // Cmd/Ctrl + Shift + C => add column
      if (e.shiftKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        handleAddField();
        return;
      }

      // Cmd/Ctrl + F => focus search
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setOpenSearchTick((t) => t + 1);
        return;
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [createRow, handleAddField]);

  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    const row = sortedRows[rowIndex];
    const col = fields[colIndex];
    if (!row || !col) return;
    const ref = cellRefs.current[`${row.id}-${col.id}`];
    ref?.focus();
  }, [sortedRows, fields]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowId: string, fieldId: string) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const rowIndex = sortedRows.findIndex((r) => r.id === rowId);
    const colIndex = fields.findIndex((f) => f.id === fieldId);
    if (rowIndex === -1 || colIndex === -1) return;
    e.preventDefault();
    if (e.key === "ArrowLeft") {
      focusCell(rowIndex, Math.max(0, colIndex - 1));
    } else if (e.key === "ArrowRight") {
      focusCell(rowIndex, Math.min(fields.length - 1, colIndex + 1));
    } else if (e.key === "ArrowUp") {
      focusCell(Math.max(0, rowIndex - 1), colIndex);
    } else if (e.key === "ArrowDown") {
      focusCell(Math.min(sortedRows.length - 1, rowIndex + 1), colIndex);
    }
  }, [fields, sortedRows, focusCell]);

  // Sync active view with loaded view
  useEffect(() => {
    if (rowData?.view?.id) {
      setActiveViewId(rowData.view.id);
    }
  }, [rowData?.view?.id]);

  useEffect(() => {
    if (view?.config?.sorts) setSorts(view.config.sorts);
    if (view?.config?.filters) setFilters(view.config.filters);
  }, [view?.config?.sorts, view?.config?.filters]);

  useEffect(() => {
    if (view?.config?.groupBy?.collapsed) {
      setCollapsedGroups(view.config.groupBy.collapsed);
    } else {
      setCollapsedGroups([]);
    }
  }, [view?.config?.groupBy?.collapsed]);

  useEffect(() => {
    if (views && views.length > 0) {
      const current = views.find((v) => v.id === activeViewId);
      if (!current) {
        const fallback = views.find((v) => v.is_default) || views[0];
        setActiveViewId(fallback.id);
      }
    }
  }, [views, activeViewId]);

  if (metaLoading || rowsLoading) {
    return (
      <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)]">
        Loading table…
      </div>
    );
  }

  return (
    <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden w-full">
      {error && (
        <div className="px-3 py-2 text-sm text-[var(--error-foreground)] bg-[var(--error)]/20 border-b border-[var(--error)]/30">
          {error}
        </div>
      )}
      <TableHeaderCompact
        tableId={tableId}
        tableTitle={tableData?.table.title}
        views={views || (view ? [view] : [])}
        activeViewId={effectiveViewId}
        fields={fields}
        filters={filters}
        onSearch={(q) => setSearch(q)}
        onColumnSearch={handleColumnSearch}
        onFiltersChange={(next) => {
          setFilters(next);
          persistViewConfig(sorts, next);
        }}
        searchInputRef={searchInputRef}
        openSearchTick={openSearchTick}
        groupBy={groupByConfig}
        onGroupByChange={handleGroupByChange}
        onCreateView={() =>
          createView.mutate(
            { name: "New view", type: "table" },
            {
              onSuccess: (res) => {
                if ("data" in res && res.data?.id) {
                  setActiveViewId(res.data.id);
                }
              },
            }
          )
        }
        onRenameView={(viewId, name) => {
          setActiveViewId(viewId);
          updateView.mutate({ name });
        }}
        onDeleteView={(viewId) => {
          deleteView.mutate(viewId);
        }}
        onSetDefault={(viewId) => setDefaultView.mutate(viewId)}
        onSwitchView={(viewId) => {
          setActiveViewId(viewId);
        }}
        onUpdateTableTitle={(title) => {
          updateTable.mutate({ title }, {
            onError: (err) => setError(err instanceof Error ? err.message : "Failed to update table title"),
          });
        }}
      />

      {hiddenFieldList.length > 0 && (
        <div className="px-3 py-2 text-xs text-[var(--muted-foreground)] flex items-center gap-2">
          <EyeOff className="h-4 w-4" />
          Hidden columns:
          {hiddenFieldList.map((f) => (
            <button
              key={f!.id}
              onClick={() => handleShowField(f!.id)}
              className="px-2 py-1 rounded-[2px] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors duration-150"
            >
              Show {f!.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative w-full" ref={containerRef}>
        <div className="overflow-x-auto w-full" style={{ maxHeight: '480px', overflowY: 'scroll' }}>
          <div style={{ width: 'max-content', minWidth: '100%' }}>
            <div className="max-h-[480px] overflow-x-hidden divide-y divide-[var(--border)] scrollbar-thin" style={{ width: 'max-content', minWidth: '100%', overflowY: 'scroll' }}>
              <TableHeaderRow
                fields={fields}
                columnTemplate={columnTemplate}
                sorts={sorts}
                pinnedFields={pinnedFields}
                onSetSort={handleSetSort}
            onToggleSort={(fieldId) => {
              const next = (() => {
                const existing = sorts.find((s) => s.fieldId === fieldId);
                if (!existing) return [{ fieldId, direction: "asc" as const }];
                if (existing.direction === "asc") return [{ fieldId, direction: "desc" as const }];
                return [];
              })();
              setSorts(next);
              persistViewConfig(next, filters);
            }}
            onRenameField={handleRenameField}
            onDeleteField={handleDeleteField}
            onAddField={handleAddField}
            onChangeType={handleChangeType}
            onReorderField={handleReorderField}
            onPinColumn={handlePinColumn}
            onViewColumnDetails={(fieldId) => setDetailColumnId(fieldId)}
            onUpdateFieldConfig={handleUpdateFieldConfig}
            columnRefs={Object.fromEntries(
              fields.map((f) => [f.id, (el: HTMLDivElement | null) => { columnRefs.current[f.id] = el; }])
            )}
            onColumnContextMenu={handleColumnContextMenu}
            onHideField={handleHideField}
              onResize={handleResizeWidth}
              widths={widthMap}
              className="sticky top-0 z-10"
          />
            {groupedData.grouped ? (
              groupedData.groups.map((group) => (
                <React.Fragment key={group.groupId}>
                  <GroupHeader
                    groupId={group.groupId}
                    groupLabel={group.groupLabel}
                    groupColor={group.groupColor}
                    count={group.count}
                    isCollapsed={group.isCollapsed}
                    onToggle={() => handleToggleGroup(group.groupId)}
                    onDropRow={(rowId) => handleDropRowInGroup(rowId, group.groupId)}
                  />
                  {!group.isCollapsed &&
                    group.rows.map((row) => (
                      <TableRow
                        key={row.id}
                        fields={fields}
                        columnTemplate={columnTemplate}
                        rowId={row.id}
                        data={row.data || {}}
                        onChange={handleCellChange}
                        savingRowIds={savingRows}
                        onOpenComments={(rid) => setCommentsRowId(rid)}
                        pinnedFields={pinnedFields}
                        onContextMenu={handleCellContextMenu}
                        widths={widthMap}
                        rowMetadata={{
                          created_at: row.created_at,
                          updated_at: row.updated_at,
                          created_by: row.created_by || undefined,
                          updated_by: row.updated_by || undefined,
                        }}
                        workspaceMembers={workspaceMembers}
                        onCellKeyDown={handleCellKeyDown}
                        cellRefs={cellRefs}
                        draggable
                        onDragStart={(id, e) => {
                          e.dataTransfer.setData("rowId", id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onUpdateFieldConfig={handleUpdateFieldConfig}
                      />
                    ))}
                </React.Fragment>
              ))
            ) : (
              sortedRows.map((row) => (
                <TableRow
                  key={row.id}
                  fields={fields}
                  columnTemplate={columnTemplate}
                  rowId={row.id}
                  data={row.data || {}}
                  onChange={handleCellChange}
                  savingRowIds={savingRows}
                  onOpenComments={(rid) => setCommentsRowId(rid)}
                  pinnedFields={pinnedFields}
                  onContextMenu={handleCellContextMenu}
                  widths={widthMap}
                  rowMetadata={{
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    created_by: row.created_by || undefined,
                    updated_by: row.updated_by || undefined,
                  }}
                  workspaceMembers={workspaceMembers}
                  onCellKeyDown={handleCellKeyDown}
                  cellRefs={cellRefs}
                  onUpdateFieldConfig={handleUpdateFieldConfig}
                />
              ))
            )}

                {sortedRows.length === 0 && (
                  <div className="p-6 text-sm text-[var(--muted-foreground)] flex flex-col gap-2 items-center">
                    <div>No rows yet.</div>
                    <button
                      onClick={() => {
                        setError(null);
                        createRow.mutate(undefined, {
                          onError: (err) => setError(err instanceof Error ? err.message : "Failed to create row"),
                        });
                      }}
                      className="px-3 py-1 text-sm rounded-[2px] bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition-colors duration-150 border border-[var(--border)]"
                    >
                      Add your first row
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        {/* Standalone Add row button positioned above horizontal scrollbar */}
        <div className="absolute bottom-0 left-0 right-0 h-0 pointer-events-none">
          <button
            onClick={() => {
              setError(null);
              createRow.mutate(undefined, {
                onError: (err) => setError(err instanceof Error ? err.message : "Failed to create row"),
              });
            }}
            className="absolute bottom-[18px] left-2 pointer-events-auto inline-flex items-center gap-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-colors duration-150"
          >
            <Plus className="h-3 w-3" />
            Add row
          </button>
        </div>
      </div>
      {commentsRowId && (
        <div className="fixed inset-y-0 right-0 z-40">
          <RowComments rowId={commentsRowId} onClose={() => setCommentsRowId(null)} />
        </div>
      )}
      {detailColumnId && (
        <ColumnDetailPanel
          tableId={tableId}
          fieldId={detailColumnId}
          rows={sortedRows}
          onClose={() => setDetailColumnId(null)}
        />
      )}
      {contextMenu && (
        <TableContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onClose={() => setContextMenu(null)}
          onAddRowAbove={contextMenu.type === "cell" ? handleAddRowAbove : undefined}
          onAddRowBelow={contextMenu.type === "cell" ? handleAddRowBelow : undefined}
          onAddColumnLeft={contextMenu.type === "column" ? handleAddColumnLeft : undefined}
          onAddColumnRight={contextMenu.type === "column" ? handleAddColumnRight : undefined}
        />
      )}
    </div>
  );
}
