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

  // Format due date for display
  const formatDueDate = () => {
    if (project.due_date_text) {
      return project.due_date_text;
    }
    if (project.due_date_date) {
      const date = new Date(project.due_date_date);
      const now = new Date();
      const isOverdue = date < now && project.status !== "complete";
      
      return (
        <span className={isOverdue ? "text-red-600" : ""}>
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {isOverdue && " (Overdue)"}
        </span>
      );
    }
    return null;
  };

  const dueDate = formatDueDate();

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard/projects")}
        className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </button>

      {/* Project Info */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Client Name (small, above project name) */}
          {project.client && (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              Client: {project.client.name}
              {project.client.company && ` • ${project.client.company}`}
            </div>
          )}

          {/* Project Name */}
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">
            {project.name}
          </h1>

          {/* Status & Due Date */}
          <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
            <StatusBadge status={project.status} />
            {dueDate && (
              <>
                <span>•</span>
                <span>Due: {dueDate}</span>
              </>
            )}
          </div>
        </div>

        {/* Edit Button */}
        <button
          onClick={() => {
            // TODO: Open edit project dialog
            console.log("Edit project:", project.id);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Edit className="w-4 h-4" />
          Edit Project
        </button>
      </div>
    </div>
  );
}