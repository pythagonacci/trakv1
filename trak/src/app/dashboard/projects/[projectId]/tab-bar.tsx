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
  children?: Tab[];
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
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
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

  const handleAddTab = () => {
    setCreateDialogParentId(undefined);
    setIsCreateDialogOpen(true);
  };

  const handleDialogSuccess = () => router.refresh();

  const handleDeleteSuccess = () => {
    router.refresh();
    if (deleteConfirmTab && activeTabId === deleteConfirmTab.id) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  };

  const renderTab = (tab: Tab, depth = 0) => {
    const isActive = activeTabId === tab.id;
    const isEditing = editingTabId === tab.id;
    const hasChildren = tab.children && tab.children.length > 0;

    return (
      <div
        key={tab.id}
        className={cn("group relative flex items-center", depth > 0 && "pl-3")}
      >
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
          <button
            onClick={(e) => handleTabClick(tab.id, e)}
            onDoubleClick={(e) => handleDoubleClick(tab, e)}
            className={cn(
              "relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors",
              isActive
                ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <span className="truncate max-w-xs text-left">{tab.name}</span>
            {hasChildren && <ChevronDown className="ml-1 h-3 w-3 text-[var(--tertiary-foreground)]" />}
          </button>
        )}

        <DropdownMenu open={openMenuId === tab.id} onOpenChange={(open) => setOpenMenuId(open ? tab.id : null)}>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 inline-flex items-center justify-center rounded-[6px] p-2 text-[var(--tertiary-foreground)] opacity-0 pointer-events-none transition-all duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:pointer-events-auto group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
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
            {canDeleteTabs && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteConfirmTab(tab)}
                  className="text-red-500 focus:bg-red-50 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const shouldShowFloating = !isAtTop && (isHoveringRevealZone || isHoveringFloating || mobileMenuOpen);

  const renderBar = (variant: "inline" | "floating") => (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          variant === "floating" ? "px-3 py-1.5" : "px-2 py-0.5 sm:px-2.5"
        )}
      >
        <div className="flex items-center gap-3 overflow-x-auto">
          {tabs.map((tab) => (
            <div key={tab.id} className="flex items-center gap-2">
              {renderTab(tab)}
              {tab.children && tab.children.length > 0 && (
                <div className="flex items-center gap-2 pl-4">
                  {tab.children.map((child) => renderTab(child, 1))}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={handleAddTab}
            className="ml-3 inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-dashed border-[var(--border)] px-3 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            <Plus className="h-3.5 w-3.5" /> New tab
          </button>
        </div>

        <button
          className="lg:hidden rounded-[6px] border border-[var(--border)] p-2 text-[var(--muted-foreground)]"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", mobileMenuOpen && "rotate-180")} />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mt-2 space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-card lg:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
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
          shouldShowFloating ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
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
        <div className="pointer-events-auto mx-auto w-full max-w-6xl px-3">
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
        onClose={() => setDeleteConfirmTab(null)}
        tab={deleteConfirmTab}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}