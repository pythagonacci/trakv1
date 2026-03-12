export const NOTIFICATION_TYPES = [
  "mention",
  "task_assignment",
  "client_comment",
  "comment_reply",
  "file_upload",
  "task_status_change",
  "due_date_change",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PREFERENCE_FIELDS = {
  mention: "mentions_enabled",
  task_assignment: "task_assignments_enabled",
  client_comment: "client_comments_enabled",
  comment_reply: "comment_replies_enabled",
  file_upload: "file_uploads_enabled",
  task_status_change: "task_status_changes_enabled",
  due_date_change: "due_date_changes_enabled",
} as const satisfies Record<NotificationType, string>;

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  mention: "Mentions",
  task_assignment: "Task assignments",
  client_comment: "Client comments",
  comment_reply: "Replies to my comments",
  file_upload: "File uploads",
  task_status_change: "Task status changes",
  due_date_change: "Due date changes",
};
