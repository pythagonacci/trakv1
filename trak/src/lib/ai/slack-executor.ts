import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAICommand, type ExecutionResult, type AIMessage } from "@/lib/ai/executor";
import type { AuthContext } from "@/lib/auth-context";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SLACK_ALLOWED_TABLES = new Set<string>([
  "workspace_members",
  "projects",
  "clients",
  "tabs",
  "blocks",
  "docs",
  "tables",
  "table_fields",
  "table_views",
  "table_rows",
  "task_items",
  "task_subtasks",
  "task_comments",
  "task_assignees",
  "task_tags",
  "task_tag_links",
  "files",
  "file_attachments",
  "file_analysis_artifacts",
  "file_analysis_chunks",
  "file_analysis_session_files",
  "unstructured_parents",
  "unstructured_chunks",
  "entity_properties",
  "entity_links",
  "timeline_events",
  "comments",
  "payments",
  "profiles",
]);

const SLACK_WORKSPACE_SCOPED_TABLES = new Set<string>([
  "workspace_members",
  "projects",
  "clients",
  "docs",
  "tables",
  "table_fields",
  "table_views",
  "table_rows",
  "task_items",
  "task_tags",
  "files",
  "file_attachments",
  "file_analysis_artifacts",
  "file_analysis_chunks",
  "file_analysis_session_files",
  "unstructured_parents",
  "unstructured_chunks",
  "entity_properties",
  "entity_links",
  "timeline_events",
  "payments",
]);

const SLACK_TASK_SCOPED_TABLES = new Set<string>([
  "task_subtasks",
  "task_comments",
  "task_assignees",
  "task_tag_links",
]);

const SLACK_COMMENT_TABLES = new Set<string>(["comments"]);
const SLACK_ALLOWED_READONLY_RPCS = new Set<string>([
  "match_unstructured_parents",
]);

type TaskScopeState = {
  taskIds: Set<string>;
  projectIds: Set<string>;
  tabIds: Set<string>;
  rowIds: Set<string>;
  payloadTaskIds: Set<string>;
  payloadProjectIds: Set<string>;
  payloadTabIds: Set<string>;
  hasWorkspaceJoinFilter: boolean;
  hasProjectWorkspaceJoinFilter: boolean;
  hasTabWorkspaceJoinFilter: boolean;
  hasWriteAttempt: boolean;
};

function collectIds(value: unknown, sink: Set<string>) {
  if (typeof value === "string") {
    sink.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === "string") sink.add(entry);
    });
  }
}

async function guardTaskScopedTable(params: {
  base: SupabaseClient;
  table: string;
  workspaceId: string;
  state: TaskScopeState;
}) {
  const { base, table, workspaceId, state } = params;
  if (state.hasWorkspaceJoinFilter) return;

  const taskIds = new Set<string>([
    ...state.taskIds,
    ...state.payloadTaskIds,
  ]);

  if (taskIds.size === 0 && state.rowIds.size > 0) {
    const { data, error } = await base
      .from(table)
      .select("task_id")
      .in("id", Array.from(state.rowIds));
    if (error) {
      throw new Error(`Slack scope check failed for ${table}: ${error.message}`);
    }
    (data ?? []).forEach((row: any) => {
      if (row?.task_id) taskIds.add(row.task_id);
    });
  }

  if (taskIds.size === 0) {
    throw new Error(`Slack scoped client requires task scoping for ${table}.`);
  }

  const { data: tasks, error: taskError } = await base
    .from("task_items")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", Array.from(taskIds));

  if (taskError) {
    throw new Error(`Slack scope check failed for task_items: ${taskError.message}`);
  }

  if ((tasks ?? []).length !== taskIds.size) {
    throw new Error("Slack scope check failed: task outside workspace.");
  }
}

async function guardTabScopedTable(params: {
  base: SupabaseClient;
  workspaceId: string;
  state: TaskScopeState;
}) {
  const { base, workspaceId, state } = params;
  if (state.hasProjectWorkspaceJoinFilter) return;

  const projectIds = new Set<string>([
    ...state.projectIds,
    ...state.payloadProjectIds,
  ]);

  if (projectIds.size === 0 && state.rowIds.size > 0) {
    const { data, error } = await base
      .from("tabs")
      .select("project_id")
      .in("id", Array.from(state.rowIds));
    if (error) {
      throw new Error(`Slack scope check failed for tabs: ${error.message}`);
    }
    (data ?? []).forEach((row: any) => {
      if (row?.project_id) projectIds.add(row.project_id);
    });
  }

  if (projectIds.size === 0) {
    throw new Error("Slack scoped client requires project scoping for tabs.");
  }

  const { data: projects, error: projectError } = await base
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", Array.from(projectIds));
  if (projectError) {
    throw new Error(`Slack scope check failed for tabs/projects: ${projectError.message}`);
  }
  if ((projects ?? []).length !== projectIds.size) {
    throw new Error("Slack scope check failed: tab outside workspace.");
  }
}

async function guardBlockScopedTable(params: {
  base: SupabaseClient;
  workspaceId: string;
  state: TaskScopeState;
}) {
  const { base, workspaceId, state } = params;
  if (state.hasTabWorkspaceJoinFilter) return;

  const tabIds = new Set<string>([
    ...state.tabIds,
    ...state.payloadTabIds,
  ]);

  if (tabIds.size === 0 && state.rowIds.size > 0) {
    const { data, error } = await base
      .from("blocks")
      .select("tab_id")
      .in("id", Array.from(state.rowIds));
    if (error) {
      throw new Error(`Slack scope check failed for blocks: ${error.message}`);
    }
    (data ?? []).forEach((row: any) => {
      if (row?.tab_id) tabIds.add(row.tab_id);
    });
  }

  if (tabIds.size === 0) {
    throw new Error("Slack scoped client requires tab scoping for blocks.");
  }

  const { data: tabs, error: tabError } = await base
    .from("tabs")
    .select("id, projects!inner(workspace_id)")
    .in("id", Array.from(tabIds))
    .eq("projects.workspace_id", workspaceId);
  if (tabError) {
    throw new Error(`Slack scope check failed for blocks/tabs: ${tabError.message}`);
  }
  if ((tabs ?? []).length !== tabIds.size) {
    throw new Error("Slack scope check failed: block outside workspace.");
  }
}

async function filterCommentsToWorkspace(
  base: SupabaseClient,
  workspaceId: string,
  comments: Array<any>
) {
  const projectIds = comments
    .filter((c) => c?.target_type === "project")
    .map((c) => c?.target_id)
    .filter(Boolean);
  const tabIds = comments
    .filter((c) => c?.target_type === "tab")
    .map((c) => c?.target_id)
    .filter(Boolean);
  const blockIds = comments
    .filter((c) => c?.target_type === "block")
    .map((c) => c?.target_id)
    .filter(Boolean);

  const validProjectIds = new Set<string>();
  const validTabIds = new Set<string>();
  const validBlockIds = new Set<string>();

  if (projectIds.length > 0) {
    const { data, error } = await base
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("id", projectIds);
    if (error) {
      throw new Error(`Slack comments scope check failed: ${error.message}`);
    }
    (data ?? []).forEach((row: any) => {
      if (row?.id) validProjectIds.add(row.id);
    });
  }

  if (tabIds.length > 0) {
    const { data, error } = await base
      .from("tabs")
      .select("id, projects!inner(workspace_id)")
      .in("id", tabIds)
      .eq("projects.workspace_id", workspaceId);
    if (error) {
      throw new Error(`Slack comments scope check failed: ${error.message}`);
    }
    (data ?? []).forEach((row: any) => {
      if (row?.id) validTabIds.add(row.id);
    });
  }

  if (blockIds.length > 0) {
    const { data, error } = await base
      .from("blocks")
      .select("id, tabs!inner(projects!inner(workspace_id))")
      .in("id", blockIds)
      .eq("tabs.projects.workspace_id", workspaceId);
    if (error) {
      throw new Error(`Slack comments scope check failed: ${error.message}`);
    }
    (data ?? []).forEach((row: any) => {
      if (row?.id) validBlockIds.add(row.id);
    });
  }

  return comments.filter((comment) => {
    if (comment?.target_type === "project") {
      return validProjectIds.has(comment.target_id);
    }
    if (comment?.target_type === "tab") {
      return validTabIds.has(comment.target_id);
    }
    if (comment?.target_type === "block") {
      return validBlockIds.has(comment.target_id);
    }
    return false;
  });
}

function createSlackScopedServiceClient(params: {
  workspaceId: string;
  memberUserIds: string[];
}) {
  const base = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { workspaceId, memberUserIds } = params;

  const profileIds =
    memberUserIds.length > 0
      ? memberUserIds
      : ["00000000-0000-0000-0000-000000000000"];

  const wrapBuilder = (
    builder: any,
    table: string,
    scopeMode: "workspace" | "profiles" | "custom" = "custom"
  ) => {
    const taskScopeState: TaskScopeState = {
      taskIds: new Set(),
      projectIds: new Set(),
      tabIds: new Set(),
      rowIds: new Set(),
      payloadTaskIds: new Set(),
      payloadProjectIds: new Set(),
      payloadTabIds: new Set(),
      hasWorkspaceJoinFilter: false,
      hasProjectWorkspaceJoinFilter: false,
      hasTabWorkspaceJoinFilter: false,
      hasWriteAttempt: false,
    };

    const handler: ProxyHandler<any> = {
      get(target, prop, receiver) {
        if (prop === "then") {
          return (onFulfilled: any, onRejected: any) => {
            const guard = async () => {
              if (SLACK_TASK_SCOPED_TABLES.has(table)) {
                await guardTaskScopedTable({
                  base,
                  table,
                  workspaceId,
                  state: taskScopeState,
                });
              }
              if (table === "tabs") {
                await guardTabScopedTable({
                  base,
                  workspaceId,
                  state: taskScopeState,
                });
              }
              if (table === "blocks") {
                await guardBlockScopedTable({
                  base,
                  workspaceId,
                  state: taskScopeState,
                });
              }
              if (SLACK_COMMENT_TABLES.has(table)) {
                if (taskScopeState.hasWriteAttempt) {
                  throw new Error("Slack scoped client blocks comment writes.");
                }
              }
            };

            const guardedResult = guard().then(() =>
              target.then(async (result: any) => {
                if (SLACK_COMMENT_TABLES.has(table) && result?.data) {
                  if (Array.isArray(result.data)) {
                    const filtered = await filterCommentsToWorkspace(base, workspaceId, result.data);
                    return { ...result, data: filtered };
                  }
                  const filtered = await filterCommentsToWorkspace(base, workspaceId, [result.data]);
                  return { ...result, data: filtered[0] ?? null };
                }
                return result;
              })
            );

            return guardedResult.then(onFulfilled, onRejected);
          };
        }

        if (prop === "eq") {
          return (column: string, value: unknown) => {
            if (column === "task_id") collectIds(value, taskScopeState.taskIds);
            if (column === "project_id") collectIds(value, taskScopeState.projectIds);
            if (column === "tab_id") collectIds(value, taskScopeState.tabIds);
            if (column === "id") collectIds(value, taskScopeState.rowIds);
            if (column === "task_items.workspace_id" && value === workspaceId) {
              taskScopeState.hasWorkspaceJoinFilter = true;
            }
            if (column === "projects.workspace_id" && value === workspaceId) {
              taskScopeState.hasProjectWorkspaceJoinFilter = true;
            }
            if (column === "tabs.projects.workspace_id" && value === workspaceId) {
              taskScopeState.hasTabWorkspaceJoinFilter = true;
            }
            return new Proxy(target.eq(column, value), handler);
          };
        }

        if (prop === "in") {
          return (column: string, value: unknown[]) => {
            if (column === "task_id") collectIds(value, taskScopeState.taskIds);
            if (column === "project_id") collectIds(value, taskScopeState.projectIds);
            if (column === "tab_id") collectIds(value, taskScopeState.tabIds);
            if (column === "id") collectIds(value, taskScopeState.rowIds);
            if (column === "task_items.workspace_id" && value?.length === 1 && value[0] === workspaceId) {
              taskScopeState.hasWorkspaceJoinFilter = true;
            }
            if (column === "projects.workspace_id" && value?.length === 1 && value[0] === workspaceId) {
              taskScopeState.hasProjectWorkspaceJoinFilter = true;
            }
            if (column === "tabs.projects.workspace_id" && value?.length === 1 && value[0] === workspaceId) {
              taskScopeState.hasTabWorkspaceJoinFilter = true;
            }
            return new Proxy(target.in(column, value), handler);
          };
        }

        if (prop === "insert" || prop === "upsert") {
          return (payload: any, ...args: any[]) => {
            taskScopeState.hasWriteAttempt = true;
            const rows = Array.isArray(payload) ? payload : [payload];
            const scopedRows = rows.map((row) => {
              if (scopeMode === "workspace") {
                if (
                  row &&
                  typeof row === "object" &&
                  "workspace_id" in row &&
                  row.workspace_id &&
                  row.workspace_id !== workspaceId
                ) {
                  throw new Error(`Slack scoped client blocks cross-workspace write for ${table}.`);
                }
                return { ...row, workspace_id: workspaceId };
              }
              if (scopeMode === "profiles") {
                throw new Error("Slack scoped client blocks profile writes.");
              }
              return row;
            });
            scopedRows.forEach((row) => {
              if (row?.task_id) taskScopeState.payloadTaskIds.add(row.task_id);
              if (row?.project_id) taskScopeState.payloadProjectIds.add(row.project_id);
              if (row?.tab_id) taskScopeState.payloadTabIds.add(row.tab_id);
            });
            const result = (target as any)[prop](Array.isArray(payload) ? scopedRows : scopedRows[0], ...args);
            return new Proxy(result, handler);
          };
        }

        if (prop === "update" || prop === "delete") {
          return (...args: any[]) => {
            taskScopeState.hasWriteAttempt = true;
            const result = (target as any)[prop](...args);
            const scopedResult = scopeMode === "workspace"
              ? result.eq("workspace_id", workspaceId)
              : scopeMode === "profiles"
                ? result.in("id", profileIds)
                : result;
            return new Proxy(scopedResult, handler);
          };
        }

        if (prop === "select") {
          return (...args: any[]) => {
            const result = (target as any)[prop](...args);
            const scopedResult = scopeMode === "workspace"
              ? result.eq("workspace_id", workspaceId)
              : scopeMode === "profiles"
                ? result.in("id", profileIds)
                : result;
            return new Proxy(scopedResult, handler);
          };
        }

        if (prop === "maybeSingle" || prop === "single") {
          return (...args: any[]) => {
            const result = (target as any)[prop](...args);
            return new Proxy(result, handler);
          };
        }

        if (typeof (target as any)[prop] === "function") {
          return (...args: any[]) => {
            const result = (target as any)[prop](...args);
            if (result && typeof result === "object" && "then" in result) {
              return new Proxy(result, handler);
            }
            return result;
          };
        }

        return Reflect.get(target, prop, receiver);
      },
    };

    return new Proxy(builder, handler);
  };

  const from = (table: string) => {
    if (!SLACK_ALLOWED_TABLES.has(table)) {
      throw new Error(`Slack scoped client blocked table: ${table}`);
    }

    if (table === "profiles") {
      return wrapBuilder(base.from(table), table, "profiles");
    }

    if (SLACK_WORKSPACE_SCOPED_TABLES.has(table)) {
      return wrapBuilder(base.from(table), table, "workspace");
    }

    return wrapBuilder(base.from(table), table, "custom");
  };

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol") return Reflect.get(target, prop, receiver);
      if (prop === "from") return from;
      if (prop === "rpc") {
        return (fn: string, args?: Record<string, unknown>) => {
          if (typeof fn === "string" && SLACK_ALLOWED_READONLY_RPCS.has(fn)) {
            return (target as any).rpc(fn, args);
          }

          const blockedFn = typeof fn === "string" && fn.length > 0 ? fn : "unknown";
          const message = `Slack scoped client blocks rpc() access for function: ${blockedFn}`;
          return Promise.resolve({
            data: null,
            error: {
              message,
              code: "SLACK_RPC_BLOCKED",
              details: null,
              hint: null,
            },
          });
        };
      }
      if (prop === "auth" || prop === "storage" || prop === "functions" || prop === "realtime") {
        throw new Error(`Slack scoped client blocks ${String(prop)} access.`);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient;
}

export interface SlackExecutionResult {
  success: boolean;
  response: string;
  toolCallsMade: ExecutionResult["toolCallsMade"];
  needsContext?: {
    type: "project" | "tab";
    options: Array<{ id: string; name: string }>;
    originalCommand?: string;
    contextId?: string;
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

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", params.workspaceId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (membershipError) {
      return {
        success: false,
        response: "Unable to verify workspace membership.",
        toolCallsMade: [],
        error: membershipError.message,
      };
    }

    if (!membership) {
      return {
        success: false,
        response: "❌ You are not a member of this workspace.",
        toolCallsMade: [],
        error: "User not in workspace",
      };
    }

    const { data: memberRows, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", params.workspaceId);

    if (membersError) {
      return {
        success: false,
        response: "Unable to load workspace members for Slack execution.",
        toolCallsMade: [],
        error: membersError.message,
      };
    }

    const memberUserIds = new Set<string>(
      (memberRows ?? []).map((row: any) => row.user_id).filter(Boolean)
    );
    memberUserIds.add(params.userId);

    const scopedSupabase = createSlackScopedServiceClient({
      workspaceId: params.workspaceId,
      memberUserIds: Array.from(memberUserIds),
    });

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
    const requiresProjectAndTabContext = /\b(create|add|new)\b/i.test(
      params.command
    );

    if (requiresProjectAndTabContext && !params.projectId) {
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
          response: "No projects found. Please create a project in Saria first.",
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

    if (requiresProjectAndTabContext && params.projectId && !params.tabId) {
      const { data: tabs, error: tabsError } = await supabase
        .from("tabs")
        .select("id, name")
        .eq("project_id", params.projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50);

      if (tabsError) {
        return {
          success: false,
          response: "Unable to load tabs for the selected project.",
          toolCallsMade: [],
          error: tabsError.message,
        };
      }

      if (!tabs || tabs.length === 0) {
        return {
          success: false,
          response: "No tabs found in that project. Please create a tab in Saria first.",
          toolCallsMade: [],
          error: "No tabs available",
        };
      }

      return {
        success: false,
        response: "Which tab should I use?",
        toolCallsMade: [],
        needsContext: {
          type: "tab",
          options: tabs.map((t) => ({ id: t.id, name: t.name })),
          originalCommand: params.command,
        },
      };
    }

    // 3. Build system prompt for Slack
    const systemPrefix: AIMessage[] = [
      {
        role: "system",
        content: `You are Saria AI, responding to a Slack slash command.

IMPORTANT CONSTRAINTS:
- You CANNOT create blocks or visual artifacts (this is Slack, not a Saria page)
- Respond with concise text summaries (1-3 sentences maximum)
- For creation commands, execute the action and confirm completion
- For search/query commands, return a brief summary (not full details)
- If context is missing (project/tab), the system will ask the user to specify

AVAILABLE TOOLS:
- Search: searchTasks, searchSubtasks, getSubtaskDetails, searchProjects, searchDocs, searchTables, unstructuredSearchWorkspace
- Create: createTaskItem, createProject, createDoc (ONLY if user explicitly requests creation)
- Update: updateTaskItem, updateProject (ONLY if user explicitly requests updates)
- Read: getTaskDetails, getProjectDetails, searchAll

RESPONSE PATTERN:
1. Execute tool(s) as needed
2. Return a short confirmation or summary (suitable for Slack)
3. Keep responses under 200 characters when possible

Examples:
- Command: "/saria search overdue tasks"
  Response: "Found 5 overdue tasks: Fix login bug (due 2 days ago), Update docs (due yesterday), ..."

- Command: "/saria create task Review Q1 report"
  Response: "✅ Created task 'Review Q1 report' in ${params.projectId ? 'current project' : 'the selected project'}"

- Command: "/saria show projects for client Acme"
  Response: "3 projects for Acme: Website Redesign, Mobile App, Cloud Migration"

REMEMBER: Be concise. This is Slack, not a detailed report.`,
      },
    ];

    // 4. Create AuthContext with scoped service client (enforces workspace boundaries)
    const authContext: AuthContext = {
      supabase: scopedSupabase as Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
      userId: params.userId,
      workspaceId: params.workspaceId,
    };

    // 5. Execute AI command with restricted tool groups and read-only by default
    const allowMutations =
      requiresProjectAndTabContext ||
      /\b(create|add|new|update|edit|change|set|mark|complete|delete|remove|archive)\b/i.test(params.command);

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
