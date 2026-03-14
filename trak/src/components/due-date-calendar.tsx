"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addDays,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: string | null;
  end: string | null;
}

interface DateRangeCalendarProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
}

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateRangeCalendar({ range, onChange }: DateRangeCalendarProps) {
  const normalizedRange = useMemo(
    () => ({
      start: range.start ?? null,
      end: range.end ?? null,
    }),
    [range]
  );

  // Only show current month or the month of the due date (start)
  const currentMonth = useMemo(() => {
    if (normalizedRange.start) {
      return startOfMonth(new Date(normalizedRange.start + "T12:00:00"));
    }
    return startOfMonth(new Date());
  }, [normalizedRange.start]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const totalSlots = 42;
    return Array.from({ length: totalSlots }, (_, index) => addDays(gridStart, index));
  }, [currentMonth]);

  const handleDayClick = (date: Date) => {
    const iso = format(date, "yyyy-MM-dd");
    const { start, end } = normalizedRange;

    if (!start) {
      onChange({ start: iso, end: null });
      return;
    }

    if (!end) {
      if (iso === start) {
        onChange({ start: null, end: null });
        return;
      }

      if (iso < start) {
        onChange({ start: iso, end: start });
      } else {
        onChange({ start, end: iso });
      }
      return;
    }

    if (iso === start) {
      onChange({ start: end, end: null });
      return;
    }

    if (iso === end) {
      onChange({ start, end: null });
      return;
    }

    if (iso < start) {
      onChange({ start: iso, end: null });
      return;
    }

    if (iso > end) {
      onChange({ start, end: iso });
      return;
    }

    onChange({ start: iso, end: null });
  };

  const isInRange = (dateIso: string) => {
    const { start, end } = normalizedRange;
    if (!start || !end) return false;
    return dateIso > start && dateIso < end;
  };

  const isRangeStart = (dateIso: string) => normalizedRange.start === dateIso;
  const isRangeEnd = (dateIso: string) => normalizedRange.end === dateIso;
  const hasSelection = normalizedRange.start != null;

  const goToToday = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    onChange({ start: today, end: null });
  };

  const clearDate = () => {
    onChange({ start: null, end: null });
  };

  return (
    <div className="p-2">
      {/* Header: Month/Year (no navigation - only current month or due date month) */}
      <div className="mb-1.5 flex items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground)]">
          {format(currentMonth, "MMM yyyy")}
        </span>
      </div>

      {/* Weekdays row */}
      <div className="mb-1 grid grid-cols-7 gap-0 text-center">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="text-[10px] font-medium text-[var(--foreground)]">
            {day}
          </span>
        ))}
      </div>

      {/* Dates grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {monthDays.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isStart = isRangeStart(iso);
          const isEnd = isRangeEnd(iso);
          const isToday = isSameDay(day, new Date());
          const inRange = isInRange(iso);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "relative flex h-6 w-6 items-center justify-center rounded text-[11px] font-medium transition-colors",
                !isCurrentMonth && "text-[var(--muted-foreground)]/60",
                isCurrentMonth && !isStart && !isEnd && !inRange && "text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                isToday && !isStart && !isEnd && "ring-1 ring-[var(--border)]",
                (isStart || isEnd) && "bg-[var(--foreground)] text-white hover:bg-[var(--foreground)]/90",
                inRange && "bg-[var(--foreground)]/10 text-[var(--foreground)]",
                !isCurrentMonth && "hover:bg-[var(--surface-hover)]/50"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Footer: Today + Clear date */}
      <div className="mt-1.5 flex items-center justify-between border-t border-[var(--border)] pt-1.5">
        <button
          type="button"
          onClick={goToToday}
          className="text-[10px] font-medium text-[var(--foreground)] hover:underline"
        >
          Today
        </button>
        {hasSelection && (
          <button
            type="button"
            onClick={clearDate}
            className="text-[10px] font-medium text-orange-600 hover:text-orange-700 hover:underline dark:text-orange-500 dark:hover:text-orange-400"
          >
            Clear date
          </button>
        )}
      </div>
    </div>
  );
}

/** Approximate height of the calendar popover */
const CALENDAR_HEIGHT = 220;

/** Minimum space below trigger to prefer bottom placement */
const MIN_SPACE_BELOW = CALENDAR_HEIGHT + 8;

interface DateRangeCalendarDropdownProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  children: React.ReactNode;
}

export function DateRangeCalendarDropdown({
  range,
  onChange,
  children,
}: DateRangeCalendarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"bottom" | "right">("bottom");
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setSide(spaceBelow < MIN_SPACE_BELOW ? "right" : "bottom");
    }
    setOpen(next);
  }, []);

  return (
    <div ref={triggerRef} className="inline-block">
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={side}
          avoidCollisions={true}
          collisionPadding={8}
          className="z-[200] w-auto min-w-[11rem] p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <DateRangeCalendar range={range} onChange={onChange} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
