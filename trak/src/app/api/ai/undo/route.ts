import { NextRequest, NextResponse } from "next/server";
import { undoAIAction } from "@/app/actions/ai-undo";
import {
  isUnauthorizedApiError,
  requireUser,
  unauthorizedJsonResponse,
} from "@/lib/auth/require-user";

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const body = await request.json();
    const workspaceId = String(body?.workspaceId || "").trim();
    const batches = Array.isArray(body?.batches) ? body.batches : [];

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: "Missing workspaceId" }, { status: 400 });
    }

    const result = await undoAIAction({ workspaceId, batches });
    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }

    console.error("[AI Undo] Error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
