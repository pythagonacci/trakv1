-- Allow source_entity_type = 'subtask' on table_rows so table rows can link to
-- subtasks (e.g. when AI creates a table from tasks with subtasks and each
-- subtask is its own row).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND constraint_name = 'table_rows_source_entity_check'
  ) THEN
    ALTER TABLE public.table_rows DROP CONSTRAINT table_rows_source_entity_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND constraint_name = 'table_rows_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.table_rows DROP CONSTRAINT table_rows_source_metadata_consistency;
  END IF;
END $$;

ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_entity_check
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL)
    OR (source_entity_type IN ('task', 'timeline_event', 'table_row', 'block', 'subtask') AND source_entity_id IS NOT NULL)
  );

ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR (
      source_entity_type IN ('task', 'timeline_event', 'table_row', 'block', 'subtask')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );
