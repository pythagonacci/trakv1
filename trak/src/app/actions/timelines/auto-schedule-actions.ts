"use server";

import { requireTimelineAccess } from "./context";
import type { DependencyType, TimelineDependency, TimelineEvent } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

function getRequiredStart(
  dependencyType: DependencyType,
  fromStart: Date,
  fromEnd: Date,
  toStart: Date,
  toEnd: Date
) {
  switch (dependencyType) {
    case "start-to-start":
      return fromStart;
    case "finish-to-finish":
      return new Date(fromEnd.getTime() - (toEnd.getTime() - toStart.getTime()));
    case "start-to-finish":
      return new Date(fromStart.getTime() - (toEnd.getTime() - toStart.getTime()));
    case "finish-to-start":
    default:
      return fromEnd;
  }
}

export async function autoScheduleTimeline(timelineBlockId: string): Promise<ActionResult<TimelineEvent[]>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return access;

  const { supabase, userId, block } = access;

  const { data: events } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("timeline_block_id", block.id);

  const { data: dependencies } = await supabase
    .from("timeline_dependencies")
    .select("*")
    .eq("timeline_block_id", block.id);

  if (!events || !dependencies) return { error: "Failed to load timeline data" };

  const eventMap = new Map(events.map((event: any) => [event.id, event]));

  const updates: TimelineEvent[] = [];

  for (const dep of dependencies as TimelineDependency[]) {
    if (dep.to_type !== "event") continue;

    const toEvent = eventMap.get(dep.to_id) as TimelineEvent | undefined;
    if (!toEvent) continue;

    const fromRange = eventMap.get(dep.from_id);
    if (!fromRange) continue;

    const fromStart = new Date((fromRange as any).start_date);
    const fromEnd = new Date((fromRange as any).end_date);

    const toStart = new Date(toEvent.start_date);
    const toEnd = new Date(toEvent.end_date);

    const requiredStart = getRequiredStart(dep.dependency_type, fromStart, fromEnd, toStart, toEnd);

    if (requiredStart > toStart) {
      const duration = toEnd.getTime() - toStart.getTime();
      const nextStart = requiredStart;
      const nextEnd = new Date(requiredStart.getTime() + duration);
      toEvent.start_date = nextStart.toISOString();
      toEvent.end_date = nextEnd.toISOString();
      updates.push(toEvent);
    }
  }

  if (updates.length === 0) return { data: events as TimelineEvent[] };

  const payload = updates.map((event) => ({
    id: event.id,
    start_date: event.start_date,
    end_date: event.end_date,
    updated_by: userId,
  }));

  const { data, error } = await supabase
    .from("timeline_events")
    .upsert(payload, { onConflict: "id" })
    .select("*");

  if (error || !data) return { error: "Failed to auto-schedule timeline" };

  return { data: data as TimelineEvent[] };
}
