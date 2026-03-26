"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTeam } from "@/app/actions/workspace-teams";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Member {
  id: string;
  email: string;
  name: string | null;
}

interface CreateTeamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  members: Member[];
  onTeamCreated: () => void;
}

export default function CreateTeamDialog({
  isOpen,
  onClose,
  workspaceId,
  members,
  onTeamCreated,
}: CreateTeamDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    startTransition(async () => {
      const result = await createTeam(workspaceId, name.trim(), Array.from(selectedIds));
      if ("error" in result) {
        setError(result.error);
      } else {
        setName("");
        setSelectedIds(new Set());
        onTeamCreated();
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Create Team</h2>
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col min-h-0">
          <div>
            <label htmlFor="team-name" className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Team name
            </label>
            <input
              id="team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Engineering, Design"
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--tertiary-foreground)] focus:outline-none focus:border-[var(--secondary)] transition-colors"
              autoFocus
              disabled={isPending}
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Members (workspace)
            </label>
            <div className="border border-[var(--border)] rounded-[2px] overflow-y-auto max-h-48 p-2 space-y-1">
              {members.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] py-2">No workspace members yet.</p>
              ) : (
                members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-[var(--surface-hover)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-sm truncate">
                      {m.name || m.email.split("@")[0]}
                      {m.name && <span className="text-[var(--muted-foreground)]"> ({m.email})</span>}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
