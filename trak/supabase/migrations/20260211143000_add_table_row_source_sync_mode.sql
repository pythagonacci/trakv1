-- Add source-of-truth metadata for table rows rendered from editable source entities.

ALTER TABLE public.table_rows
  ADD COLUMN IF NOT EXISTS source_entity_type text,
  ADD COLUMN IF NOT EXISTS source_entity_id uuid,
  ADD COLUMN IF NOT EXISTS source_sync_mode text;

ALTER TABLE public.table_rows
  ALTER COLUMN source_sync_mode SET DEFAULT 'snapshot';

UPDATE public.table_rows
SET source_sync_mode = 'snapshot'
WHERE source_sync_mode IS NULL;

ALTER TABLE public.table_rows
  ALTER COLUMN source_sync_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_sync_mode_check'
  ) THEN
    ALTER TABLE public.table_rows
      ADD CONSTRAINT table_rows_source_sync_mode_check
      CHECK (source_sync_mode IN ('snapshot', 'live'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_entity_check'
  ) THEN
    ALTER TABLE public.table_rows
      ADD CONSTRAINT table_rows_source_entity_check
      CHECK (
        (source_entity_type IS NULL AND source_entity_id IS NULL)
        OR (
          source_entity_type IN ('task', 'timeline_event')
          AND source_entity_id IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_table_rows_source_entity
  ON public.table_rows(source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_table_rows_source_sync_mode
  ON public.table_rows(source_sync_mode)
  WHERE source_entity_id IS NOT NULL;
