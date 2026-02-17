-- Allow source_entity_type = 'block' on table_rows, task_items, and timeline_events
-- so blocks can serve as source entities for tables, tasks, and timelines.

-- 1. table_rows: drop and re-add constraints to allow 'block'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND constraint_name = 'table_rows_source_entity_check'
  ) THEN
    ALTER TABLE public.table_rows DROP CONSTRAINT table_rows_source_entity_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'table_rows' AND constraint_name = 'table_rows_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.table_rows DROP CONSTRAINT table_rows_source_metadata_consistency;
  END IF;
END $$;

ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_entity_check
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL)
    OR (source_entity_type IN ('task', 'timeline_event', 'table_row', 'block') AND source_entity_id IS NOT NULL)
  );

ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR (
      source_entity_type IN ('task', 'timeline_event', 'table_row', 'block')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );

-- 2. task_items: replace source metadata consistency constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'task_items' AND constraint_name = 'task_items_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.task_items DROP CONSTRAINT task_items_source_metadata_consistency;
  END IF;
END $$;

ALTER TABLE public.task_items
  ADD CONSTRAINT task_items_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR (
      source_entity_type IN ('task', 'timeline_event', 'table_row', 'block')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );

-- 3. timeline_events: replace source metadata consistency constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'timeline_events' AND constraint_name = 'timeline_events_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.timeline_events DROP CONSTRAINT timeline_events_source_metadata_consistency;
  END IF;
END $$;

ALTER TABLE public.timeline_events
  ADD CONSTRAINT timeline_events_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR (
      source_entity_type IN ('task', 'timeline_event', 'table_row', 'block')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );

-- 4. create_task_full: treat block sources as snapshot-only (like table_row)
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
  p_created_by uuid,
  p_source_entity_type text DEFAULT NULL,
  p_source_entity_id uuid DEFAULT NULL,
  p_source_sync_mode text DEFAULT NULL
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
  v_effective_source_entity_type text;
  v_effective_source_entity_id uuid;
  v_effective_source_sync_mode text;
  v_effective_source_task_id uuid;
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

  IF p_source_entity_type IS NOT NULL AND p_source_entity_id IS NOT NULL THEN
    v_effective_source_entity_type := p_source_entity_type;
    v_effective_source_entity_id := p_source_entity_id;
    v_effective_source_sync_mode := CASE
      WHEN p_source_entity_type = 'table_row' THEN 'snapshot'
      WHEN p_source_entity_type = 'block' THEN 'snapshot'
      ELSE COALESCE(p_source_sync_mode, 'snapshot')
    END;

    IF p_source_entity_type = 'task' THEN
      v_effective_source_task_id := p_source_entity_id;
    END IF;
  END IF;

  INSERT INTO public.task_items (
    task_block_id, workspace_id, project_id, tab_id,
    title, status, priority, description, due_date, due_time, start_date,
    hide_icons, recurring_enabled, recurring_frequency, recurring_interval,
    source_task_id, source_entity_type, source_entity_id, source_sync_mode,
    created_by, updated_by
  ) VALUES (
    p_task_block_id, v_workspace_id, v_project_id, v_tab_id,
    p_title, COALESCE(p_status, 'todo'), COALESCE(p_priority, 'none'), p_description, p_due_date, p_due_time, p_start_date,
    COALESCE(p_hide_icons, false), COALESCE(p_recurring_enabled, false), p_recurring_frequency, p_recurring_interval,
    v_effective_source_task_id, v_effective_source_entity_type, v_effective_source_entity_id, v_effective_source_sync_mode,
    p_created_by, p_created_by
  ) RETURNING * INTO v_task;

  FOR v_assignee IN SELECT * FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LOOP
    INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
    VALUES (v_task.id, NULLIF(v_assignee->>'id','')::uuid, COALESCE(NULLIF(v_assignee->>'name',''), NULLIF(v_assignee->>'id',''), 'Unknown'));
  END LOOP;

  SELECT id INTO v_assignee_def
  FROM public.property_definitions
  WHERE workspace_id = v_workspace_id AND name = 'Assignee' AND type = 'person'
  LIMIT 1;

  IF v_assignee_def IS NOT NULL THEN
    SELECT * INTO v_primary_assignee FROM jsonb_array_elements(COALESCE(p_assignees, '[]'::jsonb)) LIMIT 1;
    IF v_primary_assignee IS NOT NULL THEN
      INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
      VALUES (v_workspace_id, 'task', v_task.id, v_assignee_def, jsonb_build_object('id', NULLIF(v_primary_assignee->>'id',''), 'name', COALESCE(NULLIF(v_primary_assignee->>'name',''), NULLIF(v_primary_assignee->>'id',''))))
      ON CONFLICT (entity_type, entity_id, property_definition_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    END IF;
  END IF;

  FOR v_tag IN SELECT trim(value::text) FROM jsonb_array_elements_text(COALESCE(p_tags, '[]'::jsonb)) LOOP
    IF v_tag IS NULL OR v_tag = '' THEN CONTINUE; END IF;
    SELECT id INTO v_tag_id FROM public.task_tags WHERE workspace_id = v_workspace_id AND name = v_tag LIMIT 1;
    IF v_tag_id IS NULL THEN
      INSERT INTO public.task_tags (workspace_id, name) VALUES (v_workspace_id, v_tag) RETURNING id INTO v_tag_id;
    END IF;
    INSERT INTO public.task_tag_links (task_id, tag_id) VALUES (v_task.id, v_tag_id) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_task;
END;
$$;

-- 5. sync_live_task_properties_to_source: snapshot-only for block-sourced tasks
CREATE OR REPLACE FUNCTION public.sync_live_task_properties_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_id uuid;
  v_workspace_id uuid;
  v_property_definition_id uuid;
  v_value jsonb;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.entity_type <> 'task' THEN RETURN OLD; END IF;
    v_entity_id := OLD.entity_id; v_workspace_id := OLD.workspace_id; v_property_definition_id := OLD.property_definition_id; v_value := NULL;
  ELSE
    IF NEW.entity_type <> 'task' THEN RETURN NEW; END IF;
    v_entity_id := NEW.entity_id; v_workspace_id := NEW.workspace_id; v_property_definition_id := NEW.property_definition_id; v_value := NEW.value;
  END IF;

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  FROM public.task_items WHERE id = v_entity_id;

  IF v_sync_mode <> 'live' THEN RETURN COALESCE(NEW, OLD); END IF;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  ELSIF v_source_task_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.entity_properties
    WHERE entity_type = 'task' AND entity_id = v_source_task_id AND property_definition_id = v_property_definition_id;
  ELSE
    INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
    VALUES (v_workspace_id, 'task', v_source_task_id, v_property_definition_id, v_value)
    ON CONFLICT (entity_type, entity_id, property_definition_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. sync_live_task_item_to_source: snapshot-only for block-sourced tasks
CREATE OR REPLACE FUNCTION public.sync_live_task_item_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  v_source_task_id := NEW.source_task_id;
  v_source_entity_type := NEW.source_entity_type;
  v_source_entity_id := NEW.source_entity_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN NEW;
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR NEW.source_sync_mode <> 'live' THEN RETURN NEW; END IF;
  IF v_source_task_id = NEW.id THEN RETURN NEW; END IF;

  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.status IS DISTINCT FROM OLD.status OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.description IS DISTINCT FROM OLD.description OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.due_time IS DISTINCT FROM OLD.due_time
     OR NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.hide_icons IS DISTINCT FROM OLD.hide_icons
     OR NEW.recurring_enabled IS DISTINCT FROM OLD.recurring_enabled OR NEW.recurring_frequency IS DISTINCT FROM OLD.recurring_frequency
     OR NEW.recurring_interval IS DISTINCT FROM OLD.recurring_interval OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    UPDATE public.task_items
    SET title = NEW.title, status = NEW.status, priority = NEW.priority, description = NEW.description,
        due_date = NEW.due_date, due_time = NEW.due_time, start_date = NEW.start_date, hide_icons = NEW.hide_icons,
        recurring_enabled = NEW.recurring_enabled, recurring_frequency = NEW.recurring_frequency, recurring_interval = NEW.recurring_interval,
        assignee_id = NEW.assignee_id, updated_by = NEW.updated_by, updated_at = now()
    WHERE id = v_source_task_id AND workspace_id = NEW.workspace_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. sync_live_task_assignees_to_source: snapshot-only for block-sourced tasks
CREATE OR REPLACE FUNCTION public.sync_live_task_assignees_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
  v_workspace_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode, workspace_id
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode, v_workspace_id
  FROM public.task_items WHERE id = v_task_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN RETURN COALESCE(NEW, OLD); END IF;

  DELETE FROM public.task_assignees WHERE task_id = v_source_task_id;
  INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
  SELECT v_source_task_id, assignee_id, assignee_name FROM public.task_assignees WHERE task_id = v_task_id;

  UPDATE public.task_items
  SET assignee_id = (SELECT assignee_id FROM public.task_assignees WHERE task_id = v_task_id LIMIT 1), updated_at = now()
  WHERE id = v_source_task_id AND workspace_id = v_workspace_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8. sync_live_task_tags_to_source: snapshot-only for block-sourced tasks
CREATE OR REPLACE FUNCTION public.sync_live_task_tags_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  FROM public.task_items WHERE id = v_task_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN RETURN COALESCE(NEW, OLD); END IF;

  DELETE FROM public.task_tag_links WHERE task_id = v_source_task_id;
  INSERT INTO public.task_tag_links (task_id, tag_id)
  SELECT v_source_task_id, tag_id FROM public.task_tag_links WHERE task_id = v_task_id ON CONFLICT DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 9. duplicate_tasks_to_block: preserve block source metadata (same as table_row)
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
  FROM public.task_items WHERE task_block_id = p_target_block_id;

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
      source_task_id, source_entity_type, source_entity_id, source_sync_mode,
      created_by, updated_by
    )
    VALUES (
      p_target_block_id, p_workspace_id, p_project_id, p_tab_id,
      v_task.title, v_task.status, v_task.priority, v_task.description, v_task.due_date, v_task.due_time, v_task.start_date,
      v_task.hide_icons, v_max_order, v_task.recurring_enabled, v_task.recurring_frequency, v_task.recurring_interval,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN NULL
        WHEN v_task.source_entity_type = 'block' AND v_task.source_entity_id IS NOT NULL THEN NULL
        ELSE v_task.id
      END,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN 'table_row'
        WHEN v_task.source_entity_type = 'block' AND v_task.source_entity_id IS NOT NULL THEN 'block'
        ELSE 'task'
      END,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN v_task.source_entity_id
        WHEN v_task.source_entity_type = 'block' AND v_task.source_entity_id IS NOT NULL THEN v_task.source_entity_id
        ELSE v_task.id
      END,
      'snapshot',
      p_created_by, p_created_by
    )
    RETURNING id INTO v_new_id;

    v_created_ids := v_created_ids || v_new_id;

    IF p_include_assignees THEN
      FOR v_assignees IN SELECT * FROM public.task_assignees WHERE task_id = v_task.id LOOP
        INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
        VALUES (v_new_id, v_assignees.assignee_id, v_assignees.assignee_name);
      END LOOP;
      IF v_assignee_def IS NOT NULL THEN
        SELECT * INTO v_assignees FROM public.task_assignees WHERE task_id = v_new_id LIMIT 1;
        IF v_assignees.task_id IS NOT NULL THEN
          INSERT INTO public.entity_properties (workspace_id, entity_type, entity_id, property_definition_id, value)
          VALUES (p_workspace_id, 'task', v_new_id, v_assignee_def, jsonb_build_object('id', v_assignees.assignee_id, 'name', COALESCE(v_assignees.assignee_name, v_assignees.assignee_id::text)))
          ON CONFLICT (entity_type, entity_id, property_definition_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
        END IF;
      END IF;
    END IF;

    IF p_include_tags THEN
      FOR v_tag_links IN SELECT * FROM public.task_tag_links WHERE task_id = v_task.id LOOP
        INSERT INTO public.task_tag_links (task_id, tag_id) VALUES (v_new_id, v_tag_links.tag_id) ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', COALESCE(array_length(v_created_ids, 1), 0),
    'created_task_ids', v_created_ids,
    'skipped', ARRAY(SELECT id FROM unnest(p_task_ids) AS id WHERE NOT EXISTS (SELECT 1 FROM public.task_items t WHERE t.id = id AND t.workspace_id = p_workspace_id))
  );
END;
$$;
