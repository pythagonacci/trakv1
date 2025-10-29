"use client";

interface StatusBadgeProps {
  status: "not_started" | "in_progress" | "complete";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    not_started: "bg-neutral-100 text-neutral-700",
    in_progress: "bg-blue-100 text-blue-700",
    complete: "bg-green-100 text-green-700",
  };

  const labels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}