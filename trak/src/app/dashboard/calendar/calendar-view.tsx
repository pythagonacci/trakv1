"use client";

import React, { useState, useMemo, useEffect, useRef, forwardRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import DayDetailsPanel from "./day-details-panel";
import EventPopupCard from "./event-popup-card";
import AddEventDialog, { type AddedCalendarEvent } from "./add-event-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  timeEnd?: string;
  type: "task" | "project" | "google" | "timeline";
  projectId?: string;
  tabId?: string;
  taskId?: string;
  timelineEventId?: string;
  blockId?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  projectName?: string;
  tabName?: string;
  externalUrl?: string;
  location?: string;
}

type ViewType = "month" | "week" | "day";

interface GoogleCalendarApiEvent {
  id: string;
  title: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  htmlLink?: string | null;
  location?: string | null;
}

export type ItemsViewType = "all" | "mine";

interface CalendarViewProps {
  initialEvents: CalendarEvent[];
  workspaceId: string;
  /** When "mine", only tasks assigned to current user (or user's teams) are shown */
  itemsView?: ItemsViewType;
}

// Day view constants and helpers
const HOUR_HEIGHT = 64;
const DAY_GRID_COLORS = {
  teal: { bar: "bg-teal-500", dot: "bg-teal-500", bg: "bg-teal-500/10", ring: "ring-teal-500/25" },
  violet: { bar: "bg-violet-500", dot: "bg-violet-500", bg: "bg-violet-500/10", ring: "ring-violet-500/25" },
  amber: { bar: "bg-amber-500", dot: "bg-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/25" },
  rose: { bar: "bg-rose-500", dot: "bg-rose-500", bg: "bg-rose-500/10", ring: "ring-rose-500/25" },
  slate: { bar: "bg-slate-500", dot: "bg-slate-500", bg: "bg-slate-500/10", ring: "ring-slate-500/25" },
} as const;

type DayViewColor = keyof typeof DAY_GRID_COLORS;

function minutesFromTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTimeLabel(hour24: number): string {
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${h} ${suffix}`;
}

function getEventColor(event: CalendarEvent): DayViewColor {
  if (event.type === "google") return "violet";
  if (event.type === "project") return "slate";
  if (event.type === "timeline") return "amber";
  if (event.priority === "urgent") return "rose";
  if (event.priority === "high") return "amber";
  if (event.priority === "medium") return "teal";
  if (event.priority === "low") return "teal";
  return "teal";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Mini month for quick nav
function MiniMonth({
  date,
  onPick,
}: {
  date: Date;
  onPick: (d: Date) => void;
}) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--foreground)]">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPick(new Date(date.getFullYear(), date.getMonth() - 1, Math.min(date.getDate(), 28)))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPick(new Date(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), 28)))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] text-[var(--muted-foreground)]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === date.getMonth();
          const selected = ymd(d) === ymd(date);
          const today =
            d.getDate() === new Date().getDate() &&
            d.getMonth() === new Date().getMonth() &&
            d.getFullYear() === new Date().getFullYear();

          return (
            <button
              key={ymd(d)}
              onClick={() => onPick(d)}
              type="button"
              className={cn(
                "h-9 rounded-md text-xs transition",
                selected && "bg-[var(--foreground)] text-[var(--background)]",
                !selected && today && "bg-[var(--surface)] text-[var(--foreground)]",
                !selected && !today && "hover:bg-[var(--surface-hover)]",
                !inMonth && !selected && "text-[var(--muted-foreground)]/60"
              )}
              aria-label={d.toDateString()}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Toggle row for Show section
function ToggleRow({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2",
        disabled && "opacity-50"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate text-[var(--foreground)]">{label}</div>
        <div className="text-[11px] text-[var(--muted-foreground)]">{on ? "Visible" : "Hidden"}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-6 w-11 rounded-full transition shrink-0",
          on ? "bg-[var(--foreground)]" : "bg-[var(--border)]"
        )}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition",
            on ? "left-5" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

// Day view event card with color swatch
function DayViewEventCard({
  event,
  top,
  height,
  onClick,
  onMoreClick,
}: {
  event: CalendarEvent;
  top: number;
  height: number;
  onClick: () => void;
  onMoreClick: (e: React.MouseEvent) => void;
}) {
  const color = getEventColor(event);
  const c = DAY_GRID_COLORS[color];
  const source = event.type === "google" ? "Google" : event.type === "timeline" ? "Timeline" : "Trak";

  return (
    <div
      className={cn(
        "absolute left-0 right-0 max-w-[520px] rounded-lg border border-[var(--border)] shadow-sm ring-1 cursor-pointer transition hover:bg-[var(--surface)]/80",
        c.ring,
        c.bg
      )}
      style={{ top: top + 8, height: clamp(height - 8, 36, 999) }}
      onClick={onClick}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg overflow-hidden">
        <div className={cn("h-full", c.bar)} />
      </div>

      <div className="h-full pl-4 pr-3 py-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", c.dot)} />
            <span className="truncate text-sm font-semibold text-[var(--foreground)]">{event.title}</span>
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted-foreground)] truncate">
            {event.time ?? "—"}
            {event.timeEnd ? `–${event.timeEnd}` : ""}
            {event.location ? ` • ${event.location}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-2 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/80">
            {source}
          </span>
          <button
            type="button"
            className="h-7 w-7 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--surface-hover)] flex items-center justify-center"
            onClick={onMoreClick}
            aria-label="More"
          >
            ⋯
          </button>
        </div>
      </div>
    </div>
  );
}

// Day view with quick nav sidebar and full-width grid
const DayView = forwardRef<
  HTMLDivElement,
  {
    currentDate: Date;
    mergedEvents: CalendarEvent[];
    showTrakEvents: boolean;
    setShowTrakEvents: (v: boolean) => void;
    showGoogleEvents: boolean;
    setShowGoogleEvents: (v: boolean) => void;
    googleConnected: boolean;
    showFocusBlocks: boolean;
    setShowFocusBlocks: (v: boolean) => void;
    onDateChange: (d: Date) => void;
    onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
    onAddEvent: () => void;
    isToday: (d: Date) => boolean;
  }
>(function DayView(
  {
    currentDate,
    mergedEvents,
    showTrakEvents,
    setShowTrakEvents,
    showGoogleEvents,
    setShowGoogleEvents,
    googleConnected,
    showFocusBlocks,
    setShowFocusBlocks,
    onDateChange,
    onEventClick,
    onAddEvent,
    isToday,
  },
  ref
) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const [now, setNow] = useState(() => new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToNow = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Scroll to current time when viewing today
  useEffect(() => {
    if (!isToday(currentDate)) {
      hasScrolledToNow.current = false;
      return;
    }
    const container = scrollContainerRef.current;
    if (!container || hasScrolledToNow.current) return;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;
    // Position current time ~2 hours from top of viewport
    const scrollTop = Math.max(0, nowTop - HOUR_HEIGHT * 2);
    container.scrollTop = scrollTop;
    hasScrolledToNow.current = true;
  }, [currentDate, now]);

  // Reset scroll flag when date changes
  useEffect(() => {
    hasScrolledToNow.current = false;
  }, [currentDate]);

  const dateStr = ymd(currentDate);
  const dayEvents = mergedEvents.filter((e) => e.date === dateStr && e.time);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;
  const isTodayDate = isToday(currentDate);
  const dowShort = currentDate.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div ref={ref} className="w-full h-full min-h-0 flex flex-col lg:flex-row gap-0 overflow-hidden">
      {/* Quick nav - flush left/top, not a panel */}
      <aside className="w-full lg:w-[280px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] overflow-auto">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">Quick nav</div>
              <div className="text-xs text-[var(--muted-foreground)]">Jump + filters</div>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Calendars
            </Button>
          </div>
        </div>
        <div className="p-4">
          <MiniMonth date={currentDate} onPick={onDateChange} />
          <div className="mt-4">
            <div className="text-xs font-semibold text-[var(--foreground)] mb-2">Show</div>
            <div className="space-y-2">
              <ToggleRow label="Trak events" on={showTrakEvents} onChange={setShowTrakEvents} />
              <ToggleRow
                label="Google events"
                on={showGoogleEvents}
                onChange={setShowGoogleEvents}
                disabled={!googleConnected}
              />
              <ToggleRow label="Focus blocks" on={showFocusBlocks} onChange={setShowFocusBlocks} />
            </div>
          </div>
        </div>
      </aside>

      {/* Day grid - full width, top connects to header (no top corners) */}
      <section className="flex-1 min-w-0 rounded-b-md border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden flex flex-col">
        {/* Day header row */}
        <div className="border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          <div className="grid grid-cols-[72px_1fr]">
            <div className="border-r border-[var(--border)] px-3 py-3 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)]">
                <div className="text-center leading-tight">
                  <div className="text-[10px] opacity-80">{dowShort}</div>
                  <div className="text-sm font-semibold">{currentDate.getDate()}</div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">Your day</span>
                  {isTodayDate && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--foreground)]">
                      Today
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Drag to create • Click to edit • Source tags are preserved
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 text-sm">
                  Search
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-sm">
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Grid body */}
        <div ref={scrollContainerRef} className="relative flex-1 overflow-auto min-h-0">
          <div className="grid grid-cols-[72px_1fr]">
            {/* Time gutter */}
            <div className="relative border-r border-[var(--border)]">
              {hours.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <div className="absolute -top-2 right-3 text-[11px] text-[var(--muted-foreground)] select-none">
                    {formatTimeLabel(h)}
                  </div>
                </div>
              ))}
            </div>

            {/* Main day lane */}
            <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
              {/* Grid lines */}
              {hours.map((h) => (
                <div key={h} data-hour={h} className="absolute left-0 right-0" style={{ top: h * HOUR_HEIGHT }}>
                  <div className="h-px bg-[var(--border)]" />
                </div>
              ))}

              {/* Current time indicator */}
              {isTodayDate && nowMinutes >= 0 && nowMinutes < 24 * 60 && (
                <div className="absolute left-0 right-0 z-10" style={{ top: nowTop }}>
                  <div className="relative">
                    <div className="absolute -left-2 top-[-4px] h-2 w-2 rounded-full bg-rose-500" />
                    <div className="h-px bg-rose-500" />
                    <div className="absolute right-3 -top-3 text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-200">
                      Now • {pad2(now.getHours())}:{pad2(now.getMinutes())}
                    </div>
                  </div>
                </div>
              )}

              {/* Events */}
              <div className="absolute inset-0 px-3 py-2">
                {dayEvents.map((ev) => {
                  const startM = ev.time ? minutesFromTime(ev.time) : 0;
                  const endM = ev.timeEnd ? minutesFromTime(ev.timeEnd) : startM + 60;
                  const durM = Math.max(15, endM - startM);
                  const top = (startM / 60) * HOUR_HEIGHT;
                  const height = (durM / 60) * HOUR_HEIGHT;

                  return (
                    <DayViewEventCard
                      key={ev.id}
                      event={ev}
                      top={top}
                      height={height}
                      onClick={() => onEventClick(ev, { stopPropagation: () => {} } as React.MouseEvent)}
                      onMoreClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev, e);
                      }}
                    />
                  );
                })}

                {dayEvents.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      No events • Drag on the grid to create one
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--muted-foreground)]">
              Tip: use color swatches to reduce noisy badges.
            </div>
            <Button variant="outline" size="sm" className="h-9 text-sm" onClick={onAddEvent}>
              Import
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
});

export default function CalendarView({
  initialEvents,
  workspaceId,
  itemsView = "all",
}: CalendarViewProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [showTrakEvents, setShowTrakEvents] = useState(true);
  const [showFocusBlocks, setShowFocusBlocks] = useState(false);
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [addEventDate, setAddEventDate] = useState<Date | undefined>(undefined);
  const [addEventTime, setAddEventTime] = useState<string | undefined>(undefined);
  const [addEventTimeEnd, setAddEventTimeEnd] = useState<string | undefined>(undefined);

  // SARAJEVO ARTS PALETTE for calendar events (single light theme)
  const getEventClassName = (event: CalendarEvent, textSize: string = "text-[10px]") => {
    const baseClasses = `rounded-[2px] px-2 py-1 ${textSize} font-medium cursor-pointer transition-all hover:scale-[1.01] hover:shadow-sm`;
    
    if (event.type === "google") {
      return `${baseClasses} bg-[#4285F4]/10 text-[#1a73e8] border border-[#4285F4]/25`;
    }

    if (event.type === "project") {
      return `${baseClasses} bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)] border border-[var(--velvet-purple)]/25`;
    }

    if (event.type === "timeline") {
      return `${baseClasses} bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)] border border-[var(--tram-yellow)]/25`;
    }
    
    if (event.priority === "urgent") {
      return `${baseClasses} bg-[var(--tile-orange)]/10 text-[var(--tile-orange)] border border-[var(--tile-orange)]/25`;
    }
    
    if (event.priority === "high") {
      return `${baseClasses} bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)] border border-[var(--tram-yellow)]/25`;
    }
    
    if (event.priority === "medium") {
      return `${baseClasses} bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] border border-[var(--river-indigo)]/25`;
    }
    
    if (event.priority === "low") {
      return `${baseClasses} bg-[var(--dome-teal)]/10 text-[var(--dome-teal)] border border-[var(--dome-teal)]/25`;
    }
    
    // Default/no priority - use River Indigo
    return `${baseClasses} bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] border border-[var(--river-indigo)]/25`;
  };
  const dayViewRef = useRef<HTMLDivElement>(null);
  const hasScrolledToStart = useRef(false);

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toLocalTimeString = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const mergedEvents = useMemo(
    () => [
      ...(showTrakEvents ? events : []),
      ...(showGoogleEvents ? googleEvents : []),
    ],
    [events, googleEvents, showTrakEvents, showGoogleEvents]
  );

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = toLocalDateString(date);
    return mergedEvents.filter((event) => event.date === dateStr);
  };

  // Get events for a specific date that start in a given hour (for week view grid)
  const getEventsForDateAndHour = (date: Date, hour: number): CalendarEvent[] => {
    const dayEvents = getEventsForDate(date);
    return dayEvents.filter((event) => {
      if (!event.time) return false;
      const [h] = event.time.split(":").map(Number);
      return h === hour;
    });
  };

  // All-day events for a date (no time or full-day)
  const getAllDayEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = toLocalDateString(date);
    return mergedEvents.filter((event) => event.date === dateStr && !event.time && !event.timeEnd);
  };

  // Navigate to previous/next period
  const navigatePeriod = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewType === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    } else if (viewType === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format date for display
  const formatDateHeader = (): string => {
    if (viewType === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (viewType === "week") {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
  };

  // Get start of week
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Generate days for month view
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [currentDate]);

  // Generate days for week view
  const weekDays = useMemo(() => {
    const weekStart = getWeekStart(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  // Handle day click
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
  };

  // Handle add event from day click
  const handleAddEventFromDay = (date: Date, time?: string) => {
    setAddEventDate(date);
    setAddEventTime(time);
    setAddEventDialogOpen(true);
    setSelectedDate(null);
  };

  // Refresh events after adding
  const handleEventAdded = (event?: AddedCalendarEvent) => {
    if (event && itemsView === "all") {
      setEvents((previous) => {
        if (previous.some((existing) => existing.id === event.id)) return previous;
        return [...previous, event];
      });
    }
    // Re-sync from the server so filtered views and related entities stay correct.
    router.refresh();
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setSelectedDate(null);
  };

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is in current month (for month view)
  const isCurrentMonth = (date: Date | null): boolean => {
    if (!date) return false;
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  // Scroll to 7 AM when day view loads
  useEffect(() => {
    if (viewType === "day" && dayViewRef.current && !hasScrolledToStart.current) {
      // Find the 7 AM hour element and scroll to it
      const sevenAMElement = dayViewRef.current.querySelector('[data-hour="7"]');
      if (sevenAMElement) {
        sevenAMElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        hasScrolledToStart.current = true;
      }
    }
    
    // Reset scroll flag when switching views or dates
    if (viewType !== "day") {
      hasScrolledToStart.current = false;
    }
  }, [viewType, currentDate]);

  // Reset scroll flag when date changes in day view
  useEffect(() => {
    if (viewType === "day") {
      hasScrolledToStart.current = false;
    }
  }, [currentDate, viewType]);

  const getVisibleRange = () => {
    if (viewType === "month") {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    if (viewType === "week") {
      const start = getWeekStart(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const mapGoogleEvent = (event: GoogleCalendarApiEvent): CalendarEvent | null => {
    if (!event.start?.date && !event.start?.dateTime) return null;
    if (event.start?.date) {
      return {
        id: `google-${event.id}`,
        title: event.title || "Untitled Event",
        date: event.start.date,
        type: "google",
        externalUrl: event.htmlLink || undefined,
        location: event.location || undefined,
      };
    }

    const startDate = new Date(event.start.dateTime as string);
    const endDate = event.end?.dateTime ? new Date(event.end.dateTime) : null;

    return {
      id: `google-${event.id}`,
      title: event.title || "Untitled Event",
      date: toLocalDateString(startDate),
      time: toLocalTimeString(startDate),
      timeEnd: endDate ? toLocalTimeString(endDate) : undefined,
      type: "google",
      externalUrl: event.htmlLink || undefined,
      location: event.location || undefined,
    };
  };

  const fetchGoogleEvents = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const { start, end } = getVisibleRange();
      const response = await fetch(
        `/api/integrations/google-calendar/events?workspace_id=${encodeURIComponent(
          workspaceId
        )}&rangeStart=${encodeURIComponent(
          start.toISOString()
        )}&rangeEnd=${encodeURIComponent(end.toISOString())}`
      );

      const data = await response.json();
      setGoogleAvailable(data.available ?? true);
      setGoogleConnected(Boolean(data.connected));
      setGoogleAccountEmail(data.accountEmail ?? null);

      if (!response.ok) {
        setGoogleEvents([]);
        setGoogleError(data.error || "Failed to load Google Calendar");
        return;
      }

      if (!data.connected) {
        setGoogleEvents([]);
        return;
      }

      const mappedEvents = (data.events || [])
        .map((event: GoogleCalendarApiEvent) => mapGoogleEvent(event))
        .filter(Boolean) as CalendarEvent[];

      setGoogleEvents(mappedEvents);
    } catch (err) {
      console.error("Failed to load Google events:", err);
      setGoogleEvents([]);
      setGoogleError("Failed to load Google Calendar");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    fetchGoogleEvents();
  }, [currentDate, viewType]);

  const handleDisconnectGoogle = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const response = await fetch("/api/integrations/google-calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!response.ok) {
        const data = await response.json();
        setGoogleError(data.error || "Failed to disconnect Google Calendar");
        return;
      }
      setGoogleConnected(false);
      setGoogleAccountEmail(null);
      setGoogleEvents([]);
    } catch (err) {
      console.error("Failed to disconnect Google Calendar:", err);
      setGoogleError("Failed to disconnect Google Calendar");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)]/50 bg-[var(--surface)]/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Calendar</h1>
            <Button
              size="sm"
              onClick={() => {
                setAddEventDate(undefined);
                setAddEventTime(undefined);
                setAddEventTimeEnd(undefined);
                setAddEventDialogOpen(true);
              }}
              className="gap-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Event
            </Button>
            {/* Theme picker removed; calendar uses Sarajevo theme globally */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5">
                <Button
                  variant={itemsView === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => router.push("/dashboard/calendar")}
                  className="text-xs px-3 gap-1.5"
                >
                  All
                </Button>
                <Button
                  variant={itemsView === "mine" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => router.push("/dashboard/calendar?view=mine")}
                  className="text-xs px-3 gap-1.5"
                  title="Tasks assigned to you or teams you're in"
                >
                  <User className="h-3.5 w-3.5" />
                  Mine
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-xs"
              >
                Today
              </Button>
              <div className="flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5">
                <Button
                  variant={viewType === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewType("month")}
                  className="text-xs px-3"
                >
                  Month
                </Button>
                <Button
                  variant={viewType === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewType("week")}
                  className="text-xs px-3"
                >
                  Week
                </Button>
                <Button
                  variant={viewType === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewType("day")}
                  className="text-xs px-3"
                >
                  Day
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {googleAvailable ? (
                googleConnected ? (
                  <>
                    <span className="hidden xl:inline text-xs text-[var(--muted-foreground)]">
                      Google: {googleAccountEmail || "Connected"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGoogleEvents((prev) => !prev)}
                      disabled={googleLoading}
                      className="text-xs"
                    >
                      {showGoogleEvents ? "Hide Google" : "Show Google"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnectGoogle}
                      disabled={googleLoading}
                      className="text-xs"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2 text-xs" asChild>
                    <a
                      href={`/api/integrations/google-calendar/connect?workspace_id=${encodeURIComponent(
                        workspaceId
                      )}`}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      Connect Google
                    </a>
                  </Button>
                )
              ) : (
                <span className="text-xs text-[var(--muted-foreground)]">
                  Google Calendar not configured
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigatePeriod("prev")}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[200px] text-center text-sm font-medium">
              {formatDateHeader()}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigatePeriod("next")}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {googleError && (
          <div className="mt-2 text-xs text-red-500">{googleError}</div>
        )}
      </div>

      {/* Calendar Grid */}
      <div 
        className={cn(
          "flex-1 min-h-0 transition-all duration-300",
          viewType === "day"
            ? "overflow-hidden flex flex-col pl-0 pt-0 pr-4 pb-4 md:pr-6 md:pb-6"
            : "overflow-auto p-4 md:p-6"
        )}
        style={{ background: "var(--background)" }}
      >
        {viewType === "month" && (
          <div className="grid h-full grid-cols-7 gap-2">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="flex items-center justify-center py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {monthDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="min-h-[calc((100vh-8rem)/4)] rounded-md" />;
              }

              const dayEvents = getEventsForDate(date);
              const isTodayDate = isToday(date);
              const isCurrentMonthDate = isCurrentMonth(date);

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "min-h-[calc((100vh-8rem)/4)] rounded-xl border border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-sm p-2.5 shadow-sm transition-all hover:border-[var(--border)]/60 hover:bg-[var(--surface)]/80 hover:shadow-xl hover:shadow-black/5 cursor-pointer",
                    !isCurrentMonthDate && "opacity-30",
                    isTodayDate && "border-2 border-blue-400/50 bg-gradient-to-br from-blue-50/80 to-blue-100/40 dark:from-blue-950/30 dark:to-blue-900/20 shadow-lg shadow-blue-500/10 backdrop-blur-md"
                  )}
                >
                  <div className={cn(
                    "mb-1.5 text-sm font-semibold text-[var(--foreground)]",
                    isTodayDate && "text-blue-600 dark:text-blue-400"
                  )}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className={cn(
                          "truncate",
                          getEventClassName(event, "text-[10px]")
                        )}
                      >
                        {(event.time || event.timeEnd) && `${event.timeEnd ? `${event.time ?? "—"} – ${event.timeEnd} ` : `${event.time ?? event.timeEnd} `}`}
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewType === "week" && (
          <div className="flex flex-col h-full min-h-[480px] rounded-b-xl border border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-sm shadow-md overflow-hidden">
            {/* Top row: time gutter + day headers */}
            <div className="grid grid-cols-[4rem_1fr] flex-shrink-0 border-b border-[var(--border)]/30 bg-[var(--surface)]/80">
              <div className="border-r border-[var(--border)]/30 px-2 py-2 text-xs font-medium text-[var(--muted-foreground)]" />
              <div className="grid grid-cols-7 divide-x divide-[var(--border)]/30">
                {weekDays.map((date) => {
                  const isTodayDate = isToday(date);
                  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = date.getDate();
                  return (
                    <div
                      key={date.toISOString()}
                      onClick={() => handleDayClick(date)}
                      className={cn(
                        "px-2 py-2 text-center cursor-pointer hover:bg-[var(--surface-hover)]/50",
                        isTodayDate && "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      )}
                    >
                      <div className="text-xs font-medium text-[var(--muted-foreground)]">{dayName}</div>
                      <div className={cn("text-lg font-semibold", isTodayDate && "text-blue-600 dark:text-blue-400")}>{dayNum}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All-day row */}
            <div className="grid grid-cols-[4rem_1fr] flex-shrink-0 border-b border-[var(--border)]/30 min-h-[2rem]">
              <div className="border-r border-[var(--border)]/30 px-2 py-1.5 text-[10px] text-[var(--muted-foreground)] font-medium flex items-center">
                All day
              </div>
              <div className="grid grid-cols-7 divide-x divide-[var(--border)]/20 min-h-[2rem]">
                {weekDays.map((date) => {
                  const allDayEvents = getAllDayEventsForDate(date);
                  return (
                    <div
                      key={date.toISOString()}
                      className="p-1 space-y-0.5 overflow-hidden"
                    >
                      {allDayEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => handleEventClick(event, e)}
                          className={cn("truncate px-1.5 py-0.5 rounded", getEventClassName(event, "text-[10px]"))}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable time grid: one row per hour, time label + 7 day cells */}
            <div className="flex-1 overflow-auto min-h-0">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[4rem_1fr] min-h-[3rem] border-b border-[var(--border)]/20"
                >
                  {/* Time label (sticky left) */}
                  <div className="sticky left-0 z-10 flex items-start justify-end border-r border-[var(--border)]/30 bg-[var(--surface)]/95 pr-2 pt-0.5 text-[10px] text-[var(--muted-foreground)]">
                    {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                  </div>

                  {/* 7 day cells for this hour */}
                  <div className="grid grid-cols-7 divide-x divide-[var(--border)]/20 min-w-0">
                    {weekDays.map((date) => {
                      const slotDate = new Date(date);
                      slotDate.setHours(hour, 0, 0, 0);
                      const timeStr = `${String(hour).padStart(2, "0")}:00`;
                      const hourEvents = getEventsForDateAndHour(date, hour);
                      const isTodayDate = isToday(date);

                      return (
                        <div
                          key={date.toISOString()}
                          onClick={() => handleAddEventFromDay(slotDate, timeStr)}
                          className={cn(
                            "min-h-[3rem] p-1 cursor-pointer transition-colors hover:bg-[var(--surface-hover)]/40",
                            isTodayDate && "bg-blue-500/5"
                          )}
                        >
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event, e);
                              }}
                              className={cn(
                                "mb-0.5 px-1.5 py-1 rounded truncate",
                                getEventClassName(event, "text-[10px]")
                              )}
                            >
                              <span className="font-medium">{event.title}</span>
                              {event.timeEnd && (
                                <span className="opacity-75 text-[9px] ml-1">
                                  – {event.timeEnd}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewType === "day" && (
          <div className="flex-1 min-h-0 flex">
          <DayView
            ref={dayViewRef}
            currentDate={currentDate}
            mergedEvents={mergedEvents}
            showTrakEvents={showTrakEvents}
            setShowTrakEvents={setShowTrakEvents}
            showGoogleEvents={showGoogleEvents}
            setShowGoogleEvents={setShowGoogleEvents}
            googleConnected={googleConnected}
            showFocusBlocks={showFocusBlocks}
            setShowFocusBlocks={setShowFocusBlocks}
            onDateChange={setCurrentDate}
            onEventClick={handleEventClick}
            onAddEvent={() => setAddEventDialogOpen(true)}
            isToday={isToday}
          />
          </div>
        )}
      </div>

      {/* Side Panel */}
      {selectedDate && (
        <DayDetailsPanel
          date={selectedDate}
          events={getEventsForDate(selectedDate)}
          onClose={() => setSelectedDate(null)}
          onEventClick={handleEventClick}
          onAddEvent={handleAddEventFromDay}
          workspaceId={workspaceId}
        />
      )}

      {/* Event Popup */}
      {selectedEvent && (
        <EventPopupCard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          workspaceId={workspaceId}
        />
      )}

      {/* Add Event Dialog */}
      <AddEventDialog
        open={addEventDialogOpen}
        onClose={() => {
          setAddEventDialogOpen(false);
          setAddEventDate(undefined);
          setAddEventTime(undefined);
          setAddEventTimeEnd(undefined);
        }}
        initialDate={addEventDate}
        initialTime={addEventTime}
        initialTimeEnd={addEventTimeEnd}
        workspaceId={workspaceId}
        onEventAdded={handleEventAdded}
      />
    </div>
  );
}
