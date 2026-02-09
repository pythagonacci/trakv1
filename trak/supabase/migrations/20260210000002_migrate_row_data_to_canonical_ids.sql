-- Migration: Convert table row data from old IDs to canonical IDs
-- Maps "pri_3", "status_1" style IDs to canonical IDs like "medium", "todo"
-- Uses label-based fuzzy matching with fallback strategies

CREATE OR REPLACE FUNCTION migrate_priority_status_row_data()
RETURNS void AS $$
DECLARE
  field_rec record;
  row_rec record;
  old_id text;
  canonical_id text;
  label_text text;
  config_options jsonb;
  new_data jsonb;
  rows_updated integer := 0;
  total_fields integer := 0;
  skipped_already_canonical integer := 0;
  fallback_used integer := 0;
BEGIN
  RAISE NOTICE 'Starting row data migration to canonical IDs...';

  -- Process all priority and status fields that are now linked to property definitions
  FOR field_rec IN
    SELECT
      tf.id as field_id,
      tf.type as field_type,
      tf.config,
      tf.table_id,
      tf.name as field_name,
      pd.id as prop_def_id,
      pd.options as pd_options,
      t.workspace_id
    FROM table_fields tf
    JOIN tables t ON tf.table_id = t.id
    JOIN property_definitions pd ON tf.property_definition_id = pd.id
    WHERE tf.type IN ('priority', 'status')
      AND tf.property_definition_id IS NOT NULL
  LOOP

    total_fields := total_fields + 1;
    RAISE NOTICE 'Processing field: % (%) in table %', field_rec.field_name, field_rec.field_type, field_rec.table_id;

    -- Get config options based on field type
    IF field_rec.field_type = 'priority' THEN
      config_options := field_rec.config->'levels';
    ELSE
      config_options := field_rec.config->'options';
    END IF;

    -- Process all rows for this table that have a value for this field
    FOR row_rec IN
      SELECT id, data
      FROM table_rows
      WHERE table_id = field_rec.table_id
        AND data ? field_rec.field_id::text
        AND (data->>field_rec.field_id::text) IS NOT NULL
        AND (data->>field_rec.field_id::text) != ''
    LOOP

      -- Get current value
      old_id := row_rec.data->>field_rec.field_id::text;

      -- Skip if already canonical (matches a property definition option ID)
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(field_rec.pd_options) opt
        WHERE opt->>'id' = old_id
      ) THEN
        skipped_already_canonical := skipped_already_canonical + 1;
        CONTINUE;
      END IF;

      -- ======================================================================
      -- STRATEGY 1: Label-based matching
      -- ======================================================================

      canonical_id := NULL;

      -- Get label from old config
      IF config_options IS NOT NULL AND jsonb_typeof(config_options) = 'array' THEN
        SELECT opt->>'label' INTO label_text
        FROM jsonb_array_elements(config_options) opt
        WHERE opt->>'id' = old_id
        LIMIT 1;

        -- Try exact case-insensitive label match
        IF label_text IS NOT NULL THEN
          SELECT opt->>'id' INTO canonical_id
          FROM jsonb_array_elements(field_rec.pd_options) opt
          WHERE LOWER(opt->>'label') = LOWER(label_text)
          LIMIT 1;
        END IF;

        -- Try fuzzy label matching (contains)
        IF canonical_id IS NULL AND label_text IS NOT NULL THEN
          SELECT opt->>'id' INTO canonical_id
          FROM jsonb_array_elements(field_rec.pd_options) opt
          WHERE LOWER(opt->>'label') LIKE '%' || LOWER(label_text) || '%'
             OR LOWER(label_text) LIKE '%' || LOWER(opt->>'label') || '%'
          ORDER BY LENGTH(opt->>'label')  -- Prefer shorter (more specific) matches
          LIMIT 1;
        END IF;
      END IF;

      -- ======================================================================
      -- STRATEGY 2: Common label mappings (fallback)
      -- ======================================================================

      IF canonical_id IS NULL AND label_text IS NOT NULL THEN
        -- Priority mappings
        canonical_id := CASE LOWER(TRIM(label_text))
          WHEN 'critical' THEN 'urgent'
          WHEN 'highest' THEN 'urgent'
          WHEN 'high' THEN 'high'
          WHEN 'medium' THEN 'medium'
          WHEN 'normal' THEN 'medium'
          WHEN 'low' THEN 'low'
          WHEN 'lowest' THEN 'low'
          -- Status mappings
          WHEN 'not started' THEN 'todo'
          WHEN 'to do' THEN 'todo'
          WHEN 'todo' THEN 'todo'
          WHEN 'in progress' THEN 'in_progress'
          WHEN 'in-progress' THEN 'in_progress'
          WHEN 'progress' THEN 'in_progress'
          WHEN 'complete' THEN 'done'
          WHEN 'completed' THEN 'done'
          WHEN 'done' THEN 'done'
          WHEN 'finished' THEN 'done'
          WHEN 'blocked' THEN 'blocked'
          WHEN 'on hold' THEN 'blocked'
          ELSE NULL
        END;
      END IF;

      -- ======================================================================
      -- STRATEGY 3: Position/order-based fallback
      -- ======================================================================

      IF canonical_id IS NULL AND config_options IS NOT NULL THEN
        DECLARE
          old_position integer;
          option_idx integer := 0;
        BEGIN
          -- Find position of old_id in config options
          FOR option_idx IN 0..jsonb_array_length(config_options) - 1 LOOP
            IF (config_options->option_idx)->>'id' = old_id THEN
              old_position := option_idx;
              EXIT;
            END IF;
          END LOOP;

          -- Map to same position in property definition options
          IF old_position IS NOT NULL AND old_position < jsonb_array_length(field_rec.pd_options) THEN
            canonical_id := field_rec.pd_options->old_position->>'id';
            fallback_used := fallback_used + 1;
            RAISE WARNING 'Using position-based fallback for row %, field %, old_id %, position % -> %',
              row_rec.id, field_rec.field_name, old_id, old_position, canonical_id;
          END IF;
        END;
      END IF;

      -- ======================================================================
      -- STRATEGY 4: Default to first option (last resort)
      -- ======================================================================

      IF canonical_id IS NULL THEN
        SELECT opt->>'id' INTO canonical_id
        FROM jsonb_array_elements(field_rec.pd_options) opt
        LIMIT 1;

        fallback_used := fallback_used + 1;
        RAISE WARNING 'Using first-option fallback for row %, field %, old_id % -> %',
          row_rec.id, field_rec.field_name, old_id, canonical_id;
      END IF;

      -- ======================================================================
      -- UPDATE ROW DATA
      -- ======================================================================

      IF canonical_id IS NOT NULL AND canonical_id != old_id THEN
        new_data := jsonb_set(
          row_rec.data,
          ARRAY[field_rec.field_id::text],
          to_jsonb(canonical_id)
        );

        UPDATE table_rows
        SET
          data = new_data,
          updated_at = now()
        WHERE id = row_rec.id;

        rows_updated := rows_updated + 1;

        -- Log the mapping for verification
        IF rows_updated <= 10 THEN
          RAISE NOTICE 'Mapped: % ("%") -> % for row %', old_id, label_text, canonical_id, row_rec.id;
        END IF;
      ELSIF canonical_id IS NULL THEN
        RAISE WARNING 'Failed to map value for row %, field %, old_id %', row_rec.id, field_rec.field_name, old_id;
      END IF;

    END LOOP;  -- rows loop

  END LOOP;  -- fields loop

  -- Summary
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Total fields processed: %', total_fields;
  RAISE NOTICE '  Rows updated: %', rows_updated;
  RAISE NOTICE '  Rows skipped (already canonical): %', skipped_already_canonical;
  RAISE NOTICE '  Fallback mappings used: %', fallback_used;
  RAISE NOTICE '========================================';

END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_priority_status_row_data();

-- Clean up temporary function
DROP FUNCTION migrate_priority_status_row_data();

-- Verification: Check for any remaining non-canonical IDs
DO $$
DECLARE
  invalid_count integer;
  invalid_rows text;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM table_rows tr
  JOIN table_fields tf ON tr.table_id = tf.table_id
  JOIN property_definitions pd ON tf.property_definition_id = pd.id
  WHERE tf.type IN ('priority', 'status')
    AND tr.data ? tf.id::text
    AND (tr.data->>tf.id::text) IS NOT NULL
    AND (tr.data->>tf.id::text) != ''
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(pd.options) opt
      WHERE opt->>'id' = tr.data->>tf.id::text
    );

  IF invalid_count > 0 THEN
    -- Get sample of invalid rows for debugging
    SELECT string_agg(
      'Row: ' || tr.id || ', Field: ' || tf.name || ', Value: ' || (tr.data->>tf.id::text),
      E'\n'
    ) INTO invalid_rows
    FROM (
      SELECT tr.id, tf.id as field_id, tf.name, tr.data
      FROM table_rows tr
      JOIN table_fields tf ON tr.table_id = tf.table_id
      JOIN property_definitions pd ON tf.property_definition_id = pd.id
      WHERE tf.type IN ('priority', 'status')
        AND tr.data ? tf.id::text
        AND (tr.data->>tf.id::text) IS NOT NULL
        AND (tr.data->>tf.id::text) != ''
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(pd.options) opt
          WHERE opt->>'id' = tr.data->>tf.id::text
        )
      LIMIT 10
    ) sample;

    RAISE WARNING E'Warning: % rows still have non-canonical IDs:\n%', invalid_count, invalid_rows;
  ELSE
    RAISE NOTICE 'Success: All rows now use canonical IDs';
  END IF;
END $$;
