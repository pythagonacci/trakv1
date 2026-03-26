"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface SaveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function SaveViewModal({
  isOpen,
  onClose,
  onSave,
}: SaveViewModalProps) {
  const [name, setName] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onSave(trimmed);
      setName("");
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[var(--surface)] dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-[var(--radius-lg)] shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Save view
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[var(--radius-md)] hover:bg-[var(--surface-muted)] dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5 text-[var(--tertiary-foreground)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            View name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My high-priority tasks"
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-neutral-300 dark:border-neutral-700 bg-[var(--surface)] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-[var(--muted-foreground)] dark:text-[var(--tertiary-foreground)] hover:bg-[var(--surface-muted)] dark:hover:bg-neutral-800 rounded-[var(--radius-md)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-[var(--radius-md)]"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
