-- Universal Properties & Linking System Schema
-- Enables properties on any entity (blocks, tasks, timeline_events, table_rows) and linking between entities

-- Ensure updated_at helper exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- property_definitions
-- Stores the available properties for a workspace (e.g., "Status", "Assignee")
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'date', 'select', 'multi_select', 'person', 'checkbox')),
  options JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT property_definitions_workspace_name_unique UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_property_definitions_workspace ON property_definitions(workspace_id);

ALTER TABLE property_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property definitions visible to workspace members" ON property_definitions;
DROP POLICY IF EXISTS "Property definitions insertable by workspace members" ON property_definitions;
DROP POLICY IF EXISTS "Property definitions updatable by workspace members" ON property_definitions;
DROP POLICY IF EXISTS "Property definitions deletable by workspace members" ON property_definitions;

CREATE POLICY "Property definitions visible to workspace members"
  ON property_definitions
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Property definitions insertable by workspace members"
  ON property_definitions
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Property definitions updatable by workspace members"
  ON property_definitions
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Property definitions deletable by workspace members"
  ON property_definitions
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS property_definitions_set_updated_at ON property_definitions;
CREATE TRIGGER property_definitions_set_updated_at
  BEFORE UPDATE ON property_definitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- entity_properties
-- Stores actual property values on entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type TEXT NOT NULL CHECK (entity_type IN ('block', 'task', 'timeline_event', 'table_row')),
  entity_id UUID NOT NULL,
  property_definition_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
  value JSONB,

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entity_properties_entity_property_unique UNIQUE (entity_type, entity_id, property_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_properties_entity ON entity_properties(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_properties_property_definition ON entity_properties(property_definition_id);
CREATE INDEX IF NOT EXISTS idx_entity_properties_workspace ON entity_properties(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entity_properties_value_gin ON entity_properties USING GIN (value);

ALTER TABLE entity_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity properties visible to workspace members" ON entity_properties;
DROP POLICY IF EXISTS "Entity properties insertable by workspace members" ON entity_properties;
DROP POLICY IF EXISTS "Entity properties updatable by workspace members" ON entity_properties;
DROP POLICY IF EXISTS "Entity properties deletable by workspace members" ON entity_properties;

CREATE POLICY "Entity properties visible to workspace members"
  ON entity_properties
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Entity properties insertable by workspace members"
  ON entity_properties
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Entity properties updatable by workspace members"
  ON entity_properties
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Entity properties deletable by workspace members"
  ON entity_properties
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS entity_properties_set_updated_at ON entity_properties;
CREATE TRIGGER entity_properties_set_updated_at
  BEFORE UPDATE ON entity_properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- entity_links
-- Stores references/links between entities (@ mentions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_entity_type TEXT NOT NULL CHECK (source_entity_type IN ('block', 'task', 'timeline_event', 'table_row')),
  source_entity_id UUID NOT NULL,
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('block', 'task', 'timeline_event', 'table_row')),
  target_entity_id UUID NOT NULL,

  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entity_links_unique UNIQUE (source_entity_type, source_entity_id, target_entity_type, target_entity_id),
  CONSTRAINT entity_links_no_self_link CHECK (
    NOT (source_entity_type = target_entity_type AND source_entity_id = target_entity_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_workspace ON entity_links(workspace_id);

ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity links visible to workspace members" ON entity_links;
DROP POLICY IF EXISTS "Entity links insertable by workspace members" ON entity_links;
DROP POLICY IF EXISTS "Entity links deletable by workspace members" ON entity_links;

CREATE POLICY "Entity links visible to workspace members"
  ON entity_links
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Entity links insertable by workspace members"
  ON entity_links
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Entity links deletable by workspace members"
  ON entity_links
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- entity_inherited_display
-- Stores user preferences for which inherited properties to show on an entity
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_inherited_display (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type TEXT NOT NULL CHECK (entity_type IN ('block', 'task', 'timeline_event', 'table_row')),
  entity_id UUID NOT NULL,
  source_entity_type TEXT NOT NULL CHECK (source_entity_type IN ('block', 'task', 'timeline_event', 'table_row')),
  source_entity_id UUID NOT NULL,
  property_definition_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,

  is_visible BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT entity_inherited_display_unique UNIQUE (
    entity_type, entity_id, source_entity_type, source_entity_id, property_definition_id
  )
);

CREATE INDEX IF NOT EXISTS idx_entity_inherited_display_entity ON entity_inherited_display(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_inherited_display_source ON entity_inherited_display(source_entity_type, source_entity_id);

ALTER TABLE entity_inherited_display ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity inherited display visible to workspace members" ON entity_inherited_display;
DROP POLICY IF EXISTS "Entity inherited display insertable by workspace members" ON entity_inherited_display;
DROP POLICY IF EXISTS "Entity inherited display updatable by workspace members" ON entity_inherited_display;
DROP POLICY IF EXISTS "Entity inherited display deletable by workspace members" ON entity_inherited_display;

-- For entity_inherited_display, we need to check through property_definitions
CREATE POLICY "Entity inherited display visible to workspace members"
  ON entity_inherited_display
  FOR SELECT
  USING (
    property_definition_id IN (
      SELECT id FROM property_definitions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Entity inherited display insertable by workspace members"
  ON entity_inherited_display
  FOR INSERT
  WITH CHECK (
    property_definition_id IN (
      SELECT id FROM property_definitions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Entity inherited display updatable by workspace members"
  ON entity_inherited_display
  FOR UPDATE
  USING (
    property_definition_id IN (
      SELECT id FROM property_definitions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Entity inherited display deletable by workspace members"
  ON entity_inherited_display
  FOR DELETE
  USING (
    property_definition_id IN (
      SELECT id FROM property_definitions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Default Properties Function
-- Creates default property definitions when a workspace is created
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_property_definitions()
RETURNS TRIGGER AS $$
BEGIN
  -- Status property (select)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (
    NEW.id,
    'Status',
    'select',
    '[
      {"id": "todo", "label": "To Do", "color": "gray"},
      {"id": "in_progress", "label": "In Progress", "color": "blue"},
      {"id": "blocked", "label": "Blocked", "color": "red"},
      {"id": "done", "label": "Done", "color": "green"}
    ]'::jsonb
  );

  -- Assignee property (person)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (NEW.id, 'Assignee', 'person', '[]'::jsonb);

  -- Due Date property (date)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (NEW.id, 'Due Date', 'date', '[]'::jsonb);

  -- Priority property (select)
  INSERT INTO property_definitions (workspace_id, name, type, options)
  VALUES (
    NEW.id,
    'Priority',
    'select',
    '[
      {"id": "low", "label": "Low", "color": "gray"},
      {"id": "medium", "label": "Medium", "color": "yellow"},
      {"id": "high", "label": "High", "color": "orange"},
      {"id": "urgent", "label": "Urgent", "color": "red"}
    ]'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new workspaces (but only if the trigger doesn't already exist)
DROP TRIGGER IF EXISTS create_default_properties_on_workspace ON workspaces;
CREATE TRIGGER create_default_properties_on_workspace
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION create_default_property_definitions();

-- ============================================================================
-- Helper function: Get workspace_id for any entity
-- Used to validate workspace membership for entity operations
-- ============================================================================

CREATE OR REPLACE FUNCTION get_workspace_id_for_entity(
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  CASE p_entity_type
    WHEN 'block' THEN
      SELECT p.workspace_id INTO v_workspace_id
      FROM blocks b
      JOIN tabs t ON t.id = b.tab_id
      JOIN projects p ON p.id = t.project_id
      WHERE b.id = p_entity_id;

    WHEN 'task' THEN
      SELECT workspace_id INTO v_workspace_id
      FROM task_items
      WHERE id = p_entity_id;

    WHEN 'timeline_event' THEN
      SELECT workspace_id INTO v_workspace_id
      FROM timeline_events
      WHERE id = p_entity_id;

    WHEN 'table_row' THEN
      SELECT t.workspace_id INTO v_workspace_id
      FROM table_rows r
      JOIN tables t ON t.id = r.table_id
      WHERE r.id = p_entity_id;

    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql;
