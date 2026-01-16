"use server";

// Universal Properties & Linking System - Entity Property Actions
// Set/get/remove property values on entities (blocks, tasks, timeline_events, table_rows)

import { createClient } from "@/lib/supabase/server";
import { requireEntityAccess, requireWorkspaceAccessForProperties } from "./context";
import type {
  EntityType,
  EntityProperty,
  PropertyValue,
  EntityPropertyWithDefinition,
  InheritedProperty,
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
  input: SetEntityPropertyInput
): Promise<ActionResult<EntityProperty>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
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
 * Get properties with inheritance (direct + inherited from linked entities).
 */
export async function getEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertiesResult>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, workspaceId } = access;

  // Get direct properties
  const { data: directData, error: directError } = await supabase
    .from("entity_properties")
    .select(`
      *,
      definition:property_definitions(*)
    `)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (directError) {
    console.error("getEntityPropertiesWithInheritance direct error:", directError);
    return { error: "Failed to fetch direct properties" };
  }

  const direct: EntityPropertyWithDefinition[] = (directData ?? []).map((row) => ({
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

  // Get entities that link TO this entity (they pass their properties down)
  const { data: incomingLinks, error: linksError } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  if (linksError) {
    console.error("getEntityPropertiesWithInheritance links error:", linksError);
    return { error: "Failed to fetch entity links" };
  }

  const inherited: InheritedProperty[] = [];

  // For each linking entity, get their properties
  for (const link of incomingLinks ?? []) {
    const { data: sourceProps } = await supabase
      .from("entity_properties")
      .select(`
        *,
        definition:property_definitions(*)
      `)
      .eq("entity_type", link.source_entity_type)
      .eq("entity_id", link.source_entity_id);

    // Get visibility preferences for these inherited properties
    const { data: displayPrefs } = await supabase
      .from("entity_inherited_display")
      .select("property_definition_id, is_visible")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("source_entity_type", link.source_entity_type)
      .eq("source_entity_id", link.source_entity_id);

    const visibilityMap = new Map(
      (displayPrefs ?? []).map((pref) => [pref.property_definition_id, pref.is_visible])
    );

    for (const prop of sourceProps ?? []) {
      // Skip if this property is already directly set on the entity
      if (direct.some((d) => d.property_definition_id === prop.property_definition_id)) {
        continue;
      }

      // Check if this inherited property is visible (default to true)
      const isVisible = visibilityMap.get(prop.property_definition_id) ?? true;

      inherited.push({
        property: {
          id: prop.id,
          entity_type: prop.entity_type,
          entity_id: prop.entity_id,
          property_definition_id: prop.property_definition_id,
          value: prop.value,
          workspace_id: prop.workspace_id,
          created_at: prop.created_at,
          updated_at: prop.updated_at,
          definition: prop.definition as PropertyDefinition,
        },
        source: {
          entity_type: link.source_entity_type as EntityType,
          entity_id: link.source_entity_id,
        },
        is_visible: isVisible,
      });
    }
  }

  return { data: { direct, inherited } };
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

/**
 * Set inherited property visibility preference.
 */
export async function setInheritedPropertyVisibility(
  entityType: EntityType,
  entityId: string,
  sourceEntityType: EntityType,
  sourceEntityId: string,
  propertyDefinitionId: string,
  isVisible: boolean
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("entity_inherited_display").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      property_definition_id: propertyDefinitionId,
      is_visible: isVisible,
    },
    {
      onConflict:
        "entity_type,entity_id,source_entity_type,source_entity_id,property_definition_id",
    }
  );

  if (error) {
    console.error("setInheritedPropertyVisibility error:", error);
    return { error: "Failed to update visibility preference" };
  }

  return { data: null };
}
