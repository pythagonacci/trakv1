"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Building2,
  ArrowRight,
  Type,
  CheckSquare,
  Link2,
  Minus,
  Table as TableIcon,
  CalendarRange,
  Paperclip,
  Image as ImageIcon,
  Images as ImagesIcon,
  PlayCircle,
  Globe,
  FileText as FileTextIcon,
  LayoutPanelTop,
  BookOpen,
  BarChart3,
  Folder,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
import { moveProjectToFolder, deleteFolder } from "@/app/actions/folder";
import ProjectDialog from "./project-dialog";
import ConfirmDialog from "./confirm-dialog";
import CreateFolderDialog from "./create-folder-dialog";
import Toast from "./toast";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/app/actions/block";

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
  first_tab_preview?: FirstTabPreview | null;
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

interface ProjectsGridProps {
  projects: Project[];
  workspaceId: string;
  folders: Folder[];
}

interface FormData {
  name: string;
  client_id: string;
  client_name?: string;
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
}

interface TabPreviewBlock {
  id: string;
  type: BlockType;
  column: number | null;
  position: number | null;
  summary: string;
  detailLines?: string[];
  meta?: string;
}

interface FirstTabPreview {
  tab_id: string;
  tab_name: string;
  blocks: TabPreviewBlock[];
}

const MAX_PREVIEW_LINES = 5;

const blockIconLookup: Partial<Record<BlockType, LucideIcon>> = {
  text: Type,
  task: CheckSquare,
  link: Link2,
  divider: Minus,
  table: TableIcon,
  timeline: CalendarRange,
  file: Paperclip,
  video: PlayCircle,
  image: ImageIcon,
  gallery: ImagesIcon,
  embed: Globe,
  pdf: FileTextIcon,
  section: LayoutPanelTop,
  doc_reference: BookOpen,
  chart: BarChart3,
};

const getBlockPreviewIcon = (type: BlockType): LucideIcon => {
  return blockIconLookup[type] || FileTextIcon;
};

const renderFirstTabSnapshot = (preview?: FirstTabPreview | null) => {
  if (!preview) {
    return (
      <div className="min-h-[140px] rounded-t-[4px] px-4 py-3">
        <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
          First tab
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]/80">
          No tab content yet
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Create a tab to capture a quick snapshot here.
        </p>
      </div>
    );
  }

  const displayedBlocks = (preview.blocks || []).slice(0, MAX_PREVIEW_LINES);

  return (
    <div className="min-h-[140px] rounded-t-[4px] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">
          {preview.tab_name || "Untitled Tab"}
        </p>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
          First tab
        </span>
      </div>
      {displayedBlocks.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          No blocks yet — add a block to this tab to see it here.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {displayedBlocks.map((block) => {
            const Icon = getBlockPreviewIcon(block.type);
            return (
              <div
                key={block.id}
                className="flex items-start gap-2 rounded-[2px] bg-[var(--surface)]/80 px-2 py-1"
              >
                <Icon className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-[var(--muted-foreground)]" />
                <div className="flex-1">
                  <p className="text-[11px] font-medium leading-tight text-[var(--foreground)] line-clamp-1">
                    {block.summary || block.type}
                  </p>
                  {block.detailLines && block.detailLines.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {block.detailLines.map((line, idx) => (
                        <p
                          key={`${block.id}-line-${idx}`}
                          className="text-[10px] leading-tight text-[var(--muted-foreground)] line-clamp-1"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                  {block.meta && (
                    <p className="mt-0.5 text-[10px] text-[var(--tertiary-foreground)] line-clamp-1">
                      {block.meta}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function ProjectsGrid({ projects: initialProjects, workspaceId, folders: initialFolders }: ProjectsGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load clients on mount
  useEffect(() => {
    getAllClients(workspaceId).then((result) => {
      if (result.data) {
        setClients(result.data);
      }
    });
  }, [workspaceId]);

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
      client_name: formData.client_name || clients.find((c) => c.id === formData.client_id)?.name || null,
      created_at: new Date().toISOString(),
    } as Project;

    setProjects([optimisticProject, ...projects]);

    const result = await createProject(workspaceId, {
      name: formData.name,
      client_id: formData.client_id || null,
      client_name: formData.client_name,
      status: formData.status,
      due_date_date,
      due_date_text,
    });

    if (result.error) {
      setProjects(projects);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
    } else {
      const createdProject = {
        ...result.data,
        client_name: (result.data as any).client?.name || optimisticProject.client_name,
      };
      
      setProjects((prev) =>
        prev.map((p) => (p.id === tempId ? createdProject : p))
      );
      setToast({ message: "Project created", type: "success" });
      handleCloseDialog();
      
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

  const handleProjectClick = (projectId: string) => {
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
      now.setHours(0, 0, 0, 0);
      const isOverdue = date < now && date.toDateString() !== now.toDateString();
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
      });
      return { text: formatted, isOverdue };
    }

    return null;
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
        setToast({ message: result.error, type: "error" });
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
        setToast({ message: result.error, type: "error" });
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

  const renderProjectCard = (project: Project) => {
    const isTemp = project.id.startsWith("temp-");
    const dueDate = formatDueDate(project.due_date_date, project.due_date_text);

    return (
      <div
        key={project.id}
        onClick={() => handleProjectClick(project.id)}
        className={cn(
          "group relative flex h-full cursor-pointer flex-col rounded-[4px] border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 hover:border-[var(--border-strong)]",
          isTemp && "pointer-events-none opacity-70"
        )}
      >
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/70">
          {renderFirstTabSnapshot(project.first_tab_preview)}
        </div>

        {/* Project Card */}
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 truncate text-sm font-semibold text-[var(--foreground)]">
                {project.name}
              </h3>
              {project.client_name && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{project.client_name}</span>
                </div>
              )}
            </div>

            {/* Menu */}
            {!isTemp && (
              <DropdownMenu
                open={openMenuId === project.id}
                onOpenChange={(open) => setOpenMenuId(open ? project.id : null)}
              >
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="rounded-[2px] p-1 opacity-0 transition-opacity hover:bg-[var(--surface-hover)] group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
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
                  <DropdownMenuItem
                    onClick={(e) => handleOpenDeleteConfirm(project, e)}
                    className="text-[var(--error)] focus:bg-[var(--error)]/10 focus:text-[var(--error)]"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Status Badge */}
          <div className="mb-3">
            <StatusBadge status={project.status} />
          </div>

          {/* Due Date */}
          {dueDate && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs",
                dueDate.isOverdue ? "text-[var(--error)]" : "text-[var(--muted-foreground)]"
              )}
            >
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{dueDate.text}</span>
            </div>
          )}

          {/* View Project Link */}
          <div className="mt-auto pt-3">
            <div className="flex items-center gap-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
              <span>View project</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {projects.length === 0 && dialogMode === null ? (
        <>
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Projects</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Track deliverables, due dates, and client work from one place.</p>
            </div>
            <Button onClick={handleOpenCreate} size="sm">New project</Button>
          </div>
          <EmptyState onCreateClick={handleOpenCreate} />
          {renderDialogs()}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Projects</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Monitor progress, status, and deadlines at a glance.</p>
            </div>
            <Button onClick={handleOpenCreate} size="sm">New project</Button>
          </div>

          {projects.length === 0 ? (
            <EmptyState onCreateClick={handleOpenCreate} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => {
              const isTemp = project.id.startsWith("temp-");
              const dueDate = formatDueDate(project.due_date_date, project.due_date_text);

              return (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className={cn(
                    "group relative flex h-full cursor-pointer flex-col rounded-[4px] border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 hover:border-[var(--border-strong)]",
                    isTemp && "pointer-events-none opacity-70"
                  )}
                >
                  <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/70">
                    {renderFirstTabSnapshot(project.first_tab_preview)}
                  </div>

                  {/* Project Card */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 truncate text-sm font-semibold text-[var(--foreground)]">
                          {project.name}
                        </h3>
                        {project.client_name && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                            <Building2 className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{project.client_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Menu */}
                      {!isTemp && (
                        <DropdownMenu
                          open={openMenuId === project.id}
                          onOpenChange={(open) => setOpenMenuId(open ? project.id : null)}
                        >
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="rounded-[2px] p-1 opacity-0 transition-opacity hover:bg-[var(--surface-hover)] group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={(e) => handleOpenEdit(project, e)}>
                              <Edit className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleOpenDeleteConfirm(project, e)}
                              className="text-[var(--error)] focus:bg-[var(--error)]/10 focus:text-[var(--error)]"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="mb-3">
                      <StatusBadge status={project.status} />
                    </div>

                    {/* Due Date */}
                    {dueDate && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs",
                          dueDate.isOverdue ? "text-[var(--error)]" : "text-[var(--muted-foreground)]"
                        )}
                      >
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>{dueDate.text}</span>
                      </div>
                    )}

                    {/* View Project Link */}
                    <div className="mt-auto pt-3">
                      <div className="flex items-center gap-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
                        <span>View project</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
          
          {renderDialogs()}
        </>
      )}
    </>
  );

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
          message={`Are you sure you want to delete "${deletingProject?.name}"? This will also delete all tabs, blocks, and content in this project. This action cannot be undone.`}
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
}
