-- Fix: set_edited_flag_on_task_item_update was referencing 'status' column which was
-- dropped in 20260221180000. Remove the reference; statuses (JSONB) already covers status changes.

CREATE OR REPLACE FUNCTION public.set_edited_flag_on_task_item_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_entity_id IS NOT NULL AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.statuses IS DISTINCT FROM OLD.statuses OR
    NEW.priorities IS DISTINCT FROM OLD.priorities OR
    NEW.due_date IS DISTINCT FROM OLD.due_date OR
    NEW.start_date IS DISTINCT FROM OLD.start_date
  ) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;
