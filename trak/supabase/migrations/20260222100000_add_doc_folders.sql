-- Doc folders: group documents into folders (same pattern as project_folders).

CREATE TABLE IF NOT EXISTS public.doc_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_folders_workspace_id ON public.doc_folders(workspace_id);

COMMENT ON TABLE public.doc_folders IS 'Folders for grouping docs in the docs list.';

-- Add folder_id to docs if the table exists (docs may be created elsewhere)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'docs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'docs' AND column_name = 'folder_id') THEN
      ALTER TABLE public.docs
        ADD COLUMN folder_id UUID REFERENCES public.doc_folders(id) ON DELETE SET NULL;
      CREATE INDEX idx_docs_folder_id ON public.docs(folder_id);
    END IF;
  END IF;
END $$;
