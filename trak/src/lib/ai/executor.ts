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
import { executeTool, type ToolCallResult } from "./tool-executor";
import { aiDebug, aiTiming, isAITimingEnabled } from "./debug";
import { classifyIntent, type IntentClassification, type ToolGroup } from "./intent-classifier";
import { tryDeterministicCommand } from "./simple-commands";
import { createUndoTracker, type UndoBatch } from "@/lib/ai/undo";
import {
  buildWriteConfirmationRequest,
  matchesApprovedWriteAction,
  type WriteConfirmationApproval,
} from "./write-confirmation";

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
  undoBatches?: UndoBatch[];
  undoSkippedTools?: string[];
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
  contextBlockId?: string;
  authContext?: import("@/lib/auth-context").AuthContext; // Pre-authenticated context (for Slack, API calls, etc.)
}

export interface ExecuteAICommandOptions {
  /**
   * Force a tool group set regardless of intent classification.
   * Useful for Workflow Pages where unified multi-tool access is required.
   */
  forcedToolGroups?: ToolGroup[];
  /**
   * Enforce read-only behavior for this command (no data mutations).
   * Non-search tools are blocked unless explicitly allowlisted.
   */
  readOnly?: boolean;
  /**
   * Allowlist of non-search tools that are permitted when readOnly is true.
   */
  allowedWriteTools?: string[];
  /**
   * Whether to enforce batch completion for task updates.
   * Defaults to true in general, but can be disabled for read-only commands.
   */
  enforceBatchUpdateCompletion?: boolean;
  /**
   * Disable deterministic fast-path execution (always allow the LLM/tool loop).
   */
  disableDeterministic?: boolean;
  /**
   * Disable optimistic early exits (search/write) that skip a second LLM pass.
   * Useful when you want the model to see tool results and synthesize a response.
   */
  disableOptimisticEarlyExit?: boolean;
  /**
   * Pause before write tools and ask the user to confirm.
   */
  requireWriteConfirmation?: boolean;
  /**
   * One-shot approval to continue a previously paused write tool call.
   */
  approvedWriteAction?: WriteConfirmationApproval | null;
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
const parsedToolCallMaxTokens = Number(process.env.AI_TOOL_CALL_MAX_TOKENS ?? 8192);
const TOOL_CALL_MAX_TOKENS = Math.max(8192, Number.isFinite(parsedToolCallMaxTokens) ? parsedToolCallMaxTokens : 8192);
const parsedToolCallMaxTokensMax = Number(process.env.AI_TOOL_CALL_MAX_TOKENS_MAX ?? 12288);
const TOOL_CALL_MAX_TOKENS_MAX = Math.max(
  TOOL_CALL_MAX_TOKENS,
  Number.isFinite(parsedToolCallMaxTokensMax) ? parsedToolCallMaxTokensMax : 12288
);
const parsedToolCallLengthRetryLimit = Number(process.env.AI_TOOL_CALL_LENGTH_RETRY_LIMIT ?? 2);
const TOOL_CALL_LENGTH_RETRY_LIMIT = Math.max(
  0,
  Number.isFinite(parsedToolCallLengthRetryLimit) ? Math.floor(parsedToolCallLengthRetryLimit) : 2
);
const parsedRecoveredTextBlockMaxChars = Number(process.env.AI_RECOVERED_TEXT_BLOCK_MAX_CHARS ?? 12000);
const RECOVERED_TEXT_BLOCK_MAX_CHARS = Math.max(
  512,
  Number.isFinite(parsedRecoveredTextBlockMaxChars)
    ? Math.floor(parsedRecoveredTextBlockMaxChars)
    : 12000
);
const FINAL_RESPONSE_MAX_TOKENS = Number(process.env.AI_FINAL_MAX_TOKENS ?? 1024);
const TOOL_RESULT_MAX_ITEMS = Number(process.env.AI_TOOL_RESULT_MAX_ITEMS ?? 25);
const TOOL_RESULT_MAX_STRING_CHARS = Number(process.env.AI_TOOL_RESULT_MAX_STRING_CHARS ?? 2000);
const TOOL_RESULT_MAX_OBJECT_KEYS = Number(process.env.AI_TOOL_RESULT_MAX_OBJECT_KEYS ?? 50);
const TOOL_RESULT_MAX_DEPTH = Number(process.env.AI_TOOL_RESULT_MAX_DEPTH ?? 3);
const SKIP_SECOND_LLM = process.env.AI_SKIP_SECOND_LLM !== "0";
const COMPACT_TOOL_RESULTS = process.env.AI_COMPACT_TOOL_RESULTS !== "0";
const PROMPT_MODE = (process.env.AI_PROMPT_MODE || "auto").toLowerCase();
const TRIM_CORE_TO_INTENT = process.env.AI_TRIM_CORE_TO_INTENT !== "0";
const EARLY_EXIT_WRITES = process.env.AI_EARLY_EXIT_WRITES !== "0";
const WRITE_ACTIONS = ["create", "update", "delete", "organize", "move", "copy", "insert"];

type ToolFormatCacheEntry = {
  tools: ReturnType<typeof toOpenAIFormat>;
  jsonChars: number;
};

const toolFormatCache = new Map<string, ToolFormatCacheEntry>();

const DEFAULT_WARM_TOOL_GROUPS: ToolGroup[][] = [
  ["core"],
  ["core", "task"],
  ["core", "table"],
  ["core", "block"],
  ["core", "doc"],
  ["core", "project"],
];

// ============================================================================
// JSON REPAIR UTILITY
// ============================================================================

/**
 * Attempts to repair common JSON formatting errors from AI-generated tool arguments.
 * Specifically handles cases where enum string values are not properly quoted.
 *
 * Examples:
 * - {"status": todo} → {"status": "todo"}
 * - {"priority": high, "limit": 50} → {"priority": "high", "limit": 50}
 * - {"status": in-progress} → {"status": "in-progress"}
 */
function repairJSONArguments(jsonStr: string): string {
  // Pattern to find unquoted values after colons (excluding numbers, booleans, null, and already quoted strings)
  // Matches: : word, : word-with-hyphens, etc. but not : "quoted", : 123, : true, : false, : null
  const unquotedValuePattern = /:\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*([,}])/g;

  const repaired = jsonStr.replace(unquotedValuePattern, (match, value, delimiter) => {
    // Don't quote boolean or null literals
    if (value === 'true' || value === 'false' || value === 'null') {
      return match;
    }
    // Quote the value
    return `: "${value}"${delimiter}`;
  });

  return repaired;
}

function endsWithOddBackslashes(value: string): boolean {
  let count = 0;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    if (value[i] !== "\\") break;
    count += 1;
  }
  return count % 2 === 1;
}

function closeOpenJsonStructures(value: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of value) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }
    if (ch === "}" && stack[stack.length - 1] === "{") {
      stack.pop();
      continue;
    }
    if (ch === "]" && stack[stack.length - 1] === "[") {
      stack.pop();
    }
  }

  let suffix = "";
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    suffix += stack[i] === "{" ? "}" : "]";
  }
  return value + suffix;
}

function repairTruncatedJSONArguments(jsonStr: string): string | null {
  const start = jsonStr.indexOf("{");
  if (start === -1) return null;

  const base = jsonStr.slice(start).trim();
  if (!base) return null;

  const maxCuts = Math.min(3000, Math.max(0, base.length - 2));
  for (let cut = 0; cut <= maxCuts; cut += 1) {
    let candidate = base.slice(0, base.length - cut).trim();
    if (!candidate) break;

    // Remove incomplete trailing token fragments before closure.
    candidate = candidate.replace(/[,:]\s*$/, "");

    if (endsWithOddBackslashes(candidate)) {
      candidate += "\\";
    }

    // If still inside a string, close the quote before closing braces/brackets.
    let inString = false;
    let escaped = false;
    for (const ch of candidate) {
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === "\"") inString = false;
      } else if (ch === "\"") {
        inString = true;
      }
    }
    if (inString) {
      candidate += "\"";
    }

    candidate = closeOpenJsonStructures(candidate);

    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep trimming.
    }
  }

  return null;
}

function collectTextFragments(
  value: unknown,
  fragments: string[],
  depth = 0,
  keyHint?: string
): void {
  if (depth > 12 || value === null || value === undefined) return;

  if (typeof value === "string") {
    if (keyHint === "text" || keyHint === "title" || keyHint === "heading") {
      const normalized = value.replace(/\s+/g, " ").trim();
      if (normalized) fragments.push(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTextFragments(entry, fragments, depth + 1, keyHint);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      collectTextFragments(nested, fragments, depth + 1, key);
    }
  }
}

function recoverCreateTextBlockArgsFromTruncation(
  toolArgs: Record<string, unknown>
): Record<string, unknown> | null {
  if (toolArgs.type !== "text") return null;

  const content = toolArgs.content;
  let recoveredText = "";

  if (typeof content === "string") {
    recoveredText = content;
  } else if (content && typeof content === "object") {
    const contentRecord = content as Record<string, unknown>;
    if (typeof contentRecord.text === "string" && contentRecord.text.trim().length > 0) {
      recoveredText = contentRecord.text;
    } else {
      const fragments: string[] = [];
      collectTextFragments(contentRecord, fragments);
      if (fragments.length > 0) {
        recoveredText = fragments.join("\n");
      }
    }
  }

  const normalized = recoveredText.replace(/\u0000/g, "").trim();
  if (!normalized) return null;

  const maxChars = Math.max(512, RECOVERED_TEXT_BLOCK_MAX_CHARS);
  const boundedText = normalized.length > maxChars
    ? normalized.slice(0, maxChars)
    : normalized;

  return {
    ...toolArgs,
    type: "text",
    content: { text: boundedText },
  };
}

function recoverUpdateTextBlockArgsFromTruncation(
  toolArgs: Record<string, unknown>
): Record<string, unknown> | null {
  // For updateBlock, we need to have a blockId and content
  if (!toolArgs.blockId || !toolArgs.content) return null;

  const content = toolArgs.content;
  let recoveredText = "";

  if (typeof content === "string") {
    recoveredText = content;
  } else if (content && typeof content === "object") {
    const contentRecord = content as Record<string, unknown>;
    if (typeof contentRecord.text === "string" && contentRecord.text.trim().length > 0) {
      recoveredText = contentRecord.text;
    } else {
      const fragments: string[] = [];
      collectTextFragments(contentRecord, fragments);
      if (fragments.length > 0) {
        recoveredText = fragments.join("\n");
      }
    }
  }

  const normalized = recoveredText.replace(/\u0000/g, "").trim();
  if (!normalized) return null;

  const maxChars = Math.max(512, RECOVERED_TEXT_BLOCK_MAX_CHARS);
  const boundedText = normalized.length > maxChars
    ? normalized.slice(0, maxChars)
    : normalized;

  return {
    ...toolArgs,
    content: { text: boundedText },
  };
}

function recoverWriteToolArgumentsAfterTruncation(
  toolName: string,
  toolArgs: Record<string, unknown>
): { args: Record<string, unknown>; strategy: string } | null {
  if (toolName === "createBlock") {
    const recovered = recoverCreateTextBlockArgsFromTruncation(toolArgs);
    if (recovered) {
      return {
        args: recovered,
        strategy: "create_text_block_content_recovery",
      };
    }
  }

  if (toolName === "updateBlock") {
    const recovered = recoverUpdateTextBlockArgsFromTruncation(toolArgs);
    if (recovered) {
      return {
        args: recovered,
        strategy: "update_text_block_content_recovery",
      };
    }
  }

  return null;
}

export function warmPromptToActionCache(
  toolGroupSets: ToolGroup[][] = DEFAULT_WARM_TOOL_GROUPS
) {
  const warmed: Array<{
    groups: ToolGroup[];
    toolCount: number;
    jsonChars: number;
    cached: boolean;
  }> = [];

  toolGroupSets.forEach((groups) => {
    const toolsForGroups = getToolsByGroups(groups);
    const toolCacheKey = toolsForGroups.map((tool) => tool.name).join("|");
    const existing = toolFormatCache.get(toolCacheKey);
    if (existing) {
      warmed.push({
        groups,
        toolCount: toolsForGroups.length,
        jsonChars: existing.jsonChars,
        cached: true,
      });
      return;
    }

    const formatted = toOpenAIFormat(toolsForGroups);
    const jsonChars = JSON.stringify(formatted).length;
    toolFormatCache.set(toolCacheKey, { tools: formatted, jsonChars });
    warmed.push({
      groups,
      toolCount: toolsForGroups.length,
      jsonChars,
      cached: false,
    });
  });

  return {
    warmed,
  };
}

function isSearchLikeToolName(name: string) {
  return (
    name.startsWith("search") ||
    name.startsWith("get") ||
    name.startsWith("resolve") ||
    name === "requestToolGroups" ||
    name === "unstructuredSearchWorkspace"
  );
}

/**
 * Determines if a tool operation requires user confirmation.
 * Only update and delete operations require confirmation.
 * Create operations do not require confirmation (low risk, easily undoable).
 */
function requiresConfirmation(toolName: string): boolean {
  // Update operations - modifying existing data (risky)
  if (toolName.startsWith("update")) return true;
  if (toolName.includes("Update") && toolName.startsWith("bulk")) return true;

  // Delete operations - removing data (risky)
  if (toolName.startsWith("delete")) return true;
  if (toolName.includes("Delete") && toolName.startsWith("bulk")) return true;
  if (toolName.startsWith("archive")) return true;

  // Move/rename operations - changing structure (risky)
  if (toolName.startsWith("move")) return true;
  if (toolName.startsWith("rename")) return true;

  // Create operations - adding new data (low risk, no confirmation needed)
  // Insert operations - adding new rows (low risk, no confirmation needed)
  // All other operations - no confirmation needed
  return false;
}

function looksLikeSemanticQuery(command: string): boolean {
  const text = command.toLowerCase();
  if (text.length < 4) return false;
  if (text.includes("?")) return true;
  if (/\b(what|why|how|where|which|who|when)\b/.test(text)) return true;
  if (/\b(find|search|lookup|look up|show me|list|summarize|recap|compare|match|fit)\b/.test(text)) return true;
  if (looksLikeKnowledgeQuery(text)) return true;
  return false;
}

function looksLikeKnowledgeQuery(text: string): boolean {
  return /\b(doc|docs|documentation|note|notes|spec|specs|specification|plan|policy|strategy|icp|requirement|requirements|diet|meal|nutrition|roadmap|brief|target|targets|goal|goals|objective|objectives|guideline|guidelines|process|processes|workflow|workflows|about|details?|information|info|summary|summaries|overview|how|why)\b/i.test(
    text
  );
}

const STRUCTURED_SEARCH_FALLBACK_TOOLS = new Set([
  "searchDocs",
  "searchDocContent",
  "searchBlocks",
  "searchFiles",
  "searchAll",
  "searchTasks",
  "searchSubtasks",
  "searchProjects",
  "searchTabs",
  "searchClients",
  "searchTables",
  "searchTableRows",
  "searchTimelineEvents",
  "searchWorkspaceMembers",
  "searchTags",
]);

function isEmptySearchResult(result: ToolCallResult): boolean {
  if (!result || !result.success) return true;
  const data = result.data as any;
  if (!data) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested.length === 0;
    if (typeof (data as { count?: number }).count === "number") {
      return (data as { count?: number }).count === 0;
    }
  }
  return false;
}

function shouldUseFastPrompt(
  userCommand: string,
  intent: { confidence: number; toolGroups: string[] },
  conversationHistory: AIMessage[]
) {
  // Always use fast prompt if explicitly set
  if (PROMPT_MODE === "fast") return true;
  // For "full" or "auto" mode, auto-detect simple commands
  if (conversationHistory.length > 0) return false;
  if (userCommand.length > 400) return false;
  if (intent.confidence < 0.85) return false;
  if (intent.toolGroups.length > 2) return false;
  const lowered = userCommand.toLowerCase();
  if (/(explain|why|summarize|analysis|report|reasoning|help|how)/i.test(lowered)) return false;
  // Simple create/search commands qualify for fast prompt
  return true;
}

function applyContextualToolGroups(
  intent: IntentClassification,
  context: ExecutionContext
): IntentClassification {
  let updated = false;
  const toolGroups = new Set<ToolGroup>(intent.toolGroups);

  if (context.contextBlockId && !toolGroups.has("block")) {
    toolGroups.add("block");
    updated = true;
  }

  if (context.contextTableId && !toolGroups.has("table")) {
    toolGroups.add("table");
    updated = true;
  }

  if (!updated) return intent;

  return {
    ...intent,
    toolGroups: Array.from(toolGroups),
    reasoning: `${intent.reasoning} + context`,
  };
}
// All chart-related deterministic helper functions removed
// Charts are now handled entirely by the LLM via tool calls

const TOOL_GROUP_NAMES = new Set([
  "task",
  "project",
  "table",
  "timeline",
  "block",
  "tab",
  "doc",
  "file",
  "client",
  "property",
  "comment",
  "workspace",
  "shopify",
]);

const TOOL_ACCESS_SIGNAL =
  /(need(?:ed)? access|do(?:\s+)?not have access|don't have access|lack(?:ing)? access|missing tools?|tools? (?:are|aren't|is|isn't|not) available|current tool set|toolset|cannot|can't|unable to)\b/i;

function extractToolGroupsFromToolMentions(text: string) {
  const lower = text.toLowerCase();
  const groups = new Set<string>();
  for (const tool of allTools) {
    if (!tool?.name) continue;
    if (!lower.includes(tool.name.toLowerCase())) continue;
    const category = (tool as { category?: string }).category;
    if (category && TOOL_GROUP_NAMES.has(category)) {
      groups.add(category);
    }
  }
  return Array.from(groups);
}

function extractToolGroupsFromKeywords(text: string) {
  const lower = text.toLowerCase();
  const groups = new Set<string>();
  if (/(table|row|rows|column|columns|cell|cells|spreadsheet)/i.test(lower)) {
    groups.add("table");
  }
  if (/\btask(?:s)?\b/i.test(lower)) {
    groups.add("task");
  }
  if (/\bproject(?:s)?\b/i.test(lower)) {
    groups.add("project");
  }
  if (/\btimeline(?:s)?\b/i.test(lower)) {
    groups.add("timeline");
  }
  if (/\bblock(?:s)?\b/i.test(lower)) {
    groups.add("block");
  }
  if (/\btab(?:s)?\b/i.test(lower)) {
    groups.add("tab");
  }
  if (/\bdoc(?:s|ument)?(?:s)?\b/i.test(lower)) {
    groups.add("doc");
  }
  if (/\bfile(?:s)?\b/i.test(lower)) {
    groups.add("file");
  }
  if (/\bclient(?:s)?\b/i.test(lower)) {
    groups.add("client");
  }
  if (/\bworkspace(?:s)?\b/i.test(lower)) {
    groups.add("workspace");
  }
  if (/\b(shopify|product(?:s)?|store|shop|inventory|variant(?:s)?|sku(?:s)?)\b/i.test(lower)) {
    groups.add("shopify");
  }
  return Array.from(groups);
}

function detectToolGroupUpgrade(message: string | null, currentGroups: string[]) {
  if (!message) return [];
  const hasAccessSignal = TOOL_ACCESS_SIGNAL.test(message);
  const fromMentions = extractToolGroupsFromToolMentions(message);
  const fromKeywords = extractToolGroupsFromKeywords(message);
  if (!hasAccessSignal && fromMentions.length === 0) return [];
  const merged = new Set<string>([...fromMentions, ...fromKeywords]);
  return Array.from(merged).filter(
    (group) => TOOL_GROUP_NAMES.has(group) && !currentGroups.includes(group)
  );
}

function trimToolsForIntent(
  tools: ReturnType<typeof getToolsByGroups>,
  intent: { toolGroups: string[]; confidence: number; entities: string[] },
  userCommand: string
) {
  if (!TRIM_CORE_TO_INTENT) return tools;
  const lower = userCommand.toLowerCase();
  const hasTableOnly =
    intent.toolGroups.includes("table") &&
    intent.toolGroups.every((g) => g === "core" || g === "table");
  if (!hasTableOnly || intent.confidence < 0.85) {
    return tools;
  }

  const keep = new Set<string>([
    "searchTables",
    "searchTableRows",
    "getTableSchema",
    "resolveEntityByName",
    "getEntityById",
  ]);

  if (
    intent.entities.includes("task") ||
    lower.includes("task") ||
    lower.includes("subtask") ||
    lower.includes("checklist")
  ) {
    keep.add("searchTasks");
  }
  if (lower.includes("subtask") || lower.includes("checklist")) keep.add("searchSubtasks");
  if (intent.entities.includes("project") || lower.includes("project")) keep.add("searchProjects");
  if (intent.entities.includes("tab") || lower.includes("tab")) keep.add("searchTabs");
  if (intent.entities.includes("block") || lower.includes("block")) keep.add("searchBlocks");
  if (intent.entities.includes("doc") || lower.includes("doc")) keep.add("searchDocs");
  if (intent.entities.includes("client") || lower.includes("client")) keep.add("searchClients");
  if (intent.entities.includes("timeline") || lower.includes("timeline"))
    keep.add("searchTimelineEvents");
  if (intent.entities.includes("table") || lower.includes("tag")) keep.add("searchTags");
  if (lower.includes("assignee") || lower.includes("member")) keep.add("searchWorkspaceMembers");
  if (lower.includes("file")) keep.add("searchFiles");

  return tools.filter((tool) => tool.category !== "search" || keep.has(tool.name));
}

function extractCountFromResult(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const keys = [
    "updated",
    "updatedCount",
    "created",
    "createdCount",
    "movedCount",
    "deletedCount",
    "insertedCount",
  ];
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  if (Array.isArray(obj.insertedIds)) return obj.insertedIds.length;
  return null;
}

function summarizeToolCall(toolName: string, result: ToolCallResult) {
  if (!result.success) {
    return `Failed to ${toolName}: ${result.error ?? "Unknown error"}.`;
  }
  if (result.hint) {
    return result.hint;
  }

  const count = extractCountFromResult(result.data);
  const countText = count !== null ? ` (${count})` : "";

  switch (toolName) {
    case "createField":
      return `Added a column.${countText}`;
    case "createTable":
      return `Created a table.${countText}`;
    case "createRow":
    case "bulkInsertRows":
      return `Inserted rows.${countText}`;
    case "updateTableRowsByFieldNames":
    case "bulkUpdateRows":
    case "updateRow":
    case "updateCell":
      return `Updated table rows.${countText}`;
    case "deleteRow":
    case "deleteRows":
      return `Deleted rows.${countText}`;
    case "createTaskItem":
      return `Created task.${countText}`;
    case "createTaskSubtask":
      return `Created subtask.${countText}`;
    case "updateTaskItem":
      return `Updated task.${countText}`;
    case "createProject":
      return `Created project.${countText}`;
    case "createTab":
      return `Created tab.${countText}`;
    case "createBlock":
      return `Created block.${countText}`;
    case "createTaskBoardFromTasks":
      return `Created task board.${countText}`;
    default:
      return `Action completed.${countText}`;
  }
}

function buildToolSummary(toolCalls: Array<{ tool: string; result: ToolCallResult }>) {
  const messages = toolCalls.map((call) => summarizeToolCall(call.tool, call.result));
  const combined = messages.filter(Boolean).join(" ");
  return combined.length > 0 ? combined : "Action completed.";
}

function shouldTruncateString(value: string) {
  return value.length > TOOL_RESULT_MAX_STRING_CHARS;
}

function compactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return shouldTruncateString(value)
      ? `${value.slice(0, TOOL_RESULT_MAX_STRING_CHARS)}...[truncated]`
      : value;
  }
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    const limited = value.slice(0, TOOL_RESULT_MAX_ITEMS).map((item) =>
      compactValue(item, depth + 1)
    );
    if (value.length > TOOL_RESULT_MAX_ITEMS) {
      limited.push({ __truncated_items: value.length - TOOL_RESULT_MAX_ITEMS });
    }
    return limited;
  }

  if (depth >= TOOL_RESULT_MAX_DEPTH) {
    return "[truncated_object]";
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const limitedEntries = entries.slice(0, TOOL_RESULT_MAX_OBJECT_KEYS);
  const compacted: Record<string, unknown> = {};
  for (const [key, entryValue] of limitedEntries) {
    compacted[key] = compactValue(entryValue, depth + 1);
  }
  if (entries.length > TOOL_RESULT_MAX_OBJECT_KEYS) {
    compacted.__truncated_keys = entries.length - TOOL_RESULT_MAX_OBJECT_KEYS;
  }
  return compacted;
}

function compactToolResult(result: ToolCallResult): ToolCallResult {
  return {
    ...result,
    data: compactValue(result.data, 0),
  };
}

// ============================================================================
// SINGLE-ACTION TOOL NARROWING
// ============================================================================

/**
 * When intent is a single action on a single entity (e.g., "create task"),
 * keep only the tools relevant to that action. This cuts the tools JSON
 * payload sent to the LLM, which directly correlates with lower latency.
 *
 * Falls back to the full tool set when:
 * - Multiple entity groups are involved
 * - Multiple actions are detected
 * - Confidence is below threshold
 * - The LLM later calls requestToolGroups (handled by the upgrade path)
 */
const SINGLE_ACTION_TOOLS: Record<string, Record<string, string[]>> = {
  create: {
    task: ["createTaskItem", "createTaskSubtask"],
    project: ["createProject"],
    table: ["createTableFull", "createTable", "createField", "bulkCreateFields", "createRow", "bulkInsertRows"],
    tab: ["createTab"],
    block: ["createBlock"],
    doc: ["createDoc"],
    client: ["createClient"],
    timeline: ["createTimelineEvent"],
  },
  update: {
    task: [
      "updateTaskItem",
      "bulkUpdateTaskItems",
      "setTaskAssignees",
      "bulkSetTaskAssignees",
      "setTaskTags",
    ],
    project: ["updateProject"],
    table: [
      "updateTableRowsByFieldNames",
      "bulkUpdateRows",
      "bulkUpdateRowsByFieldNames",
      "updateRow",
      "updateCell",
      "updateField",
    ],
    tab: ["updateTab"],
    block: ["updateBlock"],
    doc: ["updateDoc"],
    client: ["updateClient"],
    timeline: ["updateTimelineEvent"],
  },
  delete: {
    task: ["deleteTaskItem"],
    project: ["deleteProject"],
    table: ["deleteTable", "deleteRow", "deleteRows", "deleteField"],
    tab: ["deleteTab"],
    block: ["deleteBlock"],
    doc: ["deleteDoc", "archiveDoc"],
    client: ["deleteClient"],
    timeline: ["deleteTimelineEvent", "deleteTimelineDependency"],
  },
};

function narrowToolsForSingleAction(
  tools: ReturnType<typeof getToolsByGroups>,
  intent: { actions: string[]; toolGroups: string[]; confidence: number }
): ReturnType<typeof getToolsByGroups> {
  const nonCoreGroups = intent.toolGroups.filter((g) => g !== "core");
  if (nonCoreGroups.length !== 1 || intent.actions.length !== 1 || intent.confidence < 0.85) {
    return tools;
  }
  const action = intent.actions[0];
  if (!["create", "update", "delete"].includes(action)) return tools;
  const entity = nonCoreGroups[0];
  const allowed = SINGLE_ACTION_TOOLS[action]?.[entity];
  if (!allowed) return tools;
  const allowedSet = new Set(allowed);
  // Keep all search/control (core) tools + only the action-relevant entity tools
  return tools.filter(
    (tool) => tool.category === "search" || tool.category === "control" || allowedSet.has(tool.name)
  );
}

function extractShopifyMention(command: string) {
  const mentionRegex = /(^|\\s)@shopify(\\b|\\s)/gi;
  const hasMention = mentionRegex.test(command);
  if (!hasMention) {
    return { hasMention: false, cleanedCommand: command };
  }
  const cleaned = command.replace(mentionRegex, " ").replace(/\\s+/g, " ").trim();
  return { hasMention: true, cleanedCommand: cleaned.length > 0 ? cleaned : command };
}

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
  conversationHistory: AIMessage[] = [],
  options: ExecuteAICommandOptions = {}
): Promise<ExecutionResult> {
  const timingEnabled = isAITimingEnabled();
  const timingStart = timingEnabled ? Date.now() : 0;
  const timing = timingEnabled
    ? {
      t_intent_ms: 0,
      t_prompt_build_ms: 0,
      t_llm1_ms: 0,
      t_llm2_ms: 0,
      t_llm_extra_ms: 0,
      t_tools_total_ms: 0,
      tool_result_chars_total: 0,
      system_prompt_chars: 0,
      tools_json_chars: 0,
      tool_timings_ms: {} as Record<string, number>,
    }
    : null;
  const undoTracker = createUndoTracker();
  const { hasMention: hasShopifyMention, cleanedCommand } = extractShopifyMention(userCommand);
  const commandForModel = cleanedCommand;
  let timingLogged = false;
  const logTiming = () => {
    if (!timing || timingLogged) return;
    timingLogged = true;
    const toolTimingEntries = Object.entries(timing.tool_timings_ms).map(([tool, ms]) => [
      `t_tool_${tool}_ms`,
      Math.round(ms),
    ]);
    aiTiming({
      event: "executor_complete",
      t_intent_ms: Math.round(timing.t_intent_ms),
      t_prompt_build_ms: Math.round(timing.t_prompt_build_ms ?? 0),
      t_llm1_ms: Math.round(timing.t_llm1_ms),
      t_llm2_ms: Math.round(timing.t_llm2_ms),
      t_llm_extra_ms: Math.round(timing.t_llm_extra_ms),
      t_tools_total_ms: Math.round(timing.t_tools_total_ms),
      t_total_ms: Math.round(Date.now() - timingStart),
      system_prompt_chars: timing.system_prompt_chars,
      tools_json_chars: timing.tools_json_chars,
      tool_result_chars_total: timing.tool_result_chars_total,
      ...Object.fromEntries(toolTimingEntries),
    });
  };
  const withTiming = (result: ExecutionResult) => {
    result.undoBatches = undoTracker.batches;
    if (undoTracker.skippedTools.length > 0) {
      result.undoSkippedTools = undoTracker.skippedTools;
    }
    logTiming();
    if (timing) {
      (result as any)._timing = {
        t_intent_ms: Math.round(timing.t_intent_ms),
        t_prompt_build_ms: Math.round(timing.t_prompt_build_ms ?? 0),
        t_llm1_ms: Math.round(timing.t_llm1_ms),
        t_llm2_ms: Math.round(timing.t_llm2_ms),
        t_llm_extra_ms: Math.round(timing.t_llm_extra_ms),
        t_tools_total_ms: Math.round(timing.t_tools_total_ms),
        t_total_ms: Math.round(Date.now() - timingStart),
        system_prompt_chars: timing.system_prompt_chars,
        tools_json_chars: timing.tools_json_chars,
        tool_result_chars_total: timing.tool_result_chars_total,
        tool_timings_ms: timing.tool_timings_ms,
      };
    }
    return result;
  };

  const openAIKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const providerPref = (process.env.AI_PROVIDER || "").toLowerCase();

  if (!openAIKey && !deepseekKey) {
    return withTiming({
      success: false,
      response:
        "AI service is not configured. Please set OPENAI_API_KEY or DEEPSEEK_API_KEY.",
      toolCallsMade: [],
      error: "Missing API key",
    });
  }

  // Classify intent to determine which tools are needed
  const intentStart = timingEnabled ? Date.now() : 0;
  const intent = applyContextualToolGroups(classifyIntent(commandForModel), context);
  const forcedToolGroups = new Set<ToolGroup>(options.forcedToolGroups ?? []);
  if (hasShopifyMention) {
    forcedToolGroups.add("shopify");
  }
  if (forcedToolGroups.size > 0) {
    const toolGroups = new Set<ToolGroup>(forcedToolGroups);
    toolGroups.add("core");
    intent.toolGroups = Array.from(toolGroups);
  }
  if (timing) {
    timing.t_intent_ms = Date.now() - intentStart;
  }

  // Handle approved write action - execute it directly without LLM
  if (options.approvedWriteAction && options.requireWriteConfirmation) {
    const approval = options.approvedWriteAction;
    const toolName = approval.request.tool;
    const toolArgs = approval.request.arguments ?? {};

    const result = await executeTool(
      {
        name: toolName,
        arguments: toolArgs,
      },
      {
        workspaceId: context.workspaceId,
        userId: context.userId,
        contextTableId: context.contextTableId,
        contextBlockId: context.contextBlockId,
        currentTabId: context.currentTabId,
        currentProjectId: context.currentProjectId,
        undoTracker,
        authContext: context.authContext,
      }
    );

    const toolCallsMade: ExecutionResult["toolCallsMade"] = [
      { tool: toolName, arguments: toolArgs, result },
    ];

    const response = result.success
      ? "Action completed."
      : `Failed to complete action: ${result.error ?? "Unknown error"}`;

    return withTiming({
      success: result.success,
      response,
      toolCallsMade,
      error: result.error,
    });
  }

  // Fast path: simple pattern-matched commands skip the LLM entirely
  if (!options.disableDeterministic) {
    const simpleResult = await tryDeterministicCommand(commandForModel, context, { undoTracker });
    if (simpleResult) return withTiming(simpleResult);
  }

  // Detect multi-step commands (used later to prevent premature early-exit on writes).
  // "then / also / after that / next" are unambiguous multi-step connectors.
  // "and" is tricky: it joins two actions ("create X and assign to Y") but also
  // appears inside noun lists ("columns Name, Region, and Population").
  // We only treat "and" as multi-step when it is followed by an action verb,
  // indicating a second independent action rather than a list continuation.
  const ACTION_VERBS = /\b(?:and)\s+(?:assign|add|set|tag|move|delete|remove|update|rename|change|populate|fill|insert|attach|link|copy|duplicate|archive|complete|close|open|share|export|import)\b/i;
  const isMultiStepCommand =
    /\b(?:then|also|after that|next)\b/i.test(commandForModel) ||
    /\b(?:with|w\/|columns?|fields?|rows?)\b/i.test(commandForModel) ||
    ACTION_VERBS.test(commandForModel) ||
    intent.actions.length > 1;

  // Build the system prompt with context
  const promptBuildStart = timingEnabled ? Date.now() : 0;
  const promptMode = shouldUseFastPrompt(commandForModel, intent, conversationHistory) ? "fast" : "full";
  const systemPrompt = getSystemPrompt({
    workspaceId: context.workspaceId,
    workspaceName: context.workspaceName,
    userId: context.userId,
    userName: context.userName,
    currentDate: new Date().toISOString().split("T")[0],
    currentProjectId: context.currentProjectId,
    currentTabId: context.currentTabId,
    activeToolGroups: intent.toolGroups,
  }, promptMode);
  if (timing) {
    timing.system_prompt_chars = systemPrompt.length;
    timing.t_prompt_build_ms = Date.now() - promptBuildStart;
  }

  // Initialize messages
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: commandForModel },
  ];

  let activeIntent = intent;
  let toolUpgradeAttempted = false;
  let relevantTools = narrowToolsForSingleAction(
    trimToolsForIntent(getToolsByGroups(activeIntent.toolGroups), activeIntent, commandForModel),
    activeIntent
  );

  // Get tools in OpenAI format (compatible with Deepseek) with caching
  const getCachedTools = (toolsForIntent: typeof relevantTools) => {
    const toolCacheKey = toolsForIntent.map((tool) => tool.name).join("|");
    const cachedTools = toolFormatCache.get(toolCacheKey);
    let tools: ReturnType<typeof toOpenAIFormat>;
    if (cachedTools) {
      tools = cachedTools.tools;
      if (timing) timing.tools_json_chars = cachedTools.jsonChars;
    } else {
      tools = toOpenAIFormat(toolsForIntent);
      const jsonChars = timingEnabled ? JSON.stringify(tools).length : 0;
      toolFormatCache.set(toolCacheKey, { tools, jsonChars });
      if (timing) timing.tools_json_chars = jsonChars;
    }
    return tools;
  };

  let tools = getCachedTools(relevantTools);
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
    promptMode,
  });

  // Track all tool calls made
  const allToolCallsMade: ExecutionResult["toolCallsMade"] = [];
  let toolCallTokenBudget = TOOL_CALL_MAX_TOKENS;
  let toolCallLengthRetries = 0;
  let lastToolSignature: string | null = null;
  let lastToolRepeatCount = 0;
  let lastToolName: string | null = null;
  let lastSearchTaskIds: string[] | null = null;
  let autoUnstructuredFallbackUsed = false;
  let llmCallIndex = 0;
  const contextTableId = context.contextTableId;
  const contextBlockId = context.contextBlockId;

  // Track consecutive errors per tool to prevent extensive retry loops
  const consecutiveErrorCount = new Map<string, number>();

  // Track empty argument calls to prevent infinite loops when LLM calls tools with no args
  const emptyArgCallCount = new Map<string, number>();

  // Track search results and updates to detect incomplete batch operations
  const searchResults = new Map<string, { count: number; itemIds: string[] }>();
  const updatedItemIds = new Set<string>();
  let sawTaskMutationTool = false;
  const readOnlyAllowedWriteTools = new Set(options.allowedWriteTools ?? []);
  const taskMutationTools = new Set([
    "updateTaskItem",
    "bulkUpdateTaskItems",
    "bulkMoveTaskItems",
    "setTaskAssignees",
    "bulkSetTaskAssignees",
    "deleteTaskItem",
    "createTaskSubtask",
    "updateTaskSubtask",
    "deleteTaskSubtask",
  ]);
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
    "bulkUpdateRowsByFieldNames",
    "bulkDeleteRows",
    "bulkDuplicateRows",
    "updateTableRowsByFieldNames",
    "updateTableFull",
  ]);
  const blockIdTools = new Set(["updateBlock", "deleteBlock"]);

  // Iterate until we get a final response or hit max iterations
  let iterations = 0;
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    try {
      aiDebug("executeAICommand:iteration", { iterations });
      // Call the AI
      const llmStart = timingEnabled ? Date.now() : 0;
      const hasToolResultsInConversation = messages.some((message) => message.role === "tool");
      const maxTokens = hasToolResultsInConversation
        ? FINAL_RESPONSE_MAX_TOKENS
        : toolCallTokenBudget;
      const response =
        provider === "openai"
          ? await callOpenAI(openAIKey as string, messages, tools, maxTokens)
          : await callDeepseek(deepseekKey as string, messages, tools, maxTokens);
      const llmDuration = timingEnabled ? Date.now() - llmStart : 0;
      llmCallIndex += 1;
      if (timing) {
        if (llmCallIndex === 1) {
          timing.t_llm1_ms = llmDuration;
        } else if (llmCallIndex === 2) {
          timing.t_llm2_ms = llmDuration;
        } else {
          timing.t_llm_extra_ms += llmDuration;
        }
      }

      if (!response.choices || response.choices.length === 0) {
        return withTiming({
          success: false,
          response: "No response from AI service.",
          toolCallsMade: allToolCallsMade,
          error: "Empty response",
        });
      }

      const choice = response.choices[0];
      const assistantMessage = choice.message;
      const finishReason = choice.finish_reason;
      aiDebug("executeAICommand:assistant", {
        contentLength: assistantMessage.content?.length ?? 0,
        toolCalls: assistantMessage.tool_calls?.map((tc) => tc.function.name) ?? [],
        finishReason,
      });

      // If the model stopped because of length while emitting tool calls,
      // retry immediately with a larger tool-call token budget.
      // This avoids truncated JSON arguments for write-heavy tool calls.
      if (
        !hasToolResultsInConversation &&
        finishReason === "length" &&
        (assistantMessage.tool_calls?.length ?? 0) > 0
      ) {
        const nextBudget = Math.min(
          Math.max(toolCallTokenBudget + 1024, Math.round(toolCallTokenBudget * 1.5)),
          TOOL_CALL_MAX_TOKENS_MAX
        );
        if (toolCallLengthRetries < TOOL_CALL_LENGTH_RETRY_LIMIT && nextBudget > toolCallTokenBudget) {
          aiDebug("executeAI:toolCallLengthRetry", {
            retry: toolCallLengthRetries + 1,
            fromMaxTokens: toolCallTokenBudget,
            toMaxTokens: nextBudget,
          });
          toolCallTokenBudget = nextBudget;
          toolCallLengthRetries += 1;
          continue;
        }
      } else {
        toolCallLengthRetries = 0;
      }

      // Add assistant message to history
      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      // Check if we have tool calls to process
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        let allToolCallsSuccessful = true;
        const toolNamesThisRound: string[] = [];
        const toolCallsThisRound: Array<{ tool: string; result: ToolCallResult }> = [];
        let pendingToolUpgradePrompt: string | null = null;
        // Process each tool call - PARALLEL EXECUTION
        // First, prepare and execute all tools in parallel
        const toolExecutionPromises = assistantMessage.tool_calls.map(async (toolCall) => {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;
          let parseFailure: string | null = null;
          let usedTruncateRepair = false;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            aiDebug("executeAI:jsonParseError", {
              tool: toolName,
              rawArguments: toolCall.function.arguments,
              parseError: errorMsg,
            });

            // Try to repair common JSON issues (like unquoted enum values)
            try {
              const repairedJSON = repairJSONArguments(toolCall.function.arguments);
              toolArgs = JSON.parse(repairedJSON);
              aiDebug("executeAI:jsonRepaired", {
                tool: toolName,
                original: toolCall.function.arguments,
                repaired: repairedJSON,
              });
            } catch (repairError) {
              // Last resort: trim incomplete tail and close open JSON structures.
              const repairedTruncated = repairTruncatedJSONArguments(toolCall.function.arguments);
              if (repairedTruncated) {
                try {
                  toolArgs = JSON.parse(repairedTruncated);
                  usedTruncateRepair = true;
                  aiDebug("executeAI:jsonTruncateRepaired", {
                    tool: toolName,
                    originalLength: toolCall.function.arguments.length,
                    repairedLength: repairedTruncated.length,
                  });
                } catch (truncatedParseError) {
                  const repairErrorMsg =
                    repairError instanceof Error ? repairError.message : String(repairError);
                  const truncatedParseErrorMsg =
                    truncatedParseError instanceof Error
                      ? truncatedParseError.message
                      : String(truncatedParseError);
                  parseFailure = `Failed to parse tool arguments JSON (${errorMsg}). Repair failed (${repairErrorMsg}). Truncate repair failed (${truncatedParseErrorMsg}).`;
                  toolArgs = {};
                }
              } else {
                const repairErrorMsg =
                  repairError instanceof Error ? repairError.message : String(repairError);
                parseFailure = `Failed to parse tool arguments JSON (${errorMsg}). Repair failed (${repairErrorMsg}).`;
                toolArgs = {};
              }
            }
          }

          // Never execute write tools with tail-truncated/repaired JSON.
          // This prevents partial inserts/updates when the model output was cut off.
          if (usedTruncateRepair && !isSearchLikeToolName(toolName) && !parseFailure) {
            const recovered = recoverWriteToolArgumentsAfterTruncation(toolName, toolArgs);
            if (recovered) {
              toolArgs = recovered.args;
              aiDebug("executeAI:jsonTruncateAccepted", {
                tool: toolName,
                strategy: recovered.strategy,
              });
            } else {
              aiDebug("executeAI:jsonTruncateRejected", {
                tool: toolName,
                reason: "truncated_repair_on_write_tool",
              });
              parseFailure =
                "Tool arguments were truncated and only partially repaired. Refusing to execute a write tool with potentially incomplete data. Retry with a smaller payload (fewer rows per call).";
            }
          }

          if (contextTableId && tableIdTools.has(toolName) && !("tableId" in toolArgs)) {
            toolArgs.tableId = contextTableId;
          }
          if (contextBlockId && blockIdTools.has(toolName) && !("blockId" in toolArgs)) {
            toolArgs.blockId = contextBlockId;
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

          aiDebug("executeAICommand:toolCall", {
            tool: toolName,
            argCount: Object.keys(toolArgs).length,
            argKeys: Object.keys(toolArgs).slice(0, 10),
          });



          // IMPORTANT: If the LLM requests a write tool, allow it even in read-only mode
          // This handles cases where queries have both read and write intent that wasn't caught in classification
          // The LLM's tool choice becomes the authoritative signal of user intent
          if (options.readOnly && !isSearchLikeToolName(toolName) && !readOnlyAllowedWriteTools.has(toolName)) {
            // Allow the tool to be called - treat the LLM's request as authorization
            aiDebug("executeAICommand:readOnlyOverride", {
              tool: toolName,
              reason: "LLM requested write tool in read-only context - allowing as intent signal",
            });
            // Continue with tool execution instead of blocking
          }

          // Execute the tool
          const toolStart = timingEnabled ? Date.now() : 0;
          const result = parseFailure
            ? ({
              success: false,
              error: `${parseFailure} Ask the model to retry the tool call with valid JSON arguments.`,
            } as ToolCallResult)
            : await executeTool({
              name: toolName,
              arguments: toolArgs,
            }, {
              workspaceId: context.workspaceId,
              userId: context.userId,
              contextTableId,
              currentTabId: context.currentTabId,
              currentProjectId: context.currentProjectId,
              undoTracker,
              authContext: context.authContext,
            });
          const toolDuration = timingEnabled ? Date.now() - toolStart : 0;

          return { toolCall, toolName, toolArgs, result, toolDuration };
        });

        // Wait for all tools to complete in parallel
        const toolExecutionResults = await Promise.all(toolExecutionPromises);

        // Process results sequentially to maintain message order and state consistency
        for (const { toolCall, toolName, toolArgs, result, toolDuration } of toolExecutionResults) {
          toolNamesThisRound.push(toolName);
          if (timing) {
            timing.t_tools_total_ms += toolDuration;
            timing.tool_timings_ms[toolName] =
              (timing.tool_timings_ms[toolName] ?? 0) + toolDuration;
          }
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
          toolCallsThisRound.push({ tool: toolName, result });

          // Check for empty argument calls (potential infinite loop)
          const hasEmptyArgs = !toolArgs || Object.keys(toolArgs).length === 0;
          if (hasEmptyArgs && !result.success) {
            const emptyCallCount = (emptyArgCallCount.get(toolName) || 0) + 1;
            emptyArgCallCount.set(toolName, emptyCallCount);

            // Stop immediately on first empty-arg failure to prevent loops
            if (emptyCallCount >= 1) {
              // Provide actionable guidance based on tool type
              const toolGuidance = toolName.includes("Task") || toolName.includes("task")
                ? "Please specify which task block to use, or navigate to a page with a task block."
                : toolName.includes("Table") || toolName.includes("table") || toolName.includes("Row")
                  ? "Please specify which table to use, or navigate to a page with a table."
                  : "Please provide more specific details about what you'd like to do.";
              return withTiming({
                success: false,
                response: `I couldn't complete the ${toolName} action because required information was missing. ${toolGuidance}`,
                toolCallsMade: allToolCallsMade,
                error: "Missing required context or information"
              });
            }
          } else if (!hasEmptyArgs || result.success) {
            emptyArgCallCount.set(toolName, 0);
          }

          if (!result.success) {
            allToolCallsSuccessful = false;
            const currentErrors = (consecutiveErrorCount.get(toolName) || 0) + 1;
            consecutiveErrorCount.set(toolName, currentErrors);

            if (currentErrors >= 3) {
              return withTiming({
                success: false,
                response: `I'm having trouble with the ${toolName} tool. It failed ${currentErrors} times in a row. Error: ${result.error}`,
                toolCallsMade: allToolCallsMade,
                error: "Too many consecutive tool errors"
              });
            }
          } else {
            consecutiveErrorCount.set(toolName, 0);
          }

          if (toolName === "requestToolGroups" && result.success) {
            const requestedGroups = Array.isArray(toolArgs.toolGroups)
              ? (toolArgs.toolGroups as string[])
              : [];
            const validGroups = requestedGroups.filter(
              (group) => TOOL_GROUP_NAMES.has(group as any) && !activeIntent.toolGroups.includes(group as any)
            );
            if (validGroups.length > 0) {
              activeIntent = {
                ...activeIntent,
                toolGroups: Array.from(new Set([...activeIntent.toolGroups, ...(validGroups as any[])])),
              };
              relevantTools = narrowToolsForSingleAction(
                trimToolsForIntent(
                  getToolsByGroups(activeIntent.toolGroups),
                  activeIntent,
                  commandForModel
                ),
                activeIntent
              );
              tools = getCachedTools(relevantTools);
              toolUpgradeAttempted = true;
              aiDebug("executeAICommand:toolUpgrade", {
                from: intent.toolGroups,
                to: activeIntent.toolGroups,
                added: validGroups,
                toolCount: tools.length,
              });
              pendingToolUpgradePrompt =
                "You now have access to the additional tools you requested. Continue and complete the task using them.";
            }
          }

          lastToolName = toolName;
          if (toolName === "searchTasks" && result.success && Array.isArray(result.data)) {
            lastSearchTaskIds = result.data.map((task: any) => task.id).filter(Boolean);
            // Track search results for batch operation detection
            if (lastSearchTaskIds.length > 1) {
              searchResults.set("tasks", { count: lastSearchTaskIds.length, itemIds: lastSearchTaskIds });
            }
          }

          if (taskMutationTools.has(toolName)) {
            sawTaskMutationTool = true;
          }

          // Track which tasks/items have been updated
          if (toolName === "updateTaskItem" && result.success && toolArgs.taskId) {
            updatedItemIds.add(toolArgs.taskId as string);
          }
          if (toolName === "bulkUpdateTaskItems" && result.success) {
            const taskIds = Array.isArray(toolArgs.taskIds) ? (toolArgs.taskIds as string[]) : [];
            const skipped = Array.isArray((result.data as any)?.skipped)
              ? ((result.data as any).skipped as string[])
              : [];
            for (const taskId of taskIds) {
              if (!skipped.includes(taskId)) {
                updatedItemIds.add(taskId);
              }
            }
          }

          const toolSignature = `${toolName}:${JSON.stringify(toolArgs)}`;
          if (toolSignature === lastToolSignature) {
            lastToolRepeatCount += 1;
          } else {
            lastToolSignature = toolSignature;
            lastToolRepeatCount = 1;
          }

          const isSearchLike = isSearchLikeToolName(toolName);

          if (!isSearchLike && lastToolRepeatCount >= TOOL_REPEAT_THRESHOLD) {
            aiDebug("executeAICommand:repeatStop", {
              tool: toolName,
              repeatCount: lastToolRepeatCount,
            });
            return result.success
              ? withTiming({
                success: true,
                response:
                  "Action completed. I stopped repeating the same tool call to prevent duplicates.",
                toolCallsMade: allToolCallsMade,
              })
              : withTiming({
                success: false,
                response: "An error occurred while executing the command.",
                toolCallsMade: allToolCallsMade,
                error: result.error || "Tool failed",
              });
          }

          // Add tool result to messages
          const compactedForMetrics = compactToolResult(result);
          const toolResultForModel = COMPACT_TOOL_RESULTS ? compactedForMetrics : result;
          const toolMessageContent = JSON.stringify(toolResultForModel);
          if (timing) {
            timing.tool_result_chars_total += JSON.stringify(compactedForMetrics).length;
          }
          messages.push({
            role: "tool",
            content: toolMessageContent,
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }

        if (pendingToolUpgradePrompt) {
          messages.push({
            role: "user",
            content: pendingToolUpgradePrompt,
          });
          continue;
        }

        const onlySearchOps = toolNamesThisRound.every(isSearchLikeToolName);
        const structuredSearchesThisRound = toolCallsThisRound.filter((call) =>
          STRUCTURED_SEARCH_FALLBACK_TOOLS.has(call.tool)
        );
        const hasStructuredSearchThisRound = structuredSearchesThisRound.length > 0;
        const structuredSearchEmpty = structuredSearchesThisRound.every((call) =>
          isEmptySearchResult(call.result)
        );
        const semanticQuery = looksLikeSemanticQuery(commandForModel);
        const knowledgeQuery = looksLikeKnowledgeQuery(commandForModel);
        // Only count successful unstructured search calls, not blocked/failed attempts
        const unstructuredAlready =
          toolCallsThisRound.some((call) => call.tool === "unstructuredSearchWorkspace" && call.result.success) ||
          allToolCallsMade.some((call) => call.tool === "unstructuredSearchWorkspace" && call.result.success);

        // Auto-fallback to unstructured search when:
        // 1. Only search operations were performed
        // 2. Structured searches returned empty OR query looks like knowledge/semantic query
        // 3. Haven't already used unstructured search
        // This is MORE AGGRESSIVE to ensure unstructured search is tried for semantic queries
        if (
          !autoUnstructuredFallbackUsed &&
          onlySearchOps &&
          hasStructuredSearchThisRound &&
          (structuredSearchEmpty || knowledgeQuery || semanticQuery) &&
          !unstructuredAlready &&
          commandForModel.trim().length >= 4
        ) {
          const autoToolArgs = { query: commandForModel };
          const autoToolCallId = `auto_unstructured_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          aiDebug("executeAICommand:autoUnstructuredFallback", {
            query: autoToolArgs.query,
            toolsAttempted: structuredSearchesThisRound.map((call) => call.tool),
            structuredSearchEmpty,
            knowledgeQuery,
            semanticQuery,
            readOnly: options.readOnly,
          });

          const autoToolResult = await executeTool(
            { name: "unstructuredSearchWorkspace", arguments: autoToolArgs },
            {
              workspaceId: context.workspaceId,
              userId: context.userId,
              contextTableId,
              currentTabId: context.currentTabId,
              currentProjectId: context.currentProjectId,
              undoTracker,
              authContext: context.authContext,
            }
          );

          allToolCallsMade.push({
            tool: "unstructuredSearchWorkspace",
            arguments: autoToolArgs,
            result: autoToolResult,
          });

          const compactedForMetrics = compactToolResult(autoToolResult);
          const toolResultForModel = COMPACT_TOOL_RESULTS ? compactedForMetrics : autoToolResult;
          if (timing) {
            timing.tool_result_chars_total += JSON.stringify(compactedForMetrics).length;
          }

          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: autoToolCallId,
                type: "function",
                function: {
                  name: "unstructuredSearchWorkspace",
                  arguments: JSON.stringify(autoToolArgs),
                },
              },
            ],
          });
          messages.push({
            role: "tool",
            content: JSON.stringify(toolResultForModel),
            tool_call_id: autoToolCallId,
            name: "unstructuredSearchWorkspace",
          });

          autoUnstructuredFallbackUsed = true;
          continue;
        } else if (onlySearchOps && hasStructuredSearchThisRound && !unstructuredAlready) {
          // Log why auto-fallback was skipped
          aiDebug("executeAICommand:autoUnstructuredFallbackSkipped", {
            autoUnstructuredFallbackUsed,
            structuredSearchEmpty,
            knowledgeQuery,
            semanticQuery,
            commandLength: commandForModel.trim().length,
            reason: !structuredSearchEmpty && !knowledgeQuery && !semanticQuery
              ? "Query not semantic/knowledge-based and structured search had results"
              : commandForModel.trim().length < 4
                ? "Query too short"
                : "Unknown",
          });
        }

        const writeToolsThisRound = toolNamesThisRound.filter(
          (name) => !isSearchLikeToolName(name)
        );
        const hasWriteTool = writeToolsThisRound.length > 0;

        // Optimistic early exit for writes — only when the command is a single
        // discrete action.  Multi-step commands ("create X and assign to Y") need
        // to continue so the LLM can issue the remaining tool calls.
        if (
          !options.disableOptimisticEarlyExit &&
          EARLY_EXIT_WRITES &&
          SKIP_SECOND_LLM &&
          allToolCallsSuccessful &&
          hasWriteTool &&
          !isMultiStepCommand
        ) {
          return withTiming({
            success: true,
            response: buildToolSummary(toolCallsThisRound),
            toolCallsMade: allToolCallsMade,
          });
        }

        // NEW: Optimistic early exit for searches - skip the 2nd LLM call
        // OPTIMIZATION: Only exit if the intent is PURELY search.
        // If the user wanted to "create", "update", etc., we must continue even if the first step was just a search.
        // Only consider actions, not toolGroups - having entity toolGroups loaded
        // doesn't mean we intend to write. The LLM can request tools if it needs to write.
        const hasWriteIntent = activeIntent.actions.some(a => WRITE_ACTIONS.includes(a));

        if (!options.disableOptimisticEarlyExit && SKIP_SECOND_LLM && allToolCallsSuccessful && onlySearchOps && !hasWriteIntent) {
          return withTiming({
            success: true,
            response: buildToolSummary(toolCallsThisRound),
            toolCallsMade: allToolCallsMade,
          });
        }

        // Continue the loop to let AI process tool results
        continue;
      }

      // Check if we have incomplete batch operations before returning final response
      const tasksSearch = searchResults.get("tasks");
      const shouldCheckIncompleteBatch =
        (options.enforceBatchUpdateCompletion ?? true) && sawTaskMutationTool;
      if (tasksSearch && tasksSearch.count > 1 && shouldCheckIncompleteBatch) {
        const updatedTasks = tasksSearch.itemIds.filter((id) => updatedItemIds.has(id));
        const remainingTasks = tasksSearch.itemIds.filter((id) => !updatedItemIds.has(id));

        // If we found multiple tasks but only updated some (or none), prompt AI to continue
        if (remainingTasks.length > 0 && updatedTasks.length < tasksSearch.count) {
          aiDebug("executeAICommand:incompleteBatch", {
            totalTasks: tasksSearch.count,
            updated: updatedTasks.length,
            remaining: remainingTasks.length,
          });

          // Inject a message prompting the AI to continue updating remaining tasks
          messages.push({
            role: "user",
            content: `IMPORTANT: You found ${tasksSearch.count} tasks but only updated ${updatedTasks.length} of them. The user asked to update ALL tasks. Please continue updating the remaining ${remainingTasks.length} task(s). Task IDs that still need updating: ${remainingTasks.slice(0, 10).join(", ")}${remainingTasks.length > 10 ? ` (and ${remainingTasks.length - 10} more)` : ""}.`,
          });

          // Continue the loop to let AI process this prompt
          continue;
        }
      }

      // No more tool calls - we have a final response
      const hasAnySearchTool = allToolCallsMade.some((call) => isSearchLikeToolName(call.tool));
      const hasWriteIntent = activeIntent.actions.some((a) => WRITE_ACTIONS.includes(a));
      if (
        !autoUnstructuredFallbackUsed &&
        !hasAnySearchTool &&
        !hasWriteIntent &&
        looksLikeSemanticQuery(commandForModel)
      ) {
        const autoToolArgs = { query: commandForModel };
        const autoToolCallId = `auto_unstructured_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        aiDebug("executeAICommand:autoUnstructuredNoSearch", {
          query: autoToolArgs.query,
        });

        const autoToolResult = await executeTool(
          { name: "unstructuredSearchWorkspace", arguments: autoToolArgs },
          {
            workspaceId: context.workspaceId,
            userId: context.userId,
            contextTableId,
            currentTabId: context.currentTabId,
            currentProjectId: context.currentProjectId,
            undoTracker,
            authContext: context.authContext,
          }
        );

        allToolCallsMade.push({
          tool: "unstructuredSearchWorkspace",
          arguments: autoToolArgs,
          result: autoToolResult,
        });

        const compactedForMetrics = compactToolResult(autoToolResult);
        const toolResultForModel = COMPACT_TOOL_RESULTS ? compactedForMetrics : autoToolResult;
        if (timing) {
          timing.tool_result_chars_total += JSON.stringify(compactedForMetrics).length;
        }

        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: autoToolCallId,
              type: "function",
              function: {
                name: "unstructuredSearchWorkspace",
                arguments: JSON.stringify(autoToolArgs),
              },
            },
          ],
        });
        messages.push({
          role: "tool",
          content: JSON.stringify(toolResultForModel),
          tool_call_id: autoToolCallId,
          name: "unstructuredSearchWorkspace",
        });

        autoUnstructuredFallbackUsed = true;
        continue;
      }

      const upgradeGroups = detectToolGroupUpgrade(assistantMessage.content, activeIntent.toolGroups);
      if (!toolUpgradeAttempted && upgradeGroups.length > 0) {
        toolUpgradeAttempted = true;
        activeIntent = {
          ...activeIntent,
          toolGroups: Array.from(new Set([...activeIntent.toolGroups, ...(upgradeGroups as any[])])),
        };
        relevantTools = narrowToolsForSingleAction(
          trimToolsForIntent(getToolsByGroups(activeIntent.toolGroups), activeIntent, commandForModel),
          activeIntent
        );
        tools = getCachedTools(relevantTools);
        aiDebug("executeAICommand:toolUpgrade", {
          from: intent.toolGroups,
          to: activeIntent.toolGroups,
          added: upgradeGroups,
          toolCount: tools.length,
        });
        messages.push({
          role: "user",
          content:
            "You now have access to the additional tools you requested. Continue and complete the task using them.",
        });
        continue;
      }

      return withTiming({
        success: true,
        response: assistantMessage.content || "Command executed successfully.",
        toolCallsMade: allToolCallsMade,
      });
    } catch (error) {
      aiDebug("executeAICommand:error", error);
      console.error("[executeAICommand] Error:", error);
      return withTiming({
        success: false,
        response: "An error occurred while processing your command.",
        toolCallsMade: allToolCallsMade,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Hit max iterations
  return withTiming({
    success: false,
    response: "The command required too many steps to complete. Please try a simpler request.",
    toolCallsMade: allToolCallsMade,
    error: "Max iterations reached",
  });
}

/**
 * Call Deepseek API with messages and tools.
 */
async function callDeepseek(
  apiKey: string,
  messages: AIMessage[],
  tools: ReturnType<typeof toOpenAIFormat>,
  maxTokens: number
): Promise<ChatCompletionResponse> {
  const t0 = performance.now();
  aiDebug("callDeepseek:request", {
    messageCount: messages.length,
    toolCount: tools.length,
    model: DEEPSEEK_MODEL,
  });
  const resolvedMaxTokens = Number.isFinite(maxTokens) ? maxTokens : 4096;
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
      parallel_tool_calls: true, // Enable multiple tool calls per turn for efficiency
      temperature: 0.1, // Low temperature for more deterministic responses
      max_tokens: resolvedMaxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[callDeepseek] API error:", response.status, errorText);
    throw new Error(`Deepseek API error: ${response.status}`);
  }

  const body = await response.json();
  aiDebug("callDeepseek:response", {
    ms: Math.round(performance.now() - t0),
    messageCount: messages.length,
    toolCount: tools.length,
    model: DEEPSEEK_MODEL,
  });
  return body;
}

/**
 * Call OpenAI Chat Completions API with messages and tools.
 */
async function callOpenAI(
  apiKey: string,
  messages: AIMessage[],
  tools: ReturnType<typeof toOpenAIFormat>,
  maxTokens: number
): Promise<ChatCompletionResponse> {
  const t0 = performance.now();
  const model = process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  aiDebug("callOpenAI:request", {
    messageCount: messages.length,
    toolCount: tools.length,
    model,
  });
  const resolvedMaxTokens = Number.isFinite(maxTokens) ? maxTokens : 4096;
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
      parallel_tool_calls: true, // Enable multiple tool calls per turn for efficiency
      temperature: 0.1,
      max_tokens: resolvedMaxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[callOpenAI] API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const body = await response.json();
  aiDebug("callOpenAI:response", {
    ms: Math.round(performance.now() - t0),
    messageCount: messages.length,
    toolCount: tools.length,
    model,
  });
  return body;
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
 * Generate a human-friendly status message for a tool call.
 */
function getHumanFriendlyToolMessage(toolName: string): string {
  // Extract the action and entity from tool name (e.g., "createTaskItem" -> "create", "Task")
  const actionPatterns: Record<string, string> = {
    create: "Creating",
    update: "Updating",
    delete: "Deleting",
    search: "Searching",
    get: "Looking up",
    list: "Finding",
    bulk: "Processing",
    move: "Moving",
    copy: "Copying",
    duplicate: "Duplicating",
  };

  const entityPatterns: Record<string, string> = {
    subtask: "subtask",
    task: "task",
    project: "project",
    table: "table",
    row: "data",
    field: "field",
    tab: "tab",
    block: "content",
    chart: "chart",
    timeline: "timeline",
    client: "client",
    comment: "comment",
    file: "file",
    doc: "document",
    workspace: "workspace",
    property: "property",
  };

  const lowerName = toolName.toLowerCase();

  // Find matching action
  let action = "Working on";
  for (const [pattern, friendlyAction] of Object.entries(actionPatterns)) {
    if (lowerName.startsWith(pattern)) {
      action = friendlyAction;
      break;
    }
  }

  // Find matching entity
  let entity = "your request";
  for (const [pattern, friendlyEntity] of Object.entries(entityPatterns)) {
    if (lowerName.includes(pattern)) {
      entity = friendlyEntity;
      break;
    }
  }

  // Special cases for common tools
  if (lowerName.includes("schema")) {
    return "Reading table structure...";
  }
  if (lowerName === "requesttoolgroups") {
    return "Getting ready...";
  }

  return `${action} ${entity}...`;
}

/**
 * Stream-based execution for real-time responses.
 * Returns an async generator that yields partial results.
 */
export async function* executeAICommandStream(
  userCommand: string,
  context: ExecutionContext,
  previousMessages: AIMessage[] = [],
  options: ExecuteAICommandOptions = {}
): AsyncGenerator<{
  type:
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "response_delta"
    | "response"
    | "confirmation_required";
  content: string;
  data?: unknown;
}> {
  const openAIKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const providerPref = (process.env.AI_PROVIDER || "").toLowerCase();
  const undoTracker = createUndoTracker();
  const toolCallsMade: ExecutionResult["toolCallsMade"] = [];
  const readOnlyAllowedWriteTools = new Set(options.allowedWriteTools ?? []);
  let autoUnstructuredFallbackUsed = false;
  const { hasMention: hasShopifyMention, cleanedCommand } = extractShopifyMention(userCommand);
  const commandForModel = cleanedCommand;

  // Track tool repeats to prevent infinite loops (streaming path)
  let lastToolSignature: string | null = null;
  let lastToolRepeatCount = 0;

  // Track consecutive errors per tool to prevent extensive retry loops (streaming path)
  const consecutiveErrorCount = new Map<string, number>();

  // Track empty argument calls to prevent infinite loops when LLM calls tools with no args (streaming path)
  const emptyArgCallCount = new Map<string, number>();
  let toolCallTokenBudget = TOOL_CALL_MAX_TOKENS;
  let toolCallLengthRetries = 0;
  let approvedWriteConsumed = false;

  if (!openAIKey && !deepseekKey) {
    yield {
      type: "response",
      content: "AI service is not configured.",
    };
    return;
  }

  // All chart creation is now handled by the LLM via tool calls
  // Removed all deterministic chart detection to prevent false positives

  let intent = applyContextualToolGroups(classifyIntent(commandForModel), context);
  const forcedToolGroups = new Set<ToolGroup>(options.forcedToolGroups ?? []);
  if (hasShopifyMention) {
    forcedToolGroups.add("shopify");
  }
  if (forcedToolGroups.size > 0) {
    const toolGroups = new Set<ToolGroup>(forcedToolGroups);
    toolGroups.add("core");
    intent = { ...intent, toolGroups: Array.from(toolGroups) };
  }
  const contextTableId = context.contextTableId;
  const contextBlockId = context.contextBlockId;
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
    "bulkUpdateRowsByFieldNames",
    "bulkDeleteRows",
    "bulkDuplicateRows",
    "updateTableRowsByFieldNames",
  ]);
  const blockIdTools = new Set(["updateBlock", "deleteBlock"]);

  // Handle approved write action - execute it directly without LLM
  if (options.approvedWriteAction && options.requireWriteConfirmation) {
    const approval = options.approvedWriteAction;
    const toolName = approval.request.tool;
    const toolArgs = approval.request.arguments ?? {};

    yield {
      type: "tool_call",
      content: getHumanFriendlyToolMessage(toolName),
      data: { tool: toolName, arguments: toolArgs },
    };

    const result = await executeTool(
      {
        name: toolName,
        arguments: toolArgs,
      },
      {
        workspaceId: context.workspaceId,
        userId: context.userId,
        contextTableId: context.contextTableId,
        contextBlockId: context.contextBlockId,
        currentTabId: context.currentTabId,
        currentProjectId: context.currentProjectId,
        undoTracker,
        authContext: context.authContext,
      }
    );

    toolCallsMade.push({ tool: toolName, arguments: toolArgs, result });

    yield {
      type: "tool_result",
      content: result.success ? "Done" : `Error: ${result.error ?? "Unknown error"}`,
      data: result,
    };

    const response = result.success
      ? "Action completed."
      : `Failed to complete action: ${result.error ?? "Unknown error"}`;

    yield {
      type: "response",
      content: response,
      data: {
        toolCallsMade,
        undoBatches: undoTracker.batches,
        undoSkippedTools: undoTracker.skippedTools,
      },
    };
    return;
  }

  // Fix A: Fast path — simple pattern-matched commands skip the LLM entirely
  if (!options.disableDeterministic && !options.requireWriteConfirmation) {
    const simpleResult = await tryDeterministicCommand(commandForModel, context);
    if (simpleResult) {
      yield {
        type: "response",
        content: simpleResult.response,
        data: simpleResult,
      };
      return;
    }
  }

  // Fix D: Detect multi-step commands to prevent premature early-exit on writes
  const isMultiStepCommand =
    /\b(?:and|then|also|after that|next)\b/i.test(commandForModel) ||
    intent.actions.length > 1;

  const promptMode = shouldUseFastPrompt(commandForModel, intent, []) ? "fast" : "full";
  const systemPrompt = getSystemPrompt({
    workspaceId: context.workspaceId,
    workspaceName: context.workspaceName,
    userId: context.userId,
    userName: context.userName,
    currentDate: new Date().toISOString().split("T")[0],
    currentProjectId: context.currentProjectId,
    currentTabId: context.currentTabId,
    activeToolGroups: intent.toolGroups,
  }, promptMode);

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...previousMessages,
    { role: "user", content: commandForModel },
  ];

  // Fix C: Narrow tools for single-action intents to reduce payload size
  const relevantTools = narrowToolsForSingleAction(
    trimToolsForIntent(getToolsByGroups(intent.toolGroups), intent, commandForModel),
    intent
  );
  const tools = toOpenAIFormat(relevantTools);
  const provider =
    providerPref === "deepseek"
      ? deepseekKey
        ? "deepseek"
        : "openai"
      : providerPref === "openai"
        ? openAIKey
          ? "openai"
          : "deepseek"
        : openAIKey
          ? "openai"
          : "deepseek";
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    yield {
      type: "thinking",
      content: iterations === 1 ? "Analyzing your request..." : "Processing...",
    };

    try {
      const hasToolResultsInConversation = messages.some((message) => message.role === "tool");
      const maxTokens = hasToolResultsInConversation
        ? FINAL_RESPONSE_MAX_TOKENS
        : toolCallTokenBudget;
      const timingEnabled = isAITimingEnabled();
      const llmStart = timingEnabled ? Date.now() : 0;
      const stream = streamChatCompletion({
        provider,
        apiKey: provider === "openai" ? (openAIKey as string) : (deepseekKey as string),
        messages,
        tools,
        maxTokens,
      });
      let streamedContent = "";
      let streamedToolCalls: AIToolCall[] | undefined;
      let streamedFinishReason: string | null = null;

      for await (const chunk of stream) {
        if (chunk.type === "delta" && chunk.content) {
          streamedContent += chunk.content;
          yield {
            type: "response_delta",
            content: chunk.content,
          };
        } else if (chunk.type === "done") {
          if (timingEnabled) {
            aiTiming({
              event: "llm_stream_complete",
              t_llm_stream_ms: Date.now() - llmStart,
            });
          }
          streamedContent = chunk.content || streamedContent;
          streamedToolCalls = chunk.toolCalls;
          streamedFinishReason = chunk.finishReason ?? null;
        }
      }

      if (
        !hasToolResultsInConversation &&
        streamedFinishReason === "length" &&
        (streamedToolCalls?.length ?? 0) > 0
      ) {
        const nextBudget = Math.min(
          Math.max(toolCallTokenBudget + 1024, Math.round(toolCallTokenBudget * 1.5)),
          TOOL_CALL_MAX_TOKENS_MAX
        );
        if (toolCallLengthRetries < TOOL_CALL_LENGTH_RETRY_LIMIT && nextBudget > toolCallTokenBudget) {
          aiDebug("executeAI:toolCallLengthRetry", {
            retry: toolCallLengthRetries + 1,
            fromMaxTokens: toolCallTokenBudget,
            toMaxTokens: nextBudget,
          });
          toolCallTokenBudget = nextBudget;
          toolCallLengthRetries += 1;
          continue;
        }
      } else {
        toolCallLengthRetries = 0;
      }

      const assistantMessage = streamedToolCalls
        ? { role: "assistant", content: null, tool_calls: streamedToolCalls }
        : { role: "assistant", content: streamedContent || "", tool_calls: undefined };

      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolCallsThisRound: Array<{ tool: string; result: ToolCallResult }> = [];
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;
          let parseFailure: string | null = null;
          let usedTruncateRepair = false;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);

            // Log what arguments the LLM provided
            if (Object.keys(toolArgs).length === 0) {
              aiDebug("executeAI:emptyArguments", {
                tool: toolName,
                iteration: iterations,
                rawArguments: toolCall.function.arguments,
                assistantContent: assistantMessage.content,
              });
            }
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            aiDebug("executeAI:jsonParseError", {
              tool: toolName,
              rawArguments: toolCall.function.arguments,
              parseError: errorMsg,
            });

            // Try to repair common JSON issues (like unquoted enum values)
            try {
              const repairedJSON = repairJSONArguments(toolCall.function.arguments);
              toolArgs = JSON.parse(repairedJSON);
              aiDebug("executeAI:jsonRepaired", {
                tool: toolName,
                original: toolCall.function.arguments,
                repaired: repairedJSON,
              });
            } catch (repairError) {
              // Last resort: trim incomplete tail and close open JSON structures.
              const repairedTruncated = repairTruncatedJSONArguments(toolCall.function.arguments);
              if (repairedTruncated) {
                try {
                  toolArgs = JSON.parse(repairedTruncated);
                  usedTruncateRepair = true;
                  aiDebug("executeAI:jsonTruncateRepaired", {
                    tool: toolName,
                    originalLength: toolCall.function.arguments.length,
                    repairedLength: repairedTruncated.length,
                  });
                } catch (truncatedParseError) {
                  const repairErrorMsg =
                    repairError instanceof Error ? repairError.message : String(repairError);
                  const truncatedParseErrorMsg =
                    truncatedParseError instanceof Error
                      ? truncatedParseError.message
                      : String(truncatedParseError);
                  parseFailure = `Failed to parse tool arguments JSON (${errorMsg}). Repair failed (${repairErrorMsg}). Truncate repair failed (${truncatedParseErrorMsg}).`;
                  toolArgs = {};
                }
              } else {
                const repairErrorMsg =
                  repairError instanceof Error ? repairError.message : String(repairError);
                parseFailure = `Failed to parse tool arguments JSON (${errorMsg}). Repair failed (${repairErrorMsg}).`;
                toolArgs = {};
              }
            }
          }

          // Never execute write tools with tail-truncated/repaired JSON.
          // This prevents partial inserts/updates when the model output was cut off.
          if (usedTruncateRepair && !isSearchLikeToolName(toolName) && !parseFailure) {
            const recovered = recoverWriteToolArgumentsAfterTruncation(toolName, toolArgs);
            if (recovered) {
              toolArgs = recovered.args;
              aiDebug("executeAI:jsonTruncateAccepted", {
                tool: toolName,
                strategy: recovered.strategy,
              });
            } else {
              aiDebug("executeAI:jsonTruncateRejected", {
                tool: toolName,
                reason: "truncated_repair_on_write_tool",
              });
              parseFailure =
                "Tool arguments were truncated and only partially repaired. Refusing to execute a write tool with potentially incomplete data. Retry with a smaller payload (fewer rows per call).";
            }
          }

          if (contextTableId && tableIdTools.has(toolName) && !("tableId" in toolArgs)) {
            toolArgs.tableId = contextTableId;
          }
          if (contextBlockId && blockIdTools.has(toolName) && !("blockId" in toolArgs)) {
            toolArgs.blockId = contextBlockId;
          }

          const isWriteTool = !isSearchLikeToolName(toolName);
          const needsConfirmation = requiresConfirmation(toolName);
          if (options.requireWriteConfirmation && isWriteTool && needsConfirmation && !parseFailure) {
            const approved = !approvedWriteConsumed && matchesApprovedWriteAction(
              toolName,
              toolArgs,
              options.approvedWriteAction
            );

            if (!approved) {
              const confirmation = await buildWriteConfirmationRequest(toolName, toolArgs);
              yield {
                type: "confirmation_required",
                content: confirmation.question,
                data: confirmation,
              };
              return;
            }

            approvedWriteConsumed = true;
          }

          yield {
            type: "tool_call",
            content: getHumanFriendlyToolMessage(toolName),
            data: { tool: toolName, arguments: toolArgs },
          };

          // IMPORTANT: If the LLM requests a write tool, allow it even in read-only mode
          // This handles cases where queries have both read and write intent that wasn't caught in classification
          // The LLM's tool choice becomes the authoritative signal of user intent
          if (options.readOnly && !isSearchLikeToolName(toolName) && !readOnlyAllowedWriteTools.has(toolName)) {
            // Allow the tool to be called - treat the LLM's request as authorization
            aiDebug("executeAICommand:readOnlyOverride", {
              tool: toolName,
              reason: "LLM requested write tool in read-only context - allowing as intent signal",
            });
            // Continue with tool execution instead of blocking
          }

          const result = parseFailure
            ? ({
              success: false,
              error: `${parseFailure} Ask the model to retry the tool call with valid JSON arguments.`,
            } as ToolCallResult)
            : await executeTool({
              name: toolName,
              arguments: toolArgs,
            }, {
              workspaceId: context.workspaceId,
              userId: context.userId,
              contextTableId: context.contextTableId,
              contextBlockId: context.contextBlockId,
              currentTabId: context.currentTabId,
              currentProjectId: context.currentProjectId,
              undoTracker,
              authContext: context.authContext,
            });

          toolCallsThisRound.push({ tool: toolName, result });
          toolCallsMade.push({ tool: toolName, arguments: toolArgs, result });

          // Track tool signature for repeat detection
          const toolSignature = `${toolName}:${JSON.stringify(toolArgs)}`;
          if (toolSignature === lastToolSignature) {
            lastToolRepeatCount += 1;
          } else {
            lastToolSignature = toolSignature;
            lastToolRepeatCount = 1;
          }

          // Check for repeated identical tool calls (prevent infinite loops)
          const isSearchLike = isSearchLikeToolName(toolName);
          if (!isSearchLike && lastToolRepeatCount >= TOOL_REPEAT_THRESHOLD) {
            yield {
              type: "response",
              content: result.success
                ? "Action completed. I stopped repeating the same tool call to prevent duplicates."
                : "An error occurred while executing the command.",
              data: {
                toolCallsMade,
                undoBatches: undoTracker.batches,
                undoSkippedTools: undoTracker.skippedTools,
                error: result.success ? undefined : result.error,
              },
            };
            return;
          }

          // Check for empty argument calls (potential infinite loop)
          const hasEmptyArgs = !toolArgs || Object.keys(toolArgs).length === 0;
          if (hasEmptyArgs && !result.success) {
            const emptyCallCount = (emptyArgCallCount.get(toolName) || 0) + 1;
            emptyArgCallCount.set(toolName, emptyCallCount);

            // Stop immediately on first empty-arg failure to prevent loops
            if (emptyCallCount >= 1) {
              // Provide actionable guidance based on tool type
              const toolGuidance = toolName.includes("Task") || toolName.includes("task")
                ? "Please specify which task block to use, or navigate to a page with a task block."
                : toolName.includes("Table") || toolName.includes("table") || toolName.includes("Row")
                  ? "Please specify which table to use, or navigate to a page with a table."
                  : "Please provide more specific details about what you'd like to do.";
              yield {
                type: "response",
                content: `I couldn't complete the ${toolName} action because required information was missing. ${toolGuidance}`,
                data: {
                  toolCallsMade,
                  undoBatches: undoTracker.batches,
                  undoSkippedTools: undoTracker.skippedTools,
                  error: "Missing required context or information",
                },
              };
              return;
            }
          } else if (!hasEmptyArgs || result.success) {
            emptyArgCallCount.set(toolName, 0);
          }

          // Track consecutive errors to prevent retry loops
          if (!result.success) {
            const currentErrors = (consecutiveErrorCount.get(toolName) || 0) + 1;
            consecutiveErrorCount.set(toolName, currentErrors);

            if (currentErrors >= 3) {
              yield {
                type: "response",
                content: `I'm having trouble with the ${toolName} tool. It failed ${currentErrors} times in a row. Error: ${result.error}`,
                data: {
                  toolCallsMade,
                  undoBatches: undoTracker.batches,
                  undoSkippedTools: undoTracker.skippedTools,
                  error: "Too many consecutive tool errors",
                },
              };
              return;
            }
          } else {
            consecutiveErrorCount.set(toolName, 0);
          }

          yield {
            type: "tool_result",
            content: result.success ? "Success" : result.error || "Error",
            data: result,
          };

          const compactedResult = COMPACT_TOOL_RESULTS ? compactToolResult(result) : result;
          messages.push({
            role: "tool",
            content: JSON.stringify(compactedResult),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }

        // Fix D: Early-exit after successful writes, but only for single-step commands.
        // Multi-step commands ("create X and assign to Y") must continue so the LLM
        // can issue the remaining tool calls.
        // Only exit when ALL tool calls actually succeeded (fix: was assuming success and reporting it even when tools failed).
        const allToolCallsSucceeded = toolCallsThisRound.every((c) => c.result.success);
        const hasWriteTool = toolCallsThisRound.some(
          (c) => !isSearchLikeToolName(c.tool)
        );
        if (
          !options.disableOptimisticEarlyExit &&
          EARLY_EXIT_WRITES &&
          SKIP_SECOND_LLM &&
          !isMultiStepCommand &&
          hasWriteTool &&
          allToolCallsSucceeded
        ) {
          const summary = buildToolSummary(toolCallsThisRound);
          yield {
            type: "response",
            content: summary,
            data: {
              toolCallsMade,
              undoBatches: undoTracker.batches,
              undoSkippedTools: undoTracker.skippedTools,
            },
          };
          return;
        }
        if (hasWriteTool && !allToolCallsSucceeded) {
          // At least one write failed — let the LLM see the tool results and generate a response that surfaces the error
          // (continue to next iteration so the model can reply with the error)
        }

        // Auto-fallback to unstructured search for semantic/knowledge queries
        const toolNamesThisRound = toolCallsThisRound.map((c) => c.tool);
        const onlySearchOps = toolNamesThisRound.every(isSearchLikeToolName);
        const structuredSearchesThisRound = toolCallsThisRound.filter((call) =>
          STRUCTURED_SEARCH_FALLBACK_TOOLS.has(call.tool)
        );
        const hasStructuredSearchThisRound = structuredSearchesThisRound.length > 0;
        const structuredSearchEmpty = structuredSearchesThisRound.every((call) =>
          isEmptySearchResult(call.result)
        );
        const semanticQuery = looksLikeSemanticQuery(commandForModel);
        const knowledgeQuery = looksLikeKnowledgeQuery(commandForModel);
        // Only count successful unstructured search calls, not blocked/failed attempts
        const unstructuredAlready =
          toolCallsThisRound.some((call) => call.tool === "unstructuredSearchWorkspace" && call.result.success) ||
          toolCallsMade.some((call) => call.tool === "unstructuredSearchWorkspace" && call.result.success);

        // Auto-fallback to unstructured search when:
        // 1. Only search operations were performed
        // 2. Structured searches returned empty OR query looks like knowledge/semantic query
        // 3. Haven't already used unstructured search
        // This is MORE AGGRESSIVE to ensure unstructured search is tried for semantic queries
        if (
          !autoUnstructuredFallbackUsed &&
          onlySearchOps &&
          hasStructuredSearchThisRound &&
          (structuredSearchEmpty || knowledgeQuery || semanticQuery) &&
          !unstructuredAlready &&
          commandForModel.trim().length >= 4
        ) {
          const autoToolArgs = { query: commandForModel };
          const autoToolCallId = `auto_unstructured_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          aiDebug("executeAICommandStream:autoUnstructuredFallback", {
            query: autoToolArgs.query,
            toolsAttempted: structuredSearchesThisRound.map((call) => call.tool),
            structuredSearchEmpty,
            knowledgeQuery,
            semanticQuery,
            readOnly: options.readOnly,
          });

          yield {
            type: "tool_call",
            content: "Searching workspace content...",
            data: { tool: "unstructuredSearchWorkspace", arguments: autoToolArgs },
          };

          const autoToolResult = await executeTool(
            { name: "unstructuredSearchWorkspace", arguments: autoToolArgs },
            {
              workspaceId: context.workspaceId,
              userId: context.userId,
              contextTableId: context.contextTableId,
              currentTabId: context.currentTabId,
              currentProjectId: context.currentProjectId,
              undoTracker,
              authContext: context.authContext,
            }
          );

          toolCallsMade.push({
            tool: "unstructuredSearchWorkspace",
            arguments: autoToolArgs,
            result: autoToolResult,
          });

          yield {
            type: "tool_result",
            content: autoToolResult.success ? "Found workspace content" : autoToolResult.error || "Error",
            data: autoToolResult,
          };

          const compactedForModel = COMPACT_TOOL_RESULTS ? compactToolResult(autoToolResult) : autoToolResult;
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: autoToolCallId,
                type: "function",
                function: {
                  name: "unstructuredSearchWorkspace",
                  arguments: JSON.stringify(autoToolArgs),
                },
              },
            ],
          });
          messages.push({
            role: "tool",
            content: JSON.stringify(compactedForModel),
            tool_call_id: autoToolCallId,
            name: "unstructuredSearchWorkspace",
          });

          autoUnstructuredFallbackUsed = true;
          continue;
        } else if (onlySearchOps && hasStructuredSearchThisRound && !unstructuredAlready) {
          // Log why auto-fallback was skipped
          aiDebug("executeAICommandStream:autoUnstructuredFallbackSkipped", {
            autoUnstructuredFallbackUsed,
            structuredSearchEmpty,
            knowledgeQuery,
            semanticQuery,
            commandLength: commandForModel.trim().length,
            reason: !structuredSearchEmpty && !knowledgeQuery && !semanticQuery
              ? "Query not semantic/knowledge-based and structured search had results"
              : commandForModel.trim().length < 4
                ? "Query too short"
                : "Unknown",
          });
        }

        continue;
      }

      // Auto-fallback when no search tools were called but query looks semantic
      const hasAnySearchTool = toolCallsMade.some((call) => isSearchLikeToolName(call.tool));
      const hasWriteIntent = intent.actions.some((a) => WRITE_ACTIONS.includes(a));
      if (
        !autoUnstructuredFallbackUsed &&
        !hasAnySearchTool &&
        !hasWriteIntent &&
        looksLikeSemanticQuery(commandForModel)
      ) {
        const autoToolArgs = { query: commandForModel };
        const autoToolCallId = `auto_unstructured_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        aiDebug("executeAICommandStream:autoUnstructuredNoSearch", {
          query: autoToolArgs.query,
        });

        yield {
          type: "tool_call",
          content: "Searching workspace content...",
          data: { tool: "unstructuredSearchWorkspace", arguments: autoToolArgs },
        };

        const autoToolResult = await executeTool(
          { name: "unstructuredSearchWorkspace", arguments: autoToolArgs },
          {
            workspaceId: context.workspaceId,
            userId: context.userId,
            contextTableId: context.contextTableId,
            currentTabId: context.currentTabId,
            currentProjectId: context.currentProjectId,
            undoTracker,
            authContext: context.authContext,
          }
        );

        toolCallsMade.push({
          tool: "unstructuredSearchWorkspace",
          arguments: autoToolArgs,
          result: autoToolResult,
        });

        yield {
          type: "tool_result",
          content: autoToolResult.success ? "Found workspace content" : autoToolResult.error || "Error",
          data: autoToolResult,
        };

        const compactedForModel = COMPACT_TOOL_RESULTS ? compactToolResult(autoToolResult) : autoToolResult;
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: autoToolCallId,
              type: "function",
              function: {
                name: "unstructuredSearchWorkspace",
                arguments: JSON.stringify(autoToolArgs),
              },
            },
          ],
        });
        messages.push({
          role: "tool",
          content: JSON.stringify(compactedForModel),
          tool_call_id: autoToolCallId,
          name: "unstructuredSearchWorkspace",
        });

        autoUnstructuredFallbackUsed = true;
        continue;
      }

      // Final response
      yield {
        type: "response",
        content: assistantMessage.content || "Done.",
        data: {
          toolCallsMade,
          undoBatches: undoTracker.batches,
          undoSkippedTools: undoTracker.skippedTools,
        },
      };
      return;
    } catch {
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

type StreamChatCompletionArgs = {
  provider: "openai" | "deepseek";
  apiKey: string;
  messages: AIMessage[];
  tools: ReturnType<typeof toOpenAIFormat>;
  maxTokens: number;
};

type StreamChatCompletionChunk =
  | { type: "delta"; content: string }
  | { type: "done"; content: string; toolCalls?: AIToolCall[]; finishReason?: string | null };

async function* streamChatCompletion({
  provider,
  apiKey,
  messages,
  tools,
  maxTokens,
}: StreamChatCompletionArgs): AsyncGenerator<StreamChatCompletionChunk> {
  const url = provider === "openai" ? OPENAI_API_URL : DEEPSEEK_API_URL;
  const model =
    provider === "openai"
      ? process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL
      : DEEPSEEK_MODEL;
  const resolvedMaxTokens = Number.isFinite(maxTokens) ? maxTokens : 4096;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        const base: Record<string, unknown> = {
          role: m.role,
          content: m.content,
          ...(m.tool_calls && { tool_calls: m.tool_calls }),
          ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
          ...(m.name && { name: m.name }),
        };

        if (provider === "deepseek" && m.role === "assistant") {
          const reasoning = (m as any).reasoning_content;
          base.reasoning_content = typeof reasoning === "string" ? reasoning : "";
        }

        return base;
      }),
      tools,
      tool_choice: "auto",
      parallel_tool_calls: true,
      temperature: 0.1,
      max_tokens: resolvedMaxTokens,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`${provider} API error: ${response.status} ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const contentParts: string[] = [];
  const toolCallAcc = new Map<number, AIToolCall>();
  let finishReason: string | null = null;

  const processSSELine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const choice = parsed?.choices?.[0];
    const delta = choice?.delta;
    if (typeof choice?.finish_reason === "string") {
      finishReason = choice.finish_reason;
    }
    if (!delta) return;

    if (typeof delta.content === "string" && delta.content.length > 0) {
      contentParts.push(delta.content);
    }

    const deltaToolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
    for (const toolCall of deltaToolCalls) {
      const index = typeof toolCall.index === "number" ? toolCall.index : 0;
      const existing = toolCallAcc.get(index) || {
        id: toolCall.id || "",
        type: "function" as const,
        function: { name: "", arguments: "" },
      };
      if (toolCall.id) existing.id = toolCall.id;
      if (toolCall.type) existing.type = toolCall.type;
      if (toolCall.function?.name) existing.function.name = toolCall.function.name;
      if (toolCall.function?.arguments) {
        existing.function.arguments += toolCall.function.arguments;
      }
      toolCallAcc.set(index, existing);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const beforeLen = contentParts.length;
      processSSELine(line);
      if (contentParts.length > beforeLen) {
        yield { type: "delta", content: contentParts[contentParts.length - 1] || "" };
      }
    }
  }

  // Flush decoder + trailing buffer (some providers omit final newline).
  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    const trailingLines = buffer.split("\n");
    for (const line of trailingLines) {
      const beforeLen = contentParts.length;
      processSSELine(line);
      if (contentParts.length > beforeLen) {
        yield { type: "delta", content: contentParts[contentParts.length - 1] || "" };
      }
    }
  }

  const toolCalls = Array.from(toolCallAcc.entries())
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call)
    .filter((call) => call.function?.name);

  if (toolCalls.length > 0) {
    yield { type: "done", content: "", toolCalls, finishReason };
    return;
  }

  yield { type: "done", content: contentParts.join(""), finishReason };
}
