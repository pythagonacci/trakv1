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
    <div className="px-16 pt-12 pb-8">
      {/* Back Button - Subtle */}
      <button
        onClick={() => router.push("/dashboard/projects")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 mb-8 transition-colors group"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-medium">Projects</span>
      </button>

      {/* Project Info - Clean, minimal */}
      <div className="flex items-start justify-between group">
        <div className="flex-1 min-w-0">
          {/* Client Name - Subtle, small */}
          {project.client && (
            <div className="text-xs font-medium text-neutral-400 dark:text-neutral-600 mb-3 tracking-wide uppercase">
              {project.client.name}
              {project.client.company && ` • ${project.client.company}`}
            </div>
          )}

          {/* Project Name - Large, elegant */}
          <h1 className="text-5xl font-semibold text-neutral-900 dark:text-white mb-6 tracking-tight leading-tight">
            {project.name}
          </h1>

          {/* Status & Due Date - Minimal dots */}
          <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-500">
            <StatusBadge status={project.status} />
            {dueDate && (
              <>
                <span className="text-neutral-300 dark:text-neutral-700">•</span>
                <span className="font-medium">{dueDate}</span>
              </>
            )}
          </div>
        </div>

        {/* Edit Button - Ghost, minimal */}
        <button
          onClick={() => {
            // TODO: Open edit project dialog
            console.log("Edit project:", project.id);
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-md transition-all opacity-0 group-hover:opacity-100"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}