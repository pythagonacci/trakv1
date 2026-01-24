-- Task block refactor schema (Supabase-backed task items)

-- Ensure updated_at helper exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- task_items
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  priority TEXT DEFAULT 'none' CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  description TEXT,
  due_date DATE,
  due_time TIME,
  start_date DATE,

  hide_icons BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,

  recurring_enabled BOOLEAN DEFAULT FALSE,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly')),
  recurring_interval INTEGER DEFAULT 1,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_items_block ON task_items(task_block_id);
CREATE INDEX IF NOT EXISTS idx_task_items_workspace ON task_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_items_tab ON task_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_task_items_due ON task_items(due_date);
CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_task_items_assignee ON task_items(assignee_id);

ALTER TABLE task_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task items visible to workspace members" ON task_items;
DROP POLICY IF EXISTS "Task items insertable by workspace members" ON task_items;
DROP POLICY IF EXISTS "Task items updatable by workspace members" ON task_items;
DROP POLICY IF EXISTS "Task items deletable by workspace members" ON task_items;

CREATE POLICY "Task items visible to workspace members"
  ON task_items
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task items insertable by workspace members"
  ON task_items
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task items updatable by workspace members"
  ON task_items
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task items deletable by workspace members"
  ON task_items
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS task_items_set_updated_at ON task_items;
CREATE TRIGGER task_items_set_updated_at
  BEFORE UPDATE ON task_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- task_subtasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id);

ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task subtasks visible to workspace members" ON task_subtasks;
DROP POLICY IF EXISTS "Task subtasks insertable by workspace members" ON task_subtasks;
DROP POLICY IF EXISTS "Task subtasks updatable by workspace members" ON task_subtasks;
DROP POLICY IF EXISTS "Task subtasks deletable by workspace members" ON task_subtasks;

CREATE POLICY "Task subtasks visible to workspace members"
  ON task_subtasks
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task subtasks insertable by workspace members"
  ON task_subtasks
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task subtasks updatable by workspace members"
  ON task_subtasks
  FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task subtasks deletable by workspace members"
  ON task_subtasks
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP TRIGGER IF EXISTS task_subtasks_set_updated_at ON task_subtasks;
CREATE TRIGGER task_subtasks_set_updated_at
  BEFORE UPDATE ON task_subtasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- task_comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task comments visible to workspace members" ON task_comments;
DROP POLICY IF EXISTS "Task comments insertable by workspace members" ON task_comments;
DROP POLICY IF EXISTS "Task comments updatable by workspace members" ON task_comments;
DROP POLICY IF EXISTS "Task comments deletable by workspace members" ON task_comments;

CREATE POLICY "Task comments visible to workspace members"
  ON task_comments
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task comments insertable by workspace members"
  ON task_comments
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task comments updatable by workspace members"
  ON task_comments
  FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task comments deletable by workspace members"
  ON task_comments
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP TRIGGER IF EXISTS task_comments_set_updated_at ON task_comments;
CREATE TRIGGER task_comments_set_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- task_tags
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_workspace ON task_tags(workspace_id);

ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task tags visible to workspace members" ON task_tags;
DROP POLICY IF EXISTS "Task tags insertable by workspace members" ON task_tags;
DROP POLICY IF EXISTS "Task tags updatable by workspace members" ON task_tags;
DROP POLICY IF EXISTS "Task tags deletable by workspace members" ON task_tags;

CREATE POLICY "Task tags visible to workspace members"
  ON task_tags
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task tags insertable by workspace members"
  ON task_tags
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task tags updatable by workspace members"
  ON task_tags
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task tags deletable by workspace members"
  ON task_tags
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS task_tags_set_updated_at ON task_tags;
CREATE TRIGGER task_tags_set_updated_at
  BEFORE UPDATE ON task_tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- task_tag_links
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_tag_links (
  task_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tag_links_task ON task_tag_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tag_links_tag ON task_tag_links(tag_id);

ALTER TABLE task_tag_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task tag links visible to workspace members" ON task_tag_links;
DROP POLICY IF EXISTS "Task tag links insertable by workspace members" ON task_tag_links;
DROP POLICY IF EXISTS "Task tag links deletable by workspace members" ON task_tag_links;

CREATE POLICY "Task tag links visible to workspace members"
  ON task_tag_links
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task tag links insertable by workspace members"
  ON task_tag_links
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task tag links deletable by workspace members"
  ON task_tag_links
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- task_assignees
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, assignee_id, assignee_name)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee ON task_assignees(assignee_id);

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task assignees visible to workspace members" ON task_assignees;
DROP POLICY IF EXISTS "Task assignees insertable by workspace members" ON task_assignees;
DROP POLICY IF EXISTS "Task assignees deletable by workspace members" ON task_assignees;

CREATE POLICY "Task assignees visible to workspace members"
  ON task_assignees
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task assignees insertable by workspace members"
  ON task_assignees
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Task assignees deletable by workspace members"
  ON task_assignees
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM task_items WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- task_references
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,

  reference_type TEXT NOT NULL CHECK (reference_type IN ('doc', 'table_row', 'task', 'block', 'tab')),
  reference_id UUID NOT NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_references_task ON task_references(task_id);
CREATE INDEX IF NOT EXISTS idx_task_references_workspace ON task_references(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_references_target ON task_references(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_task_references_table ON task_references(table_id) WHERE table_id IS NOT NULL;

ALTER TABLE task_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Task references visible to workspace members" ON task_references;
DROP POLICY IF EXISTS "Task references insertable by workspace members" ON task_references;
DROP POLICY IF EXISTS "Task references updatable by workspace members" ON task_references;
DROP POLICY IF EXISTS "Task references deletable by workspace members" ON task_references;

CREATE POLICY "Task references visible to workspace members"
  ON task_references
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task references insertable by workspace members"
  ON task_references
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task references updatable by workspace members"
  ON task_references
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Task references deletable by workspace members"
  ON task_references
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS task_references_set_updated_at ON task_references;
CREATE TRIGGER task_references_set_updated_at
  BEFORE UPDATE ON task_references
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
