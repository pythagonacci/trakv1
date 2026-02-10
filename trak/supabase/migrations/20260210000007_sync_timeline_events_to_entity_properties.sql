-- Migration: Sync timeline_events priority/status to entity_properties
-- Creates entity_properties entries for all timeline events with priority/status values

CREATE OR REPLACE FUNCTION sync_timeline_events_to_entity_properties()
RETURNS void AS $$
DECLARE
  event_rec record;
  status_prop_def_id uuid;
  priority_prop_def_id uuid;
  rows_synced integer := 0;
  status_synced integer := 0;
  priority_synced integer := 0;
BEGIN
  RAISE NOTICE 'Starting sync of timeline_events priority/status to entity_properties...';
  RAISE NOTICE '======================================';

  -- For each timeline event
  FOR event_rec IN
    SELECT
      te.id as event_id,
      te.status,
      te.priority,
      te.workspace_id
    FROM timeline_events te
    WHERE te.status IS NOT NULL OR te.priority IS NOT NULL
  LOOP

    -- Get Status property_definition for this workspace
    IF event_rec.status IS NOT NULL THEN
      SELECT id INTO status_prop_def_id
      FROM property_definitions
      WHERE workspace_id = event_rec.workspace_id
        AND name = 'Status'
        AND type = 'select'
      LIMIT 1;

      IF status_prop_def_id IS NOT NULL THEN
        -- Insert or update entity_properties for status
        INSERT INTO entity_properties (
          entity_type,
          entity_id,
          property_definition_id,
          value,
          workspace_id
        )
        VALUES (
          'timeline_event',
          event_rec.event_id,
          status_prop_def_id,
          to_jsonb(event_rec.status),
          event_rec.workspace_id
        )
        ON CONFLICT (entity_type, entity_id, property_definition_id)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = now();

        status_synced := status_synced + 1;
        rows_synced := rows_synced + 1;

        IF status_synced <= 5 THEN
          RAISE NOTICE 'Synced status: timeline_event % -> status = %',
            event_rec.event_id, event_rec.status;
        END IF;
      ELSE
        IF status_synced = 0 THEN
          RAISE WARNING 'No Status property_definition found for workspace %', event_rec.workspace_id;
        END IF;
      END IF;
    END IF;

    -- Get Priority property_definition for this workspace
    IF event_rec.priority IS NOT NULL THEN
      SELECT id INTO priority_prop_def_id
      FROM property_definitions
      WHERE workspace_id = event_rec.workspace_id
        AND name = 'Priority'
        AND type = 'select'
      LIMIT 1;

      IF priority_prop_def_id IS NOT NULL THEN
        -- Insert or update entity_properties for priority
        INSERT INTO entity_properties (
          entity_type,
          entity_id,
          property_definition_id,
          value,
          workspace_id
        )
        VALUES (
          'timeline_event',
          event_rec.event_id,
          priority_prop_def_id,
          to_jsonb(event_rec.priority),
          event_rec.workspace_id
        )
        ON CONFLICT (entity_type, entity_id, property_definition_id)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = now();

        priority_synced := priority_synced + 1;
        rows_synced := rows_synced + 1;

        IF priority_synced <= 5 THEN
          RAISE NOTICE 'Synced priority: timeline_event % -> priority = %',
            event_rec.event_id, event_rec.priority;
        END IF;
      ELSE
        IF priority_synced = 0 THEN
          RAISE WARNING 'No Priority property_definition found for workspace %', event_rec.workspace_id;
        END IF;
      END IF;
    END IF;

  END LOOP;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Sync Complete!';
  RAISE NOTICE 'Status entries synced: %', status_synced;
  RAISE NOTICE 'Priority entries synced: %', priority_synced;
  RAISE NOTICE 'Total entity_properties created/updated: %', rows_synced;
  RAISE NOTICE '======================================';

END;
$$ LANGUAGE plpgsql;

-- Execute the sync
SELECT sync_timeline_events_to_entity_properties();

-- Clean up temporary function
DROP FUNCTION sync_timeline_events_to_entity_properties();

-- Verification: Check entity_properties for timeline_events
DO $$
DECLARE
  timeline_status_count integer;
  timeline_priority_count integer;
  timeline_total_count integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE pd.name = 'Status'),
    COUNT(*) FILTER (WHERE pd.name = 'Priority'),
    COUNT(*)
  INTO timeline_status_count, timeline_priority_count, timeline_total_count
  FROM entity_properties ep
  JOIN property_definitions pd ON ep.property_definition_id = pd.id
  WHERE ep.entity_type = 'timeline_event';

  RAISE NOTICE 'Entity properties for timeline_events:';
  RAISE NOTICE '  Status properties: %', timeline_status_count;
  RAISE NOTICE '  Priority properties: %', timeline_priority_count;
  RAISE NOTICE '  Total: %', timeline_total_count;
END $$;
