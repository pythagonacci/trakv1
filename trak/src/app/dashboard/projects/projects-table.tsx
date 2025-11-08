"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import ProjectDialog from "./project-dialog";
import ConfirmDialog from "./confirm-dialog";
import Toast from "./toast";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";
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

interface Project {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  client_name?: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface ProjectsTableProps {
  projects: Project[];
  workspaceId: string;
  currentSort: {
    sort_by: string;
    sort_order: "asc" | "desc";
  };
}

interface FormData {
  name: string;
  client_id: string;
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
}

export default function ProjectsTable({ projects: initialProjects, workspaceId, currentSort }: ProjectsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState(initialProjects);
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
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
    router.push(`/dashboard/projects?${params.toString()}`);
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
    setEditingProject(null);
  };

  const handleOpenEdit = (project: Project) => {
    setDialogMode("edit");
    setEditingProject(project);
    setOpenMenuId(null);
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setEditingProject(null);
  };

  const handleOpenDeleteConfirm = (project: Project) => {
    setDeletingProject(project);
    setDeleteConfirmOpen(true);
    setOpenMenuId(null);
  };

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingProject(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProject) return;

    setIsDeleting(true);
    const previousProjects = [...projects];
    setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
    const result = await deleteProject(deletingProject.id);

    if (result.error) {
      setProjects(previousProjects);
      setToast({ message: result.error, type: "error" });
    } else {
      setToast({ message: "Project deleted successfully", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  const handleCreateSubmit = async (formData: FormData) => {
    let due_date_date = null;
    let due_date_text = null;

    if (formData.due_date.trim()) {
      const dateTest = new Date(formData.due_date);
      if (!isNaN(dateTest.getTime())) {
        due_date_date = formData.due_date;
      } else {
        due_date_text = formData.due_date;
      }
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticProject: Project = {
      id: tempId,
      name: formData.name,
      status: formData.status,
      due_date_date,
      due_date_text,
      client_id: formData.client_id || null,
      client_name: clients.find((c) => c.id === formData.client_id)?.name || null,
      created_at: new Date().toISOString(),
    } as Project;

    setProjects([optimisticProject, ...projects]);

    const result = await createProject(workspaceId, {
      name: formData.name,
      client_id: formData.client_id || null,
      status: formData.status,
      due_date_date,
      due_date_text,
    });

    if (result.error) {
      setProjects(projects);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
    } else {
      setProjects((prev) =>
        prev.map((p) => (p.id === tempId ? { ...result.data, client_name: optimisticProject.client_name } : p))
      );
      setToast({ message: "Project created", type: "success" });
      handleCloseDialog();
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleEditSubmit = async (formData: FormData) => {
    if (!editingProject) return;

    let due_date_date = null;
    let due_date_text = null;

    if (formData.due_date.trim()) {
      const dateTest = new Date(formData.due_date);
      if (!isNaN(dateTest.getTime())) {
        due_date_date = formData.due_date;
      } else {
        due_date_text = formData.due_date;
      }
    }

    const updates = {
      name: formData.name,
      client_id: formData.client_id || null,
      status: formData.status,
      due_date_date,
      due_date_text,
    };

    const previousProjects = [...projects];
    setProjects((prev) =>
      prev.map((p) =>
        p.id === editingProject.id
          ? {
              ...p,
              ...updates,
              client_name: clients.find((c) => c.id === formData.client_id)?.name || null,
            }
          : p
      )
    );

    const result = await updateProject(editingProject.id, updates);

    if (result.error) {
      setProjects(previousProjects);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
    } else {
      setToast({ message: "Project updated", type: "success" });
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

  const handleRowClick = (projectId: string) => {
    if (!projectId.startsWith("temp-")) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  };

  const formatDueDate = (dateString: string | null, textDate: string | null) => {
    if (textDate) {
      return { text: textDate, isOverdue: false };
    }

    if (dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const isOverdue = date < now;
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return { text: formatted, isOverdue };
    }

    return { text: "No due date", isOverdue: false };
  };

  if (projects.length === 0 && dialogMode === null) {
    return (
      <>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Projects</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Track deliverables, due dates, and client work from one place.</p>
          </div>
          <Button onClick={handleOpenCreate}>New project</Button>
        </div>
        <EmptyState onCreateClick={handleOpenCreate} />
        {renderDialogs()}
      </>
    );
  }

  function renderDialogs() {
    return (
      <>
        <ProjectDialog
          mode={dialogMode || "create"}
          isOpen={dialogMode !== null}
          onClose={handleCloseDialog}
          onSubmit={handleDialogSubmit}
          initialData={editingProject || undefined}
          workspaceId={workspaceId}
          clients={clients}
          onClientsLoad={setClients}
        />

        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={handleCloseDeleteConfirm}
          onConfirm={handleConfirmDelete}
          title="Delete Project"
          message={`Are you sure you want to delete "${deletingProject?.name}"? This action cannot be undone.`}
          confirmText="Delete Project"
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Projects</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Monitor progress, status, and deadlines at a glance.</p>
        </div>
        <Button onClick={handleOpenCreate}>New project</Button>
      </div>

      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  onClick={() => handleSort("client_id")}
                >
                  Client {getSortIndicator("client_id")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  onClick={() => handleSort("name")}
                >
                  Project {getSortIndicator("name")}
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
                  onClick={() => handleSort("due_date_date")}
                >
                  Due date {getSortIndicator("due_date_date")}
                </button>
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
              const isTemp = project.id.startsWith("temp-");

              return (
                <TableRow
                  key={project.id}
                  className={cn("cursor-pointer", isTemp && "opacity-70")}
                  onClick={() => handleRowClick(project.id)}
                >
                  <TableCell>
                    <span className="text-sm text-[var(--muted-foreground)]">{project.client_name || "No client"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-[var(--foreground)]">{project.name}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
                  </TableCell>
                  <TableCell className={cn("text-sm", dueDate.isOverdue && "text-red-500 font-medium")}>{dueDate.text}</TableCell>
                  <TableCell className="text-right">
                    {!isTemp && (
                      <DropdownMenu open={openMenuId === project.id} onOpenChange={(open) => setOpenMenuId(open ? project.id : null)}>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleOpenEdit(project)}>
                            <Edit className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDeleteConfirm(project)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
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
      </div>

      {renderDialogs()}
    </>
  );
}