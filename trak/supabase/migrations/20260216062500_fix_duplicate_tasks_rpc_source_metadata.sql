-- Fix duplicate_tasks_to_block RPC to include source_entity_type and source_entity_id
-- This fixes the task_items_source_metadata_consistency constraint violation

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
      source_task_id, source_entity_type, source_entity_id, source_sync_mode,
      created_by, updated_by
    )
    VALUES (
      p_target_block_id, p_workspace_id, p_project_id, p_tab_id,
      v_task.title, v_task.status, v_task.priority, v_task.description, v_task.due_date, v_task.due_time, v_task.start_date,
      v_task.hide_icons, v_max_order, v_task.recurring_enabled, v_task.recurring_frequency, v_task.recurring_interval,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN NULL
        ELSE v_task.id
      END,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN 'table_row'
        ELSE 'task'
      END,
      CASE
        WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN v_task.source_entity_id
        ELSE v_task.id
      END,
      'snapshot',
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
