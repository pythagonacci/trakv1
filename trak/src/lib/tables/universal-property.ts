import type { Priority, Status } from "@/types/properties";

export const TABLE_PRIORITY_LEVELS: Array<{ id: Priority; label: string; color: string; order: number }> = [
  { id: "urgent", label: "Urgent", color: "#ef4444", order: 4 },
  { id: "high", label: "High", color: "#f59e0b", order: 3 },
  // Medium priority should use the same yellow tone as task priorities (var(--warning) / Antique Gold)
  { id: "medium", label: "Medium", color: "#C9A857", order: 2 },
  { id: "low", label: "Low", color: "#6b7280", order: 1 },
];

export const TABLE_STATUS_OPTIONS: Array<{ id: Status; label: string; color: string }> = [
  { id: "todo", label: "To Do", color: "#6b7280" },
  { id: "in_progress", label: "In Progress", color: "#3b82f6" },
  { id: "done", label: "Done", color: "#10b981" },
  { id: "blocked", label: "Blocked", color: "#ef4444" },
];

export function isUniversalPropertyFieldType(type: unknown): type is "priority" | "status" {
  return type === "priority" || type === "status";
}

export function getCanonicalConfigForUniversalPropertyType(type: "priority" | "status"): Record<string, unknown> {
  if (type === "priority") {
    return { levels: TABLE_PRIORITY_LEVELS };
  }
  return { options: TABLE_STATUS_OPTIONS };
}

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "_");
}

export function normalizeCanonicalPriorityValue(value: unknown): Priority | null {
  if (value === null || value === undefined) return null;
  const token = normalizeToken(value)
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/^_+|_+$/g, "");
  if (!token) return null;

  if (
    token === "urgent" ||
    token === "critical" ||
    token === "highest" ||
    token === "p0" ||
    token === "must_have" ||
    token === "musthave"
  ) {
    return "urgent";
  }
  if (token === "high" || token === "p1") return "high";
  if (token === "medium" || token === "normal" || token === "med" || token === "p2") return "medium";
  if (token === "low" || token === "lowest" || token === "minor" || token === "p3") return "low";

  return null;
}

export function normalizeCanonicalStatusValue(value: unknown): Status | null {
  if (value === null || value === undefined) return null;
  const token = normalizeToken(value);
  if (!token) return null;

  if (token === "todo" || token === "to_do" || token === "to-do" || token === "not_started" || token === "backlog") {
    return "todo";
  }
  if (
    token === "pending" ||
    token === "queued" ||
    token === "quoting" ||
    token === "under_consideration" ||
    token === "underconsideration"
  ) {
    return "todo";
  }
  if (
    token === "in_progress" ||
    token === "inprogress" ||
    token === "doing" ||
    token === "active" ||
    token === "working" ||
    token === "review" ||
    token === "in_review" ||
    token === "inreview" ||
    token === "reviewing"
  ) {
    return "in_progress";
  }
  if (
    token === "done" ||
    token === "complete" ||
    token === "completed" ||
    token === "finished" ||
    token === "approved"
  ) {
    return "done";
  }
  if (token === "blocked" || token === "on_hold" || token === "stuck") return "blocked";

  return null;
}

export function normalizeUniversalPropertyValue(
  fieldType: unknown,
  value: unknown
): Priority | Status | null {
  if (fieldType === "priority") return normalizeCanonicalPriorityValue(value);
  if (fieldType === "status") return normalizeCanonicalStatusValue(value);
  return null;
}

export function getCanonicalStatusOption(
  value: unknown
): { id: Status; label: string; color: string } | null {
  const normalized = normalizeCanonicalStatusValue(value);
  if (!normalized) return null;
  return TABLE_STATUS_OPTIONS.find((option) => option.id === normalized) ?? null;
}

export function getCanonicalPriorityOption(
  value: unknown
): { id: Priority; label: string; color: string; order: number } | null {
  const normalized = normalizeCanonicalPriorityValue(value);
  if (!normalized) return null;
  return TABLE_PRIORITY_LEVELS.find((option) => option.id === normalized) ?? null;
}

export function sanitizeUniversalPropertyFieldDefinition<T extends Record<string, unknown>>(field: T): T {
  const fieldType = typeof field.type === "string" ? field.type.toLowerCase() : "";
  if (!isUniversalPropertyFieldType(fieldType)) return field;

  const rest = { ...field } as Record<string, unknown>;
  delete rest.config;
  delete rest.options;
  delete rest.levels;
  return rest as T;
}
