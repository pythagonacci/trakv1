"use client";

import { useState, useTransition } from "react";
import { createFolder } from "@/app/actions/folder";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onFolderCreated: () => void;
}

export default function CreateFolderDialog({
  isOpen,
  onClose,
  workspaceId,
  onFolderCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    startTransition(async () => {
      const result = await createFolder(workspaceId, name.trim());
      if (result.error) {
        setError(result.error);
      } else {
        setName("");
        onFolderCreated();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Create Folder</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="folder-name" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Folder Name
            </label>
            <input
              id="folder-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2024, Client Projects, Internal"
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:border-[var(--secondary)] transition-colors"
              autoFocus
              disabled={isPending}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
            >
              {isPending ? "Creating..." : "Create Folder"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
