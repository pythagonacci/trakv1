"use client";

// Trak Universal Properties - Property Badge Component (Simplified)
// Inline badges showing status, priority, assignee, due date, tags

import React from "react";
import { cn } from "@/lib/utils";
import { User, Calendar, Tag as TagIcon, Flag, CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type EntityProperties,
  type Status,
  type Priority,
  type DueDateRange,
} from "@/types/properties";
import { formatDueDateRange, getDueDateEnd, hasDueDate, parseDateSafe } from "@/lib/due-date";

interface PropertyBadgesProps {
  properties: EntityProperties | null;
  inherited?: boolean;
  className?: string;
  onClick?: () => void;
  memberNames?: string[]; // For displaying assignee names (multiple) — used for the canonical single field fallback
}

/**
 * Display all property badges for an entity
 */
export function PropertyBadges({
  properties,
  inherited = false,
  className,
  onClick,
  memberNames,
}: PropertyBadgesProps) {
  if (!properties) return null;

  const hasNamedStatuses = Array.isArray(properties.statuses) && properties.statuses.length > 0;
  const hasNamedPriorities = Array.isArray(properties.priorities) && properties.priorities.length > 0;
  const hasNamedAssignees = Array.isArray(properties.assignees) && properties.assignees.length > 0;
  const hasNamedDueDates = Array.isArray(properties.due_dates) && properties.due_dates.length > 0;

  const hasAnyProperty =
    hasNamedStatuses ||
    properties.status ||
    hasNamedPriorities ||
    properties.priority ||
    hasNamedAssignees ||
    (properties.assignee_ids?.length ? properties.assignee_ids.length > 0 : properties.assignee_id) ||
    hasNamedDueDates ||
    hasDueDate(properties.due_date) ||
    (properties.tags && properties.tags.length > 0);

  if (!hasAnyProperty) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {/* Status */}
      {hasNamedStatuses
        ? properties.statuses.map((f) => (
            <StatusBadge key={f.id} status={f.value} label={f.field_name} inherited={inherited} onClick={onClick} />
          ))
        : properties.status && (
            <StatusBadge status={properties.status} inherited={inherited} onClick={onClick} />
          )}

      {/* Priority */}
      {hasNamedPriorities
        ? properties.priorities.map((priorityField) => (
            <PriorityBadge
              key={priorityField.id}
              priority={priorityField.value}
              label={priorityField.field_name}
              inherited={inherited}
              onClick={onClick}
            />
          ))
        : properties.priority && (
            <PriorityBadge priority={properties.priority} inherited={inherited} onClick={onClick} />
          )}

      {/* Assignees */}
      {hasNamedAssignees
        ? properties.assignees.map((f) => (
            <AssigneeBadge
              key={f.id}
              label={f.field_name}
              memberNames={f.value.length > 0 ? undefined : undefined /* resolved externally if needed */}
              inherited={inherited}
              onClick={onClick}
            />
          ))
        : (properties.assignee_ids?.length ? properties.assignee_ids.length > 0 : properties.assignee_id) && (
            <AssigneeBadge memberNames={memberNames} inherited={inherited} onClick={onClick} />
          )}

      {/* Due dates */}
      {hasNamedDueDates
        ? properties.due_dates.map((f) => (
            <DueDateBadge key={f.id} dueDate={f.value} label={f.field_name} inherited={inherited} onClick={onClick} />
          ))
        : hasDueDate(properties.due_date) && (
            <DueDateBadge dueDate={properties.due_date as DueDateRange} inherited={inherited} onClick={onClick} />
          )}

      {/* Tags */}
      {properties.tags &&
        properties.tags.map((tag) => (
          <TagBadge key={tag} tag={tag} inherited={inherited} onClick={onClick} />
        ))}
    </div>
  );
}

/**
 * Status badge
 */
export function StatusBadge({
  status,
  label,
  inherited = false,
  onClick,
}: {
  status: Status;
  label?: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  if (!option) return null;
  const fieldLabel = label?.trim();
  const text =
    fieldLabel && fieldLabel.toLowerCase() !== "status"
      ? `${fieldLabel}: ${option.label}`
      : option.label;
  const StatusIcon =
    status === "done" ? CheckCircle2
    : status === "blocked" ? XCircle
    : status === "in_progress" ? Clock
    : Circle;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
        STATUS_COLORS[status],
        inherited && "border border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      <StatusIcon className="h-3 w-3 flex-shrink-0" />
      <span>{text}</span>
    </button>
  );
}

/**
 * Priority badge
 */
export function PriorityBadge({
  priority,
  label,
  inherited = false,
  onClick,
}: {
  priority: Priority;
  label?: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const option = PRIORITY_OPTIONS.find((o) => o.value === priority);
  if (!option) return null;
  const fieldLabel = label?.trim();
  const text =
    fieldLabel && fieldLabel.toLowerCase() !== "priority"
      ? `${fieldLabel}: ${option.label}`
      : option.label;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
        PRIORITY_COLORS[priority],
        inherited && "border border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      <Flag className="h-3 w-3 flex-shrink-0" />
      <span>{text}</span>
    </button>
  );
}

/**
 * Assignee badge (supports multiple assignees)
 */
export function AssigneeBadge({
  memberNames,
  label,
  inherited = false,
  onClick,
}: {
  memberNames?: string[];
  label?: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const names = memberNames?.length ? memberNames.join(", ") : "Assigned";
  const fieldLabel = label?.trim();
  const text =
    fieldLabel && fieldLabel.toLowerCase() !== "assignee"
      ? `${fieldLabel}: ${names}`
      : names;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
        "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]",
        inherited && "border-dashed opacity-75",
        onClick && "cursor-pointer hover:bg-[var(--surface-hover)]"
      )}
    >
      <User className="h-3 w-3 flex-shrink-0" />
      <span className="truncate max-w-[140px]">{text}</span>
    </button>
  );
}

/**
 * Due date badge
 */
export function DueDateBadge({
  dueDate,
  label,
  inherited = false,
  onClick,
}: {
  dueDate: DueDateRange;
  label?: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const formatted = formatDueDateRange(dueDate, formatDueDateValue);
  if (!formatted) return null;
  const endDate = getDueDateEnd(dueDate);
  const isOverdue = endDate ? new Date(endDate) < new Date() && !isToday(endDate) : false;
  const fieldLabel = label?.trim();
  const text =
    fieldLabel && fieldLabel.toLowerCase() !== "due date"
      ? `${fieldLabel}: ${formatted}`
      : formatted;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
        isOverdue
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]",
        inherited && "border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      <Calendar className="h-3 w-3 flex-shrink-0" />
      <span>{text}</span>
    </button>
  );
}

/**
 * Tag badge
 */
export function TagBadge({
  tag,
  inherited = false,
  onClick,
}: {
  tag: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
        "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]",
        inherited && "border-dashed opacity-75",
        onClick && "cursor-pointer hover:bg-[var(--surface-hover)]"
      )}
    >
      <TagIcon className="h-3 w-3" />
      {tag}
    </button>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a date string for display
 */
function formatDueDateValue(dateString: string): string {
  try {
    const date = parseDateSafe(dateString);
    if (!date || isNaN(date.getTime())) return dateString;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (compareDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateString;
  }
}

/**
 * Check if a date string is today
 */
function isToday(dateString: string): boolean {
  try {
    const date = parseDateSafe(dateString);
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  } catch {
    return false;
  }
}

export default PropertyBadges;
