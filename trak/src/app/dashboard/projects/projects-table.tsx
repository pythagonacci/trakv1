"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/actions/project";
import ProjectDialog from "./project-dialog";
import ConfirmDialog from "./confirm-dialog";
import Toast from "./toast";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";

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
}

interface FormData {
  name: string;
  client_id: string;
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
}

export default function ProjectsTable({ projects: initialProjects, workspaceId }: ProjectsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Local state
  const [projects, setProjects] = useState(initialProjects);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Dialog state
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Open create dialog
  const handleOpenCreate = () => {
    setDialogMode("create");
    setEditingProject(null);
  };

  // Open edit dialog
  const handleOpenEdit = (project: Project) => {
    setDialogMode("edit");
    setEditingProject(project);
    setOpenMenuId(null); // Close menu
  };

  // Close dialog
  const handleCloseDialog = () => {
    setDialogMode(null);
    setEditingProject(null);
  };

  // Open delete confirmation
  const handleOpenDeleteConfirm = (project: Project) => {
    setDeletingProject(project);
    setDeleteConfirmOpen(true);
    setOpenMenuId(null); // Close menu
  };

  // Close delete confirmation
  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingProject(null);
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deletingProject) return;

    setIsDeleting(true);

    // Optimistic update - remove from UI
    const previousProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== deletingProject.id));

    // Call server action
    const result = await deleteProject(deletingProject.id);

    if (result.error) {
      // Revert on error
      setProjects(previousProjects);
      setToast({ message: result.error, type: "error" });
    } else {
      // Show success toast
      setToast({ message: "Project deleted successfully ✓", type: "success" });

      // Refresh server data
      startTransition(() => {
        router.refresh();
      });
    }

    // Close confirmation dialog
    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  // Handle create submit
  const handleCreateSubmit = async (formData: FormData) => {
    // Parse due date
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

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticProject: Project = {
      id: tempId,
      name: formData.name,
      status: formData.status,
      due_date_date,
      due_date_text,
      client_id: formData.client_id || null,
      client_name: clients.find(c => c.id === formData.client_id)?.name || null,
      created_at: new Date().toISOString(),
    };

    setProjects([optimisticProject, ...projects]);

    // Call server action
    const result = await createProject(workspaceId, {
      name: formData.name,
      client_id: formData.client_id || null,
      status: formData.status,
      due_date_date,
      due_date_text,
    });

    if (result.error) {
      // Remove optimistic project on error
      setProjects(projects);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
    } else {
      // Replace temporary project with real one
      setProjects(prev => 
        prev.map(p => p.id === tempId ? { ...result.data, client_name: optimisticProject.client_name } : p)
      );
      
      // Show success toast
      setToast({ message: "Project created successfully ✓", type: "success" });
      
      // Close dialog
      handleCloseDialog();

      // Refresh server data
      startTransition(() => {
        router.refresh();
      });
    }
  };

  // Handle edit submit
  const handleEditSubmit = async (formData: FormData) => {
    if (!editingProject) return;

    // Parse due date
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

    // Prepare updates
    const updates = {
      name: formData.name,
      client_id: formData.client_id || null,
      status: formData.status,
      due_date_date,
      due_date_text,
    };

    // Optimistic update
    const previousProjects = [...projects];
    setProjects(prev =>
      prev.map(p =>
        p.id === editingProject.id
          ? {
              ...p,
              ...updates,
              client_name: clients.find(c => c.id === formData.client_id)?.name || null,
            }
          : p
      )
    );

    // Call server action
    const result = await updateProject(editingProject.id, updates);

    if (result.error) {
      // Revert on error
      setProjects(previousProjects);
      setToast({ message: result.error, type: "error" });
      throw new Error(result.error);
    } else {
      // Show success toast
      setToast({ message: "Project updated successfully ✓", type: "success" });
      
      // Close dialog
      handleCloseDialog();

      // Refresh server data
      startTransition(() => {
        router.refresh();
      });
    }
  };

  // Handle dialog submit (routes to create or edit)
  const handleDialogSubmit = async (formData: FormData) => {
    if (dialogMode === "create") {
      await handleCreateSubmit(formData);
    } else if (dialogMode === "edit") {
      await handleEditSubmit(formData);
    }
  };

  // Handle row click
  const handleRowClick = (projectId: string) => {
    if (!projectId.startsWith('temp-')) {
      router.push(`/project/${projectId}`);
    }
  };

  // Format due date
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

  // Empty state
  if (projects.length === 0 && dialogMode === null) {
    return <EmptyState onCreateClick={handleOpenCreate} />;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Table Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-neutral-900">All Projects</h2>
          <button 
            onClick={handleOpenCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors"
          >
            New Project
          </button>
        </div>

        {/* Table */}
        <div className="relative">
          <div className="bg-white/50 backdrop-blur-sm border border-neutral-200/40 rounded-2xl">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-neutral-200/40 bg-neutral-50/50 rounded-t-2xl">
              <div className="col-span-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Client
              </div>
              <div className="col-span-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Project
              </div>
              <div className="col-span-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Status
              </div>
              <div className="col-span-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Due Date
              </div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-neutral-200/40">
              {projects.map((project) => {
                const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
                const isTemp = project.id.startsWith('temp-');
                
                return (
                  <div
                    key={project.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 hover:bg-neutral-50/80 transition-colors ${
                      isTemp ? 'opacity-60' : 'cursor-pointer'
                    } group relative`}
                    onClick={() => handleRowClick(project.id)}
                  >
                    {/* Client */}
                    <div className="col-span-3 flex items-center">
                      <span className="text-sm text-neutral-600 truncate">
                        {project.client_name || "No client"}
                      </span>
                    </div>

                    {/* Project Name */}
                    <div className="col-span-4 flex items-center">
                      <span className="text-sm font-medium text-neutral-900 truncate">
                        {project.name}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 flex items-center">
                      <StatusBadge status={project.status} />
                    </div>

                    {/* Due Date */}
                    <div className="col-span-2 flex items-center">
                      <span
                        className={`text-sm truncate ${
                          dueDate.isOverdue
                            ? "text-red-600 font-medium"
                            : "text-neutral-600"
                        }`}
                      >
                        {dueDate.text}
                      </span>
                    </div>

                    {/* Actions Menu */}
                    {!isTemp && (
                      <div className="col-span-1 flex items-center justify-end">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === project.id ? null : project.id);
                            }}
                            className="p-1 hover:bg-neutral-200 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-4 h-4 text-neutral-600" />
                          </button>

                          {/* Dropdown Menu */}
                          {openMenuId === project.id && (
                            <div
                              className="absolute right-0 mt-1 w-40 bg-white border border-neutral-200/40 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleOpenEdit(project)}
                                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleOpenDeleteConfirm(project)}
                                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Project Dialog (Reusable for Create & Edit) */}
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

      {/* Delete Confirmation Dialog */}
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

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}