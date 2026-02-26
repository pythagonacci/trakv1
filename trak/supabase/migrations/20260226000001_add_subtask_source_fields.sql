-- Add source tracking fields to task_subtasks
-- Allows subtasks to track their own source entity independently from their parent task.
-- This is critical so the AI never inherits parent task source metadata onto a subtask.

ALTER TABLE public.task_subtasks
  ADD COLUMN IF NOT EXISTS source_entity_type text,
  ADD COLUMN IF NOT EXISTS source_entity_id uuid,
  ADD COLUMN IF NOT EXISTS source_sync_mode text;

ALTER TABLE public.task_subtasks
  ADD CONSTRAINT task_subtasks_source_metadata_consistency CHECK (
    (
      source_entity_type IS NULL
      AND source_entity_id IS NULL
      AND source_sync_mode IS NULL
    )
    OR (
      source_entity_type = ANY (ARRAY['task'::text, 'timeline_event'::text, 'table_row'::text, 'block'::text, 'subtask'::text])
      AND source_entity_id IS NOT NULL
      AND source_sync_mode = ANY (ARRAY['snapshot'::text, 'live'::text])
    )
  );

CREATE INDEX IF NOT EXISTS idx_task_subtasks_source_entity_id
  ON public.task_subtasks(source_entity_id)
  WHERE source_entity_id IS NOT NULL;
