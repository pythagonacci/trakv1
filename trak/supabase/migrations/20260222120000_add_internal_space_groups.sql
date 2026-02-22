-- Internal space groups: group internal spaces (project_type = 'internal') into named groups.

CREATE TABLE IF NOT EXISTS public.internal_space_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_space_groups_workspace_id ON public.internal_space_groups(workspace_id);

COMMENT ON TABLE public.internal_space_groups IS 'Groups for organizing internal spaces on the Internal page.';

-- Add internal_group_id to projects (used only when project_type = 'internal')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'internal_group_id') THEN
      ALTER TABLE public.projects
        ADD COLUMN internal_group_id UUID REFERENCES public.internal_space_groups(id) ON DELETE SET NULL;
      CREATE INDEX idx_projects_internal_group_id ON public.projects(internal_group_id);
    END IF;
  END IF;
END $$;
