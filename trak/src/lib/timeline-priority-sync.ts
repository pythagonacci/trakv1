import type { TimelineEventPriority, TimelineNamedPriority } from "@/types/timeline";

type PriorityValue = TimelineEventPriority | null | undefined;

const VALID_PRIORITY_VALUES = new Set<TimelineEventPriority>(["low", "medium", "high", "urgent"]);

function normalizeTimelinePriorityFieldName(fieldName: unknown): string | null {
  const normalized = String(fieldName ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function dedupeAndSortTimelinePriorities(priorities: TimelineNamedPriority[]): TimelineNamedPriority[] {
  const deduped = new Map<string, TimelineNamedPriority>();
  for (const entry of priorities) {
    const key = entry.field_name.trim().toLowerCase();
    if (!key || deduped.has(key)) continue;
    deduped.set(key, entry);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aKey = a.field_name.trim().toLowerCase();
    const bKey = b.field_name.trim().toLowerCase();
    if (aKey === "priority" && bKey !== "priority") return -1;
    if (bKey === "priority" && aKey !== "priority") return 1;
    return a.field_name.localeCompare(b.field_name, undefined, { sensitivity: "base" });
  });
}

export function normalizeTimelinePriorityValue(value: unknown): TimelineEventPriority | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (VALID_PRIORITY_VALUES.has(normalized as TimelineEventPriority)) {
    return normalized as TimelineEventPriority;
  }
  return null;
}

export function normalizeTimelinePriorities(input: unknown): TimelineNamedPriority[] {
  if (!Array.isArray(input)) return [];

  const normalized: TimelineNamedPriority[] = [];
  for (const rawEntry of input) {
    const fieldName =
      normalizeTimelinePriorityFieldName((rawEntry as any)?.field_name ?? (rawEntry as any)?.fieldName);
    if (!fieldName) continue;
    const value = normalizeTimelinePriorityValue((rawEntry as any)?.value);
    if (!value) continue;
    normalized.push({ field_name: fieldName, value });
  }

  return dedupeAndSortTimelinePriorities(normalized);
}

export function getCanonicalTimelinePriority(priorities: TimelineNamedPriority[] | null | undefined): TimelineEventPriority | null {
  const normalized = normalizeTimelinePriorities(priorities ?? []);
  if (normalized.length === 0) return null;
  const canonical = normalized.find((entry) => entry.field_name.trim().toLowerCase() === "priority");
  return (canonical ?? normalized[0])?.value ?? null;
}

export function mergeTimelinePriorityField(
  existing: TimelineNamedPriority[] | null | undefined,
  fieldName: string,
  value: PriorityValue
): TimelineNamedPriority[] {
  const normalizedFieldName = normalizeTimelinePriorityFieldName(fieldName);
  if (!normalizedFieldName) return normalizeTimelinePriorities(existing ?? []);

  const base = normalizeTimelinePriorities(existing ?? []);
  const nextValue = normalizeTimelinePriorityValue(value);
  const fieldKey = normalizedFieldName.toLowerCase();
  const withoutField = base.filter((entry) => entry.field_name.trim().toLowerCase() !== fieldKey);

  if (!nextValue) {
    return dedupeAndSortTimelinePriorities(withoutField);
  }

  return dedupeAndSortTimelinePriorities([
    ...withoutField,
    { field_name: normalizedFieldName, value: nextValue },
  ]);
}

export function filterTimelinePrioritiesToAllowedFieldNames(
  priorities: TimelineNamedPriority[] | null | undefined,
  allowedFieldNames: string[] | null | undefined
): TimelineNamedPriority[] {
  const normalizedPriorities = normalizeTimelinePriorities(priorities ?? []);
  if (!Array.isArray(allowedFieldNames) || allowedFieldNames.length === 0) return normalizedPriorities;

  const allowed = new Set(
    allowedFieldNames
      .map((fieldName) => String(fieldName ?? "").trim().toLowerCase())
      .filter((fieldName) => fieldName.length > 0)
  );
  if (allowed.size === 0) return [];

  return normalizedPriorities.filter((entry) => allowed.has(entry.field_name.trim().toLowerCase()));
}

export async function syncTimelinePriorityFieldsToEntityProperties(
  supabase: any,
  eventId: string,
  workspaceId: string,
  priorities: TimelineNamedPriority[] | null | undefined
): Promise<void> {
  await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", "timeline_event")
    .eq("entity_id", eventId)
    .eq("field_type", "priority");

  const normalizedPriorities = normalizeTimelinePriorities(priorities ?? []);
  if (normalizedPriorities.length === 0) return;

  const rows = normalizedPriorities.map((entry) => ({
    entity_type: "timeline_event",
    entity_id: eventId,
    workspace_id: workspaceId,
    property_definition_id: null,
    field_name: entry.field_name,
    field_type: "priority",
    value: entry.value,
  }));

  await supabase.from("entity_properties").upsert(rows, {
    onConflict: "entity_type,entity_id,field_name",
  });
}
