-- Add canonical multi-assignee payload to timeline events.
-- Keep legacy scalar assignee columns for backward compatibility.

alter table public.timeline_events
  add column if not exists assignees jsonb not null default '[]'::jsonb;

-- Backfill assignees from legacy fields when missing.
update public.timeline_events
set assignees = (
  case
    when assignee_id is not null and assignee_team_id is not null then jsonb_build_array(
      jsonb_build_object(
        'field_name', 'Assignee',
        'value', jsonb_build_array(
          jsonb_build_object('type', 'user', 'id', assignee_id::text),
          jsonb_build_object('type', 'team', 'id', assignee_team_id::text)
        )
      )
    )
    when assignee_id is not null then jsonb_build_array(
      jsonb_build_object(
        'field_name', 'Assignee',
        'value', jsonb_build_array(
          jsonb_build_object('type', 'user', 'id', assignee_id::text)
        )
      )
    )
    when assignee_team_id is not null then jsonb_build_array(
      jsonb_build_object(
        'field_name', 'Assignee',
        'value', jsonb_build_array(
          jsonb_build_object('type', 'team', 'id', assignee_team_id::text)
        )
      )
    )
    else '[]'::jsonb
  end
)
where coalesce(jsonb_array_length(assignees), 0) = 0
  and (assignee_id is not null or assignee_team_id is not null);
