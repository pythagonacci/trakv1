alter table public.cards
  add column if not exists text_rows jsonb not null default '[]'::jsonb;

comment on column public.cards.text_rows is 'Structured rows for text-card rendering. Typed rows mirror universal properties while text rows store local values.';
