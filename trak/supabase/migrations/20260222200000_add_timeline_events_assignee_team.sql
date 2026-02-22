-- Allow timeline events to be assigned to a workspace team (in addition to or instead of a user).

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS assignee_team_id UUID REFERENCES public.workspace_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_events_assignee_team_id
  ON public.timeline_events(assignee_team_id)
  WHERE assignee_team_id IS NOT NULL;

COMMENT ON COLUMN public.timeline_events.assignee_team_id IS 'When set, the event is assigned to this workspace team (assignee_id is ignored for display).';
