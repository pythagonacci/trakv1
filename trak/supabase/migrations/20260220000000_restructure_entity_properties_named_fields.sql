-- Reconstructed migration: add named field support to entity_properties.
-- Keeps property_definition_id for backward compatibility while enabling
-- field_name + field_type as first-class columns.

alter table public.entity_properties
  add column if not exists field_name text,
  add column if not exists field_type text;

-- Backfill from property_definitions where available.
update public.entity_properties ep
set
  field_name = coalesce(ep.field_name, pd.name),
  field_type = coalesce(
    ep.field_type,
    case
      when lower(pd.name) = 'priority' then 'priority'
      when lower(pd.name) = 'status' then 'status'
      when lower(pd.name) = 'assignee' then 'assignee'
      when lower(pd.name) = 'due date' then 'due_date'
      when lower(pd.name) = 'tags' then 'tags'
      else null
    end
  )
from public.property_definitions pd
where ep.property_definition_id = pd.id;

-- Backfill any remaining null names/types with sane defaults.
update public.entity_properties
set field_name = coalesce(field_name, initcap(replace(coalesce(field_type, 'priority'), '_', ' ')));

update public.entity_properties
set field_type = coalesce(field_type, 'priority')
where field_type is null;

alter table public.entity_properties
  alter column field_name set not null,
  alter column field_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entity_properties_field_type_check'
  ) then
    alter table public.entity_properties
      add constraint entity_properties_field_type_check
      check (field_type = any (array['priority','status','assignee','due_date','tags']));
  end if;
end $$;

create unique index if not exists idx_entity_properties_unique_named_field
  on public.entity_properties(entity_type, entity_id, field_name);

create index if not exists idx_entity_properties_workspace_field_type
  on public.entity_properties(workspace_id, field_type);

create index if not exists idx_entity_properties_entity_field_type
  on public.entity_properties(entity_id, field_type);
