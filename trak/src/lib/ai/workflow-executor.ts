import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { executeAICommand, type AIMessage, type ExecutionResult } from "@/lib/ai/executor";
import { getOrCreateWorkflowSession, addWorkflowMessage, getWorkflowSessionMessages } from "@/app/actions/workflow-session";
import { createBlock } from "@/app/actions/block";

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
    if (!["createBlock", "createChartBlock", "createTaskBoardFromTasks"].includes(tool)) continue;
    const data = call.result.data;
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const id = obj?.id;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  return Array.from(new Set(ids));
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
    }
  );

  const createdBlockIds = extractCreatedBlockIds(result.toolCallsMade);

  // Guarantee the workflow page renders something: if the AI didn't create any blocks,
  // persist the assistant response as a text block.
  if (createdBlockIds.length === 0 && result.response.trim().length > 0) {
    const blockResult = await createBlock({
      tabId: params.tabId,
      type: "text",
      content: { text: result.response },
    });
    if (!("error" in blockResult) && blockResult.data?.id) {
      createdBlockIds.push(blockResult.data.id);
    }
  }

  await addWorkflowMessage({
    sessionId: session.id,
    role: "assistant",
    content: {
      text: result.response,
      toolCallsMade: result.toolCallsMade,
    },
    createdBlockIds,
  });

  return {
    success: result.success,
    response: result.response,
    toolCallsMade: result.toolCallsMade,
    createdBlockIds,
    sessionId: session.id,
    error: result.error,
  };
}
