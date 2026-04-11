import { NextRequest, NextResponse } from "next/server";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { requireTableAccess } from "@/app/actions/tables/context";
import { applyTableRowSorts, shouldSortRowsInMemory } from "@/lib/tables/row-sorting";
import type { FilterCondition, SortCondition, TableField, TableRow, TableView } from "@/types/table";

export const dynamic = "force-dynamic";

type TableRowsQuery = PostgrestFilterBuilder<never, never, Record<string, unknown>, TableRow[]>;

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
  const sortFieldIds = Array.from(new Set(sorts.map((sort) => sort.fieldId)));
  const { data: sortFieldsData } = sortFieldIds.length > 0
    ? await supabase
        .from("table_fields")
        .select("id, type, config")
        .eq("table_id", tableId)
        .in("id", sortFieldIds)
    : { data: [] };
  const sortFields = (sortFieldsData ?? []) as Pick<TableField, "id" | "type" | "config">[];

  const buildFilteredQuery = () => {
    const baseQuery = supabase
      .from("table_rows")
      .select("id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by", { count: "exact", head: false })
      .eq("table_id", tableId);
    return applyServerFilters(
      baseQuery as unknown as TableRowsQuery,
      filters
    );
  };

  const { query: filteredQuery, unsupportedFilters } = buildFilteredQuery();
  const useInMemoryRows = unsupportedFilters.length > 0 || shouldSortRowsInMemory(sorts, sortFields);

  let pageRows: TableRow[];
  let total: number;

  if (useInMemoryRows) {
    const allRows: TableRow[] = [];
    const pageSize = 1000;
    for (let pageOffset = 0; ; pageOffset += pageSize) {
      const { query } = buildFilteredQuery();
      const { data: rowsPage, error } = await query
        .order("order", { ascending: true })
        .range(pageOffset, pageOffset + pageSize - 1);

      if (error || !rowsPage) {
        return NextResponse.json(
          { error: "Failed to load rows" },
          { status: 500 }
        );
      }

      allRows.push(...(rowsPage as TableRow[]));
      if (rowsPage.length < pageSize) break;
    }

    const filtered = unsupportedFilters.length > 0 ? applyFilters(allRows, unsupportedFilters) : allRows;
    const sorted = applyTableRowSorts(filtered, sorts, sortFields);
    total = sorted.length;
    pageRows = sorted.slice(offset, offset + limit);
  } else {
    const sortedQuery = applyServerSorts(filteredQuery, sorts);
    const { data: rows, error, count } = await sortedQuery
      .order("order", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error || !rows) {
      return NextResponse.json(
        { error: "Failed to load rows" },
        { status: 500 }
      );
    }

    pageRows = rows as TableRow[];
    total = count ?? pageRows.length;
  }

  const hasMore = offset + pageRows.length < total;
  const nextOffset = hasMore ? offset + pageRows.length : null;

  const ms = Math.round(Date.now() - t0);
  if (process.env.PERF_DEBUG === "1") {
    console.log(
      `[PERF] route getTableData tableId=${tableId} viewId=${viewId ?? ""} limit=${limit} offset=${offset} ms=${ms} rows=${pageRows.length} total=${total}`
    );
  }

  return NextResponse.json({
    data: { rows: pageRows, view, hasMore, nextOffset, total }
  });
}

function applyServerFilters(
  query: TableRowsQuery,
  filters: FilterCondition[]
): { query: TableRowsQuery; unsupportedFilters: FilterCondition[] } {
  if (!filters || filters.length === 0) return { query, unsupportedFilters: [] };

  const unsupported: FilterCondition[] = [];
  let working = query;

  filters.forEach((filter) => {
    const column = `data->>${filter.fieldId}`;
    const filterVal = filter.value;
    switch (filter.operator) {
      case "equals":
        working = working.filter(column, "eq", filterVal ?? null);
        break;
      case "not_equals":
        working = working.not(column, "eq", filterVal ?? null);
        break;
      case "contains":
        working = working.filter(column, "ilike", `%${filterVal ?? ""}%`);
        break;
      case "not_contains":
        working = working.not(column, "ilike", `%${filterVal ?? ""}%`);
        break;
      case "is_empty":
        working = working.or(`${column}.is.null,${column}.eq.`);
        break;
      case "is_not_empty":
        working = working.not(column, "is", null).not(column, "eq", "");
        break;
      case "greater_than":
        working = working.filter(column, "gt", filterVal);
        break;
      case "less_than":
        working = working.filter(column, "lt", filterVal);
        break;
      case "greater_or_equal":
        working = working.filter(column, "gte", filterVal);
        break;
      case "less_or_equal":
        working = working.filter(column, "lte", filterVal);
        break;
      case "is_before":
        if (typeof filterVal === "string") working = working.filter(column, "lt", filterVal);
        else unsupported.push(filter);
        break;
      case "is_after":
        if (typeof filterVal === "string") working = working.filter(column, "gt", filterVal);
        else unsupported.push(filter);
        break;
      case "is_on_or_before":
        if (typeof filterVal === "string") working = working.filter(column, "lte", filterVal);
        else unsupported.push(filter);
        break;
      case "is_on_or_after":
        if (typeof filterVal === "string") working = working.filter(column, "gte", filterVal);
        else unsupported.push(filter);
        break;
      case "is_within":
        unsupported.push(filter);
        break;
      default:
        unsupported.push(filter);
    }
  });

  return { query: working, unsupportedFilters: unsupported };
}

function applyServerSorts(query: TableRowsQuery, sorts: SortCondition[]) {
  if (!sorts || sorts.length === 0) return query;
  let working = query;
  sorts.forEach((sort) => {
    const column = `data->>${sort.fieldId}`;
    working = working.order(column, { ascending: sort.direction === "asc", nullsFirst: false });
  });
  return working;
}

function parseDateValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (typeof value === "object" && value !== null && "start" in (value as Record<string, unknown>)) {
    return String((value as { start?: unknown }).start ?? "").slice(0, 10) || null;
  }
  return null;
}

function applyFilters(rows: TableRow[], filters: FilterCondition[]): TableRow[] {
  if (!filters || filters.length === 0) return rows;

  return rows.filter((row) => {
    return filters.every((filter) => {
      const value = (row.data || {})[filter.fieldId];
      const fv = filter.value;
      switch (filter.operator) {
        case "equals":
          return value === fv;
        case "not_equals":
          return value !== fv;
        case "contains":
          return String(value ?? "").toLowerCase().includes(String(fv ?? "").toLowerCase());
        case "not_contains":
          return !String(value ?? "").toLowerCase().includes(String(fv ?? "").toLowerCase());
        case "is_empty":
          return value === null || value === undefined || value === "";
        case "is_not_empty":
          return value !== null && value !== undefined && value !== "";
        case "greater_than":
          return Number(value) > Number(fv);
        case "less_than":
          return Number(value) < Number(fv);
        case "greater_or_equal":
          return Number(value) >= Number(fv);
        case "less_or_equal":
          return Number(value) <= Number(fv);
        case "is_before":
          return parseDateValue(value) != null && (fv == null || parseDateValue(value)! < String(fv).slice(0, 10));
        case "is_after":
          return parseDateValue(value) != null && (fv == null || parseDateValue(value)! > String(fv).slice(0, 10));
        case "is_on_or_before":
          return parseDateValue(value) != null && (fv == null || parseDateValue(value)! <= String(fv).slice(0, 10));
        case "is_on_or_after":
          return parseDateValue(value) != null && (fv == null || parseDateValue(value)! >= String(fv).slice(0, 10));
        case "is_within": {
          const range = fv && typeof fv === "object" && "start" in (fv as object) && "end" in (fv as object)
            ? (fv as { start?: string; end?: string })
            : null;
          if (!range || (!range.start && !range.end)) return true;
          const rowDate = parseDateValue(value);
          const start = String(range.start ?? "").slice(0, 10);
          const end = String(range.end ?? "").slice(0, 10);
          if (!rowDate) return false;
          if (start && end) return rowDate >= start && rowDate <= end;
          if (start) return rowDate >= start;
          if (end) return rowDate <= end;
          return true;
        }
        default:
          return true;
      }
    });
  });
}
