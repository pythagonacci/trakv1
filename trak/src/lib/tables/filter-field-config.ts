import type { TableField, SelectFieldOption, StatusFieldConfig, PriorityFieldConfig, SelectFieldConfig } from "@/types/table";
import { TABLE_STATUS_OPTIONS, TABLE_PRIORITY_LEVELS } from "@/lib/tables/universal-property";

export type FilterOption = { id: string; label: string };

/**
 * Returns options for filter value when the field type has a fixed set (status, priority, select, multi_select).
 * Used to show dropdowns in the filter UI instead of free text.
 */
export function getFilterOptionsForField(field: TableField | undefined): FilterOption[] {
  if (!field) return [];
  const type = field.type;
  const config = field.config as Record<string, unknown> | null | undefined;

  if (type === "status") {
    const statusConfig = config as StatusFieldConfig | undefined;
    const options = statusConfig?.options;
    if (Array.isArray(options) && options.length > 0) {
      return options.map((o) => ({ id: o.id, label: o.label }));
    }
    return TABLE_STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label }));
  }

  if (type === "priority") {
    const priorityConfig = config as PriorityFieldConfig | undefined;
    const levels = priorityConfig?.levels;
    if (Array.isArray(levels) && levels.length > 0) {
      return levels.map((l) => ({ id: l.id, label: l.label }));
    }
    return TABLE_PRIORITY_LEVELS.map((l) => ({ id: l.id, label: l.label }));
  }

  if (type === "select" || type === "multi_select") {
    const selectConfig = config as SelectFieldConfig | undefined;
    const options = selectConfig?.options as SelectFieldOption[] | undefined;
    if (Array.isArray(options) && options.length > 0) {
      return options.map((o) => ({ id: o.id, label: o.label }));
    }
    return [];
  }

  return [];
}

export function fieldHasFilterOptions(field: TableField | undefined): boolean {
  return getFilterOptionsForField(field).length > 0;
}

export function isDateField(field: TableField | undefined): boolean {
  return field?.type === "date";
}

/** Date filter value: single date string or range object for "is_within" */
export type DateFilterValue = string | { start: string; end: string } | null;

export function normalizeDateFilterValue(value: unknown): DateFilterValue {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "object" && value !== null && "start" in value && "end" in value) {
    const o = value as { start?: unknown; end?: unknown };
    const start = typeof o.start === "string" ? o.start : "";
    const end = typeof o.end === "string" ? o.end : "";
    if (start || end) return { start, end };
  }
  return null;
}
