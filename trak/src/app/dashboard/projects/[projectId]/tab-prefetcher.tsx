"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/query-client";
import { useTabNavigation } from "./tab-navigation-context";

interface TabPrefetcherProps {
  tabs: { id: string; children?: { id: string }[] }[];
  currentTabId: string | null;
}

export default function TabPrefetcher({ tabs, currentTabId }: TabPrefetcherProps) {
  const queryClient = useQueryClient();
  const tabNav = useTabNavigation();
  const activeTabId = tabNav?.activeTabId ?? currentTabId;

  useEffect(() => {
    const allTabIds: string[] = [];
    for (const tab of tabs) {
      allTabIds.push(tab.id);
      if (tab.children) {
        for (const child of tab.children) {
          allTabIds.push(child.id);
        }
      }
    }

    // Stagger prefetches: start after a short delay to not compete with the
    // current tab's render, then fetch one tab at a time with small gaps.
    let cancelled = false;
    const delay = setTimeout(async () => {
      for (const tabId of allTabIds) {
        if (cancelled) break;
        if (tabId === activeTabId) continue;
        if (queryClient.getQueryData(queryKeys.tabBlocks(tabId))) continue;

        queryClient.prefetchQuery({
          queryKey: queryKeys.tabBlocks(tabId),
          queryFn: async () => {
            const response = await fetch(`/api/blocks/tab?tabId=${encodeURIComponent(tabId)}`, {
              cache: "no-store",
            });
            const json = await response.json();
            if (!response.ok || json?.error) throw new Error(json?.error || "Failed to fetch blocks");
            return json.data || [];
          },
          staleTime: 5 * 60 * 1000,
        });

        // Small gap between prefetches to avoid flooding the server
        await new Promise((r) => setTimeout(r, 200));
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, [tabs, activeTabId, queryClient]);

  return null;
}
