-- Fix sync trigger to work with universal source tracking (source_entity_type + source_entity_id)
-- Previously only worked with source_task_id

-- Update the sync function to handle both old and new source tracking
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

  -- Get source tracking info (support both old and new columns)
  SELECT
    source_task_id,
    source_entity_type,
    source_entity_id,
    source_sync_mode
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  FROM public.task_items
  WHERE id = v_entity_id;

  -- Check if sync mode is 'live'
  IF v_sync_mode <> 'live' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine the actual source task ID to update
  -- Prefer new universal tracking, fall back to old source_task_id
  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  ELSIF v_source_task_id IS NULL THEN
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

-- Also update the task item sync trigger to support universal source tracking
CREATE OR REPLACE FUNCTION public.sync_live_task_item_to_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Get source tracking info (support both old and new columns)
  v_source_task_id := NEW.source_task_id;
  v_source_entity_type := NEW.source_entity_type;
  v_source_entity_id := NEW.source_entity_id;

  -- Determine the actual source task ID to update
  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR NEW.source_sync_mode <> 'live' THEN
    RETURN NEW;
  END IF;

  IF v_source_task_id = NEW.id THEN
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
  WHERE id = v_source_task_id
    AND workspace_id = NEW.workspace_id;

  RETURN NEW;
END;
$$;

-- Update assignees sync trigger
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
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode, workspace_id
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode, v_workspace_id
  FROM public.task_items
  WHERE id = v_task_id;

  -- Determine the actual source task ID to update
  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

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

-- Update tags sync trigger
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
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_task_id := COALESCE(NEW.task_id, OLD.task_id);

  SELECT source_task_id, source_entity_type, source_entity_id, source_sync_mode
  INTO v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  FROM public.task_items
  WHERE id = v_task_id;

  -- Determine the actual source task ID to update
  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

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

-- Add comment explaining the sync behavior
COMMENT ON FUNCTION public.sync_live_task_properties_to_source() IS
  'Syncs entity_properties changes from a snapshot task to its source task when source_sync_mode = ''live''. Supports both legacy source_task_id and universal source_entity_type/source_entity_id tracking.';

COMMENT ON FUNCTION public.sync_live_task_item_to_source() IS
  'Syncs task_items changes from a snapshot task to its source task when source_sync_mode = ''live''. Supports both legacy source_task_id and universal source_entity_type/source_entity_id tracking.';
