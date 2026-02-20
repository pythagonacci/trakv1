-- Ensure tasks created from table_row sources inherit ALL named priority fields.
-- Also backfills existing table_row-sourced task snapshots.

begin;

create or replace function public.seed_task_priorities_from_source_row()
returns trigger
language plpgsql
as $$
begin
  if new.source_entity_type <> 'table_row' or new.source_entity_id is null then
    return new;
  end if;

  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  -- Sync named priority rows from source table_row -> task entity_properties.
  delete from public.entity_properties
  where entity_type = 'task'
    and entity_id = new.id
    and field_type = 'priority';

  insert into public.entity_properties (
    workspace_id,
    entity_type,
    entity_id,
    field_name,
    field_type,
    value
  )
  select
    new.workspace_id,
    'task',
    new.id,
    ep.field_name,
    'priority',
    to_jsonb(lower(btrim(ep.value #>> '{}')))
  from public.entity_properties ep
  where ep.entity_type = 'table_row'
    and ep.entity_id = new.source_entity_id
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

  -- Keep task_items.priorities aligned with the inserted named rows.
  new.priorities := coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'field_name', ep.field_name,
          'value', lower(btrim(ep.value #>> '{}'))
        )
        order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc
      )
      from public.entity_properties ep
      where ep.entity_type = 'task'
        and ep.entity_id = new.id
        and ep.field_type = 'priority'
        and ep.field_name is not null
        and btrim(ep.field_name) <> ''
        and jsonb_typeof(ep.value) = 'string'
        and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
    ),
    '[]'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists task_items_seed_priorities_from_source_row on public.task_items;
create trigger task_items_seed_priorities_from_source_row
before insert on public.task_items
for each row
execute function public.seed_task_priorities_from_source_row();

-- Backfill existing table_row-sourced tasks.
-- Temporarily disable edited-flag trigger so this maintenance update doesn't mark rows as edited.
alter table public.task_items disable trigger trigger_set_edited_flag_on_task_item_update;

-- 1) Rebuild named priority rows on task entities from their source table rows.
delete from public.entity_properties ep
using public.task_items t
where ep.entity_type = 'task'
  and ep.entity_id = t.id
  and ep.field_type = 'priority'
  and t.source_entity_type = 'table_row'
  and t.source_entity_id is not null;

insert into public.entity_properties (
  workspace_id,
  entity_type,
  entity_id,
  field_name,
  field_type,
  value
)
select
  t.workspace_id,
  'task',
  t.id,
  ep.field_name,
  'priority',
  to_jsonb(lower(btrim(ep.value #>> '{}')))
from public.task_items t
join public.entity_properties ep
  on ep.entity_type = 'table_row'
 and ep.entity_id = t.source_entity_id
where t.source_entity_type = 'table_row'
  and t.source_entity_id is not null
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

-- 2) Rebuild task_items.priorities JSONB from named task priority rows.
update public.task_items t
set priorities = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'field_name', ep.field_name,
        'value', lower(btrim(ep.value #>> '{}'))
      )
      order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc
    )
    from public.entity_properties ep
    where ep.entity_type = 'task'
      and ep.entity_id = t.id
      and ep.field_type = 'priority'
      and ep.field_name is not null
      and btrim(ep.field_name) <> ''
      and jsonb_typeof(ep.value) = 'string'
      and lower(btrim(ep.value #>> '{}')) in ('low', 'medium', 'high', 'urgent')
  ),
  '[]'::jsonb
)
where t.source_entity_type = 'table_row'
  and t.source_entity_id is not null;

alter table public.task_items enable trigger trigger_set_edited_flag_on_task_item_update;

commit;
