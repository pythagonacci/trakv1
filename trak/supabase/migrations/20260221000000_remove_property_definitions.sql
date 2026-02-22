-- Properties Refactor: Remove property_definitions and property_definition_id
-- This migration eliminates the property_definitions system entirely.
-- Properties are now identified by field_type + field_name + value.

begin;

-- ============================================================================
-- 1. Drop property_definition_id from entity_properties
-- ============================================================================

-- Drop the old unique constraint that uses property_definition_id
alter table public.entity_properties
  drop constraint if exists entity_properties_entity_property_unique;

-- Drop indexes that reference property_definition_id
drop index if exists idx_entity_properties_property_definition;
drop index if exists idx_entity_props_workspace_propdef_entity;

-- Drop FK from entity_properties -> property_definitions
alter table public.entity_properties
  drop constraint if exists entity_properties_property_definition_id_fkey;

-- Drop the column
alter table public.entity_properties
  drop column if exists property_definition_id;

-- ============================================================================
-- 2. Drop property_definition_id from table_fields
-- ============================================================================

-- Drop FK from table_fields -> property_definitions
alter table public.table_fields
  drop constraint if exists table_fields_property_definition_id_fkey;

-- Drop the column
alter table public.table_fields
  drop column if exists property_definition_id;

-- ============================================================================
-- 3. Drop create_default_property_definitions trigger + function
-- ============================================================================

-- Drop the trigger on workspaces that auto-creates property definitions
-- (trigger may be named create_default_properties_on_workspace or create_default_property_definitions)
drop trigger if exists create_default_properties_on_workspace on public.workspaces;
drop trigger if exists create_default_property_definitions on public.workspaces;
drop function if exists public.create_default_property_definitions() cascade;

-- ============================================================================
-- 4. Drop property_definitions table
-- ============================================================================

-- Drop the updated_at trigger first
drop trigger if exists property_definitions_set_updated_at on public.property_definitions;

-- Drop the table
drop table if exists public.property_definitions cascade;

-- ============================================================================
-- 5. Update entity_properties_populate_named_fields trigger
--    Remove the property_definitions lookup (column is gone now)
-- ============================================================================

create or replace function public.entity_properties_populate_named_fields()
returns trigger
language plpgsql
as $$
declare
  v_inferred_type text;
begin
  -- If field_name is missing, derive from field_type
  if new.field_name is null or btrim(new.field_name) = '' then
    new.field_name := case new.field_type
      when 'priority' then 'Priority'
      when 'status' then 'Status'
      when 'assignee' then 'Assignee'
      when 'due_date' then 'Due Date'
      when 'tags' then 'Tags'
      else null
    end;
  end if;

  -- If field_type is missing, infer from field_name
  if new.field_type is null then
    v_inferred_type := case
      when lower(coalesce(new.field_name, '')) like '%priority%' then 'priority'
      when lower(coalesce(new.field_name, '')) like '%status%' then 'status'
      when lower(coalesce(new.field_name, '')) like '%assignee%' then 'assignee'
      when lower(coalesce(new.field_name, '')) like '%due date%' or lower(coalesce(new.field_name, '')) like '%due_date%' then 'due_date'
      when lower(coalesce(new.field_name, '')) like '%tag%' then 'tags'
      else null
    end;
    new.field_type := v_inferred_type;
  end if;

  if new.field_name is null or btrim(new.field_name) = '' or new.field_type is null then
    raise exception 'entity_properties requires field_name and field_type for row id=%', coalesce(new.id::text, '<new>');
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 6. Simplify _resolve_field_value_with_property_def
--    No longer looks up property_definitions. Resolves values from fixed options.
-- ============================================================================

-- Drop the old function (it has a specific signature with property_definition_id param)
drop function if exists public._resolve_field_value_with_property_def(text, jsonb, uuid, jsonb);

-- Create a simplified version that uses fixed options
create or replace function public._resolve_field_value_with_property_def(
  p_field_type text,
  p_field_config jsonb,
  p_property_definition_id uuid,  -- kept for backward compat, ignored
  p_value jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_valid_options text[];
  v_item jsonb;
  v_item_text text;
  v_result jsonb := '[]'::jsonb;
begin
  -- For status and priority, validate against fixed options
  if p_field_type = 'status' then
    v_valid_options := array['todo', 'in_progress', 'done', 'blocked'];
  elsif p_field_type = 'priority' then
    v_valid_options := array['low', 'medium', 'high', 'urgent'];
  else
    -- For other types, delegate to _resolve_field_value
    return public._resolve_field_value(p_field_type, p_field_config, p_value);
  end if;

  -- Handle array values
  if jsonb_typeof(p_value) = 'array' then
    for v_item in select * from jsonb_array_elements(p_value) loop
      v_item_text := lower(btrim(v_item #>> '{}'));
      if v_item_text = any(v_valid_options) then
        v_result := v_result || jsonb_build_array(to_jsonb(v_item_text));
      end if;
    end loop;
    return v_result;
  end if;

  -- Handle scalar values
  v_item_text := lower(btrim(p_value #>> '{}'));
  if v_item_text = any(v_valid_options) then
    return to_jsonb(v_item_text);
  end if;

  return null;
end;
$$;

-- ============================================================================
-- 7. Update create_task_full — remove property_definitions lookup
-- ============================================================================

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

  -- Insert assignees
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

  -- Sync assignees to entity_properties (no property_definition_id)
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
      v_task.id,
      'Assignee',
      'assignee',
      v_assignee_payload
    )
    on conflict (entity_type, entity_id, field_name)
    do update set
      field_type = excluded.field_type,
      value = excluded.value,
      updated_at = now();
  end if;

  -- Insert tags
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

-- ============================================================================
-- 8. Update update_task_full — remove property_definitions lookup
-- ============================================================================

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
        p_task_id,
        'Assignee',
        'assignee',
        v_assignee_payload
      )
      on conflict (entity_type, entity_id, field_name)
      do update set
        field_type = excluded.field_type,
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

-- ============================================================================
-- 9. Update duplicate_tasks_to_block — remove property_definitions lookup
-- ============================================================================

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
  v_assignees record;
  v_assignee_payload jsonb;
  v_tag_links record;
  v_priority_rows_inserted int := 0;
begin
  select coalesce(max(display_order), -1)
  into v_max_order
  from public.task_items
  where task_block_id = p_target_block_id;

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

    -- Copy all entity_properties from source task (not just priority)
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
      ep.field_type,
      ep.value
    from public.entity_properties ep
    where ep.entity_type = 'task'
      and ep.entity_id = v_task.id
      and ep.field_name is not null
      and btrim(ep.field_name) <> ''
    on conflict (entity_type, entity_id, field_name)
    do update set
      workspace_id = excluded.workspace_id,
      field_type = excluded.field_type,
      value = excluded.value,
      updated_at = now();

    get diagnostics v_priority_rows_inserted = row_count;

    -- Fallback: if no priority rows were copied from entity_properties, seed from task_items.priorities
    if not exists (
      select 1 from public.entity_properties
      where entity_type = 'task' and entity_id = v_new_id and field_type = 'priority'
    ) then
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

    -- For table_row snapshots, seed task priority rows from source row
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

    -- Keep task_items.priorities aligned with named priority rows
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
          field_name,
          field_type,
          value
        )
        values (
          p_workspace_id,
          'task',
          v_new_id,
          'Assignee',
          'assignee',
          v_assignee_payload
        )
        on conflict (entity_type, entity_id, field_name)
        do update set
          field_type = excluded.field_type,
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

-- ============================================================================
-- 10. Update sync_live_task_properties_to_source — remove property_definition_id
-- ============================================================================

create or replace function public.sync_live_task_properties_to_source()
returns trigger
language plpgsql
as $$
declare
  v_entity_id uuid;
  v_workspace_id uuid;
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
    v_field_name := old.field_name;
    v_field_type := old.field_type;
    v_value := null;
  else
    if new.entity_type <> 'task' then
      return new;
    end if;
    v_entity_id := new.entity_id;
    v_workspace_id := new.workspace_id;
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
      field_name,
      field_type,
      value
    )
    values (
      v_workspace_id,
      'task',
      v_source_task_id,
      v_field_name,
      v_field_type,
      v_value
    )
    on conflict (entity_type, entity_id, field_name)
    do update set
      value = excluded.value,
      field_type = excluded.field_type,
      updated_at = now();
  end if;

  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 11. Update create_table_full — remove property_definitions lookup for fields
-- ============================================================================

create or replace function public.create_table_full(
  p_workspace_id uuid,
  p_project_id uuid,
  p_tab_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_fields jsonb default null,
  p_rows jsonb default null,
  p_created_by uuid default null,
  out result_table_id uuid,
  out result_fields_created int,
  out result_rows_inserted int
)
returns record
language plpgsql
as $$
declare
  v_table_id uuid;
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_order numeric;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_field_name text;
  v_fields_created int := 0;
  v_rows_inserted int := 0;
  v_has_rows boolean := false;
  v_has_fields boolean := false;
  v_default_count int := 0;
  v_source_entity_type text;
  v_source_entity_id uuid;
  v_source_sync_mode text;
begin
  -- Create the table
  insert into public.tables (workspace_id, project_id, tab_id, title, description, created_by)
  values (p_workspace_id, p_project_id, p_tab_id, coalesce(p_title, 'Untitled Table'), p_description, p_created_by)
  returning id into v_table_id;

  v_has_fields := jsonb_typeof(p_fields) = 'array' and jsonb_array_length(p_fields) > 0;

  if not v_has_fields then
    insert into public.table_fields (table_id, name, type, config, is_primary, "order")
    values
      (v_table_id, 'Name', 'text', '{}'::jsonb, true, 1),
      (v_table_id, 'Column 2', 'text', '{}'::jsonb, false, 2),
      (v_table_id, 'Column 3', 'text', '{}'::jsonb, false, 3);
  end if;

  -- Default rows
  insert into public.table_rows (table_id, data, "order", created_by, updated_by)
  values
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  -- Default view
  insert into public.table_views (table_id, name, type, is_default, created_by, config)
  values (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  -- Add custom fields (no property_definition_id)
  for v_field in select * from jsonb_array_elements(p_fields) loop
    v_field_name := trim(both ' ' from coalesce(v_field->>'name', ''));
    if v_field_name = '' then
      continue;
    end if;
    if exists (
      select 1 from public.table_fields tf
      where tf.table_id = v_table_id and lower(tf.name) = lower(v_field_name)
    ) then
      continue;
    end if;

    insert into public.table_fields (table_id, name, type, config, is_primary)
    values (
      v_table_id,
      v_field_name,
      coalesce(v_field->>'type', 'text'),
      coalesce(v_field->'config', '{}'::jsonb),
      case
        when v_fields_created = 0 then coalesce((v_field->>'isPrimary')::boolean, true)
        else coalesce((v_field->>'isPrimary')::boolean, false)
      end
    );
    v_fields_created := v_fields_created + 1;
  end loop;

  -- Rows (optional)
  v_has_rows := jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) > 0;
  if v_has_rows then
    select count(*) into v_default_count from public.table_rows tr where tr.table_id = v_table_id;
    if v_default_count <= 3 then
      delete from public.table_rows tr
      where tr.table_id = v_table_id and (tr.data is null or tr.data = '{}'::jsonb);
    end if;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_data := '{}'::jsonb;
    v_order := null;
    v_source_entity_type := null;
    v_source_entity_id := null;
    v_source_sync_mode := null;

    if v_row ? 'order' then
      begin
        v_order := (v_row->>'order')::numeric;
      exception when invalid_text_representation then
        v_order := null;
      end;
    end if;

    if v_row ? 'source_entity_type' then
      v_source_entity_type := v_row->>'source_entity_type';
    end if;
    if v_row ? 'source_entity_id' then
      begin
        v_source_entity_id := (v_row->>'source_entity_id')::uuid;
      exception when invalid_text_representation then
        v_source_entity_id := null;
      end;
    end if;
    if v_row ? 'source_sync_mode' then
      v_source_sync_mode := v_row->>'source_sync_mode';
    end if;

    for v_field_name, v_field_id in
      select key, public._resolve_table_field_id(v_table_id, key)
      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))
    loop
      if v_field_id is null then
        continue;
      end if;

      select type, config into v_field_type, v_field_config
      from public.table_fields
      where id = v_field_id;

      if v_field_type in ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, (v_row->'data'->v_field_name));
    end loop;

    insert into public.table_rows (
      table_id,
      data,
      "order",
      source_entity_type,
      source_entity_id,
      source_sync_mode,
      created_by,
      updated_by
    )
    values (
      v_table_id,
      v_data,
      v_order,
      v_source_entity_type,
      v_source_entity_id,
      v_source_sync_mode,
      p_created_by,
      p_created_by
    );
    v_rows_inserted := v_rows_inserted + 1;
  end loop;

  result_table_id := v_table_id;
  result_fields_created := v_fields_created;
  result_rows_inserted := v_rows_inserted;
  return;
end;
$$;

-- ============================================================================
-- 12. Update bulk_insert_rows — remove property_definition_id usage
-- ============================================================================

create or replace function public.bulk_insert_rows(
  p_table_id uuid,
  p_rows jsonb,
  p_created_by uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_row jsonb;
  v_data jsonb;
  v_order numeric;
  v_field_name text;
  v_field_id uuid;
  v_field_type text;
  v_field_config jsonb;
  v_table_field_name text;
  v_cell_value jsonb;
  v_inserted_ids uuid[] := array[]::uuid[];
  v_row_id uuid;
  v_named_fixed_values jsonb;
  v_fixed_entry record;
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.tables
  where id = p_table_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_data := '{}'::jsonb;
    v_named_fixed_values := '{}'::jsonb;
    v_order := null;

    if v_row ? 'order' then
      begin
        v_order := (v_row->>'order')::numeric;
      exception when invalid_text_representation then
        v_order := null;
      end;
    end if;

    for v_field_name, v_field_id in
      select key, public._resolve_table_field_id(p_table_id, key)
      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))
    loop
      if v_field_id is null then
        continue;
      end if;

      select name, type, config
      into v_table_field_name, v_field_type, v_field_config
      from public.table_fields
      where id = v_field_id;

      if v_field_type in ('rollup', 'formula', 'created_time', 'last_edited_time', 'created_by', 'last_edited_by') then
        continue;
      end if;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        null,  -- no property_definition_id
        (v_row->'data'->v_field_name)
      );

      if v_cell_value is null then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);

      if v_field_type in ('status', 'priority') and v_table_field_name is not null and btrim(v_table_field_name) <> '' then
        v_named_fixed_values := v_named_fixed_values || jsonb_build_object(
          v_table_field_name,
          jsonb_build_object(
            'field_type', v_field_type,
            'value', v_cell_value
          )
        );
      end if;
    end loop;

    insert into public.table_rows (table_id, data, "order", created_by, updated_by)
    values (p_table_id, v_data, v_order, p_created_by, p_created_by)
    returning id into v_row_id;

    v_inserted_ids := v_inserted_ids || v_row_id;

    for v_fixed_entry in select key, value from jsonb_each(v_named_fixed_values) loop
      insert into public.entity_properties (
        entity_type,
        entity_id,
        workspace_id,
        field_name,
        field_type,
        value
      )
      values (
        'table_row',
        v_row_id,
        v_workspace_id,
        v_fixed_entry.key,
        v_fixed_entry.value->>'field_type',
        v_fixed_entry.value->'value'
      )
      on conflict (entity_type, entity_id, field_name)
      do update set
        workspace_id = excluded.workspace_id,
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    end loop;

    -- Remove stale legacy rows
    delete from public.entity_properties ep
    where ep.entity_type = 'table_row'
      and ep.entity_id = v_row_id
      and ep.field_type in ('priority', 'status')
      and not exists (
        select 1
        from public.table_fields tf
        where tf.table_id = p_table_id
          and tf.type = ep.field_type
          and lower(btrim(tf.name)) = lower(btrim(ep.field_name))
      );
  end loop;

  return jsonb_build_object('inserted_ids', v_inserted_ids);
end;
$$;

-- ============================================================================
-- 13. Update update_table_rows_by_field_names — remove property_definition_id
-- ============================================================================

drop function if exists public.update_table_rows_by_field_names(uuid, jsonb, jsonb, integer, uuid);

create or replace function public.update_table_rows_by_field_names(
  p_table_id uuid,
  p_filters jsonb default null,
  p_updates jsonb default '{}'::jsonb,
  p_limit int default 500,
  p_updated_by uuid default null,
  out updated int,
  out row_ids uuid[]
)
returns record
language plpgsql
as $$
declare
  v_updates_by_id jsonb := '{}'::jsonb;
  v_named_fixed_updates jsonb := '{}'::jsonb;
  v_filter_key text;
  v_filter_val jsonb;
  v_filter_text text;
  v_field_id uuid;
  v_field_type text;
  v_field_name text;
  v_field_config jsonb;
  v_ids uuid[];
  v_ids_next uuid[];
  v_limit int := coalesce(p_limit, 500);
  v_workspace_id uuid;
  v_fixed_entry record;
  v_value jsonb;
begin
  select workspace_id into v_workspace_id
  from public.tables
  where id = p_table_id;

  -- Resolve updates by table field id
  for v_filter_key, v_filter_val in
    select key, value from jsonb_each(coalesce(p_updates, '{}'::jsonb))
  loop
    v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
    if v_field_id is null then
      raise exception 'Unknown field "%" in updates', v_filter_key;
    end if;

    select name, type, config
    into v_field_name, v_field_type, v_field_config
    from public.table_fields
    where id = v_field_id;

    v_value := public._resolve_field_value_with_property_def(
      v_field_type,
      v_field_config,
      null,  -- no property_definition_id
      v_filter_val
    );

    v_updates_by_id := v_updates_by_id || jsonb_build_object(v_field_id::text, v_value);

    if v_field_type in ('status', 'priority') and v_field_name is not null and btrim(v_field_name) <> '' then
      v_named_fixed_updates := v_named_fixed_updates || jsonb_build_object(
        v_field_name,
        jsonb_build_object(
          'field_type', v_field_type,
          'value', v_value
        )
      );
    end if;
  end loop;

  -- Seed candidate ids
  select array_agg(id) into v_ids
  from public.table_rows
  where table_id = p_table_id
  limit v_limit;

  if v_ids is null then
    updated := 0;
    row_ids := array[]::uuid[];
    return;
  end if;

  -- Apply filters
  if p_filters is not null then
    for v_filter_key, v_filter_val in select key, value from jsonb_each(p_filters) loop
      v_field_id := public._resolve_table_field_id(p_table_id, v_filter_key);
      if v_field_id is null then
        raise exception 'Unknown field "%" in filters', v_filter_key;
      end if;

      if jsonb_typeof(v_filter_val) not in ('object', 'array') then
        v_filter_text := trim(both '"' from v_filter_val::text);
      else
        v_filter_text := null;
      end if;

      v_ids_next := array(
        select id
        from public.table_rows
        where table_id = p_table_id
          and id = any(v_ids)
          and (
            (jsonb_typeof(v_filter_val) = 'object' and (
              (v_filter_val->>'op' = 'is_null' and (data->>v_field_id::text) is null)
              or (v_filter_val->>'op' = 'not_null' and (data->>v_field_id::text) is not null)
              or (v_filter_val->>'op' = 'eq' and lower(coalesce(data->>v_field_id::text, '')) = lower(coalesce(v_filter_val->>'value', '')))
              or (v_filter_val->>'op' = 'neq' and lower(coalesce(data->>v_field_id::text, '')) <> lower(coalesce(v_filter_val->>'value', '')))
              or (v_filter_val->>'op' = 'contains' and lower(coalesce(data->>v_field_id::text, '')) like '%' || lower(coalesce(v_filter_val->>'value', '')) || '%')
            ))
            or (jsonb_typeof(v_filter_val) = 'array' and lower(coalesce(data->>v_field_id::text, '')) in (
              select lower(value::text) from jsonb_array_elements_text(v_filter_val)
            ))
            or (jsonb_typeof(v_filter_val) not in ('object', 'array') and (
              v_filter_text is not null
              and lower(coalesce(data->>v_field_id::text, '')) = lower(v_filter_text)
            ))
          )
      );
      v_ids := v_ids_next;
    end loop;
  end if;

  if v_ids is null or array_length(v_ids, 1) is null then
    updated := 0;
    row_ids := array[]::uuid[];
    return;
  end if;

  update public.table_rows
  set data = coalesce(data, '{}'::jsonb) || v_updates_by_id,
      updated_by = p_updated_by,
      edited = case when source_entity_id is not null then true else coalesce(edited, false) end
  where table_id = p_table_id and id = any(v_ids);

  -- Sync fixed fields by named field_name key
  for v_fixed_entry in select key, value from jsonb_each(v_named_fixed_updates) loop
    v_field_name := v_fixed_entry.key;
    v_field_type := v_fixed_entry.value->>'field_type';
    v_value := v_fixed_entry.value->'value';

    if v_value is null
       or jsonb_typeof(v_value) = 'null'
       or btrim(trim(both '"' from v_value::text)) = '' then
      delete from public.entity_properties
      where entity_type = 'table_row'
        and entity_id = any(v_ids)
        and lower(field_name) = lower(v_field_name);
    else
      insert into public.entity_properties (
        entity_type,
        entity_id,
        workspace_id,
        field_name,
        field_type,
        value
      )
      select
        'table_row',
        id,
        v_workspace_id,
        v_field_name,
        v_field_type,
        v_value
      from unnest(v_ids) as id
      on conflict (entity_type, entity_id, field_name)
      do update set
        workspace_id = excluded.workspace_id,
        field_type = excluded.field_type,
        value = excluded.value,
        updated_at = now();
    end if;

    -- Remove stale legacy rows
    delete from public.entity_properties ep
    where ep.entity_type = 'table_row'
      and ep.entity_id = any(v_ids)
      and ep.field_type = v_field_type
      and not exists (
        select 1
        from public.table_fields tf
        where tf.table_id = p_table_id
          and tf.type = ep.field_type
          and lower(btrim(tf.name)) = lower(btrim(ep.field_name))
      );
  end loop;

  updated := coalesce(array_length(v_ids, 1), 0);
  row_ids := v_ids;
  return;
end;
$$;

-- ============================================================================
-- 14. Update bulk_set_task_assignees — remove property_definition_id
-- ============================================================================

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
  end loop;

  return jsonb_build_object('updated_count', array_length(p_task_ids, 1));
end;
$$;

commit;
