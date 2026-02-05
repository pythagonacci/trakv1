import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeWorkflowAICommandStream } from "@/lib/ai/workflow-executor";

/**
 * POST /api/workflow/stream
 *
 * Execute a workflow AI command with streaming responses.
 * Returns a stream of Server-Sent Events (SSE) with progress updates.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json()) as { tabId?: string; command?: string };
    const tabId = String(body?.tabId || "").trim();
    const command = String(body?.command || "").trim();

    if (!tabId) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", content: "Missing tabId" })}\n\n`,
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
    if (!command) {
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = executeWorkflowAICommandStream({ tabId, command });
          for await (const event of generator) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", content: message })}\n\n`)
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
    console.error("[Workflow Stream] Error:", error);
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
