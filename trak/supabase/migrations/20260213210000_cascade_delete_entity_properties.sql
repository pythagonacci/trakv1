-- Automatically delete entity_properties when the parent entity is deleted
-- This ensures we don't have orphaned property records

-- Trigger for task_items
CREATE OR REPLACE FUNCTION public.cleanup_entity_properties_on_task_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete all entity_properties for this task
  DELETE FROM public.entity_properties
  WHERE entity_type = 'task'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this task
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'task' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'task' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_entity_properties_on_task_delete_trigger ON public.task_items;
CREATE TRIGGER cleanup_entity_properties_on_task_delete_trigger
  BEFORE DELETE ON public.task_items
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_entity_properties_on_task_delete();

-- Trigger for task_subtasks
CREATE OR REPLACE FUNCTION public.cleanup_entity_properties_on_subtask_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete all entity_properties for this subtask
  DELETE FROM public.entity_properties
  WHERE entity_type = 'subtask'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this subtask
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'subtask' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'subtask' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_entity_properties_on_subtask_delete_trigger ON public.task_subtasks;
CREATE TRIGGER cleanup_entity_properties_on_subtask_delete_trigger
  BEFORE DELETE ON public.task_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_entity_properties_on_subtask_delete();

-- Trigger for timeline_events
CREATE OR REPLACE FUNCTION public.cleanup_entity_properties_on_timeline_event_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete all entity_properties for this timeline event
  DELETE FROM public.entity_properties
  WHERE entity_type = 'timeline_event'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this timeline event
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'timeline_event' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'timeline_event' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_entity_properties_on_timeline_event_delete_trigger ON public.timeline_events;
CREATE TRIGGER cleanup_entity_properties_on_timeline_event_delete_trigger
  BEFORE DELETE ON public.timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_entity_properties_on_timeline_event_delete();

-- Trigger for table_rows
CREATE OR REPLACE FUNCTION public.cleanup_entity_properties_on_table_row_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete all entity_properties for this table row
  DELETE FROM public.entity_properties
  WHERE entity_type = 'table_row'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this table row
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'table_row' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'table_row' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_entity_properties_on_table_row_delete_trigger ON public.table_rows;
CREATE TRIGGER cleanup_entity_properties_on_table_row_delete_trigger
  BEFORE DELETE ON public.table_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_entity_properties_on_table_row_delete();

-- Trigger for blocks
CREATE OR REPLACE FUNCTION public.cleanup_entity_properties_on_block_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete all entity_properties for this block
  DELETE FROM public.entity_properties
  WHERE entity_type = 'block'
    AND entity_id = OLD.id;

  -- Delete all entity_links involving this block
  DELETE FROM public.entity_links
  WHERE (source_entity_type = 'block' AND source_entity_id = OLD.id)
     OR (target_entity_type = 'block' AND target_entity_id = OLD.id);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_entity_properties_on_block_delete_trigger ON public.blocks;
CREATE TRIGGER cleanup_entity_properties_on_block_delete_trigger
  BEFORE DELETE ON public.blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_entity_properties_on_block_delete();

-- Add comments explaining the cleanup behavior
COMMENT ON FUNCTION public.cleanup_entity_properties_on_task_delete() IS
  'Automatically deletes entity_properties and entity_links when a task is deleted to prevent orphaned records.';

COMMENT ON FUNCTION public.cleanup_entity_properties_on_subtask_delete() IS
  'Automatically deletes entity_properties and entity_links when a subtask is deleted to prevent orphaned records.';

COMMENT ON FUNCTION public.cleanup_entity_properties_on_timeline_event_delete() IS
  'Automatically deletes entity_properties and entity_links when a timeline event is deleted to prevent orphaned records.';

COMMENT ON FUNCTION public.cleanup_entity_properties_on_table_row_delete() IS
  'Automatically deletes entity_properties and entity_links when a table row is deleted to prevent orphaned records.';

COMMENT ON FUNCTION public.cleanup_entity_properties_on_block_delete() IS
  'Automatically deletes entity_properties and entity_links when a block is deleted to prevent orphaned records.';
