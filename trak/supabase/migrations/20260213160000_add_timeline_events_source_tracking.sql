-- Add source tracking to timeline_events to enable snapshots
-- This allows timeline events to be snapshots of tasks, other timeline events, or any entity

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS source_entity_type text,
  ADD COLUMN IF NOT EXISTS source_entity_id uuid,
  ADD COLUMN IF NOT EXISTS source_sync_mode text;

-- Add constraint: source metadata must be complete or all NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'timeline_events'
      AND constraint_name = 'timeline_events_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT timeline_events_source_metadata_consistency
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

-- Add constraint: valid sync mode values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'timeline_events'
      AND constraint_name = 'timeline_events_source_sync_mode_check'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT timeline_events_source_sync_mode_check
      CHECK (source_sync_mode IN ('snapshot', 'live'));
  END IF;
END $$;

-- Create index for efficient source entity lookups
CREATE INDEX IF NOT EXISTS idx_timeline_events_source_entity
  ON public.timeline_events(source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_events_source_sync_mode
  ON public.timeline_events(source_sync_mode)
  WHERE source_entity_id IS NOT NULL;
