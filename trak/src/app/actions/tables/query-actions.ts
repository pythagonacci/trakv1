"use server";

// Table refactor baseline (Sept 2024):
// - No server-side filtering/sorting exists yet; this file provides initial data fetch hooks for the new tables schema.
// - UI should pair this with React Query and evolve filters/grouping as we port the table-block.

import { requireTableAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { FilterCondition, SortCondition, TableRow, TableView, Table, TableField } from "@/types/table";
import type { PostgrestFilterBuilder, PostgrestSingleResponse } from "@supabase/postgrest-js";

type ActionResult<T> = { data: T } | { error: string };

interface GetTableDataInput {
  tableId: string;
  viewId?: string | null;
  authContext?: AuthContext;
  limit?: number;
  offset?: number;
}

export async function getTableData(input: GetTableDataInput): Promise<ActionResult<{ rows: TableRow[]; view?: TableView | null; hasMore?: boolean; nextOffset?: number | null; total?: number }>> {
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableData tableId=${input.tableId} viewId=${input.viewId ?? ""} limit=${input.limit ?? 100} offset=${input.offset ?? 0}`);
  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  let view: TableView | null = null;
  if (input.viewId) {
    const { data: viewData } = await supabase
      .from("table_views")
      .select("*")
      .eq("id", input.viewId)
      .eq("table_id", input.tableId)
      .maybeSingle();
    view = (viewData as TableView) || null;
  } else {
    const { data: defaultView } = await supabase
      .from("table_views")
      .select("*")
      .eq("table_id", input.tableId)
      .eq("is_default", true)
      .maybeSingle();
    view = (defaultView as TableView) || null;
  }

  const filters = view?.config?.filters || [];
  const sorts = view?.config?.sorts || [];

  const { query: filteredQuery, unsupportedFilters } = applyServerFilters(
    supabase
      .from("table_rows")
      .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by")
      .eq("table_id", input.tableId),
    filters
  );

  const sortedQuery = applyServerSorts(filteredQuery, sorts);

  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;

  const { data: rows, error, count } = await (sortedQuery as PostgrestFilterBuilder<any, any, any, any>)
    .order("order", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !rows) {
    return { error: "Failed to load rows" };
  }

  // Apply any operators not supported by SQL builder in-memory
  const filtered = unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);

  // If sorts include unsupported pieces, fall back to in-memory; otherwise trust DB order
  const sorted = unsupportedFilters.length > 0 ? applySorts(filtered, sorts) : filtered;

  const total = count ?? (rows as any[]).length;
  const rowCount = (rows as any[]).length;
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableData tableId=${input.tableId} viewId=${input.viewId ?? ""} rows=${rowCount} total=${total} ms=${Math.round(performance.now() - _t0)}`);
  return {
    data: {
      rows: sorted,
      view,
      hasMore: offset + (rows as any[]).length < total,
      nextOffset: offset + (rows as any[]).length < total ? offset + (rows as any[]).length : null,
      total
    }
  };
}

export async function searchTableRows(tableId: string, query: string): Promise<ActionResult<TableRow[]>> {
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] searchTableRows tableId=${tableId}`);
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Server-side search: cast JSONB data to text and use ILIKE for matching.
  // Stabilization fix — still seq scans on large tables; future: GIN/FTS indexes.
  const { data: rows, error } = await supabase
    .from("table_rows")
    .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by")
    .eq("table_id", tableId)
    .filter("data::text", "ilike", `%${query}%`)
    .limit(50);

  if (error || !rows) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] searchTableRows tableId=${tableId} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to search rows" };
  }
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] searchTableRows tableId=${tableId} count=${(rows as any[]).length} ms=${Math.round(performance.now() - _t0)}`);
  return { data: rows as TableRow[] };
}

export async function getFilteredRows(tableId: string, filters: FilterCondition[], opts?: { authContext?: AuthContext }): Promise<ActionResult<TableRow[]>> {
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getFilteredRows tableId=${tableId} filters=${filters.length}`);
  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { query, unsupportedFilters } = applyServerFilters(
    supabase.from("table_rows").select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by").eq("table_id", tableId),
    filters
  );

  // Execute the query
  const { data: rows, error } = await (query as PostgrestFilterBuilder<any, any, any, any>);

  if (error || !rows) {
    return { error: "Failed to fetch rows" };
  }

  const result = unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getFilteredRows tableId=${tableId} rows=${result.length} ms=${Math.round(performance.now() - _t0)}`);
  return { data: result };
}

export async function getTableRows(
  tableId: string,
  options?: { limit?: number; offset?: number; authContext?: AuthContext }
): Promise<ActionResult<{ rows: TableRow[]; total: number; hasMore: boolean }>> {
  const _t0 = performance.now();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableRows tableId=${tableId} limit=${limit} offset=${offset}`);
  const access = await requireTableAccess(tableId, { authContext: options?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: rows, count, error } = await supabase
    .from("table_rows")
    .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by", { count: "exact" })
    .eq("table_id", tableId)
    .order("order", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !rows) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableRows tableId=${tableId} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to load rows" };
  }

  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableRows tableId=${tableId} rows=${rows.length} total=${total} ms=${Math.round(performance.now() - _t0)}`);
  return { data: { rows: rows as TableRow[], total, hasMore } };
}

// ---------------------------------------------------------------------------
// Server-side builders with in-memory fallback
// ---------------------------------------------------------------------------

function applyServerFilters(
  query: PostgrestFilterBuilder<any, any, any, any>,
  filters: FilterCondition[]
): { query: PostgrestFilterBuilder<any, any, any, any>; unsupportedFilters: FilterCondition[] } {
  if (!filters || filters.length === 0) return { query, unsupportedFilters: [] };

  const unsupported: FilterCondition[] = [];
  let working = query;

  filters.forEach((filter) => {
    const column = `data->>${filter.fieldId}`;
    switch (filter.operator) {
      case "equals":
        working = working.filter(column, "eq", filter.value ?? null);
        break;
      case "not_equals":
        working = working.not(column, "eq", filter.value ?? null);
        break;
      case "contains":
        working = working.filter(column, "ilike", `%${filter.value ?? ""}%`);
        break;
      case "not_contains":
        working = working.not(column, "ilike", `%${filter.value ?? ""}%`);
        break;
      case "is_empty":
        working = working.or(`${column}.is.null,${column}.eq.`); // null or empty string
        break;
      case "is_not_empty":
        working = working.not(column, "is", null).not(column, "eq", "");
        break;
      case "greater_than":
        working = working.filter(column, "gt", filter.value);
        break;
      case "less_than":
        working = working.filter(column, "lt", filter.value);
        break;
      case "greater_or_equal":
        working = working.filter(column, "gte", filter.value);
        break;
      case "less_or_equal":
        working = working.filter(column, "lte", filter.value);
        break;
      default:
        unsupported.push(filter);
    }
  });

  return { query: working, unsupportedFilters: unsupported };
}

function applyServerSorts(query: PostgrestFilterBuilder<any, any, any, any>, sorts: SortCondition[]) {
  if (!sorts || sorts.length === 0) return query;
  let working = query;
  sorts.forEach((sort, idx) => {
    const column = idx === 0 ? "order" : `data->>${sort.fieldId}`;
    working = (working as any).order(column, { ascending: sort.direction === "asc", nullsFirst: false });
  });
  return working;
}

function applyFilters(rows: TableRow[], filters: FilterCondition[]): TableRow[] {
  if (!filters || filters.length === 0) return rows;

  return rows.filter((row) => {
    return filters.every((filter) => {
      const value = (row.data || {})[filter.fieldId];
      switch (filter.operator) {
        case "equals":
          return value === filter.value;
        case "not_equals":
          return value !== filter.value;
        case "contains":
          return String(value ?? "").toLowerCase().includes(String(filter.value ?? "").toLowerCase());
        case "not_contains":
          return !String(value ?? "").toLowerCase().includes(String(filter.value ?? "").toLowerCase());
        case "is_empty":
          return value === null || value === undefined || value === "";
        case "is_not_empty":
          return value !== null && value !== undefined && value !== "";
        case "greater_than":
          return Number(value) > Number(filter.value);
        case "less_than":
          return Number(value) < Number(filter.value);
        case "greater_or_equal":
          return Number(value) >= Number(filter.value);
        case "less_or_equal":
          return Number(value) <= Number(filter.value);
        default:
          return true;
      }
    });
  });
}

function applySorts(rows: TableRow[], sorts: SortCondition[]): TableRow[] {
  if (!sorts || sorts.length === 0) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const sort of sorts) {
      const aValue = (a.data || {})[sort.fieldId];
      const bValue = (b.data || {})[sort.fieldId];
      if (aValue === bValue) continue;
      if (aValue == null) return sort.direction === "asc" ? 1 : -1;
      if (bValue == null) return sort.direction === "asc" ? -1 : 1;
      if (aValue < bValue) return sort.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sort.direction === "asc" ? 1 : -1;
    }
    return 0;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Bootstrap: table + fields + default view + rows in one round trip
// ---------------------------------------------------------------------------

export type TableBootstrap = {
  table: Table;
  fields: TableField[];
  view: TableView | null;
  rows: TableRow[];
  totalRows: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export async function getTableBootstrap(
  tableId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<TableBootstrap>> {
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableBootstrap tableId=${tableId}`);

  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, table: authTable } = access;

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableBootstrap auth tableId=${tableId} ms=${Math.round(performance.now() - _t0)}`);
  const _tMeta = performance.now();

  // Reuse table from auth — only fetch fields + default view
  const [fieldsRes, viewRes] = await Promise.all([
    supabase.from("table_fields").select("*").eq("table_id", tableId).order("order", { ascending: true }),
    supabase.from("table_views").select("*").eq("table_id", tableId).eq("is_default", true).maybeSingle(),
  ]);

  if (fieldsRes.error || !fieldsRes.data) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableBootstrap tableId=${tableId} error=fields ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to load fields" };
  }

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableBootstrap meta tableId=${tableId} ms=${Math.round(performance.now() - _tMeta)} fields=${fieldsRes.data?.length}`);

  const table = authTable as Table;
  const fields = (fieldsRes.data as TableField[]) ?? [];
  const view = (viewRes.data as TableView) || null;
  const filters = view?.config?.filters || [];
  const sorts = view?.config?.sorts || [];

  const PAGE_LIMIT = 100;

  const _tRows = performance.now();
  const { query: filteredQuery, unsupportedFilters } = applyServerFilters(
    supabase.from("table_rows").select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by", { count: "exact", head: false }).eq("table_id", tableId),
    filters
  );
  const sortedQuery = applyServerSorts(filteredQuery, sorts);
  const { data: rows, error: rowsError, count } = await (sortedQuery as PostgrestFilterBuilder<any, any, any, any>)
    .order("order", { ascending: true })
    .limit(PAGE_LIMIT);

  if (rowsError || !rows) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableBootstrap tableId=${tableId} error=rows ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to load rows" };
  }

  const totalRows = count ?? rows.length;
  const payloadBytes = Buffer.byteLength(JSON.stringify(rows), 'utf8');
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTableBootstrap rows tableId=${tableId} ms=${Math.round(performance.now() - _tRows)} count=${rows.length} total=${totalRows} bytes=${payloadBytes} totalMs=${Math.round(performance.now() - _t0)}`);

  const filtered =
    unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);
  const sorted = unsupportedFilters.length > 0 ? applySorts(filtered, sorts) : filtered;

  return {
    data: {
      table,
      fields,
      view,
      rows: sorted,
      totalRows,
      hasMore: totalRows > PAGE_LIMIT,
      nextOffset: totalRows > PAGE_LIMIT ? PAGE_LIMIT : null,
    },
  };
}
