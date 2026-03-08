"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Flag, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseDateSafe } from "@/lib/due-date";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";
import type { TaskListWidgetConfig } from "../dashboard-config-types";

interface TaskItem {
  id: string;
  text: string;
  projectName: string;
  tabName: string;
  projectId?: string | null;
  tabId?: string | null;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  dueDate?: string;
  dueTime?: string;
  sourceUrl?: string;
}

interface DashboardTaskWidgetProps {
  config: TaskListWidgetConfig;
  tasks: TaskItem[];
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
  }>;
  userId: string;
}

function formatDueDate(dueDate?: string, dueTime?: string): string | null {
  if (!dueDate) return null;
  const date = parseDateSafe(dueDate);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);
  if (taskDate.getTime() === today.getTime()) return "Today";
  if (taskDate.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardTaskWidget({
  config,
  tasks,
  dueAwareItems = [],
  userId,
}: DashboardTaskWidgetProps) {
  const router = useRouter();
  const limit = config.limit ?? 10;

  const items: TaskItem[] = dueAwareItems.length > 0
    ? dueAwareItems.slice(0, limit * 2).map((item) => ({
        id: item.id,
        text: item.text,
        projectName: item.projectName,
        tabName: item.tabName,
        projectId: item.projectId,
        tabId: item.tabId,
        priority: (item.priority as TaskItem["priority"]) ?? undefined,
        dueDate: item.dueDate,
        sourceUrl: item.sourceUrl,
      }))
    : tasks;

  const filtered =
    config.filter === "due_soon"
      ? items
          .filter((t) => t.dueDate)
          .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
          .slice(0, limit)
      : config.filter === "my_tasks"
        ? items.slice(0, limit)
        : items.slice(0, limit);

  const getPriorityColor = (priority?: TaskItem["priority"]) => {
    switch (priority) {
      case "urgent":
        return "text-[var(--tile-orange)] bg-[var(--tile-orange)]/10 border border-[var(--tile-orange)]/30";
      case "high":
        return "text-[var(--tram-yellow)] bg-[var(--tram-yellow)]/10 border border-[var(--tram-yellow)]/30";
      case "medium":
        return "text-[var(--river-indigo)] bg-[var(--river-indigo)]/10 border border-[var(--river-indigo)]/30";
      case "low":
        return "text-[var(--dome-teal)] bg-[var(--dome-teal)]/10 border border-[var(--dome-teal)]/30";
      default:
        return "";
    }
  };

  const title =
    config.filter === "due_soon"
      ? "Due soon"
      : config.filter === "my_tasks"
        ? "My tasks"
        : "Tasks";

  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
      <CardHeader className="pb-2 px-4 pt-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => router.push("/dashboard/projects")}
        >
          View all
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">No tasks to show.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (task.sourceUrl) router.push(task.sourceUrl);
                    else if (task.projectId && task.tabId)
                      router.push(
                        `${buildProjectTabPath(task.projectId, task.tabId, task.projectName, task.tabName)}?taskId=${task.id}`
                      );
                  }}
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
                        {task.priority}
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
