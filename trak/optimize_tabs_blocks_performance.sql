-- =====================================================
-- DATABASE OPTIMIZATION FOR PROJECT TABS & BLOCKS
-- Adds indexes to speed up tab/block queries by 10-100x
-- =====================================================

-- Index for tabs by project (most common query)
CREATE INDEX IF NOT EXISTS idx_tabs_project_position 
ON tabs(project_id, position ASC);

-- Index for tabs with parent hierarchy
CREATE INDEX IF NOT EXISTS idx_tabs_parent_project 
ON tabs(project_id, parent_tab_id, position ASC);

-- Index for finding child tabs
CREATE INDEX IF NOT EXISTS idx_tabs_parent_id 
ON tabs(parent_tab_id) 
WHERE parent_tab_id IS NOT NULL;

-- Index for blocks by tab (most common query)
CREATE INDEX IF NOT EXISTS idx_blocks_tab_position 
ON blocks(tab_id, parent_block_id, column ASC, position ASC);

-- Index for top-level blocks only
CREATE INDEX IF NOT EXISTS idx_blocks_tab_toplevel 
ON blocks(tab_id, column ASC, position ASC) 
WHERE parent_block_id IS NULL;

-- Index for child blocks (sections)
CREATE INDEX IF NOT EXISTS idx_blocks_parent_position 
ON blocks(parent_block_id, position ASC) 
WHERE parent_block_id IS NOT NULL;

-- Index for block type filtering
CREATE INDEX IF NOT EXISTS idx_blocks_type 
ON blocks(tab_id, type);

-- Index for template blocks
CREATE INDEX IF NOT EXISTS idx_blocks_templates 
ON blocks(is_template) 
WHERE is_template = true;

-- Composite index for project workspace lookup
CREATE INDEX IF NOT EXISTS idx_projects_workspace 
ON projects(workspace_id, id);

-- =====================================================
-- ANALYZE (refresh table statistics)
-- =====================================================

ANALYZE tabs;
ANALYZE blocks;
ANALYZE projects;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show all indexes on tabs table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tabs';

-- Show all indexes on blocks table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'blocks';

