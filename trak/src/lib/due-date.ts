import { parseISO, isValid } from "date-fns";
import type { DueDateRange } from "@/types/properties";

export function normalizeDueDateRange(value: unknown): DueDateRange | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return { start: null, end: value };
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const start = typeof obj.start === "string" ? obj.start : null;
    const end = typeof obj.end === "string" ? obj.end : null;
    if (start || end) return { start, end };
    const legacyDate =
      typeof obj.date === "string"
        ? obj.date
        : typeof obj.value === "string"
          ? obj.value
          : null;
    if (legacyDate) return { start: null, end: legacyDate };
  }
  return null;
}

export function buildDueDateRange(
  start?: string | null,
  end?: string | null
): DueDateRange | null {
  const normalizedStart = start && start.trim() ? start.trim() : null;
  const normalizedEnd = end && end.trim() ? end.trim() : null;
  if (!normalizedStart && !normalizedEnd) return null;
  return { start: normalizedStart, end: normalizedEnd };
}

export function hasDueDate(range: DueDateRange | null): boolean {
  return Boolean(range?.start || range?.end);
}

export function getDueDateStart(range: DueDateRange | null): string | null {
  return range?.start ?? null;
}

export function getDueDateEnd(range: DueDateRange | null): string | null {
  return range?.end ?? range?.start ?? null;
}

export function formatDueDateRange(
  range: DueDateRange | null,
  formatDate: (isoDate: string) => string = (iso) => iso,
  separator = "->"
): string | null {
  if (!range) return null;
  const { start, end } = range;
  if (start && end) {
    if (start === end) return formatDate(end);
    return `${formatDate(start)} ${separator} ${formatDate(end)}`;
  }
  if (end) return formatDate(end);
  if (start) return formatDate(start);
  return null;
}

export function parseDueDate(isoDate: string | null): Date | null {
  if (!isoDate) return null;
  const date = parseISO(isoDate);
  if (!isValid(date)) return null;
  return date;
}
