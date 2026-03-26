"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Flag,
  Calendar,
  MessageSquare,
  User,
} from "lucide-react";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export interface ProjectOverviewTask {
  id: string;
  text: string;
  tabName: string;
  tabId: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignees?: Array<{ id?: string; name?: string }>;
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
  const [showAllDueToday, setShowAllDueToday] = useState(false);
  const [showAllDueSoon, setShowAllDueSoon] = useState(false);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const maxVisibleTasks = 5;

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
    switch (priority) {
      case "urgent":
        return "text-[var(--priority-urgent-text)] bg-[var(--priority-urgent-bg)] border border-[var(--priority-urgent-text)]/20";
      case "high":
        return "text-[#C4622D] bg-[#FAE5D8] border border-[#C4622D]/20";
      case "medium":
        return "text-[var(--priority-medium-text)] bg-[var(--priority-medium-bg)] border border-[var(--priority-medium-text)]/20";
      case "low":
        return "text-[var(--priority-low-text)] bg-[var(--priority-low-bg)] border border-[var(--priority-low-text)]/20";
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

  const goToTab = (tabId: string, tabName: string, taskId?: string) => {
    const q = taskId ? `?taskId=${taskId}` : "";
    router.push(`${buildProjectTabPath(projectId, tabId, projectName, tabName)}${q}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-10 pt-4">
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--tertiary-foreground)]">
          Project Overview
        </p>
        <h1 className="text-[22px] font-medium leading-tight tracking-tight text-[var(--foreground)]">
          {projectName}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground)]">
          What&apos;s due, overdue, and recent feedback from your team—all in one place.
        </p>
      </div>

      <div className="flex gap-3">
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            minWidth: 150,
          }}
        >
          <p className="text-[26px] font-medium leading-none text-[var(--foreground)] tabular-nums">
            {openTasksCount}
          </p>
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--faint-foreground)]">
            Open Tasks
          </p>
        </div>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            minWidth: 150,
          }}
        >
          <p className="text-[26px] font-medium leading-none text-[var(--foreground)] tabular-nums">
            {teamFeedback.length}
          </p>
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--faint-foreground)]">
            Team Comments &amp; Feedback
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Team comments & feedback */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <MessageSquare className="h-3.5 w-3.5 text-[var(--tertiary-foreground)]" />
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontWeight: 500,
                color: "var(--muted-foreground)",
              }}
            >
              Team comments &amp; feedback
            </span>
            <span style={{ fontSize: 11, color: "var(--tertiary-foreground)" }}>
              Recent comments left by your team on this project&apos;s tabs.
            </span>
          </div>

          <div style={{ padding: "13px 16px" }}>
            {teamFeedback.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--tertiary-foreground)", fontStyle: "italic" }}>
                No team comments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {teamFeedback.slice(0, 10).map((feedback) => (
                  <button
                    key={feedback.id}
                    onClick={() => goToTab(feedback.tabId, feedback.tabName)}
                    className="group w-full text-left transition hover:opacity-90"
                    style={{
                      display: "flex",
                      gap: 9,
                      padding: "9px 11px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--surface-muted)",
                      border: "1px solid var(--border-strong)",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--primary)",
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="line-clamp-2"
                        style={{ fontSize: 12.5, color: "var(--foreground)", lineHeight: 1.4 }}
                      >
                        &ldquo;{feedback.text}&rdquo;
                      </p>
                      <p style={{ fontSize: 10.5, color: "var(--tertiary-foreground)", marginTop: 3 }}>
                        {feedback.author} · {feedback.tabName} ·{" "}
                        {formatRelativeTime(feedback.timestamp)}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--tertiary-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Due today */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--primary)",
                }}
              >
                Due today
              </span>
              <span style={{ fontSize: 11.5, color: "var(--tertiary-foreground)", fontWeight: 300, marginLeft: 4 }}>
                Tasks due in the next 24 hours.
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--faint-foreground)" }}>
              {tasksDueToday.length} items
            </span>
          </div>

          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {tasksDueToday.length > 0 ? (
              <>
                {(showAllDueToday ? tasksDueToday : tasksDueToday.slice(0, maxVisibleTasks)).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accent="var(--primary)"
                    onClick={() => goToTab(task.tabId, task.tabName, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
                {tasksDueToday.length > maxVisibleTasks ? (
                  <button
                    onClick={() => setShowAllDueToday((value) => !value)}
                    className="mx-auto mt-2 inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition hover:opacity-90"
                    style={{
                      color: "var(--foreground)",
                      background: "var(--surface-muted)",
                      border: "1px solid var(--border-strong)",
                    }}
                    type="button"
                  >
                    {showAllDueToday
                      ? "Show less \u2191"
                      : `Show ${tasksDueToday.length - maxVisibleTasks} more \u2192`}
                  </button>
                ) : null}
              </>
            ) : (
              <p style={{ fontSize: 11.5, color: "var(--tertiary-foreground)", fontStyle: "italic", padding: "4px 0" }}>
                Nothing due today for this project.
              </p>
            )}
          </div>
        </div>

        {/* Due soon */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--success)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--success)",
                }}
              >
                Due soon
              </span>
              <span style={{ fontSize: 11.5, color: "var(--tertiary-foreground)", fontWeight: 300, marginLeft: 4 }}>
                Coming up in the next 7 days.
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--faint-foreground)" }}>
              {tasksDueSoon.length} items
            </span>
          </div>

          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {tasksDueSoon.length > 0 ? (
              <>
                {(showAllDueSoon ? tasksDueSoon : tasksDueSoon.slice(0, maxVisibleTasks)).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    accent="var(--success)"
                    onClick={() => goToTab(task.tabId, task.tabName, task.id)}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    getPriorityLabel={getPriorityLabel}
                  />
                ))}
                {tasksDueSoon.length > maxVisibleTasks ? (
                  <button
                    onClick={() => setShowAllDueSoon((value) => !value)}
                    className="mx-auto mt-2 inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition hover:opacity-90"
                    style={{
                      color: "var(--foreground)",
                      background: "var(--surface-muted)",
                      border: "1px solid var(--border-strong)",
                    }}
                    type="button"
                  >
                    {showAllDueSoon
                      ? "Show less \u2191"
                      : `Show ${tasksDueSoon.length - maxVisibleTasks} more \u2192`}
                  </button>
                ) : null}
              </>
            ) : (
              <p style={{ fontSize: 11.5, color: "var(--tertiary-foreground)", fontStyle: "italic", padding: "4px 0" }}>
                No tasks due in the next week.
              </p>
            )}
          </div>
        </div>

        {/* Overdue */}
        <div className="lg:col-span-2">
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--error)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--error)",
                  }}
                >
                  Overdue
                </span>
                <span style={{ fontSize: 11.5, color: "var(--tertiary-foreground)", fontWeight: 300, marginLeft: 4 }}>
                  Past-due items that need attention.
                </span>
              </div>
              <span style={{ fontSize: 11, color: "var(--faint-foreground)" }}>
                {tasksOverdue.length} items
              </span>
            </div>

            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {tasksOverdue.length > 0 ? (
                <>
                  {(showAllOverdue ? tasksOverdue : tasksOverdue.slice(0, maxVisibleTasks)).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      accent="var(--error)"
                      onClick={() => goToTab(task.tabId, task.tabName, task.id)}
                      formatDueDate={formatDueDate}
                      getPriorityColor={getPriorityColor}
                      getPriorityLabel={getPriorityLabel}
                      isOverdue
                    />
                  ))}
                  {tasksOverdue.length > maxVisibleTasks ? (
                    <button
                      onClick={() => setShowAllOverdue((value) => !value)}
                      className="mx-auto mt-2 inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium transition hover:opacity-90"
                      style={{
                        color: "var(--foreground)",
                        background: "var(--surface-muted)",
                        border: "1px solid var(--border-strong)",
                      }}
                      type="button"
                    >
                      {showAllOverdue
                        ? "Show less \u2191"
                        : `Show ${tasksOverdue.length - maxVisibleTasks} more \u2192`}
                    </button>
                  ) : null}
                </>
              ) : (
                <p style={{ fontSize: 11.5, color: "var(--tertiary-foreground)", fontStyle: "italic", padding: "4px 0" }}>
                  No overdue tasks. You&apos;re on track.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  accent,
  onClick,
  formatDueDate,
  getPriorityColor,
  getPriorityLabel,
  isOverdue = false,
}: {
  task: ProjectOverviewTask;
  accent: string;
  onClick: () => void;
  formatDueDate: (dueDate?: string, dueTime?: string) => string | null;
  getPriorityColor: (p?: ProjectOverviewTask["priority"]) => string;
  getPriorityLabel: (p?: ProjectOverviewTask["priority"]) => string;
  isOverdue?: boolean;
}) {
  const assigneeCount = Array.isArray(task.assignees) ? task.assignees.length : 0;
  const primaryAssignee = assigneeCount > 0
    ? task.assignees?.[0]?.name?.trim() || task.assignees?.[0]?.id || "Assigned"
    : null;
  const assigneeLabel = primaryAssignee
    ? assigneeCount > 1
      ? `${primaryAssignee} +${assigneeCount - 1}`
      : primaryAssignee
    : null;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left text-xs transition hover:bg-[var(--surface-hover)]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `2.5px solid ${accent}`,
        borderRadius: "var(--radius-lg)",
        padding: "10px 12px",
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="line-clamp-1 text-[12.5px] font-medium text-[var(--foreground)]">
          {task.text}
        </p>
        <span className="shrink-0 whitespace-nowrap text-[10.5px] text-[var(--tertiary-foreground)]">
          {task.tabName}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
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
        {assigneeLabel && (
          <span
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{
              background: "var(--surface-muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <User className="h-2.5 w-2.5" />
            {assigneeLabel}
          </span>
        )}
        {task.dueDate && (
          <span
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
            style={{
              background: isOverdue ? "var(--error-bg)" : "var(--surface-muted)",
              color: isOverdue ? "var(--error)" : "var(--muted-foreground)",
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
