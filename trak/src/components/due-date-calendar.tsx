"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const normalizedRange = useMemo(
    () => ({
      start: range.start ?? null,
      end: range.end ?? null,
    }),
    [range]
  );

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
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
  const hasRange = normalizedRange.start != null && normalizedRange.end != null;

  const rangeLabel = hasRange
    ? `${format(new Date(normalizedRange.start + "T12:00:00"), "MMM d")} → ${format(new Date(normalizedRange.end + "T12:00:00"), "MMM d")}`
    : null;

  return (
    <div className="space-y-1.5">
      {rangeLabel && (
        <div className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)] text-center">
          {rangeLabel}
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] flex items-center justify-center"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className="font-semibold text-xs">{format(currentMonth, "MMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          className="h-6 w-6 rounded-full hover:bg-[var(--surface-muted)] flex items-center justify-center"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-[var(--muted-foreground)]">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="flex items-center justify-center">
            {day}
          </span>
        ))}
      </div>

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
              disabled={!isCurrentMonth}
              className={cn(
                "relative flex h-7 w-7 items-center justify-center text-xs font-medium transition",
                !isCurrentMonth && "text-[var(--muted-foreground)]",
                isStart || isEnd
                  ? "z-10 rounded-full bg-[var(--foreground)] text-white"
                  : inRange
                  ? "rounded-none bg-[var(--primary)]/15 text-[var(--foreground)]"
                  : "text-[var(--foreground)]",
                isToday && !isStart && !isEnd && "ring-1 ring-[var(--border)]",
                isStart && "rounded-l-full",
                isEnd && "rounded-r-full",
                inRange && !isStart && !isEnd && "rounded-none"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
