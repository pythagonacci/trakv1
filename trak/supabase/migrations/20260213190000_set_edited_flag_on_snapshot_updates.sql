-- Fix RPC functions to set edited=true when updating snapshot rows
-- This ensures edited snapshots appear in search results

-- 1. Fix bulk_update_rows - sets edited=true for snapshots
CREATE OR REPLACE FUNCTION public.bulk_update_rows(
  p_table_id uuid,
  p_row_ids uuid[],
  p_updates jsonb,
  p_updated_by uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_updates jsonb := '{}'::jsonb;
  v_entry record;
BEGIN
  -- Only allow valid field ids
  FOR v_entry IN
    SELECT key, value
    FROM jsonb_each(COALESCE(p_updates, '{}'::jsonb))
  LOOP
    IF EXISTS (SELECT 1 FROM public.table_fields WHERE table_id = p_table_id AND id::text = v_entry.key) THEN
      v_updates := v_updates || jsonb_build_object(v_entry.key, v_entry.value);
    END IF;
  END LOOP;

  UPDATE public.table_rows
  SET data = COALESCE(data, '{}'::jsonb) || v_updates,
      updated_by = p_updated_by,
      edited = CASE WHEN source_entity_id IS NOT NULL THEN true ELSE COALESCE(edited, false) END
  WHERE table_id = p_table_id AND id = ANY(p_row_ids);
END;
$$;

-- 2. Fix update_table_rows_by_field_names - sets edited=true for snapshots
CREATE OR REPLACE FUNCTION public.update_table_rows_by_field_names(
  p_table_id uuid,
  p_filters jsonb,
  p_updates jsonb,
  p_limit integer,
  p_updated_by uuid
)
RETURNS TABLE (updated integer, row_ids uuid[])
LANGUAGE plpgsql
AS $$
DECLARE
  v_updates_by_id jsonb := '{}'::jsonb;
  v_filter_key text;
  v_filter_val jsonb;
  v_filter_text text;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_ids uuid[];
  v_ids_next uuid[];
  v_limit int := COALESCE(p_limit, 10000);
BEGIN
  -- Build updates object with field IDs
  FOR v_filter_key, v_filter_val IN SELECT key, value FROM jsonb_each(COALESCE(p_updates, '{}'::jsonb)) LOOP
    v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
    IF v_field_id IS NULL THEN
      RAISE EXCEPTION 'Unknown field "%" in updates', v_filter_key;
    END IF;
    SELECT type, config INTO v_field_type, v_field_config FROM public.table_fields WHERE id = v_field_id;
    v_updates_by_id := v_updates_by_id || jsonb_build_object(
      v_field_id::text,
      public._resolve_field_value(v_field_type, v_field_config, v_filter_val)
    );
  END LOOP;

  -- Seed candidate IDs
  SELECT array_agg(id) INTO v_ids
  FROM public.table_rows
  WHERE table_id = p_table_id
  LIMIT v_limit;

  IF v_ids IS NULL THEN
    updated := 0;
    row_ids := ARRAY[]::uuid[];
    RETURN NEXT;
  END IF;

  -- Apply filters
  IF p_filters IS NOT NULL THEN
    FOR v_filter_key, v_filter_val IN SELECT key, value FROM jsonb_each(p_filters) LOOP
      v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
      IF v_field_id IS NULL THEN
        RAISE EXCEPTION 'Unknown field "%" in filters', v_filter_key;
      END IF;

      IF jsonb_typeof(v_filter_val) NOT IN ('object', 'array') THEN
        v_filter_text := trim(both '"' from v_filter_val::text);
      ELSE
        v_filter_text := NULL;
      END IF;

      v_ids_next := ARRAY(
        SELECT id
        FROM public.table_rows
        WHERE table_id = p_table_id
          AND id = ANY(v_ids)
          AND (
            (jsonb_typeof(v_filter_val) = 'object' AND (
              (v_filter_val->>'op' = 'is_null' AND (data->>v_field_id::text) IS NULL)
              OR (v_filter_val->>'op' = 'not_null' AND (data->>v_field_id::text) IS NOT NULL)
              OR (v_filter_val->>'op' = 'eq' AND lower(COALESCE(data->>v_field_id::text, '')) = lower(COALESCE(v_filter_val->>'value','')))
              OR (v_filter_val->>'op' = 'neq' AND lower(COALESCE(data->>v_field_id::text, '')) <> lower(COALESCE(v_filter_val->>'value','')))
              OR (v_filter_val->>'op' = 'contains' AND lower(COALESCE(data->>v_field_id::text, '')) LIKE '%' || lower(COALESCE(v_filter_val->>'value','')) || '%')
            ))
            OR (jsonb_typeof(v_filter_val) = 'array' AND lower(COALESCE(data->>v_field_id::text, '')) IN (
              SELECT lower(value::text) FROM jsonb_array_elements_text(v_filter_val)
            ))
            OR (jsonb_typeof(v_filter_val) NOT IN ('object','array') AND (
              v_filter_text IS NOT NULL
              AND lower(COALESCE(data->>v_field_id::text, '')) = lower(v_filter_text)
            ))
          )
      );
      v_ids := v_ids_next;
    END LOOP;
  END IF;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    updated := 0;
    row_ids := ARRAY[]::uuid[];
    RETURN NEXT;
  END IF;

  UPDATE public.table_rows
  SET data = COALESCE(data, '{}'::jsonb) || v_updates_by_id,
      updated_by = p_updated_by,
      edited = CASE WHEN source_entity_id IS NOT NULL THEN true ELSE COALESCE(edited, false) END
  WHERE table_id = p_table_id AND id = ANY(v_ids);

  updated := COALESCE(array_length(v_ids, 1), 0);
  row_ids := v_ids;
  RETURN NEXT;
END;
$$;

-- Note: bulk_update_rows_by_field_names calls update_table_rows_by_field_names,
-- so it will automatically inherit the edited flag behavior

-- 3. Add database triggers to automatically set edited=true for snapshots
-- This catches ALL update paths (including bulk operations from app code)

-- Trigger for table_rows
CREATE OR REPLACE FUNCTION public.set_edited_flag_on_table_row_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this is a snapshot (has source_entity_id) and data is being modified, mark as edited
  IF NEW.source_entity_id IS NOT NULL AND (NEW.data IS DISTINCT FROM OLD.data) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_edited_flag_on_table_row_update ON public.table_rows;
CREATE TRIGGER trigger_set_edited_flag_on_table_row_update
  BEFORE UPDATE ON public.table_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_edited_flag_on_table_row_update();

-- Trigger for task_items
CREATE OR REPLACE FUNCTION public.set_edited_flag_on_task_item_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this is a snapshot (has source_entity_id) and any task field is being modified, mark as edited
  IF NEW.source_entity_id IS NOT NULL AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.priority IS DISTINCT FROM OLD.priority OR
    NEW.due_date IS DISTINCT FROM OLD.due_date OR
    NEW.start_date IS DISTINCT FROM OLD.start_date
  ) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_edited_flag_on_task_item_update ON public.task_items;
CREATE TRIGGER trigger_set_edited_flag_on_task_item_update
  BEFORE UPDATE ON public.task_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_edited_flag_on_task_item_update();

-- Trigger for timeline_events
CREATE OR REPLACE FUNCTION public.set_edited_flag_on_timeline_event_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If this is a snapshot (has source_entity_id) and any field is being modified, mark as edited
  IF NEW.source_entity_id IS NOT NULL AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.notes IS DISTINCT FROM OLD.notes OR
    NEW.start_date IS DISTINCT FROM OLD.start_date OR
    NEW.end_date IS DISTINCT FROM OLD.end_date
  ) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_edited_flag_on_timeline_event_update ON public.timeline_events;
CREATE TRIGGER trigger_set_edited_flag_on_timeline_event_update
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_edited_flag_on_timeline_event_update();
