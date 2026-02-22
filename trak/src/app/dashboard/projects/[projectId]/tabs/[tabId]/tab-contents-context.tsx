"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { type Block } from "@/app/actions/block";

interface TabContentsContextValue {
  blocks: Block[];
  tocExpanded: boolean;
  setTocExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const TabContentsContext = createContext<TabContentsContextValue | null>(null);

export function TabContentsProvider({
  children,
  blocks,
  tabId,
}: {
  children: React.ReactNode;
  blocks: Block[];
  tabId: string;
}) {
  const [tocExpanded, setTocExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`trak-tab-toc-expanded-${tabId}`);
    if (saved === "true") setTocExpanded(true);
  }, [tabId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`trak-tab-toc-expanded-${tabId}`, String(tocExpanded));
  }, [tabId, tocExpanded]);

  return (
    <TabContentsContext.Provider value={{ blocks, tocExpanded, setTocExpanded }}>
      {children}
    </TabContentsContext.Provider>
  );
}

export function useTabContents() {
  return useContext(TabContentsContext);
}
