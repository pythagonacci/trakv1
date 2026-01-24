"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, addDays, differenceInCalendarDays, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfWeek, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { Plus, User, ChevronDown, ZoomIn, ZoomOut, Filter, Target, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import { PropertyBadges, PropertyMenu } from "@/components/properties";
import {
  useEntitiesProperties,
  useEntityPropertiesWithInheritance,
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
import type {
  TimelineBlockContent,
  TimelineEventStatus,
  TimelineItem,
  ReferenceType,
} from "@/types/timeline";
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
  status?: TimelineEventStatus;
  assignee?: string;
  assigneeId?: string | null;
  notes?: string;
  progress?: number; // 0-100
  isMilestone?: boolean;
  baselineStart?: string;
  baselineEnd?: string;
}

type TimelineEventPatch = Partial<TimelineEvent> & {
  status?: TimelineEventStatus | null;
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

function findWorkspaceMember(members: WorkspaceMember[], memberId?: string | null) {
  if (!memberId) return undefined;
  return members.find((m) => m.id === memberId) || members.find((m) => m.user_id === memberId);
}

function clampDate(d: Date) {
  return startOfDay(d);
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
                "event-bar flex h-8 w-full items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-sm",
                event.color || "bg-[var(--foreground)]"
              )}
            >
              {progress > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-white/30 rounded-[6px]"
                  style={{ width: `${progress}%` }}
                />
              )}
              <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
              <span className="flex-1 truncate relative z-10">{event.title}</span>
              {event.status && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/70 relative z-10" aria-label={`status-${event.status}`} />
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
              "event-bar flex h-8 w-full items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-sm transition-transform cursor-move",
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
                className="absolute left-0 top-0 h-full bg-white/30 rounded-[6px]"
                style={{ width: `${progress}%` }}
              />
            )}
            
            <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
            <span className="flex-1 truncate relative z-10">{event.title}</span>
            {event.status && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/70 relative z-10" aria-label={`status-${event.status}`} />}
            {progress > 0 && (
              <span className="ml-auto text-[10px] relative z-10">{progress}%</span>
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
  const [panelRoot, setPanelRoot] = useState<HTMLElement | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // New state for Phase 1 & 2 features
  const [filters, setFilters] = useState(viewConfig.filters || {});
  const [groupBy, setGroupBy] = useState<"none" | "status" | "assignee">(viewConfig.groupBy || "none");
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragResizeEdge, setDragResizeEdge] = useState<"start" | "end" | null>(null);

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
      const result = await getWorkspaceMembers(workspaceId);
      if (result.data) {
        setMembers(result.data);
      } else if (result.error) {
        console.error('❌ Error loading members:', result.error);
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
  React.useEffect(() => {
    setPanelRoot(document.getElementById("timeline-event-panel-root"));
  }, []);
  React.useEffect(() => {
    if (!panelRoot) {
      setPanelRoot(document.getElementById("timeline-event-panel-root"));
    }
  }, [panelRoot, selectedEventId]);

  const openPanel = (eventId: string) => {
    setSelectedEventId(eventId);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedEventId(null);
  };

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
      return {
      id: item.id,
      title: item.title,
      start: item.start_date,
      end: item.end_date,
      color: item.color || undefined,
      status: item.status,
      assignee: assigneeId ? memberMap.get(assigneeId) : undefined,
      assigneeId,
      progress: item.progress,
      notes: item.notes ?? undefined,
      isMilestone: item.is_milestone,
      baselineStart: item.baseline_start ?? undefined,
      baselineEnd: item.baseline_end ?? undefined,
      };
    });
  }, [timelineItems, timelinePropertiesById, memberMap]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    const statusFilters = filters?.status ?? [];
    const assigneeFilters = filters?.assignee ?? [];
    
    if (statusFilters.length > 0) {
      filtered = filtered.filter(e => e.status && statusFilters.includes(e.status));
    }
    
    if (assigneeFilters.length > 0) {
      filtered = filtered.filter(e => e.assignee && assigneeFilters.includes(e.assignee));
    }
    
    return filtered;
  }, [events, filters]);

  // Group events
  const groupedEvents = useMemo(() => {
    if (groupBy === "none") {
      return { "": filteredEvents };
    } else if (groupBy === "status") {
      const groups: Record<string, TimelineEvent[]> = {};
      filteredEvents.forEach(event => {
        const key = event.status || "planned";
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


  // Sort events by start date
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [filteredEvents]);

  function toCol(date: Date) {
    return Math.max(0, Math.min(totalColumns - 1, dateToColumn(date, displayRange.start, zoomLevel)));
  }

  function barStyle(startISO: string, endISO: string, rowIndex: number): React.CSSProperties {
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
    const rowHeight = 44; // Grid row height
    const topOffset = rowIndex * rowHeight + (rowHeight / 2) - 16; // Center vertically (event bar is 32px/2 = 16px offset)
    return {
      position: 'absolute',
      left: `${left}px`,
      width: `${width}px`,
      top: `${topOffset}px`,
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
      status: eventData.status,
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
    if (patch.status !== undefined) updates.status = patch.status;
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
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.progress !== undefined) updates.progress = patch.progress;
    if (patch.color !== undefined) updates.color = patch.color;
    if (patch.isMilestone !== undefined) updates.isMilestone = patch.isMilestone;
    if (patch.baselineStart !== undefined) updates.baselineStart = patch.baselineStart ?? null;
    if (patch.baselineEnd !== undefined) updates.baselineEnd = patch.baselineEnd ?? null;

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


  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const { data: selectedReferences = [] } = useTimelineReferences(selectedEventId ?? undefined);
  const { data: hoveredReferences = [] } = useTimelineReferences(hoveredEventId ?? undefined);
  const editPanel = !readOnly && isPanelOpen && selectedEvent ? (
    <EventDetailsPanel
      event={selectedEvent}
      isOpen={isPanelOpen}
      onClose={closePanel}
      onUpdate={(patch) => updateEvent(selectedEvent.id, patch)}
      references={selectedReferences}
      workspaceId={workspaceId}
      onAddReference={() => setIsReferenceDialogOpen(true)}
    />
  ) : null;
  const editPanelPortal = panelRoot && editPanel ? createPortal(editPanel, panelRoot) : editPanel;

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
                {(["planned", "in-progress", "blocked", "done"] as const).map((status) => {
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
              <Button size="sm" onClick={addEvent} className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add event
              </Button>
            )}
          </div>
        </div>

      <div ref={scrollRef} className="overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)] w-full">
        <div className="inline-block min-w-0 w-full" style={{ minWidth: `${totalColumns * columnWidth}px` }}>
          {/* Sticky date header */}
          <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]">
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${totalColumns}, ${columnWidth}px)` }}
            >
              {grid.map((c, idx) => (
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
                  {c.weekLabel ? (
                    <span className="text-[9px]">{c.weekLabel}</span>
                  ) : (
                    <span>{c.dayLabel}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline grid */}
          <div
            className="relative grid select-none"
            style={{
              position: 'relative',
              gridTemplateColumns: `repeat(${totalColumns}, ${columnWidth}px)`,
              gridTemplateRows: `repeat(${Math.max(1, Object.values(groupedEvents).reduce((sum, group) => sum + group.length, 0))}, minmax(44px, auto))`,
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

            {/* Base grid background */}
            {Object.entries(groupedEvents).flatMap(([groupKey, groupEvents], groupIndex) =>
              groupEvents.map((event, eventIndexInGroup) => {
                const eventRowIndex = Object.entries(groupedEvents)
                  .slice(0, groupIndex)
                  .reduce((sum, [, events]) => sum + events.length, 0) + eventIndexInGroup;
                
                return (
                  <React.Fragment key={`grid_row_${event.id}`}>
                    {grid.map((c, idx) => {
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
                })}
              </React.Fragment>
            );
          })
            )}

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
                    barStyle={barStyle(it.start, it.end, eventRowIndex)}
                    columnWidth={columnWidth}
                    readOnly={readOnly}
                  />
                );
              })
            )}

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

      {/* Add Event Dialog */}
      {!readOnly && (
        <AddEventDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onSave={saveNewEvent}
          defaultStart={displayRange.start}
          defaultEnd={addDays(displayRange.start, 3)}
          members={members}
        />
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
        {timelineContent}
        {editPanelPortal}
      </>
    );
  }

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {timelineContent}
    </DndContext>
      {editPanelPortal}
    </>
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
      progress: 0,
      isMilestone: false,
      assigneeId: null as string | null,
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

          {/* Progress & Milestone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Progress (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={local.progress ?? 0}
                onChange={(e) => setLocal((s) => ({ ...s, progress: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                value={format(new Date(local.start), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, start: new Date(e.target.value).toISOString() }))}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={local.isMilestone}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">End Date</label>
              <input
                type="date"
                value={format(new Date(local.end), "yyyy-MM-dd")}
                onChange={(e) => setLocal((s) => ({ ...s, end: new Date(e.target.value).toISOString() }))}
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

function EventDetailsPanel({
  event,
  isOpen,
  onClose,
  onUpdate,
  references,
  workspaceId,
  onAddReference,
}: {
  event: TimelineEvent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (patch: TimelineEventPatch) => void;
  references: Array<{ id: string; reference_type: string; reference_id: string; title: string; type_label?: string }>;
  workspaceId?: string;
  onAddReference: () => void;
}) {
  const { data: propertiesResult } = useEntityPropertiesWithInheritance("timeline_event", event.id);
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const direct = propertiesResult?.direct;
  const inherited = propertiesResult?.inherited?.filter((inh) => inh.visible) ?? [];

  const [local, setLocal] = useState({
    status: event.status ?? null,
    assigneeId: event.assigneeId ?? null,
    progress: event.progress ?? 0,
    notes: event.notes ?? "",
    start: event.start,
    end: event.end,
    isMilestone: event.isMilestone ?? false,
    color: event.color ?? null,
  });
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);

  React.useEffect(() => {
    setLocal({
      status: event.status ?? null,
      assigneeId: event.assigneeId ?? null,
      progress: event.progress ?? 0,
      notes: event.notes ?? "",
      start: event.start,
      end: event.end,
      isMilestone: event.isMilestone ?? false,
      color: event.color ?? null,
    });
    setIsColorDialogOpen(false);
  }, [event]);

  const selectedMember = local.assigneeId ? findWorkspaceMember(workspaceMembers, local.assigneeId) : undefined;
  const assigneeLabel = selectedMember?.name ?? selectedMember?.email ?? "Unassigned";

  const handleStartChange = (value: string) => {
    if (!value) return;
    const nextStart = clampDate(new Date(value));
    let nextEnd = clampDate(new Date(local.end));
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
    let nextEnd = clampDate(new Date(value));
    let nextStart = clampDate(new Date(local.start));
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
    const nextStatus = value === "none" ? null : (value as TimelineEventStatus);
    setLocal((s) => ({ ...s, status: nextStatus }));
    if ((event.status ?? null) !== nextStatus) {
      onUpdate({ status: nextStatus } as TimelineEventPatch);
    }
  };

  const handleAssigneeChange = (assigneeId: string | null) => {
    setLocal((s) => ({ ...s, assigneeId }));
    if ((event.assigneeId ?? null) !== assigneeId) {
      onUpdate({ assigneeId });
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

  return (
    <div
      className="flex h-full w-full shrink-0 flex-col border-t border-[var(--border)] bg-[var(--surface)] shadow-popover min-h-0 lg:w-96 lg:border-l lg:border-t-0 lg:rounded-2xl overflow-hidden"
      role="complementary"
      aria-label={`Event details: ${event.title}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Timeline event</div>
          <div className="text-lg font-semibold text-[var(--foreground)] truncate">
            {event.title || "Event details"}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Schedule</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={format(new Date(local.start), "yyyy-MM-dd")}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={format(new Date(local.end), "yyyy-MM-dd")}
                onChange={(e) => handleEndChange(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={local.isMilestone}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Color</div>
            <button
              type="button"
              onClick={() => setIsColorDialogOpen(true)}
              className={cn(
                "mt-2 h-6 w-6 rounded-full border border-[var(--border)] ring-offset-2 ring-offset-[var(--surface)]",
                currentColorClass
              )}
              title="Change color"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Status</div>
              <select
                value={local.status ?? "none"}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="planned">Planned</option>
                <option value="in-progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Assignee</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
                    {assigneeLabel}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto z-50">
                  <DropdownMenuItem
                    onClick={() => handleAssigneeChange(null)}
                    className="text-neutral-500"
                  >
                    Unassigned
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {workspaceMembers.length > 0 ? (
                    workspaceMembers.map((member) => (
                      <DropdownMenuItem
                        key={member.id}
                        onClick={() => handleAssigneeChange(member.user_id ?? member.id)}
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
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Progress</div>
              <input
                type="number"
                min="0"
                max="100"
                value={local.progress}
                onChange={(e) => setLocal((s) => ({ ...s, progress: Number(e.target.value) }))}
                onBlur={handleProgressBlur}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Notes</div>
            <textarea
              value={local.notes}
              onChange={(e) => setLocal((s) => ({ ...s, notes: e.target.value }))}
              onBlur={handleNotesBlur}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes..."
              rows={2}
            />
          </div>

          {workspaceId && (direct || inherited.length > 0) && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Properties</div>
              <div className="flex flex-wrap gap-2">
                {direct && <PropertyBadges properties={direct} />}
                {inherited.map((inh) => (
                  <PropertyBadges
                    key={`inherited-${inh.source_entity_id}`}
                    properties={inh.properties}
                    inherited
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Attachments</div>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={onAddReference}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {references.length > 0 && (
              <div className="space-y-2">
                {references.map((ref) => (
                  <div
                    key={ref.id}
                    className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 text-xs"
                  >
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {ref.title}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-neutral-400">
                      {ref.type_label || ref.reference_type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  const getInitialState = React.useCallback(
    () => ({
      title: event.title,
      start: event.start,
      end: event.end,
      color: event.color || DEFAULT_COLORS[0],
      status: (event.status || "planned") as TimelineEvent["status"],
      assigneeId: event.assigneeId ?? null,
      notes: event.notes || "",
      progress: event.progress ?? 0,
      isMilestone: event.isMilestone ?? false,
    }),
    [event]
  );

  const [local, setLocal] = useState<Omit<TimelineEvent, "id">>(getInitialState);
  const [showColors, setShowColors] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const { data: propertiesResult } = useEntityPropertiesWithInheritance("timeline_event", event.id);
  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const direct = propertiesResult?.direct;
  const inherited = propertiesResult?.inherited?.filter((inh) => inh.visible) ?? [];
  
  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return undefined;
    const member = findWorkspaceMember(workspaceMembers, assigneeId);
    return member?.name ?? member?.email ?? undefined;
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

              {/* Progress & Milestone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={local.progress ?? 0}
                    onChange={(e) => setLocal((s) => ({ ...s, progress: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={format(new Date(local.start), "yyyy-MM-dd")}
                    onChange={(e) => setLocal((s) => ({ ...s, start: new Date(e.target.value).toISOString() }))}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={local.isMilestone}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">End Date</label>
                  <input
                    type="date"
                    value={format(new Date(local.end), "yyyy-MM-dd")}
                    onChange={(e) => setLocal((s) => ({ ...s, end: new Date(e.target.value).toISOString() }))}
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
                  {(direct || inherited.length > 0) ? (
                    <div className="flex flex-wrap gap-2">
                      {direct && (
                        <PropertyBadges
                          properties={direct}
                          onClick={() => setPropertiesOpen(true)}
                          memberName={getMemberName(direct.assignee_id)}
                        />
                      )}
                      {inherited.map((inh) => (
                        <PropertyBadges
                          key={`inherited-${inh.source_entity_id}`}
                          properties={inh.properties}
                          inherited
                          onClick={() => setPropertiesOpen(true)}
                          memberName={getMemberName(inh.properties.assignee_id)}
                        />
                      ))}
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
