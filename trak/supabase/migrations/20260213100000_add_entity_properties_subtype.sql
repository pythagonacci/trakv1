-- Add subtype metadata to entity_properties so block entities can distinguish
-- link/text/file/etc while preserving existing entity_type semantics.

alter table public.entity_properties
  add column if not exists entity_subtype text;

create or replace function public.resolve_entity_subtype(
  p_entity_type text,
  p_entity_id uuid
)
returns text
language plpgsql
stable
as $$
declare
  resolved_subtype text;
begin
  if p_entity_type = 'block' then
    select b.type
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
as $$
begin
  new.entity_subtype := public.resolve_entity_subtype(new.entity_type, new.entity_id);
  return new;
end;
$$;

drop trigger if exists entity_properties_set_subtype on public.entity_properties;

create trigger entity_properties_set_subtype
before insert or update of entity_type, entity_id
on public.entity_properties
for each row
execute function public.entity_properties_set_subtype();

update public.entity_properties ep
set entity_subtype = public.resolve_entity_subtype(ep.entity_type, ep.entity_id)
where ep.entity_subtype is distinct from public.resolve_entity_subtype(ep.entity_type, ep.entity_id);

create index if not exists idx_entity_properties_entity_type_subtype
  on public.entity_properties(entity_type, entity_subtype);

create or replace function public.sync_block_type_to_entity_properties_subtype()
returns trigger
language plpgsql
as $$
begin
  if old.type is distinct from new.type then
    update public.entity_properties ep
    set entity_subtype = new.type
    where ep.entity_type = 'block'
      and ep.entity_id = new.id
      and ep.entity_subtype is distinct from new.type;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_block_type_to_entity_properties_subtype_trigger on public.blocks;

create trigger sync_block_type_to_entity_properties_subtype_trigger
after update of type
on public.blocks
for each row
execute function public.sync_block_type_to_entity_properties_subtype();
