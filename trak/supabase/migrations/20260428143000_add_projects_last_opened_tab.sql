alter table projects
  add column if not exists last_opened_tab_id uuid references tabs(id) on delete set null;

create index if not exists idx_projects_last_opened_tab_id on projects(last_opened_tab_id);
