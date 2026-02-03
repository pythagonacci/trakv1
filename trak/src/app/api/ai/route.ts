// ... imports remain the same
import { NextRequest, NextResponse } from "next/server";
import { executeAICommand, type AIMessage } from "@/lib/ai";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { aiDebug, aiTiming, isAITimingEnabled } from "@/lib/ai/debug"; // Added imports
import { getBlockWithContext } from "@/app/actions/ai-context";

/**
 * POST /api/ai
 * ...
 */
export async function POST(request: NextRequest) {
  const reqStart = Date.now(); // START TIMING
  let t_auth = 0;
  let t_context = 0;
  let t_executor = 0;

  try {
    const referer = request.headers.get("referer");
    let currentProjectId: string | undefined;
    let currentTabId: string | undefined;

    if (referer) {
      try {
        const url = new URL(referer);
        const match = url.pathname.match(/\/dashboard\/projects\/([^/]+)\/tabs\/([^/]+)/);
        if (match) {
          currentProjectId = match[1];
          currentTabId = match[2];
        }
      } catch {
        // Ignore malformed referer
      }
    }

    // 1. Check authentication
    const authStart = Date.now();
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", response: "Please sign in to use AI commands." },
        { status: 401 }
      );
    }

    // 2. Get workspace context
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "No workspace selected", response: "Please select a workspace first." },
        { status: 400 }
      );
    }

    // 3. Get workspace and user details for context
    const supabase = await createClient();

    const [workspaceResult, profileResult] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
      supabase.from("profiles").select("name, email").eq("id", user.id).single(),
    ]);

    const workspaceName = workspaceResult.data?.name || undefined;
    const userName = profileResult.data?.name || profileResult.data?.email || undefined;
    t_auth = Date.now() - authStart; // END AUTH TIMING

    // 4. Parse request body
    const body = await request.json();
    const { command, conversationHistory, contextBlockId } = body as {
      command: string;
      conversationHistory?: AIMessage[];
      contextBlockId?: string | null;
    };

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing command", response: "Please provide a command." },
        { status: 400 }
      );
    }

    aiDebug("api/ai:request", {
      command,
      workspaceId,
      workspaceName,
      userId: user.id,
      userName,
      currentProjectId,
      currentTabId,
      historyCount: conversationHistory?.length ?? 0,
    });

    let history: AIMessage[] = conversationHistory || [];
    let contextTableId: string | undefined;

    const contextStart = Date.now();
    if (contextBlockId) {
      const blockContext = await getBlockWithContext({ blockId: contextBlockId });
      if (blockContext.data) {
        const ctx = blockContext.data as any;
        const block = ctx.block as { id: string; type: string; content?: Record<string, unknown> };
        const blockType = block.type;
        const tabName = ctx.tab?.name || "unknown tab";
        const projectName = ctx.project?.name || "unknown project";
        const content = (block.content || {}) as Record<string, unknown>;
        const tableId = blockType === "table" ? String(content.tableId || "") : "";
        const contextLines = [
          "Context: user selected a block. Use this as the target unless the user says otherwise.",
          `- Block ID: ${block.id}`,
          `- Block type: ${blockType}`,
          `- Tab: ${tabName}`,
          `- Project: ${projectName}`,
        ];
        if (tableId) {
          contextLines.push(`- Table ID: ${tableId}`);
          contextTableId = tableId;
        }

        history = [
          {
            role: "system",
            content: contextLines.join("\n"),
          },
          ...history,
        ];
      }
    }
    t_context = Date.now() - contextStart; // END CONTEXT TIMING

    // 5. Execute the AI command
    const executorStart = Date.now();
    const result = await executeAICommand(
      command,
      {
        workspaceId,
        workspaceName,
        userId: user.id,
        userName,
        currentProjectId,
        currentTabId,
        contextTableId,
        contextBlockId: contextBlockId ?? undefined,
      },
      history
    );
    t_executor = Date.now() - executorStart;

    const totalDuration = Date.now() - reqStart;

    aiDebug("api/ai:response", {
      success: result.success,
      responseLength: result.response?.length ?? 0,
      toolCalls: result.toolCallsMade?.map((t) => ({
        tool: t.tool,
        success: t.result.success,
        error: t.result.error,
      })),
      error: result.error,
    });

    // Log top-level API timings
    let timings: Record<string, number> | undefined;
    if (isAITimingEnabled()) {
      timings = {
        t_auth_ms: t_auth,
        t_context_ms: t_context,
        t_executor_ms: t_executor,
        t_api_total_ms: totalDuration,
        overhead_ms: totalDuration - t_executor
      };
      aiTiming({
        event: "api_complete",
        ...timings
      });
    }

    // 6. Return the result
    if (timings) {
      (result as any)._timing = {
        ...((result as any)._timing || {}),
        ...timings
      };
    }
    return NextResponse.json(result);
  } catch (error) {
    aiDebug("api/ai:error", error);
    console.error("[AI Route] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        response: "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai
 *
 * Health check and info endpoint for the AI service.
 */
export async function GET() {
  const hasApiKey = !!process.env.DEEPSEEK_API_KEY;

  return NextResponse.json({
    service: "Trak AI",
    status: hasApiKey ? "ready" : "not_configured",
    message: hasApiKey
      ? "AI service is ready to accept commands."
      : "AI service is not configured. Please set DEEPSEEK_API_KEY environment variable.",
  });
}
