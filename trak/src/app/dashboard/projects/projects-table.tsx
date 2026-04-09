"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Folder,
  ChevronDown,
  ChevronRight,
  Trash2 as TrashIcon,
} from "lucide-react";
import {
  createProject,
  createProjectFromTemplate,
  updateProject,
  deleteProject,
  bulkDeleteProjects,
} from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
import { moveProjectToFolder, deleteFolder, bulkMoveProjectsToFolder } from "@/app/actions/folder";
import ProjectDialog from "./project-dialog";
import CreateFolderDialog from "./create-folder-dialog";
import ConfirmDialog from "./confirm-dialog";
import Toast from "./toast";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { parseDateSafe } from "@/lib/due-date";
import { buildProjectPath } from "@/lib/dashboard-routes";
import { OPEN_CREATE_PROJECT_EVENT } from "@/lib/projects";

interface Project {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  client_name?: string | null;
  folder_id: string | null;
  created_at: string;
  is_plan_locked?: boolean;
}

type CreatedProjectResult = Project & {
  client?: {
    name?: string | null;
  } | null;
};

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface Folder {
  id: string;
  name: string;
  position: number;
}

interface ProjectsTableProps {
  projects: Project[];
  workspaceId: string;
  folders: Folder[];
  currentSort: {
    sort_by: string;
    sort_order: "asc" | "desc";
  };
}

interface FormData {
  name: string;
  client_id: string;
  client_name?: string;  // For creating new clients on the fly
  template_id?: string;
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
  tags?: string[];
  priority?: string | null;
  assigned_tags?: string[];
  tag_bank?: string[];
  member_ids?: string[] | "all";
}

export default function ProjectsTable({ projects: initialProjects, workspaceId, folders: initialFolders, currentSort }: ProjectsTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState(initialProjects);
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  const [folders, setFolders] = useState(initialFolders);
  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectableProjectIds = useMemo(
    () => projects.filter((project) => !project.id.startsWith("temp-")).map((project) => project.id),
    [projects]
  );

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedProjectIds.has(project.id)),
    [projects, selectedProjectIds]
  );

  const allProjectsSelected =
    selectableProjectIds.length > 0 && selectableProjectIds.every((projectId) => selectedProjectIds.has(projectId));
  const someProjectsSelected =
    !allProjectsSelected && selectableProjectIds.some((projectId) => selectedProjectIds.has(projectId));

  useEffect(() => {
    const validProjectIds = new Set(projects.map((project) => project.id));
    setSelectedProjectIds((prev) => {
      const next = new Set([...prev].filter((projectId) => validProjectIds.has(projectId)));
      return next.size === prev.size ? prev : next;
    });
  }, [projects]);

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

  useEffect(() => {
    const handleOpenCreateEvent = () => {
      setDialogMode("create");
      setEditingProject(null);
    };

    window.addEventListener(OPEN_CREATE_PROJECT_EVENT, handleOpenCreateEvent);
    return () => window.removeEventListener(OPEN_CREATE_PROJECT_EVENT, handleOpenCreateEvent);
  }, []);

  const handleOpenEdit = (project: Project, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setDialogMode("edit");
    setEditingProject(project);
    setOpenMenuId(null);
  };

  const handleCloseDialog = () => {
    setDialogMode(null);
    setEditingProject(null);
  };

  const handleOpenDeleteConfirm = (project: Project, event?: React.MouseEvent) => {
    event?.stopPropagation();
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

    if ("error" in result) {
      setProjects(previousProjects);
      setToast({ message: result.error!, type: "error" });
    } else {
      setToast({ message: "Project deleted successfully", type: "success" });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  const clearSelection = () => {
    setSelectedProjectIds(new Set());
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedProjectIds(new Set(selectableProjectIds));
      return;
    }

    clearSelection();
  };

  const handleCloseBulkDeleteConfirm = () => {
    if (!isBulkDeleting) {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    const projectIds = [...selectedProjectIds];
    if (projectIds.length === 0) return;

    setIsBulkDeleting(true);
    const previousProjects = [...projects];
    setProjects((prev) => prev.filter((project) => !selectedProjectIds.has(project.id)));

    const result = await bulkDeleteProjects(projectIds);

    if ("error" in result) {
      setProjects(previousProjects);
      setToast({ message: result.error!, type: "error" });
    } else {
      clearSelection();
      setToast({
        message: `${projectIds.length} project${projectIds.length === 1 ? "" : "s"} deleted successfully`,
        type: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsBulkDeleting(false);
    setBulkDeleteConfirmOpen(false);
  };

  const handleBulkMoveToFolder = async (folderId: string | null) => {
    const projectIds = [...selectedProjectIds];
    if (projectIds.length === 0) return;

    setIsBulkMoving(true);
    const previousProjects = [...projects];
    setProjects((prev) =>
      prev.map((project) => (selectedProjectIds.has(project.id) ? { ...project, folder_id: folderId } : project))
    );

    const result = await bulkMoveProjectsToFolder(projectIds, folderId);

    if ("error" in result) {
      setProjects(previousProjects);
      setToast({ message: result.error!, type: "error" });
    } else {
      clearSelection();
      const targetFolder = folders.find((folder) => folder.id === folderId);
      setToast({
        message: folderId
          ? `${projectIds.length} project${projectIds.length === 1 ? "" : "s"} moved to ${targetFolder?.name ?? "folder"}`
          : `${projectIds.length} project${projectIds.length === 1 ? "" : "s"} removed from folder`,
        type: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    }

    setIsBulkMoving(false);
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
      // Use the client_name from formData if creating new client, otherwise lookup existing
      client_name: formData.client_name || clients.find((c) => c.id === formData.client_id)?.name || null,
      created_at: new Date().toISOString(),
    } as Project;

    setProjects([optimisticProject, ...projects]);

    const payload = {
      name: formData.name,
      client_id: formData.client_id || null,
      client_name: formData.client_name, // Pass client_name for auto-creation
      status: formData.status,
      due_date_date,
      due_date_text,
      priority: (formData.priority && ["low", "medium", "high", "urgent"].includes(formData.priority) ? formData.priority : null) as "low" | "medium" | "high" | "urgent" | null,
      assigned_tags: formData.assigned_tags ?? [],
      tag_bank: formData.tag_bank,
      member_ids: formData.member_ids,
    };

    const result = formData.template_id
      ? await createProjectFromTemplate(workspaceId, {
          ...payload,
          template_id: formData.template_id,
        })
      : await createProject(workspaceId, payload);

    if ("error" in result) {
      setProjects(projects);
      setToast({ message: result.error!, type: "error" });
      throw new Error(result.error!);
    } else {
      // Transform the returned project data to match our interface
      const resultData = result.data as CreatedProjectResult;
      const createdProject = {
        ...resultData,
        client_name: resultData.client?.name || optimisticProject.client_name,
      };
      
      setProjects((prev) =>
        prev.map((p) => (p.id === tempId ? createdProject : p))
      );
      setToast({ message: "Project created", type: "success" });
      handleCloseDialog();
      
      // Reload clients list if a new client was created
      if (formData.client_name) {
        getAllClients(workspaceId).then((clientsResult) => {
          if (clientsResult.data) {
            setClients(clientsResult.data);
          }
        });
      }
      
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

    if ("error" in result) {
      setProjects(previousProjects);
      setToast({ message: result.error!, type: "error" });
      throw new Error(result.error!);
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

  const handleRowClick = (projectId: string, projectName: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!projectId.startsWith("temp-") && !project?.is_plan_locked) {
      router.push(buildProjectPath(projectId, projectName));
    }
  };

  const handleCreateFolder = () => {
    setCreateFolderDialogOpen(true);
  };

  const handleFolderCreated = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleMoveToFolder = (project: Project, folderId: string | null) => {
    startTransition(async () => {
      const result = await moveProjectToFolder(project.id, folderId);
      if ("error" in result) {
        setToast({ message: result.error!, type: "error" });
      } else {
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? { ...p, folder_id: folderId } : p))
        );
        setToast({ message: folderId ? "Project moved to folder" : "Project removed from folder", type: "success" });
        router.refresh();
      }
    });
  };

  const handleDeleteFolder = async (folderId: string) => {
    startTransition(async () => {
      const result = await deleteFolder(folderId);
      if ("error" in result) {
        setToast({ message: result.error!, type: "error" });
      } else {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setProjects((prev) => prev.map((p) => (p.folder_id === folderId ? { ...p, folder_id: null } : p)));
        setToast({ message: "Folder deleted", type: "success" });
        router.refresh();
      }
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Organize projects by folders
  const projectsByFolder = useMemo(() => {
    const organized: { [key: string]: Project[] } = { ungrouped: [] };
    
    projects.forEach((project) => {
      const folderKey = project.folder_id || "ungrouped";
      if (!organized[folderKey]) {
        organized[folderKey] = [];
      }
      organized[folderKey].push(project);
    });

    return organized;
  }, [projects]);

  const formatDueDate = (dateString: string | null, textDate: string | null) => {
    if (textDate) {
      return { text: textDate, isOverdue: false };
    }

    if (dateString) {
      const date = parseDateSafe(dateString);
      if (!date) return { text: "No due date", isOverdue: false };
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
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-normal text-[var(--foreground)]">Projects</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Track deliverables, due dates, and client work from one place.</p>
          </div>
          <Button
            onClick={handleOpenCreate}
            size="sm"
            variant="outline"
            className="rounded-[2px] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            New project
          </Button>
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

        <ConfirmDialog
          isOpen={bulkDeleteConfirmOpen}
          onClose={handleCloseBulkDeleteConfirm}
          onConfirm={handleConfirmBulkDelete}
          title="Delete Projects"
          message={`Are you sure you want to delete ${selectedProjects.length} project${selectedProjects.length === 1 ? "" : "s"}? This action cannot be undone.`}
          confirmText={`Delete ${selectedProjects.length} Project${selectedProjects.length === 1 ? "" : "s"}`}
          confirmButtonVariant="danger"
          isLoading={isBulkDeleting}
        />

        <CreateFolderDialog
          isOpen={createFolderDialogOpen}
          onClose={() => setCreateFolderDialogOpen(false)}
          workspaceId={workspaceId}
          onFolderCreated={handleFolderCreated}
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
          <h2 className="text-xl font-semibold tracking-normal text-[var(--foreground)]">Projects</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Monitor progress, status, and deadlines at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleCreateFolder} 
            variant="outline"
            size="sm"
            className="rounded-[2px] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <Folder className="h-3.5 w-3.5" />
            New Folder
          </Button>
          <Button
            onClick={handleOpenCreate}
            size="sm"
            variant="outline"
            className="rounded-[2px] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            New project
          </Button>
        </div>
      </div>

      {selectedProjectIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {selectedProjectIds.size} selected
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-[2px]"
                disabled={isBulkDeleting || isBulkMoving}
              >
                Move to folder
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => void handleBulkMoveToFolder(null)}>
                No Folder
              </DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => void handleBulkMoveToFolder(folder.id)}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[2px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setBulkDeleteConfirmOpen(true)}
            disabled={isBulkDeleting || isBulkMoving}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-[2px]"
            onClick={clearSelection}
            disabled={isBulkDeleting || isBulkMoving}
          >
            Clear
          </Button>
        </div>
      )}

      <Table className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:h-10 [&_td]:px-3 [&_td]:py-2.5">
          <TableHeader className="bg-[var(--primary)]/10 border-b border-[var(--primary)]/30">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="h-10 w-10 px-3 py-2.5">
                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={allProjectsSelected ? true : someProjectsSelected ? "indeterminate" : false}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label={allProjectsSelected ? "Deselect all projects" : "Select all projects"}
                    disabled={selectableProjectIds.length === 0}
                  />
                </div>
              </TableHead>
              <TableHead className="h-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                <button
                  className="flex items-center gap-2 hover:text-[var(--foreground)]"
                  onClick={() => handleSort("client_id")}
                >
                  Client {getSortIndicator("client_id")}
                </button>
              </TableHead>
              <TableHead className="h-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                <button
                  className="flex items-center gap-2 hover:text-[var(--foreground)]"
                  onClick={() => handleSort("name")}
                >
                  Project {getSortIndicator("name")}
                </button>
              </TableHead>
              <TableHead className="h-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                <button
                  className="flex items-center gap-2 hover:text-[var(--foreground)]"
                  onClick={() => handleSort("status")}
                >
                  Status {getSortIndicator("status")}
                </button>
              </TableHead>
              <TableHead className="h-10 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                <button
                  className="flex items-center gap-2 hover:text-[var(--foreground)]"
                  onClick={() => handleSort("due_date_date")}
                >
                  Due date {getSortIndicator("due_date_date")}
                </button>
              </TableHead>
              <TableHead className="h-10 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--tertiary-foreground)]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Render folders first */}
            {folders.map((folder) => {
              const folderProjects = projectsByFolder[folder.id] || [];
              const isExpanded = expandedFolders.has(folder.id);
              
              return (
                <React.Fragment key={folder.id}>
                  {/* Folder Header Row */}
                  <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                    <TableCell colSpan={6} className="py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolder(folder.id);
                            }}
                            className="p-0.5 hover:bg-[var(--surface-hover)] rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                            )}
                          </button>
                          <Folder className="h-4 w-4 text-[var(--secondary)]" />
                          <span className="text-sm font-semibold text-[var(--foreground)]">{folder.name}</span>
                          <span className="text-xs text-[var(--tertiary-foreground)]">({folderProjects.length})</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete folder "${folder.name}"? Projects will be moved out of the folder.`)) {
                                  handleDeleteFolder(folder.id);
                                }
                              }}
                              className="text-red-500 focus:bg-red-50 focus:text-red-600"
                            >
                              <TrashIcon className="h-4 w-4" /> Delete Folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Folder Projects */}
                  {isExpanded && folderProjects.map((project) => {
                    const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
                    const isTemp = project.id.startsWith("temp-");
                    const isPlanLocked = Boolean(project.is_plan_locked);

                    return (
                      <TableRow
                        key={project.id}
                        className={cn(
                          "cursor-pointer transition-colors duration-150 hover:bg-[var(--primary)]/10",
                          isTemp && "opacity-70",
                          selectedProjectIds.has(project.id) && "bg-[var(--primary)]/5",
                          isPlanLocked && "cursor-not-allowed bg-[var(--surface-hover)]/50"
                        )}
                        onClick={() => handleRowClick(project.id, project.name)}
                      >
                        <TableCell className="w-10 pl-3" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedProjectIds.has(project.id)}
                            onCheckedChange={() => toggleProjectSelection(project.id)}
                            aria-label={`Select ${project.name}`}
                            disabled={isTemp || isBulkDeleting || isBulkMoving}
                          />
                        </TableCell>
                        <TableCell className="pl-8">
                          <span className="text-sm text-[var(--muted-foreground)]">{project.client_name || "No client"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                            {project.name}
                            {isPlanLocked && <Lock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                          </span>
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
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={(e) => handleOpenEdit(project, e)}>
                                  <Edit className="h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Move to Folder</div>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToFolder(project, null);
                                }}>
                                  No Folder
                                </DropdownMenuItem>
                                {folders.map((f) => (
                                  <DropdownMenuItem
                                    key={f.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveToFolder(project, f.id);
                                    }}
                                  >
                                    {f.name}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => handleOpenDeleteConfirm(project, e)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                                  <Trash2 className="h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {/* Render ungrouped projects */}
            {projectsByFolder.ungrouped && projectsByFolder.ungrouped.length > 0 && (
              <>
                {folders.length > 0 && (
                  <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                    <TableCell colSpan={6} className="py-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">No Folder</span>
                      <span className="text-xs text-[var(--tertiary-foreground)] ml-2">({projectsByFolder.ungrouped.length})</span>
                    </TableCell>
                  </TableRow>
                )}
                {projectsByFolder.ungrouped.map((project) => {
                  const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
                  const isTemp = project.id.startsWith("temp-");
                  const isPlanLocked = Boolean(project.is_plan_locked);

                  return (
                    <TableRow
                      key={project.id}
                      className={cn(
                        "cursor-pointer transition-colors duration-150 hover:bg-[var(--primary)]/10",
                        isTemp && "opacity-70",
                        selectedProjectIds.has(project.id) && "bg-[var(--primary)]/5",
                        folders.length > 0 && "pl-8",
                        isPlanLocked && "cursor-not-allowed bg-[var(--surface-hover)]/50"
                      )}
                      onClick={() => handleRowClick(project.id, project.name)}
                    >
                      <TableCell className="w-10 pl-3" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedProjectIds.has(project.id)}
                          onCheckedChange={() => toggleProjectSelection(project.id)}
                          aria-label={`Select ${project.name}`}
                          disabled={isTemp || isBulkDeleting || isBulkMoving}
                        />
                      </TableCell>
                      <TableCell className={folders.length > 0 ? "pl-8" : ""}>
                        <span className="text-sm text-[var(--muted-foreground)]">{project.client_name || "No client"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                          {project.name}
                          {isPlanLocked && <Lock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
                        </span>
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => handleOpenEdit(project, e)}>
                                <Edit className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Move to Folder</div>
                              {folders.map((f) => (
                                <DropdownMenuItem
                                  key={f.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToFolder(project, f.id);
                                  }}
                                >
                                  {f.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleOpenDeleteConfirm(project, e)} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>

      {renderDialogs()}
    </>
  );
}
