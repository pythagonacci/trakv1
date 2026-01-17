"use server";

// Universal Properties & Linking System - Context utilities
// Centralizes workspace membership and entity access checks for property operations

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityType } from "@/types/properties";
import { normalizePropertyName, isSimilarPropertyName } from "@/lib/properties/name-utils";

export interface WorkspaceAccessContext {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
}

export interface PropertyDefinitionAccessContext {
  supabase: SupabaseClient;
  userId: string;
  definition: {
    id: string;
    workspace_id: string;
  };
}

/**
 * Ensures a user can act within a workspace (used for create/read flows).
 */
export async function requireWorkspaceAccessForProperties(
  workspaceId: string
): Promise<WorkspaceAccessContext | { error: string }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return { supabase, userId: user.id, workspaceId };
}

/**
 * Fetches property definition and ensures the requesting user belongs to its workspace.
 */
export async function requirePropertyDefinitionAccess(
  definitionId: string
): Promise<PropertyDefinitionAccessContext | { error: string }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: definition, error: defError } = await supabase
    .from("property_definitions")
    .select("id, workspace_id")
    .eq("id", definitionId)
    .maybeSingle();

  if (defError || !definition) {
    return { error: "Property definition not found" };
  }

  const membership = await checkWorkspaceMembership(definition.workspace_id, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return { supabase, userId: user.id, definition };
}

/**
 * Gets workspace_id for any entity type.
 * Used to validate workspace membership before property operations.
 */
export async function getWorkspaceIdForEntity(
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
 * Ensures the user has access to perform operations on a specific entity.
 */
export async function requireEntityAccess(
  entityType: EntityType,
  entityId: string
): Promise<WorkspaceAccessContext | { error: string }> {
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

// Re-export utility functions for backwards compatibility
// Note: These are imported from @/lib/properties/name-utils (not Server Actions)
export { normalizePropertyName, isSimilarPropertyName };
