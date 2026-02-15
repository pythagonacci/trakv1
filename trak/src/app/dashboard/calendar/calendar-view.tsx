"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import DayDetailsPanel from "./day-details-panel";
import EventPopupCard from "./event-popup-card";
import AddEventDialog from "./add-event-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/app/dashboard/theme-context";

const CALENDAR_THEMES = [
  {
    id: "default",
    label: "Default",
    pageBg: "linear-gradient(to bottom, var(--surface)/40, var(--surface-muted)/20)",
  },
  {
    id: "sand",
    label: "Sand",
    pageBg: "linear-gradient(135deg, #fdfbf5 0%, #f7fbff 50%, #eef6ff 100%)",
  },
  {
    id: "foam",
    label: "Foam",
    pageBg: "linear-gradient(135deg, #f8fffd 0%, #f5fbff 50%, #eef5ff 100%)",
  },
  {
    id: "cloud",
    label: "Cloud",
    pageBg: "linear-gradient(135deg, #f9fbff 0%, #f5f7fb 50%, #eef1f6 100%)",
  },
  {
    id: "lavender",
    label: "Lavender",
    pageBg: "linear-gradient(135deg, #f5f3ff 0%, #f3f0ff 50%, #ede9fe 100%)",
  },
  {
    id: "rose",
    label: "Rose",
    pageBg: "linear-gradient(135deg, #fef7f0 0%, #fef2f2 50%, #fef1f1 100%)",
  },
];

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  timeEnd?: string;
  type: "task" | "project" | "google";
  projectId?: string;
  tabId?: string;
  taskId?: string;
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

interface CalendarViewProps {
  initialEvents: CalendarEvent[];
  workspaceId: string;
}

export default function CalendarView({ initialEvents, workspaceId }: CalendarViewProps) {
  const router = useRouter();
  const { theme } = useTheme();
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
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [addEventDate, setAddEventDate] = useState<Date | undefined>(undefined);
  const [addEventTime, setAddEventTime] = useState<string | undefined>(undefined);
  const [addEventTimeEnd, setAddEventTimeEnd] = useState<string | undefined>(undefined);
  const [calendarTheme, setCalendarTheme] = useState<string>("default");

  // SARAJEVO ARTS PALETTE for calendar events
  const getEventClassName = (event: CalendarEvent, textSize: string = "text-[10px]") => {
    const isBrutalist = theme === "brutalist";
    const baseClasses = `rounded-[2px] px-2 py-1 ${textSize} font-medium cursor-pointer transition-all hover:scale-[1.01] hover:shadow-sm`;
    
    if (event.type === "google") {
      return isBrutalist
        ? `${baseClasses} text-white bg-[#4285F4]/80`
        : `${baseClasses} bg-[#4285F4]/10 text-[#1a73e8] border border-[#4285F4]/25`;
    }

    if (event.type === "project") {
      return isBrutalist
        ? `${baseClasses} text-white bg-[var(--velvet-purple)]/70`
        : `${baseClasses} bg-[var(--velvet-purple)]/10 text-[var(--velvet-purple)] border border-[var(--velvet-purple)]/25`;
    }
    
    if (event.priority === "urgent") {
      return isBrutalist
        ? `${baseClasses} text-white bg-[var(--tile-orange)]/80`
        : `${baseClasses} bg-[var(--tile-orange)]/10 text-[var(--tile-orange)] border border-[var(--tile-orange)]/25`;
    }
    
    if (event.priority === "high") {
      return isBrutalist
        ? `${baseClasses} text-white bg-[var(--tram-yellow)]/70`
        : `${baseClasses} bg-[var(--tram-yellow)]/10 text-[var(--tram-yellow)] border border-[var(--tram-yellow)]/25`;
    }
    
    if (event.priority === "medium") {
      return isBrutalist
        ? `${baseClasses} text-white bg-[var(--river-indigo)]/70`
        : `${baseClasses} bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] border border-[var(--river-indigo)]/25`;
    }
    
    if (event.priority === "low") {
      return isBrutalist
        ? `${baseClasses} text-white bg-[var(--dome-teal)]/60`
        : `${baseClasses} bg-[var(--dome-teal)]/10 text-[var(--dome-teal)] border border-[var(--dome-teal)]/25`;
    }
    
    // Default/no priority - use River Indigo
    return isBrutalist
      ? `${baseClasses} text-white bg-[var(--river-indigo)]/70`
      : `${baseClasses} bg-[var(--river-indigo)]/10 text-[var(--river-indigo)] border border-[var(--river-indigo)]/25`;
  };
  const dayViewRef = useRef<HTMLDivElement>(null);
  const hasScrolledToStart = useRef(false);

  // Theme persistence (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("trak-calendar-theme");
    if (saved && CALENDAR_THEMES.some((t) => t.id === saved)) {
      setCalendarTheme(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("trak-calendar-theme", calendarTheme);
  }, [calendarTheme]);

  const currentTheme = useMemo(
    () => CALENDAR_THEMES.find((t) => t.id === calendarTheme) || CALENDAR_THEMES[0],
    [calendarTheme]
  );

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
    () => (showGoogleEvents ? [...events, ...googleEvents] : events),
    [events, googleEvents, showGoogleEvents]
  );

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = toLocalDateString(date);
    return mergedEvents.filter((event) => event.date === dateStr);
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
  const handleEventAdded = () => {
    // Refresh the page to get updated events
    router.refresh();
    window.location.reload();
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
        `/api/integrations/google-calendar/events?rangeStart=${encodeURIComponent(
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
      const response = await fetch("/api/integrations/google-calendar", { method: "DELETE" });
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <Palette className="h-3.5 w-3.5" />
                  Theme
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Background Theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CALENDAR_THEMES.map((theme) => (
                  <DropdownMenuItem
                    key={theme.id}
                    onClick={() => setCalendarTheme(theme.id)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border border-[var(--border)] flex-shrink-0",
                        calendarTheme === theme.id && "ring-2 ring-[var(--foreground)]"
                      )}
                      style={{ background: theme.pageBg }}
                    />
                    <span>{theme.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2">
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
                    <a href="/api/integrations/google-calendar/connect">
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
        className="flex-1 overflow-auto p-4 md:p-6 min-h-0 transition-all duration-300"
        style={{ background: currentTheme.pageBg }}
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
          <div className="grid grid-rows-[auto_1fr] grid-cols-7 gap-2 h-full">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="row-start-1 flex items-center justify-center border-b border-[var(--border)]/30 pb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
              >
                {day}
              </div>
            ))}

            {/* Week days */}
            {weekDays.map((date, index) => {
              const dayEvents = getEventsForDate(date);
              const isTodayDate = isToday(date);
              const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
              const dayNumber = date.getDate();

              return (
                  <div
                    key={date.toISOString()}
                    className="row-start-2 flex flex-col rounded-xl border border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-sm shadow-md shadow-black/5 min-h-0 transition-shadow hover:shadow-lg hover:shadow-black/10"
                    style={{ gridColumn: index + 1 }}
                  >
                    <div
                      onClick={() => handleDayClick(date)}
                      className={cn(
                        "flex-shrink-0 sticky top-0 z-10 border-b border-[var(--border)]/30 bg-[var(--surface)]/80 backdrop-blur-md px-3 py-3 text-center rounded-t-xl",
                        isTodayDate && "bg-gradient-to-br from-blue-50/90 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium text-[var(--muted-foreground)]",
                        isTodayDate && "text-blue-600 dark:text-blue-400"
                      )}>
                        {dayName}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold",
                        isTodayDate && "text-blue-600 dark:text-blue-400"
                      )}>
                        {dayNumber}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 p-2 overflow-y-auto min-h-0">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => handleEventClick(event, e)}
                        className={cn(
                          "px-2 py-1.5",
                          getEventClassName(event, "text-xs")
                        )}
                      >
                        <div className="font-medium">{event.title}</div>
                        {(event.time || event.timeEnd) && (
                          <div className="text-[10px] opacity-75">
                            {event.timeEnd ? `${event.time ?? "—"} – ${event.timeEnd}` : (event.time ?? event.timeEnd)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewType === "day" && (
          <div className="mx-auto max-w-4xl" ref={dayViewRef}>
            <div className="rounded-xl border border-[var(--border)]/30 bg-[var(--surface)]/60 backdrop-blur-xl shadow-xl shadow-black/10">
              {/* Day header */}
              <div
                onClick={() => handleDayClick(currentDate)}
                className={cn(
                  "border-b border-[var(--border)]/30 bg-[var(--surface)]/80 backdrop-blur-md px-6 py-4 rounded-t-xl",
                  isToday(currentDate) && "bg-[var(--dome-teal)]/5"
                )}
              >
                <div className={cn(
                  "text-sm font-medium text-[var(--muted-foreground)]",
                  isToday(currentDate) && "text-[var(--dome-teal)]"
                )}>
                  {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>

              {/* Hour slots */}
              <div className="divide-y divide-[var(--border)]/20 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const hourDate = new Date(currentDate);
                  hourDate.setHours(hour, 0, 0, 0);
                  const hourEvents = getEventsForDate(currentDate).filter((event) => {
                    if (!event.time) return false;
                    const [hours] = event.time.split(":").map(Number);
                    return hours === hour;
                  });

                  return (
                    <div key={hour} data-hour={hour} className="flex min-h-[60px] hover:bg-[var(--surface)]/30 transition-colors">
                      <div className="w-20 border-r border-[var(--border)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                        {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                      </div>
                      <div className="flex-1 p-2">
                        {hourEvents.map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => handleEventClick(event, e)}
                            className={cn(
                              "mb-1.5 px-2.5 py-1.5",
                              getEventClassName(event, "text-xs")
                            )}
                          >
                            <div className="font-medium">{event.title}</div>
                            {(event.time || event.timeEnd) && (
                              <div className="text-[10px] opacity-75">
                                {event.timeEnd ? `${event.time ?? "—"} – ${event.timeEnd}` : (event.time ?? event.timeEnd)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
