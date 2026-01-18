// Trak Universal Properties - Simplified Implementation
// Fixed properties (not database-driven property definitions)

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 'block' | 'task' | 'timeline_event' | 'table_row';

// ============================================================================
// Property Values
// ============================================================================

export type Status = 'todo' | 'in_progress' | 'done' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

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
  todo: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ============================================================================
// Entity Properties
// ============================================================================

export interface EntityProperties {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  workspace_id: string;
  status: Status | null;
  priority: Priority | null;
  assignee_id: string | null;
  due_date: string | null; // ISO date string (YYYY-MM-DD)
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface InheritedEntityProperties {
  source_entity_type: EntityType;
  source_entity_id: string;
  source_title: string;
  properties: EntityProperties;
  visible: boolean;
}

export interface EntityPropertiesWithInheritance {
  direct: EntityProperties | null;
  inherited: InheritedEntityProperties[];
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
  workspace_id: string;
  updates: {
    status?: Status | null;
    priority?: Priority | null;
    assignee_id?: string | null;
    due_date?: string | null;
    tags?: string[];
  };
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
// Legacy Property Definition Types (schema-driven properties)
// ============================================================================

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone";

export interface PropertyOption {
  id: string;
  label: string;
  color?: string | null;
}

export interface PropertyDefinition {
  id: string;
  workspace_id: string;
  name: string;
  type: PropertyType;
  options?: PropertyOption[] | null;
  created_at: string;
  updated_at: string;
}

export type PropertyValue = string | number | boolean | string[] | null;

export interface CreatePropertyDefinitionInput {
  workspace_id: string;
  name: string;
  type: PropertyType;
  options?: PropertyOption[];
}

export interface UpdatePropertyDefinitionInput {
  name?: string;
  options?: PropertyOption[];
}

export interface EntityProperty {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  property_definition_id: string;
  value: PropertyValue;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface EntityPropertyWithDefinition extends EntityProperty {
  definition: PropertyDefinition;
}

export interface InheritedProperty {
  property: EntityPropertyWithDefinition;
  source: {
    entity_type: EntityType;
    entity_id: string;
  };
  is_visible: boolean;
}

export interface EntityPropertiesResult {
  direct: EntityPropertyWithDefinition[];
  inherited: InheritedProperty[];
}

export interface SetEntityPropertyInput {
  entity_type: EntityType;
  entity_id: string;
  property_definition_id: string;
  value: PropertyValue;
}

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
  include_inherited?: boolean;
}

export interface QueryFilter {
  field: 'status' | 'priority' | 'assignee_id' | 'due_date' | 'tags';
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty' | 'before' | 'after';
  value?: string | string[];
}

export interface PropertyFilter {
  property_definition_id: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty" | "before" | "after";
  value?: PropertyValue;
}

export interface GroupedEntitiesResult {
  group_key: string;
  group_label: string;
  entities: EntityReference[];
}
