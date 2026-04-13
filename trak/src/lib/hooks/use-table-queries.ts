"use client";

// Table refactor baseline (Sept 2024):
// - Existing table UI is block-scoped (table-block.tsx) and reads from blocks.content via useTabBlocks/getTabBlocks.
// - No React Query hooks existed for the new Supabase-backed tables/fields/rows/views/comments; these hooks wrap the new server actions to ease migration.

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { useProjectUndo } from "@/app/dashboard/projects/[projectId]/project-undo-context";
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
import {
  buildClientPerfHeaders,
  getCurrentPerfNavigationId,
  logClientPerf,
} from "@/lib/perf/perf-trace";

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
      const navigationId = getCurrentPerfNavigationId();
      logClientPerf(
        `[PERF] client useTableBootstrap nav=${navigationId ?? "none"} tableId=${tableId}`
      );
      const response = await fetch(`/api/tables/bootstrap?tableId=${encodeURIComponent(tableId)}`, {
        credentials: "include",
        headers: buildClientPerfHeaders({
          navigationId,
          source: "useTableBootstrap",
        }),
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
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof createField>[0], "tableId">) =>
      createField({ ...input, tableId }),
    onSuccess: (result, input) => {
      if ("data" in result && result.data) {
        const field = result.data;
        let currentFieldId = field.id;
        projectUndo.registerAction({
          id: `table-field-create-${field.id}-${Date.now()}`,
          label: "column create",
          undo: async () => {
            const deleteResult = await deleteField(currentFieldId);
            if ("error" in deleteResult) throw new Error(deleteResult.error);
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
          redo: async () => {
            const createResult = await createField({ ...input, tableId, order: field.order, width: field.width });
            if ("error" in createResult) throw new Error(createResult.error);
            currentFieldId = createResult.data.id;
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
    },
  });
}

export function useUpdateField(tableId: string) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (args: { id: string; updates: Partial<TableField> }) => updateField(args.id, args.updates),
    onMutate: (args) => {
      const previous = qc.getQueryData<{ fields?: TableField[] }>(queryKeys.tableBootstrap(tableId))
        ?.fields?.find((field) => field.id === args.id);
      return { previous };
    },
    onSuccess: (result, args, context) => {
      if ("data" in result && result.data && context?.previous) {
        const previous = context.previous;
        const next = result.data;
        projectUndo.registerAction({
          id: `table-field-update-${args.id}-${Date.now()}`,
          label: "column update",
          undo: async () => {
            const undoResult = await updateField(args.id, {
              name: previous.name,
              type: previous.type,
              config: previous.config,
              is_primary: previous.is_primary,
              width: previous.width,
            });
            if ("error" in undoResult) throw new Error(undoResult.error);
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
          redo: async () => {
            const redoResult = await updateField(args.id, {
              name: next.name,
              type: next.type,
              config: next.config,
              is_primary: next.is_primary,
              width: next.width,
            });
            if ("error" in redoResult) throw new Error(redoResult.error);
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
    },
  });
}

export function useDeleteField(tableId: string) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (fieldId: string) => deleteField(fieldId),
    onMutate: (fieldId) => {
      const previous = qc.getQueryData<{ fields?: TableField[] }>(queryKeys.tableBootstrap(tableId))
        ?.fields?.find((field) => field.id === fieldId);
      return { previous };
    },
    onSuccess: (result, _fieldId, context) => {
      if ("error" in result) return;
      if (context?.previous) {
        const field = context.previous;
        let currentFieldId = field.id;
        projectUndo.registerAction({
          id: `table-field-delete-${field.id}-${Date.now()}`,
          label: "column delete",
          undo: async () => {
            const result = await createField({
              tableId,
              name: field.name,
              type: field.type,
              config: field.config ? (field.config as Record<string, unknown>) : undefined,
              order: field.order,
              isPrimary: field.is_primary,
              width: field.width,
            });
            if ("error" in result) throw new Error(result.error);
            currentFieldId = result.data.id;
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
          redo: async () => {
            const result = await deleteField(currentFieldId);
            if ("error" in result && result.error !== "Field not found") throw new Error(result.error);
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
        });
      }
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
    },
  });
}

export function useReorderFields(tableId: string) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();

  const setCachedFieldOrder = (orderedFields: TableField[]) => {
    const tableKey = queryKeys.table(tableId);
    const existing = qc.getQueryData<{ table: Table; fields: TableField[] }>(tableKey);
    if (existing) {
      qc.setQueryData(tableKey, {
        ...existing,
        fields: orderedFields,
      });
    }

    const bootstrapKey = queryKeys.tableBootstrap(tableId);
    const existingBootstrap = qc.getQueryData<{ fields?: TableField[] }>(bootstrapKey);
    if (existingBootstrap) {
      qc.setQueryData(bootstrapKey, {
        ...existingBootstrap,
        fields: orderedFields,
      });
    }
  };

  const applyFieldOrder = async (orders: Array<{ fieldId: string; order: number }>) => {
    const result = await reorderFields(tableId, orders);
    if ("error" in result) throw new Error(result.error);
    if (result.data) {
      setCachedFieldOrder(result.data);
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) }),
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) }),
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) }),
    ]);
  };

  return useMutation({
    mutationFn: async (orders: Array<{ fieldId: string; order: number }>) => {
      const result = await reorderFields(tableId, orders);
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onMutate: async (orders) => {
      // Cancel outgoing refetches
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeys.table(tableId) }),
        qc.cancelQueries({ queryKey: queryKeys.tableBootstrap(tableId) }),
      ]);

      // Snapshot previous value
      const previous = qc.getQueryData<{ table: Table; fields: TableField[] }>(
        queryKeys.table(tableId)
      );
      const previousBootstrap = qc.getQueryData<{ fields?: TableField[] }>(
        queryKeys.tableBootstrap(tableId)
      );
      const previousFields = previousBootstrap?.fields ?? previous?.fields ?? [];
      const orderMap = new Map(orders.map(o => [o.fieldId, o.order]));
      const reorderCachedFields = (fields: TableField[]) =>
        fields
          .map((field) => {
            const nextOrder = orderMap.get(field.id);
            return nextOrder === undefined ? field : { ...field, order: nextOrder };
          })
          .sort((a, b) => {
            const orderA = a.order ?? 0;
            const orderB = b.order ?? 0;
            return orderA - orderB;
          });

      // Optimistically update field order
      if (previous) {
        qc.setQueryData(queryKeys.table(tableId), {
          ...previous,
          fields: reorderCachedFields(previous.fields),
        });
      }
      if (previousBootstrap?.fields) {
        qc.setQueryData(queryKeys.tableBootstrap(tableId), {
          ...previousBootstrap,
          fields: reorderCachedFields(previousBootstrap.fields),
        });
      }
      const previousOrders = previousFields.map((field) => ({ fieldId: field.id, order: field.order ?? 0 }));
      const nextOrders = orders.map((order) => ({ ...order }));

      return { previous, previousBootstrap, previousOrders, nextOrders };
    },
    onError: (err, orders, context) => {
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(queryKeys.table(tableId), context.previous);
      }
      if (context?.previousBootstrap) {
        qc.setQueryData(queryKeys.tableBootstrap(tableId), context.previousBootstrap);
      }
      console.error("Failed to reorder fields:", err);
    },
    onSuccess: (result, _orders, context) => {
      // Update with server response if available
      if ("data" in result && result.data) {
        setCachedFieldOrder(result.data);
        if (context?.previousOrders.length && context.previousOrders.length === context.nextOrders.length) {
          projectUndo.registerAction({
            id: `table-column-reorder-${tableId}-${Date.now()}`,
            label: "column move",
            undo: () => applyFieldOrder(context.previousOrders),
            redo: () => applyFieldOrder(context.nextOrders),
          });
        }
      }
      // Invalidate to ensure consistency
      qc.invalidateQueries({ queryKey: queryKeys.tableFields(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.table(tableId) });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
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

type CreateRowMutationInput =
  | Record<string, unknown>
  | { id?: string; data?: Record<string, unknown>; order?: number | string | null }
  | undefined;

type ParsedCreateRowMutationInput = {
  id?: string;
  data?: Record<string, unknown>;
  order?: number | string | null;
};

type CachedRowsPage = {
  rows?: TableRow[];
  total?: number;
  [key: string]: unknown;
};

function isCreateRowOptions(input: CreateRowMutationInput): input is ParsedCreateRowMutationInput {
  return Boolean(
    input &&
      typeof input === "object" &&
      ("id" in input || "data" in input || "order" in input)
  );
}

function parseCreateRowInput(input: CreateRowMutationInput): ParsedCreateRowMutationInput {
  if (isCreateRowOptions(input)) {
    return {
      id: typeof input.id === "string" ? input.id : undefined,
      data: input.data,
      order: input.order,
    };
  }
  return { data: input as Record<string, unknown> | undefined };
}

function createClientRowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `optimistic-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getRowOrderValue(order: unknown) {
  const numeric = typeof order === "number" ? order : Number.parseFloat(String(order ?? ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function sortRowsByOrder(rows: TableRow[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = getRowOrderValue(a.row.order) - getRowOrderValue(b.row.order);
      return diff === 0 ? a.index - b.index : diff;
    })
    .map(({ row }) => row);
}

function collectRowsFromCache(data: unknown): TableRow[] {
  if (!data || typeof data !== "object") return [];
  if ("pages" in (data as Record<string, unknown>)) {
    const inf = data as { pages?: CachedRowsPage[] };
    return (inf.pages ?? []).flatMap((page) => page.rows ?? []);
  }
  if ("rows" in (data as Record<string, unknown>)) {
    const reg = data as { rows?: TableRow[] };
    return reg.rows ?? [];
  }
  return [];
}

function inferNextRowOrder(cachedRows: TableRow[]) {
  if (cachedRows.length === 0) return 1;
  return Math.max(...cachedRows.map((row) => getRowOrderValue(row.order))) + 1;
}

function withAdjustedRowCount<T extends Record<string, unknown>>(input: T, delta: number): T {
  const next: Record<string, unknown> = { ...input };
  if (typeof next.total === "number") next.total += delta;
  if (typeof next.totalRows === "number") next.totalRows += delta;
  return next as T;
}

function upsertRowArray(rows: TableRow[], row: TableRow, matchId?: string) {
  const matchIds = new Set([row.id, matchId].filter((id): id is string => Boolean(id)));
  let replaced = false;
  const nextRows: TableRow[] = [];

  for (const existing of rows) {
    if (matchIds.has(existing.id)) {
      if (!replaced) nextRows.push(row);
      replaced = true;
    } else {
      nextRows.push(existing);
    }
  }

  if (!replaced) nextRows.push(row);
  return { rows: sortRowsByOrder(nextRows), inserted: !replaced };
}

function upsertRowInCache(data: unknown, row: TableRow, matchId?: string): unknown {
  if (!data || typeof data !== "object") return data;
  if ("pages" in (data as Record<string, unknown>)) {
    const inf = data as { pages: CachedRowsPage[]; pageParams: unknown[]; [key: string]: unknown };
    if (inf.pages.length === 0) {
      return { ...inf, pages: [{ rows: [row], total: 1, hasMore: false }], pageParams: [0] };
    }

    let replaced = false;
    const pages = inf.pages.map((page) => {
      const result = upsertRowArray(page.rows ?? [], row, matchId);
      if (!result.inserted) replaced = true;
      return result.inserted ? page : { ...page, rows: result.rows };
    });

    if (!replaced) {
      const lastPageIndex = pages.length - 1;
      const lastPage = pages[lastPageIndex];
      const result = upsertRowArray(lastPage.rows ?? [], row, matchId);
      pages[lastPageIndex] = withAdjustedRowCount({ ...lastPage, rows: result.rows }, 1);
    }

    return { ...inf, pages };
  }
  if ("rows" in (data as Record<string, unknown>)) {
    const reg = data as { rows: TableRow[]; [key: string]: unknown };
    const result = upsertRowArray(reg.rows ?? [], row, matchId);
    const next = { ...reg, rows: result.rows };
    return result.inserted ? withAdjustedRowCount(next, 1) : next;
  }
  return data;
}

function removeRowFromCache(data: unknown, rowId: string): unknown {
  if (!data || typeof data !== "object") return data;
  if ("pages" in (data as Record<string, unknown>)) {
    const inf = data as { pages: CachedRowsPage[]; pageParams: unknown[]; [key: string]: unknown };
    let removedCount = 0;
    const pages = inf.pages.map((page) => {
      const rows = page.rows ?? [];
      const nextRows = rows.filter((row) => row.id !== rowId);
      const pageRemovedCount = rows.length - nextRows.length;
      removedCount += pageRemovedCount;
      return pageRemovedCount === 0
        ? page
        : withAdjustedRowCount({ ...page, rows: nextRows }, -pageRemovedCount);
    });
    return removedCount > 0 ? { ...inf, pages } : data;
  }
  if ("rows" in (data as Record<string, unknown>)) {
    const reg = data as { rows: TableRow[]; [key: string]: unknown };
    const nextRows = (reg.rows ?? []).filter((row) => row.id !== rowId);
    const removedCount = (reg.rows ?? []).length - nextRows.length;
    return removedCount > 0 ? withAdjustedRowCount({ ...reg, rows: nextRows }, -removedCount) : data;
  }
  return data;
}

function buildOptimisticRow(
  tableId: string,
  input: ParsedCreateRowMutationInput,
  cachedRows: TableRow[]
): TableRow {
  const now = new Date().toISOString();
  const order = input.order ?? inferNextRowOrder(cachedRows);
  return {
    id: input.id ?? createClientRowId(),
    table_id: tableId,
    source_entity_type: null,
    source_entity_id: null,
    source_sync_mode: null as unknown as TableRow["source_sync_mode"],
    data: input.data ?? {},
    order: String(order),
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    edited: false,
  };
}

export function useCreateRow(tableId: string, _viewId?: string | null) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: async (data?: CreateRowMutationInput) => {
      const parsed = parseCreateRowInput(data);
      const result = await createRow({
        tableId,
        id: parsed.id,
        data: parsed.data,
        order: parsed.order,
      });

      if ("error" in result) {
        throw new Error(result.error || "Failed to create row");
      }

      return result;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      await qc.cancelQueries({ queryKey: queryKeys.tableBootstrap(tableId) });

      const parsed = parseCreateRowInput(input);
      const rowCaches = qc.getQueriesData({ queryKey: ["tableRows", tableId] });
      const bootstrap = qc.getQueryData(queryKeys.tableBootstrap(tableId));
      const cachedRows = [
        ...rowCaches.flatMap(([, data]) => collectRowsFromCache(data)),
        ...collectRowsFromCache(bootstrap),
      ];
      const optimisticRow = buildOptimisticRow(tableId, parsed, cachedRows);

      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => upsertRowInCache(old, optimisticRow)
      );
      qc.setQueryData(
        queryKeys.tableBootstrap(tableId),
        (old: unknown) => upsertRowInCache(old, optimisticRow)
      );

      return {
        optimisticRowId: optimisticRow.id,
      };
    },
    onError: (_err, _input, context) => {
      if (!context?.optimisticRowId) return;
      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => removeRowFromCache(old, context.optimisticRowId)
      );
      qc.setQueryData(
        queryKeys.tableBootstrap(tableId),
        (old: unknown) => removeRowFromCache(old, context.optimisticRowId)
      );
    },
    onSuccess: (res, _input, context) => {
      if ("data" in res && res.data) {
        const newRow = res.data as TableRow;
        qc.setQueriesData(
          { queryKey: ["tableRows", tableId] },
          (old: unknown) => upsertRowInCache(old, newRow, context?.optimisticRowId)
        );
        qc.setQueryData(
          queryKeys.tableBootstrap(tableId),
          (old: unknown) => upsertRowInCache(old, newRow, context?.optimisticRowId)
        );
        projectUndo.registerAction({
          id: `table-row-create-${newRow.id}-${Date.now()}`,
          label: "row create",
          undo: async () => {
            const result = await deleteRow(newRow.id);
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
          redo: async () => {
            const result = await createRow({
              tableId,
              id: newRow.id,
              data: newRow.data,
              order: newRow.order,
            });
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
            qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
          },
        });
      }
    },
  });
}

export function useUpdateRow(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (args: { rowId: string; data: Record<string, unknown> }) => updateRow(args.rowId, { data: args.data }),
    onMutate: (args) => {
      const previousRows = qc.getQueriesData({ queryKey: ["tableRows", tableId] })
        .flatMap(([, data]) => collectRowsFromCache(data));
      const previous = previousRows.find((row) => row.id === args.rowId);
      return { previous };
    },
    onSuccess: (result, args, context) => {
      if ("data" in result && result.data && context?.previous) {
        const next = result.data as TableRow;
        const previous = context.previous;
        projectUndo.registerAction({
          id: `table-row-update-${args.rowId}-${Date.now()}`,
          label: "row update",
          undo: async () => {
            const undoResult = await updateRow(args.rowId, { data: previous.data });
            if ("error" in undoResult) throw new Error(undoResult.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
          redo: async () => {
            const redoResult = await updateRow(args.rowId, { data: next.data });
            if ("error" in redoResult) throw new Error(redoResult.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
        });
      }
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
  const projectUndo = useProjectUndo();
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
      const previousRows = previous.flatMap(([, data]) => collectRowsFromCache(data));
      const previousRow = previousRows.find((row) => row.id === args.rowId);
      const previousValue = previousRow?.data?.[args.fieldId];

      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) =>
          patchRowInCache(old, args.rowId, (row) => ({
            ...row,
            data: { ...row.data, [args.fieldId]: args.value },
          }))
      );

      return { previous, previousValue, hadPreviousRow: Boolean(previousRow) };
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
    onSuccess: (result, args, context) => {
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
        if (context?.hadPreviousRow) {
          projectUndo.registerAction({
            id: `table-cell-update-${args.rowId}-${args.fieldId}-${Date.now()}`,
            label: "cell edit",
            undo: async () => {
              const undoResult = await updateCell(args.rowId, args.fieldId, context.previousValue);
              if ("error" in undoResult) throw new Error(undoResult.error);
              qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
            },
            redo: async () => {
              const redoResult = await updateCell(args.rowId, args.fieldId, args.value);
              if ("error" in redoResult) throw new Error(redoResult.error);
              qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
            },
          });
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
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (rowId: string) => deleteRow(rowId),
    onMutate: async (rowId) => {
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      const previous = qc.getQueriesData({ queryKey: ["tableRows", tableId] });
      const deletedRow = previous.flatMap(([, data]) => collectRowsFromCache(data)).find((row) => row.id === rowId);
      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => filterRowsInCache(old, (r) => r.id !== rowId)
      );
      return { previous, deletedRow };
    },
    onError: (_err, _rowId, context) => {
      (context?.previous ?? []).forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data);
      });
    },
    onSuccess: (result, rowId, context) => {
      if ("error" in result) return;
      if (context?.deletedRow) {
        const deletedRow = context.deletedRow;
        projectUndo.registerAction({
          id: `table-row-delete-${rowId}-${Date.now()}`,
          label: "row delete",
          undo: async () => {
            const result = await createRow({
              tableId,
              id: deletedRow.id,
              data: deletedRow.data,
              order: deletedRow.order,
            });
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
          redo: async () => {
            const result = await deleteRow(deletedRow.id);
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
    },
  });
}

export function useDeleteRows(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (rowIds: string[]) => deleteRows(rowIds),
    onMutate: async (rowIds) => {
      const ids = new Set(rowIds);
      await qc.cancelQueries({ queryKey: ["tableRows", tableId] });
      const previous = qc.getQueriesData({ queryKey: ["tableRows", tableId] });
      const deletedRows = previous.flatMap(([, data]) => collectRowsFromCache(data)).filter((row) => ids.has(row.id));
      qc.setQueriesData(
        { queryKey: ["tableRows", tableId] },
        (old: unknown) => filterRowsInCache(old, (r) => !ids.has(r.id))
      );
      return { previous, deletedRows };
    },
    onError: (_err, _rowIds, context) => {
      (context?.previous ?? []).forEach(([key, data]) => {
        if (data !== undefined) qc.setQueryData(key, data);
      });
    },
    onSuccess: (result, rowIds, context) => {
      if ("error" in result) return;
      if (context?.deletedRows && context.deletedRows.length > 0) {
        const deletedRows = context.deletedRows;
        projectUndo.registerAction({
          id: `table-rows-delete-${Date.now()}`,
          label: "row delete",
          undo: async () => {
            const results = await Promise.all(
              deletedRows.map((row) =>
                createRow({ tableId, id: row.id, data: row.data, order: row.order })
              )
            );
            const failed = results.find((createResult) => "error" in createResult);
            if (failed && "error" in failed) throw new Error(failed.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
          redo: async () => {
            const result = await deleteRows(rowIds);
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
      qc.invalidateQueries({ queryKey: queryKeys.tableBootstrap(tableId) });
    },
  });
}

export function useReorderRows(tableId: string, viewId?: string | null) {
  const qc = useQueryClient();
  const projectUndo = useProjectUndo();
  return useMutation({
    mutationFn: (orders: Array<{ rowId: string; order: number | string }>) => reorderRows(tableId, orders),
    onMutate: (orders) => {
      const ids = new Set(orders.map((order) => order.rowId));
      const previousRows = qc.getQueriesData({ queryKey: ["tableRows", tableId] })
        .flatMap(([, data]) => collectRowsFromCache(data))
        .filter((row) => ids.has(row.id));
      const previousOrders = previousRows.map((row) => ({ rowId: row.id, order: row.order }));
      return { previousOrders, nextOrders: orders.map((order) => ({ ...order })) };
    },
    onSuccess: (result, _orders, context) => {
      if ("error" in result) return;
      if (context?.previousOrders.length) {
        projectUndo.registerAction({
          id: `table-row-reorder-${Date.now()}`,
          label: "row move",
          undo: async () => {
            const result = await reorderRows(tableId, context.previousOrders);
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
          redo: async () => {
            const result = await reorderRows(tableId, context.nextOrders);
            if ("error" in result) throw new Error(result.error);
            qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
          },
        });
      }
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
  const trimmedSearch = search.trim();
  return useQuery({
    queryKey: ['tableSearch', tableId, trimmedSearch],
    queryFn: async () => {
      if (!trimmedSearch) return [];
      const result = await searchTableRows(tableId, trimmedSearch);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(tableId && trimmedSearch),
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
      qc.invalidateQueries({ queryKey: ["tableRows", tableId] });
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
