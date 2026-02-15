-- Update create_table_full RPC to support source metadata (source_entity_type, source_entity_id, source_sync_mode)
-- This enables proper snapshot tracking when creating tables from existing workspace entities

-- Drop the old function signature
DROP FUNCTION IF EXISTS public.create_table_full(uuid, text, uuid, uuid, uuid, text, jsonb, jsonb);

-- Create the updated function with source metadata support
CREATE OR REPLACE FUNCTION public.create_table_full(
  p_workspace_id uuid,
  p_title text,
  p_created_by uuid,
  p_project_id uuid DEFAULT NULL,
  p_tab_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_fields jsonb DEFAULT '[]'::jsonb,
  p_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  result_table_id uuid,
  result_fields_created integer,
  result_rows_inserted integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_id uuid;
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_order numeric;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_name text;
  v_fields_created int := 0;
  v_rows_inserted int := 0;
  v_has_rows boolean := false;
  v_has_fields boolean := false;
  v_default_count int := 0;
  -- Source metadata variables
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_source_sync_mode text;
BEGIN
  -- Create the table (now with tab_id support)
  INSERT INTO public.tables (workspace_id, project_id, tab_id, title, description, created_by)
  VALUES (p_workspace_id, p_project_id, p_tab_id, COALESCE(p_title, 'Untitled Table'), p_description, p_created_by)
  RETURNING id INTO v_table_id;

  -- Check if fields are provided
  v_has_fields := jsonb_typeof(p_fields) = 'array' AND jsonb_array_length(p_fields) > 0;

  -- Only create default fields if no custom fields are provided
  IF NOT v_has_fields THEN
    INSERT INTO public.table_fields (table_id, name, type, config, is_primary, "order")
    VALUES
      (v_table_id, 'Name', 'text', '{}'::jsonb, true, 1),
      (v_table_id, 'Column 2', 'text', '{}'::jsonb, false, 2),
      (v_table_id, 'Column 3', 'text', '{}'::jsonb, false, 3);
  END IF;

  -- Default rows (will be deleted later if custom rows are provided)
  INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
  VALUES
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  -- Default view
  INSERT INTO public.table_views (table_id, name, type, is_default, created_by, config)
  VALUES (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  -- Add custom fields (if provided)
  -- The first field should always be primary unless explicitly set otherwise
  FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    v_field_name := trim(both ' ' from COALESCE(v_field->>'name', ''));
    IF v_field_name = '' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.table_fields tf
      WHERE tf.table_id = v_table_id AND lower(tf.name) = lower(v_field_name)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.table_fields (table_id, name, type, config, is_primary, property_definition_id)
    VALUES (
      v_table_id,
      v_field_name,
      COALESCE(v_field->>'type', 'text'),
      COALESCE(v_field->'config', '{}'::jsonb),
      -- First field is primary by default, others respect LLM's choice
      CASE
        WHEN v_fields_created = 0 THEN COALESCE((v_field->>'isPrimary')::boolean, true)
        ELSE COALESCE((v_field->>'isPrimary')::boolean, false)
      END,
      CASE
        WHEN COALESCE(v_field->>'type', 'text') = 'priority' THEN (
          SELECT id FROM public.property_definitions
          WHERE workspace_id = p_workspace_id AND name = 'Priority' AND type = 'select'
          LIMIT 1
        )
        WHEN COALESCE(v_field->>'type', 'text') = 'status' THEN (
          SELECT id FROM public.property_definitions
          WHERE workspace_id = p_workspace_id AND name = 'Status' AND type = 'select'
          LIMIT 1
        )
        ELSE NULL
      END
    );
    v_fields_created := v_fields_created + 1;
  END LOOP;

  -- Rows (optional)
  v_has_rows := jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0;
  IF v_has_rows THEN
    SELECT count(*) INTO v_default_count FROM public.table_rows tr WHERE tr.table_id = v_table_id;
    IF v_default_count <= 3 THEN
      DELETE FROM public.table_rows tr
      WHERE tr.table_id = v_table_id AND (tr.data IS NULL OR tr.data = '{}'::jsonb);
    END IF;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_data := '{}'::jsonb;
    v_order := NULL;
    v_source_entity_type := NULL;
    v_source_entity_id := NULL;
    v_source_sync_mode := NULL;

    IF v_row ? 'order' THEN
      BEGIN
        v_order := (v_row->>'order')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        v_order := NULL;
      END;
    END IF;

    -- Extract source metadata if present
    IF v_row ? 'source_entity_type' THEN
      v_source_entity_type := v_row->>'source_entity_type';
    END IF;
    IF v_row ? 'source_entity_id' THEN
      BEGIN
        v_source_entity_id := (v_row->>'source_entity_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_source_entity_id := NULL;
      END;
    END IF;
    IF v_row ? 'source_sync_mode' THEN
      v_source_sync_mode := v_row->>'source_sync_mode';
    END IF;

    FOR v_field_name, v_field_id IN
      SELECT key, public._resolve_table_field_id(v_table_id, key)
      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))
    LOOP
      IF v_field_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT type, config INTO v_field_type, v_field_config
      FROM public.table_fields
      WHERE id = v_field_id;

      IF v_field_type IN ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') THEN
        CONTINUE;
      END IF;

      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    END LOOP;

    -- Insert row with source metadata support
    INSERT INTO public.table_rows (
      table_id,
      data,
      "order",
      source_entity_type,
      source_entity_id,
      source_sync_mode,
      created_by,
      updated_by
    )
    VALUES (
      v_table_id,
      v_data,
      v_order,
      v_source_entity_type,
      v_source_entity_id,
      v_source_sync_mode,
      p_created_by,
      p_created_by
    );
    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  result_table_id := v_table_id;
  result_fields_created := v_fields_created;
  result_rows_inserted := v_rows_inserted;
  RETURN NEXT;
END;
$$;
