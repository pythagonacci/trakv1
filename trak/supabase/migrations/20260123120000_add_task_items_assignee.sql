-- Add assignee_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_items' AND column_name = 'assignee_id'
  ) THEN
    ALTER TABLE public.task_items ADD COLUMN assignee_id uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'task_items_assignee_id_fkey'
    AND table_name = 'task_items'
  ) THEN
    ALTER TABLE public.task_items
    ADD CONSTRAINT task_items_assignee_id_fkey
    FOREIGN KEY (assignee_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_task_items_assignee
  ON public.task_items (assignee_id);
