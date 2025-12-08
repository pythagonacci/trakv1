"use client";

import { useState, useEffect, useRef } from "react";
import TabCanvas from "./tab-canvas";
import { type Block } from "@/app/actions/block";
import { TAB_THEMES } from "./tab-themes";
import { useTabBlocks, useBatchFileUrls } from "@/lib/hooks/use-tab-data";

interface TabCanvasWrapperProps {
  tabId: string;
  projectId: string;
  workspaceId: string;
  blocks: Block[];
  scrollToTaskId?: string | null;
  initialFileUrls?: Record<string, string>;
}

export default function TabCanvasWrapper({ tabId, projectId, workspaceId, blocks: initialBlocks, scrollToTaskId, initialFileUrls = {} }: TabCanvasWrapperProps) {
  const [tabTheme, setTabTheme] = useState<string>("default");

  // 🚀 NEW: Use React Query for cached blocks
  const { data: blocks, isLoading, isFetching, dataUpdatedAt, isPlaceholderData, isStale } = useTabBlocks(tabId, initialBlocks);
  
  // Better cache detection: data exists, not fetching, and dataUpdatedAt is older than mount time
  const mountTimeRef = useRef(Date.now());
  const isFromCache = blocks && !isFetching && !isLoading && dataUpdatedAt && dataUpdatedAt < mountTimeRef.current;
  
  console.log('useTabBlocks result:', { 
    tabId,
    blocksCount: blocks?.length || 0,
    initialBlocksCount: initialBlocks?.length || 0,
    isLoading,
    isFetching,
    isPlaceholderData,
    isStale,
    dataUpdatedAt: dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null,
    mountTime: new Date(mountTimeRef.current).toISOString(),
    isFromCache,
    hasData: !!blocks
  });

  // 🚀 NEW: Use React Query for cached file URLs
  const fileIds = blocks?.flatMap(block => {
    const ids: string[] = [];
    if (block.type === 'image' && block.content?.fileId) {
      ids.push(block.content.fileId as string);
    }
    if (block.type === 'pdf' && block.content?.fileId) {
      ids.push(block.content.fileId as string);
    }
    if (block.type === 'video' && block.content?.fileId) {
      ids.push(block.content.fileId as string);
    }
    return ids;
  }) || [];

  const { data: fileUrls, isLoading: fileUrlsLoading, isFetching: fileUrlsFetching, dataUpdatedAt: fileUrlsUpdatedAt } = useBatchFileUrls(fileIds, initialFileUrls);
  
  // Better cache detection for file URLs
  const fileUrlsMountTimeRef = useRef(Date.now());
  const fileUrlsIsFromCache = fileUrls && !fileUrlsFetching && !fileUrlsLoading && fileUrlsUpdatedAt && fileUrlsUpdatedAt < fileUrlsMountTimeRef.current;
  
  console.log('useBatchFileUrls result:', {
    fileIds: fileIds.length,
    fileUrlsCount: Object.keys(fileUrls || {}).length,
    initialFileUrlsCount: Object.keys(initialFileUrls).length,
    isLoading: fileUrlsLoading,
    isFetching: fileUrlsFetching,
    dataUpdatedAt: fileUrlsUpdatedAt ? new Date(fileUrlsUpdatedAt).toISOString() : null,
    mountTime: new Date(fileUrlsMountTimeRef.current).toISOString(),
    isFromCache: fileUrlsIsFromCache,
    hasData: !!fileUrls,
    queryEnabled: fileIds.length > 0, // Shows if query is enabled
    note: fileIds.length === 0 ? 'Query disabled (no file IDs)' : 'Query active'
  });

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
    if (saved && TAB_THEMES.some((t) => t.id === saved)) {
      setTabTheme(saved);
    }
  }, [tabId]);

  // Listen for theme changes from project header (localStorage changes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `trak-tab-theme-${tabId}` && e.newValue && TAB_THEMES.some((t) => t.id === e.newValue)) {
        setTabTheme(e.newValue);
      }
    };
    // Also listen to same-window changes via custom event
    const handleCustomChange = () => {
      const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
      if (saved && TAB_THEMES.some((t) => t.id === saved)) {
        setTabTheme(saved);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tab-theme-updated", handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tab-theme-updated", handleCustomChange);
    };
  }, [tabId]);

  const handleThemeChange = (theme: string) => {
    setTabTheme(theme);
  };

  return (
    <TabCanvas 
      tabId={tabId}
      projectId={projectId}
      workspaceId={workspaceId}
      blocks={blocks || []}
      scrollToTaskId={scrollToTaskId}
      onThemeChange={handleThemeChange}
      currentTheme={tabTheme}
      initialFileUrls={fileUrls || {}}
    />
  );
}

