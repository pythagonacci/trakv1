-- Table refactor groundwork (baseline scan, Sept 2024):
-- - Current table UI lives in src/app/dashboard/projects/[projectId]/tabs/[tabId]/table-block.tsx and persists rows/cols/cells in blocks.content JSONB via updateBlock/getTabBlocks.
-- - Field types today are limited to ColumnType ('text' | 'number' | 'date' | 'checkbox' | 'select') with client-only filters/sorts; no dedicated Supabase tables for tables/fields/rows/views/comments.
-- - Data fetch is block-scoped through server actions + React Query (see src/lib/hooks/use-tab-data.ts); no table-specific endpoints or schemas.
-- - Table is just another block type inside the tab canvas renderer; there are no saved views, grouping, or Supabase-backed row-level RLS for table data yet.

-- ============================================================================
-- Core tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Table',
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_tables_workspace_id ON tables(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tables_project_id ON tables(project_id);
CREATE INDEX IF NOT EXISTS idx_tables_created_by ON tables(created_by);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tables are visible to workspace members"
  ON tables
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tables can be created by workspace members"
  ON tables
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tables can be updated by workspace members"
  ON tables
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tables can be deleted by workspace members"
  ON tables
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS table_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Field',
  type TEXT NOT NULL CHECK (type IN ('text', 'long_text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url', 'email', 'phone', 'person', 'files', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by', 'formula', 'relation', 'rollup', 'status', 'priority')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  "order" INTEGER NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  width INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT table_fields_order_unique UNIQUE (table_id, "order")
);

CREATE INDEX IF NOT EXISTS idx_table_fields_table_id ON table_fields(table_id);
CREATE INDEX IF NOT EXISTS idx_table_fields_order ON table_fields(table_id, "order");

ALTER TABLE table_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table fields visible to workspace members"
  ON table_fields
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_fields.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table fields insertable by workspace members"
  ON table_fields
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_fields.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table fields updatable by workspace members"
  ON table_fields
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_fields.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table fields deletable by workspace members"
  ON table_fields
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_fields.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE TABLE IF NOT EXISTS table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  "order" NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_table_rows_table_id ON table_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_table_rows_data_gin ON table_rows USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_table_rows_order ON table_rows(table_id, "order");

ALTER TABLE table_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table rows visible to workspace members"
  ON table_rows
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_rows.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table rows insertable by workspace members"
  ON table_rows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_rows.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table rows updatable by workspace members"
  ON table_rows
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_rows.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table rows deletable by workspace members"
  ON table_rows
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_rows.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE TABLE IF NOT EXISTS table_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled View',
  type TEXT NOT NULL DEFAULT 'table' CHECK (type IN ('table', 'board', 'calendar', 'list', 'gallery')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_table_views_table_id ON table_views(table_id);
CREATE INDEX IF NOT EXISTS idx_table_views_created_by ON table_views(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_views_default_unique ON table_views(table_id) WHERE is_default;

ALTER TABLE table_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table views visible to workspace members"
  ON table_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_views.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table views insertable by workspace members"
  ON table_views
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_views.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table views updatable by workspace members"
  ON table_views
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_views.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table views deletable by workspace members"
  ON table_views
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_views.table_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE TABLE IF NOT EXISTS table_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES table_comments(id) ON DELETE CASCADE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_comments_row_id ON table_comments(row_id);
CREATE INDEX IF NOT EXISTS idx_table_comments_user_id ON table_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_table_comments_parent_id ON table_comments(parent_id);

ALTER TABLE table_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table comments visible to workspace members"
  ON table_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM table_rows r
      JOIN tables t ON t.id = r.table_id
      WHERE r.id = table_comments.row_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table comments insertable by workspace members"
  ON table_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM table_rows r
      JOIN tables t ON t.id = r.table_id
      WHERE r.id = table_comments.row_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table comments updatable by workspace members"
  ON table_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM table_rows r
      JOIN tables t ON t.id = r.table_id
      WHERE r.id = table_comments.row_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Table comments deletable by workspace members"
  ON table_comments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM table_rows r
      JOIN tables t ON t.id = r.table_id
      WHERE r.id = table_comments.row_id
        AND t.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    )
  );

-- ============================================================================
-- Utility functions & triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_single_default_view()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE table_views
    SET is_default = FALSE
    WHERE table_id = NEW.table_id
      AND id <> NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_table_field_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."order" IS NULL THEN
    SELECT COALESCE(MAX("order"), 0) + 1 INTO NEW."order"
    FROM table_fields
    WHERE table_id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_table_row_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."order" IS NULL THEN
    SELECT COALESCE(MAX("order"), 0)::NUMERIC + 1 INTO NEW."order"
    FROM table_rows
    WHERE table_id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_table_row_data()
RETURNS TRIGGER AS $$
DECLARE
  key TEXT;
  field_record RECORD;
  value JSONB;
BEGIN
  -- Ensure all keys reference existing fields on the table
  FOR key IN SELECT jsonb_object_keys(COALESCE(NEW.data, '{}'::jsonb))
  LOOP
    SELECT id, type, config INTO field_record
    FROM table_fields
    WHERE id = key::uuid
      AND table_id = NEW.table_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown field id % for table %', key, NEW.table_id;
    END IF;

    value := NEW.data -> key;

    -- Basic type validation per field type (lightweight to avoid blocking flexible configs)
    IF field_record.type = 'number' THEN
      IF jsonb_typeof(value) NOT IN ('number', 'string', 'null') THEN
        RAISE EXCEPTION 'Field % expects numeric-compatible value', key;
      END IF;
    ELSIF field_record.type = 'checkbox' THEN
      IF jsonb_typeof(value) NOT IN ('boolean', 'null') THEN
        RAISE EXCEPTION 'Field % expects boolean value', key;
      END IF;
    ELSIF field_record.type IN ('multi_select', 'files', 'relation') THEN
      IF jsonb_typeof(value) NOT IN ('array', 'null') THEN
        RAISE EXCEPTION 'Field % expects array value', key;
      END IF;
    ELSIF field_record.type = 'date' THEN
      IF jsonb_typeof(value) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'Field % expects ISO date string', key;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger wiring
-- ============================================================================

-- updated_at maintenance
CREATE TRIGGER tables_set_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER table_fields_set_updated_at
  BEFORE UPDATE ON table_fields
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER table_rows_set_updated_at
  BEFORE UPDATE ON table_rows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER table_views_set_updated_at
  BEFORE UPDATE ON table_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER table_comments_set_updated_at
  BEFORE UPDATE ON table_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- default view enforcement
CREATE TRIGGER table_views_single_default
  BEFORE INSERT OR UPDATE ON table_views
  FOR EACH ROW
  WHEN (NEW.is_default IS TRUE)
  EXECUTE FUNCTION ensure_single_default_view();

-- auto-increment orders
CREATE TRIGGER table_fields_set_order
  BEFORE INSERT ON table_fields
  FOR EACH ROW EXECUTE FUNCTION assign_table_field_order();

CREATE TRIGGER table_rows_set_order
  BEFORE INSERT ON table_rows
  FOR EACH ROW EXECUTE FUNCTION assign_table_row_order();

-- row data validation
CREATE TRIGGER table_rows_validate_data
  BEFORE INSERT OR UPDATE ON table_rows
  FOR EACH ROW EXECUTE FUNCTION validate_table_row_data();

