"use server";

import { requireTimelineAccess } from "./context";
import type { TimelineEvent } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function bulkUpdateTimelineEvents(input: {
  timelineBlockId: string;
  updates: Array<{ id: string; startDate?: string; endDate?: string; displayOrder?: number }>;
}): Promise<ActionResult<null>> {
  const access = await requireTimelineAccess(input.timelineBlockId);
  if ("error" in access) return access;

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
  if ("error" in access) return access;

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
}): Promise<ActionResult<TimelineEvent[]>> {
  const access = await requireTimelineAccess(input.timelineBlockId);
  if ("error" in access) return access;

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
    status: event.status,
    assignee_id: event.assignee_id,
    progress: event.progress,
    notes: event.notes,
    color: event.color,
    is_milestone: event.is_milestone,
    baseline_start: event.baseline_start,
    baseline_end: event.baseline_end,
    display_order: event.display_order + idx + 1,
    created_by: userId,
    updated_by: userId,
  }));

  const { data, error } = await supabase
    .from("timeline_events")
    .insert(payload)
    .select("*");

  if (error || !data) return { error: "Failed to duplicate timeline events" };

  return { data: data as TimelineEvent[] };
}
