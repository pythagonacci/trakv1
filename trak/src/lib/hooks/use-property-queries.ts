"use client";

// Universal Properties & Linking System - React Query hooks
// Wraps server actions for property definitions, entity properties, and entity links

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import {
  getPropertyDefinitions,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
  addPropertyOption,
  updatePropertyOption,
  removePropertyOption,
  mergePropertyOptions,
  getEntityProperties,
  getEntityPropertiesWithInheritance,
  setEntityProperty,
  removeEntityProperty,
  setInheritedPropertyVisibility,
  getEntityLinks,
  createEntityLink,
  removeEntityLink,
  searchLinkableEntities,
  queryEntities,
  queryEntitiesGroupedBy,
} from "@/app/actions/properties";
import type {
  PropertyDefinition,
  PropertyOption,
  EntityType,
  PropertyValue,
  CreatePropertyDefinitionInput,
  UpdatePropertyDefinitionInput,
  CreateEntityLinkInput,
  QueryEntitiesParams,
  EntityPropertyWithDefinition,
  EntityPropertiesResult,
} from "@/types/properties";

// ---------------------------------------------------------------------------
// Property Definitions
// ---------------------------------------------------------------------------

/**
 * Fetch all property definitions for a workspace.
 */
export function usePropertyDefinitions(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.propertyDefinitions(workspaceId ?? ""),
    queryFn: async () => {
      if (!workspaceId) return [];
      const result = await getPropertyDefinitions(workspaceId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60_000, // Property definitions don't change often
  });
}

/**
 * Create a new property definition.
 */
export function useCreatePropertyDefinition(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreatePropertyDefinitionInput, "workspace_id">) =>
      createPropertyDefinition({ ...input, workspace_id: workspaceId }),
    onSuccess: (result) => {
      if ("data" in result) {
        qc.invalidateQueries({
          queryKey: queryKeys.propertyDefinitions(workspaceId),
        });
      }
    },
  });
}

/**
 * Update an existing property definition.
 */
export function useUpdatePropertyDefinition(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      definitionId: string;
      updates: UpdatePropertyDefinitionInput;
    }) => updatePropertyDefinition(args.definitionId, args.updates),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.propertyDefinitions(workspaceId),
      });
    },
  });
}

/**
 * Delete a property definition.
 */
export function useDeletePropertyDefinition(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (definitionId: string) => deletePropertyDefinition(definitionId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.propertyDefinitions(workspaceId),
      });
      // Also invalidate entity properties since they may reference deleted definition
      qc.invalidateQueries({ queryKey: ["entityProperties"] });
    },
  });
}

/**
 * Add an option to a select/multi_select property.
 */
export function useAddPropertyOption(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { definitionId: string; option: PropertyOption }) =>
      addPropertyOption(args.definitionId, args.option),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.propertyDefinitions(workspaceId),
      });
    },
  });
}

/**
 * Update an option within a select/multi_select property.
 */
export function useUpdatePropertyOption(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      definitionId: string;
      optionId: string;
      updates: Partial<Omit<PropertyOption, "id">>;
    }) => updatePropertyOption(args.definitionId, args.optionId, args.updates),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.propertyDefinitions(workspaceId),
      });
    },
  });
}

/**
 * Remove an option from a select/multi_select property.
 */
export function useRemovePropertyOption(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { definitionId: string; optionId: string }) =>
      removePropertyOption(args.definitionId, args.optionId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.propertyDefinitions(workspaceId),
      });
    },
  });
}

/**
 * Merge duplicate option values (for deduplication).
 */
export function useMergePropertyOptions(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      definitionId: string;
      sourceValue: string;
      targetValue: string;
    }) => mergePropertyOptions(args.definitionId, args.sourceValue, args.targetValue),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.propertyDefinitions(workspaceId),
      });
      qc.invalidateQueries({ queryKey: ["entityProperties"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Entity Properties
// ---------------------------------------------------------------------------

/**
 * Fetch direct properties on an entity.
 */
export function useEntityProperties(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: queryKeys.entityProperties(entityType, entityId),
    queryFn: async () => {
      const result = await getEntityProperties(entityType, entityId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(entityId),
    staleTime: 30_000,
  });
}

/**
 * Fetch properties with inheritance (direct + inherited from linked entities).
 */
export function useEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string
) {
  return useQuery({
    queryKey: queryKeys.entityPropertiesWithInheritance(entityType, entityId),
    queryFn: async () => {
      const result = await getEntityPropertiesWithInheritance(entityType, entityId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(entityId),
    staleTime: 30_000,
  });
}

/**
 * Set a property value on an entity.
 */
export function useSetEntityProperty(
  entityType: EntityType,
  entityId: string,
  workspaceId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { propertyDefinitionId: string; value: PropertyValue }) =>
      setEntityProperty({
        entity_type: entityType,
        entity_id: entityId,
        property_definition_id: args.propertyDefinitionId,
        value: args.value,
        workspace_id: workspaceId,
      }),
    onMutate: async (args) => {
      // Optimistic update
      await qc.cancelQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });

      const previousDirect = qc.getQueryData<EntityPropertyWithDefinition[]>(
        queryKeys.entityProperties(entityType, entityId)
      );

      if (previousDirect) {
        const existingIndex = previousDirect.findIndex(
          (p) => p.property_definition_id === args.propertyDefinitionId
        );
        const updatedDirect = [...previousDirect];

        if (existingIndex >= 0) {
          updatedDirect[existingIndex] = {
            ...updatedDirect[existingIndex],
            value: args.value,
          };
        }
        // Note: Can't add new property optimistically since we don't have the definition

        qc.setQueryData(
          queryKeys.entityProperties(entityType, entityId),
          updatedDirect
        );
      }

      return { previousDirect };
    },
    onError: (err, args, context) => {
      // Rollback on error
      if (context?.previousDirect) {
        qc.setQueryData(
          queryKeys.entityProperties(entityType, entityId),
          context.previousDirect
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(entityType, entityId),
      });
    },
  });
}

/**
 * Remove a property from an entity.
 */
export function useRemoveEntityProperty(entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (propertyDefinitionId: string) =>
      removeEntityProperty(entityType, entityId, propertyDefinitionId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(entityType, entityId),
      });
    },
  });
}

/**
 * Toggle visibility of an inherited property.
 */
export function useSetInheritedPropertyVisibility(
  entityType: EntityType,
  entityId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      sourceEntityType: EntityType;
      sourceEntityId: string;
      propertyDefinitionId: string;
      isVisible: boolean;
    }) =>
      setInheritedPropertyVisibility(
        entityType,
        entityId,
        args.sourceEntityType,
        args.sourceEntityId,
        args.propertyDefinitionId,
        args.isVisible
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(entityType, entityId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Entity Links
// ---------------------------------------------------------------------------

/**
 * Fetch all links for an entity (outgoing and incoming).
 */
export function useEntityLinks(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: queryKeys.entityLinks(entityType, entityId),
    queryFn: async () => {
      const result = await getEntityLinks(entityType, entityId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(entityId),
    staleTime: 30_000,
  });
}

/**
 * Create a link between entities.
 */
export function useCreateEntityLink(
  sourceEntityType: EntityType,
  sourceEntityId: string,
  workspaceId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { targetEntityType: EntityType; targetEntityId: string }) =>
      createEntityLink({
        source_entity_type: sourceEntityType,
        source_entity_id: sourceEntityId,
        target_entity_type: args.targetEntityType,
        target_entity_id: args.targetEntityId,
        workspace_id: workspaceId,
      }),
    onSuccess: (result, args) => {
      // Invalidate both source and target entity links
      qc.invalidateQueries({
        queryKey: queryKeys.entityLinks(sourceEntityType, sourceEntityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.entityLinks(args.targetEntityType, args.targetEntityId),
      });
      // Invalidate target's properties with inheritance since it gained new inherited properties
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(
          args.targetEntityType,
          args.targetEntityId
        ),
      });
    },
  });
}

/**
 * Remove a link between entities.
 */
export function useRemoveEntityLink(
  sourceEntityType: EntityType,
  sourceEntityId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { targetEntityType: EntityType; targetEntityId: string }) =>
      removeEntityLink(
        sourceEntityType,
        sourceEntityId,
        args.targetEntityType,
        args.targetEntityId
      ),
    onSuccess: (result, args) => {
      // Invalidate both source and target entity links
      qc.invalidateQueries({
        queryKey: queryKeys.entityLinks(sourceEntityType, sourceEntityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.entityLinks(args.targetEntityType, args.targetEntityId),
      });
      // Invalidate target's properties with inheritance since it lost inherited properties
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(
          args.targetEntityType,
          args.targetEntityId
        ),
      });
    },
  });
}

/**
 * Search for linkable entities (for @ mention picker).
 */
export function useSearchLinkableEntities(
  workspaceId: string,
  query: string,
  entityTypes?: EntityType[],
  limit: number = 10
) {
  return useQuery({
    queryKey: ["linkableEntities", workspaceId, query, entityTypes, limit],
    queryFn: async () => {
      const result = await searchLinkableEntities(workspaceId, query, entityTypes, limit);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Query Entities
// ---------------------------------------------------------------------------

/**
 * Query entities matching property criteria.
 */
export function useQueryEntities(params: QueryEntitiesParams) {
  return useQuery({
    queryKey: ["queryEntities", params],
    queryFn: async () => {
      const result = await queryEntities(params);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(params.workspace_id),
    staleTime: 30_000,
  });
}

/**
 * Query entities grouped by a property value.
 */
export function useQueryEntitiesGroupedBy(
  params: QueryEntitiesParams,
  groupByPropertyId: string
) {
  return useQuery({
    queryKey: ["queryEntitiesGrouped", params, groupByPropertyId],
    queryFn: async () => {
      const result = await queryEntitiesGroupedBy(params, groupByPropertyId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(params.workspace_id && groupByPropertyId),
    staleTime: 30_000,
  });
}
