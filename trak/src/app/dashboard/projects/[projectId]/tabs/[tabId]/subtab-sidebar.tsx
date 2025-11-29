"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubtabSidebarTab {
  id: string;
  name: string;
  position: number;
}

interface SubtabSidebarProps {
  parentTabId: string;
  parentTabName: string;
  subtabs: SubtabSidebarTab[];
  projectId: string;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export default function SubtabSidebar({
  parentTabId,
  parentTabName,
  subtabs,
  projectId,
  isExpanded,
  setIsExpanded,
}: SubtabSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTabId = pathname.split("/tabs/")[1]?.split("/")[0];

  const handleTabClick = (tabId: string) => {
    router.push(`/dashboard/projects/${projectId}/tabs/${tabId}`);
  };

  if (subtabs.length === 0) return null;

  return (
    <>
      {/* Expanded sidebar */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/10 z-30"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--surface)] border-r border-[var(--border)] z-40 shadow-lg">
            <div className="p-4 space-y-1 h-full overflow-y-auto">
              {/* Header with close button */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                  Navigation
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="h-4 w-4 text-[var(--muted-foreground)]" />
                </button>
              </div>

              {/* Parent tab link */}
              <button
                onClick={() => {
                  handleTabClick(parentTabId);
                  setIsExpanded(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTabId === parentTabId
                    ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                )}
              >
                {parentTabName}
              </button>

              {/* Divider */}
              <div className="pt-3 pb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                  Sub-tabs
                </div>
              </div>

              {/* Subtabs */}
              <div className="space-y-0.5">
                {subtabs.map((subtab) => (
                  <button
                    key={subtab.id}
                    onClick={() => {
                      handleTabClick(subtab.id);
                      setIsExpanded(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors border-l-2",
                      activeTabId === subtab.id
                        ? "bg-[var(--surface-hover)] text-[var(--foreground)] border-[var(--foreground)] font-medium"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] border-transparent"
                    )}
                  >
                    {subtab.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

