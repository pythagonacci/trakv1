"use client";

import { useState } from "react";
import { X, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateMemberRole, removeMember } from "@/app/actions/workspace";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "teammate";
}

interface EditMemberDialogProps {
  workspaceId: string;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditMemberDialog({
  workspaceId,
  member,
  isOpen,
  onClose,
}: EditMemberDialogProps) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const hasRoleChanged = role !== member.role;

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasRoleChanged) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateMemberRole(workspaceId, member.id, role);

      if ("error" in result) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      // Success - refresh page and close dialog
      router.refresh();
      onClose();
    } catch (err) {
      setError("Failed to update member role. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await removeMember(workspaceId, member.id);

      if ("error" in result) {
        setError(result.error);
        setIsSubmitting(false);
        setShowRemoveConfirm(false);
        return;
      }

      // Success - refresh page and close dialog
      router.refresh();
      onClose();
    } catch (err) {
      setError("Failed to remove member. Please try again.");
      setIsSubmitting(false);
      setShowRemoveConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold">
            {showRemoveConfirm ? "Remove Member" : "Edit Member"}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {showRemoveConfirm ? (
            /* Remove Confirmation */
            <div className="space-y-4">
              <div className="rounded-md bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">
                  Are you sure you want to remove{" "}
                  <strong>{member.name || member.email}</strong> from this
                  workspace? They will lose access to all projects and data.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveMember}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Removing..." : "Remove Member"}
                </button>
              </div>
            </div>
          ) : (
            /* Edit Form */
            <form onSubmit={handleUpdateRole} className="space-y-4">
              {/* Member Info */}
              <div className="rounded-md bg-[var(--background)] p-4">
                <p className="text-sm font-medium">
                  {member.name || member.email.split("@")[0]}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {member.email}
                </p>
              </div>

              {/* Role Select */}
              <div className="space-y-2">
                <label htmlFor="role" className="block text-sm font-medium">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "owner" | "admin" | "teammate")
                  }
                  className="w-full px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)]"
                  disabled={isSubmitting}
                >
                  <option value="owner">Owner - Full workspace control</option>
                  <option value="admin">Admin - Can manage members and settings</option>
                  <option value="teammate">Teammate - Can view and edit projects</option>
                </select>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove from workspace
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-md transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !hasRoleChanged}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSubmitting ? "Updating..." : "Update Role"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
