"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createTab, getProjectTabs, type TabWithChildren } from "@/app/actions/tab";

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
  const [tabName, setTabName] = useState("");
  const [isSubTab, setIsSubTab] = useState(initialParentTabId !== undefined);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    initialParentTabId || null
  );
  const [availableParents, setAvailableParents] = useState<TabWithChildren[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (isSubTab && !selectedParentId) {
      setFormError("Please select a parent tab for the sub-tab");
      return;
    }

    setIsSubmitting(true);

    try {
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

      // Success: close dialog and call success callback
      onSuccess?.();
      onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-popover max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Create New Tab
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dialog Body */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {/* Error Message */}
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}

          {/* Tab Name */}
          <div className="space-y-2">
            <label htmlFor="tab-name" className="block text-sm font-medium text-[var(--foreground)]">
              Tab Name <span className="text-red-500">*</span>
            </label>
            <input
              id="tab-name"
              type="text"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="Enter tab name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:border-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              disabled={isSubmitting}
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Create as Sub-tab Toggle */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={isSubTab}
                onChange={(e) => {
                  setIsSubTab(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedParentId(null);
                  }
                }}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                disabled={isSubmitting}
              />
              Create as sub-tab
            </label>
            <p className="ml-6 mt-1 text-xs text-[var(--tertiary-foreground)]">
              Organize this tab under another existing tab
            </p>
          </div>

          {/* Parent Tab Selector (shown when sub-tab is checked) */}
          {isSubTab && (
            <div className="space-y-2">
              <label htmlFor="parent-tab" className="block text-sm font-medium text-[var(--foreground)]">
                Parent Tab <span className="text-red-500">*</span>
              </label>
              {isLoadingParents ? (
                <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2">
                  <p className="text-sm text-[var(--muted-foreground)]">Loading tabs...</p>
                </div>
              ) : flatParents.length === 0 ? (
                <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2">
                  <p className="text-sm text-[var(--muted-foreground)]">No tabs available. Create a top-level tab first.</p>
                </div>
              ) : (
                <select
                  id="parent-tab"
                  value={selectedParentId || ""}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                  disabled={isSubmitting}
                  required={isSubTab}
                >
                  <option value="">Select a parent tab</option>
                  {flatParents.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-all duration-150 hover:bg-surface-hover"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-all duration-150 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Tab"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

