alter table projects
  add column if not exists last_opened_at timestamptz;

alter table docs
  add column if not exists last_opened_at timestamptz;

create table if not exists user_pinned_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index if not exists idx_user_pinned_projects_user_id on user_pinned_projects(user_id);
create index if not exists idx_user_pinned_projects_project_id on user_pinned_projects(project_id);
create index if not exists idx_projects_last_opened_at on projects(last_opened_at desc nulls last);
create index if not exists idx_docs_last_opened_at on docs(last_opened_at desc nulls last);

alter table user_pinned_projects enable row level security;

drop policy if exists "Users can view their own pinned projects" on user_pinned_projects;
create policy "Users can view their own pinned projects"
  on user_pinned_projects
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own pinned projects" on user_pinned_projects;
create policy "Users can insert their own pinned projects"
  on user_pinned_projects
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from projects p
      join workspace_members wm on wm.workspace_id = p.workspace_id
      where p.id = user_pinned_projects.project_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own pinned projects" on user_pinned_projects;
create policy "Users can delete their own pinned projects"
  on user_pinned_projects
  for delete
  using (auth.uid() = user_id);
