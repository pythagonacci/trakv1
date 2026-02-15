"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
import { moveProjectToFolder, deleteFolder } from "@/app/actions/folder";
import ProjectDialog from "./project-dialog";
import CreateFolderDialog from "./create-folder-dialog";
import ConfirmDialog from "./confirm-dialog";
import Toast from "./toast";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";
import { Folder, Plus, ChevronDown, ChevronRight, Trash2 as TrashIcon } from "lucide-react";
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
}

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
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
}

export default function ProjectsTable({ projects: initialProjects, workspaceId, folders: initialFolders, currentSort }: ProjectsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [moveProjectDialogOpen, setMoveProjectDialogOpen] = useState(false);
  const [projectToMove, setProjectToMove] = useState<Project | null>(null);
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

    const result = await createProject(workspaceId, {
      name: formData.name,
      client_id: formData.client_id || null,
      client_name: formData.client_name, // Pass client_name for auto-creation
      status: formData.status,
      due_date_date,
      due_date_text,
    });

    if ("error" in result) {
      setProjects(projects);
      setToast({ message: result.error!, type: "error" });
      throw new Error(result.error!);
    } else {
      // Transform the returned project data to match our interface
      const createdProject = {
        ...result.data,
        client_name: (result.data as any).client?.name || optimisticProject.client_name,
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

  const handleRowClick = (projectId: string) => {
    if (!projectId.startsWith("temp-")) {
      router.push(`/dashboard/projects/${projectId}`);
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
  const projectsByFolder = React.useMemo(() => {
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
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-normal text-[var(--foreground)]">Projects</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Track deliverables, due dates, and client work from one place.</p>
          </div>
          <Button onClick={handleOpenCreate} size="sm">New project</Button>
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
            variant="secondary"
            size="sm"
            className="bg-white text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
          >
            <Folder className="h-3.5 w-3.5" />
            New Folder
          </Button>
          <Button onClick={handleOpenCreate} size="sm">New project</Button>
        </div>
      </div>

      <Table className="[&_th]:px-3 [&_th]:py-2.5 [&_th]:h-10 [&_td]:px-3 [&_td]:py-2.5">
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
            {/* Render folders first */}
            {folders.map((folder) => {
              const folderProjects = projectsByFolder[folder.id] || [];
              const isExpanded = expandedFolders.has(folder.id);
              
              return (
                <React.Fragment key={folder.id}>
                  {/* Folder Header Row */}
                  <TableRow className="bg-[var(--secondary)]/5 hover:bg-[var(--secondary)]/5">
                    <TableCell colSpan={5} className="py-2">
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
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
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

                    return (
                      <TableRow
                        key={project.id}
                        className={cn("cursor-pointer", isTemp && "opacity-70")}
                        onClick={() => handleRowClick(project.id)}
                      >
                        <TableCell className="pl-8">
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
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
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
                    <TableCell colSpan={5} className="py-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">No Folder</span>
                      <span className="text-xs text-[var(--tertiary-foreground)] ml-2">({projectsByFolder.ungrouped.length})</span>
                    </TableCell>
                  </TableRow>
                )}
                {projectsByFolder.ungrouped.map((project) => {
                  const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
                  const isTemp = project.id.startsWith("temp-");

                  return (
                    <TableRow
                      key={project.id}
                      className={cn("cursor-pointer", isTemp && "opacity-70", folders.length > 0 && "pl-8")}
                      onClick={() => handleRowClick(project.id)}
                    >
                      <TableCell className={folders.length > 0 ? "pl-8" : ""}>
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-surface-hover"
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
