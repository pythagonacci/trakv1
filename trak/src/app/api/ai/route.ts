import { NextRequest, NextResponse } from "next/server";
import { executeAICommand, type AIMessage } from "@/lib/ai";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ai
 *
 * Execute an AI command in the current workspace.
 *
 * Request body:
 * {
 *   command: string;           // The natural language command
 *   conversationHistory?: AIMessage[];  // Optional conversation history for context
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   response: string;          // The AI's response text
 *   toolCallsMade?: Array<{    // Optional: details of tools called
 *     tool: string;
 *     arguments: Record<string, unknown>;
 *     result: { success: boolean; data?: unknown; error?: string };
 *   }>;
 *   error?: string;            // Error message if success is false
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
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

    // 4. Parse request body
    const body = await request.json();
    const { command, conversationHistory } = body as {
      command: string;
      conversationHistory?: AIMessage[];
    };

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing command", response: "Please provide a command." },
        { status: 400 }
      );
    }

    // 5. Execute the AI command
    const result = await executeAICommand(
      command,
      {
        workspaceId,
        workspaceName,
        userId: user.id,
        userName,
      },
      conversationHistory || []
    );

    // 6. Return the result
    return NextResponse.json(result);
  } catch (error) {
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
