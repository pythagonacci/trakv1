alter table public.timeline_events
  add column if not exists tags jsonb not null default '[]'::jsonb;
