-- Add a simple lock flag to blocks so UI can prevent edits
-- without affecting underlying source-sync behaviors.
-- Idempotent and safe to run multiple times.

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename = 'blocks'
    AND    indexname = 'idx_blocks_locked'
  ) THEN
    CREATE INDEX idx_blocks_locked
      ON public.blocks(locked);
  END IF;
END $$;

