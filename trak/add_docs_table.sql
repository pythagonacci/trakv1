-- Migration: Create docs table for document management
-- This allows users to create Google Docs-style documents within Trak

-- Create docs table
CREATE TABLE IF NOT EXISTS docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  content JSONB DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE
);

-- Add indexes for performance
CREATE INDEX idx_docs_workspace ON docs(workspace_id);
CREATE INDEX idx_docs_created_by ON docs(created_by);
CREATE INDEX idx_docs_updated_at ON docs(updated_at DESC);
CREATE INDEX idx_docs_archived ON docs(is_archived);

-- Enable RLS
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read docs in their workspace
CREATE POLICY "Users can view docs in their workspace"
  ON docs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Users can create docs in their workspace
CREATE POLICY "Users can create docs in their workspace"
  ON docs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Users can update docs in their workspace
CREATE POLICY "Users can update docs in their workspace"
  ON docs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete docs in their workspace
CREATE POLICY "Users can delete docs in their workspace"
  ON docs FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_updated_at
  BEFORE UPDATE ON docs
  FOR EACH ROW
  EXECUTE FUNCTION update_docs_updated_at();

COMMENT ON TABLE docs IS 'Stores rich text documents created within Trak';
COMMENT ON COLUMN docs.content IS 'ProseMirror JSON content from Tiptap editor';

