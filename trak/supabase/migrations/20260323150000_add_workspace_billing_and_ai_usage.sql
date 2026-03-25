create table if not exists public.workspace_billing (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_key text not null default 'free',
  billing_status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  seat_quantity integer not null default 1,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workspace_billing_workspace_id_key unique (workspace_id),
  constraint workspace_billing_plan_key_check check (
    plan_key = any (array['free'::text, 'standard'::text, 'business'::text])
  ),
  constraint workspace_billing_seat_quantity_check check (seat_quantity >= 1)
);

comment on table public.workspace_billing is 'Canonical SaaS billing state for each workspace. Used to resolve Trak entitlements independent of Stripe client state.';

create index if not exists idx_workspace_billing_workspace on public.workspace_billing(workspace_id);
create index if not exists idx_workspace_billing_subscription on public.workspace_billing(stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists idx_workspace_billing_customer on public.workspace_billing(stripe_customer_id) where stripe_customer_id is not null;

create table if not exists public.workspace_ai_daily_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usage_date date not null,
  commands_used integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint workspace_ai_daily_usage_workspace_date_key unique (workspace_id, usage_date),
  constraint workspace_ai_daily_usage_commands_used_check check (commands_used >= 0)
);

comment on table public.workspace_ai_daily_usage is 'Daily AI command metering for free-plan workspaces. Only /api/ai and /api/ai/stream count toward this quota.';

create index if not exists idx_workspace_ai_daily_usage_workspace_date
  on public.workspace_ai_daily_usage(workspace_id, usage_date desc);

create table if not exists public.workspace_billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  source text not null,
  event_type text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint workspace_billing_events_external_event_id_key unique (external_event_id)
);

comment on table public.workspace_billing_events is 'Audit trail for billing syncs and webhook processing.';

create index if not exists idx_workspace_billing_events_workspace_created
  on public.workspace_billing_events(workspace_id, created_at desc);

create or replace function public.consume_workspace_ai_daily_quota(
  p_workspace_id uuid,
  p_usage_date date,
  p_limit integer
)
returns table (
  allowed boolean,
  commands_used integer
)
language plpgsql
as $$
declare
  updated_row public.workspace_ai_daily_usage%rowtype;
begin
  insert into public.workspace_ai_daily_usage (workspace_id, usage_date, commands_used)
  values (p_workspace_id, p_usage_date, 1)
  on conflict (workspace_id, usage_date)
  do update
    set commands_used = public.workspace_ai_daily_usage.commands_used + 1,
        updated_at = now()
  where public.workspace_ai_daily_usage.commands_used < p_limit
  returning * into updated_row;

  if updated_row.id is not null then
    return query select true, updated_row.commands_used;
    return;
  end if;

  return query
  select false, wau.commands_used
  from public.workspace_ai_daily_usage wau
  where wau.workspace_id = p_workspace_id
    and wau.usage_date = p_usage_date;
end;
$$;

alter table public.workspace_billing enable row level security;
alter table public.workspace_ai_daily_usage enable row level security;
alter table public.workspace_billing_events enable row level security;

create policy "Workspace billing visible to members"
on public.workspace_billing
for select
using (public.is_member_of_workspace(workspace_id));

create policy "Workspace billing insertable by members"
on public.workspace_billing
for insert
with check (public.is_member_of_workspace(workspace_id));

create policy "Workspace billing updatable by members"
on public.workspace_billing
for update
using (public.is_member_of_workspace(workspace_id));

create policy "Workspace AI usage visible to members"
on public.workspace_ai_daily_usage
for select
using (public.is_member_of_workspace(workspace_id));

create policy "Workspace AI usage insertable by members"
on public.workspace_ai_daily_usage
for insert
with check (public.is_member_of_workspace(workspace_id));

create policy "Workspace AI usage updatable by members"
on public.workspace_ai_daily_usage
for update
using (public.is_member_of_workspace(workspace_id));

create policy "Workspace billing events visible to members"
on public.workspace_billing_events
for select
using (
  workspace_id is not null
  and public.is_member_of_workspace(workspace_id)
);

drop trigger if exists workspace_billing_set_updated_at on public.workspace_billing;
create trigger workspace_billing_set_updated_at
before update on public.workspace_billing
for each row
execute function public.set_updated_at();

drop trigger if exists workspace_ai_daily_usage_set_updated_at on public.workspace_ai_daily_usage;
create trigger workspace_ai_daily_usage_set_updated_at
before update on public.workspace_ai_daily_usage
for each row
execute function public.set_updated_at();
