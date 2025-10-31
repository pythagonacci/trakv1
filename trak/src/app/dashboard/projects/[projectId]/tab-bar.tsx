"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, ChevronDown, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateTabDialog from "./create-tab-dialog";
import DeleteTabDialog from "./delete-tab-dialog";
import { updateTab } from "@/app/actions/tab";
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
}

interface TabBarProps {
  tabs: Tab[];
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
  const [deleteConfirmTab, setDeleteConfirmTab] = useState<Tab | null>(null);
  
  // Inline rename state
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Check if user can delete tabs (only admins and owners)
  const canDeleteTabs = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  // Determine active tab from URL
  const activeTabId = pathname.split("/tabs/")[1]?.split("/")[0];

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

  const handleDoubleClick = (tab: Tab, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleSaveRename = async () => {
    if (!editingTabId) return;

    const trimmedName = editName.trim();
    
    // Validation
    if (!trimmedName) {
      // Revert to original name
      const originalTab = tabs.find((t) => t.id === editingTabId);
      setEditName(originalTab?.name || "");
      setEditingTabId(null);
      return;
    }

    if (trimmedName.length > 100) {
      // Name too long, revert
      const originalTab = tabs.find((t) => t.id === editingTabId);
      setEditName(originalTab?.name || "");
      setEditingTabId(null);
      return;
    }

    // If name hasn't changed, just cancel
    const originalTab = tabs.find((t) => t.id === editingTabId);
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
      setEditName(originalTab?.name || "");
      setIsSaving(false);
      setEditingTabId(null);
    }
  };

  const handleCancelRename = () => {
    const originalTab = tabs.find((t) => t.id === editingTabId);
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

  const handleContextMenuRename = (tab: Tab) => {
    setOpenMenuId(null);
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleContextMenuAddSubTab = (tab: Tab) => {
    setOpenMenuId(null);
    setCreateDialogParentId(tab.id);
    setIsCreateDialogOpen(true);
  };

  const handleContextMenuDelete = (tab: Tab) => {
    setOpenMenuId(null);
    setDeleteConfirmTab(tab);
  };

  return (
    <>
      {/* Desktop: Horizontal Tabs */}
      <div className="hidden md:block border-b border-neutral-200 dark:border-neutral-800 px-6">
        <div className="flex items-center gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const isEditing = editingTabId === tab.id;
            const isActive = activeTabId === tab.id;
            
            return (
              <div
                key={tab.id}
                className="relative flex items-center group"
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
                      "py-4 px-0 text-sm font-medium border-b-2 -mb-px whitespace-nowrap bg-transparent outline-none focus:outline-none",
                      "border-neutral-900 dark:border-white text-neutral-900 dark:text-white",
                      isSaving && "opacity-50"
                    )}
                    style={{ width: `${Math.max(editName.length * 8, 60)}px` }}
                    maxLength={100}
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleTabClick(tab.id, e)}
                      onDoubleClick={(e) => handleDoubleClick(tab, e)}
                      className={cn(
                        "py-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer",
                        isActive
                          ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                          : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
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
            );
          })}

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

      {/* Mobile: Dropdown */}
      <div className="block md:hidden border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between text-sm font-medium text-neutral-900 dark:text-white"
        >
          <span>
            {tabs.find((t) => t.id === activeTabId)?.name || "Select a tab"}
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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm transition-colors",
                  activeTabId === tab.id
                    ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-750"
                )}
              >
                {tab.name}
              </button>
            ))}
            <button
              onClick={handleAddTab}
              className="w-full px-4 py-2 text-left text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-750 flex items-center gap-2 border-t border-neutral-200 dark:border-neutral-700 mt-1 pt-3"
            >
              <Plus className="w-4 h-4" />
              Add Tab
            </button>
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