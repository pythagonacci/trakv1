-- Migration: Migrate timeline_events status values to canonical IDs
-- Maps old status values ('planned', 'in-progress') to canonical IDs ('todo', 'in_progress')

CREATE OR REPLACE FUNCTION migrate_timeline_status_to_canonical()
RETURNS void AS $$
DECLARE
  event_rec record;
  old_status text;
  new_status text;
  events_updated integer := 0;
  status_breakdown jsonb := '{}';
BEGIN
  RAISE NOTICE 'Starting migration of timeline_events status to canonical IDs...';
  RAISE NOTICE '======================================';

  -- Process all timeline events
  FOR event_rec IN
    SELECT id, status
    FROM timeline_events
    WHERE status IS NOT NULL
  LOOP
    old_status := event_rec.status;
    new_status := NULL;

    -- Map old status values to canonical IDs
    new_status := CASE old_status
      -- Already canonical - no change needed
      WHEN 'todo' THEN 'todo'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'done' THEN 'done'
      WHEN 'blocked' THEN 'blocked'

      -- Old values that need migration
      WHEN 'planned' THEN 'todo'
      WHEN 'in-progress' THEN 'in_progress'

      -- Fallback: try to match common variations
      ELSE
        CASE LOWER(TRIM(old_status))
          WHEN 'not started' THEN 'todo'
          WHEN 'to do' THEN 'todo'
          WHEN 'in progress' THEN 'in_progress'
          WHEN 'progress' THEN 'in_progress'
          WHEN 'complete' THEN 'done'
          WHEN 'completed' THEN 'done'
          WHEN 'finished' THEN 'done'
          WHEN 'on hold' THEN 'blocked'
          -- If no match, default to todo
          ELSE 'todo'
        END
    END;

    -- Update if status changed
    IF new_status IS NOT NULL AND new_status != old_status THEN
      UPDATE timeline_events
      SET status = new_status
      WHERE id = event_rec.id;

      events_updated := events_updated + 1;

      -- Track status breakdown for reporting
      IF status_breakdown ? old_status THEN
        status_breakdown := jsonb_set(
          status_breakdown,
          ARRAY[old_status],
          to_jsonb((status_breakdown->>old_status)::integer + 1)
        );
      ELSE
        status_breakdown := jsonb_set(status_breakdown, ARRAY[old_status], '1');
      END IF;

      -- Log first few updates
      IF events_updated <= 10 THEN
        RAISE NOTICE 'Migrated timeline_event %: "%" -> "%"', event_rec.id, old_status, new_status;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE 'Timeline events updated: %', events_updated;

  IF events_updated > 0 THEN
    RAISE NOTICE 'Status breakdown: %', status_breakdown;
  END IF;

  RAISE NOTICE '======================================';

END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_timeline_status_to_canonical();

-- Clean up temporary function
DROP FUNCTION migrate_timeline_status_to_canonical();

-- Now drop the old constraint and add the new one with canonical values
ALTER TABLE timeline_events
  DROP CONSTRAINT IF EXISTS timeline_events_status_check;

ALTER TABLE timeline_events
  ADD CONSTRAINT timeline_events_status_check
  CHECK (status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'blocked'::text, 'done'::text]));

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Updated status constraint to use canonical IDs';
END $$;

-- Verification: Check status distribution
DO $$
DECLARE
  todo_count integer;
  in_progress_count integer;
  blocked_count integer;
  done_count integer;
  total_count integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'todo'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'blocked'),
    COUNT(*) FILTER (WHERE status = 'done'),
    COUNT(*)
  INTO todo_count, in_progress_count, blocked_count, done_count, total_count
  FROM timeline_events;

  RAISE NOTICE 'Status distribution after migration:';
  RAISE NOTICE '  todo: %', todo_count;
  RAISE NOTICE '  in_progress: %', in_progress_count;
  RAISE NOTICE '  blocked: %', blocked_count;
  RAISE NOTICE '  done: %', done_count;
  RAISE NOTICE '  Total: %', total_count;
END $$;
