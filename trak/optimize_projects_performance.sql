-- =====================================================
-- DATABASE OPTIMIZATION FOR PROJECTS DASHBOARD
-- Adds indexes to speed up queries by 10-100x
-- =====================================================

-- Index for projects filtered by workspace + project_type (most common query)
CREATE INDEX IF NOT EXISTS idx_projects_workspace_type 
ON projects(workspace_id, project_type) 
WHERE project_type = 'project';

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_projects_status 
ON projects(workspace_id, status);

-- Index for filtering by client
CREATE INDEX IF NOT EXISTS idx_projects_client 
ON projects(workspace_id, client_id);

-- Index for sorting by created_at (most common sort)
CREATE INDEX IF NOT EXISTS idx_projects_created_at 
ON projects(workspace_id, created_at DESC);

-- Index for sorting by updated_at
CREATE INDEX IF NOT EXISTS idx_projects_updated_at 
ON projects(workspace_id, updated_at DESC);

-- Index for sorting by name (text search)
CREATE INDEX IF NOT EXISTS idx_projects_name 
ON projects(workspace_id, name);

-- Index for due date sorting
CREATE INDEX IF NOT EXISTS idx_projects_due_date 
ON projects(workspace_id, due_date_date DESC NULLS LAST);

-- Composite index for the most common filter combination
CREATE INDEX IF NOT EXISTS idx_projects_workspace_type_status 
ON projects(workspace_id, project_type, status, created_at DESC);

-- Index for workspace members lookup (speeds up auth checks)
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user 
ON workspace_members(workspace_id, user_id);

-- Index for clients by workspace
CREATE INDEX IF NOT EXISTS idx_clients_workspace 
ON clients(workspace_id, name);

-- =====================================================
-- ANALYZE (refresh table statistics)
-- Helps PostgreSQL optimize query plans
-- =====================================================

ANALYZE projects;
ANALYZE workspace_members;
ANALYZE clients;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify indexes were created
-- =====================================================

-- Show all indexes on projects table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'projects';

-- Show all indexes on workspace_members table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'workspace_members';

-- Show all indexes on clients table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'clients';

