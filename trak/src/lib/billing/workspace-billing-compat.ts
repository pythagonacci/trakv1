const WORKSPACE_BILLING_TABLE = "workspace_billing";
const OPTIONAL_TRIAL_COLUMNS = [
  "trial_started_at",
  "trial_ends_at",
  "trial_ending_reminder_sent_at",
] as const;

type WorkspaceBillingOptionalTrialColumn = (typeof OPTIONAL_TRIAL_COLUMNS)[number];

type PostgrestLikeError = {
  message?: string | null;
};

export function getMissingWorkspaceBillingOptionalTrialColumn(error: PostgrestLikeError | null | undefined): WorkspaceBillingOptionalTrialColumn | null {
  const message = typeof error?.message === "string" ? error.message : "";

  for (const column of OPTIONAL_TRIAL_COLUMNS) {
    if (
      message.includes(`Could not find the '${column}' column of '${WORKSPACE_BILLING_TABLE}'`)
      || message.includes(`column "${column}" of relation "${WORKSPACE_BILLING_TABLE}" does not exist`)
    ) {
      return column;
    }
  }

  return null;
}

export function isMissingWorkspaceBillingTrialReminderColumnError(error: PostgrestLikeError | null | undefined) {
  return getMissingWorkspaceBillingOptionalTrialColumn(error) === "trial_ending_reminder_sent_at";
}

export function omitWorkspaceBillingColumn<T extends Record<string, unknown>>(
  values: T,
  column: WorkspaceBillingOptionalTrialColumn
) {
  const rest = { ...values } as Record<string, unknown>;
  delete rest[column];
  return rest as Omit<T, WorkspaceBillingOptionalTrialColumn>;
}
