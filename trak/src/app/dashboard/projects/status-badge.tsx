"use client";

import { useThemeOptional } from "@/app/dashboard/theme-context";

interface StatusBadgeProps {
  status: "not_started" | "in_progress" | "complete";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  useThemeOptional();
  
  const styles = {
    not_started: "bg-[var(--status-todo-bg)] text-[var(--status-todo-text)] border border-[var(--border-strong)]",
    in_progress: "bg-[var(--status-inprogress-bg)] text-[var(--status-inprogress-text)] border border-[var(--status-inprogress-text)]/20",
    complete: "bg-[var(--status-done-bg)] text-[var(--status-done-text)] border border-[var(--status-done-text)]/20",
  } as const;

  const labels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
  };

  return (
    <span
      className={`inline-flex items-center rounded-[2px] px-2 py-0.5 text-[10px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
