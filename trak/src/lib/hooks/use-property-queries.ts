"use client";

// Trak Universal Properties - React Query Hooks (Simplified)
// Fixed properties: status, priority, assignee, due date, tags

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import {
  getEntityProperties,
  setEntityProperties,
  addTag,
  removeTag,
  clearEntityProperties,
  createEntityLink,
  removeEntityLink,
  getEntityLinks,
} from "@/app/actions/entity-properties";
import { getProjectTags, addProjectTag } from "@/app/actions/project";
import type {
  EntityType,
  EntityProperties,
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
 * Bulk fetch direct properties for multiple entities of the same type.
 * Returns a map keyed by entity_id.
 */
export function useEntitiesProperties(
  entityType: EntityType,
  entityIds: string[],
  workspaceId?: string
) {
  const normalizedIds = Array.from(
    new Set(entityIds.filter((id) => id))
  ).sort();
  const idsKey = normalizedIds.join(",");

  return useQuery({
    queryKey: ["entitiesProperties", entityType, workspaceId ?? "", idsKey],
    queryFn: async () => {
      if (!workspaceId || normalizedIds.length === 0) {
        return {} as Record<string, EntityProperties>;
      }
      const params = new URLSearchParams({
        entityType,
        ids: idsKey,
        workspaceId,
      });
      const response = await fetch(`/api/entities/properties?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to fetch entity properties");
      }
      return json.data ?? {};
    },
    enabled: Boolean(workspaceId) && normalizedIds.length > 0,
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
    mutationFn: async (updates: SetEntityPropertiesInput["updates"]) => {
      const result = await setEntityProperties({
        entity_type: entityType,
        entity_id: entityId,
        workspace_id: workspaceId,
        updates,
      });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
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
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      // Invalidate any bulk queries for this entity type/workspace
      qc.invalidateQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
    },
  });
}

/**
 * Set/update properties for entities of a given type (entityId passed at call-time).
 * Useful for lists (e.g., task list) where entityId varies per row.
 */
export function useSetEntityPropertiesForType(entityType: EntityType, workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { entityId: string; updates: SetEntityPropertiesInput["updates"] }) => {
      const result = await setEntityProperties({
        entity_type: entityType,
        entity_id: args.entityId,
        workspace_id: workspaceId,
        updates: args.updates,
      });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_result, args) => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityProperties(entityType, args.entityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.entityProperties(entityType, args.entityId),
      });
      qc.invalidateQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
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
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
    },
  });
}

/**
 * Fetch the tag bank for a project (for suggestions in the properties modal)
 */
export function useProjectTags(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.projectTags(projectId ?? ""),
    queryFn: async () => {
      if (!projectId) return [];
      const result = await getProjectTags(projectId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
}

/**
 * Add a tag to a project's tag bank (e.g. when user creates a new tag from the properties modal)
 */
export function useAddProjectTag(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!projectId) return Promise.resolve({ data: null as null });
      return addProjectTag(projectId, name);
    },
    onSuccess: (_result, _name, _variables) => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: queryKeys.projectTags(projectId) });
      }
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
        queryKey: queryKeys.entityProperties(entityType, entityId),
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
        queryKey: queryKeys.entityProperties(entityType, entityId),
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
  return useQuery<WorkspaceMember[]>({
    queryKey: ["workspaceMembers", "properties", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      console.log(`[PERF] client useWorkspaceMembers workspaceId=${workspaceId}`);
      const response = await fetch(`/api/workspaces/members?workspaceId=${encodeURIComponent(workspaceId)}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to fetch workspace members");
      }
      return json.data || [];
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
        queryKey: queryKeys.entityProperties(
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
        queryKey: queryKeys.entityProperties(
          args.targetEntityType,
          args.targetEntityId
        ),
      });
    },
  });
}
