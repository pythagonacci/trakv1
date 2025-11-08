"use client";

interface StatusBadgeProps {
  status: "not_started" | "in_progress" | "complete";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    not_started: "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
    in_progress: "bg-[#dbeafe] text-[#1d4ed8]",
    complete: "bg-[#dcfce7] text-[#15803d]",
  } as const;

  const labels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}