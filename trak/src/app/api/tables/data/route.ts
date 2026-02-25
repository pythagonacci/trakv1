import { NextRequest, NextResponse } from "next/server";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { requireTableAccess } from "@/app/actions/tables/context";
import type { FilterCondition, SortCondition, TableRow, TableView } from "@/types/table";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tableId = url.searchParams.get("tableId");
  const viewId = url.searchParams.get("viewId");
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  if (!tableId) {
    return NextResponse.json(
      { error: "Missing tableId" },
      { status: 400 }
    );
  }

  const limit = Number.isFinite(Number(limitParam)) ? Number(limitParam) : 100;
  const offset = Number.isFinite(Number(offsetParam)) ? Number(offsetParam) : 0;
  const t0 = Date.now();

  const access = await requireTableAccess(tableId);
  if ("error" in access) {
    const status =
      access.error === "Unauthorized" ? 401 :
      access.error === "Not a member of this workspace" ? 403 :
      access.error === "Table not found" ? 404 :
      500;
    return NextResponse.json(
      { error: access.error ?? "Unknown error" },
      { status }
    );
  }

  const { supabase } = access;

  let view: TableView | null = null;
  if (viewId) {
    const { data: viewData } = await supabase
      .from("table_views")
      .select("*")
      .eq("id", viewId)
      .eq("table_id", tableId)
      .maybeSingle();
    view = (viewData as TableView) || null;
  } else {
    const { data: defaultView } = await supabase
      .from("table_views")
      .select("*")
      .eq("table_id", tableId)
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
      .eq("table_id", tableId),
    filters
  );

  const sortedQuery = applyServerSorts(filteredQuery, sorts);

  const { data: rows, error, count } = await (sortedQuery as PostgrestFilterBuilder<any, any, any, any>)
    .order("order", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !rows) {
    return NextResponse.json(
      { error: "Failed to load rows" },
      { status: 500 }
    );
  }

  const filtered = unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);
  const sorted = unsupportedFilters.length > 0 ? applySorts(filtered, sorts) : filtered;

  const total = count ?? (rows as any[]).length;
  const hasMore = offset + (rows as any[]).length < total;
  const nextOffset = hasMore ? offset + (rows as any[]).length : null;

  const ms = Math.round(Date.now() - t0);
  console.log(
    `[PERF] route getTableData tableId=${tableId} viewId=${viewId ?? ""} limit=${limit} offset=${offset} ms=${ms} rows=${rows?.length ?? 0} total=${total}`
  );

  return NextResponse.json({
    data: { rows: sorted, view, hasMore, nextOffset, total }
  });
}

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
        working = working.or(`${column}.is.null,${column}.eq.`);
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
