import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeAICommand, executeAICommandStream, type AIMessage, type ExecutionResult } from "@/lib/ai/executor";
import { createUndoTracker, type UndoBatch } from "@/lib/ai/undo";
import { getOrCreateWorkflowSession, addWorkflowMessage, getWorkflowSessionMessages } from "@/app/actions/workflow-session";
import { createBlock } from "@/app/actions/block";
import { executeTool } from "@/lib/ai/tool-executor";
import { searchTasks } from "@/app/actions/ai-search";

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

YOUR PRIMARY JOB: Create BLOCKS on the page to display results, not just respond in chat.

BLOCK CREATION:
- Use createBlock({ type: "text" }) for prose, summaries, and analysis
- Use createTableFull({ title: "...", rows: [...] }) for tabular data - the title IS the heading
- Use createChartBlock() for visualizations
- For tasks, prefer: searchTasks → createTableFull(...) to list results (use a task board only if the user explicitly asks for a board)
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

IMPORTANT SAFETY:
- Do NOT modify existing tasks, projects, or data unless the user explicitly asks you to update/delete/move/assign.
- For read-only requests, only use search/analysis tools and create display blocks (text/table/chart).
- Use conversation history to resolve references like "that", "those", "previous", "above", "earlier" and update the most recent relevant block instead of creating new ones.
- If the user refers to "that table", "this table", or "the table above", UPDATE the existing table (use updateTableFull / updateTableRowsByFieldNames). Do NOT create a new table.
- If a field like Priority/Status is missing in source data, fill with "Unspecified" rather than leaving blanks.
${tableContext.tableId ? `CURRENT TABLE CONTEXT: tableId=${tableContext.tableId}, blockId=${tableContext.blockId}` : ""}
${blockContext.blockId ? `CURRENT BLOCK CONTEXT: blockId=${blockContext.blockId}, type=${blockContext.blockType}` : ""}

SEARCH STRATEGY - Use BOTH STRUCTURED SEARCH AND UNSTRUCTURED/RAG search for comprehensive results. ALWAYS READ THE QUERY, AND DECIDE WHETHER ITS ASKING ABOUT STRUCTURED, UNSTRUCTURED, OR A COMBINATION OF BOTH:
1. STRUCTURED SEARCH (searchTasks, searchProjects, searchDocs, searchTables, etc.)
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
2. CREATE BLOCKS on the page with findings
3. Your chat response should briefly summarize what you added: "I've added a table showing 12 campaigns and a summary of top performers."`,
    },
  ];

  const allowTaskMutations = isTaskMutationCommand(params.command, recentHistoryText);
  const allowEntityMutations = isExplicitEntityMutationCommand(params.command);
  const allowedWriteTools = [
    "createBlock",
    "updateBlock",
    "updateTableFull",
    "updateTableRowsByFieldNames",
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

  const mergedUndoBatches: UndoBatch[] = Array.isArray(result.undoBatches) ? [...result.undoBatches] : [];
  const mergedSkipped = Array.isArray(result.undoSkippedTools) ? [...result.undoSkippedTools] : [];

  const createdBlockIds = extractCreatedBlockIds(result.toolCallsMade);
  let finalResponse = result.response;

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

  // Guarantee the workflow page renders something: if the AI didn't create any blocks
  // AND didn't execute any successful tool calls, persist the assistant response as a text block.
  // Skip this if the LLM performed actions (like deleting a table) - those should only show in chat.
  const hadSuccessfulToolCall = (result.toolCallsMade || []).some(
    (call) => call?.result?.success
  );
  if (createdBlockIds.length === 0 && finalResponse.trim().length > 0 && !hadSuccessfulToolCall) {
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
}): AsyncGenerator<{
  type: "thinking" | "tool_call" | "tool_result" | "response_delta" | "response";
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

YOUR PRIMARY JOB: Create BLOCKS on the page to display results, not just respond in chat.

BLOCK CREATION:
- Use createBlock({ type: "text" }) for prose, summaries, and analysis
- Use createTableFull({ title: "...", rows: [...] }) for tabular data - the title IS the heading
- Use createChartBlock() for visualizations
- For tasks, prefer: searchTasks → createTableFull(...) to list results (use a task board only if the user explicitly asks for a board)
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

IMPORTANT SAFETY:
- Do NOT modify existing tasks, projects, or data unless the user explicitly asks you to update/delete/move/assign.
- For read-only requests, only use search/analysis tools and create display blocks (text/table/chart).
- Use conversation history to resolve references like "that", "those", "previous", "above", "earlier" and update the most recent relevant block instead of creating new ones.
- If the user refers to "that table", "this table", or "the table above", UPDATE the existing table (use updateTableFull / updateTableRowsByFieldNames). Do NOT create a new table.
- If a field like Priority/Status is missing in source data, fill with "Unspecified" rather than leaving blanks.
${tableContext.tableId ? `CURRENT TABLE CONTEXT: tableId=${tableContext.tableId}, blockId=${tableContext.blockId}` : ""}
${blockContext.blockId ? `CURRENT BLOCK CONTEXT: blockId=${blockContext.blockId}, type=${blockContext.blockType}` : ""}

SEARCH STRATEGY - Use BOTH STRUCTURED SEARCH AND UNSTRUCTURED/RAG search for comprehensive results. ALWAYS READ THE QUERY, AND DECIDE WHETHER ITS ASKING ABOUT STRUCTURED, UNSTRUCTURED, OR A COMBINATION OF BOTH:
1. STRUCTURED SEARCH (searchTasks, searchProjects, searchDocs, searchTables, etc.)
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
2. CREATE BLOCKS on the page with findings
3. Your chat response should briefly summarize what you added: "I've added a table showing 12 campaigns and a summary of top performers."`,
    },
  ];

  const allowTaskMutations = isTaskMutationCommand(params.command, recentHistoryText);
  const allowEntityMutations = isExplicitEntityMutationCommand(params.command);
  const allowedWriteTools = [
    "createBlock",
    "updateBlock",
    "updateTableFull",
    "updateTableRowsByFieldNames",
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
    }
  );

  let finalEvent: { content: string; data?: unknown } | null = null;

  for await (const event of stream) {
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
  const mergedUndoBatches: UndoBatch[] = Array.isArray(payload.undoBatches)
    ? [...(payload.undoBatches as UndoBatch[])]
    : [];
  const mergedSkipped: string[] = Array.isArray(payload.undoSkippedTools)
    ? [...(payload.undoSkippedTools as string[])]
    : [];

  const createdBlockIds = extractCreatedBlockIds(toolCallsMade);
  let finalResponse = finalEvent.content || "";

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

  // Only create a text block if the AI didn't create blocks AND didn't execute any actions
  const hadSuccessfulToolCall = (toolCallsMade || []).some(
    (call) => call?.result?.success
  );
  if (createdBlockIds.length === 0 && finalResponse.trim().length > 0 && !hadSuccessfulToolCall) {
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
