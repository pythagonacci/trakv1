"use client";

// Trak Universal Properties - Property Menu Component
// Simple menu for managing fixed properties (status, priority, assignee, due date, tags)

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X, User, Tag as TagIcon } from "lucide-react";
import { normalizeDueDateRange } from "@/lib/due-date";
import {
  useEntityPropertiesWithInheritance,
  useSetEntityProperties,
  useAddTag,
  useRemoveTag,
  useWorkspaceMembers,
  useProjectTags,
  useAddProjectTag,
} from "@/lib/hooks/use-property-queries";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type EntityType,
  type Status,
  type Priority,
  type DueDateRange,
} from "@/types/properties";

interface PropertyMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  workspaceId: string;
  entityTitle?: string;
  /** When set, the project's tag bank is shown and new tags are saved to the project. */
  projectId?: string;
  disabledFields?: Partial<{
    status: boolean;
    priority: boolean;
    assignees: boolean;
    dueDate: boolean;
    tags: boolean;
  }>;
}

// ============================================================================
// Draft types
// ============================================================================

type StatusFieldDraft = { id: string; field_name: string; value: Status };
type PriorityFieldDraft = { id: string; field_name: string; value: Priority };
type AssigneeFieldDraft = { id: string; field_name: string; value: string[] };
type DueDateFieldDraft = { id: string; field_name: string; value: DueDateRange };

// ============================================================================
// Build draft helpers
// ============================================================================

function buildStatusDrafts(
  direct: { statuses?: Array<{ id?: string; field_name?: string; value?: Status | null }>; status?: Status | null } | null | undefined
): StatusFieldDraft[] {
  const named = Array.isArray(direct?.statuses)
    ? direct!.statuses
        .map((field, index) => {
          const fieldName = String(field?.field_name ?? "").trim();
          const value = field?.value;
          if (!fieldName) return null;
          if (value !== "todo" && value !== "in_progress" && value !== "blocked" && value !== "done") return null;
          return {
            id: String(field?.id ?? `status-${index}-${fieldName.toLowerCase()}`),
            field_name: fieldName,
            value,
          } as StatusFieldDraft;
        })
        .filter((f): f is StatusFieldDraft => Boolean(f))
    : [];
  if (named.length > 0) return named;
  if (direct?.status) {
    return [{ id: "status-default", field_name: "Status", value: direct.status }];
  }
  return [];
}

function buildPriorityDrafts(
  direct: { priorities?: Array<{ id?: string; field_name?: string; value?: Priority | null }>; priority?: Priority | null } | null | undefined
): PriorityFieldDraft[] {
  const named = Array.isArray(direct?.priorities)
    ? direct!.priorities
        .map((field, index) => {
          const fieldName = String(field?.field_name ?? "").trim();
          const value = field?.value;
          if (!fieldName) return null;
          if (value !== "low" && value !== "medium" && value !== "high" && value !== "urgent") return null;
          return {
            id: String(field?.id ?? `priority-${index}-${fieldName.toLowerCase()}`),
            field_name: fieldName,
            value,
          } as PriorityFieldDraft;
        })
        .filter((field): field is PriorityFieldDraft => Boolean(field))
    : [];

  if (named.length > 0) return named;
  if (direct?.priority) {
    return [{ id: "priority-default", field_name: "Priority", value: direct.priority }];
  }
  return [];
}

function buildAssigneeDrafts(
  direct: { assignees?: Array<{ id?: string; field_name?: string; value?: string[] | null }>; assignee_ids?: string[]; assignee_id?: string | null } | null | undefined
): AssigneeFieldDraft[] {
  const named = Array.isArray(direct?.assignees)
    ? direct!.assignees
        .map((field, index) => {
          const fieldName = String(field?.field_name ?? "").trim();
          const value = Array.isArray(field?.value) ? field!.value.filter(Boolean) : [];
          if (!fieldName) return null;
          return {
            id: String(field?.id ?? `assignee-${index}-${fieldName.toLowerCase()}`),
            field_name: fieldName,
            value,
          } as AssigneeFieldDraft;
        })
        .filter((f): f is AssigneeFieldDraft => Boolean(f))
    : [];
  if (named.length > 0) return named;
  const fallbackIds = direct?.assignee_ids?.length
    ? direct.assignee_ids
    : direct?.assignee_id
      ? [direct.assignee_id]
      : [];
  if (fallbackIds.length > 0) {
    return [{ id: "assignee-default", field_name: "Assignee", value: fallbackIds }];
  }
  return [];
}

function buildDueDateDrafts(
  direct: { due_dates?: Array<{ id?: string; field_name?: string; value?: DueDateRange | null }>; due_date?: DueDateRange | null } | null | undefined
): DueDateFieldDraft[] {
  const named = Array.isArray(direct?.due_dates)
    ? direct!.due_dates
        .map((field, index) => {
          const fieldName = String(field?.field_name ?? "").trim();
          const value = normalizeDueDateRange(field?.value);
          if (!fieldName) return null;
          return {
            id: String(field?.id ?? `due-date-${index}-${fieldName.toLowerCase()}`),
            field_name: fieldName,
            value: value ?? { start: null, end: null },
          } as DueDateFieldDraft;
        })
        .filter((f): f is DueDateFieldDraft => Boolean(f))
    : [];
  if (named.length > 0) return named;
  const fallback = normalizeDueDateRange(direct?.due_date);
  if (fallback?.start || fallback?.end) {
    return [{ id: "due-date-default", field_name: "Due Date", value: fallback }];
  }
  return [];
}

// ============================================================================
// Next field name generators
// ============================================================================

function getNextStatusFieldName(existing: StatusFieldDraft[]): string {
  const existingLower = new Set(existing.map((f) => f.field_name.trim().toLowerCase()));
  if (!existingLower.has("status")) return "Status";
  let index = 2;
  while (existingLower.has(`status ${index}`)) index += 1;
  return `Status ${index}`;
}

function getNextPriorityFieldName(existing: PriorityFieldDraft[]): string {
  const existingLower = new Set(existing.map((field) => field.field_name.trim().toLowerCase()));
  if (!existingLower.has("priority")) return "Priority";
  let index = 2;
  while (existingLower.has(`priority ${index}`)) index += 1;
  return `Priority ${index}`;
}

function getNextAssigneeFieldName(existing: AssigneeFieldDraft[]): string {
  const existingLower = new Set(existing.map((f) => f.field_name.trim().toLowerCase()));
  if (!existingLower.has("assignee")) return "Assignee";
  let index = 2;
  while (existingLower.has(`assignee ${index}`)) index += 1;
  return `Assignee ${index}`;
}

function getNextDueDateFieldName(existing: DueDateFieldDraft[]): string {
  const existingLower = new Set(existing.map((f) => f.field_name.trim().toLowerCase()));
  if (!existingLower.has("due date")) return "Due Date";
  let index = 2;
  while (existingLower.has(`due date ${index}`)) index += 1;
  return `Due Date ${index}`;
}

// ============================================================================
// Dedup helper
// ============================================================================

function deduplicateByName<T extends { field_name: string }>(drafts: T[]): T[] {
  const seen = new Set<string>();
  return drafts
    .map((f) => ({ ...f, field_name: f.field_name.trim() }))
    .filter((f) => f.field_name.length > 0)
    .filter((f) => {
      const key = f.field_name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Menu for viewing and editing properties on an entity
 */
export function PropertyMenu({
  open,
  onOpenChange,
  entityType,
  entityId,
  workspaceId,
  entityTitle,
  projectId,
  disabledFields,
}: PropertyMenuProps) {
  const [newTagInput, setNewTagInput] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<StatusFieldDraft[]>([]);
  const { data: projectTagBank = [] } = useProjectTags(projectId);
  const addProjectTagMutation = useAddProjectTag(projectId);
  const [priorityDrafts, setPriorityDrafts] = useState<PriorityFieldDraft[]>([]);
  const [assigneeDrafts, setAssigneeDrafts] = useState<AssigneeFieldDraft[]>([]);
  const [dueDateDrafts, setDueDateDrafts] = useState<DueDateFieldDraft[]>([]);
  const statusDraftsRef = React.useRef<StatusFieldDraft[]>([]);
  const priorityDraftsRef = React.useRef<PriorityFieldDraft[]>([]);
  const assigneeDraftsRef = React.useRef<AssigneeFieldDraft[]>([]);
  const dueDateDraftsRef = React.useRef<DueDateFieldDraft[]>([]);

  const { data: propertiesResult, isLoading } =
    useEntityPropertiesWithInheritance(entityType, entityId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const setProperties = useSetEntityProperties(entityType, entityId, workspaceId);
  const addTagMutation = useAddTag(entityType, entityId, workspaceId);
  const removeTagMutation = useRemoveTag(entityType, entityId);

  const direct = propertiesResult?.direct;
  const statusDisabled = Boolean(disabledFields?.status);
  const assigneesDisabled = Boolean(disabledFields?.assignees);

  const memberLookup = React.useMemo(() => {
    const map = new Map<string, (typeof members)[number]>();
    members.forEach((member) => {
      map.set(member.id, member);
      if (member.user_id) map.set(member.user_id, member);
    });
    return map;
  }, [members]);

  // Keep refs in sync
  React.useEffect(() => { statusDraftsRef.current = statusDrafts; }, [statusDrafts]);
  React.useEffect(() => { priorityDraftsRef.current = priorityDrafts; }, [priorityDrafts]);
  React.useEffect(() => { assigneeDraftsRef.current = assigneeDrafts; }, [assigneeDrafts]);
  React.useEffect(() => { dueDateDraftsRef.current = dueDateDrafts; }, [dueDateDrafts]);

  // Initialize drafts when menu opens
  React.useEffect(() => {
    if (!open) return;
    setStatusDrafts(buildStatusDrafts(direct));
    setPriorityDrafts(buildPriorityDrafts(direct));
    setAssigneeDrafts(buildAssigneeDrafts(direct));
    setDueDateDrafts(buildDueDateDrafts(direct));
  }, [open, direct?.updated_at, direct?.id]);

  // ============================================================================
  // Persist callbacks
  // ============================================================================

  const persistStatusDrafts = React.useCallback(
    (nextDrafts: StatusFieldDraft[]) => {
      const normalized = deduplicateByName(nextDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
      setProperties.mutate({ statuses: normalized.length > 0 ? normalized : null });
    },
    [setProperties]
  );

  const persistPriorityDrafts = React.useCallback(
    (nextDrafts: PriorityFieldDraft[]) => {
      const normalized = deduplicateByName(nextDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
      setProperties.mutate({ priorities: normalized.length > 0 ? normalized : null });
    },
    [setProperties]
  );

  const persistAssigneeDrafts = React.useCallback(
    (nextDrafts: AssigneeFieldDraft[]) => {
      const normalized = deduplicateByName(nextDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
      setProperties.mutate({ assignees: normalized.length > 0 ? normalized : null });
    },
    [setProperties]
  );

  const persistDueDateDrafts = React.useCallback(
    (nextDrafts: DueDateFieldDraft[]) => {
      const normalized = deduplicateByName(nextDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
      setProperties.mutate({ due_dates: normalized.length > 0 ? normalized : null });
    },
    [setProperties]
  );

  // ============================================================================
  // Tag handlers
  // ============================================================================

  const handleAddTag = () => {
    const tag = newTagInput.trim();
    if (!tag) return;
    addTagMutation.mutate(tag, {
      onSuccess: () => {
        setNewTagInput("");
        if (projectId) addProjectTagMutation.mutate(tag);
      },
    });
  };

  const handleRemoveTag = (tag: string) => {
    removeTagMutation.mutate(tag);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Properties</DialogTitle>
          <DialogDescription>
            {entityTitle
              ? `Manage properties for "${entityTitle}"`
              : `Manage properties for this ${entityType.replace("_", " ")}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-sm text-[var(--muted-foreground)]">Loading...</div>
        ) : (
          <div className="space-y-6">

            {/* ================================================================
                Status (named fields)
            ================================================================ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Statuses</Label>
                {!statusDisabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = [
                        ...statusDrafts,
                        {
                          id: `status-new-${Date.now()}`,
                          field_name: getNextStatusFieldName(statusDrafts),
                          value: (direct?.status ?? "todo") as Status,
                        } as StatusFieldDraft,
                      ];
                      setStatusDrafts(next);
                      persistStatusDrafts(next);
                    }}
                  >
                    Add
                  </Button>
                )}
              </div>
              {statusDisabled ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  {direct?.status
                    ? STATUS_OPTIONS.find((o) => o.value === direct.status)?.label || direct.status
                    : "None"}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                    (Derived)
                  </span>
                </div>
              ) : statusDrafts.length === 0 ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  No status fields
                </div>
              ) : (
                <div className="space-y-2">
                  {statusDrafts.map((field) => (
                    <div key={field.id} className="grid grid-cols-[1fr_160px_auto] items-center gap-2">
                      <Input
                        value={field.field_name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStatusDrafts((prev) =>
                            prev.map((entry) => entry.id === field.id ? { ...entry, field_name: value } : entry)
                          );
                        }}
                        onBlur={() => persistStatusDrafts(statusDraftsRef.current)}
                        placeholder="Field name"
                      />
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          const next = statusDrafts.map((entry) =>
                            entry.id === field.id ? { ...entry, value: value as Status } : entry
                          );
                          setStatusDrafts(next);
                          persistStatusDrafts(next);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", STATUS_COLORS[option.value])}>
                                {option.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const next = statusDrafts.filter((entry) => entry.id !== field.id);
                          setStatusDrafts(next);
                          persistStatusDrafts(next);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ================================================================
                Priorities (named fields)
            ================================================================ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Priorities</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = [
                      ...priorityDrafts,
                      {
                        id: `priority-new-${Date.now()}`,
                        field_name: getNextPriorityFieldName(priorityDrafts),
                        value: direct?.priority ?? "medium",
                      } as PriorityFieldDraft,
                    ];
                    setPriorityDrafts(next);
                    persistPriorityDrafts(next);
                  }}
                >
                  Add
                </Button>
              </div>
              {priorityDrafts.length === 0 ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  No priority fields
                </div>
              ) : (
                <div className="space-y-2">
                  {priorityDrafts.map((field) => (
                    <div key={field.id} className="grid grid-cols-[1fr_132px_auto] items-center gap-2">
                      <Input
                        value={field.field_name}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPriorityDrafts((prev) =>
                            prev.map((entry) =>
                              entry.id === field.id ? { ...entry, field_name: value } : entry
                            )
                          );
                        }}
                        onBlur={() => {
                          persistPriorityDrafts(priorityDraftsRef.current);
                        }}
                        placeholder="Field name"
                      />
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          const next = priorityDrafts.map((entry) =>
                            entry.id === field.id ? { ...entry, value: value as Priority } : entry
                          );
                          setPriorityDrafts(next);
                          persistPriorityDrafts(next);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                                  PRIORITY_COLORS[option.value]
                                )}
                              >
                                {option.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const next = priorityDrafts.filter((entry) => entry.id !== field.id);
                          setPriorityDrafts(next);
                          persistPriorityDrafts(next);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ================================================================
                Assignees (named fields)
            ================================================================ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Assignees</Label>
                {!assigneesDisabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = [
                        ...assigneeDrafts,
                        {
                          id: `assignee-new-${Date.now()}`,
                          field_name: getNextAssigneeFieldName(assigneeDrafts),
                          value: [],
                        } as AssigneeFieldDraft,
                      ];
                      setAssigneeDrafts(next);
                      persistAssigneeDrafts(next);
                    }}
                  >
                    Add
                  </Button>
                )}
              </div>
              {assigneesDisabled ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Derived</span>
                </div>
              ) : assigneeDrafts.length === 0 ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  No assignee fields
                </div>
              ) : (
                <div className="space-y-2">
                  {assigneeDrafts.map((field) => {
                    const unassignedMembers = members.filter((m) => !field.value.includes(m.user_id));
                    return (
                      <div key={field.id} className="space-y-1.5 rounded-md border border-[var(--border)] p-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={field.field_name}
                            onChange={(e) => {
                              const value = e.target.value;
                              setAssigneeDrafts((prev) =>
                                prev.map((entry) => entry.id === field.id ? { ...entry, field_name: value } : entry)
                              );
                            }}
                            onBlur={() => persistAssigneeDrafts(assigneeDraftsRef.current)}
                            placeholder="Field name"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const next = assigneeDrafts.filter((entry) => entry.id !== field.id);
                              setAssigneeDrafts(next);
                              persistAssigneeDrafts(next);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                          {field.value.length === 0 && (
                            <span className="text-xs text-[var(--muted-foreground)]">Unassigned</span>
                          )}
                          {field.value.map((uid) => {
                            const member = memberLookup.get(uid);
                            const label = member?.name || member?.email || "Unknown";
                            return (
                              <span
                                key={uid}
                                className="inline-flex items-center gap-1 rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
                              >
                                <User className="h-3 w-3" />
                                {label}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = assigneeDrafts.map((entry) =>
                                      entry.id === field.id
                                        ? { ...entry, value: entry.value.filter((id) => id !== uid) }
                                        : entry
                                    );
                                    setAssigneeDrafts(next);
                                    persistAssigneeDrafts(next);
                                  }}
                                  className="ml-1 hover:text-[var(--error)] transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            );
                          })}
                          {unassignedMembers.length > 0 && (
                            <Select
                              value="_add"
                              onValueChange={(value) => {
                                if (!value || value === "_add") return;
                                const next = assigneeDrafts.map((entry) =>
                                  entry.id === field.id && !entry.value.includes(value)
                                    ? { ...entry, value: [...entry.value, value] }
                                    : entry
                                );
                                setAssigneeDrafts(next);
                                persistAssigneeDrafts(next);
                              }}
                            >
                              <SelectTrigger className="h-6 w-auto min-w-[100px] border-0 bg-transparent shadow-none focus:ring-0 text-[var(--muted-foreground)] text-xs">
                                <SelectValue placeholder="Add..." />
                              </SelectTrigger>
                              <SelectContent>
                                {unassignedMembers.map((member) => (
                                  <SelectItem key={member.user_id} value={member.user_id}>
                                    <span className="flex items-center gap-2">
                                      <User className="h-4 w-4" />
                                      {member.name || member.email}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ================================================================
                Due Dates (named fields)
            ================================================================ */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Due Dates</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = [
                      ...dueDateDrafts,
                      {
                        id: `due-date-new-${Date.now()}`,
                        field_name: getNextDueDateFieldName(dueDateDrafts),
                        value: { start: null, end: null },
                      } as DueDateFieldDraft,
                    ];
                    setDueDateDrafts(next);
                    persistDueDateDrafts(next);
                  }}
                >
                  Add
                </Button>
              </div>
              {dueDateDrafts.length === 0 ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  No date fields
                </div>
              ) : (
                <div className="space-y-2">
                  {dueDateDrafts.map((field) => (
                    <div key={field.id} className="space-y-1.5 rounded-md border border-[var(--border)] p-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={field.field_name}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDueDateDrafts((prev) =>
                              prev.map((entry) => entry.id === field.id ? { ...entry, field_name: value } : entry)
                            );
                          }}
                          onBlur={() => persistDueDateDrafts(dueDateDraftsRef.current)}
                          placeholder="Field name"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const next = dueDateDrafts.filter((entry) => entry.id !== field.id);
                            setDueDateDrafts(next);
                            persistDueDateDrafts(next);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span>Start</span>
                        <input
                          type="date"
                          value={field.value.start ?? ""}
                          onChange={(e) => {
                            const start = e.target.value || null;
                            const next = dueDateDrafts.map((entry) =>
                              entry.id === field.id ? { ...entry, value: { ...entry.value, start } } : entry
                            );
                            setDueDateDrafts(next);
                            persistDueDateDrafts(next);
                          }}
                          className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
                        />
                        <span>→</span>
                        <input
                          type="date"
                          value={field.value.end ?? ""}
                          onChange={(e) => {
                            const end = e.target.value || null;
                            const next = dueDateDrafts.map((entry) =>
                              entry.id === field.id ? { ...entry, value: { ...entry.value, end } } : entry
                            );
                            setDueDateDrafts(next);
                            persistDueDateDrafts(next);
                          }}
                          className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
                        />
                        {(field.value.start || field.value.end) && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = dueDateDrafts.map((entry) =>
                                entry.id === field.id ? { ...entry, value: { start: null, end: null } } : entry
                              );
                              setDueDateDrafts(next);
                              persistDueDateDrafts(next);
                            }}
                            className="hover:text-[var(--error)] transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ================================================================
                Tags
            ================================================================ */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tags</Label>
              {projectId && projectTagBank.length > 0 && (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)] mb-1">Project tag bank</p>
                  <div className="flex flex-wrap gap-1">
                    {projectTagBank.map((tag) => {
                      const currentTags = direct?.tags || [];
                      const isOnEntity = currentTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (!isOnEntity) addTagMutation.mutate(tag);
                          }}
                          disabled={isOnEntity}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors",
                            isOnEntity
                              ? "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] cursor-default"
                              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                          )}
                        >
                          <TagIcon className="h-3 w-3" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {(direct?.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    <TagIcon className="h-3 w-3" />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-[var(--error)] transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tag..."
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PropertyMenu;
