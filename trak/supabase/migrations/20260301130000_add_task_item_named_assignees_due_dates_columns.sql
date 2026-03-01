-- Add named assignees/due-dates columns on task_items for parity with named statuses/priorities.

begin;

alter table public.task_items
  add column if not exists assignees jsonb not null default '[]'::jsonb,
  add column if not exists due_dates jsonb not null default '[]'::jsonb;

-- Backfill assignees from task_assignees when task_items.assignees is empty.
with assignee_agg as (
  select
    ta.task_id,
    array_remove(array_agg(distinct ta.assignee_id::text), null) as assignee_ids
  from public.task_assignees ta
  group by ta.task_id
)
update public.task_items t
set assignees = jsonb_build_array(
  jsonb_build_object(
    'field_name', 'Assignee',
    'value', to_jsonb(coalesce(a.assignee_ids, array[]::text[]))
  )
)
from assignee_agg a
where t.id = a.task_id
  and coalesce(jsonb_array_length(t.assignees), 0) = 0;

-- Backfill due_dates from task_items.start_date/due_date when task_items.due_dates is empty.
update public.task_items t
set due_dates = case
  when t.start_date is null and t.due_date is null then '[]'::jsonb
  else jsonb_build_array(
    jsonb_build_object(
      'field_name', 'Due Date',
      'value', jsonb_build_object(
        'start', t.start_date,
        'end', t.due_date
      )
    )
  )
end
where coalesce(jsonb_array_length(t.due_dates), 0) = 0;

-- If entity_properties already has named assignees/due_dates, prefer that richer named source.
with named_assignees as (
  select
    ep.entity_id,
    jsonb_agg(
      jsonb_build_object(
        'field_name', ep.field_name,
        'value',
          coalesce(
            (
              select jsonb_agg(to_jsonb(assignee_id_txt))
              from (
                select distinct nullif(
                  btrim(
                    case
                      when jsonb_typeof(item) = 'object' then item->>'id'
                      when jsonb_typeof(item) = 'string' then trim(both '"' from item::text)
                      else null
                    end
                  ),
                  ''
                ) as assignee_id_txt
                from jsonb_array_elements(
                  case
                    when jsonb_typeof(ep.value) = 'array' then ep.value
                    else jsonb_build_array(ep.value)
                  end
                ) item
              ) parsed
              where assignee_id_txt is not null
            ),
            '[]'::jsonb
          )
      )
      order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc
    ) as named_value
  from public.entity_properties ep
  where ep.entity_type = 'task'
    and ep.field_type = 'assignee'
    and ep.field_name is not null
    and btrim(ep.field_name) <> ''
  group by ep.entity_id
),
named_due_dates as (
  select
    ep.entity_id,
    jsonb_agg(
      jsonb_build_object(
        'field_name', ep.field_name,
        'value',
          case
            when jsonb_typeof(ep.value) = 'object'
              then jsonb_build_object('start', ep.value->>'start', 'end', ep.value->>'end')
            when jsonb_typeof(ep.value) = 'string'
              then jsonb_build_object('start', null, 'end', trim(both '"' from ep.value::text))
            else null
          end
      )
      order by ep.updated_at desc nulls last, ep.created_at desc nulls last, ep.id desc
    ) filter (
      where
        (jsonb_typeof(ep.value) = 'object' and ((ep.value ? 'start') or (ep.value ? 'end')))
        or jsonb_typeof(ep.value) = 'string'
    ) as named_value
  from public.entity_properties ep
  where ep.entity_type = 'task'
    and ep.field_type = 'due_date'
    and ep.field_name is not null
    and btrim(ep.field_name) <> ''
  group by ep.entity_id
)
update public.task_items t
set assignees = coalesce(na.named_value, t.assignees),
    due_dates = coalesce(nd.named_value, t.due_dates)
from named_assignees na
full outer join named_due_dates nd on nd.entity_id = na.entity_id
where t.id = coalesce(na.entity_id, nd.entity_id);

commit;

