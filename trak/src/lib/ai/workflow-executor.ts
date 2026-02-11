import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeAICommand, executeAICommandStream, type AIMessage, type ExecutionResult } from "@/lib/ai/executor";
import { createUndoTracker, type UndoBatch } from "@/lib/ai/undo";
import { getOrCreateWorkflowSession, addWorkflowMessage, getWorkflowSessionMessages } from "@/app/actions/workflow-session";
import { createBlock, deleteBlock } from "@/app/actions/block";
import { executeTool } from "@/lib/ai/tool-executor";
import { searchTasks } from "@/app/actions/ai-search";
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

function extractCreatedBlockIds(toolCallsMade: ExecutionResult["toolCallsMade"]): string[] {
  const ids: string[] = [];
  for (const call of toolCallsMade || []) {
    if (!call?.result?.success) continue;
    const tool = call.tool;
    if (!["createBlock", "createChartBlock", "createTaskBoardFromTasks", "createTableFull", "createTable"].includes(tool)) continue;
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
}) {
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
        return { blockId: block.id as string, blockType: block.type as string };
      }
    }
  }

  const { data: latestBlock } = await params.supabase
    .from("blocks")
    .select("id, type")
    .eq("tab_id", params.tabId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBlock?.id) {
    return { blockId: latestBlock.id as string, blockType: latestBlock.type as string };
  }

  return { blockId: undefined, blockType: undefined };
}

function coerceTaskRows(tasks: Array<Record<string, unknown>>) {
  return tasks.map((task) => ({
    source_entity_type: "task",
    source_entity_id: typeof task.id === "string" ? task.id : undefined,
    source_sync_mode: "snapshot",
    data: {
      Task: String(task.title || ""),
      Project: String(task.project_name || ""),
      Tab: String(task.tab_name || ""),
      "Due Date": task.due_date ? String(task.due_date) : null,
      Status: task.status ? String(task.status) : "",
      Priority: task.priority ? String(task.priority) : "",
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
    source_sync_mode: "snapshot",
    data: {
      "Task Title": String(task.title || ""),
      Status: normalizeTaskStatusForTable(task.status),
      Priority: normalizeTaskPriorityForTable(task.priority),
      Project: String(task.project_name || ""),
      Tab: String(task.tab_name || ""),
      "Created At": toDateOnly(task.created_at),
      "Updated At": toDateOnly(task.updated_at),
      "Task ID": typeof task.id === "string" ? task.id : "",
    },
  }));
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

function hasCreateTableTruncationFailure(toolCalls: ExecutionResult["toolCallsMade"]): boolean {
  return (toolCalls || []).some((call) => (
    call?.tool === "createTableFull" &&
    !call?.result?.success &&
    typeof call?.result?.error === "string" &&
    call.result.error.toLowerCase().includes("truncated")
  ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  return executeTool(
    {
      name: "createTableFull",
      arguments: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        tabId: params.tabId,
        title,
        fields: [
          { name: "Task Title", type: "text" },
          { name: "Status", type: "status" },
          { name: "Priority", type: "priority" },
          { name: "Project", type: "text" },
          { name: "Tab", type: "text" },
          { name: "Created At", type: "date" },
          { name: "Updated At", type: "date" },
          { name: "Task ID", type: "text" },
        ],
        rows: coerceTaskRowsForWorkflowFallback(params.tasks),
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
  const toolResult = await executeTool(
    {
      name: "createTableFull",
      arguments: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        tabId: params.tabId,
        title,
        fields: [
          { name: "Task", type: "text" },
          { name: "Project", type: "text" },
          { name: "Tab", type: "text" },
          { name: "Due Date", type: "date", config: { includeTime: false, format: "MMM d, yyyy" } },
          { name: "Status", type: "text" },
          { name: "Priority", type: "text" },
        ],
        rows: coerceTaskRows(params.tasks),
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
- Use createChartBlock() for visualizations
- For tasks/subtasks, prefer: searchTasks or searchSubtasks → createTableFull(...) to list results (use a task board only if the user explicitly asks for a board)
- For large result sets (20+ rows), avoid oversized single payloads: create table with initial rows, then append remaining rows with bulkInsertRows in batches of ~20.
- When rendering editable rows from tasks or timeline events, preserve source metadata on each row: source_entity_type/source_entity_id/source_sync_mode ("snapshot"). Never add these as visible columns.
- Use createBlock({ type: "text" }) ONLY when the user explicitly asks for a written artifact to persist on the page (report, brief, plan, notes, documentation, summary).
- Do NOT create text blocks for normal Q&A, status checks, caveats, or general conversation.
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

IMPORTANT SAFETY:
- Do NOT modify existing tasks, projects, or data unless the user explicitly asks you to update/delete/move/assign.
- For read-only requests, use search/analysis tools. Create blocks only when the output should persist as a page artifact.
- Use conversation history to resolve references like "that", "those", "previous", "above", "earlier" and update the most recent relevant block instead of creating new ones.
- If the user refers to "that table", "this table", or "the table above", UPDATE the existing table (use updateTableFull / updateTableRowsByFieldNames). Do NOT create a new table.
- If a field like Priority/Status is missing in source data, fill with "Unspecified" rather than leaving blanks.
${tableContext.tableId ? `CURRENT TABLE CONTEXT: tableId=${tableContext.tableId}, blockId=${tableContext.blockId}` : ""}
${blockContext.blockId ? `CURRENT BLOCK CONTEXT: blockId=${blockContext.blockId}, type=${blockContext.blockType}` : ""}

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
   - If you did not create blocks: provide the answer directly in chat.`,
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
    "createChartBlock",
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

  await addWorkflowMessage({
    sessionId: session.id,
    role: "assistant",
    content: {
      text: finalResponse,
      toolCallsMade: result.toolCallsMade,
      undoBatches: mergedUndoBatches,
      undoSkippedTools: mergedSkipped,
    },
    createdBlockIds,
  });

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
  confirmation?: WriteConfirmationApproval | null;
  resumeFromConfirmation?: boolean;
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
  const user = await getAuthenticatedUser();
  if (!user) {
    yield { type: "response", content: "Unauthorized", data: { error: "Unauthorized" } };
    return;
  }

  const sessionResult = await getOrCreateWorkflowSession({ tabId: params.tabId });
  if ("error" in sessionResult) {
    yield { type: "response", content: sessionResult.error, data: { error: sessionResult.error } };
    return;
  }

  const session = sessionResult.data;

  const historyResult = await getWorkflowSessionMessages({ sessionId: session.id });
  const history = "data" in historyResult ? historyResult.data : [];
  const conversationHistory: AIMessage[] = history.map((message) => ({
    role: message.role,
    content: safeTextFromContent(message.content),
  }));
  const recentHistoryText = conversationHistory.slice(-6).map((m) => m.content ?? "").join(" ");

  if (!params.resumeFromConfirmation) {
    await addWorkflowMessage({
      sessionId: session.id,
      role: "user",
      content: { text: params.command },
    });
  }

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
- Use createChartBlock() for visualizations
- For tasks/subtasks, prefer: searchTasks or searchSubtasks → createTableFull(...) to list results (use a task board only if the user explicitly asks for a board)
- For large result sets (20+ rows), avoid oversized single payloads: create table with initial rows, then append remaining rows with bulkInsertRows in batches of ~20.
- When rendering editable rows from tasks or timeline events, preserve source metadata on each row: source_entity_type/source_entity_id/source_sync_mode ("snapshot"). Never add these as visible columns.
- Use createBlock({ type: "text" }) ONLY when the user explicitly asks for a written artifact to persist on the page (report, brief, plan, notes, documentation, summary).
- Do NOT create text blocks for normal Q&A, status checks, caveats, or general conversation.
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

IMPORTANT SAFETY:
- Do NOT modify existing tasks, projects, or data unless the user explicitly asks you to update/delete/move/assign.
- For read-only requests, use search/analysis tools. Create blocks only when the output should persist as a page artifact.
- Use conversation history to resolve references like "that", "those", "previous", "above", "earlier" and update the most recent relevant block instead of creating new ones.
- If the user refers to "that table", "this table", or "the table above", UPDATE the existing table (use updateTableFull / updateTableRowsByFieldNames). Do NOT create a new table.
- If a field like Priority/Status is missing in source data, fill with "Unspecified" rather than leaving blanks.
${tableContext.tableId ? `CURRENT TABLE CONTEXT: tableId=${tableContext.tableId}, blockId=${tableContext.blockId}` : ""}
${blockContext.blockId ? `CURRENT BLOCK CONTEXT: blockId=${blockContext.blockId}, type=${blockContext.blockType}` : ""}

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
   - If you did not create blocks: provide the answer directly in chat.`,
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
    "createChartBlock",
  ];
  allowedWriteTools.push("createTableFull");
  allowedWriteTools.push("deleteTable");

  const stream = executeAICommandStream(
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
    yield { type: "response", content: "An error occurred while processing your command." };
    return;
  }

  const payload = finalEvent.data && typeof finalEvent.data === "object"
    ? (finalEvent.data as {
        toolCallsMade?: unknown;
        undoBatches?: unknown;
        undoSkippedTools?: unknown;
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
  if (createdBlockIds.length === 0 && hasCreateTableTruncationFailure(toolCallsMade)) {
    const tasks = getSuccessfulSearchTasks(toolCallsMade);
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

  if (createdBlockIds.length === 0 && hasCreateTableTruncationFailure(toolCallsMade)) {
    const dataset = getLatestSearchDatasetForFallback(toolCallsMade);
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

  await addWorkflowMessage({
    sessionId: session.id,
    role: "assistant",
    content: {
      text: finalResponse,
      toolCallsMade,
      undoBatches: mergedUndoBatches,
      undoSkippedTools: mergedSkipped,
    },
    createdBlockIds,
  });

  yield {
    type: "response",
    content: finalResponse,
    data: {
      toolCallsMade,
      undoBatches: mergedUndoBatches,
      undoSkippedTools: mergedSkipped,
      createdBlockIds,
      sessionId: session.id,
    },
  };
}
