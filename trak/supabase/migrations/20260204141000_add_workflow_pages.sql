-- Workflow Pages: tabs flag/metadata, workspace analysis project, and persistent workflow AI sessions

-- ---------------------------------------------------------------------------
-- Tabs: workflow page flag + metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS is_workflow_page boolean DEFAULT false NOT NULL;

ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS workflow_metadata jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tabs_workflow_pages
  ON public.tabs (project_id, is_workflow_page)
  WHERE is_workflow_page = true;

-- ---------------------------------------------------------------------------
-- Projects: workspace-level analysis project marker + helper
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_workspace_analysis_project boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_workspace_analysis_unique
  ON public.projects (workspace_id)
  WHERE is_workspace_analysis_project = true;

CREATE OR REPLACE FUNCTION public.get_or_create_workspace_analysis_project(p_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT id
    INTO v_project_id
  FROM public.projects
  WHERE workspace_id = p_workspace_id
    AND is_workspace_analysis_project = true
  LIMIT 1;

  IF v_project_id IS NOT NULL THEN
    RETURN v_project_id;
  END IF;

  BEGIN
    INSERT INTO public.projects (workspace_id, name, project_type, is_workspace_analysis_project)
    VALUES (p_workspace_id, 'Workspace Analysis', 'internal', true)
    RETURNING id INTO v_project_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id
      INTO v_project_id
    FROM public.projects
    WHERE workspace_id = p_workspace_id
      AND is_workspace_analysis_project = true
    LIMIT 1;
  END;

  RETURN v_project_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Workflow AI persistence: sessions + messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workflow_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  tab_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_message_at timestamp with time zone,
  CONSTRAINT workflow_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT unique_workflow_session_per_tab UNIQUE (tab_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_block_ids uuid[] DEFAULT ARRAY[]::uuid[],
  CONSTRAINT workflow_messages_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

-- Foreign keys (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflow_sessions_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_sessions
      ADD CONSTRAINT workflow_sessions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflow_sessions_tab_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_sessions
      ADD CONSTRAINT workflow_sessions_tab_id_fkey
      FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflow_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_sessions
      ADD CONSTRAINT workflow_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflow_messages_session_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_messages
      ADD CONSTRAINT workflow_messages_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.workflow_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_workspace
  ON public.workflow_sessions (workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_sessions_tab
  ON public.workflow_sessions (tab_id);

CREATE INDEX IF NOT EXISTS idx_workflow_messages_session
  ON public.workflow_messages (session_id, created_at);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_workflow_sessions'
  ) THEN
    CREATE TRIGGER set_updated_at_workflow_sessions
      BEFORE UPDATE ON public.workflow_sessions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_messages ENABLE ROW LEVEL SECURITY;

-- Policies: sessions (workspace members can access)
CREATE POLICY sel_workflow_sessions ON public.workflow_sessions
  FOR SELECT USING (
    public.is_member_of_workspace(workspace_id)
  );

CREATE POLICY ins_workflow_sessions ON public.workflow_sessions
  FOR INSERT WITH CHECK (
    public.is_member_of_workspace(workspace_id)
    AND user_id = auth.uid()
  );

CREATE POLICY upd_workflow_sessions ON public.workflow_sessions
  FOR UPDATE USING (
    public.is_member_of_workspace(workspace_id)
  );

CREATE POLICY del_workflow_sessions ON public.workflow_sessions
  FOR DELETE USING (
    public.is_member_of_workspace(workspace_id)
  );

-- Policies: messages (via owning session's workspace)
CREATE POLICY sel_workflow_messages ON public.workflow_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workflow_sessions s
      WHERE s.id = workflow_messages.session_id
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY ins_workflow_messages ON public.workflow_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflow_sessions s
      WHERE s.id = workflow_messages.session_id
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY upd_workflow_messages ON public.workflow_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workflow_sessions s
      WHERE s.id = workflow_messages.session_id
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY del_workflow_messages ON public.workflow_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workflow_sessions s
      WHERE s.id = workflow_messages.session_id
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );
