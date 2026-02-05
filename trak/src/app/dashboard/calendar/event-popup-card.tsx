"use client";

import { X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "./calendar-view";

interface EventPopupCardProps {
  event: CalendarEvent;
  onClose: () => void;
  workspaceId: string;
}

export default function EventPopupCard({
  event,
  onClose,
  workspaceId,
}: EventPopupCardProps) {
  const router = useRouter();

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleNavigate = () => {
    if (event.type === "task" && event.projectId && event.tabId) {
      router.push(`/dashboard/projects/${event.projectId}/tabs/${event.tabId}?taskId=${event.taskId}`);
    } else if (event.type === "project" && event.projectId) {
      router.push(`/dashboard/projects/${event.projectId}`);
    } else if (event.type === "google" && event.externalUrl) {
      window.open(event.externalUrl, "_blank", "noopener,noreferrer");
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md rounded-2xl border border-[var(--border)]/30 bg-[var(--surface)]/90 backdrop-blur-2xl shadow-2xl",
          event.type === "task" && event.priority === "urgent" && "border-red-200/50",
          event.type === "task" && event.priority === "high" && "border-orange-200/50",
          event.type === "task" && (!event.priority || event.priority === "none") && "border-blue-200/50",
          event.type === "project" && "border-purple-200/50",
          event.type === "google" && "border-[#4285F4]/40"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-md px-6 py-4 rounded-t-2xl">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {event.title}
              </h2>
              {event.priority && event.priority !== "none" && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    event.priority === "urgent" && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                    event.priority === "high" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                    event.priority === "medium" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                    event.priority === "low" && "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  )}
                >
                  {event.priority}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {formatDate(event.date)}
              {(event.time || event.timeEnd) &&
                ` at ${event.timeEnd ? `${event.time ?? "—"} – ${event.timeEnd}` : (event.time ?? event.timeEnd)}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--tertiary-foreground)]">
                Type
              </p>
              <p className="mt-1 text-sm text-[var(--foreground)] capitalize">
                {event.type === "google" ? "Google Calendar" : event.type}
              </p>
            </div>

            {event.type === "task" && (
              <>
                {event.projectName && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--tertiary-foreground)]">
                      Project
                    </p>
                    <p className="mt-1 text-sm text-[var(--foreground)]">
                      {event.projectName}
                      {event.tabName && ` · ${event.tabName}`}
                    </p>
                  </div>
                )}
              </>
            )}

            {event.type === "google" && event.location && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--tertiary-foreground)]">
                  Location
                </p>
                <p className="mt-1 text-sm text-[var(--foreground)]">{event.location}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-md px-6 py-4 rounded-b-2xl">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {(event.type === "task" || event.type === "project" || event.externalUrl) && (
            <Button size="sm" onClick={handleNavigate} className="gap-2">
              {event.type === "google"
                ? "Open in Google Calendar"
                : `Open ${event.type === "task" ? "Task" : "Project"}`}
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
