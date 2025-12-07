"use client";

import { useState, useEffect } from "react";
import StatusBadge from "@/app/dashboard/projects/status-badge";
import { ClientPageProject } from "@/app/actions/client-page";
import { cn } from "@/lib/utils";

interface ClientPageHeaderProps {
  project: ClientPageProject;
  tabId?: string;
}

export default function ClientPageHeader({ project, tabId }: ClientPageHeaderProps) {
  const [tabTheme, setTabTheme] = useState<string>("default");

  // Load theme from localStorage (same as internal)
  useEffect(() => {
    if (typeof window === "undefined" || !tabId) return;
    const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
    if (saved) {
      setTabTheme(saved);
    }
  }, [tabId]);

  // Listen for theme changes (same as internal)
  useEffect(() => {
    if (typeof window === "undefined" || !tabId) return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `trak-tab-theme-${tabId}` && e.newValue) {
        setTabTheme(e.newValue);
      }
    };
    const handleCustomChange = () => {
      const saved = localStorage.getItem(`trak-tab-theme-${tabId}`);
      if (saved) {
        setTabTheme(saved);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tab-theme-updated", handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tab-theme-updated", handleCustomChange);
    };
  }, [tabId]);

  const formatDueDate = () => {
    if (project.due_date_text) {
      return { text: project.due_date_text, isOverdue: false };
    }
    if (project.due_date_date) {
      const date = new Date(project.due_date_date);
      const now = new Date();
      const isOverdue = date < now && date.toDateString() !== now.toDateString();
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return { text: formatted, isOverdue };
    }
    return { text: "No due date", isOverdue: false };
  };

  const dueDate = formatDueDate();

  return (
    <div className="space-y-3">
      {project.client && (
        <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--velvet-purple)]">
          {project.client.name}
          {project.client.company && <span className="text-[var(--velvet-purple)]/70">· {project.client.company}</span>}
        </span>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-[var(--font-serif)]">
        {project.name}
      </h1>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status={project.status} />
        {dueDate.text !== "No due date" && (
          <span className={cn("flex items-center gap-1 text-[var(--foreground)]/70 font-medium",
            dueDate.isOverdue && "text-red-500"
          )}>
            Due {dueDate.text}
          </span>
        )}
      </div>
    </div>
  );
}

