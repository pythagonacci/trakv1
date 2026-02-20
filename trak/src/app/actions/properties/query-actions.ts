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
  PropertyOption,
} from "@/types/properties";

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
  groupByPropertyId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<GroupedEntitiesResult[]>> {
  const access = await requireWorkspaceAccessForProperties(params.workspace_id, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get the property definition for grouping
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", groupByPropertyId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  // Get all entities matching the base query (without property filters for grouping)
  const entitiesResult = await queryEntities({
    ...params,
    properties: params.properties?.filter(
      (p) => p.property_definition_id !== groupByPropertyId
    ),
    authContext: opts?.authContext,
  });

  if ("error" in entitiesResult) return entitiesResult;
  const allEntities = entitiesResult.data;

  // Get property values for all entities
  const entityIds = allEntities.map((e) => e.id);
  const groupFieldType = normalizePropertyFieldType(propDef.name);
  const [directPropsResult, typePropsResult] = await Promise.all([
    supabase
      .from("entity_properties")
      .select("id, entity_type, entity_id, value")
      .eq("property_definition_id", groupByPropertyId)
      .in("entity_id", entityIds),
    groupFieldType
      ? supabase
          .from("entity_properties")
          .select("id, entity_type, entity_id, value")
          .eq("field_type", groupFieldType)
          .in("entity_id", entityIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  const directProps = directPropsResult.data ?? [];
  const typeProps = typePropsResult.data ?? [];
  const entityProps = [...directProps, ...typeProps];

  // Create a map of entity -> list of property values (supports multi-field same type)
  const valueMap = new Map<string, unknown[]>();
  const seenPropRows = new Set<string>();
  for (const prop of entityProps ?? []) {
    if (!prop?.id || seenPropRows.has(prop.id)) continue;
    seenPropRows.add(prop.id);
    const key = `${prop.entity_type}:${prop.entity_id}`;
    const list = valueMap.get(key) ?? [];
    list.push(prop.value);
    valueMap.set(key, list);
  }

  // Group entities by property value
  const groups = new Map<string, EntityReference[]>();

  // Initialize groups based on property type
  if (propDef.type === "select" || propDef.type === "multi_select") {
    const options = (propDef.options as PropertyOption[]) ?? [];
    // Initialize groups for each option
    for (const option of options) {
      groups.set(option.id, []);
    }
  }
  // Always have a "no value" group
  groups.set("__no_value__", []);

  // Assign entities to groups
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
      // Entity doesn't have this property
      addToGroup("__no_value__", entity);
    } else if (propDef.type === "multi_select" && values.some((value) => Array.isArray(value))) {
      // Multi-select: entity can be in multiple groups
      const normalizedValues = values.flatMap((value) => (Array.isArray(value) ? value : []));
      for (const val of normalizedValues) {
        addToGroup(String(val), entity);
      }
      // If no values in array, put in no value group
      if (normalizedValues.length === 0) {
        addToGroup("__no_value__", entity);
      }
    } else {
      // Single-value properties: with named fields, an entity can appear in multiple groups.
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

  // Add option groups first (in order)
  if (propDef.type === "select" || propDef.type === "multi_select") {
    const options = (propDef.options as PropertyOption[]) ?? [];
    for (const option of options) {
      const entities = groups.get(option.id) ?? [];
      results.push({
        group_key: option.id,
        group_label: option.label,
        entities,
      });
    }
  } else {
    // For other types, create groups from actual values
    for (const [key, entities] of groups.entries()) {
      if (key !== "__no_value__" && entities.length > 0) {
        results.push({
          group_key: key,
          group_label: key,
          entities,
        });
      }
    }
  }

  // Always add "No Value" group at the end
  const noValueEntities = groups.get("__no_value__") ?? [];
  results.push({
    group_key: "__no_value__",
    group_label: getNoValueLabel(propDef.name),
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

  const filterIds = Array.from(new Set(filters.map((f) => f.property_definition_id)));
  const { data: definitions } = await supabase
    .from("property_definitions")
    .select("id, name")
    .in("id", filterIds);
  const fieldTypeByFilter = new Map<string, string | null>();
  for (const filter of filters) {
    fieldTypeByFilter.set(filter.property_definition_id, null);
  }
  for (const row of definitions ?? []) {
    fieldTypeByFilter.set(row.id, normalizePropertyFieldType(row.name));
  }
  const filterFieldTypes = Array.from(
    new Set(
      Array.from(fieldTypeByFilter.values()).filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );

  const [directPropsResult, typedPropsResult] = await Promise.all([
    supabase
      .from("entity_properties")
      .select("id, entity_id, property_definition_id, field_type, value")
      .eq("entity_type", entityType)
      .in("entity_id", entityIds)
      .in("property_definition_id", filterIds),
    filterFieldTypes.length > 0
      ? supabase
          .from("entity_properties")
          .select("id, entity_id, property_definition_id, field_type, value")
          .eq("entity_type", entityType)
          .in("entity_id", entityIds)
          .in("field_type", filterFieldTypes)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  const directProps = directPropsResult.data ?? [];
  const typedProps = typedPropsResult.data ?? [];
  const props = [...directProps, ...typedProps];
  const seenRows = new Set<string>();

  const propMap = new Map<string, Map<string, unknown[]>>();
  for (const prop of props ?? []) {
    const rowId = String(prop.id ?? "");
    if (rowId && seenRows.has(rowId)) continue;
    if (rowId) seenRows.add(rowId);

    let entityMap = propMap.get(prop.entity_id);
    if (!entityMap) {
      entityMap = new Map();
      propMap.set(prop.entity_id, entityMap);
    }

    for (const filter of filters) {
      const expectedFieldType = fieldTypeByFilter.get(filter.property_definition_id) ?? null;
      const matchesDefinition = Boolean(prop.property_definition_id) && prop.property_definition_id === filter.property_definition_id;
      const matchesFieldType = expectedFieldType !== null && prop.field_type === expectedFieldType;
      if (!matchesDefinition && !matchesFieldType) continue;

      const values = entityMap.get(filter.property_definition_id) ?? [];
      values.push(prop.value);
      entityMap.set(filter.property_definition_id, values);
    }
  }

  // Filter entities
  return entities.filter((entity) => {
    const entityProps = propMap.get(entity.id) ?? new Map();

    for (const filter of filters) {
      const values = entityProps.get(filter.property_definition_id) ?? [];

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
