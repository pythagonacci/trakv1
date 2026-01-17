"use client";

// Trak Universal Properties - React Query Hooks (Simplified)
// Fixed properties: status, priority, assignee, due date, tags

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import {
  getEntityProperties,
  getEntityPropertiesWithInheritance,
  setEntityProperties,
  addTag,
  removeTag,
  clearEntityProperties,
  getWorkspaceMembers,
  createEntityLink,
  removeEntityLink,
  getEntityLinks,
  setInheritedPropertyVisibility,
} from "@/app/actions/entity-properties";
import type {
  EntityType,
  EntityProperties,
  EntityPropertiesWithInheritance,
  SetEntityPropertiesInput,
  AddTagInput,
  RemoveTagInput,
  WorkspaceMember,
} from "@/types/properties";

// ============================================================================
// Entity Properties
// ============================================================================

/**
 * Fetch direct properties on an entity
 */
export function useEntityProperties(entityType: EntityType, entityId?: string) {
  return useQuery({
    queryKey: queryKeys.entityProperties(entityType, entityId ?? ""),
    queryFn: async () => {
      if (!entityId) return null;
      const result = await getEntityProperties(entityType, entityId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(entityId),
    staleTime: 30_000,
  });
}

/**
 * Fetch properties with inheritance (direct + inherited from linked entities)
 */
export function useEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId?: string
) {
  return useQuery({
    queryKey: queryKeys.entityPropertiesWithInheritance(entityType, entityId ?? ""),
    queryFn: async () => {
      if (!entityId) return { direct: null, inherited: [] };
      const result = await getEntityPropertiesWithInheritance(entityType, entityId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(entityId),
    staleTime: 30_000,
  });
}

/**
 * Set/update entity properties
 */
export function useSetEntityProperties(
  entityType: EntityType,
  entityId: string,
  workspaceId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: SetEntityPropertiesInput["updates"]) =>
      setEntityProperties({
        entity_type: entityType,
        entity_id: entityId,
        workspace_id: workspaceId,
        updates,
      }),
    onMutate: async (updates) => {
      // Optimistic update
      await qc.cancelQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });

      const previous = qc.getQueryData<EntityProperties | null>(
        queryKeys.entityProperties(entityType, entityId)
      );

      if (previous) {
        qc.setQueryData(
          queryKeys.entityProperties(entityType, entityId),
          {
            ...previous,
            ...updates,
          }
        );
      }

      return { previous };
    },
    onError: (err, updates, context) => {
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(
          queryKeys.entityProperties(entityType, entityId),
          context.previous
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
 * Add a tag to an entity
 */
export function useAddTag(
  entityType: EntityType,
  entityId: string,
  workspaceId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tag: string) =>
      addTag({
        entity_type: entityType,
        entity_id: entityId,
        workspace_id: workspaceId,
        tag,
      }),
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
 * Remove a tag from an entity
 */
export function useRemoveTag(entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tag: string) =>
      removeTag({
        entity_type: entityType,
        entity_id: entityId,
        tag,
      }),
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
 * Clear all properties for an entity
 */
export function useClearEntityProperties(entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearEntityProperties(entityType, entityId),
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

// ============================================================================
// Workspace Members (for assignee dropdown)
// ============================================================================

/**
 * Fetch all members of a workspace
 */
export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery({
    queryKey: ["workspaceMembers", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const result = await getWorkspaceMembers(workspaceId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

// ============================================================================
// Entity Links
// ============================================================================

/**
 * Fetch all links for an entity (outgoing and incoming)
 */
export function useEntityLinks(entityType: EntityType, entityId?: string) {
  return useQuery({
    queryKey: queryKeys.entityLinks(entityType, entityId ?? ""),
    queryFn: async () => {
      if (!entityId) return { outgoing: [], incoming: [] };
      const result = await getEntityLinks(entityType, entityId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(entityId),
    staleTime: 30_000,
  });
}

/**
 * Create a link between entities
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
      // Invalidate target's properties with inheritance
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
 * Remove a link between entities
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
      // Invalidate target's properties with inheritance
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(
          args.targetEntityType,
          args.targetEntityId
        ),
      });
    },
  });
}

// ============================================================================
// Inherited Property Visibility
// ============================================================================

/**
 * Toggle visibility of inherited properties from a source entity
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
      isVisible: boolean;
    }) =>
      setInheritedPropertyVisibility({
        entity_type: entityType,
        entity_id: entityId,
        source_entity_type: args.sourceEntityType,
        source_entity_id: args.sourceEntityId,
        is_visible: args.isVisible,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityPropertiesWithInheritance(entityType, entityId),
      });
    },
  });
}
