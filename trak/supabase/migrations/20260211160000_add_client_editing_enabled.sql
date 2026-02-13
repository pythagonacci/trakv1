-- Add client_editing_enabled column to projects table
-- This allows project owners to grant editing permissions to client page visitors

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_editing_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN projects.client_editing_enabled IS 'Allow visitors with the public link to edit blocks and content';

-- Update existing projects to have editing disabled by default (already handled by DEFAULT false)
UPDATE projects
SET client_editing_enabled = false
WHERE client_editing_enabled IS NULL;
