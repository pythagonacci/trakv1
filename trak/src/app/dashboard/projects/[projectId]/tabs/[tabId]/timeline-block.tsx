"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { Plus, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TimelineEvent {
  id: string;
  title: string;
  start: string; // ISO date
  end: string; // ISO date
  color?: string;
  status?: "planned" | "in-progress" | "blocked" | "done";
  assignee?: string;
  notes?: string;
}

interface TimelineContent {
  startDate: string;
  endDate: string;
  events: TimelineEvent[];
}

interface TimelineBlockProps {
  block: Block;
  onUpdate?: () => void;
  workspaceId: string;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const DEFAULT_COLORS = [
  "bg-neutral-900",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-sky-600",
];

function clampDate(d: Date) {
  return startOfDay(d);
}

function daysBetween(a: Date, b: Date) {
  return Math.max(1, differenceInCalendarDays(clampDate(b), clampDate(a)));
}

function buildGrid(start: Date, end: Date) {
  const cells: { key: string; date: Date; dayLabel: string; monthLabel?: string }[] = [];
  const total = daysBetween(start, end);
  for (let i = 0; i <= total; i++) {
    const date = addDays(start, i);
    const dayLabel = format(date, "d");
    const monthLabel = format(date, "d") === "1" ? format(date, "MMM yyyy") : undefined;
    cells.push({ key: `${date.toISOString()}_${i}`, date, dayLabel, monthLabel });
  }
  return cells;
}

export default function TimelineBlock({ block, onUpdate, workspaceId }: TimelineBlockProps) {
  const content = (block.content || {}) as TimelineContent;

  const range = useMemo(() => {
    const startDate = content.startDate ? new Date(content.startDate) : addDays(new Date(), -7);
    const endDate = content.endDate ? new Date(content.endDate) : addDays(new Date(), 30);
    return {
      start: clampDate(startDate),
      end: clampDate(endDate),
    };
  }, [content.startDate, content.endDate]);

  const events = useMemo(() => content.events || [], [content.events]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load workspace members
  useEffect(() => {
    if (!workspaceId) {
      console.warn('⚠️ No workspaceId provided to TimelineBlock');
      return;
    }

    const loadMembers = async () => {
      const result = await getWorkspaceMembers(workspaceId);
      if (result.data) {
        setMembers(result.data);
      } else if (result.error) {
        console.error('❌ Error loading members:', result.error);
        setMembers([]);
      }
    };

    loadMembers();
  }, [workspaceId]);

  // Mount flag for portal (avoids SSR/TS issues)
  React.useEffect(() => setMounted(true), []);

  // Hide timer to bridge the gap between bar and tooltip
  const hideTimer = useRef<number | null>(null);
  function clearHideTimer() {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }
  function scheduleHide() {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setHoveredEventId(null);
      setTooltipPosition(null);
    }, 120);
  }

  const grid = useMemo(() => buildGrid(range.start, range.end), [range]);
  const totalDays = useMemo(() => daysBetween(range.start, range.end), [range]);

  // Sort events by start date
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  function toCol(date: Date) {
    return Math.max(0, Math.min(totalDays, differenceInCalendarDays(clampDate(date), range.start)));
  }

  function barStyle(startISO: string, endISO: string, rowIndex: number) {
    const s = clampDate(new Date(startISO));
    const e = clampDate(new Date(endISO));
    const startCol = toCol(s);
    const endCol = toCol(e);
    const span = Math.max(1, endCol - startCol + 1);
    return {
      gridColumn: `${startCol + 1} / span ${span}`,
      gridRow: rowIndex + 1,
    };
  }

  const addEvent = () => {
    setIsAddDialogOpen(true);
  };

  const saveNewEvent = async (eventData: Omit<TimelineEvent, "id">) => {
    const newEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      ...eventData,
    };
    const newEvents = [newEvent, ...events];
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    setIsAddDialogOpen(false);
    onUpdate?.();
  };

  const removeEvent = async (id: string) => {
    const newEvents = events.filter((e) => e.id !== id);
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    if (selectedEventId === id) {
      setSelectedEventId(null);
      setIsEditDialogOpen(false);
    }
    onUpdate?.();
  };

  const duplicateEvent = async (id: string) => {
    const src = events.find((e) => e.id === id);
    if (!src) return;
    const copy: TimelineEvent = {
      ...src,
      id: crypto.randomUUID(),
      title: `${src.title} (Copy)`,
      start: addDays(new Date(src.start), 1).toISOString(),
      end: addDays(new Date(src.end), 1).toISOString(),
    };
    const newEvents = [copy, ...events];
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    setSelectedEventId(copy.id);
    setIsEditDialogOpen(true);
    onUpdate?.();
  };

  const updateEvent = async (id: string, patch: Partial<TimelineEvent>) => {
    const newEvents = events.map((e) => (e.id === id ? { ...e, ...patch } : e));
    await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    onUpdate?.();
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // ---- Build tooltip element (or null) once per render; pass into createPortal below ----
  const tooltipEl =
    hoveredEventId && tooltipPosition
      ? (() => {
          const event = sortedEvents.find((e) => e.id === hoveredEventId);
          if (!event) return null;
          return (
            <div
              id="timeline-tooltip"
              className="fixed z-[99999] min-w-[220px] max-w-[320px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--foreground)] shadow-lg pointer-events-auto"
              style={{
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: "translateY(calc(-100% - 8px))",
              }}
              onMouseEnter={() => {
                clearHideTimer();
              }}
              onMouseLeave={(e) => {
                const rt = e.relatedTarget as HTMLElement | null;
                if (rt && rt.closest("[data-event-id]")) return; // going back to a bar
                scheduleHide();
              }}
            >
              <div className="flex items-start gap-2">
                <div className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", event.color || "bg-[var(--foreground)]")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--foreground)]">{event.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
                    {format(new Date(event.start), "MMM d")} – {format(new Date(event.end), "MMM d, yyyy")}
                  </div>
                  {event.assignee && (
                    <div className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
                      Assignee: {event.assignee}
                    </div>
                  )}
                  {event.notes && (
                    <div className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
                      {event.notes}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEventId(event.id);
                    setIsEditDialogOpen(true);
                    setHoveredEventId(null);
                    setTooltipPosition(null);
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateEvent(event.id);
                    setHoveredEventId(null);
                    setTooltipPosition(null);
                  }}
                >
                  Duplicate
                </button>
                <button
                  className="rounded-[4px] border border-[var(--error)]/50 px-2 py-1 text-xs text-[var(--error)] transition-colors hover:bg-[var(--error)]/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEvent(event.id);
                    setHoveredEventId(null);
                    setTooltipPosition(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })()
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Timeline</h2>
          <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
            {format(range.start, "MMM d")} – {format(range.end, "MMM d, yyyy")}
          </div>
        </div>
        <Button size="sm" onClick={addEvent} className="inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add event
        </Button>
      </div>

      <div ref={scrollRef} className="overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="inline-block min-w-0" style={{ minWidth: `${(totalDays + 1) * 44}px` }}>
          {/* Sticky date header */}
          <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]">
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${totalDays + 1}, 44px)` }}
            >
              {grid.map((c) => (
                <div
                  key={`dateheader_${c.key}`}
                  className="flex min-h-[44px] flex-col items-center justify-center border-l border-[var(--border)] py-2 text-[10px] text-[var(--tertiary-foreground)] first:border-l-0"
                >
                  {c.monthLabel ? (
                    <span className="mb-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                      {c.monthLabel}
                    </span>
                  ) : (
                    <span className="mb-0.5" />
                  )}
                  <span>{c.dayLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline grid */}
          <div
            className="relative grid select-none"
            style={{
              gridTemplateColumns: `repeat(${totalDays + 1}, 44px)`,
              gridTemplateRows: `repeat(${Math.max(1, sortedEvents.length)}, minmax(44px, auto))`,
            }}
          >
            {/* Base grid background */}
            {sortedEvents.map((event, eventRowIndex) => (
              <React.Fragment key={`grid_row_${event.id}`}>
                {grid.map((c, idx) => {
                  const cellDate = c.date;
                  const eventStart = clampDate(new Date(event.start));
                  const eventEnd = clampDate(new Date(event.end));
                  const isCovered = cellDate >= eventStart && cellDate <= eventEnd;

                  if (!isCovered) {
                    return (
                      <div
                        key={`grid_${event.id}_${c.key}`}
                        className={cn(
                          idx === grid.length - 1 && "border-r",
                          "pointer-events-none border-[var(--border)]"
                        )}
                        style={{
                          gridColumn: idx + 1,
                          gridRow: eventRowIndex + 1,
                          borderLeft: idx === 0 ? undefined : "1px solid var(--border)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </React.Fragment>
            ))}

            {/* If no events, show empty grid */}
            {sortedEvents.length === 0 &&
              grid.map((c, idx) => (
                <div
                  key={`grid_empty_${c.key}`}
                  className={cn(idx === grid.length - 1 && "border-r", "pointer-events-none border-[var(--border)]")}
                  style={{
                    gridColumn: idx + 1,
                    gridRow: 1,
                    borderLeft: idx === 0 ? undefined : "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                  }}
                />
              ))}

            {/* Events overlay */}
            {sortedEvents.map((it, eventRowIndex) => (
              <div
                key={it.id}
                className="relative z-10 pointer-events-auto"
                style={barStyle(it.start, it.end, eventRowIndex)}
                data-event-id={it.id}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  clearHideTimer();
                  const bar = (e.currentTarget.querySelector(".event-bar") as HTMLElement) ?? (e.currentTarget as HTMLElement);
                  const rect = bar.getBoundingClientRect();
                  setHoveredEventId(it.id);
                  setTooltipPosition({
                    top: rect.top,
                    left: Math.min(rect.left, window.innerWidth - 320 - 8),
                  });
                }}
                onMouseLeave={(e) => {
                  const rt = e.relatedTarget as HTMLElement | null;
                  if (rt && (rt.closest("[data-event-id]") || rt.closest("#timeline-tooltip"))) {
                    return;
                  }
                  scheduleHide();
                }}
              >
                <div
                  className={cn(
                    "event-bar my-2 flex h-8 w-full items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-sm transition-transform",
                    it.color || "bg-[var(--foreground)]"
                  )}
                  onClick={() => {
                    setSelectedEventId(it.id);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
                  <span className="flex-1 truncate">{it.title}</span>
                  {it.status && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" aria-label={`status-${it.status}`} />}
                </div>
              </div>
            ))}

            {/* Empty state when no events */}
            {sortedEvents.length === 0 && (
              <div
                className="py-12 text-center"
                style={{
                  gridColumn: `1 / span ${totalDays + 1}`,
                  gridRow: 1,
                }}
              >
                <p className="text-sm text-[var(--muted-foreground)]">No events yet. Click “Add event” to create your first milestone.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover Tooltip */}
      {mounted && tooltipEl && createPortal(tooltipEl, document.body)}

      {/* Add Event Dialog */}
      <AddEventDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={saveNewEvent}
        defaultStart={range.start}
        defaultEnd={addDays(range.start, 3)}
        members={members}
      />

      {/* Edit Event Dialog */}
      {isEditDialogOpen && selectedEvent && (
        <EditEventDialog
          event={selectedEvent}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          onUpdate={(patch) => {
            updateEvent(selectedEvent.id, patch);
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          onDelete={() => {
            removeEvent(selectedEvent.id);
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          onDuplicate={() => {
            duplicateEvent(selectedEvent.id);
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          members={members}
        />
      )}
    </div>
  );
}

// Add Event Dialog Component
function AddEventDialog({
  isOpen,
  onClose,
  onSave,
  defaultStart,
  defaultEnd,
  members,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<TimelineEvent, "id">) => void;
  defaultStart: Date;
  defaultEnd: Date;
  members: WorkspaceMember[];
}) {
  const getInitialState = React.useCallback(
    () => ({
      title: "New event",
      start: defaultStart.toISOString(),
      end: defaultEnd.toISOString(),
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      status: "planned" as const,
    }),
    [defaultStart, defaultEnd]
  );

  const [local, setLocal] = useState<Omit<TimelineEvent, "id">>(getInitialState);
  const [showColors, setShowColors] = useState(false);

  const dialogKey = isOpen ? `${defaultStart.toISOString()}-${defaultEnd.toISOString()}` : null;

  const handleSave = () => {
    if (!local.title.trim()) return;
    onSave(local);
  };

  React.useEffect(() => {
    if (isOpen) {
      setLocal(getInitialState());
    }
  }, [isOpen, getInitialState]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" key={dialogKey || undefined}>
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Title</label>
            <input
              type="text"
              value={local.title}
              onChange={(e) => setLocal((s) => ({ ...s, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Event title"
              autoFocus
            />
          </div>

          {/* Color & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Color</label>
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    "w-full h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 px-3",
                    local.color || "bg-neutral-900"
                  )}
                  onClick={() => setShowColors((v) => !v)}
                >
                  <div className={cn("h-5 w-5 rounded-full", local.color || "bg-neutral-900")} />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Change</span>
                </button>
                {showColors && (
                  <div className="absolute z-10 mt-2 grid grid-cols-6 gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn("h-8 w-8 rounded-full", c)}
                        onClick={() => {
                          setLocal((s) => ({ ...s, color: c }));
                          setShowColors(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Status</label>
              <select
                value={local.status ?? "planned"}
                onChange={(e) => setLocal((s) => ({ ...s, status: e.target.value as TimelineEvent["status"] }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={format(new Date(local.start), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, start: new Date(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">End Date</label>
              <input
                type="date"
                value={format(new Date(local.end), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, end: new Date(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Assignee (optional)</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-neutral-500" />
                    <span className={cn(local.assignee ? "text-neutral-900 dark:text-white" : "text-neutral-500")}>
                      {local.assignee || "Unassigned"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto z-50">
                <DropdownMenuItem
                  onClick={() => setLocal((s) => ({ ...s, assignee: undefined }))}
                  className="text-neutral-500"
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.length > 0 ? (
                  members.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setLocal((s) => ({ ...s, assignee: member.name }))}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                          {member.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{member.name}</div>
                          <div className="text-xs text-neutral-500 truncate">{member.email}</div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-neutral-400">
                    Loading members...
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={local.notes ?? ""}
              onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Additional details..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!local.title.trim()}>
            Add Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Event Dialog Component
function EditEventDialog({
  event,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  members,
}: {
  event: TimelineEvent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  members: WorkspaceMember[];
}) {
  const getInitialState = React.useCallback(
    () => ({
      title: event.title,
      start: event.start,
      end: event.end,
      color: event.color || DEFAULT_COLORS[0],
      status: (event.status || "planned") as TimelineEvent["status"],
      assignee: event.assignee || "",
      notes: event.notes || "",
    }),
    [event]
  );

  const [local, setLocal] = useState<Omit<TimelineEvent, "id">>(getInitialState);
  const [showColors, setShowColors] = useState(false);

  React.useEffect(() => {
    if (isOpen) setLocal(getInitialState());
  }, [isOpen, getInitialState]);

  const handleSave = () => {
    if (!local.title.trim()) return;
    onUpdate(local);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Title</label>
            <input
              type="text"
              value={local.title}
              onChange={(e) => setLocal((s) => ({ ...s, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Event title"
              autoFocus
            />
          </div>

          {/* Color & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Color</label>
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    "w-full h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 px-3",
                    local.color || "bg-neutral-900"
                  )}
                  onClick={() => setShowColors((v) => !v)}
                >
                  <div className={cn("h-5 w-5 rounded-full", local.color || "bg-neutral-900")} />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Change</span>
                </button>
                {showColors && (
                  <div className="absolute z-10 mt-2 grid grid-cols-6 gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn("h-8 w-8 rounded-full", c)}
                        onClick={() => {
                          setLocal((s) => ({ ...s, color: c }));
                          setShowColors(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Status</label>
              <select
                value={local.status ?? "planned"}
                onChange={(e) => setLocal((s) => ({ ...s, status: e.target.value as TimelineEvent["status"] }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={format(new Date(local.start), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, start: new Date(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">End Date</label>
              <input
                type="date"
                value={format(new Date(local.end), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, end: new Date(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Assignee (optional)</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-neutral-500" />
                    <span className={cn(local.assignee ? "text-neutral-900 dark:text-white" : "text-neutral-500")}>
                      {local.assignee || "Unassigned"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto z-50">
                <DropdownMenuItem
                  onClick={() => setLocal((s) => ({ ...s, assignee: undefined }))}
                  className="text-neutral-500"
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.length > 0 ? (
                  members.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setLocal((s) => ({ ...s, assignee: member.name }))}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                          {member.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{member.name}</div>
                          <div className="text-xs text-neutral-500 truncate">{member.email}</div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-neutral-400">
                    Loading members...
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={local.notes ?? ""}
              onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Additional details..."
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDuplicate}>
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              Delete
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!local.title.trim()}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Event Drawer Component (kept for backwards compatibility but not used)
function EventDrawer({
  event,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  event: TimelineEvent;
  onClose: () => void;
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [local, setLocal] = useState<TimelineEvent>(event);
  const [showColors, setShowColors] = useState(false);

  React.useEffect(() => {
    setLocal(event);
  }, [event]);

  const apply = () => {
    onUpdate(local);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 p-5 flex flex-col gap-4 animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative">
              <button
                className={cn(
                  "h-5 w-5 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900",
                  local.color || "bg-neutral-900"
                )}
                onClick={() => setShowColors((v) => !v)}
                aria-label="Change color"
                title="Change color"
              />
              {showColors && (
                <div className="absolute z-10 mt-2 grid grid-cols-6 gap-2 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      className={cn("h-5 w-5 rounded-full", c)}
                      onClick={() => {
                        setLocal((s) => ({ ...s, color: c }));
                        setShowColors(false);
                      }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="truncate">
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Edit Event</div>
              <input
                className="block w-full text-lg font-semibold text-neutral-800 dark:text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                value={local.title}
                onChange={(e) => setLocal((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDuplicate}
              className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Duplicate
            </button>
            <button
              onClick={onDelete}
              className="px-2 py-1 text-xs rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            Assignee
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Person"
              value={local.assignee ?? ""}
              onChange={(e) => setLocal((s) => ({ ...s, assignee: e.target.value }))}
            />
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            Status
            <select
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={local.status ?? "planned"}
              onChange={(e) => setLocal((s) => ({ ...s, status: e.target.value as TimelineEvent["status"] }))}
            >
              <option value="planned">Planned</option>
              <option value="in-progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            Start
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={format(new Date(local.start), "yyyy-MM-dd")}
              onChange={(e) => setLocal((s) => ({ ...s, start: new Date(e.target.value).toISOString() }))}
            />
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            End
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={format(new Date(local.end), "yyyy-MM-dd")}
              onChange={(e) => setLocal((s) => ({ ...s, end: new Date(e.target.value).toISOString() }))}
            />
          </label>
        </div>

        <label className="text-sm text-neutral-600 dark:text-neutral-400">
          Notes
          <textarea
            className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Details, context…"
            value={local.notes ?? ""}
            onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))}
          />
        </label>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            className="px-3 py-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
