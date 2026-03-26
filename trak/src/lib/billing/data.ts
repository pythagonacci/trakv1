import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import {
  STANDARD_TRIAL_DAYS,
  normalizeBillingStatus,
  normalizePlanKey,
  resolveEffectivePlan,
  type BillingStatus,
  type PlanKey,
} from "@/lib/billing/config";
import { BillingError } from "@/lib/billing/errors";
import { planKeyFromPriceId, billingStatusFromStripeStatus } from "@/lib/billing/stripe";

export interface WorkspaceBillingRow {
  id: string;
  workspace_id: string;
  plan_key: PlanKey;
  billing_status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  seat_quantity: number;
  cancel_at_period_end: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_ending_reminder_sent_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

type BillingClient = SupabaseClient<any, "public", any>;

function mapBillingRow(row: any): WorkspaceBillingRow {
  return {
    ...row,
    plan_key: normalizePlanKey(row?.plan_key),
    billing_status: normalizeBillingStatus(row?.billing_status),
    seat_quantity: typeof row?.seat_quantity === "number" && row.seat_quantity > 0 ? row.seat_quantity : 1,
    cancel_at_period_end: Boolean(row?.cancel_at_period_end),
    trial_started_at: typeof row?.trial_started_at === "string" ? row.trial_started_at : null,
    trial_ends_at: typeof row?.trial_ends_at === "string" ? row.trial_ends_at : null,
    trial_ending_reminder_sent_at: typeof row?.trial_ending_reminder_sent_at === "string" ? row.trial_ending_reminder_sent_at : null,
  };
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function hasWorkspaceUsedStandardTrial(row: Pick<WorkspaceBillingRow, "trial_started_at">) {
  return Boolean(row.trial_started_at);
}

export function isAppManagedStandardTrial(
  row: Pick<WorkspaceBillingRow, "plan_key" | "billing_status" | "stripe_subscription_id" | "trial_ends_at">
) {
  return row.plan_key === "standard"
    && row.billing_status === "trialing"
    && !row.stripe_subscription_id
    && Boolean(row.trial_ends_at);
}

async function maybeExpireAppManagedTrial(
  workspaceId: string,
  billing: WorkspaceBillingRow,
  supabase?: BillingClient
): Promise<WorkspaceBillingRow> {
  if (!isAppManagedStandardTrial(billing) || !billing.trial_ends_at) {
    return billing;
  }

  const trialEndsAtMs = new Date(billing.trial_ends_at).getTime();
  if (Number.isNaN(trialEndsAtMs) || trialEndsAtMs > Date.now()) {
    return billing;
  }

  return expireAppManagedStandardTrial(workspaceId, supabase, billing);
}

function parseSeatQuantity(value: unknown) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number.parseInt(value, 10)
      : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Seats must be a whole number greater than or equal to 1.");
  }

  return parsed;
}

export async function getWorkspaceSeatCount(workspaceId: string, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const { count, error } = await client
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to compute workspace seat count: ${error.message}`);
  }

  return Math.max(count ?? 1, 1);
}

export async function validateWorkspaceSeatQuantity(workspaceId: string, requestedSeatQuantity: unknown, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const seatQuantity = parseSeatQuantity(requestedSeatQuantity);
  const activeMemberCount = await getWorkspaceSeatCount(workspaceId, client);

  if (seatQuantity < activeMemberCount) {
    throw new Error(
      `Seats cannot be lower than the current ${activeMemberCount} workspace member${activeMemberCount === 1 ? "" : "s"}.`
    );
  }

  return { seatQuantity, activeMemberCount };
}

export async function getWorkspaceBillingRow(workspaceId: string, supabase?: BillingClient): Promise<WorkspaceBillingRow | null> {
  const client = supabase ?? await createServiceClient();
  const { data, error } = await client
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load workspace billing: ${error.message}`);
  }

  if (!data) return null;

  return maybeExpireAppManagedTrial(workspaceId, mapBillingRow(data), client);
}

export async function ensureWorkspaceBillingRow(workspaceId: string, supabase?: BillingClient): Promise<WorkspaceBillingRow> {
  const client = supabase ?? await createServiceClient();
  const existing: WorkspaceBillingRow | null = await getWorkspaceBillingRow(workspaceId, client);
  if (existing) return existing;

  const seatQuantity = await getWorkspaceSeatCount(workspaceId, client);
  const { data, error } = await client
    .from("workspace_billing")
    .insert({
      workspace_id: workspaceId,
      plan_key: "free",
      billing_status: "free",
      seat_quantity: seatQuantity,
      last_synced_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    const retry: WorkspaceBillingRow | null = await getWorkspaceBillingRow(workspaceId, client);
    if (retry) return retry;
    throw new Error(`Failed to initialize workspace billing: ${error.message}`);
  }

  return mapBillingRow(data);
}

export async function startAppManagedStandardTrial(workspaceId: string, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const billing = await ensureWorkspaceBillingRow(workspaceId, client);

  if (hasWorkspaceUsedStandardTrial(billing)) {
    throw new Error("This workspace has already used its Standard trial.");
  }

  const now = new Date();
  const trialEndsAt = addDays(now, STANDARD_TRIAL_DAYS);
  const seatQuantity = await getWorkspaceSeatCount(workspaceId, client);

  return updateWorkspaceBillingRow(workspaceId, {
    plan_key: "standard",
    billing_status: "trialing",
    stripe_subscription_id: null,
    stripe_price_id: null,
    cancel_at_period_end: false,
    seat_quantity: seatQuantity,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    trial_ending_reminder_sent_at: null,
    current_period_start: now.toISOString(),
    current_period_end: trialEndsAt.toISOString(),
    last_synced_at: now.toISOString(),
  }, client);
}

export async function expireAppManagedStandardTrial(
  workspaceId: string,
  supabase?: BillingClient,
  existingBilling?: WorkspaceBillingRow
): Promise<WorkspaceBillingRow> {
  const client = supabase ?? await createServiceClient();
  const billing: WorkspaceBillingRow = existingBilling ?? await ensureWorkspaceBillingRow(workspaceId, client);
  const seatQuantity = await getWorkspaceSeatCount(workspaceId, client);

  if (!isAppManagedStandardTrial(billing)) {
    return billing;
  }

  return updateWorkspaceBillingRow(workspaceId, {
    plan_key: "free",
    billing_status: "free",
    stripe_subscription_id: null,
    stripe_price_id: null,
    seat_quantity: seatQuantity,
    cancel_at_period_end: false,
    current_period_start: null,
    current_period_end: null,
    last_synced_at: new Date().toISOString(),
  }, client);
}

export async function updateWorkspaceBillingRow(
  workspaceId: string,
  values: Partial<Omit<WorkspaceBillingRow, "id" | "workspace_id" | "created_at" | "updated_at">>,
  supabase?: BillingClient
) {
  const client = supabase ?? await createServiceClient();
  const payload = {
    ...values,
    last_synced_at: values.last_synced_at ?? new Date().toISOString(),
  };
  const { data, error } = await client
    .from("workspace_billing")
    .update(payload)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update workspace billing: ${error.message}`);
  }

  return mapBillingRow(data);
}

export async function assertCanAddWorkspaceMember(workspaceId: string, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const billing = await ensureWorkspaceBillingRow(workspaceId, client);
  const planKey = derivePlanFromBillingRow(billing);
  const activeMemberCount = await getWorkspaceSeatCount(workspaceId, client);
  const nextActiveMemberCount = activeMemberCount + 1;

  if (planKey === "free") {
    return {
      allowed: true as const,
      billing,
      planKey,
      activeMemberCount,
      nextActiveMemberCount,
      purchasedSeatQuantity: billing.seat_quantity,
    };
  }

  if (nextActiveMemberCount > billing.seat_quantity) {
    throw new BillingError({
      code: "PLAN_LIMIT_REACHED",
      message: `This workspace has ${billing.seat_quantity} purchased seat${billing.seat_quantity === 1 ? "" : "s"} and already includes ${activeMemberCount} active member${activeMemberCount === 1 ? "" : "s"}. Increase seats before adding another member.`,
    });
  }

  return {
    allowed: true as const,
    billing,
    planKey,
    activeMemberCount,
    nextActiveMemberCount,
    purchasedSeatQuantity: billing.seat_quantity,
  };
}

export async function updateStripeSubscriptionPurchasedSeatQuantity(workspaceId: string, requestedSeatQuantity: unknown) {
  const supabase = await createServiceClient();
  const billing = await ensureWorkspaceBillingRow(workspaceId, supabase);
  const effectivePlan = derivePlanFromBillingRow(billing);
  if (!billing.stripe_subscription_id || effectivePlan === "free") {
    throw new Error("Only paid workspaces with an active Stripe subscription can update seats.");
  }

  const { seatQuantity, activeMemberCount } = await validateWorkspaceSeatQuantity(workspaceId, requestedSeatQuantity, supabase);
  const { getStripe } = await import("@/lib/billing/stripe");
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    throw new Error("Stripe subscription is missing a billable line item.");
  }

  await stripe.subscriptions.update(billing.stripe_subscription_id, {
    items: [{
      id: firstItem.id,
      quantity: seatQuantity,
    }],
    proration_behavior: "create_prorations",
  });

  const updated = await updateWorkspaceBillingRow(workspaceId, {
    seat_quantity: seatQuantity,
  }, supabase);

  return { billing: updated, seatQuantity, activeMemberCount, syncedToStripe: true };
}

export async function logBillingEvent(input: {
  workspaceId?: string | null;
  source: string;
  eventType: string;
  externalEventId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("workspace_billing_events")
    .upsert({
      workspace_id: input.workspaceId ?? null,
      source: input.source,
      event_type: input.eventType,
      external_event_id: input.externalEventId ?? null,
      payload: input.payload ?? {},
    }, {
      onConflict: "external_event_id",
      ignoreDuplicates: false,
    });

  if (error && input.externalEventId) {
    const { error: fallbackError } = await supabase
      .from("workspace_billing_events")
      .insert({
        workspace_id: input.workspaceId ?? null,
        source: input.source,
        event_type: input.eventType,
        payload: input.payload ?? {},
      });
    if (fallbackError) {
      console.error("[billing] failed to log event", fallbackError);
    }
    return;
  }

  if (error) {
    console.error("[billing] failed to log event", error);
  }
}

export async function findWorkspaceBillingByStripeCustomer(customerId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("workspace_billing")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load workspace billing by customer: ${error.message}`);
  }

  return data ? mapBillingRow(data) : null;
}

export async function findWorkspaceBillingByStripeSubscription(subscriptionId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("workspace_billing")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load workspace billing by subscription: ${error.message}`);
  }

  return data ? mapBillingRow(data) : null;
}

export function derivePlanFromBillingRow(row: Pick<WorkspaceBillingRow, "plan_key" | "billing_status">) {
  return resolveEffectivePlan(row.plan_key, row.billing_status);
}

export function buildBillingUpdateFromStripeSubscription(subscription: {
  status?: string | null;
  customer?: string | null;
  id?: string | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null; quantity?: number | null }> } | null;
  cancel_at_period_end?: boolean | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
}) {
  const firstItem = subscription.items?.data?.[0];
  const stripePriceId = firstItem?.price?.id ?? null;
  const planKey = planKeyFromPriceId(stripePriceId);

  return {
    plan_key: planKey,
    billing_status: billingStatusFromStripeStatus((subscription.status ?? null) as any),
    stripe_customer_id: subscription.customer ?? null,
    stripe_subscription_id: subscription.id ?? null,
    stripe_price_id: stripePriceId,
    seat_quantity: Math.max(firstItem?.quantity ?? 1, 1),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    trial_ends_at: null,
    trial_ending_reminder_sent_at: null,
    current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    last_synced_at: new Date().toISOString(),
  };
}
