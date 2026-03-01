-- Extend update_task_full to maintain task_items.assignees and task_items.due_dates.

create or replace function public.update_task_full(
  p_task_id uuid,
  p_updates jsonb,
  p_assignees jsonb,
  p_assignees_set boolean,
  p_tags jsonb,
  p_tags_set boolean,
  p_updated_by uuid
)
returns public.task_items
language plpgsql
as $$
declare
  v_task public.task_items;
  v_workspace_id uuid;
  v_primary_assignee jsonb;
  v_primary_assignee_id uuid;
  v_assignee_id_text text;
  v_named_assignee_ids text[] := array[]::text[];
  v_tag text;
  v_tag_id uuid;
  v_existing_tags uuid[];
  v_desired_tags uuid[] := array[]::uuid[];
  v_statuses jsonb;
  v_priorities jsonb;
  v_status_entry jsonb;
  v_priority_entry jsonb;
begin
  update public.task_items
  set
    title = coalesce(p_updates->>'title', title),
    statuses = case
      when p_updates ? 'statuses' then coalesce(p_updates->'statuses', '[]'::jsonb)
      when p_updates ? 'status' then
        case
          when nullif(btrim(coalesce(p_updates->>'status', '')), '') is null then '[]'::jsonb
          else jsonb_build_array(jsonb_build_object('field_name', 'Status', 'value',
            case
              when lower(p_updates->>'status') = 'in-progress' then 'in_progress'
              when lower(p_updates->>'status') = 'in progress' then 'in_progress'
              when lower(p_updates->>'status') = 'done' then 'done'
              when lower(p_updates->>'status') = 'blocked' then 'blocked'
              else 'todo'
            end
          ))
        end
      else statuses
    end,
    priorities = case
      when p_updates ? 'priorities' then coalesce(p_updates->'priorities', '[]'::jsonb)
      when p_updates ? 'priority' then
        case
          when nullif(btrim(coalesce(p_updates->>'priority', '')), '') is null or lower(p_updates->>'priority') = 'none'
            then '[]'::jsonb
          else jsonb_build_array(jsonb_build_object('field_name', 'Priority', 'value', lower(p_updates->>'priority')))
        end
      else priorities
    end,
    due_dates = case
      when p_updates ? 'due_dates' then coalesce(p_updates->'due_dates', '[]'::jsonb)
      when p_updates ? 'dueDate' or p_updates ? 'startDate' then
        case
          when coalesce((p_updates->>'startDate')::date, start_date) is null
               and coalesce((p_updates->>'dueDate')::date, due_date) is null
            then '[]'::jsonb
          else jsonb_build_array(
            jsonb_build_object(
              'field_name', 'Due Date',
              'value', jsonb_build_object(
                'start', coalesce((p_updates->>'startDate')::date, start_date),
                'end', coalesce((p_updates->>'dueDate')::date, due_date)
              )
            )
          )
        end
      else due_dates
    end,
    description = coalesce(p_updates->>'description', description),
    due_date = coalesce((p_updates->>'dueDate')::date, due_date),
    due_time = coalesce((p_updates->>'dueTime')::time, due_time),
    start_date = coalesce((p_updates->>'startDate')::date, start_date),
    hide_icons = coalesce((p_updates->>'hideIcons')::boolean, hide_icons),
    recurring_enabled = coalesce((p_updates->>'recurringEnabled')::boolean, recurring_enabled),
    recurring_frequency = coalesce(p_updates->>'recurringFrequency', recurring_frequency),
    recurring_interval = coalesce((p_updates->>'recurringInterval')::integer, recurring_interval),
    updated_by = p_updated_by
  where id = p_task_id
  returning * into v_task;

  if v_task.id is null then
    raise exception 'Task not found';
  end if;

  v_workspace_id := v_task.workspace_id;

  if p_updates ? 'statuses' or p_updates ? 'status' then
    v_statuses := v_task.statuses;
    delete from public.entity_properties
    where entity_type = 'task' and entity_id = p_task_id and field_type = 'status';

    for v_status_entry in select * from jsonb_array_elements(coalesce(v_statuses, '[]'::jsonb)) loop
      if (v_status_entry ? 'field_name') and (v_status_entry ? 'value') then
        insert into public.entity_properties (
          workspace_id, entity_type, entity_id, field_name, field_type, value
        )
        values (
          v_workspace_id,
          'task',
          p_task_id,
          coalesce(nullif(trim(v_status_entry->>'field_name'), ''), 'Status'),
          'status',
          to_jsonb(v_status_entry->>'value')
        )
        on conflict (entity_type, entity_id, field_name)
        do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
      end if;
    end loop;
  end if;

  if p_updates ? 'priorities' or p_updates ? 'priority' then
    v_priorities := v_task.priorities;
    delete from public.entity_properties
    where entity_type = 'task' and entity_id = p_task_id and field_type = 'priority';

    for v_priority_entry in select * from jsonb_array_elements(coalesce(v_priorities, '[]'::jsonb)) loop
      if (v_priority_entry ? 'field_name') and (v_priority_entry ? 'value') then
        insert into public.entity_properties (
          workspace_id, entity_type, entity_id, field_name, field_type, value
        )
        values (
          v_workspace_id,
          'task',
          p_task_id,
          coalesce(nullif(trim(v_priority_entry->>'field_name'), ''), 'Priority'),
          'priority',
          to_jsonb(v_priority_entry->>'value')
        )
        on conflict (entity_type, entity_id, field_name)
        do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
      end if;
    end loop;
  end if;

  if p_assignees_set then
    v_primary_assignee_id := null;
    v_named_assignee_ids := array[]::text[];
    delete from public.task_assignees where task_id = p_task_id;

    for v_primary_assignee in select * from jsonb_array_elements(coalesce(p_assignees, '[]'::jsonb)) loop
      v_assignee_id_text := nullif(v_primary_assignee->>'id', '');
      if v_assignee_id_text is not null then
        v_named_assignee_ids := array_append(v_named_assignee_ids, v_assignee_id_text);
      end if;

      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        p_task_id,
        v_assignee_id_text::uuid,
        coalesce(nullif(v_primary_assignee->>'name', ''), v_assignee_id_text, 'Unknown')
      );
    end loop;

    if jsonb_array_length(coalesce(p_assignees, '[]'::jsonb)) > 0 then
      select * into v_primary_assignee from jsonb_array_elements(coalesce(p_assignees, '[]'::jsonb)) limit 1;
      v_primary_assignee_id := nullif(v_primary_assignee->>'id', '')::uuid;
      insert into public.entity_properties (
        workspace_id, entity_type, entity_id, field_name, field_type, value
      )
      values (
        v_workspace_id, 'task', p_task_id, 'Assignee', 'assignee',
        jsonb_build_object(
          'id', nullif(v_primary_assignee->>'id', ''),
          'name', coalesce(nullif(v_primary_assignee->>'name', ''), nullif(v_primary_assignee->>'id', ''))
        )
      )
      on conflict (entity_type, entity_id, field_name)
      do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id and entity_type = 'task' and entity_id = p_task_id and field_name = 'Assignee';
    end if;

    update public.task_items
    set assignee_id = v_primary_assignee_id,
        assignees = case
          when coalesce(array_length(v_named_assignee_ids, 1), 0) = 0 then '[]'::jsonb
          else jsonb_build_array(
            jsonb_build_object('field_name', 'Assignee', 'value', to_jsonb(v_named_assignee_ids))
          )
        end,
        updated_by = p_updated_by
    where id = p_task_id;
  end if;

  if p_tags_set then
    select array_agg(tag_id) into v_existing_tags
    from public.task_tag_links where task_id = p_task_id;

    for v_tag in select trim(value::text) from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) loop
      if v_tag is null or v_tag = '' then continue; end if;
      select id into v_tag_id from public.task_tags where workspace_id = v_workspace_id and name = v_tag limit 1;
      if v_tag_id is null then
        insert into public.task_tags (workspace_id, name) values (v_workspace_id, v_tag) returning id into v_tag_id;
      end if;
      v_desired_tags := v_desired_tags || v_tag_id;
    end loop;

    insert into public.task_tag_links (task_id, tag_id)
    select p_task_id, t from unnest(v_desired_tags) as t
    where not (t = any(coalesce(v_existing_tags, array[]::uuid[])))
    on conflict do nothing;
  end if;

  select * into v_task from public.task_items where id = p_task_id;
  return v_task;
end;
$$;

