"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTimelineAccess } from "./context";
import { validateEventStatus, validateEventPriority, validateTimelineDateRange } from "./validators";
import type { AuthContext } from "@/lib/auth-context";
import type { TimelineEvent, TimelineEventStatus, TimelineEventPriority } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function createTimelineEvent(input: {
  timelineBlockId: string;
  title: string;
  startDate: string;
  endDate: string;
  status?: TimelineEventStatus;
  priority?: TimelineEventPriority | null;  // NEW: Priority parameter
  progress?: number;
  notes?: string | null;
  color?: string | null;
  isMilestone?: boolean;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  displayOrder?: number;
  assigneeId?: string;
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

  const { supabase, userId, block } = access;

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
      priority: input.priority ?? null,  // NEW: Priority field
      progress: input.progress ?? 0,
      notes: input.notes ?? null,
      color: input.color ?? null,
      is_milestone: input.isMilestone ?? false,
      baseline_start: input.baselineStart ?? null,
      baseline_end: input.baselineEnd ?? null,
      display_order: input.displayOrder ?? nextOrder,
      assignee_id: input.assigneeId ?? null,
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

  // Sync status and priority to entity_properties
  await syncTimelineEventToEntityProperties(supabase, data.id, block.workspace_id, data.status, data.priority);

  return { data: data as TimelineEvent };
}

export async function updateTimelineEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    startDate: string;
    endDate: string;
    status: TimelineEventStatus;
    priority: TimelineEventPriority | null;  // NEW: Priority parameter
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
  if (updates.priority !== undefined) payload.priority = updates.priority;  // NEW: Priority field
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

  // Sync status and priority to entity_properties if either was updated
  if (updates.status !== undefined || updates.priority !== undefined) {
    const finalStatus = updates.status ?? data.status;
    const finalPriority = updates.priority !== undefined ? updates.priority : data.priority;
    await syncTimelineEventToEntityProperties(supabase, eventId, event.workspace_id, finalStatus, finalPriority);
  }

  return { data: data as TimelineEvent };
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

  const { data, error } = await supabase
    .from("timeline_events")
    .insert({
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
      display_order: event.display_order + 1,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to duplicate timeline event" };
  }

  return { data: data as TimelineEvent };
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

  return { data: data as TimelineEvent };
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
  priority: TimelineEventPriority | null | undefined
): Promise<void> {
  // Get Status property_definition for this workspace
  const { data: statusPropDef } = await supabase
    .from("property_definitions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Status")
    .eq("type", "select")
    .single();

  if (statusPropDef) {
    // Upsert status to entity_properties
    await supabase
      .from("entity_properties")
      .upsert({
        entity_type: "timeline_event",
        entity_id: eventId,
        property_definition_id: statusPropDef.id,
        value: status,
        workspace_id: workspaceId,
      }, {
        onConflict: "entity_type,entity_id,property_definition_id"
      });
  }

  // Get Priority property_definition for this workspace
  const { data: priorityPropDef } = await supabase
    .from("property_definitions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Priority")
    .eq("type", "select")
    .single();

  if (priorityPropDef) {
    if (priority === null || priority === undefined) {
      // Delete entity_property if priority is cleared
      await supabase
        .from("entity_properties")
        .delete()
        .eq("entity_type", "timeline_event")
        .eq("entity_id", eventId)
        .eq("property_definition_id", priorityPropDef.id);
    } else {
      // Upsert priority to entity_properties
      await supabase
        .from("entity_properties")
        .upsert({
          entity_type: "timeline_event",
          entity_id: eventId,
          property_definition_id: priorityPropDef.id,
          value: priority,
          workspace_id: workspaceId,
        }, {
          onConflict: "entity_type,entity_id,property_definition_id"
        });
    }
  }
}
