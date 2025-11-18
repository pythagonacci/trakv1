"use client";

import { ArrowLeft, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import StatusBadge from "../../projects/status-badge";
import ClientPageToggle from "./client-page-toggle";

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    status: "not_started" | "in_progress" | "complete";
    due_date_date?: string | null;
    due_date_text?: string | null;
    client_page_enabled?: boolean;
    public_token?: string | null;
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
    return null;
  };

  const hasDueDate = project.due_date_text || project.due_date_date;
  const dueDateText = formatDueDate();

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.push("/dashboard/projects")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to projects
      </button>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          {project.client && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--info)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--info)]">
              {project.client.name}
              {project.client.company && <span className="text-[var(--info)]/70">· {project.client.company}</span>}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={project.status} />
            {hasDueDate && dueDateText && (
              <span className="flex items-center gap-1 text-[var(--foreground)]/70 font-medium">
                Due {dueDateText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Client Page Toggle - only show for client projects */}
          {project.client && (
            <ClientPageToggle
              projectId={project.id}
              clientPageEnabled={project.client_page_enabled || false}
              publicToken={project.public_token || null}
            />
          )}
          
          <button className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] shadow-sm">
            <Edit className="h-3.5 w-3.5" />
            Edit details
          </button>
        </div>
      </div>
    </div>
  );
}