alter type public.block_type add value if not exists 'cards';

comment on type public.block_type is 'Types of blocks that can be added to tabs: text, task, link, divider, table, timeline, file, video, image, gallery, embed, pdf, section, section_header, doc_reference, chart, shopify_product, cards';

alter table public.entity_properties
  drop constraint if exists entity_properties_entity_type_check1;

alter table public.entity_properties
  add constraint entity_properties_entity_type_check1
  check (
    entity_type = any (
      array[
        'block'::text,
        'task'::text,
        'subtask'::text,
        'timeline_event'::text,
        'table_row'::text,
        'card'::text
      ]
    )
  );

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  cards_block_id uuid not null references public.blocks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  tab_id uuid references public.tabs(id) on delete set null,
  title text not null default '',
  notes text,
  asset_file_id uuid references public.files(id) on delete set null,
  asset_kind text,
  asset_caption text,
  display_order integer not null default 0,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  start_date date,
  tags text[] not null default '{}'::text[],
  priorities jsonb not null default '[]'::jsonb,
  statuses jsonb not null default '[]'::jsonb,
  assignees jsonb not null default '[]'::jsonb,
  due_dates jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint cards_asset_kind_check
    check (
      asset_kind is null
      or asset_kind = any (array['image'::text, 'video'::text, 'file'::text])
    ),
  constraint cards_priorities_valid_check
    check (public.is_valid_task_priorities(priorities))
);

comment on table public.cards is 'Structured card entities that belong to a cards block and mirror universal properties in both table columns and entity_properties.';
comment on column public.cards.asset_file_id is 'Primary visual/file asset attached to the card.';

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  text text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.card_comments is 'Comments attached to individual card entities.';

create index if not exists idx_cards_block on public.cards(cards_block_id);
create index if not exists idx_cards_block_order on public.cards(cards_block_id, display_order);
create index if not exists idx_cards_workspace on public.cards(workspace_id);
create index if not exists idx_cards_due on public.cards(due_date);
create index if not exists idx_cards_assignee on public.cards(assignee_id);
create index if not exists idx_cards_asset_file on public.cards(asset_file_id) where asset_file_id is not null;
create index if not exists idx_card_comments_card on public.card_comments(card_id);
create index if not exists idx_card_comments_card_created on public.card_comments(card_id, created_at);

create or replace function public.cleanup_entity_properties_on_card_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.entity_properties
  where entity_type = 'card'
    and entity_id = old.id;

  delete from public.entity_links
  where (source_entity_type = 'card' and source_entity_id = old.id)
     or (target_entity_type = 'card' and target_entity_id = old.id);

  return old;
end;
$$;

create or replace function public.resolve_entity_subtype(p_entity_type text, p_entity_id uuid)
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

  if p_entity_type in ('task', 'subtask', 'timeline_event', 'table_row', 'card') then
    return p_entity_type;
  end if;

  return null;
end;
$$;

drop trigger if exists cleanup_entity_properties_on_card_delete_trigger on public.cards;
create trigger cleanup_entity_properties_on_card_delete_trigger
before delete on public.cards
for each row
execute function public.cleanup_entity_properties_on_card_delete();

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
before update on public.cards
for each row
execute function public.set_updated_at();

drop trigger if exists card_comments_set_updated_at on public.card_comments;
create trigger card_comments_set_updated_at
before update on public.card_comments
for each row
execute function public.set_updated_at();

alter table public.cards enable row level security;
alter table public.card_comments enable row level security;

create policy "Cards visible to workspace members"
on public.cards
for select
using (
  workspace_id in (
    select workspace_members.workspace_id
    from public.workspace_members
    where workspace_members.user_id = auth.uid()
  )
);

create policy "Cards insertable by workspace members"
on public.cards
for insert
with check (
  workspace_id in (
    select workspace_members.workspace_id
    from public.workspace_members
    where workspace_members.user_id = auth.uid()
  )
);

create policy "Cards updatable by workspace members"
on public.cards
for update
using (
  workspace_id in (
    select workspace_members.workspace_id
    from public.workspace_members
    where workspace_members.user_id = auth.uid()
  )
);

create policy "Cards deletable by workspace members"
on public.cards
for delete
using (
  workspace_id in (
    select workspace_members.workspace_id
    from public.workspace_members
    where workspace_members.user_id = auth.uid()
  )
);

create policy "Card comments visible to workspace members"
on public.card_comments
for select
using (
  card_id in (
    select cards.id
    from public.cards
    where cards.workspace_id in (
      select workspace_members.workspace_id
      from public.workspace_members
      where workspace_members.user_id = auth.uid()
    )
  )
);

create policy "Card comments insertable by workspace members"
on public.card_comments
for insert
with check (
  card_id in (
    select cards.id
    from public.cards
    where cards.workspace_id in (
      select workspace_members.workspace_id
      from public.workspace_members
      where workspace_members.user_id = auth.uid()
    )
  )
);

create policy "Card comments updatable by workspace members"
on public.card_comments
for update
using (
  card_id in (
    select cards.id
    from public.cards
    where cards.workspace_id in (
      select workspace_members.workspace_id
      from public.workspace_members
      where workspace_members.user_id = auth.uid()
    )
  )
);

create policy "Card comments deletable by workspace members"
on public.card_comments
for delete
using (
  card_id in (
    select cards.id
    from public.cards
    where cards.workspace_id in (
      select workspace_members.workspace_id
      from public.workspace_members
      where workspace_members.user_id = auth.uid()
    )
  )
);
