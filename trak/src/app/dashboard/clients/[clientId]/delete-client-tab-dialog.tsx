"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { deleteClientTab } from "@/app/actions/client-tab";

interface ClientTab {
  id: string;
  name: string;
  position: number;
}

interface DeleteClientTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tab: ClientTab | null;
  onSuccess: () => void;
}

export default function DeleteClientTabDialog({
  isOpen,
  onClose,
  tab,
  onSuccess,
}: DeleteClientTabDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!tab) return;

    setIsDeleting(true);
    try {
      const result = await deleteClientTab(tab.id);

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        onSuccess();
        onClose();
      }
    } catch (error) {
      alert("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !tab) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Delete Tab</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Are you sure you want to delete the tab "{tab.name}"? This action cannot be undone and will permanently remove all content within this tab.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-[6px]"
          >
            {isDeleting ? "Deleting..." : "Delete Tab"}
          </button>
        </div>
      </div>
    </div>
  );
}