"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { getWorkspaceEverything } from "@/app/actions/everything-view";
import { setEntityProperties } from "@/app/actions/entity-properties";
import type { EverythingItem, EverythingOptions, BulkUpdateInput } from "@/types/everything";
import type { EntityType } from "@/types/properties";

// ============================================================================
// Fetch Workspace Everything
// ============================================================================

/**
 * Fetch all items with properties across the workspace
 */
export function useWorkspaceEverything(
  workspaceId: string,
  options?: EverythingOptions
) {
  return useQuery({
    queryKey: [...queryKeys.workspaceEverything(workspaceId), options],
    queryFn: async () => {
      if (!workspaceId) return { items: [], total: 0, hasMore: false };
      const result = await getWorkspaceEverything(workspaceId, options);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 30_000, // Cache for 30 seconds
  });
}

// ============================================================================
// Update Everything Item
// ============================================================================

/**
 * Update a single property on an everything item
 */
export function useUpdateEverythingItem(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      item,
      updates,
    }: {
      item: EverythingItem;
      updates: {
        status?: EverythingItem["properties"]["status"];
        priority?: EverythingItem["properties"]["priority"];
        assignee_ids?: string[];
        due_date?: string | null;
        tags?: string[];
      };
    }) => {
      const result = await setEntityProperties({
        entity_type: item.type as EntityType,
        entity_id: item.id,
        workspace_id: workspaceId,
        updates,
      });

      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onMutate: async ({ item, updates }) => {
      // Cancel outgoing queries
      await qc.cancelQueries({
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });

      // Snapshot previous value
      const previousData = qc.getQueryData(queryKeys.workspaceEverything(workspaceId));

      // Optimistically update the cache
      qc.setQueriesData(
        { queryKey: queryKeys.workspaceEverything(workspaceId) },
        (old: any) => {
          if (!old || !old.items) return old;

          return {
            ...old,
            items: old.items.map((i: EverythingItem) =>
              i.id === item.id
                ? {
                    ...i,
                    properties: {
                      ...i.properties,
                      ...updates,
                    },
                    updated_at: new Date().toISOString(),
                  }
                : i
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        qc.setQueryData(
          queryKeys.workspaceEverything(workspaceId),
          context.previousData
        );
      }
      console.error("Failed to update item:", err);
    },
    onSuccess: () => {
      // Invalidate to refetch fresh data
      qc.invalidateQueries({
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });
    },
  });
}

// ============================================================================
// Bulk Update Everything Items
// ============================================================================

/**
 * Update multiple items at once
 */
export function useBulkUpdateEverythingItems(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, updates }: {
      items: EverythingItem[];
      updates: BulkUpdateInput["updates"];
    }) => {
      // Update each item
      const results = await Promise.all(
        items.map((item) =>
          setEntityProperties({
            entity_type: item.type as EntityType,
            entity_id: item.id,
            workspace_id: workspaceId,
            updates,
          })
        )
      );

      // Check for errors
      const errors = results.filter((r) => "error" in r);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} items`);
      }

      return results;
    },
    onMutate: async ({ items, updates }) => {
      // Cancel outgoing queries
      await qc.cancelQueries({
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });

      // Snapshot previous value
      const previousData = qc.getQueryData(queryKeys.workspaceEverything(workspaceId));

      // Optimistically update the cache
      const itemIds = new Set(items.map((i) => i.id));
      qc.setQueriesData(
        { queryKey: queryKeys.workspaceEverything(workspaceId) },
        (old: any) => {
          if (!old || !old.items) return old;

          return {
            ...old,
            items: old.items.map((i: EverythingItem) =>
              itemIds.has(i.id)
                ? {
                    ...i,
                    properties: {
                      ...i.properties,
                      ...updates,
                    },
                    updated_at: new Date().toISOString(),
                  }
                : i
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        qc.setQueryData(
          queryKeys.workspaceEverything(workspaceId),
          context.previousData
        );
      }
      console.error("Failed to bulk update items:", err);
    },
    onSuccess: () => {
      // Invalidate to refetch fresh data
      qc.invalidateQueries({
        queryKey: queryKeys.workspaceEverything(workspaceId),
      });
    },
  });
}
