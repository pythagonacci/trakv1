alter table public.workspace_billing
  add column if not exists manual_plan_key text,
  add column if not exists manual_plan_note text,
  add column if not exists manual_plan_set_at timestamp with time zone,
  add column if not exists manual_plan_set_by_email text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_billing_manual_plan_key_check'
  ) then
    alter table public.workspace_billing
      add constraint workspace_billing_manual_plan_key_check check (
        manual_plan_key is null
        or manual_plan_key = any (array['standard'::text, 'business'::text])
      );
  end if;
end $$;

comment on column public.workspace_billing.manual_plan_key is 'Internal support override for granting a paid workspace plan without Stripe.';
comment on column public.workspace_billing.manual_plan_note is 'Optional reason recorded when a manual plan override is applied.';
