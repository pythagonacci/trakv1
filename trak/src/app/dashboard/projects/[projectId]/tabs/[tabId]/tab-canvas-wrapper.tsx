"use client";

import { useState, useEffect } from "react";
import TabCanvas from "./tab-canvas";
import { type Block } from "@/app/actions/block";
import { TAB_THEMES } from "./tab-themes";

interface TabCanvasWrapperProps {
  tabId: string;
  projectId: string;
  workspaceId: string;
  blocks: Block[];
  scrollToTaskId?: string | null;
  initialFileUrls?: Record<string, string>;
}

export default function TabCanvasWrapper({ tabId, projectId, workspaceId, blocks, scrollToTaskId, initialFileUrls = {} }: TabCanvasWrapperProps) {
  const [tabTheme, setTabTheme] = useState<string>("default");

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
      blocks={blocks}
      scrollToTaskId={scrollToTaskId}
      onThemeChange={handleThemeChange}
      currentTheme={tabTheme}
      initialFileUrls={initialFileUrls}
    />
  );
}

