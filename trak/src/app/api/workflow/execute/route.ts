import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeWorkflowAICommand } from "@/lib/ai/workflow-executor";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("[Workflow Execute] Error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
