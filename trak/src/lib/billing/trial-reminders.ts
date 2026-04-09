import { createServiceClient } from "@/lib/supabase/service";
import { STANDARD_TRIAL_ENDING_REMINDER_DAYS } from "@/lib/billing/config";
import { expireAppManagedStandardTrial } from "@/lib/billing/data";
import { getBaseAppUrl } from "@/lib/billing/stripe";
import { isMissingWorkspaceBillingTrialReminderColumnError } from "@/lib/billing/workspace-billing-compat";
import { sendWorkspaceTrialEndingEmail } from "@/lib/email";
import { createBillingTrialEndingNotifications } from "@/lib/notifications/service";

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export async function processAppManagedStandardTrials() {
  const supabase = await createServiceClient();
  const now = new Date();
  const reminderWindowEnd = addDays(now, STANDARD_TRIAL_ENDING_REMINDER_DAYS).toISOString();
  const billingUrl = `${getBaseAppUrl()}/dashboard/settings?tab=general`;

  const { data: expiredTrials, error: expiredError } = await supabase
    .from("workspace_billing")
    .select("*")
    .eq("plan_key", "standard")
    .eq("billing_status", "trialing")
    .is("stripe_subscription_id", null)
    .not("current_period_end", "is", null)
    .lte("current_period_end", now.toISOString());

  if (expiredError) {
    throw new Error(`Failed to load expired app-managed trials: ${expiredError.message}`);
  }

  for (const row of expiredTrials ?? []) {
    await expireAppManagedStandardTrial(row.workspace_id, supabase);
  }

  const { data: reminderRows, error: reminderError } = await supabase
    .from("workspace_billing")
    .select("workspace_id, current_period_end")
    .eq("plan_key", "standard")
    .eq("billing_status", "trialing")
    .is("stripe_subscription_id", null)
    .not("current_period_end", "is", null)
    .is("trial_ending_reminder_sent_at", null)
    .gt("current_period_end", now.toISOString())
    .lte("current_period_end", reminderWindowEnd);

  if (reminderError) {
    if (isMissingWorkspaceBillingTrialReminderColumnError(reminderError)) {
      console.warn("[billing] skipping trial ending reminders because workspace_billing.trial_ending_reminder_sent_at is unavailable");
      return {
        expiredTrials: expiredTrials?.length ?? 0,
        remindersSent: 0,
      };
    }
    throw new Error(`Failed to load trial reminder candidates: ${reminderError.message}`);
  }

  let remindersSent = 0;

  for (const row of reminderRows ?? []) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", row.workspace_id)
      .maybeSingle();

    if (workspaceError || !workspace) {
      continue;
    }

    const { data: adminMembers, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id, role, profiles(email)")
      .eq("workspace_id", row.workspace_id)
      .in("role", ["owner", "admin"]);

    if (membersError || !adminMembers?.length) {
      continue;
    }

    const recipientIds = Array.from(new Set(adminMembers.map((member: any) => String(member.user_id)).filter(Boolean)));
    const recipientEmails = Array.from(new Set(
      adminMembers
        .map((member: any) => {
          const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
          return typeof profile?.email === "string" ? profile.email : null;
        })
        .filter((email: string | null): email is string => Boolean(email))
    ));

    if (recipientIds.length > 0) {
      await createBillingTrialEndingNotifications({
        workspaceId: row.workspace_id,
        recipientIds,
        workspaceName: workspace.name,
        trialEndsAt: row.current_period_end,
        billingUrl,
      });
    }

    for (const email of recipientEmails) {
      await sendWorkspaceTrialEndingEmail({
        to: email,
        workspaceName: workspace.name,
        trialEndsAt: row.current_period_end,
        billingUrl,
      });
    }

    await supabase
      .from("workspace_billing")
      .update({
        trial_ending_reminder_sent_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq("workspace_id", row.workspace_id);

    remindersSent += 1;
  }

  return {
    expiredTrials: expiredTrials?.length ?? 0,
    remindersSent,
  };
}
