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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          className="h-7 w-7 rounded-full hover:bg-[var(--surface-muted)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          className="h-7 w-7 rounded-full hover:bg-[var(--surface-muted)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[11px] text-[var(--muted-foreground)]">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="flex items-center justify-center">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isStart = normalizedRange.start === iso;
          const isEnd = normalizedRange.end === iso;
          const isToday = isSameDay(day, new Date());
          const inRange = isInRange(iso);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={!isCurrentMonth}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition",
                !isCurrentMonth && "text-[var(--muted-foreground)]",
                isStart || isEnd
                  ? "bg-[var(--foreground)] text-white"
                  : inRange
                  ? "bg-[var(--primary-foreground)/10] text-[var(--foreground)]"
                  : "text-[var(--foreground)]",
                isToday && "border border-[var(--border)]"
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
