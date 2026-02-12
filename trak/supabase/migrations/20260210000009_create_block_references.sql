create table if not exists public.block_references (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  block_id uuid not null,
  reference_type text not null,
  reference_id uuid not null,
  table_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint block_references_reference_type_check check (
    reference_type = any (array['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text])
  )
);

alter table public.block_references enable row level security;

create index if not exists idx_block_references_block on public.block_references using btree (block_id);
create index if not exists idx_block_references_target on public.block_references using btree (reference_type, reference_id);
create index if not exists idx_block_references_workspace on public.block_references using btree (workspace_id);
create index if not exists idx_block_references_table on public.block_references using btree (table_id) where (table_id is not null);

create trigger block_references_set_updated_at
before update on public.block_references
for each row execute function public.set_updated_at();

alter table only public.block_references
  add constraint block_references_pkey primary key (id);

alter table only public.block_references
  add constraint block_references_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table only public.block_references
  add constraint block_references_block_id_fkey foreign key (block_id) references public.blocks(id) on delete cascade;

alter table only public.block_references
  add constraint block_references_table_id_fkey foreign key (table_id) references public.tables(id) on delete set null;

alter table only public.block_references
  add constraint block_references_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

create policy "Block references visible to workspace members" on public.block_references
  for select
  using (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );

create policy "Block references insertable by workspace members" on public.block_references
  for insert
  with check (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );

create policy "Block references updatable by workspace members" on public.block_references
  for update
  using (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );

create policy "Block references deletable by workspace members" on public.block_references
  for delete
  using (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );
