"use client";

import React, { useState, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEntityProperties, useSetEntityProperties } from "@/lib/hooks/use-property-queries";
import {
  PRIORITY_OPTIONS,
  PRIORITY_COLORS,
  STATUS_OPTIONS,
  STATUS_COLORS,
  type EntityType,
  type Priority,
  type Status,
} from "@/types/properties";

const PRIORITY_NONE = "__none__" as const;
const STATUS_NONE = "__none__" as const;

type PriorityDraft = { id: string; field_name: string; value: Priority | null };
type StatusDraft = { id: string; field_name: string; value: Status | null };

function buildPriorityDrafts(direct: { priorities?: Array<{ id?: string; field_name?: string; value?: Priority | null }>; priority?: Priority | null } | null | undefined): PriorityDraft[] {
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
          } as PriorityDraft;
        })
        .filter((f): f is PriorityDraft => Boolean(f))
    : [];
  if (named.length > 0) return named;
  return [{ id: "priority-default", field_name: "Priority", value: direct?.priority ?? null }];
}

function buildStatusDrafts(direct: { statuses?: Array<{ id?: string; field_name?: string; value?: Status | null }>; status?: Status | null } | null | undefined): StatusDraft[] {
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
          } as StatusDraft;
        })
        .filter((f): f is StatusDraft => Boolean(f))
    : [];
  if (named.length > 0) return named;
  return [{ id: "status-default", field_name: "Status", value: direct?.status ?? null }];
}

function dedupeByName<T extends { field_name: string }>(drafts: T[]): T[] {
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

interface PropertyFieldDropdownProps {
  entityType: EntityType;
  entityId: string;
  workspaceId: string;
  group: "priority" | "status";
  fieldId?: string;
  children: React.ReactNode;
  className?: string;
  /** When true, renders children without opening the dropdown editor. */
  disabled?: boolean;
}

export function PropertyFieldDropdown({
  entityType,
  entityId,
  workspaceId,
  group,
  fieldId,
  children,
  className,
  disabled = false,
}: PropertyFieldDropdownProps) {
  if (disabled) {
    return <>{children}</>;
  }
  const [open, setOpen] = useState(false);
  const { data: direct, isLoading } = useEntityProperties(entityType, entityId);
  const setProperties = useSetEntityProperties(entityType, entityId, workspaceId);
  const buildDrafts = group === "priority" ? buildPriorityDrafts : buildStatusDrafts;
  const drafts = buildDrafts(direct);
  // Fall back to drafts[0] if fieldId doesn't match any draft — can happen during the brief
  // window where the per-entity cache has an optimistic update but the bulk cache still has
  // the old IDs (they generate index-based IDs like "priority-0-priority" vs real UUIDs).
  const editingDraft = (fieldId ? drafts.find((d) => d.id === fieldId) : null) ?? drafts[0];
  const [fieldName, setFieldName] = useState(editingDraft?.field_name ?? (group === "priority" ? "Priority" : "Status"));
  const [value, setValue] = useState<Priority | Status | null>((editingDraft?.value as Priority | Status | null) ?? null);
  const nameRef = useRef(fieldName);
  nameRef.current = fieldName;

  React.useEffect(() => {
    if (!open || !editingDraft) return;
    setFieldName(editingDraft.field_name);
    setValue(editingDraft.value);
  }, [open, editingDraft?.id, editingDraft?.field_name, editingDraft?.value]);

  const persist = React.useCallback(
    (nextName: string, nextValue: Priority | Status | null) => {
      const name = nextName.trim() || (group === "priority" ? "Priority" : "Status");
      if (group === "priority") {
        const priorityDrafts = drafts as PriorityDraft[];
        const nextDrafts = priorityDrafts.map((d, index) =>
          (fieldId ? d.id === fieldId : index === 0)
            ? { ...d, field_name: name, value: (nextValue as Priority | null) }
            : d
        );
        const normalized = dedupeByName(nextDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
        setProperties.mutate({ priorities: normalized.length > 0 ? (normalized as { field_name: string; value: Priority | null }[]) : null });
      } else {
        const statusDrafts = drafts as StatusDraft[];
        const nextDrafts = statusDrafts.map((d, index) =>
          (fieldId ? d.id === fieldId : index === 0)
            ? { ...d, field_name: name, value: (nextValue as Status | null) }
            : d
        );
        const normalized = dedupeByName(nextDrafts).map((f) => ({ field_name: f.field_name, value: f.value }));
        setProperties.mutate({ statuses: normalized.length > 0 ? (normalized as { field_name: string; value: Status | null }[]) : null });
      }
    },
    [drafts, fieldId, group, setProperties]
  );

  const options = group === "priority" ? PRIORITY_OPTIONS : STATUS_OPTIONS;
  const colorMap = group === "priority" ? PRIORITY_COLORS : STATUS_COLORS;

  const setOption = (v: Priority | Status | null) => {
    setValue(v);
    persist(nameRef.current, v);
    setOpen(false);
  };

  if (!editingDraft && !isLoading) return <>{children}</>;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild className={className}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-0 max-w-[8rem] p-1.5" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <div className="text-[10px] text-[var(--muted-foreground)] px-1.5 py-0.5">Loading...</div>
        ) : (
          <div className="space-y-1.5">
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              onBlur={() => persist(nameRef.current, value)}
              placeholder="Name"
              className="h-6 min-w-0 text-[10px] px-1.5"
            />
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setOption(null)}
                className={cn(
                  "w-full rounded px-1.5 py-0.5 text-left text-[10px] transition-colors",
                  value === null
                    ? "bg-[var(--surface-hover)] text-[var(--foreground)] font-medium"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
                )}
              >
                None
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOption(opt.value as Priority | Status)}
                  className={cn(
                    "w-full rounded px-1.5 py-0.5 text-left text-[10px] transition-opacity truncate",
                    colorMap[opt.value as keyof typeof colorMap],
                    value === opt.value && "ring-1 ring-[var(--foreground)]/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
