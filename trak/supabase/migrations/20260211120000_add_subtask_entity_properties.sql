alter table public.task_subtasks
  add column if not exists description text;

alter table public.entity_properties
  drop constraint if exists entity_properties_entity_type_check1;

alter table public.entity_properties
  add constraint entity_properties_entity_type_check1
  check (
    entity_type = any (array[
      'block'::text,
      'task'::text,
      'subtask'::text,
      'timeline_event'::text,
      'table_row'::text
    ])
  );

alter table public.entity_inherited_display
  drop constraint if exists entity_inherited_display_entity_type_check;

alter table public.entity_inherited_display
  add constraint entity_inherited_display_entity_type_check
  check (
    entity_type = any (array[
      'block'::text,
      'task'::text,
      'subtask'::text,
      'timeline_event'::text,
      'table_row'::text
    ])
  );

alter table public.entity_inherited_display
  drop constraint if exists entity_inherited_display_source_entity_type_check;

alter table public.entity_inherited_display
  add constraint entity_inherited_display_source_entity_type_check
  check (
    source_entity_type = any (array[
      'block'::text,
      'task'::text,
      'subtask'::text,
      'timeline_event'::text,
      'table_row'::text
    ])
  );

alter table public.entity_links
  drop constraint if exists entity_links_source_entity_type_check;

alter table public.entity_links
  add constraint entity_links_source_entity_type_check
  check (
    source_entity_type = any (array[
      'block'::text,
      'task'::text,
      'subtask'::text,
      'timeline_event'::text,
      'table_row'::text
    ])
  );

alter table public.entity_links
  drop constraint if exists entity_links_target_entity_type_check;

alter table public.entity_links
  add constraint entity_links_target_entity_type_check
  check (
    target_entity_type = any (array[
      'block'::text,
      'task'::text,
      'subtask'::text,
      'timeline_event'::text,
      'table_row'::text
    ])
  );

create table if not exists public.task_subtask_references (
  id uuid default gen_random_uuid() not null,
  workspace_id uuid not null,
  subtask_id uuid not null,
  reference_type text not null,
  reference_id uuid not null,
  table_id uuid,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint task_subtask_references_reference_type_check check (
    reference_type = any (array['doc'::text, 'table_row'::text, 'task'::text, 'block'::text, 'tab'::text])
  )
);

alter table public.task_subtask_references enable row level security;

create index if not exists idx_task_subtask_references_table
  on public.task_subtask_references using btree (table_id)
  where (table_id is not null);

create index if not exists idx_task_subtask_references_target
  on public.task_subtask_references using btree (reference_type, reference_id);

create index if not exists idx_task_subtask_references_subtask
  on public.task_subtask_references using btree (subtask_id);

create index if not exists idx_task_subtask_references_workspace
  on public.task_subtask_references using btree (workspace_id);

create trigger task_subtask_references_set_updated_at
before update on public.task_subtask_references
for each row execute function public.set_updated_at();

alter table only public.task_subtask_references
  add constraint task_subtask_references_pkey primary key (id);

alter table only public.task_subtask_references
  add constraint task_subtask_references_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table only public.task_subtask_references
  add constraint task_subtask_references_subtask_id_fkey foreign key (subtask_id) references public.task_subtasks(id) on delete cascade;

alter table only public.task_subtask_references
  add constraint task_subtask_references_table_id_fkey foreign key (table_id) references public.tables(id) on delete set null;

alter table only public.task_subtask_references
  add constraint task_subtask_references_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

create policy "Task subtask references visible to workspace members" on public.task_subtask_references
  for select
  using (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );

create policy "Task subtask references insertable by workspace members" on public.task_subtask_references
  for insert
  with check (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );

create policy "Task subtask references updatable by workspace members" on public.task_subtask_references
  for update
  using (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );

create policy "Task subtask references deletable by workspace members" on public.task_subtask_references
  for delete
  using (
    workspace_id in (
      select workspace_members.workspace_id
      from workspace_members
      where workspace_members.user_id = auth.uid()
    )
  );
