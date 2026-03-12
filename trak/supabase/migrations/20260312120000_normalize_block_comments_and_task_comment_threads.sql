ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_comments_parent_id ON public.task_comments(parent_id);

CREATE TABLE IF NOT EXISTS public.block_comments (
  id text PRIMARY KEY,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  parent_id text REFERENCES public.block_comments(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_external_id text,
  author_name text,
  author_email text,
  text text NOT NULL,
  source text NOT NULL DEFAULT 'internal' CHECK (source IN ('internal', 'external')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_block_comments_block_created_at
  ON public.block_comments(block_id, created_at);

CREATE INDEX IF NOT EXISTS idx_block_comments_parent_id
  ON public.block_comments(parent_id);

DROP TRIGGER IF EXISTS block_comments_set_updated_at ON public.block_comments;
CREATE TRIGGER block_comments_set_updated_at
BEFORE UPDATE ON public.block_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

WITH expanded AS (
  SELECT
    b.id AS block_id,
    comment
  FROM public.blocks b,
  LATERAL jsonb_array_elements(COALESCE(b.content->'_blockComments', '[]'::jsonb)) AS comment
)
INSERT INTO public.block_comments (
  id,
  block_id,
  parent_id,
  author_user_id,
  author_external_id,
  author_name,
  author_email,
  text,
  source,
  created_at,
  updated_at
)
SELECT
  COALESCE(comment->>'id', concat('legacy-comment-', md5(random()::text || clock_timestamp()::text))),
  block_id,
  NULLIF(comment->>'parent_id', ''),
  CASE
    WHEN COALESCE(comment->>'source', 'internal') = 'internal'
      AND NULLIF(comment->>'author_id', '') ~ '^[0-9a-fA-F-]{36}$'
    THEN (comment->>'author_id')::uuid
    ELSE NULL
  END,
  CASE
    WHEN COALESCE(comment->>'source', 'internal') = 'external'
    THEN NULLIF(comment->>'author_id', '')
    ELSE NULL
  END,
  NULLIF(comment->>'author_name', ''),
  NULLIF(comment->>'author_email', ''),
  COALESCE(comment->>'text', ''),
  COALESCE(comment->>'source', 'internal'),
  COALESCE((comment->>'timestamp')::timestamptz, now()),
  COALESCE((comment->>'timestamp')::timestamptz, now())
FROM expanded
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.block_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block comments visible to workspace members"
ON public.block_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.blocks b
    JOIN public.tabs t ON t.id = b.tab_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE b.id = block_comments.block_id
      AND public.is_member_of_workspace(p.workspace_id)
  )
);

CREATE POLICY "Block comments insertable by workspace members"
ON public.block_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.blocks b
    JOIN public.tabs t ON t.id = b.tab_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE b.id = block_comments.block_id
      AND public.is_member_of_workspace(p.workspace_id)
  )
);

CREATE POLICY "Block comments updatable by workspace members"
ON public.block_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.blocks b
    JOIN public.tabs t ON t.id = b.tab_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE b.id = block_comments.block_id
      AND public.is_member_of_workspace(p.workspace_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.blocks b
    JOIN public.tabs t ON t.id = b.tab_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE b.id = block_comments.block_id
      AND public.is_member_of_workspace(p.workspace_id)
  )
);

CREATE POLICY "Block comments deletable by workspace members"
ON public.block_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.blocks b
    JOIN public.tabs t ON t.id = b.tab_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE b.id = block_comments.block_id
      AND public.is_member_of_workspace(p.workspace_id)
  )
);
