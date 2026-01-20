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
  const { supabase } = access;

  const { data, error } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  return { data: data || null };
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
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  const result: Record<string, EntityProperties> = {};
  for (const row of data ?? []) {
    // entity_id is UUID in DB; ensure it's a string key
    result[String((row as any).entity_id)] = row as EntityProperties;
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
  const { supabase } = access;

  // Get direct properties
  const { data: direct } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  // Get entities that link TO this entity (they pass their properties down)
  const { data: incomingLinks } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  const inherited: InheritedEntityProperties[] = [];

  // For each linking entity, get their properties
  for (const link of incomingLinks ?? []) {
    const { data: sourceProps } = await supabase
      .from("entity_properties")
      .select("*")
      .eq("entity_type", link.source_entity_type)
      .eq("entity_id", link.source_entity_id)
      .maybeSingle();

    if (!sourceProps) continue;

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
      properties: sourceProps,
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

  // Get existing properties
  const { data: existing } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .maybeSingle();

  // Merge updates with existing values
  const updates = {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    workspace_id: workspaceId,
    status: input.updates.status !== undefined ? input.updates.status : existing?.status || null,
    priority: input.updates.priority !== undefined ? input.updates.priority : existing?.priority || null,
    assignee_id: input.updates.assignee_id !== undefined ? input.updates.assignee_id : existing?.assignee_id || null,
    due_date: input.updates.due_date !== undefined ? input.updates.due_date : existing?.due_date || null,
    tags: input.updates.tags !== undefined ? input.updates.tags : existing?.tags || [],
  };

  const { data, error } = await supabase
    .from("entity_properties")
    .upsert(updates, {
      onConflict: "entity_type,entity_id",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("setEntityProperties error:", error);
    return { error: "Failed to set entity properties" };
  }

  // Keep legacy task fields loosely in sync (so existing task UI/queries don't drift).
  // Universal properties are the source of truth.
  if (input.entity_type === "task") {
    const status = (data as any).status as string | null;
    const priority = (data as any).priority as string | null;
    const dueDate = (data as any).due_date as string | null;

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

    await supabase
      .from("task_items")
      .update({
        status: legacyStatus,
        priority: legacyPriority,
        due_date: dueDate ?? null,
      })
      .eq("id", input.entity_id);
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

  // Get existing properties
  const { data: existing } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .maybeSingle();

  const currentTags = existing?.tags || [];
  
  // Check for duplicate (case-insensitive)
  if (currentTags.some((t: string) => t.toLowerCase() === normalizedTag)) {
    return { error: "Tag already exists" };
  }

  // Add new tag
  const newTags = [...currentTags, normalizedTag];

  // Upsert
  const { data, error } = await supabase
    .from("entity_properties")
    .upsert(
      {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        workspace_id: workspaceId,
        status: existing?.status || null,
        priority: existing?.priority || null,
        assignee_id: existing?.assignee_id || null,
        due_date: existing?.due_date || null,
        tags: newTags,
      },
      {
        onConflict: "entity_type,entity_id",
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("addTag error:", error);
    return { error: "Failed to add tag" };
  }

  return { data };
}

/**
 * Remove a tag from an entity
 */
export async function removeTag(input: RemoveTagInput): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  const normalizedTag = input.tag.trim().toLowerCase();

  // Get existing properties
  const { data: existing } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .maybeSingle();

  if (!existing) {
    return { error: "Entity properties not found" };
  }

  // Remove tag (case-insensitive match)
  const newTags = (existing.tags || []).filter(
    (t: string) => t.toLowerCase() !== normalizedTag
  );

  const { data, error } = await supabase
    .from("entity_properties")
    .update({ tags: newTags })
    .eq("entity_type", input.entity_type)
    .eq("entity_id", input.entity_id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("removeTag error:", error);
    return { error: "Failed to remove tag" };
  }

  return { data };
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
