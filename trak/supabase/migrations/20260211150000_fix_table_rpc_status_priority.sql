-- Fix table RPCs to enforce canonical status/priority values and sync entity_properties

CREATE OR REPLACE FUNCTION public._resolve_option_id_or_null(
  p_options jsonb,
  p_value jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_text text;
  v_opt jsonb;
BEGIN
  IF p_options IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_value) = 'string' THEN
    v_text := trim(both '"' from p_value::text);
  ELSE
    v_text := p_value::text;
  END IF;

  -- Match by id
  SELECT opt INTO v_opt
  FROM jsonb_array_elements(p_options) AS opt
  WHERE lower(opt->>'id') = lower(v_text)
  LIMIT 1;

  IF v_opt IS NOT NULL THEN
    RETURN to_jsonb(v_opt->>'id');
  END IF;

  -- Match by label
  SELECT opt INTO v_opt
  FROM jsonb_array_elements(p_options) AS opt
  WHERE lower(opt->>'label') = lower(v_text)
  LIMIT 1;

  IF v_opt IS NOT NULL THEN
    RETURN to_jsonb(v_opt->>'id');
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._resolve_field_value_with_property_def(
  p_field_type text,
  p_config jsonb,
  p_property_definition_id uuid,
  p_value jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_options jsonb;
  v_item jsonb;
  v_item_res jsonb;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_field_type IN ('status', 'priority') AND p_property_definition_id IS NOT NULL THEN
    SELECT options INTO v_options
    FROM public.property_definitions
    WHERE id = p_property_definition_id
    LIMIT 1;

    IF jsonb_typeof(p_value) = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
        v_item_res := public._resolve_option_id_or_null(v_options, v_item);
        IF v_item_res IS NOT NULL THEN
          v_result := v_result || jsonb_build_array(v_item_res);
        END IF;
      END LOOP;
      RETURN v_result;
    END IF;

    RETURN public._resolve_option_id_or_null(v_options, p_value);
  END IF;

  RETURN public._resolve_field_value(p_field_type, p_config, p_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_table_full(
  p_workspace_id uuid,
  p_title text,
  p_created_by uuid,
  p_project_id uuid DEFAULT NULL,
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
  v_row_id uuid;
  v_row_ids uuid[];
  v_data jsonb;
  v_order numeric;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_name text;
  v_field_prop_def_id uuid;
  v_fields_created int := 0;
  v_rows_inserted int := 0;
  v_has_rows boolean := false;
  v_has_fields boolean := false;
  v_default_count int := 0;
  v_status_def_id uuid;
  v_priority_def_id uuid;
  v_entity_props jsonb;
  v_prop_entry record;
  v_cell_value jsonb;
BEGIN
  -- Ensure default property definitions exist for this workspace
  SELECT id INTO v_status_def_id
  FROM public.property_definitions
  WHERE workspace_id = p_workspace_id AND name = 'Status' AND type = 'select'
  LIMIT 1;

  IF v_status_def_id IS NULL THEN
    INSERT INTO public.property_definitions (workspace_id, name, type, options)
    VALUES (
      p_workspace_id,
      'Status',
      'select',
      '[
        {"id": "todo", "label": "To Do", "color": "#6b7280"},
        {"id": "in_progress", "label": "In Progress", "color": "#3b82f6"},
        {"id": "done", "label": "Done", "color": "#10b981"},
        {"id": "blocked", "label": "Blocked", "color": "#ef4444"}
      ]'::jsonb
    )
    RETURNING id INTO v_status_def_id;
  END IF;

  SELECT id INTO v_priority_def_id
  FROM public.property_definitions
  WHERE workspace_id = p_workspace_id AND name = 'Priority' AND type = 'select'
  LIMIT 1;

  IF v_priority_def_id IS NULL THEN
    INSERT INTO public.property_definitions (workspace_id, name, type, options)
    VALUES (
      p_workspace_id,
      'Priority',
      'select',
      '[
        {"id": "low", "label": "Low", "color": "#6b7280"},
        {"id": "medium", "label": "Medium", "color": "#f59e0b"},
        {"id": "high", "label": "High", "color": "#f97316"},
        {"id": "urgent", "label": "Urgent", "color": "#ef4444"}
      ]'::jsonb
    )
    RETURNING id INTO v_priority_def_id;
  END IF;

  -- Create the table
  INSERT INTO public.tables (workspace_id, project_id, title, description, created_by)
  VALUES (p_workspace_id, p_project_id, COALESCE(p_title, 'Untitled Table'), p_description, p_created_by)
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
      CASE
        WHEN COALESCE(v_field->>'type', 'text') IN ('status', 'priority') THEN '{}'::jsonb
        ELSE COALESCE(v_field->'config', '{}'::jsonb)
      END,
      CASE
        WHEN v_fields_created = 0 THEN COALESCE((v_field->>'isPrimary')::boolean, true)
        ELSE COALESCE((v_field->>'isPrimary')::boolean, false)
      END,
      CASE
        WHEN COALESCE(v_field->>'type', 'text') = 'priority' THEN v_priority_def_id
        WHEN COALESCE(v_field->>'type', 'text') = 'status' THEN v_status_def_id
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
    v_entity_props := '{}'::jsonb;
    v_order := NULL;

    IF v_row ? 'order' THEN
      BEGIN
        v_order := (v_row->>'order')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        v_order := NULL;
      END;
    END IF;

    FOR v_field_name, v_field_id IN
      SELECT key, public._resolve_table_field_id(v_table_id, key)
      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))
    LOOP
      IF v_field_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT type, config, property_definition_id INTO v_field_type, v_field_config, v_field_prop_def_id
      FROM public.table_fields
      WHERE id = v_field_id;

      IF v_field_type IN ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') THEN
        CONTINUE;
      END IF;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        v_field_prop_def_id,
        (v_row->'data'->v_field_name)
      );

      IF v_cell_value IS NULL THEN
        CONTINUE;
      END IF;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);

      IF v_field_type IN ('status', 'priority') AND v_field_prop_def_id IS NOT NULL THEN
        v_entity_props := v_entity_props || jsonb_build_object(v_field_prop_def_id::text, v_cell_value);
      END IF;
    END LOOP;

    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (v_table_id, v_data, v_order, p_created_by, p_created_by)
    RETURNING id INTO v_row_id;

    FOR v_prop_entry IN SELECT * FROM jsonb_each(v_entity_props) LOOP
      INSERT INTO public.entity_properties (
        entity_type,
        entity_id,
        property_definition_id,
        value,
        workspace_id
      )
      VALUES (
        'table_row',
        v_row_id,
        (v_prop_entry.key)::uuid,
        v_prop_entry.value,
        p_workspace_id
      )
      ON CONFLICT (entity_type, entity_id, property_definition_id)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now();
    END LOOP;

    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  result_table_id := v_table_id;
  result_fields_created := v_fields_created;
  result_rows_inserted := v_rows_inserted;
  RETURN NEXT;
END;
$$;

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
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_prop_def_id uuid;
  v_updates_by_id jsonb := '{}'::jsonb;
  v_filter_key text;
  v_filter_val jsonb;
  v_filter_text text;
  v_ids uuid[];
  v_ids_next uuid[];
  v_value jsonb;
  v_limit integer := COALESCE(p_limit, 500);
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.tables WHERE id = p_table_id;

  -- Resolve updates to field ids
  FOR v_filter_key, v_filter_val IN SELECT key, value FROM jsonb_each(COALESCE(p_updates, '{}'::jsonb)) LOOP
    v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
    IF v_field_id IS NULL THEN
      RAISE EXCEPTION 'Unknown field "%" in updates', v_filter_key;
    END IF;
    SELECT type, config, property_definition_id
    INTO v_field_type, v_field_config, v_field_prop_def_id
    FROM public.table_fields
    WHERE id = v_field_id;
    v_updates_by_id := v_updates_by_id || jsonb_build_object(
      v_field_id::text,
      public._resolve_field_value_with_property_def(v_field_type, v_field_config, v_field_prop_def_id, v_filter_val)
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
      updated_by = p_updated_by
  WHERE table_id = p_table_id AND id = ANY(v_ids);

  -- Sync status/priority updates to entity_properties
  FOR v_filter_key, v_value IN SELECT key, value FROM jsonb_each(v_updates_by_id) LOOP
    v_field_id := v_filter_key::uuid;
    SELECT type, property_definition_id INTO v_field_type, v_field_prop_def_id
    FROM public.table_fields
    WHERE id = v_field_id;

    IF v_field_type IN ('status', 'priority') AND v_field_prop_def_id IS NOT NULL THEN
      IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' OR trim(both '\"' from v_value::text) = '' THEN
        DELETE FROM public.entity_properties
        WHERE entity_type = 'table_row'
          AND entity_id = ANY(v_ids)
          AND property_definition_id = v_field_prop_def_id;
      ELSE
        INSERT INTO public.entity_properties (
          entity_type,
          entity_id,
          property_definition_id,
          value,
          workspace_id
        )
        SELECT
          'table_row',
          id,
          v_field_prop_def_id,
          v_value,
          v_workspace_id
        FROM unnest(v_ids) AS id
        ON CONFLICT (entity_type, entity_id, property_definition_id)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = now();
      END IF;
    END IF;
  END LOOP;

  updated := COALESCE(array_length(v_ids, 1), 0);
  row_ids := v_ids;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_insert_rows(
  p_table_id uuid,
  p_rows jsonb,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_row jsonb;
  v_data jsonb;
  v_order numeric;
  v_field_name text;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_prop_def_id uuid;
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
  v_row_id uuid;
  v_entity_props jsonb;
  v_prop_entry record;
  v_cell_value jsonb;
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.tables WHERE id = p_table_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_data := '{}'::jsonb;
    v_entity_props := '{}'::jsonb;
    v_order := NULL;
    IF v_row ? 'order' THEN
      BEGIN
        v_order := (v_row->>'order')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        v_order := NULL;
      END;
    END IF;
    FOR v_field_name, v_field_id IN
      SELECT key, public._resolve_table_field_id(p_table_id, key)
      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))
    LOOP
      IF v_field_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT type, config, property_definition_id
      INTO v_field_type, v_field_config, v_field_prop_def_id
      FROM public.table_fields
      WHERE id = v_field_id;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        v_field_prop_def_id,
        (v_row->'data'->v_field_name)
      );

      IF v_cell_value IS NULL THEN
        CONTINUE;
      END IF;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);

      IF v_field_type IN ('status', 'priority') AND v_field_prop_def_id IS NOT NULL THEN
        v_entity_props := v_entity_props || jsonb_build_object(v_field_prop_def_id::text, v_cell_value);
      END IF;
    END LOOP;
    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (p_table_id, v_data, v_order, p_created_by, p_created_by)
    RETURNING id INTO v_row_id;
    v_inserted_ids := v_inserted_ids || v_row_id;

    FOR v_prop_entry IN SELECT * FROM jsonb_each(v_entity_props) LOOP
      INSERT INTO public.entity_properties (
        entity_type,
        entity_id,
        property_definition_id,
        value,
        workspace_id
      )
      VALUES (
        'table_row',
        v_row_id,
        (v_prop_entry.key)::uuid,
        v_prop_entry.value,
        v_workspace_id
      )
      ON CONFLICT (entity_type, entity_id, property_definition_id)
      DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now();
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('inserted_ids', v_inserted_ids);
END;
$$;
