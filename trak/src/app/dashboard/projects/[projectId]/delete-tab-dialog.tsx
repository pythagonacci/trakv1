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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D3236]/40 p-4">
      <div className="w-full max-w-md rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[2px] bg-[var(--error)]/10 text-[var(--error)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] font-[var(--font-serif)]">
              Delete Tab
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-[2px] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            disabled={isDeleting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-[2px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
              <p className="text-sm text-[var(--error)]">{error}</p>
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
            className="flex-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 rounded-[2px] bg-[var(--error)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A54F4F] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Tab"}
          </button>
        </div>
      </div>
    </div>
  );
}

