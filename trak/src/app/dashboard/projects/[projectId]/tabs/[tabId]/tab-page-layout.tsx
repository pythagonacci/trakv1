"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import ProjectHeader from "../../project-header";
import TabBar from "../../tab-bar";
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

interface TabPageLayoutProps {
  blocks?: Block[];
  project: {
    id: string;
    name: string;
    workspace_id?: string;
    status: "not_started" | "in_progress" | "complete";
    due_date_date?: string | null;
    due_date_text?: string | null;
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
}

export default function TabPageLayout({
  project,
  tabId,
  tabs,
  children,
  isWorkflowTab,
  blocks = [],
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
    <TabContentsProvider blocks={blocks} tabId={tabId}>
      <div className={isWorkflowTab ? "h-full flex flex-col min-h-0 bg-transparent" : "min-h-screen bg-transparent"}>
        {/* Project Header - Compact or Collapsed */}
        <div className={cn(
          "shrink-0",
          isCollapsed ? "sticky top-0 z-50" : "pt-1 pb-1 pl-2 pr-4 md:pl-3 md:pr-4 lg:pl-4 lg:pr-4"
        )}>
          <ProjectHeader project={project} tabId={tabId} tabs={tabs} />
        </div>

      {/* Tab Navigation - Sticky, hidden when collapsed */}
      {!isCollapsed && (
        <div className="sticky top-0 bg-transparent backdrop-blur-sm shrink-0 z-40">
          <div className="border-b border-[var(--border)]/50 -mx-2 md:-mx-3 lg:-mx-4 px-2 md:px-3 lg:px-4">
            <TabBar 
              tabs={tabs} 
              projectId={project.id}
              isClientProject={!!project.client}
              clientPageEnabled={project.client_page_enabled || false}
            />
          </div>
        </div>
      )}

        {/* Canvas Content */}
        <div className={isWorkflowTab ? "flex flex-col min-h-0 flex-1" : "pt-1 pb-3 md:pb-4 lg:pb-5"}>
          {children}
        </div>
      </div>
    </TabContentsProvider>
  );
}
