"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Users,
  Plus,
  TrendingUp,
  CheckCircle2,
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
import { useTheme } from "@/app/dashboard/theme-context";

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
}

interface DashboardOverviewProps {
  projects: Project[];
  docs: Doc[];
  tasks: Task[];
  workspaceId: string;
  clientFeedback: ClientFeedback[];
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

export default function DashboardOverview({ projects, docs, tasks, clientFeedback }: DashboardOverviewProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "complete" && p.project_type === "project"),
    [projects]
  );
  const internalSpaces = useMemo(
    () => projects.filter((p) => p.project_type === "internal"),
    [projects]
  );

  const totalProjects = projects.length;
  const inProgressCount = projects.filter((p) => p.status === "in_progress").length;
  const notStartedCount = projects.filter((p) => p.status === "not_started").length;
  const completedCount = projects.filter((p) => p.status === "complete").length;

  const clientFeedbackItems = clientFeedback.slice(0, 4);
  const teamUpdates = tasks.slice(0, 3);
  const materialUpdates = tasks.slice(3, 6);
  const clientDocs = docs.slice(0, 3);
  const todayTasks = tasks.slice(0, 6);
  const feedbackCount = clientFeedback.length;
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


  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const formatDueDate = (dueDate?: string, dueTime?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
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
    const isBrutalist = theme === "brutalist";
    switch (priority) {
      case "urgent": return isBrutalist ? "text-white bg-[var(--tile-orange)]/80" : "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30";
      case "high": return isBrutalist ? "text-white bg-[var(--tram-yellow)]/70" : "text-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 border border-[var(--tram-yellow)]/30";
      case "medium": return isBrutalist ? "text-white bg-[var(--river-indigo)]/70" : "text-[var(--river-indigo)] bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/30";
      case "low": return isBrutalist ? "text-white bg-[var(--dome-teal)]/60" : "text-[var(--dome-teal)] bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/30";
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

  const deliveryPercent = (count: number) =>
    totalProjects === 0 ? 0 : Math.round((count / totalProjects) * 100);

  return (
    <div className="flex flex-col gap-6 pb-10 px-6 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            Overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Run your service business from one place.
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Open to today’s work first—then see client health and delivery signals.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => router.push("/dashboard")}
          >
            <CalendarDays className="h-4 w-4" />
            Today view
          </Button>
          <button 
            onClick={() => router.push("/dashboard/projects")}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[2px] transition-colors"
          >
            New project
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={activeProjects.length}
          onClick={() => router.push("/dashboard/projects")}
        />
        <StatCard label="Open tasks" value={tasks.length} />
        <StatCard
          label="Documents"
          value={docs.length}
          onClick={() => router.push("/dashboard/docs")}
        />
        <StatCard label="Feedback & updates" value={feedbackCount} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UpdatesCard
          title="Client feedback"
          description="Latest comments left on shared client pages."
          items={clientFeedbackItems}
          emptyMessage="No client feedback yet."
          renderItem={(feedback) => (
            <UpdateRow
              key={feedback.id}
              title={`“${feedback.text}”`}
              subtitle={`${feedback.author} · ${feedback.projectName} · ${feedback.tabName} · ${formatRelativeTime(
                feedback.timestamp
              )}`}
              icon={<MessageSquare className="h-3.5 w-3.5 text-[var(--foreground)]" />}
              onClick={
                feedback.projectId && feedback.tabId
                  ? () => router.push(`/dashboard/projects/${feedback.projectId}/tabs/${feedback.tabId}`)
                  : undefined
              }
            />
          )}
        />

        <UpdatesCard
          title="Team updates"
          description="Team activity and check-ins from task lists."
          items={teamUpdates}
          emptyMessage="No recent team activity yet."
          renderItem={(task) => (
            <UpdateRow
              key={task.id}
              title={task.text}
              subtitle={`${task.projectName} · ${task.tabName}`}
              priority={task.priority}
              dueDate={task.dueDate}
              dueTime={task.dueTime}
              getPriorityColor={getPriorityColor}
              getPriorityLabel={getPriorityLabel}
              formatDueDate={formatDueDate}
              onClick={
                task.projectId && task.tabId
                  ? () => router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}?taskId=${task.id}`)
                  : undefined
              }
            />
          )}
        />

        <UpdatesCard
          title="Material updates"
          description="Concrete progress captured in task lists."
          items={materialUpdates}
          emptyMessage="No concrete updates yet."
          renderItem={(task) => (
            <UpdateRow
              key={task.id}
              title={task.text}
              subtitle={`${task.projectName} · ${task.tabName}`}
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-[var(--foreground)]" />}
              priority={task.priority}
              dueDate={task.dueDate}
              dueTime={task.dueTime}
              getPriorityColor={getPriorityColor}
              getPriorityLabel={getPriorityLabel}
              formatDueDate={formatDueDate}
              onClick={
                task.projectId && task.tabId
                  ? () => router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}?taskId=${task.id}`)
                  : undefined
              }
            />
          )}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                What matters in the next 24 hours.
              </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-border/70 px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
                Active: {activeProjects.length}
              </span>
              <span className="rounded-full border border-border/70 px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
                {tasks.length} open tasks
              </span>
            </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => router.push("/dashboard/projects")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 px-4 pb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Due today
                </p>
                <span className="text-xs text-[var(--tertiary-foreground)]">{todayTasks.length} items</span>
              </div>
              {todayTasks.length > 0 ? (
                <div className="space-y-2">
                  {todayTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={
                        task.projectId && task.tabId
                          ? () => router.push(`/dashboard/projects/${task.projectId}/tabs/${task.tabId}?taskId=${task.id}`)
                          : undefined
                      }
                      className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
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
                        {/* Priority Badge */}
                        {task.priority && task.priority !== "none" && (
                          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${theme === "brutalist" ? "" : "border"} ${getPriorityColor(task.priority)}`}>
                            <Flag className="h-2.5 w-2.5" />
                            {getPriorityLabel(task.priority)}
                          </span>
                        )}
                        {/* Due Date Badge */}
                        {task.dueDate && (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                            theme === "brutalist"
                              ? "text-white bg-[var(--tram-yellow)]/70"
                              : "border border-[var(--tram-yellow)]/30 bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)]"
                          )}>
                            <Calendar className="h-2.5 w-2.5" />
                            {formatDueDate(task.dueDate, task.dueTime)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Nothing due today. Use the time to structure your pipeline.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Upcoming meetings
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => router.push("/dashboard")}>
                  Open calendar
                </Button>
              </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Meetings are tracked alongside each project tab. Jump into the relevant space to see
                  scheduled calls.
                </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <div>
                <CardTitle className="text-sm font-medium">Client delivery status</CardTitle>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  How projects are progressing.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push("/dashboard/projects")}>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <StatBar
                label="In progress"
                count={inProgressCount}
                percent={deliveryPercent(inProgressCount)}
              />
              <StatBar
                label="Not started"
                count={notStartedCount}
                percent={deliveryPercent(notStartedCount)}
              />
              <StatBar
                label="Complete"
                count={completedCount}
                percent={deliveryPercent(completedCount)}
              />
              <p className="pt-1 text-[11px] text-[var(--muted-foreground)]">
                Tip: Tag projects with <span className="font-medium">@at-risk</span> or{" "}
                <span className="font-medium">@waiting-on-client</span> so the delivery view stays accurate.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <div>
                <CardTitle className="text-sm font-medium">Business health</CardTitle>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Quick signals tied directly to your workspace data.
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
                <TrendingUp className="h-3 w-3" />
                Workspace view
              </span>
            </CardHeader>
            <CardContent className="space-y-4 text-xs px-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[var(--muted-foreground)]">Projects tracked</p>
                  <p className="text-base font-semibold">{totalProjects}</p>
                </div>
                <MiniStat icon={<Users className="h-4 w-4" />} label="Active teams" value="Workspace level" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">Docs updated</span>
                  <span className="font-medium">{docs.length}</span>
                </div>
                <SimpleProgress value={Math.min(100, docs.length * 5)} />
              </div>
              <MiniStat
                icon={<ArrowUpRight className="h-4 w-4" />}
                label="Internal spaces"
                value={`${internalSpaces.length} active`}
              />
            </CardContent>
          </Card>

          <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl flex-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Recent docs</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => router.push("/dashboard/docs")}>
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0">
              {docs.length === 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  No documents yet. Start by drafting a proposal or project brief.
                </p>
              ) : (
                docs.slice(0, 4).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => router.push(`/dashboard/docs/${doc.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 flex-none text-[var(--muted-foreground)]" />
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-[13px] font-medium">{doc.title}</p>
                        <p className="line-clamp-1 text-[11px] text-[var(--muted-foreground)]">
                          Updated {formatDate(doc.updated_at)}
                        </p>
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
                      {formatDate(doc.updated_at)}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  onClick?: () => void;
}

function StatCard({ label, value, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors",
        onClick
          ? "hover:border-[var(--border)] hover:bg-[var(--surface-hover)] cursor-pointer"
          : "cursor-default"
      )}
    >
      <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">{value}</p>
      <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">{label}</p>
    </button>
  );
}

interface UpdatesCardProps<Item> {
  title: string;
  description: string;
  items: Item[];
  emptyMessage: string;
  renderItem: (item: Item) => ReactNode;
}

function UpdatesCard<Item>({
  title,
  description,
  items,
  emptyMessage,
  renderItem,
}: UpdatesCardProps<Item>) {
  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0 text-xs">
        {items.length === 0 ? (
          <p className="text-[var(--muted-foreground)]">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">{items.map((item) => renderItem(item))}</div>
        )}
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
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--surface-hover)]"
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
              theme === "brutalist"
                ? "text-white bg-[var(--tram-yellow)]/70"
                : "border border-[var(--tram-yellow)]/30 bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)]"
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

interface StatBarProps {
  label: string;
  count: number;
  percent: number;
}

function StatBar({ label, count, percent }: StatBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-medium">
          {count} ({percent}%)
        </span>
      </div>
      <SimpleProgress value={percent} />
    </div>
  );
}

function SimpleProgress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
      <div
        className="h-full rounded-full bg-[var(--foreground)] transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

interface MiniStatProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function MiniStat({ icon, label, value }: MiniStatProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-transparent px-3 py-2 text-xs">
      {icon}
      <div>
        <p className="text-[11px] text-[var(--muted-foreground)]">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

