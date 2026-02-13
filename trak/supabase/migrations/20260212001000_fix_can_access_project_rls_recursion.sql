-- Migration: Fix recursive projects RLS introduced by project permissions migration
-- Created: 2026-02-12
-- Description: Replaces project access function/policies with a non-recursive variant.

-- Two-arg variant that does NOT query projects (safe inside projects policies).
CREATE OR REPLACE FUNCTION public.can_access_project(project_id_param UUID, workspace_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.is_member_of_workspace(workspace_id_param)
    AND (
      -- Workspace owner always has access.
      EXISTS (
        SELECT 1
        FROM public.workspaces ws
        WHERE ws.id = workspace_id_param
          AND ws.owner_id = auth.uid()
      )
      -- No explicit project members => open to all workspace members.
      OR NOT EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = project_id_param
      )
      -- Explicit member access.
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = project_id_param
          AND pm.user_id = auth.uid()
      )
    );
$$;

-- One-arg wrapper retained for compatibility in tabs/blocks policies.
-- It queries projects, but projects policies now call the non-recursive two-arg variant.
CREATE OR REPLACE FUNCTION public.can_access_project(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id_param
      AND public.can_access_project(p.id, p.workspace_id)
  );
$$;

-- Recreate project policies to call the non-recursive function directly.
DROP POLICY IF EXISTS sel_projects ON public.projects;
CREATE POLICY sel_projects ON public.projects
  FOR SELECT
  USING (public.can_access_project(id, workspace_id));

DROP POLICY IF EXISTS upd_projects ON public.projects;
CREATE POLICY upd_projects ON public.projects
  FOR UPDATE
  USING (public.can_access_project(id, workspace_id));

DROP POLICY IF EXISTS del_projects ON public.projects;
CREATE POLICY del_projects ON public.projects
  FOR DELETE
  USING (public.can_access_project(id, workspace_id));
