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
      case "urgent": return "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30";
      case "high": return "text-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 border border-[var(--tram-yellow)]/30";
      case "medium": return "text-[var(--river-indigo)] bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/30";
      case "low": return "text-[var(--dome-teal)] bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/30";
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
                onNavigate={(projectId, tabId) => {
                  if (projectId && tabId) {
                    router.push(`/dashboard/projects/${projectId}/tabs/${tabId}`);
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
              <Card key={widget.id} className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                  <div>
                    <CardTitle className="text-sm font-medium">Today</CardTitle>
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
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Due today</p>
                    {dueTodayTasks.length > 0 ? (
                      <div className="space-y-2">
                        {dueTodayTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => { if (task.sourceUrl) router.push(task.sourceUrl); else if (task.projectId && task.tabId) router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}?taskId=${task.id}`); }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing due today.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Upcoming</p>
                    {upcomingTasks.length > 0 ? (
                      <div className="space-y-2">
                        {upcomingTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => { if (task.sourceUrl) router.push(task.sourceUrl); else if (task.projectId && task.tabId) router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}?taskId=${task.id}`); }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">Nothing upcoming.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Past due</p>
                    {pastDueTasks.length > 0 ? (
                      <div className="space-y-2">
                        {pastDueTasks.map((task) => (
                          <TaskRowButton
                            key={task.id}
                            task={task}
                            getPriorityColor={getPriorityColor}
                            getPriorityLabel={getPriorityLabel}
                            formatDueDate={formatDueDate}
                            onNavigate={() => { if (task.sourceUrl) router.push(task.sourceUrl); else if (task.projectId && task.tabId) router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}?taskId=${task.id}`); }}
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
}: {
  task: Task;
  getPriorityColor: (priority?: Task["priority"]) => string;
  getPriorityLabel: (priority?: Task["priority"]) => string;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  onNavigate: () => void;
}) {
  return (
    <button
      onClick={onNavigate}
      className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-left text-xs transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30 text-[var(--foreground)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[13px] line-clamp-1">{task.text}</p>
        <span className="whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
          {task.tabName}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <p className="line-clamp-1 text-[11px] text-[var(--muted-foreground)]">
          {task.projectName}
        </p>
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              getPriorityColor(task.priority)
            )}
          >
            <Flag className="h-2.5 w-2.5" />
            {getPriorityLabel(task.priority)}
          </span>
        )}
        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              "border border-[var(--tile-orange)]/30 bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]"
            )}
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
  onNavigate: (projectId?: string | null, tabId?: string | null) => void;
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
                onClick={() => onNavigate(feedback.projectId, feedback.tabId)}
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
                onClick={() => onNavigate(feedback.projectId, feedback.tabId)}
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
      className="group flex w-full items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30"
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
