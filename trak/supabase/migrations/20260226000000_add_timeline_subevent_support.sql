-- Add first-class nested sub-events for timeline events (1-level depth enforced in application logic)

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES public.timeline_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_timeline_events_parent_event_id
  ON public.timeline_events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

ALTER TABLE public.timeline_events
  DROP CONSTRAINT IF EXISTS timeline_events_source_metadata_consistency;

ALTER TABLE public.timeline_events
  ADD CONSTRAINT timeline_events_source_metadata_consistency CHECK (
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
