-- Hotfix for DB drift after task priority JSONB + named entity properties rollout.
-- Fixes legacy overloads, broken duplicate RPC definition, and missing trigger wiring.

begin;

-- Remove stale overload that still writes task_items.priority (dropped column).
drop function if exists public.create_task_full(
  uuid, text, text, text, text, date, time without time zone, date, boolean, boolean, text, integer, jsonb, jsonb, uuid
);

create or replace function public.create_task_full(
  p_task_block_id uuid,
  p_title text,
  p_status text default null,
  p_priorities jsonb default '[]'::jsonb,
  p_description text default null,
  p_due_date date default null,
  p_due_time time without time zone default null,
  p_start_date date default null,
  p_hide_icons boolean default null,
  p_recurring_enabled boolean default false,
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
  v_assignee_def uuid;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
  v_tag text;
  v_tag_id uuid;
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

  insert into public.task_items (
    task_block_id,
    workspace_id,
    project_id,
    tab_id,
    title,
    status,
    priorities,
    description,
    due_date,
    due_time,
    start_date,
    hide_icons,
    recurring_enabled,
    recurring_frequency,
    recurring_interval,
    source_task_id,
    source_entity_type,
    source_entity_id,
    source_sync_mode,
    created_by,
    updated_by
  ) values (
    p_task_block_id,
    v_workspace_id,
    v_project_id,
    v_tab_id,
    p_title,
    coalesce(p_status, 'todo'),
    coalesce(p_priorities, '[]'::jsonb),
    p_description,
    p_due_date,
    p_due_time,
    p_start_date,
    coalesce(p_hide_icons, false),
    coalesce(p_recurring_enabled, false),
    p_recurring_frequency,
    p_recurring_interval,
    v_effective_source_task_id,
    v_effective_source_entity_type,
    v_effective_source_entity_id,
    v_effective_source_sync_mode,
    p_created_by,
    p_created_by
  )
  returning * into v_task;

  for v_assignee in
    select * from jsonb_array_elements(v_assignee_payload)
  loop
    insert into public.task_assignees (task_id, assignee_id, assignee_name)
    values (
      v_task.id,
      nullif(v_assignee->>'id', '')::uuid,
      coalesce(nullif(v_assignee->>'name', ''), nullif(v_assignee->>'id', ''), 'Unknown')
    );
  end loop;

  select id into v_assignee_def
  from public.property_definitions
  where workspace_id = v_workspace_id
    and name = 'Assignee'
    and type = 'person'
  limit 1;

  if jsonb_array_length(v_assignee_payload) > 0 then
    insert into public.entity_properties (
      workspace_id,
      entity_type,
      entity_id,
      property_definition_id,
      field_name,
      field_type,
      value
    )
    values (
      v_workspace_id,
      'task',
      v_task.id,
      v_assignee_def,
      'Assignee',
      'assignee',
      v_assignee_payload
    )
    on conflict (entity_type, entity_id, field_name)
    do update set
      field_type = excluded.field_type,
      property_definition_id = excluded.property_definition_id,
      value = excluded.value,
      updated_at = now();
  end if;

  for v_tag in
    select trim(value::text)
    from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb))
  loop
    if v_tag is null or v_tag = '' then
      continue;
    end if;

    select id into v_tag_id
    from public.task_tags
    where workspace_id = v_workspace_id
      and name = v_tag
    limit 1;

    if v_tag_id is null then
      insert into public.task_tags (workspace_id, name)
      values (v_workspace_id, v_tag)
      returning id into v_tag_id;
    end if;

    insert into public.task_tag_links (task_id, tag_id)
    values (v_task.id, v_tag_id)
    on conflict do nothing;
  end loop;

  return v_task;
end;
$$;

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
  v_assignee_def uuid;
  v_assignee_payload jsonb := coalesce(p_assignees, '[]'::jsonb);
  v_assignee jsonb;
  v_tag text;
  v_tag_id uuid;
  v_existing_tags uuid[];
  v_desired_tags uuid[] := array[]::uuid[];
begin
  update public.task_items
  set
    title = coalesce(p_updates->>'title', title),
    status = coalesce(p_updates->>'status', status),
    priorities = case
      when p_updates ? 'priorities' then coalesce(p_updates->'priorities', '[]'::jsonb)
      when p_updates ? 'priority' then
        case
          when nullif(btrim(coalesce(p_updates->>'priority', '')), '') is null
            or lower(p_updates->>'priority') = 'none'
            then '[]'::jsonb
          else jsonb_build_array(
            jsonb_build_object(
              'field_name',
              'Priority',
              'value',
              lower(p_updates->>'priority')
            )
          )
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

    for v_assignee in
      select * from jsonb_array_elements(v_assignee_payload)
    loop
      insert into public.task_assignees (task_id, assignee_id, assignee_name)
      values (
        p_task_id,
        nullif(v_assignee->>'id', '')::uuid,
        coalesce(nullif(v_assignee->>'name', ''), nullif(v_assignee->>'id', ''), 'Unknown')
      );
    end loop;

    select id into v_assignee_def
    from public.property_definitions
    where workspace_id = v_workspace_id
      and name = 'Assignee'
      and type = 'person'
    limit 1;

    if jsonb_array_length(v_assignee_payload) > 0 then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        property_definition_id,
        field_name,
        field_type,
        value
      )
      values (
        v_workspace_id,
        'task',
        p_task_id,
        v_assignee_def,
        'Assignee',
        'assignee',
        v_assignee_payload
      )
      on conflict (entity_type, entity_id, field_name)
      do update set
        field_type = excluded.field_type,
        property_definition_id = excluded.property_definition_id,
        value = excluded.value,
        updated_at = now();
    else
      delete from public.entity_properties
      where workspace_id = v_workspace_id
        and entity_type = 'task'
        and entity_id = p_task_id
        and field_name = 'Assignee';
    end if;
  end if;

  if p_tags_set then
    select array_agg(tag_id)
    into v_existing_tags
    from public.task_tag_links
    where task_id = p_task_id;

    for v_tag in
      select trim(value::text)
      from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb))
    loop
      if v_tag is null or v_tag = '' then
        continue;
      end if;

      select id into v_tag_id
      from public.task_tags
      where workspace_id = v_workspace_id
        and name = v_tag
      limit 1;

      if v_tag_id is null then
        insert into public.task_tags (workspace_id, name)
        values (v_workspace_id, v_tag)
        returning id into v_tag_id;
      end if;

      v_desired_tags := v_desired_tags || v_tag_id;
    end loop;

    insert into public.task_tag_links (task_id, tag_id)
    select p_task_id, t
    from unnest(v_desired_tags) as t
    where not (t = any(coalesce(v_existing_tags, array[]::uuid[])))
    on conflict do nothing;

    delete from public.task_tag_links
    where task_id = p_task_id
      and tag_id = any(coalesce(v_existing_tags, array[]::uuid[]))
      and not (tag_id = any(v_desired_tags));
  end if;

  return v_task;
end;
$$;

create or replace function public.bulk_update_task_items(
  p_task_ids uuid[],
  p_updates jsonb,
  p_updated_by uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_workspace_id uuid;
  v_valid_ids uuid[];
  v_skipped uuid[];
  v_updated_count int := 0;
begin
  select workspace_id into v_workspace_id
  from public.task_items
  where id = p_task_ids[1];

  if v_workspace_id is null then
    return jsonb_build_object('updated_count', 0, 'skipped', p_task_ids);
  end if;

  select array_agg(id) into v_valid_ids
  from public.task_items
  where id = any(p_task_ids)
    and workspace_id = v_workspace_id;

  v_skipped := array(
    select id from unnest(p_task_ids) as id
    where not (id = any(coalesce(v_valid_ids, array[]::uuid[])))
  );

  if v_valid_ids is not null then
    update public.task_items
    set
      title = coalesce(p_updates->>'title', title),
      status = coalesce(p_updates->>'status', status),
      priorities = case
        when p_updates ? 'priorities' then coalesce(p_updates->'priorities', '[]'::jsonb)
        when p_updates ? 'priority' then
          case
            when nullif(btrim(coalesce(p_updates->>'priority', '')), '') is null
              or lower(p_updates->>'priority') = 'none'
              then '[]'::jsonb
            else jsonb_build_array(
              jsonb_build_object(
                'field_name',
                'Priority',
                'value',
                lower(p_updates->>'priority')
              )
            )
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
    where id = any(v_valid_ids);

    get diagnostics v_updated_count = row_count;
  end if;

  return jsonb_build_object(
    'updated_count',
    v_updated_count,
    'skipped',
    coalesce(v_skipped, array[]::uuid[])
  );
end;
$$;

create or replace function public.duplicate_tasks_to_block(
  p_task_ids uuid[],
  p_target_block_id uuid,
  p_tab_id uuid,
  p_project_id uuid,
  p_workspace_id uuid,
  p_include_assignees boolean,
  p_include_tags boolean,
  p_created_by uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_max_order int := 0;
  v_created_ids uuid[] := array[]::uuid[];
  v_task record;
  v_new_id uuid;
  v_assignee_def uuid;
  v_assignees record;
  v_assignee_payload jsonb;
  v_tag_links record;
  v_priority_rows_inserted int := 0;
begin
  select coalesce(max(display_order), -1)
  into v_max_order
  from public.task_items
  where task_block_id = p_target_block_id;

  select id into v_assignee_def
  from public.property_definitions
  where workspace_id = p_workspace_id
    and name = 'Assignee'
    and type = 'person'
  limit 1;

  for v_task in
    select *
    from public.task_items
    where id = any(p_task_ids)
      and workspace_id = p_workspace_id
    order by array_position(p_task_ids, id)
  loop
    v_max_order := v_max_order + 1;

    insert into public.task_items (
      task_block_id,
      workspace_id,
      project_id,
      tab_id,
      title,
      status,
      priorities,
      description,
      due_date,
      due_time,
      due_time_end,
      start_date,
      hide_icons,
      display_order,
      recurring_enabled,
      recurring_frequency,
      recurring_interval,
      source_task_id,
      source_entity_type,
      source_entity_id,
      source_sync_mode,
      created_by,
      updated_by
    )
    values (
      p_target_block_id,
      p_workspace_id,
      p_project_id,
      p_tab_id,
      v_task.title,
      v_task.status,
      coalesce(v_task.priorities, '[]'::jsonb),
      v_task.description,
      v_task.due_date,
      v_task.due_time,
      v_task.due_time_end,
      v_task.start_date,
      v_task.hide_icons,
      v_max_order,
      v_task.recurring_enabled,
      v_task.recurring_frequency,
      v_task.recurring_interval,
      case
        when v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then null
        when v_task.source_entity_type = 'block' and v_task.source_entity_id is not null then null
        else v_task.id
      end,
      case
        when v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then 'table_row'
        when v_task.source_entity_type = 'block' and v_task.source_entity_id is not null then 'block'
        else 'task'
      end,
      case
        when v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then v_task.source_entity_id
        when v_task.source_entity_type = 'block' and v_task.source_entity_id is not null then v_task.source_entity_id
        else v_task.id
      end,
      'snapshot',
      p_created_by,
      p_created_by
    )
    returning id into v_new_id;

    v_created_ids := v_created_ids || v_new_id;

    -- 1) Copy named task priority properties from source task.
    insert into public.entity_properties (
      workspace_id,
      entity_type,
      entity_id,
      field_name,
      field_type,
      value
    )
    select
      p_workspace_id,
      'task',
      v_new_id,
      ep.field_name,
      'priority',
      ep.value
    from public.entity_properties ep
    where ep.entity_type = 'task'
      and ep.entity_id = v_task.id
      and ep.field_type = 'priority'
      and ep.field_name is not null
      and btrim(ep.field_name) <> ''
      and jsonb_typeof(ep.value) = 'string'
      and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
    on conflict (entity_type, entity_id, field_name)
    do update set
      workspace_id = excluded.workspace_id,
      field_type = excluded.field_type,
      value = excluded.value,
      updated_at = now();

    get diagnostics v_priority_rows_inserted = row_count;

    -- 2) Fallback to task_items.priorities payload when no named rows exist.
    if v_priority_rows_inserted = 0 then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        field_name,
        field_type,
        value
      )
      select
        p_workspace_id,
        'task',
        v_new_id,
        btrim(elem->>'field_name') as field_name,
        'priority',
        to_jsonb(lower(btrim(elem->>'value')))
      from jsonb_array_elements(coalesce(v_task.priorities, '[]'::jsonb)) as e(elem)
      where jsonb_typeof(elem) = 'object'
        and jsonb_typeof(elem->'field_name') = 'string'
        and btrim(elem->>'field_name') <> ''
        and jsonb_typeof(elem->'value') = 'string'
        and lower(btrim(elem->>'value')) in ('low', 'medium', 'high', 'urgent')
      on conflict (entity_type, entity_id, field_name)
      do update set
        workspace_id = excluded.workspace_id,
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    end if;

    -- 3) For table_row snapshots, seed task priority rows from source row.
    if v_task.source_entity_type = 'table_row' and v_task.source_entity_id is not null then
      insert into public.entity_properties (
        workspace_id,
        entity_type,
        entity_id,
        field_name,
        field_type,
        value
      )
      select
        p_workspace_id,
        'task',
        v_new_id,
        ep.field_name,
        'priority',
        ep.value
      from public.entity_properties ep
      where ep.entity_type = 'table_row'
        and ep.entity_id = v_task.source_entity_id
        and ep.field_type = 'priority'
        and ep.field_name is not null
        and btrim(ep.field_name) <> ''
        and jsonb_typeof(ep.value) = 'string'
        and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
      on conflict (entity_type, entity_id, field_name)
      do update set
        workspace_id = excluded.workspace_id,
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    end if;

    -- Keep task_items.priorities aligned with named priority rows.
    update public.task_items t
    set priorities = coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'field_name',
            ep.field_name,
            'value',
            lower(btrim(ep.value #>> '{}'))
          )
          order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc
        )
        from public.entity_properties ep
        where ep.entity_type = 'task'
          and ep.entity_id = v_new_id
          and ep.field_type = 'priority'
          and ep.field_name is not null
          and btrim(ep.field_name) <> ''
          and jsonb_typeof(ep.value) = 'string'
          and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
      ),
      '[]'::jsonb
    )
    where t.id = v_new_id;

    if p_include_assignees then
      for v_assignees in
        select *
        from public.task_assignees
        where task_id = v_task.id
      loop
        insert into public.task_assignees (task_id, assignee_id, assignee_name)
        values (v_new_id, v_assignees.assignee_id, v_assignees.assignee_name);
      end loop;

      select coalesce(
        jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'id', ta.assignee_id,
              'name', ta.assignee_name
            )
          )
        ),
        '[]'::jsonb
      )
      into v_assignee_payload
      from public.task_assignees ta
      where ta.task_id = v_new_id;

      if jsonb_array_length(v_assignee_payload) > 0 then
        insert into public.entity_properties (
          workspace_id,
          entity_type,
          entity_id,
          property_definition_id,
          field_name,
          field_type,
          value
        )
        values (
          p_workspace_id,
          'task',
          v_new_id,
          v_assignee_def,
          'Assignee',
          'assignee',
          v_assignee_payload
        )
        on conflict (entity_type, entity_id, field_name)
        do update set
          field_type = excluded.field_type,
          property_definition_id = excluded.property_definition_id,
          value = excluded.value,
          updated_at = now();
      end if;
    end if;

    if p_include_tags then
      for v_tag_links in
        select *
        from public.task_tag_links
        where task_id = v_task.id
      loop
        insert into public.task_tag_links (task_id, tag_id)
        values (v_new_id, v_tag_links.tag_id)
        on conflict do nothing;
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'created_count',
    coalesce(array_length(v_created_ids, 1), 0),
    'created_task_ids',
    v_created_ids,
    'skipped',
    array(
      select id
      from unnest(p_task_ids) as id
      where not exists (
        select 1
        from public.task_items t
        where t.id = id
          and t.workspace_id = p_workspace_id
      )
    )
  );
end;
$$;

create or replace function public.sync_live_task_item_to_source()
returns trigger
language plpgsql
as $$
declare
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_source_task_id := new.source_task_id;
  v_source_entity_type := new.source_entity_type;
  v_source_entity_id := new.source_entity_id;

  if v_source_entity_type = 'table_row' or v_source_entity_type = 'block' then
    return new;
  end if;

  if v_source_entity_type = 'task' and v_source_entity_id is not null then
    v_source_task_id := v_source_entity_id;
  end if;

  if v_source_task_id is null or new.source_sync_mode <> 'live' then
    return new;
  end if;

  if v_source_task_id = new.id then
    return new;
  end if;

  if new.title is distinct from old.title
     or new.status is distinct from old.status
     or new.priorities is distinct from old.priorities
     or new.description is distinct from old.description
     or new.due_date is distinct from old.due_date
     or new.due_time is distinct from old.due_time
     or new.due_time_end is distinct from old.due_time_end
     or new.start_date is distinct from old.start_date
     or new.hide_icons is distinct from old.hide_icons
     or new.recurring_enabled is distinct from old.recurring_enabled
     or new.recurring_frequency is distinct from old.recurring_frequency
     or new.recurring_interval is distinct from old.recurring_interval
     or new.assignee_id is distinct from old.assignee_id then
    update public.task_items
    set
      title = new.title,
      status = new.status,
      priorities = new.priorities,
      description = new.description,
      due_date = new.due_date,
      due_time = new.due_time,
      due_time_end = new.due_time_end,
      start_date = new.start_date,
      hide_icons = new.hide_icons,
      recurring_enabled = new.recurring_enabled,
      recurring_frequency = new.recurring_frequency,
      recurring_interval = new.recurring_interval,
      assignee_id = new.assignee_id,
      updated_by = new.updated_by,
      updated_at = now()
    where id = v_source_task_id
      and workspace_id = new.workspace_id;
  end if;

  return new;
end;
$$;

create or replace function public.sync_live_task_properties_to_source()
returns trigger
language plpgsql
as $$
declare
  v_entity_id uuid;
  v_workspace_id uuid;
  v_property_definition_id uuid;
  v_field_name text;
  v_field_type text;
  v_value jsonb;
  v_source_task_id uuid;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_sync_mode text;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.entity_type <> 'task' then
      return old;
    end if;
    v_entity_id := old.entity_id;
    v_workspace_id := old.workspace_id;
    v_property_definition_id := old.property_definition_id;
    v_field_name := old.field_name;
    v_field_type := old.field_type;
    v_value := null;
  else
    if new.entity_type <> 'task' then
      return new;
    end if;
    v_entity_id := new.entity_id;
    v_workspace_id := new.workspace_id;
    v_property_definition_id := new.property_definition_id;
    v_field_name := new.field_name;
    v_field_type := new.field_type;
    v_value := new.value;
  end if;

  select
    source_task_id,
    source_entity_type,
    source_entity_id,
    source_sync_mode
  into v_source_task_id, v_source_entity_type, v_source_entity_id, v_sync_mode
  from public.task_items
  where id = v_entity_id;

  if v_sync_mode <> 'live' then
    return coalesce(new, old);
  end if;

  if v_source_entity_type = 'table_row' or v_source_entity_type = 'block' then
    return coalesce(new, old);
  end if;

  if v_source_entity_type = 'task' and v_source_entity_id is not null then
    v_source_task_id := v_source_entity_id;
  elsif v_source_task_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.entity_properties
    where entity_type = 'task'
      and entity_id = v_source_task_id
      and field_name = v_field_name;
  else
    insert into public.entity_properties (
      workspace_id,
      entity_type,
      entity_id,
      property_definition_id,
      field_name,
      field_type,
      value
    )
    values (
      v_workspace_id,
      'task',
      v_source_task_id,
      v_property_definition_id,
      v_field_name,
      v_field_type,
      v_value
    )
    on conflict (entity_type, entity_id, field_name)
    do update set
      value = excluded.value,
      field_type = excluded.field_type,
      property_definition_id = excluded.property_definition_id,
      updated_at = now();
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.set_edited_flag_on_task_item_update()
returns trigger
language plpgsql
as $$
begin
  if new.source_entity_id is not null and (
    new.title is distinct from old.title or
    new.description is distinct from old.description or
    new.status is distinct from old.status or
    new.priorities is distinct from old.priorities or
    new.due_date is distinct from old.due_date or
    new.due_time is distinct from old.due_time or
    new.due_time_end is distinct from old.due_time_end or
    new.start_date is distinct from old.start_date
  ) then
    new.edited := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_set_edited_flag_on_task_item_update on public.task_items;
create trigger trigger_set_edited_flag_on_task_item_update
before update on public.task_items
for each row
execute function public.set_edited_flag_on_task_item_update();

commit;
