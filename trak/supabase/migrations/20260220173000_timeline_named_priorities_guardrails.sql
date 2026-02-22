-- Timeline named-priority guardrails.
-- Aligns timeline_events.priorities with task_items.priorities validation semantics.

create or replace function public.is_valid_timeline_priorities(p_priorities jsonb)
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

-- Backwards-compatible alias used by existing constraints in some environments.
create or replace function public.is_valid_timeline_event_priorities(p_priorities jsonb)
returns boolean
language sql
immutable
as $$
  select public.is_valid_timeline_priorities(p_priorities);
$$;

update public.timeline_events
set priorities = '[]'::jsonb
where not public.is_valid_timeline_priorities(priorities);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'timeline_events_priorities_valid_check'
      and conrelid = 'public.timeline_events'::regclass
  ) then
    alter table public.timeline_events
      drop constraint timeline_events_priorities_valid_check;
  end if;

  alter table public.timeline_events
    add constraint timeline_events_priorities_valid_check
    check (public.is_valid_timeline_priorities(priorities));
end $$;

create index if not exists idx_timeline_events_priorities_gin
  on public.timeline_events
  using gin (priorities);

-- Ensure edited snapshots include all timeline fields touched by named-priority rollout.
create or replace function public.set_edited_flag_on_timeline_event_update()
returns trigger
language plpgsql
as $$
begin
  if new.source_entity_id is not null and (
    new.title is distinct from old.title or
    new.notes is distinct from old.notes or
    new.start_date is distinct from old.start_date or
    new.end_date is distinct from old.end_date or
    new.status is distinct from old.status or
    new.priorities is distinct from old.priorities or
    new.assignee_id is distinct from old.assignee_id or
    new.progress is distinct from old.progress or
    new.color is distinct from old.color or
    new.is_milestone is distinct from old.is_milestone
  ) then
    new.edited := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_set_edited_flag_on_timeline_event_update on public.timeline_events;
create trigger trigger_set_edited_flag_on_timeline_event_update
  before update on public.timeline_events
  for each row
  execute function public.set_edited_flag_on_timeline_event_update();
