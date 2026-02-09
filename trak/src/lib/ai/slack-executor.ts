import { createClient as createServiceClient } from "@supabase/supabase-js";
import { executeAICommand, type ExecutionResult, type AIMessage } from "@/lib/ai/executor";
import type { AuthContext } from "@/lib/auth-context";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface SlackExecutionResult {
  success: boolean;
  response: string;
  toolCallsMade: ExecutionResult["toolCallsMade"];
  needsContext?: {
    type: "project" | "tab";
    options: Array<{ id: string; name: string }>;
    originalCommand?: string;
  };
  error?: string;
}

export interface SlackAICommandParams {
  command: string;
  workspaceId: string;
  userId: string;
  projectId?: string; // Optional context from interactive selection
  tabId?: string;
}

/**
 * Executes an AI command optimized for Slack
 * - Detects missing project/tab context and prompts user
 * - Returns concise text summaries (no block creation)
 * - Uses limited tool groups (core, task, project, doc)
 * - Read-only by default for safety
 */
export async function executeSlackAICommand(
  params: SlackAICommandParams
): Promise<SlackExecutionResult> {
  try {
    const supabase = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Get workspace metadata
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", params.workspaceId)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", params.userId)
      .single();

    const workspaceName = workspace?.name;
    const userName = profile?.name || profile?.email;

    // 2. Detect if command needs project/tab context
    const needsProjectContext = /\b(create|add|new)\s+(task|table|doc|timeline)\b/i.test(
      params.command
    );

    if (needsProjectContext && !params.projectId) {
      // Fetch projects and ask user to select
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", params.workspaceId)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!projects || projects.length === 0) {
        return {
          success: false,
          response: "No projects found. Please create a project in Trak first.",
          toolCallsMade: [],
          error: "No projects available",
        };
      }

      return {
        success: false,
        response: "Which project should I create this in?",
        toolCallsMade: [],
        needsContext: {
          type: "project",
          options: projects.map((p) => ({ id: p.id, name: p.name })),
          originalCommand: params.command,
        },
      };
    }

    // 3. Build system prompt for Slack
    const systemPrefix: AIMessage[] = [
      {
        role: "system",
        content: `You are Trak AI, responding to a Slack slash command.

IMPORTANT CONSTRAINTS:
- You CANNOT create blocks or visual artifacts (this is Slack, not a Trak page)
- Respond with concise text summaries (1-3 sentences maximum)
- For creation commands, execute the action and confirm completion
- For search/query commands, return a brief summary (not full details)
- If context is missing (project/tab), the system will ask the user to specify

AVAILABLE TOOLS:
- Search: searchTasks, searchProjects, searchDocs, searchTables, unstructuredSearchWorkspace
- Create: createTaskItem, createProject, createDoc (ONLY if user explicitly requests creation)
- Update: updateTaskItem, updateProject (ONLY if user explicitly requests updates)
- Read: getTaskDetails, getProjectDetails, searchAll

RESPONSE PATTERN:
1. Execute tool(s) as needed
2. Return a short confirmation or summary (suitable for Slack)
3. Keep responses under 200 characters when possible

Examples:
- Command: "/trak search overdue tasks"
  Response: "Found 5 overdue tasks: Fix login bug (due 2 days ago), Update docs (due yesterday), ..."

- Command: "/trak create task Review Q1 report"
  Response: "✅ Created task 'Review Q1 report' in ${params.projectId ? 'current project' : 'the selected project'}"

- Command: "/trak show projects for client Acme"
  Response: "3 projects for Acme: Website Redesign, Mobile App, Cloud Migration"

REMEMBER: Be concise. This is Slack, not a detailed report.`,
      },
    ];

    // 4. Create AuthContext with service client (bypasses RLS for Slack commands)
    const authContext: AuthContext = {
      supabase,
      userId: params.userId,
      workspaceId: params.workspaceId,
    };

    // 5. Execute AI command with restricted tool groups and read-only by default
    const allowMutations = needsProjectContext || /\b(update|edit|change|set|mark|complete)\b/i.test(params.command);

    const allowedWriteTools = allowMutations
      ? ["createTaskItem", "updateTaskItem", "createProject", "updateProject", "createDoc"]
      : [];

    const result = await executeAICommand(
      params.command,
      {
        workspaceId: params.workspaceId,
        workspaceName,
        userId: params.userId,
        userName,
        currentProjectId: params.projectId,
        currentTabId: params.tabId,
        authContext, // Pass service client for Slack commands
      },
      systemPrefix,
      {
        readOnly: !allowMutations,
        allowedWriteTools,
        forcedToolGroups: ["core", "task", "project", "doc"], // Limited tool set for Slack
        disableDeterministic: false, // Allow deterministic routing for speed
        disableOptimisticEarlyExit: false,
      }
    );

    return {
      success: result.success,
      response: result.response,
      toolCallsMade: result.toolCallsMade,
      error: result.error,
    };
  } catch (error) {
    console.error("Error in executeSlackAICommand:", error);
    return {
      success: false,
      response: "An unexpected error occurred while processing your command.",
      toolCallsMade: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
