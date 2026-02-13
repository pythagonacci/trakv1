import { NextRequest, NextResponse } from "next/server";
import { executeWorkflowAICommand } from "@/lib/ai/workflow-executor";
import {
  isUnauthorizedApiError,
  requireUser,
  unauthorizedJsonResponse,
} from "@/lib/auth/require-user";

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const body = (await request.json()) as { tabId?: string; command?: string };
    const tabId = String(body?.tabId || "").trim();
    const command = String(body?.command || "").trim();

    if (!tabId) {
      return NextResponse.json({ success: false, error: "Missing tabId" }, { status: 400 });
    }
    if (!command) {
      return NextResponse.json({ success: false, error: "Missing command" }, { status: 400 });
    }

    const result = await executeWorkflowAICommand({ tabId, command });
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to execute workflow AI command",
          response: result.response,
          sessionId: result.sessionId,
          toolCallsMade: result.toolCallsMade,
          createdBlockIds: result.createdBlockIds,
          undoBatches: result.undoBatches,
          undoSkippedTools: result.undoSkippedTools,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return unauthorizedJsonResponse();
    }

    console.error("[Workflow Execute] Error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
