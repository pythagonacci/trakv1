"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { createClientTab } from "@/app/actions/client-tab";

interface CreateClientTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  onSuccess: () => void;
}

export default function CreateClientTabDialog({
  isOpen,
  onClose,
  clientId,
  onSuccess,
}: CreateClientTabDialogProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Tab name is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await createClientTab({
        clientId,
        name: name.trim(),
      });

      if (result.error) {
        setError(result.error);
      } else {
        setName("");
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName("");
      setError("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Create New Tab</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="tab-name" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Tab Name
            </label>
            <input
              id="tab-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tab name..."
              disabled={isSubmitting}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none disabled:opacity-50"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-[4px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 rounded-[6px]"
            >
              {isSubmitting ? "Creating..." : "Create Tab"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}