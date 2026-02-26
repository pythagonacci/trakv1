import { format, parseISO, isValid } from "date-fns";
import type { DueDateRange } from "@/types/properties";

/**
 * Format an ISO date string for UI display (e.g. "Feb 28").
 * Use with formatDueDateRange for consistent task/subtask date labels.
 */
export function formatDueDateForDisplay(isoDate: string): string {
  const d = parseDateSafe(isoDate);
  if (!d) return isoDate;
  return format(d, "MMM d");
}

/**
 * Parses "YYYY-MM-DD" as a local date (avoids timezone shift).
 * new Date("2026-02-22") treats it as UTC midnight → can show as previous day.
 * Use this for date-only strings from inputs.
 */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Parses a date string that may be "YYYY-MM-DD" or full ISO.
 * For date-only (or ISO with date part), uses local parse to avoid timezone shift.
 * Use for due dates, timeline dates, and any calendar-day value.
 */
export function parseDateSafe(isoOrYmd: string | null): Date | null {
  if (!isoOrYmd || typeof isoOrYmd !== "string") return null;
  const s = isoOrYmd.trim();
  if (!s) return null;
  const ymd = s.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = parseLocalDate(ymd);
    return isValid(d) ? d : null;
  }
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

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
  return parseDateSafe(isoDate);
}
