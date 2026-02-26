-- Fix sync_live_task_item_to_source trigger: remove dead references to 'status' column
-- 'status' was dropped in 20260221180000_drop_legacy_status_columns.sql
-- The trigger still referenced new.status/old.status in the change-detection IF and the UPDATE SET,
-- which caused "column status does not exist" errors any time source_sync_mode was toggled to 'live'.

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

  v_source_task_id := new.source_task_id;
  v_source_entity_type := new.source_entity_type;
  v_source_entity_id := new.source_entity_id;

  IF v_source_entity_type = 'table_row' OR v_source_entity_type = 'block' THEN
    RETURN NEW;
  END IF;

  IF v_source_entity_type = 'task' AND v_source_entity_id IS NOT NULL THEN
    v_source_task_id := v_source_entity_id;
  END IF;

  IF v_source_task_id IS NULL OR new.source_sync_mode <> 'live' THEN RETURN NEW; END IF;
  IF v_source_task_id = new.id THEN RETURN NEW; END IF;

  IF new.title IS DISTINCT FROM old.title
     OR new.statuses IS DISTINCT FROM old.statuses
     OR new.priorities IS DISTINCT FROM old.priorities
     OR new.description IS DISTINCT FROM old.description
     OR new.due_date IS DISTINCT FROM old.due_date
     OR new.due_time IS DISTINCT FROM old.due_time
     OR new.start_date IS DISTINCT FROM old.start_date
     OR new.hide_icons IS DISTINCT FROM old.hide_icons
     OR new.recurring_enabled IS DISTINCT FROM old.recurring_enabled
     OR new.recurring_frequency IS DISTINCT FROM old.recurring_frequency
     OR new.recurring_interval IS DISTINCT FROM old.recurring_interval
     OR new.assignee_id IS DISTINCT FROM old.assignee_id THEN
    UPDATE public.task_items
    SET title = new.title,
        statuses = new.statuses,
        priorities = new.priorities,
        description = new.description,
        due_date = new.due_date,
        due_time = new.due_time,
        start_date = new.start_date,
        hide_icons = new.hide_icons,
        recurring_enabled = new.recurring_enabled,
        recurring_frequency = new.recurring_frequency,
        recurring_interval = new.recurring_interval,
        assignee_id = new.assignee_id,
        updated_by = new.updated_by,
        updated_at = now()
    WHERE id = v_source_task_id AND workspace_id = new.workspace_id;
  END IF;

  RETURN NEW;
END;
$$;
