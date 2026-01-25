-- Fix task_assignees table to support external assignees (name-only)
-- and ensure name is always populated

-- Step 1: Drop the existing primary key constraint
ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_pkey;

-- Step 2: Make assignee_id nullable to support external assignees
ALTER TABLE public.task_assignees
  ALTER COLUMN assignee_id DROP NOT NULL;

-- Step 3: Add a new primary key that works with nullable assignee_id
-- We'll use task_id + COALESCE(assignee_id, assignee_name) for uniqueness
-- Since we can't use COALESCE in a primary key, we'll use a unique constraint instead
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_unique_assignee
  UNIQUE (task_id, assignee_id, assignee_name);

-- Step 4: Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id
  ON public.task_assignees (task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee_id
  ON public.task_assignees (assignee_id)
  WHERE assignee_id IS NOT NULL;

-- Step 5: Add a check constraint to ensure at least assignee_id or assignee_name exists
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_has_identifier
  CHECK (assignee_id IS NOT NULL OR (assignee_name IS NOT NULL AND length(trim(assignee_name)) > 0));

-- Step 6: Update any existing rows that might have issues (if any)
-- Set a default name if assignee_name is null but assignee_id exists
UPDATE public.task_assignees
SET assignee_name = COALESCE(
  (SELECT COALESCE(p.name, p.email, 'Unknown')
   FROM profiles p
   WHERE p.id = task_assignees.assignee_id),
  'Unknown'
)
WHERE assignee_name IS NULL OR trim(assignee_name) = '';
