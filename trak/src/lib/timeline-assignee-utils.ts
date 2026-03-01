import type {
  TimelineNamedAssignee,
  TimelineAssigneeValueEntry,
  TimelineAssigneeKind,
} from "@/types/timeline";

export function normalizeTimelineAssignees(input: unknown): TimelineNamedAssignee[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const fieldName = String((entry as any)?.field_name ?? "").trim();
      if (!fieldName) return null;
      const values = Array.isArray((entry as any)?.value) ? (entry as any).value : [];
      const normalizedValues: TimelineAssigneeValueEntry[] = values
        .map((raw: any) => {
          const type = raw?.type === "team" ? "team" : raw?.type === "user" ? "user" : null;
          const id = typeof raw?.id === "string" ? raw.id.trim() : "";
          const name = typeof raw?.name === "string" ? raw.name.trim() : undefined;
          if (!type || !id) return null;
          return { type, id, ...(name ? { name } : {}) };
        })
        .filter((value: TimelineAssigneeValueEntry | null): value is TimelineAssigneeValueEntry => Boolean(value));
      if (normalizedValues.length === 0) return null;
      return { field_name: fieldName, value: normalizedValues } as TimelineNamedAssignee;
    })
    .filter((entry: TimelineNamedAssignee | null): entry is TimelineNamedAssignee => Boolean(entry));
}

export function deriveTimelineLegacyAssigneeIds(
  assignees: TimelineNamedAssignee[],
  fallback?: { assignee_id?: string | null; assignee_team_id?: string | null }
): { assignee_id: string | null; assignee_team_id: string | null } {
  for (const field of assignees) {
    for (const entry of field.value) {
      if (entry.type === "user" && entry.id) {
        const firstTeam = field.value.find((value) => value.type === "team" && value.id);
        return { assignee_id: entry.id, assignee_team_id: firstTeam?.id ?? null };
      }
    }
  }
  for (const field of assignees) {
    const team = field.value.find((entry) => entry.type === "team" && entry.id);
    if (team?.id) return { assignee_id: null, assignee_team_id: team.id };
  }
  return {
    assignee_id: fallback?.assignee_id ?? null,
    assignee_team_id: fallback?.assignee_team_id ?? null,
  };
}

/**
 * Converts entity_properties assignee fields into TimelineNamedAssignee[].
 * Handles two value formats:
 * - Timeline format: [{type: "user"|"team", id, name?}]  (written by syncTimelineEventToEntityProperties)
 * - Task format:     [{id, name}]                         (written by setEntityProperties assignee path)
 */
export function convertEntityPropertiesAssigneesToTimeline(
  namedFields: Array<{ field_name?: unknown; value?: unknown }>
): TimelineNamedAssignee[] {
  return namedFields
    .map((field) => {
      const fieldName = String(field?.field_name ?? "").trim();
      if (!fieldName) return null;
      const values = Array.isArray(field?.value) ? field.value : [];
      const normalizedValues: TimelineAssigneeValueEntry[] = values
        .map((entry: any) => {
          const type: TimelineAssigneeKind | null =
            entry?.type === "team" ? "team"
            : entry?.type === "user" ? "user"
            : entry?.id ? "user" // task format: no type field → assume user
            : null;
          const id = typeof entry?.id === "string" ? entry.id.trim() : "";
          if (!type || !id) return null;
          return { type, id, ...(entry?.name ? { name: entry.name } : {}) };
        })
        .filter(Boolean) as TimelineAssigneeValueEntry[];
      if (normalizedValues.length === 0) return null;
      return { field_name: fieldName, value: normalizedValues } as TimelineNamedAssignee;
    })
    .filter(Boolean) as TimelineNamedAssignee[];
}
