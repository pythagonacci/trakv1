"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { getAllClients } from "@/app/actions/client";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import { getProjectTags, addProjectTag, removeProjectTag } from "@/app/actions/project";
import { useWorkspaceBilling } from "@/hooks/use-workspace-billing";

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "teammate";
}

type ProjectPriority = "low" | "medium" | "high" | "urgent" | null;

interface Project {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  priority?: ProjectPriority;
  tags?: string[]; // Tags assigned to this project (labels on the project)
  client_id: string | null;
  client_name?: string | null;
}

interface FormData {
  name: string;
  client_id: string;
  client_name?: string; // For creating new clients
  template_id?: string;
  status: "not_started" | "in_progress" | "complete";
  due_date: string;
  priority: ProjectPriority;
  assigned_tags?: string[]; // Tags for this project (saved to project.tags)
  tag_bank?: string[]; // Tag bank for tasks (project_tags table, create only)
  member_ids?: string[] | "all"; // Project permissions
}

interface ProjectTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  minimumPlan: "free" | "standard" | "business";
  isAvailable: boolean;
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
  const { data: billingSummary } = useWorkspaceBilling(workspaceId);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [clientsLoaded, setClientsLoaded] = useState(initialClients.length > 0);
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    client_id: "",
    template_id: undefined,
    status: "not_started",
    due_date: "",
    priority: null,
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientInput, setClientInput] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [projectTags, setProjectTags] = useState<string[]>([]); // Tags for this project (project.tags)
  const [tagBank, setTagBank] = useState<string[]>([]); // Tag bank for tasks (project_tags table)
  const [projectTagInput, setProjectTagInput] = useState("");
  const [tagBankInput, setTagBankInput] = useState("");
  const [isTagsAccessOpen, setIsTagsAccessOpen] = useState(false);

  // Project permissions state
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [permissionMode, setPermissionMode] = useState<"all" | "specific">("all");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || mode !== "create" || templatesLoaded) return;

    fetch("/api/project-templates", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || "Failed to load templates");
        }
        setTemplates((json?.data ?? []) as ProjectTemplateSummary[]);
        setTemplatesLoaded(true);
      })
      .catch(() => {
        setTemplates([]);
        setTemplatesLoaded(true);
      });
  }, [isOpen, mode, templatesLoaded]);

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

  // Load workspace members for permissions
  useEffect(() => {
    if (isOpen && workspaceId) {
      getWorkspaceMembers(workspaceId).then((result) => {
        if (result.data) {
          setWorkspaceMembers(result.data);
        }
      });
    }
  }, [isOpen, workspaceId]);

  // Load tag bank (project_tags) in edit mode
  useEffect(() => {
    if (isOpen && mode === "edit" && initialData?.id) {
      getProjectTags(initialData.id).then((result) => {
        if ("data" in result) setTagBank(result.data);
      });
    }
  }, [isOpen, mode, initialData?.id]);

  // Pre-fill form in edit mode
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        const dueDate = initialData.due_date_date || initialData.due_date_text || "";
        setFormData({
          name: initialData.name,
          client_id: initialData.client_id || "",
          status: initialData.status,
          due_date: dueDate,
          priority: initialData.priority ?? null,
          assigned_tags: initialData.tags ?? [],
        });
        setProjectTags(initialData.tags ?? []);
        if (initialData.client_name) {
          setClientInput(initialData.client_name);
        }
      } else {
        setFormData({
          name: "",
          client_id: "",
          template_id: undefined,
          status: "not_started",
          due_date: "",
          priority: null,
        });
        setClientInput("");
        setPermissionMode("all");
        setSelectedMemberIds([]);
        setProjectTags([]);
        setTagBank([]);
        setProjectTagInput("");
        setTagBankInput("");
      }
      setFormError("");
      setIsSubmitting(false);
      setShowClientDropdown(false);
      setIsTagsAccessOpen(false);
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

  const addProjectTagToList = () => {
    const normalized = projectTagInput.trim();
    if (!normalized) return;

    const exists = projectTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      setProjectTagInput("");
      return;
    }

    setProjectTags((prev) => [...prev, normalized]);
    setProjectTagInput("");
  };

  const addTagBankToList = () => {
    const normalized = tagBankInput.trim();
    if (!normalized) return;

    const exists = tagBank.some((tag) => tag.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      setTagBankInput("");
      return;
    }

    setTagBankInput("");

    if (mode === "create") {
      setTagBank((prev) => [...prev, normalized]);
      return;
    }

    if (mode === "edit" && initialData?.id) {
      addProjectTag(initialData.id, normalized);
      setTagBank((prev) => [...prev, normalized]);
    }
  };

  const removeTagBankEntry = async (tag: string) => {
    if (mode === "create") {
      setTagBank((prev) => prev.filter((value) => value !== tag));
      return;
    }

    if (mode === "edit" && initialData?.id) {
      await removeProjectTag(initialData.id, tag);
      setTagBank((prev) => prev.filter((value) => value !== tag));
    }
  };

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
      const submitData: FormData = {
        ...formData,
        client_name: clientInput && !formData.client_id ? clientInput.trim() : undefined,
        member_ids: permissionMode === "all" ? "all" : selectedMemberIds,
        assigned_tags: projectTags,
        tag_bank: mode === "create" && tagBank.length > 0 ? tagBank : undefined,
      };

      await onSubmit(submitData);
      // Parent handles success, close, and toast
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save project");
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

  const labelClassName = "mb-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-[#a09589]";
  const inputClassName =
    "w-full rounded-[9px] border border-[#ebe2d7] bg-[#efe8de] px-2.5 py-1.5 text-[12px] text-[#433a33] placeholder:text-[#8a8178] outline-none transition focus:border-[#d4c6b5] focus:ring-2 focus:ring-[#d4c6b5]/40 disabled:cursor-not-allowed disabled:opacity-60";
  const largeInputClassName =
    "w-full rounded-[10px] border border-[#ebe2d7] bg-[#efe8de] px-3 py-2 text-[13px] font-medium text-[#433a33] placeholder:text-[#80776e] outline-none transition focus:border-[#d4c6b5] focus:ring-2 focus:ring-[#d4c6b5]/40 disabled:cursor-not-allowed disabled:opacity-60";
  const chipClassName =
    "inline-flex items-center gap-1.5 rounded-full border border-[#ddd1c3] bg-white/75 px-2 py-0.5 text-[11px] text-[#4a4138]";
  const optionRowClassName =
    "flex items-start gap-2.5 rounded-[10px] border border-[#e4d9cd] bg-[#fbf7f2] px-2.5 py-2 transition has-[:checked]:border-[#c6b4a1] has-[:checked]:bg-white";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(104,97,90,0.58)] p-4 md:p-6" aria-modal="true">
      <div className="w-full max-w-[396px] overflow-hidden rounded-[18px] border border-[#e8ddd0] bg-[#fcf8f4] shadow-[0_18px_40px_rgba(49,40,30,0.15)]">
        {/* Dialog Header */}
        <div className="flex flex-col gap-2 border-b border-[#e8ddd0] px-3 py-3 md:flex-row md:items-center md:justify-between md:px-3.5 md:py-3.5">
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#1f2024] md:text-[18px]">
            {mode === "create" ? "New project" : "Edit project"}
          </h2>

          <div className="flex items-center gap-2.5">
            {mode === "create" && (
              <div className="relative min-w-0 flex-1 md:w-[126px] md:flex-none">
                <select
                  id="project-template"
                  value={formData.template_id ?? ""}
                  onChange={(e) => setFormData({ ...formData, template_id: e.target.value || undefined })}
                  className="h-8 w-full appearance-none rounded-[9px] border border-[#ebe2d7] bg-[#efe8de] px-2.5 pr-7 text-[12px] font-medium text-[#594e44] outline-none transition focus:border-[#d4c6b5] focus:ring-2 focus:ring-[#d4c6b5]/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                >
                  <option value="">Blank project</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id} disabled={!template.isAvailable}>
                      {template.name}{!template.isAvailable ? ` (${template.minimumPlan})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#75695f]" />
              </div>
            )}
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#978a7e] transition hover:bg-[#f1e9df] hover:text-[#5a4e43] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Dialog Body */}
        <form onSubmit={handleSubmit} className="space-y-3 px-3 py-3 md:px-3.5 md:py-3.5">
          {/* Error Message */}
          {formError && (
            <div className="rounded-[9px] border border-[#f1b2aa] bg-[#fff1ef] px-2.5 py-1.5">
              <p className="text-[12px] font-medium text-[#b14e46]">{formError}</p>
            </div>
          )}

          {mode === "create" && (
            <>
              <div>
                <input
                  id="project-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Project name"
                  className={largeInputClassName}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div className="grid gap-1.5 md:grid-cols-3">
                <div>
                  <label htmlFor="status" className={labelClassName}>
                    Status
                  </label>
                  <div className="relative">
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData["status"] })}
                      className={`${inputClassName} appearance-none pr-9`}
                      disabled={isSubmitting}
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="complete">Complete</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#75695f]" />
                  </div>
                </div>

                <div>
                  <label htmlFor="priority" className={labelClassName}>
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      id="priority"
                      value={formData.priority ?? ""}
                      onChange={(e) => setFormData({ ...formData, priority: (e.target.value || null) as FormData["priority"] })}
                      className={`${inputClassName} appearance-none pr-9`}
                      disabled={isSubmitting}
                    >
                      <option value="">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#75695f]" />
                  </div>
                </div>

                <div>
                  <label htmlFor="due-date" className={labelClassName}>
                    Due Date
                  </label>
                  <input
                    id="due-date"
                    type="text"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    placeholder="YYYY-MM-DD"
                    className={inputClassName}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="rounded-[10px]">
                <button
                  type="button"
                  onClick={() => setIsTagsAccessOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-left text-[12px] font-semibold text-[#95897d] transition hover:text-[#675b50]"
                  aria-expanded={isTagsAccessOpen}
                >
                  {isTagsAccessOpen ? (
                    <ChevronDown className="h-3 w-3 text-[#9c8f82]" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-[#9c8f82]" />
                  )}
                  <span>Tags &amp; access</span>
                </button>

                {isTagsAccessOpen && (
                  <div className="mt-2 space-y-2.5 rounded-[12px] border border-[#ede4d8] bg-[#f7f1ea] p-2.5 md:p-3">
                    <div className="relative">
                      <label htmlFor="client" className={labelClassName}>
                        Client
                      </label>
                      <input
                        id="client"
                        type="text"
                        value={clientInput}
                        onChange={(e) => handleClientInputChange(e.target.value)}
                        onFocus={() => setShowClientDropdown(clientInput.length > 0)}
                        onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                        placeholder="Type to select or create a client"
                        className={inputClassName}
                        disabled={isSubmitting}
                      />

                      {showClientDropdown && (
                        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-[9px] border border-[#e6d9cb] bg-[#fffdfa] shadow-[0_10px_20px_rgba(75,61,46,0.12)]">
                          {filteredClients.length > 0 ? (
                            filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => handleClientSelect(client)}
                                className="w-full px-3 py-2 text-left transition hover:bg-[#f4ece3]"
                              >
                                <div className="font-medium text-[#3e352e]">{client.name}</div>
                                {client.company && (
                                  <div className="text-xs text-[#8e8276]">{client.company}</div>
                                )}
                              </button>
                            ))
                          ) : clientInput.trim() ? (
                            <div className="px-3 py-2.5 text-[12px]">
                              <div className="mb-1 text-[#8e8276]">No existing clients found</div>
                              <div className="font-medium text-[#3e352e]">
                                Will create: <span className="text-[#7d5d3c]">{clientInput}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {clientInput && !formData.client_id && (
                        <p className="mt-1.5 text-[12px] text-[#84664d]">
                          New client &quot;{clientInput}&quot; will be created.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <label className={labelClassName}>Project Tags</label>
                        <p className="mb-2 text-[12px] text-[#8e8276]">
                          Labels shown on the project itself.
                        </p>
                        <div className="min-h-[78px] rounded-[10px] border border-[#e6d9cb] bg-[#fffdfa] p-2">
                          <div className="flex flex-wrap gap-1.5">
                            {projectTags.map((tag) => (
                              <span key={tag} className={chipClassName}>
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => setProjectTags((prev) => prev.filter((value) => value !== tag))}
                                  className="text-[#7b6f63] transition hover:text-[#b14e46]"
                                  disabled={isSubmitting}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="mt-1.5 flex gap-1.5">
                            <input
                              type="text"
                              value={projectTagInput}
                              onChange={(e) => setProjectTagInput(e.target.value)}
                              placeholder="Add tag"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addProjectTagToList();
                                }
                              }}
                              className="min-w-0 flex-1 rounded-[8px] border border-[#e6d9cb] bg-[#f7f1ea] px-2 py-1.5 text-[11px] text-[#433a33] outline-none transition focus:border-[#d4c6b5] focus:ring-2 focus:ring-[#d4c6b5]/40"
                              disabled={isSubmitting}
                            />
                            <button
                              type="button"
                              onClick={addProjectTagToList}
                              className="rounded-[8px] border border-[#d8caba] px-2 py-1.5 text-[11px] font-medium text-[#5b5046] transition hover:bg-[#f2e7db] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isSubmitting || !projectTagInput.trim()}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className={labelClassName}>Task Tag Bank</label>
                        <p className="mb-2 text-[12px] text-[#8e8276]">
                          Shared tags available for tasks and other items in this project.
                        </p>
                        <div className="min-h-[78px] rounded-[10px] border border-[#e6d9cb] bg-[#fffdfa] p-2">
                          <div className="flex flex-wrap gap-1.5">
                            {tagBank.map((tag) => (
                              <span key={tag} className={chipClassName}>
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => void removeTagBankEntry(tag)}
                                  className="text-[#7b6f63] transition hover:text-[#b14e46]"
                                  disabled={isSubmitting}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="mt-1.5 flex gap-1.5">
                            <input
                              type="text"
                              value={tagBankInput}
                              onChange={(e) => setTagBankInput(e.target.value)}
                              placeholder="Add task tag"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addTagBankToList();
                                }
                              }}
                              className="min-w-0 flex-1 rounded-[8px] border border-[#e6d9cb] bg-[#f7f1ea] px-2 py-1.5 text-[11px] text-[#433a33] outline-none transition focus:border-[#d4c6b5] focus:ring-2 focus:ring-[#d4c6b5]/40"
                              disabled={isSubmitting}
                            />
                            <button
                              type="button"
                              onClick={addTagBankToList}
                              className="rounded-[8px] border border-[#d8caba] px-2 py-1.5 text-[11px] font-medium text-[#5b5046] transition hover:bg-[#f2e7db] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isSubmitting || !tagBankInput.trim()}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={labelClassName}>Project Access</label>
                      <div className="space-y-2">
                        <label className={optionRowClassName}>
                          <input
                            type="radio"
                            name="permission"
                            checked={permissionMode === "all"}
                            onChange={() => setPermissionMode("all")}
                            className="mt-1 h-4 w-4 border-[#cdbca9] text-[#20324b] focus:ring-[#20324b]"
                            disabled={isSubmitting}
                          />
                          <div>
                            <div className="text-[12px] font-medium text-[#3e352e]">All workspace members</div>
                            <div className="text-xs text-[#8e8276]">
                              {workspaceMembers.length} {workspaceMembers.length === 1 ? "member" : "members"} will be able to access this project.
                            </div>
                          </div>
                        </label>

                        <label className={optionRowClassName}>
                          <input
                            type="radio"
                            name="permission"
                            checked={permissionMode === "specific"}
                            onChange={() => setPermissionMode("specific")}
                            className="mt-1 h-4 w-4 border-[#cdbca9] text-[#20324b] focus:ring-[#20324b]"
                            disabled={isSubmitting}
                          />
                          <div>
                            <div className="text-[12px] font-medium text-[#3e352e]">Specific members only</div>
                            <div className="text-xs text-[#8e8276]">Choose a smaller access list for this project.</div>
                          </div>
                        </label>
                      </div>

                      {permissionMode === "specific" && (
                        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-[10px] border border-[#e6d9cb] bg-[#fffdfa] p-2">
                          {workspaceMembers.length === 0 ? (
                            <p className="text-sm text-[#8e8276]">Loading members...</p>
                          ) : (
                            workspaceMembers.map((member) => (
                              <label
                                key={member.id}
                                className="flex items-center gap-2 rounded-[8px] border border-transparent px-1.5 py-1.5 transition hover:border-[#ece0d3] hover:bg-[#faf5ef]"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMemberIds.includes(member.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMemberIds([...selectedMemberIds, member.id]);
                                    } else {
                                      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== member.id));
                                    }
                                  }}
                                  className="h-4 w-4 border-[#cdbca9] text-[#20324b] focus:ring-[#20324b]"
                                  disabled={isSubmitting}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[12px] font-medium text-[#3e352e]">{member.name}</div>
                                  <div className="truncate text-xs text-[#8e8276]">{member.email}</div>
                                </div>
                                <span className="rounded-full bg-[#f2e8dc] px-1.5 py-0.5 text-[9px] font-medium capitalize text-[#7f7468]">
                                  {member.role}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      )}

                      {permissionMode === "specific" && selectedMemberIds.length === 0 && (
                        <p className="mt-2 text-[12px] text-[#8e8276]">
                          Select at least one member. You&apos;ll still be included automatically.
                        </p>
                      )}
                    </div>

                    <div className="space-y-0.5 text-[10px] text-[#94887b]">
                      <p>
                        {templates.length > 0
                          ? "Templates clone into a normal project after creation."
                          : templatesLoaded
                          ? "No templates have been seeded yet."
                          : "Loading templates..."}
                      </p>
                      {!billingSummary?.entitlements.allowProjectTemplates && (
                        <p>Templates are available on Standard and Business.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {mode === "edit" && (
            <>
              <div>
                <label htmlFor="project-name" className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter project name"
                  className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div className="relative">
                <label htmlFor="client" className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Client{" "}
                  <span className="text-[10px] text-[var(--tertiary-foreground)]">
                    (optional - type to create or select)
                  </span>
                </label>
                <input
                  id="client"
                  type="text"
                  value={clientInput}
                  onChange={(e) => handleClientInputChange(e.target.value)}
                  onFocus={() => setShowClientDropdown(clientInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  placeholder="Type client name..."
                  className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
                  disabled={isSubmitting}
                />

                {showClientDropdown && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                    {filteredClients.length > 0 ? (
                      <>
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleClientSelect(client)}
                            className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)]"
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
                        <div className="mb-1 text-[var(--muted-foreground)]">No existing clients found</div>
                        <div className="font-medium text-[var(--foreground)]">
                          Will create: <span className="text-[var(--primary)]">{clientInput}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {clientInput && !formData.client_id && (
                  <p className="mt-0.5 text-[10px] text-[var(--primary)]">
                    ✨ New client &quot;{clientInput}&quot; will be created
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="status" className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData["status"] })}
                  className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
                  disabled={isSubmitting}
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>

              <div>
                <label htmlFor="due-date" className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Due Date{" "}
                  <span className="text-[var(--tertiary-foreground)] text-[10px]">(optional)</span>
                </label>
                <input
                  id="due-date"
                  type="text"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  placeholder="YYYY-MM-DD or custom text"
                  className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="priority" className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Priority{" "}
                  <span className="text-[var(--tertiary-foreground)] text-[10px]">(optional)</span>
                </label>
                <select
                  id="priority"
                  value={formData.priority ?? ""}
                  onChange={(e) => setFormData({ ...formData, priority: (e.target.value || null) as FormData["priority"] })}
                  className="w-full rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
                  disabled={isSubmitting}
                >
                  <option value="">None</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Tags (for this project){" "}
                  <span className="text-[10px] text-[var(--tertiary-foreground)]">(optional)</span>
                </label>
                <p className="mb-1 text-[11px] text-[var(--muted-foreground)]">
                  Labels on the project, e.g. Q1, Marketing. Shown in the project header.
                </p>
                <div className="flex min-h-[32px] flex-wrap gap-1.5 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-2">
                  {projectTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setProjectTags((prev) => prev.filter((value) => value !== tag))}
                        className="ml-0.5 transition-colors hover:text-[var(--error)]"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={projectTagInput}
                      onChange={(e) => setProjectTagInput(e.target.value)}
                      placeholder="Add tag..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addProjectTagToList();
                        }
                      }}
                      className="w-24 min-w-0 rounded border-0 bg-transparent px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      disabled={isSubmitting}
                    />
                    {projectTagInput.trim() && (
                      <button
                        type="button"
                        onClick={addProjectTagToList}
                        className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                  Tag bank (for tasks in this project){" "}
                  <span className="text-[10px] text-[var(--tertiary-foreground)]">(optional)</span>
                </label>
                <p className="mb-1 text-[11px] text-[var(--muted-foreground)]">
                  Tags that can be used when adding tags to tasks and other items in this project.
                </p>
                <div className="flex min-h-[32px] flex-wrap gap-1.5 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] p-2">
                  {tagBank.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => void removeTagBankEntry(tag)}
                        className="ml-0.5 transition-colors hover:text-[var(--error)]"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagBankInput}
                      onChange={(e) => setTagBankInput(e.target.value)}
                      placeholder="Add to tag bank..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTagBankToList();
                        }
                      }}
                      className="w-24 min-w-0 rounded border-0 bg-transparent px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      disabled={isSubmitting}
                    />
                    {tagBankInput.trim() && (
                      <button
                        type="button"
                        onClick={addTagBankToList}
                        className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-1.5 pt-0.5 md:gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-[9px] border border-[#d9cec2] bg-[#fcf8f4] px-2.5 py-1.5 text-[12px] font-medium text-[#655b52] transition hover:bg-[#f7f0e8] hover:border-[#cdbda8] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[1.65] rounded-[9px] bg-[#233550] px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#1c2b41] disabled:cursor-not-allowed disabled:opacity-60"
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
