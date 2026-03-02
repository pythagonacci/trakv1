/**
 * Dashboard layout configuration: widget types and their options.
 * Stored per-workspace (e.g. localStorage) and used to render the customizable dashboard.
 */

// ─── Project group filter kinds (what to show) ───────────────────────────────
export type ProjectGroupFilterKind =
  | "status"
  | "team"
  | "initiative"
  | "due_this_week"
  | "recently_updated";

export type ProjectGroupView = "compact_list" | "kanban_snapshot";

export type TaskWidgetFilter = "due_soon" | "my_tasks" | "all";

// ─── Widget configs (discriminated by type) ────────────────────────────────

export interface DashboardWidgetBase {
  id: string;
}

/** Single project card (specific project) */
export interface ProjectCardWidgetConfig extends DashboardWidgetBase {
  type: "project_card";
  projectId: string;
}

/** Filtered group of projects with a view mode */
export interface ProjectGroupWidgetConfig extends DashboardWidgetBase {
  type: "project_group";
  filter: {
    kind: ProjectGroupFilterKind;
    /** For status: not_started | in_progress | complete. For team/initiative: id. */
    value?: string;
  };
  view: ProjectGroupView;
  limit?: number;
}

/** Task list widget (due soon, my tasks, or all) */
export interface TaskListWidgetConfig extends DashboardWidgetBase {
  type: "task_list";
  filter: TaskWidgetFilter;
  limit?: number;
}

/** Chart widget: generated from query (same flow as AI charts — tasks by status/priority/assignee/tags) */
export type DashboardChartQuery = {
  chartType: "pie" | "bar" | "doughnut";
  scope: "workspace" | "project";
  projectId?: string | null;
  breakdownField: "status" | "priority" | "assignee" | "tags";
  title?: string | null;
};

export interface ChartWidgetConfig extends DashboardWidgetBase {
  type: "chart";
  query: DashboardChartQuery;
}

/** Built-in sections (not draggable; can be toggled or ordered with custom widgets) */
export type BuiltInWidgetType = "notifications" | "ai_overview" | "today";

export interface BuiltInWidgetConfig extends DashboardWidgetBase {
  type: BuiltInWidgetType;
}

export type DashboardWidgetConfig =
  | ProjectCardWidgetConfig
  | ProjectGroupWidgetConfig
  | TaskListWidgetConfig
  | ChartWidgetConfig
  | BuiltInWidgetConfig;

export interface DashboardLayoutConfig {
  version: number;
  /** Order of widgets; built-in types + custom widget configs */
  widgets: DashboardWidgetConfig[];
}

const STORAGE_KEY_PREFIX = "trak-dashboard-config-";

export function getDashboardConfigStorageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

/** Default layout: built-in sections only */
export function getDefaultDashboardConfig(): DashboardLayoutConfig {
  return {
    version: 1,
    widgets: [
      { id: "builtin-notifications", type: "notifications" },
      { id: "builtin-ai", type: "ai_overview" },
      { id: "builtin-today", type: "today" },
    ],
  };
}

export function isBuiltInWidget(
  w: DashboardWidgetConfig
): w is BuiltInWidgetConfig {
  return (
    w.type === "notifications" ||
    w.type === "ai_overview" ||
    w.type === "today"
  );
}

export function isProjectCardWidget(
  w: DashboardWidgetConfig
): w is ProjectCardWidgetConfig {
  return w.type === "project_card";
}

export function isProjectGroupWidget(
  w: DashboardWidgetConfig
): w is ProjectGroupWidgetConfig {
  return w.type === "project_group";
}

export function isTaskListWidget(
  w: DashboardWidgetConfig
): w is TaskListWidgetConfig {
  return w.type === "task_list";
}

export function isChartWidget(
  w: DashboardWidgetConfig
): w is ChartWidgetConfig {
  return w.type === "chart";
}
