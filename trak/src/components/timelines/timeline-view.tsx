"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { format, addDays, differenceInCalendarDays, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfWeek, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { parseLocalDate, parseDateSafe } from "@/lib/due-date";
import { Plus, User, ChevronDown, ChevronRight, ZoomIn, ZoomOut, Filter, Target, Paperclip, X, AlertCircle, ArrowUp, ArrowDown, Minus, ExternalLink, Flag, Link2, Search, Calendar as CalendarIcon, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block, getBlockLocation, updateBlock } from "@/app/actions/block";
import { getAllTeams } from "@/app/actions/workspace-teams";
import type { WorkspaceTeam } from "@/app/actions/workspace-teams";
import { PropertyBadges, PropertyMenu } from "@/components/properties";
import {
  useEntitiesProperties,
  useEntityProperties,
  useSetEntityPropertiesForType,
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import ReferencePicker from "@/components/timelines/reference-picker";
import {
  useTimelineItems,
  useTimelineReferences,
  useCreateTimelineEvent,
  useCreateTimelineReference,
  useUpdateTimelineEvent,
  useDeleteTimelineEvent,
  useDeleteTimelineReference,
  useDuplicateTimelineEvent,
  useSetTimelineEventBaseline,
} from "@/lib/hooks/use-timeline-queries";
import { getSubEventsByParentIds } from "@/app/actions/timelines/query-actions";
import { syncSubEventsForTaskEventsBatch } from "@/app/actions/timelines/event-actions";
import type {
  TimelineBlockContent,
  TimelineEventStatus,
  TimelineEventPriority,
  TimelineNamedPriority,
  TimelineItem,
  ReferenceType,
} from "@/types/timeline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTaskSubtasksWithProperties } from "@/app/actions/tasks/query-actions";
import type { TaskSubtaskWithProperties } from "@/app/actions/tasks/query-actions";
import { createClient } from "@/lib/supabase/client";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragStartEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type ZoomLevel = "day" | "week" | "month" | "quarter" | "year";

interface TimelineEvent {
  id: string;
  title: string;
  start: string; // ISO date
  end: string; // ISO date
  color?: string;
  statuses: Array<{ field_name: string; value: string }>;
  priorities: TimelineNamedPriority[];
  assignee?: string;
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  notes?: string;
  progress?: number; // 0-100
  isMilestone?: boolean;
  baselineStart?: string;
  baselineEnd?: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  parent_event_id?: string | null;
  sourceSyncMode?: "snapshot" | "live" | null;
}

type TimelineEventPatch = Partial<TimelineEvent> & {
  statuses?: Array<{ field_name: string; value: string }>;
  priorities?: TimelineNamedPriority[];
  notes?: string | null;
  color?: string | null;
};

interface TimelineContent {
  viewConfig: TimelineBlockContent["viewConfig"];
}

interface TimelineBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  workspaceId?: string;
  projectId?: string;
  readOnly?: boolean;
}

interface WorkspaceMember {
  id: string;
  user_id?: string | null;
  name: string | null;
  email: string | null;
  role: string;
}

const DEFAULT_COLORS = [
  "bg-blue-500/50",
  "bg-indigo-500/50",
  "bg-purple-500/50",
  "bg-pink-500/50",
  "bg-rose-500/50",
  "bg-orange-500/50",
  "bg-amber-500/50",
  "bg-lime-500/50",
  "bg-green-500/50",
  "bg-emerald-500/50",
  "bg-teal-500/50",
  "bg-cyan-500/50",
];

const PRIORITY_LABELS: Record<TimelineEventPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_PILL_COLORS: Record<TimelineEventPriority, string> = {
  low: "bg-[var(--surface-muted)] text-[var(--muted-foreground)] border-[var(--border)]",
  medium: "bg-amber-500/12 text-amber-700 border-amber-200",
  high: "bg-orange-500/12 text-orange-700 border-orange-200",
  urgent: "bg-red-500/12 text-red-700 border-red-200",
};

const PRIORITY_BUTTON_COLORS: Record<TimelineEventPriority, string> = {
  low: "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
  medium: "border border-amber-200 bg-amber-500/12 text-amber-700 hover:bg-amber-500/18",
  high: "border border-orange-200 bg-orange-500/12 text-orange-700 hover:bg-orange-500/18",
  urgent: "border border-red-200 bg-red-500/12 text-red-700 hover:bg-red-500/18",
};

function normalizeTimelinePrioritiesClient(input: unknown): TimelineNamedPriority[] {
  if (!Array.isArray(input)) return [];

  const normalized: TimelineNamedPriority[] = [];
  const seen = new Set<string>();
  for (const rawEntry of input) {
    const fieldName = String((rawEntry as any)?.field_name ?? "").trim();
    const rawValue = String((rawEntry as any)?.value ?? "").trim().toLowerCase();
    if (!fieldName) continue;
    if (!["low", "medium", "high", "urgent"].includes(rawValue)) continue;
    const key = fieldName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ field_name: fieldName, value: rawValue as TimelineEventPriority });
  }

  return normalized.sort((a, b) =>
    a.field_name.localeCompare(b.field_name, undefined, { sensitivity: "base" })
  );
}

function getTimelinePriorityDisplayLabel(priorityField: TimelineNamedPriority): string {
  return `${PRIORITY_LABELS[priorityField.value]} · ${priorityField.field_name}`;
}

function findWorkspaceMember(members: WorkspaceMember[], memberId?: string | null) {
  if (!memberId) return undefined;
  return members.find((m) => m.id === memberId) || members.find((m) => m.user_id === memberId);
}

function clampDate(d: Date) {
  return startOfDay(d);
}

function EventModalToneChip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn" | "success" }) {
  const t: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-200 dark:ring-zinc-800",
    accent: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-900/15 dark:text-blue-200 dark:ring-blue-800",
    warn: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/15 dark:text-amber-200 dark:ring-amber-900/35",
    success: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/15 dark:text-emerald-200 dark:ring-emerald-900/35",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", t[tone])}>{children}</span>;
}

function daysBetween(a: Date, b: Date) {
  return Math.max(1, differenceInCalendarDays(clampDate(b), clampDate(a)));
}

function buildGrid(start: Date, end: Date, zoomLevel: ZoomLevel = "day") {
  const cells: { key: string; date: Date; dayLabel: string; monthLabel?: string; weekLabel?: string }[] = [];

  if (zoomLevel === "day") {
    const total = daysBetween(start, end);
    for (let i = 0; i <= total; i++) {
      const date = addDays(start, i);
      const dayLabel = format(date, "d");
      const monthLabel = format(date, "d") === "1" ? format(date, "MMM yyyy") : undefined;
      cells.push({ key: `${date.toISOString()}_${i}`, date, dayLabel, monthLabel });
    }
  } else if (zoomLevel === "week") {
    let current = startOfWeek(start);
    const endWeek = endOfWeek(end);
    while (current <= endWeek) {
      const weekStart = startOfWeek(current);
      const weekEnd = endOfWeek(current);
      const weekLabel = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`;
      cells.push({ key: `week_${weekStart.toISOString()}`, date: weekStart, dayLabel: format(weekStart, "d"), monthLabel: format(weekStart, "MMM yyyy"), weekLabel });
      current = addDays(current, 7);
    }
  } else if (zoomLevel === "month") {
    let current = startOfMonth(start);
    const endMonth = endOfMonth(end);
    while (current <= endMonth) {
      const monthLabel = format(current, "MMM yyyy");
      cells.push({ key: `month_${current.toISOString()}`, date: current, dayLabel: format(current, "d"), monthLabel });
      current = addDays(endOfMonth(current), 1);
    }
  } else if (zoomLevel === "quarter") {
    let current = startOfQuarter(start);
    const endQuarter = endOfQuarter(end);
    while (current <= endQuarter) {
      const quarterLabel = `Q${Math.floor(current.getMonth() / 3) + 1} ${format(current, "yyyy")}`;
      cells.push({ key: `quarter_${current.toISOString()}`, date: current, dayLabel: format(current, "d"), monthLabel: quarterLabel });
      current = addDays(endOfQuarter(current), 1);
    }
  } else if (zoomLevel === "year") {
    let current = startOfYear(start);
    const endYear = endOfYear(end);
    while (current <= endYear) {
      const yearLabel = format(current, "yyyy");
      cells.push({ key: `year_${current.toISOString()}`, date: current, dayLabel: format(current, "d"), monthLabel: yearLabel });
      current = addDays(endOfYear(current), 1);
    }
  }

  return cells;
}

function getColumnWidth(zoomLevel: ZoomLevel): number {
  switch (zoomLevel) {
    case "day": return 44;
    case "week": return 80;
    case "month": return 120;
    case "quarter": return 150;
    case "year": return 200;
    default: return 44;
  }
}

function dateToColumn(date: Date, rangeStart: Date, zoomLevel: ZoomLevel): number {
  const clamped = clampDate(date);
  const start = clampDate(rangeStart);

  if (zoomLevel === "day") {
    return differenceInCalendarDays(clamped, start);
  } else if (zoomLevel === "week") {
    const startWeek = startOfWeek(start);
    const dateWeek = startOfWeek(clamped);
    return Math.floor(differenceInCalendarDays(dateWeek, startWeek) / 7);
  } else if (zoomLevel === "month") {
    const startMonth = startOfMonth(start);
    const dateMonth = startOfMonth(clamped);
    const monthsDiff = (dateMonth.getFullYear() - startMonth.getFullYear()) * 12 + (dateMonth.getMonth() - startMonth.getMonth());
    return monthsDiff;
  } else if (zoomLevel === "quarter") {
    const startQuarter = startOfQuarter(start);
    const dateQuarter = startOfQuarter(clamped);
    const quartersDiff = ((dateQuarter.getFullYear() - startQuarter.getFullYear()) * 4) +
      (Math.floor(dateQuarter.getMonth() / 3) - Math.floor(startQuarter.getMonth() / 3));
    return quartersDiff;
  } else if (zoomLevel === "year") {
    return date.getFullYear() - start.getFullYear();
  }
  return 0;
}

function weekColumnOffset(date: Date, rangeStart: Date): number {
  const clamped = clampDate(date);
  const startWeek = startOfWeek(clampDate(rangeStart));
  const dateWeek = startOfWeek(clamped);
  const weekIndex = differenceInCalendarDays(dateWeek, startWeek) / 7;
  const dayOffset = differenceInCalendarDays(clamped, dateWeek);
  return weekIndex + dayOffset / 7;
}

function quarterColumnOffset(date: Date, rangeStart: Date): number {
  const clamped = clampDate(date);
  const startQuarter = startOfQuarter(clampDate(rangeStart));
  const dateQuarter = startOfQuarter(clamped);
  const quarterIndex = ((dateQuarter.getFullYear() - startQuarter.getFullYear()) * 4) +
    (Math.floor(dateQuarter.getMonth() / 3) - Math.floor(startQuarter.getMonth() / 3));
  const quarterStart = dateQuarter;
  const quarterEnd = endOfQuarter(dateQuarter);
  const daysInQuarter = differenceInCalendarDays(addDays(quarterEnd, 1), quarterStart);
  const dayOffset = differenceInCalendarDays(clamped, quarterStart);
  return quarterIndex + dayOffset / daysInQuarter;
}

function monthColumnOffset(date: Date, rangeStart: Date): number {
  const clamped = clampDate(date);
  const startMonth = startOfMonth(clampDate(rangeStart));
  const dateMonth = startOfMonth(clamped);
  const monthIndex = (dateMonth.getFullYear() - startMonth.getFullYear()) * 12 +
    (dateMonth.getMonth() - startMonth.getMonth());
  const monthStart = dateMonth;
  const monthEnd = endOfMonth(dateMonth);
  const daysInMonth = differenceInCalendarDays(addDays(monthEnd, 1), monthStart);
  const dayOffset = differenceInCalendarDays(clamped, monthStart);
  return monthIndex + dayOffset / daysInMonth;
}

function columnToDate(column: number, rangeStart: Date, zoomLevel: ZoomLevel): Date {
  const start = clampDate(rangeStart);

  if (zoomLevel === "day") {
    return addDays(start, column);
  } else if (zoomLevel === "week") {
    return addDays(startOfWeek(start), column * 7);
  } else if (zoomLevel === "month") {
    const startMonth = startOfMonth(start);
    const targetMonth = new Date(startMonth);
    targetMonth.setMonth(targetMonth.getMonth() + column);
    return startOfMonth(targetMonth);
  } else if (zoomLevel === "quarter") {
    const startQuarter = startOfQuarter(start);
    const targetQuarter = new Date(startQuarter);
    targetQuarter.setMonth(targetQuarter.getMonth() + column * 3);
    return startOfQuarter(targetQuarter);
  } else if (zoomLevel === "year") {
    const targetYear = new Date(start);
    targetYear.setFullYear(targetYear.getFullYear() + column);
    return startOfYear(targetYear);
  }
  return start;
}

// Droppable Column Component
function DroppableColumn({
  id,
  columnIndex,
  columnWidth,
  readOnly,
}: {
  id: string;
  columnIndex: number;
  columnWidth: number;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return null;
  }

  const baseProps = {
    className: "absolute",
    style: {
      gridColumn: columnIndex + 1,
      gridRow: `1 / -1`,
      width: `${columnWidth}px`,
      height: "100%",
    },
  } as const;

  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} {...baseProps} />;
}

// Draggable Event Component
function DraggableEvent({
  event,
  rowIndex,
  isCritical,
  isDragging,
  onMouseEnter,
  onMouseLeave,
  onClick,
  barStyle,
  columnWidth,
  readOnly,
  onAddSubEvent,
}: {
  event: TimelineEvent;
  rowIndex: number;
  isCritical: boolean;
  isDragging: boolean;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  barStyle: React.CSSProperties;
  columnWidth: number;
  readOnly?: boolean;
  onAddSubEvent?: (eventId: string) => void;
}) {
  if (readOnly) {
    const progress = event.progress ?? 0;
    const hasBaseline = event.baselineStart && event.baselineEnd;
    const barWidth =
      typeof barStyle.width === "string"
        ? parseFloat(barStyle.width)
        : typeof barStyle.width === "number"
          ? barStyle.width
          : 0;
    const needsTitleLabel =
      !event.isMilestone &&
      barWidth > 0 &&
      event.title &&
      (barWidth < 90 || event.title.length * 6 > barWidth - 24);
    return (
      <div
        className="absolute z-10 pointer-events-auto"
        style={barStyle}
        data-event-id={event.id}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        suppressHydrationWarning
      >
        {hasBaseline && (
          <div
            className="absolute top-0 h-1 bg-blue-200 dark:bg-blue-900/30"
            style={{
              left: 0,
              width: "100%",
              transform: "translateY(-100%)",
            }}
          />
        )}

        {event.isMilestone ? (
          <div
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0",
              "border-l-[8px] border-r-[8px] border-b-[12px]",
              "border-l-transparent border-r-transparent",
              event.color || "border-b-[var(--foreground)]"
            )}
            style={{
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
            }}
          />
        ) : (
          <>
            {needsTitleLabel && (
              <div className="absolute -top-5 left-0 z-20 max-w-[200px] truncate rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--foreground)] shadow-sm pointer-events-none">
                {event.title}
              </div>
            )}
            <div
              className={cn(
                "event-bar relative overflow-hidden flex h-8 w-full items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-sm",
                event.color || "bg-[var(--foreground)]"
              )}
            >
              {progress > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-white/20 rounded-[6px]"
                  style={{ width: `${progress}%` }}
                />
              )}
              <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
              <span className="flex-1 truncate relative z-10">{event.title}</span>
              {event.source_entity_id && (
                <span className="shrink-0 relative z-10" title="Linked from another item">
                  <Link2 className="h-3 w-3 opacity-90" aria-hidden />
                </span>
              )}
              {(event.statuses?.[0]?.value) && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/70 relative z-10" aria-label={`status-${event.statuses?.[0]?.value ?? "todo"}`} />
              )}
              {progress > 0 && (
                <span className="ml-auto text-[10px] relative z-10">{progress}%</span>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const { attributes, listeners, setNodeRef, transform, isDragging: isDraggingStart } = useDraggable({
    id: `event-${event.id}`,
    disabled: false,
  });

  const { attributes: resizeStartAttrs, listeners: resizeStartListeners, setNodeRef: resizeStartRef } = useDraggable({
    id: `resize-start-${event.id}`,
    disabled: event.isMilestone,
  });

  const { attributes: resizeEndAttrs, listeners: resizeEndListeners, setNodeRef: resizeEndRef } = useDraggable({
    id: `resize-end-${event.id}`,
    disabled: event.isMilestone,
  });

  const style = transform
    ? {
      ...barStyle,
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.5 : 1,
    }
    : {
      ...barStyle,
      opacity: isDragging ? 0.5 : 1
    };

  const progress = event.progress ?? 0;
  const hasBaseline = event.baselineStart && event.baselineEnd;
  const barWidth =
    typeof barStyle.width === "string"
      ? parseFloat(barStyle.width)
      : typeof barStyle.width === "number"
        ? barStyle.width
        : 0;
  const needsTitleLabel =
    !event.isMilestone &&
    barWidth > 0 &&
    event.title &&
    (barWidth < 90 || event.title.length * 6 > barWidth - 24);

  return (
    <div
      ref={setNodeRef}
      className="absolute z-10 pointer-events-auto"
      style={style}
      data-event-id={event.id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      suppressHydrationWarning
    >
      {/* Baseline comparison */}
      {hasBaseline && (
        <div
          className="absolute top-0 h-1 bg-blue-200 dark:bg-blue-900/30"
          style={{
            left: 0,
            width: "100%",
            transform: "translateY(-100%)",
          }}
        />
      )}
      {/* Milestone marker */}
      {event.isMilestone ? (
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0",
            "border-l-[8px] border-r-[8px] border-b-[12px]",
            "border-l-transparent border-r-transparent",
            isCritical ? "border-b-red-500" : event.color || "border-b-[var(--foreground)]"
          )}
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
          }}
        />
      ) : (
        <>
          {needsTitleLabel && (
            <div className="absolute -top-5 left-0 z-20 max-w-[200px] truncate rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--foreground)] shadow-sm pointer-events-none">
              {event.title}
            </div>
          )}
          {/* Event bar */}
          <div
            className={cn(
              "event-bar group relative overflow-hidden flex h-8 w-full items-center gap-2 rounded-[6px] px-3 pr-7 text-[11px] text-white shadow-sm transition-transform cursor-move",
              isCritical && "ring-2 ring-red-500 ring-offset-1",
              event.color || "bg-[var(--foreground)]"
            )}
            {...attributes}
            {...listeners}
            suppressHydrationWarning
          >
            {/* Progress bar overlay */}
            {progress > 0 && (
              <div
                className="absolute left-0 top-0 h-full bg-white/20 rounded-[6px]"
                style={{ width: `${progress}%` }}
              />
            )}

            <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
            <span className="flex-1 truncate relative z-10">{event.title}</span>
            {event.source_entity_id && (
              <span className="shrink-0 relative z-10" title="Linked from another item">
                <Link2 className="h-3 w-3 opacity-90" aria-hidden />
              </span>
            )}
            {(event.statuses?.[0]?.value) && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/70 relative z-10" aria-label={`status-${event.statuses?.[0]?.value ?? "todo"}`} />}
            {progress > 0 && (
              <span className="ml-auto text-[10px] relative z-10">{progress}%</span>
            )}
            {!readOnly && onAddSubEvent && (
              <button
                type="button"
                className="absolute right-1 top-1/2 z-20 h-5 w-5 -translate-y-1/2 rounded text-xs opacity-0 transition-opacity hover:bg-white/25 group-hover:opacity-100"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubEvent(event.id);
                }}
                title="Add sub-event"
              >
                +
              </button>
            )}
          </div>

          {/* Resize handles */}
          <div
            ref={resizeStartRef}
            {...resizeStartAttrs}
            {...resizeStartListeners}
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-30"
            style={{ marginLeft: "-4px" }}
            suppressHydrationWarning
          />
          <div
            ref={resizeEndRef}
            {...resizeEndAttrs}
            {...resizeEndListeners}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-30"
            style={{ marginRight: "-4px" }}
            suppressHydrationWarning
          />
        </>
      )}
    </div>
  );
}

export default function TimelineBlock({ block, onUpdate, workspaceId, projectId, readOnly = false }: TimelineBlockProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const content = (block.content || {}) as Partial<TimelineContent> & Record<string, any>;
  const viewConfig = content.viewConfig || {
    startDate: content.startDate || addDays(new Date(), -7).toISOString(),
    endDate: content.endDate || addDays(new Date(), 30).toISOString(),
    zoomLevel: content.zoomLevel || "day",
    filters: content.filters || {},
    groupBy: content.groupBy || "none",
  };

  const initialZoomLevel: ZoomLevel =
    viewConfig.zoomLevel === "year" ? "quarter" : (viewConfig.zoomLevel || "day");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(initialZoomLevel);

  const baseRange = useMemo(() => {
    const startDate = viewConfig.startDate ? new Date(viewConfig.startDate) : addDays(new Date(), -7);
    const endDate = viewConfig.endDate ? new Date(viewConfig.endDate) : addDays(new Date(), 30);
    return {
      start: clampDate(startDate),
      end: clampDate(endDate),
    };
  }, [viewConfig.startDate, viewConfig.endDate]);

  const displayRange = useMemo(() => {
    if (zoomLevel === "month" || zoomLevel === "quarter" || zoomLevel === "year") {
      return {
        start: startOfYear(baseRange.start),
        end: endOfYear(baseRange.end),
      };
    }
    return baseRange;
  }, [baseRange, zoomLevel]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number; maxHeight?: number } | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addEventButtonRef = useRef<HTMLButtonElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // New state for Phase 1 & 2 features
  const [filters, setFilters] = useState(viewConfig.filters || {});
  const [groupBy, setGroupBy] = useState<"none" | "status" | "assignee">(viewConfig.groupBy || "none");
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragResizeEdge, setDragResizeEdge] = useState<"start" | "end" | null>(null);
  const [addSubEventParentId, setAddSubEventParentId] = useState<string | null>(null);
  const [newSubEventTitle, setNewSubEventTitle] = useState("");
  const [newSubEventStart, setNewSubEventStart] = useState("");
  const [newSubEventEnd, setNewSubEventEnd] = useState("");

  const { data: timelineItems = [] } = useTimelineItems(block.id);
  const timelineEventIds = useMemo(() => timelineItems.map((item) => item.id), [timelineItems]);
  const { data: timelinePropertiesById = {} } = useEntitiesProperties(
    "timeline_event",
    timelineEventIds,
    workspaceId
  );
  const createEvent = useCreateTimelineEvent(block.id);
  const createReference = useCreateTimelineReference(block.id);
  const updateEventMutation = useUpdateTimelineEvent(block.id);
  const deleteEventMutation = useDeleteTimelineEvent(block.id);
  const deleteReferenceMutation = useDeleteTimelineReference(block.id);
  const duplicateEventMutation = useDuplicateTimelineEvent(block.id);
  const setBaselineMutation = useSetTimelineEventBaseline(block.id);
  const setTimelineProperties = useSetEntityPropertiesForType("timeline_event", workspaceId || "");
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  // Load workspace members
  useEffect(() => {
    if (readOnly) {
      setMembers([]);
      return;
    }

    if (!workspaceId) {
      console.warn('⚠️ No workspaceId provided to TimelineBlock');
      setMembers([]);
      return;
    }

    const loadMembers = async () => {
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "1") console.log(`[PERF] client timeline getWorkspaceMembers workspaceId=${workspaceId}`);
      const response = await fetch(`/api/workspaces/members?workspaceId=${encodeURIComponent(workspaceId)}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (response.ok && json?.data) {
        setMembers(json.data);
      } else {
        console.error('❌ Error loading members:', json?.error || 'Failed to fetch workspace members');
        setMembers([]);
      }
    };

    loadMembers();
  }, [workspaceId, readOnly]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const updateWidth = () => {
      setContainerWidth(node.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);


  // Mount flag for portal (avoids SSR/TS issues)
  React.useEffect(() => setMounted(true), []);

  const openPanel = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedEventId(null);
  };

  // Position the modal next to the timeline when it opens
  React.useEffect(() => {
    if (!isPanelOpen) {
      setModalPosition(null);
      return;
    }

    const doUpdate = () => {
      const el = timelineContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 12;
      const modalWidth = 384;
      const padding = 16;
      const minModalHeight = 280;
      let left = rect.right + gap;
      if (left + modalWidth + padding > window.innerWidth) {
        left = rect.left - modalWidth - gap;
      }
      left = Math.max(padding, Math.min(left, window.innerWidth - modalWidth - padding));
      // Keep modal fully on screen: prefer aligning to timeline top, but never let bottom go below viewport
      const maxTop = window.innerHeight - minModalHeight - padding;
      const top = Math.max(padding, Math.min(rect.top, maxTop));
      // Cap modal height so it never extends below the viewport
      const maxHeight = window.innerHeight - top - padding;

      setModalPosition(prev => {
        if (prev && Math.abs(prev.top - top) < 2 && Math.abs(prev.left - left) < 2 && prev.maxHeight === maxHeight) {
          return prev;
        }
        return { top, left, maxHeight };
      });
    };

    const timer = setTimeout(doUpdate, 0);
    window.addEventListener("resize", doUpdate);
    window.addEventListener("scroll", doUpdate, true);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", doUpdate);
      window.removeEventListener("scroll", doUpdate, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isPanelOpen, closePanel]);

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

  const grid = useMemo(
    () => buildGrid(displayRange.start, displayRange.end, zoomLevel),
    [displayRange.start, displayRange.end, zoomLevel]
  );
  const totalColumns = useMemo(() => grid.length, [grid]);
  const baseColumnWidth = useMemo(() => getColumnWidth(zoomLevel), [zoomLevel]);
  const columnWidth = useMemo(() => {
    if (!containerWidth || totalColumns === 0) return baseColumnWidth;
    const fillWidth = Math.floor(containerWidth / totalColumns);
    return Math.max(baseColumnWidth, fillWidth);
  }, [baseColumnWidth, containerWidth, totalColumns]);
  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.id, member.name ?? member.email ?? "Unknown");
      if (member.user_id) {
        map.set(member.user_id, member.name ?? member.email ?? "Unknown");
      }
    });
    return map;
  }, [members]);

  const events = useMemo<TimelineEvent[]>(() => {
    return timelineItems.map((item) => {
      const props = timelinePropertiesById[item.id];
      const assigneeId = props?.assignee_id ?? item.assignee_id ?? null;
      const assigneeTeamId = item.assignee_team_id ?? null;
      const propertyPriorities = normalizeTimelinePrioritiesClient(props?.priorities ?? []);
      const itemPriorities = normalizeTimelinePrioritiesClient(item.priorities ?? []);
      const priorities = propertyPriorities.length > 0 ? propertyPriorities : itemPriorities;
      return {
        id: item.id,
        title: item.title,
        start: item.start_date,
        end: item.end_date,
        color: item.color || undefined,
        statuses: item.statuses ?? [],
        priorities,
        assignee: assigneeId ? memberMap.get(assigneeId) : undefined,
        assigneeId,
        assigneeTeamId,
        progress: item.progress,
        notes: item.notes ?? undefined,
        isMilestone: item.is_milestone,
        baselineStart: item.baseline_start ?? undefined,
        baselineEnd: item.baseline_end ?? undefined,
        source_entity_type: item.source_entity_type ?? undefined,
        source_entity_id: item.source_entity_id ?? undefined,
        parent_event_id: item.parent_event_id ?? null,
        sourceSyncMode: item.source_sync_mode ?? null,
      };
    });
  }, [timelineItems, timelinePropertiesById, memberMap]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events.filter((e) => !e.parent_event_id);

    const statusFilters = filters?.status ?? [];
    const assigneeFilters = filters?.assignee ?? [];

    if (statusFilters.length > 0) {
      filtered = filtered.filter(e => {
        const s = e.statuses?.[0]?.value ?? "todo";
        return s && statusFilters.includes(s);
      });
    }

    if (assigneeFilters.length > 0) {
      filtered = filtered.filter(e => e.assignee && assigneeFilters.includes(e.assignee));
    }

    return filtered;
  }, [events, filters]);

  const parentEventIds = useMemo(() => filteredEvents.map((e) => e.id), [filteredEvents]);
  const { data: subEventsByParentId = {} } = useQuery({
    queryKey: ["timelineSubEvents", block.id, parentEventIds.join(",")],
    queryFn: async () => {
      const result = await getSubEventsByParentIds(block.id, parentEventIds);
      if ("error" in result) return {} as Record<string, TimelineEvent[]>;
      return Object.fromEntries(
        Object.entries(result.data).map(([parentId, subEvents]) => [
          parentId,
          subEvents.map((subEvent) => {
            const props = timelinePropertiesById[subEvent.id];
            const assigneeId = props?.assignee_id ?? subEvent.assignee_id ?? null;
            return {
              id: subEvent.id,
              title: subEvent.title,
              start: subEvent.start_date,
              end: subEvent.end_date,
              color: subEvent.color || undefined,
              statuses: subEvent.statuses ?? [],
              priorities: normalizeTimelinePrioritiesClient(subEvent.priorities ?? []),
              assignee: assigneeId ? memberMap.get(assigneeId) : undefined,
              assigneeId,
              assigneeTeamId: subEvent.assignee_team_id ?? null,
              progress: subEvent.progress ?? 0,
              notes: subEvent.notes ?? undefined,
              isMilestone: subEvent.is_milestone ?? false,
              baselineStart: subEvent.baseline_start ?? undefined,
              baselineEnd: subEvent.baseline_end ?? undefined,
              source_entity_type: subEvent.source_entity_type ?? undefined,
              source_entity_id: subEvent.source_entity_id ?? undefined,
              parent_event_id: subEvent.parent_event_id ?? null,
              sourceSyncMode: subEvent.source_sync_mode ?? null,
            } as TimelineEvent;
          }),
        ])
      );
    },
    enabled: parentEventIds.length > 0,
    staleTime: 15_000,
  });

  const taskSourcedParents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => event.source_entity_type === "task" && Boolean(event.source_entity_id) && !event.parent_event_id
      ),
    [filteredEvents]
  );
  const taskSourcedSyncKey = useMemo(
    () => taskSourcedParents.map((event) => `${event.id}:${event.source_entity_id}`).sort().join(","),
    [taskSourcedParents]
  );

  useEffect(() => {
    if (readOnly || taskSourcedParents.length === 0) return;
    let cancelled = false;
    syncSubEventsForTaskEventsBatch(
      taskSourcedParents.map((event) => ({
        parentEventId: event.id,
        taskId: event.source_entity_id!,
        timelineBlockId: block.id,
      }))
    ).then(() => {
      if (cancelled) return;
      queryClient.invalidateQueries({ queryKey: ["timelineSubEvents", block.id] });
    });
    return () => {
      cancelled = true;
    };
  }, [readOnly, taskSourcedSyncKey, block.id, queryClient, taskSourcedParents]);

  // Group events
  const groupedEvents = useMemo(() => {
    if (groupBy === "none") {
      return { "": filteredEvents };
    } else if (groupBy === "status") {
      const groups: Record<string, TimelineEvent[]> = {};
      filteredEvents.forEach(event => {
        const key = event.statuses?.[0]?.value ?? "todo";
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
      });
      return groups;
    } else if (groupBy === "assignee") {
      const groups: Record<string, TimelineEvent[]> = {};
      filteredEvents.forEach(event => {
        const key = event.assignee || "Unassigned";
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
      });
      return groups;
    }
    return { "": filteredEvents };
  }, [filteredEvents, groupBy]);

  // Flat row model: same ordering as grid (for left rail 1:1 alignment)
  const flatRows = React.useMemo(() => {
    const entries = Object.entries(groupedEvents);
    const rows: Array<{ event: TimelineEvent; rowIndex: number; groupKey: string }> = [];
    let rowIndex = 0;
    for (const [groupKey, events] of entries) {
      for (const ev of events) {
        rows.push({ event: ev, rowIndex, groupKey });
        rowIndex += 1;
      }
    }
    return rows;
  }, [groupedEvents]);

  const MAIN_BAR_HEIGHT = 32;
  const SUBEVENT_BAR_HEIGHT = 20;
  const ROW_HEIGHT_BASE = 44;

  const { rowHeights, rowTops, totalRowHeight } = useMemo(() => {
    const heights = flatRows.map(({ event }) => {
      const children = subEventsByParentId[event.id] ?? [];
      if (children.length === 0) return ROW_HEIGHT_BASE;
      return MAIN_BAR_HEIGHT + children.length * SUBEVENT_BAR_HEIGHT + 16;
    });
    const tops: number[] = [];
    let acc = 0;
    for (const h of heights) {
      tops.push(acc);
      acc += h;
    }
    return { rowHeights: heights, rowTops: tops, totalRowHeight: acc };
  }, [flatRows, subEventsByParentId]);

  const totalRowCount = Math.max(1, flatRows.length);

  // Sort events by start date
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [filteredEvents]);

  function toCol(date: Date) {
    return Math.max(0, Math.min(totalColumns - 1, dateToColumn(date, displayRange.start, zoomLevel)));
  }

  function barStyle(startISO: string, endISO: string, rowTop: number): React.CSSProperties {
    const s = clampDate(new Date(startISO));
    const e = clampDate(new Date(endISO));
    let left = 0;
    let width = 0;
    if (zoomLevel === "week") {
      const startOffset = weekColumnOffset(s, displayRange.start);
      const endOffset = weekColumnOffset(addDays(e, 1), displayRange.start);
      const clampedStart = Math.max(0, Math.min(totalColumns, startOffset));
      const clampedEnd = Math.max(0, Math.min(totalColumns, endOffset));
      const span = Math.max(1 / 7, clampedEnd - clampedStart);
      left = clampedStart * columnWidth;
      width = span * columnWidth;
    } else if (zoomLevel === "month") {
      const startOffset = monthColumnOffset(s, displayRange.start);
      const endOffset = monthColumnOffset(addDays(e, 1), displayRange.start);
      const clampedStart = Math.max(0, Math.min(totalColumns, startOffset));
      const clampedEnd = Math.max(0, Math.min(totalColumns, endOffset));
      const daysInMonth = differenceInCalendarDays(addDays(endOfMonth(s), 1), startOfMonth(s));
      const span = Math.max(1 / Math.max(1, daysInMonth), clampedEnd - clampedStart);
      left = clampedStart * columnWidth;
      width = span * columnWidth;
    } else if (zoomLevel === "quarter") {
      const startOffset = quarterColumnOffset(s, displayRange.start);
      const endOffset = quarterColumnOffset(addDays(e, 1), displayRange.start);
      const clampedStart = Math.max(0, Math.min(totalColumns, startOffset));
      const clampedEnd = Math.max(0, Math.min(totalColumns, endOffset));
      const daysInQuarter = differenceInCalendarDays(addDays(endOfQuarter(s), 1), startOfQuarter(s));
      const span = Math.max(1 / Math.max(1, daysInQuarter), clampedEnd - clampedStart);
      left = clampedStart * columnWidth;
      width = span * columnWidth;
    } else {
      const startCol = toCol(s);
      const endCol = toCol(e);
      const span = Math.max(1, endCol - startCol + 1);
      left = startCol * columnWidth;
      width = span * columnWidth;
    }
    // rowTop is pixel offset for this row; offset by 8px (py-2) to align bar top with sidebar content top
    const topOffset = rowTop + 8;
    return {
      position: "absolute" as const,
      left: `${left}px`,
      width: `${width}px`,
      top: `${topOffset}px`,
    };
  }

  function barStyleForSubEvent(startISO: string, endISO: string, rowTop: number, subEventIndex: number): React.CSSProperties {
    const base = barStyle(startISO, endISO, rowTop);
    const top = rowTop + 8 + MAIN_BAR_HEIGHT + subEventIndex * SUBEVENT_BAR_HEIGHT + (SUBEVENT_BAR_HEIGHT / 2) - 8;
    return {
      ...base,
      top: `${top}px`,
      left: `calc(${base.left} + 12px)`,
      width: `calc(${base.width} - 24px)`,
      height: "16px",
      minWidth: "4px",
    };
  }

  const addEvent = () => {
    setIsAddDialogOpen(true);
  };

  const saveNewEvent = async (eventData: Omit<TimelineEvent, "id">) => {
    const result = await createEvent.mutateAsync({
      timelineBlockId: block.id,
      title: eventData.title,
      startDate: eventData.start,
      endDate: eventData.end,
      statuses: (eventData.statuses ?? []).map((s) => ({ field_name: s.field_name, value: s.value as TimelineEventStatus })),
      priorities: eventData.priorities ?? [],
      notes: eventData.notes ?? null,
      progress: eventData.progress ?? 0,
      color: eventData.color ?? null,
      isMilestone: eventData.isMilestone ?? false,
    });
    setIsAddDialogOpen(false);
    if ("error" in result) {
      console.error("Failed to save new event:", result.error);
    } else if (workspaceId && eventData.assigneeId) {
      const member = findWorkspaceMember(members, eventData.assigneeId);
      const propertyAssigneeId = member?.user_id ?? eventData.assigneeId;
      try {
        await setTimelineProperties.mutateAsync({
          entityId: result.data.id,
          updates: { assignee_id: propertyAssigneeId },
        });
      } catch (error) {
        console.error("Failed to set timeline assignee property:", error);
      }
    }
  };

  const saveNewSubEvent = async () => {
    if (!addSubEventParentId || !newSubEventTitle.trim() || !newSubEventStart || !newSubEventEnd) return;
    const result = await createEvent.mutateAsync({
      timelineBlockId: block.id,
      parentEventId: addSubEventParentId,
      title: newSubEventTitle.trim(),
      startDate: newSubEventStart,
      endDate: newSubEventEnd,
      statuses: [{ field_name: "Status", value: "todo" as TimelineEventStatus }],
    });
    if ("error" in result) {
      console.error("Failed to create sub-event:", result.error);
      return;
    }
    setAddSubEventParentId(null);
    setNewSubEventTitle("");
  };

  const removeEvent = async (id: string) => {
    const result = await deleteEventMutation.mutateAsync(id);
    if (selectedEventId === id) {
      closePanel();
    }
    if ("error" in result) {
      console.error("Failed to remove event:", result.error);
    }
  };

  const duplicateEvent = async (id: string) => {
    const result = await duplicateEventMutation.mutateAsync(id);
    if ("error" in result) {
      console.error("Failed to duplicate event:", result.error);
    }
  };

  const updateEvent = async (id: string, patch: TimelineEventPatch) => {
    const updates: Record<string, unknown> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.start !== undefined) updates.startDate = patch.start;
    if (patch.end !== undefined) updates.endDate = patch.end;
    if (patch.statuses !== undefined) updates.statuses = patch.statuses;
    if (patch.priorities !== undefined) updates.priorities = patch.priorities;
    if (patch.assigneeId !== undefined) {
      const member = findWorkspaceMember(members, patch.assigneeId ?? null);
      const propertyAssigneeId = member?.user_id ?? patch.assigneeId ?? null;
      if (workspaceId) {
        try {
          await setTimelineProperties.mutateAsync({
            entityId: id,
            updates: { assignee_id: propertyAssigneeId },
          });
        } catch (error) {
          console.error("Failed to update timeline assignee property:", error);
        }
      }
    }
    if (patch.assigneeTeamId !== undefined) updates.assigneeTeamId = patch.assigneeTeamId;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.progress !== undefined) updates.progress = patch.progress;
    if (patch.color !== undefined) updates.color = patch.color;
    if (patch.isMilestone !== undefined) updates.isMilestone = patch.isMilestone;
    if (patch.baselineStart !== undefined) updates.baselineStart = patch.baselineStart ?? null;
    if (patch.baselineEnd !== undefined) updates.baselineEnd = patch.baselineEnd ?? null;
    if (patch.sourceSyncMode !== undefined) updates.sourceSyncMode = patch.sourceSyncMode;

    const result = await updateEventMutation.mutateAsync({
      eventId: id,
      updates,
    });
    if ("error" in result) {
      console.error("Failed to update event:", result.error);
      // Don't call onUpdate on error to avoid stale state
    }
  };

  // Update zoom level
  const handleZoomChange = async (newZoom: ZoomLevel) => {
    const nextViewConfig = {
      startDate: viewConfig.startDate,
      endDate: viewConfig.endDate,
      zoomLevel: newZoom,
      filters,
      groupBy,
    };
    setZoomLevel(newZoom);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        viewConfig: nextViewConfig,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update zoom level:", result.error);
    }
  };


  // Update filters
  const handleFilterChange = async (newFilters: typeof filters) => {
    setFilters(newFilters);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        viewConfig: {
          startDate: viewConfig.startDate,
          endDate: viewConfig.endDate,
          zoomLevel,
          filters: newFilters,
          groupBy,
        },
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update filters:", result.error);
      setFilters(filters);
    }
  };

  // Update group by
  const handleGroupByChange = async (newGroupBy: typeof groupBy) => {
    setGroupBy(newGroupBy);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        viewConfig: {
          startDate: viewConfig.startDate,
          endDate: viewConfig.endDate,
          zoomLevel,
          filters,
          groupBy: newGroupBy,
        },
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update group by:", result.error);
      setGroupBy(groupBy);
    }
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const eventId = event.active.id as string;
    if (eventId.startsWith("event-")) {
      setDraggingEventId(eventId.replace("event-", ""));
    } else if (eventId.startsWith("resize-start-")) {
      setDraggingEventId(eventId.replace("resize-start-", ""));
      setDragResizeEdge("start");
    } else if (eventId.startsWith("resize-end-")) {
      setDraggingEventId(eventId.replace("resize-end-", ""));
      setDragResizeEdge("end");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const eventId = draggingEventId;
    const edge = dragResizeEdge;

    if (!eventId) {
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    const activeEvent = events.find(e => e.id === eventId);
    if (!activeEvent) {
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    const overId = event.over?.id as string;
    if (!overId || !overId.startsWith("column-")) {
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    if (!block?.id) {
      console.error("Cannot move event: block.id is missing");
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    const columnIndex = parseInt(overId.replace("column-", ""));
    if (isNaN(columnIndex)) {
      console.error("Invalid column index:", overId);
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    const newDate = columnToDate(columnIndex, displayRange.start, zoomLevel);
    const currentStart = clampDate(new Date(activeEvent.start));
    const currentEnd = clampDate(new Date(activeEvent.end));
    const duration = Math.max(0, differenceInCalendarDays(currentEnd, currentStart));

    let nextStart = currentStart;
    let nextEnd = currentEnd;

    if (edge === "start") {
      nextStart = clampDate(newDate);
      nextEnd = clampDate(addDays(nextStart, duration));
    } else if (edge === "end") {
      nextEnd = clampDate(newDate);
      if (nextEnd < currentStart) {
        nextEnd = currentStart;
      }
    } else {
      // Moving entire event
      nextStart = clampDate(newDate);
      nextEnd = clampDate(addDays(nextStart, duration));
    }

    if (nextStart.getTime() === currentStart.getTime() && nextEnd.getTime() === currentEnd.getTime()) {
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    if (nextStart > nextEnd) {
      setDraggingEventId(null);
      setDragResizeEdge(null);
      return;
    }

    const updatedEvent: TimelineEvent = {
      ...activeEvent,
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
    };

    try {
      await updateEvent(eventId, updatedEvent);
    } catch (error) {
      console.error("Error updating event after drag:", error);
    } finally {
      setDraggingEventId(null);
      setDragResizeEdge(null);
    }
  };

  // Save baseline
  const saveBaseline = async () => {
    const eventUpdates = events
      .map((event) =>
        setBaselineMutation.mutateAsync({
          eventId: event.id,
          baseline: {
            start: event.baselineStart || event.start,
            end: event.baselineEnd || event.end,
          },
        })
      );

    const results = await Promise.all(eventUpdates);
    results.forEach((result) => {
      if ("error" in result) {
        console.error("Failed to save baseline:", result.error);
      }
    });
  };

  // Navigate to reference
  const navigateToReference = (ref: { reference_type: string; reference_id: string; tab_id?: string; project_id?: string; is_workflow?: boolean }) => {
    if (ref.reference_type === "doc") {
      router.push(`/dashboard/docs/${ref.reference_id}`);
    } else if (ref.reference_type === "block" && ref.tab_id) {
      if (ref.is_workflow) {
        router.push(`/dashboard/workflow/${ref.tab_id}#block-${ref.reference_id}`);
      } else if (ref.project_id) {
        router.push(`/dashboard/projects/${ref.project_id}/tabs/${ref.tab_id}#block-${ref.reference_id}`);
      }
    } else if (ref.reference_type === "table_row") {
      // For table rows, we could navigate to the table view
      // For now, just log - can be enhanced later
      console.log("Navigation to table rows not yet implemented", ref);
    }
  };

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const { data: selectedReferences = [] } = useTimelineReferences(selectedEventId ?? undefined);
  const { data: hoveredReferences = [] } = useTimelineReferences(hoveredEventId ?? undefined);
  const editPanel = !readOnly && isPanelOpen && selectedEvent && modalPosition ? (
    <>
      <div
        className="fixed inset-0 z-[99998] bg-black/20"
        aria-hidden
        onClick={closePanel}
      />
      <div
        className="fixed z-[99999] w-[calc(100vw-24px)] max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-hidden flex flex-col"
        style={{
          top: modalPosition.top,
          left: modalPosition.left,
          maxHeight: modalPosition.maxHeight != null ? modalPosition.maxHeight : "calc(100vh - 32px)",
        }}
        role="dialog"
        aria-modal
        aria-label={`Event details: ${selectedEvent.title}`}
      >
        <EventDetailsPanel
          event={selectedEvent}
          isOpen={isPanelOpen}
          onClose={closePanel}
          onUpdate={(patch) => updateEvent(selectedEvent.id, patch)}
          references={selectedReferences}
          workspaceId={workspaceId}
          onAddReference={() => setIsReferenceDialogOpen(true)}
          onNavigateToReference={navigateToReference}
          subEventsByParentId={subEventsByParentId}
          onSelectEvent={(eventId) => openPanel(eventId)}
          onAddSubEvent={(parentEventId) => {
            setAddSubEventParentId(parentEventId);
            const parent = events.find((item) => item.id === parentEventId);
            const fallbackStart = parent?.start ?? displayRange.start.toISOString();
            const fallbackEnd = parent?.end ?? fallbackStart;
            setNewSubEventTitle("");
            setNewSubEventStart(format(parseDateSafe(fallbackStart) || new Date(fallbackStart), "yyyy-MM-dd"));
            setNewSubEventEnd(format(parseDateSafe(fallbackEnd) || new Date(fallbackEnd), "yyyy-MM-dd"));
          }}
          variant="modal"
        />
      </div>
    </>
  ) : null;
  const editPanelPortal = typeof document !== "undefined" && editPanel ? createPortal(editPanel, document.body) : editPanel;

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
                {event.source_entity_id && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                    <Link2 className="h-3 w-3 shrink-0" />
                    <span>Linked from {event.source_entity_type === "task" ? "task" : event.source_entity_type ?? "source"}</span>
                  </div>
                )}
                {event.assignee && (
                  <div className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
                    Assignee: {event.assignee}
                  </div>
                )}
                {Array.isArray(event.priorities) && event.priorities.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {event.priorities.map((priorityField) => (
                      <span
                        key={`${event.id}-tooltip-priority-${priorityField.field_name.toLowerCase()}`}
                        className={cn(
                          "inline-flex max-w-[260px] items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                          PRIORITY_PILL_COLORS[priorityField.value]
                        )}
                        title={getTimelinePriorityDisplayLabel(priorityField)}
                      >
                        <span className="truncate">{getTimelinePriorityDisplayLabel(priorityField)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {event.notes && (
                  <div className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
                    {event.notes}
                  </div>
                )}
                {hoveredReferences.length > 0 && (
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <Paperclip className="h-3 w-3 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        {hoveredReferences.length} attachment{hoveredReferences.length !== 1 ? 's' : ''}
                      </div>
                      {hoveredReferences.slice(0, 3).map((ref) => (
                        <div key={ref.id} className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
                          • {ref.title}
                        </div>
                      ))}
                      {hoveredReferences.length > 3 && (
                        <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                          +{hoveredReferences.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="mt-3 flex items-center gap-2">
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
            )}
          </div>
        );
      })()
      : null;

  const timelineContent = (
    <div className="space-y-3 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Timeline</h2>
          <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
            {format(displayRange.start, "MMM d")} – {format(displayRange.end, "MMM d, yyyy")}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(["day", "week", "month", "quarter"] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => handleZoomChange(level)}
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

          {/* Filter/Group controls */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors">
                <Filter className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuLabel>Group By</DropdownMenuLabel>
              {(["none", "status", "assignee"] as const).map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => handleGroupByChange(option)}
                  className={groupBy === option ? "bg-[var(--surface-hover)]" : ""}
                >
                  {option === "none" ? "No Grouping" : option.charAt(0).toUpperCase() + option.slice(1)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              {(["todo", "in_progress", "blocked", "done"] as const).map((status) => {
                const isSelected = filters.status?.includes(status);
                return (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => {
                      const newStatusFilters = filters.status || [];
                      const updated = isSelected
                        ? newStatusFilters.filter((s: typeof status) => s !== status)
                        : [...newStatusFilters, status];
                      handleFilterChange({ ...filters, status: updated });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", isSelected ? "bg-[var(--foreground)]" : "border border-[var(--border)]")} />
                      {status}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save baseline */}
          {!readOnly && (
            <button
              onClick={saveBaseline}
              className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Save baseline"
            >
              <Target className="h-3.5 w-3.5" />
            </button>
          )}

          {!readOnly && (
            <Button ref={addEventButtonRef} size="sm" onClick={addEvent} className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add event
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] border border-[var(--border)] bg-[var(--surface)] w-full">
        {/* Left rail: event list aligned 1:1 with timeline rows */}
        <div className="border-r border-[var(--border)] bg-[var(--surface)] flex flex-col min-w-[320px] w-[320px] shrink-0">
          <div className="sticky top-0 z-10 min-h-[44px] border-b border-[var(--border)] bg-[var(--surface)] shrink-0" />
          <div className="flex flex-col min-h-0">
            {flatRows.length === 0 ? (
              <div className="min-h-[44px] border-b border-[var(--border)] flex items-center px-3 text-sm text-[var(--muted-foreground)]">
                No events
              </div>
            ) : (
              flatRows.map(({ event, rowIndex }) => {
                const rowSubEvents = subEventsByParentId[event.id] ?? [];
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "min-h-[44px] border-b border-[var(--border)] flex flex-col gap-1 px-3 py-2",
                      rowIndex % 2 === 1 ? "bg-[var(--surface-hover)]/50" : "bg-[var(--surface)]"
                    )}
                    style={{ minHeight: rowHeights[rowIndex] ?? 44 }}
                  >
                    <div className="flex items-center gap-2 min-h-[20px]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm text-[var(--foreground)] font-medium">
                          <span className="truncate">{event.title || "Untitled"}</span>
                          {event.source_entity_id && (
                            <span className="shrink-0 text-[var(--muted-foreground)]" title="Linked from another item">
                              <Link2 className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </div>
                        {event.assignee && (
                          <div className="truncate text-[10px] text-[var(--muted-foreground)] mt-0.5">
                            {event.assignee}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-[10px] text-[var(--tertiary-foreground)] whitespace-nowrap">
                        {format(new Date(event.start), "MMM d")}
                        {event.start !== event.end && ` – ${format(new Date(event.end), "MMM d")}`}
                      </div>
                    </div>
                    {rowSubEvents.length > 0 && (
                      <ul className="mt-0.5 pl-4 space-y-0.5 border-l border-[var(--border)] ml-1">
                        {rowSubEvents.map((child) => (
                          <li
                            key={child.id}
                            className={cn(
                              "flex items-center gap-2 text-[11px] text-[var(--muted-foreground)] truncate cursor-pointer hover:text-[var(--foreground)]"
                            )}
                            onClick={() => openPanel(child.id)}
                          >
                            <Minus className="h-3 w-3 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                            <span className="truncate flex-1 min-w-0">{child.title || "Untitled"}</span>
                            <span className="text-[9px] text-[var(--tertiary-foreground)] shrink-0">
                              {format(parseDateSafe(child.start) || new Date(), "MMM d")}
                              {child.start !== child.end && `-${format(parseDateSafe(child.end) || new Date(), "MMM d")}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: timeline canvas (horizontal scroll) */}
        <div ref={scrollRef} className="overflow-x-auto min-w-0">
          <div className="inline-block min-w-0 w-full" style={{ minWidth: `${totalColumns * columnWidth}px` }}>
            {/* Sticky date header */}
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] h-[44px] overflow-hidden">
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${totalColumns}, ${columnWidth}px)` }}
              >
                {grid.map((c, idx) => (
                  <div
                    key={`dateheader_${c.key}`}
                    className="flex h-[44px] flex-col items-center justify-center border-l border-[var(--border)] py-2 text-[10px] text-[var(--tertiary-foreground)] first:border-l-0"
                  >
                    {c.monthLabel ? (
                      <span className="mb-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                        {c.monthLabel}
                      </span>
                    ) : (
                      <span className="mb-0.5" />
                    )}
                    {c.weekLabel ? (
                      <span className="text-[9px]">{c.weekLabel}</span>
                    ) : (
                      <span>{c.dayLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline grid: row-based, no per-cell borders */}
            <div
              className="relative grid select-none"
              style={{
                position: "relative",
                gridTemplateColumns: `repeat(${totalColumns}, ${columnWidth}px)`,
                gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "),
                minHeight: totalRowHeight,
              }}
            >
              {/* Droppable columns for drag-and-drop */}
              {!readOnly &&
                grid.map((c, idx) => (
                  <DroppableColumn
                    key={`drop_${c.key}`}
                    id={`column-${idx}`}
                    columnIndex={idx}
                    columnWidth={columnWidth}
                  />
                ))}

              {/* Vertical grid lines (one per column) */}
              {grid.map((c, idx) => (
                <div
                  key={`vline_${c.key}`}
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--border)]"
                  style={{
                    left: idx * columnWidth,
                    height: totalRowHeight,
                  }}
                />
              ))}
              {/* Right edge line */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--border)]"
                style={{
                  left: totalColumns * columnWidth,
                  height: totalRowHeight,
                }}
              />

              {/* Horizontal row separators */}
              {rowTops.map((top, i) => (
                <div
                  key={`hline_${i}`}
                  className="pointer-events-none absolute left-0 right-0 h-px bg-[var(--border)]"
                  style={{ top, width: totalColumns * columnWidth }}
                />
              ))}
              {totalRowCount > 0 && (
                <div
                  className="pointer-events-none absolute left-0 right-0 h-px bg-[var(--border)]"
                  style={{ top: totalRowHeight, width: totalColumns * columnWidth }}
                />
              )}
              {/* Alternating row banding (subtle) */}
              {rowTops.map((top, rowIndex) => (
                <div
                  key={`band_${rowIndex}`}
                  className="pointer-events-none absolute left-0"
                  style={{
                    top,
                    left: 0,
                    width: totalColumns * columnWidth,
                    height: rowHeights[rowIndex] ?? 44,
                    backgroundColor: rowIndex % 2 === 1 ? "var(--surface-hover)" : undefined,
                    opacity: 0.5,
                  }}
                />
              ))}

              {/* Events overlay */}
              {Object.entries(groupedEvents).flatMap(([groupKey, groupEvents], groupIndex) =>
                groupEvents.map((it, eventIndexInGroup) => {
                  const eventRowIndex = Object.entries(groupedEvents)
                    .slice(0, groupIndex)
                    .reduce((sum, [, events]) => sum + events.length, 0) + eventIndexInGroup;

                  const isDragging = draggingEventId === it.id;

                  return (
                    <DraggableEvent
                      key={it.id}
                      event={it}
                      rowIndex={eventRowIndex}
                      isCritical={false}
                      isDragging={isDragging}
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
                      onClick={(e) => {
                        if (readOnly) return;
                        e.stopPropagation();
                        openPanel(it.id);
                        setHoveredEventId(null);
                        setTooltipPosition(null);
                      }}
                      barStyle={barStyle(it.start, it.end, rowTops[eventRowIndex] ?? 0)}
                      columnWidth={columnWidth}
                      readOnly={readOnly}
                      onAddSubEvent={(parentId) => {
                        setAddSubEventParentId(parentId);
                        const parent = events.find((event) => event.id === parentId);
                        const fallbackStart = parent?.start ?? displayRange.start.toISOString();
                        const fallbackEnd = parent?.end ?? fallbackStart;
                        setNewSubEventTitle("");
                        setNewSubEventStart(format(parseDateSafe(fallbackStart) || new Date(fallbackStart), "yyyy-MM-dd"));
                        setNewSubEventEnd(format(parseDateSafe(fallbackEnd) || new Date(fallbackEnd), "yyyy-MM-dd"));
                      }}
                    />
                  );
                })
              )}

              {/* Sub-event bars (real DB records, interactive) */}
              {flatRows.flatMap(({ event, rowIndex }) => {
                const children = subEventsByParentId[event.id] ?? [];
                const rowTop = rowTops[rowIndex] ?? 0;
                return children.map((child, childIndex) => {
                  const subStyle = barStyleForSubEvent(child.start, child.end, rowTop, childIndex);
                  return (
                    <div
                      key={`subevent-${child.id}`}
                      className="absolute z-10 rounded-[4px] border-l-2 border-[var(--primary)]/60 bg-[var(--primary)]/20 cursor-pointer hover:bg-[var(--primary)]/30"
                      style={subStyle}
                      data-event-id={child.id}
                      onClick={() => openPanel(child.id)}
                      title={child.title}
                    >
                      <span className="absolute inset-0 flex items-center px-2 truncate text-[9px] text-[var(--foreground)]/90">
                        {child.title}
                      </span>
                    </div>
                  );
                });
              })}

              {/* Empty state when no events */}
              {sortedEvents.length === 0 && (
                <div
                  className="py-12 text-center"
                  style={{
                    gridColumn: `1 / span ${totalColumns}`,
                    gridRow: 1,
                  }}
                >
                  <p className="text-sm text-[var(--muted-foreground)]">No events yet. Click "Add event" to create your first milestone.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <DragOverlay>
          {draggingEventId ? (
            (() => {
              const draggingEvent = events.find(e => e.id === draggingEventId);
              if (!draggingEvent) return null;
              return (
                <div className={cn(
                  "flex h-8 items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-lg",
                  draggingEvent.color || "bg-[var(--foreground)]"
                )}>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
                  <span className="flex-1 truncate">{draggingEvent.title}</span>
                </div>
              );
            })()
          ) : null}
        </DragOverlay>
      )}

      {/* Hover Tooltip */}
      {mounted && tooltipEl && createPortal(tooltipEl, document.body)}

      {/* Add Event Popover */}
      {!readOnly && (
        <AddEventPopover
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onSave={saveNewEvent}
          defaultStart={displayRange.start}
          defaultEnd={addDays(displayRange.start, 3)}
          members={members}
          workspaceId={workspaceId}
          anchorRef={addEventButtonRef}
        />
      )}
      {!readOnly && (
        <Dialog open={Boolean(addSubEventParentId)} onOpenChange={(open) => { if (!open) setAddSubEventParentId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add sub-event</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)]">Title</label>
                <input
                  type="text"
                  value={newSubEventTitle}
                  onChange={(e) => setNewSubEventTitle(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sub-event title"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">Start</label>
                  <input
                    type="date"
                    value={newSubEventStart}
                    onChange={(e) => setNewSubEventStart(e.target.value)}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--muted-foreground)]">End</label>
                  <input
                    type="date"
                    value={newSubEventEnd}
                    onChange={(e) => setNewSubEventEnd(e.target.value)}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddSubEventParentId(null)}>Cancel</Button>
              <Button onClick={saveNewSubEvent} disabled={!newSubEventTitle.trim() || !newSubEventStart || !newSubEventEnd}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {!readOnly && projectId && workspaceId && (
        <ReferencePicker
          isOpen={isReferenceDialogOpen}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() => setIsReferenceDialogOpen(false)}
          onSelect={async (item) => {
            if (!selectedEventId) return false;
            const result = await createReference.mutateAsync({
              timelineBlockId: block.id,
              eventId: selectedEventId,
              referenceType: item.referenceType as ReferenceType,
              referenceId: item.id,
              tableId: null,
            });
            if ("error" in result) {
              console.error("Failed to create reference:", result.error);
              return false;
            }
            return true;
          }}
        />
      )}

    </div>
  );

  if (readOnly) {
    return (
      <>
        <div ref={timelineContainerRef} className="relative w-full">
          {timelineContent}
        </div>
        {editPanelPortal}
      </>
    );
  }

  return (
    <>
      <div ref={timelineContainerRef} className="relative w-full">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {timelineContent}
        </DndContext>
      </div>
      {editPanelPortal}
    </>
  );
}

// Add Event Popover – compact popup above Add event button
function AddEventPopover({
  isOpen,
  onClose,
  onSave,
  defaultStart,
  defaultEnd,
  members,
  workspaceId,
  anchorRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<TimelineEvent, "id">) => void;
  defaultStart: Date;
  defaultEnd: Date;
  members: WorkspaceMember[];
  workspaceId?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
}) {
  const statusOptions = STATUS_OPTIONS.map(o => ({ id: o.value, label: o.label, color: o.color }));
  const priorityOptions = PRIORITY_OPTIONS.map(o => ({ id: o.value, label: o.label, color: o.color }));

  const getInitialState = React.useCallback(
    () => ({
      title: "New event",
      start: defaultStart.toISOString(),
      end: defaultEnd.toISOString(),
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      statuses: [{ field_name: "Status", value: "todo" }],
      priorities: [],
      progress: 0,
      isMilestone: false,
      assigneeId: null as string | null,
    }),
    [defaultStart, defaultEnd]
  );

  const [local, setLocal] = useState<Omit<TimelineEvent, "id">>(getInitialState);
  const [showColors, setShowColors] = useState(false);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    if (!local.title.trim()) return;
    onSave(local);
  };

  React.useEffect(() => {
    if (isOpen) {
      setLocal(getInitialState());
    }
  }, [isOpen, getInitialState]);

  // Position popover above the Add event button; update on resize/scroll
  const updatePosition = React.useCallback(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const margin = 8;
    const maxW = Math.min(300, Math.max(260, window.innerWidth - 24));
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - maxW / 2, window.innerWidth - maxW - margin));
    const top = Math.max(margin, rect.top - 360 - margin);
    setPopoverRect({ top, left });
  }, [anchorRef]);

  React.useLayoutEffect(() => {
    if (!isOpen || !anchorRef?.current) {
      setPopoverRect(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, anchorRef, updatePosition]);

  // Click outside to close
  React.useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target) && anchorRef?.current && !anchorRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose, anchorRef]);

  // Escape to close
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !popoverRect) return null;

  const maxW = Math.min(300, Math.max(260, window.innerWidth - 24));

  const popoverContent = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Add event"
      className="fixed z-[100] flex flex-col rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
      style={{
        top: popoverRect?.top ?? -9999,
        left: popoverRect?.left ?? -9999,
        width: maxW,
        maxHeight: Math.min(window.innerHeight * 0.85, 360),
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--foreground)]">Add event</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 px-3 py-2 space-y-2.5">
        {/* Title */}
        <div>
          <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Title</label>
          <input
            type="text"
            value={local.title}
            onChange={(e) => setLocal((s) => ({ ...s, title: e.target.value }))}
            className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
            placeholder="Event title"
            autoFocus
          />
        </div>

        {/* Color & Status */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Color</label>
            <div className="relative">
              <button
                type="button"
                className={cn(
                  "w-full h-8 rounded-[4px] border border-[var(--border)] flex items-center gap-1.5 px-2",
                  local.color || "bg-neutral-900"
                )}
                onClick={() => setShowColors((v) => !v)}
              >
                <div className={cn("h-3.5 w-3.5 rounded-full", local.color || "bg-neutral-900")} />
                <span className="text-[11px] text-[var(--muted-foreground)]">Change</span>
              </button>
              {showColors && (
                <div className="absolute z-10 mt-1 grid grid-cols-6 gap-1.5 p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn("h-6 w-6 rounded-full", c)}
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
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Status</label>
            <select
              value={local.statuses?.[0]?.value ?? "todo"}
              onChange={(e) => setLocal((s) => ({ ...s, statuses: [{ field_name: "Status", value: e.target.value }] }))}
              className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
            >
              {statusOptions.length > 0 ? (
                statusOptions.map((opt: any) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))
              ) : (
                <>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Start</label>
            <input
              type="date"
              value={format(parseDateSafe(local.start) || new Date(local.start), "yyyy-MM-dd")}
              onChange={(e) => setLocal((s) => ({ ...s, start: parseLocalDate(e.target.value).toISOString() }))}
              className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] disabled:opacity-50"
              disabled={local.isMilestone}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">End</label>
            <input
              type="date"
              value={format(parseDateSafe(local.end) || new Date(local.end), "yyyy-MM-dd")}
              onChange={(e) => setLocal((s) => ({ ...s, end: parseLocalDate(e.target.value).toISOString() }))}
              className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] disabled:opacity-50"
              disabled={local.isMilestone}
            />
          </div>
        </div>

        {/* Progress & Milestone */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Progress %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={local.progress === 0 ? "" : local.progress}
              onChange={(e) => {
                const v = e.target.value;
                setLocal((s) => ({ ...s, progress: v === "" ? 0 : Math.min(100, Math.max(0, parseInt(v) || 0)) }));
              }}
              placeholder="0"
              className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-1.5 cursor-pointer py-1.5">
              <input
                type="checkbox"
                checked={local.isMilestone ?? false}
                onChange={(e) => {
                  setLocal((s) => ({
                    ...s,
                    isMilestone: e.target.checked,
                    end: e.target.checked ? s.start : s.end,
                  }));
                }}
                className="w-3.5 h-3.5 rounded border-[var(--border)]"
              />
              <span className="text-[11px] text-[var(--foreground)]">Milestone</span>
            </label>
          </div>
        </div>

        {/* Priority & Assignee - compact row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Priority</label>
            <select
              value={local.priorities?.[0]?.value ?? ""}
              onChange={(e) => setLocal((s) => ({
                ...s,
                priorities: e.target.value ? [{ field_name: "Priority", value: e.target.value as TimelineEventPriority }] : [],
              }))}
              className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
            >
              <option value="">None</option>
              {priorityOptions.length > 0 ? (
                priorityOptions.map((opt: any) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))
              ) : (
                <>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Assignee</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full h-8 px-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[11px] text-left flex items-center gap-1.5 hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]">
                  <User className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                  <span className={cn("truncate", local.assigneeId ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
                    {findWorkspaceMember(members, local.assigneeId)?.name || "Unassigned"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] shrink-0 ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 max-h-48 overflow-y-auto z-[110]">
                <DropdownMenuItem
                  onClick={() => setLocal((s) => ({ ...s, assigneeId: null }))}
                  className="text-[11px] text-[var(--muted-foreground)]"
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.length > 0 ? (
                  members.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setLocal((s) => ({ ...s, assigneeId: member.user_id ?? member.id }))}
                      className="text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[10px] font-medium shrink-0">
                          {(member.name ?? member.email ?? "?")[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="truncate">{member.name ?? member.email ?? "Unknown"}</span>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-[11px] text-[var(--muted-foreground)]">
                    Loading...
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Notes - compact */}
        <div>
          <label className="text-[11px] font-medium text-[var(--muted-foreground)] mb-0.5 block">Notes</label>
          <textarea
            value={local.notes ?? ""}
            onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))}
            className="w-full px-2 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-xs min-h-[48px] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] resize-none"
            placeholder="Optional..."
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 px-3 py-2 border-t border-[var(--border)]">
        <Button variant="outline" size="sm" onClick={onClose} className="h-7 px-2 text-xs">
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!local.title.trim()} className="h-7 px-2 text-xs">
          Add
        </Button>
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}

function EventDetailsPanel({
  event,
  isOpen,
  onClose,
  onUpdate,
  references,
  workspaceId,
  onAddReference,
  onNavigateToReference,
  subEventsByParentId,
  onSelectEvent,
  onAddSubEvent,
  variant = "sidebar",
}: {
  event: TimelineEvent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (patch: TimelineEventPatch) => void;
  references: Array<{ id: string; reference_type: string; reference_id: string; title: string; type_label?: string; tab_id?: string; project_id?: string; is_workflow?: boolean }>;
  workspaceId?: string;
  onAddReference: () => void;
  onNavigateToReference?: (ref: { reference_type: string; reference_id: string; tab_id?: string; project_id?: string; is_workflow?: boolean }) => void;
  subEventsByParentId: Record<string, TimelineEvent[]>;
  onSelectEvent: (eventId: string) => void;
  onAddSubEvent: (parentEventId: string) => void;
  variant?: "sidebar" | "modal";
}) {
  const { data: direct } = useEntityProperties("timeline_event", event.id);
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const { data: teams = [] } = useQuery({
    queryKey: ["workspaceTeams", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const r = await getAllTeams(workspaceId);
      if ("error" in r) return [];
      return r.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const eventPriorities = useMemo(
    () => normalizeTimelinePrioritiesClient(event.priorities ?? []),
    [event.priorities]
  );
  const directPriorities = useMemo(
    () => normalizeTimelinePrioritiesClient(direct?.priorities ?? []),
    [direct?.priorities]
  );
  const effectivePriorities = directPriorities.length > 0 ? directPriorities : eventPriorities;

  const [local, setLocal] = useState<{
    status: string | null;
    assigneeId: string | null;
    assigneeTeamId: string | null;
    progress: number;
    notes: string;
    start: string;
    end: string;
    isMilestone: boolean;
    color: string | null;
  }>({
    status: event.statuses?.[0]?.value ?? null,
    assigneeId: event.assigneeId ?? null,
    assigneeTeamId: event.assigneeTeamId ?? null,
    progress: event.progress ?? 0,
    notes: event.notes ?? "",
    start: event.start,
    end: event.end,
    isMilestone: event.isMilestone ?? false,
    color: event.color ?? null,
  });
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [assigneeSearchOpen, setAssigneeSearchOpen] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [notesOpen, setNotesOpen] = useState(Boolean((event.notes ?? "").trim()));
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false);
  const assigneeSearchInputRef = useRef<HTMLInputElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const taskId = event.source_entity_type === "task" ? event.source_entity_id ?? null : null;
  const subEvents = subEventsByParentId[event.id] ?? [];
  const { data: subtasksData } = useQuery({
    queryKey: ["taskSubtasksWithProperties", taskId],
    queryFn: async () => {
      if (!taskId) return { data: [] };
      const r = await getTaskSubtasksWithProperties(taskId);
      if ("error" in r) return { data: [] as TaskSubtaskWithProperties[] };
      return { data: r.data };
    },
    enabled: Boolean(isOpen && taskId),
    staleTime: 30_000,
  });
  const subtasks: TaskSubtaskWithProperties[] = subtasksData?.data ?? [];

  const resizeNotesTextarea = React.useCallback(() => {
    const el = notesTextareaRef.current;
    if (!el || variant !== "modal") return;
    el.style.height = "auto";
    const lineHeight = 20;
    const minH = lineHeight + 8;
    const maxH = 200;
    const h = Math.max(minH, Math.min(el.scrollHeight, maxH));
    el.style.height = `${h}px`;
    el.style.overflowY = h >= maxH ? "auto" : "hidden";
  }, [variant]);

  React.useEffect(() => {
    resizeNotesTextarea();
  }, [local.notes, resizeNotesTextarea]);

  // Scroll content to top when panel opens or event changes so the event details are visible
  React.useEffect(() => {
    if (isOpen && contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [isOpen, event.id]);

  React.useEffect(() => {
    setLocal({
      status: event.statuses?.[0]?.value ?? null,
      assigneeId: event.assigneeId ?? null,
      assigneeTeamId: event.assigneeTeamId ?? null,
      progress: event.progress ?? 0,
      notes: event.notes ?? "",
      start: event.start,
      end: event.end,
      isMilestone: event.isMilestone ?? false,
      color: event.color ?? null,
    });
    setIsColorDialogOpen(false);
    setAssigneeSearchQuery("");
    setAssigneeSearchOpen(false);
    setNotesOpen(Boolean((event.notes ?? "").trim()));
  }, [event]);

  const selectedMember = local.assigneeId ? findWorkspaceMember(workspaceMembers, local.assigneeId) : undefined;
  const selectedTeam = local.assigneeTeamId ? (teams as WorkspaceTeam[]).find((t) => t.id === local.assigneeTeamId) : undefined;
  const assigneeLabel = selectedTeam
    ? selectedTeam.name
    : selectedMember
      ? (selectedMember?.name ?? selectedMember?.email ?? "Unassigned")
      : "Unassigned";
  const assigneeSearchLower = assigneeSearchQuery.trim().toLowerCase();
  const filteredTeamsForSearch = useMemo(
    () =>
      assigneeSearchLower
        ? (teams as WorkspaceTeam[]).filter((t) => t.name.toLowerCase().includes(assigneeSearchLower))
        : (teams as WorkspaceTeam[]),
    [teams, assigneeSearchLower]
  );
  const filteredMembersForSearch = useMemo(
    () =>
      assigneeSearchLower
        ? workspaceMembers.filter(
            (m) =>
              (m.name ?? "").toLowerCase().includes(assigneeSearchLower) ||
              (m.email ?? "").toLowerCase().includes(assigneeSearchLower)
          )
        : workspaceMembers,
    [workspaceMembers, assigneeSearchLower]
  );

  const handleStartChange = (value: string) => {
    if (!value) return;
    const nextStart = clampDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDate(value) : new Date(value));
    let nextEnd = clampDate(parseDateSafe(local.end) ?? new Date(local.end));
    if (nextStart > nextEnd) {
      nextEnd = nextStart;
    }
    const nextStartIso = nextStart.toISOString();
    const nextEndIso = nextEnd.toISOString();
    setLocal((s) => ({ ...s, start: nextStartIso, end: nextEndIso }));
    if (nextStartIso !== event.start || nextEndIso !== event.end) {
      onUpdate({ start: nextStartIso, end: nextEndIso });
    }
  };

  const handleEndChange = (value: string) => {
    if (!value) return;
    let nextEnd = clampDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? parseLocalDate(value) : new Date(value));
    let nextStart = clampDate(parseDateSafe(local.start) ?? new Date(local.start));
    if (nextEnd < nextStart) {
      nextStart = nextEnd;
    }
    const nextStartIso = nextStart.toISOString();
    const nextEndIso = nextEnd.toISOString();
    setLocal((s) => ({ ...s, start: nextStartIso, end: nextEndIso }));
    if (nextStartIso !== event.start || nextEndIso !== event.end) {
      onUpdate({ start: nextStartIso, end: nextEndIso });
    }
  };

  const handleStatusChange = (value: string) => {
    const nextStatus = value === "none" ? null : value;
    setLocal((s) => ({ ...s, status: nextStatus }));
    const nextStatuses = nextStatus ? [{ field_name: "Status", value: nextStatus }] : [];
    if ((event.statuses?.[0]?.value ?? null) !== nextStatus) {
      onUpdate({ statuses: nextStatuses });
    }
  };

  const handleAddPriority = (value: TimelineEventPriority) => {
    const current = event.priorities ?? [];
    const next = [...current.filter((p) => p.field_name.toLowerCase() !== "priority"), { field_name: "Priority", value }];
    onUpdate({ priorities: next });
  };

  const handleAssigneeChange = (assigneeId: string | null) => {
    setLocal((s) => ({ ...s, assigneeId, assigneeTeamId: null }));
    if ((event.assigneeId ?? null) !== assigneeId || (event.assigneeTeamId ?? null) !== null) {
      onUpdate({ assigneeId, assigneeTeamId: null });
    }
  };

  const handleAssigneeTeamChange = (assigneeTeamId: string | null) => {
    setLocal((s) => ({ ...s, assigneeTeamId, assigneeId: null }));
    if ((event.assigneeTeamId ?? null) !== assigneeTeamId || (event.assigneeId ?? null) !== null) {
      onUpdate({ assigneeTeamId, assigneeId: null });
    }
  };

  const handleAssigneeClear = () => {
    setLocal((s) => ({ ...s, assigneeId: null, assigneeTeamId: null }));
    if ((event.assigneeId ?? null) !== null || (event.assigneeTeamId ?? null) !== null) {
      onUpdate({ assigneeId: null, assigneeTeamId: null });
    }
  };

  const handleColorChange = (color: string | null) => {
    setLocal((s) => ({ ...s, color }));
    if ((event.color ?? null) !== color) {
      onUpdate({ color } as TimelineEventPatch);
    }
  };

  const handleProgressBlur = () => {
    const nextProgress = Math.min(100, Math.max(0, Number(local.progress) || 0));
    setLocal((s) => ({ ...s, progress: nextProgress }));
    if ((event.progress ?? 0) !== nextProgress) {
      onUpdate({ progress: nextProgress });
    }
  };

  const handleNotesBlur = () => {
    const nextNotes = local.notes.trim();
    const prevNotes = (event.notes ?? "").trim();
    if (nextNotes !== prevNotes) {
      onUpdate({ notes: nextNotes.length > 0 ? nextNotes : null } as TimelineEventPatch);
    }
  };

  const colorChoices = [
    { value: null as string | null, className: "bg-[var(--foreground)]", label: "Default" },
    ...DEFAULT_COLORS.map((color) => ({ value: color, className: color, label: color })),
  ];
  const currentColorClass = local.color ?? "bg-[var(--foreground)]";

  if (!isOpen) return null;

  const isModal = variant === "modal";
  const statusDisplay = (local.status === "todo" || !local.status) ? "Todo" : (local.status === "in_progress" ? "In Progress" : local.status === "blocked" ? "Blocked" : "Done");
  const statusTone = (s: string | null) => (s === "done" ? "success" : s === "blocked" ? "warn" : s === "in_progress" ? "accent" : "neutral");
  const priorityTone = (v: string) => (v === "high" || v === "urgent" ? "warn" : v === "medium" ? "accent" : "neutral");
  const statusLabel = (local.status === "todo" || !local.status) ? "Todo" : (local.status === "in_progress" ? "In Progress" : local.status === "blocked" ? "Blocked" : "Done");
  const formatSubEventRange = (child: TimelineEvent) => {
    const start = format(parseDateSafe(child.start) || new Date(child.start), "MMM d");
    const end = format(parseDateSafe(child.end) || new Date(child.end), "MMM d");
    return child.start === child.end ? start : `${start} - ${end}`;
  };
  const p = Math.max(0, Math.min(100, Number.isFinite(local.progress) ? local.progress : 0));
  const displayColor = local.color ?? "#111827";
  const isHexColor = typeof displayColor === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(displayColor);

  const Divider = () => <div className="h-px bg-zinc-200/80 dark:bg-zinc-800/80" />;
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[9px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">{children}</div>
  );

  if (isModal) {
    return (
      <>
      <div className="flex flex-col min-h-0 overflow-hidden h-full w-full bg-white dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">TIMELINE EVENT</div>
            <div className="mt-0.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsColorDialogOpen(true)}
                className={cn("h-4 w-4 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800 cursor-pointer", isHexColor ? "" : displayColor || "bg-zinc-700")}
                style={isHexColor ? { background: displayColor } : undefined}
                aria-label="Pick color"
              />
              <span className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{event.title || "Event details"}</span>
            </div>
            {event.source_entity_id && (
              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <Link2 className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="truncate">Linked from{" "}
                  <button
                    type="button"
                    onClick={async () => {
                      const entityType = event.source_entity_type ?? "block";
                      const entityId = event.source_entity_id!;
                      if (!onNavigateToReference) return;
                      if (entityType === "doc") {
                        onNavigateToReference({ reference_type: "doc", reference_id: entityId });
                      } else if (entityType === "task" || entityType === "block") {
                        const loc = await getBlockLocation(entityId);
                        if ("data" in loc) {
                          onNavigateToReference({ reference_type: "block", reference_id: entityId, tab_id: loc.data.tab_id, project_id: loc.data.project_id ?? undefined, is_workflow: loc.data.is_workflow });
                        }
                      } else if (entityType === "table_row") {
                        onNavigateToReference({ reference_type: "table_row", reference_id: entityId });
                      }
                    }}
                    className="underline hover:text-[var(--primary)] focus:outline-none focus:underline"
                  >
                    {event.source_entity_type === "task" ? "task" : event.source_entity_type ?? "source"}
                  </button>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-zinc-400">·</span>
                  <span className="text-xs text-zinc-500">Sync with source</span>
                  <Switch
                    checked={event.sourceSyncMode === "live"}
                    onCheckedChange={(checked) => onUpdate({ sourceSyncMode: checked ? "live" : "snapshot" })}
                  />
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[.98] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Divider />
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto min-h-0 px-4" data-event-details-modal="true">
          <div className="py-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-zinc-400 shrink-0" />
              <SectionLabel>SCHEDULE</SectionLabel>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <label className="block">
                <span className="sr-only">Start date</span>
                <input
                  type="date"
                  value={format(parseDateSafe(local.start) || new Date(local.start), "yyyy-MM-dd")}
                  onChange={(e) => handleStartChange(e.target.value)}
                  className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs shadow-sm outline-none focus:border-blue-500/55 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-800 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="sr-only">End date</span>
                <input
                  type="date"
                  value={format(parseDateSafe(local.end) || new Date(local.end), "yyyy-MM-dd")}
                  onChange={(e) => handleEndChange(e.target.value)}
                  disabled={local.isMilestone}
                  className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs shadow-sm outline-none focus:border-blue-500/55 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-800 dark:bg-zinc-950"
                />
              </label>
            </div>
          </div>
          {event.parent_event_id && (
            <>
              <Divider />
              <div className="py-2">
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:underline"
                  onClick={() => onSelectEvent(event.parent_event_id!)}
                >
                  ← Parent event
                </button>
              </div>
            </>
          )}
          {!event.parent_event_id && (
            <>
              <Divider />
              <div className="py-2">
                <div className="flex items-center justify-between">
                  <SectionLabel>SUB-EVENTS</SectionLabel>
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 hover:underline"
                    onClick={() => onAddSubEvent(event.id)}
                  >
                    + Add
                  </button>
                </div>
                {subEvents.length === 0 ? (
                  <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">No sub-events yet</div>
                ) : (
                  <ul className="mt-1.5 space-y-1 pl-2">
                    {subEvents.map((child) => (
                      <li key={child.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          onClick={() => onSelectEvent(child.id)}
                        >
                          <span className="truncate flex-1">{child.title}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{formatSubEventRange(child)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          {taskId && (
            <>
              <Divider />
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => setSubtasksCollapsed((c) => !c)}
                  className="flex items-center gap-2 w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-[6px] py-0.5 -mx-1 px-1"
                >
                  {subtasksCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                  )}
                  <SectionLabel>SUBTASKS</SectionLabel>
                  {subtasks.length > 0 && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">({subtasks.length})</span>
                  )}
                </button>
                {!subtasksCollapsed && (
                  <ul className="mt-1.5 space-y-1 pl-6">
                    {subtasks.length === 0 ? (
                      <li className="text-[11px] text-zinc-500 dark:text-zinc-400">No subtasks</li>
                    ) : (
                      subtasks.map((st) => (
                        <li key={st.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          {st.completed ? (
                            <CheckSquare className="h-4 w-4 text-zinc-500 shrink-0" aria-hidden />
                          ) : (
                            <Square className="h-4 w-4 text-zinc-400 shrink-0" aria-hidden />
                          )}
                          <span className={cn("truncate flex-1 min-w-0", st.completed && "line-through opacity-70")}>
                            {st.title || "Untitled"}
                          </span>
                          {st.due_date && (st.due_date.start || st.due_date.end) && (
                            <span className="text-[10px] text-zinc-500 shrink-0">
                              {st.due_date.start && st.due_date.end
                                ? `${format(parseDateSafe(st.due_date.start) || new Date(), "MMM d")} – ${format(parseDateSafe(st.due_date.end) || new Date(), "MMM d")}`
                                : format(parseDateSafe(st.due_date.end ?? st.due_date.start) || new Date(), "MMM d")}
                            </span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </>
          )}
          <Divider />
          <div className="py-0.5 grid grid-cols-2 gap-x-4">
            <div className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">STATUS</div>
                <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{statusDisplay}</div>
              </div>
              <div className="shrink-0 pt-[10px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="focus:outline-none">
                      <EventModalToneChip tone={statusTone(local.status) as "neutral" | "accent" | "warn" | "success"}>{statusLabel}</EventModalToneChip>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[100000]" sideOffset={4}>
                    <DropdownMenuItem onClick={() => handleStatusChange("todo")}>To Do</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>In Progress</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("blocked")}>Blocked</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("done")}>Done</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("none")}>None</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">ASSIGNEE</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="mt-1 truncate text-left text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:opacity-80 focus:outline-none">
                      {assigneeLabel}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 max-h-56 overflow-y-auto z-[100000] py-1 text-xs" sideOffset={4}>
                    <DropdownMenuItem onClick={handleAssigneeClear} className="text-[11px] text-neutral-500 py-1.5 px-2">Unassigned</DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    {teams.length > 0 && (
                      <>
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-neutral-400 py-1 px-2">Teams</DropdownMenuLabel>
                        {filteredTeamsForSearch.map((team) => (
                          <DropdownMenuItem key={team.id} onClick={() => handleAssigneeTeamChange(team.id)} className="py-1 px-2 gap-1.5">
                            <span className="truncate text-[11px]">{team.name}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator className="my-1" />
                      </>
                    )}
                    <div className="flex items-center justify-between gap-1 py-1 px-2">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-neutral-400 p-0">Members</DropdownMenuLabel>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAssigneeSearchOpen((v) => !v); if (!assigneeSearchOpen) setTimeout(() => assigneeSearchInputRef.current?.focus(), 0); }}
                        className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
                        title="Search assignees"
                      >
                        <Search className="h-3 w-3" />
                      </button>
                    </div>
                    {assigneeSearchOpen && (
                      <div className="px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={assigneeSearchInputRef}
                          type="text"
                          value={assigneeSearchQuery}
                          onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    {workspaceMembers.length > 0 ? (
                      filteredMembersForSearch.length > 0 ? (
                        filteredMembersForSearch.map((member) => (
                          <DropdownMenuItem key={member.id} onClick={() => handleAssigneeChange(member.user_id ?? member.id)} className="py-1 px-2 gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-medium shrink-0">
                              {(member.name ?? member.email ?? "?")[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="truncate text-[11px]">{member.name ?? member.email ?? "Unknown"}</span>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <div className="py-1 px-2 text-[11px] text-neutral-400">No members match</div>
                      )
                    ) : (
                      <DropdownMenuItem disabled className="text-[11px] text-neutral-400 py-1 px-2">Loading members...</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">PROGRESS</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${p}%` }} />
                </div>
              </div>
              <div className="shrink-0 pt-[14px] flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={local.progress === 0 ? "" : local.progress}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLocal((s) => ({ ...s, progress: v === "" ? 0 : Math.min(100, Math.max(0, Number(v) || 0)) }));
                  }}
                  onBlur={handleProgressBlur}
                  placeholder="0"
                  className="w-10 rounded border border-zinc-200 bg-white px-1 py-0.5 text-right text-xs font-semibold outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 placeholder:text-zinc-400"
                />
                <span className="text-xs font-semibold">%</span>
              </div>
            </div>
          </div>
          <Divider />
          <div className="py-2">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>PRIORITY</SectionLabel>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="text-xs font-semibold text-blue-600 hover:opacity-80 dark:text-blue-400">
                    Edit
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100000]" sideOffset={4}>
                  <DropdownMenuItem onClick={() => handleAddPriority("low")}>Low</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddPriority("medium")}>Medium</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddPriority("high")}>High</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddPriority("urgent")}>Urgent</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {effectivePriorities.length > 0 ? (
                effectivePriorities.map((priorityField) => (
                  <EventModalToneChip key={`${event.id}-details-priority-${priorityField.field_name.toLowerCase()}`} tone={priorityTone(priorityField.value) as "neutral" | "accent" | "warn" | "success"}>
                    <span className="font-semibold">{PRIORITY_LABELS[priorityField.value]}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">•</span>
                    <span>{priorityField.field_name}</span>
                  </EventModalToneChip>
                ))
              ) : (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">None</span>
              )}
            </div>
          </div>
          <Divider />
          <div className="py-2">
            <SectionLabel>NOTES</SectionLabel>
            <input
              type="text"
              value={local.notes}
              onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))}
              onBlur={handleNotesBlur}
              placeholder="Add notes…"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-sm outline-none focus:border-blue-500/55 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-800 dark:bg-zinc-950 placeholder:text-zinc-400"
            />
          </div>

          {workspaceId && direct && (
            <div className="space-y-1 py-2">
              <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Properties</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <PropertyBadges properties={direct} />
              </div>
            </div>
          )}

          <div className="space-y-1 py-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Attachments</div>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={onAddReference}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {references.length > 0 && (
              <div className={cn("space-y-1", !isModal && "space-y-2")}>
                {references.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => onNavigateToReference?.(ref)}
                    className={cn(
                      "w-full rounded text-left text-xs transition-colors cursor-pointer",
                      isModal
                        ? "border-0 bg-transparent px-0 py-1.5 hover:bg-[var(--surface-hover)]"
                        : "border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-3 py-2"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {ref.title}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                          {ref.type_label || ref.reference_type}
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                    </div>
                  </button>
                    ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-8 flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[.98] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
            Cancel
          </button>
          <button type="button" onClick={onClose} className="inline-flex h-8 flex-1 items-center justify-center rounded-xl bg-[var(--primary)] text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:bg-[var(--primary-hover)] active:scale-[.98]">
            Save
          </button>
        </div>
      </div>
      <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pick a color</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-2">
            {colorChoices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => {
                  handleColorChange(choice.value);
                  setIsColorDialogOpen(false);
                }}
                className={cn(
                  "h-8 w-8 rounded-full border border-[var(--border)] ring-offset-2 ring-offset-[var(--surface)]",
                  choice.className,
                  (local.color ?? null) === choice.value && "ring-2 ring-[var(--foreground)]"
                )}
                title={choice.label}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      </>
    );
  }

  return (
    <div className="h-full w-full shrink-0 flex flex-col min-h-0 overflow-hidden border-t border-[var(--border)] bg-[var(--surface)] shadow-popover lg:w-96 lg:border-l lg:border-t-0 lg:rounded-2xl" role="complementary" aria-label={`Event details: ${event.title}`}>
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Timeline event</div>
          <div className="text-lg font-semibold text-[var(--foreground)] truncate">{event.title || "Event details"}</div>
          {event.source_entity_id && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
              <Link2 className="h-3 w-3 shrink-0" />
              <span>Linked from {event.source_entity_type === "task" ? "task" : event.source_entity_type ?? "source"}</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
        <div className="space-y-3">
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Schedule</div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input type="date" value={format(parseDateSafe(local.start) || new Date(local.start), "yyyy-MM-dd")} onChange={(e) => handleStartChange(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md" />
              <input type="date" value={format(parseDateSafe(local.end) || new Date(local.end), "yyyy-MM-dd")} onChange={(e) => handleEndChange(e.target.value)} disabled={local.isMilestone} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md" />
            </div>
          </div>
          {event.parent_event_id && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <button
                type="button"
                className="text-xs text-[var(--muted-foreground)] hover:underline"
                onClick={() => onSelectEvent(event.parent_event_id!)}
              >
                ← Parent event
              </button>
            </div>
          )}
          {!event.parent_event_id && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Sub-events</div>
                <button
                  type="button"
                  onClick={() => onAddSubEvent(event.id)}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  + Add
                </button>
              </div>
              {subEvents.length === 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">No sub-events yet</p>
              ) : (
                <div className="space-y-1">
                  {subEvents.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-[var(--surface-hover)]"
                      onClick={() => onSelectEvent(child.id)}
                    >
                      <span className="truncate flex-1">{child.title}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">{formatSubEventRange(child)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {event.source_entity_id && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Sync with source</span>
              <Switch checked={event.sourceSyncMode === "live"} onCheckedChange={(checked) => onUpdate({ sourceSyncMode: checked ? "live" : "snapshot" })} />
            </div>
          )}
          {taskId && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => setSubtasksCollapsed((c) => !c)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/30"
              >
                {subtasksCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                )}
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Subtasks</span>
                {subtasks.length > 0 && (
                  <span className="text-[10px] text-[var(--muted-foreground)]">({subtasks.length})</span>
                )}
              </button>
              {!subtasksCollapsed && (
                <ul className="border-t border-[var(--border)] px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {subtasks.length === 0 ? (
                    <li className="text-[11px] text-[var(--muted-foreground)]">No subtasks</li>
                  ) : (
                    subtasks.map((st) => (
                      <li key={st.id} className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                        {st.completed ? (
                          <CheckSquare className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" aria-hidden />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" aria-hidden />
                        )}
                        <span className={cn("truncate flex-1 min-w-0", st.completed && "line-through opacity-70")}>
                          {st.title || "Untitled"}
                        </span>
                        {st.due_date && (st.due_date.start || st.due_date.end) && (
                          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                            {st.due_date.start && st.due_date.end
                              ? `${format(parseDateSafe(st.due_date.start) || new Date(), "MMM d")} – ${format(parseDateSafe(st.due_date.end) || new Date(), "MMM d")}`
                              : format(parseDateSafe(st.due_date.end ?? st.due_date.start) || new Date(), "MMM d")}
                          </span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] shrink-0">Color</div>
            <button type="button" onClick={() => setIsColorDialogOpen(true)} className={cn("rounded-full ring-offset-1 ring-offset-[var(--surface)] mt-2 h-6 w-6 border border-[var(--border)]", currentColorClass)} title="Change color" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Status</div>
              <select value={local.status ?? "none"} onChange={(e) => handleStatusChange(e.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
                <option value="none">None</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Assignee</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-blue-500">{assigneeLabel}</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44 max-h-56 overflow-y-auto z-[100000] py-1 text-xs" sideOffset={4}>
                  <DropdownMenuItem onClick={handleAssigneeClear} className="text-[11px] text-neutral-500 py-1.5 px-2">Unassigned</DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  {teams.length > 0 && (
                    <>
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-neutral-400 py-1 px-2">Teams</DropdownMenuLabel>
                      {filteredTeamsForSearch.map((team) => (
                        <DropdownMenuItem key={team.id} onClick={() => handleAssigneeTeamChange(team.id)} className="py-1 px-2 gap-1.5">
                          <span className="truncate text-[11px]">{team.name}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="my-1" />
                    </>
                  )}
                  <div className="flex items-center justify-between gap-1 py-1 px-2">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-neutral-400 p-0">Members</DropdownMenuLabel>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAssigneeSearchOpen((v) => !v); if (!assigneeSearchOpen) setTimeout(() => assigneeSearchInputRef.current?.focus(), 0); }} className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600" title="Search assignees">
                      <Search className="h-3 w-3" />
                    </button>
                  </div>
                  {assigneeSearchOpen && (
                    <div className="px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                      <input ref={assigneeSearchInputRef} type="text" value={assigneeSearchQuery} onChange={(e) => setAssigneeSearchQuery(e.target.value)} placeholder="Search..." className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  )}
                  {workspaceMembers.length > 0 ? (
                    filteredMembersForSearch.length > 0 ? (
                      filteredMembersForSearch.map((member) => (
                        <DropdownMenuItem key={member.id} onClick={() => handleAssigneeChange(member.user_id ?? member.id)} className="py-1 px-2 gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-medium shrink-0">{(member.name ?? member.email ?? "?")[0]?.toUpperCase() || "?"}</div>
                          <span className="truncate text-[11px]">{member.name ?? member.email ?? "Unknown"}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="py-1 px-2 text-[11px] text-neutral-400">No members match</div>
                    )
                  ) : (
                    <DropdownMenuItem disabled className="text-[11px] text-neutral-400 py-1 px-2">Loading members...</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Progress</div>
              <input type="number" min="0" max="100" value={local.progress === 0 ? "" : local.progress} onChange={(e) => { const v = e.target.value; setLocal((s) => ({ ...s, progress: v === "" ? 0 : Math.min(100, Math.max(0, Number(v) || 0)) })); }} onBlur={handleProgressBlur} placeholder="0" className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md placeholder:text-[var(--muted-foreground)]" />
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Priority</div>
              {effectivePriorities.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {effectivePriorities.map((priorityField) => (
                    <span key={`${event.id}-details-priority-${priorityField.field_name.toLowerCase()}`} className={cn("inline-flex max-w-[180px] items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border", PRIORITY_PILL_COLORS[priorityField.value])} title={getTimelinePriorityDisplayLabel(priorityField)}>
                      <span className="truncate">{getTimelinePriorityDisplayLabel(priorityField)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="text-[10px] text-[var(--muted-foreground)]">None</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="text-[10px] text-blue-600 hover:underline focus:outline-none">Add priority</button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="z-[100000]" sideOffset={4}>
                      <DropdownMenuItem onClick={() => handleAddPriority("low")}>Low</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddPriority("medium")}>Medium</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddPriority("high")}>High</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddPriority("urgent")}>Urgent</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-neutral-700 dark:text-neutral-300 text-sm">Notes</div>
            <textarea ref={notesTextareaRef} value={local.notes} onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))} onBlur={handleNotesBlur} placeholder="Add notes..." rows={2} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {workspaceId && direct && (
            <div className="space-y-2">
              <div className="font-medium text-neutral-700 dark:text-neutral-300 text-sm">Properties</div>
              <div className="flex flex-wrap gap-1.5"><PropertyBadges properties={direct} /></div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-neutral-700 dark:text-neutral-300 text-sm">Attachments</div>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={onAddReference}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {references.length > 0 && (
              <div className="space-y-2">
                {references.map((ref) => (
                  <button key={ref.id} onClick={() => onNavigateToReference?.(ref)} className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 text-left text-xs transition-colors cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate">{ref.title}</div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">{ref.type_label || ref.reference_type}</div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pick a color</DialogTitle></DialogHeader>
          <div className="grid grid-cols-6 gap-2">
            {colorChoices.map((choice) => (
              <button key={choice.label} type="button" onClick={() => { handleColorChange(choice.value); setIsColorDialogOpen(false); }} className={cn("h-8 w-8 rounded-full border border-[var(--border)] ring-offset-2 ring-offset-[var(--surface)]", choice.className, (local.color ?? null) === choice.value && "ring-2 ring-[var(--foreground)]")} title={choice.label} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
  references,
  onAddReference,
  onDeleteReference,
  members,
  workspaceId,
}: {
  event: TimelineEvent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  references: Array<{ id: string; reference_type: string; reference_id: string; title: string; type_label?: string }>;
  onAddReference: () => void;
  onDeleteReference: (id: string) => void;
  members: WorkspaceMember[];
  workspaceId?: string;
}) {
  const statusOptions = STATUS_OPTIONS.map(o => ({ id: o.value, label: o.label, color: o.color }));
  const eventPriorities = useMemo(
    () => normalizeTimelinePrioritiesClient(event.priorities ?? []),
    [event.priorities]
  );
  const { data: direct } = useEntityProperties("timeline_event", event.id);
  const directPriorities = useMemo(
    () => normalizeTimelinePrioritiesClient(direct?.priorities ?? []),
    [direct?.priorities]
  );
  const effectivePriorities = directPriorities.length > 0 ? directPriorities : eventPriorities;

  const getInitialState = React.useCallback(
    () => ({
      title: event.title,
      start: event.start,
      end: event.end,
      color: event.color || DEFAULT_COLORS[0],
      statuses: event.statuses?.length ? event.statuses : [{ field_name: "Status", value: "todo" }],
      priorities: effectivePriorities,
      assigneeId: event.assigneeId ?? null,
      notes: event.notes ?? "",
      progress: event.progress ?? 0,
      isMilestone: event.isMilestone ?? false,
    }),
    [event, effectivePriorities]
  );

  const [local, setLocal] = useState<Omit<TimelineEvent, "id">>(getInitialState);
  const [showColors, setShowColors] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);

  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return undefined;
    const member = findWorkspaceMember(workspaceMembers, assigneeId);
    return member?.name ?? member?.email ?? undefined;
  };
  const getMemberNames = (props: { assignee_id?: string | null; assignee_ids?: string[] }) => {
    const ids: Array<string | null> = props.assignee_ids?.length
      ? props.assignee_ids
      : props.assignee_id
        ? [props.assignee_id]
        : [];
    return ids.map((id) => getMemberName(id)).filter((n): n is string => Boolean(n));
  };

  React.useEffect(() => {
    if (isOpen) setLocal(getInitialState());
  }, [isOpen, getInitialState]);

  React.useEffect(() => {
    setPropertiesOpen(false);
  }, [event.id]);

  const closePanel = React.useCallback(() => {
    setPropertiesOpen(false);
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePanel, isOpen]);

  const handleSave = () => {
    if (!local.title.trim()) return;
    onUpdate(local);
  };

  if (!isOpen) return null;

  return (
    <div
      className="flex h-full w-full shrink-0 flex-col border-t border-[var(--border)] bg-[var(--surface)] shadow-popover min-h-0 lg:w-96 lg:border-l lg:border-t-0"
      role="complementary"
      aria-label={`Event details: ${event.title}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Timeline event</div>
          <div className="text-lg font-semibold text-[var(--foreground)] truncate">
            {event.title || "Event details"}
          </div>
          {event.source_entity_id && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>Linked from {event.source_entity_type === "task" ? "task" : event.source_entity_type ?? "source"}</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={closePanel} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        <div className="space-y-4">
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
                value={local.statuses?.[0]?.value ?? "todo"}
                onChange={(e) => setLocal((s) => ({ ...s, statuses: [{ field_name: "Status", value: e.target.value }] }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.length > 0 ? (
                  statusOptions.map((opt: any) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Priority (optional)</label>
            {(local.priorities ?? effectivePriorities).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {(local.priorities ?? effectivePriorities).map((priorityField) => (
                  <span
                    key={`${event.id}-edit-priority-${priorityField.field_name.toLowerCase()}`}
                    className={cn(
                      "inline-flex max-w-[220px] items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                      PRIORITY_PILL_COLORS[priorityField.value]
                    )}
                    title={getTimelinePriorityDisplayLabel(priorityField)}
                  >
                    <span className="truncate">{getTimelinePriorityDisplayLabel(priorityField)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-neutral-500">None</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  Add priority
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setLocal((s) => ({
                  ...s,
                  priorities: [...(s.priorities ?? []), { field_name: "Priority", value: "low" }],
                }))}>
                  Low
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocal((s) => ({
                  ...s,
                  priorities: [...(s.priorities ?? []), { field_name: "Priority", value: "medium" }],
                }))}>
                  Medium
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocal((s) => ({
                  ...s,
                  priorities: [...(s.priorities ?? []), { field_name: "Priority", value: "high" }],
                }))}>
                  High
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocal((s) => ({
                  ...s,
                  priorities: [...(s.priorities ?? []), { field_name: "Priority", value: "urgent" }],
                }))}>
                  Urgent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Progress & Milestone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={local.progress === 0 ? "" : local.progress}
                onChange={(e) => {
                  const v = e.target.value;
                  setLocal((s) => ({ ...s, progress: v === "" ? 0 : Math.min(100, Math.max(0, parseInt(v) || 0)) }));
                }}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-neutral-400"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.isMilestone ?? false}
                  onChange={(e) => {
                    setLocal((s) => ({
                      ...s,
                      isMilestone: e.target.checked,
                      end: e.target.checked ? s.start : s.end,
                    }));
                  }}
                  className="w-4 h-4 rounded border-neutral-300"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Milestone</span>
              </label>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={format(parseDateSafe(local.start) || new Date(local.start), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, start: parseLocalDate(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={local.isMilestone}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">End Date</label>
              <input
                type="date"
                value={format(parseDateSafe(local.end) || new Date(local.end), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, end: parseLocalDate(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={local.isMilestone}
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
                    <span className={cn(local.assigneeId ? "text-neutral-900 dark:text-white" : "text-neutral-500")}>
                      {findWorkspaceMember(members, local.assigneeId)?.name || "Unassigned"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto z-50">
                <DropdownMenuItem
                  onClick={() => setLocal((s) => ({ ...s, assigneeId: null }))}
                  className="text-neutral-500"
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.length > 0 ? (
                  members.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setLocal((s) => ({ ...s, assigneeId: member.user_id ?? member.id }))}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                          {(member.name ?? member.email ?? "?")[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{member.name ?? member.email ?? "Unknown"}</div>
                          <div className="text-xs text-neutral-500 truncate">{member.email ?? ""}</div>
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

          {/* Properties */}
          {workspaceId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Properties</label>
                <Button variant="outline" size="sm" onClick={() => setPropertiesOpen(true)}>
                  Manage properties
                </Button>
              </div>
              {direct ? (
                <div className="flex flex-wrap gap-2">
                  <PropertyBadges
                    properties={direct}
                    onClick={() => setPropertiesOpen(true)}
                    memberNames={getMemberNames(direct)}
                  />
                </div>
              ) : (
                <p className="text-xs text-neutral-500">No properties yet.</p>
              )}
            </div>
          )}

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Attachments</label>
              <Button variant="outline" size="sm" onClick={onAddReference}>
                Add attachment
              </Button>
            </div>
            {references.length === 0 ? (
              <p className="text-xs text-neutral-500">No attachments yet.</p>
            ) : (
              <div className="space-y-2">
                {references.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">
                        {ref.title}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-neutral-400">
                        {ref.type_label || ref.reference_type}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteReference(ref.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
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
            <Button variant="outline" onClick={closePanel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!local.title.trim()}>
              Save
            </Button>
          </div>
        </div>
      </div>
      {workspaceId && (
        <PropertyMenu
          open={propertiesOpen}
          onOpenChange={setPropertiesOpen}
          entityType="timeline_event"
          entityId={event.id}
          workspaceId={workspaceId}
          entityTitle={event.title}
        />
      )}
    </div>
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
              value={local.statuses?.[0]?.value ?? "todo"}
              onChange={(e) => setLocal((s) => ({ ...s, statuses: [{ field_name: "Status", value: e.target.value }] }))}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
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
              value={format(parseDateSafe(local.start) || new Date(local.start), "yyyy-MM-dd")}
              onChange={(e) => setLocal((s) => ({ ...s, start: parseLocalDate(e.target.value).toISOString() }))}
            />
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-400">
            End
            <input
              type="date"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={format(parseDateSafe(local.end) || new Date(local.end), "yyyy-MM-dd")}
              onChange={(e) => setLocal((s) => ({ ...s, end: parseLocalDate(e.target.value).toISOString() }))}
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
