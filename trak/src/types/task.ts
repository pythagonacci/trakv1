export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";
export type TaskReferenceType = "doc" | "table_row" | "task" | "block" | "tab";
export type TaskSourceSyncMode = "snapshot" | "live";

export interface TaskItem {
  id: string;
  task_block_id: string;
  workspace_id: string;
  project_id: string | null;
  tab_id: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  source_task_id: string | null;
  source_sync_mode: TaskSourceSyncMode;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  due_time_end: string | null;
  start_date: string | null;
  hide_icons: boolean;
  display_order: number;
  recurring_enabled: boolean;
  recurring_frequency: "daily" | "weekly" | "monthly" | null;
  recurring_interval: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskSubtaskReference {
  id: string;
  workspace_id: string;
  subtask_id: string;
  reference_type: TaskReferenceType;
  reference_id: string;
  table_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface TaskTag {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTagLink {
  task_id: string;
  tag_id: string;
  created_at: string;
}

export interface TaskAssignee {
  task_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
}

export interface TaskReference {
  id: string;
  workspace_id: string;
  task_id: string;
  reference_type: TaskReferenceType;
  reference_id: string;
  table_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskBlockContent {
  title: string;
  hideIcons?: boolean;
  viewMode?: "list" | "board" | "table";
  boardGroupBy?: "status" | "priority" | "assignee" | "dueDate" | "tags";
}
