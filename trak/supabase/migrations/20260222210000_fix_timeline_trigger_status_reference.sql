-- Fix: set_edited_flag_on_timeline_event_update was referencing 'status' column which was
-- dropped in 20260221180000. Replace with statuses (JSONB).

CREATE OR REPLACE FUNCTION public.set_edited_flag_on_timeline_event_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_entity_id IS NOT NULL AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.notes IS DISTINCT FROM OLD.notes OR
    NEW.start_date IS DISTINCT FROM OLD.start_date OR
    NEW.end_date IS DISTINCT FROM OLD.end_date OR
    NEW.statuses IS DISTINCT FROM OLD.statuses OR
    NEW.priorities IS DISTINCT FROM OLD.priorities OR
    NEW.assignee_id IS DISTINCT FROM OLD.assignee_id OR
    NEW.progress IS DISTINCT FROM OLD.progress OR
    NEW.color IS DISTINCT FROM OLD.color OR
    NEW.is_milestone IS DISTINCT FROM OLD.is_milestone
  ) THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;
