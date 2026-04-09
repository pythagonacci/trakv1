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
  WorkspaceMember,
} from "@/types/properties";
import {
  buildClientPerfHeaders,
  getCurrentPerfNavigationId,
  logClientInvalidation,
  logClientPerf,
} from "@/lib/perf/perf-trace";

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
  workspaceId?: string,
  options?: {
    navigationId?: string;
    source?: string;
    initialData?: Record<string, EntityProperties>;
    hydrateInitialData?: boolean;
  }
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
      logClientPerf(
        `[PERF] client useEntitiesProperties nav=${options?.navigationId ?? getCurrentPerfNavigationId() ?? "none"} type=${entityType} ids=${normalizedIds.length} workspaceId=${workspaceId} source=${options?.source ?? "useEntitiesProperties"}`
      );
      const response = await fetch(`/api/entities/properties?${params.toString()}`, {
        headers: buildClientPerfHeaders({
          navigationId: options?.navigationId,
          source: options?.source ?? "useEntitiesProperties",
        }),
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to fetch entity properties");
      }
      return json.data ?? {};
    },
    placeholderData: (previousData) => previousData ?? ({} as Record<string, EntityProperties>),
    initialData: options?.hydrateInitialData ? options.initialData ?? {} : undefined,
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
  const pickPreferredFieldValue = <T,>(
    fields: Array<{ field_name?: string; value?: T | null }> | null | undefined,
    preferredName: string
  ): T | null => {
    if (!Array.isArray(fields) || fields.length === 0) return null;
    const normalizedPreferred = preferredName.trim().toLowerCase();
    const preferred =
      fields.find((field) => String(field?.field_name ?? "").trim().toLowerCase() === normalizedPreferred) ?? fields[0];
    return preferred?.value ?? null;
  };

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
  if (updates.priorities !== undefined) {
    merged.priority = pickPreferredFieldValue(merged.priorities, "Priority") as EntityProperties["priority"];
  }
  if (updates.statuses !== undefined) {
    merged.status = pickPreferredFieldValue(merged.statuses, "Status") as EntityProperties["status"];
  }
  if (updates.assignees !== undefined) {
    const preferredAssignees = pickPreferredFieldValue(merged.assignees, "Assignee");
    const normalizedAssigneeIds = Array.isArray(preferredAssignees)
      ? preferredAssignees.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    merged.assignee_ids = normalizedAssigneeIds;
    merged.assignee_id = normalizedAssigneeIds[0] ?? null;
  }
  if (updates.due_dates !== undefined) {
    merged.due_date = pickPreferredFieldValue(merged.due_dates, "Due Date") as EntityProperties["due_date"];
  }

  return merged;
}

function appendTagOptimistic(
  previous: EntityProperties | null | undefined,
  tag: string
): EntityProperties {
  const normalizedTag = tag.trim();
  const currentTags = previous?.tags ?? [];
  const nextTags = normalizedTag
    ? currentTags.some((existingTag) => existingTag.toLowerCase() === normalizedTag.toLowerCase())
      ? currentTags
      : [...currentTags, normalizedTag]
    : currentTags;

  return mergePropertiesOptimistic(previous, { tags: nextTags });
}

function removeTagOptimistic(
  previous: EntityProperties | null | undefined,
  tag: string
): EntityProperties {
  const normalizedTag = tag.trim().toLowerCase();
  const currentTags = previous?.tags ?? [];
  const nextTags = normalizedTag
    ? currentTags.filter((existingTag) => existingTag.toLowerCase() !== normalizedTag)
    : currentTags;

  return mergePropertiesOptimistic(previous, { tags: nextTags });
}

function idsKeyContainsEntity(idsKey: string, entityId: string): boolean {
  if (!idsKey || !entityId) return false;
  return idsKey.split(",").includes(entityId);
}

function invalidateWithPerf(
  qc: ReturnType<typeof useQueryClient>,
  scope: string,
  filters: Parameters<ReturnType<typeof useQueryClient>["invalidateQueries"]>[0],
  extra?: string
) {
  const safeFilters = filters ?? {};
  logClientInvalidation(
    scope,
    Array.isArray(safeFilters.queryKey) ? safeFilters.queryKey : ["unknown"],
    extra
  );
  return qc.invalidateQueries(safeFilters);
}

function applyOptimisticEntityPropertyCacheUpdate(
  qc: ReturnType<typeof useQueryClient>,
  entityType: EntityType,
  entityId: string,
  workspaceId: string,
  updater: (previous: EntityProperties | null | undefined) => EntityProperties
) {
  const directQueryKey = queryKeys.entityProperties(entityType, entityId);
  const previous = qc.getQueryData<EntityProperties | null>(directQueryKey);
  const previousBulk = qc.getQueriesData<Record<string, EntityProperties>>({
    queryKey: ["entitiesProperties", entityType, workspaceId],
  });

  qc.setQueryData(directQueryKey, updater(previous));

  for (const [queryKey, data] of previousBulk) {
    if (!Array.isArray(queryKey)) continue;
    const idsKey = typeof queryKey[3] === "string" ? queryKey[3] : "";
    if (!idsKeyContainsEntity(idsKey, entityId)) continue;

    qc.setQueryData<Record<string, EntityProperties>>(queryKey, {
      ...(data ?? {}),
      [entityId]: updater(data?.[entityId]),
    });
  }

  return { previous, previousBulk };
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
      invalidateWithPerf(qc, "useSetEntityProperties.direct", {
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      // Invalidate any bulk queries for this entity type/workspace
      invalidateWithPerf(qc, "useSetEntityProperties.bulk", {
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      // Keep Everything view in sync when properties change from property menu / elsewhere
      if (workspaceId) {
        invalidateWithPerf(qc, "useSetEntityProperties.workspaceEverything", {
          queryKey: queryKeys.workspaceEverything(workspaceId),
        });
      }
      // Source-linked table rows: when source entity (task/timeline_event) is updated, tables showing derived rows should refetch
      if (entityType === "task" || entityType === "timeline_event") {
        invalidateWithPerf(qc, "useSetEntityProperties.tableRows", { queryKey: ["tableRows"] });
        invalidateWithPerf(qc, "useSetEntityProperties.tableBootstrap", { queryKey: ["tableBootstrap"] });
      }
      // Task/timeline blocks showing this entity should refetch so they render the new property values
      if (entityType === "task") invalidateWithPerf(qc, "useSetEntityProperties.taskItems", { queryKey: ["taskItems"] });
      if (entityType === "task") invalidateWithPerf(qc, "useSetEntityProperties.timelineItemsFromTask", { queryKey: ["timelineItems"] });
      if (entityType === "card") invalidateWithPerf(qc, "useSetEntityProperties.cardItems", { queryKey: ["cardItems"] });
      if (entityType === "timeline_event") invalidateWithPerf(qc, "useSetEntityProperties.timelineItems", { queryKey: ["timelineItems"] });
      // Live charts tracking this entity type need to re-run their query to reflect the updated property value
      invalidateWithPerf(qc, "useSetEntityProperties.chartLiveData", { queryKey: queryKeys.chartLiveData() });
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
      invalidateWithPerf(qc, "useSetEntityPropertiesForType.direct", {
        queryKey: queryKeys.entityProperties(entityType, args.entityId),
      });
      invalidateWithPerf(qc, "useSetEntityPropertiesForType.bulk", {
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      if (workspaceId) {
        invalidateWithPerf(qc, "useSetEntityPropertiesForType.workspaceEverything", {
          queryKey: queryKeys.workspaceEverything(workspaceId),
        });
      }
      // Source-linked table rows: when source entity (task/timeline_event) is updated, tables showing derived rows should refetch
      if (entityType === "task" || entityType === "timeline_event") {
        invalidateWithPerf(qc, "useSetEntityPropertiesForType.tableRows", { queryKey: ["tableRows"] });
        invalidateWithPerf(qc, "useSetEntityPropertiesForType.tableBootstrap", { queryKey: ["tableBootstrap"] });
      }
      if (entityType === "task") invalidateWithPerf(qc, "useSetEntityPropertiesForType.taskItems", { queryKey: ["taskItems"] });
      if (entityType === "card") invalidateWithPerf(qc, "useSetEntityPropertiesForType.cardItems", { queryKey: ["cardItems"] });
      if (entityType === "timeline_event") invalidateWithPerf(qc, "useSetEntityPropertiesForType.timelineItems", { queryKey: ["timelineItems"] });
      // Live charts tracking this entity type need to re-run their query to reflect the updated property value
      invalidateWithPerf(qc, "useSetEntityPropertiesForType.chartLiveData", { queryKey: queryKeys.chartLiveData() });
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
    mutationFn: async (tag: string) => {
      const result = await addTag({
        entity_type: entityType,
        entity_id: entityId,
        workspace_id: workspaceId,
        tag,
      });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onMutate: async (tag) => {
      await qc.cancelQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      await qc.cancelQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      return applyOptimisticEntityPropertyCacheUpdate(
        qc,
        entityType,
        entityId,
        workspaceId,
        (previous) => appendTagOptimistic(previous, tag)
      );
    },
    onError: (_err, _tag, context) => {
      if (context?.previous !== undefined) {
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
      invalidateWithPerf(qc, "useAddTag.direct", {
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      invalidateWithPerf(qc, "useAddTag.bulk", {
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      invalidateWithPerf(qc, "useAddTag.workspaceEverything", {
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });
      if (entityType === "task" || entityType === "timeline_event") {
        invalidateWithPerf(qc, "useAddTag.tableRows", { queryKey: ["tableRows"] });
        invalidateWithPerf(qc, "useAddTag.tableBootstrap", { queryKey: ["tableBootstrap"] });
      }
      if (entityType === "task") invalidateWithPerf(qc, "useAddTag.taskItems", { queryKey: ["taskItems"] });
      if (entityType === "card") {
        invalidateWithPerf(qc, "useAddTag.cardItems", { queryKey: ["cardItems"] });
      }
      if (entityType === "timeline_event") {
        invalidateWithPerf(qc, "useAddTag.timelineItems", { queryKey: ["timelineItems"] });
      }
      invalidateWithPerf(qc, "useAddTag.chartLiveData", { queryKey: queryKeys.chartLiveData() });
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
    onSuccess: () => {
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
    mutationFn: async (tag: string) => {
      const result = await removeTag({
        entity_type: entityType,
        entity_id: entityId,
        tag,
      });
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onMutate: async (tag) => {
      await qc.cancelQueries({
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      await qc.cancelQueries({
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      return applyOptimisticEntityPropertyCacheUpdate(
        qc,
        entityType,
        entityId,
        workspaceId,
        (previous) => removeTagOptimistic(previous, tag)
      );
    },
    onError: (_err, _tag, context) => {
      if (context?.previous !== undefined) {
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
      invalidateWithPerf(qc, "useRemoveTag.direct", {
        queryKey: queryKeys.entityProperties(entityType, entityId),
      });
      invalidateWithPerf(qc, "useRemoveTag.bulk", {
        queryKey: ["entitiesProperties", entityType, workspaceId],
      });
      invalidateWithPerf(qc, "useRemoveTag.workspaceEverything", {
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });
      if (entityType === "task" || entityType === "timeline_event") {
        invalidateWithPerf(qc, "useRemoveTag.tableRows", { queryKey: ["tableRows"] });
        invalidateWithPerf(qc, "useRemoveTag.tableBootstrap", { queryKey: ["tableBootstrap"] });
      }
      if (entityType === "task") invalidateWithPerf(qc, "useRemoveTag.taskItems", { queryKey: ["taskItems"] });
      if (entityType === "card") {
        invalidateWithPerf(qc, "useRemoveTag.cardItems", { queryKey: ["cardItems"] });
      }
      if (entityType === "timeline_event") {
        invalidateWithPerf(qc, "useRemoveTag.timelineItems", { queryKey: ["timelineItems"] });
      }
      invalidateWithPerf(qc, "useRemoveTag.chartLiveData", { queryKey: queryKeys.chartLiveData() });
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
      logClientPerf(
        `[PERF] client useWorkspaceMembers nav=${getCurrentPerfNavigationId() ?? "none"} workspaceId=${workspaceId}`
      );
      const response = await fetch(`/api/workspaces/members?workspaceId=${encodeURIComponent(workspaceId)}`, {
        cache: "no-store",
        headers: buildClientPerfHeaders({
          source: "useWorkspaceMembers",
        }),
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
