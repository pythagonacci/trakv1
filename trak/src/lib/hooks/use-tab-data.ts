import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Block } from '@/app/actions/block';
import { type TabWithChildren } from '@/app/actions/tab';
import { queryKeys } from '@/lib/react-query/query-client';
import {
  buildClientPerfHeaders,
  logClientPerf,
} from '@/lib/perf/perf-trace';

type PerfOptions = {
  navigationId?: string;
};

/**
 * Hook to fetch and cache tab blocks
 * Uses server-fetched data as initialData for instant first render
 * Only uses initialData if cache is empty (first visit)
 * 
 * @param tabId - The tab ID to fetch blocks for
 * @param initialBlocks - Server-fetched blocks to hydrate cache (optional)
 */
export function useTabBlocks(tabId: string, initialBlocks?: Block[], options?: PerfOptions) {
  const queryClient = useQueryClient();

  // Check if we already have cached data for this tab
  const cachedData = queryClient.getQueryData<Block[]>(queryKeys.tabBlocks(tabId));
  const hasCache = !!cachedData;

  // Only use initialData if we don't have cached data (first visit) and
  // initialBlocks was explicitly provided with content (not just an empty default)
  const shouldUseInitialData = !hasCache && initialBlocks !== undefined && initialBlocks.length > 0;

  return useQuery({
    queryKey: queryKeys.tabBlocks(tabId),
    queryFn: async () => {
      logClientPerf(
        `[PERF] client getTabBlocks via route nav=${options?.navigationId ?? "none"} tabId=${tabId} hasCache=${hasCache} usingInitialData=${Boolean(shouldUseInitialData)}`
      );
      const response = await fetch(`/api/blocks/tab?tabId=${encodeURIComponent(tabId)}`, {
        cache: "no-store",
        headers: buildClientPerfHeaders({
          navigationId: options?.navigationId,
          source: "useTabBlocks",
        }),
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to fetch blocks");
      }
      return json.data || [];
    },
    initialData: shouldUseInitialData ? initialBlocks : undefined,
    // Refetch on mount only when there's no cache and no initial data (client-side nav)
    refetchOnMount: !hasCache && !shouldUseInitialData ? 'always' : false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch and cache project tabs (hierarchical)
 * 
 * @param projectId - The project ID to fetch tabs for
 * @param initialTabs - Server-fetched tabs to hydrate cache (optional)
 */
export function useProjectTabs(projectId: string, initialTabs?: TabWithChildren[]) {
  const queryClient = useQueryClient();
  const cachedData = queryClient.getQueryData(queryKeys.projectTabs(projectId));
  const hasCache = !!cachedData;
  const shouldUseInitialData = !hasCache && initialTabs;

  return useQuery({
    queryKey: queryKeys.projectTabs(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/tabs/project?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to fetch tabs");
      }
      return json.data || [];
    },
    initialData: shouldUseInitialData ? initialTabs : undefined,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch and cache file URLs in batch
 * 
 * @param fileIds - Array of file IDs to fetch URLs for
 * @param initialUrls - Server-fetched URLs to hydrate cache (optional)
 */
export function useBatchFileUrls(
  fileIds: string[],
  initialUrls?: Record<string, string>,
  options?: PerfOptions
) {
  const queryClient = useQueryClient();
  const cachedData = queryClient.getQueryData<Record<string, string>>(queryKeys.fileUrls(fileIds));
  const hasCache = !!cachedData;
  const hasInitialUrls = !!initialUrls && Object.keys(initialUrls).length > 0;
  const initialUrlsCoverAll = fileIds.length > 0 && hasInitialUrls
    ? fileIds.every((id) => Boolean(initialUrls?.[id]))
    : false;
  const shouldUseInitialData = !hasCache && initialUrlsCoverAll;
  const initialCoverageCount = fileIds.filter((id) => Boolean(initialUrls?.[id])).length;

  return useQuery({
    queryKey: queryKeys.fileUrls(fileIds),
    queryFn: async () => {
      if (fileIds.length === 0) {
        return {};
      }
      logClientPerf(
        `[PERF] client useBatchFileUrls nav=${options?.navigationId ?? "none"} ids=${fileIds.length} hasCache=${hasCache} hasInitialUrls=${hasInitialUrls} initialCoverage=${initialCoverageCount}/${fileIds.length} initialUrlsCoverAll=${initialUrlsCoverAll} refetchOnMount=true`
      );
      const params = new URLSearchParams();
      uniqueFileIds(fileIds).forEach((id) => params.append("ids", id));
      const response = await fetch(`/api/files/batch-urls?${params.toString()}`, {
        cache: "no-store",
        headers: buildClientPerfHeaders({
          navigationId: options?.navigationId,
          source: "useBatchFileUrls",
        }),
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to load file URLs");
      }
      return json.data || {};
    },
    initialData: shouldUseInitialData ? initialUrls : undefined,
    placeholderData: (previousData) => {
      if (fileIds.length === 0) return undefined;
      const sources = {
        ...(initialUrls || {}),
        ...(previousData || {}),
      };
      const merged = fileIds.reduce<Record<string, string>>((acc, id) => {
        if (sources[id]) acc[id] = sources[id];
        return acc;
      }, {});
      return Object.keys(merged).length > 0 ? merged : undefined;
    },
    // `true` only refetches when stale; empty/partial maps were staying "fresh" for 30m and hid new assets.
    refetchOnMount: 'always',
    staleTime: 30 * 60 * 1000, // 30 min (half of 60-min signed URL TTL)
    gcTime: 55 * 60 * 1000,    // GC just before signed URLs expire
    enabled: fileIds.length > 0, // Don't fetch if no file IDs
  });
}

function uniqueFileIds(fileIds: string[]) {
  return Array.from(new Set(fileIds.map((id) => id.trim()).filter(Boolean)));
}

/**
 * Hook to invalidate cached data when mutations occur
 * Call this after creating/updating/deleting blocks or tabs
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    // Invalidate tab blocks cache (after block changes)
    invalidateTabBlocks: (tabId: string) => {
      return queryClient.invalidateQueries({
        queryKey: queryKeys.tabBlocks(tabId),
      });
    },

    // Invalidate project tabs cache (after tab changes)
    invalidateProjectTabs: (projectId: string) => {
      return queryClient.invalidateQueries({
        queryKey: queryKeys.projectTabs(projectId),
      });
    },

    // Invalidate all caches (nuclear option)
    invalidateAll: () => {
      return queryClient.invalidateQueries();
    },
  };
}
