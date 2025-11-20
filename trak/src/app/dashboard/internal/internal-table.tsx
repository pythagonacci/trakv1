"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown, File, Download } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import { getFileUrl, deleteFile } from "@/app/actions/file";
import InternalDialog from "./internal-dialog";
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
  currentSort: {
    sort_by: string;
    sort_order: "asc" | "desc";
  };
}

interface FormData {
  name: string;
  status: "not_started" | "in_progress" | "complete";
}

export default function InternalTable({ spaces: initialSpaces, files: initialFiles, workspaceId, currentSort }: InternalTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [spaces, setSpaces] = useState(initialSpaces);
  const [files, setFiles] = useState(initialFiles);
  useEffect(() => {
    setSpaces(initialSpaces);
    setFiles(initialFiles);
  }, [initialSpaces, initialFiles]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [deletingFile, setDeletingFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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

    if (result.error) {
      setSpaces(previousSpaces);
      setToast({ message: result.error, type: "error" });
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
    };

    setSpaces([optimisticSpace, ...spaces]);

    const result = await createProject(workspaceId, {
      name: formData.name,
      status: formData.status,
      project_type: 'internal',
    });

    if (result.error) {
      setSpaces(spaces);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
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

    if (result.error) {
      setSpaces(previousSpaces);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
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
    if (result.data?.url) {
      window.open(result.data.url, '_blank');
    } else {
      setToast({ message: result.error || 'Failed to get download URL', type: "error" });
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

    if (result.error) {
      setFiles(previousFiles);
      setToast({ message: result.error, type: "error" });
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

  // Combine and sort spaces and files
  const allItems = [
    ...spaces.map(s => ({ type: 'space' as const, data: s, created_at: s.created_at })),
    ...files.map(f => ({ type: 'file' as const, data: f, created_at: f.created_at }))
  ].sort((a, b) => {
    const aDate = new Date(a.created_at).getTime();
    const bDate = new Date(b.created_at).getTime();
    return currentSort.sort_order === 'asc' ? aDate - bDate : bDate - aDate;
  });

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
          {allItems.map((item) => {
            const createdDate = new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            if (item.type === 'space') {
              const space = item.data as Space;
              const isTemp = space.id.startsWith("temp-");
              
              return (
                <TableRow
                  key={`space-${space.id}`}
                  className={cn("cursor-pointer", isTemp && "opacity-70")}
                  onClick={() => handleRowClick(space.id)}
                >
                  <TableCell>
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleOpenEdit(space)}>
                            <Edit className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDeleteConfirm(space)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            } else {
              const file = item.data as File;
              
              return (
                <TableRow
                  key={`file-${file.id}`}
                  className="cursor-pointer"
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
            }
          })}
        </TableBody>
      </Table>

      {renderDialogs()}
    </>
  );
}




