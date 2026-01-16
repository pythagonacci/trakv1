"use server";

import { requireTimelineAccess } from "./context";
import type { TimelineEvent, TimelineItem } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function getTimelineItems(timelineBlockId: string): Promise<ActionResult<{ events: TimelineEvent[] }>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, block } = access;

  const { data: events, error: eventError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("timeline_block_id", block.id)
    .order("display_order", { ascending: true })
    .order("start_date", { ascending: true });

  if (eventError) return { error: "Failed to load timeline events" };

  return { data: { events: (events || []) as TimelineEvent[] } };
}

export async function getResolvedTimelineItems(timelineBlockId: string): Promise<ActionResult<TimelineItem[]>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const itemsResult = await getTimelineItems(timelineBlockId);
  if ("error" in itemsResult) return itemsResult;
  const items = itemsResult.data;

  const eventItems: TimelineItem[] = (items.events || []).map((event) => ({
    id: event.id,
    type: "event",
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    status: event.status,
    assignee_id: event.assignee_id,
    progress: event.progress,
    color: event.color,
    is_milestone: event.is_milestone,
    notes: event.notes ?? null,
    baseline_start: event.baseline_start,
    baseline_end: event.baseline_end,
    display_order: event.display_order,
  }));

  const combined = [...eventItems];
  combined.sort((a, b) => a.display_order - b.display_order);

  return { data: combined };
}
