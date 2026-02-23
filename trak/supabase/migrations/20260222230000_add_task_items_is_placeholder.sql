-- Add is_placeholder to task_items so the default "New task" in new task blocks
-- can be excluded from search/Everything until the user edits the task or block.

ALTER TABLE public.task_items
  ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.task_items.is_placeholder IS
  'True for the initial empty task in a new task block; cleared on first edit so it does not pollute search.';
