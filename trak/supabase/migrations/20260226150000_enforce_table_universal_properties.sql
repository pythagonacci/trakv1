-- Enforce universal property contract for table priority/status fields:
-- - canonical server-owned field config
-- - canonical row values (never option IDs)

create or replace function public._resolve_field_value_with_property_def(
  p_field_type text,
  p_field_config jsonb,
  p_property_definition_id uuid,
  p_value jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_item jsonb;
  v_item_text text;
  v_result jsonb := '[]'::jsonb;
  v_normalized text;
begin
  if p_field_type not in ('status', 'priority') then
    return public._resolve_field_value(p_field_type, p_field_config, p_value);
  end if;

  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return null;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_item in select * from jsonb_array_elements(p_value) loop
      v_item_text := lower(btrim(v_item #>> '{}'));
      v_normalized := regexp_replace(v_item_text, '[\s-]+', '_', 'g');

      if p_field_type = 'status' then
        if v_normalized in ('todo', 'to_do', 'not_started', 'backlog') then
          v_result := v_result || jsonb_build_array(to_jsonb('todo'::text));
        elsif v_normalized in ('in_progress', 'inprogress', 'doing', 'active', 'working') then
          v_result := v_result || jsonb_build_array(to_jsonb('in_progress'::text));
        elsif v_normalized in ('done', 'complete', 'completed', 'finished') then
          v_result := v_result || jsonb_build_array(to_jsonb('done'::text));
        elsif v_normalized in ('blocked', 'on_hold', 'stuck') then
          v_result := v_result || jsonb_build_array(to_jsonb('blocked'::text));
        end if;
      else
        if v_normalized in ('urgent', 'critical', 'highest', 'p0') then
          v_result := v_result || jsonb_build_array(to_jsonb('urgent'::text));
        elsif v_normalized in ('high', 'p1') then
          v_result := v_result || jsonb_build_array(to_jsonb('high'::text));
        elsif v_normalized in ('medium', 'normal', 'med', 'p2') then
          v_result := v_result || jsonb_build_array(to_jsonb('medium'::text));
        elsif v_normalized in ('low', 'lowest', 'minor', 'p3') then
          v_result := v_result || jsonb_build_array(to_jsonb('low'::text));
        end if;
      end if;
    end loop;
    return v_result;
  end if;

  v_item_text := lower(btrim(p_value #>> '{}'));
  v_normalized := regexp_replace(v_item_text, '[\s-]+', '_', 'g');

  if p_field_type = 'status' then
    if v_normalized in ('todo', 'to_do', 'not_started', 'backlog') then
      return to_jsonb('todo'::text);
    elsif v_normalized in ('in_progress', 'inprogress', 'doing', 'active', 'working') then
      return to_jsonb('in_progress'::text);
    elsif v_normalized in ('done', 'complete', 'completed', 'finished') then
      return to_jsonb('done'::text);
    elsif v_normalized in ('blocked', 'on_hold', 'stuck') then
      return to_jsonb('blocked'::text);
    end if;
    return null;
  end if;

  if v_normalized in ('urgent', 'critical', 'highest', 'p0') then
    return to_jsonb('urgent'::text);
  elsif v_normalized in ('high', 'p1') then
    return to_jsonb('high'::text);
  elsif v_normalized in ('medium', 'normal', 'med', 'p2') then
    return to_jsonb('medium'::text);
  elsif v_normalized in ('low', 'lowest', 'minor', 'p3') then
    return to_jsonb('low'::text);
  end if;

  return null;
end;
$$;

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
  v_cell_value jsonb;
begin
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

  insert into public.table_rows (table_id, data, "order", created_by, updated_by)
  values
    (v_table_id, '{}'::jsonb, 1, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 2, p_created_by, p_created_by),
    (v_table_id, '{}'::jsonb, 3, p_created_by, p_created_by);

  insert into public.table_views (table_id, name, type, is_default, created_by, config)
  values (v_table_id, 'Default view', 'table', true, p_created_by, '{}'::jsonb);

  for v_field in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
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
      case
        when coalesce(v_field->>'type', 'text') = 'priority' then
          '{"levels":[{"id":"urgent","label":"Urgent","color":"#ef4444","order":4},{"id":"high","label":"High","color":"#f59e0b","order":3},{"id":"medium","label":"Medium","color":"#3b82f6","order":2},{"id":"low","label":"Low","color":"#6b7280","order":1}]}'::jsonb
        when coalesce(v_field->>'type', 'text') = 'status' then
          '{"options":[{"id":"todo","label":"To Do","color":"#6b7280"},{"id":"in_progress","label":"In Progress","color":"#3b82f6"},{"id":"done","label":"Done","color":"#10b981"},{"id":"blocked","label":"Blocked","color":"#ef4444"}]}'::jsonb
        else
          coalesce(v_field->'config', '{}'::jsonb)
      end,
      case
        when v_fields_created = 0 then coalesce((v_field->>'isPrimary')::boolean, true)
        else coalesce((v_field->>'isPrimary')::boolean, false)
      end
    );
    v_fields_created := v_fields_created + 1;
  end loop;

  v_has_rows := jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) > 0;
  if v_has_rows then
    select count(*) into v_default_count from public.table_rows tr where tr.table_id = v_table_id;
    if v_default_count <= 3 then
      delete from public.table_rows tr
      where tr.table_id = v_table_id and (tr.data is null or tr.data = '{}'::jsonb);
    end if;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
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

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        null,
        (v_row->'data'->v_field_name)
      );

      if v_cell_value is null then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);
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

create or replace function public.update_table_full(
  p_table_id uuid,
  p_title text,
  p_description text,
  p_updated_by uuid,
  p_add_fields jsonb default '[]'::jsonb,
  p_update_fields jsonb default '[]'::jsonb,
  p_delete_fields jsonb default '[]'::jsonb,
  p_insert_rows jsonb default '[]'::jsonb,
  p_update_rows jsonb default null,
  p_delete_row_ids jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_field jsonb;
  v_row jsonb;
  v_row_ids uuid[];
  v_data jsonb;
  v_field_id uuid;
  v_field_name text;
  v_updates jsonb;
  v_filters jsonb;
  v_result jsonb := '{}'::jsonb;
  v_fields_added int := 0;
  v_fields_updated int := 0;
  v_fields_deleted int := 0;
  v_rows_inserted int := 0;
  v_rows_updated int := 0;
  v_rows_deleted int := 0;
  v_field_type text;
  v_field_config jsonb;
  v_cell_value jsonb;
begin
  if p_title is not null or p_description is not null then
    update public.tables
    set title = coalesce(p_title, title),
        description = coalesce(p_description, description),
        updated_at = now()
    where id = p_table_id;
  end if;

  for v_field in select * from jsonb_array_elements(coalesce(p_add_fields, '[]'::jsonb)) loop
    v_field_name := trim(both ' ' from coalesce(v_field->>'name', ''));
    if v_field_name = '' then
      continue;
    end if;
    if exists (
      select 1 from public.table_fields
      where table_id = p_table_id and lower(name) = lower(v_field_name)
    ) then
      continue;
    end if;
    insert into public.table_fields (table_id, name, type, config, is_primary)
    values (
      p_table_id,
      v_field_name,
      coalesce(v_field->>'type', 'text'),
      case
        when coalesce(v_field->>'type', 'text') = 'priority' then
          '{"levels":[{"id":"urgent","label":"Urgent","color":"#ef4444","order":4},{"id":"high","label":"High","color":"#f59e0b","order":3},{"id":"medium","label":"Medium","color":"#3b82f6","order":2},{"id":"low","label":"Low","color":"#6b7280","order":1}]}'::jsonb
        when coalesce(v_field->>'type', 'text') = 'status' then
          '{"options":[{"id":"todo","label":"To Do","color":"#6b7280"},{"id":"in_progress","label":"In Progress","color":"#3b82f6"},{"id":"done","label":"Done","color":"#10b981"},{"id":"blocked","label":"Blocked","color":"#ef4444"}]}'::jsonb
        else
          coalesce(v_field->'config', '{}'::jsonb)
      end,
      coalesce((v_field->>'isPrimary')::boolean, false)
    );
    v_fields_added := v_fields_added + 1;
  end loop;

  for v_field in select * from jsonb_array_elements(coalesce(p_update_fields, '[]'::jsonb)) loop
    v_field_id := null;
    v_field_name := coalesce(v_field->>'fieldId', null);
    if v_field_name is not null then
      begin
        v_field_id := v_field_name::uuid;
      exception when invalid_text_representation then
        v_field_id := null;
      end;
    end if;
    if v_field_id is null and v_field ? 'fieldName' then
      v_field_id := public._resolve_table_field_id(p_table_id, v_field->>'fieldName');
    end if;
    if v_field_id is null then
      continue;
    end if;

    select type into v_field_type
    from public.table_fields
    where id = v_field_id;

    update public.table_fields
    set name = coalesce(v_field->>'name', name),
        config = case
          when v_field_type = 'priority' then
            '{"levels":[{"id":"urgent","label":"Urgent","color":"#ef4444","order":4},{"id":"high","label":"High","color":"#f59e0b","order":3},{"id":"medium","label":"Medium","color":"#3b82f6","order":2},{"id":"low","label":"Low","color":"#6b7280","order":1}]}'::jsonb
          when v_field_type = 'status' then
            '{"options":[{"id":"todo","label":"To Do","color":"#6b7280"},{"id":"in_progress","label":"In Progress","color":"#3b82f6"},{"id":"done","label":"Done","color":"#10b981"},{"id":"blocked","label":"Blocked","color":"#ef4444"}]}'::jsonb
          when v_field ? 'config' then coalesce(v_field->'config', '{}'::jsonb)
          else config
        end,
        updated_at = now()
    where id = v_field_id;
    v_fields_updated := v_fields_updated + 1;
  end loop;

  for v_field_name in select * from jsonb_array_elements_text(coalesce(p_delete_fields, '[]'::jsonb)) loop
    v_field_id := public._resolve_table_field_id(p_table_id, v_field_name);
    if v_field_id is null then
      continue;
    end if;
    delete from public.table_fields where id = v_field_id;
    v_fields_deleted := v_fields_deleted + 1;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_insert_rows, '[]'::jsonb)) loop
    v_data := '{}'::jsonb;
    for v_field_name, v_field_id in
      select key, public._resolve_table_field_id(p_table_id, key)
      from jsonb_each(coalesce(v_row->'data', '{}'::jsonb))
    loop
      if v_field_id is null then
        continue;
      end if;

      select type, config
      into v_field_type, v_field_config
      from public.table_fields
      where id = v_field_id;

      v_cell_value := public._resolve_field_value_with_property_def(
        v_field_type,
        v_field_config,
        null,
        (v_row->'data'->v_field_name)
      );
      if v_cell_value is null then
        continue;
      end if;

      v_data := v_data || jsonb_build_object(v_field_id::text, v_cell_value);
    end loop;
    insert into public.table_rows (table_id, data, created_by, updated_by)
    values (p_table_id, v_data, p_updated_by, p_updated_by);
    v_rows_inserted := v_rows_inserted + 1;
  end loop;

  if p_update_rows is not null then
    v_filters := p_update_rows->'filters';
    v_updates := p_update_rows->'updates';
    if v_updates is not null then
      select updated, row_ids into v_rows_updated, v_row_ids
      from public.update_table_rows_by_field_names(p_table_id, v_filters, v_updates, null, p_updated_by)
      limit 1;
    end if;
  end if;

  if jsonb_typeof(p_delete_row_ids) = 'array' and jsonb_array_length(p_delete_row_ids) > 0 then
    delete from public.table_rows
    where table_id = p_table_id and id in (
      select (value::text)::uuid from jsonb_array_elements_text(p_delete_row_ids)
    );
    get diagnostics v_rows_deleted = row_count;
  end if;

  v_result := v_result || jsonb_build_object('fieldsAdded', v_fields_added);
  v_result := v_result || jsonb_build_object('fieldsUpdated', v_fields_updated);
  v_result := v_result || jsonb_build_object('fieldsDeleted', v_fields_deleted);
  v_result := v_result || jsonb_build_object('rowsInserted', v_rows_inserted);
  v_result := v_result || jsonb_build_object('rowsUpdated', v_rows_updated);
  v_result := v_result || jsonb_build_object('rowsDeleted', v_rows_deleted);

  return v_result;
end;
$$;
