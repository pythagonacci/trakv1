"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTimelineAccess } from "./context";
import { validateEventStatus, validateEventPriority, validateTimelineDateRange } from "./validators";
import {
  getCanonicalTimelinePriority,
  mergeTimelinePriorityField,
  normalizeTimelinePriorities,
  normalizeTimelinePriorityValue,
  syncTimelinePriorityFieldsToEntityProperties,
} from "@/lib/timeline-priority-sync";
import type { AuthContext } from "@/lib/auth-context";
import type {
  TimelineEvent,
  TimelineEventStatus,
  TimelineEventPriority,
  TimelineNamedPriority,
} from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

function normalizeTimelineEventRow(row: any): TimelineEvent {
  const priorities = normalizeTimelinePriorities(row?.priorities);
  return {
    ...(row as TimelineEvent),
    priorities,
    priority: getCanonicalTimelinePriority(priorities),
  };
}

async function buildTimelinePrioritiesFromSourceTableRow(
  supabase: any,
  sourceEntityType: "task" | "timeline_event" | "table_row" | "block" | null,
  sourceEntityId: string | null
): Promise<TimelineNamedPriority[] | null> {
  if (sourceEntityType !== "table_row" || !sourceEntityId) return null;

  const { data: sourceRow } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("id", sourceEntityId)
    .maybeSingle();
  if (!sourceRow?.table_id) return null;

  const { data: priorityFields } = await supabase
    .from("table_fields")
    .select("id, name")
    .eq("table_id", sourceRow.table_id)
    .eq("type", "priority");
  if (!priorityFields || priorityFields.length === 0) return null;

  const sourceData = ((sourceRow.data ?? {}) as Record<string, unknown>);
  const extracted: TimelineNamedPriority[] = [];
  for (const field of priorityFields as Array<{ id: string; name: string }>) {
    const fieldName = String(field.name ?? "").trim();
    if (!fieldName) continue;
    const normalizedValue = normalizeTimelinePriorityValue(sourceData[field.id] ?? sourceData[fieldName]);
    if (!normalizedValue) continue;
    extracted.push({ field_name: fieldName, value: normalizedValue });
  }

  const normalized = normalizeTimelinePriorities(extracted);
  return normalized.length > 0 ? normalized : null;
}

export async function createTimelineEvent(input: {
  timelineBlockId: string;
  title: string;
  startDate: string;
  endDate: string;
  status?: TimelineEventStatus;
  priority?: TimelineEventPriority | null;
  priorities?: TimelineNamedPriority[];
  progress?: number;
  notes?: string | null;
  color?: string | null;
  isMilestone?: boolean;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  displayOrder?: number;
  assigneeId?: string;
  sourceEntityType?: "task" | "timeline_event" | "table_row" | "block";
  sourceEntityId?: string | null;
  sourceSyncMode?: "snapshot" | "live";
  authContext?: AuthContext;
}): Promise<ActionResult<TimelineEvent>> {
  const access = await requireTimelineAccess(input.timelineBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { valid, message } = validateTimelineDateRange(input.startDate, input.endDate);
  if (!valid) return { error: message || "Invalid date range" };

  if (input.status && !validateEventStatus(input.status)) {
    return { error: "Invalid status. Must be one of: todo, in_progress, blocked, done" };
  }

  if (input.priority && !validateEventPriority(input.priority)) {
    return { error: "Invalid priority. Must be one of: low, medium, high, urgent" };
  }
  if (input.priorities && normalizeTimelinePriorities(input.priorities).length !== input.priorities.length) {
    return { error: "Invalid priorities payload" };
  }

  const { supabase, userId, block } = access;
  const hasSourceMetadata = Boolean(input.sourceEntityType && input.sourceEntityId);
  const sourceEntityType = hasSourceMetadata ? input.sourceEntityType! : null;
  const sourceEntityId = hasSourceMetadata ? input.sourceEntityId! : null;
  const sourceSyncMode = hasSourceMetadata
    ? (sourceEntityType === "table_row" || sourceEntityType === "block" ? "snapshot" : (input.sourceSyncMode ?? "snapshot"))
    : null;
  const sourceRowPriorities =
    input.priorities === undefined
      ? await buildTimelinePrioritiesFromSourceTableRow(supabase, sourceEntityType, sourceEntityId)
      : null;
  const priorities =
    input.priorities !== undefined
      ? normalizeTimelinePriorities(input.priorities)
      : sourceRowPriorities ?? mergeTimelinePriorityField([], "Priority", input.priority ?? null);

  const { data: latestOrder } = await supabase
    .from("timeline_events")
    .select("display_order")
    .eq("timeline_block_id", block.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = typeof latestOrder?.display_order === "number" ? latestOrder.display_order + 1 : 0;

  const { data, error } = await supabase
    .from("timeline_events")
    .insert({
      timeline_block_id: block.id,
      workspace_id: block.workspace_id,
      title: input.title,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status ?? "todo",  // Changed default from "planned" to "todo"
      priorities,
      progress: input.progress ?? 0,
      notes: input.notes ?? null,
      color: input.color ?? null,
      is_milestone: input.isMilestone ?? false,
      baseline_start: input.baselineStart ?? null,
      baseline_end: input.baselineEnd ?? null,
      display_order: input.displayOrder ?? nextOrder,
      assignee_id: input.assigneeId ?? null,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      source_sync_mode: sourceSyncMode,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Database error creating timeline event:", error);
    return { error: `Failed to create timeline event: ${error.message || error.code}` };
  }

  if (!data) {
    return { error: "Failed to create timeline event: No data returned" };
  }

  const normalized = normalizeTimelineEventRow(data);

  // Sync status and priority to entity_properties
  await syncTimelineEventToEntityProperties(supabase, normalized.id, block.workspace_id, normalized.status, normalized.priorities);

  return { data: normalized };
}

export async function updateTimelineEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    startDate: string;
    endDate: string;
    status: TimelineEventStatus;
    priority: TimelineEventPriority | null;
    priorities: TimelineNamedPriority[];
    progress: number;
    notes: string | null;
    color: string | null;
    isMilestone: boolean;
    assigneeId: string | null;
    baselineStart: string | null;
    baselineEnd: string | null;
    displayOrder: number;
  }>,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<TimelineEvent>> {
  const access = await getEventContext(eventId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (updates.status && !validateEventStatus(updates.status)) {
    return { error: "Invalid status. Must be one of: todo, in_progress, blocked, done" };
  }

  if (updates.priority !== undefined && updates.priority !== null && !validateEventPriority(updates.priority)) {
    return { error: "Invalid priority. Must be one of: low, medium, high, urgent" };
  }
  if (updates.priorities !== undefined && normalizeTimelinePriorities(updates.priorities).length !== updates.priorities.length) {
    return { error: "Invalid priorities payload" };
  }

  if (updates.startDate && updates.endDate) {
    const { valid, message } = validateTimelineDateRange(updates.startDate, updates.endDate);
    if (!valid) return { error: message || "Invalid date range" };
  }

  const { supabase, userId, event } = access;

  const payload: Record<string, unknown> = {
    updated_by: userId,
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priorities !== undefined) payload.priorities = normalizeTimelinePriorities(updates.priorities);
  if (updates.priority !== undefined && updates.priorities === undefined) {
    payload.priorities = mergeTimelinePriorityField(
      normalizeTimelinePriorities((event as any).priorities),
      "Priority",
      updates.priority
    );
  }
  if (updates.progress !== undefined) payload.progress = updates.progress;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.isMilestone !== undefined) payload.is_milestone = updates.isMilestone;
  if (updates.assigneeId !== undefined) payload.assignee_id = updates.assigneeId;
  if (updates.baselineStart !== undefined) payload.baseline_start = updates.baselineStart;
  if (updates.baselineEnd !== undefined) payload.baseline_end = updates.baselineEnd;
  if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;

  const { data, error } = await supabase
    .from("timeline_events")
    .update(payload)
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    console.error("Database error updating timeline event:", {
      error,
      eventId,
      payload,
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      errorHint: error.hint,
    });

    // Provide more specific error messages based on error code
    if (error.code === "23503") {
      // Foreign key violation
      if (error.message?.includes("assignee_id") || error.message?.includes("timeline_events_assignee_id_fkey")) {
        console.error("Foreign key violation for assignee_id:", {
          assigneeId: payload.assignee_id,
          eventId,
          workspaceId: event?.workspace_id,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
        });
        return {
          error: `Invalid assignee: The selected user ID does not exist in the authentication system. This may happen if the user account was deleted. Please select a different user.`
        };
      }
      return { error: `Database constraint violation: ${error.message || "Invalid reference"}` };
    }

    if (error.code === "42501") {
      return { error: "Permission denied: You don't have access to update this event" };
    }

    return { error: `Failed to update timeline event: ${error.message || error.code || "Unknown error"}` };
  }

  if (!data) {
    return { error: "Failed to update timeline event: No data returned" };
  }
  const normalized = normalizeTimelineEventRow(data);

  // Sync status and priority to entity_properties if either was updated
  if (updates.status !== undefined || updates.priority !== undefined || updates.priorities !== undefined) {
    const finalStatus = updates.status ?? normalized.status;
    await syncTimelineEventToEntityProperties(supabase, eventId, event.workspace_id, finalStatus, normalized.priorities);
  }

  return { data: normalized };
}

export async function deleteTimelineEvent(eventId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await getEventContext(eventId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase } = access;
  const { error } = await supabase.from("timeline_events").delete().eq("id", eventId);

  if (error) return { error: "Failed to delete timeline event" };
  return { data: null };
}

export async function duplicateTimelineEvent(eventId: string): Promise<ActionResult<TimelineEvent>> {
  const access = await getEventContext(eventId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, userId, event } = access;
  const sourcePriorities = normalizeTimelinePriorities((event as any).priorities);
  const shouldPropagateRowSource = event.source_entity_type === "table_row" && Boolean(event.source_entity_id);

  const { data, error } = await supabase
    .from("timeline_events")
    .insert({
      timeline_block_id: event.timeline_block_id,
      workspace_id: event.workspace_id,
      title: `${event.title} (Copy)`,
      start_date: event.start_date,
      end_date: event.end_date,
      status: event.status,
      priorities: sourcePriorities,
      assignee_id: event.assignee_id,
      progress: event.progress,
      notes: event.notes,
      color: event.color,
      is_milestone: event.is_milestone,
      baseline_start: event.baseline_start,
      baseline_end: event.baseline_end,
      display_order: event.display_order + 1,
      ...(shouldPropagateRowSource
        ? {
            source_entity_type: "table_row",
            source_entity_id: event.source_entity_id,
            source_sync_mode: "snapshot" as const,
          }
        : {}),
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to duplicate timeline event" };
  }

  const normalized = normalizeTimelineEventRow(data);
  await syncTimelineEventToEntityProperties(supabase, normalized.id, normalized.workspace_id, normalized.status, normalized.priorities);
  return { data: normalized };
}

export async function setTimelineEventBaseline(eventId: string, baseline: { start: string | null; end: string | null }, opts?: { authContext?: AuthContext }): Promise<ActionResult<TimelineEvent>> {
  const access = await getEventContext(eventId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("timeline_events")
    .update({
      baseline_start: baseline.start,
      baseline_end: baseline.end,
      updated_by: userId,
    })
    .eq("id", eventId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update baseline" };
  }

  return { data: normalizeTimelineEventRow(data) };
}

async function getEventContext(eventId: string, opts?: { authContext?: AuthContext }): Promise<{ error: string } | { supabase: any; userId: string; event: TimelineEvent }> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const { data: event, error: eventError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return { error: "Timeline event not found" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", (event as any).workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId, event: event as TimelineEvent };
}

/**
 * Syncs timeline event status and priority to entity_properties table
 * This enables universal queries across all entity types
 */
async function syncTimelineEventToEntityProperties(
  supabase: any,
  eventId: string,
  workspaceId: string,
  status: TimelineEventStatus,
  priorities: TimelineNamedPriority[] | null | undefined
): Promise<void> {
  await supabase.from("entity_properties").upsert(
    {
      entity_type: "timeline_event",
      entity_id: eventId,
      workspace_id: workspaceId,
      property_definition_id: null,
      field_name: "Status",
      field_type: "status",
      value: status,
    },
    {
      onConflict: "entity_type,entity_id,field_name",
    }
  );

  await syncTimelinePriorityFieldsToEntityProperties(supabase, eventId, workspaceId, priorities);
}
