import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireWorkspaceAdminRole } from "@/lib/billing/access";
import { ensureWorkspaceBillingRow, getWorkspaceSeatCount, updateWorkspaceBillingRow, validateWorkspaceSeatQuantity } from "@/lib/billing/data";
import { getBaseAppUrl, getPlanPriceId, getStripe } from "@/lib/billing/stripe";
import { normalizePlanKey } from "@/lib/billing/config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    console.log("[billing/checkout] request:start");
    const { user } = await requireUser();
    console.log("[billing/checkout] auth:ok", { userId: user.id });
    const body = await request.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const requestedPlan = normalizePlanKey(body.planKey);
    const requestedSeatQuantity = body.seatQuantity;
    console.log("[billing/checkout] request:parsed", { workspaceId, requestedPlan });

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    if (requestedPlan === "free") {
      return NextResponse.json({ error: "Checkout is only available for paid plans." }, { status: 400 });
    }

    await requireWorkspaceAdminRole(workspaceId, user.id);
    console.log("[billing/checkout] workspace-admin:ok", { workspaceId, userId: user.id });

    const priceId = getPlanPriceId(requestedPlan);
    console.log("[billing/checkout] plan-price:resolved", { requestedPlan, priceId });
    if (!priceId) {
      return NextResponse.json({ error: `Stripe price is not configured for ${requestedPlan}.` }, { status: 500 });
    }

    const stripe = getStripe();
    console.log("[billing/checkout] stripe:client-ready");
    const billing = await ensureWorkspaceBillingRow(workspaceId);
    console.log("[billing/checkout] billing:loaded", {
      workspaceId,
      existingCustomerId: billing.stripe_customer_id,
      existingSubscriptionId: billing.stripe_subscription_id,
    });
    let customerId = billing.stripe_customer_id;
    if (!customerId) {
      console.log("[billing/checkout] stripe-customer:create:start", { workspaceId });
      const customer = await stripe.customers.create({
        metadata: {
          workspaceId,
        },
      });
      customerId = customer.id;
      console.log("[billing/checkout] stripe-customer:create:ok", { workspaceId, customerId });
      await updateWorkspaceBillingRow(workspaceId, { stripe_customer_id: customerId });
      console.log("[billing/checkout] billing:update-customer:ok", { workspaceId, customerId });
    }

    const seatQuantityInput = requestedSeatQuantity ?? await getWorkspaceSeatCount(workspaceId);
    const { seatQuantity, activeMemberCount } = await validateWorkspaceSeatQuantity(workspaceId, seatQuantityInput);
    const appUrl = getBaseAppUrl();
    console.log("[billing/checkout] checkout-session:create:start", {
      workspaceId,
      customerId,
      seatQuantity,
      activeMemberCount,
      appUrl,
      priceId,
    });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: seatQuantity,
      }],
      success_url: `${appUrl}/dashboard/settings?tab=general`,
      cancel_url: `${appUrl}/dashboard/settings?tab=general`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          workspaceId,
          planKey: requestedPlan,
          seatQuantity: String(seatQuantity),
          initiatingUserId: user.id,
        },
      },
      metadata: {
        workspaceId,
        planKey: requestedPlan,
        seatQuantity: String(seatQuantity),
        initiatingUserId: user.id,
      },
    });
    console.log("[billing/checkout] checkout-session:create:ok", {
      workspaceId,
      sessionId: session.id,
      hasUrl: Boolean(session.url),
    });

    return NextResponse.json({ data: { url: session.url } });
  } catch (error) {
    console.error("[billing/checkout] request:error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
