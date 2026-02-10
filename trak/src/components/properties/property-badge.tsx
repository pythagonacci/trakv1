"use client";

// Trak Universal Properties - Property Badge Component (Simplified)
// Inline badges showing status, priority, assignee, due date, tags

import React from "react";
import { cn } from "@/lib/utils";
import { User, Calendar, Tag as TagIcon } from "lucide-react";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type EntityProperties,
  type Status,
  type Priority,
} from "@/types/properties";

interface PropertyBadgesProps {
  properties: EntityProperties | null;
  inherited?: boolean;
  className?: string;
  onClick?: () => void;
  memberNames?: string[]; // For displaying assignee names (multiple)
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

  const hasAnyProperty =
    properties.status ||
    properties.priority ||
    (properties.assignee_ids?.length ? properties.assignee_ids.length > 0 : properties.assignee_id) ||
    properties.due_date ||
    (properties.tags && properties.tags.length > 0);

  if (!hasAnyProperty) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {properties.status && (
        <StatusBadge status={properties.status} inherited={inherited} onClick={onClick} />
      )}
      {properties.priority && (
        <PriorityBadge priority={properties.priority} inherited={inherited} onClick={onClick} />
      )}
      {(properties.assignee_ids?.length ? properties.assignee_ids.length > 0 : properties.assignee_id) && (
        <AssigneeBadge memberNames={memberNames} inherited={inherited} onClick={onClick} />
      )}
      {properties.due_date && (
        <DueDateBadge dueDate={properties.due_date} inherited={inherited} onClick={onClick} />
      )}
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
  inherited = false,
  onClick,
}: {
  status: Status;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  if (!option) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors",
        STATUS_COLORS[status],
        inherited && "border border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      {option.label}
    </button>
  );
}

/**
 * Priority badge
 */
export function PriorityBadge({
  priority,
  inherited = false,
  onClick,
}: {
  priority: Priority;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const option = PRIORITY_OPTIONS.find((o) => o.value === priority);
  if (!option) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors",
        PRIORITY_COLORS[priority],
        inherited && "border border-dashed opacity-75",
        onClick && "cursor-pointer hover:opacity-80"
      )}
    >
      {option.label}
    </button>
  );
}

/**
 * Assignee badge (supports multiple assignees)
 */
export function AssigneeBadge({
  memberNames,
  inherited = false,
  onClick,
}: {
  memberNames?: string[];
  inherited?: boolean;
  onClick?: () => void;
}) {
  const labels = memberNames?.length ? memberNames : undefined;
  const label = labels?.length ? labels.join(", ") : "Assigned";
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
      <span className="truncate max-w-[140px]">{label}</span>
    </button>
  );
}

/**
 * Due date badge
 */
export function DueDateBadge({
  dueDate,
  inherited = false,
  onClick,
}: {
  dueDate: string;
  inherited?: boolean;
  onClick?: () => void;
}) {
  const formatted = formatDueDate(dueDate);
  const isOverdue = new Date(dueDate) < new Date() && !isToday(dueDate);

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
      <Calendar className="h-3 w-3" />
      {formatted}
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
function formatDueDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

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

    // Otherwise show formatted date
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
    const date = new Date(dateString);
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
