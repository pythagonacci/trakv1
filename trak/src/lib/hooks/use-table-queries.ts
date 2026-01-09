"use client";

// Table refactor baseline (Sept 2024):
// - Existing table UI is block-scoped (table-block.tsx) and reads from blocks.content via useTabBlocks/getTabBlocks.
// - No React Query hooks existed for the new Supabase-backed tables/fields/rows/views/comments; these hooks wrap the new server actions to ease migration.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { createTable, getTable, updateTable, deleteTable, duplicateTable } from "@/app/actions/tables/table-actions";
import { createField, updateField, deleteField, reorderFields, updateFieldConfig } from "@/app/actions/tables/field-actions";
import { createRow, updateRow, updateCell, deleteRow, deleteRows, reorderRows, duplicateRow } from "@/app/actions/tables/row-actions";
import { createView, getView, updateView, deleteView, setDefaultView, listViews } from "@/app/actions/tables/view-actions";
import { createComment, updateComment, deleteComment, resolveComment, getRowComments } from "@/app/actions/tables/comment-actions";
import { getTableData, searchTableRows, getFilteredRows } from "@/app/actions/tables/query-actions";
import type { Table, TableField, TableRow, TableView, TableComment, FilterCondition } from "@/types/table";

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function useTable(tableId: string, initialData?: { table: Table; fields: TableField[] }) {
  return useQuery({
    queryKey: queryKeys.table(tableId),
    queryFn: async () => {
      const result = await getTable(tableId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    initialData,
    staleTime: 30_000,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTable,
    onSuccess: (result) => {
      if ("data" in result) {
        qc.invalidateQueries({ queryKey: queryKeys.workspace(result.data.table.workspace_id) });
      }
    },
  });
}

export function useUpdateTable(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Table>) => updateTable(tableId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useDeleteTable(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTable(tableId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useDuplicateTable(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { includeRows?: boolean }) => duplicateTable(tableId, options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export function useCreateField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof createField>[0], "tableId">) =>
      createField({ ...input, tableId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useUpdateField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; updates: Partial<TableField> }) => updateField(args.id, args.updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useDeleteField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => deleteField(fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useReorderFields(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: Array<{ fieldId: string; order: number }>) => reorderFields(tableId, orders),
    onMutate: async (orders) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: queryKeys.table(tableId) });
      
      // Snapshot previous value
      const previous = qc.getQueryData<{ table: Table; fields: TableField[] }>(
        queryKeys.table(tableId)
      );
      
      // Optimistically update field order
      if (previous) {
        const orderMap = new Map(orders.map(o => [o.fieldId, o.order]));
        const reorderedFields = [...previous.fields].sort((a, b) => {
          const orderA = orderMap.get(a.id) ?? a.order;
          const orderB = orderMap.get(b.id) ?? b.order;
          return orderA - orderB;
        });
        
        qc.setQueryData(queryKeys.table(tableId), {
          ...previous,
          fields: reorderedFields,
        });
      }
      
      return { previous };
    },
    onError: (err, orders, context) => {
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(queryKeys.table(tableId), context.previous);
      }
      console.error("Failed to reorder fields:", err);
    },
    onSuccess: (result) => {
      // Update with server response if available
      if ("data" in result && result.data) {
        const key = queryKeys.table(tableId);
        const existing = qc.getQueryData<{ table: Table; fields: TableField[] }>(key);
        if (existing) {
          qc.setQueryData(key, {
            ...existing,
            fields: result.data,
          });
        }
      }
      // Invalidate to ensure consistency
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useUpdateFieldConfig(tableId: string, fieldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, unknown>) => updateFieldConfig(fieldId, config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function useCreateRow(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: Record<string, unknown> | { data?: Record<string, unknown>; order?: number | string | null }) => {
      if (data && typeof data === 'object' && ('data' in data || 'order' in data)) {
        return createRow({ tableId, data: data.data, order: data.order });
      }
      return createRow({ tableId, data: data as Record<string, unknown> | undefined });
    },
    onSuccess: (res) => {
      // Optimistically append the new row to the cached dataset if present
      if ("data" in res && res.data) {
        const key = queryKeys.tableRows(tableId, viewId);
        const existing = qc.getQueryData<{ rows: TableRow[]; view?: any }>(key);
        if (existing) {
          qc.setQueryData(key, { ...existing, rows: [...existing.rows, res.data] });
        }
      }
      // Invalidate all tableRows queries for this table to ensure fresh data
      qc.invalidateQueries({ 
        queryKey: ['tableRows', tableId],
        refetchType: 'active' // Only refetch active queries
      });
    },
  });
}

export function useUpdateRow(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { rowId: string; data: Record<string, unknown> }) => updateRow(args.rowId, { data: args.data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
    },
  });
}

export function useUpdateCell(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { rowId: string; fieldId: string; value: unknown }) => {
      const result = await updateCell(args.rowId, args.fieldId, args.value);
      
      // Throw error if result contains error, so React Query's onError is called
      if ("error" in result) {
        throw new Error(result.error);
      }
      
      return result;
    },
    onMutate: async (args) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
      
      // Snapshot previous value
      const previous = qc.getQueryData<{ rows: TableRow[]; view?: any }>(
        queryKeys.tableRows(tableId, viewId)
      );
      
      // Optimistically update
      if (previous) {
        qc.setQueryData(queryKeys.tableRows(tableId, viewId), {
          ...previous,
          rows: previous.rows.map((row) =>
            row.id === args.rowId
              ? { ...row, data: { ...row.data, [args.fieldId]: args.value } }
              : row
          ),
        });
      }
      
      return { previous };
    },
    onError: (err, args, context) => {
      console.error("useUpdateCell onError:", err, args);
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(queryKeys.tableRows(tableId, viewId), context.previous);
      }
      // Re-throw so the component can handle it
      throw err;
    },
    onSuccess: (result) => {
      // Result is guaranteed to have data at this point (error would have thrown)
      if ("data" in result && result.data) {
        // Update cache with server response
        const key = queryKeys.tableRows(tableId, viewId);
        const existing = qc.getQueryData<{ rows: TableRow[]; view?: any }>(key);
        if (existing) {
          qc.setQueryData(key, {
            ...existing,
            rows: existing.rows.map((row) =>
              row.id === result.data.id ? result.data : row
            ),
          });
        }
      }
      // Invalidate to ensure consistency
      qc.invalidateQueries({ 
        queryKey: queryKeys.tableRows(tableId, viewId),
        refetchType: 'active'
      });
    },
  });
}

export function useDeleteRow(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) => deleteRow(rowId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
    },
  });
}

export function useDeleteRows(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) => deleteRows(rowIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
    },
  });
}

export function useReorderRows(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orders: Array<{ rowId: string; order: number | string }>) => reorderRows(tableId, orders),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
    },
  });
}

export function useDuplicateRow(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) => duplicateRow(rowId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
    },
  });
}

export function useTableRows(tableId: string, viewId?: string | null) {
  return useQuery({
    queryKey: queryKeys.tableRows(tableId, viewId),
    queryFn: async () => {
      const result = await getTableData({ tableId, viewId });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    staleTime: 10_000,
  });
}

export function useSearchTableRows(tableId: string, search: string) {
  return useQuery({
    queryKey: ['tableSearch', tableId, search],
    queryFn: async () => {
      if (!search) return [];
      const result = await searchTableRows(tableId, search);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(search),
  });
}

export function useFilteredRows(tableId: string, filters: FilterCondition[]) {
  return useQuery({
    // React Query handles deep equality checks automatically - no need for JSON.stringify
    queryKey: ['tableFiltered', tableId, filters] as const,
    queryFn: async () => {
      const result = await getFilteredRows(tableId, filters);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: filters.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function useTableView(viewId?: string | null) {
  return useQuery({
    queryKey: viewId ? queryKeys.tableView(viewId) : ['tableView', 'none'],
    queryFn: async () => {
      if (!viewId) return null;
      const result = await getView(viewId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(viewId),
  });
}

export function useTableViews(tableId: string) {
  return useQuery({
    queryKey: ['tableViews', tableId],
    queryFn: async () => {
      const result = await listViews(tableId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateView(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof createView>[0], "tableId">) =>
      createView({ ...input, tableId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useUpdateView(tableId: string, viewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<TableView>) => updateView(viewId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId, viewId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableView(viewId) });
    },
  });
}

export function useDeleteView(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) => deleteView(viewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
      qc.invalidateQueries({ queryKey: ['tableViews', tableId] });
    },
  });
}

export function useSetDefaultView(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) => setDefaultView(viewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
      qc.invalidateQueries({ queryKey: ['tableViews', tableId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useRowComments(rowId: string) {
  return useQuery({
    queryKey: queryKeys.tableComments(rowId),
    queryFn: async () => {
      const result = await getRowComments(rowId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    staleTime: 15_000,
  });
}

export function useCreateComment(rowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof createComment>[0], "rowId">) =>
      createComment({ ...input, rowId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableComments(rowId) });
    },
  });
}

export function useUpdateComment(rowId: string, commentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => updateComment(commentId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableComments(rowId) });
    },
  });
}

export function useDeleteComment(rowId: string, _commentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableComments(rowId) });
    },
  });
}

export function useResolveComment(rowId: string, _commentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { commentId: string; resolved: boolean }) =>
      resolveComment(args.commentId, args.resolved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableComments(rowId) });
    },
  });
}
