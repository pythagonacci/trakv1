"use client";

import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { deleteTab } from "@/app/actions/tab";

interface DeleteTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tab: { id: string; name: string } | null;
  onSuccess?: () => void;
}

export default function DeleteTabDialog({
  isOpen,
  onClose,
  tab,
  onSuccess,
}: DeleteTabDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (!tab) return;

    setIsDeleting(true);
    setError("");

    try {
      const result = await deleteTab(tab.id);

      if (result.error) {
        setError(result.error);
        setIsDeleting(false);
        return;
      }

      // Success: close dialog and call success callback
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete tab");
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
      setError("");
    }
  };

  if (!isOpen || !tab) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full">
        {/* Dialog Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Delete Tab
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            disabled={isDeleting}
          >
            <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Warning Message */}
          <div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
              Are you sure you want to delete the tab{" "}
              <span className="font-semibold">&quot;{tab.name}&quot;</span>?
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              This will permanently delete the tab and all its sub-tabs and content. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Tab"}
          </button>
        </div>
      </div>
    </div>
  );
}

