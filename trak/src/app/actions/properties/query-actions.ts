"use server";

// Universal Properties & Linking System - Query Actions
// Query entities by properties and group by property values

import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccessForProperties } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type {
  EntityType,
  QueryEntitiesParams,
  PropertyFilter,
  EntityReference,
  GroupedEntitiesResult,
} from "@/types/properties";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

function normalizePropertyFieldType(propertyName: string | null | undefined): string | null {
  const lower = String(propertyName ?? "").trim().toLowerCase();
  if (!lower) return null;
  if (lower === "priority") return "priority";
  if (lower === "status") return "status";
  if (lower === "assignee") return "assignee";
  if (lower === "due date") return "due_date";
  if (lower === "tags") return "tags";
  return null;
}

/**
 * Query entities matching property criteria.
 * Joins through the hierarchy to resolve workspace context for each entity type.
 */
export async function queryEntities(
  params: QueryEntitiesParams & { authContext?: AuthContext }
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireWorkspaceAccessForProperties(params.workspace_id, { authContext: params.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const entityTypes = params.entity_types ?? [
    "block",
    "task",
    "card",
    "timeline_event",
    "table_row",
  ];
  const results: EntityReference[] = [];

  // Query each entity type
  for (const entityType of entityTypes) {
    const entities = await queryEntitiesByType(
      supabase,
      entityType,
      params
    );
    results.push(...entities);
  }

  return { data: results };
}

/**
 * Query entities and group them by a property value.
 * IMPORTANT: Always includes entities without the property in a "No Status" / "Unassigned" group.
 */
export async function queryEntitiesGroupedBy(
  params: QueryEntitiesParams,
  groupByFieldType: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<GroupedEntitiesResult[]>> {
  const access = await requireWorkspaceAccessForProperties(params.workspace_id, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get all entities matching the base query
  const entitiesResult = await queryEntities({
    ...params,
    authContext: opts?.authContext,
  });

  if ("error" in entitiesResult) return entitiesResult;
  const allEntities = entitiesResult.data;

  // Get property values for all entities by field_type
  const entityIds = allEntities.map((e) => e.id);
  const { data: entityProps } = entityIds.length > 0
    ? await supabase
        .from("entity_properties")
        .select("id, entity_type, entity_id, value")
        .eq("field_type", groupByFieldType)
        .in("entity_id", entityIds)
    : { data: [] };

  // Create a map of entity -> list of property values
  const valueMap = new Map<string, unknown[]>();
  for (const prop of entityProps ?? []) {
    const key = `${prop.entity_type}:${prop.entity_id}`;
    const list = valueMap.get(key) ?? [];
    list.push(prop.value);
    valueMap.set(key, list);
  }

  // Group entities by property value
  const groups = new Map<string, EntityReference[]>();

  // Initialize groups from fixed options for status/priority
  const options = groupByFieldType === "status"
    ? STATUS_OPTIONS.map(o => ({ id: o.value, label: o.label }))
    : groupByFieldType === "priority"
    ? PRIORITY_OPTIONS.map(o => ({ id: o.value, label: o.label }))
    : [];

  for (const option of options) {
    groups.set(option.id, []);
  }
  groups.set("__no_value__", []);

  const addToGroup = (groupKey: string, entity: EntityReference) => {
    const group = groups.get(groupKey) ?? [];
    const exists = group.some((item) => item.type === entity.type && item.id === entity.id);
    if (!exists) group.push(entity);
    groups.set(groupKey, group);
  };

  for (const entity of allEntities) {
    const key = `${entity.type}:${entity.id}`;
    const values = valueMap.get(key) ?? [];

    if (values.length === 0) {
      addToGroup("__no_value__", entity);
    } else {
      const groupKeys = new Set<string>();
      for (const value of values) {
        if (value === null || value === undefined || value === "") continue;
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (entry !== null && entry !== undefined && entry !== "") {
              groupKeys.add(String(entry));
            }
          }
        } else {
          groupKeys.add(String(value));
        }
      }
      if (groupKeys.size === 0) {
        addToGroup("__no_value__", entity);
      } else {
        for (const groupKey of groupKeys) {
          addToGroup(groupKey, entity);
        }
      }
    }
  }

  // Convert to result format with labels
  const results: GroupedEntitiesResult[] = [];

  for (const option of options) {
    const entities = groups.get(option.id) ?? [];
    results.push({
      group_key: option.id,
      group_label: option.label,
      entities,
    });
  }

  // Add any groups for values not in fixed options
  for (const [key, entities] of groups.entries()) {
    if (key !== "__no_value__" && !options.some(o => o.id === key) && entities.length > 0) {
      results.push({
        group_key: key,
        group_label: key,
        entities,
      });
    }
  }

  // Always add "No Value" group at the end
  const noValueEntities = groups.get("__no_value__") ?? [];
  const fieldLabel = groupByFieldType === "status" ? "Status"
    : groupByFieldType === "priority" ? "Priority"
    : groupByFieldType === "assignee" ? "Assignee"
    : groupByFieldType === "due_date" ? "Due Date"
    : groupByFieldType;
  results.push({
    group_key: "__no_value__",
    group_label: getNoValueLabel(fieldLabel),
    entities: noValueEntities,
  });

  return { data: results };
}

// Helper functions

async function getTableIdsFromTableBlocks(
  supabase: any,
  workspaceId: string,
  opts: { projectId?: string; tabId?: string }
): Promise<string[]> {
  let blockQuery = supabase
    .from("blocks")
    .select("id, content, tab_id, tabs!inner(project_id, projects!inner(workspace_id))")
    .eq("tabs.projects.workspace_id", workspaceId)
    .eq("type", "table");

  if (opts.projectId) {
    blockQuery = blockQuery.eq("tabs.project_id", opts.projectId);
  }
  if (opts.tabId) {
    blockQuery = blockQuery.eq("tab_id", opts.tabId);
  }

  const { data: blocks } = await blockQuery;
  const tableIds = new Set<string>();

  for (const block of blocks ?? []) {
    const content = (block as any).content ?? {};
    const tableId =
      (typeof content.tableId === "string" && content.tableId) ||
      (typeof content.table_id === "string" && content.table_id) ||
      (typeof content.table === "string" && content.table) ||
      null;
    if (tableId) tableIds.add(tableId);
  }

  return Array.from(tableIds);
}

/**
 * Query entities of a specific type.
 */
async function queryEntitiesByType(
  supabase: any,
  entityType: EntityType,
  params: QueryEntitiesParams
): Promise<EntityReference[]> {
  const results: EntityReference[] = [];

  switch (entityType) {
    case "block": {
      let query = supabase
        .from("blocks")
        .select(
          `
          id,
          type,
          content,
          tabs!inner(
            id,
            name,
            project_id,
            projects!inner(
              id,
              workspace_id
            )
          )
        `
        )
        .eq("tabs.projects.workspace_id", params.workspace_id);

      // Apply scope filters
      if (params.scope === "project" && params.project_id) {
        query = query.eq("tabs.project_id", params.project_id);
      } else if (params.scope === "tab" && params.tab_id) {
        query = query.eq("tab_id", params.tab_id);
      }

      const { data: blocks } = await query;
      const typedBlocks = (blocks ?? []) as Array<{
        id: string;
        type: string;
        content: Record<string, unknown> | null;
        tabs?: { name?: string } | null;
      }>;

      // Apply property filters
      const filteredBlocks = await filterByProperties(
        supabase,
        "block",
        typedBlocks,
        params.properties
      );

      for (const block of filteredBlocks) {
        results.push({
          type: "block",
          id: block.id,
          title: getBlockTitle(block),
          context: (block.tabs as any)?.name ?? "",
        });
      }
      break;
    }

    case "task": {
      let query = supabase
        .from("task_items")
        .select("id, title, tab_id, project_id, source_task_id, source_entity_type, source_entity_id, tabs(name, project_id)")
        .eq("workspace_id", params.workspace_id);

      if (!params.include_workflow_representations) {
        query = query
          .is("source_entity_id", null)
          .is("source_task_id", null);
      }

      // Apply scope filters
      if (params.scope === "project" && params.project_id) {
        // Defer to post-fetch filtering to handle tasks missing project_id but linked to a tab.
      } else if (params.scope === "tab" && params.tab_id) {
        query = query.eq("tab_id", params.tab_id);
      }

      const { data: tasks } = await query;
      let typedTasks = (tasks ?? []) as Array<{
        id: string;
        title: string;
        project_id?: string | null;
        tabs?: { name?: string } | null;
      }>;

      if (params.scope === "project" && params.project_id) {
        typedTasks = typedTasks.filter((task) => {
          const tabProjectId = (task.tabs as any)?.project_id ?? null;
          const taskProjectId = task.project_id ?? null;
          return taskProjectId === params.project_id || tabProjectId === params.project_id;
        });
      }

      // Apply property filters
      const filteredTasks = await filterByProperties(
        supabase,
        "task",
        typedTasks,
        params.properties
      );

      for (const task of filteredTasks) {
        results.push({
          type: "task",
          id: task.id,
          title: task.title,
          context: (task.tabs as any)?.name ?? "",
        });
      }
      break;
    }

    case "card": {
      let query = supabase
        .from("cards")
        .select("id, title, project_id, tab_id")
        .eq("workspace_id", params.workspace_id);

      if (params.scope === "project" && params.project_id) {
        query = query.eq("project_id", params.project_id);
      } else if (params.scope === "tab" && params.tab_id) {
        query = query.eq("tab_id", params.tab_id);
      }

      const { data: cards } = await query;
      const typedCards = (cards ?? []) as Array<{ id: string; title: string }>;
      const filteredCards = await filterByProperties(supabase, "card", typedCards, params.properties);

      for (const card of filteredCards) {
        results.push({
          type: "card",
          id: card.id,
          title: card.title,
          context: "Cards",
        });
      }
      break;
    }

    case "subtask": {
      let query = supabase
        .from("task_subtasks")
        .select("id, title, task_id, task_items!inner(id, title, workspace_id, project_id, tab_id, tabs(name))")
        .eq("task_items.workspace_id", params.workspace_id);

      if (params.scope === "project" && params.project_id) {
        query = query.eq("task_items.project_id", params.project_id);
      } else if (params.scope === "tab" && params.tab_id) {
        query = query.eq("task_items.tab_id", params.tab_id);
      }

      const { data: subtasks } = await query;
      const typedSubtasks = (subtasks ?? []) as Array<{
        id: string;
        title: string;
        task_items?: { title?: string; tabs?: { name?: string } | null } | null;
      }>;

      const filteredSubtasks = await filterByProperties(
        supabase,
        "subtask",
        typedSubtasks,
        params.properties
      );

      for (const subtask of filteredSubtasks) {
        results.push({
          type: "subtask",
          id: subtask.id,
          title: subtask.title,
          context: (subtask.task_items as any)?.title ?? "",
        });
      }
      break;
    }

    case "timeline_event": {
      let query = supabase
        .from("timeline_events")
        .select(
          `
          id,
          title,
          timeline_block_id,
          blocks!inner(
            tab_id,
            tabs!inner(
              id,
              title,
              project_id
            )
          )
        `
        )
        .eq("workspace_id", params.workspace_id);

      // Apply scope filters
      if (params.scope === "project" && params.project_id) {
        query = query.eq("blocks.tabs.project_id", params.project_id);
      } else if (params.scope === "tab" && params.tab_id) {
        query = query.eq("blocks.tab_id", params.tab_id);
      }

      const { data: events } = await query;
      const typedEvents = (events ?? []) as Array<{
        id: string;
        title: string;
      }>;

      // Apply property filters
      const filteredEvents = await filterByProperties(
        supabase,
        "timeline_event",
        typedEvents,
        params.properties
      );

      for (const event of filteredEvents) {
        results.push({
          type: "timeline_event",
          id: event.id,
          title: event.title,
          context: "Timeline",
        });
      }
      break;
    }

    case "table_row": {
      const baseSelect = `
        id,
        data,
        table_id,
        source_entity_id,
        tables!inner(
          id,
          title,
          workspace_id,
          project_id,
          table_fields(id, name, is_primary)
        )
      `;

      let rows: any[] = [];

      if (params.scope === "project" && params.project_id) {
        const { data: rowsByProject } = await supabase
          .from("table_rows")
          .select(baseSelect)
          .eq("tables.workspace_id", params.workspace_id)
          .eq("tables.project_id", params.project_id);

        rows = (rowsByProject ?? []) as any[];
        if (!params.include_workflow_representations) {
          rows = rows.filter((row) => !row?.source_entity_id);
        }

        const tableIdsFromBlocks = await getTableIdsFromTableBlocks(supabase, params.workspace_id, {
          projectId: params.project_id,
        });
        if (tableIdsFromBlocks.length > 0) {
          const { data: rowsByBlocks } = await supabase
            .from("table_rows")
            .select(baseSelect)
            .eq("tables.workspace_id", params.workspace_id)
            .in("table_id", tableIdsFromBlocks);
          const blockRows = (rowsByBlocks ?? []) as any[];
          rows = [
            ...rows,
            ...(
              params.include_workflow_representations
                ? blockRows
                : blockRows.filter((row) => !row?.source_entity_id)
            ),
          ];
        }

        const rowMap = new Map<string, any>();
        for (const row of rows) {
          if (!row?.id) continue;
          rowMap.set(row.id, row);
        }
        rows = Array.from(rowMap.values());
      } else if (params.scope === "tab" && params.tab_id) {
        const tableIdsFromBlocks = await getTableIdsFromTableBlocks(supabase, params.workspace_id, {
          tabId: params.tab_id,
        });
        if (tableIdsFromBlocks.length === 0) {
          rows = [];
        } else {
          const { data: rowsByBlocks } = await supabase
            .from("table_rows")
            .select(baseSelect)
            .eq("tables.workspace_id", params.workspace_id)
            .in("table_id", tableIdsFromBlocks);
          rows = (rowsByBlocks ?? []) as any[];
          if (!params.include_workflow_representations) {
            rows = rows.filter((row) => !row?.source_entity_id);
          }
        }
      } else {
        const { data: rowsAll } = await supabase
          .from("table_rows")
          .select(baseSelect)
          .eq("tables.workspace_id", params.workspace_id);
        rows = (rowsAll ?? []) as any[];
        if (!params.include_workflow_representations) {
          rows = rows.filter((row) => !row?.source_entity_id);
        }
      }

      const typedRows = (rows ?? []) as Array<{
        id: string;
        table_id?: string;
        data: Record<string, unknown>;
        tables?:
          | { title?: string; table_fields?: Array<{ id: string; name: string; is_primary: boolean }> }
          | Array<{ title?: string; table_fields?: Array<{ id: string; name: string; is_primary: boolean }> }>;
      }>;

      // Apply property filters
      const filteredRows = await filterByProperties(
        supabase,
        "table_row",
        typedRows,
        params.properties
      );

      for (const row of filteredRows) {
        const table = Array.isArray(row.tables) ? row.tables[0] : row.tables;
        results.push({
          type: "table_row",
          id: row.id,
          title: getTableRowTitle(row),
          context: table?.title ?? "Table",
        });
      }
      break;
    }
  }

  return results;
}

/**
 * Filter entities by property values.
 */
async function filterByProperties<T extends { id: string }>(
  supabase: any,
  entityType: EntityType,
  entities: T[],
  filters?: PropertyFilter[]
): Promise<T[]> {
  if (!filters || filters.length === 0) {
    return entities;
  }

  const entityIds = entities.map((e) => e.id);
  if (entityIds.length === 0) {
    return [];
  }

  // Get unique field_types from filters
  const filterFieldTypes = Array.from(new Set(filters.map((f) => f.field_type)));

  const { data: props } = await supabase
    .from("entity_properties")
    .select("id, entity_id, field_type, field_name, value")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .in("field_type", filterFieldTypes);

  // Build map: entityId -> fieldType -> values[]
  const propMap = new Map<string, Map<string, unknown[]>>();
  for (const prop of props ?? []) {
    let entityMap = propMap.get(prop.entity_id);
    if (!entityMap) {
      entityMap = new Map();
      propMap.set(prop.entity_id, entityMap);
    }

    const values = entityMap.get(prop.field_type) ?? [];
    values.push(prop.value);
    entityMap.set(prop.field_type, values);
  }

  // Filter entities
  return entities.filter((entity) => {
    const entityProps = propMap.get(entity.id) ?? new Map();

    for (const filter of filters) {
      const values = entityProps.get(filter.field_type) ?? [];

      if (!matchesFilterAny(values, filter)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if a value matches a filter.
 */
function normalizeComparableStrings(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    const flattened: string[] = [];
    for (const item of value) {
      flattened.push(...normalizeComparableStrings(item));
    }
    return flattened;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidates: string[] = [];
    for (const key of ["id", "value", "name", "label"]) {
      const v = obj[key];
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        candidates.push(String(v));
      }
    }
    return candidates;
  }
  return [];
}

function matchesFilter(value: unknown, filter: PropertyFilter): boolean {
  const filterValueString = typeof filter.value === "string" ? filter.value.toLowerCase() : null;
  const comparableStrings = filterValueString
    ? normalizeComparableStrings(value).map((v) => v.toLowerCase())
    : [];

  switch (filter.operator) {
    case "equals":
      if (filterValueString) {
        return comparableStrings.includes(filterValueString);
      }
      return value === filter.value;

    case "not_equals":
      if (filterValueString) {
        return !comparableStrings.includes(filterValueString);
      }
      return value !== filter.value;

    case "contains":
      if (filterValueString) {
        return comparableStrings.some((entry) => entry.includes(filterValueString));
      }
      return false;

    case "is_empty":
      return (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      );

    case "is_not_empty":
      return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0)
      );

    default:
      return true;
  }
}

function matchesFilterAny(values: unknown[], filter: PropertyFilter): boolean {
  if (!values || values.length === 0) {
    return matchesFilter(undefined, filter);
  }

  switch (filter.operator) {
    case "is_empty":
      return values.every((value) => matchesFilter(value, filter));
    case "is_not_empty":
      return values.some((value) => matchesFilter(value, filter));
    case "not_equals":
      return values.every((value) => matchesFilter(value, filter));
    default:
      return values.some((value) => matchesFilter(value, filter));
  }
}

/**
 * Get a display title for a block based on its type and content.
 */
function getBlockTitle(block: {
  type: string;
  content: Record<string, unknown> | null;
}): string {
  const content = block.content ?? {};

  switch (block.type) {
    case "text":
      const text = (content as any).text ?? (content as any).content ?? "";
      if (typeof text === "string") {
        return text.slice(0, 50) || "Text block";
      }
      return "Text block";

    case "task":
      return (content as any).title ?? "Task block";

    case "cards":
      return (content as any).title ?? "Cards";

    case "table":
      return (content as any).title ?? "Table";

    case "timeline":
      return "Timeline";

    case "image":
      return (content as any).alt ?? (content as any).filename ?? "Image";

    case "file":
      return (content as any).filename ?? "File";

    case "video":
      return (content as any).title ?? "Video";

    case "embed":
      return (content as any).title ?? "Embed";

    case "link":
      return (content as any).title ?? (content as any).url ?? "Link";

    case "divider":
      return "Divider";

    case "section":
      return (content as any).title ?? "Section";

    case "doc_reference":
      return (content as any).title ?? "Document reference";

    case "pdf":
      return (content as any).filename ?? "PDF";

    case "chart":
      return (content as any).title ?? "Chart";

    default:
      return `${block.type} block`;
  }
}

/**
 * Get a display title for a table row from its primary field.
 */
function getTableRowTitle(row: {
  data: Record<string, unknown>;
  tables?:
    | {
        table_fields?: Array<{ id: string; name: string; is_primary: boolean }>;
      }
    | Array<{
        table_fields?: Array<{ id: string; name: string; is_primary: boolean }>;
      }>;
}): string {
  const table = Array.isArray(row.tables) ? row.tables[0] : row.tables;
  const fields = table?.table_fields ?? [];
  const primaryField = fields.find((f) => f.is_primary);

  if (primaryField) {
    const value = row.data[primaryField.id];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  // Fallback: use first non-empty string value
  for (const value of Object.values(row.data)) {
    if (typeof value === "string" && value.trim()) {
      return value.slice(0, 50);
    }
  }

  return "Table row";
}

/**
 * Get the label for the "no value" group based on property name.
 */
function getNoValueLabel(propertyName: string): string {
  const lower = propertyName.toLowerCase();

  if (lower.includes("status")) return "No Status";
  if (lower.includes("assignee") || lower.includes("person")) return "Unassigned";
  if (lower.includes("priority")) return "No Priority";
  if (lower.includes("date") || lower.includes("due")) return "No Date";

  return `No ${propertyName}`;
}
