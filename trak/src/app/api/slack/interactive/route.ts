import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifySlackSignature } from "@/lib/slack/signature";
import { executeSlackAICommand } from "@/lib/ai/slack-executor";
import { buildSlackResponse } from "@/lib/slack/block-kit";
import {
  deleteInteractionContext,
  getInteractionContext,
  updateInteractionContext,
} from "@/lib/slack/interaction-context";
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
      const { actionName, contextId } = parseActionMeta(action.action_id, action.block_id);
      console.log("[Slack Interactive] action received", {
        actionId: action.action_id,
        blockId: action.block_id,
        parsedActionName: actionName,
        hasContextId: Boolean(contextId),
      });

      // Handle project selection
      if (actionName === "select_project" && action.selected_option) {
        return await handleProjectSelection({
          payload,
          projectId: action.selected_option.value,
          projectName: action.selected_option.text.text,
          contextId,
        });
      }

      // Handle tab selection
      if (actionName === "select_tab" && action.selected_option) {
        return await handleTabSelection({
          payload,
          tabId: action.selected_option.value,
          tabName: action.selected_option.text.text,
          contextId,
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
  contextId?: string;
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
      return await respondToInteractive(params.payload.response_url, {
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
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Account not linked",
      });
    }

    if (!params.contextId) {
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Missing interaction context. Please run the command again.",
      });
    }

    const context = await getInteractionContext(teamId, params.contextId);
    console.log("[Slack Interactive] project selected", {
      hasContext: Boolean(context),
      contextId: params.contextId,
      projectId: params.projectId,
    });
    if (!context || context.slackUserId !== slackUserId || context.trakUserId !== userLink.trak_user_id) {
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ This selection has expired. Please run the command again.",
      });
    }

    await updateInteractionContext(teamId, params.contextId, {
      selectedProjectId: params.projectId,
    });

    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, name")
      .eq("project_id", params.projectId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);

    if (tabsError) {
      console.error("Failed to load tabs for project selection:", {
        projectId: params.projectId,
        error: tabsError,
      });
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Unable to load tabs for that project.",
      });
    }

    if (!tabs || tabs.length === 0) {
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ No tabs found in that project. Create a tab in TWOD first.",
      });
    }

    const slackResponse = buildSlackResponse({
      success: false,
      response: `Project selected: *${params.projectName}*. Now choose a tab.`,
      needsContext: {
        type: "tab",
        options: tabs.map((tab) => ({ id: tab.id, name: tab.name })),
        originalCommand: context.originalCommand,
        contextId: params.contextId,
      },
    });
    return await respondToInteractive(params.payload.response_url, {
      ...slackResponse,
      replace_original: true,
    });
  } catch (error) {
    console.error("Error handling project selection:", error);
    return await respondToInteractive(params.payload.response_url, {
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
  contextId?: string;
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
      return await respondToInteractive(params.payload.response_url, {
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
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Account not linked",
      });
    }

    if (!params.contextId) {
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ Missing interaction context. Please run the command again.",
      });
    }

    const context = await getInteractionContext(teamId, params.contextId);
    console.log("[Slack Interactive] tab selected", {
      hasContext: Boolean(context),
      contextId: params.contextId,
      tabId: params.tabId,
      hasSelectedProjectId: Boolean(context?.selectedProjectId),
    });
    if (!context || context.slackUserId !== slackUserId || context.trakUserId !== userLink.trak_user_id) {
      return await respondToInteractive(params.payload.response_url, {
        response_type: "ephemeral",
        replace_original: true,
        text: "❌ This selection has expired. Please run the command again.",
      });
    }

    // Execute original command with selected project + tab context
    const result = await executeSlackAICommand({
      command: context.originalCommand,
      workspaceId: connection.workspace_id,
      userId: userLink.trak_user_id,
      projectId: context.selectedProjectId,
      tabId: params.tabId,
    });

    await deleteInteractionContext(teamId, params.contextId);

    const slackResponse = buildSlackResponse(result);
    return await respondToInteractive(params.payload.response_url, {
      ...slackResponse,
      replace_original: true,
    });
  } catch (error) {
    console.error("Error handling tab selection:", error);
    return await respondToInteractive(params.payload.response_url, {
      response_type: "ephemeral",
      replace_original: true,
      text: "❌ An error occurred while processing your selection.",
    });
  }
}

async function respondToInteractive(responseUrl: string, payload: Record<string, unknown>) {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed posting interactive response_url payload:", error);
  }

  return NextResponse.json({ ok: true });
}

function parseActionMeta(
  actionId: string | undefined,
  blockId: string | undefined
): { actionName: string; contextId?: string } {
  if (!actionId) return { actionName: "" };

  let contextId: string | undefined;
  let actionName = actionId;

  const actionCtxToken = "__ctx__";
  if (actionId.includes(actionCtxToken)) {
    const [name, ctx] = actionId.split(actionCtxToken);
    actionName = name;
    contextId = ctx || undefined;
  } else if (actionId.includes(":")) {
    const [name, ctx] = actionId.split(":");
    actionName = name;
    contextId = ctx || undefined;
  }

  if (!contextId && blockId?.startsWith("ctx__")) {
    contextId = blockId.replace(/^ctx__/, "") || undefined;
  }

  return { actionName, contextId };
}
