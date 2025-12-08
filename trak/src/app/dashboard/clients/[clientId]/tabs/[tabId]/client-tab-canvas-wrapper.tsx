"use client";

import { useState, useEffect, useRef } from "react";
import ClientTabCanvas from "./client-tab-canvas";
import { type ClientTabBlock } from "@/app/actions/client-tab-block";
import { TAB_THEMES } from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-themes";

interface ClientTabCanvasWrapperProps {
  tabId: string;
  clientId: string;
  workspaceId: string;
  blocks: ClientTabBlock[];
  scrollToTaskId?: string | null;
  initialFileUrls?: Record<string, string>;
}

export default function ClientTabCanvasWrapper({ 
  tabId, 
  clientId, 
  workspaceId, 
  blocks: initialBlocks, 
  scrollToTaskId, 
  initialFileUrls = {} 
}: ClientTabCanvasWrapperProps) {
  const [tabTheme, setTabTheme] = useState<string>("default");

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`trak-client-tab-theme-${tabId}`);
    if (saved && TAB_THEMES.some((t) => t.id === saved)) {
      setTabTheme(saved);
    }
  }, [tabId]);

  // Listen for theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `trak-client-tab-theme-${tabId}` && e.newValue && TAB_THEMES.some((t) => t.id === e.newValue)) {
        setTabTheme(e.newValue);
      }
    };
    const handleCustomChange = () => {
      const saved = localStorage.getItem(`trak-client-tab-theme-${tabId}`);
      if (saved && TAB_THEMES.some((t) => t.id === saved)) {
        setTabTheme(saved);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("client-tab-theme-updated", handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("client-tab-theme-updated", handleCustomChange);
    };
  }, [tabId]);

  const handleThemeChange = (theme: string) => {
    setTabTheme(theme);
  };

  return (
    <ClientTabCanvas 
      tabId={tabId}
      clientId={clientId}
      workspaceId={workspaceId}
      blocks={initialBlocks}
      scrollToTaskId={scrollToTaskId}
      onThemeChange={handleThemeChange}
      currentTheme={tabTheme}
      initialFileUrls={initialFileUrls}
    />
  );
}
