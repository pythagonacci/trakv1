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

  // Flatten hierarchical tabs for dropdown (only top-level for now)
  const flatParents = availableParents.map((tab) => ({
    id: tab.id,
    name: tab.name,
  }));

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
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Dialog Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
            Create New Tab
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>

        {/* Dialog Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            </div>
          )}

          {/* Tab Name */}
          <div>
            <label
              htmlFor="tab-name"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
            >
              Tab Name <span className="text-red-500">*</span>
            </label>
            <input
              id="tab-name"
              type="text"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="Enter tab name"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              disabled={isSubmitting}
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Create as Sub-tab Toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSubTab}
                onChange={(e) => {
                  setIsSubTab(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedParentId(null);
                  }
                }}
                className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
                disabled={isSubmitting}
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Create as sub-tab
              </span>
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1 ml-6">
              Organize this tab under another existing tab
            </p>
          </div>

          {/* Parent Tab Selector (shown when sub-tab is checked) */}
          {isSubTab && (
            <div>
              <label
                htmlFor="parent-tab"
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
              >
                Parent Tab <span className="text-red-500">*</span>
              </label>
              {isLoadingParents ? (
                <div className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Loading tabs...
                  </p>
                </div>
              ) : flatParents.length === 0 ? (
                <div className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    No tabs available. Create a top-level tab first.
                  </p>
                </div>
              ) : (
                <select
                  id="parent-tab"
                  value={selectedParentId || ""}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white focus:border-transparent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
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
              className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

