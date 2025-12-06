"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import StatusBadge from "../../projects/status-badge";

interface Project {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientProjectsProps {
  projects: Project[];
  clientId: string;
}

export default function ClientProjects({ projects, clientId }: ClientProjectsProps) {
  const router = useRouter();

  const formatDueDate = (dateString: string | null, textDate: string | null) => {
    if (textDate) {
      return { text: textDate, isOverdue: false };
    }

    if (dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const isOverdue = date < now;
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return { text: formatted, isOverdue };
    }

    return { text: "No due date", isOverdue: false };
  };

  const handleRowClick = (projectId: string) => {
    router.push(`/dashboard/projects/${projectId}`);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-[var(--surface)] p-3">
          <DollarSign className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
          No projects yet
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
          Projects created for this client will appear here. Create a new project to get started.
        </p>
        <button className="mt-4 inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
          Create project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Projects ({projects.length})
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            All projects associated with this client
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--surface-hover)]">
          New project
        </button>
      </div>

      <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border)] hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Project
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Due Date
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Created
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
              const createdDate = new Date(project.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <TableRow
                  key={project.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  onClick={() => handleRowClick(project.id)}
                >
                  <TableCell className="py-4">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {project.name}
                    </span>
                  </TableCell>

                  <TableCell className="py-4">
                    <StatusBadge status={project.status} />
                  </TableCell>

                  <TableCell className="py-4">
                    <span
                      className={cn(
                        "text-sm",
                        dueDate.isOverdue && "text-red-500 font-medium"
                      )}
                    >
                      {dueDate.text}
                    </span>
                  </TableCell>

                  <TableCell className="py-4">
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {createdDate}
                    </span>
                  </TableCell>

                  <TableCell className="py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/projects/${project.id}`);
                          }}
                        >
                          View project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle edit
                          }}
                        >
                          Edit project
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-sm text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle delete
                          }}
                        >
                          Delete project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}