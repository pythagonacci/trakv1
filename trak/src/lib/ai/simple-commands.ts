/**
 * Deterministic Command Fast Path
 *
 * Executes high-confidence deterministic parse results without calling the LLM.
 */

import { executeTool, type ToolCallResult } from "./tool-executor";
import type { ExecutionContext, ExecutionResult } from "./executor";
import {
  parseDeterministicCommand,
  type DeterministicToolCall,
  type DeterministicToolCallResult,
} from "./deterministic-parser";
import { aiDebug } from "./debug";
import type { UndoTracker } from "@/lib/ai/undo";

export { parseDeterministicCommand } from "./deterministic-parser";

type ParseOptions = {
  now?: Date;
  minConfidence?: number;
  undoTracker?: UndoTracker;
};

export async function tryDeterministicCommand(
  userCommand: string,
  context: ExecutionContext,
  options: ParseOptions = {}
): Promise<ExecutionResult | null> {
  const t0 = performance.now();
  const parsed = parseDeterministicCommand(userCommand, context, options);
  if (!parsed) return null;

  const toolCallsMade: ExecutionResult["toolCallsMade"] = [];
  const results: ToolCallResult[] = [];
  let lastCreatedTableId: string | null = null;

  for (const toolCall of parsed.toolCalls) {
    const args = { ...toolCall.arguments };
    if (toolCall.name === "bulkCreateFields" && !("tableId" in args) && lastCreatedTableId) {
      args.tableId = lastCreatedTableId;
    }

    const result = await executeTool(
      { name: toolCall.name, arguments: args },
      {
        workspaceId: context.workspaceId,
        userId: context.userId,
        contextTableId: context.contextTableId,
        currentTabId: context.currentTabId,
        currentProjectId: context.currentProjectId,
        undoTracker: options.undoTracker,
      }
    );

    if (toolCall.name === "createTable" && result.success) {
      lastCreatedTableId = extractTableId(result.data) ?? lastCreatedTableId;
    }

    toolCallsMade.push({ tool: toolCall.name, arguments: args, result });
    results.push(result);

    if (!result.success) {
      return {
        success: false,
        response: buildErrorResponse(toolCall.name, result),
        toolCallsMade,
        error: result.error,
      };
    }
  }

  const response = parsed.responseTemplate
    ? parsed.responseTemplate(results as DeterministicToolCallResult[], parsed.toolCalls)
    : buildDefaultResponse(results, parsed.toolCalls);

  aiDebug("deterministic:complete", {
    command: userCommand,
    confidence: parsed.confidence,
    toolCount: parsed.toolCalls.length,
    ms: Math.round(performance.now() - t0),
  });

  return {
    success: results.every((r) => r.success),
    response,
    toolCallsMade,
  };
}

export async function trySimpleCommand(
  userCommand: string,
  context: ExecutionContext
): Promise<ExecutionResult | null> {
  return tryDeterministicCommand(userCommand, context);
}

function buildErrorResponse(toolName: string, result?: ToolCallResult) {
  const error = result?.error ?? "Unknown error";
  return `Failed to ${toolName}: ${error}`;
}

function buildDefaultResponse(results: ToolCallResult[], toolCalls: DeterministicToolCall[]) {
  const failed = results.find((r) => !r.success);
  if (failed) return buildErrorResponse(toolCalls[0]?.name ?? "tool", failed);
  return toolCalls.length > 1 ? "Action completed." : "Done.";
}

function extractTableId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  const table = obj.table as Record<string, unknown> | undefined;
  if (table && typeof table.id === "string") return table.id;
  return null;
}
