"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { format, addDays, differenceInCalendarDays, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfWeek, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { Plus, User, ChevronDown, ZoomIn, ZoomOut, Filter, GitBranch, Target, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { getWorkspaceMembers } from "@/app/actions/workspace";
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
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragStartEvent, DragOverlay, closestCenter } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type DependencyType = "finish-to-start" | "start-to-start" | "finish-to-finish" | "start-to-finish";
type ZoomLevel = "day" | "week" | "month" | "quarter" | "year";

interface TimelineDependency {
  fromEventId: string;
  toEventId: string;
  type: DependencyType;
}

interface TimelineEvent {
  id: string;
  title: string;
  start: string; // ISO date
  end: string; // ISO date
  color?: string;
  status?: "planned" | "in-progress" | "blocked" | "done";
  assignee?: string;
  notes?: string;
  progress?: number; // 0-100
  isMilestone?: boolean;
  baselineStart?: string;
  baselineEnd?: string;
}

interface TimelineContent {
  startDate: string;
  endDate: string;
  events: TimelineEvent[];
  dependencies?: TimelineDependency[];
  zoomLevel?: ZoomLevel;
  filters?: {
    status?: string[];
    assignee?: string[];
  };
  groupBy?: "none" | "status" | "assignee";
}

interface TimelineBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  workspaceId: string;
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
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
function DroppableColumn({ id, columnIndex, columnWidth }: { id: string; columnIndex: number; columnWidth: number }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      key={id}
      ref={setNodeRef}
      className="absolute"
      style={{
        gridColumn: columnIndex + 1,
        gridRow: `1 / -1`,
        width: `${columnWidth}px`,
        height: "100%",
      }}
    />
  );
}

// Draggable Event Component
function DraggableEvent({
  event,
  rowIndex,
  isCritical,
  isDragging,
  isDependencyMode,
  onDependencyClick,
  onMouseEnter,
  onMouseLeave,
  onClick,
  barStyle,
  columnWidth,
}: {
  event: TimelineEvent;
  rowIndex: number;
  isCritical: boolean;
  isDragging: boolean;
  isDependencyMode: boolean;
  onDependencyClick: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  barStyle: React.CSSProperties;
  columnWidth: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isDraggingStart } = useDraggable({
    id: `event-${event.id}`,
    disabled: isDependencyMode,
  });
  
  const { attributes: resizeStartAttrs, listeners: resizeStartListeners, setNodeRef: resizeStartRef } = useDraggable({
    id: `resize-start-${event.id}`,
    disabled: isDependencyMode || event.isMilestone,
  });
  
  const { attributes: resizeEndAttrs, listeners: resizeEndListeners, setNodeRef: resizeEndRef } = useDraggable({
    id: `resize-end-${event.id}`,
    disabled: isDependencyMode || event.isMilestone,
  });

  const style = transform
    ? {
        ...barStyle,
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : { ...barStyle, opacity: isDragging ? 0.5 : 1 };

  const progress = event.progress ?? 0;
  const hasBaseline = event.baselineStart && event.baselineEnd;

  return (
    <div
      ref={setNodeRef}
      className="relative z-10 pointer-events-auto"
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
            isCritical ? "border-b-red-500" : event.color || "border-b-[var(--foreground)]",
            isDependencyMode && "ring-2 ring-blue-500"
          )}
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
          }}
        />
      ) : (
        <>
          {/* Event bar */}
          <div
            className={cn(
              "event-bar my-2 flex h-8 w-full items-center gap-2 rounded-[6px] px-3 text-[11px] text-white shadow-sm transition-transform cursor-move",
              isCritical && "ring-2 ring-red-500 ring-offset-1",
              isDependencyMode && "ring-2 ring-blue-500",
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

export default function TimelineBlock({ block, onUpdate, workspaceId }: TimelineBlockProps) {
  const content = (block.content || {}) as TimelineContent;

  const range = useMemo(() => {
    const startDate = content.startDate ? new Date(content.startDate) : addDays(new Date(), -7);
    const endDate = content.endDate ? new Date(content.endDate) : addDays(new Date(), 30);
    return {
      start: clampDate(startDate),
      end: clampDate(endDate),
    };
  }, [content.startDate, content.endDate]);

  const events = useMemo(() => content.events || [], [content.events]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // New state for Phase 1 & 2 features
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(content.zoomLevel || "day");
  const [dependencies, setDependencies] = useState<TimelineDependency[]>(content.dependencies || []);
  const [filters, setFilters] = useState(content.filters || {});
  const [groupBy, setGroupBy] = useState<"none" | "status" | "assignee">(content.groupBy || "none");
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragResizeEdge, setDragResizeEdge] = useState<"start" | "end" | null>(null);
  const [isDependencyMode, setIsDependencyMode] = useState(false);
  const [dependencyFrom, setDependencyFrom] = useState<string | null>(null);

  // Load workspace members
  useEffect(() => {
    if (!workspaceId) {
      console.warn('⚠️ No workspaceId provided to TimelineBlock');
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
  }, [workspaceId]);

  // Mount flag for portal (avoids SSR/TS issues)
  React.useEffect(() => setMounted(true), []);

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

  const grid = useMemo(() => buildGrid(range.start, range.end, zoomLevel), [range, zoomLevel]);
  const columnWidth = useMemo(() => getColumnWidth(zoomLevel), [zoomLevel]);
  const totalColumns = useMemo(() => grid.length, [grid]);

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

  // Calculate critical path
  const criticalPathEvents = useMemo(() => {
    if (dependencies.length === 0) return new Set<string>();
    
    // Build dependency graph
    const graph: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    
    filteredEvents.forEach(e => {
      graph[e.id] = [];
      inDegree[e.id] = 0;
    });
    
    dependencies.forEach(dep => {
      if (graph[dep.fromEventId] && graph[dep.toEventId] !== undefined) {
        graph[dep.fromEventId].push(dep.toEventId);
        inDegree[dep.toEventId] = (inDegree[dep.toEventId] || 0) + 1;
      }
    });
    
    // Calculate earliest start times (topological sort)
    const earliestStart: Record<string, number> = {};
    const queue: string[] = [];
    
    filteredEvents.forEach(e => {
      if (inDegree[e.id] === 0) {
        queue.push(e.id);
        earliestStart[e.id] = new Date(e.start).getTime();
      }
    });
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentEvent = filteredEvents.find(e => e.id === current);
      if (!currentEvent) continue;
      
      const currentEnd = new Date(currentEvent.end).getTime();
      
      graph[current].forEach(nextId => {
        inDegree[nextId]--;
        if (!earliestStart[nextId] || earliestStart[nextId] < currentEnd) {
          earliestStart[nextId] = currentEnd;
        }
        if (inDegree[nextId] === 0) {
          queue.push(nextId);
        }
      });
    }
    
    // Find longest path
    const latestFinish: Record<string, number> = {};
    const reverseGraph: Record<string, string[]> = {};
    
    filteredEvents.forEach(e => {
      reverseGraph[e.id] = [];
    });
    
    dependencies.forEach(dep => {
      if (reverseGraph[dep.toEventId]) {
        reverseGraph[dep.toEventId].push(dep.fromEventId);
      }
    });
    
    // Calculate latest finish times (reverse topological sort)
    const endNodes = filteredEvents.filter(e => !graph[e.id] || graph[e.id].length === 0);
    const maxEndTime = Math.max(...endNodes.map(e => new Date(e.end).getTime()));
    
    endNodes.forEach(e => {
      latestFinish[e.id] = maxEndTime;
    });
    
    const reverseQueue = [...endNodes.map(e => e.id)];
    while (reverseQueue.length > 0) {
      const current = reverseQueue.shift()!;
      const currentEvent = filteredEvents.find(e => e.id === current);
      if (!currentEvent) continue;
      
      const currentStart = new Date(currentEvent.start).getTime();
      
      reverseGraph[current]?.forEach(prevId => {
        if (!latestFinish[prevId] || latestFinish[prevId] > currentStart) {
          latestFinish[prevId] = currentStart;
        }
        reverseQueue.push(prevId);
      });
    }
    
    // Events on critical path have earliestStart === latestStart and earliestFinish === latestFinish
    const critical = new Set<string>();
    filteredEvents.forEach(e => {
      const start = new Date(e.start).getTime();
      const end = new Date(e.end).getTime();
      if (earliestStart[e.id] === start && latestFinish[e.id] === end) {
        critical.add(e.id);
      }
    });
    
    return critical;
  }, [filteredEvents, dependencies]);

  // Auto-schedule based on dependencies
  const autoSchedule = useCallback(() => {
    if (dependencies.length === 0) return;
    
    const updatedEvents = [...filteredEvents];
    const eventMap = new Map(updatedEvents.map(e => [e.id, e]));
    
    // Build dependency graph
    const graph: Record<string, { to: string; type: DependencyType }[]> = {};
    const inDegree: Record<string, number> = {};
    
    updatedEvents.forEach(e => {
      graph[e.id] = [];
      inDegree[e.id] = 0;
    });
    
    dependencies.forEach(dep => {
      if (graph[dep.fromEventId] && eventMap.has(dep.toEventId)) {
        graph[dep.fromEventId].push({ to: dep.toEventId, type: dep.type });
        inDegree[dep.toEventId] = (inDegree[dep.toEventId] || 0) + 1;
      }
    });
    
    // Topological sort and schedule
    const queue: string[] = [];
    updatedEvents.forEach(e => {
      if (inDegree[e.id] === 0) {
        queue.push(e.id);
      }
    });
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentEvent = eventMap.get(current);
      if (!currentEvent) continue;
      
      const currentStart = new Date(currentEvent.start);
      const currentEnd = new Date(currentEvent.end);
      const duration = differenceInCalendarDays(currentEnd, currentStart);
      
      graph[current].forEach(({ to, type }) => {
        const nextEvent = eventMap.get(to);
        if (!nextEvent) return;
        
        inDegree[to]--;
        
        let newStart: Date;
        if (type === "finish-to-start") {
          newStart = addDays(currentEnd, 1);
        } else if (type === "start-to-start") {
          newStart = currentStart;
        } else if (type === "finish-to-finish") {
          newStart = addDays(currentEnd, -duration);
        } else { // start-to-finish
          newStart = addDays(currentStart, -duration);
        }
        
        const newEnd = addDays(newStart, duration);
        
        if (new Date(nextEvent.start).getTime() !== newStart.getTime() || 
            new Date(nextEvent.end).getTime() !== newEnd.getTime()) {
          nextEvent.start = clampDate(newStart).toISOString();
          nextEvent.end = clampDate(newEnd).toISOString();
        }
        
        if (inDegree[to] === 0) {
          queue.push(to);
        }
      });
    }
    
    return updatedEvents;
  }, [filteredEvents, dependencies]);

  // Sort events by start date
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [filteredEvents]);

  function toCol(date: Date) {
    return Math.max(0, Math.min(totalColumns - 1, dateToColumn(date, range.start, zoomLevel)));
  }

  function barStyle(startISO: string, endISO: string, rowIndex: number) {
    const s = clampDate(new Date(startISO));
    const e = clampDate(new Date(endISO));
    const startCol = toCol(s);
    const endCol = toCol(e);
    const span = Math.max(1, endCol - startCol + 1);
    return {
      gridColumn: `${startCol + 1} / span ${span}`,
      gridRow: rowIndex + 1,
    };
  }

  const addEvent = () => {
    setIsAddDialogOpen(true);
  };

  const saveNewEvent = async (eventData: Omit<TimelineEvent, "id">) => {
    if (!block?.id) {
      console.error("Cannot save new event: block.id is missing");
      return;
    }
    
    const newEvent: TimelineEvent = {
      id: crypto.randomUUID(),
      ...eventData,
    };
    const newEvents = [newEvent, ...events];
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    setIsAddDialogOpen(false);
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to save new event:", result.error);
    } else {
      onUpdate?.();
    }
  };

  const removeEvent = async (id: string) => {
    if (!block?.id) {
      console.error("Cannot remove event: block.id is missing");
      return;
    }
    
    const newEvents = events.filter((e) => e.id !== id);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    if (selectedEventId === id) {
      setSelectedEventId(null);
      setIsEditDialogOpen(false);
    }
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to remove event:", result.error);
    } else {
      onUpdate?.();
    }
  };

  const duplicateEvent = async (id: string) => {
    if (!block?.id) {
      console.error("Cannot duplicate event: block.id is missing");
      return;
    }
    
    const src = events.find((e) => e.id === id);
    if (!src) return;
    const copy: TimelineEvent = {
      ...src,
      id: crypto.randomUUID(),
      title: `${src.title} (Copy)`,
      start: addDays(new Date(src.start), 1).toISOString(),
      end: addDays(new Date(src.end), 1).toISOString(),
    };
    const newEvents = [copy, ...events];
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    setSelectedEventId(copy.id);
    setIsEditDialogOpen(true);
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to duplicate event:", result.error);
    } else {
      onUpdate?.();
    }
  };

  const updateEvent = async (id: string, patch: Partial<TimelineEvent>) => {
    if (!block?.id) {
      console.error("Cannot update event: block.id is missing");
      return;
    }
    
    const newEvents = events.map((e) => (e.id === id ? { ...e, ...patch } : e));
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: newEvents,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update event:", result.error);
      // Don't call onUpdate on error to avoid stale state
    } else {
      onUpdate?.();
    }
  };

  // Update zoom level
  const handleZoomChange = async (newZoom: ZoomLevel) => {
    if (!block?.id) {
      console.error("Cannot update zoom level: block.id is missing");
      setZoomLevel(newZoom); // Still update local state
      return;
    }
    
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        zoomLevel: newZoom,
      },
    });
    if (result.data) {
      setZoomLevel(newZoom);
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update zoom level:", result.error);
      setZoomLevel(newZoom); // Still update local state
    } else {
      setZoomLevel(newZoom);
    }
  };

  // Add dependency
  const addDependency = async (fromId: string, toId: string, type: DependencyType = "finish-to-start") => {
    if (!block?.id) {
      console.error("Cannot add dependency: block.id is missing");
      return;
    }
    
    const newDeps = [...dependencies, { fromEventId: fromId, toEventId: toId, type }];
    setDependencies(newDeps);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        dependencies: newDeps,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to add dependency:", result.error);
      // Revert local state on error
      setDependencies(dependencies);
    }
  };

  // Remove dependency
  const removeDependency = async (fromId: string, toId: string) => {
    if (!block?.id) {
      console.error("Cannot remove dependency: block.id is missing");
      return;
    }
    
    const newDeps = dependencies.filter(d => !(d.fromEventId === fromId && d.toEventId === toId));
    setDependencies(newDeps);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        dependencies: newDeps,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to remove dependency:", result.error);
      // Revert local state on error
      setDependencies(dependencies);
    }
  };

  // Update filters
  const handleFilterChange = async (newFilters: typeof filters) => {
    if (!block?.id) {
      console.error("Cannot update filters: block.id is missing");
      return;
    }
    
    setFilters(newFilters);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        filters: newFilters,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update filters:", result.error);
      // Revert local state on error
      setFilters(filters);
    }
  };

  // Update group by
  const handleGroupByChange = async (newGroupBy: typeof groupBy) => {
    if (!block?.id) {
      console.error("Cannot update group by: block.id is missing");
      return;
    }
    
    setGroupBy(newGroupBy);
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        groupBy: newGroupBy,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update group by:", result.error);
      // Revert local state on error
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

    const newDate = columnToDate(columnIndex, range.start, zoomLevel);
    
    let updatedEvent: TimelineEvent;
    if (edge === "start") {
      const currentEnd = new Date(activeEvent.end);
      const duration = differenceInCalendarDays(currentEnd, new Date(activeEvent.start));
      updatedEvent = {
        ...activeEvent,
        start: clampDate(newDate).toISOString(),
        end: clampDate(addDays(newDate, duration)).toISOString(),
      };
    } else if (edge === "end") {
      updatedEvent = {
        ...activeEvent,
        end: clampDate(newDate).toISOString(),
      };
    } else {
      // Moving entire event
      const currentStart = new Date(activeEvent.start);
      const currentEnd = new Date(activeEvent.end);
      const duration = differenceInCalendarDays(currentEnd, currentStart);
      updatedEvent = {
        ...activeEvent,
        start: clampDate(newDate).toISOString(),
        end: clampDate(addDays(newDate, duration)).toISOString(),
      };
    }

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
    if (!block?.id) {
      console.error("Cannot save baseline: block.id is missing");
      return;
    }
    
    const eventsWithBaseline = events.map(e => ({
      ...e,
      baselineStart: e.baselineStart || e.start,
      baselineEnd: e.baselineEnd || e.end,
    }));
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: eventsWithBaseline,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to save baseline:", result.error);
    }
  };

  // Auto-schedule handler
  const handleAutoSchedule = async () => {
    if (!block?.id) {
      console.error("Cannot auto-schedule: block.id is missing");
      return;
    }
    
    const scheduledEvents = autoSchedule();
    if (!scheduledEvents) return;
    
    const result = await updateBlock({
      blockId: block.id,
      content: {
        ...content,
        events: scheduledEvents,
      },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to auto-schedule:", result.error);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

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
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-[4px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEventId(event.id);
                    setIsEditDialogOpen(true);
                    setHoveredEventId(null);
                    setTooltipPosition(null);
                  }}
                >
                  Edit
                </button>
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
            </div>
          );
        })()
      : null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3 w-full">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Timeline</h2>
            <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              {format(range.start, "MMM d")} – {format(range.end, "MMM d, yyyy")}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Zoom controls */}
            <div className="flex items-center gap-0.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
              {(["day", "week", "month", "quarter", "year"] as ZoomLevel[]).map((level) => (
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
                          ? newStatusFilters.filter(s => s !== status)
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
            
            {/* Dependency mode toggle */}
            <button
              onClick={() => setIsDependencyMode(!isDependencyMode)}
              className={cn(
                "p-1.5 rounded-[4px] border transition-colors",
                isDependencyMode
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              )}
              title="Link events"
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
            
            {/* Auto-schedule */}
            {dependencies.length > 0 && (
              <button
                onClick={handleAutoSchedule}
                className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                title="Auto-schedule based on dependencies"
              >
                <Calendar className="h-3.5 w-3.5" />
              </button>
            )}
            
            {/* Save baseline */}
            <button
              onClick={saveBaseline}
              className="p-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Save baseline"
            >
              <Target className="h-3.5 w-3.5" />
            </button>
            
            <Button size="sm" onClick={addEvent} className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add event
            </Button>
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
              gridTemplateColumns: `repeat(${totalColumns}, ${columnWidth}px)`,
              gridTemplateRows: `repeat(${Math.max(1, Object.values(groupedEvents).reduce((sum, group) => sum + group.length, 0))}, minmax(44px, auto))`,
            }}
          >
            {/* Droppable columns for drag-and-drop */}
            {grid.map((c, idx) => (
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
                      const cellDate = c.date;
                      const eventStart = clampDate(new Date(event.start));
                      const eventEnd = clampDate(new Date(event.end));
                      const isCovered = cellDate >= eventStart && cellDate <= eventEnd;

                      if (!isCovered) {
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
                      }
                      return null;
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

            {/* Dependency arrows */}
            {dependencies.map((dep) => {
              const fromEvent = filteredEvents.find(e => e.id === dep.fromEventId);
              const toEvent = filteredEvents.find(e => e.id === dep.toEventId);
              if (!fromEvent || !toEvent) return null;
              
              // Find row indices in grouped events
              let fromRow = -1;
              let toRow = -1;
              let currentRow = 0;
              
              for (const [groupKey, groupEvents] of Object.entries(groupedEvents)) {
                const fromIndex = groupEvents.findIndex(e => e.id === fromEvent.id);
                const toIndex = groupEvents.findIndex(e => e.id === toEvent.id);
                
                if (fromIndex !== -1 && fromRow === -1) {
                  fromRow = currentRow + fromIndex;
                }
                if (toIndex !== -1 && toRow === -1) {
                  toRow = currentRow + toIndex;
                }
                
                currentRow += groupEvents.length;
              }
              
              if (fromRow === -1 || toRow === -1) return null;
              
              const fromStart = toCol(new Date(fromEvent.start));
              const fromEnd = toCol(new Date(fromEvent.end));
              const toStart = toCol(new Date(toEvent.start));
              const toEnd = toCol(new Date(toEvent.end));
              
              // Calculate arrow positions based on dependency type
              let fromX = 0;
              let toX = 0;
              if (dep.type === "finish-to-start") {
                fromX = fromEnd;
                toX = toStart;
              } else if (dep.type === "start-to-start") {
                fromX = fromStart;
                toX = toStart;
              } else if (dep.type === "finish-to-finish") {
                fromX = fromEnd;
                toX = toEnd;
              } else {
                fromX = fromStart;
                toX = toEnd;
              }
              
              const fromXPos = fromX * columnWidth + columnWidth;
              const toXPos = toX * columnWidth;
              const fromYPos = (fromRow + 1) * 44 - 22;
              const toYPos = (toRow + 1) * 44 - 22;
              
              const isCritical = criticalPathEvents.has(fromEvent.id) && criticalPathEvents.has(toEvent.id);
              
              return (
                <svg
                  key={`dep_${dep.fromEventId}_${dep.toEventId}`}
                  className="absolute pointer-events-none z-20"
                  style={{ width: "100%", height: "100%", top: 0, left: 0 }}
                >
                  <path
                    d={`M ${fromXPos} ${fromYPos} L ${toXPos} ${toYPos}`}
                    stroke={isCritical ? "#ef4444" : "#94a3b8"}
                    strokeWidth={isCritical ? 2 : 1}
                    strokeDasharray={isCritical ? "0" : "4,4"}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                </svg>
              );
            })}
            
            {/* Arrow marker definition */}
            <svg className="absolute" style={{ width: 0, height: 0 }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>

            {/* Events overlay */}
            {Object.entries(groupedEvents).flatMap(([groupKey, groupEvents], groupIndex) =>
              groupEvents.map((it, eventIndexInGroup) => {
                const eventRowIndex = Object.entries(groupedEvents)
                  .slice(0, groupIndex)
                  .reduce((sum, [, events]) => sum + events.length, 0) + eventIndexInGroup;
                
                const isCritical = criticalPathEvents.has(it.id);
                const isDragging = draggingEventId === it.id;
                
                return (
                  <DraggableEvent
                    key={it.id}
                    event={it}
                    rowIndex={eventRowIndex}
                    isCritical={isCritical}
                    isDragging={isDragging}
                    isDependencyMode={isDependencyMode}
                    onDependencyClick={() => {
                      if (dependencyFrom === null) {
                        setDependencyFrom(it.id);
                      } else if (dependencyFrom !== it.id) {
                        addDependency(dependencyFrom, it.id);
                        setDependencyFrom(null);
                        setIsDependencyMode(false);
                      }
                    }}
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
        e.stopPropagation();
        if (isDependencyMode) {
          if (dependencyFrom === null) {
            setDependencyFrom(it.id);
          } else if (dependencyFrom !== it.id) {
            addDependency(dependencyFrom, it.id);
            setDependencyFrom(null);
            setIsDependencyMode(false);
          } else {
            setDependencyFrom(null);
          }
        } else {
          setSelectedEventId(it.id);
          setIsEditDialogOpen(true);
        }
      }}
                    barStyle={barStyle(it.start, it.end, eventRowIndex)}
                    columnWidth={columnWidth}
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

      {/* Hover Tooltip */}
      {mounted && tooltipEl && createPortal(tooltipEl, document.body)}

      {/* Add Event Dialog */}
      <AddEventDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={saveNewEvent}
        defaultStart={range.start}
        defaultEnd={addDays(range.start, 3)}
        members={members}
      />

      {/* Edit Event Dialog */}
      {isEditDialogOpen && selectedEvent && (
        <EditEventDialog
          event={selectedEvent}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          onUpdate={(patch) => {
            updateEvent(selectedEvent.id, patch);
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          onDelete={() => {
            removeEvent(selectedEvent.id);
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          onDuplicate={() => {
            duplicateEvent(selectedEvent.id);
            setIsEditDialogOpen(false);
            setSelectedEventId(null);
          }}
          members={members}
        />
      )}
      </div>
    </DndContext>
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
                    <span className={cn(local.assignee ? "text-neutral-900 dark:text-white" : "text-neutral-500")}>
                      {local.assignee || "Unassigned"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto z-50">
                <DropdownMenuItem
                  onClick={() => setLocal((s) => ({ ...s, assignee: undefined }))}
                  className="text-neutral-500"
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.length > 0 ? (
                  members.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setLocal((s) => ({ ...s, assignee: member.name }))}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                          {member.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{member.name}</div>
                          <div className="text-xs text-neutral-500 truncate">{member.email}</div>
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

// Edit Event Dialog Component
function EditEventDialog({
  event,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  members,
}: {
  event: TimelineEvent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  members: WorkspaceMember[];
}) {
  const getInitialState = React.useCallback(
    () => ({
      title: event.title,
      start: event.start,
      end: event.end,
      color: event.color || DEFAULT_COLORS[0],
      status: (event.status || "planned") as TimelineEvent["status"],
      assignee: event.assignee || "",
      notes: event.notes || "",
      progress: event.progress ?? 0,
      isMilestone: event.isMilestone ?? false,
    }),
    [event]
  );

  const [local, setLocal] = useState<Omit<TimelineEvent, "id">>(getInitialState);
  const [showColors, setShowColors] = useState(false);

  React.useEffect(() => {
    if (isOpen) setLocal(getInitialState());
  }, [isOpen, getInitialState]);

  const handleSave = () => {
    if (!local.title.trim()) return;
    onUpdate(local);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
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
                    <span className={cn(local.assignee ? "text-neutral-900 dark:text-white" : "text-neutral-500")}>
                      {local.assignee || "Unassigned"}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto z-50">
                <DropdownMenuItem
                  onClick={() => setLocal((s) => ({ ...s, assignee: undefined }))}
                  className="text-neutral-500"
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.length > 0 ? (
                  members.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => setLocal((s) => ({ ...s, assignee: member.name }))}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                          {member.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{member.name}</div>
                          <div className="text-xs text-neutral-500 truncate">{member.email}</div>
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

        <DialogFooter className="flex items-center justify-between">
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
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!local.title.trim()}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
