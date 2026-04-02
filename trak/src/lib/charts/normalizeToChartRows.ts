/**
 * Normalize search/entity API results into ChartRow[] for the chart transform.
 * Reuses the same field semantics as workflow-executor and chart spec (status, priority, assignee, tags).
 */

import type { ChartRow } from "./chartSpec";

// ─── Status / priority (mirror workflow-executor semantics for chart row shape) ───

function normalizeStatus(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["todo", "to_do", "to-do", "not_started", "not-started"].includes(raw)) return "todo";
  if (["in_progress", "in-progress", "doing", "working"].includes(raw)) return "in_progress";
  if (["done", "complete", "completed"].includes(raw)) return "done";
  if (["blocked", "on_hold", "on-hold"].includes(raw)) return "blocked";
  return raw;
}

function normalizePriority(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["low"].includes(raw)) return "low";
  if (["medium"].includes(raw)) return "medium";
  if (["high"].includes(raw)) return "high";
  if (["urgent", "critical"].includes(raw)) return "urgent";
  if (["none"].includes(raw)) return "none";
  return raw;
}

function toDateOnly(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Extract assignee display (name or id) for chart row */
function assigneesToChart(assignees: Array<{ id?: string; name?: string }> | null | undefined): string | null {
  if (!Array.isArray(assignees) || assignees.length === 0) return null;
  const names = assignees.map((a) => (a?.name != null ? String(a.name) : a?.id != null ? String(a.id) : "")).filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

/** Extract tag names for chart row */
function tagsToChart(tags: Array<{ id?: string; name?: string }> | null | undefined): string[] {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  return tags.map((t) => (t?.name != null ? String(t.name) : t?.id != null ? String(t.id) : "")).filter(Boolean);
}

/** First status value from statuses array (TaskResult / TimelineEventResult shape) */
function firstStatusValue(statuses: Array<{ value?: string }> | null | undefined): string | null {
  if (!Array.isArray(statuses) || statuses.length === 0) return null;
  const v = statuses[0]?.value;
  return v != null ? normalizeStatus(v) : null;
}

/** First priority value from priorities array */
function firstPriorityValue(priorities: Array<{ value?: string }> | null | undefined): string | null {
  if (!Array.isArray(priorities) || priorities.length === 0) return null;
  const v = priorities[0]?.value;
  return v != null ? normalizePriority(v) : null;
}

// ─── Task-like (TaskResult from searchTasks) ───

export interface TaskLikeRow {
  id: string;
  title?: string | null;
  statuses?: Array<{ field_name?: string; value?: string }>;
  priorities?: Array<{ field_name?: string; value?: string }>;
  assignees?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  due_date?: string | null;
  project_name?: string | null;
  tab_name?: string | null;
  // Optional navigation metadata (when available from TaskResult)
  project_id?: string | null;
  tab_id?: string | null;
  task_block_id?: string | null;
  [key: string]: unknown;
}

function taskLikeToChartRow(task: TaskLikeRow): ChartRow {
  const status = firstStatusValue(task.statuses as Array<{ value?: string }> | undefined) ?? null;
  const priority = firstPriorityValue(task.priorities as Array<{ value?: string }> | undefined) ?? null;
  const assignee = assigneesToChart(task.assignees ?? null) ?? undefined;
  const tagsArr = tagsToChart(task.tags ?? null);

  const row: ChartRow = {
    id: task.id,
    "Task Title": task.title ?? "",
    status: status ?? undefined,
    priority: priority ?? undefined,
    assignee: assignee || undefined,
    tags: tagsArr.length > 0 ? tagsArr : undefined,
    "Due Date": toDateOnly(task.due_date) ?? undefined,
  };
  if (task.project_name != null) row.Project = String(task.project_name);
  if (task.tab_name != null) row.Tab = String(task.tab_name);
  // Preserve navigation metadata when present so charts can deep-link to tasks
  if (task.project_id != null) {
    row.projectId = String(task.project_id);
  }
  if (task.project_name != null) {
    row.projectName = String(task.project_name);
  }
  if (task.tab_id != null) {
    row.tabId = String(task.tab_id);
  }
  if (task.tab_name != null) {
    row.tabName = String(task.tab_name);
  }
  if (task.task_block_id != null) {
    row.taskBlockId = String(task.task_block_id);
  }
  return row;
}

// ─── Timeline event-like (TimelineEventResult from searchTimelineEvents) ───

export interface TimelineEventLikeRow {
  id: string;
  title?: string | null;
  statuses?: Array<{ field_name?: string; value?: string }>;
  priorities?: Array<{ field_name?: string; value?: string }>;
  assignee_id?: string | null;
  assignee_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number;
  [key: string]: unknown;
}

function timelineEventLikeToChartRow(event: TimelineEventLikeRow): ChartRow {
  const status = firstStatusValue(event.statuses as Array<{ value?: string }> | undefined) ?? null;
  const priority = firstPriorityValue(event.priorities as Array<{ value?: string }> | undefined) ?? null;
  const assignee = event.assignee_name ?? (event.assignee_id != null ? String(event.assignee_id) : null) ?? undefined;

  const row: ChartRow = {
    id: event.id,
    "Task Title": event.title ?? "",
    status: status ?? undefined,
    priority: priority ?? undefined,
    assignee: assignee || undefined,
    "Start Date": toDateOnly(event.start_date) ?? undefined,
    "End Date": toDateOnly(event.end_date) ?? undefined,
  };
  if (typeof event.progress === "number") row.progress = event.progress;
  return row;
}

// ─── Card-like (CardResult from searchCards) ───

export interface CardLikeRow {
  id: string;
  title?: string | null;
  status?: string | null;
  priority?: string | null;
  assignees?: Array<{ id: string; name: string }>;
  assignee_name?: string | null;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  due_date?: string | null;
  start_date?: string | null;
  project_name?: string | null;
  tab_name?: string | null;
  project_id?: string | null;
  tab_id?: string | null;
  cards_block_id?: string | null;
  [key: string]: unknown;
}

function cardLikeToChartRow(card: CardLikeRow): ChartRow {
  const status = normalizeStatus(card.status) ?? null;
  const priority = normalizePriority(card.priority) ?? null;
  const assignee = assigneesToChart(card.assignees ?? null) ?? card.assignee_name ?? undefined;
  const tagsArr = tagsToChart(card.tags ?? null);

  const row: ChartRow = {
    id: card.id,
    "Task Title": card.title ?? "",
    status: status ?? undefined,
    priority: priority ?? undefined,
    assignee: assignee || undefined,
    tags: tagsArr.length > 0 ? tagsArr : undefined,
    "Due Date": toDateOnly(card.due_date) ?? undefined,
  };
  if (card.project_name != null) row.Project = String(card.project_name);
  if (card.tab_name != null) row.Tab = String(card.tab_name);
  if (card.project_id != null) row.projectId = String(card.project_id);
  if (card.project_name != null) row.projectName = String(card.project_name);
  if (card.tab_id != null) row.tabId = String(card.tab_id);
  if (card.tab_name != null) row.tabName = String(card.tab_name);
  if (card.cards_block_id != null) row.cardsBlockId = String(card.cards_block_id);
  return row;
}

// ─── Subtask-like (SubtaskResult from searchSubtasks) ───────────────────────

export interface SubtaskLikeRow {
  id: string;
  title?: string | null;
  completed?: boolean;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  tab_id?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  tab_name?: string | null;
  [key: string]: unknown;
}

function subtaskLikeToChartRow(subtask: SubtaskLikeRow): ChartRow {
  const rawStatus = normalizeStatus(subtask.status);
  const status = rawStatus ?? (typeof subtask.completed === "boolean" ? (subtask.completed ? "done" : "todo") : null);
  const priority = normalizePriority(subtask.priority) ?? null;
  const title = typeof subtask.title === "string" && subtask.title.trim().length > 0
    ? subtask.title.trim()
    : typeof subtask.task_title === "string" && subtask.task_title.trim().length > 0
      ? subtask.task_title.trim()
      : "";

  const row: ChartRow = {
    id: subtask.id,
    "Task Title": title,
    type: "subtask",
    status: status ?? undefined,
    priority: priority ?? undefined,
    "Due Date": toDateOnly(subtask.due_date) ?? undefined,
  };
  if (subtask.task_id != null) row.parentTaskId = String(subtask.task_id);
  if (subtask.task_title != null) row.parentTaskTitle = String(subtask.task_title);
  if (subtask.tab_id != null) row.tabId = String(subtask.tab_id);
  if (subtask.project_id != null) row.projectId = String(subtask.project_id);
  if (subtask.project_name != null) row.projectName = String(subtask.project_name);
  if (subtask.tab_name != null) row.tabName = String(subtask.tab_name);
  return row;
}

// ─── Table row-like (TableRowResult: id, data, plus optional entity_properties) ───

export interface TableRowLikeRow {
  id: string;
  data: Record<string, unknown>;
  assignees?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  [key: string]: unknown;
}

/** Pick a title-like value from table row data (first string field or common names) */
function tableRowTitle(data: Record<string, unknown>): string {
  const keys = ["Title", "Task Title", "title", "Name", "name"];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const firstString = Object.entries(data).find(([, v]) => typeof v === "string" && String(v).trim());
  if (firstString) return String(firstString[1]).trim();
  return "";
}

function tableRowLikeToChartRow(rowLike: TableRowLikeRow): ChartRow {
  const { id, data } = rowLike;
  const title = tableRowTitle(data);
  const status = normalizeStatus(rowLike.status) ?? undefined;
  const priority = normalizePriority(rowLike.priority) ?? undefined;
  const assignee = assigneesToChart(rowLike.assignees ?? null) ?? undefined;
  const tagsArr = tagsToChart(rowLike.tags ?? null);

  const row: ChartRow = {
    id,
    "Task Title": title || id,
    status: status || undefined,
    priority: priority || undefined,
    assignee: assignee || undefined,
    tags: tagsArr.length > 0 ? tagsArr : undefined,
    "Due Date": toDateOnly(rowLike.due_date) ?? undefined,
  };
  // Flatten common data fields so breakdown/series can use them
  for (const [key, value] of Object.entries(data)) {
    if (key === "id") continue;
    if (row[key] === undefined && value !== undefined && value !== null) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        row[key] = value;
      } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        row[key] = value;
      }
    }
  }
  return row;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ChartDataSourceType = "tasks" | "subtasks" | "timeline_events" | "table_rows" | "cards";

/**
 * Normalize API results to ChartRow[] for buildChartData.
 * Use the same source type as ChartDataQuery.type.
 */
export function normalizeToChartRows(
  sourceType: ChartDataSourceType,
  rawResults: unknown[]
): ChartRow[] {
  if (!Array.isArray(rawResults)) return [];

  switch (sourceType) {
    case "tasks":
      return rawResults.map((r) => taskLikeToChartRow(r as TaskLikeRow));
    case "subtasks":
      return rawResults.map((r) => subtaskLikeToChartRow(r as SubtaskLikeRow));
    case "timeline_events":
      return rawResults.map((r) => timelineEventLikeToChartRow(r as TimelineEventLikeRow));
    case "table_rows":
      return rawResults.map((r) => tableRowLikeToChartRow(r as TableRowLikeRow));
    case "cards":
      return rawResults.map((r) => cardLikeToChartRow(r as CardLikeRow));
    default:
      return [];
  }
}
