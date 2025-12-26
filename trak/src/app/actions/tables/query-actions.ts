"use server";

// Table refactor baseline (Sept 2024):
// - No server-side filtering/sorting exists yet; this file provides initial data fetch hooks for the new tables schema.
// - UI should pair this with React Query and evolve filters/grouping as we port the table-block.

import { requireTableAccess } from "./context";
import type { FilterCondition, SortCondition, TableRow, TableView } from "@/types/table";
import type { PostgrestFilterBuilder, PostgrestSingleResponse } from "@supabase/postgrest-js";

type ActionResult<T> = { data: T } | { error: string };

interface GetTableDataInput {
  tableId: string;
  viewId?: string | null;
}

export async function getTableData(input: GetTableDataInput): Promise<ActionResult<{ rows: TableRow[]; view?: TableView | null }>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return access;
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
      .select("*")
      .eq("table_id", input.tableId),
    filters
  );

  const sortedQuery = applyServerSorts(filteredQuery, sorts);

  const { data: rows, error } = await (sortedQuery as PostgrestFilterBuilder<any, any, any, any>)
    .order("order", { ascending: true });

  if (error || !rows) {
    return { error: "Failed to load rows" };
  }

  // Apply any operators not supported by SQL builder in-memory
  const filtered = unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);

  // If sorts include unsupported pieces, fall back to in-memory; otherwise trust DB order
  const sorted = unsupportedFilters.length > 0 ? applySorts(filtered, sorts) : filtered;

  return { data: { rows: sorted, view } };
}

export async function searchTableRows(tableId: string, query: string): Promise<ActionResult<TableRow[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { data: rows, error } = await supabase
    .from("table_rows")
    .select("*")
    .eq("table_id", tableId);

  if (error || !rows) {
    return { error: "Failed to search rows" };
  }

  const lowered = query.toLowerCase();
  const results = (rows as TableRow[]).filter((row) =>
    Object.values(row.data || {}).some((v) => String(v ?? "").toLowerCase().includes(lowered))
  );
  return { data: results };
}

export async function getFilteredRows(tableId: string, filters: FilterCondition[]): Promise<ActionResult<TableRow[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return access;
  const { supabase } = access;

  const { query, unsupportedFilters } = applyServerFilters(
    supabase.from("table_rows").select("*").eq("table_id", tableId),
    filters
  );

  // Execute the query
  const { data: rows, error } = await (query as PostgrestFilterBuilder<any, any, any, any>);

  if (error || !rows) {
    return { error: "Failed to fetch rows" };
  }

  const result = unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);
  return { data: result };
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
