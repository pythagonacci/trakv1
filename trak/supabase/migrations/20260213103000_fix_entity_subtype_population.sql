-- Make entity_subtype population deterministic for entity_properties rows.
-- This hardens the trigger path and repairs existing rows.

create or replace function public.resolve_entity_subtype(
  p_entity_type text,
  p_entity_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_subtype text;
begin
  if p_entity_type = 'block' then
    select b.type::text
      into resolved_subtype
    from public.blocks b
    where b.id = p_entity_id;

    return coalesce(resolved_subtype, 'block');
  end if;

  if p_entity_type in ('task', 'subtask', 'timeline_event', 'table_row') then
    return p_entity_type;
  end if;

  return null;
end;
$$;

create or replace function public.entity_properties_set_subtype()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.entity_subtype := public.resolve_entity_subtype(new.entity_type, new.entity_id);
  return new;
end;
$$;

drop trigger if exists entity_properties_set_subtype on public.entity_properties;

create trigger entity_properties_set_subtype
before insert or update
on public.entity_properties
for each row
execute function public.entity_properties_set_subtype();

-- Repair existing rows via explicit join for block entries.
update public.entity_properties ep
set entity_subtype = b.type::text
from public.blocks b
where ep.entity_type = 'block'
  and ep.entity_id = b.id
  and ep.entity_subtype is distinct from b.type::text;

-- Ensure non-block entities have canonical subtype values.
update public.entity_properties ep
set entity_subtype = ep.entity_type
where ep.entity_type in ('task', 'subtask', 'timeline_event', 'table_row')
  and ep.entity_subtype is distinct from ep.entity_type;

-- Keep unresolved block rows explicit.
update public.entity_properties ep
set entity_subtype = 'block'
where ep.entity_type = 'block'
  and ep.entity_subtype is null;
