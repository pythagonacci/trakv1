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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Dialog Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900">
            {mode === "create" ? "New Project" : "Edit Project"}
          </h2>
          <button
            onClick={handleClose}
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
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
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
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
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
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Project" : "Save Changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}