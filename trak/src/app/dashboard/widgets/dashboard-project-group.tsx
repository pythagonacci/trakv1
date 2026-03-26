"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllProjects } from "@/app/actions/project";
import { Calendar, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/app/dashboard/projects/status-badge";
import { parseDateSafe } from "@/lib/due-date";
import { buildProjectPath } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";
import type { ProjectGroupWidgetConfig, ProjectGroupFilterKind } from "../dashboard-config-types";

interface ProjectRow {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client: { id: string; name: string | null; company?: string | null } | null;
}

interface DashboardProjectGroupProps {
  config: ProjectGroupWidgetConfig;
  workspaceId: string;
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToSunday = now.getDate() - day;
  const sunday = new Date(now);
  sunday.setDate(diffToSunday);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return {
    start: sunday.toISOString().slice(0, 10),
    end: saturday.toISOString().slice(0, 10),
  };
}

export function getProjectGroupFilters(config: ProjectGroupWidgetConfig): {
  status?: "not_started" | "in_progress" | "complete";
  internal_group_id?: string | null;
  due_date_start?: string | null;
  due_date_end?: string | null;
  sort_by?: "created_at" | "updated_at" | "due_date_date" | "name";
  sort_order?: "asc" | "desc";
} {
  const { filter } = config;
  const kind = filter.kind as ProjectGroupFilterKind;
  const value = filter.value;

  if (kind === "status") {
    return {
      status: value as "not_started" | "in_progress" | "complete" | undefined,
      sort_by: "updated_at",
      sort_order: "desc",
    };
  }
  if (kind === "initiative" && value) {
    return {
      internal_group_id: value,
      sort_by: "updated_at",
      sort_order: "desc",
    };
  }
  if (kind === "team") {
    // Projects don't have team_id in schema; we still allow the filter for future use
    return { sort_by: "updated_at", sort_order: "desc" };
  }
  if (kind === "due_this_week") {
    const { start, end } = getWeekRange();
    return {
      due_date_start: start,
      due_date_end: end,
      sort_by: "due_date_date",
      sort_order: "asc",
    };
  }
  if (kind === "recently_updated") {
    return { sort_by: "updated_at", sort_order: "desc" };
  }
  return { sort_by: "updated_at", sort_order: "desc" };
}

const FILTER_GROUP_LABELS: Record<ProjectGroupFilterKind, string> = {
  status: "By status",
  team: "By team",
  initiative: "By initiative",
  due_this_week: "Due this week",
  recently_updated: "Recently updated",
};

function mapToProjectRow(p: any): ProjectRow {
  const rawClient = Array.isArray(p.client) ? p.client[0] : p.client;
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    due_date_date: p.due_date_date ?? null,
    due_date_text: p.due_date_text ?? null,
    client: rawClient
      ? { id: rawClient.id, name: rawClient.name ?? null, company: rawClient.company ?? null }
      : null,
  };
}

export default function DashboardProjectGroup({
  config,
  workspaceId,
}: DashboardProjectGroupProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const filters = getProjectGroupFilters(config);
    setProjects([]);
    setIsLoading(true);
    getAllProjects(workspaceId, {
      project_type: "project",
      status: filters.status,
      internal_group_id: filters.internal_group_id ?? undefined,
      due_date_start: filters.due_date_start ?? undefined,
      due_date_end: filters.due_date_end ?? undefined,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    }, {}).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if ("error" in result) {
        setProjects([]);
      } else {
        setProjects((result.data ?? []).map(mapToProjectRow));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, config.filter.kind, config.filter.value, config.view]);

  const limit = config.limit ?? 10;
  const displayed = projects.slice(0, limit);
  const title = FILTER_GROUP_LABELS[config.filter.kind] ?? "Projects";

  if (isLoading) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-32 animate-pulse rounded bg-[var(--surface-muted)]" />
        </CardContent>
      </Card>
    );
  }

  if (config.view === "kanban_snapshot") {
    const byStatus = {
      not_started: displayed.filter((p) => p.status === "not_started"),
      in_progress: displayed.filter((p) => p.status === "in_progress"),
      complete: displayed.filter((p) => p.status === "complete"),
    };
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
        <CardContent className="px-4 pb-4 grid grid-cols-3 gap-2">
          {(["not_started", "in_progress", "complete"] as const).map((status) => (
            <div
              key={status}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-2 min-h-[80px]"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
                {status === "not_started"
                  ? "Not started"
                  : status === "in_progress"
                    ? "In progress"
                    : "Complete"}
              </p>
              <div className="space-y-1">
                {byStatus[status].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(buildProjectPath(p.id, p.name));
                    }}
                    className="w-full text-left rounded px-2 py-1.5 text-xs font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] truncate"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

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
        {displayed.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">No projects match this filter.</p>
        ) : (
          <ul className="space-y-1">
            {displayed.map((project) => {
              const dueDate = project.due_date_text
                ? project.due_date_text
                : project.due_date_date
                  ? (() => {
                      const date = parseDateSafe(project.due_date_date);
                      return date
                        ? date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : null;
                    })()
                  : null;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => router.push(buildProjectPath(project.id, project.name))}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border/60 bg-transparent px-3 py-2 text-left text-xs transition hover:bg-[var(--secondary)]/5 hover:border-[var(--secondary)]/30 text-[var(--foreground)]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[13px] line-clamp-1">{project.name}</p>
                      {project.client?.name && (
                        <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                          {project.client.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={project.status} />
                      {dueDate && (
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          {dueDate}
                        </span>
                      )}
                      <ArrowRight className="h-3 w-3 text-[var(--muted-foreground)]" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
