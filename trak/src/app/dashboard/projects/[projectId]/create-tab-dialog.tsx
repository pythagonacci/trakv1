"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createTab, getProjectTabs, type TabWithChildren } from "@/app/actions/tab";
import { createWorkflowPage } from "@/app/actions/workflow-page";

interface CreateTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialParentTabId?: string | null; // Pre-select parent if creating sub-tab from context menu
  onSuccess?: () => void; // Callback when tab is successfully created
}

export default function CreateTabDialog({
  isOpen,
  onClose,
  projectId,
  initialParentTabId,
  onSuccess,
}: CreateTabDialogProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tabName, setTabName] = useState("");
  const [isSubTab, setIsSubTab] = useState(initialParentTabId !== undefined);
  const [isWorkflowPage, setIsWorkflowPage] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    initialParentTabId || null
  );
  const [availableParents, setAvailableParents] = useState<TabWithChildren[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ensure we're mounted before using portal (SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load parent tabs when dialog opens and sub-tab mode is enabled
  useEffect(() => {
    if (isOpen && isSubTab && availableParents.length === 0) {
      setIsLoadingParents(true);
      getProjectTabs(projectId)
        .then((result) => {
          if (result.data) {
            setAvailableParents(result.data);
          } else if (result.error) {
            setFormError(`Failed to load tabs: ${result.error}`);
          }
          setIsLoadingParents(false);
        })
        .catch(() => {
          setFormError("Failed to load tabs");
          setIsLoadingParents(false);
        });
    }
  }, [isOpen, isSubTab, projectId, availableParents.length]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTabName("");
      setIsSubTab(initialParentTabId !== undefined);
      setIsWorkflowPage(false);
      setSelectedParentId(initialParentTabId || null);
      setFormError("");
      setIsSubmitting(false);
      setAvailableParents([]); // Reset to force reload when needed
    }
  }, [isOpen, initialParentTabId]);

  // Load parents when sub-tab checkbox is checked
  useEffect(() => {
    if (isOpen && isSubTab && availableParents.length === 0 && !isLoadingParents) {
      setIsLoadingParents(true);
      getProjectTabs(projectId)
        .then((result) => {
          if (result.data) {
            setAvailableParents(result.data);
          }
          setIsLoadingParents(false);
        })
        .catch(() => {
          setIsLoadingParents(false);
        });
    }
  }, [isOpen, isSubTab, projectId, availableParents.length, isLoadingParents]);

  // Flatten hierarchical tabs for dropdown (include all tabs recursively)
  const flattenTabsWithDepth = (
    tabs: TabWithChildren[],
    depth: number = 0,
    excludeTabId?: string // Exclude a tab (to prevent making a tab its own parent)
  ): Array<{ id: string; name: string; depth: number }> => {
    const result: Array<{ id: string; name: string; depth: number }> = [];
    
    tabs.forEach((tab) => {
      // Skip the tab being excluded
      if (tab.id === excludeTabId) return;
      
      // Add current tab with indentation indicator
      const indent = "  ".repeat(depth); // 2 spaces per level
      result.push({
        id: tab.id,
        name: depth > 0 ? `${indent}└─ ${tab.name}` : tab.name,
        depth,
      });
      
      // Recursively add children
      if (tab.children && tab.children.length > 0) {
        result.push(...flattenTabsWithDepth(tab.children, depth + 1, excludeTabId));
      }
    });
    
    return result;
  };

  const flatParents = flattenTabsWithDepth(availableParents, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validation
    const trimmedName = tabName.trim();
    if (!trimmedName) {
      setFormError("Tab name is required");
      return;
    }

    if (trimmedName.length > 100) {
      setFormError("Tab name must be 100 characters or less");
      return;
    }

    if (isSubTab && !selectedParentId && !isWorkflowPage) {
      setFormError("Please select a parent tab for the sub-tab");
      return;
    }

    if (isWorkflowPage && isSubTab) {
      setFormError("Workflow pages must be top-level tabs");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isWorkflowPage) {
        const result = await createWorkflowPage({
          projectId,
          title: trimmedName,
          isWorkspaceLevel: false,
        });

        if ("error" in result) {
          setFormError(result.error);
          setIsSubmitting(false);
          return;
        }

        onClose();
        router.push(`/dashboard/projects/${projectId}/tabs/${result.data.tabId}`);
      } else {
        const result = await createTab({
          projectId,
          name: trimmedName,
          parentTabId: isSubTab ? selectedParentId : null,
        });

        if (result.error) {
          setFormError(result.error);
          setIsSubmitting(false);
          return;
        }

        onClose();
        if (result.data?.id) {
          router.push(`/dashboard/projects/${projectId}/tabs/${result.data.id}`);
        }
      }
      
      // Call success callback after navigation (for any cleanup/updates)
      onSuccess?.();
    } catch (error: any) {
      setFormError(error.message || "Failed to create tab");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setFormError("");
    }
  };

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-3"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[340px] rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Create Tab
          </h2>
          <button
            onClick={handleClose}
            className="rounded-[2px] p-1 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            disabled={isSubmitting}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
          {formError && (
            <div className="rounded-[2px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2">
              <p className="text-xs text-[var(--error)]">{formError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="tab-name" className="block text-xs font-medium text-[var(--foreground)]">
              Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="tab-name"
              type="text"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="Enter tab name"
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--primary)] focus:outline-none transition-colors"
              disabled={isSubmitting}
              autoFocus
              maxLength={100}
            />
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={isWorkflowPage}
                onChange={(e) => {
                  setIsWorkflowPage(e.target.checked);
                  if (e.target.checked) {
                    setIsSubTab(false);
                    setSelectedParentId(null);
                  }
                }}
                className="h-3.5 w-3.5 rounded-[2px] border-[var(--border)] text-[var(--foreground)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                disabled={isSubmitting}
              />
              Workflow page (AI + blocks)
            </label>
          </div>

          {!isWorkflowPage && (
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={isSubTab}
                  onChange={(e) => {
                    setIsSubTab(e.target.checked);
                    if (!e.target.checked) setSelectedParentId(null);
                  }}
                  className="h-3.5 w-3.5 rounded-[2px] border-[var(--border)] text-[var(--foreground)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                  disabled={isSubmitting}
                />
                Create as sub-tab
              </label>
            </div>
          )}

          {isSubTab && !isWorkflowPage && (
            <div className="space-y-1.5">
              <label htmlFor="parent-tab" className="block text-xs font-medium text-[var(--foreground)]">
                Parent Tab <span className="text-[var(--error)]">*</span>
              </label>
              {isLoadingParents ? (
                <div className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2">
                  <p className="text-xs text-[var(--muted-foreground)]">Loading…</p>
                </div>
              ) : flatParents.length === 0 ? (
                <div className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2">
                  <p className="text-xs text-[var(--muted-foreground)]">No tabs available.</p>
                </div>
              ) : (
                <select
                  id="parent-tab"
                  value={selectedParentId || ""}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                  disabled={isSubmitting}
                  required={isSubTab}
                >
                  <option value="">Select parent</option>
                  {flatParents.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-[2px] bg-[#3080a6]/50 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#3080a6]/65 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : isWorkflowPage ? "Create" : "Create Tab"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}

