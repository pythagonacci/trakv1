import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { requireManualBillingOverrideAdmin } from "@/lib/billing/access";
import { getWorkspaceBillingSummary } from "@/lib/billing/entitlements";
import { logBillingEvent, setManualWorkspacePlanOverride } from "@/lib/billing/data";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser();
    requireManualBillingOverrideAdmin(user);

    const body = await request.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const requestedPlanKey = typeof body.planKey === "string" ? body.planKey.trim() : "";
    const manualPlanKey = requestedPlanKey === "standard" || requestedPlanKey === "business"
      ? requestedPlanKey
      : null;
    const clearOverride = body.clearOverride === true || requestedPlanKey === "";
    const manualPlanNote = typeof body.note === "string" ? body.note : null;

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    if (!clearOverride && !manualPlanKey) {
      return NextResponse.json({ error: "Manual overrides can only set Standard or Business." }, { status: 400 });
    }

    const updatedBilling = await setManualWorkspacePlanOverride({
      workspaceId,
      manualPlanKey: clearOverride ? null : manualPlanKey,
      manualPlanNote,
      actorEmail: user.email ?? null,
    });

    await logBillingEvent({
      workspaceId,
      source: "manual_override",
      eventType: clearOverride ? "workspace.manual_plan_override.cleared" : "workspace.manual_plan_override.set",
      payload: {
        manualPlanKey: clearOverride ? null : manualPlanKey,
        manualPlanNote: clearOverride ? null : manualPlanNote,
        actorUserId: user.id,
        actorEmail: user.email ?? null,
      },
    });

    const summary = await getWorkspaceBillingSummary(workspaceId);

    return NextResponse.json({
      data: {
        billing: updatedBilling,
        summary,
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "You are not allowed to apply manual billing overrides."
      ? 403
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update manual billing override" },
      { status }
    );
  }
}
