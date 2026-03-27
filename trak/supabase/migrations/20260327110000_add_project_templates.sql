create table public.project_templates (
    id uuid default gen_random_uuid() primary key,
    workspace_id uuid,
    source_project_id uuid not null,
    slug text not null,
    name text not null,
    description text,
    category text,
    icon text,
    visibility text not null default 'global',
    min_plan text not null default 'standard',
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint project_templates_slug_key unique (slug),
    constraint project_templates_visibility_check check (visibility in ('global', 'workspace')),
    constraint project_templates_min_plan_check check (min_plan in ('free', 'standard', 'business')),
    constraint project_templates_workspace_visibility_check check (
        (visibility = 'global' and workspace_id is null)
        or (visibility = 'workspace' and workspace_id is not null)
    ),
    constraint project_templates_source_project_id_fkey foreign key (source_project_id) references public.projects(id) on delete cascade,
    constraint project_templates_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade
);

comment on table public.project_templates is 'Registry of Trak-owned and workspace-owned starter projects that can be cloned into normal projects.';
comment on column public.project_templates.source_project_id is 'Canonical source project that is cloned when a user starts from this template.';

create index idx_project_templates_active_visibility_sort
    on public.project_templates (is_active, visibility, sort_order, name);

create trigger project_templates_set_updated_at
before update on public.project_templates
for each row execute function public.set_updated_at();

alter table public.project_templates enable row level security;

create policy "Project templates visible to workspace members"
on public.project_templates
for select
using (
    visibility = 'global'
    or (
        workspace_id in (
            select workspace_members.workspace_id
            from public.workspace_members
            where workspace_members.user_id = auth.uid()
        )
    )
);

alter table public.projects
    add column source_template_id uuid;

comment on column public.projects.source_template_id is 'The template used to create this project, if any. Does not affect runtime behavior after cloning.';

alter table public.projects
    add constraint projects_source_template_id_fkey
    foreign key (source_template_id) references public.project_templates(id) on delete set null;

create index idx_projects_source_template_id
    on public.projects (source_template_id)
    where source_template_id is not null;
