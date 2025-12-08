import { QueryClient } from '@tanstack/react-query';

/**
 * React Query client configuration for Trak
 * Optimized for tab navigation and block data caching
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 5 minutes
        staleTime: 5 * 60 * 1000,
        
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
        
        // Retry failed queries once
        retry: 1,
        
        // Don't retry on 404s
        retryOnMount: false,
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
      },
    },
  });
}

// Cache keys for consistent querying
export const queryKeys = {
  projectTabs: (projectId: string) => ['projectTabs', projectId] as const,
  tabBlocks: (tabId: string) => ['tabBlocks', tabId] as const,
  fileUrls: (fileIds: string[]) => ['fileUrls', fileIds.sort().join(',')] as const,
  workspace: (workspaceId: string) => ['workspace', workspaceId] as const,
} as const;