import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeAICommand, type AIMessage, type ExecutionResult } from "@/lib/ai/executor";
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
    if (!["createBlock", "createChartBlock", "createTaskBoardFromTasks", "createTableFull"].includes(tool)) continue;
    const data = call.result.data;
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    if (tool === "createTableFull") {
      const blockId = obj?.blockId;
      if (typeof blockId === "string" && blockId.length > 0) ids.push(blockId);
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
    { workspaceId: params.workspaceId, userId: params.userId, currentTabId: params.tabId, currentProjectId: params.projectId }
  );

  return toolResult;
}

export async function executeWorkflowAICommand(params: {
  tabId: string;
  command: string;
}): Promise<WorkflowExecutionResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      success: false,
      response: "Unauthorized",
      toolCallsMade: [],
      createdBlockIds: [],
      sessionId: "",
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

  const systemPrefix: AIMessage[] = [
    {
      role: "system",
      content: `You are building a Workflow Page - a persistent document made of blocks.

YOUR PRIMARY JOB: Create BLOCKS on the page to display results, not just respond in chat.

BLOCK CREATION:
- Use createBlock({ type: "text" }) for prose, summaries, and analysis
- Use createTableFull({ title: "...", rows: [...] }) for tabular data - the title IS the heading
- Use createChartBlock() for visualizations
- For tasks, prefer: searchTasks → createTaskBoardFromTasks({ taskIds, boardGroupBy }) to render a live board/list on the page
- Target the current workflow tab (tabId: ${params.tabId}) for all blocks

SEARCH STRATEGY - Use BOTH search types for comprehensive results:
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
1. Search/analyze data as needed (use fallback if no results)
2. CREATE BLOCKS on the page with findings
3. Your chat response should briefly summarize what you added: "I've added a table showing 12 campaigns and a summary of top performers."`,
    },
  ];

  const result = await executeAICommand(
    params.command,
    {
      workspaceId: session.workspace_id,
      workspaceName,
      userId: user.id,
      userName,
      currentProjectId,
      currentTabId: params.tabId,
    },
    [...systemPrefix, ...conversationHistory],
    {
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

  // Guarantee the workflow page renders something: if the AI didn't create any blocks,
  // persist the assistant response as a text block.
  if (createdBlockIds.length === 0 && finalResponse.trim().length > 0) {
    const blockResult = await createBlock({
      tabId: params.tabId,
      type: "text",
      content: { text: finalResponse },
    });
    if (!("error" in blockResult) && blockResult.data?.id) {
      createdBlockIds.push(blockResult.data.id);
    }
  }

  await addWorkflowMessage({
    sessionId: session.id,
    role: "assistant",
    content: {
      text: finalResponse,
      toolCallsMade: result.toolCallsMade,
    },
    createdBlockIds,
  });

  return {
    success: result.success,
    response: finalResponse,
    toolCallsMade: result.toolCallsMade,
    createdBlockIds,
    sessionId: session.id,
    error: result.error,
  };
}
