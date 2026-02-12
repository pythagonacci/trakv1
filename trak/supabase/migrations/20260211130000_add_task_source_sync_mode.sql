-- Add source-of-truth metadata for copied tasks and optional live-sync behavior.

ALTER TABLE public.task_items
  ADD COLUMN IF NOT EXISTS source_task_id uuid,
  ADD COLUMN IF NOT EXISTS source_sync_mode text;

ALTER TABLE public.task_items
  ALTER COLUMN source_sync_mode SET DEFAULT 'snapshot';

UPDATE public.task_items
SET source_sync_mode = 'snapshot'
WHERE source_sync_mode IS NULL;

ALTER TABLE public.task_items
  ALTER COLUMN source_sync_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'task_items_source_sync_mode_check'
      AND table_schema = 'public'
      AND table_name = 'task_items'
  ) THEN
    ALTER TABLE public.task_items
      ADD CONSTRAINT task_items_source_sync_mode_check
      CHECK (source_sync_mode IN ('snapshot', 'live'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'task_items_source_task_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'task_items'
  ) THEN
    ALTER TABLE public.task_items
      ADD CONSTRAINT task_items_source_task_id_fkey
      FOREIGN KEY (source_task_id) REFERENCES public.task_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_items_source_task_id
  ON public.task_items(source_task_id)
  WHERE source_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_items_sync_mode
  ON public.task_items(source_sync_mode)
  WHERE source_task_id IS NOT NULL;

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
      source_task_id, source_sync_mode,
      created_by, updated_by
    )
    VALUES (
      p_target_block_id, p_workspace_id, p_project_id, p_tab_id,
      v_task.title, v_task.status, v_task.priority, v_task.description, v_task.due_date, v_task.due_time, v_task.start_date,
      v_task.hide_icons, v_max_order, v_task.recurring_enabled, v_task.recurring_frequency, v_task.recurring_interval,
      v_task.id, 'snapshot',
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

CREATE OR REPLACE FUNCTION public.sync_live_task_item_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.source_task_id IS NULL OR NEW.source_sync_mode <> 'live' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_task_id = NEW.id THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.priority IS NOT DISTINCT FROM OLD.priority
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date
     AND NEW.due_time IS NOT DISTINCT FROM OLD.due_time
     AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
     AND NEW.hide_icons IS NOT DISTINCT FROM OLD.hide_icons
     AND NEW.recurring_enabled IS NOT DISTINCT FROM OLD.recurring_enabled
     AND NEW.recurring_frequency IS NOT DISTINCT FROM OLD.recurring_frequency
     AND NEW.recurring_interval IS NOT DISTINCT FROM OLD.recurring_interval
     AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.task_items
  SET title = NEW.title,
      status = NEW.status,
      priority = NEW.priority,
      description = NEW.description,
      due_date = NEW.due_date,
      due_time = NEW.due_time,
      start_date = NEW.start_date,
      hide_icons = NEW.hide_icons,
      recurring_enabled = NEW.recurring_enabled,
      recurring_frequency = NEW.recurring_frequency,
      recurring_interval = NEW.recurring_interval,
      assignee_id = NEW.assignee_id,
      updated_by = NEW.updated_by,
      updated_at = now()
  WHERE id = NEW.source_task_id
    AND workspace_id = NEW.workspace_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_live_task_assignees_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_source_task_id uuid;
  v_sync_mode text;
  v_workspace_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_sync_mode, workspace_id
  INTO v_source_task_id, v_sync_mode, v_workspace_id
  FROM public.task_items
  WHERE id = v_task_id;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM public.task_assignees
  WHERE task_id = v_source_task_id;

  INSERT INTO public.task_assignees (task_id, assignee_id, assignee_name)
  SELECT v_source_task_id, assignee_id, assignee_name
  FROM public.task_assignees
  WHERE task_id = v_task_id;

  UPDATE public.task_items
  SET assignee_id = (
        SELECT assignee_id
        FROM public.task_assignees
        WHERE task_id = v_task_id
        LIMIT 1
      ),
      updated_at = now()
  WHERE id = v_source_task_id
    AND workspace_id = v_workspace_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_live_task_tags_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_source_task_id uuid;
  v_sync_mode text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_sync_mode
  INTO v_source_task_id, v_sync_mode
  FROM public.task_items
  WHERE id = v_task_id;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM public.task_tag_links
  WHERE task_id = v_source_task_id;

  INSERT INTO public.task_tag_links (task_id, tag_id)
  SELECT v_source_task_id, tag_id
  FROM public.task_tag_links
  WHERE task_id = v_task_id
  ON CONFLICT DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

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
  v_sync_mode text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.entity_type <> 'task' THEN
      RETURN OLD;
    END IF;
    v_entity_id := OLD.entity_id;
    v_workspace_id := OLD.workspace_id;
    v_property_definition_id := OLD.property_definition_id;
    v_value := NULL;
  ELSE
    IF NEW.entity_type <> 'task' THEN
      RETURN NEW;
    END IF;
    v_entity_id := NEW.entity_id;
    v_workspace_id := NEW.workspace_id;
    v_property_definition_id := NEW.property_definition_id;
    v_value := NEW.value;
  END IF;

  SELECT source_task_id, source_sync_mode
  INTO v_source_task_id, v_sync_mode
  FROM public.task_items
  WHERE id = v_entity_id;

  IF v_source_task_id IS NULL OR v_sync_mode <> 'live' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.entity_properties
    WHERE entity_type = 'task'
      AND entity_id = v_source_task_id
      AND property_definition_id = v_property_definition_id;
  ELSE
    INSERT INTO public.entity_properties (
      workspace_id,
      entity_type,
      entity_id,
      property_definition_id,
      value
    )
    VALUES (
      v_workspace_id,
      'task',
      v_source_task_id,
      v_property_definition_id,
      v_value
    )
    ON CONFLICT (entity_type, entity_id, property_definition_id)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_live_task_item_to_source_trigger ON public.task_items;
CREATE TRIGGER sync_live_task_item_to_source_trigger
AFTER UPDATE ON public.task_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_live_task_item_to_source();

DROP TRIGGER IF EXISTS sync_live_task_assignees_to_source_trigger ON public.task_assignees;
CREATE TRIGGER sync_live_task_assignees_to_source_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.sync_live_task_assignees_to_source();

DROP TRIGGER IF EXISTS sync_live_task_tags_to_source_trigger ON public.task_tag_links;
CREATE TRIGGER sync_live_task_tags_to_source_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.task_tag_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_live_task_tags_to_source();

DROP TRIGGER IF EXISTS sync_live_task_properties_to_source_trigger ON public.entity_properties;
CREATE TRIGGER sync_live_task_properties_to_source_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.entity_properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_live_task_properties_to_source();
