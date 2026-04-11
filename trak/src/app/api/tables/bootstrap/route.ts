import { NextResponse } from "next/server";
import { requireTableAccess } from "@/app/actions/tables/context";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyTableRowSorts, shouldSortRowsInMemory } from "@/lib/tables/row-sorting";
import type { FilterCondition, SortCondition, TableField, TableRow, TableView, Table } from "@/types/table";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { formatPerfContext, getPerfRequestContext } from "@/lib/perf/perf-trace";

type TableRowsQuery = PostgrestFilterBuilder<never, never, Record<string, unknown>, TableRow[]>;

export async function GET(request: Request) {
  const t0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;
  const perfContext = getPerfRequestContext(request);
  const url = new URL(request.url);
  const tableId = url.searchParams.get("tableId");

  if (!tableId) {
    return NextResponse.json({ error: "Missing tableId" }, { status: 400 });
  }

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTableBootstrap tableId=${tableId}${formatPerfContext(perfContext)}`);

  const supabaseClient = await createClient();
  const tAuth0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTableBootstrap unauthorized tableId=${tableId} userError=${userError?.message ?? "none"}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireTableAccess(tableId, { authContext: { supabase: supabaseClient, userId: user.id } });
  let supabase = supabaseClient;
  let authTable = "table" in access ? access.table : null;

  if ("error" in access) {
    console.log(`[PERF] route getTableBootstrap denied tableId=${tableId} userId=${user.id} error=${access.error}`);

    if (access.error === "Table not found") {
      const service = await createServiceClient();
      const { data: table, error: tableError } = await service
        .from("tables")
        .select("*")
        .eq("id", tableId)
        .maybeSingle();

      if (tableError || !table) {
        return NextResponse.json({ error: "Table not found" }, { status: 403 });
      }

      const { data: membership } = await service
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", table.workspace_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
      }

      if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTableBootstrap fallback service role tableId=${tableId} userId=${user.id}`);
      supabase = service;
      authTable = table;
    } else {
      return NextResponse.json({ error: access.error ?? "Unknown error" }, { status: 403 });
    }
  }

  if (!authTable) {
    return NextResponse.json({ error: "Table not found" }, { status: 403 });
  }

  const tMeta0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;
  const [fieldsRes, viewRes] = await Promise.all([
    supabase.from("table_fields").select("*").eq("table_id", tableId).order("order", { ascending: true }),
    supabase.from("table_views").select("*").eq("table_id", tableId).eq("is_default", true).maybeSingle(),
  ]);

  if (fieldsRes.error || !fieldsRes.data) {
    return NextResponse.json({ error: "Failed to load fields" }, { status: 500 });
  }

  const table = authTable as Table;
  const fields = (fieldsRes.data as TableField[]) ?? [];
  const view = (viewRes.data as TableView) || null;
  const filters = view?.config?.filters || [];
  const sorts = view?.config?.sorts || [];

  const PAGE_LIMIT = 100;

  const buildFilteredQuery = () => {
    const baseQuery = supabase
      .from("table_rows")
      .select(
        "id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by",
        { count: "exact", head: false }
      )
      .eq("table_id", tableId);
    return applyServerFilters(
      baseQuery as unknown as TableRowsQuery,
      filters
    );
  };

  const { query: filteredQuery, unsupportedFilters } = buildFilteredQuery();
  const useInMemoryRows = unsupportedFilters.length > 0 || shouldSortRowsInMemory(sorts, fields);
  const tRows0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;

  let rows: TableRow[];
  let totalRows: number;

  if (useInMemoryRows) {
    const allRows: TableRow[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { query } = buildFilteredQuery();
      const { data: rowsPage, error: rowsError } = await query
        .order("order", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (rowsError || !rowsPage) {
        return NextResponse.json({ error: "Failed to load rows" }, { status: 500 });
      }

      allRows.push(...(rowsPage as TableRow[]));
      if (rowsPage.length < pageSize) break;
    }

    const filtered =
      unsupportedFilters.length > 0 ? applyFilters(allRows, unsupportedFilters) : allRows;
    const sorted = applyTableRowSorts(filtered, sorts, fields);
    totalRows = sorted.length;
    rows = sorted.slice(0, PAGE_LIMIT);
  } else {
    const sortedQuery = applyServerSorts(filteredQuery, sorts);
    const { data: rowsData, error: rowsError, count } = await sortedQuery
      .order("order", { ascending: true })
      .limit(PAGE_LIMIT);

    if (rowsError || !rowsData) {
      return NextResponse.json({ error: "Failed to load rows" }, { status: 500 });
    }

    rows = rowsData as TableRow[];
    totalRows = count ?? rows.length;
  }

  if (process.env.PERF_DEBUG === "1") {
    const payload = {
      table,
      fields,
      view,
      rows,
      totalRows,
      hasMore: totalRows > PAGE_LIMIT,
      nextOffset: totalRows > PAGE_LIMIT ? PAGE_LIMIT : null,
    };
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
    console.log(
      `[PERF] route getTableBootstrap tableId=${tableId} authMs=${Math.round(tMeta0 - tAuth0)} metaMs=${Math.round(tRows0 - tMeta0)} rowsMs=${Math.round(performance.now() - tRows0)} fields=${fields.length} rows=${rows.length} totalRows=${totalRows} unsupportedFilters=${unsupportedFilters.length} payloadBytes=${payloadBytes} totalMs=${Math.round(performance.now() - t0)}${formatPerfContext(perfContext)}`
    );
  }

  return NextResponse.json({
    table,
    fields,
    view,
    rows,
    totalRows,
    hasMore: totalRows > PAGE_LIMIT,
    nextOffset: totalRows > PAGE_LIMIT ? PAGE_LIMIT : null,
  });
}

// ---------------------------------------------------------------------------
// Server-side builders with in-memory fallback
// (copied from query-actions to avoid Server Action coupling)
// ---------------------------------------------------------------------------

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
          return typeof value === "number" && typeof fv === "number" && value > fv;
        case "less_than":
          return typeof value === "number" && typeof fv === "number" && value < fv;
        case "greater_or_equal":
          return typeof value === "number" && typeof fv === "number" && value >= fv;
        case "less_or_equal":
          return typeof value === "number" && typeof fv === "number" && value <= fv;
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
