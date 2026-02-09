import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/signature";
import { executeSlackAICommand } from "@/lib/ai/slack-executor";
import { buildSlackResponse } from "@/lib/slack/block-kit";
import type { SlackInteractivePayload } from "@/lib/slack/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/slack/interactive
 *
 * Handles Slack interactive component events (button clicks, select menus, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. VERIFY SLACK SIGNATURE
    const body = await request.text();
    const signature = request.headers.get("x-slack-signature");
    const timestamp = request.headers.get("x-slack-request-timestamp");

    if (!signature || !timestamp || !verifySlackSignature(body, signature, timestamp)) {
      console.error("Invalid Slack signature for interactive component");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 2. PARSE PAYLOAD (Slack sends it as form-encoded with "payload" key)
    const params = new URLSearchParams(body);
    const payloadJson = params.get("payload");
    if (!payloadJson) {
      return NextResponse.json(
        { error: "Missing payload" },
        { status: 400 }
      );
    }

    const payload: SlackInteractivePayload = JSON.parse(payloadJson);

    // 3. HANDLE DIFFERENT INTERACTION TYPES
    if (payload.type === "block_actions" && payload.actions && payload.actions.length > 0) {
      const action = payload.actions[0];

      // Handle project selection
      if (action.action_id === "select_project" && action.selected_option) {
        return await handleProjectSelection({
          payload,
          projectId: action.selected_option.value,
          projectName: action.selected_option.text.text,
        });
      }

      // Handle tab selection
      if (action.action_id === "select_tab" && action.selected_option) {
        return await handleTabSelection({
          payload,
          tabId: action.selected_option.value,
          tabName: action.selected_option.text.text,
        });
      }
    }

    // Unknown action type
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Unknown action type",
    });
  } catch (error) {
    console.error("Error in interactive route:", error);
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: "❌ An error occurred while processing your interaction.",
      },
      { status: 500 }
    );
  }
}

/**
 * Handles when a user selects a project from the dropdown
 */
async function handleProjectSelection(params: {
  payload: SlackInteractivePayload;
  projectId: string;
  projectName: string;
}) {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const teamId = params.payload.team.id;
    const slackUserId = params.payload.user.id;

    // Get workspace and user link
    const { data: connection } = await supabase
      .from("slack_workspace_connections")
      .select("id, workspace_id")
      .eq("slack_team_id", teamId)
      .eq("connection_status", "active")
      .single();

    if (!connection) {
      return NextResponse.json({
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Workspace not connected",
      });
    }

    const { data: userLink } = await supabase
      .from("slack_user_links")
      .select("trak_user_id")
      .eq("slack_connection_id", connection.id)
      .eq("slack_user_id", slackUserId)
      .eq("link_status", "active")
      .single();

    if (!userLink) {
      return NextResponse.json({
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Account not linked",
      });
    }

    // Get the original command from the message (if available)
    // For now, we'll just confirm the selection
    const result = await executeSlackAICommand({
      command: `create task in project ${projectName}`,
      workspaceId: connection.workspace_id,
      userId: userLink.trak_user_id,
      projectId: params.projectId,
    });

    const slackResponse = buildSlackResponse(result);
    return NextResponse.json({
      ...slackResponse,
      replace_original: true, // Replace the dropdown message with the result
    });
  } catch (error) {
    console.error("Error handling project selection:", error);
    return NextResponse.json({
      response_type: "ephemeral",
      replace_original: true,
      text: "❌ An error occurred while processing your selection.",
    });
  }
}

/**
 * Handles when a user selects a tab from the dropdown
 */
async function handleTabSelection(params: {
  payload: SlackInteractivePayload;
  tabId: string;
  tabName: string;
}) {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const teamId = params.payload.team.id;
    const slackUserId = params.payload.user.id;

    // Get workspace and user link
    const { data: connection } = await supabase
      .from("slack_workspace_connections")
      .select("id, workspace_id")
      .eq("slack_team_id", teamId)
      .eq("connection_status", "active")
      .single();

    if (!connection) {
      return NextResponse.json({
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Workspace not connected",
      });
    }

    const { data: userLink } = await supabase
      .from("slack_user_links")
      .select("trak_user_id")
      .eq("slack_connection_id", connection.id)
      .eq("slack_user_id", slackUserId)
      .eq("link_status", "active")
      .single();

    if (!userLink) {
      return NextResponse.json({
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Account not linked",
      });
    }

    // Execute command with tab context
    const result = await executeSlackAICommand({
      command: `in tab ${params.tabName}`,
      workspaceId: connection.workspace_id,
      userId: userLink.trak_user_id,
      tabId: params.tabId,
    });

    const slackResponse = buildSlackResponse(result);
    return NextResponse.json({
      ...slackResponse,
      replace_original: true,
    });
  } catch (error) {
    console.error("Error handling tab selection:", error);
    return NextResponse.json({
      response_type: "ephemeral",
      replace_original: true,
      text: "❌ An error occurred while processing your selection.",
    });
  }
}
