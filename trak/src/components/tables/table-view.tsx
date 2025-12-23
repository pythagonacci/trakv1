"use client";

// Table refactor baseline (Sept 2024):
// - Uses new Supabase-backed schema (tables/table_fields/table_rows/table_views) and React Query hooks in src/lib/hooks/use-table-queries.ts.
// - Only table view is implemented here; other view types (board/list/gallery/calendar) intentionally omitted per scope.

import { useEffect, useMemo, useState, useRef } from "react";
import { Plus } from "lucide-react";
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
import type { SortCondition, FilterCondition, FieldType, ViewConfig } from "@/types/table";

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
  const pinnedFields = useMemo(() => view?.config?.pinnedFields ?? [], [view?.config?.pinnedFields]);
  
  // Order fields: pinned first, then others
  const fields = useMemo(() => {
    const pinned = allFields.filter((f) => pinnedFields.includes(f.id));
    const unpinned = allFields.filter((f) => !pinnedFields.includes(f.id));
    return [...pinned, ...unpinned];
  }, [allFields, pinnedFields]);
  
  const columnTemplate = useMemo(() => {
    if (!fields.length) return "1fr 40px";
    // Use 1fr for columns to fill available space, with min width constraint
    const base = fields.map(() => "minmax(180px, 1fr)").join(" ");
    // Extra thin column at the end for the add-column affordance
    return `${base} 40px`;
  }, [fields]);
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

  const sortedRows = useMemo(() => {
    let filtered = rows;
    if (filters.length) {
      filtered = rows.filter((row) =>
        filters.every((f) => {
          const value = (row.data || {})[f.fieldId];
          switch (f.operator) {
            case "is_empty":
              return value === null || value === undefined || value === "";
            case "is_not_empty":
              return value !== null && value !== undefined && value !== "";
            case "equals":
              return value === f.value;
            case "not_equals":
              return value !== f.value;
            case "contains":
            default:
              return String(value ?? "").toLowerCase().includes(String(f.value ?? "").toLowerCase());
          }
        })
      );
    }

    if (!sorts.length) return filtered;
    const [sort] = sorts;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const aVal = (a.data || {})[sort.fieldId];
      const bVal = (b.data || {})[sort.fieldId];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return aVal > bVal ? direction : -direction;
    });
  }, [rows, sorts, filters]);

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

  const handleAddField = () => {
    setError(null);
    createField.mutate({ name: "New Field", type: "text" }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to add field"),
    });
  };

  const handleRenameField = (fieldId: string, name: string) => {
    const target = fields.find((f) => f.id === fieldId);
    if (!target || target.name === name) return;
    setError(null);
    updateField.mutate({ id: fieldId, updates: { name } }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to rename field"),
    });
  };

  const handleDeleteField = (fieldId: string) => {
    // prevent deleting last field
    if (fields.length <= 1) return;
    setError(null);
    deleteField.mutate(fieldId, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to delete field"),
    });
  };

  const handleChangeType = (fieldId: string, type: string) => {
    const target = fields.find((f) => f.id === fieldId);
    if (!target || target.type === type) return;
    setError(null);
    updateField.mutate({ id: fieldId, updates: { type: type as FieldType } }, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to change field type"),
    });
  };

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

      <div className="relative w-full">
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
                columnRefs={Object.fromEntries(
                  fields.map((f) => [f.id, (el: HTMLDivElement | null) => { columnRefs.current[f.id] = el; }])
                )}
                onColumnContextMenu={handleColumnContextMenu}
                className="sticky top-0 z-10"
              />
              {sortedRows.map((row) => (
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
                  />
                ))}

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
