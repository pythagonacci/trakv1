"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateTabDialog from "./create-tab-dialog";
import DeleteTabDialog from "./delete-tab-dialog";
import { updateTab, type TabWithChildren } from "@/app/actions/tab";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TabBarProps {
  tabs: TabWithChildren[];
  projectId: string;
}

export default function TabBar({ tabs, projectId }: TabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentWorkspace } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogParentId, setCreateDialogParentId] = useState<string | undefined>(undefined);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmTab, setDeleteConfirmTab] = useState<TabWithChildren | null>(null);
  
  // Inline rename state
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Expand/collapse state - load from localStorage
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const stored = localStorage.getItem(`tabs_expanded_${projectId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Save expanded state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`tabs_expanded_${projectId}`, JSON.stringify(Array.from(expandedTabs)));
    }
  }, [expandedTabs, projectId]);

  // Check if user can delete tabs (only admins and owners)
  const canDeleteTabs = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  // Determine active tab from URL
  const activeTabId = pathname.split("/tabs/")[1]?.split("/")[0];

  // Toggle expand/collapse
  const toggleExpand = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  const handleTabClick = (tabId: string, e?: React.MouseEvent) => {
    // Don't navigate if we're currently editing
    if (editingTabId) return;
    
    // Prevent navigation if this was a double-click (will trigger rename)
    if (e?.detail === 2) return;
    
    router.push(`/dashboard/projects/${projectId}/tabs/${tabId}`);
    setMobileMenuOpen(false);
  };

  const handleDoubleClick = (tab: TabWithChildren, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleSaveRename = async () => {
    if (!editingTabId) return;

    const trimmedName = editName.trim();
    
    // Find original tab in flattened list
    const findTab = (tabList: TabWithChildren[]): TabWithChildren | undefined => {
      for (const tab of tabList) {
        if (tab.id === editingTabId) return tab;
        if (tab.children) {
          const found = findTab(tab.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    // Validation
    if (!trimmedName) {
      // Revert to original name
      const originalTab = findTab(tabs);
      setEditName(originalTab?.name || "");
      setEditingTabId(null);
      return;
    }

    if (trimmedName.length > 100) {
      // Name too long, revert
      const originalTab = findTab(tabs);
      setEditName(originalTab?.name || "");
      setEditingTabId(null);
      return;
    }

    // If name hasn't changed, just cancel
    const originalTab = findTab(tabs);
    if (trimmedName === originalTab?.name) {
      setEditingTabId(null);
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateTab({
        tabId: editingTabId,
        name: trimmedName,
      });

      if (result.error) {
        // Revert to original name on error
        const originalTab = findTab(tabs);
        setEditName(originalTab?.name || "");
        setIsSaving(false);
        // Could show error toast here
        return;
      }

      // Success: exit edit mode and refresh
      setEditingTabId(null);
      setIsSaving(false);
      router.refresh();
    } catch {
      // Revert on error
      const originalTab = findTab(tabs);
      setEditName(originalTab?.name || "");
      setIsSaving(false);
      setEditingTabId(null);
    }
  };

  const handleCancelRename = () => {
    const findTab = (tabList: TabWithChildren[]): TabWithChildren | undefined => {
      for (const tab of tabList) {
        if (tab.id === editingTabId) return tab;
        if (tab.children) {
          const found = findTab(tab.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    const originalTab = findTab(tabs);
    setEditName(originalTab?.name || "");
    setEditingTabId(null);
    setIsSaving(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const handleAddTab = () => {
    setCreateDialogParentId(undefined);
    setIsCreateDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    // Refresh the page to show the new tab in the tab bar
    // Note: We don't navigate to the tab route yet since that's Task 2.5 (Page/Canvas Foundation)
    router.refresh();
  };

  const handleDeleteSuccess = () => {
    // Refresh the page after deletion
    router.refresh();
    // If we deleted the active tab, navigate to project page
    if (deleteConfirmTab && activeTabId === deleteConfirmTab.id) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  };

  const handleContextMenuRename = (tab: TabWithChildren) => {
    setOpenMenuId(null);
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleContextMenuAddSubTab = (tab: TabWithChildren) => {
    setOpenMenuId(null);
    setCreateDialogParentId(tab.id);
    setIsCreateDialogOpen(true);
  };

  const handleContextMenuDelete = (tab: TabWithChildren) => {
    setOpenMenuId(null);
    setDeleteConfirmTab(tab);
  };

  // Flatten tabs for finding active tab (for mobile dropdown)
  const flattenTabs = (tabList: TabWithChildren[]): TabWithChildren[] => {
    const result: TabWithChildren[] = [];
    const traverse = (tabs: TabWithChildren[]) => {
      tabs.forEach((tab) => {
        result.push(tab);
        if (tab.children && tab.children.length > 0) {
          traverse(tab.children);
        }
      });
    };
    traverse(tabList);
    return result;
  };

  // Recursive TabItem component
  const TabItem = ({ tab, depth = 0 }: { tab: TabWithChildren; depth?: number }) => {
    const isEditing = editingTabId === tab.id;
    const isActive = activeTabId === tab.id;
    const hasChildren = tab.children && tab.children.length > 0;
    const isExpanded = expandedTabs.has(tab.id);
    
    // Limit visual indentation depth (max 3 levels)
    const visualDepth = Math.min(depth, 3);
    const indentAmount = visualDepth * 12; // 12px per level
    
    // Sub-tab styling (depth > 0)
    const isSubTab = depth > 0;
    const textSize = isSubTab ? "text-xs" : "text-sm";
    const fontWeight = isSubTab ? "font-normal" : "font-medium";
    const textColorActive = isSubTab 
      ? "text-neutral-700 dark:text-neutral-300" 
      : "text-neutral-900 dark:text-white";
    const textColorInactive = isSubTab
      ? "text-neutral-500 dark:text-neutral-500"
      : "text-neutral-500 dark:text-neutral-400";
    const hoverColor = isSubTab
      ? "hover:text-neutral-600 dark:hover:text-neutral-400"
      : "hover:text-neutral-700 dark:hover:text-neutral-300";

    return (
      <>
        <div
          className="relative flex items-center group"
          style={{ marginLeft: indentAmount > 0 ? `${indentAmount}px` : undefined }}
        >
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleRenameKeyDown}
              disabled={isSaving}
              className={cn(
                "py-4 px-0 border-b-2 -mb-px whitespace-nowrap bg-transparent outline-none focus:outline-none",
                textSize,
                fontWeight,
                "border-neutral-900 dark:border-white text-neutral-900 dark:text-white",
                isSaving && "opacity-50"
              )}
              style={{ width: `${Math.max(editName.length * 8, 60)}px` }}
              maxLength={100}
            />
          ) : (
            <div className="flex items-center gap-1">
              {/* Expand/Collapse Button (only for tabs with children) */}
              {hasChildren && (
                <button
                  onClick={(e) => toggleExpand(tab.id, e)}
                  className="p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  )}
                </button>
              )}
              
              <button
                onClick={(e) => handleTabClick(tab.id, e)}
                onDoubleClick={(e) => handleDoubleClick(tab, e)}
                className={cn(
                  "py-4 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer",
                  textSize,
                  fontWeight,
                  isActive
                    ? `border-neutral-900 dark:border-white ${textColorActive}`
                    : `border-transparent ${textColorInactive} ${hoverColor}`
                )}
              >
                {tab.name}
              </button>
              
              {/* Context Menu Trigger */}
              <DropdownMenu open={openMenuId === tab.id} onOpenChange={(open) => setOpenMenuId(open ? tab.id : null)}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100",
                      openMenuId === tab.id && "opacity-100"
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={() => handleContextMenuRename(tab)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleContextMenuAddSubTab(tab)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add sub-tab
                  </DropdownMenuItem>
                  {canDeleteTabs && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleContextMenuDelete(tab)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        {/* Render children if expanded */}
        {hasChildren && isExpanded && tab.children && (
          <>
            {tab.children.map((child) => (
              <TabItem key={child.id} tab={child} depth={depth + 1} />
            ))}
          </>
        )}
      </>
    );
  };

  return (
    <>
      {/* Desktop: Horizontal Tabs */}
      <div className="hidden md:block border-b border-neutral-200 dark:border-neutral-800 px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 overflow-x-auto">
          {tabs.map((tab) => (
            <TabItem key={tab.id} tab={tab} depth={0} />
          ))}

          {/* Add Tab Button */}
          <button
            onClick={handleAddTab}
            className="py-4 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Tab
          </button>
        </div>
      </div>

      {/* Mobile: Dropdown with nested tabs */}
      <div className="block md:hidden border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between text-sm font-medium text-neutral-900 dark:text-white"
        >
          <span>
            {flattenTabs(tabs).find((t) => t.id === activeTabId)?.name || "Select a tab"}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              mobileMenuOpen && "rotate-180"
            )}
          />
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg">
            {/* Recursive mobile menu item */}
            {(() => {
              const MobileTabItem = ({ tab, depth = 0 }: { tab: TabWithChildren; depth?: number }) => {
                const hasChildren = tab.children && tab.children.length > 0;
                const isExpanded = expandedTabs.has(tab.id);
                const isActive = activeTabId === tab.id;
                const indentAmount = depth * 16; // 16px per level for mobile
                const isSubTab = depth > 0;

                return (
                  <>
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          toggleExpand(tab.id);
                        } else {
                          handleTabClick(tab.id);
                          setMobileMenuOpen(false);
                        }
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-left transition-colors flex items-center gap-2",
                        isSubTab ? "text-xs" : "text-sm",
                        isActive
                          ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                      )}
                      style={{ paddingLeft: `${16 + indentAmount}px` }}
                    >
                      {hasChildren && (
                        <span className="shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </span>
                      )}
                      {!hasChildren && <span className="w-3" />}
                      <span className="truncate">{tab.name}</span>
                    </button>
                    {hasChildren && isExpanded && tab.children && (
                      <>
                        {tab.children.map((child) => (
                          <MobileTabItem key={child.id} tab={child} depth={depth + 1} />
                        ))}
                      </>
                    )}
                  </>
                );
              };

              return (
                <>
                  {tabs.map((tab) => (
                    <MobileTabItem key={tab.id} tab={tab} depth={0} />
                  ))}
                  <button
                    onClick={handleAddTab}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-750 flex items-center gap-2 border-t border-neutral-200 dark:border-neutral-700 mt-1 pt-3"
                  >
                    <Plus className="w-4 h-4" />
                    Add Tab
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Create Tab Dialog */}
      <CreateTabDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setCreateDialogParentId(undefined);
        }}
        projectId={projectId}
        initialParentTabId={createDialogParentId}
        onSuccess={handleDialogSuccess}
      />

      {/* Delete Tab Dialog */}
      <DeleteTabDialog
        isOpen={deleteConfirmTab !== null}
        onClose={() => setDeleteConfirmTab(null)}
        tab={deleteConfirmTab}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}