-- Fix create_task_full and update_task_full: remove references to dropped "status" column.
-- task_items.status was dropped in 20260221180000_drop_legacy_status_columns.sql;
-- the RPCs were still inserting/updating it, causing error 42703.

-- Drop existing overloads so we can replace with the same signature
drop function if exists public.create_task_full(
  uuid, text, text, jsonb, jsonb, text, date, time without time zone, date, boolean, boolean, text, integer, jsonb, jsonb, uuid, text, uuid, text
);

create or replace function public.create_task_full(
  p_task_block_id uuid,
  p_title text,
  p_status text,
  p_priorities jsonb default '[]'::jsonb,
  p_statuses jsonb default '[]'::jsonb,
  p_description text default null,
  p_due_date date default null,
  p_due_time time without time zone default null,
  p_start_date date default null,
  p_hide_icons boolean default null,
  p_recurring_enabled boolean default null,
  p_recurring_frequency text default null,
  p_recurring_interval integer default null,
  p_assignees jsonb default '[]'::jsonb,
  p_tags jsonb default '[]'::jsonb,
  p_created_by uuid default null,
  p_source_entity_type text default null,
  p_source_entity_id uuid default null,
  p_source_sync_mode text default null
)
returns public.task_items
language plpgsql
as $$
declare
  v_task public.task_items;
  v_workspace_id uuid;
  v_project_id uuid;
  v_tab_id uuid;
  v_assignee jsonb;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
  v_statuses jsonb;
  v_tag text;
  v_tag_id uuid;
  v_tag_names jsonb := '[]'::jsonb;
  v_priority_entry jsonb;
  v_effective_source_entity_type text;
  v_effective_source_entity_id uuid;
  v_effective_source_sync_mode text;
  v_effective_source_task_id uuid;
begin
  select b.tab_id, t.project_id, p.workspace_id
  into v_tab_id, v_project_id, v_workspace_id
  from public.blocks b
  join public.tabs t on t.id = b.tab_id
  join public.projects p on p.id = t.project_id
  where b.id = p_task_block_id and b.type = 'task'
  limit 1;

  if v_workspace_id is null then
    raise exception 'Task block not found';
  end if;

  if p_source_entity_type is not null and p_source_entity_id is not null then
    v_effective_source_entity_type := p_source_entity_type;
    v_effective_source_entity_id := p_source_entity_id;
    v_effective_source_sync_mode := case
      when p_source_entity_type = 'table_row' then 'snapshot'
      when p_source_entity_type = 'block' then 'snapshot'
      else coalesce(p_source_sync_mode, 'snapshot')
    end;

    if p_source_entity_type = 'task' then
      v_effective_source_task_id := p_source_entity_id;
    end if;
  end if;

  -- Use p_statuses when non-empty, else build single Status from p_status (status column no longer exists)
  v_statuses := case
    when jsonb_array_length(coalesce(p_statuses, '[]'::jsonb)) > 0 then coalesce(p_statuses, '[]'::jsonb)
    else jsonb_build_array(
      jsonb_build_object(
        'field_name', 'Status',
        'value',
        case
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'in-progress' then 'in_progress'
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'in progress' then 'in_progress'
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'done' then 'done'
          when lower(coalesce(nullif(trim(p_status), ''), 'todo')) = 'blocked' then 'blocked'
          else 'todo'
        end
      )
    )
  end;

  insert into public.task_items (
    task_block_id, workspace_id, project_id, tab_id,
    title, statuses, priorities, description, due_date, due_time, start_date,
    hide_icons, recurring_enabled, recurring_frequency, recurring_interval,
    source_task_id, source_entity_type, source_entity_id, source_sync_mode,
    created_by, updated_by
  ) values (
    p_task_block_id, v_workspace_id, v_project_id, v_tab_id,
    p_title, v_statuses, coalesce(p_priorities, '[]'::jsonb), p_description, p_due_date, p_due_time, p_start_date,
    coalesce(p_hide_icons, false), coalesce(p_recurring_enabled, false), p_recurring_frequency, p_recurring_interval,
    v_effective_source_task_id, v_effective_source_entity_type, v_effective_source_entity_id, v_effective_source_sync_mode,
    p_created_by, p_created_by
  ) returning * into v_task;

  for v_assignee in select * from jsonb_array_elements(v_assignee_payload) loop
    insert into public.task_assignees (task_id, assignee_id, assignee_name)
    values (
      v_task.id,
      nullif(v_assignee->>'id', '')::uuid,
      coalesce(nullif(v_assignee->>'name', ''), nullif(v_assignee->>'id', ''), 'Unknown')
    );
  end loop;

  -- Sync assignees to entity_properties (no property_definition_id)
  if jsonb_array_length(v_assignee_payload) > 0 then
    insert into public.entity_properties (
      workspace_id, entity_type, entity_id, field_name, field_type, value
    )
    values (
      v_workspace_id, 'task', v_task.id, 'Assignee', 'assignee', v_assignee_payload
    )
    on conflict (entity_type, entity_id, field_name)
    do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
  end if;

  -- Sync status to entity_properties (single "Status" field; value = canonical string)
  insert into public.entity_properties (
    workspace_id, entity_type, entity_id, field_name, field_type, value
  )
  values (
    v_workspace_id,
    'task',
    v_task.id,
    'Status',
    'status',
    coalesce(v_statuses->0->'value', '"todo"'::jsonb)
  )
  on conflict (entity_type, entity_id, field_name)
  do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();

  -- Sync each priority to entity_properties (e.g. "Priority", "Execution Priority")
  for v_priority_entry in select * from jsonb_array_elements(coalesce(p_priorities, '[]'::jsonb)) loop
    if v_priority_entry ? 'field_name' and v_priority_entry ? 'value' then
      insert into public.entity_properties (
        workspace_id, entity_type, entity_id, field_name, field_type, value
      )
      values (
        v_workspace_id,
        'task',
        v_task.id,
        coalesce(nullif(trim(v_priority_entry->>'field_name'), ''), 'Priority'),
        'priority',
        to_jsonb(v_priority_entry->>'value')
      )
      on conflict (entity_type, entity_id, field_name)
      do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
    end if;
  end loop;

  for v_tag in select trim(value::text) from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) loop
    if v_tag is null or v_tag = '' then continue; end if;
    v_tag_names := v_tag_names || to_jsonb(v_tag);
    select id into v_tag_id from public.task_tags where workspace_id = v_workspace_id and name = v_tag limit 1;
    if v_tag_id is null then
      insert into public.task_tags (workspace_id, name) values (v_workspace_id, v_tag) returning id into v_tag_id;
    end if;
    insert into public.task_tag_links (task_id, tag_id) values (v_task.id, v_tag_id) on conflict do nothing;
  end loop;

  -- Sync tags to entity_properties (array of tag name strings)
  if jsonb_array_length(v_tag_names) > 0 then
    insert into public.entity_properties (
      workspace_id, entity_type, entity_id, field_name, field_type, value
    )
    values (
      v_workspace_id, 'task', v_task.id, 'Tags', 'tags', v_tag_names
    )
    on conflict (entity_type, entity_id, field_name)
    do update set field_type = excluded.field_type, value = excluded.value, updated_at = now();
  end if;

  return v_task;
end;
$$;

-- update_task_full: stop setting the dropped "status" column
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
  v_tag text;
  v_tag_id uuid;
  v_existing_tags uuid[];
  v_desired_tags uuid[] := array[]::uuid[];
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

  if p_assignees_set then
    delete from public.task_assignees where task_id = p_task_id;
    for v_primary_assignee in select * from jsonb_array_elements(coalesce(p_assignees, '[]'::jsonb)) loop
      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        p_task_id,
        nullif(v_primary_assignee->>'id', '')::uuid,
        coalesce(nullif(v_primary_assignee->>'name', ''), nullif(v_primary_assignee->>'id', ''), 'Unknown')
      );
    end loop;

    if jsonb_array_length(coalesce(p_assignees, '[]'::jsonb)) > 0 then
      select * into v_primary_assignee from jsonb_array_elements(coalesce(p_assignees, '[]'::jsonb)) limit 1;
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

  return v_task;
end;
$$;
