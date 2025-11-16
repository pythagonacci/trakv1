"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import InternalDialog from "./internal-dialog";
import ConfirmDialog from "../projects/confirm-dialog";
import Toast from "../projects/toast";
import EmptyState from "./internal-empty-state";
import StatusBadge from "../projects/status-badge";
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

interface InternalTableProps {
  spaces: Space[];
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

export default function InternalTable({ spaces: initialSpaces, workspaceId, currentSort }: InternalTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [spaces, setSpaces] = useState(initialSpaces);
  useEffect(() => {
    setSpaces(initialSpaces);
  }, [initialSpaces]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
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

  if (spaces.length === 0 && dialogMode === null) {
    return (
      <>
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Internal</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Company knowledge, SOPs, guidelines, and templates.</p>
          </div>
          <Button onClick={handleOpenCreate} size="sm">New space</Button>
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
          onClose={handleCloseDeleteConfirm}
          onConfirm={handleConfirmDelete}
          title="Delete Space"
          message={`Are you sure you want to delete "${deletingSpace?.name}"? This action cannot be undone.`}
          confirmText="Delete Space"
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
        <Button onClick={handleOpenCreate} size="sm">New space</Button>
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
          {spaces.map((space) => {
            const isTemp = space.id.startsWith("temp-");
            const createdDate = new Date(space.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <TableRow
                key={space.id}
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
          })}
        </TableBody>
      </Table>

      {renderDialogs()}
    </>
  );
}

