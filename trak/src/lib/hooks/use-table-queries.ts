"use client";

// Table refactor baseline (Sept 2024):
// - Existing table UI is block-scoped (table-block.tsx) and reads from blocks.content via useTabBlocks/getTabBlocks.
// - No React Query hooks existed for the new Supabase-backed tables/fields/rows/views/comments; these hooks wrap the new server actions to ease migration.

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { createTable, getTable, updateTable, deleteTable, duplicateTable, listWorkspaceTables } from "@/app/actions/tables/table-actions";
import { createField, updateField, deleteField, reorderFields, updateFieldConfig } from "@/app/actions/tables/field-actions";
import {
  createRow,
  updateRow,
  updateCell,
  deleteRow,
  deleteRows,
  reorderRows,
  duplicateRow,
  setTableRowsSourceSyncMode,
  pushEditedSnapshotRowsToSource,
  refreshEditedSnapshotRowsFromSource,
} from "@/app/actions/tables/row-actions";
import { createView, getView, updateView, deleteView, setDefaultView, listViews } from "@/app/actions/tables/view-actions";
import { createComment, updateComment, deleteComment, resolveComment, getRowComments } from "@/app/actions/tables/comment-actions";
import { searchTableRows, getFilteredRows, getTableRows } from "@/app/actions/tables/query-actions";
import { getRelatedRows, configureRelationField } from "@/app/actions/tables/relation-actions";
import { bulkUpdateRows, bulkDeleteRows, bulkDuplicateRows, bulkInsertRows } from "@/app/actions/tables/bulk-actions";
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
    enabled: Boolean(tableId),
  });
}

/** Single round-trip load for table + fields + default view + rows. Use for initial render to avoid 3 parallel requests. */
export function useTableBootstrap(tableId: string) {
  return useQuery({
    queryKey: queryKeys.tableBootstrap(tableId),
    queryFn: async () => {
      const response = await fetch(`/api/tables/bootstrap?tableId=${encodeURIComponent(tableId)}`, {
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load table bootstrap");
      }
      return payload;
    },
    staleTime: 30_000,
    enabled: Boolean(tableId),
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTable,
    onSuccess: (result) => {
      if ("data" in result) {
        qc.invalidateQueries({ queryKey: queryKeys.workspace(result.data.table.workspace_id) });
        qc.invalidateQueries({ queryKey: ["workspaceTables", result.data.table.workspace_id] });
      }
    },
  });
}

export function useWorkspaceTables(workspaceId?: string) {
  return useQuery({
    queryKey: ["workspaceTables", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const result = await listWorkspaceTables(workspaceId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
  });
}

export function useUpdateTable(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Table>) => updateTable(tableId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
      qc.invalidateQueries({ queryKey: ["workspaceTables"] });
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
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
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
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
    },
  });
}

export function useDeleteField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => deleteField(fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
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

export function useConfigureRelationField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: configureRelationField,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function useCreateRow(tableId: string, _viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data?: Record<string, unknown> | { data?: Record<string, unknown>; order?: number | string | null }) => {
      const result =
        data && typeof data === "object" && ("data" in data || "order" in data)
          ? await createRow({
              tableId,
              data: (data as { data?: Record<string, unknown> }).data,
              order: (data as { order?: number | string | null }).order,
            })
          : await createRow({ tableId, data: data as Record<string, unknown> | undefined });

      if ("error" in result) {
        throw new Error(result.error || "Failed to create row");
      }

      return result;
    },
    onSuccess: (res) => {
      // Append the new row to all cached datasets for this table
      if ("data" in res && res.data) {
        const newRow = res.data as TableRow;
        qc.setQueriesData(
          { queryKey: ["tableRows", tableId] },
          (old: unknown) => {
            if (!old || typeof old !== "object") return old;
            if ("pages" in (old as Record<string, unknown>)) {
              const inf = old as { pages: Array<{ rows: TableRow[]; [k: string]: unknown }>; pageParams: unknown[] };
              // Append to last page
              const pages = inf.pages.map((page, i) =>
                i === inf.pages.length - 1
                  ? { ...page, rows: [...(page.rows ?? []), newRow] }
                  : page
              );
              return { ...inf, pages };
            }
            if ("rows" in (old as Record<string, unknown>)) {
              const reg = old as { rows: TableRow[]; [k: string]: unknown };
              return { ...reg, rows: [...(reg.rows ?? []), newRow] };
            }
            return old;
          }
        );
      }
      // Invalidate all tableRows queries for this table to ensure fresh data
      qc.invalidateQueries({ queryKey: ["tableRows", tableId], refetchType: "active" });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
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

// ---------------------------------------------------------------------------
// Cache shape helpers
// The perf refactor (commit 42c526d) switched table-view to useInfiniteTableRows,
// which stores data as { pages: [...], pageParams: [...] } under the same query key
// that useUpdateCell/useDeleteRow etc. previously assumed was { rows: [...] }.
// These helpers handle both shapes so optimistic updates work correctly.
// ---------------------------------------------------------------------------

function patchRowInCache(
  data: unknown,
  rowId: string,
  patch: (row: TableRow) => TableRow
): unknown {
  if (!data || typeof data !== "object") return data;
  if ("pages" in (data as Record<string, unknown>)) {
    const inf = data as { pages: Array<{ rows: TableRow[]; [k: string]: unknown }>; pageParams: unknown[] };
    return {
      ...inf,
      pages: inf.pages.map((page) => ({
        ...page,
        rows: (page.rows ?? []).map((row) => (row.id === rowId ? patch(row) : row)),
      })),
    };
  }
  if ("rows" in (data as Record<string, unknown>)) {
    const reg = data as { rows: TableRow[]; [k: string]: unknown };
    return { ...reg, rows: (reg.rows ?? []).map((row) => (row.id === rowId ? patch(row) : row)) };
  }
  return data;
}

function filterRowsInCache(data: unknown, predicate: (row: TableRow) => boolean): unknown {
  if (!data || typeof data !== "object") return data;
  if ("pages" in (data as Record<string, unknown>)) {
    const inf = data as { pages: Array<{ rows: TableRow[]; [k: string]: unknown }>; pageParams: unknown[] };
    return {
      ...inf,
      pages: inf.pages.map((page) => ({
        ...page,
        rows: (page.rows ?? []).filter(predicate),
      })),
    };
  }
  if ("rows" in (data as Record<string, unknown>)) {
    const reg = data as { rows: TableRow[]; [k: string]: unknown };
    return { ...reg, rows: (reg.rows ?? []).filter(predicate) };
  }
  return data;
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
      // Use broad prefix key — the exact viewId key used by useInfiniteTableRows diverges
      // from effectiveViewId after bootstrap loads (infinite uses undefined→'default', but
      // effectiveViewId resolves to the actual view UUID). Broad prefix catches both.
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      const previous = qc.getQueriesData({ queryKey: ["tableRows", tableId] });

      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) =>
          patchRowInCache(old, args.rowId, (row) => ({
            ...row,
            data: { ...row.data, [args.fieldId]: args.value },
          }))
      );

      return { previous };
    },
    onError: (err, args, context) => {
      console.error("useUpdateCell onError:", err, args);
      // Rollback on error
      (context?.previous ?? []).forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data);
      });
      // Re-throw so the component can handle it
      throw err;
    },
    onSuccess: (result) => {
      // Result is guaranteed to have data at this point (error would have thrown)
      if ("data" in result && result.data) {
        const updatedRow = result.data as TableRow;
        qc.setQueriesData(
          { queryKey: ["tableRows", tableId] },
          (old: unknown) => patchRowInCache(old, updatedRow.id, () => updatedRow)
        );
        // Source-linked row writeback: table cell update may have synced to source task/timeline; invalidate source caches so source view updates
        const st = (updatedRow as { source_entity_type?: string | null }).source_entity_type;
        const sid = (updatedRow as { source_entity_id?: string | null }).source_entity_id;
        if (st && sid) {
          qc.invalidateQueries({ queryKey: ["taskItems"] });
          qc.invalidateQueries({ queryKey: ["timelineItems"] });
          qc.invalidateQueries({ queryKey: queryKeys.entityProperties(st, sid) });
        }
      }
      // Invalidate to ensure consistency
      qc.invalidateQueries({ queryKey: ["tableRows", tableId], refetchType: "active" });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
    },
  });
}

export function useDeleteRow(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) => deleteRow(rowId),
    onMutate: async (rowId) => {
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      const previous = qc.getQueriesData({ queryKey: ["tableRows", tableId] });
      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => filterRowsInCache(old, (r) => r.id !== rowId)
      );
      return { previous };
    },
    onError: (_err, _rowId, context) => {
      (context?.previous ?? []).forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
    },
  });
}

export function useDeleteRows(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) => deleteRows(rowIds),
    onMutate: async (rowIds) => {
      const ids = new Set(rowIds);
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      const previous = qc.getQueriesData({ queryKey: ["tableRows", tableId] });
      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => filterRowsInCache(old, (r) => !ids.has(r.id))
      );
      return { previous };
    },
    onError: (_err, _rowIds, context) => {
      (context?.previous ?? []).forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
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

export function useTableRows(
  tableId: string,
  viewId?: string | null,
  opts?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.tableRows(tableId, viewId),
    queryFn: async () => {
      const params = new URLSearchParams({ tableId });
      if (viewId) params.set("viewId", viewId);
      const response = await fetch(`/api/tables/data?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || json?.error) throw new Error(json?.error || "Failed to load rows");
      return json.data;
    },
    staleTime: 10_000,
    enabled: opts?.enabled !== false && Boolean(tableId),
  });
}

export function useInfiniteTableRows(
  tableId: string,
  viewId?: string | null,
  opts?: { enabled?: boolean; initialData?: any }
) {
  return useInfiniteQuery({
    queryKey: queryKeys.tableRows(tableId, viewId),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        tableId,
        limit: "100",
        offset: String(pageParam as number),
      });
      if (viewId) params.set("viewId", viewId);
      const response = await fetch(`/api/tables/data?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || json?.error) throw new Error(json?.error || "Failed to load rows");
      return json.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : null,
    initialPageParam: 0,
    staleTime: 10_000,
    enabled: opts?.enabled !== false && Boolean(tableId),
    initialData: opts?.initialData ? {
      pages: [opts.initialData],
      pageParams: [0]
    } : undefined,
  });
}

export function useAllTableRows(tableId?: string) {
  return useQuery({
    queryKey: ["tableRowsAll", tableId],
    queryFn: async () => {
      if (!tableId) return [];
      const result = await getTableRows(tableId, { limit: 1000, offset: 0 });
      if ("error" in result) throw new Error(result.error);
      return result.data.rows;
    },
    enabled: Boolean(tableId),
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

export function useRelatedRows(rowId?: string, fieldId?: string) {
  return useQuery({
    queryKey: ["relatedRows", rowId, fieldId],
    queryFn: async () => {
      if (!rowId || !fieldId) return { rows: [], displayFieldId: null };
      const result = await getRelatedRows(rowId, fieldId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(rowId && fieldId),
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
      qc.invalidateQueries({ queryKey: ["tableViews", tableId] });
    },
  });
}

export function useUpdateView(tableId: string, defaultViewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<TableView> & { viewId?: string }) => {
      const { viewId, ...updates } = payload;
      const targetId = viewId ?? defaultViewId;
      return updateView(targetId, updates);
    },
    onMutate: async (payload) => {
      const { viewId, ...updates } = payload;
      const targetId = viewId ?? defaultViewId;
      await qc.cancelQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
      const previous = qc.getQueryData(queryKeys.tableBootstrap(tableId));
      qc.setQueryData(queryKeys.tableBootstrap(tableId), (old: any) => {
        if (!old?.view) return old;
        if (old.view.id !== targetId) return old;
        return { ...old, view: { ...old.view, ...updates } };
      });
      return { previous };
    },
    onError: (_err, _payload, context: any) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.tableBootstrap(tableId), context.previous);
      }
    },
    onSuccess: (_data, payload) => {
      const { viewId } = payload;
      const targetId = viewId ?? defaultViewId;
      // Invalidate all row queries for this table (default + any viewId) so filter/sort changes refetch
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
      qc.invalidateQueries({ queryKey: queryKeys.tableView(targetId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
      qc.invalidateQueries({ queryKey: ["tableViews", tableId] });
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
// Bulk operations
// ---------------------------------------------------------------------------

export function useBulkUpdateRows(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rowIds: string[]; updates: Record<string, unknown> }) =>
      bulkUpdateRows({ tableId, rowIds: input.rowIds, updates: input.updates }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
    },
  });
}

export function useBulkDeleteRows(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) => bulkDeleteRows({ tableId, rowIds }),
    onMutate: async (rowIds) => {
      const ids = new Set(rowIds);
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      const previous = qc.getQueriesData({ queryKey: ["tableRows", tableId] });
      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => filterRowsInCache(old, (r) => !ids.has(r.id))
      );
      return { previous };
    },
    onError: (_err, _rowIds, context) => {
      (context?.previous ?? []).forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
    },
  });
}

export function useBulkDuplicateRows(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowIds: string[]) => bulkDuplicateRows({ tableId, rowIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
    },
  });
}

export function useBulkInsertRows(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      rows: Array<{
        data: Record<string, unknown>;
        order?: number | string | null;
        source_entity_type?: "task" | "timeline_event" | "table_row" | null;
        source_entity_id?: string | null;
        source_sync_mode?: "snapshot" | "live" | null;
      }>
    ) =>
      bulkInsertRows({ tableId, rows }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
    },
  });
}

export function useSetTableRowsSourceSyncMode(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode: "snapshot" | "live";
      sourceEntityType?: "task" | "timeline_event" | "table_row";
    }) =>
      setTableRowsSourceSyncMode({
        tableId,
        mode: input.mode,
        sourceEntityType: input.sourceEntityType,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
    },
  });
}

export function usePushEditedSnapshotRows(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pushEditedSnapshotRowsToSource({ tableId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
    },
  });
}

export function useRefreshEditedSnapshotRows(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => refreshEditedSnapshotRowsFromSource({ tableId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tableRows(tableId) });
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
