"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown, Archive, ArchiveRestore } from "lucide-react";
import { createDoc, updateDoc, deleteDoc } from "@/app/actions/doc";
import ConfirmDialog from "@/app/dashboard/projects/confirm-dialog";
import Toast from "@/app/dashboard/projects/toast";
import DocsEmptyState from "./docs-empty-state";
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

interface Doc {
  id: string;
  title: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface DocsTableProps {
  docs: Doc[];
  workspaceId: string;
  currentSort: {
    sort_by: string;
    sort_order: "asc" | "desc";
  };
}

export default function DocsTable({ docs: initialDocs, workspaceId, currentSort }: DocsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [docs, setDocs] = useState(initialDocs);
  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null);
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
    router.push(`/dashboard/docs?${params.toString()}`);
  };

  const getSortIndicator = (column: string) => {
    if (currentSort.sort_by !== column) return null;
    return currentSort.sort_order === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  const handleCreateNew = async () => {
    const tempId = `temp-${Date.now()}`;
    const optimisticDoc: Doc = {
      id: tempId,
      title: "Untitled Document",
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDocs([optimisticDoc, ...docs]);

    const result = await createDoc(workspaceId);

    if (result.error) {
      setDocs(docs);
      setToast({ message: result.error, type: "error" });
    } else if (result.data) {
      setDocs((prev) => prev.map((d) => (d.id === tempId ? result.data : d)));
      setToast({ message: "Document created", type: "success" });
      // Navigate to the new doc
      router.push(`/dashboard/docs/${result.data.id}`);
    }
  };

  const handleToggleArchive = async (doc: Doc, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const previousDocs = [...docs];
    setDocs((prev) =>
      prev.map((d) =>
        d.id === doc.id ? { ...d, is_archived: !d.is_archived } : d
      )
    );

    const result = await updateDoc(doc.id, { is_archived: !doc.is_archived });

    if (result.error) {
      setDocs(previousDocs);
      setToast({ message: result.error, type: "error" });
    } else {
      setToast({
        message: doc.is_archived ? "Document restored" : "Document archived",
        type: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    }
    setOpenMenuId(null);
  };

  const handleOpenDeleteConfirm = (doc: Doc, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setDeletingDoc(doc);
    setDeleteConfirmOpen(true);
    setOpenMenuId(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingDoc(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;

    setIsDeleting(true);
    const previousDocs = [...docs];
    setDocs((prev) => prev.filter((d) => d.id !== deletingDoc.id));
    const result = await deleteDoc(deletingDoc.id);

    if (result.error) {
      setDocs(previousDocs);
      setToast({ message: result.error, type: "error" });
    } else {
      setToast({ message: "Document deleted successfully", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  const handleRowClick = (docId: string) => {
    if (!docId.startsWith("temp-")) {
      router.push(`/dashboard/docs/${docId}`);
    }
  };

  if (docs.length === 0 && !searchParams.get("search") && !searchParams.get("is_archived")) {
    return (
      <>
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Documents</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Create and manage your documents.</p>
          </div>
          <button 
            onClick={handleCreateNew} 
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[2px] transition-colors"
          >
            New Document
          </button>
        </div>
        <DocsEmptyState onCreateClick={handleCreateNew} />
        {renderDialogs()}
      </>
    );
  }

  if (docs.length === 0) {
    return (
      <>
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Documents</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Create and manage your documents.</p>
          </div>
          <button 
            onClick={handleCreateNew} 
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[2px] transition-colors"
          >
            New Document
          </button>
        </div>
        <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
          No documents found
        </div>
        {renderDialogs()}
      </>
    );
  }

  function renderDialogs() {
    return (
      <>
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={handleCloseDeleteConfirm}
          onConfirm={handleConfirmDelete}
          title="Delete Document"
          message={`Are you sure you want to delete "${deletingDoc?.title || "Untitled Document"}"? This action cannot be undone.`}
          confirmText="Delete Document"
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
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Documents</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Create and manage your documents.</p>
        </div>
        <Button onClick={handleCreateNew} size="sm">New Document</Button>
      </div>

      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                onClick={() => handleSort("title")}
              >
                Title {getSortIndicator("title")}
              </button>
            </TableHead>
            <TableHead>
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                onClick={() => handleSort("updated_at")}
              >
                Last Updated {getSortIndicator("updated_at")}
              </button>
            </TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => {
            const isTemp = doc.id.startsWith("temp-");

            return (
            <TableRow
              key={doc.id}
                className={cn("cursor-pointer py-1.5", isTemp && "opacity-70")}
              onClick={() => handleRowClick(doc.id)}
            >
              <TableCell>
                <span className="text-sm font-medium text-[var(--foreground)]">
                    {doc.title || "Untitled Document"}
                    {doc.is_archived && (
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">(Archived)</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-[var(--muted-foreground)]">
                  {new Date(doc.updated_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-right">
                  {!isTemp && (
                    <DropdownMenu open={openMenuId === doc.id} onOpenChange={(open) => setOpenMenuId(open ? doc.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={(e) => handleToggleArchive(doc, e)}>
                          {doc.is_archived ? (
                            <>
                              <ArchiveRestore className="h-4 w-4" /> Restore
                            </>
                          ) : (
                            <>
                              <Archive className="h-4 w-4" /> Archive
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleOpenDeleteConfirm(doc, e)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
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
