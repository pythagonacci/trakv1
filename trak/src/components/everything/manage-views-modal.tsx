"use client";

import { useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";
import type { SavedEverythingView } from "@/types/everything";

interface ManageViewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  views: SavedEverythingView[];
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export function ManageViewsModal({
  isOpen,
  onClose,
  views,
  onRename,
  onDelete,
}: ManageViewsModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[var(--surface)] dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-[var(--radius-lg)] shadow-xl p-5 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Manage views
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[var(--radius-md)] hover:bg-[var(--surface-muted)] dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5 text-[var(--tertiary-foreground)]" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {views.length === 0 ? (
            <p className="text-sm text-[var(--tertiary-foreground)] dark:text-[var(--tertiary-foreground)]">
              No saved views. Save a view from the view dropdown to see it here.
            </p>
          ) : (
            <ul className="space-y-1">
              {views.map((v) => (
                <ManageViewItem
                  key={v.id}
                  view={v}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ManageViewItem({
  view,
  onRename,
  onDelete,
}: {
  view: SavedEverythingView;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(view.name);

  const handleSubmitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (trimmed && trimmed !== view.name) {
      onRename(view.id, trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-2 px-3 rounded-[var(--radius-md)] bg-[var(--background)] dark:bg-neutral-800/50">
        <form onSubmit={handleSubmitRename} className="flex-1 flex gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-1 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--surface)] dark:bg-neutral-900"
            autoFocus
          />
          <button
            type="submit"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Save
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setEditName(view.name);
            setEditing(false);
          }}
          className="text-sm text-[var(--tertiary-foreground)] hover:text-neutral-700"
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2 px-3 rounded-[var(--radius-md)] hover:bg-[var(--background)] dark:hover:bg-neutral-800/50 group">
      <span className="flex-1 truncate text-sm text-neutral-900 dark:text-neutral-100">
        {view.name}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1.5 rounded text-[var(--tertiary-foreground)] hover:text-neutral-700 hover:bg-[var(--surface-hover)] dark:hover:bg-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Rename"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(view.id)}
        className="p-1.5 rounded text-[var(--tertiary-foreground)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
