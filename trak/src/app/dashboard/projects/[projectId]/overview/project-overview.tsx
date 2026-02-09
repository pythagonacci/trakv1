"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Flag,
  Calendar,
  MessageSquare,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/app/dashboard/theme-context";
import { cn } from "@/lib/utils";

export interface ProjectOverviewTask {
  id: string;
  text: string;
  tabName: string;
  tabId: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  dueDate?: string;
  dueTime?: string;
  status?: string;
}

export interface TeamFeedbackItem {
  id: string;
  text: string;
  author: string;
  tabName: string;
  tabId: string;
  blockId: string;
  timestamp?: string;
}

interface ProjectOverviewProps {
  projectId: string;
  projectName: string;
  tasksDueToday: ProjectOverviewTask[];
  tasksDueSoon: ProjectOverviewTask[];
  tasksOverdue: ProjectOverviewTask[];
  teamFeedback: TeamFeedbackItem[];
  openTasksCount: number;
}

export default function ProjectOverview({
  projectId,
  projectName,
  tasksDueToday,
  tasksDueSoon,
  tasksOverdue,
  teamFeedback,
  openTasksCount,
}: ProjectOverviewProps) {
  const router = useRouter();
  const { theme } = useTheme();

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
      const timeStr = time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateLabel} ${timeStr}`;
    }
    return dateLabel;
  };

  const getPriorityColor = (priority?: ProjectOverviewTask["priority"]) => {
    const isBrutalist = theme === "brutalist";
    switch (priority) {
      case "urgent":
        return isBrutalist
          ? "text-white bg-[var(--tile-orange)]/80"
          : "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30";
      case "high":
        return isBrutalist
          ? "text-white bg-[var(--tram-yellow)]/70"
          : "text-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 border border-[var(--tram-yellow)]/30";
      case "medium":
        return isBrutalist
          ? "text-white bg-[var(--river-indigo)]/70"
          : "text-[var(--river-indigo)] bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/30";
      case "low":
        return isBrutalist
          ? "text-white bg-[var(--dome-teal)]/60"
          : "text-[var(--dome-teal)] bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/30";
      default:
        return "";
    }
  };

  const getPriorityLabel = (priority?: ProjectOverviewTask["priority"]) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "None";
    }
  };

  const goToTab = (tabId: string, taskId?: string) => {
    const q = taskId ? `?taskId=${taskId}` : "";
    router.push(`/dashboard/projects/${projectId}/tabs/${tabId}${q}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-10 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            Project overview
          </p>
          <h1
            className="mt-1 text-2xl font-semibold tracking-normal md:text-3xl font-playfair"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {projectName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            What’s due, overdue, and recent feedback from your team—all in one place.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => {}}
          className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors cursor-default"
        >
          <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">
            {openTasksCount}
          </p>
          <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">
            Open tasks
          </p>
        </button>
        <button
          onClick={() => {}}
          className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--surface)] px-4 py-4 text-left transition-colors cursor-default"
        >
          <p className="text-2xl font-semibold text-[var(--foreground)] tabular-nums">
            {teamFeedback.length}
          </p>
          <p className="text-xs text-[var(--tertiary-foreground)] uppercase tracking-[0.18em]">
            Team comments & feedback
          </p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Due today */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Due today
              </CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Tasks due in the next 24 hours.
              </p>
            </div>
            <span className="text-xs text-[var(--tertiary-foreground)]">
              {tasksDueToday.length} items
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasksDueToday.length > 0 ? (
              <div className="space-y-2">
                {tasksDueToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={() => goToTab(task.tabId, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Nothing due today for this project.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Due soon */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Due soon
              </CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Coming up in the next 7 days.
              </p>
            </div>
            <span className="text-xs text-[var(--tertiary-foreground)]">
              {tasksDueSoon.length} items
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasksDueSoon.length > 0 ? (
              <div className="space-y-2">
                {tasksDueSoon.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={() => goToTab(task.tabId, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                No tasks due in the next week.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[var(--tile-orange)]" />
                Overdue
              </CardTitle>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Past-due items that need attention.
              </p>
            </div>
            <span className="text-xs text-[var(--tertiary-foreground)]">
              {tasksOverdue.length} items
            </span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasksOverdue.length > 0 ? (
              <div className="space-y-2">
                {tasksOverdue.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={() => goToTab(task.tabId, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                    isOverdue
                  />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                No overdue tasks. You’re on track.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Team comments & feedback */}
        <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl lg:col-span-2">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Team comments & feedback
            </CardTitle>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Recent comments left by your team on this project’s tabs.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 pt-0">
            {teamFeedback.length === 0 ? (
              <p className="text-[var(--muted-foreground)] text-xs">
                No team comments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {teamFeedback.slice(0, 10).map((feedback) => (
                  <button
                    key={feedback.id}
                    onClick={() => goToTab(feedback.tabId)}
                    className="group flex w-full items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-left transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[var(--foreground)]" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-[13px] font-medium text-[var(--foreground)] line-clamp-2">
                        &ldquo;{feedback.text}&rdquo;
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {feedback.author} · {feedback.tabName} ·{" "}
                        {formatRelativeTime(feedback.timestamp)}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onClick,
  formatDueDate,
  getPriorityColor,
  getPriorityLabel,
  isOverdue = false,
}: {
  task: ProjectOverviewTask;
  onClick: () => void;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  getPriorityColor: (p?: ProjectOverviewTask["priority"]) => string;
  getPriorityLabel: (p?: ProjectOverviewTask["priority"]) => string;
  isOverdue?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left text-xs transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30 text-[var(--foreground)]",
        isOverdue
          ? "border-[var(--tile-orange)]/40 bg-[var(--tile-orange)]/5"
          : "border-border/60 bg-transparent"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[13px] line-clamp-1">{task.text}</p>
        <span className="whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
          {task.tabName}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        {task.priority && task.priority !== "none" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
              theme === "brutalist" ? "" : "border",
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
              isOverdue
                ? "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30"
                : theme === "brutalist"
                  ? "text-white bg-[var(--tram-yellow)]/70"
                  : "border border-[var(--tram-yellow)]/30 bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)]"
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
