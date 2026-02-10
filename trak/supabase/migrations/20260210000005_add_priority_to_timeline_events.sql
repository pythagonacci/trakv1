-- Migration: Add priority column to timeline_events
-- Adds priority field to timeline events to support workspace-level property definitions

-- Add priority column
ALTER TABLE timeline_events
  ADD COLUMN priority text;

-- Add helpful comments explaining canonical values
COMMENT ON COLUMN timeline_events.priority IS
  'Priority level using canonical IDs: low, medium, high, urgent. Links to workspace property_definitions.';

COMMENT ON COLUMN timeline_events.status IS
  'Status using canonical IDs: todo, in_progress, done, blocked. Links to workspace property_definitions.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Added priority column to timeline_events table';
END $$;
