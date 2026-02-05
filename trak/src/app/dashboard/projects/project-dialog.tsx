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
  client_name?: string; // For creating new clients
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
  const [clientInput, setClientInput] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);

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
        // Set client input for edit mode
        if (initialData.client_name) {
          setClientInput(initialData.client_name);
        }
      } else {
        // Reset for create mode
        setFormData({
          name: "",
          client_id: "",
          status: "not_started",
          due_date: "",
        });
        setClientInput("");
      }
      setFormError("");
      setIsSubmitting(false);
      setShowClientDropdown(false);
    }
  }, [isOpen, mode, initialData]);

  const handleClientSelect = (client: Client) => {
    setFormData({ ...formData, client_id: client.id });
    setClientInput(client.name);
    setShowClientDropdown(false);
  };

  const handleClientInputChange = (value: string) => {
    setClientInput(value);
    setShowClientDropdown(value.length > 0);
    
    // If input doesn't match any existing client, clear client_id
    // This will signal to create a new client
    const existingClient = clients.find(c => c.name.toLowerCase() === value.toLowerCase());
    setFormData({ ...formData, client_id: existingClient?.id || "" });
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientInput.toLowerCase())
  );

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
      // If clientInput exists but no client_id, we're creating a new client
      const submitData = {
        ...formData,
        client_name: clientInput && !formData.client_id ? clientInput.trim() : undefined,
      };
      
      await onSubmit(submitData);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D3236]/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {mode === "create" ? "New Project" : "Edit Project"}
          </h2>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-[var(--border)] text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dialog Body */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Error Message */}
          {formError && (
            <div className="rounded-[2px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
              <p className="text-sm font-medium text-[var(--error)]">{formError}</p>
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
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Client Input (Autocomplete + Create) */}
          <div className="relative">
            <label htmlFor="client" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Client <span className="text-xs text-[var(--tertiary-foreground)]">(optional - type to create or select)</span>
            </label>
            <input
              id="client"
              type="text"
              value={clientInput}
              onChange={(e) => handleClientInputChange(e.target.value)}
              onFocus={() => setShowClientDropdown(clientInput.length > 0)}
              onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
              placeholder="Type client name..."
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
              disabled={isSubmitting}
            />
            
            {/* Dropdown for existing clients or create new */}
            {showClientDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_16px_rgba(0,0,0,0.04)] max-h-60 overflow-auto">
                {filteredClients.length > 0 ? (
                  <>
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleClientSelect(client)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <div className="font-medium text-[var(--foreground)]">{client.name}</div>
                        {client.company && (
                          <div className="text-xs text-[var(--muted-foreground)]">{client.company}</div>
                        )}
                      </button>
                    ))}
                  </>
                ) : clientInput.trim() ? (
                  <div className="px-3 py-2 text-sm">
                    <div className="text-[var(--muted-foreground)] mb-1">No existing clients found</div>
                    <div className="font-medium text-[var(--foreground)]">
                      Will create: <span className="text-[var(--primary)]">{clientInput}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            
            {clientInput && !formData.client_id && (
              <p className="mt-1 text-xs text-[var(--primary)]">
                ✨ New client "{clientInput}" will be created
              </p>
            )}
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
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
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
              className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-3 pt-6 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-[2px] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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