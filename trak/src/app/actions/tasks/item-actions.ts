"use server";

import { requireTaskBlockAccess, requireTaskItemAccess, type TaskTimingSink } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskItem, TaskItemPriority, TaskItemStatus, TaskPriority, TaskSourceSyncMode, TaskStatus } from "@/types/task";

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
  opts?: { timing?: TaskTimingSink; authContext?: AuthContext }
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
  const priorities = input.priorities !== undefined ? normalizeTaskPriorities(input.priorities) : prioritiesFromSingle(input.priority);
  const statuses = input.statuses !== undefined ? normalizeTaskStatuses(input.statuses) : statusesFromSingle(input.status);

  // display_order is set by DB trigger set_task_item_display_order (saves one round-trip)
  const tInsert0 = performance.now();
  const { data, error } = await supabase
    .from("task_items")
    .insert({
      task_block_id: block.id,
      workspace_id: block.workspace_id,
      project_id: block.project_id,
      tab_id: block.tab_id,
      title: input.title,
      statuses: statuses,
      priorities,
      description: input.description ?? null,
      due_date: input.dueDate ?? null,
      due_time: input.dueTime ?? null,
      due_time_end: input.dueTimeEnd ?? null,
      start_date: input.startDate ?? null,
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
  }>,
  opts?: { authContext?: AuthContext }
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

  // Only call setEntityProperties if we have property updates
  if (Object.keys(entityPropertyUpdates).length > 0) {
    await setEntityProperties({
      entity_type: "task",
      entity_id: taskId,
      workspace_id: task.workspace_id,
      updates: entityPropertyUpdates,
    });
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
      "id, title, status, priorities, description, due_date, due_time, due_time_end, start_date, hide_icons, recurring_enabled, recurring_frequency, recurring_interval, source_entity_type, source_entity_id"
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
          task.source_entity_type === "table_row" && task.source_entity_id
            ? null
            : task.id,
        source_entity_type:
          task.source_entity_type === "table_row" && task.source_entity_id
            ? "table_row"
            : "task",
        source_entity_id:
          task.source_entity_type === "table_row" && task.source_entity_id
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

      // Live sync is supported for task-sourced copies only.
      if (task.source_entity_type === "task" && task.source_entity_id) return true;
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
  const { supabase } = access;

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
