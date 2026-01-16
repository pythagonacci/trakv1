"use client";

// Universal Properties & Linking System - Property Badge Component
// A small inline badge showing a property name and value

import React from "react";
import { cn } from "@/lib/utils";
import { Check, X, Calendar, User, Hash, Type, List, Link2 } from "lucide-react";
import type {
  PropertyType,
  PropertyValue,
  PropertyDefinition,
  PropertyOption,
} from "@/types/properties";

interface PropertyBadgeProps {
  definition: PropertyDefinition;
  value: PropertyValue;
  inherited?: boolean;
  sourceLabel?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * A small inline badge showing a property name and value.
 * Different rendering based on type (checkbox shows check/x, date formats nicely, etc.).
 * Has an `inherited` variant with dashed border and "(inherited)" label.
 */
export function PropertyBadge({
  definition,
  value,
  inherited = false,
  sourceLabel,
  className,
  onClick,
}: PropertyBadgeProps) {
  const renderedValue = renderPropertyValue(definition, value);
  const Icon = getPropertyIcon(definition.type);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        "hover:bg-[var(--surface-hover)]",
        inherited
          ? "border border-dashed border-[var(--border)] bg-transparent text-[var(--muted-foreground)]"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      <Icon className="h-3 w-3 flex-shrink-0 opacity-60" />
      <span className="truncate max-w-[80px]" title={definition.name}>
        {definition.name}
      </span>
      <span className="text-[var(--muted-foreground)]">:</span>
      <span className="truncate max-w-[120px]" title={String(renderedValue.label)}>
        {renderedValue.content}
      </span>
      {inherited && sourceLabel && (
        <span
          className="ml-1 text-[10px] opacity-60"
          title={`Inherited from ${sourceLabel}`}
        >
          (inherited)
        </span>
      )}
    </button>
  );
}

/**
 * Get the appropriate icon for a property type.
 */
function getPropertyIcon(type: PropertyType) {
  switch (type) {
    case "text":
      return Type;
    case "number":
      return Hash;
    case "date":
      return Calendar;
    case "select":
    case "multi_select":
      return List;
    case "person":
      return User;
    case "checkbox":
      return Check;
    default:
      return Link2;
  }
}

interface RenderedValue {
  content: React.ReactNode;
  label: string;
}

/**
 * Render a property value based on its type.
 */
function renderPropertyValue(
  definition: PropertyDefinition,
  value: PropertyValue
): RenderedValue {
  if (value === null || value === undefined) {
    return { content: <span className="italic opacity-50">Empty</span>, label: "Empty" };
  }

  switch (definition.type) {
    case "checkbox":
      return {
        content: value ? (
          <Check className="h-3 w-3 text-[var(--success)]" />
        ) : (
          <X className="h-3 w-3 text-[var(--muted-foreground)]" />
        ),
        label: value ? "Yes" : "No",
      };

    case "date":
      const dateValue = formatDate(value as string);
      return { content: dateValue, label: dateValue };

    case "number":
      const numValue = typeof value === "number" ? value.toLocaleString() : String(value);
      return { content: numValue, label: numValue };

    case "select":
      const selectOption = (definition.options ?? []).find((opt) => opt.id === value);
      if (selectOption) {
        return {
          content: (
            <SelectOptionBadge option={selectOption} />
          ),
          label: selectOption.label,
        };
      }
      return { content: String(value), label: String(value) };

    case "multi_select":
      const selectedIds = Array.isArray(value) ? value : [];
      const selectedOptions = (definition.options ?? []).filter((opt) =>
        selectedIds.includes(opt.id)
      );
      if (selectedOptions.length === 0) {
        return { content: <span className="italic opacity-50">None</span>, label: "None" };
      }
      if (selectedOptions.length === 1) {
        return {
          content: <SelectOptionBadge option={selectedOptions[0]} />,
          label: selectedOptions[0].label,
        };
      }
      return {
        content: (
          <span className="flex items-center gap-0.5">
            <SelectOptionBadge option={selectedOptions[0]} />
            <span className="text-[var(--muted-foreground)]">
              +{selectedOptions.length - 1}
            </span>
          </span>
        ),
        label: selectedOptions.map((o) => o.label).join(", "),
      };

    case "person":
      // For person type, value is user ID(s) - we'd need to resolve to names
      // For now, just show as text
      const personIds = Array.isArray(value) ? value : [value];
      if (personIds.length === 0 || !personIds[0]) {
        return { content: <span className="italic opacity-50">Unassigned</span>, label: "Unassigned" };
      }
      // TODO: Resolve user IDs to names via workspace members
      return {
        content: `${personIds.length} assignee${personIds.length > 1 ? "s" : ""}`,
        label: `${personIds.length} assignee${personIds.length > 1 ? "s" : ""}`,
      };

    case "text":
    default:
      const textValue = String(value);
      return { content: textValue, label: textValue };
  }
}

/**
 * Format a date string for display.
 */
function formatDate(value: string): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    // Check if it's today, tomorrow, yesterday
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
    return value;
  }
}

/**
 * A small colored badge for select options.
 */
function SelectOptionBadge({ option }: { option: PropertyOption }) {
  const bgColor = getOptionColor(option.color);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        bgColor
      )}
    >
      {option.label}
    </span>
  );
}

/**
 * Convert color token to Tailwind classes.
 */
function getOptionColor(color: string): string {
  const colorMap: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  };

  return colorMap[color] ?? colorMap.gray;
}

/**
 * Compact version of the property badge for list views.
 */
export function PropertyBadgeCompact({
  definition,
  value,
  className,
}: {
  definition: PropertyDefinition;
  value: PropertyValue;
  className?: string;
}) {
  const renderedValue = renderPropertyValue(definition, value);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]",
        className
      )}
      title={`${definition.name}: ${renderedValue.label}`}
    >
      {renderedValue.content}
    </span>
  );
}

export default PropertyBadge;
