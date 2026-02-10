import type { EverythingItem, BoardGroup, GroupByField } from "@/types/everything";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/properties";
import { parseISO, isToday, isTomorrow, isThisWeek, isBefore, isAfter } from "date-fns";

/**
 * Group items by a specific field for board view
 */
export function groupItems(
  items: EverythingItem[],
  groupBy: GroupByField,
  collapsedGroups: string[] = []
): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();

  // Initialize groups based on groupBy field
  switch (groupBy) {
    case "status":
      STATUS_OPTIONS.forEach((option) => {
        groups.set(option.value, {
          id: option.value,
          label: option.label,
          color: option.color,
          items: [],
          count: 0,
          collapsed: collapsedGroups.includes(option.value),
        });
      });
      break;

    case "priority":
      PRIORITY_OPTIONS.forEach((option) => {
        groups.set(option.value, {
          id: option.value,
          label: option.label,
          color: option.color,
          items: [],
          count: 0,
          collapsed: collapsedGroups.includes(option.value),
        });
      });
      break;

    case "due_date":
      // Create due date groups
      ["overdue", "today", "tomorrow", "this_week", "later", "no_date"].forEach((groupId) => {
        groups.set(groupId, {
          id: groupId,
          label: getDueDateGroupLabel(groupId),
          color: getDueDateGroupColor(groupId),
          items: [],
          count: 0,
          collapsed: collapsedGroups.includes(groupId),
        });
      });
      break;

    case "entity_type":
      // Create entity type groups
      ["timeline_event", "task", "table_row", "block"].forEach((groupId) => {
        groups.set(groupId, {
          id: groupId,
          label: getEntityTypeLabel(groupId),
          color: "gray",
          items: [],
          count: 0,
          collapsed: collapsedGroups.includes(groupId),
        });
      });
      break;

    case "source_type":
      // Create source type groups
      ["timeline", "task_list", "table", "block"].forEach((groupId) => {
        groups.set(groupId, {
          id: groupId,
          label: getSourceTypeLabel(groupId),
          color: "gray",
          items: [],
          count: 0,
          collapsed: collapsedGroups.includes(groupId),
        });
      });
      break;
  }

  // Add ungrouped bucket
  groups.set("__ungrouped__", {
    id: "__ungrouped__",
    label: "Ungrouped",
    color: "gray",
    items: [],
    count: 0,
    collapsed: collapsedGroups.includes("__ungrouped__"),
  });

  // Assign items to groups
  for (const item of items) {
    const groupIds = getItemGroupIds(item, groupBy);

    if (groupIds.length === 0) {
      // No group - add to ungrouped
      groups.get("__ungrouped__")!.items.push(item);
    } else {
      // Add to all matching groups (supports multi-group like assignees, tags)
      groupIds.forEach((groupId) => {
        const group = groups.get(groupId);
        if (group) {
          group.items.push(item);
        } else {
          // Dynamic group (e.g., assignee, tag, project)
          // Create group on the fly
          if (!groups.has(groupId)) {
            groups.set(groupId, {
              id: groupId,
              label: getDynamicGroupLabel(groupBy, groupId, item),
              color: "gray",
              items: [item],
              count: 0,
              collapsed: collapsedGroups.includes(groupId),
            });
          } else {
            groups.get(groupId)!.items.push(item);
          }
        }
      });
    }
  }

  // Update counts
  groups.forEach((group) => {
    group.count = group.items.length;
  });

  // Convert to array and sort
  let groupArray = Array.from(groups.values());

  // Filter out empty groups (except ungrouped)
  groupArray = groupArray.filter(
    (g) => g.count > 0 || g.id === "__ungrouped__"
  );

  // Sort groups
  groupArray.sort((a, b) => {
    // Ungrouped always last
    if (a.id === "__ungrouped__") return 1;
    if (b.id === "__ungrouped__") return -1;

    // For due date, custom order
    if (groupBy === "due_date") {
      const order = ["overdue", "today", "tomorrow", "this_week", "later", "no_date"];
      return order.indexOf(a.id) - order.indexOf(b.id);
    }

    // For priority, custom order (urgent first)
    if (groupBy === "priority") {
      const order = ["urgent", "high", "medium", "low"];
      return order.indexOf(a.id) - order.indexOf(b.id);
    }

    // Alphabetical for others
    return a.label.localeCompare(b.label);
  });

  return groupArray;
}

/**
 * Get the group IDs for an item based on the grouping field
 */
function getItemGroupIds(item: EverythingItem, groupBy: GroupByField): string[] {
  switch (groupBy) {
    case "status":
      return item.properties.status ? [item.properties.status] : [];

    case "priority":
      return item.properties.priority ? [item.properties.priority] : [];

    case "assignee":
      return item.properties.assignee_ids.length > 0
        ? item.properties.assignee_ids
        : [];

    case "due_date":
      const dueDateGroup = getDueDateGroup(item.properties.due_date);
      return [dueDateGroup];

    case "tags":
      return item.properties.tags.length > 0 ? item.properties.tags : [];

    case "project":
      return [item.source.projectId];

    case "source_type":
      return [item.source.type];

    case "entity_type":
      return [item.type];

    default:
      return [];
  }
}

/**
 * Get the due date group for a date
 */
function getDueDateGroup(dueDate: string | null): string {
  if (!dueDate) return "no_date";

  try {
    const date = parseISO(dueDate);
    const now = new Date();

    if (isBefore(date, now) && !isToday(date)) return "overdue";
    if (isToday(date)) return "today";
    if (isTomorrow(date)) return "tomorrow";
    if (isThisWeek(date, { weekStartsOn: 0 })) return "this_week";
    return "later";
  } catch (error) {
    console.error("Invalid due date:", dueDate, error);
    return "no_date";
  }
}

/**
 * Get label for due date group
 */
function getDueDateGroupLabel(groupId: string): string {
  const labels: Record<string, string> = {
    overdue: "Overdue",
    today: "Today",
    tomorrow: "Tomorrow",
    this_week: "This Week",
    later: "Later",
    no_date: "No Date",
  };
  return labels[groupId] || groupId;
}

/**
 * Get color for due date group
 */
function getDueDateGroupColor(groupId: string): string {
  const colors: Record<string, string> = {
    overdue: "red",
    today: "orange",
    tomorrow: "yellow",
    this_week: "blue",
    later: "gray",
    no_date: "gray",
  };
  return colors[groupId] || "gray";
}

/**
 * Get label for entity type
 */
function getEntityTypeLabel(entityType: string): string {
  const labels: Record<string, string> = {
    timeline_event: "Timeline Events",
    task: "Tasks",
    table_row: "Table Rows",
    block: "Blocks",
  };
  return labels[entityType] || entityType;
}

/**
 * Get label for source type
 */
function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    timeline: "Timelines",
    task_list: "Task Lists",
    table: "Tables",
    block: "Blocks",
  };
  return labels[sourceType] || sourceType;
}

/**
 * Get dynamic label for assignee, tag, or project groups
 */
function getDynamicGroupLabel(
  groupBy: GroupByField,
  groupId: string,
  item: EverythingItem
): string {
  switch (groupBy) {
    case "assignee":
      // Would need to fetch member name - for now use ID
      return groupId;

    case "tags":
      return groupId;

    case "project":
      return item.source.projectName;

    default:
      return groupId;
  }
}
