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
import { X, Calendar as CalendarIcon, User, Tag as TagIcon } from "lucide-react";
import { buildDueDateRange, formatDueDateRange, hasDueDate, normalizeDueDateRange } from "@/lib/due-date";
import { DateRangeCalendar } from "@/components/due-date-calendar";
import {
  useEntityPropertiesWithInheritance,
  useSetEntityProperties,
  useAddTag,
  useRemoveTag,
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type EntityType,
  type Status,
  type Priority,
} from "@/types/properties";

interface PropertyMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  workspaceId: string;
  entityTitle?: string;
  disabledFields?: Partial<{
    status: boolean;
    priority: boolean;
    assignees: boolean;
    dueDate: boolean;
    tags: boolean;
  }>;
}

type PriorityFieldDraft = { id: string; field_name: string; value: Priority };

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
    return [{ id: "priority-canonical", field_name: "Priority", value: direct.priority }];
  }
  return [];
}

function getNextPriorityFieldName(existing: PriorityFieldDraft[]): string {
  const existingLower = new Set(existing.map((field) => field.field_name.trim().toLowerCase()));
  if (!existingLower.has("priority")) return "Priority";
  let index = 2;
  while (existingLower.has(`priority ${index}`)) index += 1;
  return `Priority ${index}`;
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
  disabledFields,
}: PropertyMenuProps) {
  const [newTagInput, setNewTagInput] = useState("");
  const [priorityDrafts, setPriorityDrafts] = useState<PriorityFieldDraft[]>([]);
  const priorityDraftsRef = React.useRef<PriorityFieldDraft[]>([]);

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
      if (member.user_id) {
        map.set(member.user_id, member);
      }
    });
    return map;
  }, [members]);
  const selectedAssigneeIds: string[] = direct?.assignee_ids?.length
    ? direct.assignee_ids
    : direct?.assignee_id
      ? [direct.assignee_id]
      : [];
  const dueDateRange = normalizeDueDateRange(direct?.due_date);
  const hasDirectDueDate = Boolean(dueDateRange?.start || dueDateRange?.end);
  const dueDateLabel = formatDueDateRange(dueDateRange) ?? "No due date";

  React.useEffect(() => {
    priorityDraftsRef.current = priorityDrafts;
  }, [priorityDrafts]);

  React.useEffect(() => {
    if (!open) return;
    setPriorityDrafts(buildPriorityDrafts(direct));
  }, [open, direct?.updated_at, direct?.id]);

  const persistPriorityDrafts = React.useCallback(
    (nextDrafts: PriorityFieldDraft[]) => {
      const seenNames = new Set<string>();
      const normalized = nextDrafts
        .map((field) => ({
          field_name: field.field_name.trim(),
          value: field.value,
        }))
        .filter((field) => field.field_name.length > 0)
        .filter((field) => {
          const key = field.field_name.toLowerCase();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });

      setProperties.mutate({
        priorities: normalized.length > 0 ? normalized : null,
      });
    },
    [setProperties]
  );

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    addTagMutation.mutate(newTagInput.trim(), {
      onSuccess: () => setNewTagInput(""),
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
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              {statusDisabled ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  {direct?.status
                    ? STATUS_OPTIONS.find((option) => option.value === direct.status)?.label || direct.status
                    : "None"}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                    (Derived)
                  </span>
                </div>
              ) : (
                <Select
                  value={direct?.status || "none"}
                  onValueChange={(value) =>
                    setProperties.mutate({
                      status: value === "none" ? null : (value as Status),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-[var(--muted-foreground)]">None</span>
                    </SelectItem>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                            STATUS_COLORS[option.value]
                          )}
                        >
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Priorities (named fields) */}
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

            {/* Assignees (multiple) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assignees</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-[var(--border)] bg-[var(--background)]">
                {selectedAssigneeIds.length === 0 && (
                  <span className="text-xs text-[var(--muted-foreground)]">Unassigned</span>
                )}
                {selectedAssigneeIds.map((uid) => {
                  const member = memberLookup.get(uid);
                  const label = member?.name || member?.email || "Unknown";
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-xs"
                    >
                      <User className="h-3 w-3" />
                      {label}
                      {!assigneesDisabled && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = selectedAssigneeIds.filter((id) => id !== uid);
                            setProperties.mutate({ assignee_ids: next.length ? next : null });
                          }}
                          className="ml-1 hover:text-[var(--error)] transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
                {!assigneesDisabled && (
                  <Select
                    value="_add"
                    onValueChange={(value) => {
                      if (value === "_add" || !value) return;
                      if (value === "none") {
                        setProperties.mutate({ assignee_ids: null });
                        return;
                      }
                      if (!selectedAssigneeIds.includes(value)) {
                        setProperties.mutate({ assignee_ids: [...selectedAssigneeIds, value] });
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[120px] border-0 bg-transparent shadow-none focus:ring-0 text-[var(--muted-foreground)]">
                      <SelectValue placeholder="Add assignee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="flex items-center gap-2 text-[var(--muted-foreground)]">
                          <User className="h-4 w-4" />
                          Unassigned (clear all)
                        </span>
                      </SelectItem>
                      {members
                        .filter((m) => !selectedAssigneeIds.includes(m.user_id))
                        .map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {member.name || member.email}
                            </span>
                          </SelectItem>
                        ))}
                      {members.filter((m) => !selectedAssigneeIds.includes(m.user_id)).length === 0 && (
                        <SelectItem value="_none" disabled>
                          All members assigned
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {assigneesDisabled && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                    Derived
                  </span>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Due Date</Label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
                <DateRangeCalendar
                  range={{ start: dueDateRange?.start ?? null, end: dueDateRange?.end ?? null }}
                  onChange={(nextRange) =>
                    setProperties.mutate({
                      due_date: buildDueDateRange(nextRange.start, nextRange.end),
                    })
                  }
                />
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>Selection:</span>
                  <span className="font-medium text-[var(--foreground)]">{dueDateLabel}</span>
                </div>
                {hasDirectDueDate && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setProperties.mutate({ due_date: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tags</Label>
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
