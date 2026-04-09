alter table public.workspace_billing
  add column if not exists trial_ending_reminder_sent_at timestamp with time zone;

comment on column public.workspace_billing.trial_ending_reminder_sent_at is 'Timestamp when the 3-day app/email reminder was sent for the current app-managed trial.';
