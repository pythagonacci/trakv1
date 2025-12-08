-- ============================================================================
-- CLIENT TABS FEATURE
-- ============================================================================
-- This migration adds support for custom tabs within client detail pages
-- Similar to project tabs but for organizing client-specific information

-- 1. Create client_tabs table
CREATE TABLE IF NOT EXISTS client_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_tabs_client_id ON client_tabs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tabs_position ON client_tabs(client_id, position);

-- Enable RLS
ALTER TABLE client_tabs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view tabs for clients in their workspace
CREATE POLICY "Users can view client tabs in their workspace"
  ON client_tabs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_tabs.client_id
      AND wm.user_id = auth.uid()
    )
  );

-- Users can create tabs for clients in their workspace
CREATE POLICY "Users can create client tabs in their workspace"
  ON client_tabs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_tabs.client_id
      AND wm.user_id = auth.uid()
    )
  );

-- Users can update tabs for clients in their workspace
CREATE POLICY "Users can update client tabs in their workspace"
  ON client_tabs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_tabs.client_id
      AND wm.user_id = auth.uid()
    )
  );

-- Only admins/owners can delete tabs
CREATE POLICY "Admins and owners can delete client tabs"
  ON client_tabs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = client_tabs.client_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('admin', 'owner')
    )
  );

-- 2. Create client_tab_blocks table for content within tabs
CREATE TABLE IF NOT EXISTS client_tab_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES client_tabs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  "column" INTEGER NOT NULL DEFAULT 0 CHECK ("column" >= 0 AND "column" <= 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_tab_blocks_tab_id ON client_tab_blocks(tab_id);
CREATE INDEX IF NOT EXISTS idx_client_tab_blocks_position ON client_tab_blocks(tab_id, "column", position);

-- Enable RLS
ALTER TABLE client_tab_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view blocks for tabs in their workspace
CREATE POLICY "Users can view client tab blocks in their workspace"
  ON client_tab_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_tabs ct
      JOIN clients c ON c.id = ct.client_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE ct.id = client_tab_blocks.tab_id
      AND wm.user_id = auth.uid()
    )
  );

-- Users can create blocks for tabs in their workspace
CREATE POLICY "Users can create client tab blocks in their workspace"
  ON client_tab_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_tabs ct
      JOIN clients c ON c.id = ct.client_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE ct.id = client_tab_blocks.tab_id
      AND wm.user_id = auth.uid()
    )
  );

-- Users can update blocks for tabs in their workspace
CREATE POLICY "Users can update client tab blocks in their workspace"
  ON client_tab_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM client_tabs ct
      JOIN clients c ON c.id = ct.client_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE ct.id = client_tab_blocks.tab_id
      AND wm.user_id = auth.uid()
    )
  );

-- Users can delete blocks for tabs in their workspace
CREATE POLICY "Users can delete client tab blocks in their workspace"
  ON client_tab_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM client_tabs ct
      JOIN clients c ON c.id = ct.client_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE ct.id = client_tab_blocks.tab_id
      AND wm.user_id = auth.uid()
    )
  );

-- 3. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_client_tabs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_tabs_updated_at
  BEFORE UPDATE ON client_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_client_tabs_updated_at();

CREATE TRIGGER client_tab_blocks_updated_at
  BEFORE UPDATE ON client_tab_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_client_tabs_updated_at();

-- 4. Add comments
COMMENT ON TABLE client_tabs IS 'Custom tabs within client detail pages for organizing client-specific information';
COMMENT ON TABLE client_tab_blocks IS 'Content blocks within client tabs (similar to project tab blocks)';
COMMENT ON COLUMN client_tabs.position IS 'Display order of tabs (0-based)';
COMMENT ON COLUMN client_tab_blocks."column" IS 'Column position (0-2 for up to 3 columns)';
COMMENT ON COLUMN client_tab_blocks.position IS 'Vertical position within column';