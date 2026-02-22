"use server";

// Universal Properties & Linking System - Entity Property Actions
// Set/get/remove property values on entities using field_type + field_name + value

import { createClient } from "@/lib/supabase/server";
import { requireEntityAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type {
  EntityType,
  FieldType,
  NamedField,
} from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Get direct properties on an entity (without inheritance).
 * Returns NamedField rows from entity_properties.
 */
export async function getEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<NamedField[]>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  return { data: (data ?? []) as NamedField[] };
}

/**
 * Set/upsert a named field property value on an entity.
 */
export async function setEntityProperty(
  input: {
    entity_type: EntityType;
    entity_id: string;
    field_type: FieldType;
    field_name: string;
    value: unknown;
    authContext?: AuthContext;
  }
): Promise<ActionResult<NamedField>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, workspaceId } = access;

  const { data, error } = await supabase
    .from("entity_properties")
    .upsert(
      {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        field_name: input.field_name,
        field_type: input.field_type,
        value: input.value,
        workspace_id: workspaceId,
      },
      {
        onConflict: "entity_type,entity_id,field_name",
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("setEntityProperty error:", error);
    return { error: "Failed to set entity property" };
  }

  return { data: data as NamedField };
}

/**
 * Remove a property from an entity by field_name.
 */
export async function removeEntityProperty(
  entityType: EntityType,
  entityId: string,
  fieldName: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("field_name", fieldName);

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
): Promise<ActionResult<{ direct: NamedField[]; inherited: never[] }>> {
  void opts;
  const directResult = await getEntityProperties(entityType, entityId);
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
): Promise<ActionResult<Map<string, NamedField[]>>> {
  if (entityIds.length === 0) {
    return { data: new Map() };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entity_properties")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  const result = new Map<string, NamedField[]>();

  for (const id of entityIds) {
    result.set(id, []);
  }

  for (const row of data ?? []) {
    const props = result.get(row.entity_id) ?? [];
    props.push(row as NamedField);
    result.set(row.entity_id, props);
  }

  return { data: result };
}
