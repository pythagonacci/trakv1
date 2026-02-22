"use server";

// Trak Universal Properties - Simplified Server Actions
// Fixed properties: status, priority, assignee, due date, tags

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import { getDueDateEnd, getDueDateStart, normalizeDueDateRange } from "@/lib/due-date";
import { normalizeTimelinePriorities } from "@/lib/timeline-priority-sync";
import { normalizeTimelineStatuses } from "@/lib/timeline-status-sync";
import type {
  EntityType,
  EntityProperties,
  EntityPropertiesWithInheritance,
  SetEntityPropertiesInput,
  AddTagInput,
  RemoveTagInput,
  Priority,
  FieldType,
  Status,
  WorkspaceMember,
} from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

// ============================================================================
// Helper Functions
// ============================================================================

const FIXED_PROPERTY_DEFINITIONS = {
  status: {
    fieldName: "Status",
    fieldType: "status" as FieldType,
  },
  priority: {
    fieldName: "Priority",
    fieldType: "priority" as FieldType,
  },
  assignee_id: { fieldName: "Assignee", fieldType: "assignee" as FieldType },
  due_date: { fieldName: "Due Date", fieldType: "due_date" as FieldType },
  tags: { fieldName: "Tags", fieldType: "tags" as FieldType },
} as const;

type FixedPropertyKey = keyof typeof FIXED_PROPERTY_DEFINITIONS;

type FixedPropertyMaps = {
  byKey: Record<FixedPropertyKey, FixedPropertyKey>;
};

async function loadFixedPropertyDefinitions(
  _supabase: any,
  _workspaceId: string
): Promise<FixedPropertyMaps | { error: string }> {
  return {
    byKey: {
      status: "status",
      priority: "priority",
      assignee_id: "assignee_id",
      due_date: "due_date",
      tags: "tags",
    },
  };
}

function buildEntityPropertiesFromRows(
  entityType: EntityType,
  entityId: string,
  workspaceId: string,
  rows: any[]
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
    priorities: [],
    statuses: [],
    assignees: [],
    due_dates: [],
    tag_fields: [],
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const toPriority = (value: unknown): Priority | null => {
    if (value === "low" || value === "medium" || value === "high" || value === "urgent") return value;
    return null;
  };
  const toStatus = (value: unknown): Status | null => {
    if (value === "todo" || value === "in_progress" || value === "blocked" || value === "done") return value;
    return null;
  };
  const getRowKey = (row: any): FixedPropertyKey | null => {
    const fieldType = typeof row.field_type === "string" ? row.field_type : null;
    if (fieldType === "status") return "status";
    if (fieldType === "priority") return "priority";
    if (fieldType === "assignee") return "assignee_id";
    if (fieldType === "due_date") return "due_date";
    if (fieldType === "tags") return "tags";
    const fieldName = String(row.field_name || "").trim().toLowerCase();
    if (fieldName === "status") return "status";
    if (fieldName === "priority") return "priority";
    if (fieldName === "assignee") return "assignee_id";
    if (fieldName === "due date") return "due_date";
    if (fieldName === "tags") return "tags";
    return null;
  };
  const pickPreferred = <T,>(fields: Array<{ field_name: string; value: T }>, preferredName: string): T | null => {
    if (fields.length === 0) return null;
    const preferred = fields.find((field) => field.field_name.trim().toLowerCase() === preferredName.trim().toLowerCase());
    return (preferred ?? fields[0])?.value ?? null;
  };

  for (const row of rows) {
    const key = getRowKey(row);
    if (!key) continue;
    if (row.created_at && row.created_at < createdAt) createdAt = row.created_at;
    if (row.updated_at && row.updated_at > updatedAt) updatedAt = row.updated_at;

    switch (key) {
      case "status": {
        const value = toStatus(row.value);
        if (!value) break;
        props.statuses.push({
          id: row.id,
          entity_type: entityType,
          entity_id: entityId,
          workspace_id: workspaceId,
          field_name: row.field_name ?? FIXED_PROPERTY_DEFINITIONS.status.fieldName,
          field_type: "status",
          value,
          created_at: row.created_at ?? createdAt,
          updated_at: row.updated_at ?? updatedAt,
        });
        break;
      }
      case "priority": {
        const value = toPriority(row.value);
        if (!value) break;
        props.priorities.push({
          id: row.id,
          entity_type: entityType,
          entity_id: entityId,
          workspace_id: workspaceId,
          field_name: row.field_name ?? FIXED_PROPERTY_DEFINITIONS.priority.fieldName,
          field_type: "priority",
          value,
          created_at: row.created_at ?? createdAt,
          updated_at: row.updated_at ?? updatedAt,
        });
        break;
      }
      case "assignee_id": {
        const ids = extractAssigneeIdsFromValue(row.value);
        props.assignees.push({
          id: row.id,
          entity_type: entityType,
          entity_id: entityId,
          workspace_id: workspaceId,
          field_name: row.field_name ?? FIXED_PROPERTY_DEFINITIONS.assignee_id.fieldName,
          field_type: "assignee",
          value: ids,
          created_at: row.created_at ?? createdAt,
          updated_at: row.updated_at ?? updatedAt,
        });
        break;
      }
      case "due_date": {
        const range = normalizeDueDateRange(row.value);
        if (!range) break;
        props.due_dates.push({
          id: row.id,
          entity_type: entityType,
          entity_id: entityId,
          workspace_id: workspaceId,
          field_name: row.field_name ?? FIXED_PROPERTY_DEFINITIONS.due_date.fieldName,
          field_type: "due_date",
          value: range,
          created_at: row.created_at ?? createdAt,
          updated_at: row.updated_at ?? updatedAt,
        });
        break;
      }
      case "tags": {
        const tags = Array.isArray(row.value)
          ? row.value.filter((tag: any) => typeof tag === "string" && tag.trim() !== "")
          : [];
        props.tag_fields.push({
          id: row.id,
          entity_type: entityType,
          entity_id: entityId,
          workspace_id: workspaceId,
          field_name: row.field_name ?? FIXED_PROPERTY_DEFINITIONS.tags.fieldName,
          field_type: "tags",
          value: tags,
          created_at: row.created_at ?? createdAt,
          updated_at: row.updated_at ?? updatedAt,
        });
        break;
      }
    }
  }

  props.status = pickPreferred(props.statuses, FIXED_PROPERTY_DEFINITIONS.status.fieldName);
  props.priority = pickPreferred(props.priorities, FIXED_PROPERTY_DEFINITIONS.priority.fieldName);
  const preferredAssignees = pickPreferred(props.assignees, FIXED_PROPERTY_DEFINITIONS.assignee_id.fieldName) ?? [];
  props.assignee_ids = preferredAssignees;
  props.assignee_id = preferredAssignees[0] ?? null;
  props.due_date = pickPreferred(props.due_dates, FIXED_PROPERTY_DEFINITIONS.due_date.fieldName);
  props.tags = pickPreferred(props.tag_fields, FIXED_PROPERTY_DEFINITIONS.tags.fieldName) ?? [];

  props.created_at = createdAt;
  props.updated_at = updatedAt;
  return props;
}

async function upsertEntityPropertyValue(
  supabase: any,
  workspaceId: string,
  entityType: EntityType,
  entityId: string,
  key: FixedPropertyKey,
  value: unknown,
  fieldNameOverride?: string
) {
  const def = FIXED_PROPERTY_DEFINITIONS[key];
  const field_name = fieldNameOverride ?? def.fieldName;
  const field_type = def.fieldType;

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
      .eq("field_name", field_name);
  }

  return supabase.from("entity_properties").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      workspace_id: workspaceId,
      field_name,
      field_type,
      value,
    },
    {
      onConflict: "entity_type,entity_id,field_name",
    }
  );
}

type AssigneePayload = Array<{ id: string; name: string }>;

function extractAssigneeIdsFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object" && "id" in item) {
          const id = (item as { id?: string }).id;
          return typeof id === "string" ? id : null;
        }
        if (typeof item === "string") return item;
        return null;
      })
      .filter((id): id is string => Boolean(id));
  }
  if (value && typeof value === "object" && "id" in (value as any)) {
    const id = (value as { id?: string }).id;
    return typeof id === "string" ? [id] : [];
  }
  if (typeof value === "string") {
    return value ? [value] : [];
  }
  return [];
}

async function buildAssigneePayloadFromIds(
  supabase: any,
  assigneeIds: string[]
): Promise<AssigneePayload> {
  if (assigneeIds.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", assigneeIds);
  const profileMap = new Map<string, { id: string; name: string }>(
    (profiles ?? []).map((p: any) => [p.id, { id: p.id, name: p.name || p.email || "Unknown" }])
  );
  return assigneeIds.map((id) => profileMap.get(id) ?? { id, name: "Unknown" });
}

async function computeSubtaskAggregates(
  supabase: any,
  _workspaceId: string,
  taskId: string,
  _definitions: FixedPropertyMaps
): Promise<{ status: Status; assigneeIds: string[]; assigneePayload: AssigneePayload } | null> {
  const { data: subtasks, error } = await supabase
    .from("task_subtasks")
    .select("id, completed")
    .eq("task_id", taskId);
  if (error || !subtasks || subtasks.length === 0) return null;

  const subtaskIds = subtasks.map((subtask: any) => subtask.id);
  const { data: propertyRows } = await supabase
    .from("entity_properties")
    .select("entity_id, field_type, field_name, value")
    .eq("entity_type", "subtask")
    .in("entity_id", subtaskIds)
    .in("field_type", ["status", "assignee"]);

  const statusBySubtask = new Map<string, Status>();
  const assigneesBySubtask = new Map<string, string[]>();

  for (const row of propertyRows || []) {
    if (row.field_type === "status" && typeof row.value === "string") {
      if (row.value === "todo" || row.value === "in_progress" || row.value === "blocked" || row.value === "done") {
        const existing = statusBySubtask.get(row.entity_id);
        const isCanonical = String(row.field_name || "").trim().toLowerCase() === "status";
        if (!existing || isCanonical) {
          statusBySubtask.set(row.entity_id, row.value as Status);
        }
      }
    }
    if (row.field_type === "assignee") {
      const next = extractAssigneeIdsFromValue(row.value);
      const isCanonical = String(row.field_name || "").trim().toLowerCase() === "assignee";
      if (!assigneesBySubtask.has(row.entity_id) || isCanonical) {
        assigneesBySubtask.set(row.entity_id, next);
      }
    }
  }

  const statuses: Status[] = subtasks.map((subtask: any): Status => {
    const fallback = subtask.completed ? "done" : "todo";
    return statusBySubtask.get(subtask.id) ?? fallback;
  });

  const allDone = statuses.every((status) => status === "done");
  const allTodo = statuses.every((status) => status === "todo");
  const anyInProgress = statuses.some((status) => status === "in_progress");
  const anyBlocked = statuses.some((status) => status === "blocked");

  let status: Status = "todo";
  if (allDone) status = "done";
  else if (anyInProgress) status = "in_progress";
  else if (anyBlocked) status = "blocked";
  else if (allTodo) status = "todo";
  else status = "in_progress";

  const assigneeSet = new Set<string>();
  for (const ids of assigneesBySubtask.values()) {
    ids.forEach((id) => assigneeSet.add(id));
  }
  const assigneeIds = Array.from(assigneeSet);
  const assigneePayload = await buildAssigneePayloadFromIds(supabase, assigneeIds);

  return { status, assigneeIds, assigneePayload };
}

async function syncParentTaskPropertiesFromSubtasks(
  supabase: any,
  workspaceId: string,
  taskId: string,
  definitions: FixedPropertyMaps
) {
  const aggregates = await computeSubtaskAggregates(supabase, workspaceId, taskId, definitions);
  if (!aggregates) return;

  const { status, assigneeIds, assigneePayload } = aggregates;

  await upsertEntityPropertyValue(
    supabase,
    workspaceId,
    "task",
    taskId,
    definitions.byKey.status,
    status
  );

  await upsertEntityPropertyValue(
    supabase,
    workspaceId,
    "task",
    taskId,
    definitions.byKey.assignee_id,
    assigneePayload.length > 0 ? assigneePayload : null
  );

  const legacyStatus =
    status === "done"
      ? "done"
      : status === "in_progress"
        ? "in-progress"
        : status === "blocked"
          ? "todo"
          : "todo";

  await supabase
    .from("task_items")
    .update({
      status: legacyStatus,
      assignee_id: assigneeIds[0] ?? null,
    })
    .eq("id", taskId);

  await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (assigneePayload.length > 0) {
    const payload = assigneePayload.map((assignee) => ({
      task_id: taskId,
      assignee_id: assignee.id,
      assignee_name: assignee.name || assignee.id || "Unknown",
    }));
    await supabase.from("task_assignees").insert(payload);
  }
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

    case "subtask": {
      const { data } = await supabase
        .from("task_subtasks")
        .select("task_id, task_items!inner(workspace_id)")
        .eq("id", entityId)
        .maybeSingle();
      return (data?.task_items as any)?.workspace_id ?? null;
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

    case "subtask": {
      const { data } = await supabase
        .from("task_subtasks")
        .select("title")
        .eq("id", entityId)
        .maybeSingle();
      return data?.title || "Subtask";
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

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, field_name, field_type, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  if (!data || data.length === 0) return { data: null };

  const props = buildEntityPropertiesFromRows(
    entityType,
    entityId,
    workspaceId,
    data
  );

  return { data: props };
}

/**
 * Get direct properties for a block (convenience wrapper for getEntityProperties).
 * Use when creating table rows, timeline events, or tasks from blocks to read block properties.
 */
export async function getBlockProperties(
  blockId: string
): Promise<ActionResult<EntityProperties | null>> {
  return getEntityProperties("block", blockId);
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

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, entity_id, field_name, field_type, value, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

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
      rows
    );
  }

  return { data: result };
}

/**
 * Get properties (direct only; inheritance removed).
 */
export async function getEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertiesWithInheritance>> {
  const directResult = await getEntityProperties(entityType, entityId);
  if ("error" in directResult) return directResult;
  return {
    data: {
      direct: directResult.data ?? null,
      inherited: [],
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
  if (updates.priorities !== undefined) {
    const normalizedNamedPriorities = (updates.priorities ?? [])
      .filter((entry) => entry && typeof entry.field_name === "string")
      .map((entry) => ({
        field_name: entry.field_name.trim(),
        value: entry.value,
      }))
      .filter((entry) => entry.field_name.length > 0);

    await supabase
      .from("entity_properties")
      .delete()
      .eq("entity_type", input.entity_type)
      .eq("entity_id", input.entity_id)
      .eq("field_type", "priority");

    for (const entry of normalizedNamedPriorities) {
      upsertPromises.push(
        upsertEntityPropertyValue(
          supabase,
          workspaceId,
          input.entity_type,
          input.entity_id,
          definitions.byKey.priority,
          entry.value,
          entry.field_name
        )
      );
    }
  }
  if (updates.statuses !== undefined) {
    const normalizedNamedStatuses = (updates.statuses ?? [])
      .filter((entry) => entry && typeof entry.field_name === "string")
      .map((entry) => ({
        field_name: entry.field_name.trim(),
        value: entry.value,
      }))
      .filter((entry) => entry.field_name.length > 0);

    await supabase
      .from("entity_properties")
      .delete()
      .eq("entity_type", input.entity_type)
      .eq("entity_id", input.entity_id)
      .eq("field_type", "status");

    for (const entry of normalizedNamedStatuses) {
      upsertPromises.push(
        upsertEntityPropertyValue(
          supabase,
          workspaceId,
          input.entity_type,
          input.entity_id,
          definitions.byKey.status,
          entry.value,
          entry.field_name
        )
      );
    }
  }

  if (updates.assignees !== undefined) {
    const normalizedNamedAssignees = (updates.assignees ?? [])
      .filter((entry) => entry && typeof entry.field_name === "string")
      .map((entry) => ({
        field_name: entry.field_name.trim(),
        value: entry.value ?? [],
      }))
      .filter((entry) => entry.field_name.length > 0);

    await supabase
      .from("entity_properties")
      .delete()
      .eq("entity_type", input.entity_type)
      .eq("entity_id", input.entity_id)
      .eq("field_type", "assignee");

    for (const entry of normalizedNamedAssignees) {
      const payload = await buildAssigneePayloadFromIds(supabase, entry.value);
      const value = payload.length > 0 ? payload : null;
      upsertPromises.push(
        upsertEntityPropertyValue(
          supabase,
          workspaceId,
          input.entity_type,
          input.entity_id,
          definitions.byKey.assignee_id,
          value,
          entry.field_name
        )
      );
    }
  }

  if (updates.due_dates !== undefined) {
    const normalizedNamedDueDates = (updates.due_dates ?? [])
      .filter((entry) => entry && typeof entry.field_name === "string")
      .map((entry) => ({
        field_name: entry.field_name.trim(),
        value: normalizeDueDateRange(entry.value),
      }))
      .filter((entry) => entry.field_name.length > 0);

    await supabase
      .from("entity_properties")
      .delete()
      .eq("entity_type", input.entity_type)
      .eq("entity_id", input.entity_id)
      .eq("field_type", "due_date");

    for (const entry of normalizedNamedDueDates) {
      upsertPromises.push(
        upsertEntityPropertyValue(
          supabase,
          workspaceId,
          input.entity_type,
          input.entity_id,
          definitions.byKey.due_date,
          entry.value,
          entry.field_name
        )
      );
    }
  }

  // Assignees: support assignee_ids (array) or legacy assignee_id (single)
  const assigneeIdsToSet =
    updates.assignee_ids !== undefined
      ? (updates.assignee_ids ?? [])
      : updates.assignee_id !== undefined
        ? (updates.assignee_id ? [updates.assignee_id] : [])
        : null;

  const normalizedDueDate =
    updates.due_date !== undefined
      ? normalizeDueDateRange(updates.due_date)
      : undefined;

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
        normalizedDueDate
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
    const dueDateRange = (data as any).due_date as EntityProperties["due_date"];
    const dueDate = getDueDateEnd(dueDateRange);
    const startDate = getDueDateStart(dueDateRange);
    const assigneeId = (data as any).assignee_id as string | null;
    const priorities = Array.isArray((data as any).priorities) ? (data as any).priorities : [];

    const taskStatuses = (data as any).statuses ?? [];
    const taskPriorities = priorities
      .map((field: any) => ({
        field_name: String(field?.field_name || "").trim(),
        value:
          field?.value === "low" || field?.value === "medium" || field?.value === "high" || field?.value === "urgent"
            ? field.value
            : null,
      }))
      .filter((field: any) => field.field_name.length > 0 && field.value);

    const taskItemUpdates: Record<string, any> = {
      statuses: taskStatuses,
      priorities: taskPriorities,
      assignee_id: assigneeId ?? null,
    };
    if (updates.due_date !== undefined) {
      taskItemUpdates.due_date = dueDate ?? null;
      taskItemUpdates.start_date = startDate ?? null;
    }

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

  if (input.entity_type === "subtask") {
    if (updates.status !== undefined) {
      await supabase
        .from("task_subtasks")
        .update({ completed: updates.status === "done" })
        .eq("id", input.entity_id);
    }

    const shouldSyncParent =
      updates.status !== undefined ||
      updates.assignee_ids !== undefined ||
      updates.assignee_id !== undefined;

    if (shouldSyncParent) {
      const { data: subtask } = await supabase
        .from("task_subtasks")
        .select("task_id")
        .eq("id", input.entity_id)
        .maybeSingle();
      if (subtask?.task_id) {
        await syncParentTaskPropertiesFromSubtasks(
          supabase,
          workspaceId,
          subtask.task_id,
          definitions as FixedPropertyMaps
        );
      }
    }
  }

  if (
    input.entity_type === "timeline_event" &&
    (updates.priority !== undefined || updates.priorities !== undefined ||
      updates.status !== undefined || updates.statuses !== undefined)
  ) {
    const timelinePriorities = normalizeTimelinePriorities((data as any).priorities ?? []);
    const timelineUpdate: Record<string, unknown> = { priorities: timelinePriorities };
    if (updates.status !== undefined || updates.statuses !== undefined) {
      timelineUpdate.statuses = normalizeTimelineStatuses((data as any).statuses ?? []);
    }
    await supabase
      .from("timeline_events")
      .update(timelineUpdate)
      .eq("id", input.entity_id);
  }

  return { data };
}

/**
 * Recompute parent task status + assignees from its subtasks.
 * Useful after subtask create/delete events.
 */
export async function recomputeTaskPropertiesFromSubtasks(
  taskId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess("task", taskId);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  await syncParentTaskPropertiesFromSubtasks(supabase, workspaceId, taskId, definitions);
  return { data: null };
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
        priorities: [],
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
