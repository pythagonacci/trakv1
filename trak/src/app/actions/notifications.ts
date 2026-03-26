"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from "@/lib/notifications/constants";
import type {
  NotificationListItem,
  NotificationPreferenceRecord,
  NotificationPreferenceToggle,
} from "@/lib/notifications/types";

async function requireNotificationAccess(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { ok: false as const, error: "Not a member of this workspace" };

  return { ok: true as const, supabase, userId: user.id };
}

function buildDefaultPreferences(workspaceId: string, userId: string): NotificationPreferenceRecord {
  const now = new Date().toISOString();
  return {
    workspace_id: workspaceId,
    user_id: userId,
    mentions_enabled: true,
    task_assignments_enabled: true,
    client_comments_enabled: true,
    comment_replies_enabled: true,
    file_uploads_enabled: true,
    task_status_changes_enabled: true,
    due_date_changes_enabled: true,
    created_at: now,
    updated_at: now,
  };
}

export async function getNotifications(
  workspaceId: string,
  limit = 20
): Promise<{ data: { items: NotificationListItem[]; unreadCount: number } } | { error: string }> {
  const access = await requireNotificationAccess(workspaceId);
  if (!access.ok) return { error: access.error };
  const { supabase, userId } = access;

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("notification_recipients")
      .select(
        "id, event_id, workspace_id, recipient_id, read_at, created_at, notification_events!inner(id, workspace_id, event_type, actor_id, actor_type, source_type, source_id, project_id, tab_id, block_id, task_id, file_id, comment_id, dedupe_key, payload, created_at)"
      )
      .eq("workspace_id", workspaceId)
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("recipient_id", userId)
      .is("read_at", null),
  ]);

  if (error || countError) {
    return { error: "Failed to load notifications" };
  }

  return {
    data: {
      items: ((data ?? []) as unknown as NotificationListItem[]).map((item) => ({
        ...item,
        notification_events: Array.isArray((item as any).notification_events)
          ? (item as any).notification_events[0]
          : item.notification_events,
      })),
      unreadCount: count ?? 0,
    },
  };
}

export async function markNotificationRead(recipientId: string): Promise<{ data: { success: true } } | { error: string }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", recipientId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) return { error: "Failed to mark notification as read" };
  return { data: { success: true } };
}

export async function markAllNotificationsRead(
  workspaceId: string
): Promise<{ data: { success: true } } | { error: string }> {
  const access = await requireNotificationAccess(workspaceId);
  if (!access.ok) return { error: access.error };
  const { supabase, userId } = access;

  const { error } = await supabase
    .from("notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { error: "Failed to mark all notifications as read" };
  return { data: { success: true } };
}

export async function getNotificationPreferences(
  workspaceId: string
): Promise<{ data: { record: NotificationPreferenceRecord; toggles: NotificationPreferenceToggle[] } } | { error: string }> {
  const access = await requireNotificationAccess(workspaceId);
  if (!access.ok) return { error: access.error };
  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { error: "Failed to load notification preferences" };

  const record = (data as NotificationPreferenceRecord | null) ?? buildDefaultPreferences(workspaceId, userId);
  const toggles: NotificationPreferenceToggle[] = [
    { type: "mention", label: NOTIFICATION_TYPE_LABELS.mention, enabled: record.mentions_enabled },
    { type: "task_assignment", label: NOTIFICATION_TYPE_LABELS.task_assignment, enabled: record.task_assignments_enabled },
    { type: "client_comment", label: NOTIFICATION_TYPE_LABELS.client_comment, enabled: record.client_comments_enabled },
    { type: "comment_reply", label: NOTIFICATION_TYPE_LABELS.comment_reply, enabled: record.comment_replies_enabled },
    { type: "file_upload", label: NOTIFICATION_TYPE_LABELS.file_upload, enabled: record.file_uploads_enabled },
    { type: "task_status_change", label: NOTIFICATION_TYPE_LABELS.task_status_change, enabled: record.task_status_changes_enabled },
    { type: "due_date_change", label: NOTIFICATION_TYPE_LABELS.due_date_change, enabled: record.due_date_changes_enabled },
  ];

  return { data: { record, toggles } };
}

const preferenceColumnByType: Partial<Record<NotificationType, keyof NotificationPreferenceRecord>> = {
  mention: "mentions_enabled",
  task_assignment: "task_assignments_enabled",
  client_comment: "client_comments_enabled",
  comment_reply: "comment_replies_enabled",
  file_upload: "file_uploads_enabled",
  task_status_change: "task_status_changes_enabled",
  due_date_change: "due_date_changes_enabled",
};

export async function updateNotificationPreference(
  workspaceId: string,
  type: NotificationType,
  enabled: boolean
): Promise<{ data: { record: NotificationPreferenceRecord; toggles: NotificationPreferenceToggle[] } } | { error: string }> {
  const access = await requireNotificationAccess(workspaceId);
  if (!access.ok) return { error: access.error };
  const { supabase, userId } = access;
  const preferenceColumn = preferenceColumnByType[type];
  if (!preferenceColumn) {
    return { error: "This notification type cannot be customized." };
  }

  const payload = {
    workspace_id: workspaceId,
    user_id: userId,
    [preferenceColumn]: enabled,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "workspace_id,user_id" });

  if (error) return { error: "Failed to update notification preference" };
  return getNotificationPreferences(workspaceId);
}
