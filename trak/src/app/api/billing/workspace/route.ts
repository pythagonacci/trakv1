import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getWorkspaceBillingSummary } from "@/lib/billing/entitlements";
import { requireWorkspaceAccess } from "@/lib/auth-utils";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: 401 });
  }

  try {
    const summary = await getWorkspaceBillingSummary(workspaceId);
    return NextResponse.json({ data: summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load billing summary" },
      { status: 500 }
    );
  }
}
