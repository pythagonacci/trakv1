import { describe, expect, it } from "vitest";
import {
  getMissingWorkspaceBillingOptionalTrialColumn,
  isMissingWorkspaceBillingTrialReminderColumnError,
  omitWorkspaceBillingColumn,
} from "@/lib/billing/workspace-billing-compat";

describe("workspace billing compatibility helpers", () => {
  it("detects a missing trial end column from the PostgREST schema cache", () => {
    expect(getMissingWorkspaceBillingOptionalTrialColumn({
      message: "Could not find the 'trial_ends_at' column of 'workspace_billing' in the schema cache",
    })).toBe("trial_ends_at");
  });

  it("detects the PostgREST schema cache error for the reminder column", () => {
    expect(isMissingWorkspaceBillingTrialReminderColumnError({
      message: "Could not find the 'trial_ending_reminder_sent_at' column of 'workspace_billing' in the schema cache",
    })).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingWorkspaceBillingTrialReminderColumnError({
      message: "Failed to update workspace billing: permission denied",
    })).toBe(false);
  });

  it("omits the reminder column from update payloads", () => {
    expect(omitWorkspaceBillingColumn({
      plan_key: "standard",
      billing_status: "trialing",
      trial_ending_reminder_sent_at: null,
    }, "trial_ending_reminder_sent_at")).toEqual({
      plan_key: "standard",
      billing_status: "trialing",
    });
  });
});
