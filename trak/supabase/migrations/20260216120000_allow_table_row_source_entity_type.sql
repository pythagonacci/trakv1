-- Allow source_entity_type = 'table_row' on table_rows for row-to-row source tracking.
-- Previously only 'task' and 'timeline_event' were allowed; app and tool-executor now support table_row.

-- 1. Drop the old table_rows_source_entity_check if it exists (from 20260211143000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_entity_check'
  ) THEN
    ALTER TABLE public.table_rows
      DROP CONSTRAINT table_rows_source_entity_check;
  END IF;
END $$;

-- 2. Drop table_rows_source_metadata_consistency if it exists (from 20260213150000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.table_rows
      DROP CONSTRAINT table_rows_source_metadata_consistency;
  END IF;
END $$;

-- 3. Re-add constraint allowing task, timeline_event, and table_row
ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_entity_check
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL)
    OR (
      source_entity_type IN ('task', 'timeline_event', 'table_row')
      AND source_entity_id IS NOT NULL
    )
  );

-- 4. Re-add consistency constraint (all three source columns together or all null)
ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR
    (
      source_entity_type IN ('task', 'timeline_event', 'table_row')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );
