// Table refactor baseline (Sept 2024):
// - Current table block lives at src/app/dashboard/projects/[projectId]/tabs/[tabId]/table-block.tsx and stores rows/cols/cells in blocks.content via updateBlock/getTabBlocks.
// - Field types are limited to ColumnType ('text' | 'number' | 'date' | 'select'); filters/sorts run client-side only and there are no saved views.
// - Data fetching is block-scoped through server actions + React Query in src/lib/hooks/use-tab-data.ts; there are no table-specific endpoints or Supabase tables today.
// - Table rendering is part of the generic block system inside the tab canvas; no server-backed views/grouping/filtering or dedicated row/comment models yet.

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "person"
  | "files"
  | "created_time"
  | "last_edited_time"
  | "created_by"
  | "last_edited_by"
  | "formula"
  | "relation"
  | "rollup"
  | "status"
  | "priority";

export type ViewType = "table" | "board" | "timeline" | "calendar" | "list" | "gallery";

export interface SelectFieldOption {
  /** Stable option identifier used in cells */
  id: string;
  /** User-facing label for the option */
  label: string;
  /** Tailwind-ready color token */
  color: string;
}

export interface SelectFieldConfig {
  /** All selectable options */
  options: SelectFieldOption[];
}

export interface NumberFieldConfig {
  /** Display formatting for numeric values */
  format: "number" | "currency" | "percent";
  /** ISO currency code when format === currency */
  currency?: string;
  /** Decimal precision */
  decimals?: number;
  /** Thousands separator character */
  separator?: string;
}

export interface DateFieldConfig {
  /** Whether to include time picker */
  includeTime: boolean;
  /** Display format string */
  format: string;
}

export interface FormulaFieldConfig {
  /** Expression string using supported functions */
  formula: string;
  /** Expected result type to drive rendering */
  resultType?: FieldType;
  /** Formula return type for computed rendering */
  return_type?: "number" | "text" | "boolean" | "date";
  /** Field IDs used by the formula for invalidation */
  dependencies?: string[];
}

export interface RelationFieldConfig {
  /** Target table identifier (preferred) */
  relation_table_id?: string;
  /** Relationship cardinality */
  relation_type?: "one_to_many" | "many_to_many";
  /** Whether relation is bidirectional */
  bidirectional?: boolean;
  /** Reverse field id when bidirectional */
  reverse_field_id?: string;
  /** Reverse field allows multiple links */
  reverse_allow_multiple?: boolean;
  /** Field id to use for display in related table */
  display_field_id?: string;
  /** Allow multiple related records (preferred) */
  allow_multiple?: boolean;
  /** Max number of linked rows */
  limit?: number;
  /** Legacy: target table identifier */
  linkedTableId?: string;
  /** Legacy: allow multiple related records */
  allowMultiple?: boolean;
  /** Legacy: symmetric relation flag */
  symmetricRelation?: boolean;
  /** Legacy: reverse allow multiple */
  reverseAllowMultiple?: boolean;
  /** Legacy: display field */
  displayFieldId?: string;
}

export interface RollupFieldConfig {
  /** Relation field on this table that points outward */
  relation_field_id?: string;
  /** Field on the related table to aggregate */
  target_field_id?: string;
  /** Aggregation strategy */
  aggregation:
    | "count"
    | "count_values"
    | "count_unique"
    | "count_empty"
    | "percent_empty"
    | "percent_not_empty"
    | "sum"
    | "average"
    | "median"
    | "min"
    | "max"
    | "range"
    | "earliest_date"
    | "latest_date"
    | "date_range"
    | "checked"
    | "unchecked"
    | "percent_checked"
    | "show_unique"
    | "show_original";
  /** Optional filter for related rows */
  filter?: {
    field_id: string;
    operator: FilterCondition["operator"];
    value: unknown;
  };
  /** Legacy: relation field id */
  relationFieldId?: string;
  /** Legacy: related field id */
  relatedFieldId?: string;
}

export interface StatusFieldConfig {
  /** Linked property definition ID (source of truth for canonical values) */
  property_definition_id?: string;
  /** Optional: filter to subset of property definition options (e.g., ["todo", "done"]) */
  allowed_options?: string[];
  /** DEPRECATED: Legacy inline options (migration only) */
  options?: SelectFieldOption[];
}

export interface PriorityLevelConfig {
  /** Stable priority identifier */
  id: string;
  /** Display label */
  label: string;
  /** Tailwind-ready color token */
  color: string;
  /** Relative ordering for UI */
  order: number;
}

export interface PriorityFieldConfig {
  /** Linked property definition ID (source of truth for canonical values) */
  property_definition_id?: string;
  /** Optional: filter to subset of property definition options (e.g., ["urgent", "high"]) */
  allowed_options?: string[];
  /** DEPRECATED: Legacy inline levels (migration only) */
  levels?: PriorityLevelConfig[];
}

export type FieldConfig =
  | SelectFieldConfig
  | NumberFieldConfig
  | DateFieldConfig
  | FormulaFieldConfig
  | RelationFieldConfig
  | RollupFieldConfig
  | StatusFieldConfig
  | PriorityFieldConfig
  | Record<string, unknown>;

export interface FilterCondition {
  /** Field ID the filter targets */
  fieldId: string;
  /** Operator applied to the value */
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "is_empty"
    | "is_not_empty"
    | "greater_than"
    | "less_than"
    | "greater_or_equal"
    | "less_or_equal"
    | "is_before"
    | "is_after"
    | "is_within"
    | "is_on_or_before"
    | "is_on_or_after";
  /** Value used by the operator */
  value: unknown;
  /** Logical chaining operator for subsequent conditions */
  logicalOperator?: "AND" | "OR";
}

export interface SortCondition {
  /** Field ID used for ordering */
  fieldId: string;
  /** Sort direction */
  direction: "asc" | "desc";
}

export interface GroupByConfig {
  /** Field used to group rows */
  fieldId: string;
  /** Collapsed group ids (option ids, member ids, or __ungrouped__) */
  collapsed?: string[];
  /** Whether to render empty groups (default: true) */
  showEmptyGroups?: boolean;
  /** Optional alphabetical sort for groups (default: asc) */
  sortOrder?: "asc" | "desc";
}

export interface ViewConfig {
  /** Applied filter set */
  filters?: FilterCondition[];
  /** Applied sort order */
  sorts?: SortCondition[];
  /** Hidden field IDs for this view */
  hiddenFields?: string[];
  /** Pinned field IDs for this view (shown first, sticky when scrolling) */
  pinnedFields?: string[];
  /** Grouping metadata (table view only) */
  groupBy?: GroupByConfig;
  /** Board view configuration */
  boardConfig?: {
    groupByFieldId: string;
    cardCoverFieldId?: string;
    cardPropertiesVisible?: string[];
  };
  /** Calendar view configuration */
  calendarConfig?: {
    dateFieldId: string;
    endDateFieldId?: string;
  };
  /** Gallery view configuration */
  galleryConfig?: {
    coverFieldId?: string;
    cardSize: "small" | "medium" | "large";
  };
  /** Timeline view configuration */
  timelineConfig?: {
    dateFieldId: string;
    groupByFieldId?: string;
  };
  /** Column calculation metadata */
  field_calculations?: Record<string, CalculationType>;
}

export type CalculationType =
  | "sum"
  | "average"
  | "median"
  | "min"
  | "max"
  | "range"
  | "count_all"
  | "count_values"
  | "count_empty"
  | "count_unique"
  | "percent_empty"
  | "percent_filled"
  | "checked"
  | "unchecked"
  | "percent_checked";

export interface Table {
  /** Primary identifier (UUID) */
  id: string;
  /** Owning workspace ID */
  workspace_id: string;
  /** Owning project ID when scoped to a project */
  project_id: string | null;
  /** Human-friendly title */
  title: string;
  /** Optional description for context */
  description: string | null;
  /** Emoji or icon identifier */
  icon: string | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Creator user ID */
  created_by: string | null;
}

export interface TableField {
  /** Field identifier (UUID) */
  id: string;
  /** Parent table identifier */
  table_id: string;
  /** User-facing field name */
  name: string;
  /** Field type discriminator */
  type: FieldType;
  /** Field-type-specific configuration payload */
  config: FieldConfig | null;
  /** Property definition ID for priority/status fields (links to workspace-level definitions) */
  property_definition_id?: string | null;
  /** Column ordering index */
  order: number;
  /** Whether this is the primary display field */
  is_primary: boolean;
  /** Optional column width in pixels */
  width: number | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

export type TableRowData = Record<string, unknown>;

export interface TableRow {
  /** Row identifier (UUID) */
  id: string;
  /** Parent table identifier */
  table_id: string;
  /** Source entity type when this row is a workflow representation copy */
  source_entity_type: TableRowSourceEntityType | null;
  /** Source entity ID when this row is a workflow representation copy */
  source_entity_id: string | null;
  /** Sync behavior for source-linked rows */
  source_sync_mode: TableRowSourceSyncMode;
  /** Cell values keyed by field ID */
  data: TableRowData;
  /** Fractional order used for stable sorting */
  order: string;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Creator user ID */
  created_by: string | null;
  /** Last editor user ID */
  updated_by: string | null;
}

export type TableRowSourceEntityType = "task" | "timeline_event";

export type TableRowSourceSyncMode = "snapshot" | "live";

export interface TableView {
  /** View identifier (UUID) */
  id: string;
  /** Parent table identifier */
  table_id: string;
  /** View name */
  name: string;
  /** View type discriminator */
  type: ViewType;
  /** Persisted configuration payload */
  config: ViewConfig;
  /** Whether this is the default view */
  is_default: boolean;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Creator user ID */
  created_by: string | null;
}

export interface TableComment {
  /** Comment identifier (UUID) */
  id: string;
  /** Associated row identifier */
  row_id: string;
  /** Comment author */
  user_id: string;
  /** Comment text body */
  content: string;
  /** Optional parent comment for threads */
  parent_id: string | null;
  /** Whether the thread is resolved */
  resolved: boolean;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}
