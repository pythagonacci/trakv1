"use client";

import { useThemeOptional } from "@/app/dashboard/theme-context";

interface StatusBadgeProps {
  status: "not_started" | "in_progress" | "complete";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { theme } = useThemeOptional();
  const isBrutalist = theme === "brutalist";
  
  // SARAJEVO ARTS PALETTE for status badges
  const styles = {
    not_started: isBrutalist 
      ? "bg-[var(--river-indigo)]/70 text-white"
      : "bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] border border-[var(--river-indigo)]/20",
    in_progress: isBrutalist
      ? "bg-[var(--tram-yellow)]/70 text-white"
      : "bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)] border border-[var(--tram-yellow)]/20",
    complete: isBrutalist
      ? "bg-[var(--dome-teal)]/70 text-white"
      : "bg-[var(--dome-teal)]/10 text-[var(--dome-teal)] border border-[var(--dome-teal)]/20",
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
