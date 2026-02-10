-- Block references: attach linkable items (docs, tasks, blocks, etc.) to any block
CREATE TABLE IF NOT EXISTS public.block_references (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  reference_type text NOT NULL CHECK (reference_type IN ('doc', 'table_row', 'task', 'block')),
  reference_id uuid NOT NULL,
  -- When reference_type = 'table_row', reference_id is the row id; table_id identifies which table that row belongs to (for lookups/joins). Null for doc/task/block refs.
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_block_references_block ON public.block_references(block_id);
CREATE INDEX IF NOT EXISTS idx_block_references_workspace ON public.block_references(workspace_id);
CREATE INDEX IF NOT EXISTS idx_block_references_target ON public.block_references(reference_type, reference_id);

CREATE TRIGGER block_references_set_updated_at
  BEFORE UPDATE ON public.block_references
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.block_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block references visible to workspace members"
  ON public.block_references FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Block references insertable by workspace members"
  ON public.block_references FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Block references updatable by workspace members"
  ON public.block_references FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Block references deletable by workspace members"
  ON public.block_references FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

GRANT ALL ON TABLE public.block_references TO anon;
GRANT ALL ON TABLE public.block_references TO authenticated;
GRANT ALL ON TABLE public.block_references TO service_role;
