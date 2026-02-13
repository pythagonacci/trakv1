"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import { getProjectMembers, updateProjectMembers } from "@/app/actions/project-permissions";

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "teammate";
}

interface ProjectPermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  workspaceId: string;
  onSuccess?: () => void;
}

export default function ProjectPermissionsDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
  workspaceId,
  onSuccess,
}: ProjectPermissionsDialogProps) {
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [permissionMode, setPermissionMode] = useState<"all" | "specific">("all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Load workspace members and current project permissions
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError("");

      Promise.all([
        getWorkspaceMembers(workspaceId),
        getProjectMembers(projectId),
      ]).then(([membersResult, permissionsResult]) => {
        if (membersResult.data) {
          setWorkspaceMembers(membersResult.data);
        }

        if (permissionsResult.data) {
          if (permissionsResult.data.isAll) {
            setPermissionMode("all");
            setSelectedMemberIds([]);
          } else {
            setPermissionMode("specific");
            setSelectedMemberIds(permissionsResult.data.memberIds);
          }
        }

        setIsLoading(false);
      });
    }
  }, [isOpen, workspaceId, projectId]);

  const handleSave = async () => {
    setError("");
    setIsSaving(true);

    try {
      const memberIds = permissionMode === "all" ? "all" : selectedMemberIds;
      const result = await updateProjectMembers(projectId, memberIds);

      if (result.error) {
        setError(result.error);
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update permissions");
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
      setError("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D3236]/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Manage Access</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{projectName}</p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--border)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="px-6 py-5">
          {/* Error Message */}
          {error && (
            <div className="rounded-[2px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3 mb-5">
              <p className="text-sm font-medium text-[var(--error)]">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--muted-foreground)]">Loading permissions...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Who can access this project?
                </label>

                <div className="space-y-3">
                  {/* Radio: All workspace members */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="permission"
                      checked={permissionMode === "all"}
                      onChange={() => setPermissionMode("all")}
                      className="h-4 w-4"
                      disabled={isSaving}
                    />
                    <span className="text-sm text-[var(--foreground)]">
                      All workspace members{" "}
                      <span className="text-[var(--muted-foreground)]">
                        ({workspaceMembers.length} {workspaceMembers.length === 1 ? "member" : "members"})
                      </span>
                    </span>
                  </label>

                  {/* Radio: Specific members */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="permission"
                      checked={permissionMode === "specific"}
                      onChange={() => setPermissionMode("specific")}
                      className="h-4 w-4"
                      disabled={isSaving}
                    />
                    <span className="text-sm text-[var(--foreground)]">Specific members only</span>
                  </label>

                  {/* Member selector (shown when "specific" is selected) */}
                  {permissionMode === "specific" && (
                    <div className="ml-6 space-y-2 max-h-64 overflow-y-auto border border-[var(--border)] rounded-[2px] p-3">
                      {workspaceMembers.length === 0 ? (
                        <p className="text-xs text-[var(--muted-foreground)]">No members found</p>
                      ) : (
                        workspaceMembers.map((member) => (
                          <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--surface-hover)] p-2 rounded-[2px] -mx-2">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(member.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMemberIds([...selectedMemberIds, member.id]);
                                } else {
                                  setSelectedMemberIds(selectedMemberIds.filter((id) => id !== member.id));
                                }
                              }}
                              className="h-4 w-4"
                              disabled={isSaving}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-[var(--foreground)]">{member.name}</div>
                              <div className="text-xs text-[var(--muted-foreground)]">{member.email}</div>
                            </div>
                            <span className="text-xs text-[var(--tertiary-foreground)] capitalize px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-[2px]">
                              {member.role}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}

                  {permissionMode === "specific" && selectedMemberIds.length === 0 && (
                    <p className="ml-6 text-xs text-[var(--muted-foreground)]">
                      No members selected. Workspace owner will still have access.
                    </p>
                  )}

                  {permissionMode === "specific" && selectedMemberIds.length > 0 && (
                    <p className="ml-6 text-xs text-[var(--primary)]">
                      {selectedMemberIds.length} {selectedMemberIds.length === 1 ? "member" : "members"} selected (+ workspace owner)
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-[2px] p-3">
                <p className="text-xs text-[var(--muted-foreground)]">
                  <strong className="text-[var(--foreground)]">Note:</strong> The workspace owner always has access to all projects, regardless of these settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="flex gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-[2px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || isLoading}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
