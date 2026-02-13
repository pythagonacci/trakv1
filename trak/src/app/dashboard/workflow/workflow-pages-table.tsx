"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, Pencil, Check, X } from "lucide-react";
import { deleteWorkflowPage, updateWorkflowPageName, type WorkflowPageTab } from "@/app/actions/workflow-page";
import Toast from "@/app/dashboard/projects/toast";
import ConfirmDialog from "@/app/dashboard/projects/confirm-dialog";
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

interface WorkflowPagesTableProps {
  pages: WorkflowPageTab[];
}

export default function WorkflowPagesTable({ pages: initialPages }: WorkflowPagesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [pages, setPages] = useState(initialPages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPage, setDeletingPage] = useState<WorkflowPageTab | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleRowClick = (pageId: string) => {
    if (editingId !== pageId) {
      router.push(`/dashboard/workflow/${pageId}`);
    }
  };

  const handleStartEdit = (page: WorkflowPageTab, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingId(page.id);
    setEditingName(page.name);
    setOpenMenuId(null);
  };

  const handleCancelEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (pageId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!editingName.trim()) {
      setToast({ message: "Name cannot be empty", type: "error" });
      return;
    }

    const previousPages = [...pages];
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, name: editingName.trim() } : p))
    );

    const result = await updateWorkflowPageName({ tabId: pageId, name: editingName.trim() });

    if ("error" in result) {
      setPages(previousPages);
      setToast({ message: result.error, type: "error" });
    } else {
      setToast({ message: "Name updated", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setEditingId(null);
    setEditingName("");
  };

  const handleOpenDeleteConfirm = (page: WorkflowPageTab, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingPage(page);
    setDeleteConfirmOpen(true);
    setOpenMenuId(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingPage(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPage) return;

    setIsDeleting(true);
    const previousPages = [...pages];
    setPages((prev) => prev.filter((p) => p.id !== deletingPage.id));

    const result = await deleteWorkflowPage({ tabId: deletingPage.id });

    if ("error" in result) {
      setPages(previousPages);
      setToast({ message: result.error, type: "error" });
    } else {
      setToast({ message: "Workflow page deleted", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (pages.length === 0) {
    return (
      <div className="rounded-md border border-[#3080a6]/20 bg-[#3080a6]/5 p-4 text-sm text-[var(--muted-foreground)]">
        No workflow pages yet.
      </div>
    );
  }

  return (
    <>
      <Table className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:h-10 [&_td]:px-3 [&_td]:py-2.5">
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Title
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Created
            </TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow
              key={page.id}
              className="cursor-pointer"
              onClick={() => handleRowClick(page.id)}
            >
              <TableCell>
                {editingId === page.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveEdit(page.id, e as any);
                        } else if (e.key === "Escape") {
                          handleCancelEdit(e as any);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => handleSaveEdit(page.id, e)}
                      className="rounded p-1 text-green-600 hover:bg-green-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-[var(--foreground)]">{page.name}</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {formatDate(page.created_at)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu
                  open={openMenuId === page.id}
                  onOpenChange={(open) => setOpenMenuId(open ? page.id : null)}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={(e) => handleStartEdit(page, e)}>
                      <Pencil className="h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleOpenDeleteConfirm(page, e)}
                      className="text-red-500 focus:bg-red-50 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title="Delete Workflow Page"
        message={`Are you sure you want to delete "${deletingPage?.name}"? This will delete all conversation history and cannot be undone.`}
        confirmText="Delete Workflow Page"
        confirmButtonVariant="danger"
        isLoading={isDeleting}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
