// Canonical IDs for status (matches workspace property_definitions)
export type TimelineEventStatus = "todo" | "in_progress" | "blocked" | "done";

// Canonical IDs for priority (matches workspace property_definitions)
export type TimelineEventPriority = "low" | "medium" | "high" | "urgent";

export type DependencyType = "finish-to-start" | "start-to-start" | "finish-to-finish" | "start-to-finish";
export type ReferenceType = "doc" | "table_row" | "block";
export type TimelineItemType = "event";

export interface TimelineEvent {
  id: string;
  timeline_block_id: string;
  workspace_id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: TimelineEventStatus;
  priority: TimelineEventPriority | null;  // NEW: Priority field using canonical IDs
  assignee_id: string | null;
  progress: number;
  notes: string | null;
  color: string | null;
  is_milestone: boolean;
  baseline_start: string | null;
  baseline_end: string | null;
  display_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineReferenceFieldMappings {
  startDateFieldId?: string;
  endDateFieldId?: string;
  titleFieldId?: string;
  statusFieldId?: string;
  assigneeFieldId?: string;
}

export interface TimelineReference {
  id: string;
  workspace_id: string;
  event_id: string;
  reference_type: ReferenceType;
  reference_id: string;
  table_id: string | null;
  field_mappings?: TimelineReferenceFieldMappings | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineDependency {
  id: string;
  timeline_block_id: string;
  workspace_id: string;
  from_type?: string;
  from_id: string;
  to_type?: string;
  to_id: string;
  dependency_type: DependencyType;
  created_by: string | null;
  created_at: string;
}

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  start_date: string;
  end_date: string;
  status: TimelineEventStatus;
  priority?: TimelineEventPriority | null;  // NEW: Priority field
  assignee_id: string | null;
  progress: number;
  color: string | null;
  is_milestone: boolean;
  notes?: string | null;
  baseline_start?: string | null;
  baseline_end?: string | null;
  display_order: number;
  source_data?: Record<string, unknown> | null;
}

export interface TimelineViewConfig {
  startDate: string;
  endDate: string;
  zoomLevel: "day" | "week" | "month" | "quarter" | "year";
  groupBy: "none" | "status" | "assignee";
  filters: {
    status?: string[];
    assignee?: string[];
  };
}

export interface TimelineBlockContent {
  viewConfig: TimelineViewConfig;
}
