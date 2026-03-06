-- Add parent_id to file_comments for threaded replies
ALTER TABLE public.file_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.file_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_file_comments_parent_id ON public.file_comments(parent_id);
