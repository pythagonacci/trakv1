// ============================================================================
// Everything View Types
// Unified view showing all items with properties across the workspace
// ============================================================================

import type { EntityType, Status, Priority } from './properties';

// ============================================================================
// Source Types
// ============================================================================

/** The type of source container for an item */
export type SourceType = 'timeline' | 'task_list' | 'table' | 'block';

/** Source information for where an item comes from */
export interface ItemSource {
  /** Source container type */
  type: SourceType;
  /** Source container ID */
  id: string;
  /** Source container name */
  name: string;
  /** Tab ID containing the source */
  tabId: string;
  /** Tab name */
  tabName: string;
  /** Project ID containing the tab */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Clickable URL to navigate to source */
  url: string;
}

// ============================================================================
// Unified Item Model
// ============================================================================

/** Unified item combining all entity types for the Everything view */
export interface EverythingItem {
  /** Unique identifier */
  id: string;
  /** Entity type discriminator */
  type: EntityType;
  /** Item display name */
  name: string;
  /** Source information */
  source: ItemSource;
  /** Universal properties */
  properties: {
    status: Status | null;
    priority: Priority | null;
    assignee_ids: string[];
    due_date: string | null; // ISO date string (YYYY-MM-DD)
    tags: string[];
  };
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

// ============================================================================
// View Configuration
// ============================================================================

/** View type for the Everything view */
export type EverythingViewType = 'table' | 'board';

/** Grouping field options for board view */
export type GroupByField =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'due_date'
  | 'tags'
  | 'project'
  | 'source_type'
  | 'entity_type';

/** Sort field options */
export type SortField =
  | 'name'
  | 'status'
  | 'priority'
  | 'due_date'
  | 'created_at'
  | 'updated_at';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Sort configuration */
export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// ============================================================================
// Filtering
// ============================================================================

/** Due date filter presets */
export type DueDatePreset =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_week'
  | 'this_month'
  | 'next_month'
  | 'no_date';

/** Due date range filter */
export interface DueDateRange {
  /** Start date (inclusive) in ISO format */
  start: string | null;
  /** End date (inclusive) in ISO format */
  end: string | null;
}

/** Filter configuration */
export interface FilterConfig {
  /** Filter by entity types */
  entityTypes?: EntityType[];
  /** Filter by source types */
  sourceTypes?: SourceType[];
  /** Filter by status values */
  status?: Status[];
  /** Filter by priority values */
  priority?: Priority[];
  /** Filter by assignee IDs */
  assigneeIds?: string[];
  /** Filter by due date preset */
  dueDatePreset?: DueDatePreset;
  /** Filter by due date range (overrides preset) */
  dueDateRange?: DueDateRange;
  /** Filter by tags (items must have at least one of these tags) */
  tags?: string[];
  /** Filter by project IDs */
  projectIds?: string[];
  /** Search query for name/source name */
  searchQuery?: string;
}

// ============================================================================
// Board View
// ============================================================================

/** Group in board view */
export interface BoardGroup {
  /** Unique group identifier */
  id: string;
  /** Display label for the group */
  label: string;
  /** Color for the group header */
  color: string;
  /** Items in this group */
  items: EverythingItem[];
  /** Item count */
  count: number;
  /** Whether the group is collapsed */
  collapsed?: boolean;
}

// ============================================================================
// View State
// ============================================================================

/** Complete view configuration for persistence */
export interface EverythingViewConfig {
  /** View type */
  viewType: EverythingViewType;
  /** Active filters */
  filters: FilterConfig;
  /** Sort configuration */
  sort: SortConfig;
  /** Group by field (for board view) */
  groupBy: GroupByField;
  /** Column widths (for table view) - keyed by column name */
  columnWidths?: Record<string, number>;
}

// ============================================================================
// Query Options
// ============================================================================

/** Options for fetching everything items */
export interface EverythingOptions {
  /** Maximum number of items to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include items without properties (default: false) */
  includeWithoutProperties?: boolean;
}

/** Result of fetching everything items */
export interface EverythingResult {
  /** Items returned */
  items: EverythingItem[];
  /** Total count (before limit/offset) */
  total: number;
  /** Whether there are more items */
  hasMore: boolean;
}

// ============================================================================
// Bulk Actions
// ============================================================================

/** Bulk update input */
export interface BulkUpdateInput {
  /** Item IDs to update */
  itemIds: string[];
  /** Property updates to apply */
  updates: {
    status?: Status | null;
    priority?: Priority | null;
    assignee_ids?: string[];
    due_date?: string | null;
    tags?: string[];
  };
}
