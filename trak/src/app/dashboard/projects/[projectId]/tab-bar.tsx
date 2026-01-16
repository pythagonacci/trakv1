"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, ChevronDown, MoreHorizontal, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateTabDialog from "./create-tab-dialog";
import DeleteTabDialog from "./delete-tab-dialog";
import { updateTab } from "@/app/actions/tab";
import { toggleTabVisibility, updateTabClientTitle } from "@/app/actions/client-page";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Tab {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
  children?: Tab[];
}

interface TabBarProps {
  tabs: Tab[];
  projectId: string;
  isClientProject?: boolean;
  clientPageEnabled?: boolean;
}

export default function TabBar({ tabs, projectId, isClientProject = false, clientPageEnabled = false }: TabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentWorkspace } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogParentId, setCreateDialogParentId] = useState<string | undefined>(undefined);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmTab, setDeleteConfirmTab] = useState<Tab | null>(null);
  const [deleteTriggerRef, setDeleteTriggerRef] = useState<React.RefObject<HTMLElement | null> | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});
  const [isHoveringRevealZone, setIsHoveringRevealZone] = useState(false);
  const [isHoveringFloating, setIsHoveringFloating] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const revealTimeoutRef = useRef<number | null>(null);
  const floatingTimeoutRef = useRef<number | null>(null);

  const canDeleteTabs = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";
  const activeTabId = pathname.split("/tabs/")[1]?.split("/")[0];

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  useEffect(() => {
    const scrollContainer = document.getElementById("dashboard-content");
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsAtTop(scrollContainer.scrollTop < 12);
    };

    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        window.clearTimeout(revealTimeoutRef.current);
      }
      if (floatingTimeoutRef.current) {
        window.clearTimeout(floatingTimeoutRef.current);
      }
    };
  }, []);

  const handleTabClick = (tabId: string, e?: React.MouseEvent) => {
    if (editingTabId) return;
    if (e?.detail === 2) return;
    router.push(`/dashboard/projects/${projectId}/tabs/${tabId}`);
    setMobileMenuOpen(false);
  };

  const handleDoubleClick = (tab: Tab, e: React.MouseEvent) => {
    e.preventDefault();
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleSaveRename = async () => {
    if (!editingTabId) return;
    const trimmedName = editName.trim();

    if (!trimmedName) {
      setEditingTabId(null);
      return;
    }

    setIsSaving(true);
    const result = await updateTab({ tabId: editingTabId, name: trimmedName });

    if (!result.error) {
      setEditingTabId(null);
      router.refresh();
    }
    setIsSaving(false);
  };

  const handleCancelRename = () => {
    setEditingTabId(null);
    setEditName("");
  };

  const handleToggleClientVisibility = async (tab: Tab) => {
    const newVisibility = !tab.is_client_visible;
    const result = await toggleTabVisibility(tab.id, newVisibility);
    
    if (result.error) {
      alert(`Error: ${result.error}`);
      return;
    }
    
    router.refresh();
  };

  const handleUpdateClientTitle = async (tabId: string) => {
    const newTitle = prompt("Enter client-facing title (leave empty to use default tab name):");
    
    if (newTitle === null) return; // Cancelled
    
    const result = await updateTabClientTitle(tabId, newTitle.trim() || null);
    
    if (result.error) {
      alert(`Error: ${result.error}`);
      return;
    }
    
    router.refresh();
  };

  const handleAddTab = () => {
    setCreateDialogParentId(undefined);
    setIsCreateDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    // No need to refresh here - navigation will fetch fresh data due to revalidation in createTab action
  };

  const handleDeleteSuccess = () => {
    // If we deleted the currently active tab, navigate to project page
    // Revalidation in deleteTab action ensures fresh data is fetched
    if (deleteConfirmTab && activeTabId === deleteConfirmTab.id) {
      router.push(`/dashboard/projects/${projectId}`);
    }
    // No need to refresh - revalidation handles cache invalidation
  };

  // Find if active tab is a child and get its parent
  const findParentOfActiveTab = () => {
    for (const tab of tabs) {
      if (tab.children) {
        const activeChild = tab.children.find((child) => child.id === activeTabId);
        if (activeChild) {
          return { parent: tab, activeChild };
        }
      }
    }
    return null;
  };

  const activeTabInfo = findParentOfActiveTab();
  const [expandedTabId, setExpandedTabId] = useState<string | null>(activeTabInfo?.parent.id || null);

  const renderTab = (tab: Tab, depth = 0, showDropdown = true) => {
    const isActive = activeTabId === tab.id;
    const isEditing = editingTabId === tab.id;
    const hasChildren = tab.children && tab.children.length > 0;
    const isExpanded = expandedTabId === tab.id;
    const isParentOfActive = activeTabInfo?.parent.id === tab.id;

    // Create ref for menu trigger if it doesn't exist
    if (!menuTriggerRefs.current[tab.id]) {
      menuTriggerRefs.current[tab.id] = React.createRef<HTMLButtonElement>();
    }
    const menuTriggerRef = menuTriggerRefs.current[tab.id];

    return (
      <div key={tab.id}>
        <div className={cn("group relative flex items-center", depth > 0 && "pl-0")}>
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              disabled={isSaving}
              className="h-8 min-w-[140px] rounded-[6px] border border-[var(--foreground)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] focus:outline-none"
            />
          ) : (
            <>
              <button
                onClick={(e) => handleTabClick(tab.id, e)}
                onDoubleClick={(e) => handleDoubleClick(tab, e)}
                className={cn(
                  "relative whitespace-nowrap px-3 py-3 text-sm transition-colors flex flex-col items-start gap-0",
                  isActive || isParentOfActive
                    ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  depth === 0 ? "font-medium" : ""
                )}
              >
                {/* Parent tab name or child tab name */}
                <span className="truncate max-w-xs text-left">
                  {depth === 0 && isParentOfActive ? tab.name : tab.name}
                </span>
                
                {/* Active subtab underneath (only on parent) */}
                {depth === 0 && isParentOfActive && activeTabInfo?.activeChild && (
                  <span className="text-xs font-bold text-[var(--foreground)] mt-0.5">
                    {activeTabInfo.activeChild.name}
                  </span>
                )}
              </button>
              
              {/* Dropdown arrow for tabs with children */}
              {hasChildren && depth === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedTabId(isExpanded ? null : tab.id);
                  }}
                  className={cn(
                    "ml-1 inline-flex items-center justify-center rounded-[6px] p-1 transition-all duration-150",
                    isExpanded || isParentOfActive
                      ? "text-[var(--foreground)]"
                      : "text-[var(--tertiary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                </button>
              )}
            </>
          )}

          {showDropdown && (
            <DropdownMenu 
              open={openMenuId === tab.id} 
              onOpenChange={(open) => {
                if (open) {
                  setOpenMenuId(tab.id);
                } else {
                  setOpenMenuId(null);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  ref={menuTriggerRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="ml-1 inline-flex items-center justify-center rounded-[6px] p-2 text-[var(--tertiary-foreground)] opacity-0 pointer-events-none transition-all duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:pointer-events-auto group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => setEditingTabId(tab.id)}>
                <Edit className="h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCreateDialogParentId(tab.id);
                  setIsCreateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add sub-tab
              </DropdownMenuItem>
              
              {/* Public Page Settings */}
              {clientPageEnabled && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      handleToggleClientVisibility(tab);
                    }}
                  >
                    {tab.is_client_visible ? (
                      <>
                        <EyeOff className="h-4 w-4" /> Make Private
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" /> Make Public
                      </>
                    )}
                  </DropdownMenuItem>
                  {tab.is_client_visible && (
                    <DropdownMenuItem onClick={() => handleUpdateClientTitle(tab.id)}>
                      <Edit className="h-4 w-4" /> 
                      <span className="truncate">
                        {tab.client_title ? "Edit public title" : "Set public title"}
                      </span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
              
              {canDeleteTabs && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setDeleteTriggerRef(menuTriggerRef);
                      setDeleteConfirmTab(tab);
                      setOpenMenuId(null); // Close the dropdown menu
                    }}
                    className="text-red-500 focus:bg-red-50 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
        
        {/* Show all subtabs in dropdown when expanded */}
        {isExpanded && hasChildren && !isParentOfActive && depth === 0 && (
          <div className="pl-6 border-l-2 border-[var(--border)] ml-3 space-y-1 py-1">
            {tab.children!.map((child) => renderTab(child, 1, showDropdown))}
          </div>
        )}
      </div>
    );
  };

  const shouldShowFloating = !isAtTop && (isHoveringRevealZone || isHoveringFloating || mobileMenuOpen);

  const renderBar = (variant: "inline" | "floating") => (
    <>
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-2",
          variant === "floating" ? "px-3 py-1.5" : "px-2 py-0.5 sm:px-2.5"
        )}
      >
        <div className="flex items-start gap-3 overflow-x-auto flex-1">
          {tabs.map((tab) => renderTab(tab, 0, variant === "inline"))}
          <button
            onClick={handleAddTab}
            className="ml-3 inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-dashed border-[var(--border)] px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)] mt-3"
          >
            <Plus className="h-3.5 w-3.5" /> New tab
          </button>
        </div>

        <button
          className="lg:hidden rounded-[6px] border border-[var(--border)] p-2 text-[var(--muted-foreground)] mt-3"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", mobileMenuOpen && "rotate-180")} />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mt-2 space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-card lg:hidden">
          {tabs.map((tab) => (
            <div key={tab.id}>
              <button
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-sm",
                  activeTabId === tab.id
                    ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                )}
              >
                {tab.name}
              </button>
              {tab.children && tab.children.length > 0 && (
                <div className="ml-4 mt-1 space-y-1">
                  {tab.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleTabClick(child.id)}
                      className={cn(
                        "flex w-full items-center rounded-[6px] px-3 py-1.5 text-xs",
                        activeTabId === child.id
                          ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={handleAddTab}
            className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            <Plus className="h-4 w-4" /> New tab
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="border-b border-[var(--border)] bg-transparent backdrop-blur-sm">
        {renderBar("inline")}
      </div>

      <div
        className="fixed inset-x-0 top-0 z-50 h-3"
        onMouseEnter={() => setIsHoveringRevealZone(true)}
        onMouseLeave={() => setIsHoveringRevealZone(false)}
        onTouchStart={() => {
          setIsHoveringRevealZone(true);
          if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
          revealTimeoutRef.current = window.setTimeout(() => setIsHoveringRevealZone(false), 1600);
        }}
      />

      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-3 z-50 transition-all duration-200 ease-out",
          shouldShowFloating ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-3 opacity-0"
        )}
        onMouseEnter={() => setIsHoveringFloating(true)}
        onMouseLeave={() => setIsHoveringFloating(false)}
        onTouchStart={() => {
          setIsHoveringFloating(true);
          if (floatingTimeoutRef.current) window.clearTimeout(floatingTimeoutRef.current);
        }}
        onTouchEnd={() => {
          if (floatingTimeoutRef.current) window.clearTimeout(floatingTimeoutRef.current);
          floatingTimeoutRef.current = window.setTimeout(() => setIsHoveringFloating(false), 1600);
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-3">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-md">
            {renderBar("floating")}
          </div>
        </div>
      </div>

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

      <DeleteTabDialog
        isOpen={deleteConfirmTab !== null}
        onClose={() => {
          setDeleteConfirmTab(null);
          setDeleteTriggerRef(null);
        }}
        tab={deleteConfirmTab}
        onSuccess={handleDeleteSuccess}
        triggerRef={deleteTriggerRef}
      />
    </>
  );
}