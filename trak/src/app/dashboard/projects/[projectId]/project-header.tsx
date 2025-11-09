"use client";

import { ArrowLeft, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import StatusBadge from "../../projects/status-badge";

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    status: "not_started" | "in_progress" | "complete";
    due_date_date?: string | null;
    due_date_text?: string | null;
    client?: {
      id: string;
      name: string;
      company?: string | null;
    } | null;
  };
}

export default function ProjectHeader({ project }: ProjectHeaderProps) {
  const router = useRouter();

  const formatDueDate = () => {
    if (project.due_date_text) {
      return project.due_date_text;
    }
    if (project.due_date_date) {
      const date = new Date(project.due_date_date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return "No due date";
  };

  return (
    <div className="mb-4 space-y-3">
      <button
        onClick={() => router.push("/dashboard/projects")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to projects
      </button>

      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          {project.client && (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--surface-hover)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              {project.client.name}
              {project.client.company && <span className="text-[var(--tertiary-foreground)]">· {project.client.company}</span>}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <StatusBadge status={project.status} />
            <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
              Due {formatDueDate()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            <Edit className="h-3.5 w-3.5" />
            Edit details
          </button>
        </div>
      </div>
    </div>
  );
}