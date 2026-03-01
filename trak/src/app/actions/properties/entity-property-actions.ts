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
  const _t0 = performance.now();
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getEntityProperties type=${entityType} entityId=${entityId}`);

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, entity_type, entity_id, workspace_id, field_name, field_type, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("getEntityProperties error:", error);
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getEntityProperties type=${entityType} entityId=${entityId} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to fetch entity properties" };
  }
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getEntityProperties type=${entityType} entityId=${entityId} rows=${(data ?? []).length} ms=${Math.round(performance.now() - _t0)}`);
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
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] setEntityProperty type=${input.entity_type} entityId=${input.entity_id} field=${input.field_name}`);
  const access = await requireEntityAccess(input.entity_type, input.entity_id, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, workspaceId } = access;

  const coreFieldTypes: FieldType[] = ["status", "priority", "assignee", "due_date", "tags"];
  if (coreFieldTypes.includes(input.field_type)) {
    const { setEntityProperties } = await import("@/app/actions/entity-properties");
    const updates: Record<string, unknown> = {};
    if (input.field_type === "status") {
      updates.statuses = [{ field_name: input.field_name, value: input.value as any }];
    } else if (input.field_type === "priority") {
      updates.priorities = [{ field_name: input.field_name, value: input.value as any }];
    } else if (input.field_type === "assignee") {
      const raw = input.value;
      const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
      const ids = values
        .map((entry: any) => {
          if (typeof entry === "string") return entry.trim();
          if (entry && typeof entry === "object" && typeof entry.id === "string") return entry.id.trim();
          return "";
        })
        .filter((id) => id.length > 0);
      updates.assignees = [{ field_name: input.field_name, value: ids }];
    } else if (input.field_type === "due_date") {
      updates.due_dates = [{ field_name: input.field_name, value: input.value as any }];
    } else if (input.field_type === "tags") {
      const value = Array.isArray(input.value) ? input.value : [];
      updates.tags = value as any;
    }

    const syncResult = await setEntityProperties({
      entity_type: input.entity_type as any,
      entity_id: input.entity_id,
      workspace_id: workspaceId,
      updates: updates as any,
    });
    if ("error" in syncResult) {
      return { error: syncResult.error };
    }
    const { data: syncedRow, error: syncedRowError } = await supabase
      .from("entity_properties")
      .select("id, entity_type, entity_id, workspace_id, field_name, field_type, value, created_at, updated_at")
      .eq("entity_type", input.entity_type)
      .eq("entity_id", input.entity_id)
      .eq("field_name", input.field_name)
      .maybeSingle();
    if (syncedRowError || !syncedRow) {
      return { error: "Failed to set entity property" };
    }
    return { data: syncedRow as NamedField };
  }

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
    .select("id, entity_type, entity_id, workspace_id, field_name, field_type, value, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("setEntityProperty error:", error);
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] setEntityProperty type=${input.entity_type} entityId=${input.entity_id} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to set entity property" };
  }
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] setEntityProperty type=${input.entity_type} entityId=${input.entity_id} ms=${Math.round(performance.now() - _t0)}`);
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
  const _t0 = performance.now();
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] removeEntityProperty type=${entityType} entityId=${entityId} field=${fieldName}`);
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
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] removeEntityProperty type=${entityType} entityId=${entityId} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to remove entity property" };
  }
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] removeEntityProperty type=${entityType} entityId=${entityId} ms=${Math.round(performance.now() - _t0)}`);
  return { data: null };
}

/**
 * Bulk get properties for multiple entities of the same type.
 */
export async function getEntitiesProperties(
  entityType: EntityType,
  entityIds: string[]
): Promise<ActionResult<Map<string, NamedField[]>>> {
  const _t0 = performance.now();
  if (entityIds.length === 0) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getEntitiesProperties type=${entityType} ids=0 ms=${Math.round(performance.now() - _t0)}`);
    return { data: new Map() };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, entity_type, entity_id, workspace_id, field_name, field_type, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getEntitiesProperties type=${entityType} ids=${entityIds.length} error ms=${Math.round(performance.now() - _t0)}`);
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

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getEntitiesProperties type=${entityType} ids=${entityIds.length} rows=${data?.length ?? 0} ms=${Math.round(performance.now() - _t0)}`);
  return { data: result };
}
