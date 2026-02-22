-- Allow source_entity_type = 'table_row' on task_items and timeline_events
-- to keep universal source tracking symmetric with table_rows.

-- 1) task_items: replace source metadata consistency constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'task_items'
      AND constraint_name = 'task_items_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.task_items
      DROP CONSTRAINT task_items_source_metadata_consistency;
  END IF;
END $$;

ALTER TABLE public.task_items
  ADD CONSTRAINT task_items_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR
    (
      source_entity_type IN ('task', 'timeline_event', 'table_row')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );

-- 2) timeline_events: replace source metadata consistency constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'timeline_events'
      AND constraint_name = 'timeline_events_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.timeline_events
      DROP CONSTRAINT timeline_events_source_metadata_consistency;
  END IF;
END $$;

ALTER TABLE public.timeline_events
  ADD CONSTRAINT timeline_events_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR
    (
      source_entity_type IN ('task', 'timeline_event', 'table_row')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );
