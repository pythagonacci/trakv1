-- Add indexes for entity_properties queries (AI search layer refactor)
-- These indexes optimize property-based filtering for tasks, blocks, and timeline_events

-- Composite index for property lookups by workspace, property definition, and entity type
CREATE INDEX IF NOT EXISTS idx_entity_props_workspace_propdef_entity
  ON entity_properties(workspace_id, property_definition_id, entity_type, entity_id);

-- Index for property definition lookups by workspace and name
CREATE INDEX IF NOT EXISTS idx_property_defs_workspace_name
  ON property_definitions(workspace_id, name);

-- GIN index for JSONB value queries (supports containment and path queries)
CREATE INDEX IF NOT EXISTS idx_entity_props_value_gin
  ON entity_properties USING GIN (value);

-- Index for entity type + entity ID lookups (for enriching results)
CREATE INDEX IF NOT EXISTS idx_entity_props_entity
  ON entity_properties(entity_type, entity_id, workspace_id);

-- Index for efficient lookups when filtering by entity_id (common in enrichment queries)
CREATE INDEX IF NOT EXISTS idx_entity_props_entity_id
  ON entity_properties(entity_id);
