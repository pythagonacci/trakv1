import type { DependencyType, ReferenceType, TimelineEventStatus } from "@/types/timeline";

const VALID_DEPENDENCY_TYPES: DependencyType[] = [
  "finish-to-start",
  "start-to-start",
  "finish-to-finish",
  "start-to-finish",
];

const VALID_REFERENCE_TYPES: ReferenceType[] = ["doc", "table_row", "block"];
const VALID_EVENT_STATUSES: TimelineEventStatus[] = ["planned", "in-progress", "blocked", "done"];

export function validateTimelineDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, message: "Invalid date" };
  }
  if (start > end) {
    return { valid: false, message: "Start date must be before end date" };
  }
  return { valid: true };
}

export function validateDependencyType(type: string): type is DependencyType {
  return VALID_DEPENDENCY_TYPES.includes(type as DependencyType);
}

export function validateReferenceType(type: string): type is ReferenceType {
  return VALID_REFERENCE_TYPES.includes(type as ReferenceType);
}

export function validateEventStatus(status: string): status is TimelineEventStatus {
  return VALID_EVENT_STATUSES.includes(status as TimelineEventStatus);
}


export function detectCircularDependencies(
  edges: Array<{ fromId: string; toId: string }>,
  nextEdge?: { fromId: string; toId: string }
): boolean {
  const graph = new Map<string, Set<string>>();

  const addEdge = (fromId: string, toId: string) => {
    if (!graph.has(fromId)) graph.set(fromId, new Set());
    graph.get(fromId)?.add(toId);
  };

  edges.forEach((edge) => addEdge(edge.fromId, edge.toId));
  if (nextEdge) addEdge(nextEdge.fromId, nextEdge.toId);

  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (node: string): boolean => {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const next of neighbors) {
      if (visit(next)) return true;
    }

    stack.delete(node);
    return false;
  };

  for (const node of graph.keys()) {
    if (visit(node)) return true;
  }

  return false;
}
