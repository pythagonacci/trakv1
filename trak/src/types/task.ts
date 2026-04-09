import type { Priority } from "@/types/properties";

export type TaskFilterExpr = Record<string, unknown>;
export interface TaskRollupConfig {
  id?: string;
  [key: string]: unknown;
}
export interface ProjectTaskRollupConfig {
  enabled: true;
  mode: "all_project_tasks";
  syncMode: "live";
}

export type TaskTableHiddenColumn = "status" | "priority" | "assignee" | "dueDate" | "tags";
export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low" | "none";
export type TaskReferenceType = "doc" | "table_row" | "task" | "block" | "tab" | "file";
export type TaskSourceSyncMode = "snapshot" | "live";
export type TaskSourceEntityType = "task" | "timeline_event" | "table_row" | "block";

export interface TaskItemPriority {
  field_name: string;
  value: Priority | null;
}

export interface TaskItemStatus {
  field_name: string;
  value: "todo" | "in_progress" | "blocked" | "done" | null;
}

export interface TaskItemAssigneeField {
  field_name: string;
  value: string[] | null;
}

export interface TaskItemDueDateField {
  field_name: string;
  value: { start: string | null; end: string | null } | null;
}

export interface TaskItem {
  id: string;
  task_block_id: string;
  workspace_id: string;
  project_id: string | null;
  tab_id: string | null;
  title: string;
  statuses: TaskItemStatus[];
  priorities: TaskItemPriority[];
  assignees?: TaskItemAssigneeField[];
  due_dates?: TaskItemDueDateField[];
  assignee_id: string | null;
  source_task_id: string | null;
  source_entity_type: TaskSourceEntityType | null;
  source_entity_id: string | null;
  source_sync_mode: TaskSourceSyncMode | null;
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
  parent_id: string | null;
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
  /** Optional custom height in pixels for the task block container (mainly list view). */
  heightPx?: number;
  filters?: TaskFilterExpr;
  search?: string;
  showDone?: boolean;
  rollups?: TaskRollupConfig[];
  showRollup?: boolean;
  tableHiddenColumns?: TaskTableHiddenColumn[];
  projectRollup?: ProjectTaskRollupConfig;
}
