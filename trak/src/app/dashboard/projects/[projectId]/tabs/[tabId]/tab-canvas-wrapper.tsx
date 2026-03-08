"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import TabCanvas from "./tab-canvas";
import { type Block } from "@/app/actions/block";
import type { EntityProperties } from "@/types/properties";
import { TAB_THEMES } from "./tab-themes";
import { useTabBlocks, useBatchFileUrls } from "@/lib/hooks/use-tab-data";
import { useEntitiesProperties } from "@/lib/hooks/use-property-queries";

interface TabCanvasWrapperProps {
  tabId: string;
  projectId: string;
  projectName?: string;
  workspaceId: string;
  blocks: Block[];
  initialBlockPropertiesById?: Record<string, EntityProperties>;
  scrollToTaskId?: string | null;
  initialFileUrls?: Record<string, string>;
  /** When true (e.g. workflow page), hide the page Undo button; undo is only in the AI chat */
  hidePageUndoButton?: boolean;
}

export default function TabCanvasWrapper({
  tabId,
  projectId,
  projectName,
  workspaceId,
  blocks: initialBlocks,
  initialBlockPropertiesById = {},
  scrollToTaskId,
  initialFileUrls = {},
  hidePageUndoButton = false,
}: TabCanvasWrapperProps) {
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
  const fileIds = blocks?.flatMap((block: Block) => {
    const ids: string[] = [];
    if (block.type === 'image' && block.content?.fileId) {
      ids.push(block.content.fileId as string);
    }
    if (block.type === 'gallery' && Array.isArray(block.content?.items)) {
      block.content.items.forEach((item: any) => {
        if (item?.fileId) {
          ids.push(item.fileId as string);
        }
      });
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

  const blockIds = useMemo(
    () => (blocks || []).map((block: Block) => block.id),
    [blocks]
  );
  const {
    data: queriedBlockPropertiesById = {},
    isSuccess: hasLoadedBlockProperties,
  } = useEntitiesProperties("block", blockIds, workspaceId);
  const blockPropertiesById = hasLoadedBlockProperties
    ? queriedBlockPropertiesById
    : initialBlockPropertiesById;

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

  // Scroll to first created block when AI creates something (from ai-created-blocks event)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollToBlock = (blockId: string) => {
      const el = document.getElementById(`block-${blockId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    };
    const handleAiCreatedBlocks = (e: Event) => {
      const detail = (e as CustomEvent<{ blockIds: string[] }>).detail;
      const blockIds = detail?.blockIds;
      if (!Array.isArray(blockIds) || blockIds.length === 0) return;
      const firstId = blockIds[0];
      const tryScroll = (attempt = 0) => {
        if (scrollToBlock(firstId)) return;
        if (attempt < 10) {
          setTimeout(() => tryScroll(attempt + 1), 300 + attempt * 200);
        }
      };
      setTimeout(() => tryScroll(0), 400);
    };
    window.addEventListener("ai-created-blocks", handleAiCreatedBlocks);
    return () => window.removeEventListener("ai-created-blocks", handleAiCreatedBlocks);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex flex-col min-w-0 w-full">
    <TabCanvas 
      tabId={tabId}
      projectId={projectId}
      projectName={projectName}
      workspaceId={workspaceId}
      blocks={blocks || []}
      initialBlockPropertiesById={blockPropertiesById}
      scrollToTaskId={scrollToTaskId}
      onThemeChange={handleThemeChange}
      currentTheme={tabTheme}
      initialFileUrls={fileUrls || {}}
      hidePageUndoButton={hidePageUndoButton}
    />
    </div>
  );
}
