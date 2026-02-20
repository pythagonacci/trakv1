-- Reconstructed migration: validation for task_items.priorities JSONB.
-- Idempotent and safe to run repeatedly.

create or replace function public.is_valid_task_priorities(p_priorities jsonb)
returns boolean
language sql
immutable
as $$
  with entries as (
    select value as entry
    from jsonb_array_elements(coalesce(p_priorities, '[]'::jsonb))
  ), parsed as (
    select
      nullif(btrim(entry->>'field_name'), '') as field_name,
      entry->>'value' as value
    from entries
  )
  select
    jsonb_typeof(coalesce(p_priorities, '[]'::jsonb)) = 'array'
    and not exists (
      select 1
      from entries
      where jsonb_typeof(entry) <> 'object'
    )
    and not exists (
      select 1
      from parsed
      where field_name is null
         or value not in ('low', 'medium', 'high', 'urgent')
    )
    and not exists (
      select 1
      from (
        select lower(field_name) as key, count(*) as cnt
        from parsed
        group by lower(field_name)
      ) dups
      where dups.cnt > 1
    );
$$;

update public.task_items
set priorities = '[]'::jsonb
where not public.is_valid_task_priorities(priorities);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_items_priorities_valid_check'
  ) then
    alter table public.task_items
      add constraint task_items_priorities_valid_check
      check (public.is_valid_task_priorities(priorities));
  end if;
end $$;

create index if not exists idx_task_items_priorities_gin
  on public.task_items
  using gin (priorities);
