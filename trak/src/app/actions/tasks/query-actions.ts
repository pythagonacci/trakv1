"use server";

import { requireTaskBlockAccess, requireTaskItemAccess, requireWorkspaceAccessForTasks } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskItem, TaskItemPriority } from "@/types/task";
import type { DueDateRange, EntityProperties } from "@/types/properties";
import { buildEntityPropertiesFromRows } from "@/app/actions/entity-properties";

type ActionResult<T> = { data: T } | { error: string };

/** Entity properties keyed by task ID, mapped once server-side */
export type TaskEntityPropertiesMap = Record<string, EntityProperties>;

/** Bundle returned by getTaskItemsByBlock — tasks + pre-fetched entity properties */
export interface TaskBlockBundle {
  tasks: TaskItemView[];
  entityPropertiesByTaskId: TaskEntityPropertiesMap;
}

export interface TaskItemView {
  id: string;
  text: string;
  statuses: Array<{ field_name: string; value: string }>;
  priorities: TaskItemPriority[];
  sourceTaskId?: string | null;
  sourceEntityType?: "task" | "timeline_event" | "table_row" | null;
  sourceEntityId?: string | null;
  sourceSyncMode?: "snapshot" | "live";
  assignees?: string[];
  dueDate?: string;
  dueTime?: string;
  dueTimeEnd?: string;
  startDate?: string;
  tags?: string[];
  description?: string;
  subtasks?: { id: string; text: string; description?: string | null; completed: boolean }[];
  comments?: { id: string; author: string; text: string; timestamp: string }[];
  recurring?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly" | null;
    interval: number | null;
  };
  hideIcons?: boolean;
}

export async function getTaskItemsByBlock(taskBlockId: string): Promise<ActionResult<TaskBlockBundle>> {
  const _t0 = performance.now();
  const access = await requireTaskBlockAccess(taskBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskItemsByBlock auth ms=${Math.round(performance.now() - _t0)} taskBlockId=${taskBlockId}`);

  const _tItems = performance.now();
  // P0-2: Column projection — only fetch fields used in TaskItemView
  const { data: items, error: itemsError } = await supabase
    .from("task_items")
    .select("id, title, statuses, priorities, assignees, due_dates, source_task_id, source_entity_type, source_entity_id, source_sync_mode, due_date, due_time, due_time_end, start_date, description, display_order, recurring_enabled, recurring_frequency, recurring_interval, hide_icons")
    .eq("task_block_id", taskBlockId)
    .order("display_order", { ascending: true });

  if (itemsError) return { error: "Failed to load tasks" };
  if (!items || items.length === 0) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskItemsByBlock taskBlockId=${taskBlockId} items=0 totalMs=${Math.round(performance.now() - _t0)}`);
    return { data: { tasks: [], entityPropertiesByTaskId: {} } };
  }

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskItemsByBlock items query ms=${Math.round(performance.now() - _tItems)} count=${items.length}`);

  const taskIds = items.map((item: any) => item.id);

  // --- Single parallel batch: subtasks, comments, tags (joined), assignees, AND entity_properties ---
  const _tParallel = performance.now();
  const [subtasksResult, commentsResult, tagLinksResult, assigneesResult, entityPropsResult] = await Promise.all([
    supabase
      .from("task_subtasks")
      .select("id, task_id, title, description, completed")
      .in("task_id", taskIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("task_comments")
      .select("id, task_id, author_id, text, created_at")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true }),
    // Join tag_links → task_tags in one query (eliminates separate task_tags fetch)
    supabase
      .from("task_tag_links")
      .select("task_id, tag_id, tag:task_tags(id, name)")
      .in("task_id", taskIds),
    supabase
      .from("task_assignees")
      .select("task_id, assignee_id, assignee_name")
      .in("task_id", taskIds),
    // P0-1: Bulk entity properties — eliminates N+1 useEntityProperties calls
    supabase
      .from("entity_properties")
      .select("id, entity_id, entity_type, field_name, field_type, value, workspace_id, created_at, updated_at")
      .eq("entity_type", "task")
      .in("entity_id", taskIds),
  ]);

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskItemsByBlock parallel ms=${Math.round(performance.now() - _tParallel)} subtasks=${subtasksResult.data?.length} comments=${commentsResult.data?.length} tags=${tagLinksResult.data?.length} assignees=${assigneesResult.data?.length} entityProps=${entityPropsResult.data?.length}`);

  const subtasks = subtasksResult.data || [];
  const comments = commentsResult.data || [];
  const tagLinks = tagLinksResult.data || [];
  const assignees = assigneesResult.data || [];

  // Build entity properties map — keyed by task ID, mapped once server-side into EntityProperties objects
  const entityPropertiesByTaskId: TaskEntityPropertiesMap = {};

  // Group rows for buildEntityPropertiesFromRows
  const propsByTaskId = new Map<string, any[]>();
  for (const prop of entityPropsResult.data || []) {
    const list = propsByTaskId.get(prop.entity_id) || [];
    list.push(prop);
    propsByTaskId.set(prop.entity_id, list);
  }

  // Assuming workspaceId is on the block, but wait, TaskPropertyBadges accesses workspaceId...
  // For tasks, their properties have workspace_id. We can take it from the first row or access.
  // We can just grab workspace_id from the first row of each task's properties since they're there.
  await Promise.all(taskIds.map(async (id: string) => {
    const rows = propsByTaskId.get(id) || [];
    const workspaceId = rows.length > 0 ? rows[0].workspace_id : "";
    entityPropertiesByTaskId[id] = await buildEntityPropertiesFromRows(
      "task",
      id,
      workspaceId,
      rows
    );
  }));

  // Build tag map directly from the joined result (no separate task_tags query needed)
  const tagMap = new Map<string, string>();
  for (const link of tagLinks as any[]) {
    if (link.tag && link.tag.id && link.tag.name) {
      tagMap.set(link.tag.id, link.tag.name);
    }
  }

  // --- Profiles: only if comments or assignees have profile IDs ---
  const authorIds = Array.from(
    new Set(comments.map((comment: any) => comment.author_id).filter(Boolean))
  ) as string[];
  const assigneeIds = Array.from(
    new Set(assignees.map((assignee: any) => assignee.assignee_id).filter(Boolean))
  ) as string[];

  // Union author + assignee IDs into one profiles query
  const allProfileIds = Array.from(new Set([...authorIds, ...assigneeIds]));
  const { data: allProfiles } = allProfileIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", allProfileIds)
    : { data: [] } as any;

  const profileMap = new Map<string, string>();
  (allProfiles || []).forEach((profile: any) => {
    profileMap.set(profile.id, profile.name || profile.email || "Unknown");
  });

  const subtasksByTask = new Map<string, Array<{ id: string; text: string; description?: string | null; completed: boolean }>>();
  for (const subtask of subtasks) {
    const list = subtasksByTask.get(subtask.task_id) || [];
    list.push({
      id: subtask.id,
      text: subtask.title,
      description: subtask.description ?? undefined,
      completed: subtask.completed,
    });
    subtasksByTask.set(subtask.task_id, list);
  }

  const commentsByTask = new Map<string, Array<{ id: string; author: string; text: string; timestamp: string }>>();
  for (const comment of comments) {
    const list = commentsByTask.get(comment.task_id) || [];
    list.push({
      id: comment.id,
      author: profileMap.get(comment.author_id) || "Unknown",
      text: comment.text,
      timestamp: comment.created_at,
    });
    commentsByTask.set(comment.task_id, list);
  }

  const tagsByTask = new Map<string, string[]>();
  for (const link of tagLinks) {
    const list = tagsByTask.get(link.task_id) || [];
    const name = tagMap.get(link.tag_id);
    if (name) list.push(name);
    tagsByTask.set(link.task_id, list);
  }

  const assigneesByTask = new Map<string, string[]>();
  for (const assignee of assignees) {
    const list = assigneesByTask.get(assignee.task_id) || [];
    if (assignee.assignee_id && profileMap.has(assignee.assignee_id)) {
      list.push(profileMap.get(assignee.assignee_id)!);
    } else if (assignee.assignee_name) {
      list.push(assignee.assignee_name);
    }
    assigneesByTask.set(assignee.task_id, list);
  }

  const taskViews = (items as TaskItem[]).map((item) => {
    const priorities = Array.isArray((item as any).priorities)
      ? ((item as any).priorities as TaskItemPriority[])
      : [];
    const statuses = Array.isArray((item as any).statuses)
      ? ((item as any).statuses as any[])
      : [];
    return {
      id: item.id,
      text: item.title,
      statuses,
      priorities,
      sourceTaskId: item.source_task_id ?? null,
      sourceEntityType: (item.source_entity_type as "task" | "timeline_event" | "table_row" | null) ?? null,
      sourceEntityId: item.source_entity_id ?? null,
      sourceSyncMode: item.source_sync_mode ?? "live",
      assignees: assigneesByTask.get(item.id) || [],
      dueDate: item.due_date || undefined,
      dueTime: item.due_time ? item.due_time.slice(0, 5) : undefined,
      dueTimeEnd: item.due_time_end ? item.due_time_end.slice(0, 5) : undefined,
      startDate: item.start_date || undefined,
      tags: tagsByTask.get(item.id) || [],
      description: item.description || undefined,
      subtasks: subtasksByTask.get(item.id) || [],
      comments: commentsByTask.get(item.id) || [],
      recurring: {
        enabled: item.recurring_enabled,
        frequency: item.recurring_frequency,
        interval: item.recurring_interval,
      },
      hideIcons: item.hide_icons,
    };
  });

  const payloadBytes = Buffer.byteLength(JSON.stringify({ tasks: taskViews, entityPropertiesByTaskId }), 'utf8');
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskItemsByBlock taskBlockId=${taskBlockId} tasks=${taskViews.length} entityProps=${entityPropsResult.data?.length ?? 0} payloadBytes=${payloadBytes} totalMs=${Math.round(performance.now() - _t0)}`);
  return { data: { tasks: taskViews, entityPropertiesByTaskId } };
}

export async function getWorkspaceTasksWithDueDates(workspaceId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TaskItem[]>> {
  const _t0 = performance.now();
  const access = await requireWorkspaceAccessForTasks(workspaceId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("source_entity_id", null)
    .is("source_task_id", null)
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getWorkspaceTasksWithDueDates workspaceId=${workspaceId} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to load tasks" };
  }
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getWorkspaceTasksWithDueDates workspaceId=${workspaceId} count=${data.length} totalMs=${Math.round(performance.now() - _t0)}`);
  return { data: data as TaskItem[] };
}

/** Subtask with optional due_date range (from entity_properties). Used for timeline sidebar and nested bars. */
export interface TaskSubtaskWithProperties {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  display_order: number;
  due_date: DueDateRange | null;
}

/**
 * Fetch subtasks for a task with their due_date from entity_properties.
 * Used when a timeline event is linked to a task: sidebar list and nested timeline bars.
 */
export async function getTaskSubtasksWithProperties(
  taskId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<TaskSubtaskWithProperties[]>> {
  const _t0 = performance.now();
  const access = await requireTaskItemAccess(taskId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: subtasks, error: stError } = await supabase
    .from("task_subtasks")
    .select("id, title, description, completed, display_order")
    .eq("task_id", taskId)
    .order("display_order", { ascending: true });

  if (stError) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithProperties taskId=${taskId} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to load subtasks" };
  }
  if (!subtasks?.length) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithProperties taskId=${taskId} count=0 totalMs=${Math.round(performance.now() - _t0)}`);
    return { data: [] };
  }

  const subtaskIds = subtasks.map((s: any) => s.id);
  const { data: propRows } = await supabase
    .from("entity_properties")
    .select("entity_id, value")
    .eq("entity_type", "subtask")
    .in("entity_id", subtaskIds)
    .eq("field_type", "due_date");

  const dueDateBySubtask = new Map<string, DueDateRange | null>();
  for (const row of propRows ?? []) {
    const val = row.value;
    if (val && typeof val === "object" && ("start" in val || "end" in val)) {
      const start = typeof (val as any).start === "string" ? (val as any).start : null;
      const end = typeof (val as any).end === "string" ? (val as any).end : null;
      dueDateBySubtask.set(row.entity_id, start || end ? { start, end } : null);
    } else if (typeof val === "string") {
      dueDateBySubtask.set(row.entity_id, { start: null, end: val });
    } else {
      dueDateBySubtask.set(row.entity_id, null);
    }
  }

  const result: TaskSubtaskWithProperties[] = subtasks.map((s: any) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    completed: Boolean(s.completed),
    display_order: s.display_order ?? 0,
    due_date: dueDateBySubtask.get(s.id) ?? null,
  }));

  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithProperties taskId=${taskId} count=${result.length} totalMs=${Math.round(performance.now() - _t0)}`);
  return { data: result };
}

/**
 * Batch fetch subtasks with due_date for multiple tasks. Returns a map taskId -> subtasks.
 * Used by timeline to render nested subtask bars without N round-trips.
 */
export async function getTaskSubtasksWithPropertiesBatch(
  taskIds: string[],
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<Record<string, TaskSubtaskWithProperties[]>>> {
  const _t0 = performance.now();
  if (taskIds.length === 0) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithPropertiesBatch taskIds=0 totalMs=${Math.round(performance.now() - _t0)}`);
    return { data: {} };
  }
  const first = await requireTaskItemAccess(taskIds[0], { authContext: opts?.authContext });
  if ("error" in first) return { error: first.error ?? "Unknown error" };
  const { supabase } = first;

  const uniqueIds = [...new Set(taskIds)];

  const { data: subtasks, error: stError } = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, description, completed, display_order")
    .in("task_id", uniqueIds)
    .order("display_order", { ascending: true });

  if (stError) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithPropertiesBatch taskIds=${uniqueIds.length} error ms=${Math.round(performance.now() - _t0)}`);
    return { error: "Failed to load subtasks" };
  }
  if (!subtasks?.length) {
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithPropertiesBatch taskIds=${uniqueIds.length} count=0 totalMs=${Math.round(performance.now() - _t0)}`);
    return { data: Object.fromEntries(uniqueIds.map((id) => [id, []])) };
  }

  const subtaskIds = subtasks.map((s: any) => s.id);
  const { data: propRows } = await supabase
    .from("entity_properties")
    .select("entity_id, value")
    .eq("entity_type", "subtask")
    .in("entity_id", subtaskIds)
    .eq("field_type", "due_date");

  const dueDateBySubtask = new Map<string, DueDateRange | null>();
  for (const row of propRows ?? []) {
    const val = row.value;
    if (val && typeof val === "object" && ("start" in val || "end" in val)) {
      const start = typeof (val as any).start === "string" ? (val as any).start : null;
      const end = typeof (val as any).end === "string" ? (val as any).end : null;
      dueDateBySubtask.set(row.entity_id, start || end ? { start, end } : null);
    } else if (typeof val === "string") {
      dueDateBySubtask.set(row.entity_id, { start: null, end: val });
    } else {
      dueDateBySubtask.set(row.entity_id, null);
    }
  }

  const byTask = new Map<string, TaskSubtaskWithProperties[]>();
  for (const s of subtasks as any[]) {
    const list = byTask.get(s.task_id) ?? [];
    list.push({
      id: s.id,
      title: s.title,
      description: s.description ?? null,
      completed: Boolean(s.completed),
      display_order: s.display_order ?? 0,
      due_date: dueDateBySubtask.get(s.id) ?? null,
    });
    byTask.set(s.task_id, list);
  }
  const data: Record<string, TaskSubtaskWithProperties[]> = {};
  for (const id of uniqueIds) {
    data[id] = byTask.get(id) ?? [];
  }
  const totalSubtasks = (subtasks as any[]).length;
  if (process.env.PERF_DEBUG === "1") console.log(`[PERF] getTaskSubtasksWithPropertiesBatch taskIds=${uniqueIds.length} subtasks=${totalSubtasks} totalMs=${Math.round(performance.now() - _t0)}`);
  return { data };
}
