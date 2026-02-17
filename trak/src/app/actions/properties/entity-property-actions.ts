"use server";

// Universal Properties & Linking System - Entity Property Actions
// Set/get/remove property values on entities (blocks, tasks, timeline_events, table_rows)

import { createClient } from "@/lib/supabase/server";
import { requireEntityAccess, requireWorkspaceAccessForProperties } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type {
  EntityType,
  EntityProperty,
  PropertyValue,
  EntityPropertyWithDefinition,
  EntityPropertiesResult,
  SetEntityPropertyInput,
  PropertyDefinition,
} from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Get direct properties on an entity (without inheritance).
 */
export async function getEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertyWithDefinition[]>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("entity_properties")
    .select(`
      *,
      definition:property_definitions(*)
    `)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  // Transform to proper type
  const properties: EntityPropertyWithDefinition[] = (data ?? []).map((row) => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    property_definition_id: row.property_definition_id,
    value: row.value,
    workspace_id: row.workspace_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    definition: row.definition as PropertyDefinition,
  }));

  return { data: properties };
}

/**
 * Set/upsert a property value on an entity.
 */
export async function setEntityProperty(
  input: SetEntityPropertyInput & { authContext?: AuthContext }
): Promise<ActionResult<EntityProperty>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, workspaceId } = access;

  // Verify the property definition belongs to this workspace
  const { data: definition, error: defError } = await supabase
    .from("property_definitions")
    .select("id, workspace_id")
    .eq("id", input.property_definition_id)
    .maybeSingle();

  if (defError || !definition) {
    return { error: "Property definition not found" };
  }

  if (definition.workspace_id !== workspaceId) {
    return { error: "Property definition does not belong to this workspace" };
  }

  // Upsert the property value
  const { data, error } = await supabase
    .from("entity_properties")
    .upsert(
      {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        property_definition_id: input.property_definition_id,
        value: input.value,
        workspace_id: workspaceId,
      },
      {
        onConflict: "entity_type,entity_id,property_definition_id",
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("setEntityProperty error:", error);
    return { error: "Failed to set entity property" };
  }

  return { data };
}

/**
 * Remove a property from an entity.
 */
export async function removeEntityProperty(
  entityType: EntityType,
  entityId: string,
  propertyDefinitionId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("property_definition_id", propertyDefinitionId);

  if (error) {
    console.error("removeEntityProperty error:", error);
    return { error: "Failed to remove entity property" };
  }

  return { data: null };
}

/**
 * Get properties (direct only; inheritance removed).
 */
export async function getEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<EntityPropertiesResult>> {
  const directResult = await getEntityProperties(entityType, entityId, opts);
  if ("error" in directResult) return directResult;
  return {
    data: {
      direct: directResult.data ?? [],
      inherited: [],
    },
  };
}

/**
 * Bulk get properties for multiple entities of the same type.
 */
export async function getEntitiesProperties(
  entityType: EntityType,
  entityIds: string[]
): Promise<ActionResult<Map<string, EntityPropertyWithDefinition[]>>> {
  if (entityIds.length === 0) {
    return { data: new Map() };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entity_properties")
    .select(`
      *,
      definition:property_definitions(*)
    `)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  const result = new Map<string, EntityPropertyWithDefinition[]>();

  // Initialize empty arrays for all requested IDs
  for (const id of entityIds) {
    result.set(id, []);
  }

  // Group properties by entity_id
  for (const row of data ?? []) {
    const props = result.get(row.entity_id) ?? [];
    props.push({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      property_definition_id: row.property_definition_id,
      value: row.value,
      workspace_id: row.workspace_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      definition: row.definition as PropertyDefinition,
    });
    result.set(row.entity_id, props);
  }

  return { data: result };
}

