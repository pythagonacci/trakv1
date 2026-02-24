"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, File, Folder, Download, ChevronDown, ChevronRight } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import { getFileUrl, deleteFile } from "@/app/actions/file";
import { moveSpaceToGroup, deleteInternalGroup } from "@/app/actions/internal-group";
import type { InternalSpaceGroup } from "@/app/actions/internal-group";
import InternalDialog from "./internal-dialog";
import CreateInternalGroupDialog from "./create-internal-group-dialog";
import ConfirmDialog from "../projects/confirm-dialog";
import Toast from "../projects/toast";
import EmptyState from "./internal-empty-state";
import StatusBadge from "../projects/status-badge";
import QuickUpload from "./quick-upload";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Space {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  created_at: string;
  internal_group_id?: string | null;
}

interface File {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface InternalGridProps {
  spaces: Space[];
  files: File[];
  workspaceId: string;
  groups: InternalSpaceGroup[];
}

interface FormData {
  name: string;
  status: "not_started" | "in_progress" | "complete";
}

export default function InternalGrid({ spaces: initialSpaces, files: initialFiles, workspaceId, groups: initialGroups }: InternalGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [spaces, setSpaces] = useState(initialSpaces);
  const [files, setFiles] = useState(initialFiles);
  const [localGroups, setLocalGroups] = useState(initialGroups);
  useEffect(() => {
    setSpaces(initialSpaces);
    setFiles(initialFiles);
  }, [initialSpaces, initialFiles]);
  useEffect(() => {
    setLocalGroups(initialGroups);
  }, [initialGroups]);

  const spacesByGroup = useMemo(() => {
    const out: Record<string, Space[]> = {};
    spaces.forEach((s) => {
      const key = s.internal_group_id ?? "ungrouped";
      if (!out[key]) out[key] = [];
      out[key].push(s);
    });
    return out;
  }, [spaces]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>(["ungrouped"]);
    initialGroups.forEach((g) => initial.add(g.id));
    return initial;
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleDeleteGroup = async (groupId: string) => {
    const result = await deleteInternalGroup(groupId);
    if ("error" in result) setToast({ message: result.error ?? "Failed to delete group", type: "error" });
    else {
      setLocalGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSpaces((prev) => prev.map((s) => (s.internal_group_id === groupId ? { ...s, internal_group_id: null } : s)));
      setToast({ message: "Group deleted", type: "success" });
      startTransition(() => router.refresh());
    }
    setOpenMenuId(null);
  };
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [deletingFile, setDeletingFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleMoveToGroup = async (space: Space, groupId: string | null) => {
    const result = await moveSpaceToGroup(space.id, groupId);
    if ("error" in result) setToast({ message: result.error ?? "Failed to move space", type: "error" });
    else {
      setSpaces((prev) => prev.map((s) => (s.id === space.id ? { ...s, internal_group_id: groupId } : s)));
      setToast({ message: groupId ? "Space moved to group" : "Space removed from group", type: "success" });
      startTransition(() => router.refresh());
    }
    setOpenMenuId(null);
  };

  const handleOpenCreate = () => {
    setDialogMode("create");
    setEditingSpace(null);
  };

  const handleOpenEdit = (space: Space) => {
    setDialogMode("edit");
    setEditingSpace(space);
    setOpenMenuId(null);
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setEditingSpace(null);
  };

  const handleOpenDeleteConfirm = (space: Space) => {
    setDeletingSpace(space);
    setDeleteConfirmOpen(true);
    setOpenMenuId(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingSpace(null);
    setDeletingFile(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSpace) return;

    setIsDeleting(true);
    const previousSpaces = [...spaces];
    setSpaces((prev) => prev.filter((p) => p.id !== deletingSpace.id));
    const result = await deleteProject(deletingSpace.id);

    if ("error" in result) {
      setSpaces(previousSpaces);
      setToast({ message: result.error ?? "Failed to delete space", type: "error" });
    } else {
      setToast({ message: "Space deleted successfully", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  const handleCreateSubmit = async (formData: FormData) => {
    const result = await createProject(workspaceId, {
      name: formData.name,
      status: formData.status,
      project_type: "internal",
    });

    if ("error" in result) {
      const errMsg = result.error ?? "Failed to create space";
      setToast({ message: errMsg, type: "error" });
      throw new Error(errMsg);
    } else {
      setToast({ message: "Space created", type: "success" });
      handleCloseDialog();
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleEditSubmit = async (formData: FormData) => {
    if (!editingSpace) return;

    const previousSpaces = [...spaces];
    setSpaces((prev) =>
      prev.map((p) => (p.id === editingSpace.id ? { ...p, name: formData.name, status: formData.status } : p))
    );

    const result = await updateProject(editingSpace.id, {
      name: formData.name,
      status: formData.status,
    });

    if ("error" in result) {
      const errMsg = result.error ?? "Failed to update space";
      setSpaces(previousSpaces);
      setToast({ message: errMsg, type: "error" });
      throw new Error(errMsg);
    } else {
      setToast({ message: "Space updated", type: "success" });
      handleCloseDialog();
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleDialogSubmit = async (formData: FormData) => {
    if (dialogMode === "create") {
      await handleCreateSubmit(formData);
    } else if (dialogMode === "edit") {
      await handleEditSubmit(formData);
    }
  };

  const handleSpaceClick = (spaceId: string) => {
    if (!spaceId.startsWith("temp-")) {
      router.push(`/dashboard/internal/${spaceId}`);
    }
  };

  const handleFileDownload = async (file: File) => {
    const result = await getFileUrl(file.id);
    if ("data" in result && result.data?.url) {
      window.open(result.data.url, '_blank');
    } else {
      setToast({ message: ("error" in result ? result.error : null) || 'Failed to get download URL', type: "error" });
    }
  };

  const handleFileDelete = (file: File) => {
    setDeletingFile(file);
    setDeleteConfirmOpen(true);
    setOpenMenuId(null);
  };

  const handleConfirmFileDelete = async () => {
    if (!deletingFile) return;

    setIsDeleting(true);
    const previousFiles = [...files];
    setFiles((prev) => prev.filter((f) => f.id !== deletingFile.id));
    
    const result = await deleteFile(deletingFile.id);

    if ("error" in result) {
      setFiles(previousFiles);
      setToast({ message: result.error ?? "Failed to delete file", type: "error" });
    } else {
      setToast({ message: "File deleted successfully", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsDeleting(false);
    setDeleteConfirmOpen(false);
    setDeletingFile(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  function renderSpaceCard(space: Space) {
    const isTemp = space.id.startsWith("temp-");
    const createdDate = new Date(space.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return (
      <div
        key={`space-${space.id}`}
        onClick={() => handleSpaceClick(space.id)}
        className={cn(
          "group relative flex h-full cursor-pointer flex-col rounded-[4px] border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 hover:border-[var(--border-strong)]",
          isTemp && "pointer-events-none opacity-70"
        )}
      >
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {space.name}
                </h3>
              </div>
            </div>

            {!isTemp && (
              <DropdownMenu
                open={openMenuId === `space-${space.id}`}
                onOpenChange={(open) => setOpenMenuId(open ? `space-${space.id}` : null)}
              >
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="rounded-[2px] p-1 opacity-0 transition-opacity hover:bg-[var(--surface-hover)] group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(space); }}>
                    <Edit className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  {localGroups.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Move to Group</div>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToGroup(space, null); }}>No group</DropdownMenuItem>
                      {localGroups.map((g) => (
                        <DropdownMenuItem key={g.id} onClick={(e) => { e.stopPropagation(); handleMoveToGroup(space, g.id); }}>{g.name}</DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(space); }}
                    className="text-[var(--error)] focus:bg-[var(--error)]/10 focus:text-[var(--error)]"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="mb-3">
            <StatusBadge status={space.status} />
          </div>

          <div className="text-xs text-[var(--muted-foreground)]">
            Created {createdDate}
          </div>
        </div>
      </div>
    );
  }

  function renderFileCard(file: File) {
    const createdDate = new Date(file.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return (
      <div
        key={`file-${file.id}`}
        className="group relative flex h-full cursor-pointer flex-col rounded-[4px] border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 hover:border-[var(--border-strong)]"
      >
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <File className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {file.file_name}
                </h3>
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {formatFileSize(file.file_size)}
              </div>
            </div>

            <DropdownMenu
              open={openMenuId === `file-${file.id}`}
              onOpenChange={(open) => setOpenMenuId(open ? `file-${file.id}` : null)}
            >
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="rounded-[2px] p-1 opacity-0 transition-opacity hover:bg-[var(--surface-hover)] group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleFileDownload(file); }}>
                  <Download className="h-4 w-4" /> Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleFileDelete(file); }}
                  className="text-[var(--error)] focus:bg-[var(--error)]/10 focus:text-[var(--error)]"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-xs text-[var(--muted-foreground)]">
            Created {createdDate}
          </div>
        </div>
      </div>
    );
  }

  if (spaces.length === 0 && files.length === 0 && dialogMode === null) {
    return (
      <>
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Internal</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Company knowledge, SOPs, guidelines, and templates.</p>
          </div>
          <div className="flex items-center gap-2">
            <QuickUpload workspaceId={workspaceId} />
            <Button variant="outline" size="sm" onClick={() => setCreateGroupDialogOpen(true)}>New group</Button>
            <Button onClick={handleOpenCreate} size="sm">New space</Button>
          </div>
        </div>
        <EmptyState onCreateClick={handleOpenCreate} />
        {renderDialogs()}
      </>
    );
  }

  function renderDialogs() {
    return (
      <>
        <CreateInternalGroupDialog
          isOpen={createGroupDialogOpen}
          onClose={() => setCreateGroupDialogOpen(false)}
          workspaceId={workspaceId}
          onGroupCreated={() => startTransition(() => router.refresh())}
        />
        <InternalDialog
          mode={dialogMode || "create"}
          isOpen={dialogMode !== null}
          onClose={handleCloseDialog}
          onSubmit={handleDialogSubmit}
          initialData={editingSpace || undefined}
        />

        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => {
            handleCloseDeleteConfirm();
            setDeletingFile(null);
          }}
          onConfirm={deletingFile ? handleConfirmFileDelete : handleConfirmDelete}
          title={deletingFile ? "Delete File" : "Delete Space"}
          message={deletingFile 
            ? `Are you sure you want to delete "${deletingFile.file_name}"? This action cannot be undone.`
            : `Are you sure you want to delete "${deletingSpace?.name}"? This action cannot be undone.`}
          confirmText={deletingFile ? "Delete File" : "Delete Space"}
          confirmButtonVariant="danger"
          isLoading={isDeleting}
        />

        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Internal</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Company knowledge, SOPs, guidelines, and templates.</p>
        </div>
        <div className="flex items-center gap-2">
          <QuickUpload workspaceId={workspaceId} />
          <Button variant="outline" size="sm" onClick={() => setCreateGroupDialogOpen(true)}>New group</Button>
          <Button onClick={handleOpenCreate} size="sm">New space</Button>
        </div>
      </div>

      {spaces.length === 0 && files.length === 0 ? (
        <EmptyState onCreateClick={handleOpenCreate} />
      ) : (
        <div className="space-y-8">
          {localGroups.map((group) => {
            const groupSpaces = spacesByGroup[group.id] || [];
            const isExpanded = expandedGroups.has(group.id);
            return (
              <section key={group.id}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-2 min-w-0 rounded-[4px] py-1.5 px-2 -ml-2 hover:bg-[var(--surface-hover)] transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                    )}
                    <Folder className="h-4 w-4 text-[var(--secondary)] flex-shrink-0" />
                    <span className="text-sm font-semibold text-[var(--foreground)] truncate">{group.name}</span>
                    <span className="text-xs text-[var(--tertiary-foreground)] flex-shrink-0">({groupSpaces.length})</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] flex-shrink-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete group "${group.name}"? Spaces will be moved out of the group.`)) handleDeleteGroup(group.id);
                        }}
                        className="text-[var(--error)] focus:bg-[var(--error)]/10 focus:text-[var(--error)]"
                      >
                        <Trash2 className="h-4 w-4" /> Delete group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {isExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupSpaces.map((space) => renderSpaceCard(space))}
                  </div>
                )}
              </section>
            );
          })}

          {(spacesByGroup.ungrouped?.length ?? 0) > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => toggleGroup("ungrouped")}
                  className="flex items-center gap-2 min-w-0 rounded-[4px] py-1.5 px-2 -ml-2 hover:bg-[var(--surface-hover)] transition-colors text-left"
                >
                  {expandedGroups.has("ungrouped") ? (
                    <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-[var(--foreground)]">No group</span>
                  <span className="text-xs text-[var(--tertiary-foreground)]">({spacesByGroup.ungrouped!.length})</span>
                </button>
              </div>
              {expandedGroups.has("ungrouped") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {spacesByGroup.ungrouped!.map((space) => renderSpaceCard(space))}
                </div>
              )}
            </section>
          )}

          {files.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-[var(--foreground)]">Files</span>
                <span className="text-xs text-[var(--tertiary-foreground)]">({files.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {files.map((file) => renderFileCard(file))}
              </div>
            </section>
          )}
        </div>
      )}

      {renderDialogs()}
    </>
  );
}

