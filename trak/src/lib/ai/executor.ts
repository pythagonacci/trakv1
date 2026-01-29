/**
 * AI Executor for Prompt-to-Action
 *
 * This module handles the full AI conversation flow:
 * 1. Receives user commands
 * 2. Calls the AI with system prompt and tools
 * 3. Processes tool calls from the AI
 * 4. Returns the final response
 */

import { allTools, toOpenAIFormat, getToolsByGroups } from "./tool-definitions";
import { getSystemPrompt } from "./system-prompt";
import { executeTool, type ToolCall, type ToolCallResult } from "./tool-executor";
import { aiDebug } from "./debug";
import { classifyIntent } from "./intent-classifier";

// ============================================================================
// TYPES
// ============================================================================

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  response: string;
  toolCallsMade: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    result: ToolCallResult;
  }>;
  error?: string;
}

export interface ExecutionContext {
  workspaceId: string;
  workspaceName?: string;
  userId: string;
  userName?: string;
  currentProjectId?: string;
  currentTabId?: string;
  contextTableId?: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: AIToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const MAX_TOOL_ITERATIONS = 25; // Prevent infinite loops
const TOOL_REPEAT_THRESHOLD = 2;

// ============================================================================
// AI EXECUTOR
// ============================================================================

/**
 * Execute an AI command with full tool calling support.
 * This is the main entry point for the Prompt-to-Action system.
 */
export async function executeAICommand(
  userCommand: string,
  context: ExecutionContext,
  conversationHistory: AIMessage[] = []
): Promise<ExecutionResult> {
  const openAIKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const providerPref = (process.env.AI_PROVIDER || "").toLowerCase();

  if (!openAIKey && !deepseekKey) {
    return {
      success: false,
      response:
        "AI service is not configured. Please set OPENAI_API_KEY or DEEPSEEK_API_KEY.",
      toolCallsMade: [],
      error: "Missing API key",
    };
  }

  // Build the system prompt with context
  const systemPrompt = getSystemPrompt({
    workspaceId: context.workspaceId,
    workspaceName: context.workspaceName,
    userId: context.userId,
    userName: context.userName,
    currentDate: new Date().toISOString().split("T")[0],
    currentProjectId: context.currentProjectId,
    currentTabId: context.currentTabId,
  });

  // Initialize messages
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userCommand },
  ];

  // Classify intent to determine which tools are needed
  const intent = classifyIntent(userCommand);
  const relevantTools = getToolsByGroups(intent.toolGroups);

  // Get tools in OpenAI format (compatible with Deepseek)
  const tools = toOpenAIFormat(relevantTools);
  const provider =
    providerPref === "deepseek"
      ? deepseekKey
        ? "deepseek"
        : openAIKey
          ? "openai"
          : "deepseek"
      : providerPref === "openai"
        ? openAIKey
          ? "openai"
          : deepseekKey
            ? "deepseek"
            : "openai"
        : openAIKey
          ? "openai"
          : "deepseek";
  aiDebug("executeAICommand:start", {
    command: userCommand,
    workspaceId: context.workspaceId,
    userId: context.userId,
    currentProjectId: context.currentProjectId,
    currentTabId: context.currentTabId,
    historyCount: conversationHistory.length,
    intent: {
      toolGroups: intent.toolGroups,
      confidence: intent.confidence,
      reasoning: intent.reasoning,
    },
    toolCount: tools.length,
    toolCountReduction: `${allTools.length} → ${relevantTools.length} (${Math.round((1 - relevantTools.length / allTools.length) * 100)}% reduction)`,
    provider,
  });

  // Track all tool calls made
  const allToolCallsMade: ExecutionResult["toolCallsMade"] = [];
  let lastToolSignature: string | null = null;
  let lastToolRepeatCount = 0;
  let lastToolName: string | null = null;
  let lastSearchTaskIds: string[] | null = null;
  const contextTableId = context.contextTableId;
  const tableIdTools = new Set([
    "getTableSchema",
    "searchTableRows",
    "createField",
    "updateField",
    "deleteField",
    "createRow",
    "updateRow",
    "updateCell",
    "deleteRow",
    "deleteRows",
    "bulkInsertRows",
    "bulkUpdateRows",
    "bulkDeleteRows",
    "bulkDuplicateRows",
    "updateTableRowsByFieldNames",
  ]);

  // Iterate until we get a final response or hit max iterations
  let iterations = 0;
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    try {
      aiDebug("executeAICommand:iteration", { iterations });
      // Call the AI
      const response =
        provider === "openai"
          ? await callOpenAI(openAIKey as string, messages, tools)
          : await callDeepseek(deepseekKey as string, messages, tools);

      if (!response.choices || response.choices.length === 0) {
        return {
          success: false,
          response: "No response from AI service.",
          toolCallsMade: allToolCallsMade,
          error: "Empty response",
        };
      }

      const choice = response.choices[0];
      const assistantMessage = choice.message;
      aiDebug("executeAICommand:assistant", {
        contentLength: assistantMessage.content?.length ?? 0,
        toolCalls: assistantMessage.tool_calls?.map((tc) => tc.function.name) ?? [],
        finishReason: choice.finish_reason,
      });

      // Add assistant message to history
      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      // Check if we have tool calls to process
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Process each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            toolArgs = {};
          }
          if (contextTableId && tableIdTools.has(toolName) && !("tableId" in toolArgs)) {
            toolArgs.tableId = contextTableId;
          }
          if (
            toolName === "createTable" &&
            !("tabId" in toolArgs) &&
            context.currentTabId
          ) {
            toolArgs.tabId = context.currentTabId;
          }
          if (
            toolName === "createTaskBoardFromTasks" &&
            lastToolName === "searchTasks" &&
            Array.isArray(lastSearchTaskIds) &&
            lastSearchTaskIds.length > 0
          ) {
            const existing = Array.isArray(toolArgs.taskIds) ? (toolArgs.taskIds as string[]) : [];
            toolArgs.taskIds = Array.from(new Set([...existing, ...lastSearchTaskIds]));
          }
          aiDebug("executeAICommand:toolCall", { tool: toolName, arguments: toolArgs });

          // Execute the tool
          const result = await executeTool({
            name: toolName,
            arguments: toolArgs,
          }, {
            workspaceId: context.workspaceId,
            userId: context.userId,
            contextTableId,
          });
          aiDebug("executeAICommand:toolResult", {
            tool: toolName,
            success: result.success,
            error: result.error,
          });

          // Track the tool call
          allToolCallsMade.push({
            tool: toolName,
            arguments: toolArgs,
            result,
          });

          lastToolName = toolName;
          if (toolName === "searchTasks" && result.success && Array.isArray(result.data)) {
            lastSearchTaskIds = result.data.map((task: any) => task.id).filter(Boolean);
          }

          const toolSignature = `${toolName}:${JSON.stringify(toolArgs)}`;
          if (toolSignature === lastToolSignature) {
            lastToolRepeatCount += 1;
          } else {
            lastToolSignature = toolSignature;
            lastToolRepeatCount = 1;
          }

          const isSearchLike =
            toolName.startsWith("search") ||
            toolName.startsWith("get") ||
            toolName.startsWith("resolve");

          if (!isSearchLike && lastToolRepeatCount >= TOOL_REPEAT_THRESHOLD) {
            aiDebug("executeAICommand:repeatStop", {
              tool: toolName,
              repeatCount: lastToolRepeatCount,
            });
            return result.success
              ? {
                  success: true,
                  response:
                    "Action completed. I stopped repeating the same tool call to prevent duplicates.",
                  toolCallsMade: allToolCallsMade,
                }
              : {
                  success: false,
                  response: "An error occurred while executing the command.",
                  toolCallsMade: allToolCallsMade,
                  error: result.error || "Tool failed",
                };
          }

          // Add tool result to messages
          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }

        // Continue the loop to let AI process tool results
        continue;
      }

      // No more tool calls - we have a final response
      return {
        success: true,
        response: assistantMessage.content || "Command executed successfully.",
        toolCallsMade: allToolCallsMade,
      };
    } catch (error) {
      aiDebug("executeAICommand:error", error);
      console.error("[executeAICommand] Error:", error);
      return {
        success: false,
        response: "An error occurred while processing your command.",
        toolCallsMade: allToolCallsMade,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Hit max iterations
  return {
    success: false,
    response: "The command required too many steps to complete. Please try a simpler request.",
    toolCallsMade: allToolCallsMade,
    error: "Max iterations reached",
  };
}

/**
 * Call Deepseek API with messages and tools.
 */
async function callDeepseek(
  apiKey: string,
  messages: AIMessage[],
  tools: ReturnType<typeof toOpenAIFormat>
): Promise<ChatCompletionResponse> {
  aiDebug("callDeepseek:request", {
    messageCount: messages.length,
    toolCount: tools.length,
    model: DEEPSEEK_MODEL,
  });
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: messages.map((m) => {
        const base: Record<string, unknown> = {
          role: m.role,
          content: m.content,
          ...(m.tool_calls && { tool_calls: m.tool_calls }),
          ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
          ...(m.name && { name: m.name }),
        };

        if (m.role === "assistant") {
          const reasoning = (m as any).reasoning_content;
          base.reasoning_content = typeof reasoning === "string" ? reasoning : "";
        }

        return base;
      }),
      tools,
      tool_choice: "auto",
      temperature: 0.1, // Low temperature for more deterministic responses
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[callDeepseek] API error:", response.status, errorText);
    throw new Error(`Deepseek API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Call OpenAI Chat Completions API with messages and tools.
 */
async function callOpenAI(
  apiKey: string,
  messages: AIMessage[],
  tools: ReturnType<typeof toOpenAIFormat>
): Promise<ChatCompletionResponse> {
  const model = process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  aiDebug("callOpenAI:request", {
    messageCount: messages.length,
    toolCount: tools.length,
    model,
  });
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
        ...(m.name && { name: m.name }),
      })),
      tools,
      tool_choice: "auto",
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[callOpenAI] API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Simple command execution for quick actions (no conversation history).
 */
export async function executeSimpleCommand(
  command: string,
  context: ExecutionContext
): Promise<ExecutionResult> {
  return executeAICommand(command, context, []);
}

/**
 * Stream-based execution for real-time responses.
 * Returns an async generator that yields partial results.
 */
export async function* executeAICommandStream(
  userCommand: string,
  context: ExecutionContext
): AsyncGenerator<{
  type: "thinking" | "tool_call" | "tool_result" | "response";
  content: string;
  data?: unknown;
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    yield {
      type: "response",
      content: "AI service is not configured.",
    };
    return;
  }

  const systemPrompt = getSystemPrompt({
    workspaceId: context.workspaceId,
    workspaceName: context.workspaceName,
    userId: context.userId,
    userName: context.userName,
    currentDate: new Date().toISOString().split("T")[0],
  });

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userCommand },
  ];

  // Classify intent to determine which tools are needed
  const intent = classifyIntent(userCommand);
  const relevantTools = getToolsByGroups(intent.toolGroups);
  const tools = toOpenAIFormat(relevantTools);
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    yield {
      type: "thinking",
      content: iterations === 1 ? "Analyzing your request..." : "Processing...",
    };

    try {
      const response = await callDeepseek(apiKey, messages, tools);
      const choice = response.choices[0];
      const assistantMessage = choice.message;

      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            toolArgs = {};
          }

          yield {
            type: "tool_call",
            content: `Calling ${toolName}...`,
            data: { tool: toolName, arguments: toolArgs },
          };

          const result = await executeTool({
            name: toolName,
            arguments: toolArgs,
          }, {
            workspaceId: context.workspaceId,
            userId: context.userId,
          });

          yield {
            type: "tool_result",
            content: result.success ? "Success" : result.error || "Error",
            data: result,
          };

          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }

        continue;
      }

      // Final response
      yield {
        type: "response",
        content: assistantMessage.content || "Done.",
      };
      return;
    } catch (error) {
      yield {
        type: "response",
        content: "An error occurred while processing your command.",
      };
      return;
    }
  }

  yield {
    type: "response",
    content: "The command required too many steps. Please try a simpler request.",
  };
}
