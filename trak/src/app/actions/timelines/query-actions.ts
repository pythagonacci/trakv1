"use server";

import { requireTimelineAccess } from "./context";
import { normalizeTimelinePriorities } from "@/lib/timeline-priority-sync";
import { normalizeTimelineStatuses } from "@/lib/timeline-status-sync";
import type { AuthContext } from "@/lib/auth-context";
import type { TimelineEvent, TimelineItem } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

function normalizeTimelineAssigneeIdsFromRow(row: any): { assignee_id: string | null; assignee_team_id: string | null } {
  const assignees = Array.isArray(row?.assignees) ? row.assignees : [];
  for (const field of assignees) {
    const values = Array.isArray((field as any)?.value) ? (field as any).value : [];
    const firstUser = values.find((entry: any) => entry?.type === "user" && typeof entry?.id === "string");
    if (firstUser?.id) {
      const firstTeam = values.find((entry: any) => entry?.type === "team" && typeof entry?.id === "string");
      return { assignee_id: firstUser.id, assignee_team_id: firstTeam?.id ?? null };
    }
    const firstTeam = values.find((entry: any) => entry?.type === "team" && typeof entry?.id === "string");
    if (firstTeam?.id) return { assignee_id: null, assignee_team_id: firstTeam.id };
  }
  return {
    assignee_id: row?.assignee_id ?? null,
    assignee_team_id: row?.assignee_team_id ?? null,
  };
}

export async function getTimelineItems(timelineBlockId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<{ events: TimelineEvent[] }>> {
  const access = await requireTimelineAccess(timelineBlockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, block } = access;

  const { data: events, error: eventError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("timeline_block_id", block.id)
    .order("display_order", { ascending: true })
    .order("start_date", { ascending: true });

  if (eventError) return { error: "Failed to load timeline events" };

  const normalizedEvents = ((events || []) as any[]).map((event) => {
    const priorities = normalizeTimelinePriorities(event?.priorities);
    const statuses = normalizeTimelineStatuses(event?.statuses);
    const assigneeCompat = normalizeTimelineAssigneeIdsFromRow(event);
    return {
      ...(event as TimelineEvent),
      priorities,
      statuses,
      assignees: Array.isArray((event as any)?.assignees) ? (event as any).assignees : [],
      assignee_id: assigneeCompat.assignee_id,
      assignee_team_id: assigneeCompat.assignee_team_id,
    } as TimelineEvent;
  });

  return { data: { events: normalizedEvents } };
}

export async function getResolvedTimelineItems(timelineBlockId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TimelineItem[]>> {
  const access = await requireTimelineAccess(timelineBlockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const itemsResult = await getTimelineItems(timelineBlockId, opts);
  if ("error" in itemsResult) return itemsResult;
  const items = itemsResult.data;

  const eventItems: TimelineItem[] = (items.events || []).map((event) => ({
    id: event.id,
    type: "event",
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    statuses: normalizeTimelineStatuses(event.statuses),
    priorities: normalizeTimelinePriorities(event.priorities),
    assignees: Array.isArray((event as any)?.assignees) ? (event as any).assignees : [],
    assignee_id: event.assignee_id,
    assignee_team_id: (event as any).assignee_team_id ?? null,
    parent_event_id: (event as any).parent_event_id ?? null,
    progress: event.progress,
    color: event.color,
    is_milestone: event.is_milestone,
    notes: event.notes ?? null,
    baseline_start: event.baseline_start,
    baseline_end: event.baseline_end,
    display_order: event.display_order,
    source_entity_type: event.source_entity_type ?? null,
    source_entity_id: event.source_entity_id ?? null,
    source_sync_mode: event.source_sync_mode ?? null,
  }));

  const combined = [...eventItems];
  combined.sort((a, b) => a.display_order - b.display_order);

  return { data: combined };
}

export async function getSubEventsByParentIds(
  timelineBlockId: string,
  parentEventIds: string[],
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<Record<string, TimelineEvent[]>>> {
  if (parentEventIds.length === 0) return { data: {} };

  const access = await requireTimelineAccess(timelineBlockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, block } = access;
  const uniqueParentIds = [...new Set(parentEventIds)];

  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("timeline_block_id", block.id)
    .in("parent_event_id", uniqueParentIds)
    .order("display_order", { ascending: true });
  if (error) return { error: "Failed to load timeline sub-events" };

  const byParentId: Record<string, TimelineEvent[]> = {};
  for (const parentId of uniqueParentIds) {
    byParentId[parentId] = [];
  }

  for (const row of (data ?? []) as any[]) {
    const parentId = row.parent_event_id as string | null;
    if (!parentId) continue;
    const priorities = normalizeTimelinePriorities(row?.priorities);
    const statuses = normalizeTimelineStatuses(row?.statuses);
    const assigneeCompat = normalizeTimelineAssigneeIdsFromRow(row);
    byParentId[parentId] = byParentId[parentId] ?? [];
    byParentId[parentId].push({
      ...(row as TimelineEvent),
      priorities,
      statuses,
      assignees: Array.isArray((row as any)?.assignees) ? (row as any).assignees : [],
      assignee_id: assigneeCompat.assignee_id,
      assignee_team_id: assigneeCompat.assignee_team_id,
    });
  }

  return { data: byParentId };
}
