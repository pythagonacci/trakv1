"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, File, Folder, Download } from "lucide-react";
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

interface InternalGridProps {
  spaces: Space[];
  files: File[];
  workspaceId: string;
}

interface FormData {
  name: string;
  status: "not_started" | "in_progress" | "complete";
}

export default function InternalGrid({ spaces: initialSpaces, files: initialFiles, workspaceId }: InternalGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
    const result = await createProject(workspaceId, {
      name: formData.name,
      status: formData.status,
      project_type: "internal",
    });

    if (result.error) {
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
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

  const handleSpaceClick = (spaceId: string) => {
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

  // Combine spaces and files
  const allItems = [
    ...spaces.map(s => ({ type: 'space' as const, data: s, created_at: s.created_at })),
    ...files.map(f => ({ type: 'file' as const, data: f, created_at: f.created_at }))
  ];

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

      {allItems.length === 0 ? (
        <EmptyState onCreateClick={handleOpenCreate} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(space); }}>
                              <Edit className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
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
            } else {
              const file = item.data as File;

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
          })}
        </div>
      )}

      {renderDialogs()}
    </>
  );
}

