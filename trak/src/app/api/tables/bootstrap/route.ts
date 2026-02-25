import { NextResponse } from "next/server";
import { requireTableAccess } from "@/app/actions/tables/context";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { FilterCondition, SortCondition, TableField, TableRow, TableView, Table } from "@/types/table";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tableId = url.searchParams.get("tableId");

  if (!tableId) {
    return NextResponse.json({ error: "Missing tableId" }, { status: 400 });
  }

  console.log(`[PERF] route getTableBootstrap tableId=${tableId}`);

  const supabaseClient = await createClient();
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.log(`[PERF] route getTableBootstrap unauthorized tableId=${tableId} userError=${userError?.message ?? "none"}`);
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

      console.log(`[PERF] route getTableBootstrap fallback service role tableId=${tableId} userId=${user.id}`);
      supabase = service;
      authTable = table;
    } else {
      return NextResponse.json({ error: access.error ?? "Unknown error" }, { status: 403 });
    }
  }

  if (!authTable) {
    return NextResponse.json({ error: "Table not found" }, { status: 403 });
  }

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

  const { query: filteredQuery, unsupportedFilters } = applyServerFilters(
    supabase
      .from("table_rows")
      .select(
        "id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by",
        { count: "exact", head: false }
      )
      .eq("table_id", tableId),
    filters
  );
  const sortedQuery = applyServerSorts(filteredQuery, sorts);
  const { data: rows, error: rowsError, count } = await (sortedQuery as PostgrestFilterBuilder<any, any, any, any>)
    .order("order", { ascending: true })
    .limit(PAGE_LIMIT);

  if (rowsError || !rows) {
    return NextResponse.json({ error: "Failed to load rows" }, { status: 500 });
  }

  const totalRows = count ?? rows.length;

  const filtered =
    unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);
  const sorted = unsupportedFilters.length > 0 ? applySorts(filtered, sorts) : filtered;

  return NextResponse.json({
    table,
    fields,
    view,
    rows: sorted,
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
          return typeof value === "number" && typeof filter.value === "number" && value > filter.value;
        case "less_than":
          return typeof value === "number" && typeof filter.value === "number" && value < filter.value;
        case "greater_or_equal":
          return typeof value === "number" && typeof filter.value === "number" && value >= filter.value;
        case "less_or_equal":
          return typeof value === "number" && typeof filter.value === "number" && value <= filter.value;
        default:
          return true;
      }
    });
  });
}

function applySorts(rows: TableRow[], sorts: SortCondition[]): TableRow[] {
  if (!sorts || sorts.length === 0) return rows;

  return [...rows].sort((a, b) => {
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
}
