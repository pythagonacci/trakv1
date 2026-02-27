-- Ensure bulk_update_rows normalizes select-like updates to canonical labels.

CREATE OR REPLACE FUNCTION public.bulk_update_rows(
  p_table_id uuid,
  p_row_ids uuid[],
  p_updates jsonb,
  p_updated_by uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_updates jsonb := '{}'::jsonb;
  v_entry record;
  v_field_type text;
  v_field_config jsonb;
  v_resolved jsonb;
BEGIN
  FOR v_entry IN
    SELECT key, value
    FROM jsonb_each(COALESCE(p_updates, '{}'::jsonb))
  LOOP
    SELECT type, config
    INTO v_field_type, v_field_config
    FROM public.table_fields
    WHERE table_id = p_table_id
      AND id::text = v_entry.key
    LIMIT 1;

    IF v_field_type IS NULL THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(v_entry.value) = 'null' THEN
      v_updates := v_updates || jsonb_build_object(v_entry.key, null);
      CONTINUE;
    END IF;

    v_resolved := public._resolve_field_value_with_property_def(
      v_field_type,
      v_field_config,
      null,
      v_entry.value
    );

    v_updates := v_updates || jsonb_build_object(v_entry.key, v_resolved);
  END LOOP;

  UPDATE public.table_rows
  SET data = COALESCE(data, '{}'::jsonb) || v_updates,
      updated_by = p_updated_by,
      edited = CASE WHEN source_entity_id IS NOT NULL THEN true ELSE COALESCE(edited, false) END
  WHERE table_id = p_table_id AND id = ANY(p_row_ids);
END;
$$;
