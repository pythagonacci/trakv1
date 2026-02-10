import type { EverythingItem, FilterConfig, DueDatePreset } from "@/types/everything";
import { isAfter, isBefore, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, isWithinInterval } from "date-fns";

/**
 * Apply filters to everything items
 */
export function applyFilters(
  items: EverythingItem[],
  filters: FilterConfig
): EverythingItem[] {
  return items.filter((item) => {
    // Filter by entity types
    if (filters.entityTypes && filters.entityTypes.length > 0) {
      if (!filters.entityTypes.includes(item.type)) return false;
    }

    // Filter by source types
    if (filters.sourceTypes && filters.sourceTypes.length > 0) {
      if (!filters.sourceTypes.includes(item.source.type)) return false;
    }

    // Filter by status
    if (filters.status && filters.status.length > 0) {
      if (!item.properties.status || !filters.status.includes(item.properties.status)) {
        return false;
      }
    }

    // Filter by priority
    if (filters.priority && filters.priority.length > 0) {
      if (!item.properties.priority || !filters.priority.includes(item.properties.priority)) {
        return false;
      }
    }

    // Filter by assignees
    if (filters.assigneeIds && filters.assigneeIds.length > 0) {
      const hasMatchingAssignee = item.properties.assignee_ids.some(
        (id) => filters.assigneeIds!.includes(id)
      );
      if (!hasMatchingAssignee) return false;
    }

    // Filter by due date preset
    if (filters.dueDatePreset) {
      if (!matchesDueDatePreset(item.properties.due_date, filters.dueDatePreset)) {
        return false;
      }
    }

    // Filter by due date range (overrides preset)
    if (filters.dueDateRange) {
      if (!matchesDueDateRange(item.properties.due_date, filters.dueDateRange)) {
        return false;
      }
    }

    // Filter by tags (item must have at least one of the specified tags)
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = item.properties.tags.some(
        (tag) => filters.tags!.includes(tag)
      );
      if (!hasMatchingTag) return false;
    }

    // Filter by projects
    if (filters.projectIds && filters.projectIds.length > 0) {
      if (!filters.projectIds.includes(item.source.projectId)) return false;
    }

    // Filter by search query (searches name and source name)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(query);
      const sourceMatch = item.source.name.toLowerCase().includes(query);
      if (!nameMatch && !sourceMatch) return false;
    }

    return true;
  });
}

/**
 * Check if a date is in next week
 */
function isNextWeek(date: Date): boolean {
  const now = new Date();
  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 0 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 0 });
  return isWithinInterval(date, { start: nextWeekStart, end: nextWeekEnd });
}

/**
 * Check if a date is in next month
 */
function isNextMonth(date: Date): boolean {
  const now = new Date();
  const nextMonthStart = startOfMonth(addMonths(now, 1));
  const nextMonthEnd = endOfMonth(addMonths(now, 1));
  return isWithinInterval(date, { start: nextMonthStart, end: nextMonthEnd });
}

/**
 * Check if a date matches a due date preset
 */
function matchesDueDatePreset(dueDate: string | null, preset: DueDatePreset): boolean {
  if (preset === "no_date") {
    return !dueDate;
  }

  if (!dueDate) return false;

  try {
    const date = parseISO(dueDate);
    const now = new Date();

    switch (preset) {
      case "overdue":
        return isBefore(date, now) && !isToday(date);
      case "today":
        return isToday(date);
      case "tomorrow":
        return isTomorrow(date);
      case "this_week":
        return isThisWeek(date, { weekStartsOn: 0 });
      case "next_week":
        return isNextWeek(date);
      case "this_month":
        return isThisMonth(date);
      case "next_month":
        return isNextMonth(date);
      default:
        return false;
    }
  } catch (error) {
    console.error("Invalid due date:", dueDate, error);
    return false;
  }
}

/**
 * Check if a date is within a date range
 */
function matchesDueDateRange(
  dueDate: string | null,
  range: { start: string | null; end: string | null }
): boolean {
  if (!dueDate) return false;

  try {
    const date = parseISO(dueDate);

    if (range.start && range.end) {
      const start = parseISO(range.start);
      const end = parseISO(range.end);
      return !isBefore(date, start) && !isAfter(date, end);
    }

    if (range.start) {
      const start = parseISO(range.start);
      return !isBefore(date, start);
    }

    if (range.end) {
      const end = parseISO(range.end);
      return !isAfter(date, end);
    }

    return true;
  } catch (error) {
    console.error("Invalid due date or range:", dueDate, range, error);
    return false;
  }
}
