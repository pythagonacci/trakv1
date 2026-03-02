"use client";

import React, { useCallback, useState } from "react";
import {
  LayoutDashboard,
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Folder,
  List,
  CheckSquare,
  BarChart3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type DashboardLayoutConfig,
  type DashboardWidgetConfig,
  type ProjectCardWidgetConfig,
  type ProjectGroupWidgetConfig,
  type TaskListWidgetConfig,
  type ChartWidgetConfig,
  type DashboardChartQuery,
  getDefaultDashboardConfig,
  isBuiltInWidget,
  isProjectCardWidget,
  isProjectGroupWidget,
  isTaskListWidget,
  isChartWidget,
  type ProjectGroupFilterKind,
  type ProjectGroupView,
  type TaskWidgetFilter,
} from "./dashboard-config-types";
import { useDashboardConfigModal } from "./dashboard-config-modal-context";
import { useDashboardConfig } from "./use-dashboard-config";
import { getAllProjects } from "@/app/actions/project";
import { getAllInternalGroups } from "@/app/actions/internal-group";
import { getAllTeams } from "@/app/actions/workspace-teams";
import { cn } from "@/lib/utils";

const BUILT_IN_LABELS: Record<string, string> = {
  notifications: "Notifications",
  ai_overview: "AI Overview",
  today: "Today",
};

const PROJECT_GROUP_FILTER_LABELS: Record<ProjectGroupFilterKind, string> = {
  status: "By status",
  team: "By team",
  initiative: "By initiative",
  due_this_week: "Due this week",
  recently_updated: "Recently updated",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

const VIEW_LABELS: Record<ProjectGroupView, string> = {
  compact_list: "Compact list",
  kanban_snapshot: "Kanban snapshot",
};

const TASK_FILTER_LABELS: Record<TaskWidgetFilter, string> = {
  due_soon: "Due soon",
  my_tasks: "My tasks",
  all: "All tasks",
};

function widgetLabel(w: DashboardWidgetConfig): string {
  if (isBuiltInWidget(w)) return BUILT_IN_LABELS[w.type] ?? w.type;
  if (isProjectCardWidget(w)) return `Project: ${w.projectId.slice(0, 8)}…`;
  if (isProjectGroupWidget(w)) {
    const filterLabel = PROJECT_GROUP_FILTER_LABELS[w.filter.kind];
    const viewLabel = VIEW_LABELS[w.view];
    return `${filterLabel} (${viewLabel})`;
  }
  if (isTaskListWidget(w)) return `Tasks: ${TASK_FILTER_LABELS[w.filter]}`;
  if (isChartWidget(w)) {
    const t = w.query.title;
    const by = w.query.breakdownField;
    const scope = w.query.scope === "project" && w.query.projectId ? "project" : "workspace";
    return t ? `Chart: ${t}` : `${w.query.chartType} by ${by} (${scope})`;
  }
  return "Widget";
}

function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface DashboardConfigModalProps {
  workspaceId: string;
  projectNames?: Map<string, string>;
}

export default function DashboardConfigModal({
  workspaceId,
  projectNames = new Map(),
}: DashboardConfigModalProps) {
  const modal = useDashboardConfigModal();
  const { config, setConfig } = useDashboardConfig(workspaceId);
  const [addingType, setAddingType] = useState<
    "project_card" | "project_group" | "task_list" | "chart" | null
  >(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

  const open = modal?.isOpen ?? false;
  const onClose = useCallback(() => {
    modal?.close();
    setAddingType(null);
  }, [modal]);

  React.useEffect(() => {
    if (!open || addingType === null) return;
    if (addingType === "project_card" || addingType === "project_group" || addingType === "chart") {
      getAllProjects(workspaceId, {}, {}).then((r) => {
        if (r.data) setProjects(r.data.map((p) => ({ id: p.id, name: p.name })));
      });
    }
    if (addingType === "project_group") {
      getAllInternalGroups(workspaceId).then((r) => {
        if (r.data) setGroups(r.data.map((g) => ({ id: g.id, name: g.name })));
      });
      getAllTeams(workspaceId).then((r) => {
        if (r.data) setTeams(r.data.map((t) => ({ id: t.id, name: t.name })));
      });
    }
  }, [open, addingType, workspaceId]);

  const moveWidget = useCallback(
    (index: number, direction: "up" | "down") => {
      const next = [...config.widgets];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      setConfig({ ...config, widgets: next });
    },
    [config, setConfig]
  );

  const removeWidget = useCallback(
    (id: string) => {
      setConfig({
        ...config,
        widgets: config.widgets.filter((w) => w.id !== id),
      });
    },
    [config, setConfig]
  );

  const addWidget = useCallback(
    (widget: DashboardWidgetConfig) => {
      setConfig({
        ...config,
        widgets: [...config.widgets, widget],
      });
      setAddingType(null);
    },
    [config, setConfig]
  );

  const resetToDefault = useCallback(() => {
    setConfig(getDefaultDashboardConfig());
  }, [setConfig]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Configure dashboard
          </DialogTitle>
          <DialogDescription>
            Add, remove, or reorder widgets. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Widget order
          </p>
          <ul className="space-y-1 rounded-md border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {config.widgets.map((w, i) => (
              <li
                key={w.id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveWidget(i, "up")}
                    disabled={i === 0}
                    className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidget(i, "down")}
                    disabled={i === config.widgets.length - 1}
                    className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <GripVertical className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span className="flex-1 truncate">{widgetLabel(w)}</span>
                {!isBuiltInWidget(w) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-[var(--muted-foreground)] hover:text-red-600"
                    onClick={() => removeWidget(w.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {addingType === null ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Add widget
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--border)]"
                onClick={() => setAddingType("project_card")}
              >
                <Folder className="h-3.5 w-3.5" />
                Project card
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--border)]"
                onClick={() => setAddingType("project_group")}
              >
                <List className="h-3.5 w-3.5" />
                Project group
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--border)]"
                onClick={() => setAddingType("task_list")}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Task list
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[var(--border)]"
                onClick={() => setAddingType("chart")}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Chart
              </Button>
            </div>
          </div>
        ) : (
          <AddWidgetForm
            type={addingType}
            projects={projects}
            groups={groups}
            teams={teams}
            onAdd={addWidget}
            onCancel={() => setAddingType(null)}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={resetToDefault} className="border-[var(--border)]">
            Reset to default
          </Button>
          <Button onClick={onClose} className="bg-[var(--primary)]">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddWidgetForm({
  type,
  projects,
  groups,
  teams,
  onAdd,
  onCancel,
}: {
  type: "project_card" | "project_group" | "task_list" | "chart";
  projects: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  onAdd: (w: DashboardWidgetConfig) => void;
  onCancel: () => void;
}) {
  if (type === "project_card") {
    return (
      <AddProjectCardForm
        projects={projects}
        onAdd={onAdd as (w: ProjectCardWidgetConfig) => void}
        onCancel={onCancel}
      />
    );
  }
  if (type === "project_group") {
    return (
      <AddProjectGroupForm
        groups={groups}
        teams={teams}
        onAdd={onAdd as (w: ProjectGroupWidgetConfig) => void}
        onCancel={onCancel}
      />
    );
  }
  if (type === "task_list") {
    return (
      <AddTaskListForm
        onAdd={onAdd as (w: TaskListWidgetConfig) => void}
        onCancel={onCancel}
      />
    );
  }
  return (
    <AddChartForm
      projects={projects}
      onAdd={onAdd as (w: ChartWidgetConfig) => void}
      onCancel={onCancel}
    />
  );
}

function AddProjectCardForm({
  projects,
  onAdd,
  onCancel,
}: {
  projects: Array<{ id: string; name: string }>;
  onAdd: (w: ProjectCardWidgetConfig) => void;
  onCancel: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <p className="text-sm font-medium">Add project card</p>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
      >
        <option value="">Select project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="border-[var(--border)]">
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-[var(--primary)]"
          disabled={!projectId}
          onClick={() =>
            projectId &&
            onAdd({
              id: generateWidgetId(),
              type: "project_card",
              projectId,
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function AddProjectGroupForm({
  groups,
  teams,
  onAdd,
  onCancel,
}: {
  groups: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  onAdd: (w: ProjectGroupWidgetConfig) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ProjectGroupFilterKind>("status");
  const [value, setValue] = useState("");
  const [view, setView] = useState<ProjectGroupView>("compact_list");
  const valueOptions =
    kind === "status"
      ? ["not_started", "in_progress", "complete"]
      : kind === "initiative"
        ? groups
        : kind === "team"
          ? teams
          : [];

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <p className="text-sm font-medium">Add project group</p>
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Filter</label>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as ProjectGroupFilterKind);
            setValue("");
          }}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {(Object.entries(PROJECT_GROUP_FILTER_LABELS) as [ProjectGroupFilterKind, string][]).map(
            ([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            )
          )}
        </select>
      </div>
      {(kind === "status" || kind === "initiative" || kind === "team") && (
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Value</label>
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">
              {kind === "status" ? "Any" : `Select ${kind}`}
            </option>
            {kind === "status" &&
              valueOptions.map((v) => (
                <option key={v} value={v}>
                  {STATUS_LABELS[v] ?? v}
                </option>
              ))}
            {(kind === "initiative" || kind === "team") &&
              valueOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">View</label>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as ProjectGroupView)}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {(Object.entries(VIEW_LABELS) as [ProjectGroupView, string][]).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="border-[var(--border)]">
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-[var(--primary)]"
          onClick={() =>
            onAdd({
              id: generateWidgetId(),
              type: "project_group",
              filter: { kind, value: value || undefined },
              view,
              limit: 10,
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function AddTaskListForm({
  onAdd,
  onCancel,
}: {
  onAdd: (w: TaskListWidgetConfig) => void;
  onCancel: () => void;
}) {
  const [filter, setFilter] = useState<TaskWidgetFilter>("due_soon");
  const [limit, setLimit] = useState(10);
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <p className="text-sm font-medium">Add task list</p>
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Show</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TaskWidgetFilter)}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {(Object.entries(TASK_FILTER_LABELS) as [TaskWidgetFilter, string][]).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Max items</label>
        <input
          type="number"
          min={3}
          max={30}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 10)}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="border-[var(--border)]">
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-[var(--primary)]"
          onClick={() =>
            onAdd({
              id: generateWidgetId(),
              type: "task_list",
              filter,
              limit,
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}

const CHART_TYPE_LABELS: Record<DashboardChartQuery["chartType"], string> = {
  pie: "Pie chart",
  bar: "Bar chart",
  doughnut: "Doughnut chart",
};

const BREAKDOWN_LABELS: Record<DashboardChartQuery["breakdownField"], string> = {
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  tags: "Tags",
};

function AddChartForm({
  projects,
  onAdd,
  onCancel,
}: {
  projects: Array<{ id: string; name: string }>;
  onAdd: (w: ChartWidgetConfig) => void;
  onCancel: () => void;
}) {
  const [chartType, setChartType] = useState<DashboardChartQuery["chartType"]>("pie");
  const [scope, setScope] = useState<"workspace" | "project">("workspace");
  const [projectId, setProjectId] = useState("");
  const [breakdownField, setBreakdownField] = useState<DashboardChartQuery["breakdownField"]>("status");
  const [title, setTitle] = useState("");
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <p className="text-sm font-medium">Add chart</p>
      <p className="text-xs text-[var(--muted-foreground)]">
        Generate a chart from your tasks (same data as AI charts). Choose type, scope, and what to group by.
      </p>
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Chart type</label>
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as DashboardChartQuery["chartType"])}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {(Object.entries(CHART_TYPE_LABELS) as [DashboardChartQuery["chartType"], string][]).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Data scope</label>
        <select
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as "workspace" | "project");
            if (e.target.value !== "project") setProjectId("");
          }}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="workspace">All workspace tasks</option>
          <option value="project">Tasks in a project</option>
        </select>
      </div>
      {scope === "project" && (
        <div>
          <label className="text-xs text-[var(--muted-foreground)]">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Group by</label>
        <select
          value={breakdownField}
          onChange={(e) => setBreakdownField(e.target.value as DashboardChartQuery["breakdownField"])}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {(Object.entries(BREAKDOWN_LABELS) as [DashboardChartQuery["breakdownField"], string][]).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-[var(--muted-foreground)]">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Tasks by status"
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="border-[var(--border)]">
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-[var(--primary)]"
          disabled={scope === "project" && !projectId}
          onClick={() => {
            const query: DashboardChartQuery = {
              chartType,
              scope,
              projectId: scope === "project" && projectId ? projectId : null,
              breakdownField,
              title: title || null,
            };
            onAdd({
              id: generateWidgetId(),
              type: "chart",
              query,
            });
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
