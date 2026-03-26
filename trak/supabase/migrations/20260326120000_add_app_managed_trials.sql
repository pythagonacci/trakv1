alter table public.workspace_billing
  add column if not exists trial_started_at timestamp with time zone,
  add column if not exists trial_ends_at timestamp with time zone,
  add column if not exists trial_ending_reminder_sent_at timestamp with time zone;

comment on column public.workspace_billing.trial_started_at is 'First time an app-managed Standard trial started for this workspace.';
comment on column public.workspace_billing.trial_ends_at is 'Current app-managed Standard trial end timestamp when the workspace is trialing without Stripe.';
comment on column public.workspace_billing.trial_ending_reminder_sent_at is 'Timestamp when the 3-day app/email reminder was sent for the current app-managed trial.';

create index if not exists idx_workspace_billing_app_trial_scan
  on public.workspace_billing (billing_status, trial_ends_at)
  where plan_key = 'standard' and stripe_subscription_id is null and trial_ends_at is not null;

alter table public.notification_events
  drop constraint if exists notification_events_event_type_check;

alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in ('mention', 'task_assignment', 'client_comment', 'comment_reply', 'file_upload', 'task_status_change', 'due_date_change', 'billing_trial_ending'));
