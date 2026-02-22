-- Workspace teams: named groups of workspace members for assignment.

CREATE TABLE IF NOT EXISTS public.workspace_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_teams_workspace_id ON public.workspace_teams(workspace_id);

COMMENT ON TABLE public.workspace_teams IS 'Teams are groups of workspace members; used when assigning to tasks/items.';

-- Team membership: which workspace members (user_id) belong to which team.
CREATE TABLE IF NOT EXISTS public.workspace_team_members (
  team_id UUID NOT NULL REFERENCES public.workspace_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_workspace_team_members_team_id ON public.workspace_team_members(team_id);
CREATE INDEX idx_workspace_team_members_user_id ON public.workspace_team_members(user_id);

COMMENT ON TABLE public.workspace_team_members IS 'Junction: workspace members (user_id) in each team.';
