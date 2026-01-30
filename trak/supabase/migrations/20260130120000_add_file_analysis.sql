-- File Analysis: sessions, messages, artifacts, chunks, citations, and file comments

-- Sessions (per user + scope)
CREATE TABLE IF NOT EXISTS public.file_analysis_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  project_id uuid,
  tab_id uuid,
  user_id uuid NOT NULL,
  scope_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_message_at timestamp with time zone,
  CONSTRAINT file_analysis_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT file_analysis_sessions_scope_check CHECK (scope_type IN ('tab', 'project', 'workspace'))
);

-- Messages
CREATE TABLE IF NOT EXISTS public.file_analysis_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT file_analysis_messages_pkey PRIMARY KEY (id),
  CONSTRAINT file_analysis_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

-- Session-scoped file uploads
CREATE TABLE IF NOT EXISTS public.file_analysis_session_files (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  file_id uuid NOT NULL,
  source text DEFAULT 'upload' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT file_analysis_session_files_pkey PRIMARY KEY (id),
  CONSTRAINT file_analysis_session_files_source_check CHECK (source IN ('upload', 'mention', 'attached'))
);

-- Extracted artifacts per file
CREATE TABLE IF NOT EXISTS public.file_analysis_artifacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  file_id uuid NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  extracted_text text,
  extracted_tables jsonb,
  page_count integer,
  row_count integer,
  column_count integer,
  token_estimate integer,
  error text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT file_analysis_artifacts_pkey PRIMARY KEY (id),
  CONSTRAINT file_analysis_artifacts_status_check CHECK (status IN ('pending', 'processing', 'ready', 'error'))
);

-- Chunk + embedding index
CREATE TABLE IF NOT EXISTS public.file_analysis_chunks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  artifact_id uuid NOT NULL,
  file_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_count integer,
  embedding float8[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT file_analysis_chunks_pkey PRIMARY KEY (id)
);

-- Citations per assistant message
CREATE TABLE IF NOT EXISTS public.file_analysis_citations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  message_id uuid NOT NULL,
  file_id uuid NOT NULL,
  chunk_id uuid,
  page_number integer,
  row_start integer,
  row_end integer,
  excerpt text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT file_analysis_citations_pkey PRIMARY KEY (id)
);

-- File comments (AI analysis summaries)
CREATE TABLE IF NOT EXISTS public.file_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  file_id uuid NOT NULL,
  user_id uuid NOT NULL,
  analysis_message_id uuid,
  text text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT file_comments_pkey PRIMARY KEY (id)
);

-- Foreign keys (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_sessions_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_sessions
      ADD CONSTRAINT file_analysis_sessions_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_sessions_project_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_sessions
      ADD CONSTRAINT file_analysis_sessions_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_sessions_tab_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_sessions
      ADD CONSTRAINT file_analysis_sessions_tab_id_fkey
      FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_sessions
      ADD CONSTRAINT file_analysis_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_messages_session_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_messages
      ADD CONSTRAINT file_analysis_messages_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.file_analysis_sessions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_session_files_session_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_session_files
      ADD CONSTRAINT file_analysis_session_files_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.file_analysis_sessions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_session_files_file_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_session_files
      ADD CONSTRAINT file_analysis_session_files_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_artifacts_file_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_artifacts
      ADD CONSTRAINT file_analysis_artifacts_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_chunks_artifact_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_chunks
      ADD CONSTRAINT file_analysis_chunks_artifact_id_fkey
      FOREIGN KEY (artifact_id) REFERENCES public.file_analysis_artifacts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_chunks_file_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_chunks
      ADD CONSTRAINT file_analysis_chunks_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_citations_message_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_citations
      ADD CONSTRAINT file_analysis_citations_message_id_fkey
      FOREIGN KEY (message_id) REFERENCES public.file_analysis_messages(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_citations_file_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_citations
      ADD CONSTRAINT file_analysis_citations_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_analysis_citations_chunk_id_fkey'
  ) THEN
    ALTER TABLE public.file_analysis_citations
      ADD CONSTRAINT file_analysis_citations_chunk_id_fkey
      FOREIGN KEY (chunk_id) REFERENCES public.file_analysis_chunks(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_comments_file_id_fkey'
  ) THEN
    ALTER TABLE public.file_comments
      ADD CONSTRAINT file_comments_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_comments_user_id_fkey'
  ) THEN
    ALTER TABLE public.file_comments
      ADD CONSTRAINT file_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'file_comments_analysis_message_id_fkey'
  ) THEN
    ALTER TABLE public.file_comments
      ADD CONSTRAINT file_comments_analysis_message_id_fkey
      FOREIGN KEY (analysis_message_id) REFERENCES public.file_analysis_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_analysis_sessions_user_tab
  ON public.file_analysis_sessions (user_id, tab_id)
  WHERE tab_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_analysis_sessions_user_project
  ON public.file_analysis_sessions (user_id, project_id)
  WHERE tab_id IS NULL AND project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_analysis_sessions_user_workspace
  ON public.file_analysis_sessions (user_id, workspace_id)
  WHERE tab_id IS NULL AND project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_file_analysis_messages_session
  ON public.file_analysis_messages (session_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_analysis_session_files_unique
  ON public.file_analysis_session_files (session_id, file_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_analysis_artifacts_file
  ON public.file_analysis_artifacts (file_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_analysis_chunks_artifact_index
  ON public.file_analysis_chunks (artifact_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_file_analysis_chunks_file
  ON public.file_analysis_chunks (file_id);

CREATE INDEX IF NOT EXISTS idx_file_analysis_citations_message
  ON public.file_analysis_citations (message_id);

CREATE INDEX IF NOT EXISTS idx_file_comments_file
  ON public.file_comments (file_id, created_at);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_file_analysis_sessions'
  ) THEN
    CREATE TRIGGER set_updated_at_file_analysis_sessions
      BEFORE UPDATE ON public.file_analysis_sessions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_file_analysis_artifacts'
  ) THEN
    CREATE TRIGGER set_updated_at_file_analysis_artifacts
      BEFORE UPDATE ON public.file_analysis_artifacts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_file_comments'
  ) THEN
    CREATE TRIGGER set_updated_at_file_comments
      BEFORE UPDATE ON public.file_comments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.file_analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_analysis_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_analysis_session_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_analysis_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_analysis_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_analysis_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_comments ENABLE ROW LEVEL SECURITY;

-- Policies: sessions
CREATE POLICY sel_file_analysis_sessions ON public.file_analysis_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    AND public.is_member_of_workspace(workspace_id)
  );

CREATE POLICY ins_file_analysis_sessions ON public.file_analysis_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.is_member_of_workspace(workspace_id)
  );

CREATE POLICY upd_file_analysis_sessions ON public.file_analysis_sessions
  FOR UPDATE USING (
    user_id = auth.uid()
    AND public.is_member_of_workspace(workspace_id)
  );

CREATE POLICY del_file_analysis_sessions ON public.file_analysis_sessions
  FOR DELETE USING (
    user_id = auth.uid()
    AND public.is_member_of_workspace(workspace_id)
  );

-- Policies: messages
CREATE POLICY sel_file_analysis_messages ON public.file_analysis_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_messages.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY ins_file_analysis_messages ON public.file_analysis_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_messages.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY upd_file_analysis_messages ON public.file_analysis_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_messages.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY del_file_analysis_messages ON public.file_analysis_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_messages.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

-- Policies: session files
CREATE POLICY sel_file_analysis_session_files ON public.file_analysis_session_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_session_files.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY ins_file_analysis_session_files ON public.file_analysis_session_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_session_files.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY del_file_analysis_session_files ON public.file_analysis_session_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.file_analysis_sessions s
      WHERE s.id = file_analysis_session_files.session_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

-- Policies: artifacts
CREATE POLICY sel_file_analysis_artifacts ON public.file_analysis_artifacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_analysis_artifacts.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

CREATE POLICY ins_file_analysis_artifacts ON public.file_analysis_artifacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_analysis_artifacts.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

CREATE POLICY upd_file_analysis_artifacts ON public.file_analysis_artifacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_analysis_artifacts.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

-- Policies: chunks
CREATE POLICY sel_file_analysis_chunks ON public.file_analysis_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_analysis_chunks.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

CREATE POLICY ins_file_analysis_chunks ON public.file_analysis_chunks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_analysis_chunks.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

-- Policies: citations
CREATE POLICY sel_file_analysis_citations ON public.file_analysis_citations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.file_analysis_messages m
      JOIN public.file_analysis_sessions s ON s.id = m.session_id
      WHERE m.id = file_analysis_citations.message_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

CREATE POLICY ins_file_analysis_citations ON public.file_analysis_citations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.file_analysis_messages m
      JOIN public.file_analysis_sessions s ON s.id = m.session_id
      WHERE m.id = file_analysis_citations.message_id
        AND s.user_id = auth.uid()
        AND public.is_member_of_workspace(s.workspace_id)
    )
  );

-- Policies: file comments
CREATE POLICY sel_file_comments ON public.file_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_comments.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

CREATE POLICY ins_file_comments ON public.file_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_comments.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

CREATE POLICY upd_file_comments ON public.file_comments
  FOR UPDATE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_comments.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );

CREATE POLICY del_file_comments ON public.file_comments
  FOR DELETE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.id = file_comments.file_id
        AND public.is_member_of_workspace(f.workspace_id)
    )
  );
