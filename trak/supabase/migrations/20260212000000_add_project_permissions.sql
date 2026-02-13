-- Migration: Add project-level permissions
-- Created: 2026-02-12
-- Description: Adds project_members junction table and updates RLS policies to support project-level access control

-- Step 1: Create the project_members junction table
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- Step 2: Add indexes for performance
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);

-- Step 3: Add table comment
COMMENT ON TABLE public.project_members IS 'Project-level access control. If NO rows exist for a project, it is accessible to ALL workspace members (default). If ANY rows exist, only listed users + workspace owner have access.';

-- Step 4: Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS policies for project_members table
-- Allow workspace members to view project members if they have access to the project
CREATE POLICY sel_project_members ON public.project_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_member_of_workspace(p.workspace_id)
    )
  );

-- Only admins and owners can add project members
CREATE POLICY ins_project_members ON public.project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = project_members.project_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Only admins and owners can remove project members
CREATE POLICY del_project_members ON public.project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = project_members.project_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Step 6: Create helper function for permission checking
CREATE OR REPLACE FUNCTION public.can_access_project(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    LEFT JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = auth.uid()
    LEFT JOIN public.workspaces ws ON ws.id = p.workspace_id
    WHERE p.id = project_id_param
      AND wm.user_id = auth.uid()  -- User must be workspace member
      AND (
        -- Case 1: Workspace owner always has access
        ws.owner_id = auth.uid()
        -- Case 2: No project_members rows = accessible to all workspace members
        OR NOT EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p.id)
        -- Case 3: User is explicitly listed in project_members
        OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p.id AND user_id = auth.uid())
      )
  );
$$;

-- Step 7: Update RLS policies for projects table
DROP POLICY IF EXISTS sel_projects ON public.projects;
CREATE POLICY sel_projects ON public.projects
  FOR SELECT
  USING (public.can_access_project(id));

DROP POLICY IF EXISTS upd_projects ON public.projects;
CREATE POLICY upd_projects ON public.projects
  FOR UPDATE
  USING (public.can_access_project(id));

DROP POLICY IF EXISTS del_projects ON public.projects;
CREATE POLICY del_projects ON public.projects
  FOR DELETE
  USING (public.can_access_project(id));

-- Note: ins_projects remains workspace-level (any workspace member can create)
-- The INSERT policy doesn't need to change

-- Step 8: Update RLS policies for tabs (inherit from projects)
DROP POLICY IF EXISTS sel_tabs ON public.tabs;
CREATE POLICY sel_tabs ON public.tabs
  FOR SELECT
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS ins_tabs ON public.tabs;
CREATE POLICY ins_tabs ON public.tabs
  FOR INSERT
  WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS upd_tabs ON public.tabs;
CREATE POLICY upd_tabs ON public.tabs
  FOR UPDATE
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS del_tabs ON public.tabs;
CREATE POLICY del_tabs ON public.tabs
  FOR DELETE
  USING (public.can_access_project(project_id));

-- Step 9: Update blocks RLS (through tabs -> projects)
DROP POLICY IF EXISTS sel_blocks ON public.blocks;
CREATE POLICY sel_blocks ON public.blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = blocks.tab_id
        AND public.can_access_project(t.project_id)
    )
  );

DROP POLICY IF EXISTS ins_blocks ON public.blocks;
CREATE POLICY ins_blocks ON public.blocks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = blocks.tab_id
        AND public.can_access_project(t.project_id)
    )
  );

DROP POLICY IF EXISTS upd_blocks ON public.blocks;
CREATE POLICY upd_blocks ON public.blocks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = blocks.tab_id
        AND public.can_access_project(t.project_id)
    )
  );

DROP POLICY IF EXISTS del_blocks ON public.blocks;
CREATE POLICY del_blocks ON public.blocks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tabs t
      WHERE t.id = blocks.tab_id
        AND public.can_access_project(t.project_id)
    )
  );

-- Migration complete
-- All existing projects remain accessible to all workspace members (backward compatible)
-- New projects can be restricted to specific members during creation
