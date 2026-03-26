"use client";

import { cn } from "@/lib/utils";

interface ChartEmptyStateProps {
  message?: string;
  className?: string;
}

export function ChartEmptyState({
  message = "No data to display.",
  className,
}: ChartEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-48 flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)]",
        className
      )}
      aria-label="Chart empty state"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="text-[var(--muted-foreground)] opacity-40"
      >
        <rect x="4" y="18" width="6" height="10" rx="1" fill="currentColor" />
        <rect x="13" y="10" width="6" height="18" rx="1" fill="currentColor" />
        <rect x="22" y="14" width="6" height="14" rx="1" fill="currentColor" />
      </svg>
      <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
    </div>
  );
}
