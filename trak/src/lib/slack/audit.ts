import { createClient as createServiceClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface SlackCommandLogParams {
  connectionId: string;
  slackUserId: string;
  trakUserId: string | null;
  commandText: string;
  channelId: string;
  channelName?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  status: "pending" | "success" | "error" | "unauthorized" | "rate_limited";
  responseSummary?: string;
  errorMessage?: string;
  executionTimeMs?: number;
  toolsUsed?: string[];
}

/**
 * Logs a Slack slash command to the audit log
 * @param params The command details to log
 */
export async function logSlackCommand(params: SlackCommandLogParams): Promise<void> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error } = await supabase.from("slack_command_audit_log").insert({
      slack_connection_id: params.connectionId,
      slack_user_id: params.slackUserId,
      trak_user_id: params.trakUserId,
      command_text: params.commandText,
      channel_id: params.channelId,
      channel_name: params.channelName,
      request_id: params.requestId,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      response_status: params.status,
      response_summary: params.responseSummary,
      error_message: params.errorMessage,
      execution_time_ms: params.executionTimeMs,
      tools_used: params.toolsUsed,
    });

    if (error) {
      console.error("Error logging Slack command to audit log:", error);
      // Don't throw - audit logging failures shouldn't break the request
    }
  } catch (error) {
    console.error("Unexpected error in logSlackCommand:", error);
    // Don't throw - audit logging failures shouldn't break the request
  }
}

/**
 * Updates an existing audit log entry
 * @param requestId The request ID to update
 * @param updates The fields to update
 */
export async function updateSlackCommandLog(
  requestId: string,
  updates: Partial<SlackCommandLogParams>
): Promise<void> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const updateData: Record<string, any> = {};
    if (updates.status) updateData.response_status = updates.status;
    if (updates.responseSummary) updateData.response_summary = updates.responseSummary;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.executionTimeMs) updateData.execution_time_ms = updates.executionTimeMs;
    if (updates.toolsUsed) updateData.tools_used = updates.toolsUsed;

    const { error } = await supabase
      .from("slack_command_audit_log")
      .update(updateData)
      .eq("request_id", requestId);

    if (error) {
      console.error("Error updating Slack command audit log:", error);
    }
  } catch (error) {
    console.error("Unexpected error in updateSlackCommandLog:", error);
  }
}
