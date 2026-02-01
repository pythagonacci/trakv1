import { NextRequest } from "next/server";
import { executeAICommandStream, type AIMessage } from "@/lib/ai/executor";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import { getBlockWithContext } from "@/app/actions/ai-context";

/**
 * POST /api/ai/stream
 *
 * Execute an AI command with streaming responses.
 * Returns a stream of Server-Sent Events (SSE) with progress updates.
 *
 * Request body:
 * {
 *   command: string;  // The natural language command
 * }
 *
 * SSE Events:
 * - thinking: AI is processing
 * - tool_call: AI is calling a tool
 * - tool_result: Tool execution result
 * - response: Final response from AI
 * - error: An error occurred
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const user = await getAuthenticatedUser();

    if (!user) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", content: "Unauthorized" })}\n\n`,
        {
          status: 401,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // 2. Get workspace context
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", content: "No workspace selected" })}\n\n`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // 3. Get workspace and user details
    const dataClient = await createClient();
    const [workspaceResult, profileResult] = await Promise.all([
      dataClient.from("workspaces").select("name").eq("id", workspaceId).single(),
      dataClient.from("profiles").select("name, email").eq("id", user.id).single(),
    ]);

    const workspaceName = workspaceResult.data?.name || undefined;
    const userName = profileResult.data?.name || profileResult.data?.email || undefined;

    // 4. Parse request body
    const body = await request.json();
    const { command, projectId, tabId, contextBlockId, messages } = body as {
      command: string;
      projectId?: string;
      tabId?: string;
      contextBlockId?: string;
      messages?: AIMessage[];
    };

    // 5. Handle context block if provided
    let contextTableId: string | undefined;
    if (contextBlockId) {
      const blockContext = await getBlockWithContext({ blockId: contextBlockId });
      if (blockContext.data) {
        const ctx = blockContext.data as any;
        const block = ctx.block as { type: string; content?: Record<string, unknown> };
        if (block.type === "table") {
          const content = (block.content || {}) as Record<string, unknown>;
          contextTableId = content.tableId ? String(content.tableId) : undefined;
        }
      }
    }

    if (!command || typeof command !== "string") {
      return new Response(
        `data: ${JSON.stringify({ type: "error", content: "Missing command" })}\n\n`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // 6. Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = executeAICommandStream(command, {
            workspaceId,
            workspaceName,
            userId: user.id,
            userName,
            currentProjectId: projectId,
            currentTabId: tabId,
            contextTableId,
          }, messages || []);

          for await (const event of generator) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send done event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", content: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI Stream Route] Error:", error);
    return new Response(
      `data: ${JSON.stringify({ type: "error", content: "An unexpected error occurred" })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }
}
