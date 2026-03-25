import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";
import {
  buildBillingUpdateFromStripeSubscription,
  ensureWorkspaceBillingRow,
  findWorkspaceBillingByStripeCustomer,
  findWorkspaceBillingByStripeSubscription,
  logBillingEvent,
  updateWorkspaceBillingRow,
} from "@/lib/billing/data";

async function resolveWorkspaceIdFromEvent(event: Stripe.Event) {
  const object = event.data.object as unknown as Record<string, unknown>;
  const metadata = (object?.metadata ?? null) as Record<string, unknown> | null;
  const metadataWorkspaceId = metadata?.workspaceId ?? metadata?.workspace_id ?? null;
  if (metadataWorkspaceId) return String(metadataWorkspaceId);

  const customerField = object?.customer;
  const customerId =
    typeof customerField === "string"
      ? customerField
      : customerField && typeof customerField === "object" && "id" in customerField && typeof customerField.id === "string"
        ? customerField.id
        : null;
  if (customerId) {
    const billing = await findWorkspaceBillingByStripeCustomer(customerId);
    if (billing) return billing.workspace_id;
  }

  const subscriptionField = object?.subscription;
  const subscriptionId = typeof object?.id === "string" && object.object === "subscription"
    ? object.id
    : typeof subscriptionField === "string"
      ? subscriptionField
      : subscriptionField && typeof subscriptionField === "object" && "id" in subscriptionField && typeof subscriptionField.id === "string"
        ? subscriptionField.id
        : null;
  if (subscriptionId) {
    const billing = await findWorkspaceBillingByStripeSubscription(subscriptionId);
    if (billing) return billing.workspace_id;
  }

  return null;
}

async function syncSubscriptionForWorkspace(workspaceId: string, subscription: Stripe.Subscription | null) {
  await ensureWorkspaceBillingRow(workspaceId);
  if (!subscription) {
    await updateWorkspaceBillingRow(workspaceId, {
      plan_key: "free",
      billing_status: "free",
      stripe_subscription_id: null,
      stripe_price_id: null,
      cancel_at_period_end: false,
      current_period_start: null,
      current_period_end: null,
      last_synced_at: new Date().toISOString(),
    });
    return;
  }

  await updateWorkspaceBillingRow(workspaceId, buildBillingUpdateFromStripeSubscription(subscription as any));
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature" },
      { status: 400 }
    );
  }

  const workspaceId = await resolveWorkspaceIdFromEvent(event);
  await logBillingEvent({
    workspaceId,
    source: "stripe_webhook",
    eventType: event.type,
    externalEventId: event.id,
    payload: {
      object: event.data.object,
    },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionWorkspaceId = session.metadata?.workspaceId ?? workspaceId;
        if (sessionWorkspaceId) {
          await ensureWorkspaceBillingRow(sessionWorkspaceId);
          if (session.customer) {
            await updateWorkspaceBillingRow(sessionWorkspaceId, {
              stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer.id,
            });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionWorkspaceId = await resolveWorkspaceIdFromEvent(event);
        if (subscriptionWorkspaceId) {
          await syncSubscriptionForWorkspace(subscriptionWorkspaceId, subscription);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionWorkspaceId = await resolveWorkspaceIdFromEvent(event);
        if (subscriptionWorkspaceId) {
          await syncSubscriptionForWorkspace(subscriptionWorkspaceId, subscription);
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string | null } | null };
        const subscriptionId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id ?? null;
        if (subscriptionId) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subscriptionWorkspaceId = await resolveWorkspaceIdFromEvent({
            ...event,
            data: { ...event.data, object: subscription as unknown as Stripe.Event.Data.Object },
          } as unknown as Stripe.Event);
          if (subscriptionWorkspaceId) {
            await syncSubscriptionForWorkspace(subscriptionWorkspaceId, subscription);
          }
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] failed to process event", event.id, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process webhook" },
      { status: 500 }
    );
  }
}
