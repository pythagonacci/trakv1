-- Tags assigned TO the project (e.g. "Q1", "Marketing") – shown on the project, separate from the tag bank.
-- The tag bank (project_tags table) is for tags available when tagging tasks/entities within the project.
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.projects.tags IS 'Tags assigned to this project (labels on the project). Distinct from project_tags table which is the tag bank for tasks.';
