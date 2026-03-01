"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTimelineAccess } from "./context";
import { validateEventStatus, validateEventPriority, validateTimelineDateRange } from "./validators";
import {
  mergeTimelinePriorityField,
  normalizeTimelinePriorities,
  normalizeTimelinePriorityValue,
  syncTimelinePriorityFieldsToEntityProperties,
} from "@/lib/timeline-priority-sync";
import {
  mergeTimelineStatusField,
  normalizeTimelineStatuses,
  syncTimelineStatusFieldsToEntityProperties,
} from "@/lib/timeline-status-sync";
import { updateTaskItem } from "@/app/actions/tasks/item-actions";
import type { AuthContext } from "@/lib/auth-context";
import type {
  TimelineEvent,
  TimelineNamedAssignee,
  TimelineAssigneeValueEntry,
  TimelineEventStatus,
  TimelineEventPriority,
  TimelineNamedPriority,
  TimelineNamedStatus,
} from "@/types/timeline";
import {
  normalizeTimelineAssignees,
  deriveTimelineLegacyAssigneeIds,
} from "@/lib/timeline-assignee-utils";

type ActionResult<T> = { data: T } | { error: string };

function normalizeTimelineEventRow(row: any): TimelineEvent {
  const priorities = normalizeTimelinePriorities(row?.priorities);
  const statuses = normalizeTimelineStatuses(row?.statuses ?? []);
  const assignees = normalizeTimelineAssignees(row?.assignees ?? []);
  const compat = deriveTimelineLegacyAssigneeIds(assignees, {
    assignee_id: (row as any)?.assignee_id ?? null,
    assignee_team_id: (row as any)?.assignee_team_id ?? null,
  });
  return {
    ...(row as TimelineEvent),
    priorities,
    statuses,
    assignees,
    assignee_id: compat.assignee_id,
    assignee_team_id: compat.assignee_team_id,
  };
}

// normalizeTimelineAssignees and deriveTimelineLegacyAssigneeIds are imported from @/lib/timeline-assignee-utils

function buildTimelineAssigneesFromLegacy(input: {
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
}): TimelineNamedAssignee[] {
  const values: TimelineAssigneeValueEntry[] = [];
  if (input.assigneeId) values.push({ type: "user", id: input.assigneeId });
  if (input.assigneeTeamId) values.push({ type: "team", id: input.assigneeTeamId });
  if (values.length === 0) return [];
  return [{ field_name: "Assignee", value: values }];
}


function extractUserAssigneeIds(assignees: TimelineNamedAssignee[]): string[] {
  return Array.from(
    new Set(
      assignees
        .flatMap((field) => field.value)
        .filter((entry) => entry.type === "user")
        .map((entry) => entry.id)
    )
  );
}

function normalizeFieldName(name: string): string {
  return String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
}

function toDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.slice(0, 10);
}

function formatDateRangeCellValue(
  start: string | null,
  end: string | null
): { start: string; end: string } | string | null {
  if (!start && !end) return null;
  const resolvedStart = start ?? end;
  const resolvedEnd = end ?? start;
  if (!resolvedStart || !resolvedEnd) return resolvedStart ?? resolvedEnd ?? null;
  if (resolvedStart === resolvedEnd) return resolvedEnd;
  return { start: resolvedStart, end: resolvedEnd };
}

async function syncTimelineEventUpdateToSourceTableRow(params: {
  supabase: any;
  sourceRowId: string;
  userId: string;
  event: TimelineEvent;
}): Promise<void> {
  const { supabase, sourceRowId, userId, event } = params;
  const { data: sourceRow } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("id", sourceRowId)
    .maybeSingle();
  if (!sourceRow?.table_id) return;

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, is_primary")
    .eq("table_id", sourceRow.table_id);
  if (!fields || fields.length === 0) return;

  const namedStatuses = normalizeTimelineStatuses((event as any).statuses);
  const namedPriorities = normalizeTimelinePriorities((event as any).priorities);
  const assigneeIds = extractUserAssigneeIds(normalizeTimelineAssignees((event as any).assignees ?? []));
  const primaryAssigneeId = assigneeIds[0] ?? null;
  const nextData: Record<string, unknown> = { ...((sourceRow.data ?? {}) as Record<string, unknown>) };

  const primaryField = fields.find((f: any) => Boolean(f.is_primary))
    ?? fields.find((f: any) => normalizeFieldName(f.name).includes("title") || normalizeFieldName(f.name) === "event");
  if (primaryField) nextData[primaryField.id] = event.title ?? "";

  const statusFields = fields.filter((f: any) => f.type === "status");
  const priorityFields = fields.filter((f: any) => f.type === "priority");
  const assigneeField = fields.find((f: any) => f.type === "person");

  for (const entry of namedStatuses) {
    const match = statusFields.find((f: any) => normalizeFieldName(f.name) === normalizeFieldName(entry.field_name));
    if (match) nextData[match.id] = entry.value;
  }

  for (const entry of namedPriorities) {
    const match = priorityFields.find((f: any) => normalizeFieldName(f.name) === normalizeFieldName(entry.field_name));
    if (match) nextData[match.id] = entry.value;
  }
  if (assigneeField) {
    nextData[assigneeField.id] = primaryAssigneeId;
  }

  const startField = fields.find((f: any) => normalizeFieldName(f.name).includes("start") && f.type === "date")
    ?? fields.find((f: any) => normalizeFieldName(f.name).includes("start"));
  const endField = fields.find((f: any) => normalizeFieldName(f.name).includes("end") && f.type === "date")
    ?? fields.find((f: any) => normalizeFieldName(f.name).includes("due") || normalizeFieldName(f.name).includes("end"));
  const singleDateField = fields.find((f: any) => f.type === "date");
  const startDate = toDateOnly((event as any).start_date);
  const endDate = toDateOnly((event as any).end_date);
  if (startField && startDate) nextData[startField.id] = startDate;
  if (endField && endDate) nextData[endField.id] = endDate;
  if (!startField && !endField && singleDateField) {
    nextData[singleDateField.id] = formatDateRangeCellValue(startDate, endDate);
  }

  await supabase
    .from("table_rows")
    .update({ data: nextData, updated_by: userId })
    .eq("id", sourceRowId);
}

async function syncTimelineEventUpdateToDerivedRows(params: {
  supabase: any;
  sourceEventId: string;
  userId: string;
  event: TimelineEvent;
}): Promise<void> {
  const { supabase, sourceEventId, userId, event } = params;
  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("source_entity_type", "timeline_event")
    .eq("source_entity_id", sourceEventId)
    .eq("source_sync_mode", "live");
  if (!rows || rows.length === 0) return;

  const tableIds = Array.from(new Set(rows.map((r: any) => r.table_id)));
  const { data: allFields } = await supabase
    .from("table_fields")
    .select("id, table_id, name, type, is_primary")
    .in("table_id", tableIds);
  const fieldsByTable = new Map<string, any[]>();
  for (const field of allFields ?? []) {
    const list = fieldsByTable.get((field as any).table_id) ?? [];
    list.push(field);
    fieldsByTable.set((field as any).table_id, list);
  }

  const namedStatuses = normalizeTimelineStatuses((event as any).statuses);
  const namedPriorities = normalizeTimelinePriorities((event as any).priorities);
  const assigneeIds = extractUserAssigneeIds(normalizeTimelineAssignees((event as any).assignees ?? []));
  const primaryAssigneeId = assigneeIds[0] ?? null;
  const startDate = toDateOnly((event as any).start_date);
  const endDate = toDateOnly((event as any).end_date);

  for (const row of rows as any[]) {
    const fields = fieldsByTable.get(row.table_id) ?? [];
    const nextData: Record<string, unknown> = { ...((row.data ?? {}) as Record<string, unknown>) };

    const primaryField = fields.find((f: any) => Boolean(f.is_primary))
      ?? fields.find((f: any) => normalizeFieldName(f.name).includes("title") || normalizeFieldName(f.name) === "event");
    if (primaryField) nextData[primaryField.id] = event.title ?? "";

    const statusFields = fields.filter((f: any) => f.type === "status");
    const priorityFields = fields.filter((f: any) => f.type === "priority");
    const assigneeField = fields.find((f: any) => f.type === "person");

    for (const entry of namedStatuses) {
      const match = statusFields.find((f: any) => normalizeFieldName(f.name) === normalizeFieldName(entry.field_name));
      if (match) nextData[match.id] = entry.value;
    }

    for (const entry of namedPriorities) {
      const match = priorityFields.find((f: any) => normalizeFieldName(f.name) === normalizeFieldName(entry.field_name));
      if (match) nextData[match.id] = entry.value;
    }
    if (assigneeField) {
      nextData[assigneeField.id] = primaryAssigneeId;
    }

    const startField = fields.find((f: any) => normalizeFieldName(f.name).includes("start") && f.type === "date")
      ?? fields.find((f: any) => normalizeFieldName(f.name).includes("start"));
    const endField = fields.find((f: any) => normalizeFieldName(f.name).includes("end") && f.type === "date")
      ?? fields.find((f: any) => normalizeFieldName(f.name).includes("due") || normalizeFieldName(f.name).includes("end"));
    const singleDateField = fields.find((f: any) => f.type === "date");
    if (startField && startDate) nextData[startField.id] = startDate;
    if (endField && endDate) nextData[endField.id] = endDate;
    if (!startField && !endField && singleDateField) {
      nextData[singleDateField.id] = formatDateRangeCellValue(startDate, endDate);
    }

    await supabase
      .from("table_rows")
      .update({ data: nextData, updated_by: userId })
      .eq("id", row.id);
  }
}

async function syncTimelineEventUpdateToDerivedTasks(params: {
  supabase: any;
  sourceEventId: string;
  userId: string;
  event: TimelineEvent;
}): Promise<void> {
  const { supabase, sourceEventId, userId, event } = params;
  const { data: tasks } = await supabase
    .from("task_items")
    .select("id, workspace_id")
    .eq("source_entity_type", "timeline_event")
    .eq("source_entity_id", sourceEventId)
    .eq("source_sync_mode", "live");
  if (!tasks || tasks.length === 0) return;

  const statuses = normalizeTimelineStatuses((event as any).statuses).map((entry) => ({
    field_name: entry.field_name,
    value: entry.value,
  }));
  const priorities = normalizeTimelinePriorities((event as any).priorities).map((entry) => ({
    field_name: entry.field_name,
    value: entry.value,
  }));
  const assignees = normalizeTimelineAssignees((event as any).assignees ?? []);
  const assigneeIds = extractUserAssigneeIds(assignees);
  const firstAssigneeId = assigneeIds[0] ?? null;
  const taskNamedAssignees = assignees
    .map((entry) => ({
      field_name: entry.field_name,
      value: entry.value.filter((value) => value.type === "user").map((value) => value.id),
    }))
    .filter((entry) => entry.value.length > 0);

  for (const task of tasks as any[]) {
    await supabase
      .from("task_items")
      .update({
        title: event.title ?? "",
        statuses,
        priorities,
        assignees: taskNamedAssignees,
        start_date: (event as any).start_date?.slice?.(0, 10) ?? null,
        due_date: (event as any).end_date?.slice?.(0, 10) ?? null,
        description: event.notes ?? null,
        assignee_id: firstAssigneeId,
        updated_by: userId,
      })
      .eq("id", task.id);
    await supabase.from("task_assignees").delete().eq("task_id", task.id);
    if (assigneeIds.length > 0) {
      await supabase.from("task_assignees").insert(
        assigneeIds.map((assigneeId) => ({
          task_id: task.id,
          assignee_id: assigneeId,
          assignee_name: assigneeId,
        }))
      );
    }
    // Bug 1.1 fix: sync entity_properties for derived task
    if (task.workspace_id) {
      await supabase.from("entity_properties").delete()
        .eq("entity_type", "task").eq("entity_id", task.id).eq("field_type", "status");
      await supabase.from("entity_properties").delete()
        .eq("entity_type", "task").eq("entity_id", task.id).eq("field_type", "priority");
      if (statuses.length > 0) {
        await supabase.from("entity_properties").upsert(
          statuses.map((e) => ({ entity_type: "task", entity_id: task.id, workspace_id: task.workspace_id, field_name: e.field_name, field_type: "status", value: e.value })),
          { onConflict: "entity_type,entity_id,field_name" }
        );
      }
      if (priorities.length > 0) {
        await supabase.from("entity_properties").upsert(
          priorities.map((e) => ({ entity_type: "task", entity_id: task.id, workspace_id: task.workspace_id, field_name: e.field_name, field_type: "priority", value: e.value })),
          { onConflict: "entity_type,entity_id,field_name" }
        );
      }
      await supabase.from("entity_properties").delete()
        .eq("entity_type", "task").eq("entity_id", task.id).eq("field_type", "assignee");
      if (assigneeIds.length > 0) {
        await supabase.from("entity_properties").upsert(
          [{
            entity_type: "task",
            entity_id: task.id,
            workspace_id: task.workspace_id,
            field_name: "Assignee",
            field_type: "assignee",
            value: assigneeIds.map((id) => ({ id, name: id })),
          }],
          { onConflict: "entity_type,entity_id,field_name" }
        );
      }
    }
  }
}

async function syncTimelineEventUpdateToDerivedTimelineEvents(params: {
  supabase: any;
  sourceEventId: string;
  userId: string;
  event: TimelineEvent;
}): Promise<void> {
  const { supabase, sourceEventId, userId, event } = params;
  const { data: events } = await supabase
    .from("timeline_events")
    .select("id, workspace_id")
    .eq("source_entity_type", "timeline_event")
    .eq("source_entity_id", sourceEventId)
    .eq("source_sync_mode", "live");
  if (!events || events.length === 0) return;

  const childStatuses = normalizeTimelineStatuses((event as any).statuses);
  const childPriorities = normalizeTimelinePriorities((event as any).priorities);
  const childAssignees = normalizeTimelineAssignees((event as any).assignees ?? []);
  const childCompatAssignees = deriveTimelineLegacyAssigneeIds(childAssignees, {
    assignee_id: (event as any).assignee_id ?? null,
    assignee_team_id: (event as any).assignee_team_id ?? null,
  });

  for (const child of events as any[]) {
    if (child.id === sourceEventId) continue;
    await supabase
      .from("timeline_events")
      .update({
        title: event.title ?? "",
        statuses: childStatuses,
        priorities: childPriorities,
        assignees: childAssignees,
        assignee_id: childCompatAssignees.assignee_id,
        assignee_team_id: childCompatAssignees.assignee_team_id,
        start_date: (event as any).start_date ?? null,
        end_date: (event as any).end_date ?? null,
        notes: event.notes ?? null,
        updated_by: userId,
      })
      .eq("id", child.id);
    // Bug 1.3 fix: sync entity_properties for derived timeline event
    if (child.workspace_id) {
      const childTags = Array.isArray((event as any).tags) ? (event as any).tags as string[] : [];
      await syncTimelineEventToEntityProperties(supabase, child.id, child.workspace_id, childStatuses, childPriorities, childAssignees, childTags);
    }
  }
}

async function buildTimelinePrioritiesFromSourceEntity(
  supabase: any,
  sourceEntityType: "task" | "timeline_event" | "table_row" | "block" | "subtask" | null,
  sourceEntityId: string | null
): Promise<TimelineNamedPriority[] | null> {
  if (!sourceEntityType || !sourceEntityId || sourceEntityType === "block" || sourceEntityType === "subtask") return null;

  if (sourceEntityType === "task") {
    const { data: sourceTask } = await supabase
      .from("task_items")
      .select("priorities")
      .eq("id", sourceEntityId)
      .maybeSingle();
    if (sourceTask?.priorities) {
      const normalized = normalizeTimelinePriorities(sourceTask.priorities);
      return normalized.length > 0 ? normalized : null;
    }
    return null;
  }

  if (sourceEntityType === "timeline_event") {
    const { data: sourceEvent } = await supabase
      .from("timeline_events")
      .select("priorities")
      .eq("id", sourceEntityId)
      .maybeSingle();
    if (sourceEvent?.priorities) {
      const normalized = normalizeTimelinePriorities(sourceEvent.priorities);
      return normalized.length > 0 ? normalized : null;
    }
    return null;
  }

  if (sourceEntityType === "table_row") {
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

  return null;
}

async function buildTimelineStatusesFromSourceEntity(
  supabase: any,
  sourceEntityType: "task" | "timeline_event" | "table_row" | "block" | "subtask" | null,
  sourceEntityId: string | null
): Promise<TimelineNamedStatus[] | null> {
  if (!sourceEntityType || !sourceEntityId || sourceEntityType === "block" || sourceEntityType === "subtask") return null;

  if (sourceEntityType === "task") {
    const { data: sourceTask } = await supabase
      .from("task_items")
      .select("statuses")
      .eq("id", sourceEntityId)
      .maybeSingle();
    if (sourceTask?.statuses) {
      const normalized = normalizeTimelineStatuses(sourceTask.statuses);
      return normalized.length > 0 ? normalized : null;
    }
    return null;
  }

  if (sourceEntityType === "timeline_event") {
    const { data: sourceEvent } = await supabase
      .from("timeline_events")
      .select("statuses")
      .eq("id", sourceEntityId)
      .maybeSingle();
    if (sourceEvent?.statuses) {
      const normalized = normalizeTimelineStatuses(sourceEvent.statuses);
      return normalized.length > 0 ? normalized : null;
    }
    return null;
  }

  if (sourceEntityType === "table_row") {
    const { data: sourceRow } = await supabase
      .from("table_rows")
      .select("id, table_id, data")
      .eq("id", sourceEntityId)
      .maybeSingle();
    if (!sourceRow?.table_id) return null;

    const { data: statusFields } = await supabase
      .from("table_fields")
      .select("id, name")
      .eq("table_id", sourceRow.table_id)
      .eq("type", "status");
    if (!statusFields || statusFields.length === 0) return null;

    const sourceData = ((sourceRow.data ?? {}) as Record<string, unknown>);
    const extracted: TimelineNamedStatus[] = [];
    for (const field of statusFields as Array<{ id: string; name: string }>) {
      const fieldName = String(field.name ?? "").trim();
      if (!fieldName) continue;
      const rawValue = sourceData[field.id] ?? sourceData[fieldName];
      if (typeof rawValue !== "string") continue;
      const normalizedValue = ["todo", "in_progress", "blocked", "done"].includes(rawValue.toLowerCase())
        ? rawValue.toLowerCase() as TimelineEventStatus
        : null;
      if (!normalizedValue) continue;
      extracted.push({ field_name: fieldName, value: normalizedValue });
    }

    const normalized = normalizeTimelineStatuses(extracted);
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

async function buildTimelineAssigneesFromSourceEntity(
  supabase: any,
  sourceEntityType: "task" | "timeline_event" | "table_row" | "block" | "subtask" | null,
  sourceEntityId: string | null
): Promise<TimelineNamedAssignee[] | null> {
  if (!sourceEntityType || !sourceEntityId || sourceEntityType === "block" || sourceEntityType === "subtask") return null;

  if (sourceEntityType === "task") {
    const { data: sourceTask } = await supabase
      .from("task_items")
      .select("assignees, assignee_id")
      .eq("id", sourceEntityId)
      .maybeSingle();
    const rawNamed = Array.isArray(sourceTask?.assignees) ? sourceTask.assignees : [];
    const rawIds = rawNamed
      .flatMap((entry: any) => Array.isArray(entry?.value) ? entry.value : [])
      .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
      .filter((id: string) => id.length > 0);
    const fallbackId = typeof sourceTask?.assignee_id === "string" ? sourceTask.assignee_id : null;
    const ids = Array.from(new Set([...(fallbackId ? [fallbackId] : []), ...rawIds]));
    if (ids.length === 0) return null;
    return [{ field_name: "Assignee", value: ids.map((id) => ({ type: "user", id })) }];
  }

  if (sourceEntityType === "timeline_event") {
    const { data: sourceEvent } = await supabase
      .from("timeline_events")
      .select("assignees, assignee_id, assignee_team_id")
      .eq("id", sourceEntityId)
      .maybeSingle();
    const normalized = normalizeTimelineAssignees(sourceEvent?.assignees ?? []);
    if (normalized.length > 0) return normalized;
    return buildTimelineAssigneesFromLegacy({
      assigneeId: sourceEvent?.assignee_id ?? null,
      assigneeTeamId: sourceEvent?.assignee_team_id ?? null,
    });
  }

  if (sourceEntityType === "table_row") {
    const { data: sourceRow } = await supabase
      .from("table_rows")
      .select("id, table_id, data")
      .eq("id", sourceEntityId)
      .maybeSingle();
    if (!sourceRow?.table_id) return null;
    const { data: personFields } = await supabase
      .from("table_fields")
      .select("id, name")
      .eq("table_id", sourceRow.table_id)
      .eq("type", "person");
    if (!personFields || personFields.length === 0) return null;
    const sourceData = ((sourceRow.data ?? {}) as Record<string, unknown>);
    const assignees: TimelineNamedAssignee[] = [];
    for (const field of personFields as Array<{ id: string; name: string }>) {
      const rawValue = sourceData[field.id] ?? sourceData[field.name];
      const rawValues = Array.isArray(rawValue) ? rawValue : rawValue == null ? [] : [rawValue];
      const ids = rawValues
        .map((entry) => {
          if (typeof entry === "string") return entry.trim();
          if (entry && typeof entry === "object" && typeof (entry as any).id === "string") return (entry as any).id.trim();
          return "";
        })
        .filter((id) => id.length > 0);
      if (ids.length === 0) continue;
      assignees.push({
        field_name: String(field.name || "Assignee"),
        value: Array.from(new Set(ids)).map((id) => ({ type: "user", id })),
      });
    }
    return assignees.length > 0 ? assignees : null;
  }

  return null;
}

export async function createTimelineEvent(input: {
  timelineBlockId: string;
  parentEventId?: string | null;
  title: string;
  startDate: string;
  endDate: string;
  status?: TimelineEventStatus;
  statuses?: TimelineNamedStatus[];
  priority?: TimelineEventPriority | null;
  priorities?: TimelineNamedPriority[];
  progress?: number;
  notes?: string | null;
  color?: string | null;
  isMilestone?: boolean;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  displayOrder?: number;
  assignees?: TimelineNamedAssignee[];
  assigneeIds?: string[];
  assigneeTeamIds?: string[];
  assigneeId?: string;
  assigneeTeamId?: string | null;
  sourceEntityType?: "task" | "timeline_event" | "table_row" | "block" | "subtask";
  sourceEntityId?: string | null;
  sourceSyncMode?: "snapshot" | "live";
  tags?: string[];
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
  if (input.statuses && normalizeTimelineStatuses(input.statuses).length !== input.statuses.length) {
    return { error: "Invalid statuses payload" };
  }

  const { supabase, userId, block } = access;
  let normalizedParentEventId: string | null = null;
  if (input.parentEventId) {
    const { data: parent, error: parentError } = await supabase
      .from("timeline_events")
      .select("id, parent_event_id, timeline_block_id")
      .eq("id", input.parentEventId)
      .maybeSingle();
    if (parentError || !parent) return { error: "Parent event not found" };
    if ((parent as any).parent_event_id) {
      return { error: "Cannot nest sub-events more than 1 level deep" };
    }
    if ((parent as any).timeline_block_id !== block.id) {
      return { error: "Sub-event must belong to the same timeline block as its parent" };
    }
    normalizedParentEventId = parent.id as string;
  }

  const hasSourceMetadata = Boolean(input.sourceEntityType && input.sourceEntityId);
  const sourceEntityType = hasSourceMetadata ? input.sourceEntityType! : null;
  const sourceEntityId = hasSourceMetadata ? input.sourceEntityId! : null;
  const sourceSyncMode = hasSourceMetadata
    ? (input.sourceSyncMode ?? "live")
    : null;

  const sourceRowPriorities =
    input.priorities === undefined
      ? await buildTimelinePrioritiesFromSourceEntity(supabase, sourceEntityType, sourceEntityId)
      : null;
  const priorities =
    input.priorities !== undefined
      ? normalizeTimelinePriorities(input.priorities)
      : sourceRowPriorities && sourceRowPriorities.length > 0
        ? sourceRowPriorities
        : input.priority !== undefined
          ? mergeTimelinePriorityField([], "Priority", input.priority ?? null)
          : mergeTimelinePriorityField([], "Priority", null);

  const sourceRowStatuses =
    input.statuses === undefined
      ? await buildTimelineStatusesFromSourceEntity(supabase, sourceEntityType, sourceEntityId)
      : null;
  const statuses =
    input.statuses !== undefined
      ? normalizeTimelineStatuses(input.statuses)
      : input.status !== undefined
        ? mergeTimelineStatusField(sourceRowStatuses ?? [], "Status", input.status ?? "todo")
        : sourceRowStatuses ?? mergeTimelineStatusField([], "Status", "todo");
  const sourceRowAssignees =
    input.assignees === undefined &&
      input.assigneeIds === undefined &&
      input.assigneeTeamIds === undefined &&
      input.assigneeId === undefined &&
      input.assigneeTeamId === undefined
      ? await buildTimelineAssigneesFromSourceEntity(supabase, sourceEntityType, sourceEntityId)
      : null;
  const assignees =
    input.assignees !== undefined
      ? normalizeTimelineAssignees(input.assignees)
      : (Array.isArray(input.assigneeIds) && input.assigneeIds.length > 0) || (Array.isArray(input.assigneeTeamIds) && input.assigneeTeamIds.length > 0)
        ? normalizeTimelineAssignees([{
          field_name: "Assignee",
          value: [
            ...(input.assigneeIds ?? []).map((id) => ({ type: "user", id })),
            ...(input.assigneeTeamIds ?? []).map((id) => ({ type: "team", id })),
          ],
        }])
        : sourceRowAssignees && sourceRowAssignees.length > 0
          ? sourceRowAssignees
        : buildTimelineAssigneesFromLegacy({
          assigneeId: input.assigneeId,
          assigneeTeamId: input.assigneeTeamId ?? null,
        });
  const assigneeCompat = deriveTimelineLegacyAssigneeIds(assignees, {
    assignee_id: input.assigneeId ?? null,
    assignee_team_id: input.assigneeTeamId ?? null,
  });

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
      statuses,
      priorities,
      parent_event_id: normalizedParentEventId,
      progress: input.progress ?? 0,
      notes: input.notes ?? null,
      color: input.color ?? null,
      is_milestone: input.isMilestone ?? false,
      baseline_start: input.baselineStart ?? null,
      baseline_end: input.baselineEnd ?? null,
      display_order: input.displayOrder ?? nextOrder,
      assignees,
      assignee_id: assigneeCompat.assignee_id,
      assignee_team_id: assigneeCompat.assignee_team_id,
      tags: Array.isArray(input.tags) ? input.tags : [],
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

  // Sync status, priority, assignees, and tags to entity_properties
  const createdTags = Array.isArray((data as any).tags) ? (data as any).tags as string[] : [];
  await syncTimelineEventToEntityProperties(supabase, normalized.id, block.workspace_id, normalized.statuses, normalized.priorities, normalized.assignees, createdTags);

  return { data: normalized };
}

export async function updateTimelineEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    startDate: string;
    endDate: string;
    status: TimelineEventStatus;
    statuses: TimelineNamedStatus[];
    priority: TimelineEventPriority | null;
    priorities: TimelineNamedPriority[];
    progress: number;
    notes: string | null;
    color: string | null;
    isMilestone: boolean;
    assignees: TimelineNamedAssignee[];
    assigneeIds: string[];
    assigneeTeamIds: string[];
    assigneeId: string | null;
    assigneeTeamId: string | null;
    baselineStart: string | null;
    baselineEnd: string | null;
    displayOrder: number;
    sourceSyncMode: "snapshot" | "live";
    tags: string[];
  }>,
  opts?: { authContext?: AuthContext; skipDerivedFanout?: boolean; skipSourceWriteback?: boolean; skipEntityPropertiesSync?: boolean }
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
  if (updates.statuses !== undefined && normalizeTimelineStatuses(updates.statuses).length !== updates.statuses.length) {
    return { error: "Invalid statuses payload" };
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
  if (updates.statuses !== undefined) payload.statuses = normalizeTimelineStatuses(updates.statuses);
  if (updates.status !== undefined && updates.statuses === undefined) {
    payload.statuses = mergeTimelineStatusField(
      normalizeTimelineStatuses((event as any).statuses),
      "Status",
      updates.status
    );
  }
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
  const shouldUpdateAssignees =
    updates.assignees !== undefined ||
    updates.assigneeIds !== undefined ||
    updates.assigneeTeamIds !== undefined ||
    updates.assigneeId !== undefined ||
    updates.assigneeTeamId !== undefined;
  if (shouldUpdateAssignees) {
    const nextAssignees =
      updates.assignees !== undefined
        ? normalizeTimelineAssignees(updates.assignees)
        : (updates.assigneeIds !== undefined || updates.assigneeTeamIds !== undefined)
          ? normalizeTimelineAssignees([{
            field_name: "Assignee",
            value: [
              ...((updates.assigneeIds ?? []).map((id) => ({ type: "user", id }))),
              ...((updates.assigneeTeamIds ?? []).map((id) => ({ type: "team", id }))),
            ],
          }])
          : buildTimelineAssigneesFromLegacy({
            assigneeId: updates.assigneeId ?? null,
            assigneeTeamId: updates.assigneeTeamId ?? null,
          });
    const compat = deriveTimelineLegacyAssigneeIds(nextAssignees, {
      assignee_id: (event as any).assignee_id ?? null,
      assignee_team_id: (event as any).assignee_team_id ?? null,
    });
    payload.assignees = nextAssignees;
    payload.assignee_id = compat.assignee_id;
    payload.assignee_team_id = compat.assignee_team_id;
  }
  if (updates.baselineStart !== undefined) payload.baseline_start = updates.baselineStart;
  if (updates.baselineEnd !== undefined) payload.baseline_end = updates.baselineEnd;
  if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
  if (updates.sourceSyncMode !== undefined) payload.source_sync_mode = updates.sourceSyncMode;
  if (updates.tags !== undefined) payload.tags = Array.isArray(updates.tags) ? updates.tags : [];

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

  // Sync timeline universal properties to entity_properties if these fields changed.
  if (
    !opts?.skipEntityPropertiesSync &&
    (updates.status !== undefined ||
      updates.statuses !== undefined ||
      updates.priority !== undefined ||
      updates.priorities !== undefined ||
      shouldUpdateAssignees ||
      updates.tags !== undefined)
  ) {
    const normalizedTags = Array.isArray((data as any).tags) ? (data as any).tags as string[] : [];
    await syncTimelineEventToEntityProperties(supabase, eventId, event.workspace_id, normalized.statuses, normalized.priorities, normalized.assignees, normalizedTags);
  }

  // If this event is live-synced to a task, propagate updates back to the source task.
  if (
    !opts?.skipSourceWriteback &&
    event.source_entity_type === "task" &&
    event.source_entity_id &&
    event.source_sync_mode === "live"
  ) {
    try {
      const taskUpdates: Record<string, unknown> = {};

      if (updates.status !== undefined || updates.statuses !== undefined) {
        taskUpdates.statuses = normalizeTimelineStatuses((normalized as any).statuses).map((entry) => ({
          field_name: entry.field_name,
          value: entry.value,
        }));
      }

      if (updates.priority !== undefined || updates.priorities !== undefined) {
        taskUpdates.priorities = normalizeTimelinePriorities((normalized as any).priorities).map((entry) => ({
          field_name: entry.field_name,
          value: entry.value,
        }));
      }
      if (updates.title !== undefined) {
        taskUpdates.title = normalized.title;
      }
      if (updates.startDate !== undefined) {
        taskUpdates.startDate = (normalized as any).start_date?.slice?.(0, 10) ?? null;
      }
      if (updates.endDate !== undefined) {
        taskUpdates.dueDate = (normalized as any).end_date?.slice?.(0, 10) ?? null;
      }
      if (updates.notes !== undefined) {
        taskUpdates.description = normalized.notes ?? null;
      }

      if (Object.keys(taskUpdates).length > 0) {
        await updateTaskItem(event.source_entity_id, taskUpdates as any, {
          authContext: { supabase, userId },
        });
      }
      if (shouldUpdateAssignees) {
        const { setEntityProperties } = await import("@/app/actions/entity-properties");
        await setEntityProperties({
          entity_type: "task",
          entity_id: event.source_entity_id,
          workspace_id: event.workspace_id,
          updates: {
            assignee_ids: extractUserAssigneeIds((normalized as any).assignees ?? []),
          } as any,
        });
      }
    } catch (syncError) {
      console.error("Failed to sync timeline event properties back to source task", {
        eventId,
        sourceTaskId: event.source_entity_id,
        error: syncError,
      });
    }
  }

  // If this event is live-synced to a table row, propagate key fields back to the source row.
  if (
    !opts?.skipSourceWriteback &&
    event.source_entity_type === "table_row" &&
    event.source_entity_id &&
    event.source_sync_mode === "live"
  ) {
    try {
      await syncTimelineEventUpdateToSourceTableRow({
        supabase,
        sourceRowId: event.source_entity_id,
        userId,
        event: normalized,
      });
    } catch (syncError) {
      console.error("Failed to sync timeline event properties back to source table row", {
        eventId,
        sourceRowId: event.source_entity_id,
        error: syncError,
      });
    }
  }

  if (!opts?.skipDerivedFanout) {
    try {
      await syncTimelineEventUpdateToDerivedTimelineEvents({
        supabase,
        sourceEventId: eventId,
        userId,
        event: normalized,
      });
      await syncTimelineEventUpdateToDerivedTasks({
        supabase,
        sourceEventId: eventId,
        userId,
        event: normalized,
      });
      await syncTimelineEventUpdateToDerivedRows({
        supabase,
        sourceEventId: eventId,
        userId,
        event: normalized,
      });
    } catch (fanoutError) {
      console.error("Failed to sync source timeline event updates to derived entities", {
        eventId,
        error: fanoutError,
      });
    }
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
      parent_event_id: (event as any).parent_event_id ?? null,
      title: `${event.title} (Copy)`,
      start_date: event.start_date,
      end_date: event.end_date,
      statuses: normalizeTimelineStatuses((event as any).statuses),
      priorities: sourcePriorities,
      assignees: normalizeTimelineAssignees((event as any).assignees ?? []),
      assignee_id: event.assignee_id,
      assignee_team_id: (event as any).assignee_team_id ?? null,
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
          source_sync_mode: "live" as const,
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
  await syncTimelineEventToEntityProperties(supabase, normalized.id, normalized.workspace_id, normalized.statuses, normalized.priorities, normalized.assignees);
  return { data: normalized };
}

function parseSubtaskDueDateValue(value: unknown): { start: string; end: string } | null {
  if (typeof value === "string") {
    return { start: value, end: value };
  }
  if (!value || typeof value !== "object") return null;
  const rawStart = typeof (value as any).start === "string" ? (value as any).start : null;
  const rawEnd = typeof (value as any).end === "string" ? (value as any).end : null;
  const start = rawStart ?? rawEnd;
  const end = rawEnd ?? rawStart;
  if (!start || !end) return null;
  return { start, end };
}

function sortTimelineEventsByDisplayOrder(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => a.display_order - b.display_order);
}

export async function syncSubEventsForTaskEvent(input: {
  parentEventId: string;
  taskId: string;
  timelineBlockId: string;
  authContext?: AuthContext;
}): Promise<ActionResult<TimelineEvent[]>> {
  const access = await requireTimelineAccess(input.timelineBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, userId, block } = access;
  const effectiveAuthContext: AuthContext = { supabase, userId };

  const { data: parentEvent, error: parentError } = await supabase
    .from("timeline_events")
    .select("id, timeline_block_id, parent_event_id")
    .eq("id", input.parentEventId)
    .maybeSingle();
  if (parentError || !parentEvent) return { error: "Parent timeline event not found" };
  if ((parentEvent as any).timeline_block_id !== block.id) {
    return { error: "Parent event does not belong to this timeline block" };
  }
  if ((parentEvent as any).parent_event_id) {
    return { error: "Cannot nest sub-events more than 1 level deep" };
  }

  const { data: subtasks, error: subtasksError } = await supabase
    .from("task_subtasks")
    .select("id, title")
    .eq("task_id", input.taskId);
  if (subtasksError) return { error: "Failed to load task subtasks" };

  const subtaskIds = (subtasks ?? []).map((s: any) => s.id as string);
  const { data: dueRows, error: dueRowsError } = subtaskIds.length > 0
    ? await supabase
      .from("entity_properties")
      .select("entity_id, value")
      .eq("entity_type", "subtask")
      .eq("field_type", "due_date")
      .in("entity_id", subtaskIds)
    : { data: [], error: null as any };
  if (dueRowsError) return { error: "Failed to load subtask due dates" };
  const { data: statusRows, error: statusRowsError } = subtaskIds.length > 0
    ? await supabase
      .from("entity_properties")
      .select("entity_id, field_name, value")
      .eq("entity_type", "subtask")
      .eq("field_type", "status")
      .in("entity_id", subtaskIds)
    : { data: [], error: null as any };
  if (statusRowsError) return { error: "Failed to load subtask statuses" };
  const { data: priorityRows, error: priorityRowsError } = subtaskIds.length > 0
    ? await supabase
      .from("entity_properties")
      .select("entity_id, field_name, value")
      .eq("entity_type", "subtask")
      .eq("field_type", "priority")
      .in("entity_id", subtaskIds)
    : { data: [], error: null as any };
  if (priorityRowsError) return { error: "Failed to load subtask priorities" };
  const { data: assigneeRows, error: assigneeRowsError } = subtaskIds.length > 0
    ? await supabase
      .from("entity_properties")
      .select("entity_id, field_name, value")
      .eq("entity_type", "subtask")
      .eq("field_type", "assignee")
      .in("entity_id", subtaskIds)
    : { data: [], error: null as any };
  if (assigneeRowsError) return { error: "Failed to load subtask assignees" };

  const dueDateBySubtaskId = new Map<string, { start: string; end: string }>();
  for (const row of dueRows ?? []) {
    const parsed = parseSubtaskDueDateValue((row as any).value);
    if (parsed) dueDateBySubtaskId.set((row as any).entity_id, parsed);
  }
  const statusesBySubtaskId = new Map<string, TimelineNamedStatus[]>();
  for (const row of statusRows ?? []) {
    const value = typeof (row as any).value === "string" ? (row as any).value : null;
    if (!value || !["todo", "in_progress", "blocked", "done"].includes(value)) continue;
    const list = statusesBySubtaskId.get((row as any).entity_id) ?? [];
    list.push({
      field_name: typeof (row as any).field_name === "string" && (row as any).field_name.trim()
        ? (row as any).field_name
        : "Status",
      value: value as TimelineEventStatus,
    });
    statusesBySubtaskId.set((row as any).entity_id, list);
  }
  const prioritiesBySubtaskId = new Map<string, TimelineNamedPriority[]>();
  for (const row of priorityRows ?? []) {
    const value = normalizeTimelinePriorityValue((row as any).value);
    if (!value) continue;
    const list = prioritiesBySubtaskId.get((row as any).entity_id) ?? [];
    list.push({
      field_name: typeof (row as any).field_name === "string" && (row as any).field_name.trim()
        ? (row as any).field_name
        : "Priority",
      value,
    });
    prioritiesBySubtaskId.set((row as any).entity_id, list);
  }
  const assigneesBySubtaskId = new Map<string, TimelineNamedAssignee[]>();
  for (const row of assigneeRows ?? []) {
    const raw = (row as any).value;
    const rawValues = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const values = rawValues
      .map((entry: any): TimelineAssigneeValueEntry | null => {
        if (entry && typeof entry === "object" && typeof entry.id === "string" && entry.id.trim()) {
          return { type: "user", id: entry.id.trim(), ...(typeof entry.name === "string" ? { name: entry.name } : {}) };
        }
        if (typeof entry === "string" && entry.trim()) {
          return { type: "user", id: entry.trim() };
        }
        return null;
      })
      .filter((entry): entry is TimelineAssigneeValueEntry => entry !== null);
    if (values.length === 0) continue;
    const list = assigneesBySubtaskId.get((row as any).entity_id) ?? [];
    list.push({
      field_name: typeof (row as any).field_name === "string" && (row as any).field_name.trim()
        ? (row as any).field_name
        : "Assignee",
      value: values,
    });
    assigneesBySubtaskId.set((row as any).entity_id, list);
  }

  const subtasksWithDates = (subtasks ?? [])
    .map((subtask: any) => ({
      id: subtask.id as string,
      title: String(subtask.title ?? "Untitled"),
      due: dueDateBySubtaskId.get(subtask.id as string) ?? null,
      statuses: statusesBySubtaskId.get(subtask.id as string) ?? [],
      priorities: prioritiesBySubtaskId.get(subtask.id as string) ?? [],
      assignees: assigneesBySubtaskId.get(subtask.id as string) ?? [],
    }))
    .filter((subtask) => Boolean(subtask.due));

  const { data: existingChildrenRaw, error: existingChildrenError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("parent_event_id", input.parentEventId)
    .order("display_order", { ascending: true });
  if (existingChildrenError) return { error: "Failed to load existing sub-events" };
  const existingChildren = ((existingChildrenRaw ?? []) as any[]).map(normalizeTimelineEventRow);

  const existingBySourceSubtaskId = new Map<string, TimelineEvent>();
  for (const child of existingChildren) {
    if (child.source_entity_type === "subtask" && child.source_entity_id) {
      existingBySourceSubtaskId.set(child.source_entity_id, child);
    }
  }

  await Promise.all(
    subtasksWithDates.map(async (subtask) => {
      const existing = existingBySourceSubtaskId.get(subtask.id);
      const startDate = subtask.due!.start;
      const endDate = subtask.due!.end;
      if (!existing) {
        await createTimelineEvent({
          timelineBlockId: block.id,
          parentEventId: input.parentEventId,
          title: subtask.title,
          startDate,
          endDate,
          statuses: subtask.statuses,
          priorities: subtask.priorities,
          assignees: subtask.assignees,
          sourceEntityType: "subtask",
          sourceEntityId: subtask.id,
          sourceSyncMode: "live",
          authContext: effectiveAuthContext,
        });
        return;
      }

      const titleChanged = existing.title !== subtask.title;
      const startChanged = existing.start_date !== startDate;
      const endChanged = existing.end_date !== endDate;
      const statusesChanged = JSON.stringify(existing.statuses ?? []) !== JSON.stringify(subtask.statuses);
      const prioritiesChanged = JSON.stringify(existing.priorities ?? []) !== JSON.stringify(subtask.priorities);
      const assigneesChanged = JSON.stringify((existing as any).assignees ?? []) !== JSON.stringify(subtask.assignees);
      if (!titleChanged && !startChanged && !endChanged && !statusesChanged && !prioritiesChanged && !assigneesChanged) return;
      await updateTimelineEvent(
        existing.id,
        {
          title: subtask.title,
          startDate,
          endDate,
          statuses: subtask.statuses,
          priorities: subtask.priorities,
          assignees: subtask.assignees,
        },
        { authContext: effectiveAuthContext }
      );
    })
  );

  const subtaskIdsWithDates = new Set(subtasksWithDates.map((subtask) => subtask.id));
  const staleChildren = existingChildren.filter(
    (child) => child.source_entity_type === "subtask" && child.source_entity_id && !subtaskIdsWithDates.has(child.source_entity_id)
  );

  if (staleChildren.length > 0) {
    await Promise.all(
      staleChildren.map((child) => deleteTimelineEvent(child.id, { authContext: effectiveAuthContext }))
    );
  }

  const { data: finalChildrenRaw, error: finalChildrenError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("parent_event_id", input.parentEventId)
    .order("display_order", { ascending: true });
  if (finalChildrenError) return { error: "Failed to load synced sub-events" };

  return { data: sortTimelineEventsByDisplayOrder(((finalChildrenRaw ?? []) as any[]).map(normalizeTimelineEventRow)) };
}

export async function syncSubEventsForTaskEventsBatch(
  pairs: Array<{ parentEventId: string; taskId: string; timelineBlockId: string }>,
  authContext?: AuthContext
): Promise<ActionResult<void>> {
  if (pairs.length === 0) return { data: undefined };
  const results = await Promise.all(
    pairs.map((pair) =>
      syncSubEventsForTaskEvent({
        ...pair,
        authContext,
      })
    )
  );
  const firstError = results.find((result) => "error" in result);
  if (firstError && "error" in firstError) return { error: firstError.error };
  return { data: undefined };
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
 * Syncs timeline event status, priority, assignees, and tags to entity_properties table.
 * This enables universal queries across all entity types.
 */
export async function syncTimelineEventToEntityProperties(
  supabase: any,
  eventId: string,
  workspaceId: string,
  statuses: TimelineNamedStatus[] | null | undefined,
  priorities: TimelineNamedPriority[] | null | undefined,
  assignees?: TimelineNamedAssignee[] | null | undefined,
  tags?: string[] | null | undefined
): Promise<void> {
  await syncTimelineStatusFieldsToEntityProperties(supabase, eventId, workspaceId, statuses ?? []);
  await syncTimelinePriorityFieldsToEntityProperties(supabase, eventId, workspaceId, priorities);
  await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", "timeline_event")
    .eq("entity_id", eventId)
    .eq("field_type", "assignee");
  const normalizedAssignees = normalizeTimelineAssignees(assignees ?? []);
  if (normalizedAssignees.length > 0) {
    await supabase
      .from("entity_properties")
      .upsert(
        normalizedAssignees.map((entry) => ({
          workspace_id: workspaceId,
          entity_type: "timeline_event",
          entity_id: eventId,
          field_name: entry.field_name,
          field_type: "assignee",
          value: entry.value,
        })),
        { onConflict: "entity_type,entity_id,field_name" }
      );
  }
  // Sync tags
  await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", "timeline_event")
    .eq("entity_id", eventId)
    .eq("field_type", "tags");
  const normalizedTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string" && t.trim().length > 0) : [];
  if (normalizedTags.length > 0) {
    await supabase
      .from("entity_properties")
      .upsert([{
        workspace_id: workspaceId,
        entity_type: "timeline_event",
        entity_id: eventId,
        field_name: "Tags",
        field_type: "tags",
        value: normalizedTags,
      }], { onConflict: "entity_type,entity_id,field_name" });
  }
}
