-- Super-tool + bulk RPC functions (tasks + tables)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._resolve_table_field_id(
  p_table_id uuid,
  p_key text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_field_id uuid;
BEGIN
  -- Try direct UUID
  BEGIN
    v_field_id := p_key::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_field_id := NULL;
  END;

  IF v_field_id IS NOT NULL THEN
    SELECT id INTO v_field_id
    FROM public.table_fields
    WHERE table_id = p_table_id AND id = v_field_id;
    IF FOUND THEN
      RETURN v_field_id;
    END IF;
  END IF;

  -- Try by name (case-insensitive)
  SELECT id INTO v_field_id
  FROM public.table_fields
  WHERE table_id = p_table_id AND lower(name) = lower(p_key)
  LIMIT 1;

  RETURN v_field_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._resolve_option_id(
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
    RETURN p_value;
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

  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public._resolve_field_value(
  p_field_type text,
  p_config jsonb,
  p_value jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_options jsonb;
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_field_type IN ('select', 'status', 'priority', 'multi_select') THEN
    IF p_field_type = 'priority' THEN
      v_options := p_config->'levels';
    ELSE
      v_options := p_config->'options';
    END IF;

    IF jsonb_typeof(p_value) = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_value) LOOP
        v_result := v_result || jsonb_build_array(public._resolve_option_id(v_options, v_item));
      END LOOP;
      RETURN v_result;
    END IF;

    RETURN public._resolve_option_id(v_options, p_value);
  END IF;

  RETURN p_value;
END;
$$;

-- ---------------------------------------------------------------------------
-- Table RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_table_full(
  p_workspace_id uuid,
  p_project_id uuid,
  p_title text,
  p_description text,
  p_created_by uuid,
  p_fields jsonb DEFAULT '[]'::jsonb,
  p_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  table_id uuid,
  fields_created integer,
  rows_inserted integer
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
  v_default_count int := 0;
BEGIN
  INSERT INTO public.tables (workspace_id, project_id, title, description, created_by)
  VALUES (p_workspace_id, p_project_id, COALESCE(p_title, 'Untitled Table'), p_description, p_created_by)
  RETURNING id INTO v_table_id;

  -- Default fields
  INSERT INTO public.table_fields (table_id, name, type, is_primary, "order")
  VALUES
    (v_table_id, 'Name', 'text', true, 1),
    (v_table_id, 'Column 2', 'text', false, 2),
    (v_table_id, 'Column 3', 'text', false, 3);

  -- Default rows
  INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
  VALUES
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  -- Default view
  INSERT INTO public.table_views (table_id, name, type, is_default, created_by, config)
  VALUES (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  -- Extra fields
  FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    v_field_name := trim(both ' ' from COALESCE(v_field->>'name', ''));
    IF v_field_name = '' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.table_fields
      WHERE table_id = v_table_id AND lower(name) = lower(v_field_name)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.table_fields (table_id, name, type, config, is_primary)
    VALUES (
      v_table_id,
      v_field_name,
      COALESCE(v_field->>'type', 'text'),
      v_field->'config',
      COALESCE((v_field->>'isPrimary')::boolean, false)
    );
    v_fields_created := v_fields_created + 1;
  END LOOP;

  -- Rows (optional)
  v_has_rows := jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0;
  IF v_has_rows THEN
    SELECT count(*) INTO v_default_count FROM public.table_rows WHERE table_id = v_table_id;
    IF v_default_count <= 3 THEN
      DELETE FROM public.table_rows
      WHERE table_id = v_table_id AND (data IS NULL OR data = '{}'::jsonb);
    END IF;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_data := '{}'::jsonb;
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

      SELECT type, config INTO v_field_type, v_field_config
      FROM public.table_fields
      WHERE id = v_field_id;

      IF v_field_type IN ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') THEN
        CONTINUE;
      END IF;

      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    END LOOP;

    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (v_table_id, v_data, v_order, p_created_by, p_created_by);
    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  table_id := v_table_id;
  fields_created := v_fields_created;
  rows_inserted := v_rows_inserted;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_table_full(
  p_table_id uuid,
  p_title text,
  p_description text,
  p_updated_by uuid,
  p_add_fields jsonb DEFAULT '[]'::jsonb,
  p_update_fields jsonb DEFAULT '[]'::jsonb,
  p_delete_fields jsonb DEFAULT '[]'::jsonb,
  p_insert_rows jsonb DEFAULT '[]'::jsonb,
  p_update_rows jsonb DEFAULT NULL,
  p_delete_row_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_field_id uuid;
  v_field_name text;
  v_updates jsonb;
  v_filters jsonb;
  v_result jsonb := '{}'::jsonb;
  v_fields_added int := 0;
  v_fields_updated int := 0;
  v_fields_deleted int := 0;
  v_rows_inserted int := 0;
  v_rows_updated int := 0;
  v_rows_deleted int := 0;
BEGIN
  IF p_title IS NOT NULL OR p_description IS NOT NULL THEN
    UPDATE public.tables
    SET title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        updated_at = now()
    WHERE id = p_table_id;
  END IF;

  -- Add fields
  FOR v_field IN SELECT * FROM jsonb_array_elements(p_add_fields) LOOP
    v_field_name := trim(both ' ' from COALESCE(v_field->>'name', ''));
    IF v_field_name = '' THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.table_fields
      WHERE table_id = p_table_id AND lower(name) = lower(v_field_name)
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.table_fields (table_id, name, type, config, is_primary)
    VALUES (
      p_table_id,
      v_field_name,
      COALESCE(v_field->>'type', 'text'),
      v_field->'config',
      COALESCE((v_field->>'isPrimary')::boolean, false)
    );
    v_fields_added := v_fields_added + 1;
  END LOOP;

  -- Update fields
  FOR v_field IN SELECT * FROM jsonb_array_elements(p_update_fields) LOOP
    v_field_id := NULL;
    v_field_name := COALESCE(v_field->>'fieldId', NULL);
    IF v_field_name IS NOT NULL THEN
      BEGIN
        v_field_id := v_field_name::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_field_id := NULL;
      END;
    END IF;
    IF v_field_id IS NULL AND v_field ? 'fieldName' THEN
      v_field_id := public._resolve_table_field_id(p_table_id, v_field->>'fieldName');
    END IF;
    IF v_field_id IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE public.table_fields
    SET name = COALESCE(v_field->>'name', name),
        config = COALESCE(v_field->'config', config),
        updated_at = now()
    WHERE id = v_field_id;
    v_fields_updated := v_fields_updated + 1;
  END LOOP;

  -- Delete fields (by id or name)
  FOR v_field_name IN SELECT * FROM jsonb_array_elements_text(COALESCE(p_delete_fields, '[]'::jsonb)) LOOP
    v_field_id := public._resolve_table_field_id(p_table_id, v_field_name);
    IF v_field_id IS NULL THEN
      CONTINUE;
    END IF;
    DELETE FROM public.table_fields WHERE id = v_field_id;
    v_fields_deleted := v_fields_deleted + 1;
  END LOOP;

  -- Insert rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_insert_rows) LOOP
    v_data := '{}'::jsonb;
    FOR v_field_name, v_field_id IN
      SELECT key, public._resolve_table_field_id(p_table_id, key)
      FROM jsonb_each(COALESCE(v_row->'data', '{}'::jsonb))
    LOOP
      IF v_field_id IS NULL THEN
        CONTINUE;
      END IF;
      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    END LOOP;
    INSERT INTO public.table_rows (table_id, data, created_by, updated_by)
    VALUES (p_table_id, v_data, p_updated_by, p_updated_by);
    v_rows_inserted := v_rows_inserted + 1;
  END LOOP;

  -- Update rows (filters + updates)
  IF p_update_rows IS NOT NULL THEN
    v_filters := p_update_rows->'filters';
    v_updates := p_update_rows->'updates';
    IF v_updates IS NOT NULL THEN
      SELECT updated, row_ids INTO v_rows_updated, v_row_ids
      FROM public.update_table_rows_by_field_names(p_table_id, v_filters, v_updates, NULL, p_updated_by)
      LIMIT 1;
    END IF;
  END IF;

  -- Delete rows
  IF jsonb_typeof(p_delete_row_ids) = 'array' AND jsonb_array_length(p_delete_row_ids) > 0 THEN
    DELETE FROM public.table_rows
    WHERE table_id = p_table_id AND id IN (
      SELECT (value::text)::uuid FROM jsonb_array_elements_text(p_delete_row_ids)
    );
    GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  END IF;

  v_result := v_result || jsonb_build_object('fieldsAdded', v_fields_added);
  v_result := v_result || jsonb_build_object('fieldsUpdated', v_fields_updated);
  v_result := v_result || jsonb_build_object('fieldsDeleted', v_fields_deleted);
  v_result := v_result || jsonb_build_object('rowsInserted', v_rows_inserted);
  v_result := v_result || jsonb_build_object('rowsUpdated', v_rows_updated);
  v_result := v_result || jsonb_build_object('rowsDeleted', v_rows_deleted);

  RETURN v_result;
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
  v_updates_by_id jsonb := '{}'::jsonb;
  v_filter_key text;
  v_filter_val jsonb;
  v_filter_text text;
  v_ids uuid[];
  v_ids_next uuid[];
  v_value text;
  v_limit integer := COALESCE(p_limit, 500);
BEGIN
  -- Resolve updates to field ids
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
      updated_by = p_updated_by
  WHERE table_id = p_table_id AND id = ANY(v_ids);

  updated := COALESCE(array_length(v_ids, 1), 0);
  row_ids := v_ids;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_rows_by_field_names(
  p_table_id uuid,
  p_rows jsonb,
  p_limit integer,
  p_updated_by uuid
)
RETURNS TABLE (updated integer, row_ids uuid[])
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry jsonb;
  v_filters jsonb;
  v_updates jsonb;
  v_row_ids uuid[];
  v_total_ids uuid[] := ARRAY[]::uuid[];
  v_total int := 0;
BEGIN
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_filters := v_entry->'filters';
    v_updates := v_entry->'updates';
    IF v_updates IS NULL THEN
      CONTINUE;
    END IF;
    SELECT updated, row_ids INTO v_total, v_row_ids
    FROM public.update_table_rows_by_field_names(p_table_id, v_filters, v_updates, p_limit, p_updated_by)
    LIMIT 1;
    IF v_row_ids IS NOT NULL THEN
      v_total_ids := v_total_ids || v_row_ids;
      v_total_ids := ARRAY(SELECT DISTINCT unnest(v_total_ids));
    END IF;
  END LOOP;

  updated := COALESCE(array_length(v_total_ids, 1), 0);
  row_ids := v_total_ids;
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
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_data := '{}'::jsonb;
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
      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    END LOOP;
    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (p_table_id, v_data, v_order, p_created_by, p_created_by)
    RETURNING id INTO v_field_id;
    v_inserted_ids := v_inserted_ids || v_field_id;
  END LOOP;

  RETURN jsonb_build_object('inserted_ids', v_inserted_ids);
END;
$$;

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
      updated_by = p_updated_by
  WHERE table_id = p_table_id AND id = ANY(p_row_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_delete_rows(
  p_table_id uuid,
  p_row_ids uuid[],
  p_updated_by uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rel record;
  v_row record;
BEGIN
  -- Delete rows
  DELETE FROM public.table_rows
  WHERE table_id = p_table_id AND id = ANY(p_row_ids);

  -- Clean up relation references (remove deleted ids from relation arrays)
  FOR v_rel IN
    SELECT from_row_id, from_field_id, to_row_id, from_table_id
    FROM public.table_relations
    WHERE to_row_id = ANY(p_row_ids)
  LOOP
    SELECT data INTO v_row FROM public.table_rows WHERE id = v_rel.from_row_id;
    IF v_row.data IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE public.table_rows
    SET data = jsonb_set(
      v_row.data,
      ARRAY[v_rel.from_field_id::text],
      (
        SELECT to_jsonb(
          ARRAY(
            SELECT value::text
            FROM jsonb_array_elements_text(COALESCE(v_row.data->v_rel.from_field_id::text, '[]'::jsonb))
            WHERE value::uuid <> v_rel.to_row_id
          )
        )
      ),
      true
    ),
    updated_by = p_updated_by
    WHERE id = v_rel.from_row_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_duplicate_rows(
  p_table_id uuid,
  p_row_ids uuid[],
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows record;
  v_idx int := 0;
BEGIN
  FOR v_rows IN
    SELECT * FROM public.table_rows
    WHERE table_id = p_table_id AND id = ANY(p_row_ids)
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.table_rows (table_id, data, "order", created_by, updated_by)
    VALUES (v_rows.table_id, v_rows.data, COALESCE(v_rows."order", 0) + (0.001 * v_idx), p_created_by, p_created_by);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Task RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_task_full(
  p_task_block_id uuid,
  p_title text,
  p_status text,
  p_priority text,
  p_description text,
  p_due_date date,
  p_due_time time,
  p_start_date date,
  p_hide_icons boolean,
  p_recurring_enabled boolean,
  p_recurring_frequency text,
  p_recurring_interval integer,
  p_assignees jsonb,
  p_tags jsonb,
  p_created_by uuid
)
RETURNS public.task_items
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.task_items;
  v_workspace_id uuid;
  v_project_id uuid;
  v_tab_id uuid;
  v_assignee jsonb;
  v_assignee_def uuid;
  v_primary_assignee jsonb;
  v_tag text;
  v_tag_id uuid;
BEGIN
  SELECT b.tab_id, t.project_id, p.workspace_id
  INTO v_tab_id, v_project_id, v_workspace_id
  FROM public.blocks b
  JOIN public.tabs t ON t.id = b.tab_id
  JOIN public.projects p ON p.id = t.project_id
  WHERE b.id = p_task_block_id AND b.type = 'task'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Task block not found';
  END IF;

  INSERT INTO public.task_items (
    task_block_id,
    workspace_id,
    project_id,
    tab_id,
    title,
    status,
    priority,
    description,
    due_date,
    due_time,
    start_date,
    hide_icons,
    recurring_enabled,
    recurring_frequency,
    recurring_interval,
    created_by,
    updated_by
  ) VALUES (
    p_task_block_id,
    v_workspace_id,
    v_project_id,
    v_tab_id,
    p_title,
    COALESCE(p_status, 'todo'),
    COALESCE(p_priority, 'none'),
    p_description,
    p_due_date,
    p_due_time,
    p_start_date,
    COALESCE(p_hide_icons, false),
    COALESCE(p_recurring_enabled, false),
    p_recurring_frequency,
    p_recurring_interval,
    p_created_by,
    p_created_by
  ) RETURNING * INTO v_task;

  -- Assignees
  FOR v_assignee IN SELECT * FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LOOP
    INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
    VALUES (
      v_task.id,
      NULLIF(v_assignee->>'id','')::uuid,
      COALESCE(NULLIF(v_assignee->>'name',''), NULLIF(v_assignee->>'id',''), 'Unknown')
    );
  END LOOP;

  -- Sync primary assignee to entity_properties if definition exists
  SELECT id INTO v_assignee_def
  FROM public.property_definitions
  WHERE workspace_id = v_workspace_id AND name = 'Assignee' AND type = 'person'
  LIMIT 1;

  IF v_assignee_def IS NOT NULL THEN
    SELECT * INTO v_primary_assignee FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LIMIT 1;
    IF v_primary_assignee IS NOT NULL THEN
      INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
      VALUES (
        v_workspace_id,
        'task',
        v_task.id,
        v_assignee_def,
        jsonb_build_object(
          'id', NULLIF(v_primary_assignee->>'id',''),
          'name', COALESCE(NULLIF(v_primary_assignee->>'name',''), NULLIF(v_primary_assignee->>'id',''))
        )
      )
      ON CONFLICT (entity_type, entity_id, property_definition_id)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    END IF;
  END IF;

  -- Tags
  FOR v_tag IN SELECT trim(value::text) FROM jsonb_array_elements_text(COALESCE(p_tags, '[]'::jsonb)) LOOP
    IF v_tag IS NULL OR v_tag = '' THEN
      CONTINUE;
    END IF;
    SELECT id INTO v_tag_id
    FROM public.task_tags
    WHERE workspace_id = v_workspace_id AND name = v_tag
    LIMIT 1;
    IF v_tag_id IS NULL THEN
      INSERT INTO public.task_tags (workspace_id, name)
      VALUES (v_workspace_id, v_tag)
      RETURNING id INTO v_tag_id;
    END IF;
    INSERT INTO public.task_tag_links (task_id, tag_id)
    VALUES (v_task.id, v_tag_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_task_full(
  p_task_id uuid,
  p_updates jsonb,
  p_assignees jsonb,
  p_assignees_set boolean,
  p_tags jsonb,
  p_tags_set boolean,
  p_updated_by uuid
)
RETURNS public.task_items
LANGUAGE plpgsql
AS $$
DECLARE
  v_task public.task_items;
  v_workspace_id uuid;
  v_assignee_def uuid;
  v_primary_assignee jsonb;
  v_tag text;
  v_tag_id uuid;
  v_existing_tags uuid[];
  v_desired_tags uuid[] := ARRAY[]::uuid[];
BEGIN
  UPDATE public.task_items
  SET
    title = COALESCE(p_updates->>'title', title),
    status = COALESCE(p_updates->>'status', status),
    priority = COALESCE(p_updates->>'priority', priority),
    description = COALESCE(p_updates->>'description', description),
    due_date = COALESCE((p_updates->>'dueDate')::date, due_date),
    due_time = COALESCE((p_updates->>'dueTime')::time, due_time),
    start_date = COALESCE((p_updates->>'startDate')::date, start_date),
    hide_icons = COALESCE((p_updates->>'hideIcons')::boolean, hide_icons),
    recurring_enabled = COALESCE((p_updates->>'recurringEnabled')::boolean, recurring_enabled),
    recurring_frequency = COALESCE(p_updates->>'recurringFrequency', recurring_frequency),
    recurring_interval = COALESCE((p_updates->>'recurringInterval')::integer, recurring_interval),
    updated_by = p_updated_by
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_workspace_id := v_task.workspace_id;

  IF p_assignees_set THEN
    DELETE FROM public.task_assignees WHERE task_id = p_task_id;
    FOR v_primary_assignee IN SELECT * FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LOOP
      INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
      VALUES (
        p_task_id,
        NULLIF(v_primary_assignee->>'id','')::uuid,
        COALESCE(NULLIF(v_primary_assignee->>'name',''), NULLIF(v_primary_assignee->>'id',''), 'Unknown')
      );
    END LOOP;

    SELECT id INTO v_assignee_def
    FROM public.property_definitions
    WHERE workspace_id = v_workspace_id AND name = 'Assignee' AND type = 'person'
    LIMIT 1;

    IF v_assignee_def IS NOT NULL THEN
      SELECT * INTO v_primary_assignee FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LIMIT 1;
      IF v_primary_assignee IS NOT NULL THEN
        INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
        VALUES (
          v_workspace_id,
          'task',
          p_task_id,
          v_assignee_def,
          jsonb_build_object(
            'id', NULLIF(v_primary_assignee->>'id',''),
            'name', COALESCE(NULLIF(v_primary_assignee->>'name',''), NULLIF(v_primary_assignee->>'id',''))
          )
        )
        ON CONFLICT (entity_type, entity_id, property_definition_id)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      ELSE
        DELETE FROM public.entity_properties
        WHERE workspace_id = v_workspace_id
          AND entity_type = 'task'
          AND entity_id = p_task_id
          AND property_definition_id = v_assignee_def;
      END IF;
    END IF;
  END IF;

  IF p_tags_set THEN
    SELECT array_agg(tag_id) INTO v_existing_tags
    FROM public.task_tag_links
    WHERE task_id = p_task_id;

    FOR v_tag IN SELECT trim(value::text) FROM jsonb_array_elements_text(COALESCE(p_tags, '[]'::jsonb)) LOOP
      IF v_tag IS NULL OR v_tag = '' THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_tag_id
      FROM public.task_tags
      WHERE workspace_id = v_workspace_id AND name = v_tag
      LIMIT 1;
      IF v_tag_id IS NULL THEN
        INSERT INTO public.task_tags (workspace_id, name)
        VALUES (v_workspace_id, v_tag)
        RETURNING id INTO v_tag_id;
      END IF;
      v_desired_tags := v_desired_tags || v_tag_id;
    END LOOP;

    -- Insert missing
    INSERT INTO public.task_tag_links (task_id, tag_id)
    SELECT p_task_id, t
    FROM unnest(v_desired_tags) AS t
    WHERE NOT (t = ANY(COALESCE(v_existing_tags, ARRAY[]::uuid[])))
    ON CONFLICT DO NOTHING;

    -- Delete removed
    DELETE FROM public.task_tag_links
    WHERE task_id = p_task_id
      AND tag_id = ANY(COALESCE(v_existing_tags, ARRAY[]::uuid[]))
      AND NOT (tag_id = ANY(v_desired_tags));
  END IF;

  RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_update_task_items(
  p_task_ids uuid[],
  p_updates jsonb,
  p_updated_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id uuid;
  v_valid_ids uuid[];
  v_skipped uuid[];
  v_updated_count int := 0;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.task_items
  WHERE id = p_task_ids[1];

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('updated_count', 0, 'skipped', p_task_ids);
  END IF;

  SELECT array_agg(id) INTO v_valid_ids
  FROM public.task_items
  WHERE id = ANY(p_task_ids) AND workspace_id = v_workspace_id;

  v_skipped := ARRAY(
    SELECT id FROM unnest(p_task_ids) AS id
    WHERE NOT (id = ANY(COALESCE(v_valid_ids, ARRAY[]::uuid[])))
  );

  IF v_valid_ids IS NOT NULL THEN
    UPDATE public.task_items
    SET
      title = COALESCE(p_updates->>'title', title),
      status = COALESCE(p_updates->>'status', status),
      priority = COALESCE(p_updates->>'priority', priority),
      description = COALESCE(p_updates->>'description', description),
      due_date = COALESCE((p_updates->>'dueDate')::date, due_date),
      due_time = COALESCE((p_updates->>'dueTime')::time, due_time),
      start_date = COALESCE((p_updates->>'startDate')::date, start_date),
      hide_icons = COALESCE((p_updates->>'hideIcons')::boolean, hide_icons),
      recurring_enabled = COALESCE((p_updates->>'recurringEnabled')::boolean, recurring_enabled),
      recurring_frequency = COALESCE(p_updates->>'recurringFrequency', recurring_frequency),
      recurring_interval = COALESCE((p_updates->>'recurringInterval')::integer, recurring_interval),
      updated_by = p_updated_by
    WHERE id = ANY(v_valid_ids);
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('updated_count', v_updated_count, 'skipped', COALESCE(v_skipped, ARRAY[]::uuid[]));
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_move_task_items(
  p_task_ids uuid[],
  p_target_block_id uuid,
  p_tab_id uuid,
  p_project_id uuid,
  p_workspace_id uuid,
  p_updated_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_skipped uuid[];
  v_max_order int := 0;
  v_moved int := 0;
BEGIN
  SELECT COALESCE(max(display_order), -1) INTO v_max_order
  FROM public.task_items
  WHERE task_block_id = p_target_block_id;

  WITH ordered AS (
    SELECT id, row_number() OVER () AS rn
    FROM unnest(p_task_ids) AS id
  )
  UPDATE public.task_items t
  SET
    task_block_id = p_target_block_id,
    tab_id = p_tab_id,
    project_id = p_project_id,
    workspace_id = p_workspace_id,
    display_order = v_max_order + ordered.rn,
    updated_by = p_updated_by
  FROM ordered
  WHERE t.id = ordered.id AND t.workspace_id = p_workspace_id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  v_skipped := ARRAY(
    SELECT id FROM unnest(p_task_ids) AS id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.task_items t WHERE t.id = id AND t.workspace_id = p_workspace_id
    )
  );

  RETURN jsonb_build_object('moved_count', v_moved, 'skipped', COALESCE(v_skipped, ARRAY[]::uuid[]));
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_set_task_assignees(
  p_task_ids uuid[],
  p_assignees jsonb,
  p_updated_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_workspace_id uuid;
  v_assignee_def uuid;
  v_primary_assignee jsonb;
BEGIN
  -- Determine workspace from first task
  SELECT workspace_id INTO v_workspace_id
  FROM public.task_items
  WHERE id = p_task_ids[1];

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('updated_count', 0);
  END IF;

  SELECT id INTO v_assignee_def
  FROM public.property_definitions
  WHERE workspace_id = v_workspace_id AND name = 'Assignee' AND type = 'person'
  LIMIT 1;

  FOREACH v_task_id IN ARRAY p_task_ids LOOP
    DELETE FROM public.task_assignees WHERE task_id = v_task_id;
    FOR v_primary_assignee IN SELECT * FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LOOP
      INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
      VALUES (
        v_task_id,
        NULLIF(v_primary_assignee->>'id','')::uuid,
        COALESCE(NULLIF(v_primary_assignee->>'name',''), NULLIF(v_primary_assignee->>'id',''), 'Unknown')
      );
    END LOOP;

    IF v_assignee_def IS NOT NULL THEN
      SELECT * INTO v_primary_assignee FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LIMIT 1;
      IF v_primary_assignee IS NOT NULL THEN
        INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
        VALUES (
          v_workspace_id,
          'task',
          v_task_id,
          v_assignee_def,
          jsonb_build_object(
            'id', NULLIF(v_primary_assignee->>'id',''),
            'name', COALESCE(NULLIF(v_primary_assignee->>'name',''), NULLIF(v_primary_assignee->>'id',''))
          )
        )
        ON CONFLICT (entity_type, entity_id, property_definition_id)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      ELSE
        DELETE FROM public.entity_properties
        WHERE workspace_id = v_workspace_id
          AND entity_type = 'task'
          AND entity_id = v_task_id
          AND property_definition_id = v_assignee_def;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('updated_count', array_length(p_task_ids, 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.duplicate_tasks_to_block(
  p_task_ids uuid[],
  p_target_block_id uuid,
  p_tab_id uuid,
  p_project_id uuid,
  p_workspace_id uuid,
  p_include_assignees boolean,
  p_include_tags boolean,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_order int := 0;
  v_created_ids uuid[] := ARRAY[]::uuid[];
  v_task record;
  v_new_id uuid;
  v_assignee_def uuid;
  v_assignees record;
  v_tag_links record;
BEGIN
  SELECT COALESCE(max(display_order), -1) INTO v_max_order
  FROM public.task_items
  WHERE task_block_id = p_target_block_id;

  SELECT id INTO v_assignee_def
  FROM public.property_definitions
  WHERE workspace_id = p_workspace_id AND name = 'Assignee' AND type = 'person'
  LIMIT 1;

  FOR v_task IN
    SELECT * FROM public.task_items
    WHERE id = ANY(p_task_ids) AND workspace_id = p_workspace_id
    ORDER BY array_position(p_task_ids, id)
  LOOP
    v_max_order := v_max_order + 1;
    INSERT INTO public.task_items (
      task_block_id, workspace_id, project_id, tab_id,
      title, status, priority, description, due_date, due_time, start_date,
      hide_icons, display_order, recurring_enabled, recurring_frequency, recurring_interval,
      created_by, updated_by
    )
    VALUES (
      p_target_block_id, p_workspace_id, p_project_id, p_tab_id,
      v_task.title, v_task.status, v_task.priority, v_task.description, v_task.due_date, v_task.due_time, v_task.start_date,
      v_task.hide_icons, v_max_order, v_task.recurring_enabled, v_task.recurring_frequency, v_task.recurring_interval,
      p_created_by, p_created_by
    )
    RETURNING id INTO v_new_id;

    v_created_ids := v_created_ids || v_new_id;

    IF p_include_assignees THEN
      FOR v_assignees IN
        SELECT * FROM public.task_assignees WHERE task_id = v_task.id
      LOOP
        INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
        VALUES (v_new_id, v_assignees.assignee_id, v_assignees.assignee_name);
      END LOOP;
      IF v_assignee_def IS NOT NULL THEN
        SELECT * INTO v_assignees FROM public.task_assignees WHERE task_id = v_new_id LIMIT 1;
        IF v_assignees.task_id IS NOT NULL THEN
          INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
          VALUES (
            p_workspace_id,
            'task',
            v_new_id,
            v_assignee_def,
            jsonb_build_object(
              'id', v_assignees.assignee_id,
              'name', COALESCE(v_assignees.assignee_name, v_assignees.assignee_id::text)
            )
          )
          ON CONFLICT (entity_type, entity_id, property_definition_id)
          DO UPDATE SET value = EXCLUDED.value, updated_at = now();
        END IF;
      END IF;
    END IF;

    IF p_include_tags THEN
      FOR v_tag_links IN
        SELECT * FROM public.task_tag_links WHERE task_id = v_task.id
      LOOP
        INSERT INTO public.task_tag_links (task_id, tag_id)
        VALUES (v_new_id, v_tag_links.tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', COALESCE(array_length(v_created_ids, 1), 0),
    'created_task_ids', v_created_ids,
    'skipped', ARRAY(
      SELECT id FROM unnest(p_task_ids) AS id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.task_items t WHERE t.id = id AND t.workspace_id = p_workspace_id
      )
    )
  );
END;
$$;
