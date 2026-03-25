import { NextRequest } from "next/server";
import { executeWorkflowAICommandStream } from "@/lib/ai/workflow-executor";
import type { AIMessage } from "@/lib/ai/executor";
import type { WriteConfirmationApproval } from "@/lib/ai/write-confirmation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { isUnauthorizedApiError, requireUser } from "@/lib/auth/require-user";
import { resolveRouteContextFromPathname } from "@/lib/route-context";
import { assertAndConsumeFreeAiCommandQuota } from "@/lib/billing/limits";
import { toBillingErrorPayload } from "@/lib/billing/errors";

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
 * - response_delta: Streaming response chunk
 * - response: Final response from AI
 * - error: An error occurred
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireUser();

    const body = await request.json();
    const { command, tabId, messages, confirmation, resumeFromConfirmation, routingMode, attachedFiles, contextBlockId } = body as {
      command: string;
      tabId?: string;
      contextBlockId?: string;
      messages?: AIMessage[];
      confirmation?: WriteConfirmationApproval | null;
      resumeFromConfirmation?: boolean;
      routingMode?: "default" | "chart" | "shopify";
      attachedFiles?: Array<{ id: string; name: string }>;
    };

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

    const referer = request.headers.get("referer");
    let refererPathname: string | null = null;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        refererPathname = refererUrl.pathname;
      } catch {
        // Ignore malformed referer
      }
    }

    let resolvedTabId = (tabId || "").trim();
    const workspaceId = await getCurrentWorkspaceId();
    if (workspaceId) {
      try {
        await assertAndConsumeFreeAiCommandQuota(workspaceId);
      } catch (error) {
        const billingError = toBillingErrorPayload(error);
        if (billingError) {
          return new Response(
            `data: ${JSON.stringify({ type: "error", content: billingError.message, code: billingError.code, upgradeTargetPlan: billingError.upgradeTargetPlan })}\n\n`,
            {
              status: 402,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            }
          );
        }
        throw error;
      }
    }
    if (workspaceId && refererPathname) {
      const resolvedRoute = await resolveRouteContextFromPathname({
        supabase,
        workspaceId,
        pathname: refererPathname,
      });
      if (resolvedRoute.tabId) {
        resolvedTabId = resolvedRoute.tabId;
      }
    }

    if (!resolvedTabId) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", content: "Missing tab context" })}\n\n`,
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
          const generator = executeWorkflowAICommandStream({
            tabId: resolvedTabId,
            command,
            contextBlockId: typeof contextBlockId === "string" && contextBlockId.trim().length > 0 ? contextBlockId.trim() : undefined,
            conversationHistory: messages,
            persistSession: false,
            confirmation: confirmation ?? null,
            resumeFromConfirmation: Boolean(resumeFromConfirmation),
            routingMode:
              routingMode === "chart"
                ? "chart"
                : routingMode === "shopify"
                  ? "shopify"
                  : "default",
            attachedFiles: Array.isArray(attachedFiles) && attachedFiles.length > 0 ? attachedFiles : undefined,
          });

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
    if (isUnauthorizedApiError(error)) {
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
