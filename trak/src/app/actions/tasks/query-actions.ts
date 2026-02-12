"use server";

import { requireTaskBlockAccess, requireWorkspaceAccessForTasks } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskItem } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export interface TaskItemView {
  id: string;
  text: string;
  status: "todo" | "in-progress" | "done";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  sourceTaskId?: string | null;
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

export async function getTaskItemsByBlock(taskBlockId: string): Promise<ActionResult<TaskItemView[]>> {
  const access = await requireTaskBlockAccess(taskBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: items, error: itemsError } = await supabase
    .from("task_items")
    .select("*")
    .eq("task_block_id", taskBlockId)
    .order("display_order", { ascending: true });

  if (itemsError) return { error: "Failed to load tasks" };
  if (!items || items.length === 0) return { data: [] };

  const taskIds = items.map((item: any) => item.id);

  const [subtasksResult, commentsResult, tagLinksResult, assigneesResult] = await Promise.all([
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
    supabase
      .from("task_tag_links")
      .select("task_id, tag_id")
      .in("task_id", taskIds),
    supabase
      .from("task_assignees")
      .select("task_id, assignee_id, assignee_name")
      .in("task_id", taskIds),
  ]);

  const subtasks = subtasksResult.data || [];
  const comments = commentsResult.data || [];
  const tagLinks = tagLinksResult.data || [];
  const assignees = assigneesResult.data || [];

  const tagIds = Array.from(new Set(tagLinks.map((link: any) => link.tag_id)));
  const { data: tags } = tagIds.length
    ? await supabase.from("task_tags").select("id, name").in("id", tagIds)
    : { data: [] } as any;

  const tagMap = new Map<string, string>();
  (tags || []).forEach((tag: any) => tagMap.set(tag.id, tag.name));

  const authorIds = Array.from(
    new Set(comments.map((comment: any) => comment.author_id).filter(Boolean))
  ) as string[];
  const { data: authorProfiles } = authorIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", authorIds)
    : { data: [] } as any;

  const authorMap = new Map<string, string>();
  (authorProfiles || []).forEach((profile: any) => {
    const displayName = profile.name || profile.email || "Unknown";
    authorMap.set(profile.id, displayName);
  });

  const assigneeIds = Array.from(
    new Set(assignees.map((assignee: any) => assignee.assignee_id).filter(Boolean))
  ) as string[];
  const { data: assigneeProfiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", assigneeIds)
    : { data: [] } as any;

  const assigneeMap = new Map<string, string>();
  (assigneeProfiles || []).forEach((profile: any) => {
    const displayName = profile.name || profile.email || "Unknown";
    assigneeMap.set(profile.id, displayName);
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
      author: authorMap.get(comment.author_id) || "Unknown",
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
    if (assignee.assignee_id && assigneeMap.has(assignee.assignee_id)) {
      list.push(assigneeMap.get(assignee.assignee_id)!);
    } else if (assignee.assignee_name) {
      list.push(assignee.assignee_name);
    }
    assigneesByTask.set(assignee.task_id, list);
  }

  const result = (items as TaskItem[]).map((item) => ({
    id: item.id,
    text: item.title,
    status: item.status,
    priority: item.priority,
    sourceTaskId: item.source_task_id ?? null,
    sourceSyncMode: item.source_sync_mode ?? "snapshot",
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
  }));

  return { data: result };
}

export async function getWorkspaceTasksWithDueDates(workspaceId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TaskItem[]>> {
  const access = await requireWorkspaceAccessForTasks(workspaceId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("source_task_id", null)
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false });

  if (error || !data) return { error: "Failed to load tasks" };
  return { data: data as TaskItem[] };
}
