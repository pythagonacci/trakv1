"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { type Block } from "@/app/actions/block";

interface SubtabConfig {
  parentTabId: string;
  parentTabName: string;
  subtabs: { id: string; name: string; position: number }[];
}

interface TabContentsContextValue {
  blocks: Block[];
  tocExpanded: boolean;
  setTocExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
  subtabConfig: SubtabConfig | null;
}

const TabContentsContext = createContext<TabContentsContextValue | null>(null);

export function TabContentsProvider({
  children,
  blocks,
  tabId,
  subtabConfig = null,
}: {
  children: React.ReactNode;
  blocks: Block[];
  tabId: string;
  subtabConfig?: SubtabConfig | null;
}) {
  const [tocExpanded, setTocExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`trak-tab-toc-expanded-${tabId}`);
    // Auto-open if there are subtabs and user hasn't explicitly closed it
    if (saved === "true" || (subtabConfig && subtabConfig.subtabs.length > 0 && saved !== "false")) {
      setTocExpanded(true);
    }
  }, [tabId, subtabConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`trak-tab-toc-expanded-${tabId}`, String(tocExpanded));
  }, [tabId, tocExpanded]);

  const value = useMemo(
    () => ({ blocks, tocExpanded, setTocExpanded, subtabConfig }),
    [blocks, tocExpanded, subtabConfig]
  );

  return (
    <TabContentsContext.Provider value={value}>
      {children}
    </TabContentsContext.Provider>
  );
}

export function useTabContents() {
  return useContext(TabContentsContext);
}
