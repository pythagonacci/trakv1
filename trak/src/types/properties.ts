// Saria Universal Properties - Simplified Implementation
// Fixed properties (not database-driven property definitions)

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 'block' | 'task' | 'subtask' | 'timeline_event' | 'table_row' | 'card';

// ============================================================================
// Property Values
// ============================================================================

export type Status = 'todo' | 'in_progress' | 'done' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type FieldType = 'priority' | 'status' | 'assignee' | 'due_date' | 'tags';
export interface DueDateRange {
  start: string | null;
  end: string | null;
}

export const STATUS_OPTIONS: { value: Status; label: string; color: string }[] = [
  { value: 'todo', label: 'To-Do', color: 'gray' },
  { value: 'in_progress', label: 'In Progress', color: 'blue' },
  { value: 'done', label: 'Done', color: 'green' },
  { value: 'blocked', label: 'Blocked', color: 'red' },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
];

export const STATUS_COLORS: Record<Status, string> = {
  todo: 'bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
  in_progress: 'bg-[var(--primary)]/10 text-[var(--primary)]',
  done: 'bg-[var(--success)]/10 text-[var(--success)]',
  blocked: 'bg-[var(--error)]/10 text-[var(--error)]',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-[var(--surface-muted)] text-[var(--tertiary-foreground)]',
  medium: 'bg-[var(--warning)]/10 text-[var(--warning)]',
  high: 'bg-[var(--tile-orange)]/10 text-[var(--tile-orange)]',
  urgent: 'bg-[var(--error)]/10 text-[var(--error)]',
};

// ============================================================================
// Entity Properties
// ============================================================================

export interface NamedField<TValue = unknown> {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  workspace_id: string;
  field_name: string;
  field_type: FieldType;
  value: TValue;
  created_at: string;
  updated_at: string;
}

export interface EntityProperties {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  workspace_id: string;
  status: Status | null;
  priority: Priority | null;
  /** First assignee (for backward compat). Use assignee_ids for full list. */
  assignee_id: string | null;
  /** All assignee user IDs. Source of truth for multiple assignees. */
  assignee_ids: string[];
  due_date: DueDateRange | null; // { start, end } in ISO date format (YYYY-MM-DD)
  tags: string[];
  /** Named fields for each property type. Canonical flat fields above are derived for backward compatibility. */
  priorities: Array<NamedField<Priority>>;
  statuses: Array<NamedField<Status>>;
  assignees: Array<NamedField<string[]>>;
  due_dates: Array<NamedField<DueDateRange>>;
  tag_fields: Array<NamedField<string[]>>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Workspace Member (for assignee)
// ============================================================================

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
}

// ============================================================================
// Entity Links (for @ mentions and inheritance)
// ============================================================================

export interface EntityLink {
  id: string;
  source_entity_type: EntityType;
  source_entity_id: string;
  target_entity_type: EntityType;
  target_entity_id: string;
  workspace_id: string;
  created_at: string;
}

export interface EntityReference {
  type: EntityType;
  id: string;
  title: string;
  context?: string;
}

// ============================================================================
// Input Types
// ============================================================================

export interface SetEntityPropertiesInput {
  entity_type: EntityType;
  entity_id: string;
  workspace_id?: string;
  updates: {
    status?: Status | null;
    priority?: Priority | null;
    /** Single assignee (legacy). Prefer assignee_ids for multiple. */
    assignee_id?: string | null;
    /** Set/replace all assignees. Replaces assignee_id. */
    assignee_ids?: string[] | null;
    due_date?: DueDateRange | null;
    tags?: string[];
    /** Replace all named priority fields for this entity. */
    priorities?: Array<{ field_name: string; value: Priority | null }> | null;
    /** Replace all named status fields for this entity. */
    statuses?: Array<{ field_name: string; value: Status | null }> | null;
    /** Replace all named assignee fields for this entity. */
    assignees?: Array<{ field_name: string; value: string[] | null }> | null;
    /** Replace all named due date fields for this entity. */
    due_dates?: Array<{ field_name: string; value: DueDateRange | null }> | null;
  };
}

export interface SetNamedFieldInput {
  entity_type: EntityType;
  entity_id: string;
  workspace_id: string;
  field_name: string;
  field_type: FieldType;
  value: Priority | Status | string[] | DueDateRange | null;
}

export interface AddTagInput {
  entity_type: EntityType;
  entity_id: string;
  workspace_id: string;
  tag: string;
}

export interface RemoveTagInput {
  entity_type: EntityType;
  entity_id: string;
  tag: string;
}

export interface CreateEntityLinkInput {
  source_entity_type: EntityType;
  source_entity_id: string;
  target_entity_type: EntityType;
  target_entity_id: string;
  workspace_id: string;
}

export interface SetInheritedPropertyVisibilityInput {
  entity_type: EntityType;
  entity_id: string;
  source_entity_type: EntityType;
  source_entity_id: string;
  is_visible: boolean;
}

// ============================================================================
// Property Value Types
// ============================================================================

export type PropertyValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | null;

// ============================================================================
// Query Types
// ============================================================================

export type QueryScope = 'workspace' | 'project' | 'tab';
export type QueryGroupBy = 'status' | 'priority' | 'assignee' | 'due_date';

export interface QueryEntitiesParams {
  scope: QueryScope;
  workspace_id: string;
  project_id?: string;
  tab_id?: string;
  entity_types?: EntityType[];
  filters?: QueryFilter[];
  properties?: PropertyFilter[];
  include_workflow_representations?: boolean;
}

export interface QueryFilter {
  field: 'status' | 'priority' | 'assignee_id' | 'due_date' | 'tags';
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty' | 'before' | 'after';
  value?: string | string[];
}

export interface PropertyFilter {
  field_type: FieldType;
  field_name?: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty" | "before" | "after";
  value?: PropertyValue;
}

export interface GroupedEntitiesResult {
  group_key: string;
  group_label: string;
  entities: EntityReference[];
}
