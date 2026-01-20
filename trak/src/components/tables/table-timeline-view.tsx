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
  if (order >= 4) return <ArrowUp className="h-3 w-3" />;
  if (order >= 3) return <ArrowUp className="h-3 w-3" />;
  if (order >= 2) return <Minus className="h-3 w-3" />;
  return <ArrowDown className="h-3 w-3" />;
};

const withAlpha = (color: string, alpha: string) => {
  if (!color) return color;
  if (color.startsWith("#") && color.length === 7) {
    return `${color}${alpha}`;
  }
  return color;
};

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
  if (scale === "day") return 80;
  if (scale === "week") return 120;
  return 160;
};

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
  const dateField = dateFieldId
    ? fields.find((f) => f.id === dateFieldId)
    : dateFields[0];
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

  const ticks = useMemo(() => {
    if (!range) return [];
    if (scale === "day") {
      const total = differenceInCalendarDays(range.end, range.start);
      return Array.from({ length: total + 1 }, (_, idx) => addDays(range.start, idx));
    }
    if (scale === "week") {
      const start = startOfWeek(range.start);
      const totalWeeks = Math.ceil(differenceInCalendarDays(range.end, start) / 7);
      return Array.from({ length: totalWeeks + 1 }, (_, idx) => addDays(start, idx * 7));
    }
    const start = startOfMonth(range.start);
    const totalMonths = differenceInCalendarMonths(range.end, start);
    return Array.from({ length: totalMonths + 1 }, (_, idx) => addMonths(start, idx));
  }, [range, scale]);

  const getOffsetForDate = (date: Date) => {
    if (!range) return 0;
    const clamped = startOfDay(date);
    if (scale === "day") {
      return differenceInCalendarDays(clamped, range.start) * columnWidth;
    }
    if (scale === "week") {
      return (differenceInCalendarDays(clamped, range.start) / 7) * columnWidth;
    }
    const startMonth = startOfMonth(range.start);
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
      return addDays(range.start, days);
    }
    if (scale === "week") {
      const days = Math.round((offset / columnWidth) * 7);
      return addDays(range.start, days);
    }
    const months = Math.floor(offset / columnWidth);
    const remainder = offset / columnWidth - months;
    const monthStart = addMonths(startOfMonth(range.start), months);
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
    return [
      {
        id: "all",
        label: "All items",
        rows,
      },
    ];
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
    return (
      <div className="p-6 text-sm text-gray-500">
        Add a date field to enable timeline view.
      </div>
    );
  }

  const timelineWidth = Math.max(ticks.length * columnWidth, 600);
  const todayOffset = range ? getOffsetForDate(new Date()) : null;

  return (
    <div className="bg-white p-6">
      <div className="flex items-center gap-3 mb-4">
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
                  className="text-xs text-gray-500 px-2 py-2 border-r border-gray-200 last:border-r-0"
                  style={{ width: columnWidth }}
                >
                  {scale === "month"
                    ? format(tick, "MMM yyyy")
                    : scale === "week"
                    ? format(tick, "MMM d")
                    : format(tick, "MMM d")}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto" ref={scrollRef}>
            <div style={{ width: timelineWidth }}>
              {lanes.map((lane) => {
                const laneRows = lane.rows.filter((row) =>
                  parseDateValue(row.data?.[dateField.id])
                );
                const laneHeight = Math.max(laneRows.length * 64, 72);
                return (
                  <div key={lane.id} className="border-b border-gray-200">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white">
                      {lane.label} · {laneRows.length}
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
                        if (!rowId || !range || !scrollRef.current) return;
                        const rect = scrollRef.current.getBoundingClientRect();
                        const offset = e.clientX - rect.left + scrollRef.current.scrollLeft;
                        const nextDate = getDateFromOffset(offset);
                        if (!nextDate) return;
                        onUpdateCell(rowId, dateField.id, format(nextDate, "yyyy-MM-dd"));
                      }}
                    >
                      {todayOffset !== null && todayOffset >= 0 && todayOffset <= timelineWidth && (
                        <div
                          className="absolute top-0 bottom-0 border-l-2 border-blue-500"
                          style={{ left: todayOffset }}
                        />
                      )}
                      {laneRows.map((row, index) => {
                        const dateValue = parseDateValue(row.data?.[dateField.id]);
                        if (!dateValue) return null;
                        const left = getOffsetForDate(dateValue);
                        const title = primaryField
                          ? String(row.data?.[primaryField.id] ?? "Untitled")
                          : "Untitled";
                        const priorityValue = priorityField ? row.data?.[priorityField.id] : null;
                        const statusValue = statusField ? row.data?.[statusField.id] : null;
                        const personValue = personField ? row.data?.[personField.id] : null;
                        const person = workspaceMembers.find((m) => m.id === personValue);

                        const priority = resolveOption(priorityField, priorityValue) as PriorityLevelConfig | null;
                        const status = resolveOption(statusField, statusValue);

                        return (
                          <div
                            key={row.id}
                            className="absolute"
                            style={{ left, top: index * 64 + 12, width: columnWidth - 16 }}
                          >
                            <div
                              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all cursor-pointer group relative"
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
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium text-gray-900">{title}</div>
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(row.id)}
                                  onChange={(e) =>
                                    onSelectRow(row.id, e as unknown as React.MouseEvent<HTMLInputElement>)
                                  }
                                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-0"
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">{toDateDisplay(dateValue)}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {status && (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border"
                                    style={{
                                      backgroundColor: status.color ? withAlpha(status.color, "1A") : "#f3f4f6",
                                      borderColor: status.color ? withAlpha(status.color, "33") : "#e5e7eb",
                                      color: status.color || "#374151",
                                    }}
                                  >
                                    <span
                                      className="h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: status.color || "#9ca3af" }}
                                    />
                                    {status.label}
                                  </span>
                                )}
                                {priority && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border"
                                    style={{
                                      backgroundColor: priority.color ? withAlpha(priority.color, "1A") : "#f3f4f6",
                                      borderColor: priority.color ? withAlpha(priority.color, "33") : "#e5e7eb",
                                      color: priority.color || "#374151",
                                    }}
                                  >
                                    {getPriorityIcon(priority.order || 0)}
                                    {priority.label}
                                  </span>
                                )}
                                {person && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                                    <span className="h-5 w-5 rounded-full bg-gray-200 text-[10px] flex items-center justify-center text-gray-600">
                                      {formatUserDisplay(person).slice(0, 2).toUpperCase()}
                                    </span>
                                    {formatUserDisplay(person)}
                                  </span>
                                )}
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
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Unscheduled
          </div>
          <div className="space-y-2">
            {unscheduledRows.map((row) => {
              const title = primaryField ? String(row.data?.[primaryField.id] ?? "Untitled") : "Untitled";
              return (
                <div
                  key={row.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, row.id);
                  }}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{title}</div>
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
