"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getAllClients } from "@/app/actions/client";

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface Project {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  client_name?: string | null;
}

interface FormData {
  name: string;
  client_id: string;
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
}

interface ProjectDialogProps {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  initialData?: Project;
  workspaceId: string;
  clients: Client[];
  onClientsLoad?: (clients: Client[]) => void;
}

export default function ProjectDialog({
  mode,
  isOpen,
  onClose,
  onSubmit,
  initialData,
  workspaceId,
  clients: initialClients = [],
  onClientsLoad,
}: ProjectDialogProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [clientsLoaded, setClientsLoaded] = useState(initialClients.length > 0);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    client_id: "",
    status: "not_started",
    due_date: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load clients if not already loaded
  useEffect(() => {
    if (isOpen && !clientsLoaded) {
      getAllClients(workspaceId).then((result) => {
        if (result.data) {
          setClients(result.data);
          setClientsLoaded(true);
          if (onClientsLoad) {
            onClientsLoad(result.data);
          }
        }
      });
    }
  }, [isOpen, clientsLoaded, workspaceId, onClientsLoad]);

  // Pre-fill form in edit mode
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        // Pre-fill with existing data
        const dueDate = initialData.due_date_date || initialData.due_date_text || "";
        setFormData({
          name: initialData.name,
          client_id: initialData.client_id || "",
          status: initialData.status,
          due_date: dueDate,
        });
      } else {
        // Reset for create mode
        setFormData({
          name: "",
          client_id: "",
          status: "not_started",
          due_date: "",
        });
      }
      setFormError("");
      setIsSubmitting(false); // Reset submitting state when dialog opens
    }
  }, [isOpen, mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validation
    if (!formData.name.trim()) {
      setFormError("Project name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      // Parent handles success, close, and toast
    } catch (error: any) {
      setFormError(error.message || "Failed to save project");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setFormError("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-white/95 shadow-popover dark:bg-[#111]">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {mode === "create" ? "New Project" : "Edit Project"}
          </h2>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--tertiary-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dialog Body */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Error Message */}
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-600">{formError}</p>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label htmlFor="project-name" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm transition-all focus:border-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Client Selector */}
          <div>
            <label htmlFor="client" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Client <span className="text-xs text-[var(--tertiary-foreground)]">(optional)</span>
            </label>
            <select
              id="client"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
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
            <label htmlFor="status" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData["status"] })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              disabled={isSubmitting}
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="due-date" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Due Date <span className="text-neutral-400 text-xs">(optional)</span>
            </label>
            <input
              id="due-date"
              type="text"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              placeholder="YYYY-MM-DD or custom text"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm focus:border-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)]"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : mode === "create" ? "Create project" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}