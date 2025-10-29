"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Edit, Trash2, X } from "lucide-react";
import { createProject } from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
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

export default function ProjectsTable({ projects: initialProjects, workspaceId }: ProjectsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Local state
  const [projects, setProjects] = useState(initialProjects);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    client_id: "",
    status: "not_started" as const,
    due_date: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load clients when dialog opens
  const handleOpenDialog = async () => {
    setIsCreateDialogOpen(true);
    
    if (!clientsLoaded) {
      const result = await getAllClients(workspaceId);
      if (result.data) {
        setClients(result.data);
        setClientsLoaded(true);
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validation
    if (!formData.name.trim()) {
      setFormError("Project name is required");
      return;
    }

    setIsSubmitting(true);

    // Parse due date - if it's a valid date, use due_date_date, otherwise use due_date_text
    let due_date_date = null;
    let due_date_text = null;

    if (formData.due_date.trim()) {
      const dateTest = new Date(formData.due_date);
      if (!isNaN(dateTest.getTime())) {
        // Valid date
        due_date_date = formData.due_date;
      } else {
        // Text like "quarterly", "weekly", etc.
        due_date_text = formData.due_date;
      }
    }

    // Optimistic update - add temporary project
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
      setFormError(result.error);
      setIsSubmitting(false);
    } else {
      // Replace temporary project with real one
      setProjects(prev => 
        prev.map(p => p.id === tempId ? { ...result.data, client_name: optimisticProject.client_name } : p)
      );
      
      // Close dialog and reset form
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        client_id: "",
        status: "not_started",
        due_date: "",
      });
      setIsSubmitting(false);

      // Refresh server data
      startTransition(() => {
        router.refresh();
      });
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
  if (projects.length === 0 && !isCreateDialogOpen) {
    return <EmptyState onCreateClick={handleOpenDialog} />;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Table Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-neutral-900">All Projects</h2>
          <button 
            onClick={handleOpenDialog}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors"
          >
            New Project
          </button>
        </div>

        {/* Table - Fixed overflow issue */}
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
                                onClick={() => {
                                  console.log("Edit project:", project.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  console.log("Delete project:", project.id);
                                  setOpenMenuId(null);
                                }}
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

      {/* Create Project Dialog */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <h2 className="text-xl font-semibold text-neutral-900">New Project</h2>
              <button
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setFormData({ name: "", client_id: "", status: "not_started", due_date: "" });
                  setFormError("");
                }}
                className="p-1 hover:bg-neutral-100 rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Dialog Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Error Message */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              {/* Project Name */}
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium text-neutral-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter project name"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              {/* Client Selector */}
              <div>
                <label htmlFor="client" className="block text-sm font-medium text-neutral-700 mb-2">
                  Client <span className="text-neutral-400 text-xs">(optional)</span>
                </label>
                <select
                  id="client"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
                  disabled={isSubmitting}
                >
                  <option value="">No client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.company && `(${client.company})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
                  disabled={isSubmitting}
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="due-date" className="block text-sm font-medium text-neutral-700 mb-2">
                  Due Date <span className="text-neutral-400 text-xs">(date or text like "quarterly")</span>
                </label>
                <input
                  id="due-date"
                  type="text"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  placeholder="2024-12-31 or 'quarterly'"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Enter a date (YYYY-MM-DD) or text like "quarterly", "weekly", etc.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setFormData({ name: "", client_id: "", status: "not_started", due_date: "" });
                    setFormError("");
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}