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

        await queryClient.prefetchQuery({
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

        // Extract file IDs from blocks that need signed URLs (gallery, image, pdf, video, cards)
        const blocks = queryClient.getQueryData<any[]>(queryKeys.tabBlocks(tabId)) || [];
        const fileIds: string[] = [];
        for (const block of blocks) {
          if (block.type === "image" && block.content?.fileId) {
            fileIds.push(block.content.fileId as string);
          }
          if (block.type === "gallery" && Array.isArray(block.content?.items)) {
            for (const item of block.content.items) {
              if (item?.fileId) fileIds.push(item.fileId as string);
            }
          }
          if (block.type === "pdf" && block.content?.fileId) {
            fileIds.push(block.content.fileId as string);
          }
          if (block.type === "video" && block.content?.fileId) {
            fileIds.push(block.content.fileId as string);
          }
          if (block.type === "cards" && Array.isArray(block.content?.items)) {
            for (const item of block.content.items) {
              if (item?.fileId) fileIds.push(item.fileId as string);
            }
          }
        }

        const uniqueFileIds = [...new Set(fileIds)];
        if (uniqueFileIds.length > 0 && !queryClient.getQueryData(queryKeys.fileUrls(uniqueFileIds))) {
          queryClient.prefetchQuery({
            queryKey: queryKeys.fileUrls(uniqueFileIds),
            queryFn: async () => {
              const params = new URLSearchParams({ ids: uniqueFileIds.join(",") });
              const response = await fetch(`/api/files/batch-urls?${params.toString()}`, {
                cache: "no-store",
              });
              const json = await response.json();
              if (!response.ok || json?.error) throw new Error(json?.error || "Failed to fetch file URLs");
              return json.data || {};
            },
            staleTime: 30 * 60 * 1000,
          });
        }

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
