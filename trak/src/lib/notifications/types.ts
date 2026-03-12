import type { NotificationType } from "./constants";

export interface NotificationPreferenceRecord {
  workspace_id: string;
  user_id: string;
  mentions_enabled: boolean;
  task_assignments_enabled: boolean;
  client_comments_enabled: boolean;
  comment_replies_enabled: boolean;
  file_uploads_enabled: boolean;
  task_status_changes_enabled: boolean;
  due_date_changes_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationEventRecord {
  id: string;
  workspace_id: string;
  event_type: NotificationType;
  actor_id: string | null;
  actor_type: "user" | "client" | "system";
  source_type: string;
  source_id: string | null;
  project_id: string | null;
  tab_id: string | null;
  block_id: string | null;
  task_id: string | null;
  file_id: string | null;
  comment_id: string | null;
  dedupe_key: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface NotificationRecipientRecord {
  id: string;
  event_id: string;
  workspace_id: string;
  recipient_id: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListItem extends NotificationRecipientRecord {
  notification_events: NotificationEventRecord;
}

export interface NotificationPreferencesInput {
  mention?: boolean;
  task_assignment?: boolean;
  client_comment?: boolean;
  comment_reply?: boolean;
  file_upload?: boolean;
  task_status_change?: boolean;
  due_date_change?: boolean;
}

export interface NotificationPreferenceToggle {
  type: NotificationType;
  label: string;
  enabled: boolean;
}
