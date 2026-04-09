"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import TabCanvas from "./tab-canvas";
import { CardCountProvider } from "./card-count-context";
import { type Block } from "@/app/actions/block";
import type { EntityProperties } from "@/types/properties";
import { TAB_THEMES } from "./tab-themes";
import { useTabBlocks, useBatchFileUrls } from "@/lib/hooks/use-tab-data";
import { useEntitiesProperties } from "@/lib/hooks/use-property-queries";
import {
  logClientPerf,
  setCurrentPerfNavigationId,
} from "@/lib/perf/perf-trace";

interface TabCanvasWrapperProps {
  tabId: string;
  projectId: string;
  projectName?: string;
  workspaceId: string;
  perfNavigationId?: string;
  blocks: Block[];
  initialBlockPropertiesById?: Record<string, EntityProperties>;
  scrollToTaskId?: string | null;
  initialFileUrls?: Record<string, string>;
  /** When true (e.g. workflow page), hide the page Undo button; undo is only in the AI chat */
  hidePageUndoButton?: boolean;
  lockedBlockIds?: string[];
}

export default function TabCanvasWrapper({
  tabId,
  projectId,
  projectName,
  workspaceId,
  perfNavigationId,
  blocks: initialBlocks,
  initialBlockPropertiesById = {},
  scrollToTaskId,
  initialFileUrls = {},
  hidePageUndoButton = false,
  lockedBlockIds = [],
}: TabCanvasWrapperProps) {
  const [tabTheme, setTabTheme] = useState<string>("default");

  // 🚀 NEW: Use React Query for cached blocks
  const { data: blocks, isLoading, isFetching, dataUpdatedAt, isPlaceholderData, isStale } = useTabBlocks(
    tabId,
    initialBlocks,
    { navigationId: perfNavigationId }
  );
  
  // Better cache detection: data exists, not fetching, and dataUpdatedAt is older than mount time
  const mountTimeRef = useRef(Date.now());
  const isFromCache = blocks && !isFetching && !isLoading && dataUpdatedAt && dataUpdatedAt < mountTimeRef.current;
  
  logClientPerf(
    `[PERF] client useTabBlocks result nav=${perfNavigationId ?? "none"} tabId=${tabId} blocks=${blocks?.length || 0} initialBlocks=${initialBlocks?.length || 0} isLoading=${isLoading} isFetching=${isFetching} isPlaceholderData=${isPlaceholderData} isStale=${isStale} isFromCache=${Boolean(isFromCache)} hasData=${Boolean(blocks)} dataUpdatedAt=${dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : "null"} mountTime=${new Date(mountTimeRef.current).toISOString()}`
  );

  // 🚀 NEW: Use React Query for cached file URLs
  const fileIds = blocks?.flatMap((block: Block) => {
    const ids: string[] = [];
    if (block.type === 'image' && block.content?.fileId) {
      ids.push(block.content.fileId as string);
    }
    if (block.type === 'cards' && Array.isArray(block.content?.items)) {
      block.content.items.forEach((item: any) => {
        if (item?.fileId) ids.push(item.fileId as string);
      });
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

  const { data: fileUrls, isLoading: fileUrlsLoading, isFetching: fileUrlsFetching, dataUpdatedAt: fileUrlsUpdatedAt } = useBatchFileUrls(
    fileIds,
    initialFileUrls,
    { navigationId: perfNavigationId }
  );
  
  // Better cache detection for file URLs
  const fileUrlsMountTimeRef = useRef(Date.now());
  const fileUrlsIsFromCache = fileUrls && !fileUrlsFetching && !fileUrlsLoading && fileUrlsUpdatedAt && fileUrlsUpdatedAt < fileUrlsMountTimeRef.current;
  
  logClientPerf(
    `[PERF] client useBatchFileUrls result nav=${perfNavigationId ?? "none"} fileIds=${fileIds.length} fileUrls=${Object.keys(fileUrls || {}).length} initialFileUrls=${Object.keys(initialFileUrls).length} isLoading=${fileUrlsLoading} isFetching=${fileUrlsFetching} isFromCache=${Boolean(fileUrlsIsFromCache)} hasData=${Boolean(fileUrls)} queryEnabled=${fileIds.length > 0} dataUpdatedAt=${fileUrlsUpdatedAt ? new Date(fileUrlsUpdatedAt).toISOString() : "null"} mountTime=${new Date(fileUrlsMountTimeRef.current).toISOString()}`
  );

  const blockIds = useMemo(
    () => (blocks || []).map((block: Block) => block.id),
    [blocks]
  );
  const {
    data: queriedBlockPropertiesById = {},
    isSuccess: hasLoadedBlockProperties,
  } = useEntitiesProperties("block", blockIds, workspaceId, {
    navigationId: perfNavigationId,
    source: "TabCanvasWrapper.blockProperties",
    initialData: initialBlockPropertiesById,
    hydrateInitialData: true,
  });
  const blockPropertiesById = hasLoadedBlockProperties
    ? queriedBlockPropertiesById
    : initialBlockPropertiesById;

  useEffect(() => {
    setCurrentPerfNavigationId(perfNavigationId ?? null);
    return () => {
      setCurrentPerfNavigationId(null);
    };
  }, [perfNavigationId]);

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
    const pendingCleanupFns = new Set<() => void>();

    const getScrollableAncestor = (el: HTMLElement): HTMLElement | null => {
      let parent = el.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        const canScroll = (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && parent.scrollHeight > parent.clientHeight;
        if (canScroll) return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const smoothCenterElement = (el: HTMLElement) => {
      const scrollParent = getScrollableAncestor(el);
      if (!scrollParent) {
        const rect = el.getBoundingClientRect();
        const targetTop = window.scrollY + rect.top - (window.innerHeight / 2 - rect.height / 2);
        const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const clampedTop = Math.max(0, Math.min(targetTop, maxScrollTop));
        window.scrollTo({ top: clampedTop, behavior: "smooth" });
        return;
      }

      const parentRect = scrollParent.getBoundingClientRect();
      const elementRect = el.getBoundingClientRect();
      const offsetWithinParent = elementRect.top - parentRect.top;
      const targetTop = scrollParent.scrollTop + offsetWithinParent - (scrollParent.clientHeight / 2 - elementRect.height / 2);
      const maxScrollTop = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
      const clampedTop = Math.max(0, Math.min(targetTop, maxScrollTop));
      scrollParent.scrollTo({ top: clampedTop, behavior: "smooth" });
    };

    const scrollToBlock = (blockId: string) => {
      const el = document.getElementById(`block-${blockId}`);
      if (el) {
        smoothCenterElement(el);
        return true;
      }
      return false;
    };
    const handleAiCreatedBlocks = (e: Event) => {
      const detail = (e as CustomEvent<{ blockIds: string[] }>).detail;
      const blockIds = detail?.blockIds;
      if (!Array.isArray(blockIds) || blockIds.length === 0) return;
      const firstId = blockIds[0];

      if (scrollToBlock(firstId)) return;

      let disconnected = false;
      let timeoutId: number | null = null;
      const observer = new MutationObserver(() => {
        tryScroll();
      });
      const cleanup = () => {
        if (disconnected) return;
        disconnected = true;
        observer.disconnect();
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        pendingCleanupFns.delete(cleanup);
      };
      const tryScroll = () => {
        if (scrollToBlock(firstId)) {
          cleanup();
        }
      };
      pendingCleanupFns.add(cleanup);
      observer.observe(document.body, { childList: true, subtree: true });

      // Two-frame defer ensures layout has committed after mount before measuring/scrolling.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          tryScroll();
        });
      });

      timeoutId = window.setTimeout(() => {
        cleanup();
      }, 12000);
    };
    window.addEventListener("ai-created-blocks", handleAiCreatedBlocks);
    return () => {
      window.removeEventListener("ai-created-blocks", handleAiCreatedBlocks);
      pendingCleanupFns.forEach((cleanup) => cleanup());
      pendingCleanupFns.clear();
    };
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex flex-col min-w-0 w-full">
    <CardCountProvider>
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
      lockedBlockIds={lockedBlockIds}
    />
    </CardCountProvider>
    </div>
  );
}
