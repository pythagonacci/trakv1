import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Block } from '@/app/actions/block';
import { type TabWithChildren } from '@/app/actions/tab';
import { queryKeys } from '@/lib/react-query/query-client';

/**
 * Hook to fetch and cache tab blocks
 * Uses server-fetched data as initialData for instant first render
 * Only uses initialData if cache is empty (first visit)
 * 
 * @param tabId - The tab ID to fetch blocks for
 * @param initialBlocks - Server-fetched blocks to hydrate cache (optional)
 */
export function useTabBlocks(tabId: string, initialBlocks?: Block[]) {
  const queryClient = useQueryClient();

  // Check if we already have cached data for this tab
  const cachedData = queryClient.getQueryData<Block[]>(queryKeys.tabBlocks(tabId));
  const hasCache = !!cachedData;

  // Only use initialData if we don't have cached data (first visit)
  // This allows cache to be used on subsequent visits
  const shouldUseInitialData = !hasCache && initialBlocks;

  return useQuery({
    queryKey: queryKeys.tabBlocks(tabId),
    queryFn: async () => {
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log(`[PERF] client getTabBlocks via route tabId=${tabId}`);
      const response = await fetch(`/api/blocks/tab?tabId=${encodeURIComponent(tabId)}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to fetch blocks");
      }
      return json.data || [];
    },
    initialData: shouldUseInitialData ? initialBlocks : undefined,
    // Don't set initialDataUpdatedAt - let React Query handle it
    // Don't refetch on mount if we have data (cached or initial)
    refetchOnMount: false,
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
export function useBatchFileUrls(fileIds: string[], initialUrls?: Record<string, string>) {
  const queryClient = useQueryClient();
  const cachedData = queryClient.getQueryData<Record<string, string>>(queryKeys.fileUrls(fileIds));
  const hasCache = !!cachedData;
  const hasInitialUrls = !!initialUrls && Object.keys(initialUrls).length > 0;
  const initialUrlsCoverAll = fileIds.length > 0 && hasInitialUrls
    ? fileIds.every((id) => Boolean(initialUrls?.[id]))
    : false;
  const shouldUseInitialData = !hasCache && initialUrlsCoverAll;

  return useQuery({
    queryKey: queryKeys.fileUrls(fileIds),
    queryFn: async () => {
      if (fileIds.length === 0) {
        return {};
      }
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log(`[PERF] client useBatchFileUrls ids=${fileIds.length}`);
      const params = new URLSearchParams({ ids: fileIds.join(",") });
      const response = await fetch(`/api/files/batch-urls?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || "Failed to load file URLs");
      }
      return json.data || {};
    },
    initialData: shouldUseInitialData ? initialUrls : undefined,
    refetchOnMount: true, // Always refetch on mount to get fresh signed URLs
    staleTime: 30 * 60 * 1000, // 30 min (half of 60-min signed URL TTL)
    gcTime: 55 * 60 * 1000,    // GC just before signed URLs expire
    enabled: fileIds.length > 0, // Don't fetch if no file IDs
  });
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
