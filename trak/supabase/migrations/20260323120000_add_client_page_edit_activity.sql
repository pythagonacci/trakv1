CREATE TABLE IF NOT EXISTS public.client_page_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tab_id uuid REFERENCES public.tabs(id) ON DELETE SET NULL,
  block_id uuid REFERENCES public.blocks(id) ON DELETE SET NULL,
  visitor_id text NOT NULL,
  visitor_name text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_page_edits_workspace_created_at
  ON public.client_page_edits(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_page_edits_project_created_at
  ON public.client_page_edits(project_id, created_at DESC);

ALTER TABLE public.client_page_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client page edits visible to workspace members"
ON public.client_page_edits
FOR SELECT
USING (
  public.is_member_of_workspace(workspace_id)
);

COMMENT ON TABLE public.client_page_edits IS 'Audit trail for edits made through public client magic links.';
COMMENT ON COLUMN public.client_page_edits.summary IS 'Human-readable summary shown in dashboard feedback surfaces.';
