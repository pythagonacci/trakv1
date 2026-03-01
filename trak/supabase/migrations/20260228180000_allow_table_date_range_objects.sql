-- Allow table date fields to store either an ISO date string or a date-range object.
-- Supported object keys: start/end and startDate/endDate.

CREATE OR REPLACE FUNCTION public.validate_table_row_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  key TEXT;
  field_record RECORD;
  value JSONB;

  start_value JSONB;
  end_value JSONB;
BEGIN
  -- Ensure all keys reference existing fields on the table
  FOR key IN SELECT jsonb_object_keys(COALESCE(NEW.data, '{}'::jsonb))
  LOOP
    -- Skip computed metadata keys used by rollups/formulas (not field IDs)
    IF key LIKE '%\_computed_at' ESCAPE '\' THEN
      CONTINUE;
    END IF;

    SELECT id, type, config INTO field_record
    FROM table_fields
    WHERE id = key::uuid
      AND table_id = NEW.table_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown field id % for table %', key, NEW.table_id;
    END IF;

    value := NEW.data -> key;

    -- Basic type validation per field type (lightweight to avoid blocking flexible configs)
    IF field_record.type = 'number' THEN
      IF jsonb_typeof(value) NOT IN ('number', 'string', 'null') THEN
        RAISE EXCEPTION 'Field % expects numeric-compatible value', key;
      END IF;

    ELSIF field_record.type = 'checkbox' THEN
      IF jsonb_typeof(value) NOT IN ('boolean', 'null') THEN
        RAISE EXCEPTION 'Field % expects boolean value', key;
      END IF;

    ELSIF field_record.type IN ('multi_select', 'files', 'relation') THEN
      IF jsonb_typeof(value) NOT IN ('array', 'null') THEN
        RAISE EXCEPTION 'Field % expects array value', key;
      END IF;

    ELSIF field_record.type = 'date' THEN
      IF jsonb_typeof(value) = 'null' THEN
        CONTINUE;
      ELSIF jsonb_typeof(value) = 'string' THEN
        -- Accept plain ISO date and datetime-like strings.
        IF (value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}([T\s].*)?$' THEN
          RAISE EXCEPTION 'Field % expects ISO date string', key;
        END IF;
      ELSIF jsonb_typeof(value) = 'object' THEN
        start_value := COALESCE(value -> 'start', value -> 'startDate');
        end_value := COALESCE(value -> 'end', value -> 'endDate');

        IF start_value IS NULL AND end_value IS NULL THEN
          RAISE EXCEPTION 'Field % expects date range object with start/end', key;
        END IF;

        IF start_value IS NOT NULL THEN
          IF jsonb_typeof(start_value) NOT IN ('string', 'null') THEN
            RAISE EXCEPTION 'Field % expects date range start as string|null', key;
          END IF;
          IF jsonb_typeof(start_value) = 'string' AND (start_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}([T\s].*)?$' THEN
            RAISE EXCEPTION 'Field % expects date range start as ISO date string', key;
          END IF;
        END IF;

        IF end_value IS NOT NULL THEN
          IF jsonb_typeof(end_value) NOT IN ('string', 'null') THEN
            RAISE EXCEPTION 'Field % expects date range end as string|null', key;
          END IF;
          IF jsonb_typeof(end_value) = 'string' AND (end_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}([T\s].*)?$' THEN
            RAISE EXCEPTION 'Field % expects date range end as ISO date string', key;
          END IF;
        END IF;
      ELSE
        RAISE EXCEPTION 'Field % expects ISO date string or range object', key;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
