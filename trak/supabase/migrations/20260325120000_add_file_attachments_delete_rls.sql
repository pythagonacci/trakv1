-- Allow workspace members to remove a file from a block (detach attachment).
-- Previously only INSERT and SELECT existed on file_attachments, so DELETE always failed under RLS.

CREATE POLICY del_file_attachments ON public.file_attachments FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM public.blocks b
    JOIN public.tabs t ON t.id = b.tab_id
    JOIN public.projects p ON p.id = t.project_id
    WHERE b.id = file_attachments.block_id
      AND public.is_member_of_workspace(p.workspace_id)
  )
);
