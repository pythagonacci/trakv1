"use server";

// Trak Universal Properties - Simplified Server Actions
// Fixed properties: status, priority, assignee, due date, tags

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type {
  EntityType,
  EntityProperties,
  EntityPropertiesWithInheritance,
  InheritedEntityProperties,
  SetEntityPropertiesInput,
  AddTagInput,
  RemoveTagInput,
  WorkspaceMember,
} from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

// ============================================================================
// Helper Functions
// ============================================================================

const FIXED_PROPERTY_DEFINITIONS = {
  status: {
    name: "Status",
    type: "select",
    options: [
      { id: "todo", label: "To Do", color: "gray" },
      { id: "in_progress", label: "In Progress", color: "blue" },
      { id: "blocked", label: "Blocked", color: "red" },
      { id: "done", label: "Done", color: "green" },
    ],
  },
  priority: {
    name: "Priority",
    type: "select",
    options: [
      { id: "low", label: "Low", color: "gray" },
      { id: "medium", label: "Medium", color: "yellow" },
      { id: "high", label: "High", color: "orange" },
      { id: "urgent", label: "Urgent", color: "red" },
    ],
  },
  assignee_id: { name: "Assignee", type: "person", options: [] },
  due_date: { name: "Due Date", type: "date", options: [] },
  tags: { name: "Tags", type: "multi_select", options: [] },
} as const;

type FixedPropertyKey = keyof typeof FIXED_PROPERTY_DEFINITIONS;

type FixedPropertyMaps = {
  byKey: Record<FixedPropertyKey, string>;
  byId: Record<string, FixedPropertyKey>;
};

async function loadFixedPropertyDefinitions(
  supabase: any,
  workspaceId: string
): Promise<FixedPropertyMaps | { error: string }> {
  const entries = Object.entries(FIXED_PROPERTY_DEFINITIONS) as Array<
    [FixedPropertyKey, (typeof FIXED_PROPERTY_DEFINITIONS)[FixedPropertyKey]]
  >;
  const names = entries.map(([, def]) => def.name);

  const fetchDefinitions = async () =>
    supabase
      .from("property_definitions")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .in("name", names);

  const { data: existing, error: existingError } = await fetchDefinitions();
  if (existingError) {
    console.error("loadFixedPropertyDefinitions error:", existingError);
    return { error: "Failed to load property definitions" };
  }

  const existingByName = new Map<string, string>();
  (existing ?? []).forEach((row: any) => existingByName.set(row.name, row.id));

  const missing = entries.filter(([, def]) => !existingByName.has(def.name));
  if (missing.length > 0) {
    const payload = missing.map(([, def]) => ({
      workspace_id: workspaceId,
      name: def.name,
      type: def.type,
      options: def.options,
    }));

    const { error: insertError } = await supabase
      .from("property_definitions")
      .insert(payload);
    if (insertError) {
      console.error("loadFixedPropertyDefinitions insert error:", insertError);
    }
  }

  const { data: refreshed, error: refreshError } = await fetchDefinitions();
  if (refreshError) {
    console.error("loadFixedPropertyDefinitions refresh error:", refreshError);
    return { error: "Failed to load property definitions" };
  }

  const keyByName = new Map<string, FixedPropertyKey>();
  entries.forEach(([key, def]) => keyByName.set(def.name, key));

  const byKey = {} as Record<FixedPropertyKey, string>;
  const byId: Record<string, FixedPropertyKey> = {};
  (refreshed ?? []).forEach((row: any) => {
    const key = keyByName.get(row.name);
    if (!key) return;
    byKey[key] = row.id;
    byId[row.id] = key;
  });

  const missingKeys = entries
    .map(([key]) => key)
    .filter((key) => !byKey[key]);
  if (missingKeys.length > 0) {
    console.error("Missing property definitions:", missingKeys.join(", "));
    return { error: "Missing property definitions" };
  }

  return { byKey, byId };
}

function buildEntityPropertiesFromRows(
  entityType: EntityType,
  entityId: string,
  workspaceId: string,
  rows: any[],
  byId: Record<string, FixedPropertyKey>
): EntityProperties {
  let createdAt = rows[0]?.created_at ?? new Date().toISOString();
  let updatedAt = rows[0]?.updated_at ?? createdAt;

  const props: EntityProperties = {
    id: rows[0]?.id ?? entityId,
    entity_type: entityType,
    entity_id: entityId,
    workspace_id: workspaceId,
    status: null,
    priority: null,
    assignee_id: null,
    assignee_ids: [],
    due_date: null,
    tags: [],
    created_at: createdAt,
    updated_at: updatedAt,
  };

  for (const row of rows) {
    const key = byId[row.property_definition_id];
    if (!key) continue;
    if (row.created_at && row.created_at < createdAt) createdAt = row.created_at;
    if (row.updated_at && row.updated_at > updatedAt) updatedAt = row.updated_at;

    switch (key) {
      case "status":
        props.status = typeof row.value === "string" ? (row.value as any) : null;
        break;
      case "priority":
        props.priority = typeof row.value === "string" ? (row.value as any) : null;
        break;
      case "assignee_id":
        // Handle array of {id, name}, single {id, name}, or legacy string ID
        if (Array.isArray(row.value) && row.value.length > 0) {
          const ids = (row.value as Array<{ id?: string }>)
            .map((a) => (a && typeof a === "object" && a.id) || null)
            .filter((id): id is string => Boolean(id));
          props.assignee_ids = ids;
          props.assignee_id = ids[0] ?? null;
        } else if (row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
          const single = row.value as { id?: string };
          props.assignee_id = single.id ?? null;
          props.assignee_ids = props.assignee_id ? [props.assignee_id] : [];
        } else if (typeof row.value === "string") {
          props.assignee_id = row.value;
          props.assignee_ids = row.value ? [row.value] : [];
        } else {
          props.assignee_id = null;
          props.assignee_ids = [];
        }
        break;
      case "due_date":
        props.due_date = typeof row.value === "string" ? row.value : null;
        break;
      case "tags":
        props.tags = Array.isArray(row.value)
          ? row.value.filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
          : [];
        break;
    }
  }

  props.created_at = createdAt;
  props.updated_at = updatedAt;
  return props;
}

async function upsertEntityPropertyValue(
  supabase: any,
  workspaceId: string,
  entityType: EntityType,
  entityId: string,
  propertyDefinitionId: string,
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return supabase
      .from("entity_properties")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("property_definition_id", propertyDefinitionId);
  }

  return supabase.from("entity_properties").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      workspace_id: workspaceId,
      property_definition_id: propertyDefinitionId,
      value,
    },
    {
      onConflict: "entity_type,entity_id,property_definition_id",
    }
  );
}

/**
 * Get workspace ID for an entity
 */
async function getWorkspaceIdForEntity(
  entityType: EntityType,
  entityId: string
): Promise<string | null> {
  const supabase = await createClient();

  switch (entityType) {
    case "block": {
      const { data } = await supabase
        .from("blocks")
        .select("tab_id, tabs!inner(project_id, projects!inner(workspace_id))")
        .eq("id", entityId)
        .maybeSingle();
      return (data?.tabs as any)?.projects?.workspace_id ?? null;
    }

    case "task": {
      const { data } = await supabase
        .from("task_items")
        .select("workspace_id")
        .eq("id", entityId)
        .maybeSingle();
      return data?.workspace_id ?? null;
    }

    case "timeline_event": {
      const { data } = await supabase
        .from("timeline_events")
        .select("workspace_id")
        .eq("id", entityId)
        .maybeSingle();
      return data?.workspace_id ?? null;
    }

    case "table_row": {
      const { data } = await supabase
        .from("table_rows")
        .select("table_id, tables!inner(workspace_id)")
        .eq("id", entityId)
        .maybeSingle();
      return (data?.tables as any)?.workspace_id ?? null;
    }

    default:
      return null;
  }
}

/**
 * Get entity title for display
 */
async function getEntityTitle(
  entityType: EntityType,
  entityId: string
): Promise<string> {
  const supabase = await createClient();

  switch (entityType) {
    case "block": {
      const { data } = await supabase
        .from("blocks")
        .select("content")
        .eq("id", entityId)
        .maybeSingle();
      return data?.content?.title || data?.content?.text || "Block";
    }

    case "task": {
      const { data } = await supabase
        .from("task_items")
        .select("text")
        .eq("id", entityId)
        .maybeSingle();
      return data?.text || "Task";
    }

    case "timeline_event": {
      const { data } = await supabase
        .from("timeline_events")
        .select("title")
        .eq("id", entityId)
        .maybeSingle();
      return data?.title || "Event";
    }

    case "table_row": {
      return "Table Row";
    }

    default:
      return "Entity";
  }
}

/**
 * Ensure user has access to entity
 */
async function requireEntityAccess(
  entityType: EntityType,
  entityId: string
): Promise<{ supabase: any; userId: string; workspaceId: string } | { error: string }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const workspaceId = await getWorkspaceIdForEntity(entityType, entityId);
  if (!workspaceId) {
    return { error: "Entity not found" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return { supabase, userId: user.id, workspaceId };
}

// ============================================================================
// Entity Properties CRUD
// ============================================================================

/**
 * Get direct properties for an entity
 */
export async function getEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityProperties | null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const definitionIds = Object.values(definitions.byKey).filter(Boolean);
  if (definitionIds.length === 0) return { data: null };

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, property_definition_id, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .in("property_definition_id", definitionIds);

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  if (!data || data.length === 0) return { data: null };

  const props = buildEntityPropertiesFromRows(
    entityType,
    entityId,
    workspaceId,
    data,
    definitions.byId
  );

  return { data: props };
}

/**
 * Bulk fetch direct properties for multiple entities of the same type.
 * Returns a map keyed by entity_id.
 */
export async function getEntitiesProperties(
  entityType: EntityType,
  entityIds: string[],
  workspaceId: string
): Promise<ActionResult<Record<string, EntityProperties>>> {
  if (entityIds.length === 0) return { data: {} };

  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const definitionIds = Object.values(definitions.byKey).filter(Boolean);
  if (definitionIds.length === 0) return { data: {} };

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, entity_id, property_definition_id, value, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .in("property_definition_id", definitionIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  const result: Record<string, EntityProperties> = {};
  const grouped = new Map<string, any[]>();
  for (const row of data ?? []) {
    const key = String((row as any).entity_id);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  for (const [id, rows] of grouped.entries()) {
    result[id] = buildEntityPropertiesFromRows(
      entityType,
      id,
      workspaceId,
      rows,
      definitions.byId
    );
  }

  return { data: result };
}

/**
 * Get properties with inheritance (direct + inherited from linked entities)
 */
export async function getEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertiesWithInheritance>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  // Get direct properties
  const definitionIds = Object.values(definitions.byKey).filter(Boolean);
  const { data: directRows, error: directError } = await supabase
    .from("entity_properties")
    .select("id, property_definition_id, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .in("property_definition_id", definitionIds);
  if (directError) {
    console.error("getEntityPropertiesWithInheritance error:", directError);
    return { error: "Failed to fetch entity properties" };
  }
  const direct =
    directRows && directRows.length > 0
      ? buildEntityPropertiesFromRows(
          entityType,
          entityId,
          workspaceId,
          directRows,
          definitions.byId
        )
      : null;

  // Get entities that link TO this entity (they pass their properties down)
  const { data: incomingLinks } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  const inherited: InheritedEntityProperties[] = [];

  // For each linking entity, get their properties
  for (const link of incomingLinks ?? []) {
    const { data: sourceRows } = await supabase
      .from("entity_properties")
      .select("id, property_definition_id, value, created_at, updated_at")
      .eq("entity_type", link.source_entity_type)
      .eq("entity_id", link.source_entity_id)
      .in("property_definition_id", definitionIds);

    if (!sourceRows || sourceRows.length === 0) continue;

    // Check visibility preference
    const { data: displayPref } = await supabase
      .from("entity_inherited_display")
      .select("is_visible")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("source_entity_type", link.source_entity_type)
      .eq("source_entity_id", link.source_entity_id)
      .maybeSingle();

    const isVisible = displayPref?.is_visible ?? true;

    // Get source entity title
    const sourceTitle = await getEntityTitle(
      link.source_entity_type as EntityType,
      link.source_entity_id
    );

    inherited.push({
      source_entity_type: link.source_entity_type as EntityType,
      source_entity_id: link.source_entity_id,
      source_title: sourceTitle,
      properties: buildEntityPropertiesFromRows(
        link.source_entity_type as EntityType,
        link.source_entity_id,
        workspaceId,
        sourceRows,
        definitions.byId
      ),
      visible: isVisible,
    });
  }

  return {
    data: {
      direct: direct || null,
      inherited,
    },
  };
}

/**
 * Set/update entity properties (upsert)
 */
export async function setEntityProperties(
  input: SetEntityPropertiesInput
): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const updates = input.updates;
  const upsertPromises: Promise<any>[] = [];

  if (updates.status !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.status,
        updates.status
      )
    );
  }
  if (updates.priority !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.priority,
        updates.priority
      )
    );
  }
  // Assignees: support assignee_ids (array) or legacy assignee_id (single)
  const assigneeIdsToSet =
    updates.assignee_ids !== undefined
      ? (updates.assignee_ids ?? [])
      : updates.assignee_id !== undefined
        ? (updates.assignee_id ? [updates.assignee_id] : [])
        : null;

  let assigneePayloadForTask: Array<{ id: string; name: string }> | null = null;
  if (assigneeIdsToSet !== null) {
    const assigneePayload: Array<{ id: string; name: string }> = [];
    if (assigneeIdsToSet.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", assigneeIdsToSet);
      const profileMap = new Map<string, { id: string; name: string }>(
        (profiles ?? []).map((p: any) => [p.id, { id: p.id, name: p.name || p.email || "Unknown" }])
      );
      for (const id of assigneeIdsToSet) {
        const p = profileMap.get(id);
        assigneePayload.push(p ? p : { id, name: "Unknown" });
      }
    }
    assigneePayloadForTask = assigneePayload;
    const assigneeValue =
      assigneePayload.length > 0 ? assigneePayload : null;
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.assignee_id,
        assigneeValue
      )
    );
  }
  if (updates.due_date !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.due_date,
        updates.due_date
      )
    );
  }
  if (updates.tags !== undefined) {
    const normalizedTags = updates.tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.tags,
        normalizedTags
      )
    );
  }

  const results = await Promise.all(upsertPromises);
  const firstError = results.find((result) => result?.error)?.error;
  if (firstError) {
    console.error("setEntityProperties error:", firstError);
    return { error: "Failed to set entity properties" };
  }

  const refreshed = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in refreshed) return refreshed;
  if (!refreshed.data) return { error: "Failed to set entity properties" };
  const data = refreshed.data;

  // Keep legacy task fields and task_assignees in sync. Universal properties are source of truth.
  if (input.entity_type === "task") {
    const status = (data as any).status as string | null;
    const priority = (data as any).priority as string | null;
    const dueDate = (data as any).due_date as string | null;
    const assigneeIds = (data as any).assignee_ids as string[] | undefined;
    const assigneeId = (data as any).assignee_id as string | null;

    const legacyStatus =
      status === "done"
        ? "done"
        : status === "in_progress"
        ? "in-progress"
        : status === "blocked"
        ? "todo"
        : "todo";

    const legacyPriority =
      priority === "low" || priority === "medium" || priority === "high" || priority === "urgent"
        ? priority
        : "none";

    const taskItemUpdates: Record<string, any> = {
      status: legacyStatus,
      priority: legacyPriority,
      due_date: dueDate ?? null,
      assignee_id: assigneeId ?? null,
    };

    await supabase
      .from("task_items")
      .update(taskItemUpdates)
      .eq("id", input.entity_id);

    // Sync task_assignees when assignees were updated (so task list and AI use same data)
    if (assigneePayloadForTask !== null) {
      const { setTaskAssignees } = await import("@/app/actions/tasks/assignee-actions");
      await setTaskAssignees(input.entity_id, assigneePayloadForTask, { replaceExisting: true });
    }
  }

  return { data };
}

/**
 * Add a tag to an entity
 */
export async function addTag(input: AddTagInput): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  // Normalize tag (trim and lowercase for matching)
  const normalizedTag = input.tag.trim().toLowerCase();
  if (!normalizedTag) {
    return { error: "Tag cannot be empty" };
  }

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const current = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in current) return current;

  const currentTags = current.data?.tags || [];
  
  // Check for duplicate (case-insensitive)
  if (currentTags.some((t: string) => t.toLowerCase() === normalizedTag)) {
    return { error: "Tag already exists" };
  }

  // Add new tag
  const newTags = [...currentTags, normalizedTag];

  const { error } = await upsertEntityPropertyValue(
    supabase,
    workspaceId,
    input.entity_type,
    input.entity_id,
    definitions.byKey.tags,
    newTags
  );

  if (error) {
    console.error("addTag error:", error);
    return { error: "Failed to add tag" };
  }

  const refreshed = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in refreshed) return refreshed;
  if (!refreshed.data) return { error: "Failed to add tag" };
  return { data: refreshed.data };
}

/**
 * Remove a tag from an entity
 */
export async function removeTag(input: RemoveTagInput): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const normalizedTag = input.tag.trim().toLowerCase();

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const existing = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in existing) return existing;

  if (!existing.data) {
    return { error: "Entity properties not found" };
  }

  // Remove tag (case-insensitive match)
  const newTags = (existing.data.tags || []).filter(
    (t: string) => t.toLowerCase() !== normalizedTag
  );

  const { error } = await upsertEntityPropertyValue(
    supabase,
    workspaceId,
    input.entity_type,
    input.entity_id,
    definitions.byKey.tags,
    newTags
  );

  if (error) {
    console.error("removeTag error:", error);
    return { error: "Failed to remove tag" };
  }

  const refreshed = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in refreshed) return refreshed;
  if (!refreshed.data) return { error: "Failed to remove tag" };
  return { data: refreshed.data };
}

/**
 * Clear all properties for an entity
 */
export async function clearEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("clearEntityProperties error:", error);
    return { error: "Failed to clear entity properties" };
  }

  // Best-effort sync for tasks: reset legacy fields to defaults
  if (entityType === "task") {
    await supabase
      .from("task_items")
      .update({
        status: "todo",
        priority: "none",
        due_date: null,
      })
      .eq("id", entityId);
  }

  return { data: null };
}

// ============================================================================
// Workspace Members (for assignee dropdown)
// ============================================================================

/**
 * Get all members of a workspace
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<ActionResult<WorkspaceMember[]>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("getWorkspaceMembers error:", error);
    return { error: "Failed to fetch workspace members" };
  }

  if (!members || members.length === 0) {
    return { data: [] };
  }

  const userIds = members.map((member: any) => member.user_id).filter(Boolean);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  if (profilesError) {
    console.error("getWorkspaceMembers profiles error:", profilesError);
    const fallback = members.map((member: any) => ({
      id: member.id || member.user_id,
      user_id: member.user_id || member.id,
      workspace_id: member.workspace_id ?? workspaceId,
      name: member.name || member.email || "Unknown",
      email: member.email || "",
      avatar_url: member.avatar_url ?? null,
      role: member.role,
    }));
    return { data: fallback };
  }

  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const transformed = members.map((member: any) => {
    const profile = profileMap.get(member.user_id);
    const name =
      profile?.name ||
      profile?.full_name ||
      profile?.display_name ||
      profile?.username ||
      member.name ||
      profile?.email ||
      member.email ||
      "Unknown";
    return {
      id: member.id || member.user_id,
      user_id: member.user_id || member.id,
      workspace_id: member.workspace_id ?? workspaceId,
      name,
      email: profile?.email || member.email || "",
      avatar_url: profile?.avatar_url ?? member.avatar_url ?? null,
      role: member.role,
    };
  });

  return { data: transformed };
}

// ============================================================================
// Entity Links (@ mentions and property inheritance)
// ============================================================================

/**
 * Create a link between two entities (@ mention)
 * Source entity properties will be inherited by target entity
 */
export async function createEntityLink(
  input: {
    source_entity_type: EntityType;
    source_entity_id: string;
    target_entity_type: EntityType;
    target_entity_id: string;
    workspace_id: string;
  }
): Promise<ActionResult<any>> {
  // Verify source entity access
  const sourceAccess = await requireEntityAccess(
    input.source_entity_type,
    input.source_entity_id
  );
  if ("error" in sourceAccess) return { error: sourceAccess.error };

  // Verify target entity exists and is in the same workspace
  const targetWorkspaceId = await getWorkspaceIdForEntity(
    input.target_entity_type,
    input.target_entity_id
  );

  if (!targetWorkspaceId) {
    return { error: "Target entity not found" };
  }

  if (targetWorkspaceId !== sourceAccess.workspaceId) {
    return { error: "Cannot link entities from different workspaces" };
  }

  // Prevent self-links
  if (
    input.source_entity_type === input.target_entity_type &&
    input.source_entity_id === input.target_entity_id
  ) {
    return { error: "Cannot link an entity to itself" };
  }

  const { supabase } = sourceAccess;

  const { data, error } = await supabase
    .from("entity_links")
    .insert({
      source_entity_type: input.source_entity_type,
      source_entity_id: input.source_entity_id,
      target_entity_type: input.target_entity_type,
      target_entity_id: input.target_entity_id,
      workspace_id: sourceAccess.workspaceId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createEntityLink error:", error);
    if (error.code === "23505") {
      return { error: "This link already exists" };
    }
    return { error: "Failed to create entity link" };
  }

  return { data };
}

/**
 * Remove a link between two entities
 */
export async function removeEntityLink(
  sourceEntityType: EntityType,
  sourceEntityId: string,
  targetEntityType: EntityType,
  targetEntityId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(sourceEntityType, sourceEntityId);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_links")
    .delete()
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", sourceEntityId)
    .eq("target_entity_type", targetEntityType)
    .eq("target_entity_id", targetEntityId);

  if (error) {
    console.error("removeEntityLink error:", error);
    return { error: "Failed to remove entity link" };
  }

  return { data: null };
}

/**
 * Get all links for an entity (both outgoing and incoming)
 */
export async function getEntityLinks(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<{ outgoing: any[]; incoming: any[] }>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  // Get outgoing links (this entity links to others)
  const { data: outgoing, error: outError } = await supabase
    .from("entity_links")
    .select("*")
    .eq("source_entity_type", entityType)
    .eq("source_entity_id", entityId);

  if (outError) {
    console.error("getEntityLinks outgoing error:", outError);
    return { error: "Failed to fetch outgoing links" };
  }

  // Get incoming links (others link to this entity)
  const { data: incoming, error: inError } = await supabase
    .from("entity_links")
    .select("*")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  if (inError) {
    console.error("getEntityLinks incoming error:", inError);
    return { error: "Failed to fetch incoming links" };
  }

  return {
    data: {
      outgoing: outgoing || [],
      incoming: incoming || [],
    },
  };
}

// ============================================================================
// Inherited Property Visibility
// ============================================================================

/**
 * Set visibility preference for an inherited property
 */
export async function setInheritedPropertyVisibility(
  input: {
    entity_type: EntityType;
    entity_id: string;
    source_entity_type: EntityType;
    source_entity_id: string;
    is_visible: boolean;
  }
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  const { error } = await supabase.from("entity_inherited_display").upsert(
    {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      source_entity_type: input.source_entity_type,
      source_entity_id: input.source_entity_id,
      is_visible: input.is_visible,
    },
    {
      onConflict: "entity_type,entity_id,source_entity_type,source_entity_id",
    }
  );

  if (error) {
    console.error("setInheritedPropertyVisibility error:", error);
    return { error: "Failed to update visibility preference" };
  }

  return { data: null };
}
