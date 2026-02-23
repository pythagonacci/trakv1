-- Add priority to projects (same idea as due date: optional field on the project)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL;

COMMENT ON COLUMN public.projects.priority IS 'Project priority: low, medium, high, urgent, or null for none';
