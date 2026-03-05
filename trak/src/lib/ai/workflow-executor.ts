import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeAICommand, executeAICommandStream, type AIMessage, type ExecutionResult, type SearchManifest } from "@/lib/ai/executor";
import { aiDebug } from "@/lib/ai/debug";
import { createUndoTracker, type UndoBatch } from "@/lib/ai/undo";
import { getOrCreateWorkflowSession, addWorkflowMessage, getWorkflowSessionMessages, type WorkflowMessageRecord } from "@/app/actions/workflow-session";
import { createBlock, deleteBlock } from "@/app/actions/block";
import { executeTool } from "@/lib/ai/tool-executor";
import { searchTasks } from "@/app/actions/ai-search";
import { normalizeToChartRows } from "@/lib/charts/normalizeToChartRows";
import type { WriteConfirmationApproval } from "@/lib/ai/write-confirmation";

export interface WorkflowExecutionResult {
  success: boolean;
  response: string;
  toolCallsMade: ExecutionResult["toolCallsMade"];
  createdBlockIds: string[];
  sessionId: string;
  undoBatches?: UndoBatch[];
  undoSkippedTools?: string[];
  error?: string;
}

function safeTextFromContent(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function scrubInternalIdsFromResponse(text: string): string {
  if (!text) return "";

  const withoutKeyedIds = text.replace(
    /\b(?:blockId|tableId|sessionId|tabId|workspaceId|projectId|source_entity_id)\s*[:=]\s*[A-Za-z0-9_-]+\b/g,
    ""
  );
  const withoutUuids = withoutKeyedIds.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    ""
  );

  return withoutUuids
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract a compact search history context from recent workflow messages.
 * Walks backward through history and collects searchManifest data from the
 * last 5 assistant messages that had search results, paired with their
 * preceding user message for context.
 */
function buildSearchHistoryContext(
  history: WorkflowMessageRecord[]
): { searchHistory: string; hasSearchHistory: boolean } {
  const manifests: Array<{
    userQuery: string;
    manifest: SearchManifest;
  }> = [];

  // Walk backward through history to find assistant messages with search manifests
  for (let i = history.length - 1; i >= 0 && manifests.length < 5; i--) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;

    const content = msg.content as Record<string, unknown> | null;
    if (!content?.searchManifest) continue;

    const manifest = content.searchManifest as SearchManifest;
    if (!manifest.entities || manifest.entities.length === 0) continue;

    // Find the preceding user message
    let userQuery = "(unknown query)";
    for (let j = i - 1; j >= 0; j--) {
      if (history[j].role === "user") {
        userQuery = safeTextFromContent(history[j].content);
        break;
      }
    }

    manifests.push({ userQuery, manifest });
  }

  if (manifests.length === 0) {
    aiDebug("sourceTracking:searchHistoryContext", {
      result: "none",
      historyLength: history.length,
      assistantMessagesScanned: history.filter((m) => m.role === "assistant").length,
    });
    return { searchHistory: "", hasSearchHistory: false };
  }

  // Build compact text — reverse so oldest is first
  manifests.reverse();
  const totalEntities = manifests.reduce((sum, m) => sum + m.manifest.entities.length, 0);
  aiDebug("sourceTracking:searchHistoryContext", {
    result: "found",
    manifestCount: manifests.length,
    totalEntities,
    turns: manifests.map((m) => ({
      query: m.userQuery.slice(0, 80),
      tools: m.manifest.searchTools,
      entityCount: m.manifest.entities.length,
    })),
  });
  const sections = manifests.map((m, idx) => {
    const entityLines = m.manifest.entities.map(
      (e) => `  - "${e.title}" (${e.entityType}, id: ${e.id})`
    );
    return `--- Search ${idx + 1} (user asked: "${m.userQuery.slice(0, 120)}") ---\nSearched via: ${m.manifest.searchTools.join(", ")}\nEntities found:\n${entityLines.join("\n")}`;
  });

  const searchHistory = `\n\n---\n📋 SOURCE ID REFERENCE — PRIOR TURNS ONLY (do NOT skip tool calls)\nThe entities below were found in PREVIOUS conversation turns, NOT in the current request. This section exists solely so you can supply the correct source_entity_id, source_entity_type, and source_sync_mode when you create table rows that map to these entities. You MUST still call the appropriate tools (searchTasks, createTableFull, etc.) to fulfill the current user request. Do NOT treat this reference as a substitute for tool use — always call tools first.\nIf you are creating NEW, summarized, or derived content that does NOT directly correspond to a specific entity below, do NOT include source metadata for that item.\n\n${sections.join("\n\n")}`;

  return { searchHistory, hasSearchHistory: true };
}

/**
 * Extract all searched entities from recent workflow messages to seed
 * the executor's searchedEntities array for deterministic title matching.
 */
function extractInitialSearchedEntities(
  history: WorkflowMessageRecord[]
): SearchManifest["entities"] {
  const entities: SearchManifest["entities"] = [];
  const seenIds = new Set<string>();

  // Collect from last 5 assistant messages with manifests (same window as buildSearchHistoryContext)
  let count = 0;
  for (let i = history.length - 1; i >= 0 && count < 5; i--) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;

    const content = msg.content as Record<string, unknown> | null;
    if (!content?.searchManifest) continue;

    const manifest = content.searchManifest as SearchManifest;
    if (!manifest.entities || manifest.entities.length === 0) continue;

    count++;
    for (const entity of manifest.entities) {
      if (!seenIds.has(entity.id)) {
        seenIds.add(entity.id);
        entities.push(entity);
      }
    }
  }

  if (entities.length > 0) {
    aiDebug("sourceTracking:initialSearchedEntities", {
      count: entities.length,
      titles: entities.map((e) => e.title),
    });
  }

  return entities;
}

function extractCreatedBlockIds(toolCallsMade: ExecutionResult["toolCallsMade"]): string[] {
  const ids: string[] = [];
  for (const call of toolCallsMade || []) {
    if (!call?.result?.success) continue;
    const tool = call.tool;
    if (!["createBlock", "createSpecChartBlock", "createTaskBoardFromTasks", "createTableFull", "createTable"].includes(tool)) continue;
    const data = call.result.data;
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    if (tool === "createTableFull") {
      const blockId = obj?.blockId;
      if (typeof blockId === "string" && blockId.length > 0) ids.push(blockId);
      continue;
    }
    if (tool === "createTable") {
      // createTable returns { block: { id } } when a block is created
      const block = obj?.block;
      const blockId = (block && typeof block === "object" && "id" in block && typeof block.id === "string")
        ? block.id
        : (typeof obj?.blockId === "string" ? obj.blockId : null);
      if (blockId) ids.push(blockId);
      continue;
    }
    if (tool === "createSpecChartBlock") {
      const blockId = typeof obj?.blockId === "string" ? obj.blockId : null;
      if (blockId) ids.push(blockId);
      continue;
    }

    const id = obj?.id;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  return Array.from(new Set(ids));
}

function extractCreatedTextBlockIds(toolCallsMade: ExecutionResult["toolCallsMade"]): string[] {
  const ids: string[] = [];
  for (const call of toolCallsMade || []) {
    if (!call?.result?.success || call.tool !== "createBlock") continue;
    const args = call.arguments && typeof call.arguments === "object"
      ? (call.arguments as Record<string, unknown>)
      : null;
    if (args?.type !== "text") continue;
    const data = call.result.data && typeof call.result.data === "object"
      ? (call.result.data as Record<string, unknown>)
      : null;
    const id = data?.id;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  return Array.from(new Set(ids));
}

function pruneUndoBatchesForDeletedBlocks(batches: UndoBatch[], deletedBlockIds: string[]): UndoBatch[] {
  if (deletedBlockIds.length === 0 || batches.length === 0) return batches;
  const deletedSet = new Set(deletedBlockIds);
  const pruned: UndoBatch[] = [];

  for (const batch of batches) {
    const nextBatch: UndoBatch = [];
    for (const step of batch) {
      if (step.table !== "blocks") {
        nextBatch.push(step);
        continue;
      }

      if (step.action === "delete" && Array.isArray(step.ids)) {
        const remainingIds = step.ids.filter((id) => !deletedSet.has(id));
        if (remainingIds.length === 0) continue;
        nextBatch.push({ ...step, ids: remainingIds });
        continue;
      }

      if (step.action === "upsert") {
        const remainingRows = step.rows.filter((row) => {
          const rowId = row?.id;
          return !(typeof rowId === "string" && deletedSet.has(rowId));
        });
        if (remainingRows.length === 0) continue;
        nextBatch.push({ ...step, rows: remainingRows });
        continue;
      }

      nextBatch.push(step);
    }

    if (nextBatch.length > 0) pruned.push(nextBatch);
  }

  return pruned;
}

function formatDateYYYYMMDD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdueQuery(command: string) {
  return /\b(overdue|overd?ue|overdude|past due|late)\b/i.test(command);
}

function mentionsTasks(text: string) {
  return /\b(task|tasks|overdue|todo|to-do|backlog)\b/i.test(text);
}

function hasMutationVerb(text: string) {
  return /\b(update|edit|change|set|mark|complete|close|reopen|assign|unassign|delete|remove|move|rename|archive|unarchive|duplicate|reschedule|postpone|defer|snooze|prioritiz|deprioritiz|reorder|reassign|convert|merge|split|done)\b/i.test(
    text
  );
}

function isTaskMutationCommand(command: string, historyText: string) {
  const cmd = command.toLowerCase();
  if (/\b(create|add|new)\s+task\b/.test(cmd)) return true;
  if (hasMutationVerb(cmd) && mentionsTasks(cmd)) return true;
  if (hasMutationVerb(cmd) && /\b(them|those|these|all)\b/i.test(cmd) && mentionsTasks(historyText)) {
    return true;
  }
  return false;
}

function isExplicitEntityMutationCommand(command: string) {
  const cmd = command.toLowerCase();
  const verb = /\b(create|update|delete|archive|unarchive|rename|move|copy|duplicate)\b/;
  const entity = /\b(table|project|client|tab|document|doc|file|folder|workspace)\b/;
  return verb.test(cmd) && entity.test(cmd);
}

function shouldPersistAssistantAsTextBlock(command: string) {
  const normalized = command.toLowerCase().trim();
  const asksQuestion = /\?$/.test(normalized) || /^(what|which|who|when|where|why|how|can you|could you|do we|is there|are there|show me)\b/.test(normalized);
  const explicitArtifactIntent = /\b(add|save|write|draft|create|generate|make|prepare|summari[sz]e|document)\b/.test(normalized)
    && /\b(report|summary|brief|plan|notes?|doc(?:ument)?|proposal|outline|strategy|spec|checklist|sop|memo|analysis|writeup|text block|artifact)\b/.test(normalized);
  const explicitPageIntent = /\b(on|to|into)\s+(this|the)\s+(page|workflow|canvas|doc(?:ument)?)\b/.test(normalized)
    || /\b(add|put|save)\s+(it|this|that)\s+(on|to|into)\s+(this|the)?\s*(page|workflow|canvas|doc(?:ument)?)\b/.test(normalized);
  return !asksQuestion && (explicitArtifactIntent || explicitPageIntent);
}


async function resolveLatestTableContext(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tabId: string;
  history: Array<{ created_block_ids?: string[] }>;
}) {
  for (let i = params.history.length - 1; i >= 0; i -= 1) {
    const ids = params.history[i]?.created_block_ids ?? [];
    if (!ids || ids.length === 0) continue;
    const { data: blocks } = await params.supabase
      .from("blocks")
      .select("id, type, content")
      .in("id", ids);
    const tableBlock = (blocks || []).find((block) => block.type === "table");
    if (tableBlock) {
      const tableId = (tableBlock.content as Record<string, unknown> | null)?.tableId as string | undefined;
      if (tableId) {
        return { tableId, blockId: tableBlock.id };
      }
    }
  }

  const { data: latestTable } = await params.supabase
    .from("blocks")
    .select("id, content")
    .eq("tab_id", params.tabId)
    .eq("type", "table")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tableId = (latestTable?.content as Record<string, unknown> | null)?.tableId as string | undefined;
  if (tableId && latestTable?.id) {
    return { tableId, blockId: latestTable.id };
  }

  return { tableId: undefined, blockId: undefined };
}

async function resolveLatestBlockContext(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tabId: string;
  history: Array<{ created_block_ids?: string[] }>;
}): Promise<{
  blockId?: string;
  blockType?: string;
  chartContent?: { spec: Record<string, unknown>; rows: Array<Record<string, unknown>>; universeTotal?: number };
}> {
  for (let i = params.history.length - 1; i >= 0; i -= 1) {
    const ids = params.history[i]?.created_block_ids ?? [];
    if (!ids || ids.length === 0) continue;
    const orderedIds = [...ids].reverse();
    const { data: blocks } = await params.supabase
      .from("blocks")
      .select("id, type, content")
      .in("id", orderedIds);
    if (!blocks || blocks.length === 0) continue;
    const byId = new Map(blocks.map((block) => [block.id, block]));
    for (const id of orderedIds) {
      const block = byId.get(id);
      if (block) {
        const content = block.content as Record<string, unknown> | null;
        const chartContent =
          block.type === "chart" &&
          content &&
          typeof content.spec === "object" &&
          Array.isArray(content.rows)
            ? {
                spec: content.spec as Record<string, unknown>,
                rows: content.rows as Array<Record<string, unknown>>,
                universeTotal: typeof content.universeTotal === "number" ? content.universeTotal : undefined,
              }
            : undefined;
        return {
          blockId: block.id as string,
          blockType: block.type as string,
          chartContent,
        };
      }
    }
  }

  const { data: latestBlock } = await params.supabase
    .from("blocks")
    .select("id, type, content")
    .eq("tab_id", params.tabId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBlock?.id) {
    const content = (latestBlock as { content?: Record<string, unknown> }).content;
    const chartContent =
      latestBlock.type === "chart" &&
      content &&
      typeof content.spec === "object" &&
      Array.isArray(content.rows)
        ? {
            spec: content.spec as Record<string, unknown>,
            rows: content.rows as Array<Record<string, unknown>>,
            universeTotal: typeof content.universeTotal === "number" ? content.universeTotal : undefined,
          }
        : undefined;
    return {
      blockId: latestBlock.id as string,
      blockType: latestBlock.type as string,
      chartContent,
    };
  }

  return { blockId: undefined, blockType: undefined };
}

function extractAssigneeIds(task: Record<string, unknown>): string[] | null {
  const assignees = task.assignees;
  if (!Array.isArray(assignees) || assignees.length === 0) return null;
  const ids: string[] = [];
  for (const entry of assignees) {
    if (entry && typeof entry === "object" && "id" in entry && typeof entry.id === "string") {
      ids.push(entry.id);
    }
  }
  return ids.length > 0 ? ids : null;
}

function extractFirstTaskPriority(task: Record<string, unknown>): unknown {
  const priorities = task.priorities;
  if (Array.isArray(priorities) && priorities.length > 0) {
    return (priorities[0] as Record<string, unknown> | undefined)?.value ?? task.priority;
  }
  return task.priority;
}

function coerceTaskRows(tasks: Array<Record<string, unknown>>) {
  return tasks.map((task) => ({
    source_entity_type: "task",
    source_entity_id: typeof task.id === "string" ? task.id : undefined,
    source_sync_mode: "live",
    data: {
      "Task Title": String(task.title || ""),
      Status: normalizeTaskStatusForTable(task.status),
      Priority: normalizeTaskPriorityForTable(extractFirstTaskPriority(task)),
      "Due Date": toDateOnly(task.due_date),
      Assignee: extractAssigneeIds(task),
      Project: String(task.project_name || ""),
      Tab: String(task.tab_name || ""),
    },
  }));
}

function normalizeTaskStatusForTable(value: unknown): "todo" | "in_progress" | "done" | "blocked" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["todo", "to_do", "to-do", "to do", "not_started", "not-started", "not started"].includes(raw)) return "todo";
  if (["in_progress", "in-progress", "in progress", "doing", "working"].includes(raw)) return "in_progress";
  if (["done", "complete", "completed"].includes(raw)) return "done";
  if (["blocked", "on_hold", "on-hold", "on hold"].includes(raw)) return "blocked";
  return null;
}

function normalizeTaskPriorityForTable(value: unknown): "low" | "medium" | "high" | "urgent" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["low"].includes(raw)) return "low";
  if (["medium", "med"].includes(raw)) return "medium";
  if (["high"].includes(raw)) return "high";
  if (["urgent", "critical"].includes(raw)) return "urgent";
  return null;
}

function toDateOnly(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateYYYYMMDD(parsed);
}

function coerceTaskRowsForWorkflowFallback(tasks: Array<Record<string, unknown>>) {
  return tasks.map((task) => ({
    source_entity_type: "task",
    source_entity_id: typeof task.id === "string" ? task.id : undefined,
    source_sync_mode: "live",
    data: {
      "Task Title": String(task.title || ""),
      Status: normalizeTaskStatusForTable(task.status),
      Priority: normalizeTaskPriorityForTable(extractFirstTaskPriority(task)),
      "Due Date": toDateOnly(task.due_date),
      Assignee: extractAssigneeIds(task),
      Project: String(task.project_name || ""),
      Tab: String(task.tab_name || ""),
      "Created At": toDateOnly(task.created_at),
      "Updated At": toDateOnly(task.updated_at),
    },
  }));
}

function pruneEmptyColumnsForRows(
  fields: Array<{ name: string; type: string; config?: Record<string, unknown>; isPrimary?: boolean }>,
  rows: Array<{ data?: Record<string, unknown> }>
): Array<{ name: string; type: string; config?: Record<string, unknown>; isPrimary?: boolean }> {
  if (fields.length === 0 || rows.length === 0) return fields;

  const isEmptyValue = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  const kept = fields.filter((field) => {
    if (field.isPrimary) return true;
    return rows.some((row) => !isEmptyValue((row.data || {})[field.name]));
  });

  return kept.length > 0 ? kept : [fields[0]];
}

function extractTaskAssigneeFromCommand(command: string): string | null {
  const m = command.match(/\bassigned to\s+([a-z0-9 _.'-]+)/i);
  if (!m?.[1]) return null;
  return m[1].trim() || null;
}

function buildFallbackTaskTableTitle(command: string, count: number): string {
  const assignee = extractTaskAssigneeFromCommand(command);
  if (assignee) return `Tasks Assigned to ${assignee} (${count})`;
  return `Tasks (${count})`;
}

const CHART_FALLBACK_MAX_ROWS = 500;

function hasCreateTableTruncationFailure(toolCalls: ExecutionResult["toolCallsMade"]): boolean {
  return (toolCalls || []).some((call) => (
    call?.tool === "createTableFull" &&
    !call?.result?.success &&
    typeof call?.result?.error === "string" &&
    call.result.error.toLowerCase().includes("truncated")
  ));
}

function hasCreateSpecChartTruncationFailure(toolCalls: ExecutionResult["toolCallsMade"]): boolean {
  return (toolCalls || []).some((call) => (
    call?.tool === "createSpecChartBlock" &&
    !call?.result?.success &&
    typeof call?.result?.error === "string" &&
    call.result.error.toLowerCase().includes("truncated")
  ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecordArray(values: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(values)) return [];
  return values.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}

function normalizeCellValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toTabularRecords(values: unknown[]): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  for (const value of values) {
    if (!isRecord(value)) continue;
    const row: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (!key || key === "__typename") continue;
      const normalized = normalizeCellValue(raw);
      row[key] = normalized;
    }
    if (Object.keys(row).length > 0) {
      records.push(row);
    }
  }
  return records;
}

function inferFieldTypeForFallback(values: Array<unknown>): "text" | "long_text" {
  const maxLen = values.reduce<number>((acc, value) => {
    const len = typeof value === "string" ? value.length : String(value ?? "").length;
    return Math.max(acc, len);
  }, 0);
  return maxLen > 180 ? "long_text" : "text";
}

function buildFieldsFromRecords(records: Array<Record<string, unknown>>): Array<{ name: string; type: "text" | "long_text" }> {
  const keyOrder: string[] = [];
  const seen = new Set<string>();
  for (const row of records) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      keyOrder.push(key);
    }
  }
  const limitedKeys = keyOrder.slice(0, 20);
  return limitedKeys.map((key) => {
    const values = records.map((row) => row[key]);
    return {
      name: key,
      type: inferFieldTypeForFallback(values),
    };
  });
}

function mapRecordsToRows(
  records: Array<Record<string, unknown>>,
  fields: Array<{ name: string; type: "text" | "long_text" }>
) {
  const fieldNames = fields.map((field) => field.name);
  return records.map((record) => {
    const data: Record<string, unknown> = {};
    for (const name of fieldNames) {
      data[name] = name in record ? record[name] : null;
    }
    return { data };
  });
}

function getLatestSearchDatasetForFallback(
  toolCalls: ExecutionResult["toolCallsMade"]
): { sourceTool: string; rows: Array<Record<string, unknown>> } | null {
  for (let i = (toolCalls || []).length - 1; i >= 0; i -= 1) {
    const call = toolCalls[i];
    if (!call?.result?.success) continue;
    if (typeof call.tool !== "string" || !call.tool.toLowerCase().startsWith("search")) continue;
    if (!Array.isArray(call.result.data)) continue;
    const rows = toTabularRecords(call.result.data as unknown[]);
    if (rows.length === 0) continue;
    return { sourceTool: call.tool, rows };
  }
  return null;
}

type ChartFallbackSearchTool =
  | "searchTasks"
  | "searchTimelineEvents"
  | "searchTableRows"
  | "searchSubtasks";

type ChartFallbackDataset = {
  sourceTool: ChartFallbackSearchTool;
  sourceArgs: Record<string, unknown>;
  rawResults: Array<Record<string, unknown>>;
};

function getLatestChartSearchDatasetForFallback(
  toolCalls: ExecutionResult["toolCallsMade"]
): ChartFallbackDataset | null {
  for (let i = (toolCalls || []).length - 1; i >= 0; i -= 1) {
    const call = toolCalls[i];
    if (!call?.result?.success || !Array.isArray(call.result.data)) continue;
    const sourceTool = call.tool as string;
    if (
      sourceTool !== "searchTasks" &&
      sourceTool !== "searchTimelineEvents" &&
      sourceTool !== "searchTableRows" &&
      sourceTool !== "searchSubtasks"
    ) {
      continue;
    }

    const rawResults = asRecordArray(call.result.data);
    if (rawResults.length === 0) continue;

    return {
      sourceTool,
      sourceArgs: isRecord(call.arguments) ? call.arguments : {},
      rawResults,
    };
  }

  return null;
}

function getLatestFailedCreateSpecChartArgs(
  toolCalls: ExecutionResult["toolCallsMade"]
): Record<string, unknown> | null {
  for (let i = (toolCalls || []).length - 1; i >= 0; i -= 1) {
    const call = toolCalls[i];
    if (call?.tool !== "createSpecChartBlock") continue;
    if (call?.result?.success) continue;
    if (
      typeof call?.result?.error !== "string" ||
      !call.result.error.toLowerCase().includes("truncated")
    ) {
      continue;
    }
    if (!isRecord(call.arguments)) continue;
    return call.arguments;
  }
  return null;
}

function normalizeSubtaskStatusForChart(statusValue: unknown, completedValue: unknown): string | undefined {
  const normalized = normalizeTaskStatusForTable(statusValue);
  if (normalized) return normalized;
  if (typeof completedValue === "boolean") return completedValue ? "done" : "todo";
  return undefined;
}

function buildTaskSubtaskChartRows(tasks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  for (const task of tasks) {
    const taskId = typeof task.id === "string" && task.id.length > 0 ? task.id : "task";
    const taskTitle = typeof task.title === "string" ? task.title : "";
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];

    for (let i = 0; i < subtasks.length; i += 1) {
      const subtask = subtasks[i];
      if (!isRecord(subtask)) continue;

      const id = typeof subtask.id === "string" && subtask.id.length > 0
        ? subtask.id
        : `${taskId}__subtask_${i + 1}`;
      const title = typeof subtask.title === "string" && subtask.title.trim().length > 0
        ? subtask.title
        : taskTitle || `Subtask ${i + 1}`;

      const row: Record<string, unknown> = {
        id,
        "Task Title": title,
        type: "subtask",
        parentTaskId: taskId,
      };

      const status = normalizeSubtaskStatusForChart(subtask.status, subtask.completed);
      const priority = normalizeTaskPriorityForTable(subtask.priority);
      const dueDate = toDateOnly(subtask.due_date);

      if (status) row.status = status;
      if (priority) row.priority = priority;
      if (dueDate) row["Due Date"] = dueDate;
      if (taskTitle) row.parentTaskTitle = taskTitle;

      rows.push(row);
    }
  }

  return rows;
}

function buildStandaloneSubtaskChartRows(subtasks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < subtasks.length; i += 1) {
    const subtask = subtasks[i];
    const id = typeof subtask.id === "string" && subtask.id.length > 0
      ? subtask.id
      : `subtask_${i + 1}`;
    const title = typeof subtask.title === "string" && subtask.title.trim().length > 0
      ? subtask.title
      : typeof subtask.task_title === "string"
        ? subtask.task_title
        : `Subtask ${i + 1}`;

    const row: Record<string, unknown> = {
      id,
      "Task Title": title,
      type: "subtask",
    };

    const status = normalizeSubtaskStatusForChart(subtask.status, subtask.completed);
    const priority = normalizeTaskPriorityForTable(subtask.priority);
    const dueDate = toDateOnly(subtask.due_date);

    if (status) row.status = status;
    if (priority) row.priority = priority;
    if (dueDate) row["Due Date"] = dueDate;

    if (typeof subtask.task_id === "string" && subtask.task_id.length > 0) {
      row.parentTaskId = subtask.task_id;
    }
    if (typeof subtask.task_title === "string" && subtask.task_title.length > 0) {
      row.parentTaskTitle = subtask.task_title;
    }

    rows.push(row);
  }

  return rows;
}

function dedupeChartRowsById(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    let id = typeof row.id === "string" && row.id.length > 0 ? row.id : `row_${out.length + 1}`;
    if (seen.has(id)) {
      let suffix = 2;
      while (seen.has(`${id}__${suffix}`)) {
        suffix += 1;
      }
      id = `${id}__${suffix}`;
    }
    seen.add(id);
    out.push({ ...row, id });
  }

  return out;
}

function buildChartRowsFromFallbackDataset(dataset: ChartFallbackDataset): Array<Record<string, unknown>> {
  switch (dataset.sourceTool) {
    case "searchTasks": {
      const taskRows = normalizeToChartRows("tasks", dataset.rawResults) as Array<Record<string, unknown>>;
      const includeSubtasks = dataset.sourceArgs.includeSubtasks === true;
      const subtaskRows = includeSubtasks ? buildTaskSubtaskChartRows(dataset.rawResults) : [];
      return dedupeChartRowsById([...taskRows, ...subtaskRows]);
    }
    case "searchTimelineEvents":
      return dedupeChartRowsById(
        normalizeToChartRows("timeline_events", dataset.rawResults) as Array<Record<string, unknown>>
      );
    case "searchTableRows":
      return dedupeChartRowsById(
        normalizeToChartRows("table_rows", dataset.rawResults) as Array<Record<string, unknown>>
      );
    case "searchSubtasks":
      return dedupeChartRowsById(buildStandaloneSubtaskChartRows(dataset.rawResults));
    default:
      return [];
  }
}

function hasNonEmptyChartField(rows: Array<Record<string, unknown>>, field: string): boolean {
  for (const row of rows) {
    const value = row[field];
    if (Array.isArray(value)) {
      if (value.length > 0) return true;
      continue;
    }
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    return true;
  }
  return false;
}

function inferFallbackBreakdownField(
  rows: Array<Record<string, unknown>>,
  preferred?: string
): string {
  const preferredField = typeof preferred === "string" ? preferred.trim() : "";
  if (preferredField && hasNonEmptyChartField(rows, preferredField)) {
    return preferredField;
  }

  const candidates = ["status", "priority", "assignee", "tags", "type", "Task Title", "title"];
  for (const candidate of candidates) {
    if (hasNonEmptyChartField(rows, candidate)) return candidate;
  }

  for (const row of rows) {
    for (const [key] of Object.entries(row)) {
      if (key === "id") continue;
      if (hasNonEmptyChartField(rows, key)) return key;
    }
  }

  return "status";
}

function buildFallbackChartSpec(
  specCandidate: unknown,
  rows: Array<Record<string, unknown>>
): Record<string, unknown> {
  const base = isRecord(specCandidate) ? { ...specCandidate } : {};
  const existingBreakdown = isRecord(base.breakdown) ? base.breakdown : {};
  const preferredBreakdownField = typeof existingBreakdown.field === "string" ? existingBreakdown.field : undefined;
  const breakdownField = inferFallbackBreakdownField(rows, preferredBreakdownField);

  const chartType = typeof base.chartType === "string" && ["pie", "doughnut", "bar"].includes(base.chartType)
    ? base.chartType
    : "pie";
  const normalizeTo = typeof base.normalizeTo === "string" && ["focus", "universe"].includes(base.normalizeTo)
    ? base.normalizeTo
    : "focus";
  const sort = typeof base.sort === "string" && ["value_desc", "value_asc", "label_asc", "label_desc"].includes(base.sort)
    ? base.sort
    : "value_desc";

  const measureBase = isRecord(base.measure) ? base.measure : {};
  const measureType = typeof measureBase.type === "string" ? measureBase.type : "count";
  const measure =
    measureType === "count"
      ? { type: "count" }
      : (measureType === "sum" || measureType === "avg") && typeof measureBase.field === "string" && measureBase.field.trim().length > 0
        ? { type: measureType, field: measureBase.field.trim() }
        : { type: "count" };

  const spec: Record<string, unknown> = {
    version: 1,
    chartType,
    breakdown: { field: breakdownField },
    measure,
    normalizeTo,
    sort,
  };

  if (typeof existingBreakdown.fieldLabel === "string" && existingBreakdown.fieldLabel.trim().length > 0) {
    spec.breakdown = { ...(spec.breakdown as Record<string, unknown>), fieldLabel: existingBreakdown.fieldLabel };
  }

  if (isRecord(base.series) && typeof base.series.field === "string" && base.series.field.trim().length > 0) {
    const series: Record<string, unknown> = { field: base.series.field.trim() };
    if (typeof base.series.fieldLabel === "string" && base.series.fieldLabel.trim().length > 0) {
      series.fieldLabel = base.series.fieldLabel;
    }
    spec.series = series;
  }

  if (chartType === "bar" && typeof base.orientation === "string" && ["horizontal", "vertical"].includes(base.orientation)) {
    spec.orientation = base.orientation;
  }
  if ((chartType === "pie" || chartType === "doughnut") && typeof base.pieComposition === "string" && ["breakdownOnly", "focusPlusRest"].includes(base.pieComposition)) {
    spec.pieComposition = base.pieComposition;
  }
  if (typeof base.restLabel === "string" && base.restLabel.trim().length > 0) {
    spec.restLabel = base.restLabel;
  }
  if (typeof base.topN === "number" && Number.isInteger(base.topN) && base.topN > 0) {
    spec.topN = base.topN;
  }
  if (typeof base.includeOtherBucket === "boolean") {
    spec.includeOtherBucket = base.includeOtherBucket;
  }
  if (typeof base.otherLabel === "string" && base.otherLabel.trim().length > 0) {
    spec.otherLabel = base.otherLabel;
  }
  if (typeof base.title === "string" && base.title.trim().length > 0) {
    spec.title = base.title;
  }
  if (typeof base.valueLabel === "string" && base.valueLabel.trim().length > 0) {
    spec.valueLabel = base.valueLabel;
  }
  if (typeof base.labelLabel === "string" && base.labelLabel.trim().length > 0) {
    spec.labelLabel = base.labelLabel;
  }

  return spec;
}

function inferChartDataSourceFromFallbackDataset(
  dataset: ChartFallbackDataset
): Record<string, unknown> | undefined {
  if (dataset.sourceTool === "searchSubtasks") return undefined;

  const type =
    dataset.sourceTool === "searchTasks"
      ? "tasks"
      : dataset.sourceTool === "searchTimelineEvents"
        ? "timeline_events"
        : dataset.sourceTool === "searchTableRows"
          ? "table_rows"
          : null;
  if (!type) return undefined;

  return {
    mode: "refreshable",
    scope: "query",
    query: {
      type,
      params: dataset.sourceArgs,
    },
  };
}

async function createSearchFallbackChart(params: {
  workspaceId: string;
  projectId?: string;
  tabId: string;
  command: string;
  toolCalls: ExecutionResult["toolCallsMade"];
  userId: string;
  undoTracker?: ReturnType<typeof createUndoTracker>;
}): Promise<{ blockId?: string; sourceTool: string; rowCount: number; omittedRows: number } | null> {
  const failedArgs = getLatestFailedCreateSpecChartArgs(params.toolCalls);
  const dataset = getLatestChartSearchDatasetForFallback(params.toolCalls);
  if (!failedArgs || !dataset) return null;

  const fallbackRows = buildChartRowsFromFallbackDataset(dataset);
  if (fallbackRows.length === 0) return null;

  const cappedRows = fallbackRows.slice(0, CHART_FALLBACK_MAX_ROWS);
  const omittedRows = Math.max(0, fallbackRows.length - cappedRows.length);
  const fallbackSpec = buildFallbackChartSpec(failedArgs.spec, cappedRows);

  const toolArgs: Record<string, unknown> = {
    tabId: params.tabId,
    spec: fallbackSpec,
    rows: cappedRows,
    prompt: typeof failedArgs.prompt === "string" ? failedArgs.prompt : params.command,
  };

  if (typeof failedArgs.title === "string" && failedArgs.title.trim().length > 0) {
    toolArgs.title = failedArgs.title;
  }
  if (typeof failedArgs.universeTotal === "number" && Number.isFinite(failedArgs.universeTotal)) {
    toolArgs.universeTotal = failedArgs.universeTotal;
  }
  if (typeof failedArgs.isSimulation === "boolean") {
    toolArgs.isSimulation = failedArgs.isSimulation;
  }
  if (typeof failedArgs.originalChartId === "string" && failedArgs.originalChartId.trim().length > 0) {
    toolArgs.originalChartId = failedArgs.originalChartId;
  }
  if (
    typeof failedArgs.simulationDescription === "string" &&
    failedArgs.simulationDescription.trim().length > 0
  ) {
    toolArgs.simulationDescription = failedArgs.simulationDescription;
  }

  const failedDataSource = isRecord(failedArgs.dataSource) ? failedArgs.dataSource : undefined;
  const inferredDataSource = inferChartDataSourceFromFallbackDataset(dataset);
  if (failedDataSource) {
    toolArgs.dataSource = failedDataSource;
  } else if (inferredDataSource) {
    toolArgs.dataSource = inferredDataSource;
  }

  const chartResult = await executeTool(
    {
      name: "createSpecChartBlock",
      arguments: toolArgs,
    },
    {
      workspaceId: params.workspaceId,
      userId: params.userId,
      currentTabId: params.tabId,
      currentProjectId: params.projectId,
      undoTracker: params.undoTracker,
    }
  );

  if (!chartResult.success) {
    aiDebug("workflow:chartFallbackFailed", {
      sourceTool: dataset.sourceTool,
      error: chartResult.error,
    });
    return null;
  }

  const data = isRecord(chartResult.data) ? chartResult.data : null;
  const blockId = data && typeof data.blockId === "string"
    ? data.blockId
    : data && typeof data.id === "string"
      ? data.id
      : undefined;

  return {
    blockId,
    sourceTool: dataset.sourceTool,
    rowCount: cappedRows.length,
    omittedRows,
  };
}

async function createGenericSearchFallbackTable(params: {
  workspaceId: string;
  projectId?: string;
  tabId: string;
  title: string;
  rows: Array<Record<string, unknown>>;
  userId: string;
  undoTracker?: ReturnType<typeof createUndoTracker>;
}) {
  const fields = buildFieldsFromRecords(params.rows);
  if (fields.length === 0) {
    return { success: false, error: "No tabular fields found in fallback dataset." };
  }

  const rowPayload = mapRecordsToRows(params.rows, fields);
  const firstBatch = rowPayload.slice(0, 25);
  const remaining = rowPayload.slice(25);

  const createResult = await executeTool(
    {
      name: "createTableFull",
      arguments: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        tabId: params.tabId,
        title: params.title,
        fields,
        rows: firstBatch,
      },
    },
    {
      workspaceId: params.workspaceId,
      userId: params.userId,
      currentTabId: params.tabId,
      currentProjectId: params.projectId,
      undoTracker: params.undoTracker,
    }
  );

  if (!createResult.success) return createResult;

  const tableData = isRecord(createResult.data) ? createResult.data : {};
  const tableId = typeof tableData.tableId === "string" ? tableData.tableId : null;
  if (!tableId || remaining.length === 0) return createResult;

  const chunkSize = 25;
  for (let i = 0; i < remaining.length; i += chunkSize) {
    const chunk = remaining.slice(i, i + chunkSize);
    const insertResult = await executeTool(
      {
        name: "bulkInsertRows",
        arguments: { tableId, rows: chunk },
      },
      {
        workspaceId: params.workspaceId,
        userId: params.userId,
        currentTabId: params.tabId,
        currentProjectId: params.projectId,
        undoTracker: params.undoTracker,
      }
    );
    if (!insertResult.success) {
      return {
        success: false,
        error: insertResult.error ?? "Failed to append fallback rows.",
      };
    }
  }

  return createResult;
}

function getSuccessfulSearchTasks(toolCalls: ExecutionResult["toolCallsMade"]): Array<Record<string, unknown>> {
  for (let i = (toolCalls || []).length - 1; i >= 0; i -= 1) {
    const call = toolCalls[i];
    if (call?.tool !== "searchTasks") continue;
    if (!call?.result?.success || !Array.isArray(call.result.data)) continue;
    return call.result.data as Array<Record<string, unknown>>;
  }
  return [];
}

async function createTaskSearchFallbackTable(params: {
  workspaceId: string;
  projectId?: string;
  tabId: string;
  command: string;
  tasks: Array<Record<string, unknown>>;
  userId: string;
  undoTracker?: ReturnType<typeof createUndoTracker>;
}) {
  const title = buildFallbackTaskTableTitle(params.command, params.tasks.length);
  const rows = coerceTaskRowsForWorkflowFallback(params.tasks);
  const fields = pruneEmptyColumnsForRows([
    { name: "Task Title", type: "text", isPrimary: true },
    { name: "Status", type: "status" },
    { name: "Priority", type: "priority" },
    { name: "Due Date", type: "date", config: { includeTime: false } },
    { name: "Assignee", type: "person" },
    { name: "Project", type: "text" },
    { name: "Tab", type: "text" },
    { name: "Created At", type: "date" },
    { name: "Updated At", type: "date" },
  ], rows);
  return executeTool(
    {
      name: "createTableFull",
      arguments: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        tabId: params.tabId,
        title,
        fields,
        rows,
      },
    },
    {
      workspaceId: params.workspaceId,
      userId: params.userId,
      currentTabId: params.tabId,
      currentProjectId: params.projectId,
      undoTracker: params.undoTracker,
    }
  );
}

async function createOverdueTasksTable(params: {
  workspaceId: string;
  projectId?: string;
  tabId: string;
  tasks: Array<Record<string, unknown>>;
  userId: string;
  undoTracker?: ReturnType<typeof createUndoTracker>;
}) {
  const title = `Overdue Tasks (${params.tasks.length})`;
  const rows = coerceTaskRows(params.tasks);
  const fields = pruneEmptyColumnsForRows([
    { name: "Task Title", type: "text", isPrimary: true },
    { name: "Status", type: "status" },
    { name: "Priority", type: "priority" },
    { name: "Due Date", type: "date", config: { includeTime: false } },
    { name: "Assignee", type: "person" },
    { name: "Project", type: "text" },
    { name: "Tab", type: "text" },
  ], rows);
  const toolResult = await executeTool(
    {
      name: "createTableFull",
      arguments: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        tabId: params.tabId,
        title,
        fields,
        rows,
      },
    },
    {
      workspaceId: params.workspaceId,
      userId: params.userId,
      currentTabId: params.tabId,
      currentProjectId: params.projectId,
      undoTracker: params.undoTracker,
    }
  );

  return toolResult;
}

export async function executeWorkflowAICommand(params: {
  tabId: string;
  command: string;
}): Promise<WorkflowExecutionResult> {
  const workflowUndoTracker = createUndoTracker();
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      success: false,
      response: "Unauthorized",
      toolCallsMade: [],
      createdBlockIds: [],
      sessionId: "",
      undoBatches: [],
      undoSkippedTools: [],
      error: "Unauthorized",
    };
  }

  const sessionResult = await getOrCreateWorkflowSession({ tabId: params.tabId });
  if ("error" in sessionResult) {
    return {
      success: false,
      response: sessionResult.error,
      toolCallsMade: [],
      createdBlockIds: [],
      sessionId: "",
      undoBatches: [],
      undoSkippedTools: [],
      error: sessionResult.error,
    };
  }

  const session = sessionResult.data;

  // Load history
  const historyResult = await getWorkflowSessionMessages({ sessionId: session.id });
  const history = "data" in historyResult ? historyResult.data : [];

  const conversationHistory: AIMessage[] = history.map((message) => ({
    role: message.role,
    content: safeTextFromContent(message.content),
  }));

  const recentHistoryText = conversationHistory.slice(-6).map((m) => m.content ?? "").join(" ");

  // Build search history context from previous turns for source data propagation
  const { searchHistory, hasSearchHistory } = buildSearchHistoryContext(history);
  const initialSearchedEntities = hasSearchHistory ? extractInitialSearchedEntities(history) : [];

  // Record user message
  await addWorkflowMessage({
    sessionId: session.id,
    role: "user",
    content: { text: params.command },
  });

  const supabase = await createClient();
  const [workspaceResult, profileResult, tabResult] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", session.workspace_id).single(),
    supabase.from("profiles").select("name, email").eq("id", user.id).single(),
    supabase
      .from("tabs")
      .select("id, project_id, name, projects!inner(id, workspace_id)")
      .eq("id", params.tabId)
      .single(),
  ]);

  const workspaceName = workspaceResult.data?.name || undefined;
  const userName = profileResult.data?.name || profileResult.data?.email || undefined;
  const currentProjectId = tabResult.data?.project_id || undefined;

  // Auto-generate title from first query
  if (history.length === 0 && tabResult.data) {
    const currentName = tabResult.data.name;
    if (currentName === "Workflow Page" || !currentName || currentName.trim() === "") {
      // Generate a title from the command
      const titleFromCommand = params.command
        .replace(/^(please|can you|could you|would you|i need|i want|help me|show me)\s+/i, "")
        .replace(/[?!.]+$/, "")
        .trim();
      const maxLength = 60;
      const newTitle = titleFromCommand.length > maxLength
        ? titleFromCommand.substring(0, maxLength).trim() + "..."
        : titleFromCommand;

      if (newTitle) {
        await supabase
          .from("tabs")
          .update({ name: newTitle })
          .eq("id", params.tabId);
      }
    }
  }

  const [tableContext, blockContext] = await Promise.all([
    resolveLatestTableContext({ supabase, tabId: params.tabId, history }),
    resolveLatestBlockContext({ supabase, tabId: params.tabId, history }),
  ]);

  const systemPrefix: AIMessage[] = [
    {
      role: "system",
      content: `You are building a Workflow Page - a persistent document made of blocks.

YOUR PRIMARY JOB: Create durable, useful page artifacts in the right format.
Keep conversational explanation, reasoning, and elaboration in chat.

BLOCK CREATION:
- Use createTableFull({ title: "...", rows: [...] }) for lists/comparisons/tabular data - the title IS the heading
- Use createSpecChartBlock() for visualizations
- When the user asks to SEE, SHOW, or VISUALIZE a distribution/chart/graph (e.g. "let me see the distribution", "show me the breakdown"), you MUST call createSpecChartBlock to create the actual chart. NEVER respond with text-only descriptions of what a chart would show—always create the chart block.
- For tasks/subtasks, prefer: searchTasks or searchSubtasks → createTableFull(...) to list results (use a task board only if the user explicitly asks for a board)
- For large result sets (20+ rows), avoid oversized single payloads: create table with initial rows, then append remaining rows with bulkInsertRows in batches of ~20.
- Use createBlock({ type: "text" }) ONLY when the user explicitly asks for a written artifact to persist on the page (report, brief, plan, notes, documentation, summary).
- Do NOT create text blocks for normal Q&A, status checks, caveats, or general conversation.
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

🚨 SOURCE TRACKING (NON-NEGOTIABLE) - When creating table rows from existing workspace data (tasks, timeline events, table rows, subtasks, etc.):
- You MUST include source_entity_type, source_entity_id, and source_sync_mode on EVERY row that represents an existing entity.
- Format: { data: {...}, source_entity_type: "task" | "timeline_event" | "table_row" | "block", source_entity_id: "<entity-uuid>", source_sync_mode: "live" }
- This applies to ALL table creation from existing data, whether via createTableFull or bulkInsertRows.
- NEVER omit source tracking when the data comes from searchTasks, searchSubtasks, searchTimelineEvents, searchBlocks, getEntityById (table rows), or similar search results. For rows from another table use source_entity_type "table_row". For blocks use source_entity_type "block".
- When creating tasks or timeline events from table rows/results, you MUST pass source_entity_type "table_row", source_entity_id as the row id, and source_sync_mode "snapshot" in createTaskItem/createTimelineEvent calls.
- These fields enable the sync header and snapshot tracking. Without them, the table has no connection to source data.
- Never add source_entity_type/source_entity_id/source_sync_mode as visible table columns - they go on the row object, not in the data.

🚨 FIELD TYPE PRESERVATION (NON-NEGOTIABLE) - When creating tables from existing data:
- Status fields → type: "status" (NOT text). Value must be normalized: "todo", "in_progress", "done", "blocked"
- Priority fields → type: "priority" (NOT text). Value must be normalized: "low", "medium", "high", "urgent"
- Assignee fields → type: "person". Value must be an array of user ID strings (from assignees.map(a => a.id) in search results), e.g. ["user-id-1", "user-id-2"]
- Date fields → type: "date". Value must be YYYY-MM-DD format
- Include only source entity fields that have at least one non-null value across the rows; omit columns that would be all-null (e.g., Due Date when absent for all rows)
- Field order: entity's own fields FIRST (title, status, priority, due date, assignee), then context/metadata fields (project, tab)

🚨 TABLE SUBTASKS (when creating tables from tasks that have subtasks) - DO NOT put subtask names in a text column:
- Add a "Subtask" field with type "subtask" or "checkbox" to the table schema.
- Each subtask is a SEPARATE ROW: parent task row has Subtask=false, each subtask has its own row with Subtask=true placed directly under the parent.
- Row order: Parent → subtask1 → subtask2 → next parent → its subtasks...
- Each subtask row fills ALL columns (Title, Status, Priority, etc.) with the subtask's own values — treat it like a regular row.
- NEVER create a text/long_text "Subtasks" column that lists names in one cell.

CRITICAL - TEXT BLOCK CONTENT REQUIREMENT:
- When creating text blocks (reports, summaries, documentation, etc.), you MUST search the workspace FIRST to gather relevant information
- NEVER create text blocks with generic or made-up content - always base them on actual workspace data
- Use unstructuredSearchWorkspace, searchTasks, searchProjects, searchDocs, or other search tools BEFORE calling createBlock
- Example flow: "Create a summary of our priorities" → searchTasks/unstructuredSearchWorkspace → analyze results → createBlock with actual findings

IMPORTANT SAFETY:
- Do NOT modify existing tasks, projects, or data unless the user explicitly asks you to update/delete/move/assign.
- For read-only requests, use search/analysis tools. Create blocks only when the output should persist as a page artifact.
- Use conversation history to resolve references like "that", "those", "previous", "above", "earlier" and update the most recent relevant block instead of creating new ones.
- If the user refers to "that table", "this table", or "the table above", UPDATE the existing table (use updateTableFull / updateTableRowsByFieldNames). Do NOT create a new table.
- If a field like Priority/Status is missing in source data, fill with "Unspecified" rather than leaving blanks.
${tableContext.tableId ? `CURRENT TABLE CONTEXT: tableId=${tableContext.tableId}, blockId=${tableContext.blockId}` : ""}
${blockContext.blockId ? `CURRENT BLOCK CONTEXT: blockId=${blockContext.blockId}, type=${blockContext.blockType}` : ""}
${blockContext.chartContent ? `
CHART CONVERSION: The latest block is a chart. To convert it to a different type (e.g. "render as doughnut chart", "make it a pie chart"), you MUST call createSpecChartBlock with the SAME rows and a spec with the new type.
Current chart data (use these rows and modify spec.type as needed):
spec: ${JSON.stringify(blockContext.chartContent.spec)}
rows: ${JSON.stringify(blockContext.chartContent.rows)}
${typeof blockContext.chartContent.universeTotal === "number" ? `universeTotal: ${blockContext.chartContent.universeTotal}` : ""}
Do NOT respond with text-only. Call createSpecChartBlock.` : ""}

SEARCH STRATEGY - Use BOTH STRUCTURED SEARCH AND UNSTRUCTURED/RAG search for comprehensive results. ALWAYS READ THE QUERY, AND DECIDE WHETHER ITS ASKING ABOUT STRUCTURED, UNSTRUCTURED, OR A COMBINATION OF BOTH:
1. STRUCTURED SEARCH (searchTasks, searchSubtasks, searchProjects, searchDocs, searchTables, etc.)
   - Use when looking for specific entities by name, status, date, assignee
   - Good for: "overdue tasks", "projects for client X", "tasks assigned to Sarah"
   - IMPORTANT: Status/priority filters rely on entity properties and may be missing on older tasks. Unless the user explicitly asks for a status, prefer NOT filtering by status to avoid false empty results.

2. UNSTRUCTURED/RAG SEARCH (unstructuredSearchWorkspace)
   - Use for semantic/conceptual queries across all content
   - Good for: "Q1 marketing campaigns", "budget discussions", "anything mentioning revenue"

SHOPIFY PRIORITY:
- If the user asks about Shopify products, inventory, store/shop, SKUs/variants, or sales, use Shopify tools FIRST.
- Call searchShopifyProducts before any general workspace search. Only fall back to general search if Shopify results are empty or the user explicitly asks about workspace content.

FALLBACK BEHAVIOR:
- If structured search returns no results, TRY unstructuredSearchWorkspace
- If unstructured search is too broad, REFINE with structured filters
- For ambiguous queries like "Q1 campaigns", try BOTH: searchProjects + unstructuredSearchWorkspace

RESPONSE PATTERN:
1. Search/analyze data as needed. Always use the tools to find the information you need. Do not eer come back with no results without using all the search tools available. 
2. Create or update blocks only if a persistent artifact is needed; otherwise keep it in chat.
3. Chat response style:
   - If you created/updated blocks: brief action summary of what changed.
   - If you did not create blocks: provide the answer directly in chat.
4. User-facing wording:
   - NEVER include internal IDs (UUIDs, blockId, tableId, sessionId, tabId, workspaceId, projectId, source_entity_id) in chat responses.
   - Refer to items by human-readable names/titles and plain-language context instead of IDs.
   - Format answers for readability with short paragraphs and bullets, with blank lines between sections.${hasSearchHistory ? "\n" + searchHistory : ""}`,
    },
  ];

  const allowTaskMutations = isTaskMutationCommand(params.command, recentHistoryText);
  const allowEntityMutations = isExplicitEntityMutationCommand(params.command);
  const allowedWriteTools = [
    "createBlock",
    "updateBlock",
    "updateTableFull",
    "updateTableRowsByFieldNames",
    "bulkInsertRows",
    "bulkUpdateRows",
    "bulkUpdateRowsByFieldNames",
    "createSpecChartBlock",
  ];
  allowedWriteTools.push("createTableFull");
  allowedWriteTools.push("deleteTable");
  const result = await executeAICommand(
    params.command,
    {
      workspaceId: session.workspace_id,
      workspaceName,
      userId: user.id,
      userName,
      currentProjectId,
      currentTabId: params.tabId,
      contextTableId: tableContext.tableId,
      contextBlockId: blockContext.blockId ?? tableContext.blockId,
    },
    [...systemPrefix, ...conversationHistory],
    {
      readOnly: !(allowTaskMutations || allowEntityMutations),
      allowedWriteTools,
      enforceBatchUpdateCompletion: allowTaskMutations,
      initialSearchedEntities: initialSearchedEntities.length > 0 ? initialSearchedEntities : undefined,
      // Workflow pages require unified multi-tool access and should not short-circuit
      // via deterministic parsing (we want the LLM to create blocks/artifacts).
      forcedToolGroups: [
        "core",
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
      ],
      disableDeterministic: true,
      disableOptimisticEarlyExit: true,
    }
  );

  let mergedUndoBatches: UndoBatch[] = Array.isArray(result.undoBatches) ? [...result.undoBatches] : [];
  const mergedSkipped = Array.isArray(result.undoSkippedTools) ? [...result.undoSkippedTools] : [];

  const allowTextBlockArtifacts = shouldPersistAssistantAsTextBlock(params.command);
  const createdTextBlockIds = extractCreatedTextBlockIds(result.toolCallsMade);
  const createdTextBlockIdSet = new Set(createdTextBlockIds);
  const createdBlockIds = extractCreatedBlockIds(result.toolCallsMade).filter((id) => (
    allowTextBlockArtifacts || !createdTextBlockIdSet.has(id)
  ));
  let finalResponse = result.response;

  if (!allowTextBlockArtifacts && createdTextBlockIds.length > 0) {
    for (const blockId of createdTextBlockIds) {
      await deleteBlock(blockId);
    }
    mergedUndoBatches = pruneUndoBatchesForDeletedBlocks(mergedUndoBatches, createdTextBlockIds);
  }

  // If the AI ran a task search but returned empty due to brittle status filters,
  // retry overdue task search without status filtering and persist results as a table.
  if (isOverdueQuery(params.command)) {
    const alreadyCreatedTasksTable = (result.toolCallsMade || []).some((call) => {
      if (!call?.result?.success) return false;
      if (call.tool === "createTableFull") return true;
      if (call.tool === "createBlock") {
        const args = call.arguments as Record<string, unknown> | undefined;
        return args?.type === "table";
      }
      return false;
    });

    if (!alreadyCreatedTasksTable) {
      const attemptedSearch = (result.toolCallsMade || []).find((call) => call.tool === "searchTasks");
      const attemptedArgs = attemptedSearch?.arguments as Record<string, unknown> | undefined;
      const attemptedData = attemptedSearch?.result?.success && Array.isArray(attemptedSearch.result.data)
        ? (attemptedSearch.result.data as Array<Record<string, unknown>>)
        : null;

      const hadStatusFilter = Boolean(attemptedArgs && "status" in attemptedArgs);
      const emptyFromSearch = Array.isArray(attemptedData) && attemptedData.length === 0;

      if (hadStatusFilter && emptyFromSearch) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const retry = await searchTasks({
          dueDate: { lte: formatDateYYYYMMDD(yesterday) },
          limit: 200,
        });

        const tasks = !retry.error && Array.isArray(retry.data)
          ? (retry.data as unknown as Array<Record<string, unknown>>).filter((t) => {
              const status = String((t as Record<string, unknown>).status ?? "").toLowerCase();
              return status !== "done" && status !== "complete" && status !== "completed";
            })
          : [];

        if (tasks.length > 0) {
          const tableResult = await createOverdueTasksTable({
            workspaceId: session.workspace_id,
            projectId: currentProjectId,
            tabId: params.tabId,
            tasks,
            userId: user.id,
            undoTracker: workflowUndoTracker,
          });

          if (tableResult.success) {
            const data = tableResult.data && typeof tableResult.data === "object"
              ? (tableResult.data as Record<string, unknown>)
              : null;
            const blockId = data?.blockId;
            if (typeof blockId === "string" && blockId.length > 0) {
              createdBlockIds.push(blockId);
            } else {
              const tableId = data?.tableId;
              if (typeof tableId === "string" && tableId.length > 0) {
                const blockResult = await createBlock({
                  tabId: params.tabId,
                  type: "table",
                  content: { tableId },
                });
                if (!("error" in blockResult) && blockResult.data?.id) {
                  createdBlockIds.push(blockResult.data.id);
                  workflowUndoTracker.addBatch([
                    { action: "delete", table: "blocks", ids: [blockResult.data.id], idColumn: "id" },
                  ]);
                }
              }
            }

            const note = `I added a table with ${tasks.length} overdue task(s) to this page.`;
            const normalized = finalResponse.trim().toLowerCase();
            finalResponse =
              normalized === "action completed." || normalized === "action completed"
                ? note
                : finalResponse.trim().length > 0
                  ? `${finalResponse.trim()}\n\n${note}`
                  : note;
          }
        }
      }
    }
  }

  // Fallback for LLM tool-call truncation:
  // If createTableFull payload got truncated, but searchTasks succeeded,
  // build the table server-side from search results (no giant LLM JSON payload).
  if (createdBlockIds.length === 0 && hasCreateTableTruncationFailure(result.toolCallsMade)) {
    const tasks = getSuccessfulSearchTasks(result.toolCallsMade);
    if (tasks.length > 0) {
      const tableResult = await createTaskSearchFallbackTable({
        workspaceId: session.workspace_id,
        projectId: currentProjectId,
        tabId: params.tabId,
        command: params.command,
        tasks,
        userId: user.id,
        undoTracker: workflowUndoTracker,
      });

      if (tableResult.success) {
        const data = tableResult.data && typeof tableResult.data === "object"
          ? (tableResult.data as Record<string, unknown>)
          : null;
        const blockId = data?.blockId;
        if (typeof blockId === "string" && blockId.length > 0) {
          createdBlockIds.push(blockId);
        }
        const note = `I created the table from ${tasks.length} task(s) using a safe batched path after a payload truncation.`;
        finalResponse = finalResponse.trim().length > 0 ? `${finalResponse.trim()}\n\n${note}` : note;
      }
    }
  }

  if (createdBlockIds.length === 0 && hasCreateTableTruncationFailure(result.toolCallsMade)) {
    const dataset = getLatestSearchDatasetForFallback(result.toolCallsMade);
    if (dataset && dataset.rows.length > 0) {
      const fallbackTitle = `Search Results (${dataset.rows.length})`;
      const tableResult = await createGenericSearchFallbackTable({
        workspaceId: session.workspace_id,
        projectId: currentProjectId,
        tabId: params.tabId,
        title: fallbackTitle,
        rows: dataset.rows,
        userId: user.id,
        undoTracker: workflowUndoTracker,
      });

      if (tableResult.success) {
        const data = isRecord(tableResult.data) ? tableResult.data : null;
        const blockId = data && typeof data.blockId === "string" ? data.blockId : null;
        if (blockId) {
          createdBlockIds.push(blockId);
        }
        const note = `I created the table from ${dataset.rows.length} ${dataset.sourceTool} result row(s) using a fallback path after payload truncation.`;
        finalResponse = finalResponse.trim().length > 0 ? `${finalResponse.trim()}\n\n${note}` : note;
      }
    }
  }

  if (createdBlockIds.length === 0 && hasCreateSpecChartTruncationFailure(result.toolCallsMade)) {
    const chartFallback = await createSearchFallbackChart({
      workspaceId: session.workspace_id,
      projectId: currentProjectId,
      tabId: params.tabId,
      command: params.command,
      toolCalls: result.toolCallsMade,
      userId: user.id,
      undoTracker: workflowUndoTracker,
    });

    if (chartFallback) {
      if (chartFallback.blockId) {
        createdBlockIds.push(chartFallback.blockId);
      }
      const omittedNote = chartFallback.omittedRows > 0
        ? ` (${chartFallback.omittedRows} additional row(s) omitted for stability).`
        : ".";
      const note = `I created the chart from ${chartFallback.rowCount} ${chartFallback.sourceTool} result row(s) using a fallback path after payload truncation${omittedNote}`;
      finalResponse = finalResponse.trim().length > 0 ? `${finalResponse.trim()}\n\n${note}` : note;
    }
  }

  // Persist chat as a text block only when the user explicitly asked for a written page artifact.
  const hadSuccessfulToolCall = (result.toolCallsMade || []).some(
    (call) => call?.result?.success
  );
  if (
    createdBlockIds.length === 0
    && finalResponse.trim().length > 0
    && !hadSuccessfulToolCall
    && shouldPersistAssistantAsTextBlock(params.command)
  ) {
    const blockResult = await createBlock({
      tabId: params.tabId,
      type: "text",
      content: { text: finalResponse },
    });
    if (!("error" in blockResult) && blockResult.data?.id) {
      createdBlockIds.push(blockResult.data.id);
      workflowUndoTracker.addBatch([
        { action: "delete", table: "blocks", ids: [blockResult.data.id], idColumn: "id" },
      ]);
    }
  }

  if (workflowUndoTracker.batches.length > 0) {
    mergedUndoBatches.push(...workflowUndoTracker.batches);
  }
  if (workflowUndoTracker.skippedTools.length > 0) {
    mergedSkipped.push(...workflowUndoTracker.skippedTools);
  }

  finalResponse = scrubInternalIdsFromResponse(finalResponse);

  await addWorkflowMessage({
    sessionId: session.id,
    role: "assistant",
    content: {
      text: finalResponse,
      toolCallsMade: result.toolCallsMade,
      undoBatches: mergedUndoBatches,
      undoSkippedTools: mergedSkipped,
      searchManifest: result.searchManifest ?? null,
    },
    createdBlockIds,
  });
  if (result.searchManifest) {
    aiDebug("sourceTracking:manifestPersisted", {
      sessionId: session.id,
      entityCount: result.searchManifest.entities.length,
      searchTools: result.searchManifest.searchTools,
    });
  }

  return {
    success: result.success,
    response: finalResponse,
    toolCallsMade: result.toolCallsMade,
    createdBlockIds,
    sessionId: session.id,
    undoBatches: mergedUndoBatches,
    undoSkippedTools: mergedSkipped,
    error: result.error,
  };
}

export async function* executeWorkflowAICommandStream(params: {
  tabId: string;
  command: string;
  routingMode?: "default" | "chart" | "shopify";
  confirmation?: WriteConfirmationApproval | null;
  resumeFromConfirmation?: boolean;
  conversationHistory?: AIMessage[];
  persistSession?: boolean;
}): AsyncGenerator<{
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
  const workflowUndoTracker = createUndoTracker();
  const persistSession = params.persistSession !== false;
  const user = await getAuthenticatedUser();
  if (!user) {
    yield { type: "response", content: "Unauthorized", data: { error: "Unauthorized" } };
    return;
  }

  let sessionId: string | null = null;
  let workspaceId: string | null = null;
  let history: WorkflowMessageRecord[] = [];
  let conversationHistory: AIMessage[] = [];

  if (persistSession) {
    const sessionResult = await getOrCreateWorkflowSession({ tabId: params.tabId });
    if ("error" in sessionResult) {
      yield { type: "response", content: sessionResult.error, data: { error: sessionResult.error } };
      return;
    }

    const session = sessionResult.data;
    sessionId = session.id;
    workspaceId = session.workspace_id;

    const historyResult = await getWorkflowSessionMessages({ sessionId: session.id });
    history = "data" in historyResult ? historyResult.data : [];
    conversationHistory = history.map((message) => ({
      role: message.role,
      content: safeTextFromContent(message.content),
    }));
  } else {
    conversationHistory = Array.isArray(params.conversationHistory)
      ? params.conversationHistory.filter((message) => message.role !== "system")
      : [];
  }

  const recentHistoryText = conversationHistory.slice(-6).map((m) => m.content ?? "").join(" ");

  // Build search history context from previous turns for source data propagation (streaming path)
  const { searchHistory: streamSearchHistory, hasSearchHistory: streamHasSearchHistory } = persistSession
    ? buildSearchHistoryContext(history)
    : { searchHistory: "", hasSearchHistory: false };
  const streamInitialSearchedEntities = streamHasSearchHistory ? extractInitialSearchedEntities(history) : [];

  if (persistSession && sessionId && !params.resumeFromConfirmation) {
    await addWorkflowMessage({
      sessionId,
      role: "user",
      content: { text: params.command },
    });
  }

  const supabase = await createClient();
  const tabResult = await supabase
    .from("tabs")
    .select("id, project_id, name, projects!inner(id, workspace_id)")
    .eq("id", params.tabId)
    .single();

  const tabProject = tabResult.data?.projects as { workspace_id?: string } | { workspace_id?: string }[] | null;
  const tabWorkspaceId = Array.isArray(tabProject) ? tabProject[0]?.workspace_id : tabProject?.workspace_id;
  const effectiveWorkspaceId = workspaceId || tabWorkspaceId || null;
  if (!effectiveWorkspaceId) {
    yield { type: "response", content: "Unable to resolve workspace for this tab.", data: { error: "Missing workspace context" } };
    return;
  }

  const [workspaceResult, profileResult] = await Promise.all([
    supabase.from("workspaces").select("id, name").eq("id", effectiveWorkspaceId).single(),
    supabase.from("profiles").select("name, email").eq("id", user.id).single(),
  ]);

  const workspaceName = workspaceResult.data?.name || undefined;
  const userName = profileResult.data?.name || profileResult.data?.email || undefined;
  const currentProjectId = tabResult.data?.project_id || undefined;

  // Auto-generate title from first query (streaming version)
  if (persistSession && !params.resumeFromConfirmation && history.length === 0 && tabResult.data) {
    const currentName = tabResult.data.name;
    if (currentName === "Workflow Page" || !currentName || currentName.trim() === "") {
      // Generate a title from the command
      const titleFromCommand = params.command
        .replace(/^(please|can you|could you|would you|i need|i want|help me|show me)\s+/i, "")
        .replace(/[?!.]+$/, "")
        .trim();
      const maxLength = 60;
      const newTitle = titleFromCommand.length > maxLength
        ? titleFromCommand.substring(0, maxLength).trim() + "..."
        : titleFromCommand;

      if (newTitle) {
        await supabase
          .from("tabs")
          .update({ name: newTitle })
          .eq("id", params.tabId);
      }
    }
  }

  const [tableContext, blockContext] = await Promise.all([
    resolveLatestTableContext({ supabase, tabId: params.tabId, history }),
    resolveLatestBlockContext({ supabase, tabId: params.tabId, history }),
  ]);

  const systemPrefix: AIMessage[] = [
    {
      role: "system",
      content: `You are building a Workflow Page - a persistent document made of blocks.

YOUR PRIMARY JOB: Create durable, useful page artifacts in the right format.
Keep conversational explanation, reasoning, and elaboration in chat.

BLOCK CREATION:
- Use createTableFull({ title: "...", rows: [...] }) for lists/comparisons/tabular data - the title IS the heading
- Use createSpecChartBlock() for visualizations
- When the user asks to SEE, SHOW, or VISUALIZE a distribution/chart/graph (e.g. "let me see the distribution", "show me the breakdown"), you MUST call createSpecChartBlock to create the actual chart. NEVER respond with text-only descriptions of what a chart would show—always create the chart block.
- For tasks/subtasks, prefer: searchTasks or searchSubtasks → createTableFull(...) to list results (use a task board only if the user explicitly asks for a board)
- For large result sets (20+ rows), avoid oversized single payloads: create table with initial rows, then append remaining rows with bulkInsertRows in batches of ~20.
- Use createBlock({ type: "text" }) ONLY when the user explicitly asks for a written artifact to persist on the page (report, brief, plan, notes, documentation, summary).
- Do NOT create text blocks for normal Q&A, status checks, caveats, or general conversation.
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

🚨 SOURCE TRACKING (NON-NEGOTIABLE) - When creating table rows from existing workspace data (tasks, timeline events, table rows, subtasks, etc.):
- You MUST include source_entity_type, source_entity_id, and source_sync_mode on EVERY row that represents an existing entity.
- Format: { data: {...}, source_entity_type: "task" | "timeline_event" | "table_row" | "block", source_entity_id: "<entity-uuid>", source_sync_mode: "live" }
- This applies to ALL table creation from existing data, whether via createTableFull or bulkInsertRows.
- NEVER omit source tracking when the data comes from searchTasks, searchSubtasks, searchTimelineEvents, searchBlocks, getEntityById (table rows), or similar search results. For rows from another table use source_entity_type "table_row". For blocks use source_entity_type "block".
- When creating tasks or timeline events from table rows/results, you MUST pass source_entity_type "table_row", source_entity_id as the row id, and source_sync_mode "snapshot" in createTaskItem/createTimelineEvent calls.
- These fields enable the sync header and snapshot tracking. Without them, the table has no connection to source data.
- Never add source_entity_type/source_entity_id/source_sync_mode as visible table columns - they go on the row object, not in the data.

🚨 FIELD TYPE PRESERVATION (NON-NEGOTIABLE) - When creating tables from existing data:
- Status fields → type: "status" (NOT text). Value must be normalized: "todo", "in_progress", "done", "blocked"
- Priority fields → type: "priority" (NOT text). Value must be normalized: "low", "medium", "high", "urgent"
- Assignee fields → type: "person". Value must be an array of user ID strings (from assignees.map(a => a.id) in search results), e.g. ["user-id-1", "user-id-2"]
- Date fields → type: "date". Value must be YYYY-MM-DD format
- Include only source entity fields that have at least one non-null value across the rows; omit columns that would be all-null (e.g., Due Date when absent for all rows)
- Field order: entity's own fields FIRST (title, status, priority, due date, assignee), then context/metadata fields (project, tab)

🚨 TABLE SUBTASKS (when creating tables from tasks that have subtasks) - DO NOT put subtask names in a text column:
- Add a "Subtask" field with type "subtask" or "checkbox" to the table schema.
- Each subtask is a SEPARATE ROW: parent task row has Subtask=false, each subtask has its own row with Subtask=true placed directly under the parent.
- Row order: Parent → subtask1 → subtask2 → next parent → its subtasks...
- Each subtask row fills ALL columns (Title, Status, Priority, etc.) with the subtask's own values — treat it like a regular row.
- NEVER create a text/long_text "Subtasks" column that lists names in one cell.

CRITICAL - TEXT BLOCK CONTENT REQUIREMENT:
- When creating text blocks (reports, summaries, documentation, etc.), you MUST search the workspace FIRST to gather relevant information
- NEVER create text blocks with generic or made-up content - always base them on actual workspace data
- Use unstructuredSearchWorkspace, searchTasks, searchProjects, searchDocs, or other search tools BEFORE calling createBlock
- Example flow: "Create a summary of our priorities" → searchTasks/unstructuredSearchWorkspace → analyze results → createBlock with actual findings

IMPORTANT SAFETY:
- Do NOT modify existing tasks, projects, or data unless the user explicitly asks you to update/delete/move/assign.
- For read-only requests, use search/analysis tools. Create blocks only when the output should persist as a page artifact.
- Use conversation history to resolve references like "that", "those", "previous", "above", "earlier" and update the most recent relevant block instead of creating new ones.
- If the user refers to "that table", "this table", or "the table above", UPDATE the existing table (use updateTableFull / updateTableRowsByFieldNames). Do NOT create a new table.
- If a field like Priority/Status is missing in source data, fill with "Unspecified" rather than leaving blanks.
${tableContext.tableId ? `CURRENT TABLE CONTEXT: tableId=${tableContext.tableId}, blockId=${tableContext.blockId}` : ""}
${blockContext.blockId ? `CURRENT BLOCK CONTEXT: blockId=${blockContext.blockId}, type=${blockContext.blockType}` : ""}
${blockContext.chartContent ? `
CHART CONVERSION: The latest block is a chart. To convert it to a different type (e.g. "render as doughnut chart", "make it a pie chart"), you MUST call createSpecChartBlock with the SAME rows and a spec with the new type.
Current chart data (use these rows and modify spec.type as needed):
spec: ${JSON.stringify(blockContext.chartContent.spec)}
rows: ${JSON.stringify(blockContext.chartContent.rows)}
${typeof blockContext.chartContent.universeTotal === "number" ? `universeTotal: ${blockContext.chartContent.universeTotal}` : ""}
Do NOT respond with text-only. Call createSpecChartBlock.` : ""}

SEARCH STRATEGY - Use BOTH STRUCTURED SEARCH AND UNSTRUCTURED/RAG search for comprehensive results. ALWAYS READ THE QUERY, AND DECIDE WHETHER ITS ASKING ABOUT STRUCTURED, UNSTRUCTURED, OR A COMBINATION OF BOTH:
1. STRUCTURED SEARCH (searchTasks, searchSubtasks, searchProjects, searchDocs, searchTables, etc.)
   - Use when looking for specific entities by name, status, date, assignee
   - Good for: "overdue tasks", "projects for client X", "tasks assigned to Sarah"
   - IMPORTANT: Status/priority filters rely on entity properties and may be missing on older tasks. Unless the user explicitly asks for a status, prefer NOT filtering by status to avoid false empty results.

2. UNSTRUCTURED/RAG SEARCH (unstructuredSearchWorkspace)
   - Use for semantic/conceptual queries across all content
   - Good for: "Q1 marketing campaigns", "budget discussions", "anything mentioning revenue"

FALLBACK BEHAVIOR:
- If structured search returns no results, TRY unstructuredSearchWorkspace
- If unstructured search is too broad, REFINE with structured filters
- For ambiguous queries like "Q1 campaigns", try BOTH: searchProjects + unstructuredSearchWorkspace

RESPONSE PATTERN:
1. Search/analyze data as needed. Always use the tools to find the information you need. Do not eer come back with no results without using all the search tools available. 
2. Create or update blocks only if a persistent artifact is needed; otherwise keep it in chat.
3. Chat response style:
   - If you created/updated blocks: brief action summary of what changed.
   - If you did not create blocks: provide the answer directly in chat.
4. User-facing wording:
   - NEVER include internal IDs (UUIDs, blockId, tableId, sessionId, tabId, workspaceId, projectId, source_entity_id) in chat responses.
   - Refer to items by human-readable names/titles and plain-language context instead of IDs.
   - Format answers for readability with short paragraphs and bullets, with blank lines between sections.${streamHasSearchHistory ? "\n" + streamSearchHistory : ""}`,
    },
  ];

  const allowTaskMutations = isTaskMutationCommand(params.command, recentHistoryText);
  const allowEntityMutations = isExplicitEntityMutationCommand(params.command);
  const allowedWriteTools = [
    "createBlock",
    "updateBlock",
    "updateTableFull",
    "updateTableRowsByFieldNames",
    "bulkInsertRows",
    "bulkUpdateRows",
    "bulkUpdateRowsByFieldNames",
    "createSpecChartBlock",
  ];
  allowedWriteTools.push("createTableFull");
  allowedWriteTools.push("deleteTable");

  const stream = executeAICommandStream(
    params.command,
    {
      workspaceId: effectiveWorkspaceId,
      workspaceName,
      userId: user.id,
      userName,
      currentProjectId,
      currentTabId: params.tabId,
      contextTableId: tableContext.tableId,
      contextBlockId: blockContext.blockId ?? tableContext.blockId,
    },
    [...systemPrefix, ...conversationHistory],
    {
      readOnly: !(allowTaskMutations || allowEntityMutations),
      allowedWriteTools,
      routingMode:
        params.routingMode === "chart"
          ? "chart"
          : params.routingMode === "shopify"
            ? "shopify"
            : "default",
      enforceBatchUpdateCompletion: allowTaskMutations,
      forcedToolGroups: [
        "core",
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
      ],
      disableDeterministic: true,
      disableOptimisticEarlyExit: true,
      requireWriteConfirmation: true,
      approvedWriteAction: params.confirmation,
      initialSearchedEntities: streamInitialSearchedEntities.length > 0 ? streamInitialSearchedEntities : undefined,
    }
  );

  let finalEvent: { content: string; data?: unknown } | null = null;

  for await (const event of stream) {
    if (event.type === "confirmation_required") {
      yield event;
      return;
    }
    if (event.type === "response") {
      finalEvent = event;
      break;
    }
    yield event;
  }

  if (!finalEvent) {
    aiDebug("workflow:streamCompletedWithoutResponse", { command: params.command });
    yield { type: "response", content: "An error occurred while processing your command." };
    return;
  }

  const payload = finalEvent.data && typeof finalEvent.data === "object"
    ? (finalEvent.data as {
        toolCallsMade?: unknown;
        undoBatches?: unknown;
        undoSkippedTools?: unknown;
        searchManifest?: unknown;
      })
    : {};
  const toolCallsMade = Array.isArray(payload.toolCallsMade)
    ? (payload.toolCallsMade as ExecutionResult["toolCallsMade"])
    : [];
  let mergedUndoBatches: UndoBatch[] = Array.isArray(payload.undoBatches)
    ? [...(payload.undoBatches as UndoBatch[])]
    : [];
  const mergedSkipped: string[] = Array.isArray(payload.undoSkippedTools)
    ? [...(payload.undoSkippedTools as string[])]
    : [];
  const streamSearchManifest = payload.searchManifest && typeof payload.searchManifest === "object"
    ? (payload.searchManifest as SearchManifest)
    : undefined;

  const allowTextBlockArtifacts = shouldPersistAssistantAsTextBlock(params.command);
  const createdTextBlockIds = extractCreatedTextBlockIds(toolCallsMade);
  const createdTextBlockIdSet = new Set(createdTextBlockIds);
  const createdBlockIds = extractCreatedBlockIds(toolCallsMade).filter((id) => (
    allowTextBlockArtifacts || !createdTextBlockIdSet.has(id)
  ));
  let finalResponse = finalEvent.content || "";

  if (!allowTextBlockArtifacts && createdTextBlockIds.length > 0) {
    for (const blockId of createdTextBlockIds) {
      await deleteBlock(blockId);
    }
    mergedUndoBatches = pruneUndoBatchesForDeletedBlocks(mergedUndoBatches, createdTextBlockIds);
  }

  if (isOverdueQuery(params.command)) {
    const alreadyCreatedTasksTable = (toolCallsMade || []).some((call) => {
      if (!call?.result?.success) return false;
      if (call.tool === "createTableFull") return true;
      if (call.tool === "createBlock") {
        const args = call.arguments as Record<string, unknown> | undefined;
        return args?.type === "table";
      }
      return false;
    });

    if (!alreadyCreatedTasksTable) {
      const attemptedSearch = (toolCallsMade || []).find((call) => call.tool === "searchTasks");
      const attemptedArgs = attemptedSearch?.arguments as Record<string, unknown> | undefined;
      const attemptedData = attemptedSearch?.result?.success && Array.isArray(attemptedSearch.result.data)
        ? (attemptedSearch.result.data as Array<Record<string, unknown>>)
        : null;

      const hadStatusFilter = Boolean(attemptedArgs && "status" in attemptedArgs);
      const emptyFromSearch = Array.isArray(attemptedData) && attemptedData.length === 0;

      if (hadStatusFilter && emptyFromSearch) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const retry = await searchTasks({
          dueDate: { lte: formatDateYYYYMMDD(yesterday) },
          limit: 200,
        });

        const tasks = !retry.error && Array.isArray(retry.data)
          ? (retry.data as unknown as Array<Record<string, unknown>>).filter((t) => {
              const status = String((t as Record<string, unknown>).status ?? "").toLowerCase();
              return status !== "done" && status !== "complete" && status !== "completed";
            })
          : [];

        if (tasks.length > 0) {
          const tableResult = await createOverdueTasksTable({
            workspaceId: effectiveWorkspaceId,
            projectId: currentProjectId,
            tabId: params.tabId,
            tasks,
            userId: user.id,
            undoTracker: workflowUndoTracker,
          });

          if (tableResult.success) {
            const data = tableResult.data && typeof tableResult.data === "object"
              ? (tableResult.data as Record<string, unknown>)
              : null;
            const blockId = data?.blockId;
            if (typeof blockId === "string" && blockId.length > 0) {
              createdBlockIds.push(blockId);
            } else {
              const tableId = data?.tableId;
              if (typeof tableId === "string" && tableId.length > 0) {
                const blockResult = await createBlock({
                  tabId: params.tabId,
                  type: "table",
                  content: { tableId },
                });
                if (!("error" in blockResult) && blockResult.data?.id) {
                  createdBlockIds.push(blockResult.data.id);
                  workflowUndoTracker.addBatch([
                    { action: "delete", table: "blocks", ids: [blockResult.data.id], idColumn: "id" },
                  ]);
                }
              }
            }

            const note = `I added a table with ${tasks.length} overdue task(s) to this page.`;
            const normalized = finalResponse.trim().toLowerCase();
            finalResponse =
              normalized === "action completed." || normalized === "action completed"
                ? note
                : finalResponse.trim().length > 0
                  ? `${finalResponse.trim()}\n\n${note}`
                  : note;
          }
        }
      }
    }
  }

  // Fallback for LLM tool-call truncation:
  // If createTableFull payload got truncated, but searchTasks succeeded,
  // build the table server-side from search results (no giant LLM JSON payload).
  if (createdBlockIds.length === 0 && hasCreateTableTruncationFailure(toolCallsMade)) {
    const tasks = getSuccessfulSearchTasks(toolCallsMade);
    if (tasks.length > 0) {
      const tableResult = await createTaskSearchFallbackTable({
        workspaceId: effectiveWorkspaceId,
        projectId: currentProjectId,
        tabId: params.tabId,
        command: params.command,
        tasks,
        userId: user.id,
        undoTracker: workflowUndoTracker,
      });

      if (tableResult.success) {
        const data = tableResult.data && typeof tableResult.data === "object"
          ? (tableResult.data as Record<string, unknown>)
          : null;
        const blockId = data?.blockId;
        if (typeof blockId === "string" && blockId.length > 0) {
          createdBlockIds.push(blockId);
        }
        const note = `I created the table from ${tasks.length} task(s) using a safe batched path after a payload truncation.`;
        finalResponse = finalResponse.trim().length > 0 ? `${finalResponse.trim()}\n\n${note}` : note;
      }
    }
  }

  if (createdBlockIds.length === 0 && hasCreateTableTruncationFailure(toolCallsMade)) {
    const dataset = getLatestSearchDatasetForFallback(toolCallsMade);
    if (dataset && dataset.rows.length > 0) {
      const fallbackTitle = `Search Results (${dataset.rows.length})`;
      const tableResult = await createGenericSearchFallbackTable({
        workspaceId: effectiveWorkspaceId,
        projectId: currentProjectId,
        tabId: params.tabId,
        title: fallbackTitle,
        rows: dataset.rows,
        userId: user.id,
        undoTracker: workflowUndoTracker,
      });

      if (tableResult.success) {
        const data = isRecord(tableResult.data) ? tableResult.data : null;
        const blockId = data && typeof data.blockId === "string" ? data.blockId : null;
        if (blockId) {
          createdBlockIds.push(blockId);
        }
        const note = `I created the table from ${dataset.rows.length} ${dataset.sourceTool} result row(s) using a fallback path after payload truncation.`;
        finalResponse = finalResponse.trim().length > 0 ? `${finalResponse.trim()}\n\n${note}` : note;
      }
    }
  }

  if (createdBlockIds.length === 0 && hasCreateSpecChartTruncationFailure(toolCallsMade)) {
    const chartFallback = await createSearchFallbackChart({
      workspaceId: effectiveWorkspaceId,
      projectId: currentProjectId,
      tabId: params.tabId,
      command: params.command,
      toolCalls: toolCallsMade,
      userId: user.id,
      undoTracker: workflowUndoTracker,
    });

    if (chartFallback) {
      if (chartFallback.blockId) {
        createdBlockIds.push(chartFallback.blockId);
      }
      const omittedNote = chartFallback.omittedRows > 0
        ? ` (${chartFallback.omittedRows} additional row(s) omitted for stability).`
        : ".";
      const note = `I created the chart from ${chartFallback.rowCount} ${chartFallback.sourceTool} result row(s) using a fallback path after payload truncation${omittedNote}`;
      finalResponse = finalResponse.trim().length > 0 ? `${finalResponse.trim()}\n\n${note}` : note;
    }
  }

  // Persist chat as a text block only when the user explicitly asked for a written page artifact.
  const hadSuccessfulToolCall = (toolCallsMade || []).some(
    (call) => call?.result?.success
  );
  if (
    createdBlockIds.length === 0
    && finalResponse.trim().length > 0
    && !hadSuccessfulToolCall
    && shouldPersistAssistantAsTextBlock(params.command)
  ) {
    const blockResult = await createBlock({
      tabId: params.tabId,
      type: "text",
      content: { text: finalResponse },
    });
    if (!("error" in blockResult) && blockResult.data?.id) {
      createdBlockIds.push(blockResult.data.id);
      workflowUndoTracker.addBatch([
        { action: "delete", table: "blocks", ids: [blockResult.data.id], idColumn: "id" },
      ]);
    }
  }

  if (workflowUndoTracker.batches.length > 0) {
    mergedUndoBatches.push(...workflowUndoTracker.batches);
  }
  if (workflowUndoTracker.skippedTools.length > 0) {
    mergedSkipped.push(...workflowUndoTracker.skippedTools);
  }

  finalResponse = scrubInternalIdsFromResponse(finalResponse);

  if (persistSession && sessionId) {
    await addWorkflowMessage({
      sessionId,
      role: "assistant",
      content: {
        text: finalResponse,
        toolCallsMade,
        undoBatches: mergedUndoBatches,
        undoSkippedTools: mergedSkipped,
        searchManifest: streamSearchManifest ?? null,
      },
      createdBlockIds,
    });
    if (streamSearchManifest) {
      aiDebug("sourceTracking:manifestPersisted:stream", {
        sessionId,
        entityCount: streamSearchManifest.entities.length,
        searchTools: streamSearchManifest.searchTools,
      });
    }
  }

  yield {
    type: "response",
    content: finalResponse,
    data: {
      toolCallsMade,
      undoBatches: mergedUndoBatches,
      undoSkippedTools: mergedSkipped,
      createdBlockIds,
      sessionId,
    },
  };
}
