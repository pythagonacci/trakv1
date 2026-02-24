"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown, File, Download, Folder, ChevronDown, ChevronRight } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface InternalTableProps {
  spaces: Space[];
  files: File[];
  workspaceId: string;
  groups: InternalSpaceGroup[];
  currentSort: {
    sort_by: string;
    sort_order: "asc" | "desc";
  };
}

interface FormData {
  name: string;
  status: "not_started" | "in_progress" | "complete";
}

export default function InternalTable({ spaces: initialSpaces, files: initialFiles, workspaceId, groups: initialGroups, currentSort }: InternalTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [spaces, setSpaces] = useState(initialSpaces);
  const [files, setFiles] = useState(initialFiles);
  const [groups, setGroups] = useState(initialGroups);
  useEffect(() => {
    setSpaces(initialSpaces);
    setFiles(initialFiles);
  }, [initialSpaces, initialFiles]);
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [deletingFile, setDeletingFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

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

  const handleDeleteGroup = async (groupId: string) => {
    const result = await deleteInternalGroup(groupId);
    if ("error" in result) setToast({ message: result.error ?? "Failed to delete group", type: "error" });
    else {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSpaces((prev) => prev.map((s) => (s.internal_group_id === groupId ? { ...s, internal_group_id: null } : s)));
      setToast({ message: "Group deleted", type: "success" });
      startTransition(() => router.refresh());
    }
  };

  const spacesByGroup = useMemo(() => {
    const out: Record<string, Space[]> = {};
    spaces.forEach((s) => {
      const key = s.internal_group_id ?? "ungrouped";
      if (!out[key]) out[key] = [];
      out[key].push(s);
    });
    return out;
  }, [spaces]);

  const handleSort = (column: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (currentSort.sort_by === column) {
      const newOrder = currentSort.sort_order === "asc" ? "desc" : "asc";
      params.set("sort_order", newOrder);
    } else {
      params.set("sort_by", column);
      params.set("sort_order", "desc");
    }
    router.push(`/dashboard/internal?${params.toString()}`);
  };

  const getSortIndicator = (column: string) => {
    if (currentSort.sort_by !== column) return null;
    return currentSort.sort_order === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
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
    const tempId = `temp-${Date.now()}`;
    const optimisticSpace: Space = {
      id: tempId,
      name: formData.name,
      status: formData.status,
      created_at: new Date().toISOString(),
      internal_group_id: null,
    };

    setSpaces([optimisticSpace, ...spaces]);

    const result = await createProject(workspaceId, {
      name: formData.name,
      status: formData.status,
      project_type: 'internal',
    });

    if ("error" in result) {
      const errMsg = result.error ?? "Failed to create space";
      setSpaces(spaces);
      setToast({ message: errMsg, type: "error" });
      throw new Error(errMsg);
    } else {
      setSpaces((prev) =>
        prev.map((p) => (p.id === tempId ? { ...result.data, status: result.data.status as "not_started" | "in_progress" | "complete" } : p))
      );
      setToast({ message: "Space created", type: "success" });
      handleCloseDialog();
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleEditSubmit = async (formData: FormData) => {
    if (!editingSpace) return;

    const updates = {
      name: formData.name,
      status: formData.status,
    };

    const previousSpaces = [...spaces];
    setSpaces((prev) =>
      prev.map((p) => (p.id === editingSpace.id ? { ...p, ...updates } : p))
    );

    const result = await updateProject(editingSpace.id, updates);

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

  const handleRowClick = (spaceId: string) => {
    if (!spaceId.startsWith("temp-")) {
      router.push(`/dashboard/internal/${spaceId}`);
    }
  };

  const handleFileDownload = async (file: File) => {
    const result = await getFileUrl(file.id);
    if ("data" in result && result.data?.url) {
      window.open(result.data.url, '_blank');
    } else {
      setToast({ message: ("error" in result ? result.error : null) ?? 'Failed to get download URL', type: "error" });
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

  function renderSpaceRow(space: Space, extraCellClass?: string) {
    const isTemp = space.id.startsWith("temp-");
    const createdDate = new Date(space.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return (
      <TableRow
        key={`space-${space.id}`}
        className={cn("cursor-pointer transition-colors duration-150 hover:bg-[var(--primary)]/10", isTemp && "opacity-70")}
        onClick={() => handleRowClick(space.id)}
      >
        <TableCell className={extraCellClass}>
          <span className="text-sm font-medium text-[var(--foreground)]">{space.name}</span>
        </TableCell>
        <TableCell>
          <StatusBadge status={space.status} />
        </TableCell>
        <TableCell>
          <span className="text-sm text-[var(--muted-foreground)]">{createdDate}</span>
        </TableCell>
        <TableCell className="text-right">
          {!isTemp && (
            <DropdownMenu open={openMenuId === space.id} onOpenChange={(open) => setOpenMenuId(open ? space.id : null)}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleOpenEdit(space)}>
                  <Edit className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                {groups.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Move to Group</div>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToGroup(space, null); }}>No group</DropdownMenuItem>
                    {groups.map((g) => (
                      <DropdownMenuItem key={g.id} onClick={(e) => { e.stopPropagation(); handleMoveToGroup(space, g.id); }}>{g.name}</DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleOpenDeleteConfirm(space)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                onClick={() => handleSort("name")}
              >
                Name {getSortIndicator("name")}
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                onClick={() => handleSort("status")}
              >
                Status {getSortIndicator("status")}
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                onClick={() => handleSort("created_at")}
              >
                Created {getSortIndicator("created_at")}
              </button>
            </TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const groupSpaces = spacesByGroup[group.id] || [];
            const isExpanded = expandedGroups.has(group.id);
            return (
              <React.Fragment key={group.id}>
                <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                  <TableCell colSpan={4} className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleGroup(group.id); }}
                          className="p-0.5 hover:bg-[var(--surface-hover)] rounded transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" /> : <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />}
                        </button>
                        <Folder className="h-4 w-4 text-[var(--secondary)]" />
                        <span className="text-sm font-semibold text-[var(--foreground)]">{group.name}</span>
                        <span className="text-xs text-[var(--tertiary-foreground)]">({groupSpaces.length})</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete group "${group.name}"? Spaces will be moved out of the group.`)) handleDeleteGroup(group.id);
                            }}
                            className="text-red-500 focus:bg-red-50 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" /> Delete group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && groupSpaces.map((space) => renderSpaceRow(space, "pl-8"))}
              </React.Fragment>
            );
          })}
          {spacesByGroup.ungrouped && spacesByGroup.ungrouped.length > 0 && (
            <>
              {groups.length > 0 && (
                <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                  <TableCell colSpan={4} className="py-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">No group</span>
                    <span className="text-xs text-[var(--tertiary-foreground)] ml-2">({spacesByGroup.ungrouped.length})</span>
                  </TableCell>
                </TableRow>
              )}
              {spacesByGroup.ungrouped.map((space) => renderSpaceRow(space, groups.length > 0 ? "pl-8" : undefined))}
            </>
          )}
          {files.map((file) => {
            const createdDate = new Date(file.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              
              return (
                <TableRow
                  key={`file-${file.id}`}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[var(--primary)]/10"
                  onClick={() => handleFileDownload(file)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-[var(--muted-foreground)]" />
                      <span className="text-sm font-medium text-[var(--foreground)]">{file.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-[var(--muted-foreground)]">{formatFileSize(file.file_size)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-[var(--muted-foreground)]">{createdDate}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu open={openMenuId === file.id} onOpenChange={(open) => setOpenMenuId(open ? file.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => handleFileDownload(file)}>
                          <Download className="h-4 w-4" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFileDelete(file)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
          })}
        </TableBody>
      </Table>

      {renderDialogs()}
    </>
  );
}




