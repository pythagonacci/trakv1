"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Trash2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateMemberRole, removeMember, updateMemberDisplayName } from "@/app/actions/workspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Member {
  membershipId?: string;
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
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState(member.role);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(member.name ?? "");
      setRole(member.role);
    }
  }, [isOpen, member.id, member.name, member.role]);

  const membershipId = member.membershipId ?? member.id;
  const hasNameChanged = name.trim() !== (member.name ?? "").trim();
  const hasRoleChanged = role !== member.role;
  const hasChanges = hasNameChanged || hasRoleChanged;

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      if (hasNameChanged) {
        const nameResult = await updateMemberDisplayName(workspaceId, member.id, name.trim());
        if ("error" in nameResult) {
          setError(nameResult.error || "Failed to update display name");
          setIsSubmitting(false);
          return;
        }
      }
      if (hasRoleChanged) {
        const roleResult = await updateMemberRole(workspaceId, membershipId, role);
        if ("error" in roleResult) {
          setError(roleResult.error || "Failed to update member role");
          setIsSubmitting(false);
          return;
        }
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError("Failed to update member. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await removeMember(workspaceId, membershipId);

      if ("error" in result) {
        setError(result.error || "Failed to remove member");
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full max-w-[280px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-popover p-0 gap-0"
        onPointerDownOutside={(e) => !showRemoveConfirm && onClose()}
      >
        {/* Compact header – property menu style */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-[var(--border)] px-2 py-1.5 shrink-0 space-y-0">
          <div className="space-y-0.5 pr-8">
            <DialogTitle className="text-[11px] font-semibold text-[var(--foreground)] tracking-tight">
              {showRemoveConfirm ? "Remove Member" : "Edit Member"}
            </DialogTitle>
            {!showRemoveConfirm && (
              <DialogDescription className="text-[10px] text-[var(--muted-foreground)] line-clamp-1">
                {member.email}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 px-2 py-1.5">
          {error && (
            <div className="flex items-start gap-2 rounded px-1.5 py-1.5 border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 mb-2">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-[11px] text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {showRemoveConfirm ? (
            <div className="space-y-3 pt-1">
              <p className="text-[11px] text-[var(--foreground)]">
                Remove <strong>{member.name || member.email}</strong> from this workspace? They will lose access to all projects and data.
              </p>
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isSubmitting}
                  className="h-6 gap-1 px-1.5 text-[11px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveMember}
                  disabled={isSubmitting}
                  className="h-6 gap-1 px-1.5 text-[11px]"
                >
                  {isSubmitting && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                  {isSubmitting ? "Removing…" : "Remove"}
                </Button>
              </div>
            </div>
          ) : (
            <form id="edit-member-form" onSubmit={handleUpdateMember} className="space-y-0">
              {/* Display name – property menu input style */}
              <div className="rounded px-1.5 py-1 hover:bg-[var(--surface-hover)]">
                <Label htmlFor="edit-member-display-name" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                  Display name
                </Label>
                <Input
                  id="edit-member-display-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={member.email.split("@")[0]}
                  disabled={isSubmitting}
                  className="mt-0.5 h-6 border-0 shadow-none bg-transparent text-[11px] font-medium text-[var(--foreground)] rounded px-0.5 py-0 focus-visible:ring-1 focus-visible:ring-[var(--border)]"
                />
              </div>

              {/* Role – compact select */}
              <div className="rounded px-1.5 py-1 hover:bg-[var(--surface-hover)]">
                <Label htmlFor="edit-member-role" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                  Role
                </Label>
                <select
                  id="edit-member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "owner" | "admin" | "teammate")}
                  disabled={isSubmitting}
                  className="mt-0.5 w-full h-6 border-0 bg-transparent text-[11px] font-semibold text-[var(--foreground)] rounded px-0.5 py-0 focus:ring-1 focus:ring-[var(--border)] outline-none cursor-pointer"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="teammate">Teammate</option>
                </select>
              </div>

              {/* Remove link */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded p-0.5 text-[11px] text-red-600 dark:text-red-400 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  Remove from workspace
                </button>
              </div>
            </form>
          )}
        </div>

        {!showRemoveConfirm && (
          <DialogFooter className="shrink-0 px-2 pb-2 pt-1.5 border-t border-[var(--border)] mt-0 flex-row justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-6 gap-1 px-1.5 text-[11px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-member-form"
              size="sm"
              disabled={isSubmitting || !hasChanges}
              className="h-6 gap-1 px-1.5 text-[11px]"
            >
              <Save className="h-2.5 w-2.5" />
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
