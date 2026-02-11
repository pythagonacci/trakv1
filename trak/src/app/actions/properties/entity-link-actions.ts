"use server";

// Universal Properties & Linking System - Entity Link Actions
// Create/remove/query links (@ mentions) between entities

import { createClient } from "@/lib/supabase/server";
import {
  requireEntityAccess,
  requireWorkspaceAccessForProperties,
  getWorkspaceIdForEntity,
} from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type {
  EntityType,
  EntityLink,
  CreateEntityLinkInput,
  EntityReference,
} from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Create a link between two entities.
 * The source entity "links to" / "mentions" the target entity.
 * Properties from the source entity will be inherited by the target.
 */
export async function createEntityLink(
  input: CreateEntityLinkInput
): Promise<ActionResult<EntityLink>> {
  // Verify source entity access
  const sourceAccess = await requireEntityAccess(
    input.source_entity_type,
    input.source_entity_id
  );
  if ("error" in sourceAccess) return { error: sourceAccess.error ?? "Unknown error" };

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
 * Remove a link between two entities.
 */
export async function removeEntityLink(
  sourceEntityType: EntityType,
  sourceEntityId: string,
  targetEntityType: EntityType,
  targetEntityId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(sourceEntityType, sourceEntityId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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
 * Get all links for an entity (both outgoing and incoming).
 */
export async function getEntityLinks(
  entityType: EntityType,
  entityId: string
): Promise<
  ActionResult<{
    outgoing: EntityLink[];
    incoming: EntityLink[];
  }>
> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
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
      outgoing: outgoing ?? [],
      incoming: incoming ?? [],
    },
  };
}

/**
 * Get entities that this entity links to (outgoing references).
 */
export async function getLinkedEntities(
  entityType: EntityType,
  entityId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireEntityAccess(entityType, entityId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: links, error } = await supabase
    .from("entity_links")
    .select("target_entity_type, target_entity_id")
    .eq("source_entity_type", entityType)
    .eq("source_entity_id", entityId);

  if (error) {
    console.error("getLinkedEntities error:", error);
    return { error: "Failed to fetch linked entities" };
  }

  const references: EntityReference[] = [];

  for (const link of links ?? []) {
    const ref = await resolveEntityReference(
      link.target_entity_type as EntityType,
      link.target_entity_id,
      supabase
    );
    if (ref) {
      references.push(ref);
    }
  }

  return { data: references };
}

/**
 * Get entities that link to this entity (incoming references).
 */
export async function getLinkingEntities(
  entityType: EntityType,
  entityId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireEntityAccess(entityType, entityId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: links, error } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  if (error) {
    console.error("getLinkingEntities error:", error);
    return { error: "Failed to fetch linking entities" };
  }

  const references: EntityReference[] = [];

  for (const link of links ?? []) {
    const ref = await resolveEntityReference(
      link.source_entity_type as EntityType,
      link.source_entity_id,
      supabase
    );
    if (ref) {
      references.push(ref);
    }
  }

  return { data: references };
}

/**
 * Search for entities that can be linked (for @ mention picker).
 * Returns recent entities matching the search query.
 */
export async function searchLinkableEntities(
  workspaceId: string,
  query: string,
  entityTypes?: EntityType[],
  limit: number = 10,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireWorkspaceAccessForProperties(workspaceId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const types = entityTypes ?? ["block", "task", "timeline_event", "table_row"];
  const results: EntityReference[] = [];
  const searchQuery = query.toLowerCase().trim();

  // Search blocks
  if (types.includes("block") && results.length < limit) {
    const { data: blocks } = await supabase
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
          projects!inner(workspace_id)
        )
      `
      )
      .eq("tabs.projects.workspace_id", workspaceId)
      .limit(limit - results.length);

    for (const block of blocks ?? []) {
      const title = getBlockTitle(block);
      if (!searchQuery || title.toLowerCase().includes(searchQuery)) {
        results.push({
          type: "block",
          id: block.id,
          title,
          context: (block.tabs as any)?.name ?? "",
        });
      }
    }
  }

  // Search tasks
  if (types.includes("task") && results.length < limit) {
    const { data: tasks } = await supabase
      .from("task_items")
      .select("id, title, tab_id, tabs(name)")
      .eq("workspace_id", workspaceId)
      .ilike("title", `%${searchQuery}%`)
      .limit(limit - results.length);

    for (const task of tasks ?? []) {
      results.push({
        type: "task",
        id: task.id,
        title: task.title,
        context: (task.tabs as any)?.name ?? "",
      });
    }
  }

  // Search timeline events
  if (types.includes("timeline_event") && results.length < limit) {
    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, title, timeline_block_id")
      .eq("workspace_id", workspaceId)
      .ilike("title", `%${searchQuery}%`)
      .limit(limit - results.length);

    for (const event of events ?? []) {
      results.push({
        type: "timeline_event",
        id: event.id,
        title: event.title,
        context: "Timeline",
      });
    }
  }

  // Search table rows
  if (types.includes("table_row") && results.length < limit) {
    const { data: rows } = await supabase
      .from("table_rows")
      .select(
        `
        id,
        data,
        tables!inner(
          id,
          title,
          workspace_id,
          table_fields(id, name, is_primary)
        )
      `
      )
      .eq("tables.workspace_id", workspaceId)
      .limit(limit - results.length);

    for (const row of rows ?? []) {
      const title = getTableRowTitle(row);
      if (!searchQuery || title.toLowerCase().includes(searchQuery)) {
        const table = Array.isArray(row.tables) ? row.tables[0] : row.tables;
        results.push({
          type: "table_row",
          id: row.id,
          title,
          context: table?.title ?? "Table",
        });
      }
    }
  }

  return { data: results.slice(0, limit) };
}

// Helper functions

/**
 * Resolve an entity reference to get its display title.
 */
async function resolveEntityReference(
  entityType: EntityType,
  entityId: string,
  supabase: any
): Promise<EntityReference | null> {
  switch (entityType) {
    case "block": {
      const { data } = await supabase
        .from("blocks")
        .select("id, type, content, tabs(name)")
        .eq("id", entityId)
        .maybeSingle();

      if (!data) return null;
      return {
        type: "block",
        id: data.id,
        title: getBlockTitle(data),
        context: data.tabs?.name ?? "",
      };
    }

    case "task": {
      const { data } = await supabase
        .from("task_items")
        .select("id, title, tabs(name)")
        .eq("id", entityId)
        .maybeSingle();

      if (!data) return null;
      return {
        type: "task",
        id: data.id,
        title: data.title,
        context: data.tabs?.name ?? "",
      };
    }

    case "subtask": {
      const { data } = await supabase
        .from("task_subtasks")
        .select("id, title, task_items(title)")
        .eq("id", entityId)
        .maybeSingle();

      if (!data) return null;
      return {
        type: "subtask",
        id: data.id,
        title: data.title,
        context: (data.task_items as any)?.title ?? "",
      };
    }

    case "timeline_event": {
      const { data } = await supabase
        .from("timeline_events")
        .select("id, title")
        .eq("id", entityId)
        .maybeSingle();

      if (!data) return null;
      return {
        type: "timeline_event",
        id: data.id,
        title: data.title,
        context: "Timeline",
      };
    }

    case "table_row": {
      const { data } = await supabase
        .from("table_rows")
        .select(
          `
          id,
          data,
          tables(title, table_fields(id, name, is_primary))
        `
        )
        .eq("id", entityId)
        .maybeSingle();

      if (!data) return null;
      const table = Array.isArray(data.tables) ? data.tables[0] : data.tables;
      return {
        type: "table_row",
        id: data.id,
        title: getTableRowTitle(data),
        context: table?.title ?? "Table",
      };
    }

    default:
      return null;
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
      // Extract text from content, handling both plain text and rich text formats
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
