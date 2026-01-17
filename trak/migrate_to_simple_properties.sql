-- Migration: Simplify Properties System
-- Drop the complex property_definitions system and replace with fixed property fields

-- ============================================================================
-- 1. Drop old tables (property_definitions will cascade to old entity_properties)
-- ============================================================================

DROP TABLE IF EXISTS entity_properties CASCADE;
DROP TABLE IF EXISTS property_definitions CASCADE;

-- ============================================================================
-- 2. Create simplified entity_properties table
-- ============================================================================

CREATE TABLE entity_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('block', 'task', 'timeline_event', 'table_row')),
  entity_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Fixed property fields (all nullable - properties are optional)
  status TEXT CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_id UUID REFERENCES workspace_members(id) ON DELETE SET NULL,
  due_date DATE,
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One row per entity
  CONSTRAINT entity_properties_unique UNIQUE (entity_type, entity_id)
);

-- ============================================================================
-- 3. Indexes
-- ============================================================================

CREATE INDEX idx_entity_properties_entity ON entity_properties(entity_type, entity_id);
CREATE INDEX idx_entity_properties_workspace ON entity_properties(workspace_id);
CREATE INDEX idx_entity_properties_status ON entity_properties(workspace_id, status) WHERE status IS NOT NULL;
CREATE INDEX idx_entity_properties_priority ON entity_properties(workspace_id, priority) WHERE priority IS NOT NULL;
CREATE INDEX idx_entity_properties_assignee ON entity_properties(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_entity_properties_due_date ON entity_properties(workspace_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_entity_properties_tags ON entity_properties USING GIN (tags);

-- ============================================================================
-- 4. Row Level Security
-- ============================================================================

ALTER TABLE entity_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view entity properties" ON entity_properties;
DROP POLICY IF EXISTS "Workspace members can insert entity properties" ON entity_properties;
DROP POLICY IF EXISTS "Workspace members can update entity properties" ON entity_properties;
DROP POLICY IF EXISTS "Workspace members can delete entity properties" ON entity_properties;

CREATE POLICY "Workspace members can view entity properties"
  ON entity_properties FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can insert entity properties"
  ON entity_properties FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can update entity properties"
  ON entity_properties FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can delete entity properties"
  ON entity_properties FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Trigger for updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_entity_properties_updated_at ON entity_properties;

CREATE TRIGGER update_entity_properties_updated_at
  BEFORE UPDATE ON entity_properties
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Notes:
-- - entity_links table remains unchanged
-- - entity_inherited_display table remains unchanged
-- - All old data from property_definitions/entity_properties is lost
-- - If you need to preserve old data, export it before running this migration
-- ============================================================================
