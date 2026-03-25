import { getWorkspaceBillingRow, ensureWorkspaceBillingRow, getWorkspaceSeatCount } from "@/lib/billing/data";
import { BillingError } from "@/lib/billing/errors";
import { getEntitlementTemplate, resolveEffectivePlan, type WorkspaceEntitlements, type PlanKey } from "@/lib/billing/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function getWorkspaceEntitlements(workspaceId: string): Promise<WorkspaceEntitlements> {
  const supabase = await createServiceClient();
  const billing = await ensureWorkspaceBillingRow(workspaceId, supabase);
  const effectivePlan = resolveEffectivePlan(billing.plan_key, billing.billing_status);
  const template = getEntitlementTemplate(effectivePlan);

  return {
    workspaceId,
    planKey: effectivePlan,
    billingStatus: billing.billing_status,
    ...template,
    seatQuantity: billing.seat_quantity,
    cancelAtPeriodEnd: billing.cancel_at_period_end,
    currentPeriodStart: billing.current_period_start,
    currentPeriodEnd: billing.current_period_end,
  };
}

export async function getWorkspaceBillingSummary(workspaceId: string) {
  const supabase = await createServiceClient();
  const billing = await ensureWorkspaceBillingRow(workspaceId, supabase);
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  const seatCount = await getWorkspaceSeatCount(workspaceId, supabase);

  const usageClient = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: usageRow } = await usageClient
    .from("workspace_ai_daily_usage")
    .select("commands_used")
    .eq("workspace_id", workspaceId)
    .eq("usage_date", today)
    .maybeSingle();

  return {
    billing,
    entitlements,
    usage: {
      date: today,
      commandsUsed: usageRow?.commands_used ?? 0,
      commandLimit: entitlements.aiDailyCommandLimit,
    },
    seatCount,
  };
}

export async function assertCanAccessEverythingPage(workspaceId: string) {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (!entitlements.allowEverythingPage) {
    throw new BillingError({
      code: "FEATURE_NOT_AVAILABLE",
      message: "Everything is available on Business only. Upgrade to Business to unlock workspace-wide views.",
      upgradeTargetPlan: "business",
    });
  }
  return entitlements;
}

export async function assertCanUseWorkspaceScopeCharts(workspaceId: string) {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (!entitlements.allowWorkspaceScopeCharts) {
    throw new BillingError({
      code: "FEATURE_NOT_AVAILABLE",
      message: "Workspace-wide dashboard charts are available on Business only.",
      upgradeTargetPlan: "business",
    });
  }
  return entitlements;
}

export async function assertCanCreateWorkspace(userId: string) {
  const supabase = await createServiceClient();
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to evaluate workspace limit: ${error.message}`);
  }

  if (!memberships || memberships.length === 0) {
    return { allowed: true as const, upgradeTargetPlan: undefined };
  }

  const workspaceIds = memberships.map((membership) => membership.workspace_id);
  const { data: billingRows, error: billingError } = await supabase
    .from("workspace_billing")
    .select("workspace_id, plan_key, billing_status")
    .in("workspace_id", workspaceIds);

  if (billingError) {
    throw new Error(`Failed to evaluate workspace billing: ${billingError.message}`);
  }

  const billingByWorkspace = new Map(
    (billingRows ?? []).map((row: any) => [row.workspace_id, resolveEffectivePlan(row.plan_key, row.billing_status)])
  );

  const hasBusinessAdminWorkspace = memberships.some((membership) => {
    const role = membership.role;
    if (role !== "owner" && role !== "admin") return false;
    return billingByWorkspace.get(membership.workspace_id) === "business";
  });

  if (!hasBusinessAdminWorkspace) {
    throw new BillingError({
      code: "PLAN_LIMIT_REACHED",
      message: "Free and Standard plans can only create one workspace. Upgrade a workspace to Business to create additional workspaces.",
      upgradeTargetPlan: "business",
    });
  }

  return { allowed: true as const, upgradeTargetPlan: "business" as PlanKey };
}
