-- Migration: Add project-level tag bank
-- Each project has its own set of tags; used when creating a project and when adding tags in the properties modal.

CREATE TABLE IF NOT EXISTS public.project_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON public.project_tags(project_id);
-- Case-insensitive unique tag name per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_tags_project_id_name_lower ON public.project_tags (project_id, lower(trim(name)));

COMMENT ON TABLE public.project_tags IS 'Tag bank per project. Tags created in project create modal or when adding a tag in the properties modal (for entities in that project) are stored here.';

ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent re-run)
DROP POLICY IF EXISTS sel_project_tags ON public.project_tags;
DROP POLICY IF EXISTS ins_project_tags ON public.project_tags;
DROP POLICY IF EXISTS del_project_tags ON public.project_tags;

-- Select: user can see tags for projects they can access
CREATE POLICY sel_project_tags ON public.project_tags
  FOR SELECT
  USING (public.can_access_project(project_id));

-- Insert: user can add tags to projects they can access
CREATE POLICY ins_project_tags ON public.project_tags
  FOR INSERT
  WITH CHECK (public.can_access_project(project_id));

-- Delete: user can remove tags from projects they can access (e.g. when cleaning up)
CREATE POLICY del_project_tags ON public.project_tags
  FOR DELETE
  USING (public.can_access_project(project_id));
