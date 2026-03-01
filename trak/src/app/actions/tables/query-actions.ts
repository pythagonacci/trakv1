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

export type TableSourceOrigin = {
  sourceEntityType: "task" | "timeline_event" | "table_row" | "block";
  sourceEntityId: string;
  sourceName: string;
  sourceHref: string | null;
  previewEntityType: "block" | "table";
  previewEntityId: string;
  projectId: string | null;
  projectName: string | null;
  tabId: string | null;
  tabName: string | null;
};

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

function getBlockTitle(content: unknown, fallback: string): string {
  if (content && typeof content === "object" && typeof (content as Record<string, unknown>).title === "string") {
    const title = String((content as Record<string, unknown>).title).trim();
    if (title.length > 0) return title;
  }
  return fallback;
}

export async function getTableSourceOrigins(
  tableId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<TableSourceOrigin[]>> {
  const access = await requireTableAccess(tableId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: sourceRows, error: sourceRowsError } = await supabase
    .from("table_rows")
    .select("source_entity_type, source_entity_id")
    .eq("table_id", tableId)
    .not("source_entity_type", "is", null)
    .not("source_entity_id", "is", null);

  if (sourceRowsError) return { error: "Failed to load source-linked rows" };
  if (!sourceRows || sourceRows.length === 0) return { data: [] };

  const taskIds = Array.from(
    new Set(
      sourceRows
        .filter((row) => row.source_entity_type === "task" && typeof row.source_entity_id === "string")
        .map((row) => row.source_entity_id as string)
    )
  );
  const timelineEventIds = Array.from(
    new Set(
      sourceRows
        .filter((row) => row.source_entity_type === "timeline_event" && typeof row.source_entity_id === "string")
        .map((row) => row.source_entity_id as string)
    )
  );
  const tableRowIds = Array.from(
    new Set(
      sourceRows
        .filter((row) => row.source_entity_type === "table_row" && typeof row.source_entity_id === "string")
        .map((row) => row.source_entity_id as string)
    )
  );
  const blockIds = Array.from(
    new Set(
      sourceRows
        .filter((row) => row.source_entity_type === "block" && typeof row.source_entity_id === "string")
        .map((row) => row.source_entity_id as string)
    )
  );

  const origins = new Map<string, TableSourceOrigin>();

  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("task_items")
      .select("id, task_block_id")
      .in("id", taskIds);
    const blockIdsForTasks = Array.from(new Set((tasks ?? []).map((task) => task.task_block_id).filter(Boolean)));
    const { data: taskBlocks } = blockIdsForTasks.length
      ? await supabase
          .from("blocks")
          .select("id, type, content, tab_id, tabs!inner(project_id, name, projects(name))")
          .in("id", blockIdsForTasks)
      : { data: [] as any[] };
    const blockById = new Map<string, any>((taskBlocks ?? []).map((block: any) => [block.id, block]));

    for (const task of tasks ?? []) {
      const block = blockById.get(task.task_block_id as string);
      if (!block) continue;
      const sourceName = getBlockTitle(block.content, "Task block");
      const tab = (block as any)?.tabs as { project_id?: string; name?: string; projects?: { name?: string } } | undefined;
      const projectId = tab?.project_id;
      const href = projectId && block.tab_id
        ? `/dashboard/projects/${projectId}/tabs/${block.tab_id}#block-${block.id}`
        : null;
      const key = `task:${block.id}`;
      if (!origins.has(key)) {
        origins.set(key, {
          sourceEntityType: "task",
          sourceEntityId: String(task.id),
          sourceName,
          sourceHref: href,
          previewEntityType: "block",
          previewEntityId: String(block.id),
          projectId: projectId ?? null,
          projectName: tab?.projects?.name ?? null,
          tabId: (block.tab_id as string | null) ?? null,
          tabName: tab?.name ?? null,
        });
      }
    }
  }

  if (timelineEventIds.length > 0) {
    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, timeline_block_id")
      .in("id", timelineEventIds);
    const blockIdsForEvents = Array.from(new Set((events ?? []).map((event) => event.timeline_block_id).filter(Boolean)));
    const { data: timelineBlocks } = blockIdsForEvents.length
      ? await supabase
          .from("blocks")
          .select("id, type, content, tab_id, tabs!inner(project_id, name, projects(name))")
          .in("id", blockIdsForEvents)
      : { data: [] as any[] };
    const blockById = new Map<string, any>((timelineBlocks ?? []).map((block: any) => [block.id, block]));

    for (const event of events ?? []) {
      const block = blockById.get(event.timeline_block_id as string);
      if (!block) continue;
      const sourceName = getBlockTitle(block.content, "Timeline block");
      const tab = (block as any)?.tabs as { project_id?: string; name?: string; projects?: { name?: string } } | undefined;
      const projectId = tab?.project_id;
      const href = projectId && block.tab_id
        ? `/dashboard/projects/${projectId}/tabs/${block.tab_id}#block-${block.id}`
        : null;
      const key = `timeline_event:${block.id}`;
      if (!origins.has(key)) {
        origins.set(key, {
          sourceEntityType: "timeline_event",
          sourceEntityId: String(event.id),
          sourceName,
          sourceHref: href,
          previewEntityType: "block",
          previewEntityId: String(block.id),
          projectId: projectId ?? null,
          projectName: tab?.projects?.name ?? null,
          tabId: (block.tab_id as string | null) ?? null,
          tabName: tab?.name ?? null,
        });
      }
    }
  }

  if (tableRowIds.length > 0) {
    const { data: rows } = await supabase
      .from("table_rows")
      .select("id, table_id")
      .in("id", tableRowIds);
    const sourceTableIds = Array.from(new Set((rows ?? []).map((row) => row.table_id).filter(Boolean)));
    const { data: tables } = sourceTableIds.length
      ? await supabase
          .from("tables")
          .select("id, title, tab_id, project_id, tabs(name), projects(name)")
          .in("id", sourceTableIds)
      : { data: [] as any[] };
    const tableById = new Map<string, any>((tables ?? []).map((table: any) => [table.id, table]));
    const sourceTabIds = Array.from(new Set((tables ?? []).map((table: any) => table.tab_id).filter(Boolean)));
    const { data: tableBlocks } = sourceTabIds.length
      ? await supabase
          .from("blocks")
          .select("id, tab_id, content")
          .eq("type", "table")
          .in("tab_id", sourceTabIds)
      : { data: [] as any[] };
    const tableBlockByTableId = new Map<string, string>();
    for (const block of tableBlocks ?? []) {
      const content = (block as any)?.content as Record<string, unknown> | null;
      const sourceTableId = typeof content?.tableId === "string" ? content.tableId : null;
      if (!sourceTableId || tableBlockByTableId.has(sourceTableId)) continue;
      tableBlockByTableId.set(sourceTableId, String((block as any).id));
    }

    for (const row of rows ?? []) {
      const table = tableById.get(row.table_id as string);
      if (!table) continue;
      const sourceName = typeof table.title === "string" && table.title.trim().length > 0 ? table.title : "Table";
      const href = table.project_id && table.tab_id
        ? `/dashboard/projects/${table.project_id}/tabs/${table.tab_id}#table-${table.id}`
        : null;
      const key = `table_row:${table.id}`;
      if (!origins.has(key)) {
        origins.set(key, {
          sourceEntityType: "table_row",
          sourceEntityId: String(row.id),
          sourceName,
          sourceHref: href,
          previewEntityType: tableBlockByTableId.has(String(table.id)) ? "block" : "table",
          previewEntityId: tableBlockByTableId.get(String(table.id)) ?? String(table.id),
          projectId: (table.project_id as string | null) ?? null,
          projectName: ((table.projects as { name?: string } | null)?.name ?? null),
          tabId: (table.tab_id as string | null) ?? null,
          tabName: ((table.tabs as { name?: string } | null)?.name ?? null),
        });
      }
    }
  }

  if (blockIds.length > 0) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, type, content, tab_id, tabs!inner(project_id, name, projects(name))")
      .in("id", blockIds);

    for (const block of blocks ?? []) {
      const sourceName = getBlockTitle((block as any).content, `${String((block as any).type || "block")} block`);
      const tab = (block as any)?.tabs as { project_id?: string; name?: string; projects?: { name?: string } } | undefined;
      const projectId = tab?.project_id;
      const href = projectId && (block as any).tab_id
        ? `/dashboard/projects/${projectId}/tabs/${(block as any).tab_id}#block-${(block as any).id}`
        : null;
      const key = `block:${(block as any).id}`;
      if (!origins.has(key)) {
        origins.set(key, {
          sourceEntityType: "block",
          sourceEntityId: String((block as any).id),
          sourceName,
          sourceHref: href,
          previewEntityType: "block",
          previewEntityId: String((block as any).id),
          projectId: projectId ?? null,
          projectName: tab?.projects?.name ?? null,
          tabId: ((block as any).tab_id as string | null) ?? null,
          tabName: tab?.name ?? null,
        });
      }
    }
  }

  return { data: Array.from(origins.values()) };
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

function applyServerSorts(query: PostgrestFilterBuilder<any, any, any, any>, sorts: SortCondition[]) {
  if (!sorts || sorts.length === 0) return query;
  let working = query;
  sorts.forEach((sort, idx) => {
    const column = idx === 0 ? "order" : `data->>${sort.fieldId}`;
    working = (working as any).order(column, { ascending: sort.direction === "asc", nullsFirst: false });
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
