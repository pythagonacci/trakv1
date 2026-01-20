"use client";

import React, { useMemo, useRef } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
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
  StatusFieldConfig,
  TableField,
  TableRow,
} from "@/types/table";
import { canGroupByField, groupRows } from "@/lib/table-grouping";
import { formatUserDisplay } from "@/lib/field-utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

type TimelineScale = "day" | "week" | "month";

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
  if (order >= 3) return <ArrowUp className="h-3 w-3" />;
  if (order >= 2) return <Minus className="h-3 w-3" />;
  return <ArrowDown className="h-3 w-3" />;
};

const withAlpha = (color: string, alpha: string) => {
  if (!color) return color;
  if (color.startsWith("#") && color.length === 7) return `${color}${alpha}`;
  return color;
};

const clampText = (s: string, max = 28) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const toDateDisplay = (value: unknown) => {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-").map(Number);
    if (!year || !month || !day) return "";
    return new Date(year, month - 1, day).toLocaleDateString();
  }
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

const parseDateValue = (value: unknown) => {
  if (!value) return null;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getScale = (rangeDays: number): TimelineScale => {
  if (rangeDays <= 21) return "day";
  if (rangeDays <= 120) return "week";
  return "month";
};

const getColumnWidth = (scale: TimelineScale) => {
  // Compact so you can see more at once.
  if (scale === "day") return 56;
  if (scale === "week") return 92;
  return 132;
};

// Compact vertical sizing (tight but readable)
const ROW_HEIGHT = 44; // increased because pill includes 2 lines (title + date)
const ROW_GAP = 8;
const LANE_MIN_HEIGHT = 56;

// Horizontal padding inside each card area
const CARD_HORIZONTAL_PADDING = 12;

// If you have lots of items on the same day, a slightly narrower card helps reduce “wall of cards”
const WIDTH_MULTIPLIER = 0.82;

const getStatusColor = (status: any | null) => status?.color || "#e5e7eb";
const getPriorityColor = (priority: PriorityLevelConfig | null) => priority?.color || "#e5e7eb";

// Simple, deterministic track-packing: place each item into the first track
// whose last end offset doesn't overlap this item's start offset.
function packIntoTracks<T extends { start: number; end: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const trackLastEnd: number[] = [];
  const placed: Array<T & { track: number }> = [];

  for (const item of sorted) {
    let placedTrack = -1;
    for (let t = 0; t < trackLastEnd.length; t++) {
      if (item.start >= trackLastEnd[t]) {
        placedTrack = t;
        break;
      }
    }
    if (placedTrack === -1) {
      placedTrack = trackLastEnd.length;
      trackLastEnd.push(item.end);
    } else {
      trackLastEnd[placedTrack] = item.end;
    }
    placed.push({ ...item, track: placedTrack });
  }

  return { placed, trackCount: Math.max(1, trackLastEnd.length) };
}

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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scheduledRows = useMemo(() => {
    if (!dateField) return [];
    return rows
      .map((row) => ({ row, date: parseDateValue(row.data?.[dateField.id]) }))
      .filter((entry) => entry.date)
      .map((entry) => ({ row: entry.row, date: entry.date! }));
  }, [rows, dateField]);

  const unscheduledRows = useMemo(() => {
    if (!dateField) return rows;
    return rows.filter((row) => !parseDateValue(row.data?.[dateField.id]));
  }, [rows, dateField]);

  const range = useMemo(() => {
    if (!scheduledRows.length) return null;
    const dates = scheduledRows.map((entry) => entry.date);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = addDays(startOfDay(min), -2);
    const end = addDays(startOfDay(max), 2);
    return { start, end };
  }, [scheduledRows]);

  const scale = range ? getScale(differenceInCalendarDays(range.end, range.start)) : "week";
  const columnWidth = getColumnWidth(scale);

  // Shared timelineStart for BOTH ticks and offsets.
  const timelineStart = useMemo(() => {
    if (!range) return startOfWeek(startOfDay(new Date()));
    if (scale === "day") return startOfDay(range.start);
    if (scale === "week") return startOfWeek(range.start);
    return startOfMonth(range.start);
  }, [range, scale]);

  const ticks = useMemo(() => {
    if (!range) return [];
    if (scale === "day") {
      const total = differenceInCalendarDays(range.end, timelineStart);
      return Array.from({ length: total + 1 }, (_, idx) => addDays(timelineStart, idx));
    }
    if (scale === "week") {
      const totalWeeks = Math.ceil(differenceInCalendarDays(range.end, timelineStart) / 7);
      return Array.from({ length: totalWeeks + 1 }, (_, idx) => addDays(timelineStart, idx * 7));
    }
    const totalMonths = differenceInCalendarMonths(range.end, timelineStart);
    return Array.from({ length: totalMonths + 1 }, (_, idx) => addMonths(timelineStart, idx));
  }, [range, scale, timelineStart]);

  const getOffsetForDate = (date: Date) => {
    if (!range) return 0;
    const clamped = startOfDay(date);

    if (scale === "day") return differenceInCalendarDays(clamped, timelineStart) * columnWidth;

    if (scale === "week") {
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

    if (scale === "day") {
      const days = Math.round(offset / columnWidth);
      return addDays(timelineStart, days);
    }

    if (scale === "week") {
      const days = Math.round((offset / columnWidth) * 7);
      return addDays(timelineStart, days);
    }

    const months = Math.floor(offset / columnWidth);
    const remainder = offset / columnWidth - months;
    const monthStart = addMonths(startOfMonth(timelineStart), months);
    const monthDays = differenceInCalendarDays(endOfMonth(monthStart), monthStart) + 1;
    return addDays(monthStart, Math.round(monthDays * remainder));
  };

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

  const priorityField = useMemo(() => fields.find((f) => f.type === "priority"), [fields]);
  const statusField = useMemo(() => fields.find((f) => f.type === "status"), [fields]);
  const personField = useMemo(() => fields.find((f) => f.type === "person"), [fields]);
  const primaryField = useMemo(() => fields.find((f) => f.is_primary) ?? fields[0], [fields]);

  const resolveOption = (field: TableField | undefined, value: unknown) => {
    if (!field || value === null || value === undefined) return null;
    if (field.type === "priority") {
      const levels = ((field.config || {}) as PriorityFieldConfig).levels || [];
      return levels.find((level) => level.id === value) || null;
    }
    if (field.type === "status") {
      const options = ((field.config || {}) as StatusFieldConfig).options || [];
      return options.find((opt) => opt.id === value) || null;
    }
    if (field.type === "select") {
      const options = ((field.config || {}) as SelectFieldConfig).options || [];
      return options.find((opt) => opt.id === value) || null;
    }
    return null;
  };

  if (!dateField) {
    return <div className="p-6 text-sm text-gray-500">Add a date field to enable timeline view.</div>;
  }

  const timelineWidth = Math.max(ticks.length * columnWidth, 520);
  const todayOffset = range ? getOffsetForDate(new Date()) : null;

  return (
    <div className="bg-white p-4">
      <div className="flex items-center gap-3 mb-3">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Date field</label>
        <select
          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
          value={dateField.id}
          onChange={(e) => onDateFieldChange(e.target.value)}
        >
          {dateFields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.name}
            </option>
          ))}
        </select>
      </div>

      {!range && (
        <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4">
          No dates set yet. Add a date to see items on the timeline.
        </div>
      )}

      {range && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50/50">
            <div className="flex" style={{ width: timelineWidth }}>
              {ticks.map((tick, idx) => (
                <div
                  key={`${tick.toISOString()}-${idx}`}
                  className="text-[11px] text-gray-500 px-2 py-2 border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                  style={{ width: columnWidth }}
                >
                  {scale === "month" ? format(tick, "MMM yyyy") : format(tick, "MMM d")}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto" ref={scrollRef}>
            <div style={{ width: timelineWidth }}>
              {lanes.map((lane) => {
                const laneRowsWithDates = lane.rows
                  .map((row) => ({ row, date: parseDateValue(row.data?.[dateField.id]) }))
                  .filter((x): x is { row: TableRow; date: Date } => !!x.date);

                // Card width for packing + rendering
                const cardWidth = Math.max(
                  60,
                  Math.floor((columnWidth - CARD_HORIZONTAL_PADDING) * WIDTH_MULTIPLIER)
                );

                // Items become segments for packing (using a width so packing is deterministic)
                const items = laneRowsWithDates.map(({ row, date }) => {
                  const start = getOffsetForDate(date);
                  const end = start + cardWidth;
                  return { row, date, start, end };
                });

                const { placed, trackCount } = packIntoTracks(items);

                const laneHeight = Math.max(
                  trackCount * (ROW_HEIGHT + ROW_GAP) + ROW_GAP,
                  LANE_MIN_HEIGHT
                );

                return (
                  <div key={lane.id} className="border-b border-gray-200">
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white">
                      {lane.label} · {laneRowsWithDates.length}
                    </div>

                    <div
                      className="relative bg-white"
                      style={{ height: laneHeight }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rowId = e.dataTransfer.getData("rowId");
                        if (!rowId || !scrollRef.current) return;

                        const rect = scrollRef.current.getBoundingClientRect();
                        const offset = e.clientX - rect.left + scrollRef.current.scrollLeft;
                        const nextDate = getDateFromOffset(offset);
                        if (!nextDate) return;

                        onUpdateCell(rowId, dateField.id, format(nextDate, "yyyy-MM-dd"));
                      }}
                    >
                      {/* Grid background */}
                      <div className="absolute inset-0 pointer-events-none">
                        {ticks.map((_, i) => (
                          <div
                            key={`grid-col-${i}`}
                            className="absolute top-0 bottom-0"
                            style={{
                              left: i * columnWidth,
                              width: columnWidth,
                              backgroundColor: i % 2 === 0 ? "rgba(249,250,251,0.55)" : "transparent",
                              borderRight: "1px solid rgba(229,231,235,0.9)",
                            }}
                          />
                        ))}

                        {Array.from({ length: trackCount + 1 }).map((_, t) => (
                          <div
                            key={`grid-row-${t}`}
                            className="absolute left-0 right-0"
                            style={{
                              top: t * (ROW_HEIGHT + ROW_GAP) + ROW_GAP - ROW_GAP / 2,
                              borderTop: "1px solid rgba(243,244,246,1)",
                            }}
                          />
                        ))}
                      </div>

                      {todayOffset !== null &&
                        todayOffset >= 0 &&
                        todayOffset <= timelineWidth && (
                          <div
                            className="absolute top-0 bottom-0 border-l-2 border-blue-500"
                            style={{ left: todayOffset }}
                          />
                        )}

                      {placed.map(({ row, date, start, track }) => {
                        const title = primaryField
                          ? String(row.data?.[primaryField.id] ?? "Untitled")
                          : "Untitled";

                        const priorityValue = priorityField ? row.data?.[priorityField.id] : null;
                        const statusValue = statusField ? row.data?.[statusField.id] : null;
                        const personValue = personField ? row.data?.[personField.id] : null;
                        const person = workspaceMembers.find((m) => m.id === personValue);

                        const priority = resolveOption(
                          priorityField,
                          priorityValue
                        ) as PriorityLevelConfig | null;
                        const status = resolveOption(statusField, statusValue);

                        const statusColor = getStatusColor(status);
                        const priorityColor = getPriorityColor(priority);

                        return (
                          <div
                            key={row.id}
                            className="absolute"
                            style={{
                              left: start,
                              top: track * (ROW_HEIGHT + ROW_GAP) + ROW_GAP,
                              width: cardWidth,
                            }}
                          >
                            <div
                              className="group relative h-full"
                              style={{ height: ROW_HEIGHT }}
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
                              {/* Compact pill (no wrapping, no multi-line badges) */}
                              <div
                                className="h-full w-full rounded-md border bg-white hover:shadow-sm transition-shadow flex items-center gap-2 px-2 overflow-hidden"
                                style={{
                                  borderColor: "rgba(229,231,235,1)",
                                }}
                              >
                                {/* Status indicator */}
                                <div
                                  className="h-6 w-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: statusColor }}
                                />

                                {/* Title + date */}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {clampText(String(title), 34)}
                                  </div>
                                  <div className="text-[11px] text-gray-500 leading-4">
                                    {format(date, "MMM d")}
                                  </div>
                                </div>

                                {/* Tiny indicators + checkbox */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {priority && (
                                    <div
                                      className="h-6 px-1.5 rounded border text-[11px] font-medium flex items-center gap-1"
                                      style={{
                                        backgroundColor: withAlpha(priorityColor, "1A"),
                                        borderColor: withAlpha(priorityColor, "33"),
                                        color: priorityColor,
                                      }}
                                      title={priority.label}
                                    >
                                      {getPriorityIcon(priority.order || 0)}
                                    </div>
                                  )}

                                  {person && (
                                    <div
                                      className="h-6 w-6 rounded-full border flex items-center justify-center text-[9px] text-gray-700 bg-gray-50"
                                      style={{ borderColor: "rgba(229,231,235,1)" }}
                                      title={formatUserDisplay(person)}
                                    >
                                      {formatUserDisplay(person).slice(0, 2).toUpperCase()}
                                    </div>
                                  )}

                                  <input
                                    type="checkbox"
                                    checked={selectedRows.has(row.id)}
                                    onChange={(e) =>
                                      onSelectRow(
                                        row.id,
                                        e as unknown as React.MouseEvent<HTMLInputElement>
                                      )
                                    }
                                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0"
                                  />
                                </div>
                              </div>

                              {/* Hover tooltip with full metadata (doesn't affect layout) */}
                              <div className="pointer-events-none absolute left-0 top-full mt-2 hidden group-hover:block z-20">
                                <div className="w-[260px] rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                                  <div className="text-sm font-semibold text-gray-900">
                                    {String(title)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {toDateDisplay(date)}
                                  </div>

                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {status && (
                                      <span
                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border"
                                        style={{
                                          backgroundColor: status.color
                                            ? withAlpha(status.color, "1A")
                                            : "#f3f4f6",
                                          borderColor: status.color
                                            ? withAlpha(status.color, "33")
                                            : "#e5e7eb",
                                          color: status.color || "#374151",
                                        }}
                                      >
                                        <span
                                          className="h-1.5 w-1.5 rounded-full"
                                          style={{
                                            backgroundColor: status.color || "#9ca3af",
                                          }}
                                        />
                                        {status.label}
                                      </span>
                                    )}

                                    {priority && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border"
                                        style={{
                                          backgroundColor: priority.color
                                            ? withAlpha(priority.color, "1A")
                                            : "#f3f4f6",
                                          borderColor: priority.color
                                            ? withAlpha(priority.color, "33")
                                            : "#e5e7eb",
                                          color: priority.color || "#374151",
                                        }}
                                      >
                                        {getPriorityIcon(priority.order || 0)}
                                        {priority.label}
                                      </span>
                                    )}

                                    {person && (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                                        {formatUserDisplay(person)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {unscheduledRows.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Unscheduled
          </div>
          <div className="space-y-2">
            {unscheduledRows.map((row) => {
              const title = primaryField
                ? String(row.data?.[primaryField.id] ?? "Untitled")
                : "Untitled";
              return (
                <div
                  key={row.id}
                  className="bg-white border border-gray-200 rounded-lg p-2 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, row.id);
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{title}</div>
                    <div className="text-xs text-gray-500">No date set</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={(e) =>
                      onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)
                    }
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0"
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
