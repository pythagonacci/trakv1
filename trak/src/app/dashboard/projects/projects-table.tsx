"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import EmptyState from "./empty-state";
import StatusBadge from "./status-badge";

interface Project {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  client_name?: string | null;
  created_at: string;
}

interface ProjectsTableProps {
  projects: Project[];
}

export default function ProjectsTable({ projects }: ProjectsTableProps) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Handle row click
  const handleRowClick = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  // Format due date
  const formatDueDate = (dateString: string | null, textDate: string | null) => {
    // If text date exists, show it
    if (textDate) {
      return { text: textDate, isOverdue: false };
    }

    // If date exists, format it
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

  // Empty state
  if (projects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Table Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-neutral-900">All Projects</h2>
        <button className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors">
          New Project
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/50 backdrop-blur-sm border border-neutral-200/40 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-neutral-200/40 bg-neutral-50/50">
          <div className="col-span-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Client
          </div>
          <div className="col-span-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Project
          </div>
          <div className="col-span-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Status
          </div>
          <div className="col-span-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Due Date
          </div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-neutral-200/40">
          {projects.map((project) => {
            const dueDate = formatDueDate(project.due_date_date, project.due_date_text);
            
            return (
              <div
                key={project.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-neutral-50/80 transition-colors cursor-pointer group relative"
                onClick={() => handleRowClick(project.id)}
              >
                {/* Client */}
                <div className="col-span-3 flex items-center">
                  <span className="text-sm text-neutral-600 truncate">
                    {project.client_name || "No client"}
                  </span>
                </div>

                {/* Project Name */}
                <div className="col-span-4 flex items-center">
                  <span className="text-sm font-medium text-neutral-900 truncate">
                    {project.name}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center">
                  <StatusBadge status={project.status} />
                </div>

                {/* Due Date */}
                <div className="col-span-2 flex items-center">
                  <span
                    className={`text-sm truncate ${
                      dueDate.isOverdue
                        ? "text-red-600 font-medium"
                        : "text-neutral-600"
                    }`}
                  >
                    {dueDate.text}
                  </span>
                </div>

                {/* Actions Menu */}
                <div className="col-span-1 flex items-center justify-end">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                      }}
                      className="p-1 hover:bg-neutral-200 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4 text-neutral-600" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === project.id && (
                      <div
                        className="absolute right-0 mt-1 w-40 bg-white border border-neutral-200/40 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            console.log("Edit project:", project.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            console.log("Delete project:", project.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}