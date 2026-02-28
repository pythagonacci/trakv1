"use client";

// Trak Universal Properties - Property Menu Component
// Popover menu for managing fixed properties (status, priority, assignee, due date, tags).
// When anchorRef is provided, opens as a dropdown from the trigger; otherwise falls back to centered dialog.

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { X, User, Tag as TagIcon, Save, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { normalizeDueDateRange } from "@/lib/due-date";
import {
  useEntityProperties,
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
  /** When set, the menu opens as a popover anchored to this element (e.g. the three-dots trigger). */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Captured at open time (e.g. trigger.getBoundingClientRect()) so position stays fixed and doesn't follow cursor. */
  anchorRect?: DOMRect | null;
  /** When set, the project's tag bank is shown and new tags are saved to the project. */
  projectId?: string;
  disabledFields?: Partial<{
    status: boolean;
    priority: boolean;
    assignees: boolean;
    dueDate: boolean;
    tags: boolean;
  }>;
  /**
   * Optional focus descriptor used when the caller wants to show
   * only a single property group (e.g. just one priority field)
   * instead of the full properties menu.
   */
  focus?: {
    group: "status" | "priority" | "assignees" | "due_date" | "tags";
    fieldId?: string;
  } | null;
  /**
   * When status (or assignees) is disabled because it's derived (e.g. from subtasks),
   * pass the effective value here so the menu shows the correct label instead of
   * the stored value.
   */
  displayStatus?: Status | null;
  displayAssigneeIds?: string[] | null;
}

// ============================================================================
// Draft types
// ============================================================================

type StatusFieldDraft = { id: string; field_name: string; value: Status | null };
type PriorityFieldDraft = { id: string; field_name: string; value: Priority | null };
type AssigneeFieldDraft = { id: string; field_name: string; value: string[] };
type DueDateFieldDraft = { id: string; field_name: string; value: DueDateRange };

// ============================================================================
// Build draft helpers
// ============================================================================

const STATUS_NONE = "__none__" as const;

function buildStatusDrafts(
  direct: { statuses?: Array<{ id?: string; field_name?: string; value?: Status | null }>; status?: Status | null } | null | undefined
): StatusFieldDraft[] {
  const named = Array.isArray(direct?.statuses)
    ? direct!.statuses
        .map((field, index) => {
          const fieldName = String(field?.field_name ?? "").trim();
          const value = field?.value ?? null;
          if (!fieldName) return null;
          const valid = value === null || value === "todo" || value === "in_progress" || value === "blocked" || value === "done";
          if (!valid) return null;
          return {
            id: String(field?.id ?? `status-${index}-${fieldName.toLowerCase()}`),
            field_name: fieldName,
            value,
          } as StatusFieldDraft;
        })
        .filter((f): f is StatusFieldDraft => Boolean(f))
    : [];
  if (named.length > 0) return named;
  // Always one default editable Status field (empty until user selects)
  return [{ id: "status-default", field_name: "Status", value: direct?.status ?? null }];
}

function buildPriorityDrafts(
  direct: { priorities?: Array<{ id?: string; field_name?: string; value?: Priority | null }>; priority?: Priority | null } | null | undefined
): PriorityFieldDraft[] {
  const named = Array.isArray(direct?.priorities)
    ? direct!.priorities
        .map((field, index) => {
          const fieldName = String(field?.field_name ?? "").trim();
          const value = field?.value ?? null;
          if (!fieldName) return null;
          const valid = value === null || value === "low" || value === "medium" || value === "high" || value === "urgent";
          if (!valid) return null;
          return {
            id: String(field?.id ?? `priority-${index}-${fieldName.toLowerCase()}`),
            field_name: fieldName,
            value,
          } as PriorityFieldDraft;
        })
        .filter((field): field is PriorityFieldDraft => Boolean(field))
    : [];

  if (named.length > 0) return named;
  // Always one default editable Priority field (empty until user selects)
  return [{ id: "priority-default", field_name: "Priority", value: direct?.priority ?? null }];
}

const PRIORITY_NONE = "__none__" as const;

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

// Screenshot-style UI: dot tone, section, divider
const STATUS_TONE: Record<Status, "green" | "blue" | "amber" | "red" | "neutral"> = {
  todo: "neutral",
  in_progress: "blue",
  done: "green",
  blocked: "red",
};
const PRIORITY_TONE: Record<Priority, "green" | "blue" | "amber" | "red" | "neutral"> = {
  low: "neutral",
  medium: "amber",
  high: "red",
  urgent: "red",
};

function Dot({ tone }: { tone: "green" | "blue" | "amber" | "red" | "neutral" }) {
  const map: Record<typeof tone, string> = {
    green: "bg-[var(--success)]",
    blue: "bg-[var(--primary)]",
    amber: "bg-[var(--warning)]",
    red: "bg-[var(--error)]",
    neutral: "bg-[var(--tertiary-foreground)]/50",
  };
  return <span className={cn("h-1 w-1 rounded-full shrink-0", map[tone])} />;
}

function PopoverSection({
  title,
  onAdd,
  children,
}: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div className="px-0 py-1">
      <div className="flex items-center justify-between pb-0.5">
        <div className="text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {title}
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label={`Add ${title}`}
          >
            <span className="text-xs leading-none">+</span>
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function PopoverDivider() {
  return <div className="mx-0 border-t border-[var(--border)]" />;
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
  anchorRef,
  anchorRect,
  projectId,
  disabledFields,
  focus,
  displayStatus,
  displayAssigneeIds,
}: PropertyMenuProps) {
  const [newTagInput, setNewTagInput] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<StatusFieldDraft[]>([]);
  const { data: projectTagBank = [] } = useProjectTags(projectId);
  const addProjectTagMutation = useAddProjectTag(projectId);
  const [priorityDrafts, setPriorityDrafts] = useState<PriorityFieldDraft[]>([]);
  const [assigneeDrafts, setAssigneeDrafts] = useState<AssigneeFieldDraft[]>([]);
  const [dueDateDrafts, setDueDateDrafts] = useState<DueDateFieldDraft[]>([]);

  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  const { data: direct, isLoading } =
    useEntityProperties(entityType, entityId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const setProperties = useSetEntityProperties(entityType, entityId, workspaceId);
  const addTagMutation = useAddTag(entityType, entityId, workspaceId);
  const removeTagMutation = useRemoveTag(entityType, entityId, workspaceId);
  const statusDisabled = Boolean(disabledFields?.status);
  const assigneesDisabled = Boolean(disabledFields?.assignees);
  const priorityDisabled = Boolean(disabledFields?.priority);
  const dueDateDisabled = Boolean(disabledFields?.dueDate);
  const tagsDisabled = Boolean(disabledFields?.tags);
  const allFieldsDisabled =
    statusDisabled && assigneesDisabled && priorityDisabled && dueDateDisabled && tagsDisabled;

  const focusedGroup = focus?.group;
  const usePopover = Boolean(open && (anchorRect ?? anchorRef?.current));

  // Position popover once from captured anchorRect (or single read of anchorRef). No continuous observation so it doesn't follow cursor.
  useEffect(() => {
    if (!open) {
      setPopoverPosition(null);
      return;
    }
    const gap = 4;
    const panelWidth = 280;
    const margin = 8;
    const estimatedHeight = 320;
    let rect: DOMRect | null = null;
    if (anchorRect) {
      rect = anchorRect;
    } else if (anchorRef?.current) {
      rect = anchorRef.current.getBoundingClientRect();
    }
    if (!rect) return;
    let left = rect.left;
    let top = rect.bottom + gap;
    if (left + panelWidth > window.innerWidth - margin) left = window.innerWidth - panelWidth - margin;
    if (left < margin) left = margin;
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = rect.top - estimatedHeight - gap;
      if (top < margin) top = margin;
    }
    setPopoverPosition({ left, top });
    const onResize = () => {
      setPopoverPosition((prev) => {
        if (!prev) return null;
        let l = prev.left;
        let t = prev.top;
        if (l + panelWidth > window.innerWidth - margin) l = window.innerWidth - panelWidth - margin;
        if (l < margin) l = margin;
        if (t + estimatedHeight > window.innerHeight - margin) t = window.innerHeight - estimatedHeight - margin;
        if (t < margin) t = margin;
        return l === prev.left && t === prev.top ? prev : { left: l, top: t };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, anchorRect, anchorRef]);

  // Click-outside is handled by the backdrop div rendered in the portal (see below).
  // We do NOT use a document-level click listener because Radix Select v2 unmounts
  // its portal content on pointerdown (before the click event fires), so any
  // composedPath / contains check against the Radix portal wrapper is unreliable.

  const memberLookup = React.useMemo(() => {
    const map = new Map<string, (typeof members)[number]>();
    members.forEach((member) => {
      map.set(member.id, member);
      if (member.user_id) map.set(member.user_id, member);
    });
    return map;
  }, [members]);

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
    if (allFieldsDisabled) return;
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
    if (allFieldsDisabled) return;
    removeTagMutation.mutate(tag);
  };

  const handleSave = () => {
    if (allFieldsDisabled) {
      onOpenChange(false);
      return;
    }
    // Build one combined update and fire a single mutation to avoid race conditions.
    // Firing 4 separate mutations simultaneously caused each to call getEntityProperties
    // before the others had inserted their rows, triggering false "no rows" errors.
    const normalizedStatuses = deduplicateByName(statusDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
    const normalizedPriorities = deduplicateByName(priorityDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
    const normalizedAssignees = deduplicateByName(assigneeDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
    const normalizedDueDates = deduplicateByName(dueDateDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
    setProperties.mutate({
      statuses: normalizedStatuses.length > 0 ? normalizedStatuses : null,
      priorities: normalizedPriorities.length > 0 ? normalizedPriorities : null,
      assignees: normalizedAssignees.length > 0 ? normalizedAssignees : null,
      due_dates: normalizedDueDates.length > 0 ? normalizedDueDates : null,
    });
    onOpenChange(false);
  };

  const formContent = isLoading ? (
    <div className="text-[11px] text-[var(--muted-foreground)] py-2">Loading...</div>
  ) : usePopover ? (
    <div className="space-y-0 max-h-[min(70vh,340px)] overflow-y-auto">
      {(focusedGroup === undefined || focusedGroup === "status") && (
        <>
          <PopoverSection
            title="Statuses"
            onAdd={statusDisabled ? undefined : () => setStatusDrafts((prev) => [...prev, { id: `status-new-${Date.now()}`, field_name: getNextStatusFieldName(prev), value: direct?.status ?? null } as StatusFieldDraft])}
          >
            {statusDisabled ? (
              <div className="rounded px-1.5 py-1 text-[11px] text-[var(--muted-foreground)]">
                {(displayStatus ?? direct?.status) ? STATUS_OPTIONS.find((o) => o.value === (displayStatus ?? direct?.status))?.label || (displayStatus ?? direct?.status) : "None"} <span className="text-[9px] uppercase text-[var(--tertiary-foreground)]">(Derived)</span>
              </div>
            ) : (
              statusDrafts.map((field) => (
                <div key={field.id} className="group rounded px-1.5 py-1 hover:bg-[var(--surface-hover)]">
                  <div className="text-[11px] font-medium text-[var(--muted-foreground)]">{field.field_name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Dot tone={field.value ? STATUS_TONE[field.value] : "neutral"} />
                      <Select value={field.value ?? STATUS_NONE} onValueChange={(v) => { const next = v === STATUS_NONE ? null : (v as Status); setStatusDrafts((prev) => prev.map((e) => e.id === field.id ? { ...e, value: next } : e)); }}>
                        <SelectTrigger className="h-6 border-0 shadow-none gap-0.5 text-[11px] font-semibold p-0 bg-transparent">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={STATUS_NONE}>None</SelectItem>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}><span className={cn("font-medium", STATUS_COLORS[opt.value])}>{opt.label}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {statusDrafts.length > 1 && (
                        <button type="button" onClick={() => setStatusDrafts((prev) => prev.filter((e) => e.id !== field.id))} className="rounded p-0.5 hover:bg-[var(--surface)] text-[var(--muted-foreground)]"><X className="h-2.5 w-2.5" /></button>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </PopoverSection>
          <PopoverDivider />
        </>
      )}
      {(focusedGroup === undefined || focusedGroup === "priority") && (
        <>
          <PopoverSection
            title="Priorities"
            onAdd={
              focusedGroup === undefined && !priorityDisabled
                ? () =>
                    setPriorityDrafts((prev) => [
                      ...prev,
                      {
                        id: `priority-new-${Date.now()}`,
                        field_name: getNextPriorityFieldName(prev),
                        value: direct?.priority ?? null,
                      } as PriorityFieldDraft,
                    ])
                : undefined
            }
          >
            {priorityDisabled ? (
              <div className="rounded px-1.5 py-1 text-[11px] space-y-1">
                {priorityDrafts.length === 0 ? (
                  <div className="text-[var(--muted-foreground)]">None</div>
                ) : (
                  priorityDrafts.map((field) => {
                    const opt = field.value ? PRIORITY_OPTIONS.find((o) => o.value === field.value) : null;
                    const label = opt?.label ?? "None";
                    const tone = field.value ? PRIORITY_TONE[field.value] : "neutral";
                    const colorClass = field.value ? PRIORITY_COLORS[field.value] : "";
                    return (
                      <div key={field.id} className="flex items-center gap-1.5">
                        <Dot tone={tone} />
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium",
                            colorClass
                          )}
                        >
                          {field.field_name && field.field_name.toLowerCase() !== "priority"
                            ? `${field.field_name}: ${label}`
                            : label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              priorityDrafts
                .filter((f) => (focusedGroup === "priority" && focus?.fieldId ? f.id === focus.fieldId : true))
                .map((field) => (
                  <div key={field.id} className="group rounded px-1.5 py-1 hover:bg-[var(--surface-hover)]">
                    <div className="text-[11px] font-medium text-[var(--muted-foreground)]">{field.field_name}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Dot tone={field.value ? PRIORITY_TONE[field.value] : "neutral"} />
                        <Select
                          value={field.value ?? PRIORITY_NONE}
                          onValueChange={(v) => {
                            const next = v === PRIORITY_NONE ? null : (v as Priority);
                            setPriorityDrafts((prev) =>
                              prev.map((e) => (e.id === field.id ? { ...e, value: next } : e))
                            );
                          }}
                        >
                          <SelectTrigger className="h-6 border-0 shadow-none gap-0.5 text-[11px] font-semibold p-0 bg-transparent">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PRIORITY_NONE}>None</SelectItem>
                            {PRIORITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className={cn("font-medium", PRIORITY_COLORS[opt.value])}>{opt.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {priorityDrafts.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPriorityDrafts((prev) => prev.filter((e) => e.id !== field.id))
                            }
                            className="rounded p-0.5 hover:bg-[var(--surface)] text-[var(--muted-foreground)]"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      </div>
                    </div>
                  </div>
                ))
            )}
          </PopoverSection>
          <PopoverDivider />
        </>
      )}
      {(focusedGroup === undefined || focusedGroup === "assignees") && (
        <>
          <PopoverSection
            title="Assignees"
            onAdd={assigneesDisabled ? undefined : () => setAssigneeDrafts((prev) => [...prev, { id: `assignee-new-${Date.now()}`, field_name: getNextAssigneeFieldName(prev), value: [] } as AssigneeFieldDraft])}
          >
            {assigneesDisabled ? (
              <div className="rounded px-1.5 py-1 text-[11px] text-[var(--muted-foreground)]">Derived</div>
            ) : assigneeDrafts.length === 0 ? (
              <div className="rounded px-1.5 py-1 text-[11px] text-[var(--muted-foreground)]">No assignee fields yet</div>
            ) : (
              assigneeDrafts.filter((f) => focusedGroup === "assignees" && focus?.fieldId ? f.id === focus.fieldId : true).map((field) => {
                const names = field.value.map((uid) => memberLookup.get(uid)?.name || memberLookup.get(uid)?.email || "Unknown");
                return (
                  <div key={field.id} className="rounded px-1.5 py-1 hover:bg-[var(--surface-hover)]">
                    <div className="text-[11px] font-medium text-[var(--muted-foreground)]">{field.field_name}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Dot tone="neutral" />
                        <span className="text-[11px] font-semibold truncate">{names.length ? names.join(", ") : "Unassigned"}</span>
                        {members.filter((m) => !field.value.includes(m.user_id)).length > 0 && (
                          <Select value="_add" onValueChange={(v) => { if (v && v !== "_add") setAssigneeDrafts((prev) => prev.map((e) => e.id === field.id && !e.value.includes(v) ? { ...e, value: [...e.value, v] } : e)); }}>
                            <SelectTrigger className="h-5 border-0 shadow-none text-[10px] p-0 bg-transparent text-[var(--muted-foreground)] min-w-0 w-auto"><SelectValue placeholder="Add..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_add" className="hidden">Add...</SelectItem>
                              {members.filter((m) => !field.value.includes(m.user_id)).map((member) => (
                                <SelectItem key={member.user_id} value={member.user_id}>{member.name || member.email}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {field.value.map((uid) => (
                          <button key={uid} type="button" onClick={() => setAssigneeDrafts((prev) => prev.map((e) => e.id === field.id ? { ...e, value: e.value.filter((id) => id !== uid) } : e))} className="rounded p-0.5 hover:text-[var(--error)]"><X className="h-2.5 w-2.5" /></button>
                        ))}
                        {assigneeDrafts.length > 1 && (
                          <button type="button" onClick={() => setAssigneeDrafts((prev) => prev.filter((e) => e.id !== field.id))} className="rounded p-0.5 text-[var(--muted-foreground)]"><X className="h-2.5 w-2.5" /></button>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </PopoverSection>
          <PopoverDivider />
        </>
      )}
      {(focusedGroup === undefined || focusedGroup === "due_date") && (
        <>
          <PopoverSection
            title="Due dates"
            onAdd={
              focusedGroup === undefined && !dueDateDisabled
                ? () =>
                    setDueDateDrafts((prev) => [
                      ...prev,
                      {
                        id: `due-date-new-${Date.now()}`,
                        field_name: getNextDueDateFieldName(prev),
                        value: { start: null, end: null },
                      } as DueDateFieldDraft,
                    ])
                : undefined
            }
          >
            {dueDateDrafts
              .filter((f) => (focusedGroup === "due_date" && focus?.fieldId ? f.id === focus.fieldId : true))
              .map((field) => {
                const startStr = field.value.start ? format(new Date(field.value.start), "MMM d, yyyy") : null;
                const endStr = field.value.end ? format(new Date(field.value.end), "MMM d, yyyy") : null;
                return (
                  <div key={field.id} className="rounded px-1.5 py-1 hover:bg-[var(--surface-hover)]">
                    <div className="text-[11px] font-medium text-[var(--muted-foreground)]">{field.field_name}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Dot tone="neutral" />
                        <span className="text-[11px] font-semibold whitespace-nowrap">
                          {startStr ?? "—"}
                          <span className="text-[var(--muted-foreground)] font-medium"> {"\u2192"} </span>
                          {endStr ?? "—"}
                        </span>
                      </div>
                      {!dueDateDisabled && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input
                            type="date"
                            value={field.value.start ?? ""}
                            onChange={(e) =>
                              setDueDateDrafts((prev) =>
                                prev.map((entry) =>
                                  entry.id === field.id
                                    ? { ...entry, value: { ...entry.value, start: e.target.value || null } }
                                    : entry
                                )
                              )
                            }
                            className="w-20 text-[10px] rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5"
                          />
                          <input
                            type="date"
                            value={field.value.end ?? ""}
                            onChange={(e) =>
                              setDueDateDrafts((prev) =>
                                prev.map((entry) =>
                                  entry.id === field.id
                                    ? { ...entry, value: { ...entry.value, end: e.target.value || null } }
                                    : entry
                                )
                              )
                            }
                            className="w-20 text-[10px] rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5"
                          />
                          {dueDateDrafts.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDueDateDrafts((prev) => prev.filter((e) => e.id !== field.id))
                              }
                              className="rounded p-0.5 text-[var(--muted-foreground)]"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </PopoverSection>
          <PopoverDivider />
        </>
      )}
      {(focusedGroup === undefined || focusedGroup === "tags") && (
        <>
          <div className="text-[10px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase pt-2 pb-0.5">Tags</div>
          {projectId && projectTagBank.length > 0 && (
            <div className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 mb-0.5">
              <p className="text-[9px] uppercase tracking-wide text-[var(--tertiary-foreground)] mb-0.5">Project tag bank</p>
              <div className="flex flex-wrap gap-0.5">
                {projectTagBank.map((tag) => {
                  const currentTags = direct?.tags || [];
                  const isOnEntity = currentTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={isOnEntity || tagsDisabled}
                      onClick={() => {
                        if (!isOnEntity && !tagsDisabled) {
                          addTagMutation.mutate(tag, {
                            onSuccess: () => projectId && addProjectTagMutation.mutate(tag),
                          });
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px]",
                        isOnEntity || tagsDisabled
                          ? "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]"
                          : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      <TagIcon className="h-2.5 w-2.5" />{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!tagsDisabled && (
            <div className="flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 focus-within:ring-1 focus-within:ring-[var(--focus-ring)]">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag…"
                className="h-6 flex-1 min-w-0 bg-transparent text-[11px] placeholder:text-[var(--muted-foreground)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
                aria-label="Add tag"
              >
                <span className="text-xs leading-none">+</span>
              </button>
            </div>
          )}
          {(direct?.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {(direct?.tags ?? []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[10px]">
                  <TagIcon className="h-2 w-2" />
                  {tag}
                  {!tagsDisabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-[var(--error)]"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  ) : (
    <div className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
      {(focusedGroup === undefined || focusedGroup === "status" || focusedGroup === "priority") && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      {(focusedGroup === undefined || focusedGroup === "status") && (
                        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-[var(--foreground)]">
                          Statuses
                        </Label>
                        {!statusDisabled && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[11px]"
                            onClick={() =>
                              setStatusDrafts((prev) => [
                                ...prev,
                                {
                                  id: `status-new-${Date.now()}`,
                                  field_name: getNextStatusFieldName(prev),
                                  value: direct?.status ?? null,
                                } as StatusFieldDraft,
                              ])
                            }
                          >
                            Add
                          </Button>
                        )}
                      </div>
                      {statusDisabled ? (
                        <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                          {(displayStatus ?? direct?.status)
                            ? STATUS_OPTIONS.find((o) => o.value === (displayStatus ?? direct?.status))?.label || (displayStatus ?? direct?.status)
                            : "None"}{" "}
                          <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                            (Derived)
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {statusDrafts.map((field) => (
                            <div key={field.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-1.5">
                              <Input
                                value={field.field_name}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setStatusDrafts((prev) =>
                                    prev.map((entry) => entry.id === field.id ? { ...entry, field_name: value } : entry)
                                  );
                                }}
                                placeholder="Name"
                                className="h-7 min-w-0 text-xs"
                              />
                              <Select
                                value={field.value ?? STATUS_NONE}
                                onValueChange={(value) => {
                                  const nextValue = value === STATUS_NONE ? null : (value as Status);
                                  setStatusDrafts((prev) =>
                                    prev.map((entry) =>
                                      entry.id === field.id ? { ...entry, value: nextValue } : entry
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger className="h-7 w-full max-w-[130px] min-w-0 text-xs">
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent className="max-w-[130px]">
                                  <SelectItem value={STATUS_NONE}>
                                    <span className="text-xs text-[var(--muted-foreground)]">None</span>
                                  </SelectItem>
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", STATUS_COLORS[option.value])}>
                                        {option.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {statusDrafts.length > 1 && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() =>
                                    setStatusDrafts((prev) => prev.filter((entry) => entry.id !== field.id))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                      )}
      
                      {(focusedGroup === undefined || focusedGroup === "priority") && (
                        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium text-[var(--foreground)]">
                              Priorities
                            </Label>
                            {focusedGroup === undefined && !priorityDisabled && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[11px]"
                                onClick={() =>
                                  setPriorityDrafts((prev) => [
                                    ...prev,
                                    {
                                      id: `priority-new-${Date.now()}`,
                                      field_name: getNextPriorityFieldName(prev),
                                      value: direct?.priority ?? null,
                                    } as PriorityFieldDraft,
                                  ])
                                }
                              >
                                Add
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {priorityDrafts
                              .filter((field) =>
                                focusedGroup === "priority" && focus?.fieldId
                                  ? field.id === focus.fieldId
                                  : true
                              )
                              .map((field) => (
                                <div key={field.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-1.5">
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
                                    placeholder="Name"
                                    className="h-7 min-w-0 text-xs"
                                  />
                                  <Select
                                    value={field.value ?? PRIORITY_NONE}
                                    onValueChange={(value) => {
                                      const nextValue = value === PRIORITY_NONE ? null : (value as Priority);
                                      setPriorityDrafts((prev) =>
                                        prev.map((entry) =>
                                          entry.id === field.id ? { ...entry, value: nextValue } : entry
                                        )
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-7 w-full max-w-[130px] min-w-0 text-xs">
                                      <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-[130px]">
                                      <SelectItem value={PRIORITY_NONE}>
                                        <span className="text-xs text-[var(--muted-foreground)]">None</span>
                                      </SelectItem>
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
                                  {priorityDrafts.length > 1 && (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() =>
                                        setPriorityDrafts((prev) => prev.filter((entry) => entry.id !== field.id))
                                      }
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
      
                  {/* Assignees + Due Dates in one row */}
                  {(focusedGroup === undefined || focusedGroup === "assignees" || focusedGroup === "due_date") && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      {/* Assignees (named fields) */}
                      {(focusedGroup === undefined || focusedGroup === "assignees") && (
                        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium text-[var(--foreground)]">
                              Assignees
                            </Label>
                            {!assigneesDisabled && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[11px]"
                                onClick={() =>
                                  setAssigneeDrafts((prev) => [
                                    ...prev,
                                    {
                                      id: `assignee-new-${Date.now()}`,
                                      field_name: getNextAssigneeFieldName(prev),
                                      value: [],
                                    } as AssigneeFieldDraft,
                                  ])
                                }
                              >
                                Add
                              </Button>
                            )}
                          </div>
                          {assigneesDisabled ? (
                            <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                              <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                                Derived
                              </span>
                            </div>
                          ) : assigneeDrafts.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                              No assignee fields yet
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {assigneeDrafts
                                .filter((field) =>
                                  focusedGroup === "assignees" && focus?.fieldId ? field.id === focus.fieldId : true
                                )
                                .map((field) => {
                                  const unassignedMembers = members.filter((m) => !field.value.includes(m.user_id));
                                  return (
                                    <div
                                      key={field.id}
                                      className="space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] p-2"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          value={field.field_name}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setAssigneeDrafts((prev) =>
                                              prev.map((entry) =>
                                                entry.id === field.id ? { ...entry, field_name: value } : entry
                                              )
                                            );
                                          }}
                                          placeholder="Name"
                                          className="h-7 w-[72px] min-w-0 shrink-0 text-xs"
                                        />
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 shrink-0"
                                          onClick={() =>
                                            setAssigneeDrafts((prev) => prev.filter((entry) => entry.id !== field.id))
                                          }
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="flex flex-wrap gap-1 min-h-[24px]">
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
                                                onClick={() =>
                                                  setAssigneeDrafts((prev) =>
                                                    prev.map((entry) =>
                                                      entry.id === field.id
                                                        ? { ...entry, value: entry.value.filter((id) => id !== uid) }
                                                        : entry
                                                    )
                                                  )
                                                }
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
                                              setAssigneeDrafts((prev) =>
                                                prev.map((entry) =>
                                                  entry.id === field.id && !entry.value.includes(value)
                                                    ? { ...entry, value: [...entry.value, value] }
                                                    : entry
                                                )
                                              );
                                            }}
                                          >
                                            <SelectTrigger className="h-6 w-auto min-w-[100px] max-w-[160px] border-0 bg-transparent shadow-none focus:ring-0 text-[var(--muted-foreground)] text-xs">
                                              <SelectValue placeholder="Add..." />
                                            </SelectTrigger>
                                            <SelectContent className="max-w-[200px]">
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
                      )}
      
                      {/* Due Dates (named fields) */}
                      {(focusedGroup === undefined || focusedGroup === "due_date") && (
                        <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium text-[var(--foreground)]">
                              Due Dates
                            </Label>
                            {focusedGroup === undefined && !dueDateDisabled && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[11px]"
                                onClick={() =>
                                  setDueDateDrafts((prev) => [
                                    ...prev,
                                    {
                                      id: `due-date-new-${Date.now()}`,
                                      field_name: getNextDueDateFieldName(prev),
                                      value: { start: null, end: null },
                                    } as DueDateFieldDraft,
                                  ])
                                }
                              >
                                Add
                              </Button>
                            )}
                          </div>
                          {dueDateDrafts.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                              No date fields yet
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {dueDateDrafts
                                .filter((field) =>
                                  focusedGroup === "due_date" && focus?.fieldId ? field.id === focus.fieldId : true
                                )
                                .map((field) => (
                                  <div
                                    key={field.id}
                                    className="space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] p-2"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        value={field.field_name}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setDueDateDrafts((prev) =>
                                            prev.map((entry) =>
                                              entry.id === field.id ? { ...entry, field_name: value } : entry
                                            )
                                          );
                                        }}
                                        placeholder="Name"
                                        className="h-7 w-[72px] min-w-0 shrink-0 text-xs"
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 shrink-0"
                                        onClick={() =>
                                          setDueDateDrafts((prev) => prev.filter((entry) => entry.id !== field.id))
                                        }
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                                      <span className="shrink-0">Start</span>
                                      <input
                                        type="date"
                                        value={field.value.start ?? ""}
                                        onChange={(e) => {
                                          const start = e.target.value || null;
                                          setDueDateDrafts((prev) =>
                                            prev.map((entry) =>
                                              entry.id === field.id ? { ...entry, value: { ...entry.value, start } } : entry
                                            )
                                          );
                                        }}
                                        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--foreground)]"
                                      />
                                      <span className="shrink-0">→</span>
                                      <input
                                        type="date"
                                        value={field.value.end ?? ""}
                                        onChange={(e) => {
                                          const end = e.target.value || null;
                                          setDueDateDrafts((prev) =>
                                            prev.map((entry) =>
                                              entry.id === field.id ? { ...entry, value: { ...entry.value, end } } : entry
                                            )
                                          );
                                        }}
                                        className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--foreground)]"
                                      />
                                      {(field.value.start || field.value.end) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDueDateDrafts((prev) =>
                                              prev.map((entry) =>
                                                entry.id === field.id ? { ...entry, value: { start: null, end: null } } : entry
                                              )
                                            )
                                          }
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
                      )}
                    </div>
                  )}
      
                  {/* ================================================================
                      Tags
                  ================================================================ */}
                  {(focusedGroup === undefined || focusedGroup === "tags") && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Tags</Label>
                    {projectId && projectTagBank.length > 0 && (
                      <div className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)] mb-0.5">Project tag bank</p>
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
                    <div className="flex flex-wrap gap-1 min-h-[24px]">
                      {(direct?.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-xs"
                        >
                          <TagIcon className="h-2.5 w-2.5" />
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-[var(--error)] transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
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
                        className="h-7 flex-1 text-xs"
                      />
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddTag}>
                        Add
                      </Button>
                    </div>
                  </div>
                  )}
    </div>
  );

  const footerContent = allFieldsDisabled ? null : (
    <div className="flex justify-end border-t border-[var(--border)] pt-4 mt-4">
      <Button
        type="button"
        size="sm"
        onClick={handleSave}
        disabled={isLoading || setProperties.isPending}
        className="h-7 gap-1.5 px-2 text-xs"
      >
        <Save className="h-3 w-3" />
        {setProperties.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );

  if (usePopover && popoverPosition) {
    return createPortal(
      <>
        {/* Backdrop: z-[99] sits below the menu (z-[100]) and below Radix portals (z-[200]).
            Uses onPointerDown (not onClick) because Radix DismissableLayer calls
            event.preventDefault() on pointerdown when closing a Select, which suppresses
            the subsequent click event — making onClick unreliable when a dropdown is open. */}
        <div className="fixed inset-0 z-[99]" onPointerDown={() => onOpenChange(false)} />
        <div
          className="z-[100] w-[280px] rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-popover flex flex-col max-h-[min(85vh,380px)]"
          style={{
            position: "fixed",
            left: popoverPosition.left,
            top: popoverPosition.top,
          }}
          role="dialog"
          aria-label="Properties"
        >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-2 py-1.5 shrink-0">
          <button
            type="button"
            onPointerDown={() => onOpenChange(false)}
            className="rounded px-1.5 py-0.5 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Back"
          >
            ←
          </button>
          <span className="text-[11px] font-semibold text-[var(--foreground)]">Properties</span>
          <button
            type="button"
            onPointerDown={() => onOpenChange(false)}
            className="rounded px-1.5 py-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 px-2 py-1.5">
          {formContent}
        </div>
        <div className="shrink-0 px-2 pb-2 pt-1.5 border-t border-[var(--border)]">
          <div className="flex justify-end">
            <Button type="button" size="sm" onPointerDown={handleSave} disabled={isLoading || setProperties.isPending} className="h-6 gap-1 px-1.5 text-[11px]">
              <Save className="h-2.5 w-2.5" />
              {setProperties.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
      </>,
      document.body
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] sm:max-w-[640px] p-4 sm:p-5">
        <DialogHeader className="mb-4 space-y-0.5">
          <DialogTitle className="text-sm font-semibold tracking-tight">
            Properties
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--muted-foreground)] line-clamp-1">
            {entityTitle
              ? `"${entityTitle}"`
              : `${entityType.replace("_", " ")}`}
          </DialogDescription>
        </DialogHeader>

        {formContent}
        <DialogFooter className="mt-4 pt-4 border-t border-[var(--border)] sm:justify-end">
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PropertyMenu;
