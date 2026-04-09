"use server";

import { requireTaskBlockAccess, requireTaskItemAccess, type TaskTimingSink } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskItem, TaskItemPriority, TaskItemStatus, TaskPriority, TaskSourceSyncMode, TaskStatus } from "@/types/task";
import { mapTagNamesToOptionIds, type TagFieldOption } from "@/lib/tables/tag-field-config";
import { syncTimelineStatusFieldsToEntityProperties } from "@/lib/timeline-status-sync";
import { syncTimelinePriorityFieldsToEntityProperties } from "@/lib/timeline-priority-sync";
import { deriveTaskSeedFromTableRowSource } from "@/lib/tasks/table-row-task-derivation";
import { isProjectTaskRollupBlockContent } from "@/lib/tasks/project-rollup";
import type {
  TimelineEventPriority,
  TimelineEventStatus,
  TimelineNamedAssignee,
  TimelineNamedPriority,
  TimelineNamedStatus,
} from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

function normalizeTaskPriorities(input: unknown): TaskItemPriority[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const fieldName = String((entry as any)?.field_name ?? "").trim();
      const value = (entry as any)?.value;
      if (!fieldName) return null;
      if (value !== "low" && value !== "medium" && value !== "high" && value !== "urgent") return null;
      return { field_name: fieldName, value } as TaskItemPriority;
    })
    .filter((entry): entry is TaskItemPriority => Boolean(entry));
}

function prioritiesFromSingle(priority?: TaskPriority | null): TaskItemPriority[] {
  if (!priority || priority === "none") return [];
  if (priority !== "low" && priority !== "medium" && priority !== "high" && priority !== "urgent") return [];
  return [{ field_name: "Priority", value: priority }];
}

function normalizeTaskStatuses(input: unknown): TaskItemStatus[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const fieldName = String((entry as any)?.field_name ?? "").trim();
      let value = (entry as any)?.value;
      if (!fieldName) return null;
      if (value === "in-progress" || value === "in progress") value = "in_progress";
      if (value !== "todo" && value !== "in_progress" && value !== "blocked" && value !== "done") return null;
      return { field_name: fieldName, value } as TaskItemStatus;
    })
    .filter((entry): entry is TaskItemStatus => Boolean(entry));
}

function statusesFromSingle(status?: TaskStatus | null): TaskItemStatus[] {
  if (!status) return [];
  let value = status as string;
  if (value === "in-progress" || value === "in progress") value = "in_progress";
  if (value !== "todo" && value !== "in_progress" && value !== "blocked" && value !== "done") return [];
  return [{ field_name: "Status", value: value as any }];
}

function normalizeTaskRow(row: any): TaskItem {
  const priorities = normalizeTaskPriorities(row?.priorities ?? prioritiesFromSingle(row?.priority));
  return {
    ...(row as TaskItem),
    priorities,
  };
}

async function listProjectTaskRollupBlocks(
  supabase: any,
  projectId: string | null | undefined
): Promise<Array<{ id: string }>> {
  if (!projectId) return [];
  const { data: tabs, error: tabsError } = await supabase
    .from("tabs")
    .select("id")
    .eq("project_id", projectId);
  if (tabsError || !tabs || tabs.length === 0) return [];

  const tabIds = tabs.map((tab: any) => String(tab.id));
  const { data: blocks, error: blocksError } = await supabase
    .from("blocks")
    .select("id, content")
    .eq("type", "task")
    .in("tab_id", tabIds);
  if (blocksError || !blocks) return [];

  return blocks
    .filter((block: any) => isProjectTaskRollupBlockContent(block.content))
    .map((block: any) => ({ id: String(block.id) }));
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

async function getTaskTagNames(supabase: any, taskId: string): Promise<string[]> {
  const { data } = await supabase
    .from("entity_properties")
    .select("value")
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .eq("field_type", "tags")
    .limit(1)
    .maybeSingle();
  const raw = (data as any)?.value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function mapTaskTagsToFieldValue(field: any, tagNames: string[]): string[] {
  if (!Array.isArray(tagNames) || tagNames.length === 0) return [];
  const options = ((((field as any)?.config ?? {}) as Record<string, unknown>).options ?? []) as TagFieldOption[];
  const mapped = mapTagNamesToOptionIds(tagNames, options);
  if (mapped.length > 0) return mapped;
  return tagNames;
}

function extractTaskAssigneeIds(task: TaskItem): string[] {
  const namedAssignees = Array.isArray((task as any).assignees) ? (task as any).assignees : [];
  const fromNamed = namedAssignees
    .flatMap((entry: any) => Array.isArray(entry?.value) ? entry.value : [])
    .map((id: unknown) => typeof id === "string" ? id.trim() : "")
    .filter((id: string) => id.length > 0);
  const primary = typeof (task as any).assignee_id === "string" ? (task as any).assignee_id.trim() : "";
  return Array.from(new Set([...(primary ? [primary] : []), ...fromNamed]));
}

function buildTimelineAssigneesFromTask(task: TaskItem): TimelineNamedAssignee[] {
  const ids = extractTaskAssigneeIds(task);
  if (ids.length === 0) return [];
  return [{
    field_name: "Assignee",
    value: ids.map((id) => ({ type: "user" as const, id })),
  }];
}

function buildTimelineStatusesFromTask(statuses: unknown): TimelineNamedStatus[] {
  return normalizeTaskStatuses(statuses)
    .map((entry) => {
      const raw = String((entry as any).value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      let value: TimelineEventStatus | null = null;
      if (raw === "todo") value = "todo";
      else if (raw === "in_progress" || raw === "blocked") value = raw as TimelineEventStatus;
      else if (raw === "done") value = "done";
      if (!value) return null;
      return { field_name: entry.field_name, value };
    })
    .filter((entry): entry is TimelineNamedStatus => Boolean(entry));
}

function buildTimelinePrioritiesFromTask(priorities: unknown): TimelineNamedPriority[] {
  return normalizeTaskPriorities(priorities)
    .map((entry) => {
      const raw = String((entry as any).value ?? "").trim().toLowerCase();
      let value: TimelineEventPriority | null = null;
      if (raw === "low" || raw === "medium" || raw === "high" || raw === "urgent") {
        value = raw as TimelineEventPriority;
      }
      if (!value) return null;
      return { field_name: entry.field_name, value };
    })
    .filter((entry): entry is TimelineNamedPriority => Boolean(entry));
}

async function syncNamedTaskTagFields(params: {
  supabase: any;
  workspaceId: string;
  taskId: string;
  tagFields: Array<{ field_name: string; value: string[] }>;
}): Promise<void> {
  const { supabase, workspaceId, taskId, tagFields } = params;
  const normalized = tagFields
    .map((entry) => ({
      field_name: String(entry.field_name || "").trim(),
      value: Array.from(
        new Set(
          (Array.isArray(entry.value) ? entry.value : [])
            .map((tag) => String(tag || "").trim())
            .filter((tag) => tag.length > 0)
        )
      ),
    }))
    .filter((entry) => entry.field_name.length > 0 && entry.value.length > 0);

  if (normalized.length === 0) return;

  await supabase
    .from("entity_properties")
    .upsert(
      normalized.map((entry) => ({
        workspace_id: workspaceId,
        entity_type: "task",
        entity_id: taskId,
        field_name: entry.field_name,
        field_type: "tags",
        value: entry.value,
      })),
      { onConflict: "entity_type,entity_id,field_name" }
    );
}

async function syncTaskUpdateToSourceTableRow(params: {
  supabase: any;
  sourceRowId: string;
  userId: string;
  task: TaskItem;
}): Promise<void> {
  const { supabase, sourceRowId, userId, task } = params;
  const { data: sourceRow } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("id", sourceRowId)
    .maybeSingle();
  if (!sourceRow?.table_id) return;

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config, is_primary")
    .eq("table_id", sourceRow.table_id);
  if (!fields || fields.length === 0) return;

  const statusValue = normalizeTaskStatuses((task as any).statuses)?.[0]?.value ?? null;
  const namedPriorities = normalizeTaskPriorities((task as any).priorities);
  const namedStatuses = normalizeTaskStatuses((task as any).statuses);
  const primaryAssigneeId = extractTaskAssigneeIds(task)[0] ?? null;
  const tagNames = await getTaskTagNames(supabase, task.id);
  const nextData: Record<string, unknown> = { ...((sourceRow.data ?? {}) as Record<string, unknown>) };

  const primaryField = fields.find((f: any) => Boolean(f.is_primary))
    ?? fields.find((f: any) => normalizeFieldName(f.name).includes("title") || normalizeFieldName(f.name) === "task");
  if (primaryField) nextData[primaryField.id] = task.title ?? "";

  const statusFields = fields.filter((f: any) => f.type === "status");
  const priorityFields = fields.filter((f: any) => f.type === "priority");
  const assigneeField = fields.find((f: any) => f.type === "person");
  const tagsFields = fields.filter((f: any) => f.type === "tags");

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
  for (const tagsField of tagsFields) {
    nextData[tagsField.id] = mapTaskTagsToFieldValue(tagsField, tagNames);
  }

  const startField = fields.find((f: any) => normalizeFieldName(f.name).includes("start") && f.type === "date")
    ?? fields.find((f: any) => normalizeFieldName(f.name).includes("start"));
  const endField = fields.find((f: any) => normalizeFieldName(f.name).includes("end") && f.type === "date")
    ?? fields.find((f: any) => normalizeFieldName(f.name).includes("due") || normalizeFieldName(f.name).includes("end"));
  const singleDateField = fields.find((f: any) => f.type === "date");
  const startDate = toDateOnly((task as any).start_date);
  const dueDate = toDateOnly((task as any).due_date);
  if (startField && startDate) nextData[startField.id] = startDate;
  if (endField && dueDate) nextData[endField.id] = dueDate;
  if (!startField && !endField && singleDateField) {
    nextData[singleDateField.id] = formatDateRangeCellValue(startDate, dueDate);
  }

  await supabase
    .from("table_rows")
    .update({ data: nextData, updated_by: userId })
    .eq("id", sourceRowId);
}

async function syncTaskUpdateToDerivedRows(params: {
  supabase: any;
  sourceTaskId: string;
  userId: string;
  task: TaskItem;
}): Promise<void> {
  const { supabase, sourceTaskId, userId, task } = params;
  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, table_id, data")
    .eq("source_entity_type", "task")
    .eq("source_entity_id", sourceTaskId)
    .eq("source_sync_mode", "live");
  if (!rows || rows.length === 0) return;

  const tableIds = Array.from(new Set(rows.map((r: any) => r.table_id)));
  const { data: allFields } = await supabase
    .from("table_fields")
    .select("id, table_id, name, type, config, is_primary")
    .in("table_id", tableIds);
  const fieldsByTable = new Map<string, any[]>();
  for (const field of allFields ?? []) {
    const list = fieldsByTable.get((field as any).table_id) ?? [];
    list.push(field);
    fieldsByTable.set((field as any).table_id, list);
  }

  const namedStatuses = normalizeTaskStatuses((task as any).statuses);
  const namedPriorities = normalizeTaskPriorities((task as any).priorities);
  const primaryAssigneeId = extractTaskAssigneeIds(task)[0] ?? null;
  const tagNames = await getTaskTagNames(supabase, sourceTaskId);
  const startDate = toDateOnly((task as any).start_date);
  const dueDate = toDateOnly((task as any).due_date);

  for (const row of rows as any[]) {
    const fields = fieldsByTable.get(row.table_id) ?? [];
    const nextData: Record<string, unknown> = { ...((row.data ?? {}) as Record<string, unknown>) };

    const primaryField = fields.find((f: any) => Boolean(f.is_primary))
      ?? fields.find((f: any) => normalizeFieldName(f.name).includes("title") || normalizeFieldName(f.name) === "task");
    if (primaryField) nextData[primaryField.id] = task.title ?? "";

    const statusFields = fields.filter((f: any) => f.type === "status");
    const priorityFields = fields.filter((f: any) => f.type === "priority");
    const assigneeField = fields.find((f: any) => f.type === "person");
    const tagsFields = fields.filter((f: any) => f.type === "tags");

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
    for (const tagsField of tagsFields) {
      nextData[tagsField.id] = mapTaskTagsToFieldValue(tagsField, tagNames);
    }

    const startField = fields.find((f: any) => normalizeFieldName(f.name).includes("start") && f.type === "date")
      ?? fields.find((f: any) => normalizeFieldName(f.name).includes("start"));
    const endField = fields.find((f: any) => normalizeFieldName(f.name).includes("end") && f.type === "date")
      ?? fields.find((f: any) => normalizeFieldName(f.name).includes("due") || normalizeFieldName(f.name).includes("end"));
    const singleDateField = fields.find((f: any) => f.type === "date");
    if (startField && startDate) nextData[startField.id] = startDate;
    if (endField && dueDate) nextData[endField.id] = dueDate;
    if (!startField && !endField && singleDateField) {
      nextData[singleDateField.id] = formatDateRangeCellValue(startDate, dueDate);
    }

    await supabase
      .from("table_rows")
      .update({ data: nextData, updated_by: userId })
      .eq("id", row.id);
  }
}

async function syncTaskUpdateToDerivedTimelineEvents(params: {
  supabase: any;
  sourceTaskId: string;
  userId: string;
  task: TaskItem;
}): Promise<void> {
  const { supabase, sourceTaskId, userId, task } = params;
  const { data: events } = await supabase
    .from("timeline_events")
    .select("id, workspace_id")
    .eq("source_entity_type", "task")
    .eq("source_entity_id", sourceTaskId)
    .eq("source_sync_mode", "live");
  if (!events || events.length === 0) return;

  const statuses = normalizeTaskStatuses((task as any).statuses).map((entry) => ({
    field_name: entry.field_name,
    value: entry.value,
  }));
  const priorities = normalizeTaskPriorities((task as any).priorities).map((entry) => ({
    field_name: entry.field_name,
    value: entry.value,
  }));
  const timelineAssignees = buildTimelineAssigneesFromTask(task);
  const primaryAssigneeId = extractTaskAssigneeIds(task)[0] ?? null;

  for (const ev of events as any[]) {
    const payload: Record<string, unknown> = {
      title: task.title ?? "",
      statuses,
      priorities,
      assignees: timelineAssignees,
      assignee_id: primaryAssigneeId,
      assignee_team_id: null,
      notes: task.description ?? null,
      updated_by: userId,
    };
    const startDate = (task as any).start_date as string | null | undefined;
    const dueDate = (task as any).due_date as string | null | undefined;
    if (startDate) payload.start_date = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    if (dueDate) payload.end_date = new Date(`${dueDate}T00:00:00.000Z`).toISOString();
    await supabase
      .from("timeline_events")
      .update(payload)
      .eq("id", ev.id);
    // Bug 1.3 fix: sync entity_properties for derived timeline event
    if (ev.workspace_id) {
      await syncTimelineStatusFieldsToEntityProperties(supabase, ev.id, ev.workspace_id, statuses as any);
      await syncTimelinePriorityFieldsToEntityProperties(supabase, ev.id, ev.workspace_id, priorities as any);
    }
  }
}

async function syncTaskUpdateToDerivedTasks(params: {
  supabase: any;
  sourceTaskId: string;
  userId: string;
  task: TaskItem;
}): Promise<void> {
  const { supabase, sourceTaskId, userId, task } = params;
  const { data: tasks } = await supabase
    .from("task_items")
    .select("id, workspace_id")
    .eq("source_entity_type", "task")
    .eq("source_entity_id", sourceTaskId)
    .eq("source_sync_mode", "live");
  if (!tasks || tasks.length === 0) return;

  const normalizedStatuses = normalizeTaskStatuses((task as any).statuses);
  const normalizedPriorities = normalizeTaskPriorities((task as any).priorities);
  const assigneeIds = extractTaskAssigneeIds(task);
  const taskNamedAssignees = Array.isArray((task as any).assignees) ? (task as any).assignees : [];
  const sourceTagNames = await getTaskTagNames(supabase, sourceTaskId);

  for (const child of tasks as any[]) {
    if (child.id === sourceTaskId) continue;
    await supabase
      .from("task_items")
      .update({
        title: task.title ?? "",
        statuses: (task as any).statuses ?? [],
        priorities: (task as any).priorities ?? [],
        description: task.description ?? null,
        assignees: taskNamedAssignees,
        assignee_id: assigneeIds[0] ?? null,
        start_date: (task as any).start_date ?? null,
        due_date: (task as any).due_date ?? null,
        updated_by: userId,
      })
      .eq("id", child.id);
    // Bug 1.1 fix: sync entity_properties for derived task
    if (child.workspace_id) {
      await supabase.from("entity_properties").delete()
        .eq("entity_type", "task").eq("entity_id", child.id).eq("field_type", "status");
      await supabase.from("entity_properties").delete()
        .eq("entity_type", "task").eq("entity_id", child.id).eq("field_type", "priority");
      if (normalizedStatuses.length > 0) {
        await supabase.from("entity_properties").upsert(
          normalizedStatuses.map((e) => ({ entity_type: "task", entity_id: child.id, workspace_id: child.workspace_id, field_name: e.field_name, field_type: "status", value: e.value })),
          { onConflict: "entity_type,entity_id,field_name" }
        );
      }
      if (normalizedPriorities.length > 0) {
        await supabase.from("entity_properties").upsert(
          normalizedPriorities.map((e) => ({ entity_type: "task", entity_id: child.id, workspace_id: child.workspace_id, field_name: e.field_name, field_type: "priority", value: e.value })),
          { onConflict: "entity_type,entity_id,field_name" }
        );
      }
      await supabase.from("entity_properties").delete()
        .eq("entity_type", "task").eq("entity_id", child.id).eq("field_type", "assignee");
      if (assigneeIds.length > 0) {
        await supabase.from("entity_properties").upsert(
          [{
            entity_type: "task",
            entity_id: child.id,
            workspace_id: child.workspace_id,
            field_name: "Assignee",
            field_type: "assignee",
            value: assigneeIds.map((id) => ({ id, name: id })),
          }],
          { onConflict: "entity_type,entity_id,field_name" }
        );
      }
    }
    await supabase.from("task_assignees").delete().eq("task_id", child.id);
    if (assigneeIds.length > 0) {
      await supabase.from("task_assignees").insert(
        assigneeIds.map((assigneeId) => ({
          task_id: child.id,
          assignee_id: assigneeId,
          assignee_name: assigneeId,
        }))
      );
    }
    const { setTaskTags } = await import("@/app/actions/tasks/tag-actions");
    await setTaskTags(child.id, sourceTagNames, { authContext: { supabase, userId } });
  }
}

export async function fanOutSourceTaskUpdate(params: {
  supabase: any;
  sourceTaskId: string;
  userId: string;
  task?: TaskItem | null;
}): Promise<void> {
  const { supabase, sourceTaskId, userId } = params;

  let canonicalTask = params.task ?? null;
  if (!canonicalTask) {
    const { data: sourceTask } = await supabase
      .from("task_items")
      .select("*")
      .eq("id", sourceTaskId)
      .maybeSingle();
    if (!sourceTask) return;
    canonicalTask = normalizeTaskRow(sourceTask);
  }

  await syncTaskUpdateToDerivedTasks({
    supabase,
    sourceTaskId,
    userId,
    task: canonicalTask,
  });
  await syncTaskUpdateToDerivedTimelineEvents({
    supabase,
    sourceTaskId,
    userId,
    task: canonicalTask,
  });
  await syncTaskUpdateToDerivedRows({
    supabase,
    sourceTaskId,
    userId,
    task: canonicalTask,
  });
}

export async function createTaskItem(
  input: {
    taskBlockId: string;
    title: string;
    status?: TaskStatus;
    statuses?: TaskItemStatus[];
    priority?: TaskPriority;
    priorities?: TaskItemPriority[];
    description?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    dueTimeEnd?: string | null;
    startDate?: string | null;
    hideIcons?: boolean;
    recurring?: {
      enabled: boolean;
      frequency?: "daily" | "weekly" | "monthly";
      interval?: number;
    };
    sourceEntityType?: "task" | "timeline_event" | "table_row" | "block";
    sourceEntityId?: string | null;
    sourceSyncMode?: TaskSourceSyncMode;
    /** When true, task is excluded from search/Everything until the user edits it. Used for the default "New task" in new blocks. */
    isPlaceholder?: boolean;
  },
  opts?: { timing?: TaskTimingSink; authContext?: AuthContext; skipPropertySync?: boolean }
): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskBlockAccess(input.taskBlockId, { timing: opts?.timing, authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;
  const hasSourceMetadata = Boolean(input.sourceEntityType && input.sourceEntityId);
  const sourceEntityType = hasSourceMetadata ? input.sourceEntityType! : null;
  const sourceEntityId = hasSourceMetadata ? input.sourceEntityId! : null;
  const sourceSyncMode = hasSourceMetadata
    ? (input.sourceSyncMode ?? "live")
    : null;
  const sourceTaskId = sourceEntityType === "task" ? sourceEntityId : null;
  const isTableRowSource = sourceEntityType === "table_row" && Boolean(sourceEntityId);
  const derivedRowSeed = isTableRowSource && sourceEntityId
    ? await deriveTaskSeedFromTableRowSource(supabase, sourceEntityId)
    : null;
  const priorities = input.priorities !== undefined
    ? normalizeTaskPriorities(input.priorities)
    : derivedRowSeed?.priorities?.length
      ? derivedRowSeed.priorities
      : prioritiesFromSingle(input.priority);
  const statuses = input.statuses !== undefined
    ? normalizeTaskStatuses(input.statuses)
    : derivedRowSeed?.statuses?.length
      ? derivedRowSeed.statuses
      : statusesFromSingle(input.status);
  const resolvedTitle = derivedRowSeed?.title?.trim() || input.title;
  const resolvedStartDate = input.startDate ?? derivedRowSeed?.preferred_start_date ?? null;
  const resolvedDueDate = input.dueDate ?? derivedRowSeed?.preferred_due_date ?? null;
  const resolvedAssigneeId = derivedRowSeed?.preferred_assignee_ids?.[0] ?? null;
  const resolvedNamedAssignees = derivedRowSeed?.assignees ?? [];
  const resolvedNamedDueDates = derivedRowSeed?.due_dates ?? [];
  const resolvedTags = derivedRowSeed?.tags ?? [];
  const resolvedTagFields = derivedRowSeed?.tag_fields ?? [];

  // display_order is set by DB trigger set_task_item_display_order (saves one round-trip)
  const tInsert0 = performance.now();
  const { data, error } = await supabase
    .from("task_items")
    .insert({
      task_block_id: block.id,
      workspace_id: block.workspace_id,
      project_id: block.project_id,
      tab_id: block.tab_id,
      title: resolvedTitle,
      statuses: statuses,
      priorities,
      assignees: resolvedNamedAssignees,
      due_dates: resolvedNamedDueDates,
      assignee_id: resolvedAssigneeId,
      description: input.description ?? null,
      due_date: resolvedDueDate,
      due_time: input.dueTime ?? null,
      due_time_end: input.dueTimeEnd ?? null,
      start_date: resolvedStartDate,
      hide_icons: input.hideIcons ?? false,
      display_order: 0,
      recurring_enabled: input.recurring?.enabled ?? false,
      recurring_frequency: input.recurring?.frequency ?? null,
      recurring_interval: input.recurring?.interval ?? null,
      source_task_id: sourceTaskId,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      source_sync_mode: sourceSyncMode,
      is_placeholder: input.isPlaceholder ?? false,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();
  if (opts?.timing) {
    opts.timing.t_insert_task_ms = Math.round(performance.now() - tInsert0);
    opts.timing.t_fetch_return_ms = 0; // return is part of insert round-trip
  }

  if (error || !data) {
    const message = error?.message ?? "Unknown error";
    return { error: message };
  }

  if (!opts?.skipPropertySync) {
    try {
      const { setEntityProperties } = await import("@/app/actions/entity-properties");
      const shouldWriteNamedStatuses = statuses.length > 0 && (!isTableRowSource || input.statuses !== undefined);
      const shouldWriteNamedPriorities = priorities.length > 0 && (!isTableRowSource || input.priorities !== undefined);
      const entityPropertyUpdates: Record<string, unknown> = {};

      if (shouldWriteNamedStatuses) {
        entityPropertyUpdates.statuses = statuses.map((entry) => ({
          field_name: entry.field_name,
          value: entry.value,
        }));
      }
      if (shouldWriteNamedPriorities) {
        entityPropertyUpdates.priorities = priorities.map((entry) => ({
          field_name: entry.field_name,
          value: entry.value,
        }));
      }

      if (resolvedNamedAssignees.length > 0) {
        entityPropertyUpdates.assignees = resolvedNamedAssignees.map((entry) => ({
          field_name: entry.field_name,
          value: entry.value,
        }));
      }
      if (resolvedNamedDueDates.length > 0) {
        entityPropertyUpdates.due_dates = resolvedNamedDueDates.map((entry) => ({
          field_name: entry.field_name,
          value: entry.value,
        }));
      }
      if (resolvedTags.length > 0) {
        entityPropertyUpdates.tags = resolvedTags;
      }

      const startDate = resolvedStartDate;
      const dueDate = resolvedDueDate;
      if (startDate || dueDate) {
        if (startDate && dueDate) {
          entityPropertyUpdates.due_date = { start: startDate, end: dueDate };
        } else if (dueDate) {
          entityPropertyUpdates.due_date = { start: dueDate, end: dueDate };
        } else if (startDate) {
          entityPropertyUpdates.due_date = { start: startDate, end: startDate };
        }
      }

      if (Object.keys(entityPropertyUpdates).length > 0) {
        await setEntityProperties({
          entity_type: "task",
          entity_id: data.id,
          workspace_id: block.workspace_id,
          updates: entityPropertyUpdates as any,
        });
      }
      if (resolvedTagFields.length > 0) {
        await syncNamedTaskTagFields({
          supabase,
          workspaceId: block.workspace_id,
          taskId: data.id,
          tagFields: resolvedTagFields,
        });
      }
    } catch (propertySyncError) {
      console.error("Failed to sync task entity properties after create", {
        taskId: data.id,
        error: propertySyncError,
      });
    }
  }

  try {
    const rollupBlocks = await listProjectTaskRollupBlocks(supabase, block.project_id);
    const isCurrentRollupBlock = rollupBlocks.some((entry) => entry.id === block.id);
    const isLiveTaskDerivedCopy = sourceEntityType === "task" && Boolean(sourceEntityId) && sourceSyncMode === "live";

    if (!isCurrentRollupBlock && !isLiveTaskDerivedCopy && rollupBlocks.length > 0) {
      for (const rollupBlock of rollupBlocks) {
        if (rollupBlock.id === block.id) continue;
        await duplicateTasksToBlock({
          taskIds: [data.id],
          targetBlockId: rollupBlock.id,
          forceSourceTaskLink: true,
          authContext: { supabase, userId },
        });
      }
    }
  } catch (rollupError) {
    console.error("Failed to mirror task into project rollup blocks", {
      taskId: data.id,
      error: rollupError,
    });
  }

  return { data: normalizeTaskRow(data) };
}

export async function updateTaskItem(
  taskId: string,
  updates: Partial<{
    title: string;
    status: TaskStatus;
    statuses: TaskItemStatus[];
    priority: TaskPriority;
    priorities: TaskItemPriority[];
    description: string | null;
    dueDate: string | null;
    dueTime: string | null;
    dueTimeEnd: string | null;
    startDate: string | null;
    hideIcons: boolean;
    recurringEnabled: boolean;
    recurringFrequency: "daily" | "weekly" | "monthly" | null;
    recurringInterval: number | null;
    tags: string[];
    assignee_id: string | null;
    assignee_ids: string[];
    assignees: Array<{ field_name: string; value: string[] }>;
  }>,
  opts?: { authContext?: AuthContext; skipDerivedFanout?: boolean; skipSourceWriteback?: boolean }
): Promise<ActionResult<TaskItem>> {
  const access = await requireTaskItemAccess(taskId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, task } = access;

  const payload: Record<string, any> = {
    updated_by: userId,
    // Clear placeholder on any edit so the task appears in search/Everything
    is_placeholder: false,
  };

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.statuses !== undefined) payload.statuses = normalizeTaskStatuses(updates.statuses);
  if (updates.status !== undefined && updates.statuses === undefined) {
    payload.statuses = statusesFromSingle(updates.status);
  }
  if (updates.priorities !== undefined) payload.priorities = normalizeTaskPriorities(updates.priorities);
  if (updates.priority !== undefined && updates.priorities === undefined) {
    payload.priorities = prioritiesFromSingle(updates.priority);
  }
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.dueTime !== undefined) payload.due_time = updates.dueTime;
  if (updates.dueTimeEnd !== undefined) payload.due_time_end = updates.dueTimeEnd;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.hideIcons !== undefined) payload.hide_icons = updates.hideIcons;
  if (updates.recurringEnabled !== undefined) payload.recurring_enabled = updates.recurringEnabled;
  if (updates.recurringFrequency !== undefined) payload.recurring_frequency = updates.recurringFrequency;
  if (updates.recurringInterval !== undefined) payload.recurring_interval = updates.recurringInterval;

  // Mark as edited if this is a snapshot
  if ((task as any).source_entity_id) {
    payload.edited = true;
  }

  const { data, error } = await supabase
    .from("task_items")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error || !data) {
    const msg = error?.message ?? "Unknown error";
    return { error: `Failed to update task: ${msg}` };
  }
  const normalizedTask = normalizeTaskRow(data);

  // Update entity_properties to keep status, priority, and due date in sync
  const { setEntityProperties } = await import("@/app/actions/entity-properties");
  const entityPropertyUpdates: any = {};

  // Map task status to entity property status
  if (updates.status !== undefined) {
    const statusMap: Record<TaskStatus, string> = {
      "todo": "todo",
      "in-progress": "in_progress",
      "done": "done",
    };
    entityPropertyUpdates.status = statusMap[updates.status] || "todo";
  }
  if (updates.statuses !== undefined) {
    entityPropertyUpdates.statuses = normalizeTaskStatuses(updates.statuses).map((entry) => ({
      field_name: entry.field_name,
      value: entry.value,
    }));
  }

  // Map task priority to entity property priority
  if (updates.priority !== undefined) {
    entityPropertyUpdates.priority = updates.priority === "none" ? null : updates.priority;
  }
  if (updates.priorities !== undefined) {
    entityPropertyUpdates.priorities = normalizeTaskPriorities(updates.priorities).map((entry) => ({
      field_name: entry.field_name,
      value: entry.value,
    }));
  }

  // Update due date if provided
  if (updates.dueDate !== undefined || updates.startDate !== undefined) {
    const startDate = updates.startDate !== undefined ? updates.startDate : task.start_date;
    const dueDate = updates.dueDate !== undefined ? updates.dueDate : task.due_date;

    if (startDate && dueDate) {
      entityPropertyUpdates.due_date = { start: startDate, end: dueDate };
    } else if (dueDate) {
      entityPropertyUpdates.due_date = { start: dueDate, end: dueDate };
    } else if (startDate) {
      entityPropertyUpdates.due_date = { start: startDate, end: startDate };
    } else {
      entityPropertyUpdates.due_date = null;
    }
  }
  if (updates.tags !== undefined) {
    entityPropertyUpdates.tags = updates.tags;
  }
  if (updates.assignee_ids !== undefined) {
    entityPropertyUpdates.assignee_ids = updates.assignee_ids;
  }
  if (updates.assignees !== undefined) {
    entityPropertyUpdates.assignees = updates.assignees;
  }
  if (updates.assignee_id !== undefined) {
    entityPropertyUpdates.assignee_id = updates.assignee_id;
  }

  // Only call setEntityProperties if we have property updates
  if (Object.keys(entityPropertyUpdates).length > 0) {
    await setEntityProperties({
      entity_type: "task",
      entity_id: taskId,
      workspace_id: task.workspace_id,
      updates: entityPropertyUpdates,
    });
  }

  // Live sync back to non-task sources handled by server actions.
  const sourceType = (task as any).source_entity_type as string | null;
  const sourceId = (task as any).source_entity_id as string | null;
  const sourceMode = (task as any).source_sync_mode as string | null;
  if (!opts?.skipSourceWriteback && sourceId && sourceMode === "live") {
    if (sourceType === "timeline_event") {
      try {
        const { updateTimelineEvent } = await import("@/app/actions/timelines/event-actions");
        await updateTimelineEvent(
          sourceId,
          {
            title: normalizedTask.title,
            statuses: buildTimelineStatusesFromTask((normalizedTask as any).statuses),
            priorities: buildTimelinePrioritiesFromTask((normalizedTask as any).priorities),
            assignees: buildTimelineAssigneesFromTask(normalizedTask),
            startDate: (normalizedTask as any).start_date ?? undefined,
            endDate: (normalizedTask as any).due_date ?? undefined,
            notes: normalizedTask.description ?? undefined,
          },
          { authContext: { supabase, userId } }
        );
      } catch (syncError) {
        console.error("Failed to sync task properties back to source timeline event", {
          taskId,
          sourceTimelineEventId: sourceId,
          error: syncError,
        });
      }
    } else if (sourceType === "table_row") {
      try {
        await syncTaskUpdateToSourceTableRow({
          supabase,
          sourceRowId: sourceId,
          userId,
          task: normalizedTask,
        });
      } catch (syncError) {
        console.error("Failed to sync task properties back to source table row", {
          taskId,
          sourceRowId: sourceId,
          error: syncError,
        });
      }
    }
  }

  if (!opts?.skipDerivedFanout) {
    const fanoutSourceTaskId =
      sourceType === "task" && sourceId && sourceMode === "live"
        ? sourceId
        : taskId;
    try {
      await fanOutSourceTaskUpdate({
        supabase,
        sourceTaskId: fanoutSourceTaskId,
        userId,
        task: fanoutSourceTaskId === taskId ? normalizedTask : undefined,
      });
    } catch (fanoutError) {
      console.error("Failed to sync source task updates to derived entities", {
        taskId: fanoutSourceTaskId,
        error: fanoutError,
      });
    }
  }

  try {
    const { createTaskDueDateChangeNotification, createTaskStatusChangeNotification, getPrimaryTaskStatus } =
      await import("@/lib/notifications/service");

    if (updates.status !== undefined || updates.statuses !== undefined) {
      await createTaskStatusChangeNotification({
        taskId,
        actorId: userId,
        previousStatus: getPrimaryTaskStatus(task.statuses),
        nextStatus: getPrimaryTaskStatus((normalizedTask as any).statuses),
      });
    }

    if (updates.dueDate !== undefined) {
      await createTaskDueDateChangeNotification({
        taskId,
        actorId: userId,
        previousDueDate: task.due_date ?? null,
        nextDueDate: (normalizedTask as any).due_date ?? null,
      });
    }
  } catch (notificationError) {
    console.error("Failed to create task update notifications", notificationError);
  }

  return { data: normalizedTask };
}

export async function bulkUpdateTaskItems(input: {
  taskIds: string[];
  updates: Partial<{
    title: string;
    status: TaskStatus;
    statuses: TaskItemStatus[];
    priority: TaskPriority;
    priorities: TaskItemPriority[];
    description: string | null;
    dueDate: string | null;
    dueTime: string | null;
    dueTimeEnd: string | null;
    startDate: string | null;
    hideIcons: boolean;
    recurringEnabled: boolean;
    recurringFrequency: "daily" | "weekly" | "monthly" | null;
    recurringInterval: number | null;
  }>;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updatedCount: number; skipped: string[] }>> {
  const taskIds = Array.from(new Set((input.taskIds || []).filter(Boolean)));
  if (taskIds.length === 0) return { data: { updatedCount: 0, skipped: [] } };

  // Get access from first task to verify workspace access
  const firstTaskAccess = await requireTaskItemAccess(taskIds[0], { authContext: input.authContext });
  if ("error" in firstTaskAccess) return { error: firstTaskAccess.error ?? "Unknown error" };
  const { supabase, userId, task: firstTask } = firstTaskAccess;
  const workspaceId = firstTask.workspace_id;

  // Verify all tasks exist and belong to the same workspace
  const { data: tasks, error: tasksError } = await supabase
    .from("task_items")
    .select("id, workspace_id, start_date, due_date")
    .in("id", taskIds)
    .eq("workspace_id", workspaceId);

  if (tasksError) return { error: "Failed to load tasks" };

  const validTaskIds = new Set((tasks || []).map((t: any) => t.id));
  const skipped = taskIds.filter((id) => !validTaskIds.has(id));
  const toUpdate = taskIds.filter((id) => validTaskIds.has(id));

  if (toUpdate.length === 0) return { data: { updatedCount: 0, skipped } };

  const payload: Record<string, any> = {
    updated_by: userId,
  };

  if (input.updates.title !== undefined) payload.title = input.updates.title;
  if (input.updates.statuses !== undefined) payload.statuses = normalizeTaskStatuses(input.updates.statuses);
  if (input.updates.status !== undefined && input.updates.statuses === undefined) {
    payload.statuses = statusesFromSingle(input.updates.status);
  }
  if (input.updates.priorities !== undefined) payload.priorities = normalizeTaskPriorities(input.updates.priorities);
  if (input.updates.priority !== undefined && input.updates.priorities === undefined) {
    payload.priorities = prioritiesFromSingle(input.updates.priority);
  }
  if (input.updates.description !== undefined) payload.description = input.updates.description;
  if (input.updates.dueDate !== undefined) payload.due_date = input.updates.dueDate;
  if (input.updates.dueTime !== undefined) payload.due_time = input.updates.dueTime;
  if (input.updates.dueTimeEnd !== undefined) payload.due_time_end = input.updates.dueTimeEnd;
  if (input.updates.startDate !== undefined) payload.start_date = input.updates.startDate;
  if (input.updates.hideIcons !== undefined) payload.hide_icons = input.updates.hideIcons;
  if (input.updates.recurringEnabled !== undefined) payload.recurring_enabled = input.updates.recurringEnabled;
  if (input.updates.recurringFrequency !== undefined) payload.recurring_frequency = input.updates.recurringFrequency;
  if (input.updates.recurringInterval !== undefined) payload.recurring_interval = input.updates.recurringInterval;

  const { error: updateError } = await supabase
    .from("task_items")
    .update(payload)
    .in("id", toUpdate);

  if (updateError) return { error: "Failed to update tasks" };

  // Update entity_properties for each task to keep status, priority, and due date in sync
  const { setEntityProperties } = await import("@/app/actions/entity-properties");

  // Build entity property updates
  const entityPropertyUpdates: any = {};

  // Map task status to entity property status
  if (input.updates.status !== undefined) {
    const statusMap: Record<TaskStatus, string> = {
      "todo": "todo",
      "in-progress": "in_progress",
      "done": "done",
    };
    entityPropertyUpdates.status = statusMap[input.updates.status] || "todo";
  }
  if (input.updates.statuses !== undefined) {
    entityPropertyUpdates.statuses = normalizeTaskStatuses(input.updates.statuses).map((entry) => ({
      field_name: entry.field_name,
      value: entry.value,
    }));
  }

  // Map task priority to entity property priority
  if (input.updates.priority !== undefined) {
    entityPropertyUpdates.priority = input.updates.priority === "none" ? null : input.updates.priority;
  }
  if (input.updates.priorities !== undefined) {
    entityPropertyUpdates.priorities = normalizeTaskPriorities(input.updates.priorities).map((entry) => ({
      field_name: entry.field_name,
      value: entry.value,
    }));
  }

  // Update entity_properties for each task
  if (Object.keys(entityPropertyUpdates).length > 0 || input.updates.dueDate !== undefined || input.updates.startDate !== undefined) {
    const taskMap = new Map((tasks || []).map((t: any) => [t.id, t]));

    for (const taskId of toUpdate) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      const updates = { ...entityPropertyUpdates };

      // Update due date if provided
      if (input.updates.dueDate !== undefined || input.updates.startDate !== undefined) {
        const startDate = input.updates.startDate !== undefined ? input.updates.startDate : task.start_date;
        const dueDate = input.updates.dueDate !== undefined ? input.updates.dueDate : task.due_date;

        if (startDate && dueDate) {
          updates.due_date = { start: startDate, end: dueDate };
        } else if (dueDate) {
          updates.due_date = { start: dueDate, end: dueDate };
        } else if (startDate) {
          updates.due_date = { start: startDate, end: startDate };
        } else {
          updates.due_date = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        await setEntityProperties({
          entity_type: "task",
          entity_id: taskId,
          workspace_id: workspaceId,
          updates,
        });
      }
    }
  }

  return { data: { updatedCount: toUpdate.length, skipped } };
}

export async function bulkMoveTaskItems(input: {
  taskIds: string[];
  targetBlockId: string;
  authContext?: AuthContext;
}): Promise<ActionResult<{ movedCount: number; skipped: string[] }>> {
  const access = await requireTaskBlockAccess(input.targetBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;

  const taskIds = Array.from(new Set((input.taskIds || []).filter(Boolean)));
  if (taskIds.length === 0) return { data: { movedCount: 0, skipped: [] } };

  const { data: tasks, error: tasksError } = await supabase
    .from("task_items")
    .select("id")
    .in("id", taskIds)
    .eq("workspace_id", block.workspace_id);

  if (tasksError) return { error: "Failed to load tasks" };

  const validTaskIds = new Set((tasks || []).map((t: any) => t.id));
  const skipped = taskIds.filter((id) => !validTaskIds.has(id));
  const toMove = taskIds.filter((id) => validTaskIds.has(id));

  if (toMove.length === 0) return { data: { movedCount: 0, skipped } };

  const { data: maxOrder } = await supabase
    .from("task_items")
    .select("display_order")
    .eq("task_block_id", block.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startOrder = maxOrder?.display_order ?? -1;
  const updates = toMove.map((taskId, index) => ({
    id: taskId,
    task_block_id: block.id,
    tab_id: block.tab_id,
    project_id: block.project_id,
    workspace_id: block.workspace_id,
    display_order: startOrder + index + 1,
    updated_by: userId,
  }));

  const { error: updateError } = await supabase
    .from("task_items")
    .upsert(updates, { onConflict: "id" });

  if (updateError) return { error: "Failed to move tasks" };

  return { data: { movedCount: toMove.length, skipped } };
}

export async function duplicateTasksToBlock(input: {
  taskIds: string[];
  targetBlockId: string;
  includeAssignees?: boolean;
  includeTags?: boolean;
  forceSourceTaskLink?: boolean;
  authContext?: AuthContext;
}): Promise<ActionResult<{ createdCount: number; createdTaskIds: string[]; skipped: string[] }>> {
  const access = await requireTaskBlockAccess(input.targetBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;

  const taskIds = Array.from(new Set((input.taskIds || []).filter(Boolean)));
  if (taskIds.length === 0) return { data: { createdCount: 0, createdTaskIds: [], skipped: [] } };

  const { data: tasks, error: tasksError } = await supabase
    .from("task_items")
    .select(
      "id, title, statuses, priorities, description, due_date, due_time, due_time_end, start_date, hide_icons, recurring_enabled, recurring_frequency, recurring_interval, source_entity_type, source_entity_id"
    )
    .in("id", taskIds)
    .eq("workspace_id", block.workspace_id);

  if (tasksError) return { error: "Failed to load tasks" };

  const taskMap = new Map<string, any>();
  (tasks || []).forEach((task: any) => taskMap.set(task.id, task));

  const orderedTasks = taskIds
    .map((id) => taskMap.get(id))
    .filter(Boolean);
  const skipped = taskIds.filter((id) => !taskMap.has(id));

  console.log("[duplicateTasksToBlock]", {
    inputTaskIds: taskIds.length,
    blockWorkspaceId: block.workspace_id,
    tasksFoundInDb: (tasks || []).length,
    orderedTasks: orderedTasks.length,
    skipped: skipped.length,
    skippedIds: skipped,
  });

  if (orderedTasks.length === 0) {
    return { data: { createdCount: 0, createdTaskIds: [], skipped } };
  }

  const includeAssignees = input.includeAssignees !== false;
  const includeTags = input.includeTags !== false;

  let assigneeMap = new Map<string, Array<{ assignee_id: string | null; assignee_name: string | null }>>();

  if (includeAssignees) {
    const { data: assignees } = await supabase
      .from("task_assignees")
      .select("task_id, assignee_id, assignee_name")
      .in("task_id", orderedTasks.map((t: any) => t.id));

    (assignees || []).forEach((row: any) => {
      const list = assigneeMap.get(row.task_id) || [];
      list.push({ assignee_id: row.assignee_id ?? null, assignee_name: row.assignee_name ?? null });
      assigneeMap.set(row.task_id, list);
    });

    const missingAssigneeTaskIds = orderedTasks
      .map((t: any) => t.id)
      .filter((taskId: string) => !assigneeMap.has(taskId));

    if (missingAssigneeTaskIds.length > 0) {
      const { data: assigneeProps } = await supabase
        .from("entity_properties")
        .select("entity_id, value")
        .eq("workspace_id", block.workspace_id)
        .eq("entity_type", "task")
        .eq("field_type", "assignee")
        .in("entity_id", missingAssigneeTaskIds);

      (assigneeProps || []).forEach((row: any) => {
        const value = row.value;
        const values = Array.isArray(value) ? value : [value];
        const parsed: Array<{ assignee_id: string | null; assignee_name: string | null }> = values
          .map((entry: any) => {
            if (entry && typeof entry === "object") {
              return {
                assignee_id: typeof entry.id === "string" ? entry.id : null,
                assignee_name:
                  typeof entry.name === "string"
                    ? entry.name
                    : typeof entry.id === "string"
                      ? entry.id
                      : null,
              };
            }
            if (typeof entry === "string") {
              return { assignee_id: entry, assignee_name: entry };
            }
            return null;
          })
          .filter((entry): entry is { assignee_id: string | null; assignee_name: string | null } => {
            return Boolean(entry && (entry.assignee_id || entry.assignee_name));
          });
        if (parsed.length > 0) {
          assigneeMap.set(row.entity_id, parsed);
        }
      });
    }
  }

  let tagMap = new Map<string, string[]>();
  if (includeTags) {
    const { data: tagLinks } = await supabase
      .from("task_tag_links")
      .select("task_id, tag_id")
      .in("task_id", orderedTasks.map((t: any) => t.id));

    (tagLinks || []).forEach((row: any) => {
      const list = tagMap.get(row.task_id) || [];
      list.push(row.tag_id);
      tagMap.set(row.task_id, list);
    });
  }

  const { data: maxOrder } = await supabase
    .from("task_items")
    .select("display_order")
    .eq("task_block_id", block.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextOrder = maxOrder?.display_order ?? -1;
  const createdTaskIds: string[] = [];

  for (const task of orderedTasks) {
    nextOrder += 1;
    const baseInsert = {
      task_block_id: block.id,
      workspace_id: block.workspace_id,
      project_id: block.project_id,
      tab_id: block.tab_id,
      title: task.title,
      statuses: Array.isArray(task.statuses) ? normalizeTaskStatuses(task.statuses) : statusesFromSingle(task.status ?? "todo"),
      priorities: normalizeTaskPriorities(task.priorities),
      description: task.description ?? null,
      due_date: task.due_date ?? null,
      due_time: task.due_time ?? null,
      due_time_end: task.due_time_end ?? null,
      start_date: task.start_date ?? null,
      hide_icons: task.hide_icons ?? false,
      display_order: nextOrder,
      recurring_enabled: task.recurring_enabled ?? false,
      recurring_frequency: task.recurring_frequency ?? null,
      recurring_interval: task.recurring_interval ?? null,
      created_by: userId,
      updated_by: userId,
    };

    let createResult = await supabase
      .from("task_items")
      .insert({
        ...baseInsert,
        source_task_id:
          !input.forceSourceTaskLink && task.source_entity_type === "table_row" && task.source_entity_id
            ? null
            : task.id,
        source_entity_type:
          !input.forceSourceTaskLink && task.source_entity_type === "table_row" && task.source_entity_id
            ? "table_row"
            : "task",
        source_entity_id:
          !input.forceSourceTaskLink && task.source_entity_type === "table_row" && task.source_entity_id
            ? task.source_entity_id
            : task.id,
        source_sync_mode: "live",
      })
      .select("id")
      .single();

    if (createResult.error && /source_task_id|source_sync_mode|source_entity/i.test(createResult.error.message || "")) {
      createResult = await supabase
        .from("task_items")
        .insert(baseInsert)
        .select("id")
        .single();
    }

    const { data: created, error: createError } = createResult;

    if (createError || !created) {
      skipped.push(task.id);
      continue;
    }

    createdTaskIds.push(created.id);

    if (includeAssignees) {
      const assignees = assigneeMap.get(task.id) || [];
      if (assignees.length > 0) {
        const payload = assignees.map((assignee) => ({
          task_id: created.id,
          assignee_id: assignee.assignee_id,
          assignee_name: assignee.assignee_name || assignee.assignee_id || "Unknown",
        }));
        const { error: assigneeError } = await supabase.from("task_assignees").insert(payload);
        if (assigneeError) return { error: "Failed to copy assignees" };

        await supabase.from("entity_properties").upsert(
          {
            workspace_id: block.workspace_id,
            entity_type: "task",
            entity_id: created.id,
            field_name: "Assignee",
            field_type: "assignee",
            value: assignees
              .filter((assignee) => assignee.assignee_id)
              .map((assignee) => ({
                id: assignee.assignee_id,
                name: assignee.assignee_name || assignee.assignee_id || "Unknown",
              })),
          },
          { onConflict: "entity_type,entity_id,field_name" }
        );

        // Keep task_items.assignee_id in sync (denormalized first assignee)
        const firstAssigneeId = assignees[0]?.assignee_id ?? null;
        await supabase
          .from("task_items")
          .update({ assignee_id: firstAssigneeId })
          .eq("id", created.id);
      }
    }

    if (includeTags) {
      const tagIds = tagMap.get(task.id) || [];
      if (tagIds.length > 0) {
        const payload = tagIds.map((tagId) => ({ task_id: created.id, tag_id: tagId }));
        const { error: tagError } = await supabase.from("task_tag_links").insert(payload);
        if (tagError) return { error: "Failed to copy tags" };
      }
    }

    // Copy status/priority/due_date/tags entity_properties from source task to new task
    const { data: sourceProps } = await supabase
      .from("entity_properties")
      .select("field_name, field_type, value")
      .eq("entity_type", "task")
      .eq("entity_id", task.id)
      .in("field_type", ["status", "priority", "due_date", "tags"]);

    if (sourceProps && sourceProps.length > 0) {
      // Build named arrays — setEntityProperties expects Array<{field_name, value}> for
      // statuses/priorities/due_dates, not scalars. Collecting all rows per type preserves
      // multi-field tasks (e.g. a task linked to a table with two status columns).
      const statusRows: Array<{ field_name: string; value: unknown }> = [];
      const priorityRows: Array<{ field_name: string; value: unknown }> = [];
      const dueDateRows: Array<{ field_name: string; value: unknown }> = [];
      let tagsValue: unknown;
      let hasTags = false;

      for (const prop of sourceProps as Array<{ field_name: string; field_type: string; value: unknown }>) {
        if (prop.field_type === "status") statusRows.push({ field_name: prop.field_name, value: prop.value });
        if (prop.field_type === "priority") priorityRows.push({ field_name: prop.field_name, value: prop.value });
        if (prop.field_type === "due_date") dueDateRows.push({ field_name: prop.field_name, value: prop.value });
        if (prop.field_type === "tags") { tagsValue = prop.value; hasTags = true; }
      }

      const epUpdates: Record<string, unknown> = {};
      if (statusRows.length > 0) epUpdates.statuses = statusRows;
      if (priorityRows.length > 0) epUpdates.priorities = priorityRows;
      if (dueDateRows.length > 0) epUpdates.due_dates = dueDateRows;
      if (hasTags) epUpdates.tags = tagsValue;

      if (Object.keys(epUpdates).length > 0) {
        const { setEntityProperties } = await import("@/app/actions/entity-properties");
        await setEntityProperties({
          entity_type: "task",
          entity_id: created.id,
          workspace_id: block.workspace_id,
          updates: epUpdates as any,
        });
      }
    }
  }

  return { data: { createdCount: createdTaskIds.length, createdTaskIds, skipped } };
}

export async function setTaskSyncModeForBlock(input: {
  taskBlockId: string;
  mode: TaskSourceSyncMode;
  authContext?: AuthContext;
}): Promise<ActionResult<{ updatedCount: number }>> {
  const access = await requireTaskBlockAccess(input.taskBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: sourceCandidates, error: sourceCandidatesError } = await supabase
    .from("task_items")
    .select("id, source_task_id, source_entity_type, source_entity_id")
    .eq("task_block_id", input.taskBlockId)
    .or("source_entity_id.not.is.null,source_task_id.not.is.null");

  if (sourceCandidatesError) return { error: "Failed to load source-linked tasks" };

  const idsToUpdate = (sourceCandidates || [])
    .filter((task: any) => {
      const hasUniversalSource = Boolean(task.source_entity_id);
      const hasLegacyTaskSource = Boolean(task.source_task_id);
      if (!hasUniversalSource && !hasLegacyTaskSource) return false;

      if (input.mode === "snapshot") return true;

      // Live sync is supported for task, timeline_event, and table_row sourced copies.
      if ((task.source_entity_type === "task" || task.source_entity_type === "timeline_event" || task.source_entity_type === "table_row") && task.source_entity_id) return true;
      if (!task.source_entity_type && task.source_task_id) return true;
      return false;
    })
    .map((task: any) => task.id as string);

  if (idsToUpdate.length === 0) {
    return { data: { updatedCount: 0 } };
  }

  const { data, error } = await supabase
    .from("task_items")
    .update({ source_sync_mode: input.mode })
    .in("id", idsToUpdate)
    .select("id");

  if (error) return { error: "Failed to update task sync mode" };

  return { data: { updatedCount: (data || []).length } };
}

export async function deleteTaskItem(taskId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, task } = access;

  const isLiveTaskDerivedCopy =
    task.source_entity_type === "task" &&
    Boolean(task.source_entity_id) &&
    task.source_sync_mode === "live";

  if (!isLiveTaskDerivedCopy) {
    const { data: derivedTasks } = await supabase
      .from("task_items")
      .select("id")
      .eq("source_entity_type", "task")
      .eq("source_entity_id", taskId)
      .eq("source_sync_mode", "live");

    const derivedTaskIds = (derivedTasks ?? []).map((row: any) => String(row.id)).filter(Boolean);
    if (derivedTaskIds.length > 0) {
      await supabase
        .from("entity_properties")
        .delete()
        .eq("entity_type", "task")
        .in("entity_id", derivedTaskIds);

      const { error: derivedDeleteError } = await supabase
        .from("task_items")
        .delete()
        .in("id", derivedTaskIds);
      if (derivedDeleteError) return { error: "Failed to delete derived task copies" };
    }
  }

  // Delete entity_properties for this task
  await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", "task")
    .eq("entity_id", taskId);

  // Delete the task itself (this will cascade to task_assignees, task_tag_links, etc.)
  const { error } = await supabase.from("task_items").delete().eq("id", taskId);
  if (error) return { error: "Failed to delete task" };
  return { data: null };
}

export async function reorderTaskItems(taskBlockId: string, orderedIds: string[], opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await requireTaskBlockAccess(taskBlockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const updates = orderedIds.map((id, idx) => ({ id, display_order: idx }));
  const { error } = await supabase.from("task_items").upsert(updates, { onConflict: "id" });
  if (error) return { error: "Failed to reorder tasks" };
  return { data: null };
}
