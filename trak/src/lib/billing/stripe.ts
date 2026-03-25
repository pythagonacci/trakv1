import Stripe from "stripe";
import type { PlanKey, BillingStatus } from "@/lib/billing/config";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }
  return secret;
}

export function getPlanPriceId(planKey: PlanKey) {
  if (planKey === "standard") return process.env.STRIPE_STANDARD_PRICE_ID ?? null;
  if (planKey === "business") return process.env.STRIPE_BUSINESS_PRICE_ID ?? null;
  return null;
}

export function planKeyFromPriceId(priceId: string | null | undefined): PlanKey {
  if (priceId && process.env.STRIPE_BUSINESS_PRICE_ID && priceId === process.env.STRIPE_BUSINESS_PRICE_ID) {
    return "business";
  }
  if (priceId && process.env.STRIPE_STANDARD_PRICE_ID && priceId === process.env.STRIPE_STANDARD_PRICE_ID) {
    return "standard";
  }
  return "free";
}

export function billingStatusFromStripeStatus(status: Stripe.Subscription.Status | null | undefined): BillingStatus {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "canceled":
      return status;
    default:
      return "free";
  }
}

export function getBaseAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
