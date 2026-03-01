-- Keep table_row entity_properties field_name in sync when table_fields are renamed.
-- This closes rename drift for all rename paths (including update_table_full RPC).

create or replace function public.sync_table_row_property_names_on_field_rename()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Only relevant for renamed status/priority fields.
  if new.name is not distinct from old.name then
    return new;
  end if;
  if new.type not in ('priority', 'status') then
    return new;
  end if;
  if old.name is null or btrim(old.name) = '' or new.name is null or btrim(new.name) = '' then
    return new;
  end if;

  -- If a row already has both old and new names, keep the new-name row and drop old.
  delete from public.entity_properties ep_old
  using public.table_rows tr
  where tr.table_id = new.table_id
    and ep_old.entity_type = 'table_row'
    and ep_old.entity_id = tr.id
    and ep_old.field_type = new.type
    and ep_old.field_name = old.name
    and exists (
      select 1
      from public.entity_properties ep_new
      where ep_new.entity_type = 'table_row'
        and ep_new.entity_id = ep_old.entity_id
        and ep_new.field_type = new.type
        and ep_new.field_name = new.name
    );

  -- Rename remaining old-name rows to the new field name.
  update public.entity_properties ep
  set field_name = new.name,
      updated_at = now()
  from public.table_rows tr
  where tr.table_id = new.table_id
    and ep.entity_type = 'table_row'
    and ep.entity_id = tr.id
    and ep.field_type = new.type
    and ep.field_name = old.name;

  return new;
end;
$$;

drop trigger if exists trigger_sync_table_row_property_names_on_field_rename on public.table_fields;
create trigger trigger_sync_table_row_property_names_on_field_rename
after update of name on public.table_fields
for each row
execute function public.sync_table_row_property_names_on_field_rename();

