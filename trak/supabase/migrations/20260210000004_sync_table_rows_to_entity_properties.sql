-- Migration: Sync table_rows priority/status to entity_properties
-- Creates entity_properties entries for all table rows with priority/status values

CREATE OR REPLACE FUNCTION sync_table_rows_to_entity_properties()
RETURNS void AS $$
DECLARE
  row_rec record;
  field_rec record;
  field_value text;
  rows_synced integer := 0;
BEGIN
  RAISE NOTICE 'Starting sync of table_rows priority/status to entity_properties...';

  -- For each table row
  FOR row_rec IN
    SELECT
      tr.id as row_id,
      tr.data,
      t.workspace_id
    FROM table_rows tr
    JOIN tables t ON tr.table_id = t.id
  LOOP

    -- Check each priority/status field in this row's table
    FOR field_rec IN
      SELECT
        tf.id as field_id,
        tf.property_definition_id,
        tf.type
      FROM table_fields tf
      WHERE tf.table_id = (
        SELECT table_id FROM table_rows WHERE id = row_rec.row_id
      )
      AND tf.type IN ('priority', 'status')
      AND tf.property_definition_id IS NOT NULL
    LOOP

      -- Get the field value from row data
      IF row_rec.data ? field_rec.field_id::text THEN
        field_value := row_rec.data->>field_rec.field_id::text;

        -- Only sync if there's a value
        IF field_value IS NOT NULL AND field_value != '' THEN

          -- Insert or update entity_properties
          INSERT INTO entity_properties (
            entity_type,
            entity_id,
            property_definition_id,
            value,
            workspace_id
          )
          VALUES (
            'table_row',
            row_rec.row_id,
            field_rec.property_definition_id,
            to_jsonb(field_value),
            row_rec.workspace_id
          )
          ON CONFLICT (entity_type, entity_id, property_definition_id)
          DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = now();

          rows_synced := rows_synced + 1;

          IF rows_synced <= 10 THEN
            RAISE NOTICE 'Synced: table_row % -> % = %',
              row_rec.row_id, field_rec.type, field_value;
          END IF;
        END IF;
      END IF;

    END LOOP; -- fields loop

  END LOOP; -- rows loop

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Sync Complete!';
  RAISE NOTICE 'Entity properties created/updated: %', rows_synced;
  RAISE NOTICE '======================================';

END;
$$ LANGUAGE plpgsql;

-- Execute the sync
SELECT sync_table_rows_to_entity_properties();

-- Clean up temporary function
DROP FUNCTION sync_table_rows_to_entity_properties();

-- Verification: Check entity_properties for table_rows
DO $$
DECLARE
  entity_prop_count integer;
BEGIN
  SELECT COUNT(*) INTO entity_prop_count
  FROM entity_properties
  WHERE entity_type = 'table_row';

  RAISE NOTICE 'Total entity_properties for table_rows: %', entity_prop_count;
END $$;
