-- Fix source_sync_mode to only apply when source entity exists
-- Previously, ALL rows had source_sync_mode='snapshot' even when they had no source entity
-- This migration makes source_sync_mode nullable and only sets it when there's a source entity

-- 1. Drop the NOT NULL constraint
ALTER TABLE public.table_rows
  ALTER COLUMN source_sync_mode DROP NOT NULL;

-- 2. Remove the default value
ALTER TABLE public.table_rows
  ALTER COLUMN source_sync_mode DROP DEFAULT;

-- 3. Set source_sync_mode to NULL for rows without a source entity
UPDATE public.table_rows
SET source_sync_mode = NULL
WHERE source_entity_type IS NULL AND source_entity_id IS NULL;

-- 4. Update the constraint to ensure source_sync_mode is only set when source entity exists
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_sync_mode_check'
  ) THEN
    ALTER TABLE public.table_rows
      DROP CONSTRAINT table_rows_source_sync_mode_check;
  END IF;

  -- Add the new constraint
  ALTER TABLE public.table_rows
    ADD CONSTRAINT table_rows_source_sync_mode_check
    CHECK (source_sync_mode IN ('snapshot', 'live'));
END $$;

-- 5. Add a new constraint to ensure source_sync_mode consistency with source entity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.table_rows
      ADD CONSTRAINT table_rows_source_metadata_consistency
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
