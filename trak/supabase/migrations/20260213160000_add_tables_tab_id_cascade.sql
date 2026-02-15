-- Add tab_id to tables table for proper cascade deletion
-- When a workflow page (tab) is deleted, all tables associated with that tab should be deleted

-- 1. Add the tab_id column (nullable for existing tables)
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS tab_id uuid REFERENCES public.tabs(id) ON DELETE CASCADE;

-- 2. Create an index for better query performance
CREATE INDEX IF NOT EXISTS tables_tab_id_idx ON public.tables(tab_id);

-- 3. Note: We're NOT adding a check constraint yet because existing tables might have both NULL
-- After migration, new tables created by the AI will have tab_id set
-- Existing tables without project_id or tab_id can be cleaned up separately if needed
