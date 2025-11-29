-- ============================================================================
-- CLIENT PAGES FEATURE
-- ============================================================================
-- This migration adds support for public, read-only project views for clients

-- 1. Add client page fields to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_page_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

-- Create index for fast public token lookups
CREATE INDEX IF NOT EXISTS idx_projects_public_token ON projects(public_token) WHERE public_token IS NOT NULL;

-- 2. Add client visibility fields to tabs table
ALTER TABLE tabs
ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_title TEXT;

-- Create index for filtering client-visible tabs
CREATE INDEX IF NOT EXISTS idx_tabs_client_visible ON tabs(project_id, is_client_visible) WHERE is_client_visible = TRUE;

-- 3. Create client page views analytics table
CREATE TABLE IF NOT EXISTS client_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  public_token TEXT NOT NULL,
  
  -- Analytics fields
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  referrer TEXT,
  
  -- Session tracking (optional - helps identify unique visitors)
  session_id TEXT,
  
  -- Page metadata
  view_duration_seconds INTEGER, -- Can be updated via client-side tracking
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_client_page_views_project ON client_page_views(project_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_page_views_token ON client_page_views(public_token, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_page_views_session ON client_page_views(session_id) WHERE session_id IS NOT NULL;

-- 4. Function to generate unique public token
CREATE OR REPLACE FUNCTION generate_public_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 32-character token (URL-safe)
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := replace(token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM projects WHERE public_token = token) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- 5. Add comment documentation
COMMENT ON COLUMN projects.client_page_enabled IS 'Whether this project has a public client page enabled';
COMMENT ON COLUMN projects.public_token IS 'Unique token for accessing the public client page';
COMMENT ON COLUMN tabs.is_client_visible IS 'Whether this tab is visible on the public client page';
COMMENT ON COLUMN tabs.client_title IS 'Optional custom title to display on client page (overrides internal tab name)';
COMMENT ON TABLE client_page_views IS 'Analytics tracking for client page views';

-- 6. Enable Row Level Security (RLS) for client page views
ALTER TABLE client_page_views ENABLE ROW LEVEL SECURITY;

-- Policy: Workspace members can view analytics for their projects
CREATE POLICY "Workspace members can view client page analytics"
ON client_page_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = client_page_views.project_id
    AND wm.user_id = auth.uid()
  )
);

-- Policy: Anyone can insert view records (for public tracking)
CREATE POLICY "Anyone can track client page views"
ON client_page_views
FOR INSERT
WITH CHECK (true);

-- 7. Helpful views for analytics

-- View: Client page analytics summary by project
CREATE OR REPLACE VIEW client_page_analytics_summary AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.public_token,
  COUNT(DISTINCT cpv.id) as total_views,
  COUNT(DISTINCT cpv.session_id) as unique_visitors,
  COUNT(DISTINCT cpv.tab_id) as tabs_viewed,
  MAX(cpv.viewed_at) as last_viewed_at,
  AVG(cpv.view_duration_seconds) as avg_duration_seconds
FROM projects p
LEFT JOIN client_page_views cpv ON cpv.project_id = p.id
WHERE p.client_page_enabled = TRUE
GROUP BY p.id, p.name, p.public_token;

COMMENT ON VIEW client_page_analytics_summary IS 'Summary analytics for client pages by project';

-- ============================================================================
-- 8. RLS POLICIES FOR PUBLIC ACCESS
-- ============================================================================

-- Allow public access to projects via public_token
CREATE POLICY IF NOT EXISTS "Public can view projects via public_token"
ON projects
FOR SELECT
USING (
  client_page_enabled = TRUE 
  AND public_token IS NOT NULL
);

-- Allow public access to client-visible tabs
CREATE POLICY IF NOT EXISTS "Public can view client-visible tabs"
ON tabs
FOR SELECT
USING (
  is_client_visible = TRUE
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = tabs.project_id 
    AND projects.client_page_enabled = TRUE
    AND projects.public_token IS NOT NULL
  )
);

-- Allow public access to blocks in client-visible tabs
CREATE POLICY IF NOT EXISTS "Public can view blocks in client-visible tabs"
ON blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tabs
    JOIN projects ON projects.id = tabs.project_id
    WHERE tabs.id = blocks.tab_id
    AND tabs.is_client_visible = TRUE
    AND projects.client_page_enabled = TRUE
    AND projects.public_token IS NOT NULL
  )
);

