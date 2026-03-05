import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import { buildEntityPropertiesFromRows } from "@/app/actions/entity-properties";
import type { TaskItemPriority } from "@/types/task";
import type { EntityProperties } from "@/types/properties";

type TaskEntityPropertiesMap = Record<string, EntityProperties>;
type TaskBlockBundle = {
  tasks: TaskItemView[];
  entityPropertiesByTaskId: TaskEntityPropertiesMap;
};

type TaskItemView = {
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
};

type TaskBlockTaskRow = {
  id: string;
  title: string;
  statuses: unknown;
  priorities: unknown;
  source_task_id: string | null;
  source_entity_type: "task" | "timeline_event" | "table_row" | null;
  source_entity_id: string | null;
  source_sync_mode: "snapshot" | "live" | null;
  due_date: string | null;
  due_time: string | null;
  due_time_end: string | null;
  start_date: string | null;
  description: string | null;
  recurring_enabled: boolean;
  recurring_frequency: "daily" | "weekly" | "monthly" | null;
  recurring_interval: number | null;
  hide_icons: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const t0 = performance.now();
  const resolvedParams = await params;
  const blockId =
    resolvedParams?.blockId ??
    (() => {
      try {
        const { pathname } = new URL(request.url);
        const parts = pathname.split("/").filter(Boolean);
        return parts[2] ?? "";
      } catch {
        return "";
      }
    })();

  if (!blockId) {
    return NextResponse.json({ error: "Missing task block id" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tAuth0 = performance.now();
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id, type, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
      .eq("id", blockId)
      .maybeSingle();

    if (blockError || !block) {
      return NextResponse.json({ error: "Task block not found" }, { status: 404 });
    }

    if (block.type !== "task") {
      return NextResponse.json({ error: "Block is not a task block" }, { status: 400 });
    }

    const workspaceId = (block.tabs as { projects?: { workspace_id: string } })?.projects?.workspace_id as string | undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: "Task block is missing workspace" }, { status: 400 });
    }

    const membership = await checkWorkspaceMembership(workspaceId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTaskItemsByBlock auth ms=${Math.round(performance.now() - tAuth0)} taskBlockId=${blockId}`);

    const tItems = performance.now();
    const { data: rawItems, error: itemsError } = await supabase
      .from("task_items")
      .select("id, title, statuses, priorities, assignees, due_dates, source_task_id, source_entity_type, source_entity_id, source_sync_mode, due_date, due_time, due_time_end, start_date, description, display_order, recurring_enabled, recurring_frequency, recurring_interval, hide_icons, is_placeholder")
      .eq("task_block_id", blockId)
      .order("display_order", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
    }

    if (!rawItems || rawItems.length === 0) {
      if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTaskItemsByBlock taskBlockId=${blockId} items=0 totalMs=${Math.round(performance.now() - t0)}`);
      return NextResponse.json({ data: { tasks: [], entityPropertiesByTaskId: {} } satisfies TaskBlockBundle });
    }

    // When the block has at least one non-placeholder task (e.g. AI-created tasks), hide the default
    // empty placeholder so it doesn't show alongside the real tasks.
    const hasNonPlaceholder = rawItems.some((item: any) => !item.is_placeholder);
    const items = hasNonPlaceholder
      ? rawItems.filter((item: any) => !item.is_placeholder)
      : rawItems;

    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTaskItemsByBlock items query ms=${Math.round(performance.now() - tItems)} count=${items.length}`);

    const taskIds = items.map((item: any) => item.id);

    const tParallel = performance.now();
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
      supabase
        .from("task_tag_links")
        .select("task_id, tag_id, tag:task_tags(id, name)")
        .in("task_id", taskIds),
      supabase
        .from("task_assignees")
        .select("task_id, assignee_id, assignee_name")
        .in("task_id", taskIds),
      supabase
        .from("entity_properties")
        .select("id, entity_id, entity_type, field_name, field_type, value, workspace_id, created_at, updated_at")
        .eq("entity_type", "task")
        .in("entity_id", taskIds),
    ]);

    if (process.env.PERF_DEBUG === "1") {
      console.log(
        `[PERF] route getTaskItemsByBlock parallel ms=${Math.round(performance.now() - tParallel)} subtasks=${subtasksResult.data?.length} comments=${commentsResult.data?.length} tags=${tagLinksResult.data?.length} assignees=${assigneesResult.data?.length} entityProps=${entityPropsResult.data?.length}`
      );
    }

    const subtasks = subtasksResult.data || [];
    const comments = commentsResult.data || [];
    const tagLinks = tagLinksResult.data || [];
    const assignees = assigneesResult.data || [];

    const entityPropertiesByTaskId: TaskEntityPropertiesMap = {};

    const propsByTaskId = new Map<string, any[]>();
    for (const prop of entityPropsResult.data || []) {
      const list = propsByTaskId.get(prop.entity_id) || [];
      list.push(prop);
      propsByTaskId.set(prop.entity_id, list);
    }

    await Promise.all(taskIds.map(async (id: string) => {
      const rows = propsByTaskId.get(id) || [];
      const wsId = rows.length > 0 ? rows[0].workspace_id : workspaceId;
      entityPropertiesByTaskId[id] = await buildEntityPropertiesFromRows(
        "task",
        id,
        wsId,
        rows
      );
    }));

    const tagMap = new Map<string, string>();
    for (const link of tagLinks as any[]) {
      if (link.tag && link.tag.id && link.tag.name) {
        tagMap.set(link.tag.id, link.tag.name);
      }
    }

    const authorIds = Array.from(
      new Set(comments.map((comment: any) => comment.author_id).filter(Boolean))
    ) as string[];
    const assigneeIds = Array.from(
      new Set(assignees.map((assignee: any) => assignee.assignee_id).filter(Boolean))
    ) as string[];

    const allProfileIds = Array.from(new Set([...authorIds, ...assigneeIds]));
    const { data: allProfiles } = allProfileIds.length
      ? await supabase.from("profiles").select("id, name, email").in("id", allProfileIds)
      : ({ data: [] } as any);

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

    const taskViews = (items as TaskBlockTaskRow[]).map((item) => {
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
      } as TaskItemView;
    });

    const payloadBytes = Buffer.byteLength(JSON.stringify({ tasks: taskViews, entityPropertiesByTaskId }), "utf8");
    if (process.env.PERF_DEBUG === "1") console.log(`[PERF] route getTaskItemsByBlock taskBlockId=${blockId} tasks=${taskViews.length} entityProps=${entityPropsResult.data?.length ?? 0} payloadBytes=${payloadBytes} totalMs=${Math.round(performance.now() - t0)}`);

    return NextResponse.json({ data: { tasks: taskViews, entityPropertiesByTaskId } satisfies TaskBlockBundle });
  } catch (error) {
    console.error("Get task block items exception:", error);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}
