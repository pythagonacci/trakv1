-- Upgrade task_items to use universal source tracking
-- This allows tasks to be snapshots of timeline events, other tasks, or any entity
-- Replaces the old source_task_id with source_entity_type + source_entity_id

-- 1. Add new universal source tracking columns
ALTER TABLE public.task_items
  ADD COLUMN IF NOT EXISTS source_entity_type text,
  ADD COLUMN IF NOT EXISTS source_entity_id uuid;

-- 2. Migrate existing source_task_id data to new columns
UPDATE public.task_items
SET
  source_entity_type = 'task',
  source_entity_id = source_task_id
WHERE source_task_id IS NOT NULL;

-- 3. Add constraint: source metadata must be complete or all NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_items'
      AND constraint_name = 'task_items_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.task_items
      ADD CONSTRAINT task_items_source_metadata_consistency
      CHECK (
        -- Either no source metadata at all
        (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
        OR
        -- Or complete source metadata
        (
          source_entity_type IN ('task', 'timeline_event')
          AND source_entity_id IS NOT NULL
          AND source_sync_mode IN ('snapshot', 'live')
        )
      );
  END IF;
END $$;

-- 4. Create index for efficient source entity lookups
CREATE INDEX IF NOT EXISTS idx_task_items_source_entity
  ON public.task_items(source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

-- 5. Note: We keep source_task_id for backward compatibility
-- New code should use source_entity_type + source_entity_id
-- Old code can continue using source_task_id
COMMENT ON COLUMN public.task_items.source_task_id IS
  'DEPRECATED: Use source_entity_type + source_entity_id instead. Kept for backward compatibility.';
