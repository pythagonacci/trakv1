-- Add edited flag to track when snapshots have been modified
-- This replaces complex field comparison logic with a simple boolean

-- 1. Add edited column to table_rows
ALTER TABLE public.table_rows
  ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;

-- 2. Add edited column to task_items
ALTER TABLE public.task_items
  ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;

-- 3. Add edited column to timeline_events
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;

-- 4. Create indexes for efficient snapshot queries
-- These indexes help filter: "source_entity_id IS NOT NULL AND edited = true"
CREATE INDEX IF NOT EXISTS idx_table_rows_edited
  ON public.table_rows(edited)
  WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_items_edited
  ON public.task_items(edited)
  WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_events_edited
  ON public.timeline_events(edited)
  WHERE source_entity_id IS NOT NULL;

-- 5. Add comments explaining the edited flag
COMMENT ON COLUMN public.table_rows.edited IS
  'Tracks whether this snapshot has been modified by the user. Always false for original data (source_entity_id IS NULL). Set to true when user edits a snapshot.';

COMMENT ON COLUMN public.task_items.edited IS
  'Tracks whether this snapshot has been modified by the user. Always false for original data (source_entity_id IS NULL). Set to true when user edits a snapshot.';

COMMENT ON COLUMN public.timeline_events.edited IS
  'Tracks whether this snapshot has been modified by the user. Always false for original data (source_entity_id IS NULL). Set to true when user edits a snapshot.';
