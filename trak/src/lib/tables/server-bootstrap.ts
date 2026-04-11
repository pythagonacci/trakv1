import type { FilterCondition, SortCondition, TableField, TableView, TableRow, Table } from "@/types/table";
import { applyTableRowSorts, shouldSortRowsInMemory } from "@/lib/tables/row-sorting";

const PAGE_LIMIT = 100;

export type TableBootstrapData = {
  table: Table;
  fields: TableField[];
  view: TableView | null;
  rows: TableRow[];
  totalRows: number;
  hasMore: boolean;
  nextOffset: number | null;
};

/**
 * Builds an optimistic TableBootstrapData payload with the exact shape the
 * server returns for a freshly-created table (3 text columns, 3 empty rows,
 * default view). Used to seed React Query cache so the real TableView can
 * render instantly when a user clicks "Add table" — before the server roundtrip
 * finishes creating the real table.
 *
 * IDs are prefixed with "temp-" so mutations attempted during the brief
 * optimistic window can be detected and skipped.
 */
export function buildOptimisticTableBootstrap(params: {
  tempTableId: string;
  workspaceId?: string;
  projectId?: string | null;
}): TableBootstrapData {
  const { tempTableId, workspaceId = "", projectId = null } = params;
  const now = new Date().toISOString();

  const mkField = (idx: number, name: string, isPrimary: boolean): TableField => ({
    id: `temp-field-${tempTableId}-${idx}`,
    table_id: tempTableId,
    name,
    type: "text",
    config: null,
    order: idx,
    is_primary: isPrimary,
    width: null,
    created_at: now,
    updated_at: now,
  });

  const mkRow = (idx: number): TableRow => ({
    id: `temp-row-${tempTableId}-${idx}`,
    table_id: tempTableId,
    source_entity_type: null,
    source_entity_id: null,
    source_sync_mode: "snapshot",
    data: {},
    order: String(idx),
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
  });

  const table: Table = {
    id: tempTableId,
    workspace_id: workspaceId,
    project_id: projectId,
    title: "Untitled Table",
    description: null,
    icon: null,
    created_at: now,
    updated_at: now,
    created_by: null,
  };

  const fields: TableField[] = [
    mkField(1, "Name", true),
    mkField(2, "Column 2", false),
    mkField(3, "Column 3", false),
  ];

  const view: TableView = {
    id: `temp-view-${tempTableId}`,
    table_id: tempTableId,
    name: "Default view",
    type: "table",
    config: {},
    is_default: true,
    created_at: now,
    updated_at: now,
    created_by: null,
  };

  const rows: TableRow[] = [mkRow(1), mkRow(2), mkRow(3)];

  return {
    table,
    fields,
    view,
    rows,
    totalRows: rows.length,
    hasMore: false,
    nextOffset: null,
  };
}

/**
 * Fetches full table bootstrap data server-side using an already-authenticated Supabase client.
 * Mirrors the logic in /api/tables/bootstrap/route.ts but runs in the server component
 * render pass so the data is in the React Query cache before any client JS runs.
 *
 * Returns null on any error — callers silently fall back to client-side fetching.
 */
export async function fetchTableBootstrapData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tableId: string
): Promise<TableBootstrapData | null> {
  try {
    const [tableRes, fieldsRes, viewRes] = await Promise.all([
      supabase.from("tables").select("*").eq("id", tableId).single(),
      supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("order", { ascending: true }),
      supabase
        .from("table_views")
        .select("*")
        .eq("table_id", tableId)
        .eq("is_default", true)
        .maybeSingle(),
    ]);

    if (tableRes.error || !tableRes.data) return null;
    if (fieldsRes.error) return null;

    const table = tableRes.data as Table;
    const fields = (fieldsRes.data ?? []) as TableField[];
    const view = (viewRes.data ?? null) as TableView | null;
    const filters: FilterCondition[] = view?.config?.filters ?? [];
    const sorts: SortCondition[] = view?.config?.sorts ?? [];

    const buildRowQuery = () => {
      let rowQuery = supabase
        .from("table_rows")
        .select(
          "id, table_id, source_entity_type, source_entity_id, source_sync_mode, data, order, created_at, updated_at, created_by, updated_by",
          { count: "exact", head: false }
        )
        .eq("table_id", tableId);

      // Apply server-side filters (mirrors bootstrap API route logic)
      for (const filter of filters) {
        const col = `data->>${filter.fieldId}`;
        switch (filter.operator) {
          case "equals":           rowQuery = rowQuery.filter(col, "eq", filter.value ?? null); break;
          case "not_equals":       rowQuery = rowQuery.not(col, "eq", filter.value ?? null); break;
          case "contains":         rowQuery = rowQuery.filter(col, "ilike", `%${filter.value ?? ""}%`); break;
          case "not_contains":     rowQuery = rowQuery.not(col, "ilike", `%${filter.value ?? ""}%`); break;
          case "is_empty":         rowQuery = rowQuery.or(`${col}.is.null,${col}.eq.`); break;
          case "is_not_empty":     rowQuery = rowQuery.not(col, "is", null).not(col, "eq", ""); break;
          case "greater_than":     rowQuery = rowQuery.filter(col, "gt", filter.value); break;
          case "less_than":        rowQuery = rowQuery.filter(col, "lt", filter.value); break;
          case "greater_or_equal": rowQuery = rowQuery.filter(col, "gte", filter.value); break;
          case "less_or_equal":    rowQuery = rowQuery.filter(col, "lte", filter.value); break;
          case "is_before":
            if (typeof filter.value === "string") rowQuery = rowQuery.filter(col, "lt", filter.value);
            break;
          case "is_after":
            if (typeof filter.value === "string") rowQuery = rowQuery.filter(col, "gt", filter.value);
            break;
          case "is_on_or_before":
            if (typeof filter.value === "string") rowQuery = rowQuery.filter(col, "lte", filter.value);
            break;
          case "is_on_or_after":
            if (typeof filter.value === "string") rowQuery = rowQuery.filter(col, "gte", filter.value);
            break;
          default: break;
        }
      }

      return rowQuery;
    };

    let rows: TableRow[];
    let totalRows: number;

    if (shouldSortRowsInMemory(sorts, fields)) {
      const allRows: TableRow[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data: rowsPage, error: rowsError } = await buildRowQuery()
          .order("order", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (rowsError || !rowsPage) return null;

        allRows.push(...(rowsPage as TableRow[]));
        if (rowsPage.length < pageSize) break;
      }

      const sorted = applyTableRowSorts(allRows, sorts, fields);
      totalRows = sorted.length;
      rows = sorted.slice(0, PAGE_LIMIT);
    } else {
      let rowQuery = buildRowQuery();
      if (sorts.length > 0) {
        sorts.forEach((sort) => {
          const col = `data->>${sort.fieldId}`;
          rowQuery = rowQuery.order(col, { ascending: sort.direction === "asc", nullsFirst: false });
        });
      }

      const { data: rowsData, error: rowsError, count } = await rowQuery
        .order("order", { ascending: true })
        .limit(PAGE_LIMIT);

      if (rowsError || !rowsData) return null;

      rows = rowsData as TableRow[];
      totalRows = count ?? rows.length;
    }

    return {
      table,
      fields,
      view,
      rows,
      totalRows,
      hasMore: totalRows > PAGE_LIMIT,
      nextOffset: totalRows > PAGE_LIMIT ? PAGE_LIMIT : null,
    };
  } catch {
    return null;
  }
}
