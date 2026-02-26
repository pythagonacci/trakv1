"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TabContentsProvider } from "./tab-contents-context";
import type { Block } from "@/app/actions/block";

interface Tab {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
  children?: Tab[];
}

interface SubtabConfig {
  parentTabId: string;
  parentTabName: string;
  subtabs: { id: string; name: string; position: number }[];
}

interface TabPageLayoutProps {
  blocks?: Block[];
  workspaceId?: string;
  project: {
    id: string;
    name: string;
    workspace_id?: string;
    status: "not_started" | "in_progress" | "complete";
    due_date_date?: string | null;
    due_date_text?: string | null;
    priority?: string | null;
    client_page_enabled?: boolean;
    client_comments_enabled?: boolean;
    client_editing_enabled?: boolean;
    public_token?: string | null;
    client?: {
      id: string;
      name: string;
      company?: string | null;
    } | null;
  };
  tabId: string;
  tabs: Tab[];
  children: React.ReactNode;
  isWorkflowTab: boolean;
  subtabConfig?: SubtabConfig | null;
}

export default function TabPageLayout({
  project,
  tabId,
  tabs,
  children,
  isWorkflowTab,
  blocks = [],
  workspaceId,
  subtabConfig,
}: TabPageLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Listen for collapse state changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load initial state
    const saved = localStorage.getItem(`trak-project-header-collapsed-${project.id}`);
    if (saved === "true") {
      setIsCollapsed(true);
    }

    // Listen for changes
    const handleCollapseChange = (e: CustomEvent) => {
      if (e.detail?.projectId === project.id) {
        setIsCollapsed(e.detail.collapsed);
      }
    };

    window.addEventListener("project-header-collapse-changed", handleCollapseChange as EventListener);
    return () => {
      window.removeEventListener("project-header-collapse-changed", handleCollapseChange as EventListener);
    };
  }, [project.id]);

  return (
    <TabContentsProvider blocks={blocks} tabId={tabId} subtabConfig={subtabConfig}>
      <div className={isWorkflowTab ? "flex flex-col min-h-0 flex-1 h-full" : "pt-1 pb-3 md:pb-4 lg:pb-5"}>
        {children}
      </div>
    </TabContentsProvider>
  );
}
