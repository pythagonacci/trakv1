import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireWorkspaceAdminRole } from "@/lib/billing/access";
import { ensureWorkspaceBillingRow, getWorkspaceSeatCount, updateWorkspaceBillingRow } from "@/lib/billing/data";
import { getBaseAppUrl, getPlanPriceId, getStripe } from "@/lib/billing/stripe";
import { normalizePlanKey } from "@/lib/billing/config";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const requestedPlan = normalizePlanKey(body.planKey);

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    if (requestedPlan === "free") {
      return NextResponse.json({ error: "Checkout is only available for paid plans." }, { status: 400 });
    }

    await requireWorkspaceAdminRole(workspaceId, user.id);

    const priceId = getPlanPriceId(requestedPlan);
    if (!priceId) {
      return NextResponse.json({ error: `Stripe price is not configured for ${requestedPlan}.` }, { status: 500 });
    }

    const stripe = getStripe();
    const billing = await ensureWorkspaceBillingRow(workspaceId);
    let customerId = billing.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          workspaceId,
        },
      });
      customerId = customer.id;
      await updateWorkspaceBillingRow(workspaceId, { stripe_customer_id: customerId });
    }

    const seatQuantity = await getWorkspaceSeatCount(workspaceId);
    const appUrl = getBaseAppUrl();
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
          initiatingUserId: user.id,
        },
      },
      metadata: {
        workspaceId,
        planKey: requestedPlan,
        initiatingUserId: user.id,
      },
    });

    return NextResponse.json({ data: { url: session.url } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
