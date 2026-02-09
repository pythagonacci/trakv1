"use server";

// Universal Properties & Linking System - Property Definition Actions
// CRUD operations for workspace-level property definitions

import {
  requireWorkspaceAccessForProperties,
  requirePropertyDefinitionAccess,
  isSimilarPropertyName,
} from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type {
  PropertyDefinition,
  PropertyType,
  PropertyOption,
  CreatePropertyDefinitionInput,
  UpdatePropertyDefinitionInput,
} from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Get all property definitions for a workspace.
 */
export async function getPropertyDefinitions(
  workspaceId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<PropertyDefinition[]>> {
  const access = await requireWorkspaceAccessForProperties(workspaceId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getPropertyDefinitions error:", error);
    return { error: "Failed to fetch property definitions" };
  }

  return { data: data ?? [] };
}

/**
 * Get a single property definition by ID.
 */
export async function getPropertyDefinition(
  definitionId: string
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (error || !data) {
    return { error: "Property definition not found" };
  }

  return { data };
}

/**
 * Create a new property definition.
 * Checks for similar existing names to prevent duplicates like "Q1 Budget" vs "q1-budget".
 */
export async function createPropertyDefinition(
  input: CreatePropertyDefinitionInput & { authContext?: AuthContext }
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requireWorkspaceAccessForProperties(input.workspace_id, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Check for similar existing property names
  const { data: existingDefs } = await supabase
    .from("property_definitions")
    .select("name")
    .eq("workspace_id", input.workspace_id);

  if (existingDefs) {
    const existingNames = existingDefs.map((d) => d.name);
    const similarName = isSimilarPropertyName(input.name, existingNames);
    if (similarName) {
      return {
        error: `A similar property "${similarName}" already exists. Please use a different name.`,
      };
    }
  }

  const { data, error } = await supabase
    .from("property_definitions")
    .insert({
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      type: input.type,
      options: input.options ?? [],
    })
    .select("*")
    .single();

  if (error) {
    console.error("createPropertyDefinition error:", error);
    if (error.code === "23505") {
      return { error: "A property with this name already exists" };
    }
    return { error: "Failed to create property definition" };
  }

  return { data };
}

/**
 * Update a property definition (name and/or options).
 */
export async function updatePropertyDefinition(
  definitionId: string,
  updates: UpdatePropertyDefinitionInput,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, definition } = access;

  // If updating name, check for duplicates
  if (updates.name !== undefined) {
    const { data: existingDefs } = await supabase
      .from("property_definitions")
      .select("name")
      .eq("workspace_id", definition.workspace_id)
      .neq("id", definitionId);

    if (existingDefs) {
      const existingNames = existingDefs.map((d) => d.name);
      const similarName = isSimilarPropertyName(updates.name, existingNames);
      if (similarName) {
        return {
          error: `A similar property "${similarName}" already exists. Please use a different name.`,
        };
      }
    }
  }

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.options !== undefined) payload.options = updates.options;

  if (Object.keys(payload).length === 0) {
    // Nothing to update, return current definition
    const { data } = await supabase
      .from("property_definitions")
      .select("*")
      .eq("id", definitionId)
      .single();
    return { data };
  }

  const { data, error } = await supabase
    .from("property_definitions")
    .update(payload)
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error) {
    console.error("updatePropertyDefinition error:", error);
    if (error.code === "23505") {
      return { error: "A property with this name already exists" };
    }
    return { error: "Failed to update property definition" };
  }

  return { data };
}

/**
 * Delete a property definition.
 * Blocks deletion if any table fields link to this definition.
 * Cascades to delete all entity_properties using this definition.
 */
export async function deletePropertyDefinition(
  definitionId: string
): Promise<ActionResult<null>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Check if any table fields link to this property definition
  const { data: linkedFields, error: checkError } = await supabase
    .from("table_fields")
    .select("id, name, table_id")
    .eq("property_definition_id", definitionId)
    .limit(100);

  if (checkError) {
    console.error("deletePropertyDefinition check error:", checkError);
    return { error: "Failed to check for linked table fields" };
  }

  if (linkedFields && linkedFields.length > 0) {
    const fieldCount = linkedFields.length;
    const sampleFields = linkedFields.slice(0, 3).map(f => f.name).join(", ");
    return {
      error: `Cannot delete property definition. ${fieldCount} table field${fieldCount > 1 ? 's are' : ' is'} using it (e.g., ${sampleFields}). Unlink or delete these fields first.`
    };
  }

  const { error } = await supabase
    .from("property_definitions")
    .delete()
    .eq("id", definitionId);

  if (error) {
    console.error("deletePropertyDefinition error:", error);
    return { error: "Failed to delete property definition" };
  }

  return { data: null };
}

/**
 * Merge duplicate option values within a select/multi_select property.
 * All entities with sourceValue will be updated to targetValue.
 */
export async function mergePropertyOptions(
  definitionId: string,
  sourceValue: string,
  targetValue: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<{ updated_count: number }>> {
  const access = await requirePropertyDefinitionAccess(definitionId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, definition } = access;

  // Get the property definition to verify it's a select type
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  if (propDef.type !== "select" && propDef.type !== "multi_select") {
    return { error: "Merge is only supported for select and multi_select properties" };
  }

  // Find all entity_properties with this definition
  const { data: entityProps, error: propsError } = await supabase
    .from("entity_properties")
    .select("id, value")
    .eq("property_definition_id", definitionId);

  if (propsError) {
    console.error("mergePropertyOptions fetch error:", propsError);
    return { error: "Failed to fetch entity properties" };
  }

  let updatedCount = 0;

  // Update entity_properties values
  for (const prop of entityProps ?? []) {
    let newValue = prop.value;
    let needsUpdate = false;

    if (propDef.type === "select") {
      // Single select: direct string comparison
      if (prop.value === sourceValue) {
        newValue = targetValue;
        needsUpdate = true;
      }
    } else if (propDef.type === "multi_select") {
      // Multi select: array of strings
      const arr = Array.isArray(prop.value) ? prop.value : [];
      if (arr.includes(sourceValue)) {
        const updated = arr.filter((v) => v !== sourceValue);
        if (!updated.includes(targetValue)) {
          updated.push(targetValue);
        }
        newValue = updated;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from("entity_properties")
        .update({ value: newValue })
        .eq("id", prop.id);

      if (!updateError) {
        updatedCount++;
      }
    }
  }

  // Update the options array to remove the source option
  const currentOptions = (propDef.options as PropertyOption[]) ?? [];
  const updatedOptions = currentOptions.filter((opt) => opt.id !== sourceValue);

  await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId);

  return { data: { updated_count: updatedCount } };
}

/**
 * Add an option to a select/multi_select property definition.
 */
export async function addPropertyOption(
  definitionId: string,
  option: PropertyOption,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get current definition
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  if (propDef.type !== "select" && propDef.type !== "multi_select") {
    return { error: "Options are only supported for select and multi_select properties" };
  }

  const currentOptions = (propDef.options as PropertyOption[]) ?? [];

  // Check for duplicate option id
  if (currentOptions.some((opt) => opt.id === option.id)) {
    return { error: "An option with this ID already exists" };
  }

  const updatedOptions = [...currentOptions, option];

  const { data, error } = await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("addPropertyOption error:", error);
    return { error: "Failed to add property option" };
  }

  return { data };
}

/**
 * Update an option within a select/multi_select property definition.
 */
export async function updatePropertyOption(
  definitionId: string,
  optionId: string,
  updates: Partial<Omit<PropertyOption, "id">>
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get current definition
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  const currentOptions = (propDef.options as PropertyOption[]) ?? [];
  const optionIndex = currentOptions.findIndex((opt) => opt.id === optionId);

  if (optionIndex === -1) {
    return { error: "Option not found" };
  }

  const updatedOptions = [...currentOptions];
  updatedOptions[optionIndex] = {
    ...updatedOptions[optionIndex],
    ...updates,
  };

  const { data, error } = await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("updatePropertyOption error:", error);
    return { error: "Failed to update property option" };
  }

  return { data };
}

/**
 * Remove an option from a select/multi_select property definition.
 * Does NOT remove the value from existing entity_properties.
 */
export async function removePropertyOption(
  definitionId: string,
  optionId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get current definition
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  const currentOptions = (propDef.options as PropertyOption[]) ?? [];
  const updatedOptions = currentOptions.filter((opt) => opt.id !== optionId);

  const { data, error } = await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("removePropertyOption error:", error);
    return { error: "Failed to remove property option" };
  }

  return { data };
}
