-- Sync task_items.assignee_id when bulk_set_task_assignees runs (denormalized first assignee).
-- Both overloads (2-arg and 3-arg) are updated so task_items stays consistent.

create or replace function public.bulk_set_task_assignees(
  p_task_ids uuid[],
  p_assignees jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_task_id uuid;
  v_workspace_id uuid;
  v_assignee jsonb;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
begin
  select workspace_id into v_workspace_id
  from public.task_items
  where id = p_task_ids[1];

  if v_workspace_id is null then
    return jsonb_build_object('updated_count', 0);
  end if;

  foreach v_task_id in array p_task_ids loop
    delete from public.task_assignees where task_id = v_task_id;
    for v_assignee in select * from jsonb_array_elements(v_assignee_payload) loop
      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        v_task_id,
        nullif(v_assignee->>'id','')::uuid,
        coalesce(nullif(v_assignee->>'name',''), nullif(v_assignee->>'id',''), 'Unknown')
      );
    end loop;

    if jsonb_array_length(v_assignee_payload) > 0 then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        field_name,
        field_type,
        value
      )
      values (
        v_workspace_id,
        'task',
        v_task_id,
        'Assignee',
        'assignee',
        v_assignee_payload
      )
      on conflict (entity_id, entity_type, field_name)
      do update set
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id
        and entity_type = 'task'
        and entity_id = v_task_id
        and field_name = 'Assignee';
    end if;

    -- Keep task_items.assignee_id in sync (denormalized first assignee)
    update public.task_items
    set assignee_id = case
      when jsonb_array_length(v_assignee_payload) > 0 then
        nullif(v_assignee_payload->0->>'id', '')::uuid
      else null
    end
    where id = v_task_id;
  end loop;

  return jsonb_build_object('updated_count', array_length(p_task_ids, 1));
end;
$$;

create or replace function public.bulk_set_task_assignees(
  p_task_ids uuid[],
  p_assignees jsonb,
  p_updated_by uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_task_id uuid;
  v_workspace_id uuid;
  v_assignee jsonb;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
begin
  select workspace_id into v_workspace_id
  from public.task_items
  where id = p_task_ids[1];

  if v_workspace_id is null then
    return jsonb_build_object('updated_count', 0);
  end if;

  foreach v_task_id in array p_task_ids loop
    delete from public.task_assignees where task_id = v_task_id;
    for v_assignee in select * from jsonb_array_elements(v_assignee_payload) loop
      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        v_task_id,
        nullif(v_assignee->>'id','')::uuid,
        coalesce(nullif(v_assignee->>'name',''), nullif(v_assignee->>'id',''), 'Unknown')
      );
    end loop;

    if jsonb_array_length(v_assignee_payload) > 0 then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        field_name,
        field_type,
        value
      )
      values (
        v_workspace_id,
        'task',
        v_task_id,
        'Assignee',
        'assignee',
        v_assignee_payload
      )
      on conflict (entity_id, entity_type, field_name)
      do update set
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id
        and entity_type = 'task'
        and entity_id = v_task_id
        and field_name = 'Assignee';
    end if;

    -- Keep task_items.assignee_id in sync (denormalized first assignee)
    update public.task_items
    set assignee_id = case
      when jsonb_array_length(v_assignee_payload) > 0 then
        nullif(v_assignee_payload->0->>'id', '')::uuid
      else null
    end
    where id = v_task_id;
  end loop;

  return jsonb_build_object('updated_count', array_length(p_task_ids, 1));
end;
$$;
