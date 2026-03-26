import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireWorkspaceAdminRole } from "@/lib/billing/access";
import { updateStripeSubscriptionPurchasedSeatQuantity } from "@/lib/billing/data";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await request.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    await requireWorkspaceAdminRole(workspaceId, user.id);

    const result = await updateStripeSubscriptionPurchasedSeatQuantity(workspaceId, body.seatQuantity);
    return NextResponse.json({ data: { seatQuantity: result.seatQuantity } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update seats" },
      { status: 500 }
    );
  }
}
