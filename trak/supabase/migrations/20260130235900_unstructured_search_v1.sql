-- Unstructured Search & Indexing (RAG v1)
CREATE EXTENSION IF NOT EXISTS vector;


-- 1. Unstructured Parents (The "Source" of truth)
-- Stores metadata and summaries for any workspace object (File, Block, Note, etc.)
CREATE TABLE IF NOT EXISTS public.unstructured_parents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  tab_id uuid REFERENCES public.tabs(id) ON DELETE CASCADE,
  
  -- Polymorphic Info
  source_type text NOT NULL, -- 'file', 'block', 'note', 'comment_thread'
  source_id uuid NOT NULL,   -- The ID of the original row in files/blocks etc.
  
  -- Search Metadata
  summary text,              -- 1-2 sentence generated summary of the content
  summary_embedding float8[], -- vector(1536) for Parent Gating
  
  -- Sync State
  content_hash text,         -- Hash of the full content to skip redundant processing
  last_indexed_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT unstructured_parents_pkey PRIMARY KEY (id),
  CONSTRAINT unstructured_parents_source_unique UNIQUE (source_id, source_type)
);

-- 2. Unstructured Chunks (The "Evidence")
-- Stores the actual retrievable text snippets
CREATE TABLE IF NOT EXISTS public.unstructured_chunks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parent_id uuid NOT NULL REFERENCES public.unstructured_parents(id) ON DELETE CASCADE,
  
  chunk_index integer NOT NULL,
  content text NOT NULL,
  
  -- Search Data
  embedding float8[], -- vector(1536)
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unstructured_chunks_pkey PRIMARY KEY (id)
);

-- 3. Indexing Jobs (The "Queue")
-- Lightweight DB queue for processing ingestion
CREATE TABLE IF NOT EXISTS public.indexing_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  resource_type text NOT NULL, -- 'file', 'block'
  resource_id uuid NOT NULL,
  
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer DEFAULT 0,
  error_message text,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  CONSTRAINT indexing_jobs_pkey PRIMARY KEY (id)
);

-- Indexes

-- Parents: lookup by source (for updates)
CREATE INDEX IF NOT EXISTS idx_unstructured_parents_source ON public.unstructured_parents(source_id, source_type);
-- Parents: workspace filtering
CREATE INDEX IF NOT EXISTS idx_unstructured_parents_workspace ON public.unstructured_parents(workspace_id);

-- Chunks: fts
CREATE INDEX IF NOT EXISTS idx_unstructured_chunks_fts ON public.unstructured_chunks USING GIN (fts);
-- Chunks: lookup by parent
CREATE INDEX IF NOT EXISTS idx_unstructured_chunks_parent ON public.unstructured_chunks(parent_id);

-- Jobs: queue processing (find pending jobs)
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_processing ON public.indexing_jobs(status, created_at) WHERE status = 'pending';

-- RLS Policies

-- Enable RLS
ALTER TABLE public.unstructured_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unstructured_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indexing_jobs ENABLE ROW LEVEL SECURITY;

-- Parents
DROP POLICY IF EXISTS sel_unstructured_parents ON public.unstructured_parents;
CREATE POLICY sel_unstructured_parents ON public.unstructured_parents
  FOR SELECT USING (public.is_member_of_workspace(workspace_id));

DROP POLICY IF EXISTS all_unstructured_parents ON public.unstructured_parents;
CREATE POLICY all_unstructured_parents ON public.unstructured_parents
  FOR ALL USING (public.is_member_of_workspace(workspace_id));

-- Chunks (inherit access via parent -> workspace)
-- Chunks (inherit access via parent -> workspace)
DROP POLICY IF EXISTS sel_unstructured_chunks ON public.unstructured_chunks;
CREATE POLICY sel_unstructured_chunks ON public.unstructured_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.unstructured_parents p
      WHERE p.id = unstructured_chunks.parent_id
      AND public.is_member_of_workspace(p.workspace_id)
    )
  );

DROP POLICY IF EXISTS all_unstructured_chunks ON public.unstructured_chunks;
CREATE POLICY all_unstructured_chunks ON public.unstructured_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.unstructured_parents p
      WHERE p.id = unstructured_chunks.parent_id
      AND public.is_member_of_workspace(p.workspace_id)
    )
  );

-- Jobs
-- Jobs
DROP POLICY IF EXISTS all_indexing_jobs ON public.indexing_jobs;
CREATE POLICY all_indexing_jobs ON public.indexing_jobs
  FOR ALL USING (public.is_member_of_workspace(workspace_id));

-- Trigger for job updated_at
CREATE OR REPLACE TRIGGER set_updated_at_indexing_jobs
  BEFORE UPDATE ON public.indexing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
