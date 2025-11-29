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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-popover">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Delete Tab
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            disabled={isDeleting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              Are you sure you want to delete the tab <span className="font-semibold text-[var(--foreground)]">&quot;{tab.name}&quot;</span>?
            </p>
            <p className="text-sm text-[var(--tertiary-foreground)]">
              This will permanently delete the tab and all its sub-tabs and content. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-[var(--border)] px-6 py-5">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-all duration-150 hover:bg-surface-hover"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Tab"}
          </button>
        </div>
      </div>
    </div>
  );
}

