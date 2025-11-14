"use client";

interface StatusBadgeProps {
  status: "not_started" | "in_progress" | "complete";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    not_started: "bg-[var(--foreground)]/5 text-[var(--foreground)]/70",
    in_progress: "bg-[var(--info)]/10 text-[var(--info)]",
    complete: "bg-[var(--success)]/10 text-[var(--success)]",
  } as const;

  const labels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}