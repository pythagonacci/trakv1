"use client";

import { formatDistanceToNow } from "date-fns";
import StatusBadge from "@/app/dashboard/projects/status-badge";
import { ClientPageProject } from "@/app/actions/client-page";

interface ClientPageHeaderProps {
  project: ClientPageProject;
}

export default function ClientPageHeader({ project }: ClientPageHeaderProps) {
  const formatDueDate = () => {
    // Use text date if provided, otherwise format date
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

  const lastUpdated = project.updated_at
    ? formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })
    : null;

  return (
    <div className="space-y-4">
      {/* Client Info */}
      {project.client && (
        <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200">
          <span>{project.client.name}</span>
          {project.client.company && (
            <span className="text-blue-600/70">· {project.client.company}</span>
          )}
        </div>
      )}

      {/* Project Name */}
      <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
        {project.name}
      </h1>

      {/* Status and Metadata */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={project.status} />
        
        {formatDueDate() && (
          <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Due {formatDueDate()}
          </span>
        )}

        {lastUpdated && (
          <span className="text-[var(--muted-foreground)]">
            Last updated {lastUpdated}
          </span>
        )}
      </div>
    </div>
  );
}

