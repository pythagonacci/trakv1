"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSingleProject } from "@/app/actions/project";
import { Calendar, Building2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/app/dashboard/projects/status-badge";
import { parseDateSafe } from "@/lib/due-date";
import { buildProjectPath } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";
import type { ProjectCardWidgetConfig } from "../dashboard-config-types";

interface ProjectRow {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client: { id: string; name: string | null; company?: string | null } | null;
}

interface DashboardProjectCardProps {
  config: ProjectCardWidgetConfig;
  workspaceId: string;
}

function mapToProjectRow(project: any): ProjectRow | null {
  if (!project?.id) return null;
  const rawClient = Array.isArray(project.client) ? project.client[0] : project.client;
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    due_date_date: project.due_date_date ?? null,
    due_date_text: project.due_date_text ?? null,
    client: rawClient
      ? { id: rawClient.id, name: rawClient.name ?? null, company: rawClient.company ?? null }
      : null,
  };
}

export default function DashboardProjectCard({ config, workspaceId }: DashboardProjectCardProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProject(null);
    setIsLoading(true);
    getSingleProject(config.projectId).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if ("error" in result) {
        setProject(null);
      } else {
        setProject(mapToProjectRow(result.data));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [config.projectId]);

  if (isLoading) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
        <CardContent className="p-4">
          <div className="h-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        </CardContent>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl">
        <CardContent className="p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Project not found.</p>
        </CardContent>
      </Card>
    );
  }

  const dueDate = project.due_date_text
    ? { text: project.due_date_text, isOverdue: false }
    : project.due_date_date
      ? (() => {
          const date = parseDateSafe(project.due_date_date);
          if (!date) return null;
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const isOverdue = date < now && date.toDateString() !== now.toDateString();
          const formatted = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
          });
          return { text: formatted, isOverdue };
        })()
      : null;

  return (
    <Card
      className={cn(
        "border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-xl",
        "cursor-pointer transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]/50"
      )}
      onClick={() => router.push(buildProjectPath(project.id, project.name))}
    >
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-medium truncate">{project.name}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2">
        {project.client?.name && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{project.client.name}</span>
          </div>
        )}
        <div>
          <StatusBadge status={project.status} />
        </div>
        {dueDate && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs",
              dueDate.isOverdue ? "text-[var(--error)]" : "text-[var(--muted-foreground)]"
            )}
          >
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>{dueDate.text}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 pt-2 text-xs text-[var(--primary)]">
          <span>View project</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </CardContent>
    </Card>
  );
}
