-- Timeline refactor schema (Supabase-backed timeline items)

-- Ensure updated_at helper exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- timeline_events
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,

  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'blocked', 'done')),
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  notes TEXT,
  color TEXT DEFAULT 'bg-blue-500/50',
  is_milestone BOOLEAN DEFAULT FALSE,

  baseline_start TIMESTAMPTZ,
  baseline_end TIMESTAMPTZ,

  display_order INTEGER NOT NULL DEFAULT 0,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT timeline_events_date_order CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_block ON timeline_events(timeline_block_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_workspace ON timeline_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_dates ON timeline_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_timeline_events_assignee ON timeline_events(assignee_id);

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Timeline events visible to workspace members" ON timeline_events;
DROP POLICY IF EXISTS "Timeline events insertable by workspace members" ON timeline_events;
DROP POLICY IF EXISTS "Timeline events updatable by workspace members" ON timeline_events;
DROP POLICY IF EXISTS "Timeline events deletable by workspace members" ON timeline_events;

CREATE POLICY "Timeline events visible to workspace members"
  ON timeline_events
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline events insertable by workspace members"
  ON timeline_events
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline events updatable by workspace members"
  ON timeline_events
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline events deletable by workspace members"
  ON timeline_events
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS timeline_events_set_updated_at ON timeline_events;
CREATE TRIGGER timeline_events_set_updated_at
  BEFORE UPDATE ON timeline_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- timeline_references
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,

  reference_type TEXT NOT NULL CHECK (reference_type IN ('doc', 'table_row', 'task', 'block')),
  reference_id UUID NOT NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_references_event ON timeline_references(event_id);
CREATE INDEX IF NOT EXISTS idx_timeline_references_workspace ON timeline_references(workspace_id);
CREATE INDEX IF NOT EXISTS idx_timeline_references_target ON timeline_references(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_timeline_references_table ON timeline_references(table_id) WHERE table_id IS NOT NULL;

ALTER TABLE timeline_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Timeline references visible to workspace members" ON timeline_references;
DROP POLICY IF EXISTS "Timeline references insertable by workspace members" ON timeline_references;
DROP POLICY IF EXISTS "Timeline references updatable by workspace members" ON timeline_references;
DROP POLICY IF EXISTS "Timeline references deletable by workspace members" ON timeline_references;

CREATE POLICY "Timeline references visible to workspace members"
  ON timeline_references
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline references insertable by workspace members"
  ON timeline_references
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline references updatable by workspace members"
  ON timeline_references
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline references deletable by workspace members"
  ON timeline_references
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS timeline_references_set_updated_at ON timeline_references;
CREATE TRIGGER timeline_references_set_updated_at
  BEFORE UPDATE ON timeline_references
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- timeline_dependencies
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  from_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,

  dependency_type TEXT NOT NULL DEFAULT 'finish-to-start'
    CHECK (dependency_type IN ('finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish')),

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT timeline_dependencies_no_self_ref CHECK (
    from_id <> to_id
  )
);

CREATE INDEX IF NOT EXISTS idx_timeline_dependencies_block ON timeline_dependencies(timeline_block_id);
CREATE INDEX IF NOT EXISTS idx_timeline_dependencies_from ON timeline_dependencies(from_id);
CREATE INDEX IF NOT EXISTS idx_timeline_dependencies_to ON timeline_dependencies(to_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_dependencies_unique
  ON timeline_dependencies(timeline_block_id, from_id, to_id);

ALTER TABLE timeline_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Timeline dependencies visible to workspace members" ON timeline_dependencies;
DROP POLICY IF EXISTS "Timeline dependencies insertable by workspace members" ON timeline_dependencies;
DROP POLICY IF EXISTS "Timeline dependencies deletable by workspace members" ON timeline_dependencies;

CREATE POLICY "Timeline dependencies visible to workspace members"
  ON timeline_dependencies
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline dependencies insertable by workspace members"
  ON timeline_dependencies
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Timeline dependencies deletable by workspace members"
  ON timeline_dependencies
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
