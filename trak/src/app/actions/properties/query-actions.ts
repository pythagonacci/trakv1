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
  const { data: entityProps } = await supabase
    .from("entity_properties")
    .select("entity_type, entity_id, value")
    .eq("property_definition_id", groupByPropertyId)
    .in("entity_id", entityIds);

  // Create a map of entity -> property value
  const valueMap = new Map<string, unknown>();
  for (const prop of entityProps ?? []) {
    const key = `${prop.entity_type}:${prop.entity_id}`;
    valueMap.set(key, prop.value);
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
  for (const entity of allEntities) {
    const key = `${entity.type}:${entity.id}`;
    const value = valueMap.get(key);

    if (value === null || value === undefined) {
      // Entity doesn't have this property
      const noValue = groups.get("__no_value__") ?? [];
      noValue.push(entity);
      groups.set("__no_value__", noValue);
    } else if (propDef.type === "multi_select" && Array.isArray(value)) {
      // Multi-select: entity can be in multiple groups
      for (const val of value) {
        const group = groups.get(val) ?? [];
        group.push(entity);
        groups.set(val, group);
      }
      // If no values in array, put in no value group
      if (value.length === 0) {
        const noValue = groups.get("__no_value__") ?? [];
        noValue.push(entity);
        groups.set("__no_value__", noValue);
      }
    } else {
      // Single value (select, text, etc.)
      const groupKey = String(value);
      const group = groups.get(groupKey) ?? [];
      group.push(entity);
      groups.set(groupKey, group);
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
            title,
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
        tabs?: { title?: string } | null;
      }>;

      // Apply property filters
      const filteredBlocks = await filterByProperties(
        supabase,
        "block",
        typedBlocks,
        params.properties,
        params.include_inherited
      );

      for (const block of filteredBlocks) {
        results.push({
          type: "block",
          id: block.id,
          title: getBlockTitle(block),
          context: (block.tabs as any)?.title ?? "",
        });
      }
      break;
    }

    case "task": {
      let query = supabase
        .from("task_items")
        .select("id, title, tab_id, tabs(title)")
        .eq("workspace_id", params.workspace_id);

      // Apply scope filters
      if (params.scope === "project" && params.project_id) {
        query = query.eq("project_id", params.project_id);
      } else if (params.scope === "tab" && params.tab_id) {
        query = query.eq("tab_id", params.tab_id);
      }

      const { data: tasks } = await query;
      const typedTasks = (tasks ?? []) as Array<{
        id: string;
        title: string;
        tabs?: { title?: string } | null;
      }>;

      // Apply property filters
      const filteredTasks = await filterByProperties(
        supabase,
        "task",
        typedTasks,
        params.properties,
        params.include_inherited
      );

      for (const task of filteredTasks) {
        results.push({
          type: "task",
          id: task.id,
          title: task.title,
          context: (task.tabs as any)?.title ?? "",
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
        params.properties,
        params.include_inherited
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
      let query = supabase
        .from("table_rows")
        .select(
          `
          id,
          data,
          tables!inner(
            id,
            title,
            workspace_id,
            project_id,
            table_fields(id, name, is_primary)
          )
        `
        )
        .eq("tables.workspace_id", params.workspace_id);

      // Apply scope filters
      if (params.scope === "project" && params.project_id) {
        query = query.eq("tables.project_id", params.project_id);
      }
      // Note: table_rows don't have direct tab scope

      const { data: rows } = await query;
      const typedRows = (rows ?? []) as Array<{
        id: string;
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
        params.properties,
        params.include_inherited
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
  filters?: PropertyFilter[],
  includeInherited?: boolean
): Promise<T[]> {
  if (!filters || filters.length === 0) {
    return entities;
  }

  const entityIds = entities.map((e) => e.id);
  if (entityIds.length === 0) {
    return [];
  }

  // Get all relevant property values
  const { data: props } = await supabase
    .from("entity_properties")
    .select("entity_id, property_definition_id, value")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .in(
      "property_definition_id",
      filters.map((f) => f.property_definition_id)
    );

  // Create a map of entity -> property definition -> value
  const propMap = new Map<string, Map<string, unknown>>();
  const directPropIds = new Map<string, Set<string>>();
  for (const prop of props ?? []) {
    let entityMap = propMap.get(prop.entity_id);
    if (!entityMap) {
      entityMap = new Map();
      propMap.set(prop.entity_id, entityMap);
    }
    entityMap.set(prop.property_definition_id, prop.value);
    const directSet = directPropIds.get(prop.entity_id) ?? new Set<string>();
    directSet.add(prop.property_definition_id);
    directPropIds.set(prop.entity_id, directSet);
  }

  if (includeInherited) {
    const { data: links } = await supabase
      .from("entity_links")
      .select("target_entity_id, source_entity_type, source_entity_id")
      .eq("target_entity_type", entityType)
      .in("target_entity_id", entityIds);

    const linksByTarget = new Map<string, Array<{ sourceType: EntityType; sourceId: string }>>();
    const sourceIdsByType = new Map<EntityType, Set<string>>();
    for (const link of links ?? []) {
      const targetList = linksByTarget.get(link.target_entity_id) ?? [];
      targetList.push({
        sourceType: link.source_entity_type as EntityType,
        sourceId: link.source_entity_id,
      });
      linksByTarget.set(link.target_entity_id, targetList);

      const typeSet = sourceIdsByType.get(link.source_entity_type as EntityType) ?? new Set<string>();
      typeSet.add(link.source_entity_id);
      sourceIdsByType.set(link.source_entity_type as EntityType, typeSet);
    }

    const sourcePropsByType = new Map<EntityType, Map<string, Array<{ property_definition_id: string; value: unknown }>>>();
    for (const [sourceType, ids] of sourceIdsByType.entries()) {
      const idsArray = Array.from(ids);
      if (idsArray.length === 0) continue;
      const { data: sourceProps } = await supabase
        .from("entity_properties")
        .select("entity_id, property_definition_id, value")
        .eq("entity_type", sourceType)
        .in("entity_id", idsArray)
        .in(
          "property_definition_id",
          filters.map((f) => f.property_definition_id)
        );

      const propsByEntity = new Map<string, Array<{ property_definition_id: string; value: unknown }>>();
      for (const prop of sourceProps ?? []) {
        const list = propsByEntity.get(prop.entity_id) ?? [];
        list.push({ property_definition_id: prop.property_definition_id, value: prop.value });
        propsByEntity.set(prop.entity_id, list);
      }
      sourcePropsByType.set(sourceType, propsByEntity);
    }

    for (const [targetId, linksForTarget] of linksByTarget.entries()) {
      const entityMap = propMap.get(targetId) ?? new Map<string, unknown>();
      const directSet = directPropIds.get(targetId) ?? new Set<string>();
      for (const link of linksForTarget) {
        const propsByEntity = sourcePropsByType.get(link.sourceType);
        const propsForSource = propsByEntity?.get(link.sourceId) ?? [];
        for (const prop of propsForSource) {
          if (directSet.has(prop.property_definition_id)) continue;
          const existing = entityMap.get(prop.property_definition_id);
          if (existing === undefined) {
            entityMap.set(prop.property_definition_id, prop.value);
          } else if (Array.isArray(existing)) {
            entityMap.set(prop.property_definition_id, [...existing, prop.value]);
          } else {
            entityMap.set(prop.property_definition_id, [existing, prop.value]);
          }
        }
      }
      if (entityMap.size > 0) {
        propMap.set(targetId, entityMap);
      }
    }
  }

  // Filter entities
  return entities.filter((entity) => {
    const entityProps = propMap.get(entity.id) ?? new Map();

    for (const filter of filters) {
      const value = entityProps.get(filter.property_definition_id);

      if (!matchesFilter(value, filter)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if a value matches a filter.
 */
function matchesFilter(value: unknown, filter: PropertyFilter): boolean {
  if (Array.isArray(value)) {
    switch (filter.operator) {
      case "equals":
        return value.includes(filter.value);
      case "not_equals":
        return !value.includes(filter.value);
      case "contains":
        return value.some((item) =>
          typeof item === "string" && typeof filter.value === "string"
            ? item.toLowerCase().includes(filter.value.toLowerCase())
            : item === filter.value
        );
      case "is_empty":
        return value.length === 0;
      case "is_not_empty":
        return value.length > 0;
      default:
        break;
    }
  }
  switch (filter.operator) {
    case "equals":
      return value === filter.value;

    case "not_equals":
      return value !== filter.value;

    case "contains":
      if (typeof value === "string" && typeof filter.value === "string") {
        return value.toLowerCase().includes(filter.value.toLowerCase());
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
