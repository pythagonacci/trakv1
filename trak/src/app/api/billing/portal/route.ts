import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireWorkspaceAdminRole } from "@/lib/billing/access";
import { ensureWorkspaceBillingRow } from "@/lib/billing/data";
import { getBaseAppUrl, getStripe } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    await requireWorkspaceAdminRole(workspaceId, user.id);

    const billing = await ensureWorkspaceBillingRow(workspaceId);
    if (!billing.stripe_customer_id) {
      return NextResponse.json({ error: "This workspace does not have a Stripe customer yet." }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${getBaseAppUrl()}/dashboard/settings?tab=general`,
    });

    return NextResponse.json({ data: { url: session.url } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create portal session" },
      { status: 500 }
    );
  }
}
