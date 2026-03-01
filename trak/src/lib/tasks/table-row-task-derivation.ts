import { parseDateSafe } from "@/lib/due-date";
import { mapOptionIdsToTagNames, type TagFieldOption } from "@/lib/tables/tag-field-config";
import type { DueDateRange } from "@/types/properties";
import type { TaskItemPriority, TaskItemStatus } from "@/types/task";

export type TableFieldForTaskDerivation = {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown> | null;
  is_primary?: boolean | null;
};

export type NamedAssigneeField = {
  field_name: string;
  value: string[];
};

export type NamedDueDateField = {
  field_name: string;
  value: DueDateRange;
};

export type NamedTagField = {
  field_name: string;
  value: string[];
};

export type DerivedTaskSeedFromTableRow = {
  title: string | null;
  statuses: TaskItemStatus[];
  priorities: TaskItemPriority[];
  assignees: NamedAssigneeField[];
  due_dates: NamedDueDateField[];
  tag_fields: NamedTagField[];
  tags: string[];
  preferred_assignee_ids: string[];
  preferred_start_date: string | null;
  preferred_due_date: string | null;
};

function normalizeFieldName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_");
}

function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => valueToString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
    if (typeof obj.label === "string" && obj.label.trim()) return obj.label.trim();
    if (typeof obj.id === "string" && obj.id.trim()) return obj.id.trim();
  }
  return null;
}

function normalizeTaskStatus(value: unknown): "todo" | "in_progress" | "blocked" | "done" | null {
  const normalized = valueToString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["todo", "to_do", "to-do", "not_started", "notstarted"].includes(normalized)) return "todo";
  if (["in_progress", "inprogress", "doing"].includes(normalized)) return "in_progress";
  if (["blocked", "on_hold", "onhold"].includes(normalized)) return "blocked";
  if (["done", "complete", "completed", "finished"].includes(normalized)) return "done";
  return null;
}

function normalizeTaskPriority(value: unknown): "low" | "medium" | "high" | "urgent" | null {
  const normalized = valueToString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "urgent") return normalized;
  return null;
}

function normalizeDateToken(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const parsed = parseDateSafe(String(value));
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDateRangeForTask(value: unknown): DueDateRange | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/);
    if (rangeMatch) {
      const start = normalizeDateToken(rangeMatch[1]);
      const end = normalizeDateToken(rangeMatch[2]);
      if (!start && !end) return null;
      return { start, end: end ?? start };
    }
    const one = normalizeDateToken(trimmed);
    return one ? { start: one, end: one } : null;
  }
  if (typeof value !== "object") {
    const one = normalizeDateToken(value);
    return one ? { start: one, end: one } : null;
  }
  const obj = value as Record<string, unknown>;
  const start = normalizeDateToken(obj.start ?? obj.startDate ?? obj.from ?? obj.date ?? null);
  const end = normalizeDateToken(obj.end ?? obj.endDate ?? obj.to ?? obj.dueDate ?? start ?? null);
  if (!start && !end) return null;
  return { start, end: end ?? start };
}

function extractAssigneeIds(value: unknown): string[] {
  const ids: string[] = [];
  const push = (entry: unknown) => {
    if (entry === null || entry === undefined) return;
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) ids.push(trimmed);
      return;
    }
    if (typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const maybeId = typeof obj.id === "string" ? obj.id.trim() : "";
      if (maybeId) ids.push(maybeId);
    }
  };
  if (Array.isArray(value)) {
    for (const entry of value) push(entry);
  } else {
    push(value);
  }
  return Array.from(new Set(ids));
}

function extractTagsFromField(field: TableFieldForTaskDerivation, value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  const asStrings = values
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  if (asStrings.length === 0) return [];
  const options = ((((field.config ?? {}) as Record<string, unknown>).options ?? []) as TagFieldOption[]);
  const mapped = mapOptionIdsToTagNames(asStrings, options)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return mapped.length > 0 ? mapped : asStrings;
}

function pickTitle(
  rowData: Record<string, unknown>,
  fields: TableFieldForTaskDerivation[]
): string | null {
  const primaryField = fields.find((field) => Boolean(field.is_primary));
  if (primaryField) {
    const primaryTitle = valueToString(rowData[primaryField.id]);
    if (primaryTitle) return primaryTitle;
  }
  const textLike = fields.filter((field) => field.type === "text" || field.type === "long_text");
  for (const field of textLike) {
    const textTitle = valueToString(rowData[field.id]);
    if (textTitle) return textTitle;
  }
  return null;
}

function pickPreferredAssigneeIds(namedAssignees: NamedAssigneeField[]): string[] {
  if (namedAssignees.length === 0) return [];
  const canonical = namedAssignees.find((entry) => normalizeFieldName(entry.field_name) === "assignee");
  const source = canonical ?? namedAssignees[0];
  return source?.value ?? [];
}

function pickPreferredDateRange(namedDueDates: NamedDueDateField[]): DueDateRange | null {
  if (namedDueDates.length === 0) return null;
  const canonical = namedDueDates.find((entry) => {
    const normalized = normalizeFieldName(entry.field_name);
    return normalized === "due_date" || normalized === "date";
  });
  return (canonical ?? namedDueDates[0])?.value ?? null;
}

export function deriveTaskSeedFromTableRowData(
  rowData: Record<string, unknown>,
  fields: TableFieldForTaskDerivation[]
): DerivedTaskSeedFromTableRow {
  const statuses: TaskItemStatus[] = [];
  const priorities: TaskItemPriority[] = [];
  const assignees: NamedAssigneeField[] = [];
  const due_dates: NamedDueDateField[] = [];
  const tag_fields: NamedTagField[] = [];

  for (const field of fields) {
    const fieldName = String(field.name || "").trim();
    if (!fieldName) continue;
    const value = rowData[field.id];
    if (value === null || value === undefined || value === "") continue;

    if (field.type === "status") {
      const status = normalizeTaskStatus(value);
      if (status) statuses.push({ field_name: fieldName, value: status });
      continue;
    }
    if (field.type === "priority") {
      const priority = normalizeTaskPriority(value);
      if (priority) priorities.push({ field_name: fieldName, value: priority });
      continue;
    }
    if (field.type === "person") {
      const ids = extractAssigneeIds(value);
      if (ids.length > 0) assignees.push({ field_name: fieldName, value: ids });
      continue;
    }
    if (field.type === "date") {
      const range = normalizeDateRangeForTask(value);
      if (range) due_dates.push({ field_name: fieldName, value: range });
      continue;
    }
    if (field.type === "tags") {
      const tags = extractTagsFromField(field, value);
      if (tags.length > 0) tag_fields.push({ field_name: fieldName, value: tags });
      continue;
    }
  }

  const tags = Array.from(
    new Set(
      tag_fields
        .flatMap((entry) => entry.value)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );

  const preferredRange = pickPreferredDateRange(due_dates);
  const preferred_assignee_ids = pickPreferredAssigneeIds(assignees);

  return {
    title: pickTitle(rowData, fields),
    statuses,
    priorities,
    assignees,
    due_dates,
    tag_fields,
    tags,
    preferred_assignee_ids,
    preferred_start_date: preferredRange?.start ?? null,
    preferred_due_date: preferredRange?.end ?? preferredRange?.start ?? null,
  };
}

export async function deriveTaskSeedFromTableRowSource(
  supabase: any,
  sourceRowId: string
): Promise<DerivedTaskSeedFromTableRow | null> {
  const { data: sourceRow } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("id", sourceRowId)
    .maybeSingle();
  if (!sourceRow?.table_id) return null;

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
    .eq("table_id", sourceRow.table_id);
  if (!fields || fields.length === 0) return null;

  return deriveTaskSeedFromTableRowData(
    (sourceRow.data ?? {}) as Record<string, unknown>,
    fields as TableFieldForTaskDerivation[]
  );
}
