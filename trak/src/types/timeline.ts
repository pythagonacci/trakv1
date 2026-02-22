// Canonical status values
export type TimelineEventStatus = "todo" | "in_progress" | "blocked" | "done";

// Canonical priority values
export type TimelineEventPriority = "low" | "medium" | "high" | "urgent";
export interface TimelineNamedPriority {
  field_name: string;
  value: TimelineEventPriority;
}

export interface TimelineNamedStatus {
  field_name: string;
  value: TimelineEventStatus;
}

export type TimelineSourceEntityType = "task" | "timeline_event" | "table_row" | "block";
export type TimelineSourceSyncMode = "snapshot" | "live";

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
  statuses: TimelineNamedStatus[];
  priorities: TimelineNamedPriority[];
  assignee_id: string | null;
  assignee_team_id: string | null;
  source_entity_type: TimelineSourceEntityType | null;
  source_entity_id: string | null;
  source_sync_mode: TimelineSourceSyncMode | null;
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
  statuses?: TimelineNamedStatus[];
  priorities?: TimelineNamedPriority[];
  assignee_id: string | null;
  assignee_team_id: string | null;
  source_entity_type?: TimelineSourceEntityType | null;
  source_entity_id?: string | null;
  source_sync_mode?: TimelineSourceSyncMode | null;
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
