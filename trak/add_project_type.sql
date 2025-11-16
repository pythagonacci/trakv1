-- Migration: Add project_type to projects table
-- This allows projects to be either 'project' (client work) or 'internal' (company knowledge)

-- Add project_type column with default 'project'
ALTER TABLE projects 
ADD COLUMN project_type TEXT DEFAULT 'project' CHECK (project_type IN ('project', 'internal'));

-- Add index for faster filtering
CREATE INDEX idx_projects_type ON projects(project_type);

-- Update existing projects to be type 'project'
UPDATE projects SET project_type = 'project' WHERE project_type IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE projects ALTER COLUMN project_type SET NOT NULL;

COMMENT ON COLUMN projects.project_type IS 'Type of project: project (client work) or internal (company knowledge)';

