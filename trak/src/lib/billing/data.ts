import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeBillingStatus, normalizePlanKey, resolveEffectivePlan, type BillingStatus, type PlanKey } from "@/lib/billing/config";
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
  };
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

export async function getWorkspaceBillingRow(workspaceId: string, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const { data, error } = await client
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load workspace billing: ${error.message}`);
  }

  return data ? mapBillingRow(data) : null;
}

export async function ensureWorkspaceBillingRow(workspaceId: string, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const existing = await getWorkspaceBillingRow(workspaceId, client);
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
    const retry = await getWorkspaceBillingRow(workspaceId, client);
    if (retry) return retry;
    throw new Error(`Failed to initialize workspace billing: ${error.message}`);
  }

  return mapBillingRow(data);
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

export async function syncWorkspaceSeatQuantity(workspaceId: string, supabase?: BillingClient) {
  const client = supabase ?? await createServiceClient();
  const seatQuantity = await getWorkspaceSeatCount(workspaceId, client);
  const billing = await ensureWorkspaceBillingRow(workspaceId, client);
  if (billing.seat_quantity === seatQuantity) {
    return { billing, seatQuantity, changed: false };
  }

  const updated = await updateWorkspaceBillingRow(workspaceId, { seat_quantity: seatQuantity }, client);
  return { billing: updated, seatQuantity, changed: true };
}

export async function updateStripeSubscriptionSeatQuantity(workspaceId: string) {
  const supabase = await createServiceClient();
  const { billing, seatQuantity } = await syncWorkspaceSeatQuantity(workspaceId, supabase);
  const effectivePlan = derivePlanFromBillingRow(billing);
  if (!billing.stripe_subscription_id || effectivePlan === "free") {
    return { billing, seatQuantity, syncedToStripe: false };
  }

  const { getStripe } = await import("@/lib/billing/stripe");
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
  const firstItem = subscription.items.data[0];
  await stripe.subscriptions.update(billing.stripe_subscription_id, {
    items: firstItem
      ? [{
          id: firstItem.id,
          quantity: seatQuantity,
        }]
      : undefined,
    proration_behavior: "create_prorations",
  });

  const updated = await updateWorkspaceBillingRow(workspaceId, {
    seat_quantity: seatQuantity,
  }, supabase);

  return { billing: updated, seatQuantity, syncedToStripe: true };
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
    current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    last_synced_at: new Date().toISOString(),
  };
}
