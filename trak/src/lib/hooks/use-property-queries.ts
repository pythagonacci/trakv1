"use client";

// Saria Universal Properties - React Query Hooks (Simplified)
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

function isQueryableEntityId(id: string): boolean {
  if (!id) return false;
  if (id.startsWith("optimistic-")) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

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
    new Set(entityIds.filter((id) => isQueryableEntityId(id)))
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

// Merge an optimistic property update into existing cached data, preserving real IDs
// from the server on priorities/statuses arrays (updates often omit IDs, which causes
// buildPriorityDrafts to generate index-based IDs that don't match bulk-cache IDs).
function mergePropertiesOptimistic(
  previous: EntityProperties | null | undefined,
  updates: SetEntityPropertiesInput["updates"]
): EntityProperties {
  const base = previous ?? ({} as EntityProperties);
  const merged = { ...base, ...updates } as EntityProperties;

  // For priorities/statuses arrays, match by field_name to preserve existing IDs
  if (updates.priorities && Array.isArray(base.priorities)) {
    merged.priorities = (updates.priorities as Array<{ field_name?: string; value?: unknown; id?: string }>).map((upd) => {
      const existing = (base.priorities as Array<{ field_name?: string; id?: string }> | undefined)?.find(
        (p) => p.field_name === upd.field_name
      );
      return existing ? { ...existing, ...upd } : upd;
    }) as EntityProperties["priorities"];
  }
  if (updates.statuses && Array.isArray(base.statuses)) {
    merged.statuses = (updates.statuses as Array<{ field_name?: string; value?: unknown; id?: string }>).map((upd) => {
      const existing = (base.statuses as Array<{ field_name?: string; id?: string }> | undefined)?.find(
        (s) => s.field_name === upd.field_name
      );
      return existing ? { ...existing, ...upd } : upd;
    }) as EntityProperties["statuses"];
  }

  return merged;
}

function idsKeyContainsEntity(idsKey: string, entityId: string): boolean {
  if (!idsKey || !entityId) return false;
  return idsKey.split(",").includes(entityId);
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
      await qc.cancelQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });

      const previous = qc.getQueryData<EntityProperties | null>(
        queryKeys.entityProperties(entityType, entityId)
      );
      const previousBulk = qc.getQueriesData<Record<string, EntityProperties>>({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });

      qc.setQueryData(
        queryKeys.entityProperties(entityType, entityId),
        mergePropertiesOptimistic(previous, updates)
      );

      for (const [queryKey, data] of previousBulk) {
        if (!Array.isArray(queryKey)) continue;
        const idsKey = typeof queryKey[3] === "string" ? queryKey[3] : "";
        if (!idsKeyContainsEntity(idsKey, entityId)) continue;

        qc.setQueryData<Record<string, EntityProperties>>(queryKey, {
          ...(data ?? {}),
          [entityId]: mergePropertiesOptimistic(data?.[entityId], updates),
        });
      }

      return { previous, previousBulk };
    },
    onError: (err, updates, context) => {
      // Rollback on error
      if (context?.previous) {
        qc.setQueryData(
          queryKeys.entityProperties(entityType, entityId),
          context.previous
        );
      }
      if (context?.previousBulk) {
        for (const [queryKey, data] of context.previousBulk) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      // Invalidate any bulk queries for this entity type/workspace
      qc.invalidateQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      // Keep Everything view in sync when properties change from property menu / elsewhere
      if (workspaceId) {
        qc.invalidateQueries({
          queryKey: queryKeys.workspaceEverything(workspaceId),
        });
      }
      // Source-linked table rows: when source entity (task/timeline_event) is updated, tables showing derived rows should refetch
      if (entityType === "task" || entityType === "timeline_event") {
        qc.invalidateQueries({ queryKey: ["tableRows"] });
        qc.invalidateQueries({ queryKey: ["tableBootstrap"] });
      }
      // Task/timeline blocks showing this entity should refetch so they render the new property values
      if (entityType === "task") qc.invalidateQueries({ queryKey: ["taskItems"] });
      if (entityType === "card") qc.invalidateQueries({ queryKey: ["cardItems"] });
      if (entityType === "timeline_event") qc.invalidateQueries({ queryKey: ["timelineItems"] });
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
    onMutate: async (args) => {
      await qc.cancelQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });

      const previousBulk = qc.getQueriesData<Record<string, EntityProperties>>({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });

      for (const [queryKey, data] of previousBulk) {
        if (!Array.isArray(queryKey)) continue;
        const idsKey = typeof queryKey[3] === "string" ? queryKey[3] : "";
        if (!idsKeyContainsEntity(idsKey, args.entityId)) continue;

        qc.setQueryData<Record<string, EntityProperties>>(queryKey, {
          ...(data ?? {}),
          [args.entityId]: mergePropertiesOptimistic(data?.[args.entityId], args.updates),
        });
      }

      return { previousBulk };
    },
    onError: (_err, _args, context) => {
      if (context?.previousBulk) {
        for (const [queryKey, data] of context.previousBulk) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: (_result, args) => {
      qc.invalidateQueries({
        queryKey: queryKeys.entityProperties(entityType, args.entityId),
      });
      qc.invalidateQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      if (workspaceId) {
        qc.invalidateQueries({
          queryKey: queryKeys.workspaceEverything(workspaceId),
        });
      }
      // Source-linked table rows: when source entity (task/timeline_event) is updated, tables showing derived rows should refetch
      if (entityType === "task" || entityType === "timeline_event") {
        qc.invalidateQueries({ queryKey: ["tableRows"] });
        qc.invalidateQueries({ queryKey: ["tableBootstrap"] });
      }
      if (entityType === "task") qc.invalidateQueries({ queryKey: ["taskItems"] });
      if (entityType === "card") qc.invalidateQueries({ queryKey: ["cardItems"] });
      if (entityType === "timeline_event") qc.invalidateQueries({ queryKey: ["timelineItems"] });
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
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      qc.invalidateQueries({
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });
      if (entityType === "card") {
        qc.invalidateQueries({ queryKey: ["cardItems"] });
      }
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
export function useRemoveTag(
  entityType: EntityType,
  entityId: string,
  workspaceId: string
) {
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
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      qc.invalidateQueries({
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });
      if (entityType === "card") {
        qc.invalidateQueries({ queryKey: ["cardItems"] });
      }
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
      if (entityType === "card") {
        qc.invalidateQueries({ queryKey: ["cardItems"] });
      }
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
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log(`[PERF] client useWorkspaceMembers workspaceId=${workspaceId}`);
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
