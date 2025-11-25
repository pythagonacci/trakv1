"use client";

import { X, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "./calendar-view";

interface DayDetailsPanelProps {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
  onAddEvent?: (date: Date) => void;
  workspaceId: string;
}

export default function DayDetailsPanel({
  date,
  events,
  onClose,
  onEventClick,
  onAddEvent,
  workspaceId,
}: DayDetailsPanelProps) {
  const router = useRouter();

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleEventNavigate = (event: CalendarEvent) => {
    if (event.type === "task" && event.projectId && event.tabId) {
      router.push(`/dashboard/projects/${event.projectId}/tabs/${event.tabId}?taskId=${event.taskId}`);
    } else if (event.type === "project" && event.projectId) {
      router.push(`/dashboard/projects/${event.projectId}`);
    }
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-[var(--border)]/30 bg-[var(--surface)]/90 backdrop-blur-2xl shadow-2xl">
        <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-md px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isToday(date) ? "Today" : formatDate(date)}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {events.length} {events.length === 1 ? "event" : "events"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onAddEvent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onAddEvent(date);
                  onClose();
                }}
                className="gap-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                Nothing to do yet!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events
                .sort((a, b) => {
                  if (a.time && b.time) {
                    return a.time.localeCompare(b.time);
                  }
                  if (a.time) return -1;
                  if (b.time) return 1;
                  return 0;
                })
                .map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      handleEventNavigate(event);
                      onEventClick(event, e);
                    }}
                    className={cn(
                      "group cursor-pointer rounded-xl border border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-sm p-4 transition-all hover:border-[var(--border)]/60 hover:bg-[var(--surface)]/80 hover:shadow-lg hover:scale-[1.02]",
                      event.type === "task" && event.priority === "urgent" && "border-red-200/50 bg-red-50/60 dark:bg-red-950/30 dark:border-red-800/30",
                      event.type === "task" && event.priority === "high" && "border-orange-200/50 bg-orange-50/60 dark:bg-orange-950/30 dark:border-orange-800/30",
                      event.type === "task" && (!event.priority || event.priority === "none") && "border-blue-200/50 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-800/30",
                      event.type === "project" && "border-purple-200/50 bg-purple-50/60 dark:bg-purple-950/30 dark:border-purple-800/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                            {event.title}
                          </h3>
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
                        {event.time && (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {event.time}
                          </p>
                        )}
                        {event.type === "task" && event.projectName && (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {event.projectName}
                            {event.tabName && ` · ${event.tabName}`}
                          </p>
                        )}
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                          {event.type === "task" ? "Task" : "Project"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

