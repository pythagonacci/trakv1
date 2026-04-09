# Dashboard Home Page — Context Gather (Redesign Reference)
Generated for dashboard home redesign. Repository root for paths: `trak/`.

---

## 1. Full `src/app/dashboard/dashboard-overview.tsx`

```tsx
"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ArrowRight,
  Flag,
  Calendar,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseDateSafe } from "@/lib/due-date";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import { useDashboardConfig } from "./use-dashboard-config";
import {
  isBuiltInWidget,
  isProjectCardWidget,
  isProjectGroupWidget,
  isTaskListWidget,
  isChartWidget,
} from "./dashboard-config-types";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import AIOverviewBlock from "./ai-overview-block";
import DashboardProjectCard from "./widgets/dashboard-project-card";
import DashboardProjectGroup from "./widgets/dashboard-project-group";
import DashboardTaskWidget from "./widgets/dashboard-task-widget";
import DashboardChartWidget from "./widgets/dashboard-chart-widget";
import type { DashboardInsight } from "@/app/actions/dashboard-insights";

interface Project {
  id: string;
  name: string;
  status: string;
  project_type: string;
  updated_at: string;
}

interface Doc {
  id: string;
  title: string;
  updated_at: string;
}

interface Task {
  id: string;
  text: string;
  projectName: string;
  tabName: string;
  projectId?: string | null;
  tabId?: string | null;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  dueDate?: string;
  dueTime?: string;
  /** When set, navigate to this URL instead of project/tab?taskId= */
  sourceUrl?: string;
}

interface DashboardOverviewProps {
  projects: Project[];
  docs: Doc[];
  tasks: Task[];
  /** Items with due dates from everything (tasks, timeline, table rows, blocks) for Due today / Upcoming / Past due blocks */
  dueAwareItems?: Array<{
    id: string;
    text: string;
    projectName: string;
    tabName: string;
    projectId: string | null;
    tabId: string | null;
    priority: string | null;
    dueDate: string;
    sourceUrl: string;
    type: string;
  }>;
  workspaceId: string;
  clientFeedback: ClientFeedback[];
  teamUpdates: ClientFeedback[];
  aiInsights?: DashboardInsight | null;
  userId: string;
  userName?: string;
}

interface ClientFeedback {
  id: string;
  text: string;
  author: string;
  projectName: string;
  tabName: string;
  projectId?: string | null;
  tabId?: string | null;
  blockId: string;
  timestamp?: string;
}

export default function DashboardOverview(props: DashboardOverviewProps) {
  const {
    tasks,
    dueAwareItems = [],
    clientFeedback,
    teamUpdates,
    aiInsights,
    workspaceId,
    userId,
    userName,
  } = props;
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { config: dashboardConfig } = useDashboardConfig(workspaceId);

  const clientFeedbackItems = clientFeedback.slice(0, 4);
  const teamUpdatesItems = teamUpdates.slice(0, 6);

  const { pastDueTasks, dueTodayTasks, upcomingTasks } = useMemo((): {
    pastDueTasks: Task[];
    dueTodayTasks: Task[];
    upcomingTasks: Task[];
  } => {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    const todayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pastDue: Task[] = [];
    const dueToday: Task[] = [];
    const upcoming: Task[] = [];

    const itemsToBucket = dueAwareItems.length > 0
      ? dueAwareItems.map((item) => ({
          id: item.id,
          text: item.text,
          projectName: item.projectName,
          tabName: item.tabName,
          projectId: item.projectId,
          tabId: item.tabId,
          priority: (item.priority as Task["priority"]) ?? undefined,
          dueDate: item.dueDate,
          dueTime: undefined,
          sourceUrl: item.sourceUrl,
        }))
      : tasks.map((t) => ({ ...t, sourceUrl: undefined }));

    for (const task of itemsToBucket) {
      const due = task.dueDate?.slice(0, 10);
      if (!due) {
        upcoming.push(task);
        continue;
      }
      if (due < todayStr) pastDue.push(task);
      else if (due === todayStr) dueToday.push(task);
      else upcoming.push(task);
    }
    return { pastDueTasks: pastDue, dueTodayTasks: dueToday, upcomingTasks: upcoming };
  }, [tasks, dueAwareItems]);
  const formatRelativeTime = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };


  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null;
    const date = parseDateSafe(dueDate);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    let dateLabel = "";
    if (taskDate.getTime() === today.getTime()) {
      dateLabel = "Today";
    } else if (taskDate.getTime() === tomorrow.getTime()) {
      dateLabel = "Tomorrow";
    } else {
      dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    if (dueTime) {
      const time = new Date(`2000-01-01T${dueTime}`);
      const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${dateLabel} ${timeStr}`;
    }
    return dateLabel;
  };

  const getPriorityColor = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "text-[var(--priority-urgent-text)] bg-[var(--priority-urgent-bg)] border border-[var(--priority-urgent-text)]/20";
      case "high": return "text-[var(--priority-high-text)] bg-[var(--priority-high-bg)] border border-[var(--priority-high-text)]/20";
      case "medium": return "text-[var(--priority-medium-text)] bg-[var(--priority-medium-bg)] border border-[var(--priority-medium-text)]/20";
      case "low": return "text-[var(--priority-low-text)] bg-[var(--priority-low-bg)] border border-[var(--priority-low-text)]/20";
      default: return "";
    }
  };

  const getPriorityLabel = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "None";
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10 px-6 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl">
            {currentWorkspace?.name ?? "Workspace"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Get Up to Speed and Start Working
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => router.push("/dashboard/projects")}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--secondary)] hover:bg-[var(--secondary)]/90 rounded-[2px] transition-colors"
          >
            New project
          </button>
        </div>
      </div>

      {dashboardConfig.widgets.map((widget) => {
        if (isBuiltInWidget(widget)) {
          if (widget.type === "notifications") {
            return (
              <NotificationsCard
                key={widget.id}
                clientFeedbackItems={clientFeedbackItems}
                teamUpdatesItems={teamUpdatesItems}
                formatRelativeTime={formatRelativeTime}
                onNavigate={(projectId, tabId, projectName, tabName) => {
                  if (projectId && tabId && projectName && tabName) {
                    router.push(buildProjectTabPath(projectId, tabId, projectName, tabName));
                  }
                }}
              />
            );
          }
          if (widget.type === "ai_overview") {
            return (
              <AIOverviewBlock
                key={widget.id}
                insights={aiInsights ?? null}
                workspaceId={workspaceId}
                userId={userId}
                userName={userName}
              />
            );
          }
          if (widget.type === "today") {
            return (
              <Card key={widget.id} className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <div>
                    <CardTitle className="text-[15px] font-medium text-[var(--foreground)]">Today</CardTitle>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      What matters now and coming up.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => router.push("/dashboard/projects")}>
                    View all
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3 px-4 pb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }}
                      />
                      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--primary)" }}>
                        Due today
                      </p>
                    </div>
                    {dueTodayTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {dueTodayTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            accent="var(--primary)"
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing due today.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }}
                      />
                      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--success)" }}>
                        Upcoming
                      </p>
                    </div>
                    {upcomingTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {upcomingTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            accent="var(--success)"
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing upcoming.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--error)", flexShrink: 0 }}
                      />
                      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--error)" }}>
                        Past due
                      </p>
                    </div>
                    {pastDueTasks.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {pastDueTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            accent="var(--error)"
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => {
                              if (task.sourceUrl) router.push(task.sourceUrl);
                              else if (task.projectId && task.tabId && task.projectName && task.tabName) {
                                router.push(
                                  `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                                );
                              }
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">No past due tasks.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        }
        if (isProjectCardWidget(widget)) {
          return <DashboardProjectCard key={widget.id} config={widget} workspaceId={workspaceId} />;
        }
        if (isProjectGroupWidget(widget)) {
          return <DashboardProjectGroup key={widget.id} config={widget} workspaceId={workspaceId} />;
        }
        if (isTaskListWidget(widget)) {
          return (
            <DashboardTaskWidget
              key={widget.id}
              config={widget}
              tasks={tasks}
              dueAwareItems={dueAwareItems}
              userId={userId}
            />
          );
        }
        if (isChartWidget(widget)) {
          return <DashboardChartWidget key={widget.id} config={widget} />;
        }
        return null;
      })}
    </div>
  );
}

function TaskRowButton({
  task,
  getPriorityColor,
  getPriorityLabel,
  formatDueDate,
  onNavigate,
  accent,
}: {
  task: Task;
  getPriorityColor: (priority?: Task["priority"]) => string;
  getPriorityLabel: (priority?: Task["priority"]) => string;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  onNavigate: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onNavigate}
      className="w-full text-left text-xs transition hover:bg-[var(--surface-hover)] group"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `2.5px solid ${accent}`,
        borderRadius: "var(--radius-lg)",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-medium text-[12.5px] line-clamp-1 text-[var(--foreground)]">
          {task.text}
        </p>
        <span className="whitespace-nowrap text-[10.5px] text-[var(--tertiary-foreground)] shrink-0">
          {task.tabName}
        </span>
      </div>
      <p className="line-clamp-1 text-[10.5px] text-[var(--tertiary-foreground)] mb-2">
        {task.projectName}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium",
              getPriorityColor(task.priority)
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {getPriorityLabel(task.priority)}
          </span>
        )}
        {task.dueDate && (
          <span
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{
              background: "var(--surface-muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <Calendar className="h-2.5 w-2.5" />
            {formatDueDate(task.dueDate, task.dueTime)}
          </span>
        )}
      </div>
    </button>
  );
}

function NotificationsCard({
  clientFeedbackItems,
  teamUpdatesItems,
  formatRelativeTime,
  onNavigate,
}: {
  clientFeedbackItems: ClientFeedback[];
  teamUpdatesItems: ClientFeedback[];
  formatRelativeTime: (value?: string) => string;
  onNavigate: (
    projectId?: string | null,
    tabId?: string | null,
    projectName?: string,
    tabName?: string
  ) => void;
}) {
  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="h-4 w-4 text-[var(--foreground)]" />
          <CardTitle className="text-sm font-medium">Notifications</CardTitle>
          <span className="text-xs text-[var(--muted-foreground)]">
            Client and teammate updates in one place.
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-4 pb-4 pt-0 text-xs md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-[var(--foreground)]">
            Client Feedback
          </p>
          {clientFeedbackItems.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">No client feedback yet.</p>
          ) : (
            clientFeedbackItems.map((feedback) => (
              <UpdateRow
                key={feedback.id}
                title={`“${feedback.text}”`}
                subtitle={`${feedback.author} · ${feedback.projectName} · ${feedback.tabName} · ${formatRelativeTime(
                  feedback.timestamp
                )}`}
                icon={<MessageSquare className="h-3.5 w-3.5 text-[var(--foreground)]" />}
                onClick={() =>
                  onNavigate(feedback.projectId, feedback.tabId, feedback.projectName, feedback.tabName)
                }
              />
            ))
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-[var(--foreground)]">
            Team Updates
          </p>
          {teamUpdatesItems.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">No comments from teammates yet.</p>
          ) : (
            teamUpdatesItems.map((feedback) => (
              <UpdateRow
                key={feedback.id}
                title={`“${feedback.text}”`}
                subtitle={`${feedback.author} · ${feedback.projectName} · ${feedback.tabName} · ${formatRelativeTime(
                  feedback.timestamp
                )}`}
                icon={<MessageSquare className="h-3.5 w-3.5 text-[var(--foreground)]" />}
                onClick={() =>
                  onNavigate(feedback.projectId, feedback.tabId, feedback.projectName, feedback.tabName)
                }
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UpdateRowProps {
  title: string;
  subtitle: string;
  onClick?: () => void;
  icon?: ReactNode;
  priority?: Task["priority"];
  dueDate?: string;
  dueTime?: string;
  getPriorityColor?: (priority?: Task["priority"]) => string;
  getPriorityLabel?: (priority?: Task["priority"]) => string;
  formatDueDate?: (dueDate?: string, dueTime?: string) => string | null;
}

function UpdateRow({ 
  title, 
  subtitle, 
  onClick, 
  icon, 
  priority, 
  dueDate, 
  dueTime,
  getPriorityColor,
  getPriorityLabel,
  formatDueDate,
}: UpdateRowProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-2 rounded-[var(--radius-md)] border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30"
    >
      {icon ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--foreground)]">
          {icon}
        </span>
      ) : (
        <span className="flex h-3 w-3 flex-shrink-0 rounded-full border border-[var(--border)]" />
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)] line-clamp-1">{title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-[var(--muted-foreground)]">{subtitle}</p>
          {/* Priority Badge */}
          {priority && priority !== "none" && getPriorityColor && getPriorityLabel && (
            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${getPriorityColor(priority)}`}>
              <Flag className="h-2.5 w-2.5" />
              {getPriorityLabel(priority)}
            </span>
          )}
          {/* Due Date Badge */}
          {dueDate && formatDueDate && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              "border border-[var(--tile-orange)]/30 bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]"
            )}>
              <Calendar className="h-2.5 w-2.5" />
              {formatDueDate(dueDate, dueTime)}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

---

## 2. Full `src/app/dashboard/dashboard-client.tsx`

```tsx
"use client";

import { useDashboardData } from "@/lib/hooks/use-dashboard-queries";
import DashboardOverview from "./dashboard-overview";
import DashboardLoading from "./loading";
import DashboardConfigModal from "./dashboard-config-modal";

export default function DashboardClient({
    workspaceId,
}: {
    workspaceId: string;
}) {
    const { data, isLoading, error } = useDashboardData(workspaceId);

    if (isLoading) {
        return <DashboardLoading />;
    }

    if (error || !data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                        {error instanceof Error ? error.message : "An unknown error occurred"}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <DashboardOverview {...data} />
            <DashboardConfigModal workspaceId={workspaceId} />
        </>
    );
}
```

---

## 3. Notifications widget

Rendered when `widget.type === "notifications"`. Data: `clientFeedbackItems = clientFeedback.slice(0, 4)`; `teamUpdatesItems = teamUpdates.slice(0, 6)`. See **`NotificationsCard`** and **`UpdateRow`** in §1 (same file).

---

## 4. AI Overview widget

Mounted from `dashboard-overview.tsx` as `<AIOverviewBlock ... />`. Full UI in:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Info,
  ChevronDown,
} from "lucide-react";
import { refreshDashboardInsights } from "@/app/actions/dashboard-insights";
import type { DashboardInsight } from "@/app/actions/dashboard-insights";

// ============================================================================
// TYPES
// ============================================================================

interface AIOverviewBlockProps {
  insights: DashboardInsight | null;
  workspaceId: string;
  userId: string;
  userName?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isStale(isoDate: string): boolean {
  const date = new Date(isoDate);
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return hours > 6;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIOverviewBlock({
  insights: initialInsights,
  workspaceId,
  userId,
  userName,
}: AIOverviewBlockProps) {
  const [insights, setInsights] = useState(initialInsights);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);
  const refreshInFlight = useRef(false);
  const lastGeneratedAt = useRef<string | null>(
    initialInsights?.generatedAt ?? null
  );
  const intervalMs = 15 * 60 * 1000; // 15 minutes
  const staleThresholdMs = 5 * 60 * 1000; // consider stale after 5 min for visibility refresh

  // Handle regenerate button click
  const handleRegenerate = useCallback(() => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await refreshDashboardInsights(
          workspaceId,
          userId,
          userName
        );

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setInsights(result.data);
          lastGeneratedAt.current = result.data.generatedAt;
        }
      } catch (err) {
        setError(String(err));
      } finally {
        refreshInFlight.current = false;
      }
    });
  }, [startTransition, userId, userName, workspaceId]);

  // Keep last generated time in sync with state
  useEffect(() => {
    if (insights?.generatedAt) lastGeneratedAt.current = insights.generatedAt;
  }, [insights?.generatedAt]);

  // Periodic refresh every 15 min (only when tab is visible)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      handleRegenerate();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, handleRegenerate]);

  // Refresh when user returns to the tab if data is older than 5 min
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const at = lastGeneratedAt.current;
      if (!at) {
        handleRegenerate();
        return;
      }
      const age = Date.now() - new Date(at).getTime();
      if (age >= staleThresholdMs) handleRegenerate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [handleRegenerate, staleThresholdMs]);

  // Loading state during regeneration
  if (isPending) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)] animate-pulse">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded((e) => !e)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Sparkles className="h-5 w-5" />
              AI Overview
            </CardTitle>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="space-y-4">
              <div className="h-16 bg-[var(--muted)]/10 rounded" />
              <div className="h-16 bg-[var(--muted)]/10 rounded" />
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // No data yet (e.g. new workspace) — friendly empty state
  if (!insights && !error) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded((e) => !e)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Sparkles className="h-5 w-5" />
              AI Overview
            </CardTitle>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="h-8 w-8 text-[var(--muted-foreground)] mb-4" />
              <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-sm">
                Your workspace is new. Add some projects and tasks, then we&apos;ll generate an AI overview here.
              </p>
              <Button
                variant="outline"
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleRegenerate();
                }}
                disabled={isPending}
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // Error state (something went wrong)
  if (error || !insights) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded((e) => !e)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Sparkles className="h-5 w-5" />
              AI Overview
            </CardTitle>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-[var(--muted-foreground)] mb-4" />
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                {error ?? "Something went wrong. Try again."}
              </p>
              <Button
                variant="outline"
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleRegenerate();
                }}
                disabled={isPending}
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const stale = isStale(insights.generatedAt);

  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)]">
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Sparkles className="h-5 w-5 text-[var(--tile-orange)]" />
            AI Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRegenerate();
              }}
              disabled={isPending}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform shrink-0 ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-[var(--foreground)] leading-relaxed">
            {insights.summary}
          </p>
        </div>

        <div className="pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Generated by AI
            </span>
            <span className={stale ? "text-[var(--tram-yellow)]" : ""}>
              {formatRelativeTime(insights.generatedAt)}
              {stale && " (stale)"}
            </span>
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
```

---

## 5. Dashboard header / greeting (page content)

The home **content** header is **workspace name** (`currentWorkspace?.name ?? "Workspace"`), subtitle **"Get Up to Speed and Start Working"**, and a **New project** button. It is **not** “Good morning” (that text appears on the splash screen in `layout-client.tsx`).

---

## 6. Widget config system

### `src/app/dashboard/dashboard-config-types.ts` (full)

```ts
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
```

### `useDashboardConfig` + default order

- Storage key: `trak-dashboard-config-${workspaceId}` (`use-dashboard-config.ts`).
- Default widgets: `notifications` → `ai_overview` → `today` (`getDefaultDashboardConfig`).
- Render: `dashboardConfig.widgets.map` in `dashboard-overview.tsx`; built-ins handled first, then project card / group / task list / chart.

---

## 7. Full `src/app/dashboard/dashboard-config-modal.tsx`

```tsx
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
import { useWorkspaceBilling } from "@/hooks/use-workspace-billing";

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
  const { data: billingSummary } = useWorkspaceBilling(workspaceId);
  const [addingType, setAddingType] = useState<
    "project_card" | "project_group" | "task_list" | "chart" | null
  >(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);

  const open = modal?.isOpen ?? false;
  const canConfigureDashboard = billingSummary?.entitlements.allowDashboardConfiguration ?? false;
  const canUseWorkspaceScopeCharts = billingSummary?.entitlements.allowWorkspaceScopeCharts ?? false;
  const onClose = useCallback(() => {
    modal?.close();
    setAddingType(null);
  }, [modal]);

  React.useEffect(() => {
    if (!open || addingType === null) return;
    if (addingType === "project_card" || addingType === "project_group" || addingType === "chart") {
      getAllProjects(workspaceId, {}, {}).then((r) => {
        if ("data" in r && r.data) setProjects(r.data.map((p) => ({ id: p.id, name: p.name })));
      });
    }
    if (addingType === "project_group") {
      getAllInternalGroups(workspaceId).then((r) => {
        if ("data" in r && r.data) setGroups(r.data.map((g) => ({ id: g.id, name: g.name })));
      });
      getAllTeams(workspaceId).then((r) => {
        if ("data" in r && r.data) setTeams(r.data.map((t) => ({ id: t.id, name: t.name })));
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

  if (!canConfigureDashboard) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure dashboard</DialogTitle>
            <DialogDescription>
              Dashboard customization is available on Business only. Upgrade to unlock configurable widgets and workspace-wide analytics.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
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
          <ul className="space-y-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
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
              canUseWorkspaceScopeCharts={canUseWorkspaceScopeCharts}
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
  canUseWorkspaceScopeCharts,
  onAdd,
  onCancel,
}: {
  type: "project_card" | "project_group" | "task_list" | "chart";
  projects: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  canUseWorkspaceScopeCharts: boolean;
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
      canUseWorkspaceScopeCharts={canUseWorkspaceScopeCharts}
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
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
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
  const statusOptions: string[] = ["not_started", "in_progress", "complete"];
  const entityOptions: Array<{ id: string; name: string }> =
    kind === "initiative"
      ? groups
      : kind === "team"
        ? teams
        : [];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
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
              statusOptions.map((v) => (
                <option key={v} value={v}>
                  {STATUS_LABELS[v] ?? v}
                </option>
              ))}
            {(kind === "initiative" || kind === "team") &&
              entityOptions.map((p) => (
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
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
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
  canUseWorkspaceScopeCharts,
  onAdd,
  onCancel,
}: {
  projects: Array<{ id: string; name: string }>;
  canUseWorkspaceScopeCharts: boolean;
  onAdd: (w: ChartWidgetConfig) => void;
  onCancel: () => void;
}) {
  const [chartType, setChartType] = useState<DashboardChartQuery["chartType"]>("pie");
  const [scope, setScope] = useState<"workspace" | "project">(canUseWorkspaceScopeCharts ? "workspace" : "project");
  const [projectId, setProjectId] = useState("");
  const [breakdownField, setBreakdownField] = useState<DashboardChartQuery["breakdownField"]>("status");
  const [title, setTitle] = useState("");
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
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
          {canUseWorkspaceScopeCharts && <option value="workspace">All workspace tasks</option>}
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
```

---

## 8. Topbar (`Header`)

No separate file: **`Header`** is in `layout-client.tsx`. See §9 below (full file).

---

## 9. Sidebar + header + main shell

`Sidebar`, `Header`, `LayoutMain`, splash, and demo toast live in **one file** (not `src/app/dashboard/sidebar.tsx`). Full `layout-client.tsx`:

```tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  Users,
  BookOpen,
  FileText,
  ChevronDown,
  Check,
  LogOut,
  Loader2,
  Menu,
  X,
  Home,
  Calendar as CalendarIcon,
  Palette,
  Package,
  Square,
  Sparkles,
  Database,
  User,
  Settings,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./workspace-context";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import {
  DashboardHeaderProvider,
  useDashboardHeader,
} from "./header-visibility-context";
import { DashboardConfigModalProvider, useDashboardConfigModal } from "./dashboard-config-modal-context";
import GlobalSearch from "./global-search";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { AICommandPalette, useAI } from "@/components/ai";
import { useTheme } from "./theme-context";
import NotificationBell from "@/components/notifications/notification-bell";
import { OPEN_CREATE_PROJECT_EVENT } from "@/lib/projects";
import { useWorkspaceBilling } from "@/hooks/use-workspace-billing";
// DEMO (magic links): remove DemoUploadToastTrigger + related state when recording is done
import Toast from "@/app/dashboard/projects/toast";
import {
  createUnavailableSplashWeather,
  resolveSplashWeather,
  SPLASH_FADE_DURATION_MS,
  SPLASH_HIDE_DELAY_MS,
} from "./splash-screen";

interface User {
  id: string;
  email: string;
  name: string;
}

interface Workspace {
  id: string;
  name: string;
  role: string;
}

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { suppressInlineSidebar } = useAI();
  // Keep SSR and first client render identical to avoid hydration mismatch.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const pathname = usePathname();
  const wasProjectView = useRef<boolean | null>(null);
  const isFirstRender = useRef(true);

  const isProjectView =
    pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects";
  const isWorkflowRoute = pathname?.startsWith("/dashboard/workflow");

  const normalizedPathname = pathname?.replace(/\/$/, "") ?? "";
  const isProjectOverviewTab =
    normalizedPathname.startsWith("/dashboard/projects/") &&
    normalizedPathname !== "/dashboard/projects" &&
    normalizedPathname.endsWith("/overview");

  const [demoUploadToastOpen, setDemoUploadToastOpen] = useState(false);

  useEffect(() => {
    if (!isProjectOverviewTab) {
      setDemoUploadToastOpen(false);
    }
  }, [isProjectOverviewTab]);

  useEffect(() => {
    // After hydration, align with route-driven default once.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setSidebarCollapsed(isProjectView);
      wasProjectView.current = isProjectView;
      return;
    }
    if (wasProjectView.current !== true && isProjectView) {
      setSidebarCollapsed(true);
    }
    wasProjectView.current = isProjectView;
  }, [isProjectView]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <DashboardHeaderProvider>
      <DashboardConfigModalProvider>
      <div className="flex h-full bg-[var(--surface)] text-[var(--foreground)]">
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={toggleSidebar} />

        {isWorkflowRoute || suppressInlineSidebar ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <LayoutMain>{children}</LayoutMain>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <Header />
              <LayoutMain>{children}</LayoutMain>
            </div>
            <AICommandPalette />
          </div>
        )}

        {isProjectOverviewTab && demoUploadToastOpen && (
          <Toast
            message='Edward just uploaded "Final_Campaign_Shots.JPEG" in the Campaign Shoot tab.'
            type="success"
            duration={6000}
            onClose={() => setDemoUploadToastOpen(false)}
            action={{ label: "View Upload", href: "#" }}
          />
        )}
        {isProjectOverviewTab ? (
          <button
            type="button"
            onClick={() => {
              setDemoUploadToastOpen(false);
              requestAnimationFrame(() => setDemoUploadToastOpen(true));
            }}
            className="pointer-events-auto fixed bottom-2 left-2 z-[90] inline-flex h-auto w-max max-w-none shrink-0 whitespace-nowrap rounded-[2px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-1 py-px text-[8px] font-medium uppercase leading-none tracking-tight text-[var(--muted-foreground)] shadow-sm hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            title="Temporary control for magic-links demo recording"
          >
            Demo: upload toast
          </button>
        ) : null}
      </div>
      </DashboardConfigModalProvider>
    </DashboardHeaderProvider>
  );
}

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { data: currentUser, isLoading } = useUser();
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [weather, setWeather] = useState<{
    tempF: number | null;
    location: string | null;
    summary: string | null;
    resolved: boolean;
  }>({
    tempF: null,
    location: null,
    summary: null,
    resolved: false,
  });

  useEffect(() => {
    if (resolvedName) return;
    if (!isLoading && currentUser?.name) {
      setResolvedName(normalizeName(currentUser.name));
    }
  }, [currentUser, isLoading, resolvedName]);

  useEffect(() => {
    if (resolvedName) return;
    const fallbackTimer = setTimeout(() => {
      setResolvedName(normalizeName(currentUser?.name || "there"));
    }, 700);
    return () => clearTimeout(fallbackTimer);
  }, [currentUser, resolvedName]);

  const name = resolvedName || "there";
  const greeting = `Good Morning, ${name}`;

  useEffect(() => {
    if (!resolvedName) return;
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setTypedText(greeting.slice(0, index));
      if (index >= greeting.length) {
        clearInterval(interval);
        setTypingDone(true);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [greeting, resolvedName]);

  useEffect(() => {
    let cancelled = false;
    void resolveSplashWeather({
      geolocation: navigator.geolocation,
      loadWeather: async ({ latitude, longitude }) => {
        try {
          const weatherRes = await fetch(
            `/api/weather?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`
          );
          if (!weatherRes.ok) {
            throw new Error("Weather lookup failed");
          }
          const weatherJson = await weatherRes.json();

          const temp = typeof weatherJson?.tempF === "number"
            ? Math.round(weatherJson.tempF)
            : null;
          const wind = typeof weatherJson?.windMph === "number"
            ? weatherJson.windMph
            : null;
          const code = typeof weatherJson?.code === "number"
            ? weatherJson.code
            : null;

          return {
            tempF: temp,
            location:
              typeof weatherJson?.location === "string" && weatherJson.location.trim().length > 0
                ? weatherJson.location
                : "Location unavailable",
            summary: describeWeather(code, wind),
          };
        } catch {
          return createUnavailableSplashWeather("Weather unavailable");
        }
      },
      mapGeolocationError: geolocationErrorSummary,
    }).then((nextWeather) => {
      if (cancelled) return;
      setWeather({
        ...nextWeather,
        resolved: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!typingDone || !weather.resolved) return;

    let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
    const hideTimer = setTimeout(() => {
      setIsHiding(true);
      finalizeTimer = setTimeout(() => {
        onFinish();
      }, SPLASH_FADE_DURATION_MS);
    }, SPLASH_HIDE_DELAY_MS);

    return () => {
      clearTimeout(hideTimer);
      if (finalizeTimer) clearTimeout(finalizeTimer);
    };
  }, [typingDone, weather.resolved, onFinish]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]",
        "transition-opacity duration-300",
        isHiding ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight">
          {typedText}
          {!typingDone && <span className="inline-block w-[0.6ch] animate-pulse">|</span>}
        </div>
        <div className="text-sm md:text-base text-[var(--muted-foreground)]">
          | {weather.tempF ?? "--"}°F | {weather.location || "Locating..."} | {weather.summary || "Fetching weather..."} |
        </div>
      </div>
    </div>
  );
}

function geolocationErrorSummary(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access denied";
    case error.POSITION_UNAVAILABLE:
      return "Position unavailable";
    case error.TIMEOUT:
      return "Location lookup timed out";
    default:
      return "Location unavailable";
  }
}

function describeWeather(code: number | null, windMph: number | null) {
  const base = weatherCodeSummary(code);
  if (windMph == null) return base;
  if (windMph < 6) return `${base} with calm air`;
  if (windMph < 12) return `${base} with light breeze`;
  if (windMph < 20) return `${base} with steady breeze`;
  return `${base} with gusty winds`;
}

function weatherCodeSummary(code: number | null) {
  switch (code) {
    case 0:
      return "Clear skies";
    case 1:
    case 2:
      return "Mostly sunny";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Foggy";
    case 51:
    case 53:
    case 55:
      return "Light drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
    case 63:
      return "Light rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
    case 73:
      return "Light snow";
    case 75:
      return "Heavy snow";
    case 77:
      return "Snow grains";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorms";
    case 96:
    case 99:
      return "Thunderstorms with hail";
    default:
      return "Mixed conditions";
  }
}

function normalizeName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "There";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function AICommandButton({ collapsed }: { collapsed: boolean }) {
  const { openCommandPalette } = useAI();

  return (
    <div className={cn("px-2 pt-2 pb-2", collapsed && "flex justify-center")}>
      <button
        onClick={openCommandPalette}
        className={cn(
          "flex items-center rounded-[var(--radius-md)] transition-all duration-150",
          "bg-[var(--primary)] text-[var(--primary-foreground)]",
          "hover:bg-[var(--primary-hover)]",
          collapsed
            ? "h-7 w-7 justify-center shrink-0"
            : "w-full gap-3 px-3 py-1.5"
        )}
        title="Ask AI (⌘K)"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--primary-foreground)]">
          <Sparkles className="h-4 w-4" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-sm font-medium text-[var(--primary-foreground)]">Ask AI</span>
            <kbd className="rounded-[var(--radius-sm)] bg-[var(--primary-foreground)]/15 px-1.5 py-0.5 text-[10px] font-mono text-[var(--primary-foreground)]">
              ⌘K
            </kbd>
          </>
        )}
      </button>
    </div>
  );
}

function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { data: currentUser } = useUser();
  const { currentWorkspace, workspaces, switchWorkspace, isSwitching } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const { theme, setTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = (name?: string | null) => {
    if (!name) return "W";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserInitials = () => {
    if (!currentUser || !currentUser.name) return "U";
    return currentUser.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleWorkspaceSwitch = async (workspace: Workspace) => {
    await switchWorkspace(workspace);
    setUserDropdownOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside
      className={cn(
        "relative z-50 flex h-full flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-all duration-200 ease-out",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center py-3",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--foreground)]">
            Saria
          </span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCollapsed();
          }}
          type="button"
          className="relative z-50 inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-3">
            <GlobalSearch />
          </div>
        )}

        {/* AI Command Button */}
        <AICommandButton collapsed={collapsed} />

        <nav className={cn("space-y-0.5 px-2", collapsed ? "pt-2" : "pt-2 pb-2")}
        >
          <NavLink
            href="/dashboard"
            icon={<Home className="h-4 w-4" />}
            active={pathname === "/dashboard"}
            collapsed={collapsed}
          >
            Home
          </NavLink>
          <NavLink
            href="/dashboard/projects"
            icon={<Folder className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/projects")}
            collapsed={collapsed}
          >
            Projects
          </NavLink>
          {billingSummary?.entitlements.allowEverythingPage && (
            <NavLink
              href="/dashboard/workspace/everything"
              icon={<Database className="h-4 w-4" />}
              active={pathname?.startsWith("/dashboard/workspace/everything")}
              collapsed={collapsed}
            >
              Everything
            </NavLink>
          )}
          <NavLink
            href="/dashboard/workflow"
            icon={<Square className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/workflow")}
            collapsed={collapsed}
          >
            Workflow
          </NavLink>
          <NavLink
            href="/dashboard/clients"
            icon={<Users className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/clients")}
            collapsed={collapsed}
          >
            Clients
          </NavLink>
          <NavLink
            href="/dashboard/internal"
            icon={<BookOpen className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/internal")}
            collapsed={collapsed}
          >
            Internal
          </NavLink>
          <NavLink
            href="/dashboard/docs"
            icon={<FileText className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/docs")}
            collapsed={collapsed}
          >
            Docs
          </NavLink>
          <NavLink
            href="/dashboard/calendar"
            icon={<CalendarIcon className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/calendar")}
            collapsed={collapsed}
          >
            Calendar
          </NavLink>
          <NavLink
            href="/dashboard/shopify/products"
            icon={<Package className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/shopify/products")}
            collapsed={collapsed}
          >
            Products
          </NavLink>
          <NavLink
            href="/dashboard/settings"
            icon={<Settings className="h-4 w-4" />}
            active={pathname?.startsWith("/dashboard/settings")}
            collapsed={collapsed}
          >
            Settings
          </NavLink>
        </nav>
      </div>

      {/* Theme toggle – Sarajevo light / dark */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        {collapsed ? (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : "default")}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <Palette className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setTheme(theme === "default" ? "dark" : "default")}
            className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Palette className="h-3.5 w-3.5" />
            <span className="text-xs font-medium text-[var(--foreground)]">
              Theme: {theme === "dark" ? "Dark" : "Light"}
            </span>
          </button>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-3" ref={userDropdownRef}>
        {collapsed ? (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] text-xs font-semibold transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {getUserInitials()}
          </button>
        ) : (
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] text-xs font-semibold">
                {getUserInitials()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{currentUser?.name || "User"}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{currentUser?.email}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform duration-150",
                userDropdownOpen && "rotate-180"
              )}
            />
          </button>
        )}

        {userDropdownOpen && (
          <div className="mt-2 space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {/* Workspace switcher */}
            {workspaces.length > 0 && (
              <div className="space-y-1">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSwitch(workspace)}
                    disabled={isSwitching}
                    className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] bg-[var(--river-indigo)]/15 border border-[var(--river-indigo)]/20 text-[var(--river-indigo)] text-xs font-semibold">
                      {isSwitching && currentWorkspace?.id === workspace.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        getInitials(workspace.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold text-[var(--foreground)]">{workspace.name}</p>
                      <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                        {workspace.role}
                      </p>
                    </div>
                    {currentWorkspace?.id === workspace.id && <Check className="h-3.5 w-3.5 text-[var(--dome-teal)]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* View All Workspaces */}
            <Link
              href="/profile"
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              onClick={() => setUserDropdownOpen(false)}
            >
              <User className="h-3.5 w-3.5" />
              View All Workspaces
            </Link>

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  children,
  active,
  collapsed,
  prefetch,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        "group flex w-full items-center rounded-[var(--radius-md)] border-l-[2.5px] border-l-transparent text-base transition-colors duration-150",
        collapsed ? "justify-center px-2 py-1.5" : "gap-3 px-3 py-1.5",
        active
          ? "border-l-[var(--primary)] bg-[var(--surface)] font-medium text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
      )}
      title={collapsed ? (children as string) : undefined}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-150",
          active
            ? "text-[var(--nav-icon-active)]"
            : "text-[var(--nav-icon)] group-hover:text-[var(--nav-icon-active)]"
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate font-medium">{children}</span>}
    </Link>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatHeaderDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  return `${weekday}, ${month} ${day}${getOrdinalSuffix(day)}`;
}

function normalizeUserName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function Header() {
  const pathname = usePathname();
  const { data: currentUser, isLoading } = useUser();
  const { headerHidden } = useDashboardHeader();
  const configModal = useDashboardConfigModal();
  const { currentWorkspace } = useWorkspace();
  const { data: billingSummary } = useWorkspaceBilling(currentWorkspace?.id);
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");
  const isCalendarPage = pathname?.startsWith("/dashboard/calendar");
  const isDashboardHome = pathname === "/dashboard";
  const isProjectsPage = pathname === "/dashboard/projects";
  const isProjectOrClientDetail =
    (pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects") ||
    (pathname?.startsWith("/dashboard/clients/") && pathname !== "/dashboard/clients");
  const hideBar = headerHidden || isWorkflowPage || isCalendarPage || isProjectOrClientDetail;

  if (hideBar) return null;

  const rawName = isLoading ? "…" : (currentUser?.name || "User");
  const displayName = rawName === "…" ? rawName : normalizeUserName(rawName);
  const displayDate = formatHeaderDate(new Date());

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--header-bar-bg)] px-2 py-2 md:px-3 lg:px-4">
      <p className="text-sm text-[var(--header-bar-text)]">
        <span className="font-medium">{displayName}</span>
        <span className="mx-2 opacity-70">|</span>
        <span className="opacity-90">{displayDate}</span>
      </p>
      <div className="flex items-center gap-2">
        <NotificationBell workspaceId={currentWorkspace?.id} />
        {isDashboardHome && configModal && billingSummary?.entitlements.allowDashboardConfiguration && (
          <Button
            size="sm"
            variant="outline"
            className="border-[var(--border)] text-[var(--header-bar-text)] hover:bg-[var(--surface-hover)]"
            onClick={() => configModal.open()}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Configure dashboard
          </Button>
        )}
        {isProjectsPage ? (
          <Button
            size="sm"
            className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_PROJECT_EVENT))}
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        ) : (
          <Link href="/dashboard/projects">
            <Button
              size="sm"
              className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { headerHidden } = useDashboardHeader();
  const isWorkflowPage = pathname?.startsWith("/dashboard/workflow");
  const isWorkflowCanvas = pathname?.match(/^\/dashboard\/workflow\/[^/]+$/);
  const isCalendarPage = pathname?.startsWith("/dashboard/calendar");
  const isProjectOrClientDetail =
    (pathname?.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects") ||
    (pathname?.startsWith("/dashboard/clients/") && pathname !== "/dashboard/clients");
  const isFullBleedPage =
    pathname?.startsWith("/dashboard/settings") ||
    pathname?.startsWith("/dashboard/workspace/everything") ||
    pathname?.startsWith("/dashboard/shopify/products") ||
    isProjectOrClientDetail;

  return (
    <main
      id="dashboard-content"
      className={cn(
        "flex-1 min-h-0 bg-[var(--surface)]",
        isProjectOrClientDetail && "flex flex-col",
        isFullBleedPage ? "px-0" : "px-2 md:px-3 lg:px-4",
        isWorkflowCanvas || isCalendarPage ? "overflow-hidden py-0" : "overflow-y-auto",
        headerHidden || isWorkflowPage || isCalendarPage || isProjectOrClientDetail ? "py-0" : "py-4 lg:py-5"
      )}
    >
      {isProjectOrClientDetail ? (
        <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
      ) : (
        children
      )}
    </main>
  );
}
```

---

## 10. Root dashboard layout

```tsx
import DashboardLayoutClient from "./layout-client";
import { WorkspaceProvider } from "./workspace-context";
import { ThemeProvider } from "./theme-context";
import { ReactQueryProvider } from "@/lib/react-query/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { AIProvider } from "@/components/ai";

/**
 * Optimized Dashboard Layout - No server-side data fetching
 * All data is loaded client-side with React Query for instant navigation
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ReactQueryProvider>
          <WorkspaceProvider>
            <AIProvider>
              <DashboardLayoutClient>
                {children}
              </DashboardLayoutClient>
            </AIProvider>
          </WorkspaceProvider>
        </ReactQueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

---

## 11. Shared layout wrappers

`DashboardLayoutClient` composes sidebar + header + `LayoutMain`. No `DashboardShell` / `AppLayout` symbols in the repo.

---

## 12. `src/app/dashboard/theme-context.tsx` (full) + theme toggle

```tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// Theme types:
// - "default": Sarajevo light theme
// - "dark": Sarajevo dark theme (layered charcoals, low-glare)
type Theme = "default" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean; // Helper to check if current theme is dark
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_THEMES: Theme[] = ["default", "dark"];
const ALL_THEME_CLASSES = ["default", "dark", "brutalist"] as const;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("default");
  const [isMounted, setIsMounted] = useState(false);

  // Load theme from localStorage and apply on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setIsMounted(true);
    
    const savedTheme = localStorage.getItem("trak-theme") as Theme | null;
    const initialTheme = VALID_THEMES.includes(savedTheme as Theme) ? (savedTheme as Theme) : "default";
    
    // Apply theme immediately
    const html = document.documentElement;
    ALL_THEME_CLASSES.forEach((t) => html.classList.remove(t));
    html.classList.add(initialTheme);
    
    setThemeState(initialTheme);
  }, []);

  // Apply theme class to html element when theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !isMounted) return;
    
    const html = document.documentElement;
    
    // Remove all known theme classes (including legacy dark/brutalist)
    ALL_THEME_CLASSES.forEach((t) => html.classList.remove(t));
    
    // Add current theme class (Sarajevo)
    html.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem("trak-theme", theme);
  }, [theme, isMounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

const fallbackThemeContext: ThemeContextType = {
  theme: "default",
  setTheme: () => {},
  isDark: false,
};

// Use this in components that can render outside a ThemeProvider (e.g., public pages).
export function useThemeOptional() {
  const context = useContext(ThemeContext);
  return context ?? fallbackThemeContext;
}
```

**Theme toggle:** `Sidebar` in `layout-client.tsx`, block comment `{/* Theme toggle – Sarajevo light / dark */}` — `Palette` button; `onClick={() => setTheme(theme === "default" ? "dark" : "default")}` (collapsed vs expanded variants). See §9.

---

## 13. Dashboard home — shadcn `Card` usage

| File | Import | Subcomponents |
|------|--------|---------------|
| `dashboard-overview.tsx` | `@/components/ui/card` | Card, CardContent, CardHeader, CardTitle |
| `ai-overview-block.tsx` | `@/components/ui/card` | Card, CardContent, CardHeader, CardTitle |
| `widgets/dashboard-project-card.tsx` | `@/components/ui/card` | Card, CardContent, CardHeader, CardTitle |
| `widgets/dashboard-project-group.tsx` | `@/components/ui/card` | Card, CardContent, CardHeader, CardTitle |
| `widgets/dashboard-task-widget.tsx` | `@/components/ui/card` | Card, CardContent, CardHeader, CardTitle |

`widgets/dashboard-chart-widget.tsx` does not use `Card`.

---

## 14. `src/app/globals.css` — after `:root` and `.dark` (from `*` rule through file end)

The `.brutalist` block (lines 164–191) sits between `.dark` and this slice in the source file.

```css
  * {
    border-color: var(--border);
  }

  /* In dark mode, make structural lines feel slightly bolder */
  @layer utilities {
    .dark * {
      border-width: 1.5px;
    }
  }

  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
    @apply antialiased transition-colors duration-200 ease-out;
    font-feature-settings: "rlig" 1, "calt" 1;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.6;
  }

  /* App-wide zoom scale - adjust to zoom in/out (smaller = more zoomed out) */
  #app-scale-wrapper {
    --zoom-scale: 0.935;
    position: fixed;
    top: 0;
    left: 0;
    width: calc(100vw / var(--zoom-scale));
    height: calc(100vh / var(--zoom-scale));
    transform: scale(var(--zoom-scale));
    transform-origin: top left;
    overflow: hidden;
  }

  /* Ensure all children of the scale wrapper fill height */
  #app-scale-wrapper > * {
    height: 100%;
  }


  /* Headings - Use Inter for consistency */
  h1 {
    font-family: var(--font-sans);
    @apply text-[26px] font-semibold text-[var(--foreground)] leading-tight tracking-tight;
  }

  h2 {
    font-family: var(--font-sans);
    @apply text-[22px] font-semibold text-[var(--foreground)] leading-tight tracking-tight;
  }

  h3 {
    font-family: var(--font-sans);
    @apply text-[18px] font-medium text-[var(--foreground)] leading-snug;
  }

  h4 {
    font-family: var(--font-sans);
    @apply text-[15px] font-semibold text-[var(--foreground)] leading-snug tracking-wide;
    letter-spacing: 0.02em;
  }

  p {
    @apply text-[15px] leading-relaxed text-[var(--muted-foreground)] font-medium;
  }

  label {
    @apply text-[12px] font-medium text-[var(--foreground)] tracking-wide;
    letter-spacing: 0.01em;
  }

  a {
    @apply text-[var(--primary)] underline-offset-4 hover:underline;
  }

  code {
    border-radius: var(--radius-sm);
    background-color: var(--surface-muted);
    padding: 0.15rem 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  /* Form elements - Flat, matte, structural */
  input,
  textarea,
  select {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background-color: var(--surface);
    font-size: 0.875rem;
    color: var(--foreground);
    transition: border-color 0.15s ease-out;
  }
  
  input::placeholder,
  textarea::placeholder,
  select::placeholder {
    color: var(--tertiary-foreground);
  }
  
  input:focus,
  textarea:focus,
  select:focus {
    border-color: var(--border-strong);
  }

  /* Event details modal: inputs and selects are underline-only, no box/shadow (override base form styles) */
  [data-event-details-modal="true"] input,
  [data-event-details-modal="true"] select {
    border-radius: 0 !important;
    border: none !important;
    border-bottom: 1px solid var(--border) !important;
    background-color: transparent !important;
    box-shadow: none !important;
    -webkit-appearance: none !important;
    appearance: none !important;
  }
  [data-event-details-modal="true"] select {
    background-image: none !important;
  }
  [data-event-details-modal="true"] input:focus,
  [data-event-details-modal="true"] select:focus {
    border-bottom-color: var(--border-strong) !important;
    box-shadow: none !important;
  }
  /* Assignee dropdown trigger: same underline-only look */
  [data-event-details-modal="true"] .assignee-trigger-btn {
    border-radius: 0;
    border: none;
    border-bottom: 1px solid var(--border);
    background-color: transparent;
    box-shadow: none;
  }
  [data-event-details-modal="true"] .assignee-trigger-btn:hover {
    background-color: transparent;
  }

  /* Brutalist theme styling is handled at component level, not via CSS overrides */
}

@layer utilities {
  .text-tertiary {
    color: var(--tertiary-foreground);
  }

  .bg-surface {
    background-color: var(--surface);
  }

  .bg-surface-hover {
    background-color: var(--surface-hover);
  }

  .border-strong {
    border-color: var(--border-strong);
  }

  /* ===== SARAJEVO SHADOWS ===== */
  /* Minimal shadows - prefer borders for structure */
  .shadow-card {
    box-shadow: none;
  }

  .shadow-popover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
  
  /* Modal shadow - very diffuse, low opacity (exception per theme spec) */
  .shadow-modal {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  }

  /* Deco-style divider - double line effect */
  .divider-deco {
    border-top: 2px solid var(--border);
    border-bottom: 1px solid var(--border);
    height: 4px;
    background: transparent;
  }
  
  /* Thick structural divider */
  .divider-structural {
    border-top: 3px solid var(--border);
  }
  
  /* ===== SELECTION STATE UTILITIES (Arts Palette) ===== */
  /* Use these for selected rows, cards, and interactive elements */
  .selected-coffee {
    background-color: rgba(156, 124, 88, 0.05);
    border-color: rgba(156, 124, 88, 0.2);
  }
  
  .selected-teal {
    background-color: rgba(74, 122, 120, 0.05);
    border-color: rgba(74, 122, 120, 0.2);
  }
  
  .selected-indigo {
    background-color: rgba(82, 99, 122, 0.05);
    border-color: rgba(82, 99, 122, 0.2);
  }
  
  /* Row hover to match sidebar: primary tint */
  .row-hover-teal:hover {
    background-color: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  .row-hover-coffee:hover {
    background-color: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  /* Block entrance animation - subtle, structural */
  @keyframes block-swoosh-in {
    0% {
      opacity: 0;
      transform: translateY(8px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-block-swoosh-in {
    animation: block-swoosh-in 0.25s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }
  
  /* Focus states - structural, not glowy */
  .focus-structural:focus-visible {
    outline: 2px solid var(--border-strong);
    outline-offset: 2px;
  }

  /* Round legacy sharp utility classes for normalized radius system */
  .rounded-\[2px\] {
    border-radius: var(--radius-sm) !important;
  }

  .rounded-\[4px\] {
    border-radius: var(--radius-md) !important;
  }

  .rounded-sm {
    border-radius: var(--radius-sm) !important;
  }
  
  /* Subtle shadow utility for interactive cards */
  .shadow-subtle {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

}

/* Rich Text Editor Styles */
.ProseMirror {
  outline: none;
}

.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--tertiary-foreground);
  pointer-events: none;
  height: 0;
}

.ProseMirror h1 {
  font-size: 2em;
  font-weight: 700;
  line-height: calc(var(--line-spacing, 1.5) * 1.2);
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}

.ProseMirror h2 {
  font-size: 1.5em;
  font-weight: 600;
  line-height: calc(var(--line-spacing, 1.5) * 1.3);
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}

.ProseMirror h3 {
  font-size: 1.25em;
  font-weight: 600;
  line-height: calc(var(--line-spacing, 1.5) * 1.4);
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}

.ProseMirror p {
  margin-top: 0.75em;
  margin-bottom: 0.75em;
  line-height: var(--line-spacing, 1.5);
  font-size: 1em;
  font-weight: 500;
  color: var(--foreground);
}

.ProseMirror li {
  line-height: var(--line-spacing, 1.5);
}

.ProseMirror blockquote {
  line-height: var(--line-spacing, 1.5);
}

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5em;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
}

.ProseMirror ul li {
  list-style-type: disc;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.ProseMirror ol li {
  list-style-type: decimal;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.ProseMirror blockquote {
  border-left: 3px solid var(--border-strong);
  padding-left: 1em;
  margin-left: 0;
  margin-right: 0;
  margin-top: 0.75em;
  margin-bottom: 0.75em;
  color: var(--muted-foreground);
  font-style: italic;
}

  .ProseMirror code {
    background-color: var(--surface-muted);
    padding: 0.2em 0.4em;
    border-radius: var(--radius-sm);
    font-size: 0.9em;
    font-family: monospace;
    color: var(--foreground);
  }

  .ProseMirror pre {
    background-color: var(--surface-muted);
    border-radius: var(--radius-md);
    padding: 1em;
    overflow-x: auto;
    margin-top: 0.75em;
    margin-bottom: 0.75em;
  }

.ProseMirror pre code {
  background-color: transparent;
  padding: 0;
  font-size: 0.875em;
  line-height: 1.5;
}

.ProseMirror a {
  color: var(--primary);
  text-decoration: underline;
  cursor: pointer;
}

.ProseMirror a:hover {
  color: var(--primary-hover);
}

.ProseMirror hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 0;
}

/* Print Styles for PDF Export */
@media print {
  /* Hide UI elements */
  body > div:first-child > aside,
  nav,
  button,
  .no-print {
    display: none !important;
  }

  /* Force white background and black text */
  * {
    background: white !important;
    color: black !important;
    border-color: #ccc !important;
  }

  /* Show the document at full width */
  body {
    margin: 0;
    padding: 0;
  }

  /* Adjust page margins */
  @page {
    margin: 1in;
    size: letter;
  }

  /* Make sure editor content is visible */
  .ProseMirror {
    background: white !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  /* Improve text rendering */
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    font-weight: bold !important;
  }

  p {
    orphans: 3;
    widows: 3;
  }

  /* Avoid breaking inside lists */
  ul, ol {
    page-break-inside: avoid;
  }

  /* Remove shadows and borders */
  .shadow-lg,
  .rounded-sm {
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}

/* ===== CUSTOM SCROLLBAR STYLES ===== */
/* Theme-aware scrollbars matching the design system */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
  background-clip: padding-box;
}

/* Always show scrollbar track */
.scrollbar-thin {
  scrollbar-gutter: stable;
}

.scrollbar-thin::-webkit-scrollbar {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
  background-clip: padding-box;
}

/* Firefox scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) var(--surface-muted);
}
```

---

## Dashboard route entry

`src/app/dashboard/page.tsx` renders `<DashboardClient workspaceId={...} />` when workspace exists.
