import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/signature";
import { checkBothRateLimits } from "@/lib/slack/rate-limiter";
import { checkIdempotency, saveIdempotency, generateIdempotencyKey } from "@/lib/slack/idempotency";
import { executeSlackAICommand } from "@/lib/ai/slack-executor";
import { logSlackCommand } from "@/lib/slack/audit";
import { buildSlackResponse, buildProcessingMessage } from "@/lib/slack/block-kit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

/**
 * POST /api/slack/commands
 *
 * Handles Slack slash command requests (/trak <text>)
 * - Verifies Slack signature for security
 * - Checks rate limits and idempotency
 * - Validates user account linking
 * - Processes command asynchronously via response_url
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. VERIFY SLACK SIGNATURE (Critical security check)
    const body = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    if (!signature || !timestamp) {
      console.error("Missing Slack signature headers");
      return NextResponse.json(
        { error: "Missing signature headers" },
        { status: 401 }
      );
    }

    if (!verifySlackSignature(body, signature, timestamp)) {
      console.error("Invalid Slack signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 2. PARSE FORM DATA
    const params = new URLSearchParams(body);
    const teamId = params.get("team_id")!;
    const slackUserId = params.get("user_id")!;
    const channelId = params.get("channel_id")!;
    const channelName = params.get("channel_name") || undefined;
    const text = params.get("text") || "";
    const responseUrl = params.get("response_url")!;
    const slackRequestId = request.headers.get("x-slack-request-id") || undefined;

    // 3. CHECK IDEMPOTENCY (Deduplicate retries)
    if (slackRequestId) {
      const idempotencyKey = generateIdempotencyKey(teamId, slackRequestId);
      const cachedResponse = await checkIdempotency(idempotencyKey);
      if (cachedResponse) {
        console.log("Returning cached response for request:", slackRequestId);
        return NextResponse.json(cachedResponse);
      }
    }

    // 4. RATE LIMITING (Per-user and per-team)
    const rateLimit = await checkBothRateLimits(teamId, slackUserId);
    if (!rateLimit.success) {
      const errorResponse = {
        response_type: "ephemeral",
        text: rateLimit.message,
      };
      if (slackRequestId) {
        await saveIdempotency(generateIdempotencyKey(teamId, slackRequestId), errorResponse);
      }
      return NextResponse.json(errorResponse);
    }

    // 5. GET TRAK WORKSPACE AND CONNECTION
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: connection } = await supabase
      .from("slack_workspace_connections")
      .select("id, workspace_id")
      .eq("slack_team_id", teamId)
      .eq("connection_status", "active")
      .single();

    if (!connection) {
      const errorResponse = {
        response_type: "ephemeral",
        text: "❌ Slack integration not configured. Please contact your workspace admin.",
      };
      if (slackRequestId) {
        await saveIdempotency(generateIdempotencyKey(teamId, slackRequestId), errorResponse);
      }
      return NextResponse.json(errorResponse);
    }

    // 6. CHECK IF SLACK USER IS LINKED TO TRAK ACCOUNT
    const { data: userLink } = await supabase
      .from("slack_user_links")
      .select("trak_user_id")
      .eq("slack_connection_id", connection.id)
      .eq("slack_user_id", slackUserId)
      .eq("link_status", "active")
      .single();

    if (!userLink) {
      const linkUrl = `${NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations/slack/link?team_id=${teamId}&slack_user_id=${slackUserId}`;
      const errorResponse = {
        response_type: "ephemeral",
        text: `🔗 Please link your Slack account to Trak first:\n${linkUrl}`,
      };
      if (slackRequestId) {
        await saveIdempotency(generateIdempotencyKey(teamId, slackRequestId), errorResponse);
      }
      await logSlackCommand({
        connectionId: connection.id,
        slackUserId,
        trakUserId: null,
        commandText: text,
        channelId,
        channelName,
        requestId: slackRequestId,
        status: "unauthorized",
        errorMessage: "User not linked",
      });
      return NextResponse.json(errorResponse);
    }

    // 7. SEND IMMEDIATE ACKNOWLEDGMENT (Slack requires response within 3 seconds)
    const ackResponse = buildProcessingMessage();

    // 8. PROCESS COMMAND ASYNCHRONOUSLY (via response_url)
    // Don't await - process in background
    processSlackCommandAsync({
      connectionId: connection.id,
      workspaceId: connection.workspace_id,
      trakUserId: userLink.trak_user_id,
      slackUserId,
      teamId,
      channelId,
      channelName,
      text,
      responseUrl,
      requestId: slackRequestId,
      startTime,
    });

    return NextResponse.json(ackResponse);
  } catch (error) {
    console.error("Slack command error:", error);
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: "❌ An error occurred while processing your command.",
      },
      { status: 500 }
    );
  }
}

/**
 * Processes a Slack command asynchronously and posts the result to response_url
 */
async function processSlackCommandAsync(params: {
  connectionId: string;
  workspaceId: string;
  trakUserId: string;
  slackUserId: string;
  teamId: string;
  channelId: string;
  channelName?: string;
  text: string;
  responseUrl: string;
  requestId?: string;
  startTime: number;
}) {
  try {
    // Execute AI command
    const result = await executeSlackAICommand({
      command: params.text,
      workspaceId: params.workspaceId,
      userId: params.trakUserId,
    });

    // Build Slack Block Kit response
    const slackResponse = buildSlackResponse(result);

    // Post to response_url
    await fetch(params.responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackResponse),
    });

    // Save idempotency cache
    if (params.requestId) {
      await saveIdempotency(
        generateIdempotencyKey(params.teamId, params.requestId),
        slackResponse
      );
    }

    // Log success
    await logSlackCommand({
      connectionId: params.connectionId,
      slackUserId: params.slackUserId,
      trakUserId: params.trakUserId,
      commandText: params.text,
      channelId: params.channelId,
      channelName: params.channelName,
      requestId: params.requestId,
      status: "success",
      responseSummary: result.response,
      executionTimeMs: Date.now() - params.startTime,
      toolsUsed: result.toolCallsMade?.map((t) => t.tool),
    });
  } catch (error) {
    console.error("Async command processing error:", error);

    // Post error to response_url
    await fetch(params.responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        text: "❌ Failed to process your command. Please try again.",
      }),
    });

    // Log error
    await logSlackCommand({
      connectionId: params.connectionId,
      slackUserId: params.slackUserId,
      trakUserId: params.trakUserId,
      commandText: params.text,
      channelId: params.channelId,
      channelName: params.channelName,
      requestId: params.requestId,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      executionTimeMs: Date.now() - params.startTime,
    });
  }
}
