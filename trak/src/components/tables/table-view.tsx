"use client";

// Table refactor baseline (Sept 2024):
// - Uses new Supabase-backed schema (tables/table_fields/table_rows/table_views) and React Query hooks in src/lib/hooks/use-table-queries.ts.
// - Table, board, and timeline views live here; list/gallery/calendar are stubbed.

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Plus, EyeOff } from "lucide-react";
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
  useBulkDeleteRows,
  useBulkDuplicateRows,
  useBulkUpdateRows,
  useBulkInsertRows,
  useSetTableRowsSourceSyncMode,
} from "@/lib/hooks/use-table-queries";
import { TableHeaderRow } from "./table-header-row";
import { TableRow } from "./table-row";
import { TableHeaderCompact } from "./table-header-compact";
import { RowComments } from "./comments/row-comments";
import { ColumnDetailPanel } from "./column-detail-panel";
import { TableContextMenu } from "./table-context-menu";
import { PropertyMenu } from "@/components/properties";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { BulkDeleteDialog } from "./bulk-delete-dialog";
import { RelationConfigModal } from "./relation-config-modal";
import { RollupConfigModal } from "./rollup-config-modal";
import { FormulaConfigModal } from "./formula-config-modal";
import type { SortCondition, FilterCondition, FieldType, ViewConfig, GroupByConfig, TableField, TableRow as TableRowType } from "@/types/table";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import { countRelationLinksForRows } from "@/app/actions/tables/relation-actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import React from "react";
import { groupRows, canGroupByField } from "@/lib/table-grouping";
import { GroupHeader } from "./group-header";
import { BoardView } from "./board-view";
import { TableTimelineView } from "./table-timeline-view";
import Toast from "@/app/dashboard/projects/toast";
import { TableImportModal, type ImportColumnMapping } from "./table-import-modal";
import { Switch } from "@/components/ui/switch";
import {
  parsePastedTable,
  isStructuredData,
  inferFieldType,
  buildSelectOptions,
  transformValue,
  findOptionByLabel,
  normalizeHeaderName,
} from "@/lib/table-import";

function TableViewLoadingState() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-48 rounded-md border border-[var(--border)] bg-[var(--surface)]/60" />
      <div className="h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/40" />
    </div>
  );
}

const isFocusableElement = (el: HTMLElement | null) => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  const focusableTags = ["input", "textarea", "select", "button"];
  if (focusableTags.includes(tag)) return true;
  const contentEditable = (el as HTMLElement).getAttribute("contenteditable");
  return contentEditable === "true";
};

const isTextInputElement = (el: HTMLElement | null) => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return true;
  const contentEditable = (el as HTMLElement).getAttribute("contenteditable");
  return contentEditable === "true";
};

const normalizeFieldName = (name?: string | null) =>
  (name ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");

const isSubtaskFieldName = (name?: string | null) => {
  const normalized = normalizeFieldName(name);
  return normalized === "subtask" || normalized === "is_subtask";
};

const toBooleanValue = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "y", "1", "checked", "x"].includes(normalized);
  }
  return false;
};

type SubtaskRowMeta = {
  isSubtask: boolean;
  parentId?: string;
  hasSubtasks?: boolean;
  isCollapsed?: boolean;
};

function buildSubtaskPresentation(
  rows: TableRowType[],
  subtaskFieldId: string | null,
  collapsedParents: Set<string>
): { rowMeta: Map<string, SubtaskRowMeta>; parentIds: Set<string>; visibleRows: TableRowType[] } {
  const rowMeta = new Map<string, SubtaskRowMeta>();
  const parentIds = new Set<string>();

  if (!subtaskFieldId) {
    rows.forEach((row) => rowMeta.set(row.id, { isSubtask: false }));
    return { rowMeta, parentIds, visibleRows: rows };
  }

  let currentParentId: string | null = null;

  rows.forEach((row) => {
    const isSubtask = toBooleanValue(row.data?.[subtaskFieldId]);
    if (isSubtask) {
      const parentId = currentParentId ?? undefined;
      rowMeta.set(row.id, { isSubtask: true, parentId });
      if (parentId) parentIds.add(parentId);
      return;
    }
    rowMeta.set(row.id, { isSubtask: false });
    currentParentId = row.id;
  });

  parentIds.forEach((parentId) => {
    const existing = rowMeta.get(parentId) ?? { isSubtask: false };
    rowMeta.set(parentId, {
      ...existing,
      hasSubtasks: true,
      isCollapsed: collapsedParents.has(parentId),
    });
  });

  const visibleRows = rows.filter((row) => {
    const meta = rowMeta.get(row.id);
    if (meta?.isSubtask && meta.parentId && collapsedParents.has(meta.parentId)) {
      return false;
    }
    return true;
  });

  return { rowMeta, parentIds, visibleRows };
}

interface Props {
  tableId: string;
}

export function TableView({ tableId }: Props) {
  const queryClient = useQueryClient();
  const { data: tableData, isLoading: metaLoading } = useTable(tableId);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [commentsRowId, setCommentsRowId] = useState<string | null>(null);
  const [detailColumnId, setDetailColumnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "cell" | "column"; rowId?: string; fieldId?: string } | null>(null);
  const [propertiesRowId, setPropertiesRowId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingWidths, setPendingWidths] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [openSearchTick, setOpenSearchTick] = useState(0);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(null);
  const [relationConfigField, setRelationConfigField] = useState<TableField | null>(null);
  const [rollupConfigField, setRollupConfigField] = useState<TableField | null>(null);
  const [formulaConfigField, setFormulaConfigField] = useState<TableField | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [relationCount, setRelationCount] = useState<number | null>(null);
  const [countingRelations, setCountingRelations] = useState(false);
  const [editRequest, setEditRequest] = useState<{ rowId: string; fieldId: string; initialValue?: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [importData, setImportData] = useState<ReturnType<typeof parsePastedTable> | null>(null);
  const [importMappings, setImportMappings] = useState<ImportColumnMapping[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Set<string>>(new Set());

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
  const viewType = view?.type || "table";

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
  const bulkDeleteRows = useBulkDeleteRows(tableId);
  const bulkDuplicateRows = useBulkDuplicateRows(tableId);
  const bulkUpdateRows = useBulkUpdateRows(tableId);
  const bulkInsertRows = useBulkInsertRows(tableId);
  const setSourceSyncMode = useSetTableRowsSourceSyncMode(tableId);

  const allFields = useMemo(() => tableData?.fields ?? [], [tableData]);
  const subtaskField = useMemo(() => {
    const typed = allFields.find((field) => field.type === "subtask");
    if (typed) return typed;
    return allFields.find((field) => isSubtaskFieldName(field.name));
  }, [allFields]);
  const editableFields = useMemo(
    () =>
      allFields.filter(
        (field) =>
          !["rollup", "formula", "created_time", "last_edited_time", "created_by", "last_edited_by"].includes(field.type)
      ),
    [allFields]
  );
  const hiddenFields = useMemo(() => view?.config?.hiddenFields ?? [], [view?.config?.hiddenFields]);
  const pinnedFields = useMemo(() => view?.config?.pinnedFields ?? [], [view?.config?.pinnedFields]);
  const dateFields = useMemo(() => allFields.filter((f) => f.type === "date"), [allFields]);
  
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

  const selectionWidth = 36;
  
  const columnTemplate = useMemo(() => {
    if (!fields.length) return `${selectionWidth}px 1fr 40px`;
    // Use minmax to allow columns to fill available space while respecting minimum widths
    const base = fields.map((f) => {
      const width = getWidthForField(f.id);
      return `minmax(${width}px, 1fr)`;
    }).join(" ");
    return `${selectionWidth}px ${base} 40px`;
  }, [fields, selectionWidth, getWidthForField]);

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
  const toggleSubtasks = useCallback((rowId: string) => {
    setCollapsedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

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

  const handleUpdateCalculation = (fieldId: string, calculation: string | null) => {
    if (!view?.id) return;
    const current = view.config?.field_calculations || {};
    const next = { ...current };
    if (!calculation) {
      delete next[fieldId];
    } else {
      next[fieldId] = calculation as any;
    }
    const nextConfig: ViewConfig = {
      ...(view.config || {}),
      field_calculations: next,
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

  const handleTimelineDateFieldChange = (fieldId: string) => {
    if (!view?.id) return;
    const nextConfig: ViewConfig = {
      ...(view.config || {}),
      timelineConfig: {
        ...(view.config?.timelineConfig || {}),
        dateFieldId: fieldId,
      },
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
  const subtaskPresentation = useMemo(
    () => buildSubtaskPresentation(sortedRows, subtaskField?.id ?? null, collapsedSubtasks),
    [sortedRows, subtaskField?.id, collapsedSubtasks]
  );
  const sourceLinkedRows = useMemo(
    () => (rowData?.rows ?? []).filter((row) => Boolean(row.source_entity_id && row.source_entity_type)),
    [rowData?.rows]
  );
  const hasSourceLinkedRows = sourceLinkedRows.length > 0;
  const sourceEntityTypes = useMemo(
    () =>
      Array.from(
        new Set(
          sourceLinkedRows
            .map((row) => row.source_entity_type)
            .filter((type): type is "task" | "timeline_event" => Boolean(type))
        )
      ),
    [sourceLinkedRows]
  );
  const liveSourceSyncEnabled =
    hasSourceLinkedRows && sourceLinkedRows.every((row) => row.source_sync_mode === "live");
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

  const baseVisibleRows = useMemo(() => {
    if (viewType !== "table") return sortedRows;
    if (!groupedData.grouped) return groupedData.rows;
    return groupedData.groups.flatMap((group) => (group.isCollapsed ? [] : group.rows));
  }, [groupedData, sortedRows, viewType]);

  const subtaskUiEnabled = viewType === "table" && Boolean(subtaskField) && !groupedData.grouped;

  const visibleRows = useMemo(() => {
    if (!subtaskUiEnabled) return baseVisibleRows;
    return subtaskPresentation.visibleRows;
  }, [baseVisibleRows, subtaskPresentation.visibleRows, subtaskUiEnabled]);

  // Memoize row IDs to prevent infinite loops
  const sortedRowIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
  
  useEffect(() => {
    const rowIdSet = new Set(sortedRowIds);
    setSelectedRows((prev) => {
      const filtered = new Set(Array.from(prev).filter((id) => rowIdSet.has(id)));
      // Only update if selection actually changed
      if (filtered.size === prev.size && Array.from(filtered).every(id => prev.has(id))) {
        return prev; // No change, return same reference
      }
      return filtered;
    });
  }, [sortedRowIds]);

  const handleCellChange = (rowId: string, fieldId: string, value: unknown) => {
    const targetField = allFields.find((field) => field.id === fieldId);
    savingRows.add(rowId);
    updateCell.mutate(
      { rowId, fieldId, value },
      {
        onSuccess: (result) => {
          savingRows.delete(rowId);
          if (targetField?.type === "relation") {
            const config = targetField.config as any;
            const relationIds = Array.isArray(value) ? value : [];
            
            // Invalidate current row's related rows query
            queryClient.invalidateQueries({ queryKey: ["relatedRows", rowId, fieldId] });
            
            // Invalidate main table rows query
            queryClient.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, effectiveViewId) });
            
            // If bidirectional, invalidate the opposite field's queries for all affected related rows
            if (config?.reverse_field_id && config?.bidirectional) {
              const oppositeFieldId = config.reverse_field_id;
              const relatedTableId = config.relation_table_id || config.linkedTableId;
              
              // Get previous value to find all affected rows (both added and removed)
              const previousRow = rows.find(r => r.id === rowId);
              const previousIds = Array.isArray(previousRow?.data?.[fieldId]) 
                ? (previousRow.data[fieldId] as string[])
                : [];
              
              // Get all affected row IDs (both old and new)
              const allAffectedIds = Array.from(new Set([...previousIds, ...relationIds]));
              
              // config.reverse_field_id always points to the opposite field:
              // - If we're on reverse field (Projects in Tasks), it points to forward field (Tasks in Projects)
              // - If we're on forward field (Tasks in Projects), it points to reverse field (Projects in Tasks)
              // So we always invalidate the opposite field's queries on related rows
              allAffectedIds.forEach((affectedRowId) => {
                queryClient.invalidateQueries({ 
                  queryKey: ["relatedRows", affectedRowId, oppositeFieldId] 
                });
              });
              
              // Also update the cached row data for the related table
              // This ensures the UI updates immediately without waiting for a refetch
              if (relatedTableId) {
                // Update cached row data for affected rows in the related table
                allAffectedIds.forEach((affectedRowId) => {
                  // Get all cached tableRows queries for the related table
                  const cachedQueries = queryClient.getQueriesData({ 
                    queryKey: ["tableRows", relatedTableId],
                    exact: false 
                  });
                  
                  cachedQueries.forEach(([queryKey, cachedData]) => {
                    if (cachedData && typeof cachedData === 'object' && 'rows' in cachedData) {
                      const data = cachedData as { rows: TableRowType[] };
                      const updatedRows = data.rows.map((r) => {
                        if (r.id === affectedRowId) {
                          // Update the opposite field's data with the new relation IDs
                          const currentValue = Array.isArray(r.data?.[oppositeFieldId]) 
                            ? (r.data[oppositeFieldId] as string[])
                            : [];
                          
                          // Calculate the new value based on what was added/removed
                          // affectedRowId is the related row (e.g., Project A)
                          // rowId is the current row (e.g., Task 3)
                          const wasInPrevious = previousIds.includes(affectedRowId);
                          const isInNew = relationIds.includes(affectedRowId);
                          
                          let newValue: string[];
                          if (isInNew && !wasInPrevious) {
                            // Added: add current rowId to the related row's opposite field
                            newValue = Array.from(new Set([...currentValue, rowId]));
                          } else if (!isInNew && wasInPrevious) {
                            // Removed: remove current rowId from the related row's opposite field
                            newValue = currentValue.filter(id => id !== rowId);
                          } else {
                            // No change for this row
                            newValue = currentValue;
                          }
                          
                          return {
                            ...r,
                            data: {
                              ...r.data,
                              [oppositeFieldId]: newValue,
                            },
                          };
                        }
                        return r;
                      });
                      
                      queryClient.setQueryData(queryKey, {
                        ...data,
                        rows: updatedRows,
                      });
                    }
                  });
                });
                
                // Also invalidate to ensure consistency
                queryClient.invalidateQueries({ 
                  queryKey: ["tableRows", relatedTableId],
                  exact: false,
                  refetchType: 'active'
                });
              }
            }
          }
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

  const handleSelectRow = useCallback(
    (rowId: string, event: React.MouseEvent<HTMLInputElement>) => {
      const isChecked = event.currentTarget.checked;
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (event.shiftKey && lastSelectedRowId) {
          const ids = visibleRows.map((row) => row.id);
          const start = ids.indexOf(lastSelectedRowId);
          const end = ids.indexOf(rowId);
          if (start !== -1 && end !== -1) {
            const [from, to] = start < end ? [start, end] : [end, start];
            for (let i = from; i <= to; i++) {
              if (isChecked) {
                next.add(ids[i]);
              } else {
                next.delete(ids[i]);
              }
            }
          }
        } else if (isChecked) {
          next.add(rowId);
        } else {
          next.delete(rowId);
        }
        return next;
      });
      setLastSelectedRowId(rowId);
    },
    [lastSelectedRowId, visibleRows]
  );

  const handleToggleAllRows = useCallback(() => {
    setSelectedRows((prev) => {
      if (prev.size === sortedRows.length) return new Set();
      return new Set(sortedRows.map((row) => row.id));
    });
  }, [sortedRows]);

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    setDeleteDialogOpen(true);
    setCountingRelations(true);
    setRelationCount(null);
    try {
      const result = await countRelationLinksForRows({
        tableId,
        rowIds: Array.from(selectedRows),
      });
      if ("data" in result) {
        setRelationCount(result.data.count);
      }
    } finally {
      setCountingRelations(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    try {
      await bulkDeleteRows.mutateAsync(Array.from(selectedRows));
      setSelectedRows(new Set());
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      setError(err instanceof Error ? err.message : "Failed to delete rows");
    }
  };

  const handleBulkDuplicate = () => {
    if (selectedRows.size === 0) return;
    bulkDuplicateRows.mutate(Array.from(selectedRows), {
      onSuccess: () => setSelectedRows(new Set()),
    });
  };

  const handleBulkUpdateField = async (fieldId: string, value: unknown) => {
    if (selectedRows.size === 0) return;
    try {
      await bulkUpdateRows.mutateAsync({ rowIds: Array.from(selectedRows), updates: { [fieldId]: value } });
      setSelectedRows(new Set());
    } catch (err) {
      console.error("Bulk update failed:", err);
      setError(err instanceof Error ? err.message : "Failed to update rows");
    }
  };

  const handleBulkExport = () => {
    if (selectedRows.size === 0) return;
    const rowsToExport = sortedRows.filter((row) => selectedRows.has(row.id));
    const headers = fields.map((field) => field.name);
    const csvRows = [headers.join(",")];

    const escapeCsv = (val: unknown) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/\"/g, '""')}"`;
      }
      return str;
    };

    rowsToExport.forEach((row) => {
      const values = fields.map((field) => escapeCsv(row.data?.[field.id]));
      csvRows.push(values.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `table-export-${tableId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getLastOrderValue = () => {
    const numericOrders = sortedRows
      .map((row) => Number(row.order))
      .filter((order) => !Number.isNaN(order));
    if (numericOrders.length === 0) return 0;
    return Math.max(...numericOrders);
  };

  const buildUniqueFieldName = (name: string, usedNames: Set<string>) => {
    const baseName = name.trim() || "New Field";
    let next = baseName;
    let suffix = 2;
    while (usedNames.has(next.toLowerCase())) {
      next = `${baseName} (${suffix})`;
      suffix += 1;
    }
    usedNames.add(next.toLowerCase());
    return next;
  };

  const handlePasteImport = useCallback(
    async (parsed: NonNullable<ReturnType<typeof parsePastedTable>>, mappings?: ImportColumnMapping[]) => {
      setImporting(true);
      setError(null);
      try {
        const mappingList = (mappings || importMappings).map((entry) => ({ ...entry }));
        const usedNames = new Set(allFields.map((field) => field.name.trim().toLowerCase()));
        const createdFields: TableField[] = [];
        const fieldMap = new Map<string, TableField>(allFields.map((field) => [field.id, field]));

        for (const mapping of mappingList) {
          if (mapping.mode !== "new") continue;
          const columnValues = parsed.rows.map((row) => row[mapping.columnIndex] ?? "");
          const nextType = mapping.newFieldType || inferFieldType(columnValues);
          const nextName = buildUniqueFieldName(
            normalizeHeaderName(mapping.newFieldName || mapping.columnName),
            usedNames
          );
          const config =
            nextType === "select" || nextType === "multi_select"
              ? { options: buildSelectOptions(columnValues) }
              : undefined;
          const result = await createField.mutateAsync({
            name: nextName,
            type: nextType,
            ...(config ? { config } : {}),
          });
          if ("error" in result) {
            throw new Error(result.error);
          }
          createdFields.push(result.data);
          fieldMap.set(result.data.id, result.data);
          mapping.fieldId = result.data.id;
          mapping.mode = "field";
        }

        const mappedCount = mappingList.filter((mapping) => mapping.mode === "field" && mapping.fieldId).length;
        if (mappedCount === 0) {
          setToast({ message: "No columns selected to import.", type: "error" });
          return;
        }

        const fieldConfigUpdates = new Map<string, TableField["config"]>();
        const optionLookup = new Map<string, Map<string, string>>();

        mappingList.forEach((mapping) => {
          if (mapping.mode !== "field" || !mapping.fieldId) return;
          const field = fieldMap.get(mapping.fieldId);
          if (!field) return;
          if (!["select", "multi_select", "status"].includes(field.type)) return;

          const config = (field.config || {}) as { options?: Array<{ id: string; label: string; color: string }> };
          const options = [...(config.options || [])];
          const newOptions: Array<{ id: string; label: string; color: string }> = [];
          const ensureOption = (label: string) => {
            const existing = findOptionByLabel(options, label);
            if (existing) return existing.id;
            const nextOption = {
              id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              label: label.trim(),
              color: "#3b82f6",
            };
            options.push(nextOption);
            newOptions.push(nextOption);
            return nextOption.id;
          };

          parsed.rows.forEach((row) => {
            const raw = row[mapping.columnIndex] ?? "";
            if (!raw || !raw.trim()) return;
            if (field.type === "multi_select") {
              raw
                .split(/[,;]+/)
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((label) => ensureOption(label));
            } else {
              ensureOption(raw);
            }
          });

          if (newOptions.length > 0) {
            fieldConfigUpdates.set(field.id, { ...config, options });
            const lookup = new Map<string, string>();
            options.forEach((opt) => lookup.set(opt.label.trim().toLowerCase(), opt.id));
            optionLookup.set(field.id, lookup);
          } else if (options.length > 0) {
            const lookup = new Map<string, string>();
            options.forEach((opt) => lookup.set(opt.label.trim().toLowerCase(), opt.id));
            optionLookup.set(field.id, lookup);
          }
        });

        for (const [fieldId, config] of fieldConfigUpdates.entries()) {
          const updateResult = await updateField.mutateAsync({ id: fieldId, updates: { config } });
          if ("error" in updateResult) {
            throw new Error(updateResult.error);
          }
        }

        const baseOrder = getLastOrderValue();
        const rowsToInsert = parsed.rows.map((row, idx) => {
          const data: Record<string, unknown> = {};
          mappingList.forEach((mapping) => {
            if (mapping.mode !== "field" || !mapping.fieldId) return;
            const field = fieldMap.get(mapping.fieldId);
            if (!field) return;
            const rawValue = row[mapping.columnIndex] ?? "";
            if (!rawValue || !rawValue.trim()) {
              data[field.id] = null;
              return;
            }
            if (field.type === "select" || field.type === "status") {
              const lookup = optionLookup.get(field.id);
              if (lookup) {
                const id = lookup.get(rawValue.trim().toLowerCase());
                data[field.id] = id ?? null;
              } else {
                data[field.id] = rawValue.trim();
              }
              return;
            }
            if (field.type === "multi_select") {
              const lookup = optionLookup.get(field.id);
              const parts = rawValue
                .split(/[,;]+/)
                .map((part) => part.trim())
                .filter(Boolean);
              if (lookup) {
                data[field.id] = parts.map((part) => lookup.get(part.toLowerCase()) || part);
              } else {
                data[field.id] = parts;
              }
              return;
            }
            data[field.id] = transformValue(rawValue, field);
          });
          return { data, order: baseOrder + idx + 1 };
        });

        const insertResult = await bulkInsertRows.mutateAsync(rowsToInsert);
        if ("error" in insertResult) {
          throw new Error(insertResult.error);
        }

        setImportModalOpen(false);
        setImportData(null);
        setImportMappings([]);
        const createdCount = createdFields.length;
        setToast({
          message: `Imported ${rowsToInsert.length} rows${createdCount ? `, created ${createdCount} columns` : ""}`,
          type: "success",
        });
      } catch (err) {
        console.error("Import failed:", err);
        setToast({
          message: err instanceof Error ? err.message : "Failed to import rows",
          type: "error",
        });
      } finally {
        setImporting(false);
      }
    },
    [allFields, bulkInsertRows, createField, importMappings, sortedRows, updateField]
  );

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

    if (type === "relation") {
      setRelationConfigField(target);
      return;
    }
    if (type === "rollup") {
      setRollupConfigField(target);
      return;
    }
    if (type === "formula") {
      setFormulaConfigField(target);
      return;
    }

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

  const handleConfigureField = useCallback((fieldId: string) => {
    const target = allFields.find((f) => f.id === fieldId);
    if (!target) return;
    if (target.type === "relation") {
      setRelationConfigField(target);
    } else if (target.type === "rollup") {
      setRollupConfigField(target);
    } else if (target.type === "formula") {
      setFormulaConfigField(target);
    }
  }, [allFields]);

  const handleSaveRollupConfig = (config: Record<string, unknown>) => {
    if (!rollupConfigField) return;
    updateField.mutate(
      { id: rollupConfigField.id, updates: { type: "rollup", config } },
      {
        onSuccess: () => setRollupConfigField(null),
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to update rollup field"),
      }
    );
  };

  const handleSaveFormulaConfig = (config: { formula: string; return_type: string }) => {
    if (!formulaConfigField) return;
    updateField.mutate(
      { id: formulaConfigField.id, updates: { type: "formula", config } },
      {
        onSuccess: () => setFormulaConfigField(null),
        onError: (err) => setError(err instanceof Error ? err.message : "Failed to update formula field"),
      }
    );
  };

  const handleReorderField = (fieldId: string, direction: "left" | "right") => {
    // Find the field in the visible fields array (what the user sees)
    const visibleIdx = fields.findIndex((f) => f.id === fieldId);
    if (visibleIdx === -1) return;
    
    // Find the adjacent field in the visible array
    const swapWithVisibleIdx = direction === "left" ? visibleIdx - 1 : visibleIdx + 1;
    if (swapWithVisibleIdx < 0 || swapWithVisibleIdx >= fields.length) return;
    
    const swapWithFieldId = fields[swapWithVisibleIdx].id;
    
    // Now work with the actual ordered fields (all fields sorted by order)
    const orderedFields = [...allFields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const fieldIdx = orderedFields.findIndex((f) => f.id === fieldId);
    const swapWithIdx = orderedFields.findIndex((f) => f.id === swapWithFieldId);
    
    if (fieldIdx === -1 || swapWithIdx === -1) return;
    
    // Swap the fields in the ordered array
    const newOrder = [...orderedFields];
    [newOrder[fieldIdx], newOrder[swapWithIdx]] = [newOrder[swapWithIdx], newOrder[fieldIdx]];
    
    // Create payload with new order values (1-indexed)
    const payload = newOrder.map((f, i) => ({ fieldId: f.id, order: i + 1 }));
    setError(null);
    reorderFields.mutate(payload, {
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to reorder fields"),
    });
  };

  const handleInsertField = async (fieldId: string, direction: "left" | "right") => {
    const ordered = [...allFields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = ordered.findIndex((f) => f.id === fieldId);
    if (idx === -1) return;
    const insertIndex = direction === "left" ? idx : idx + 1;
    setError(null);
    try {
      const result = await createField.mutateAsync({
        name: "New Field",
        type: "text",
      });
      if ("error" in result) {
        throw new Error(result.error);
      }
      const newField = result.data;
      await queryClient.cancelQueries({ queryKey: queryKeys.table(tableId) });
      const nextOrder = [...ordered];
      nextOrder.splice(insertIndex, 0, newField);
      const payload = nextOrder.map((f, i) => ({ fieldId: f.id, order: i + 1 }));
      const reorderResult = await reorderFields.mutateAsync(payload);
      if ("error" in reorderResult) {
        throw new Error(reorderResult.error);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
    }
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
    if (groupByField.type === "multi_select") {
      const current = sortedRows.find((row) => row.id === rowId)?.data?.[groupByField.id];
      const currentValues = Array.isArray(current) ? current.map(String) : [];
      const next =
        targetGroupId === "__ungrouped__"
          ? []
          : Array.from(new Set([...currentValues, targetGroupId]));
      updateCell.mutate({ rowId, fieldId: groupByField.id, value: next });
      return;
    }
    if (groupByField.type === "checkbox" || groupByField.type === "subtask") {
      const value = targetGroupId === "__ungrouped__" ? null : targetGroupId === "true";
      updateCell.mutate({ rowId, fieldId: groupByField.id, value });
      return;
    }
    const value = targetGroupId === "__ungrouped__" ? null : targetGroupId;
    updateCell.mutate({ rowId, fieldId: groupByField.id, value });
  };

  const buildInitialImportMappings = (parsed: NonNullable<ReturnType<typeof parsePastedTable>>) => {
    const normalizedFieldMap = new Map(
      editableFields.map((field) => [field.name.trim().toLowerCase(), field.id])
    );
    return parsed.headers.map((header, index) => {
      const normalizedHeader = header.trim().toLowerCase();
      const columnValues = parsed.rows.map((row) => row[index] ?? "");
      const inferredType =
        normalizedHeader === "subtask" || normalizedHeader === "is_subtask"
          ? "subtask"
          : inferFieldType(columnValues);

      if (parsed.hasHeader && normalizedFieldMap.has(normalizedHeader)) {
        return {
          columnIndex: index,
          columnName: header,
          mode: "field",
          fieldId: normalizedFieldMap.get(normalizedHeader),
          newFieldType: inferredType,
        } as ImportColumnMapping;
      }

      if (!parsed.hasHeader && editableFields[index]) {
        return {
          columnIndex: index,
          columnName: header,
          mode: "field",
          fieldId: editableFields[index].id,
          newFieldType: inferredType,
        } as ImportColumnMapping;
      }

      return {
        columnIndex: index,
        columnName: header,
        mode: "new",
        newFieldName: header,
        newFieldType: inferredType,
      } as ImportColumnMapping;
    });
  };

  const handlePasteText = useCallback(
    (text: string) => {
      if (!text || !isStructuredData(text)) {
        setToast({ message: "Couldn't detect structured data.", type: "error" });
        return;
      }
      const parsed = parsePastedTable(text);
      if (!parsed) {
        setToast({ message: "Couldn't detect structured data.", type: "error" });
        return;
      }
      if (parsed.rows.length === 0) {
        setToast({ message: "No data rows detected to import.", type: "error" });
        return;
      }

      const mappings = buildInitialImportMappings(parsed);
      setImportData(parsed);
      setImportMappings(mappings);

      if (editableFields.length === 0 || sortedRows.length === 0) {
        handlePasteImport(parsed, mappings);
        return;
      }

      setImportModalOpen(true);
    },
    [editableFields, sortedRows.length, handlePasteImport]
  );

  useEffect(() => {
    if (viewType !== "table") return;

    const handlePaste = (event: ClipboardEvent) => {
      if (isTextInputElement(event.target as HTMLElement)) return;
      const container = containerRef.current;
      if (!container) return;
      const targetNode = event.target as Node | null;
      const activeNode = document.activeElement as Node | null;
      const isWithinTable =
        (targetNode && container.contains(targetNode)) || (activeNode && container.contains(activeNode));
      if (!isWithinTable) return;

      const pastedText = event.clipboardData?.getData("text/plain");
      if (!pastedText) return;
      if (!isStructuredData(pastedText)) return;
      event.preventDefault();
      handlePasteText(pastedText);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePasteText, viewType]);

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
    const row = visibleRows[rowIndex];
    const col = fields[colIndex];
    if (!row || !col) return;
    const ref = cellRefs.current[`${row.id}-${col.id}`];
    ref?.focus();
  }, [visibleRows, fields]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowId: string, fieldId: string) => {
    if (isFocusableElement(e.target as HTMLElement)) return;
    if (e.key === "Tab") return;
    const rowIndex = visibleRows.findIndex((r) => r.id === rowId);
    const colIndex = fields.findIndex((f) => f.id === fieldId);
    if (rowIndex === -1 || colIndex === -1) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "ArrowLeft") {
        focusCell(rowIndex, Math.max(0, colIndex - 1));
      } else if (e.key === "ArrowRight") {
        focusCell(rowIndex, Math.min(fields.length - 1, colIndex + 1));
      } else if (e.key === "ArrowUp") {
        focusCell(Math.max(0, rowIndex - 1), colIndex);
      } else if (e.key === "ArrowDown") {
        focusCell(Math.min(visibleRows.length - 1, rowIndex + 1), colIndex);
      }
      return;
    }

    const isModifier = e.metaKey || e.ctrlKey || e.altKey;
    if (isModifier) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      setEditRequest({ rowId, fieldId, initialValue: "" });
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();
      setEditRequest({ rowId, fieldId, initialValue: e.key });
    }
  }, [fields, visibleRows, focusCell]);

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
    if (viewType !== "timeline") return;
    if (!view?.id) return;
    if (dateFields.length === 0) return;
    const current = view.config?.timelineConfig?.dateFieldId;
    if (current && dateFields.some((field) => field.id === current)) return;
    const nextConfig: ViewConfig = {
      ...(view.config || {}),
      timelineConfig: {
        ...(view.config?.timelineConfig || {}),
        dateFieldId: dateFields[0].id,
      },
    };
    updateView.mutate({ config: nextConfig });
  }, [viewType, view?.id, view?.config, dateFields, updateView]);

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
    return <TableViewLoadingState />;
  }

  const sourceTypeLabel = sourceEntityTypes
    .map((type) => (type === "timeline_event" ? "timeline events" : "tasks"))
    .join(" and ");

  return (
    <div className="p-3">
      {error && (
        <div className="mb-2 rounded-[6px] border border-[var(--error)]/30 bg-[var(--error)]/20 px-3 py-2 text-sm text-[var(--error-foreground)]">
          {error}
        </div>
      )}
      <div className="mb-2">
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
          onCreateView={(type) => {
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            const config: ViewConfig | undefined =
              type === "timeline" && dateFields.length > 0
                ? { timelineConfig: { dateFieldId: dateFields[0].id } }
                : undefined;
            createView.mutate(
              { name: `${label} view`, type, config },
              {
                onSuccess: (res) => {
                  if ("data" in res && res.data?.id) {
                    setActiveViewId(res.data.id);
                  }
                },
              }
            );
          }}
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
          hasDateFields={dateFields.length > 0}
        />
      </div>
      {hasSourceLinkedRows && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-[10px] text-[var(--muted-foreground)]">
            Source-linked {sourceTypeLabel || "rows"} are editable copies. Global search and Everything use the source entity once.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Sync edits to source</span>
            <Switch
              checked={liveSourceSyncEnabled}
              disabled={setSourceSyncMode.isPending}
              onCheckedChange={(checked) => {
                setSourceSyncMode.mutate(
                  { mode: checked ? "live" : "snapshot" },
                  {
                    onSuccess: (res) => {
                      if ("error" in res) {
                        setToast({
                          message: res.error || "Failed to update source sync mode.",
                          type: "error",
                        });
                        return;
                      }
                      setToast({
                        message: checked
                          ? "Live sync enabled for source-linked rows."
                          : "Rows are now snapshot copies.",
                        type: "success",
                      });
                    },
                    onError: (error) => {
                      setToast({
                        message: error instanceof Error ? error.message : "Failed to update source sync mode.",
                        type: "error",
                      });
                    },
                  }
                );
              }}
            />
          </div>
        </div>
      )}

      {viewType === "table" && hiddenFieldList.length > 0 && (
        <div className="mb-2 px-3 py-2 text-xs text-[var(--muted-foreground)] flex items-center gap-2">
          <EyeOff className="h-4 w-4" />
          Hidden columns:
          {hiddenFieldList.map((f) => (
            <button
              key={f!.id}
              onClick={() => handleShowField(f!.id)}
              className="px-2 py-1 rounded-md border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] transition-colors duration-150"
            >
              Show {f!.name}
            </button>
          ))}
        </div>
      )}

      <BulkDeleteDialog
        open={deleteDialogOpen}
        rowCount={selectedRows.size}
        relationCount={relationCount}
        countingRelations={countingRelations}
        deleting={bulkDeleteRows.isPending}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmBulkDelete}
      />
      {viewType === "table" && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden w-full">
          <BulkActionsToolbar
            selectedCount={selectedRows.size}
            fields={fields}
            onDelete={handleBulkDelete}
            onDuplicate={handleBulkDuplicate}
            onExport={handleBulkExport}
            onUpdateField={handleBulkUpdateField}
            onClearSelection={() => setSelectedRows(new Set())}
          />
          <div className="relative w-full" ref={containerRef}>
          <div className="overflow-x-auto w-full" style={{ maxHeight: "480px", overflowY: "scroll" }}>
            <div style={{ width: "100%" }}>
              <div
                className="max-h-[480px] overflow-x-hidden scrollbar-thin"
                style={{ width: "100%", overflowY: "scroll" }}
              >
                <TableHeaderRow
                  fields={fields}
                  columnTemplate={columnTemplate}
                  sorts={sorts}
                  pinnedFields={pinnedFields}
                  selectedCount={selectedRows.size}
                  totalCount={sortedRows.length}
                  selectionWidth={selectionWidth}
                  onToggleAllRows={handleToggleAllRows}
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
                  onInsertField={handleInsertField}
                  onPinColumn={handlePinColumn}
                  onViewColumnDetails={(fieldId) => setDetailColumnId(fieldId)}
                  onConfigureField={handleConfigureField}
                  onUpdateFieldConfig={handleUpdateFieldConfig}
                  columnRefs={Object.fromEntries(
                    fields.map((f) => [f.id, (el: HTMLDivElement | null) => { columnRefs.current[f.id] = el; }])
                  )}
                  onColumnContextMenu={handleColumnContextMenu}
                  onHideField={handleHideField}
                  onResize={handleResizeWidth}
                  widths={widthMap}
                  calculations={view?.config?.field_calculations || {}}
                  rows={sortedRows}
                  onUpdateCalculation={handleUpdateCalculation}
                  className="sticky top-0 z-[5]"
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
                            tableId={tableId}
                            rowId={row.id}
                            data={row.data || {}}
                            onChange={handleCellChange}
                            savingRowIds={savingRows}
                            onOpenComments={(rid) => setCommentsRowId(rid)}
                            pinnedFields={pinnedFields}
                            onContextMenu={handleCellContextMenu}
                            widths={widthMap}
                            selectionWidth={selectionWidth}
                            showSelection
                            isSelected={selectedRows.has(row.id)}
                            onSelectRow={handleSelectRow}
                            rowMetadata={{
                              created_at: row.created_at,
                              updated_at: row.updated_at,
                              created_by: row.created_by || undefined,
                              updated_by: row.updated_by || undefined,
                            }}
                            workspaceMembers={workspaceMembers}
                            onCellKeyDown={handleCellKeyDown}
                            cellRefs={cellRefs}
                            editRequest={editRequest || undefined}
                            onEditRequestHandled={() => setEditRequest(null)}
                            draggable
                            onDragStart={(id, e) => {
                              e.dataTransfer.setData("rowId", id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onUpdateFieldConfig={handleUpdateFieldConfig}
                            subtaskMeta={subtaskUiEnabled ? subtaskPresentation.rowMeta.get(row.id) : undefined}
                            onToggleSubtasks={subtaskUiEnabled ? toggleSubtasks : undefined}
                          />
                        ))}
                    </React.Fragment>
                  ))
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      fields={fields}
                      columnTemplate={columnTemplate}
                      tableId={tableId}
                      rowId={row.id}
                      data={row.data || {}}
                      onChange={handleCellChange}
                      savingRowIds={savingRows}
                      onOpenComments={(rid) => setCommentsRowId(rid)}
                      pinnedFields={pinnedFields}
                      onContextMenu={handleCellContextMenu}
                      widths={widthMap}
                      selectionWidth={selectionWidth}
                      showSelection
                      isSelected={selectedRows.has(row.id)}
                      onSelectRow={handleSelectRow}
                      rowMetadata={{
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        created_by: row.created_by || undefined,
                        updated_by: row.updated_by || undefined,
                      }}
                      workspaceMembers={workspaceMembers}
                      onCellKeyDown={handleCellKeyDown}
                      cellRefs={cellRefs}
                      editRequest={editRequest || undefined}
                      onEditRequestHandled={() => setEditRequest(null)}
                      onUpdateFieldConfig={handleUpdateFieldConfig}
                      subtaskMeta={subtaskUiEnabled ? subtaskPresentation.rowMeta.get(row.id) : undefined}
                      onToggleSubtasks={subtaskUiEnabled ? toggleSubtasks : undefined}
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
                      className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                    >
                      Add your first row
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Add row button - always visible at bottom */}
          <div className="sticky bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] px-2 py-2 z-10 flex items-center justify-start">
            <button
              onClick={() => {
                setError(null);
                createRow.mutate(undefined, {
                  onError: (err) => setError(err instanceof Error ? err.message : "Failed to create row"),
                });
              }}
              className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              <Plus className="h-3 w-3" />
              Add row
            </button>
          </div>
        </div>
        </div>
      )}

      {viewType === "board" && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden w-full">
          <BoardView
            fields={fields}
            rows={sortedRows}
            groupBy={groupByConfig}
            workspaceMembers={workspaceMembers}
            selectedRows={selectedRows}
            onSelectRow={handleSelectRow}
            onUpdateCell={handleCellChange}
            onCreateRow={(data) => {
              setError(null);
              createRow.mutate({ data }, {
                onError: (err) => setError(err instanceof Error ? err.message : "Failed to create row"),
              });
            }}
            onContextMenu={handleCellContextMenu}
          />
        </div>
      )}

      {viewType === "timeline" && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden w-full">
          <TableTimelineView
            fields={fields}
            rows={sortedRows}
            dateFieldId={view?.config?.timelineConfig?.dateFieldId}
            groupBy={groupByConfig}
            workspaceMembers={workspaceMembers}
            selectedRows={selectedRows}
            onSelectRow={handleSelectRow}
            onUpdateCell={handleCellChange}
            onDateFieldChange={handleTimelineDateFieldChange}
            onContextMenu={handleCellContextMenu}
          />
        </div>
      )}

      {["list", "gallery", "calendar"].includes(viewType) && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden w-full p-6 text-sm text-gray-500">
          This view type is coming soon.
        </div>
      )}
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
      <TableImportModal
        open={importModalOpen}
        rowCount={importData?.rows.length ?? 0}
        columns={importMappings}
        fields={editableFields}
        previewRows={importData?.rows.slice(0, 5) ?? []}
        largePasteWarning={(importData?.rows.length ?? 0) > 1000}
        loading={importing}
        onClose={() => {
          if (importing) return;
          setImportModalOpen(false);
          setImportData(null);
          setImportMappings([]);
        }}
        onChange={(next) => setImportMappings(next)}
        onConfirm={() => {
          if (!importData) return;
          handlePasteImport(importData, importMappings);
        }}
      />
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
          onOpenProperties={
            contextMenu.type === "cell" && contextMenu.rowId && tableData?.table.workspace_id
              ? () => {
                  const rowId = contextMenu.rowId;
                  if (!rowId) return;
                  setPropertiesRowId(rowId);
                  setPropertiesOpen(true);
                }
              : undefined
          }
        />
      )}
      <RelationConfigModal
        open={Boolean(relationConfigField)}
        field={relationConfigField}
        tableId={tableId}
        workspaceId={tableData?.table.workspace_id}
        onClose={() => setRelationConfigField(null)}
      />
      <RollupConfigModal
        open={Boolean(rollupConfigField)}
        field={rollupConfigField}
        tableFields={allFields}
        onClose={() => setRollupConfigField(null)}
        onSave={handleSaveRollupConfig}
      />
      <FormulaConfigModal
        open={Boolean(formulaConfigField)}
        field={formulaConfigField}
        tableFields={allFields}
        onClose={() => setFormulaConfigField(null)}
        onSave={handleSaveFormulaConfig}
      />
      {propertiesRowId && tableData?.table.workspace_id && (
        <PropertyMenu
          open={propertiesOpen}
          onOpenChange={(open) => {
            setPropertiesOpen(open);
            if (!open) {
              setPropertiesRowId(null);
            }
          }}
          entityType="table_row"
          entityId={propertiesRowId}
          workspaceId={tableData.table.workspace_id}
          entityTitle="Table row"
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
