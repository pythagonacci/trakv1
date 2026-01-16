// Universal Properties & Linking System Types
// Enables properties on any entity (blocks, tasks, timeline_events, table_rows) and linking between entities

/**
 * Property type discriminator
 */
export type PropertyType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "person"
  | "checkbox";

/**
 * Entity type discriminator
 */
export type EntityType = "block" | "task" | "timeline_event" | "table_row";

/**
 * Option for select/multi_select properties
 */
export interface PropertyOption {
  /** Stable option identifier */
  id: string;
  /** User-facing label */
  label: string;
  /** Tailwind-ready color token */
  color: string;
}

/**
 * Property definition stored at workspace level
 * Defines the schema for a property (e.g., "Status", "Assignee")
 */
export interface PropertyDefinition {
  /** Primary identifier (UUID) */
  id: string;
  /** Owning workspace ID */
  workspace_id: string;
  /** Property name (e.g., "Status", "Priority") */
  name: string;
  /** Property type discriminator */
  type: PropertyType;
  /** Options for select/multi_select types */
  options: PropertyOption[];
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Union of possible property values
 */
export type PropertyValue =
  | string           // text, select, person (user ID)
  | number           // number
  | boolean          // checkbox
  | string[]         // multi_select, person (multiple user IDs)
  | null;            // unset

/**
 * Entity property value stored in the database
 */
export interface EntityProperty {
  /** Primary identifier (UUID) */
  id: string;
  /** Entity type (block, task, timeline_event, table_row) */
  entity_type: EntityType;
  /** Entity ID from the respective table */
  entity_id: string;
  /** Reference to property definition */
  property_definition_id: string;
  /** Actual property value */
  value: PropertyValue;
  /** Workspace ID for RLS */
  workspace_id: string;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Entity link representing @ mentions between entities
 */
export interface EntityLink {
  /** Primary identifier (UUID) */
  id: string;
  /** Source entity type */
  source_entity_type: EntityType;
  /** Source entity ID */
  source_entity_id: string;
  /** Target entity type */
  target_entity_type: EntityType;
  /** Target entity ID */
  target_entity_id: string;
  /** Workspace ID for RLS */
  workspace_id: string;
  /** Creation timestamp */
  created_at: string;
}

/**
 * User preference for inherited property visibility
 */
export interface EntityInheritedDisplay {
  /** Primary identifier (UUID) */
  id: string;
  /** Entity type receiving the inherited property */
  entity_type: EntityType;
  /** Entity ID receiving the inherited property */
  entity_id: string;
  /** Source entity type (where property is defined) */
  source_entity_type: EntityType;
  /** Source entity ID (where property is defined) */
  source_entity_id: string;
  /** Property definition ID */
  property_definition_id: string;
  /** Whether to show this inherited property */
  is_visible: boolean;
}

/**
 * Property with definition included (joined result)
 */
export interface EntityPropertyWithDefinition extends EntityProperty {
  /** Full property definition */
  definition: PropertyDefinition;
}

/**
 * Inherited property (from a linked entity)
 */
export interface InheritedProperty {
  /** The property itself */
  property: EntityPropertyWithDefinition;
  /** Source entity information */
  source: {
    entity_type: EntityType;
    entity_id: string;
  };
  /** Whether this inherited property is visible */
  is_visible: boolean;
}

/**
 * Combined properties result for an entity
 */
export interface EntityPropertiesResult {
  /** Direct properties on the entity */
  direct: EntityPropertyWithDefinition[];
  /** Properties inherited from linked entities */
  inherited: InheritedProperty[];
}

/**
 * Reference to an entity (for entity picker)
 */
export interface EntityReference {
  /** Entity type */
  type: EntityType;
  /** Entity ID */
  id: string;
  /** Display title (resolved from entity) */
  title: string;
  /** Additional context (tab name, table name, etc.) */
  context?: string;
}

/**
 * Query parameters for querying entities by properties
 */
export interface QueryEntitiesParams {
  /** Scope type */
  scope: "workspace" | "project" | "tab";
  /** Workspace ID (required) */
  workspace_id: string;
  /** Project ID (for project/tab scope) */
  project_id?: string;
  /** Tab ID (for tab scope) */
  tab_id?: string;
  /** Entity types to include (defaults to all) */
  entity_types?: EntityType[];
  /** Property filters */
  properties?: PropertyFilter[];
  /** Whether to include inherited properties in results */
  include_inherited?: boolean;
}

/**
 * Property filter for queries
 */
export interface PropertyFilter {
  /** Property definition ID to filter on */
  property_definition_id: string;
  /** Filter operator */
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  /** Filter value */
  value?: PropertyValue;
}

/**
 * Grouped query result
 */
export interface GroupedEntitiesResult {
  /** Group key (option id, or "__no_value__" for entities without the property) */
  group_key: string;
  /** Group label (option label, or "No Status" etc.) */
  group_label: string;
  /** Entities in this group */
  entities: EntityReference[];
}

/**
 * Input for creating a property definition
 */
export interface CreatePropertyDefinitionInput {
  workspace_id: string;
  name: string;
  type: PropertyType;
  options?: PropertyOption[];
}

/**
 * Input for updating a property definition
 */
export interface UpdatePropertyDefinitionInput {
  name?: string;
  options?: PropertyOption[];
}

/**
 * Input for setting an entity property
 */
export interface SetEntityPropertyInput {
  entity_type: EntityType;
  entity_id: string;
  property_definition_id: string;
  value: PropertyValue;
  workspace_id: string;
}

/**
 * Input for creating an entity link
 */
export interface CreateEntityLinkInput {
  source_entity_type: EntityType;
  source_entity_id: string;
  target_entity_type: EntityType;
  target_entity_id: string;
  workspace_id: string;
}
