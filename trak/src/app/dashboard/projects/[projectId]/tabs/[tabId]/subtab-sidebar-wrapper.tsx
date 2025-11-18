"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import SubtabSidebar from "./subtab-sidebar";

interface SubtabSidebarWrapperProps {
  sidebarConfig: {
    parentTabId: string;
    parentTabName: string;
    subtabs: any[];
  } | null;
  projectId: string;
  children: React.ReactNode;
}

export default function SubtabSidebarWrapper({
  sidebarConfig,
  projectId,
  children,
}: SubtabSidebarWrapperProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <>
      {/* Trigger button (only show if there are subtabs) */}
      {sidebarConfig && sidebarConfig.subtabs.length > 0 && (
        <button
          onClick={() => setIsSidebarExpanded(true)}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Show subtabs navigation"
        >
          <Menu className="h-3 w-3" />
          <span>Sub-tabs</span>
        </button>
      )}

      {/* Sidebar overlay */}
      {sidebarConfig && (
        <SubtabSidebar
          parentTabId={sidebarConfig.parentTabId}
          parentTabName={sidebarConfig.parentTabName}
          subtabs={sidebarConfig.subtabs}
          projectId={projectId}
          isExpanded={isSidebarExpanded}
          setIsExpanded={setIsSidebarExpanded}
        />
      )}

      {/* Content */}
      {children}
    </>
  );
}

