"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type {
  GroupByConfig,
  PriorityFieldConfig,
  PriorityLevelConfig,
  SelectFieldConfig,
  SelectFieldOption,
  StatusFieldConfig,
  TableField,
  TableRow,
} from "@/types/table";
import { canGroupByField, groupRows } from "@/lib/table-grouping";
import { getCanonicalPriorityOption, getCanonicalStatusOption } from "@/lib/tables/universal-property";
import { formatUserDisplay } from "@/lib/field-utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type TimelineScale = "day" | "week" | "month";

// Match timeline block column widths
const getColumnWidth = (scale: TimelineScale): number => {
  if (scale === "day") return 44;
  if (scale === "week") return 80;
  return 120;
};

// Build grid cells for date header (same structure as timeline block)
function buildTimelineGrid(
  start: Date,
  end: Date,
  scale: TimelineScale
): { key: string; date: Date; dayLabel: string; monthLabel?: string; weekLabel?: string }[] {
  const cells: { key: string; date: Date; dayLabel: string; monthLabel?: string; weekLabel?: string }[] = [];
  if (scale === "day") {
    const total = Math.max(0, differenceInCalendarDays(end, start));
    for (let i = 0; i <= total; i++) {
      const date = addDays(start, i);
      const dayLabel = format(date, "d");
      const monthLabel = dayLabel === "1" ? format(date, "MMM yyyy") : undefined;
      cells.push({ key: `day_${date.toISOString()}`, date, dayLabel, monthLabel });
    }
  } else if (scale === "week") {
    let current = startOfWeek(start);
    const endWeek = endOfWeek(end);
    while (current <= endWeek) {
      const weekStart = startOfWeek(current);
      const weekEnd = endOfWeek(current);
      const weekLabel = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`;
      cells.push({
        key: `week_${weekStart.toISOString()}`,
        date: weekStart,
        dayLabel: format(weekStart, "d"),
        monthLabel: format(weekStart, "MMM yyyy"),
        weekLabel,
      });
      current = addDays(current, 7);
    }
  } else {
    let current = startOfMonth(start);
    const endMonth = endOfMonth(end);
    while (current <= endMonth) {
      const monthLabel = format(current, "MMM yyyy");
      cells.push({
        key: `month_${current.toISOString()}`,
        date: current,
        dayLabel: format(current, "d"),
        monthLabel,
      });
      current = addDays(endOfMonth(current), 1);
    }
  }
  return cells;
}

interface TableTimelineViewProps {
  fields: TableField[];
  rows: TableRow[];
  dateFieldId?: string;
  groupBy?: GroupByConfig;
  workspaceMembers?: Array<{ id: string; name?: string; email?: string }>;
  selectedRows: Set<string>;
  onSelectRow: (rowId: string, event: React.MouseEvent<HTMLInputElement>) => void;
  onUpdateCell: (rowId: string, fieldId: string, value: unknown) => void;
  onDateFieldChange: (fieldId: string) => void;
  onContextMenu?: (e: React.MouseEvent, rowId: string) => void;
}

const getPriorityIcon = (order: number) => {
  if (order >= 3) return <ArrowUp className="h-2 w-2" />;
  if (order >= 2) return <Minus className="h-2 w-2" />;
  return <ArrowDown className="h-2 w-2" />;
};

const withAlpha = (color: string, alpha: string) => {
  if (!color) return color;
  if (color.startsWith("#") && color.length === 7) return `${color}${alpha}`;
  return color;
};

const toDateToken = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateRange = (value: unknown): { start: string; end: string } | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$/);
    if (rangeMatch) return { start: rangeMatch[1], end: rangeMatch[2] };
    const token = toDateToken(trimmed);
    return token ? { start: token, end: token } : null;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const start = toDateToken(obj.start ?? obj.startDate ?? obj.from ?? obj.date ?? null);
    const end = toDateToken(obj.end ?? obj.endDate ?? obj.to ?? obj.dueDate ?? start);
    if (!start && !end) return null;
    return { start: start || end, end: end || start };
  }

  const token = toDateToken(value);
  return token ? { start: token, end: token } : null;
};

const tokenToDate = (token: string): Date | null => {
  const [year, month, day] = token.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatToken = (token: string): string => {
  const date = tokenToDate(token);
  return date ? date.toLocaleDateString() : "";
};

const toDateDisplay = (value: unknown) => {
  const range = toDateRange(value);
  if (!range) return "";
  if (range.start && range.end && range.start !== range.end) {
    return `${formatToken(range.start)} - ${formatToken(range.end)}`;
  }
  return formatToken(range.end || range.start);
};

const parseDateValue = (value: unknown) => {
  const range = toDateRange(value);
  if (!range) return null;
  return tokenToDate(range.start || range.end);
};

const getScaleFromRange = (rangeDays: number): TimelineScale => {
  if (rangeDays <= 21) return "day";
  if (rangeDays <= 120) return "week";
  return "month";
};

// Match timeline block row height
const ROW_HEIGHT_BASE = 44;

// Status pill colors aligned with timeline block (todo/in_progress/blocked/done)
const STATUS_BAR_COLORS: Record<string, string> = {
  todo: "bg-white/12 text-white/90 border-white/20",
  in_progress: "bg-sky-300/16 text-sky-50 border-sky-200/30",
  blocked: "bg-red-300/16 text-red-50 border-red-200/30",
  done: "bg-emerald-300/16 text-emerald-50 border-emerald-200/30",
};

function getStatusBarClass(statusValue: string | null): string {
  if (!statusValue) return "bg-white/12 text-white/90 border-white/20";
  const normalized = String(statusValue).trim().toLowerCase();
  return STATUS_BAR_COLORS[normalized] ?? "bg-white/12 text-white/90 border-white/20";
}

const getStatusColor = (status: SelectFieldOption | null) => status?.color || "#e5e7eb";
const getPriorityColor = (priority: PriorityLevelConfig | null) => priority?.color || "#e5e7eb";

export function TableTimelineView({
  fields,
  rows,
  dateFieldId,
  groupBy,
  workspaceMembers = [],
  selectedRows,
  onSelectRow,
  onUpdateCell,
  onDateFieldChange,
  onContextMenu,
}: TableTimelineViewProps) {
  const dateFields = fields.filter((f) => f.type === "date");
  const dateField = dateFieldId ? fields.find((f) => f.id === dateFieldId) : dateFields[0];

  const groupByField = groupBy?.fieldId ? fields.find((f) => f.id === groupBy.fieldId) : undefined;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // User-controlled zoom (match timeline block)
  const rangeFromData = useMemo(() => {
    if (!dateField) return null;
    const withRange = rows
      .map((row) => toDateRange(row.data?.[dateField.id]))
      .filter((r): r is { start: string; end: string } => r != null);
    if (!withRange.length) return null;
    const allStarts = withRange.map((r) => tokenToDate(r.start)).filter((d): d is Date => d != null);
    const allEnds = withRange.map((r) => tokenToDate(r.end)).filter((d): d is Date => d != null);
    if (!allStarts.length || !allEnds.length) return null;
    const min = new Date(Math.min(...allStarts.map((d) => d.getTime())));
    const max = new Date(Math.max(...allEnds.map((d) => d.getTime())));
    return {
      start: addDays(startOfDay(min), -7),
      end: addDays(startOfDay(max), 7),
    };
  }, [rows, dateField]);

  const initialScale = rangeFromData
    ? getScaleFromRange(differenceInCalendarDays(rangeFromData.end, rangeFromData.start))
    : "week";
  const [zoomLevel, setZoomLevel] = useState<TimelineScale>(initialScale);

  useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const update = () => setViewportWidth(el.clientWidth || 0);
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rows with start/end dates (support date range column)
  const scheduledRows = useMemo(() => {
    if (!dateField) return [];
    return rows
      .map((row) => {
        const rangeVal = toDateRange(row.data?.[dateField.id]);
        if (!rangeVal) return null;
        const startDate = tokenToDate(rangeVal.start);
        const endDate = tokenToDate(rangeVal.end);
        if (!startDate) return null;
        return {
          row,
          startDate,
          endDate: endDate ?? startDate,
        };
      })
      .filter((entry): entry is { row: TableRow; startDate: Date; endDate: Date } => entry != null);
  }, [rows, dateField]);

  const unscheduledRows = useMemo(() => {
    if (!dateField) return rows;
    return rows.filter((row) => !toDateRange(row.data?.[dateField.id]));
  }, [rows, dateField]);

  const range = rangeFromData;

  const timelineStart = useMemo(() => {
    if (!range) return startOfWeek(startOfDay(new Date()));
    if (zoomLevel === "day") return startOfDay(range.start);
    if (zoomLevel === "week") return startOfWeek(range.start);
    return startOfMonth(range.start);
  }, [range, zoomLevel]);

  const timelineEnd = useMemo(() => {
    if (!range) return addDays(startOfWeek(startOfDay(new Date())), 7);
    if (zoomLevel === "day") return range.end;
    if (zoomLevel === "week") return endOfWeek(range.end);
    return endOfMonth(range.end);
  }, [range, zoomLevel]);

  const grid = useMemo(
    () => (range ? buildTimelineGrid(timelineStart, timelineEnd, zoomLevel) : []),
    [range, timelineStart, timelineEnd, zoomLevel]
  );

  const totalColumns = grid.length;
  const baseColumnWidth = getColumnWidth(zoomLevel);
  const columnWidth = useMemo(() => {
    if (!totalColumns || viewportWidth <= 0) return baseColumnWidth;
    const fill = Math.floor(viewportWidth / totalColumns);
    return Math.max(baseColumnWidth, fill);
  }, [baseColumnWidth, totalColumns, viewportWidth]);

  const timelineWidth = totalColumns * columnWidth;

  const getOffsetForDate = (date: Date) => {
    if (!range) return 0;
    const clamped = startOfDay(date);
    if (zoomLevel === "day") {
      return differenceInCalendarDays(clamped, timelineStart) * columnWidth;
    }
    if (zoomLevel === "week") {
      return (differenceInCalendarDays(clamped, timelineStart) / 7) * columnWidth;
    }
    const startMonth = startOfMonth(timelineStart);
    const months = differenceInCalendarMonths(clamped, startMonth);
    const monthStart = addMonths(startMonth, months);
    const monthDays = differenceInCalendarDays(endOfMonth(monthStart), monthStart) + 1;
    const dayOffset = differenceInCalendarDays(clamped, monthStart);
    return (months + dayOffset / monthDays) * columnWidth;
  };

  const getDateFromOffset = (offset: number) => {
    if (!range) return null;
    if (zoomLevel === "day") {
      const days = Math.round(offset / columnWidth);
      return addDays(timelineStart, days);
    }
    if (zoomLevel === "week") {
      const days = Math.round((offset / columnWidth) * 7);
      return addDays(timelineStart, days);
    }
    const months = Math.floor(offset / columnWidth);
    const remainder = offset / columnWidth - months;
    const monthStart = addMonths(startOfMonth(timelineStart), months);
    const monthDays = differenceInCalendarDays(endOfMonth(monthStart), monthStart) + 1;
    return addDays(monthStart, Math.round(monthDays * remainder));
  };

  // Lanes (groups) then flat list of rows for left rail + canvas (one row per table row)
  const lanes = useMemo(() => {
    if (groupByField && canGroupByField(groupByField.type)) {
      return groupRows(rows, groupByField, [], {
        members: workspaceMembers,
        showEmptyGroups: groupBy?.showEmptyGroups ?? true,
        sortOrder: groupBy?.sortOrder,
      }).map((group) => ({
        id: group.groupId,
        label: group.groupLabel,
        color: group.groupColor,
        rows: group.rows,
      }));
    }
    return [{ id: "all", label: "All items", rows }];
  }, [rows, groupByField, groupBy?.showEmptyGroups, groupBy?.sortOrder, workspaceMembers]);

  // Flat rows: only scheduled rows, in lane order, for 1:1 left rail and timeline rows
  const flatRows = useMemo(() => {
    const list: { row: TableRow; startDate: Date; endDate: Date; laneLabel: string }[] = [];
    for (const lane of lanes) {
      for (const row of lane.rows) {
        const rangeVal = dateField ? toDateRange(row.data?.[dateField.id]) : null;
        if (!rangeVal) continue;
        const startDate = tokenToDate(rangeVal.start);
        const endDate = tokenToDate(rangeVal.end);
        if (!startDate) continue;
        list.push({
          row,
          startDate,
          endDate: endDate ?? startDate,
          laneLabel: lane.label,
        });
      }
    }
    return list;
  }, [lanes, dateField]);

  const rowHeights = useMemo(() => flatRows.map(() => ROW_HEIGHT_BASE), [flatRows]);
  const rowTops = useMemo(() => {
    const tops: number[] = [];
    let acc = 0;
    for (const h of rowHeights) {
      tops.push(acc);
      acc += h;
    }
    return tops;
  }, [rowHeights]);
  const totalRowHeight = rowHeights.reduce((a, b) => a + b, 0) || ROW_HEIGHT_BASE;

  const priorityField = useMemo(() => fields.find((f) => f.type === "priority"), [fields]);
  const statusField = useMemo(() => fields.find((f) => f.type === "status"), [fields]);
  const personField = useMemo(() => fields.find((f) => f.type === "person"), [fields]);
  const primaryField = useMemo(() => fields.find((f) => f.is_primary) ?? fields[0], [fields]);

  // Bar position (match timeline block: bar spans [start, end] inclusive)
  const getBarStyle = (startDate: Date, endDate: Date, rowTop: number) => {
    const start = startOfDay(startDate);
    const end = startOfDay(addDays(endDate, 1)); // end of end day
    let left = getOffsetForDate(start);
    const endOffset = getOffsetForDate(end);
    let width = Math.max(24, endOffset - left);
    if (left < 0) {
      width += left;
      left = 0;
    }
    if (left + width > timelineWidth) width = timelineWidth - left;
    const topOffset = rowTop + 8;
    return {
      position: "absolute" as const,
      left: `${left}px`,
      width: `${width}px`,
      top: `${topOffset}px`,
    };
  };

  const resolveOption = (field: TableField | undefined, value: unknown) => {
    if (!field || value === null || value === undefined) return null;
    if (field.type === "priority") {
      const levels = ((field.config || {}) as PriorityFieldConfig).levels || [];
      const matched = levels.find((level) => level.id === value || level.label === value);
      if (matched) return matched;
      const fallback = getCanonicalPriorityOption(value);
      return fallback
        ? { id: fallback.id, label: fallback.label, color: fallback.color, order: fallback.order }
        : null;
    }
    if (field.type === "status") {
      const options = ((field.config || {}) as StatusFieldConfig).options || [];
      const matched = options.find((opt) => opt.id === value || opt.label === value);
      if (matched) return matched;
      const fallback = getCanonicalStatusOption(value);
      return fallback ? { id: fallback.id, label: fallback.label, color: fallback.color } : null;
    }
    if (field.type === "select") {
      const options = ((field.config || {}) as SelectFieldConfig).options || [];
      return options.find((opt) => opt.id === value || opt.label === value) || null;
    }
    return null;
  };

  if (!dateField) {
    return <div className="p-6 text-sm text-[var(--tertiary-foreground)]">Add a date field to enable timeline view.</div>;
  }

  const todayOffset = range ? getOffsetForDate(new Date()) : null;

  return (
    <div className="space-y-3 w-full p-4">
      {/* Header: same structure as timeline block */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-3">
          <label className="text-[11px] text-[var(--muted-foreground)]">Date field</label>
          <select
            className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
            value={dateField.id}
            onChange={(e) => onDateFieldChange(e.target.value)}
          >
            {dateFields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name}
              </option>
            ))}
          </select>
          {range && (
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {format(range.start, "MMM d")} – {format(range.end, "MMM d, yyyy")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Zoom controls – match timeline block */}
          <div className="flex items-center gap-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(["day", "week", "month"] as TimelineScale[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setZoomLevel(level)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded-[2px] transition-colors",
                  zoomLevel === level
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                )}
              >
                {level[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!range && (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-4 text-sm text-[var(--tertiary-foreground)]">
          No dates set yet. Add a date to see items on the timeline.
        </div>
      )}

      {range && (
        <div className={cn("grid border border-[var(--border)] bg-[var(--surface)] w-full overflow-hidden", "grid-cols-[280px_1fr]")}>
          {/* Left rail: row labels (match timeline block) */}
          <div className="border-r border-[var(--border)] bg-[var(--surface)] flex flex-col min-w-[280px] w-[280px] shrink-0">
            <div className="sticky top-0 z-10 min-h-[44px] border-b border-[var(--border)] bg-[var(--surface)] shrink-0" />
            <div className="flex flex-col min-h-0">
              {flatRows.length === 0 ? (
                <div className="min-h-[44px] border-b border-[var(--border)] flex items-center px-3 text-sm text-[var(--muted-foreground)]">
                  No items with dates
                </div>
              ) : (
                flatRows.map(({ row, startDate, endDate, laneLabel }, rowIndex) => {
                  const title = primaryField ? String(row.data?.[primaryField.id] ?? "Untitled") : "Untitled";
                  const personValue = personField ? row.data?.[personField.id] : null;
                  const person = workspaceMembers.find((m) => m.id === personValue);
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "min-h-[44px] border-b border-[var(--border)] flex flex-col gap-1 px-3 py-2",
                        rowIndex % 2 === 1 ? "bg-[var(--surface-hover)]/50" : "bg-[var(--surface)]"
                      )}
                      style={{ minHeight: ROW_HEIGHT_BASE }}
                    >
                      <div className="flex items-center gap-2 min-h-[20px]">
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm text-[var(--foreground)] font-medium">{title}</div>
                          {person && (
                            <div className="truncate text-[10px] text-[var(--muted-foreground)] mt-0.5">
                              {formatUserDisplay(person)}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-[10px] text-[var(--tertiary-foreground)] whitespace-nowrap">
                          {format(startDate, "MMM d")}
                          {startDate.getTime() !== endDate.getTime() && ` – ${format(endDate, "MMM d")}`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: timeline canvas (match timeline block) */}
          <div ref={viewportRef} className="overflow-x-auto min-w-0" onMouseLeave={() => setHoveredRowId(null)}>
            <div className="inline-block min-w-0" style={{ minWidth: `${timelineWidth}px` }}>
              {/* Sticky date header – same as timeline block */}
              <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] h-[44px] overflow-hidden">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${totalColumns}, ${columnWidth}px)` }}
                >
                  {grid.map((c) => (
                    <div
                      key={c.key}
                      className="flex h-[44px] flex-col items-center justify-center border-l border-[var(--border)] py-2 text-[10px] text-[var(--tertiary-foreground)] first:border-l-0"
                    >
                      {c.monthLabel ? (
                        <span className="mb-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                          {c.monthLabel}
                        </span>
                      ) : (
                        <span className="mb-0.5" />
                      )}
                      {c.weekLabel ? <span className="text-[9px]">{c.weekLabel}</span> : <span>{c.dayLabel}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline grid: rows, vertical lines, horizontal lines, alternating banding */}
              <div
                className="relative select-none"
                style={{
                  position: "relative",
                  minHeight: totalRowHeight,
                  width: timelineWidth,
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const rowId = e.dataTransfer.getData("rowId");
                  if (!rowId || !viewportRef.current) return;
                  const rect = viewportRef.current.getBoundingClientRect();
                  const offset = e.clientX - rect.left + viewportRef.current.scrollLeft;
                  const nextDate = getDateFromOffset(offset);
                  if (!nextDate) return;
                  onUpdateCell(rowId, dateField.id, format(nextDate, "yyyy-MM-dd"));
                }}
              >
                {/* Vertical grid lines */}
                {grid.map((_, idx) => (
                  <div
                    key={`vline-${idx}`}
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--border)]"
                    style={{ left: idx * columnWidth, height: totalRowHeight }}
                  />
                ))}
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--border)]"
                  style={{ left: totalColumns * columnWidth, height: totalRowHeight }}
                />
                {/* Horizontal row separators */}
                {rowTops.map((top, i) => (
                  <div
                    key={`hline-${i}`}
                    className="pointer-events-none absolute left-0 right-0 h-px bg-[var(--border)]"
                    style={{ top, width: timelineWidth }}
                  />
                ))}
                {flatRows.length > 0 && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px bg-[var(--border)]"
                    style={{ top: totalRowHeight, width: timelineWidth }}
                  />
                )}
                {/* Alternating row banding */}
                {rowTops.map((top, rowIndex) => (
                  <div
                    key={`band-${rowIndex}`}
                    className="pointer-events-none absolute left-0"
                    style={{
                      top,
                      left: 0,
                      width: timelineWidth,
                      height: rowHeights[rowIndex] ?? ROW_HEIGHT_BASE,
                      backgroundColor: rowIndex % 2 === 1 ? "var(--surface-hover)" : undefined,
                      opacity: 0.5,
                    }}
                  />
                ))}

                {/* Today line */}
                {todayOffset != null && todayOffset >= 0 && todayOffset <= timelineWidth && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-0 border-l-2 border-blue-500"
                    style={{ left: todayOffset, height: totalRowHeight }}
                  />
                )}

                {/* Event bars – same look as timeline block */}
                {flatRows.map(({ row, startDate, endDate }, rowIndex) => {
                  const title = primaryField ? String(row.data?.[primaryField.id] ?? "Untitled") : "Untitled";
                  const statusValue = statusField ? row.data?.[statusField.id] : null;
                  const status = resolveOption(statusField, statusValue);
                  const statusBarClass = getStatusBarClass(status?.id ?? status?.label ?? null);
                  const barColor = status?.color ? withAlpha(status.color, "E6") : undefined;
                  const showTooltip = hoveredRowId === row.id;
                  const rowTop = rowTops[rowIndex] ?? 0;

                  return (
                    <div
                      key={row.id}
                      className="absolute z-10 pointer-events-auto"
                      style={getBarStyle(startDate, endDate, rowTop)}
                      onMouseEnter={() => setHoveredRowId(row.id)}
                      onMouseLeave={() => setHoveredRowId((prev) => (prev === row.id ? null : prev))}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("rowId", row.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onContextMenu?.(e, row.id);
                      }}
                    >
                      <div
                        className="event-bar relative overflow-hidden flex h-8 w-full items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-sm"
                        style={
                          barColor
                            ? { backgroundColor: barColor }
                            : undefined
                        }
                      >
                        {!barColor && <div className="absolute inset-0 bg-[var(--foreground)] rounded-[6px]" />}
                        <span className="h-2 w-2 shrink-0 rounded-full bg-white/80 relative z-10" />
                        <span className="flex-1 truncate relative z-10">{title}</span>
                        {status && (
                          <span
                            className={cn(
                              "relative z-10 ml-auto inline-flex max-w-[128px] items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                              getStatusBarClass(status.id ?? status.label ?? null)
                            )}
                          >
                            <span className="truncate">{status.label}</span>
                          </span>
                        )}
                      </div>

                      {showTooltip && (
                        <div className="absolute left-0 top-full mt-2 z-30">
                          <div className="min-w-[220px] max-w-[320px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--foreground)] shadow-lg">
                            <div className="truncate font-medium">{title}</div>
                            <div className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
                              {format(startDate, "MMM d")}
                              {startDate.getTime() !== endDate.getTime() && ` – ${format(endDate, "MMM d, yyyy")}`}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedRows.has(row.id)}
                                onChange={(e) =>
                                  onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)
                                }
                                className="rounded border-[var(--border)]"
                              />
                              <span className="text-[11px] text-[var(--muted-foreground)]">Select row</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {unscheduledRows.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--tertiary-foreground)] mb-2">
            Unscheduled
          </div>
          <div className="space-y-2">
            {unscheduledRows.map((row) => {
              const title = primaryField ? String(row.data?.[primaryField.id] ?? "Untitled") : "Untitled";
              return (
                <div
                  key={row.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-2 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, row.id);
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)] truncate">{title}</div>
                    <div className="text-xs text-[var(--tertiary-foreground)]">No date set</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={(e) =>
                      onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)
                    }
                    className="w-4 h-4 rounded-[var(--radius-sm)] border-[var(--border)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
