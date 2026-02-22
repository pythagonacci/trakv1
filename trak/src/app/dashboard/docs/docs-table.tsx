"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Trash2, ArrowUp, ArrowDown, Archive, ArchiveRestore, Folder, ChevronDown, ChevronRight } from "lucide-react";
import { createDoc, updateDoc, deleteDoc } from "@/app/actions/doc";
import { moveDocToFolder, deleteDocFolder } from "@/app/actions/doc-folder";
import type { DocFolder } from "@/app/actions/doc-folder";
import ConfirmDialog from "@/app/dashboard/projects/confirm-dialog";
import Toast from "@/app/dashboard/projects/toast";
import DocsEmptyState from "./docs-empty-state";
import CreateDocFolderDialog from "./create-doc-folder-dialog";
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

interface Doc {
  id: string;
  title: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  folder_id?: string | null;
}

interface DocsTableProps {
  docs: Doc[];
  workspaceId: string;
  folders: DocFolder[];
  currentSort: {
    sort_by: string;
    sort_order: "asc" | "desc";
  };
}

export default function DocsTable({ docs: initialDocs, workspaceId, folders: initialFolders, currentSort }: DocsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [docs, setDocs] = useState(initialDocs);
  const [folders, setFolders] = useState(initialFolders);
  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);
  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<Doc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) newSet.delete(folderId);
      else newSet.add(folderId);
      return newSet;
    });
  };

  const handleMoveToFolder = async (doc: Doc, folderId: string | null) => {
    const result = await moveDocToFolder(doc.id, folderId);
    if (result.error) {
      setToast({ message: result.error, type: "error" });
    } else {
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, folder_id: folderId } : d))
      );
      setToast({ message: folderId ? "Document moved to folder" : "Document removed from folder", type: "success" });
      startTransition(() => router.refresh());
    }
    setOpenMenuId(null);
  };

  const handleDeleteFolder = async (folderId: string) => {
    const result = await deleteDocFolder(folderId);
    if (result.error) {
      setToast({ message: result.error, type: "error" });
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setDocs((prev) => prev.map((d) => (d.folder_id === folderId ? { ...d, folder_id: null } : d)));
      setToast({ message: "Folder deleted", type: "success" });
      startTransition(() => router.refresh());
    }
  };

  const docsByFolder = useMemo(() => {
    const organized: Record<string, Doc[]> = {};
    docs.forEach((doc) => {
      const key = doc.folder_id ?? "ungrouped";
      if (!organized[key]) organized[key] = [];
      organized[key].push(doc);
    });
    return organized;
  }, [docs]);

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
      folder_id: null,
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateFolderDialogOpen(true)}>New Folder</Button>
            <button 
              onClick={handleCreateNew} 
              className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[2px] transition-colors"
            >
              New Document
            </button>
          </div>
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateFolderDialogOpen(true)}>New Folder</Button>
            <button 
              onClick={handleCreateNew} 
              className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[2px] transition-colors"
            >
              New Document
            </button>
          </div>
        </div>
        <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">No documents found</div>
        {renderDialogs()}
      </>
    );
  }

  function renderDocRow(doc: Doc, extraCellClass?: string) {
    const isTemp = doc.id.startsWith("temp-");
    return (
      <TableRow
        key={doc.id}
        className={cn("cursor-pointer py-1.5 transition-colors duration-150 hover:bg-[var(--primary)]/10", isTemp && "opacity-70")}
        onClick={() => handleRowClick(doc.id)}
      >
        <TableCell className={extraCellClass}>
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
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => handleToggleArchive(doc, e)}>
                  {doc.is_archived ? <><ArchiveRestore className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}
                </DropdownMenuItem>
                {folders.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Move to Folder</div>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToFolder(doc, null); }}>
                      No Folder
                    </DropdownMenuItem>
                    {folders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={(e) => { e.stopPropagation(); handleMoveToFolder(doc, f.id); }}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => handleOpenDeleteConfirm(doc, e)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
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
        <CreateDocFolderDialog
          isOpen={createFolderDialogOpen}
          onClose={() => setCreateFolderDialogOpen(false)}
          workspaceId={workspaceId}
          onFolderCreated={() => {
            startTransition(() => router.refresh());
          }}
        />
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
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateFolderDialogOpen(true)}>
            New Folder
          </Button>
          <Button onClick={handleCreateNew} size="sm">New Document</Button>
        </div>
      </div>

      <Table className="text-sm [&_th]:px-3 [&_th]:py-2.5 [&_th]:h-10 [&_td]:px-3 [&_td]:py-2.5">
        <TableHeader className="bg-[var(--primary)]/10 border-b border-[var(--primary)]/30">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="h-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
              <button
                className="flex items-center gap-2 hover:text-[var(--foreground)]"
                onClick={() => handleSort("title")}
              >
                Title {getSortIndicator("title")}
              </button>
            </TableHead>
            <TableHead className="h-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
              <button
                className="flex items-center gap-2 hover:text-[var(--foreground)]"
                onClick={() => handleSort("updated_at")}
              >
                Last Updated {getSortIndicator("updated_at")}
              </button>
            </TableHead>
            <TableHead className="h-10 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => {
            const folderDocs = docsByFolder[folder.id] || [];
            const isExpanded = expandedFolders.has(folder.id);
            return (
              <React.Fragment key={folder.id}>
                <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                  <TableCell colSpan={3} className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }}
                          className="p-0.5 hover:bg-[var(--surface-hover)] rounded transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" /> : <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />}
                        </button>
                        <Folder className="h-4 w-4 text-[var(--secondary)]" />
                        <span className="text-sm font-semibold text-[var(--foreground)]">{folder.name}</span>
                        <span className="text-xs text-[var(--tertiary-foreground)]">({folderDocs.length})</span>
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
                              if (confirm(`Delete folder "${folder.name}"? Documents will be moved out of the folder.`)) handleDeleteFolder(folder.id);
                            }}
                            className="text-red-500 focus:bg-red-50 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" /> Delete Folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && folderDocs.map((doc) => renderDocRow(doc, "pl-8"))}
              </React.Fragment>
            );
          })}
          {docsByFolder.ungrouped && docsByFolder.ungrouped.length > 0 && (
            <>
              {folders.length > 0 && (
                <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                  <TableCell colSpan={3} className="py-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">No Folder</span>
                    <span className="text-xs text-[var(--tertiary-foreground)] ml-2">({docsByFolder.ungrouped.length})</span>
                  </TableCell>
                </TableRow>
              )}
              {docsByFolder.ungrouped.map((doc) => renderDocRow(doc, folders.length > 0 ? "pl-8" : undefined))}
            </>
          )}
        </TableBody>
      </Table>

      {renderDialogs()}
    </>
  );
}
