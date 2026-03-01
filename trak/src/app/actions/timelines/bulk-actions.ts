"use server";

import { requireTimelineAccess } from "./context";
import {
  normalizeTimelinePriorities,
} from "@/lib/timeline-priority-sync";
import { syncTimelineEventToEntityProperties } from "./event-actions";
import { normalizeTimelineAssignees } from "@/lib/timeline-assignee-utils";
import type { AuthContext } from "@/lib/auth-context";
import type { TimelineEvent } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function bulkUpdateTimelineEvents(input: {
  timelineBlockId: string;
  updates: Array<{ id: string; startDate?: string; endDate?: string; displayOrder?: number }>;
  authContext?: AuthContext;
}): Promise<ActionResult<null>> {
  const access = await requireTimelineAccess(input.timelineBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.updates.length === 0) return { data: null };

  const { supabase, userId } = access;

  const payload = input.updates.map((update) => ({
    id: update.id,
    start_date: update.startDate,
    end_date: update.endDate,
    display_order: update.displayOrder,
    updated_by: userId,
  }));

  const { error } = await supabase
    .from("timeline_events")
    .upsert(payload, { onConflict: "id" });

  if (error) return { error: "Failed to update timeline events" };
  return { data: null };
}

export async function bulkDeleteTimelineEvents(input: {
  timelineBlockId: string;
  eventIds: string[];
}): Promise<ActionResult<null>> {
  const access = await requireTimelineAccess(input.timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.eventIds.length === 0) return { data: null };

  const { supabase } = access;
  const { error } = await supabase
    .from("timeline_events")
    .delete()
    .eq("timeline_block_id", input.timelineBlockId)
    .in("id", input.eventIds);

  if (error) return { error: "Failed to delete timeline events" };
  return { data: null };
}

export async function bulkDuplicateTimelineEvents(input: {
  timelineBlockId: string;
  eventIds: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<TimelineEvent[]>> {
  const access = await requireTimelineAccess(input.timelineBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (input.eventIds.length === 0) return { data: [] };

  const { supabase, userId } = access;

  const { data: events } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("timeline_block_id", input.timelineBlockId)
    .in("id", input.eventIds);

  if (!events || events.length === 0) return { data: [] };

  const payload = events.map((event: any, idx: number) => ({
    timeline_block_id: event.timeline_block_id,
    workspace_id: event.workspace_id,
    title: `${event.title} (Copy)`,
    start_date: event.start_date,
    end_date: event.end_date,
    statuses: event.statuses,
    priorities: normalizeTimelinePriorities(event.priorities),
    assignees: Array.isArray(event.assignees) ? event.assignees : [],
    assignee_id: event.assignee_id,
    assignee_team_id: (event as any).assignee_team_id ?? null,
    tags: Array.isArray((event as any).tags) ? (event as any).tags : [],
    progress: event.progress,
    notes: event.notes,
    color: event.color,
    is_milestone: event.is_milestone,
    baseline_start: event.baseline_start,
    baseline_end: event.baseline_end,
    display_order: event.display_order + idx + 1,
    ...(event.source_entity_type === "table_row" && event.source_entity_id
      ? {
        source_entity_type: "table_row",
        source_entity_id: event.source_entity_id,
        source_sync_mode: "live" as const,
      }
      : {}),
    created_by: userId,
    updated_by: userId,
  }));

  const { data, error } = await supabase
    .from("timeline_events")
    .insert(payload)
    .select("*");

  if (error || !data) return { error: "Failed to duplicate timeline events" };
  const normalized = (data as any[]).map((event) => {
    const priorities = normalizeTimelinePriorities(event?.priorities);
    return {
      ...(event as TimelineEvent),
      priorities,
    } as TimelineEvent;
  });

  await Promise.all(
    normalized.map(async (event) => {
      const assignees = normalizeTimelineAssignees((event as any).assignees ?? []);
      const tags = Array.isArray((event as any).tags) ? (event as any).tags as string[] : [];
      await syncTimelineEventToEntityProperties(
        supabase,
        event.id,
        event.workspace_id,
        event.statuses,
        event.priorities,
        assignees,
        tags
      );
    })
  );

  return { data: normalized };
}
