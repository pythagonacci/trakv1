"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CreateClientTabDialog from "./create-client-tab-dialog";
import DeleteClientTabDialog from "./delete-client-tab-dialog";
import { updateClientTab } from "@/app/actions/client-tab";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClientTab {
  id: string;
  name: string;
  position: number;
}

interface ClientTabsProps {
  clientId: string;
  tabs: ClientTab[];
  activeTabId: string;
}

export default function ClientTabs({ clientId, tabs, activeTabId }: ClientTabsProps) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmTab, setDeleteConfirmTab] = useState<ClientTab | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const canDeleteTabs = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  const handleTabClick = (tabId: string, e?: React.MouseEvent) => {
    if (editingTabId) return;
    if (e?.detail === 2) return;

    // Handle fixed tabs (projects, details) with query params
    if (tabId === "projects" || tabId === "details") {
      router.push(`/dashboard/clients/${clientId}?tab=${tabId}`);
    } else {
      // Handle dynamic tabs with separate routes
      router.push(`/dashboard/clients/${clientId}/tabs/${tabId}`);
    }
    setMobileMenuOpen(false);
  };

  const handleDoubleClick = (tab: ClientTab, e: React.MouseEvent) => {
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
    const result = await updateClientTab({ tabId: editingTabId, name: trimmedName });

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
    setIsCreateDialogOpen(true);
  };

  const handleDialogSuccess = () => router.refresh();

  const handleDeleteSuccess = () => {
    router.refresh();
    if (deleteConfirmTab && activeTabId === deleteConfirmTab.id) {
      router.push(`/dashboard/clients/${clientId}`);
    }
  };

  const renderTab = (tab: ClientTab) => {
    const isActive = activeTabId === tab.id;
    const isEditing = editingTabId === tab.id;

    return (
      <div key={tab.id} className="group relative flex items-center">
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
                "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                isActive
                  ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <span className="truncate max-w-xs">{tab.name}</span>
            </button>

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
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  className="ml-1 inline-flex items-center justify-center rounded-[6px] p-2 text-[var(--tertiary-foreground)] opacity-0 pointer-events-none transition-all duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:pointer-events-auto group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => setEditingTabId(tab.id)}>
                  <Edit className="h-4 w-4" /> Rename
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
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="border-b border-[var(--border)] bg-transparent backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-2 px-2 py-0.5 sm:px-2.5">
          <div className="flex items-start gap-3 overflow-x-auto flex-1">
            {/* Projects tab - always first */}
            <div className="group relative flex items-center">
              <button
                onClick={(e) => handleTabClick("projects", e)}
                className={cn(
                  "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                  activeTabId === "projects"
                    ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <span className="truncate max-w-xs">Projects</span>
              </button>
            </div>

            {/* Client Details tab - always second */}
            <div className="group relative flex items-center">
              <button
                onClick={(e) => handleTabClick("details", e)}
                className={cn(
                  "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                  activeTabId === "details"
                    ? "text-[var(--foreground)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                <span className="truncate max-w-xs">Client Details</span>
              </button>
            </div>

            {/* Dynamic client tabs */}
            {tabs.map((tab) => renderTab(tab))}

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
            <button
              onClick={() => handleTabClick("projects")}
              className={cn(
                "flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-sm",
                activeTabId === "projects"
                  ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              )}
            >
              Projects
            </button>
            <button
              onClick={() => handleTabClick("details")}
              className={cn(
                "flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-sm",
                activeTabId === "details"
                  ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              )}
            >
              Client Details
            </button>
            {/* Dynamic client tabs */}
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
      </div>

      <CreateClientTabDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        clientId={clientId}
        onSuccess={handleDialogSuccess}
      />

      <DeleteClientTabDialog
        isOpen={deleteConfirmTab !== null}
        onClose={() => setDeleteConfirmTab(null)}
        tab={deleteConfirmTab}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}