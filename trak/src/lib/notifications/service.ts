import { createServiceClient } from "@/lib/supabase/service";
import { NOTIFICATION_PREFERENCE_FIELDS, type NotificationType } from "./constants";
import type { NotificationPreferenceRecord } from "./types";
import {
  extractLeadingReplyTargetUserId,
  extractMarkdownMentionUserIds,
  extractPlainTextMentionUserIds,
  type MentionableMember,
} from "./mentions";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

interface TaskCommentRecord {
  id: string;
  author_id: string | null;
  text: string;
  parent_id?: string | null;
}

interface BlockCommentRecord {
  id: string;
  parent_id?: string | null;
  author_id: string;
  author_name?: string | null;
  author_email?: string | null;
  text: string;
  timestamp: string;
  source?: "internal" | "external";
}

interface NotificationWriteInput {
  workspaceId: string;
  eventType: NotificationType;
  actorId?: string | null;
  actorType?: "user" | "client" | "system";
  recipientIds: string[];
  dedupeKey: string;
  sourceType: string;
  sourceId?: string | null;
  projectId?: string | null;
  tabId?: string | null;
  blockId?: string | null;
  taskId?: string | null;
  fileId?: string | null;
  commentId?: string | null;
  payload: Record<string, any>;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function excerpt(text: string, maxLength = 180): string {
  const normalized = text.replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  switch (value) {
    case "todo":
      return "To do";
    case "in_progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
    default:
      return value;
  }
}

function normalizeDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

async function getActorDisplayName(supabase: ServiceClient, actorId: string | null | undefined): Promise<string | null> {
  if (!actorId) return null;
  const { data } = await supabase.from("profiles").select("name, email").eq("id", actorId).maybeSingle();
  if (!data) return null;
  return data.name || data.email || null;
}

async function getWorkspaceMembers(supabase: ServiceClient, workspaceId: string): Promise<MentionableMember[]> {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, profiles(name, email)")
    .eq("workspace_id", workspaceId);

  return (data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.user_id,
      name: profile?.name ?? null,
      email: profile?.email ?? null,
    };
  });
}

async function getEnabledRecipientIds(
  supabase: ServiceClient,
  workspaceId: string,
  candidateIds: string[],
  eventType: NotificationType
): Promise<string[]> {
  const ids = unique(candidateIds);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("notification_preferences")
    .select(`user_id, ${NOTIFICATION_PREFERENCE_FIELDS[eventType]}`)
    .eq("workspace_id", workspaceId)
    .in("user_id", ids);

  const enabledByUser = new Map<string, boolean>();
  for (const row of (data ?? []) as Array<Record<string, any>>) {
    enabledByUser.set(row.user_id, row[NOTIFICATION_PREFERENCE_FIELDS[eventType]] !== false);
  }

  return ids.filter((id) => enabledByUser.get(id) !== false);
}

async function getProjectAccessibleUserIds(
  supabase: ServiceClient,
  workspaceId: string,
  projectId: string | null | undefined
): Promise<string[]> {
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const workspaceUserIds = unique((members ?? []).map((row: any) => row.user_id));
  if (!projectId) return workspaceUserIds;

  const { count } = await supabase
    .from("project_members")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (!count) return workspaceUserIds;

  const [{ data: projectMembers }, { data: workspace }] = await Promise.all([
    supabase.from("project_members").select("user_id").eq("project_id", projectId),
    supabase.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle(),
  ]);

  return unique([
    workspace?.owner_id ?? null,
    ...((projectMembers ?? []).map((row: any) => row.user_id)),
  ]);
}

async function writeNotification(input: NotificationWriteInput): Promise<void> {
  const recipientIds = unique(input.recipientIds);
  if (recipientIds.length === 0) return;

  const supabase = await createServiceClient();
  const enabledRecipientIds = await getEnabledRecipientIds(
    supabase,
    input.workspaceId,
    recipientIds,
    input.eventType
  );
  if (enabledRecipientIds.length === 0) return;

  const { data: event, error: eventError } = await supabase
    .from("notification_events")
    .upsert(
      {
        workspace_id: input.workspaceId,
        event_type: input.eventType,
        actor_id: input.actorId ?? null,
        actor_type: input.actorType ?? "user",
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        project_id: input.projectId ?? null,
        tab_id: input.tabId ?? null,
        block_id: input.blockId ?? null,
        task_id: input.taskId ?? null,
        file_id: input.fileId ?? null,
        comment_id: input.commentId ?? null,
        dedupe_key: input.dedupeKey,
        payload: input.payload,
      },
      { onConflict: "workspace_id,dedupe_key" }
    )
    .select("id")
    .single();

  if (eventError || !event) {
    console.error("Failed to upsert notification event", eventError);
    return;
  }

  const { error: recipientError } = await supabase.from("notification_recipients").upsert(
    enabledRecipientIds.map((recipientId) => ({
      event_id: event.id,
      workspace_id: input.workspaceId,
      recipient_id: recipientId,
    })),
    { onConflict: "event_id,recipient_id" }
  );

  if (recipientError) {
    console.error("Failed to upsert notification recipients", recipientError);
  }
}

async function getTaskContext(supabase: ServiceClient, taskId: string) {
  const { data } = await supabase
    .from("task_items")
    .select("id, title, workspace_id, project_id, tab_id, created_by, tabs(name), projects(name)")
    .eq("id", taskId)
    .maybeSingle();
  if (!data) return null;
  const tab = Array.isArray((data as any).tabs) ? (data as any).tabs[0] : (data as any).tabs;
  const project = Array.isArray((data as any).projects) ? (data as any).projects[0] : (data as any).projects;
  return {
    id: data.id,
    title: data.title,
    workspaceId: data.workspace_id,
    projectId: data.project_id,
    tabId: data.tab_id,
    createdBy: (data as any).created_by ?? null,
    tabName: tab?.name ?? null,
    projectName: project?.name ?? null,
  };
}

async function getBlockContext(supabase: ServiceClient, blockId: string) {
  const { data } = await supabase
    .from("blocks")
    .select("id, tab_id, type, tabs(id, name, project_id, projects(id, name, workspace_id))")
    .eq("id", blockId)
    .maybeSingle();
  if (!data) return null;
  const tab = Array.isArray((data as any).tabs) ? (data as any).tabs[0] : (data as any).tabs;
  const project = Array.isArray(tab?.projects) ? tab.projects[0] : tab?.projects;
  return {
    id: data.id,
    type: data.type,
    tabId: data.tab_id,
    tabName: tab?.name ?? null,
    projectId: tab?.project_id ?? null,
    projectName: project?.name ?? null,
    workspaceId: project?.workspace_id ?? null,
  };
}

export async function createTaskCommentNotifications(input: {
  taskId: string;
  commentId: string;
  actorId: string;
  text: string;
  existingComments: TaskCommentRecord[];
  parentId?: string | null;
}): Promise<void> {
  const supabase = await createServiceClient();
  const task = await getTaskContext(supabase, input.taskId);
  if (!task) return;
  const [members, actorName] = await Promise.all([
    getWorkspaceMembers(supabase, task.workspaceId),
    getActorDisplayName(supabase, input.actorId),
  ]);

  const parentComment = input.parentId
    ? input.existingComments.find((comment) => comment.id === input.parentId)
    : null;
  const replyTargetId = parentComment?.author_id ?? extractLeadingReplyTargetUserId({
    text: input.text,
    members,
    allowMarkdown: true,
  });
  const priorCommentAuthorIds = new Set(input.existingComments.map((comment) => comment.author_id).filter(Boolean));
  const resolvedReplyTargetId = replyTargetId && priorCommentAuthorIds.has(replyTargetId) ? replyTargetId : null;

  if (resolvedReplyTargetId && resolvedReplyTargetId !== input.actorId) {
    await writeNotification({
      workspaceId: task.workspaceId,
      eventType: "comment_reply",
      actorId: input.actorId,
      recipientIds: [resolvedReplyTargetId],
      dedupeKey: `task-comment-reply:${input.commentId}:${resolvedReplyTargetId}`,
      sourceType: "task_comment",
      sourceId: input.commentId,
      projectId: task.projectId,
      tabId: task.tabId,
      taskId: task.id,
      commentId: input.commentId,
      payload: {
        actor_name: actorName,
        task_title: task.title,
        project_name: task.projectName,
        tab_name: task.tabName,
        comment_excerpt: excerpt(input.text),
      },
    });
  }

  const mentionIds = unique([
    ...extractMarkdownMentionUserIds(input.text),
    ...extractPlainTextMentionUserIds(input.text, members),
  ]).filter((id) => id !== input.actorId && id !== resolvedReplyTargetId);

  await Promise.all(
    mentionIds.map((recipientId) =>
      writeNotification({
        workspaceId: task.workspaceId,
        eventType: "mention",
        actorId: input.actorId,
        recipientIds: [recipientId],
        dedupeKey: `task-comment-mention:${input.commentId}:${recipientId}`,
        sourceType: "task_comment",
        sourceId: input.commentId,
        projectId: task.projectId,
        tabId: task.tabId,
        taskId: task.id,
        commentId: input.commentId,
        payload: {
          actor_name: actorName,
          task_title: task.title,
          project_name: task.projectName,
          tab_name: task.tabName,
          comment_excerpt: excerpt(input.text),
        },
      })
    )
  );
}

export async function createBlockCommentNotifications(input: {
  blockId: string;
  actorId: string;
  newComments: BlockCommentRecord[];
  existingComments: BlockCommentRecord[];
  workspaceId?: string;
  projectId?: string | null;
  tabId?: string | null;
}): Promise<void> {
  if (input.newComments.length === 0) return;
  const supabase = await createServiceClient();
  const block = await getBlockContext(supabase, input.blockId);
  const resolvedWorkspaceId = input.workspaceId ?? block?.workspaceId;
  if (!resolvedWorkspaceId) return;

  const [members, actorName] = await Promise.all([
    getWorkspaceMembers(supabase, resolvedWorkspaceId),
    getActorDisplayName(supabase, input.actorId),
  ]);

  for (const comment of input.newComments) {
    const parentComment = comment.parent_id
      ? input.existingComments.find((existing) => existing.id === comment.parent_id)
      : null;
    const replyTargetId = parentComment?.author_id ?? extractLeadingReplyTargetUserId({
      text: comment.text,
      members,
      allowMarkdown: false,
    });
    const priorCommentAuthorIds = new Set(
      input.existingComments.map((existing) => existing.author_id).filter(Boolean)
    );
    const resolvedReplyTargetId =
      replyTargetId && priorCommentAuthorIds.has(replyTargetId) ? replyTargetId : null;

    if (resolvedReplyTargetId && resolvedReplyTargetId !== input.actorId) {
      await writeNotification({
        workspaceId: resolvedWorkspaceId,
        eventType: "comment_reply",
        actorId: input.actorId,
        recipientIds: [resolvedReplyTargetId],
        dedupeKey: `block-comment-reply:${comment.id}:${resolvedReplyTargetId}`,
        sourceType: "block_comment",
        sourceId: comment.id,
        projectId: input.projectId ?? block?.projectId,
        tabId: input.tabId ?? block?.tabId,
        blockId: input.blockId,
        commentId: comment.id,
        payload: {
          actor_name: actorName,
          project_name: block?.projectName,
          tab_name: block?.tabName,
          block_type: block?.type,
          comment_excerpt: excerpt(comment.text),
        },
      });
    }

    const mentionIds = unique(extractPlainTextMentionUserIds(comment.text, members)).filter(
      (id) => id !== input.actorId && id !== resolvedReplyTargetId
    );

    await Promise.all(
      mentionIds.map((recipientId) =>
        writeNotification({
          workspaceId: resolvedWorkspaceId,
          eventType: "mention",
          actorId: input.actorId,
        recipientIds: [recipientId],
        dedupeKey: `block-comment-mention:${comment.id}:${recipientId}`,
        sourceType: "block_comment",
        sourceId: comment.id,
        projectId: input.projectId ?? block?.projectId,
        tabId: input.tabId ?? block?.tabId,
        blockId: input.blockId,
        commentId: comment.id,
          payload: {
            actor_name: actorName,
            project_name: block?.projectName,
            tab_name: block?.tabName,
            block_type: block?.type,
            comment_excerpt: excerpt(comment.text),
          },
        })
      )
    );
  }
}

export async function createTaskAssignmentNotifications(input: {
  taskId: string;
  actorId: string;
  addedAssigneeIds: string[];
  mutationId?: string;
}): Promise<void> {
  const recipientIds = unique(input.addedAssigneeIds).filter((id) => id !== input.actorId);
  if (recipientIds.length === 0) return;

  const supabase = await createServiceClient();
  const [task, actorName] = await Promise.all([
    getTaskContext(supabase, input.taskId),
    getActorDisplayName(supabase, input.actorId),
  ]);
  if (!task) return;
  const dedupeSuffix = input.mutationId ?? `${Date.now()}`;

  await Promise.all(
    recipientIds.map((recipientId) =>
      writeNotification({
        workspaceId: task.workspaceId,
        eventType: "task_assignment",
        actorId: input.actorId,
        recipientIds: [recipientId],
        dedupeKey: `task-assignment:${input.taskId}:${recipientId}:${dedupeSuffix}`,
        sourceType: "task",
        sourceId: input.taskId,
        projectId: task.projectId,
        tabId: task.tabId,
        taskId: task.id,
        payload: {
          actor_name: actorName,
          task_title: task.title,
          project_name: task.projectName,
          tab_name: task.tabName,
        },
      })
    )
  );
}

export async function createClientCommentNotification(input: {
  workspaceId: string;
  projectId: string;
  tabId: string;
  blockId: string;
  commentId: string;
  authorName: string;
  text: string;
}): Promise<void> {
  const supabase = await createServiceClient();
  const block = await getBlockContext(supabase, input.blockId);
  if (!block?.workspaceId) return;

  const recipients = await getProjectAccessibleUserIds(supabase, input.workspaceId, input.projectId);
  await writeNotification({
    workspaceId: input.workspaceId,
    eventType: "client_comment",
    actorType: "client",
    recipientIds: recipients,
    dedupeKey: `client-comment:${input.commentId}`,
    sourceType: "client_comment",
    sourceId: input.commentId,
    projectId: input.projectId,
    tabId: input.tabId,
    blockId: input.blockId,
    commentId: input.commentId,
    payload: {
      actor_name: input.authorName,
      project_name: block.projectName,
      tab_name: block.tabName,
      block_type: block.type,
      comment_excerpt: excerpt(input.text),
    },
  });
}

export async function createFileUploadNotification(input: {
  workspaceId: string;
  projectId: string | null;
  blockId?: string | null;
  fileId: string;
  fileName: string;
  actorId: string;
}): Promise<void> {
  const supabase = await createServiceClient();
  const [block, actorName] = await Promise.all([
    input.blockId ? getBlockContext(supabase, input.blockId) : Promise.resolve(null),
    getActorDisplayName(supabase, input.actorId),
  ]);
  const recipients = (await getProjectAccessibleUserIds(supabase, input.workspaceId, input.projectId)).filter(
    (id) => id !== input.actorId
  );

  await writeNotification({
    workspaceId: input.workspaceId,
    eventType: "file_upload",
    actorId: input.actorId,
    recipientIds: recipients,
    dedupeKey: `file-upload:${input.fileId}`,
    sourceType: "file",
    sourceId: input.fileId,
    projectId: input.projectId,
    tabId: block?.tabId ?? null,
    blockId: input.blockId ?? null,
    fileId: input.fileId,
    payload: {
      actor_name: actorName,
      file_name: input.fileName,
      project_name: block?.projectName ?? null,
      tab_name: block?.tabName ?? null,
      block_type: block?.type ?? null,
    },
  });
}

async function getTaskNotificationRecipients(supabase: ServiceClient, taskId: string): Promise<string[]> {
  const [{ data: task }, { data: assignees }] = await Promise.all([
    supabase.from("task_items").select("created_by").eq("id", taskId).maybeSingle(),
    supabase.from("task_assignees").select("assignee_id").eq("task_id", taskId),
  ]);

  return unique([
    (task as any)?.created_by ?? null,
    ...((assignees ?? []).map((row: any) => row.assignee_id)),
  ]);
}

export async function createTaskStatusChangeNotification(input: {
  taskId: string;
  actorId: string;
  previousStatus: string | null;
  nextStatus: string | null;
  mutationId?: string;
}): Promise<void> {
  const prev = formatStatus(input.previousStatus);
  const next = formatStatus(input.nextStatus);
  if (!next || prev === next) return;

  const supabase = await createServiceClient();
  const task = await getTaskContext(supabase, input.taskId);
  if (!task) return;

  const recipients = (await getTaskNotificationRecipients(supabase, input.taskId)).filter((id) => id !== input.actorId);
  const actorName = await getActorDisplayName(supabase, input.actorId);
  const dedupeSuffix = input.mutationId ?? `${Date.now()}`;

  await writeNotification({
    workspaceId: task.workspaceId,
    eventType: "task_status_change",
    actorId: input.actorId,
    recipientIds: recipients,
    dedupeKey: `task-status:${input.taskId}:${input.previousStatus ?? 'none'}:${input.nextStatus ?? 'none'}:${dedupeSuffix}`,
    sourceType: "task",
    sourceId: input.taskId,
    projectId: task.projectId,
    tabId: task.tabId,
    taskId: task.id,
    payload: {
      actor_name: actorName,
      task_title: task.title,
      project_name: task.projectName,
      tab_name: task.tabName,
      previous_status: prev,
      next_status: next,
    },
  });
}

export async function createTaskDueDateChangeNotification(input: {
  taskId: string;
  actorId: string;
  previousDueDate: string | null;
  nextDueDate: string | null;
  mutationId?: string;
}): Promise<void> {
  const prev = normalizeDueDate(input.previousDueDate);
  const next = normalizeDueDate(input.nextDueDate);
  if (prev === next) return;

  const supabase = await createServiceClient();
  const task = await getTaskContext(supabase, input.taskId);
  if (!task) return;

  const recipients = (await getTaskNotificationRecipients(supabase, input.taskId)).filter((id) => id !== input.actorId);
  const actorName = await getActorDisplayName(supabase, input.actorId);
  const dedupeSuffix = input.mutationId ?? `${Date.now()}`;

  await writeNotification({
    workspaceId: task.workspaceId,
    eventType: "due_date_change",
    actorId: input.actorId,
    recipientIds: recipients,
    dedupeKey: `task-due-date:${input.taskId}:${prev ?? 'none'}:${next ?? 'none'}:${dedupeSuffix}`,
    sourceType: "task",
    sourceId: input.taskId,
    projectId: task.projectId,
    tabId: task.tabId,
    taskId: task.id,
    payload: {
      actor_name: actorName,
      task_title: task.title,
      project_name: task.projectName,
      tab_name: task.tabName,
      previous_due_date: prev,
      next_due_date: next,
    },
  });
}

export function getPrimaryTaskStatus(statuses: unknown): string | null {
  if (!Array.isArray(statuses)) return null;
  const first = statuses.find((entry) => typeof (entry as any)?.value === "string");
  return typeof (first as any)?.value === "string" ? (first as any).value : null;
}

export function isNotificationPreferenceRecord(value: unknown): value is NotificationPreferenceRecord {
  return typeof value === "object" && value !== null && "workspace_id" in value && "user_id" in value;
}
