import type { TimelineEventStatus, TimelineNamedStatus } from "@/types/timeline";

type StatusValue = TimelineEventStatus | null | undefined;

const VALID_STATUS_VALUES = new Set<TimelineEventStatus>(["todo", "in_progress", "blocked", "done"]);

function normalizeTimelineStatusFieldName(fieldName: unknown): string | null {
    const normalized = String(fieldName ?? "").trim();
    return normalized.length > 0 ? normalized : null;
}

function dedupeAndSortTimelineStatuses(statuses: TimelineNamedStatus[]): TimelineNamedStatus[] {
    const deduped = new Map<string, TimelineNamedStatus>();
    for (const entry of statuses) {
        const key = entry.field_name.trim().toLowerCase();
        if (!key || deduped.has(key)) continue;
        deduped.set(key, entry);
    }

    return Array.from(deduped.values()).sort((a, b) =>
        a.field_name.localeCompare(b.field_name, undefined, { sensitivity: "base" })
    );
}

export function normalizeTimelineStatusValue(value: unknown): TimelineEventStatus | null {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase().replace("-", "_");
    if (VALID_STATUS_VALUES.has(normalized as TimelineEventStatus)) {
        return normalized as TimelineEventStatus;
    }
    return null;
}

export function normalizeTimelineStatuses(input: unknown): TimelineNamedStatus[] {
    if (!Array.isArray(input)) return [];

    const normalized: TimelineNamedStatus[] = [];
    for (const rawEntry of input) {
        const fieldName =
            normalizeTimelineStatusFieldName((rawEntry as any)?.field_name ?? (rawEntry as any)?.fieldName);
        if (!fieldName) continue;
        const value = normalizeTimelineStatusValue((rawEntry as any)?.value);
        if (!value) continue;
        normalized.push({ field_name: fieldName, value });
    }

    return dedupeAndSortTimelineStatuses(normalized);
}

export function mergeTimelineStatusField(
    existing: TimelineNamedStatus[] | null | undefined,
    fieldName: string,
    value: StatusValue
): TimelineNamedStatus[] {
    const normalizedFieldName = normalizeTimelineStatusFieldName(fieldName);
    if (!normalizedFieldName) return normalizeTimelineStatuses(existing ?? []);

    const base = normalizeTimelineStatuses(existing ?? []);
    const nextValue = normalizeTimelineStatusValue(value);
    const fieldKey = normalizedFieldName.toLowerCase();
    const withoutField = base.filter((entry) => entry.field_name.trim().toLowerCase() !== fieldKey);

    if (!nextValue) {
        return dedupeAndSortTimelineStatuses(withoutField);
    }

    return dedupeAndSortTimelineStatuses([
        ...withoutField,
        { field_name: normalizedFieldName, value: nextValue },
    ]);
}

export function filterTimelineStatusesToAllowedFieldNames(
    statuses: TimelineNamedStatus[] | null | undefined,
    allowedFieldNames: string[] | null | undefined
): TimelineNamedStatus[] {
    const normalizedStatuses = normalizeTimelineStatuses(statuses ?? []);
    if (!Array.isArray(allowedFieldNames) || allowedFieldNames.length === 0) return normalizedStatuses;

    const allowed = new Set(
        allowedFieldNames
            .map((fieldName) => String(fieldName ?? "").trim().toLowerCase())
            .filter((fieldName) => fieldName.length > 0)
    );
    if (allowed.size === 0) return [];

    return normalizedStatuses.filter((entry) => allowed.has(entry.field_name.trim().toLowerCase()));
}

export async function syncTimelineStatusFieldsToEntityProperties(
    supabase: any,
    eventId: string,
    workspaceId: string,
    statuses: TimelineNamedStatus[] | null | undefined
): Promise<void> {
    await supabase
        .from("entity_properties")
        .delete()
        .eq("entity_type", "timeline_event")
        .eq("entity_id", eventId)
        .eq("field_type", "status");

    const normalizedStatuses = normalizeTimelineStatuses(statuses ?? []);
    if (normalizedStatuses.length === 0) return;

    const rows = normalizedStatuses.map((entry) => ({
        entity_type: "timeline_event",
        entity_id: eventId,
        workspace_id: workspaceId,
        field_name: entry.field_name,
        field_type: "status",
        value: entry.value,
    }));

    await supabase.from("entity_properties").upsert(rows, {
        onConflict: "entity_type,entity_id,field_name",
    });
}
