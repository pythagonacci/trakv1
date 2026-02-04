/**
 * Tool Executor for Prompt-to-Action AI
 *
 * This module maps tool calls from the AI to actual server action executions.
 * It handles parameter validation, action invocation, and result formatting.
 */

"use server";

// ============================================================================
// IMPORTS - Search Functions
// ============================================================================
import {
  searchTasks,
  searchProjects,
  searchClients,
  searchWorkspaceMembers,
  searchTabs,
  searchBlocks,
  searchDocs,
  searchDocContent,
  searchTables,
  searchTableRows,
  searchTimelineEvents,
  searchFiles,
  searchTags,
  searchAll,
  resolveEntityByName,
  getEntityById,
  getEntityContext,
  getTableSchema,
  getSearchContext,
  type SearchContextSuccess,
} from "@/app/actions/ai-search";

// ============================================================================
// IMPORTS - Task Actions
// ============================================================================
import {
  createTaskItem,
  updateTaskItem,
  deleteTaskItem,
  reorderTaskItems,
  bulkMoveTaskItems,
  bulkUpdateTaskItems,
  duplicateTasksToBlock,
} from "@/app/actions/tasks/item-actions";
import {
  createTaskFullRpc,
  updateTaskFullRpc,
  bulkUpdateTaskItemsRpc,
  bulkMoveTaskItemsRpc,
  bulkSetTaskAssigneesRpc,
  duplicateTasksToBlockRpc,
} from "@/app/actions/tasks/super-actions";
import { setTaskAssignees } from "@/app/actions/tasks/assignee-actions";
import { setTaskTags } from "@/app/actions/tasks/tag-actions";
import {
  createTaskSubtask,
  updateTaskSubtask,
  deleteTaskSubtask,
} from "@/app/actions/tasks/subtask-actions";
import { createTaskComment } from "@/app/actions/tasks/comment-actions";

// ============================================================================
// IMPORTS - Project Actions
// ============================================================================
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/app/actions/project";

// ============================================================================
// IMPORTS - Tab Actions
// ============================================================================
import { createTab, updateTab, deleteTab } from "@/app/actions/tab";

// ============================================================================
// IMPORTS - Block Actions
// ============================================================================
import {
  createBlock,
  updateBlock,
  deleteBlock,
  getTabBlocks,
} from "@/app/actions/block";
import { createChartBlock } from "@/app/actions/chart-actions";

// ============================================================================
// IMPORTS - File Actions
// ============================================================================
import { renameFile } from "@/app/actions/file";
import { ensureFileArtifact, ensureFileChunks, retrieveRelevantChunks, shouldUseRag, type FileRecord as FileAnalysisFileRecord } from "@/lib/file-analysis/service";
import { UnstructuredSearch } from "@/lib/search/query";

// ============================================================================
// IMPORTS - Indexing Actions
// ============================================================================
import { reindexWorkspaceContent } from "@/app/actions/indexing";

// ============================================================================
// IMPORTS - Table Actions
// ============================================================================
import { createTable, getTable, updateTable, deleteTable } from "@/app/actions/tables/table-actions";
import {
  createTableFullRpc,
  updateTableFullRpc,
  updateTableRowsByFieldNamesRpc,
  bulkUpdateRowsByFieldNamesRpc,
} from "@/app/actions/tables/super-actions";
import {
  createField,
  updateField,
  deleteField,
} from "@/app/actions/tables/field-actions";
import {
  createRow,
  updateRow,
  updateCell,
  deleteRow,
  deleteRows,
} from "@/app/actions/tables/row-actions";
import {
  bulkInsertRows,
  bulkUpdateRows,
} from "@/app/actions/tables/bulk-actions";
import { getTableRows } from "@/app/actions/tables/query-actions";

// ============================================================================
// IMPORTS - Timeline Actions
// ============================================================================
import {
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
} from "@/app/actions/timelines/event-actions";
import {
  createTimelineDependency,
  deleteTimelineDependency,
} from "@/app/actions/timelines/dependency-actions";
import type { TimelineEventStatus } from "@/types/timeline";

// ============================================================================
// IMPORTS - Property Actions
// ============================================================================
import {
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
} from "@/app/actions/properties/definition-actions";
import type { PropertyValue } from "@/types/properties";
import {
  setEntityProperty,
  removeEntityProperty,
} from "@/app/actions/properties/entity-property-actions";

// ============================================================================
// IMPORTS - Client Actions
// ============================================================================
import {
  createClient,
  updateClient,
  deleteClient,
} from "@/app/actions/client";

// ============================================================================
// IMPORTS - Doc Actions
// ============================================================================
import {
  createDoc,
  updateDoc,
  deleteDoc,
} from "@/app/actions/doc";

// ============================================================================
// IMPORTS - Comment Actions (for table rows)
// ============================================================================
import {
  createComment as createTableComment,
  updateComment as updateTableComment,
  deleteComment as deleteTableComment,
} from "@/app/actions/tables/comment-actions";

// ============================================================================
// IMPORTS - Workspace Context & Shared Auth
// ============================================================================
import { getCurrentWorkspaceId, setTestContext, clearTestContext } from "@/app/actions/workspace";
import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { aiDebug, aiTiming, isAITimingEnabled } from "./debug";

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
  hint?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionContext {
  workspaceId: string;
  userId?: string;
  contextTableId?: string;
  contextBlockId?: string;
  currentTabId?: string;
  currentProjectId?: string;
}

const shouldUseTestContext =
  process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_MODE === "true";

function summarizeToolArgs(args: Record<string, unknown>) {
  const keys = Object.keys(args || {});
  return {
    argCount: keys.length,
    argKeys: keys.slice(0, 10),
    truncatedKeys: Math.max(0, keys.length - 10),
  };
}

function summarizeToolResult(result: ToolCallResult) {
  const data = result.data;
  let dataType = "undefined";
  let dataCount: number | null = null;
  let dataKeys: number | null = null;

  if (Array.isArray(data)) {
    dataType = "array";
    dataCount = data.length;
  } else if (data && typeof data === "object") {
    dataType = "object";
    dataKeys = Object.keys(data as Record<string, unknown>).length;
  } else if (data === null) {
    dataType = "null";
  } else if (typeof data !== "undefined") {
    dataType = typeof data;
  }

  return {
    success: result.success,
    hasError: Boolean(result.error),
    dataType,
    dataCount,
    dataKeys,
    warningsCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
  };
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

/**
 * Execute a tool call and return the result.
 * This function maps tool names to their corresponding server actions.
 */
export async function executeTool(
  toolCall: ToolCall,
  context?: ToolExecutionContext
): Promise<ToolCallResult> {
  const { name, arguments: args } = toolCall;
  const t0 = performance.now();

  try {
    aiDebug("executeTool:start", { tool: name, ...summarizeToolArgs(args) });

    // If context is provided (test mode), set it globally for server actions to use
    if (shouldUseTestContext && context?.workspaceId && context?.userId) {
      await setTestContext(context.workspaceId, context.userId);
    }

    // Get workspace ID from context or from cookies (for backward compatibility)
    const workspaceId = context?.workspaceId || await getCurrentWorkspaceId();

    // Single shared auth per tool run — pass to all actions that accept authContext to avoid duplicate auth
    const authResult = await getAuthContext();
    const authContext: AuthContext | null =
      authResult && !("error" in authResult) ? authResult : null;

    switch (name) {
      // ==================================================================
      // CONTROL TOOLS
      // ==================================================================
      case "requestToolGroups": {
        const toolGroups = Array.isArray((args as any)?.toolGroups)
          ? ((args as any).toolGroups as unknown[])
            .map((group) => String(group))
            .filter((group) => group.length > 0)
          : [];
        const reason = typeof (args as any)?.reason === "string" ? ((args as any).reason as string) : undefined;
        return {
          success: true,
          data: { toolGroups, reason },
        };
      }

      // ==================================================================
      // WORKSPACE TOOLS
      // ==================================================================
      case "reindexWorkspaceContent":
        return await wrapResult(
          reindexWorkspaceContent({
            workspaceId: (args as any)?.workspaceId as string | undefined,
            includeBlocks: (args as any)?.includeBlocks as boolean | undefined,
            includeFiles: (args as any)?.includeFiles as boolean | undefined,
            maxItems: (args as any)?.maxItems as number | undefined,
            authContext: authContext ?? undefined,
          })
        );

      // ==================================================================
      // SEARCH TOOLS
      // ==================================================================
      case "searchTasks":
        return await wrapResult(searchTasks(args as any));

      case "searchProjects":
        return await wrapResult(searchProjects(args as any));

      case "searchClients":
        return await wrapResult(searchClients(args as any));

      case "searchWorkspaceMembers":
        return await wrapResult(searchWorkspaceMembers(args as any));

      case "searchTabs":
        return await wrapResult(searchTabs(args as any));

      case "searchBlocks":
        return await wrapResult(searchBlocks(args as any));

      case "searchDocs":
        return await wrapResult(searchDocs(args as any));

      case "searchDocContent":
        return await wrapResult(searchDocContent(args as any));

      case "searchTables":
        if (context?.contextTableId) {
          const schema = await getTableSchema({ tableId: context.contextTableId });
          if (!schema.error && schema.data) {
            return {
              success: true,
              data: [
                {
                  id: schema.data.id,
                  title: schema.data.title,
                  description: schema.data.description ?? null,
                  icon: null,
                  workspace_id: workspaceId,
                  project_id: schema.data.project_id,
                  project_name: schema.data.project_name ?? null,
                  created_at: null,
                  updated_at: null,
                },
              ],
            };
          }
        }
        if (context?.currentTabId) {
          const tabBlocks = await getTabBlocks(context.currentTabId, { authContext: authContext ?? undefined });
          const tableIds = (tabBlocks.data ?? [])
            .filter((block) => block.type === "table")
            .map((block) => String((block.content as Record<string, unknown> | undefined)?.tableId || ""))
            .filter((tableId) => tableId.length > 0);

          if (tableIds.length > 0) {
            const schemas = await Promise.all(
              Array.from(new Set(tableIds)).map(async (tableId) => ({
                tableId,
                schema: await getTableSchema({ tableId }),
              }))
            );

            const mapped = schemas
              .filter((entry) => !entry.schema.error && entry.schema.data)
              .map((entry) => {
                const schema = entry.schema.data!;
                return {
                  id: schema.id,
                  title: schema.title,
                  description: schema.description ?? null,
                  icon: null,
                  workspace_id: workspaceId,
                  project_id: schema.project_id,
                  project_name: schema.project_name ?? null,
                  created_at: null,
                  updated_at: null,
                };
              });

            const searchText = String((args as Record<string, unknown>)?.searchText || "").trim().toLowerCase();
            if (searchText.length > 0) {
              const filtered = mapped.filter((table) =>
                table.title.toLowerCase().includes(searchText)
              );
              if (filtered.length > 0) {
                return { success: true, data: filtered };
              }
            } else if (mapped.length > 0) {
              return { success: true, data: mapped };
            }
          }
        }
        return await wrapResult(searchTables(args as any));

      case "searchTableRows":
        return await wrapResult(searchTableRows(args as any));

      case "searchTimelineEvents":
        return await wrapResult(searchTimelineEvents(args as any));

      case "searchFiles":
        return await wrapResult(searchFiles(args as any));

      case "unstructuredSearchWorkspace": {
        const query = String((args as any)?.query || "").trim();
        if (!query) return { success: false, error: "Missing query for unstructuredSearchWorkspace" };
        const limitParents = typeof (args as any)?.limitParents === "number" ? (args as any).limitParents : 10;
        const limitChunks = typeof (args as any)?.limitChunks === "number" ? (args as any).limitChunks : 5;
        if (!authContext?.supabase) return { success: false, error: "Unauthorized" };

        const searcher = new UnstructuredSearch(authContext.supabase);
        const results = await searcher.searchWorkspace(workspaceId, query);
        const trimmed = (results || []).slice(0, Math.max(1, limitParents)).map((result) => ({
          ...result,
          chunks: Array.isArray(result.chunks) ? result.chunks.slice(0, Math.max(1, limitChunks)) : [],
        }));
        return { success: true, data: trimmed };
      }

      case "searchTags":
        return await wrapResult(searchTags(args as any));

      case "searchAll":
        return await wrapResult(searchAll(args as any));

      case "resolveEntityByName":
        return await wrapResult(resolveEntityByName(args as any));

      case "getEntityById":
        return await wrapResult(getEntityById(args as any));

      case "getEntityContext":
        return await wrapResult(getEntityContext(args as any));

      case "getTableSchema":
        return await wrapResult(getTableSchema(args as any));

      // ==================================================================
      // TASK ACTIONS
      // ==================================================================
      case "createTaskItem":
        {
          const timing: Record<string, number> = {};
          const needBlock = !(args.taskBlockId as string);
          const assigneeArgs =
            Array.isArray(args.assignees) && args.assignees.length > 0
              ? args.assignees.map(a =>
                  isUuid(String(a)) ? { id: a, name: "Unknown" } : { name: String(a), id: undefined }
                )
              : [];
          const needAssignees = assigneeArgs.length > 0;

          let taskBlockId = args.taskBlockId as string;
          let resolvedAssignees: Array<{ id?: string | null; name?: string | null }> = [];

          let searchCtx: SearchContextSuccess | null = null;
          if (needBlock || needAssignees) {
            const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
            if (ctxResult.error !== null) {
              return { success: false, error: ctxResult.error };
            }
            searchCtx = { workspaceId: ctxResult.workspaceId, supabase: ctxResult.supabase, userId: ctxResult.userId };
          }

          if (needBlock && needAssignees && searchCtx) {
            const tResolve0 = performance.now();
            const [resolvedBlockId, resolveResult] = await Promise.all([
              resolveTaskBlockIdForCreateTask(context, args, searchCtx, authContext),
              resolveTaskAssignees(assigneeArgs, searchCtx),
            ]);
            timing.t_resolve_assignee_ms = Math.round(performance.now() - tResolve0);
            taskBlockId = resolvedBlockId ?? taskBlockId;
            if (resolveResult.ambiguities.length > 0) {
              const details = resolveResult.ambiguities.map(a => `"${a.input}"`).join(", ");
              return { success: false, error: `Ambiguous assignee names: ${details}. Please be more specific.` };
            }
            resolvedAssignees = resolveResult.resolved;
          } else if (needBlock) {
            const resolvedBlockId = await resolveTaskBlockIdForCreateTask(context, args, searchCtx ?? undefined, authContext);
            taskBlockId = resolvedBlockId ?? taskBlockId;
          } else if (needAssignees && searchCtx) {
            const tResolve0 = performance.now();
            const assigneeResult = await resolveTaskAssignees(assigneeArgs, searchCtx);
            timing.t_resolve_assignee_ms = Math.round(performance.now() - tResolve0);
            if (assigneeResult.ambiguities.length > 0) {
              const details = assigneeResult.ambiguities.map(a => `"${a.input}"`).join(", ");
              return { success: false, error: `Ambiguous assignee names: ${details}. Please be more specific.` };
            }
            resolvedAssignees = assigneeResult.resolved;
          }

          if (!taskBlockId) {
            return { success: false, error: "Missing taskBlockId and could not auto-resolve from context. Please provide a task block ID." };
          }

          const payload = {
            taskBlockId,
            title: args.title as string,
            status: args.status as any,
            priority: args.priority as any,
            description: args.description as string | undefined,
            dueDate: args.dueDate as string | undefined,
            dueTime: args.dueTime as string | undefined,
            startDate: args.startDate as string | undefined,
          };

          // ------------------------------------------------------------------
          // EXECUTION: Create -> Assign -> Tag
          // ------------------------------------------------------------------

          const rpcResult = await createTaskFullRpc({
            ...payload,
            assignees: resolvedAssignees,
            tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
            authContext: authContext ?? undefined,
          });
          if (!("error" in rpcResult)) {
            return { success: true, data: rpcResult.data };
          }

          const directResult = await createTaskItem(payload, { timing, authContext: authContext ?? undefined });
          if (!("error" in directResult)) {
            const newTaskId = directResult.data.id;

            const postCreate: Promise<unknown>[] = [];
            if (resolvedAssignees.length > 0) {
              postCreate.push(setTaskAssignees(newTaskId, resolvedAssignees, { timing, replaceExisting: false, authContext: authContext ?? undefined }));
            }
            if (Array.isArray(args.tags) && args.tags.length > 0) {
              postCreate.push(setTaskTags(newTaskId, args.tags as string[], { authContext: authContext ?? undefined }));
            }
            if (postCreate.length > 0) await Promise.all(postCreate);

            aiDebug("createTaskItem:timing", {
              t_auth_ms: timing.t_auth_ms,
              t_ctx_ms: timing.t_ctx_ms,
              t_resolve_assignee_ms: timing.t_resolve_assignee_ms,
              t_insert_task_ms: timing.t_insert_task_ms,
              t_insert_assignees_ms: timing.t_insert_assignees_ms,
              t_fetch_return_ms: timing.t_fetch_return_ms,
            });
            return { success: true, data: directResult.data };
          }

          if (directResult.error === "Task block not found") {
            const tabResult = await getEntityById({
              entityType: "tab",
              id: taskBlockId,
            });

            if (!tabResult.error && tabResult.data) {
              // Reuse existing task block in this tab if available
              const existingBlocks = await searchBlocks({
                type: "task",
                tabId: taskBlockId,
                limit: 1,
              });
              const existingBlockId = existingBlocks.data?.[0]?.id;

              if (!existingBlockId) {
                const blockResult = await createBlock({
                  tabId: taskBlockId,
                  type: "task",
                  content: undefined,
                  authContext: authContext ?? undefined,
                });
                if ("error" in blockResult) {
                  return { success: false, error: blockResult.error ?? "Failed to create task block" };
                }

                const retryResult = await createTaskItem({
                  ...payload,
                  taskBlockId: blockResult.data.id,
                });

                if (!("error" in retryResult)) {
                  return { success: true, data: retryResult.data };
                }

                return { success: false, error: retryResult.error ?? "Failed to create task" };
              }

              const retryResult = await createTaskItem({
                ...payload,
                taskBlockId: existingBlockId,
              }, { authContext: authContext ?? undefined });

              if (!("error" in retryResult)) {
                return { success: true, data: retryResult.data };
              }

              return { success: false, error: retryResult.error ?? "Failed to create task" };
            }
          }

          if (directResult.error === "Block is not a task block") {
            const blockResult = await getEntityById({
              entityType: "block",
              id: taskBlockId,
            });

            const tabId = blockResult.data?.context?.tab_id;
            if (tabId) {
              const existingBlocks = await searchBlocks({
                type: "task",
                tabId,
                limit: 1,
              });
              const existingBlockId = existingBlocks.data?.[0]?.id;
              let taskBlockIdToUse = existingBlockId;

              if (!taskBlockIdToUse) {
                const blockResult = await createBlock({
                  tabId,
                  type: "task",
                  content: { title: "Tasks", hideIcons: false, viewMode: "list", boardGroupBy: "status" },
                  authContext: authContext ?? undefined,
                });
                if ("error" in blockResult) {
                  return { success: false, error: blockResult.error ?? "Failed to create task block" };
                }
                taskBlockIdToUse = blockResult.data?.id;
              }

              if (taskBlockIdToUse) {
                const retryResult = await createTaskItem({
                  ...payload,
                  taskBlockId: taskBlockIdToUse,
                }, { authContext: authContext ?? undefined });
                if (!("error" in retryResult)) {
                  return { success: true, data: retryResult.data };
                }
                return { success: false, error: retryResult.error ?? "Failed to create task" };
              }
            }
          }

          return { success: false, error: directResult.error ?? "Failed to create task" };
        }

      case "updateTaskItem":
        {
          let taskId = args.taskId as string;
          const lookupName = args.lookupName as string;

          // Latency Optimization: If taskId missing, find by name
          if (!taskId && lookupName) {
            const searchResult = await searchTasks({
              searchText: lookupName,
              limit: 5
            });

            if (!searchResult.error && searchResult.data) {
              // Filter for exact matches if possible, or take the best match
              const matches = searchResult.data;
              if (matches.length === 1) {
                taskId = matches[0].id;
              } else if (matches.length > 1) {
                // If multiple matches, try to find case-insensitive exact match
                const exact = matches.find(m => m.title.toLowerCase() === lookupName.toLowerCase());
                if (exact) {
                  taskId = exact.id;
                } else {
                  return {
                    success: false,
                    error: `Ambiguous task name. Found ${matches.length} tasks matching "${lookupName}". Please specify which one or use the exact title.`
                  };
                }
              } else {
                return { success: false, error: `Task "${lookupName}" not found.` };
              }
            }
          }

          if (!taskId) {
            return { success: false, error: "Missing taskId or valid lookupName." };
          }

          const baseUpdates: Record<string, unknown> = {};
          if (args.title !== undefined) baseUpdates.title = args.title as string | undefined;
          if (args.status !== undefined) baseUpdates.status = args.status as any;
          if (args.priority !== undefined) baseUpdates.priority = args.priority as any;
          if (args.description !== undefined) baseUpdates.description = args.description as string | null | undefined;
          if (args.dueDate !== undefined) baseUpdates.dueDate = args.dueDate as string | null | undefined;
          if (args.dueTime !== undefined) baseUpdates.dueTime = args.dueTime as string | null | undefined;
          if (args.startDate !== undefined) baseUpdates.startDate = args.startDate as string | null | undefined;

          const assigneesProvided = args.assignees !== undefined;
          const tagsProvided = args.tags !== undefined;
          let resolvedAssignees: Array<{ id?: string | null; name?: string | null }> = [];
          let searchCtx: SearchContextSuccess | null = null;

          if (assigneesProvided) {
            const assigneeArgs = Array.isArray(args.assignees) && args.assignees.length > 0
              ? args.assignees.map(a =>
                  isUuid(String(a)) ? { id: a, name: "Unknown" } : { name: String(a), id: undefined }
                )
              : [];

            const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
            if (ctxResult.error === null) {
              searchCtx = { workspaceId: ctxResult.workspaceId, supabase: ctxResult.supabase, userId: ctxResult.userId };
              const assigneeResult = await resolveTaskAssignees(assigneeArgs, searchCtx);
              if (assigneeResult.ambiguities.length > 0) {
                const details = assigneeResult.ambiguities.map(a => `"${a.input}"`).join(", ");
                return { success: false, error: `Ambiguous assignee names: ${details}. Please be more specific.` };
              }
              resolvedAssignees = assigneeResult.resolved;
            }
          }

          const hasRpcOps =
            Object.keys(baseUpdates).length > 0 ||
            assigneesProvided ||
            tagsProvided;

          if (hasRpcOps) {
            const rpcResult = await updateTaskFullRpc({
              taskId,
              updates: baseUpdates,
              assignees: resolvedAssignees,
              assigneesSet: assigneesProvided,
              tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
              tagsSet: tagsProvided,
              authContext: authContext ?? undefined,
            });
            if (!("error" in rpcResult)) {
              return { success: true, data: rpcResult.data };
            }
          }

          // Update base task properties
          const updateResult = await wrapResult(
            updateTaskItem(taskId, {
              title: args.title as string | undefined,
              status: args.status as any,
              priority: args.priority as any,
              description: args.description as string | null | undefined,
              dueDate: args.dueDate as string | null | undefined,
              dueTime: args.dueTime as string | null | undefined,
              startDate: args.startDate as string | null | undefined,
            }, { authContext: authContext ?? undefined })
          );

          if (!updateResult.success) {
            return updateResult;
          }

          // Handle assignees if provided (undefined means no change, array means replace)
          if (assigneesProvided) {
            if (resolvedAssignees.length > 0 || Array.isArray(args.assignees)) {
              if (!searchCtx) {
                const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
                if (ctxResult.error === null) {
                  searchCtx = { workspaceId: ctxResult.workspaceId, supabase: ctxResult.supabase, userId: ctxResult.userId };
                }
              }
              if (resolvedAssignees.length > 0) {
                await setTaskAssignees(taskId, resolvedAssignees, { replaceExisting: true, authContext: authContext ?? undefined });
              } else {
                // Empty array means clear all assignees
                await setTaskAssignees(taskId, [], { replaceExisting: true, authContext: authContext ?? undefined });
              }
            }
          }

          // Handle tags if provided (undefined means no change, array means replace)
          if (tagsProvided && Array.isArray(args.tags)) {
            await setTaskTags(taskId, args.tags as string[], { authContext: authContext ?? undefined });
          }

          return updateResult;
        }

      case "bulkUpdateTaskItems":
        if (!Array.isArray(args.taskIds) || args.taskIds.length === 0) {
          return {
            success: false,
            error: "bulkUpdateTaskItems requires a non-empty taskIds array.",
          };
        }
        const updatesArg = args.updates as Record<string, unknown> | undefined;
        {
          const rpcResult = await bulkUpdateTaskItemsRpc({
            taskIds: args.taskIds as string[],
            updates: updatesArg ?? {},
            authContext: authContext ?? undefined,
          });
          if (!("error" in rpcResult)) {
            return { success: true, data: rpcResult.data };
          }
        }
        return await wrapResult(
          bulkUpdateTaskItems({
            taskIds: args.taskIds as string[],
            updates: {
              title: updatesArg?.title as string | undefined,
              status: updatesArg?.status as any,
              priority: updatesArg?.priority as any,
              description: updatesArg?.description as string | null | undefined,
              dueDate: updatesArg?.dueDate as string | null | undefined,
              dueTime: updatesArg?.dueTime as string | null | undefined,
              startDate: updatesArg?.startDate as string | null | undefined,
            },
            authContext: authContext ?? undefined,
          })
        );

      case "deleteTaskItem":
        return await wrapResult(deleteTaskItem(args.taskId as string, { authContext: authContext ?? undefined }));

      case "bulkMoveTaskItems":
        {
          const rpcResult = await bulkMoveTaskItemsRpc({
            taskIds: args.taskIds as string[],
            targetBlockId: args.targetBlockId as string,
            authContext: authContext ?? undefined,
          });
          if (!("error" in rpcResult)) {
            return { success: true, data: rpcResult.data };
          }
        }
        return await wrapResult(
          bulkMoveTaskItems({
            taskIds: args.taskIds as string[],
            targetBlockId: args.targetBlockId as string,
            authContext: authContext ?? undefined,
          })
        );

      case "duplicateTasksToBlock":
        {
          const rpcResult = await duplicateTasksToBlockRpc({
            taskIds: (args as any).taskIds as string[],
            targetBlockId: (args as any).targetBlockId as string,
            includeAssignees: (args as any).includeAssignees as boolean | undefined,
            includeTags: (args as any).includeTags as boolean | undefined,
            authContext: authContext ?? undefined,
          });
          if (!("error" in rpcResult)) {
            return { success: true, data: rpcResult.data };
          }
        }
        return await wrapResult(duplicateTasksToBlock(args as any));

      case "createTaskBoardFromTasks":
        {
          let taskIds = Array.isArray(args.taskIds) ? (args.taskIds as string[]) : [];
          const tabId = (args.tabId as string | undefined) || context?.currentTabId;
          if (!tabId) {
            return { success: false, error: "Missing tabId for createTaskBoardFromTasks." };
          }

          const assigneeId = args.assigneeId as string | undefined;
          const assigneeName = args.assigneeName as string | undefined;
          const sourceProjectId = args.sourceProjectId as string | undefined;
          const sourceTabId = args.sourceTabId as string | undefined;
          const searchLimit = typeof args.limit === "number" ? args.limit : 500;

          if (assigneeId || assigneeName || sourceProjectId || sourceTabId) {
            const searchResult = await searchTasks({
              assigneeId,
              assigneeName,
              projectId: sourceProjectId,
              tabId: sourceTabId,
              limit: searchLimit,
            });

            if (!searchResult.error && searchResult.data) {
              const fromSearch = searchResult.data.map((task) => task.id);
              taskIds = Array.from(new Set([...taskIds, ...fromSearch]));
            }
          }

          if (taskIds.length === 0) {
            return { success: false, error: "No tasks found for createTaskBoardFromTasks." };
          }

          const blockTitle = (args.title as string | undefined) || "Task Board";
          const viewMode = (args.viewMode as string | undefined) || "board";
          const boardGroupBy = (args.boardGroupBy as string | undefined) || "status";

          const createBlockResult = await createBlock({
            tabId,
            type: "task",
            content: { title: blockTitle, hideIcons: false, viewMode, boardGroupBy },
          });

          if ("error" in createBlockResult) {
            return { success: false, error: createBlockResult.error ?? "Failed to create task block" };
          }

          const taskBlockId = createBlockResult.data?.id;
          if (!taskBlockId) {
            return { success: false, error: "Failed to create task block." };
          }

          const dupResult = await duplicateTasksToBlock({
            targetBlockId: taskBlockId,
            taskIds,
            authContext: authContext ?? undefined,
            includeAssignees: args.includeAssignees as boolean | undefined,
            includeTags: args.includeTags as boolean | undefined,
          });

          if ("error" in dupResult) {
            return { success: false, error: dupResult.error ?? "Failed to duplicate tasks" };
          }

          return {
            success: true,
            data: {
              taskBlockId,
              createdCount: dupResult.data.createdCount,
              createdTaskIds: dupResult.data.createdTaskIds,
              skipped: dupResult.data.skipped,
            },
          };
        }

      case "setTaskAssignees":
        if (!args.taskId || !Array.isArray(args.assignees)) {
          return {
            success: false,
            error: "Missing taskId or assignees array for setTaskAssignees. Required format: setTaskAssignees(taskId, [{id: 'user-uuid', name: 'User Name'}]). Always search for workspace members first using searchWorkspaceMembers to get both id and name.",
          };
        }
        // Validate assignees have proper structure
        const assigneesArray = args.assignees as Array<Record<string, unknown>>;
        const invalidAssignees = assigneesArray.filter(
          (a) => !a || typeof a !== "object" || (!a.id && !a.name && !a.userId && !a.user_id)
        );
        if (invalidAssignees.length > 0) {
          return {
            success: false,
            error: "Invalid assignee format. Each assignee must have 'id' and 'name' properties. Example: [{id: 'uuid', name: 'John Doe'}]. Use searchWorkspaceMembers to get user details first.",
          };
        }

        // CRITICAL FIX: Check for ambiguous assignees before proceeding
        const assigneeResult = await resolveTaskAssignees(assigneesArray);

        if (assigneeResult.ambiguities.length > 0) {
          // Build detailed error message with all matches
          const ambiguityDetails = assigneeResult.ambiguities
            .map((amb) => {
              const matchList = amb.matches
                .map((m) => `  - ${m.name} (${m.email})`)
                .join("\n");
              return `"${amb.input}" matches multiple workspace members:\n${matchList}`;
            })
            .join("\n\n");

          return {
            success: false,
            error: `Ambiguous assignees found. Please specify which person you meant:\n\n${ambiguityDetails}\n\nTip: Use searchWorkspaceMembers to get the exact user ID, or provide a more specific name.`,
          };
        }

        return await wrapResult(
          setTaskAssignees(
            args.taskId as string,
            assigneeResult.resolved,
            { authContext: authContext ?? undefined }
          )
        );

      case "bulkSetTaskAssignees":
        if (!Array.isArray(args.taskIds) || args.taskIds.length === 0 || !Array.isArray(args.assignees)) {
          return {
            success: false,
            error:
              "Missing taskIds or assignees array for bulkSetTaskAssignees. Required format: bulkSetTaskAssignees({ taskIds: [...], assignees: [{id: 'user-uuid', name: 'User Name'}] }).",
          };
        }
        {
          const taskIds = (args.taskIds as Array<string>).filter(Boolean);
          if (taskIds.length === 0) {
            return { success: false, error: "bulkSetTaskAssignees requires at least one taskId." };
          }

          const assigneesArray = args.assignees as Array<Record<string, unknown>>;
          const invalidAssignees = assigneesArray.filter(
            (a) => !a || typeof a !== "object" || (!a.id && !a.name && !a.userId && !a.user_id)
          );
          if (invalidAssignees.length > 0) {
            return {
              success: false,
              error:
                "Invalid assignee format. Each assignee must have 'id' and 'name' properties. Example: [{id: 'uuid', name: 'John Doe'}]. Use searchWorkspaceMembers to get user details first.",
            };
          }

          const assigneeResult = await resolveTaskAssignees(assigneesArray);

          if (assigneeResult.ambiguities.length > 0) {
            const ambiguityDetails = assigneeResult.ambiguities
              .map((amb) => {
                const matchList = amb.matches
                  .map((m) => `  - ${m.name} (${m.email})`)
                  .join("\n");
                return `"${amb.input}" matches multiple workspace members:\n${matchList}`;
              })
              .join("\n\n");

            return {
              success: false,
              error: `Ambiguous assignees found. Please specify which person you meant:\n\n${ambiguityDetails}\n\nTip: Use searchWorkspaceMembers to get the exact user ID, or provide a more specific name.`,
            };
          }

          {
            const rpcResult = await bulkSetTaskAssigneesRpc({
              taskIds,
              assignees: assigneeResult.resolved,
              authContext: authContext ?? undefined,
            });
            if (!("error" in rpcResult)) {
              return { success: true, data: rpcResult.data };
            }
          }

          const failures: Array<{ taskId: string; error: string }> = [];
          for (const taskId of taskIds) {
            const result = await setTaskAssignees(taskId, assigneeResult.resolved, { authContext: authContext ?? undefined });
            if ("error" in result) {
              failures.push({ taskId, error: result.error });
            }
          }

          if (failures.length > 0) {
            return {
              success: false,
              error: `Failed to update ${failures.length} task(s).`,
              data: { updatedCount: taskIds.length - failures.length, failures },
            };
          }

          return { success: true, data: { updatedCount: taskIds.length } };
        }

      case "setTaskTags":
        return await wrapResult(
          setTaskTags(args.taskId as string, args.tagNames as string[], { authContext: authContext ?? undefined })
        );

      case "createTaskSubtask":
        return await wrapResult(
          createTaskSubtask({
            taskId: args.taskId as string,
            title: args.title as string,
            completed: args.completed as boolean | undefined,
            authContext: authContext ?? undefined,
          })
        );

      case "updateTaskSubtask":
        return await wrapResult(
          updateTaskSubtask(args.subtaskId as string, {
            title: args.title as string | undefined,
            completed: args.completed as boolean | undefined,
          })
        );

      case "deleteTaskSubtask":
        return await wrapResult(deleteTaskSubtask(args.subtaskId as string, { authContext: authContext ?? undefined }));

      case "createTaskComment":
        return await wrapResult(
          createTaskComment({
            taskId: args.taskId as string,
            text: args.text as string,
            authContext: authContext ?? undefined,
          })
        );

      // ==================================================================
      // PROJECT ACTIONS
      // ==================================================================
      case "createProject":
        if (!workspaceId) {
          return { success: false, error: "No workspace selected" };
        }

        // Smart Tool: Resolve clientName if clientId is missing
        let clientId = args.clientId as string | undefined;
        if (!clientId && args.clientName) {
          const clientSearch = await searchClients({ searchText: args.clientName as string, limit: 1 });
          // Prefer exact match, else fuzzy
          if (clientSearch.data && clientSearch.data.length > 0) {
            clientId = clientSearch.data[0].id;
          }
        }

        return await wrapResult(
          createProject(workspaceId, {
            name: args.name as string,
            client_id: clientId,
            status: args.status as any,
            due_date_date: args.dueDate as string | undefined,
            project_type: args.projectType as any,
          }, { authContext: authContext ?? undefined })
        );

      case "updateProject":
        {
          // Smart Tool: Resolve clientName if provided
          let clientId = args.clientId as string | null | undefined;
          if (clientId === undefined && args.clientName) {
            if (args.clientName === null || args.clientName === "") {
              clientId = null; // Clear client
            } else {
              const clientSearch = await searchClients({ searchText: args.clientName as string, limit: 1 });
              if (clientSearch.data && clientSearch.data.length > 0) {
                clientId = clientSearch.data[0].id;
              } else {
                return { success: false, error: `Client "${args.clientName}" not found. Please create the client first or use an existing client name.` };
              }
            }
          }

          return await wrapResult(
            updateProject(args.projectId as string, {
              name: args.name as string | undefined,
              status: args.status as "not_started" | "in_progress" | "complete" | undefined,
              client_id: clientId,
              due_date_date: args.dueDate as string | null | undefined,
              project_type: args.projectType as "project" | "internal" | undefined,
            }, { authContext: authContext ?? undefined })
          );
        }

      case "deleteProject":
        return await wrapResult(deleteProject(args.projectId as string, { authContext: authContext ?? undefined }));

      // ==================================================================
      // TAB ACTIONS
      // ==================================================================
      case "createTab": {
        const projectId = (args.projectId as string | undefined) || context?.currentProjectId;
        if (!projectId) return { success: false, error: "createTab: Missing projectId and could not infer from context" };

        return await wrapResult(
          createTab({
            projectId,
            name: args.name as string,
            parentTabId: args.parentTabId as string | null | undefined,
            authContext: authContext ?? undefined,
          })
        );
      }

      case "updateTab":
        return await wrapResult(
          updateTab({
            tabId: args.tabId as string,
            name: args.name as string | undefined,
            parentTabId: args.parentTabId as string | null | undefined,
          })
        );

      case "deleteTab":
        return await wrapResult(deleteTab(args.tabId as string));

      // ==================================================================
      // BLOCK ACTIONS
      // ==================================================================
      case "createChartBlock": {
        let tabId = args.tabId as string | undefined;
        const isSimulation = args.isSimulation as boolean | undefined;
        let originalChartId = args.originalChartId as string | undefined;

        if (!tabId && args.tabName) {
          const tabSearch = await searchTabs({ searchText: args.tabName as string, limit: 1 });
          if (tabSearch.data && tabSearch.data.length > 0) {
            tabId = tabSearch.data[0].id;
          }
        }

        if (!tabId && context?.currentTabId) {
          tabId = context.currentTabId;
        }

        if (!tabId) {
          return { success: false, error: "createChartBlock: Missing tabId and could not infer from context" };
        }

        if (isSimulation && !originalChartId && context?.contextBlockId) {
          originalChartId = context.contextBlockId;
        }

        return await wrapResult(
          createChartBlock({
            tabId,
            prompt: args.prompt as string,
            chartType: args.chartType as any,
            title: args.title as string | undefined,
            explicitData: args.explicitData as any,
            isSimulation,
            originalChartId,
            simulationDescription: args.simulationDescription as string | undefined,
            authContext: authContext ?? undefined,
          })
        );
      }
      case "createBlock": {
        let tabId = args.tabId as string;

        // Priority 1: Smart Tool - Resolve tabName if provided
        if (!tabId && args.tabName) {
          const tabSearch = await searchTabs({ searchText: args.tabName as string, limit: 1 });
          if (tabSearch.data && tabSearch.data.length > 0) {
            tabId = tabSearch.data[0].id;
          }
        }

        // Priority 2: Use Context
        if (!tabId && context?.currentTabId) {
          tabId = context.currentTabId;
        }

        return await wrapResult(
          createBlock({
            tabId,
            type: args.type as any,
            content: args.content as any,
            authContext: authContext ?? undefined,
            position: args.position as number | undefined,
            column: args.column as number | undefined,
            parentBlockId: args.parentBlockId as string | undefined,
          })
        );
      }

      case "updateBlock":
        return await wrapResult(
          updateBlock({
            blockId: args.blockId as string,
            content: args.content as any,
            position: args.position as number | undefined,
            column: args.column as number | undefined,
          })
        );

      case "deleteBlock":
        return await wrapResult(deleteBlock(args.blockId as string, { authContext: authContext ?? undefined }));

      // ==================================================================
      // TABLE ACTIONS
      // ==================================================================
      case "createTable": {
        const targetWorkspaceId = (args.workspaceId as string | undefined) || workspaceId;
        if (!targetWorkspaceId) {
          return { success: false, error: "Missing workspaceId for createTable" };
        }

        const tabId = (args.tabId as string | undefined) || context?.currentTabId;

        // Create the table
        const tableResult = await createTable({
          workspaceId: targetWorkspaceId,
          projectId: (args.projectId as string | undefined) || context?.currentProjectId,
          title: args.title as string | undefined,
          description: args.description as string | null | undefined,
          icon: args.icon as string | null | undefined,
          authContext: authContext ?? undefined,
        });

        if ("error" in tableResult) {
          return { success: false, error: tableResult.error };
        }

        // If tabId provided, create block to show table in UI
        if (tabId) {
          const blockResult = await createBlock({
            tabId,
            type: "table",
            content: { tableId: tableResult.data.table.id },
            authContext: authContext ?? undefined,
          });

          if ("error" in blockResult) {
            // CRITICAL FIX: Table was created but block creation failed
            // Clean up the orphaned table to maintain data consistency
            await deleteTable(tableResult.data.table.id, { authContext: authContext ?? undefined });

            return {
              success: false,
              error: `Failed to add table to tab: ${blockResult.error}. Table creation rolled back.`,
            };
          }

          return { success: true, data: { ...tableResult.data, block: blockResult.data } };
        }

        // No tabId - table created but not visible in UI
        return { success: true, data: tableResult.data };
      }

      case "createField":
        {
          const tableId = args.tableId as string;
          const name = args.name as string;
          const type = args.type as string;
          const config = args.config as Record<string, unknown> | undefined;
          const isPrimary = args.isPrimary as boolean | undefined;

          const existing = await findFieldByName(tableId, name);
          if (existing) {
            return { success: true, data: existing };
          }

          const reused = await maybeReuseDefaultField({
            tableId,
            name,
            type,
            config,
            isPrimary,
          });

          if (reused) return reused;

          return await wrapResult(
            createField({
              tableId,
              name,
              type: type as any,
              config: config as any,
              isPrimary,
            })
          );
        }

      case "bulkCreateFields":
        {
          const tableId = args.tableId as string;
          const fields = args.fields as Array<{
            name: string;
            type: string;
            config?: Record<string, unknown>;
            isPrimary?: boolean;
          }>;

          if (!Array.isArray(fields) || fields.length === 0) {
            return { success: false, error: "fields must be a non-empty array" };
          }

          // Fetch schema once and resolve default-column reuse in memory,
          // then issue all writes in parallel.  This avoids the per-field
          // getTable + isNewEmptyTable round-trips that maybeReuseDefaultField
          // would make if called individually.
          const tableResult = await getTable(tableId, { authContext: authContext ?? undefined });
          const existingFields = ("error" in tableResult || !tableResult.data?.fields)
            ? []
            : tableResult.data.fields;

          // Determine whether this is a new empty table (≤3 rows, no data)
          let isEmpty = false;
          if (existingFields.length > 0) {
            const rowsResult = await getTableRows(tableId, { limit: 5, offset: 0, authContext: authContext ?? undefined });
            if (!("error" in rowsResult) && rowsResult.data) {
              const totalRows = rowsResult.data.total ?? rowsResult.data.rows.length;
              const hasData = rowsResult.data.rows.some(
                (row) => row.data && Object.keys(row.data).length > 0
              );
              isEmpty = totalRows <= 3 && !hasData;
            }
          }

          // Build a set of available default columns (non-primary, default-named)
          // that can be reused by renaming.  We consume them in order so each
          // field gets a unique candidate.
          const defaultCandidates = isEmpty
            ? existingFields.filter((f) => !f.is_primary && isDefaultFieldName(f.name))
            : [];
          const availableDefaults = new Map(
            defaultCandidates.map((f) => [normalizeFieldName(f.name), f])
          );

          // Plan each field: resolve to existing | reuse default | create new
          type FieldPlan =
            | { kind: "existing"; data: unknown }
            | { kind: "reuse"; candidateId: string; name: string; type: string; config?: Record<string, unknown> }
            | { kind: "create"; name: string; type: string; config?: Record<string, unknown>; isPrimary?: boolean };

          const plans: FieldPlan[] = [];
          for (const field of fields) {
            // Check if a field with this name already exists
            const normalized = normalizeFieldName(field.name);
            const existing = existingFields.find(
              (f) => normalizeFieldName(f.name) === normalized
            );
            if (existing) {
              plans.push({ kind: "existing", data: existing });
              continue;
            }

            // Try to claim a default column for reuse
            if (isEmpty && !field.isPrimary && !(CONFIG_REQUIRED_TYPES.has(field.type) && !field.config)) {
              const preferred = field.type === "text" ? ["column 2", "column 3"] : ["column 3", "column 2"];
              const candidate = preferred
                .map((name) => availableDefaults.get(name))
                .find(Boolean) ?? [...availableDefaults.values()][0];

              if (candidate) {
                availableDefaults.delete(normalizeFieldName(candidate.name));
                plans.push({
                  kind: "reuse",
                  candidateId: candidate.id,
                  name: field.name,
                  type: field.type,
                  config: field.config,
                });
                continue;
              }
            }

            // Fall through to a new createField
            plans.push({ kind: "create", name: field.name, type: field.type, config: field.config, isPrimary: field.isPrimary });
          }

          // Execute all writes in parallel — each targets a distinct field
          const results = await Promise.all(
            plans.map(async (plan) => {
              if (plan.kind === "existing") {
                return { success: true, data: plan.data };
              }
              if (plan.kind === "reuse") {
                const nextConfig = applyDefaultFieldConfig(plan.type, plan.config);
                const payload: Record<string, unknown> = { name: plan.name, type: plan.type };
                if (nextConfig !== undefined) payload.config = nextConfig;
                return await wrapResult(updateField(plan.candidateId, payload));
              }
              // kind === "create"
              return await wrapResult(
                createField({
                  tableId,
                  name: plan.name,
                  type: plan.type as any,
                  config: plan.config as any,
                  isPrimary: plan.isPrimary,
                })
              );
            })
          );

          const allSuccessful = results.every((r) => r.success);
          return {
            success: allSuccessful,
            data: results.map((r) => r.data),
            error: allSuccessful ? undefined : results.find((r) => !r.success)?.error,
          };
        }

      case "updateField":
        return await wrapResult(
          updateField(args.fieldId as string, {
            name: args.name as string | undefined,
            config: args.config as any,
          }, { authContext: authContext ?? undefined })
        );

      case "deleteField":
        return await wrapResult(deleteField(args.fieldId as string, { authContext: authContext ?? undefined }));

      case "createRow": {
        let tableId = args.tableId as string;
        if (!tableId && args.tableName) {
          const tableSearch = await searchTables({ searchText: args.tableName as string, limit: 1 });
          if (!tableSearch.error && tableSearch.data && tableSearch.data.length > 0) {
            tableId = tableSearch.data[0].id;
          }
        }

        if (!tableId) return { success: false, error: "Missing tableId for createRow. Provide tableId or tableName." };

        return await wrapResult(
          createRow({
            tableId,
            data: args.data as Record<string, unknown>,
            authContext: authContext ?? undefined,
          })
        );
      }

      case "updateRow":
        return await wrapResult(
          updateRow(args.rowId as string, {
            data: args.data as Record<string, unknown>,
          }, { authContext: authContext ?? undefined })
        );

      case "updateCell":
        if (!isUuid(args.rowId as string)) {
          return {
            success: false,
            error: "updateCell requires a rowId UUID. If you only have field names/labels, use updateTableRowsByFieldNames.",
          };
        }
        if (!isUuid(args.fieldId as string)) {
          return {
            success: false,
            error: "updateCell requires a fieldId UUID. If you only have field names/labels, use updateTableRowsByFieldNames.",
          };
        }
        return await wrapResult(
          updateCell(args.rowId as string, args.fieldId as string, args.value, { authContext: authContext ?? undefined })
        );

      case "deleteRow":
        return await wrapResult(deleteRow(args.rowId as string, { authContext: authContext ?? undefined }));

      case "deleteRows":
        return await wrapResult(deleteRows(args.rowIds as string[], { authContext: authContext ?? undefined }));

      case "bulkInsertRows":
        {
          let resolvedTableId = args.tableId as string;
          // Smart Tool: Resolve tableName
          if (!resolvedTableId && args.tableName) {
            const tableSearch = await searchTables({ searchText: args.tableName as string, limit: 1 });
            if (!tableSearch.error && tableSearch.data && tableSearch.data.length > 0) {
              resolvedTableId = tableSearch.data[0].id;
            }
          }
          if (!resolvedTableId) return { success: false, error: "Missing tableId for bulkInsertRows. Provide tableId or tableName." };

          const rowsArg =
            (args.rows as Array<{ data: Record<string, unknown>; order?: number | string | null }>) ??
            undefined;
          const legacyDataArg = args.data as Array<Record<string, unknown>> | undefined;
          const normalizedRows =
            rowsArg && Array.isArray(rowsArg)
              ? rowsArg
              : Array.isArray(legacyDataArg)
                ? (() => {
                  const looksLikeRows = legacyDataArg.every((entry) => {
                    if (!entry || typeof entry !== "object") return false;
                    const keys = Object.keys(entry);
                    if (!keys.includes("data")) return false;
                    return keys.every((key) => key === "data" || key === "order");
                  });

                  return looksLikeRows
                    ? (legacyDataArg as Array<{
                      data: Record<string, unknown>;
                      order?: number | string | null;
                    }>)
                    : legacyDataArg.map((data) => ({ data }));
                })()
                : undefined;

          if (!normalizedRows) {
            return {
              success: false,
              error: "Missing rows for bulkInsertRows. Expected { rows: [{ data: {...} }] }.",
            };
          }

          await maybeEnsureFieldsForRows(resolvedTableId, normalizedRows);
          await maybeRemoveDefaultRows(resolvedTableId);

          const mappingResult = await mapRowDataToFieldIds(
            resolvedTableId,
            normalizedRows
          );

          if (mappingResult.warnings.length > 0) {
            return {
              success: false,
              error: mappingResult.warnings[0],
            };
          }

          if (await shouldSkipDuplicateInsert(resolvedTableId, mappingResult.rows)) {
            return {
              success: true,
              data: { insertedIds: [] },
            };
          }

          const result = await wrapResult(
            bulkInsertRows({
              tableId: resolvedTableId,
              rows: mappingResult.rows,
            })
          );

          // Attach warnings if any fields were unmatched
          if (mappingResult.warnings.length > 0) {
            result.warnings = mappingResult.warnings;
          }

          return result;
        }

      case "bulkUpdateRows":
        if (!Array.isArray(args.rowIds) || args.rowIds.some((id) => !isUuid(id as string))) {
          return {
            success: false,
            error: "bulkUpdateRows requires rowIds as UUIDs. If you need to match rows by field names/values, use updateTableRowsByFieldNames.",
          };
        }
        if (
          !args.updates ||
          typeof args.updates !== "object" ||
          Object.keys(args.updates as Record<string, unknown>).some((key) => !isUuid(key))
        ) {
          return {
            success: false,
            error: "bulkUpdateRows requires updates with fieldId UUID keys. If you only have field names/labels, use updateTableRowsByFieldNames.",
          };
        }
        {
          const schemaResult = await getTableSchema({ tableId: args.tableId as string });
          if (schemaResult.error || !schemaResult.data) {
            return { success: false, error: schemaResult.error ?? "Failed to load table schema." };
          }
          const fieldById = new Map(schemaResult.data.fields.map((f) => [f.id, f]));
          for (const [fieldId, rawValue] of Object.entries(args.updates as Record<string, unknown>)) {
            const field = fieldById.get(fieldId);
            if (!field) continue;
            if (!isSelectLike(field.type)) continue;

            const { kind, options } = getOptionEntries(field);
            const optionIds = new Set(options.map((opt) => opt.id));
            const values = Array.isArray(rawValue) ? rawValue : [rawValue];
            const allValid = values.every((value) => optionIds.has(String(value)));
            if (!allValid) {
              return {
                success: false,
                error: `bulkUpdateRows: "${field.name}" expects option IDs, but provided values were not found. Use updateTableRowsByFieldNames to update by labels.`,
              };
            }
            if ((kind === "options" || kind === "levels") && optionIds.size === 0) {
              return {
                success: false,
                error: `bulkUpdateRows: "${field.name}" has no options configured. Use updateTableRowsByFieldNames to create options and update rows.`,
              };
            }
          }
        }
        return await wrapResult(
          bulkUpdateRows({
            tableId: args.tableId as string,
            rowIds: args.rowIds as string[],
            updates: args.updates as Record<string, unknown>,
          })
        );

      case "updateTableRowsByFieldNames": {
        const timingEnabled = isAITimingEnabled();
        const timingStart = timingEnabled ? Date.now() : 0;
        let t_schema_ms = 0;
        let t_resolve_updates_ms = 0;
        let t_update_options_ms = 0;
        let t_search_rows_ms = 0;
        let t_filter_rows_ms = 0;
        let t_bulk_update_ms = 0;
        let matchedRowCount = 0;
        let scannedRowCount = 0;

        const tableId = args.tableId as string | undefined;
        const filters = args.filters as Record<string, unknown> | undefined;
        const updates = args.updates as Record<string, unknown> | undefined;
        const limit = typeof args.limit === "number" ? args.limit : 500;

        if (!tableId) {
          return { success: false, error: "Missing tableId for updateTableRowsByFieldNames." };
        }
        if (!updates || Object.keys(updates).length === 0) {
          return { success: false, error: "updates are required for updateTableRowsByFieldNames." };
        }

        {
          const rpcResult = await updateTableRowsByFieldNamesRpc({
            tableId,
            filters,
            updates,
            limit,
            authContext: authContext ?? undefined,
          });
          if (!("error" in rpcResult)) {
            return { success: true, data: rpcResult.data };
          }
        }

        const schemaStart = timingEnabled ? Date.now() : 0;
        const schemaResult = await getTableSchema({ tableId });
        if (timingEnabled) t_schema_ms = Date.now() - schemaStart;
        if (schemaResult.error || !schemaResult.data) {
          return { success: false, error: schemaResult.error ?? "Failed to load table schema." };
        }

        const fields = schemaResult.data.fields;
        const fieldMap = new Map(fields.map((f) => [normalizeFieldKey(f.name), f]));
        const fieldIdMap = new Map(fields.map((f) => [f.id, f]));

        const resolveField = (key: string) => {
          const direct = fieldIdMap.get(key) || fieldMap.get(normalizeFieldKey(key));
          if (direct) return direct;

          const normalized = normalizeFieldKey(key);
          const startsWith = fields.find((f) => normalizeFieldKey(f.name).startsWith(normalized));
          if (startsWith) return startsWith;
          const includes = fields.find((f) => normalizeFieldKey(f.name).includes(normalized));
          if (includes) return includes;
          return undefined;
        };

        // Prepare update payload (by fieldId) and optionally extend options.
        const updatesByFieldId: Record<string, unknown> = {};
        const pendingConfigUpdates = new Map<string, Record<string, unknown>>();

        const resolveStart = timingEnabled ? Date.now() : 0;
        for (const [fieldKey, rawValue] of Object.entries(updates)) {
          const field = resolveField(fieldKey);
          if (!field) {
            return { success: false, error: `Unknown field "${fieldKey}" in updates.` };
          }
          const resolved = resolveUpdateValue(field, rawValue, true);
          updatesByFieldId[field.id] = resolved.value;
          if (resolved.updatedConfig) {
            pendingConfigUpdates.set(field.id, resolved.updatedConfig);
          }
        }
        if (timingEnabled) t_resolve_updates_ms = Date.now() - resolveStart;

        // Persist any new options before updating rows.
        const updateOptionsStart = timingEnabled ? Date.now() : 0;
        for (const [fieldId, config] of pendingConfigUpdates.entries()) {
          const updateResult = await updateField(fieldId, { config });
          if ("error" in updateResult) {
            return { success: false, error: updateResult.error ?? "Failed to update field options." };
          }
        }
        if (timingEnabled) t_update_options_ms = Date.now() - updateOptionsStart;

        const searchRowsStart = timingEnabled ? Date.now() : 0;
        const rowsResult = await searchTableRows({ tableId, limit });
        if (timingEnabled) t_search_rows_ms = Date.now() - searchRowsStart;
        if (rowsResult.error || !rowsResult.data) {
          return { success: false, error: rowsResult.error ?? "Failed to load table rows." };
        }

        const applyAllRows = !filters || Object.keys(filters).length === 0;
        const filterStart = timingEnabled ? Date.now() : 0;
        const matchedRowIds = applyAllRows
          ? rowsResult.data.map((row) => row.id)
          : rowsResult.data
            .filter((row) => matchesRowFilters(row.data, filters, resolveField))
            .map((row) => row.id);
        if (timingEnabled) t_filter_rows_ms = Date.now() - filterStart;
        matchedRowCount = matchedRowIds.length;
        scannedRowCount = rowsResult.data.length;

        if (matchedRowIds.length === 0) {
          const filterSummary = filters
            ? Object.entries(filters)
              .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
              .join(", ")
            : "";

          return {
            success: false,
            error: applyAllRows
              ? `No rows found to update. Scanned ${rowsResult.data.length} rows.`
              : `No rows matched filter {${filterSummary}}. Scanned ${rowsResult.data.length} rows. Check that field names and values match exactly (case-insensitive). Available fields: ${fields.map((f) => f.name).join(", ")}`,
          };
        }

        const bulkUpdateStart = timingEnabled ? Date.now() : 0;
        const updateResult = await wrapResult(
          bulkUpdateRows({
            tableId,
            rowIds: matchedRowIds,
            updates: updatesByFieldId,
          })
        );
        if (timingEnabled) t_bulk_update_ms = Date.now() - bulkUpdateStart;

        if (updateResult.success) {
          updateResult.data = { updated: matchedRowIds.length, rowIds: matchedRowIds };
        }

        if (timingEnabled) {
          aiTiming({
            event: "updateTableRowsByFieldNames",
            tableId,
            scanned_rows: scannedRowCount,
            matched_rows: matchedRowCount,
            t_schema_ms,
            t_resolve_updates_ms,
            t_update_options_ms,
            t_search_rows_ms,
            t_filter_rows_ms,
            t_bulk_update_ms,
            t_total_ms: Date.now() - timingStart,
          });
        }

        return updateResult;
      }

      case "bulkUpdateRowsByFieldNames": {
        const tableId = args.tableId as string | undefined;
        const rows = Array.isArray(args.rows) ? (args.rows as Array<Record<string, unknown>>) : undefined;
        const limit = typeof args.limit === "number" ? args.limit : 500;

        if (!tableId) {
          return { success: false, error: "Missing tableId for bulkUpdateRowsByFieldNames." };
        }
        if (!rows || rows.length === 0) {
          return { success: false, error: "rows are required for bulkUpdateRowsByFieldNames." };
        }

        {
          const rpcResult = await bulkUpdateRowsByFieldNamesRpc({
            tableId,
            rows,
            limit,
            authContext: authContext ?? undefined,
          });
          if (!("error" in rpcResult)) {
            return { success: true, data: rpcResult.data };
          }
        }

        const schemaResult = await getTableSchema({ tableId });
        if (schemaResult.error || !schemaResult.data) {
          return { success: false, error: schemaResult.error ?? "Failed to load table schema." };
        }

        const fields = schemaResult.data.fields;
        const fieldMap = new Map(fields.map((f) => [normalizeFieldKey(f.name), f]));
        const fieldIdMap = new Map(fields.map((f) => [f.id, f]));

        const resolveField = (key: string) => {
          const direct = fieldIdMap.get(key) || fieldMap.get(normalizeFieldKey(key));
          if (direct) return direct;

          const normalized = normalizeFieldKey(key);
          const startsWith = fields.find((f) => normalizeFieldKey(f.name).startsWith(normalized));
          if (startsWith) return startsWith;
          const includes = fields.find((f) => normalizeFieldKey(f.name).includes(normalized));
          if (includes) return includes;
          return undefined;
        };

        const rowsResult = await searchTableRows({ tableId, limit });
        if (rowsResult.error || !rowsResult.data) {
          return { success: false, error: rowsResult.error ?? "Failed to load table rows." };
        }

        const results: Array<{
          index: number;
          updated: number;
          rowIds: string[];
          filters?: Record<string, unknown>;
        }> = [];
        const allUpdatedRowIds: string[] = [];

        for (let index = 0; index < rows.length; index += 1) {
          const entry = rows[index] ?? {};
          const filters = (entry as Record<string, unknown>).filters as Record<string, unknown> | undefined;
          const updates = (entry as Record<string, unknown>).updates as Record<string, unknown> | undefined;

          if (!updates || Object.keys(updates).length === 0) {
            return { success: false, error: `Missing updates for row entry at index ${index}.` };
          }

          const updatesByFieldId: Record<string, unknown> = {};

          for (const [fieldKey, rawValue] of Object.entries(updates)) {
            const field = resolveField(fieldKey);
            if (!field) {
              return { success: false, error: `Unknown field "${fieldKey}" in updates.` };
            }
            const resolved = resolveUpdateValue(field, rawValue, true);
            updatesByFieldId[field.id] = resolved.value;
            if (resolved.updatedConfig) {
              const updateResult = await updateField(field.id, { config: resolved.updatedConfig });
              if ("error" in updateResult) {
                return { success: false, error: updateResult.error ?? "Failed to update field options." };
              }
              field.config = resolved.updatedConfig;
            }
          }

          const applyAllRows = !filters || Object.keys(filters).length === 0;
          const matchedRowIds = applyAllRows
            ? rowsResult.data.map((row) => row.id)
            : rowsResult.data
              .filter((row) => matchesRowFilters(row.data, filters, resolveField))
              .map((row) => row.id);

          if (matchedRowIds.length === 0) {
            const filterSummary = filters
              ? Object.entries(filters)
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join(", ")
              : "";
            return {
              success: false,
              error: applyAllRows
                ? `No rows found to update. Scanned ${rowsResult.data.length} rows.`
                : `No rows matched filter {${filterSummary}}. Scanned ${rowsResult.data.length} rows. Check that field names and values match exactly (case-insensitive). Available fields: ${fields.map((f) => f.name).join(", ")}`,
            };
          }

          const updateResult = await wrapResult(
            bulkUpdateRows({
              tableId,
              rowIds: matchedRowIds,
              updates: updatesByFieldId,
            })
          );

          if (!updateResult.success) {
            return updateResult;
          }

          allUpdatedRowIds.push(...matchedRowIds);
          results.push({ index, updated: matchedRowIds.length, rowIds: matchedRowIds, filters });
        }

        return {
          success: true,
          data: {
            updated: allUpdatedRowIds.length,
            rowIds: allUpdatedRowIds,
            results,
            totalRowsScanned: rowsResult.data.length,
          },
        };
      }

      // ==================================================================
      // TABLE SUPER-TOOLS
      // ==================================================================
      case "createTableFull":
        {
          const workspaceId = args.workspaceId as string;
          const title = args.title as string;
          const description = args.description as string | undefined;
          const projectId = args.projectId as string | undefined;
          const tabId = args.tabId as string | undefined;
          const fields = Array.isArray(args.fields) ? (args.fields as Array<Record<string, unknown>>) : [];
          const rows = Array.isArray(args.rows) ? (args.rows as Array<Record<string, unknown>>) : [];

          if (!workspaceId || !title) {
            return { success: false, error: "createTableFull requires workspaceId and title." };
          }

          // RPC fast-path: create table + fields + rows in one DB transaction
          const rpcResult = await createTableFullRpc({
            workspaceId,
            title,
            description,
            projectId,
            fields,
            rows,
            authContext: authContext ?? undefined,
          });

          if (!("error" in rpcResult)) {
            const { tableId, fieldsCreated, rowsInserted } = rpcResult.data;

            // Create table block (UI visibility) if needed
            if (tabId) {
              await createBlock({
                tabId,
                type: "table",
                content: { tableId },
                authContext: authContext ?? undefined,
              });
            }

            return {
              success: true,
              data: { tableId, fieldsCreated, rowsInserted },
              hint: `Created table "${title}" with ${fieldsCreated} fields and ${rowsInserted} rows.`,
            };
          }

          // Step 1: Create table
          const tableResult = await wrapResult(
            createTable({
              workspaceId,
              title,
              description,
              projectId,
              authContext: authContext ?? undefined,
            })
          );

          if (!tableResult.success || !tableResult.data) {
            return { success: false, error: tableResult.error ?? "Failed to create table." };
          }

          const tableData = tableResult.data as { table: { id: string } };
          const tableId = tableData.table.id;

          // Step 1b: Create table block if tabId provided
          if (tabId) {
            await createBlock({
              tabId,
              type: "table",
              content: { tableId },
              authContext: authContext ?? undefined,
            });
          }

          // Step 2: Create fields if provided
          let createdFields: unknown[] = [];
          if (fields.length > 0) {
            const fieldsResult = await executeTool(
              { name: "bulkCreateFields", arguments: { tableId, fields } },
              context
            );
            if (!fieldsResult.success) {
              return { success: false, error: fieldsResult.error ?? "Failed to create fields." };
            }
            createdFields = Array.isArray(fieldsResult.data) ? fieldsResult.data : [];
          }

          // Step 3: Insert rows if provided
          let insertedRows: unknown[] = [];
          if (rows.length > 0) {
            const rowsResult = await executeTool(
              { name: "bulkInsertRows", arguments: { tableId, rows } },
              context
            );
            if (!rowsResult.success) {
              return { success: false, error: rowsResult.error ?? "Failed to insert rows." };
            }
            insertedRows = Array.isArray((rowsResult.data as Record<string, unknown>)?.insertedIds)
              ? ((rowsResult.data as Record<string, unknown>).insertedIds as unknown[])
              : [];
          }

          return {
            success: true,
            data: {
              tableId,
              fieldsCreated: createdFields.length,
              rowsInserted: insertedRows.length,
            },
            hint: `Created table "${title}" with ${createdFields.length} fields and ${insertedRows.length} rows.`,
          };
        }

      case "updateTableFull":
        {
          let tableId = args.tableId as string | undefined;
          const tableName = args.tableName as string | undefined;

          // Resolve tableId from tableName if needed
          if (!tableId && tableName) {
            const tableSearch = await searchTables({ searchText: tableName, limit: 1 });
            if (!tableSearch.error && tableSearch.data && tableSearch.data.length > 0) {
              tableId = tableSearch.data[0].id;
            } else {
              return { success: false, error: `Table "${tableName}" not found.` };
            }
          }

          if (!tableId) {
            return { success: false, error: "updateTableFull requires tableId or tableName." };
          }

          const hasRpcOps =
            args.title !== undefined ||
            args.description !== undefined ||
            (Array.isArray(args.addFields) && args.addFields.length > 0) ||
            (Array.isArray(args.updateFields) && args.updateFields.length > 0) ||
            (Array.isArray(args.deleteFields) && args.deleteFields.length > 0) ||
            (Array.isArray(args.insertRows) && args.insertRows.length > 0) ||
            (args.updateRows && typeof args.updateRows === "object") ||
            (Array.isArray(args.deleteRowIds) && args.deleteRowIds.length > 0);

          if (hasRpcOps) {
            // RPC fast-path: apply all operations in one DB transaction
            const rpcResult = await updateTableFullRpc({
              tableId,
              title: args.title as string | undefined,
              description: (args.description as string | null | undefined) ?? undefined,
              addFields: Array.isArray(args.addFields) ? (args.addFields as Array<Record<string, unknown>>) : undefined,
              updateFields: Array.isArray(args.updateFields) ? (args.updateFields as Array<Record<string, unknown>>) : undefined,
              deleteFields: Array.isArray(args.deleteFields) ? (args.deleteFields as string[]) : undefined,
              insertRows: Array.isArray(args.insertRows) ? (args.insertRows as Array<Record<string, unknown>>) : undefined,
              updateRows: args.updateRows && typeof args.updateRows === "object"
                ? (args.updateRows as Record<string, unknown>)
                : undefined,
              deleteRowIds: Array.isArray(args.deleteRowIds) ? (args.deleteRowIds as string[]) : undefined,
              authContext: authContext ?? undefined,
            });

            if (!("error" in rpcResult)) {
              return {
                success: true,
                data: rpcResult.data,
                hint: `Updated table with ${Object.entries(rpcResult.data).map(([k, v]) => `${v} ${k}`).join(", ")}.`,
              };
            }
          }

          const operationSummary: Record<string, number> = {};

          // Update table metadata
          if (args.title !== undefined || args.description !== undefined) {
            const updates: Record<string, unknown> = {};
            if (args.title !== undefined) updates.title = args.title;
            if (args.description !== undefined) updates.description = args.description;

            const tableResult = await wrapResult(
              updateTable(tableId, updates, { authContext: authContext ?? undefined })
            );
            if (!tableResult.success) {
              return { success: false, error: tableResult.error ?? "Failed to update table metadata." };
            }
          }

          // Add fields
          if (Array.isArray(args.addFields) && args.addFields.length > 0) {
            const fieldsResult = await executeTool(
              { name: "bulkCreateFields", arguments: { tableId, fields: args.addFields } },
              context
            );
            if (!fieldsResult.success) {
              return { success: false, error: fieldsResult.error ?? "Failed to add fields." };
            }
            operationSummary.fieldsAdded = (args.addFields as unknown[]).length;
          }

          // Update fields
          if (Array.isArray(args.updateFields) && args.updateFields.length > 0) {
            for (const fieldUpdate of args.updateFields as Array<Record<string, unknown>>) {
              let fieldId = fieldUpdate.fieldId as string | undefined;

              if (!fieldId && fieldUpdate.fieldName) {
                const schema = await getTableSchema({ tableId });
                if (!schema.error && schema.data) {
                  const field = schema.data.fields.find(
                    (f) => f.name.toLowerCase() === String(fieldUpdate.fieldName).toLowerCase()
                  );
                  if (field) fieldId = field.id;
                }
              }

              if (fieldId) {
                const result = await updateField(fieldId, {
                  name: fieldUpdate.name as string | undefined,
                  config: fieldUpdate.config as Record<string, unknown> | undefined,
                }, { authContext: authContext ?? undefined });
                if ("error" in result) {
                  return { success: false, error: result.error ?? "Failed to update field." };
                }
              }
            }
            operationSummary.fieldsUpdated = (args.updateFields as unknown[]).length;
          }

          // Delete fields
          if (Array.isArray(args.deleteFields) && args.deleteFields.length > 0) {
            for (const fieldIdentifier of args.deleteFields as string[]) {
              let fieldId = fieldIdentifier;

              if (!isUuid(fieldIdentifier)) {
                const schema = await getTableSchema({ tableId });
                if (!schema.error && schema.data) {
                  const field = schema.data.fields.find(
                    (f) => f.name.toLowerCase() === fieldIdentifier.toLowerCase()
                  );
                  if (field) fieldId = field.id;
                }
              }

              if (fieldId) {
                const result = await deleteField(fieldId, { authContext: authContext ?? undefined });
                if ("error" in result) {
                  return { success: false, error: result.error ?? "Failed to delete field." };
                }
              }
            }
            operationSummary.fieldsDeleted = (args.deleteFields as unknown[]).length;
          }

          // Insert rows
          if (Array.isArray(args.insertRows) && args.insertRows.length > 0) {
            const rowsResult = await executeTool(
              { name: "bulkInsertRows", arguments: { tableId, rows: args.insertRows } },
              context
            );
            if (!rowsResult.success) {
              return { success: false, error: rowsResult.error ?? "Failed to insert rows." };
            }
            operationSummary.rowsInserted = (args.insertRows as unknown[]).length;
          }

          // Update rows
          if (args.updateRows && typeof args.updateRows === "object") {
            const updateRows = args.updateRows as Record<string, unknown>;
            const rowsResult = await executeTool(
              {
                name: "updateTableRowsByFieldNames",
                arguments: {
                  tableId,
                  filters: updateRows.filters,
                  updates: updateRows.updates,
                },
              },
              context
            );
            if (!rowsResult.success) {
              return { success: false, error: rowsResult.error ?? "Failed to update rows." };
            }
            operationSummary.rowsUpdated = ((rowsResult.data as Record<string, unknown>)?.updated as number) ?? 0;
          }

          // Delete rows
          if (Array.isArray(args.deleteRowIds) && args.deleteRowIds.length > 0) {
            const result = await deleteRows(args.deleteRowIds as string[], { authContext: authContext ?? undefined });
            if ("error" in result) {
              return { success: false, error: result.error ?? "Failed to delete rows." };
            }
            operationSummary.rowsDeleted = (args.deleteRowIds as unknown[]).length;
          }

          return {
            success: true,
            data: operationSummary,
            hint: `Updated table with ${Object.entries(operationSummary).map(([k, v]) => `${v} ${k}`).join(", ")}.`,
          };
        }

      case "deleteTable":
        {
          let tableId = args.tableId as string | undefined;
          const tableName = args.tableName as string | undefined;

          // Resolve tableId from tableName if needed
          if (!tableId && tableName) {
            const tableSearch = await searchTables({ searchText: tableName, limit: 1 });
            if (!tableSearch.error && tableSearch.data && tableSearch.data.length > 0) {
              tableId = tableSearch.data[0].id;
            } else {
              return { success: false, error: `Table "${tableName}" not found.` };
            }
          }

          if (!tableId) {
            return { success: false, error: "deleteTable requires tableId or tableName." };
          }

          return await wrapResult(deleteTable(tableId, { authContext: authContext ?? undefined }));
        }

      // ==================================================================
      // TIMELINE ACTIONS
      // ==================================================================
      case "createTimelineEvent": {
        let timelineBlockId = args.timelineBlockId as string;

        // Smart Tool: Resolve timelineBlockName
        if (!timelineBlockId && args.timelineBlockName) {
          const blockSearch = await searchBlocks({ searchText: args.timelineBlockName as string, type: "timeline", limit: 1 });
          // Prefer exact match
          if (blockSearch.data && blockSearch.data.length > 0) {
            timelineBlockId = blockSearch.data[0].id;
          }
        }

        // Priority 3: Resolve from context (Current Tab)
        if (!timelineBlockId && context?.currentTabId) {
          const existingBlocks = await searchBlocks({
            type: "timeline",
            tabId: context.currentTabId,
            limit: 1,
          });
          if (existingBlocks.data && existingBlocks.data.length > 0) {
            timelineBlockId = existingBlocks.data[0].id;
          } else {
            // Use createBlock to auto-create if needed
            const blockResult = await createBlock({
              tabId: context.currentTabId,
              type: "timeline",
              content: { title: "Timeline", viewMode: "gantt" },
              authContext: authContext ?? undefined,
            });
            if (!("error" in blockResult) && blockResult.data) {
              timelineBlockId = blockResult.data.id;
            }
          }
        }

        if (!timelineBlockId) return { success: false, error: "Missing timelineBlockId. Provide ID or 'timelineBlockName'." };

        // Smart Tool: Resolve assigneeName
        let assigneeId = args.assigneeId as string | undefined;
        if (!assigneeId && args.assigneeName) {
          const assigneeResult = await resolveTaskAssignees([{ name: args.assigneeName as string }]);
          if (assigneeResult.resolved.length > 0) {
            assigneeId = assigneeResult.resolved[0].id ?? undefined;
          }
        }

        return await wrapResult(
          createTimelineEvent({
            timelineBlockId,
            title: args.title as string,
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            status: args.status as TimelineEventStatus | undefined,
            progress: args.progress as number | undefined,
            notes: args.notes as string | undefined,
            color: args.color as string | undefined,
            isMilestone: args.isMilestone as boolean | undefined,
            assigneeId,
            authContext: authContext ?? undefined,
          })
        );
      }
      case "updateTimelineEvent":
        {
          // Smart Tool: Resolve assigneeName if provided
          let assigneeId = args.assigneeId as string | undefined;
          if (!assigneeId && args.assigneeName) {
            const assigneeResult = await resolveTaskAssignees([{ name: args.assigneeName as string }]);
            if (assigneeResult.ambiguities.length > 0) {
              const details = assigneeResult.ambiguities.map(a => `"${a.input}"`).join(", ");
              return { success: false, error: `Ambiguous assignee name: ${details}. Please be more specific.` };
            }
            if (assigneeResult.resolved.length > 0) {
              assigneeId = assigneeResult.resolved[0].id ?? undefined;
            }
          }

          return await wrapResult(
            updateTimelineEvent(args.eventId as string, {
              title: args.title as string | undefined,
              startDate: args.startDate as string | undefined,
              endDate: args.endDate as string | undefined,
              status: args.status as TimelineEventStatus | undefined,
              progress: args.progress as number | undefined,
              notes: (args.notes as string | null | undefined) ?? undefined,
              color: (args.color as string | null | undefined) ?? undefined,
              isMilestone: args.isMilestone as boolean | undefined,
              assigneeId: assigneeId,
            }, { authContext: authContext ?? undefined })
          );
        }

      case "deleteTimelineEvent":
        return await wrapResult(deleteTimelineEvent(args.eventId as string, { authContext: authContext ?? undefined }));

      case "createTimelineDependency":
        return await wrapResult(
          createTimelineDependency({
            timelineBlockId: args.timelineBlockId as string,
            fromId: args.fromEventId as string,
            toId: args.toEventId as string,
            dependencyType: args.dependencyType as any,
            authContext: authContext ?? undefined,
          })
        );

      case "deleteTimelineDependency":
        return await wrapResult(
          deleteTimelineDependency(args.dependencyId as string, { authContext: authContext ?? undefined })
        );

      // ==================================================================
      // PROPERTY ACTIONS
      // ==================================================================
      case "createPropertyDefinition":
        if (!workspaceId) {
          return { success: false, error: "No workspace selected" };
        }
        return await wrapResult(
          createPropertyDefinition({
            workspace_id: workspaceId,
            name: args.name as string,
            type: args.type as any,
            options: args.options as any,
          })
        );

      case "updatePropertyDefinition":
        return await wrapResult(
          updatePropertyDefinition(args.definitionId as string, {
            name: args.name as string | undefined,
            options: args.options as any,
          })
        );

      case "deletePropertyDefinition":
        return await wrapResult(
          deletePropertyDefinition(args.definitionId as string)
        );

      case "setEntityProperty":
        return await wrapResult(
          setEntityProperty({
            entity_type: args.entityType as any,
            entity_id: args.entityId as string,
            property_definition_id: args.propertyDefinitionId as string,
            value: args.value as PropertyValue,
          })
        );

      case "removeEntityProperty":
        return await wrapResult(
          removeEntityProperty(
            args.entityType as any,
            args.entityId as string,
            args.propertyDefinitionId as string
          )
        );

      // ==================================================================
      // CLIENT ACTIONS
      // ==================================================================
      case "createClient":
        if (!workspaceId) {
          return { success: false, error: "No workspace selected" };
        }
        return await wrapResult(
          createClient(workspaceId, {
            name: args.name as string,
            email: args.email as string | undefined,
            company: args.company as string | undefined,
            phone: args.phone as string | undefined,
            address: args.address as string | undefined,
            website: args.website as string | undefined,
            notes: args.notes as string | undefined,
          }, { authContext: authContext ?? undefined })
        );

      case "updateClient":
        return await wrapResult(
          updateClient(args.clientId as string, {
            name: args.name as string | undefined,
            email: args.email as string | undefined,
            company: args.company as string | undefined,
            phone: args.phone as string | undefined,
            address: args.address as string | undefined,
            website: args.website as string | undefined,
            notes: args.notes as string | undefined,
          }, { authContext: authContext ?? undefined })
        );

      case "deleteClient":
        return await wrapResult(deleteClient(args.clientId as string, { authContext: authContext ?? undefined }));

      // ==================================================================
      // DOC ACTIONS
      // ==================================================================
      case "createDoc":
        if (!workspaceId) {
          return { success: false, error: "No workspace selected" };
        }
        return await wrapResult(
          createDoc(workspaceId, args.title as string, { authContext: authContext ?? undefined })
        );

      case "updateDoc":
        return await wrapResult(
          updateDoc(args.docId as string, {
            title: args.title as string | undefined,
            content: args.content as any,
          }, { authContext: authContext ?? undefined })
        );

      case "archiveDoc":
        return await wrapResult(
          updateDoc(args.docId as string, { is_archived: true }, { authContext: authContext ?? undefined })
        );

      case "deleteDoc":
        return await wrapResult(deleteDoc(args.docId as string, { authContext: authContext ?? undefined }));

      // ==================================================================
      // FILE ACTIONS
      // ==================================================================
      case "fileAnalysisQuery": {
        if (!authContext?.supabase) return { success: false, error: "Unauthorized" };
        const fileIds = Array.isArray((args as any)?.fileIds)
          ? ((args as any).fileIds as unknown[]).map((id) => String(id)).filter(Boolean)
          : [];
        const query = String((args as any)?.query || "").trim();
        if (fileIds.length === 0) return { success: false, error: "Missing fileIds for fileAnalysisQuery" };
        if (!query) return { success: false, error: "Missing query for fileAnalysisQuery" };

        const includeTables = (args as any)?.includeTables !== false;
        const maxTextChars = typeof (args as any)?.maxTextChars === "number" ? (args as any).maxTextChars : 8000;
        const maxTableRows = typeof (args as any)?.maxTableRows === "number" ? (args as any).maxTableRows : 50;

        const { data: files, error } = await authContext.supabase
          .from("files")
          .select("id, file_name, file_size, file_type, storage_path, workspace_id, project_id")
          .in("id", fileIds);

        if (error) {
          return { success: false, error: error.message || "Failed to load files" };
        }

        const resolved = (files || []) as unknown as FileAnalysisFileRecord[];
        const results: any[] = [];
        for (const file of resolved) {
          try {
            const artifact = await ensureFileArtifact(authContext.supabase, file);
            const useRag = shouldUseRag({
              fileSize: file.file_size,
              tokenEstimate: artifact.token_estimate || 0,
              rowCount: artifact.row_count,
              pageCount: artifact.page_count,
            });

            let chunks: Array<{ id: string; chunk_index: number; content: string }> = [];
            if (useRag && artifact.status === "ready") {
              await ensureFileChunks(authContext.supabase, file, artifact);
              const retrieved = await retrieveRelevantChunks(authContext.supabase, [file.id], query);
              chunks = (retrieved || []).slice(0, 10).map((chunk) => ({
                id: chunk.id,
                chunk_index: chunk.chunk_index,
                content: chunk.content,
              }));
            }

            const extractedText = String(artifact.extracted_text || "");
            const textPreview = extractedText.length > maxTextChars ? extractedText.slice(0, maxTextChars) : extractedText;
            const tables = includeTables && Array.isArray(artifact.extracted_tables)
              ? (artifact.extracted_tables as any[]).slice(0, 5).map((table) => ({
                ...table,
                rows: Array.isArray(table?.rows) ? table.rows.slice(0, Math.max(1, maxTableRows)) : [],
              }))
              : [];

            results.push({
              file: {
                id: file.id,
                file_name: file.file_name,
                file_type: file.file_type,
                file_size: file.file_size,
              },
              artifact: {
                id: artifact.id,
                status: artifact.status,
                page_count: artifact.page_count,
                row_count: artifact.row_count,
                column_count: artifact.column_count,
                token_estimate: artifact.token_estimate,
              },
              textPreview,
              tablesPreview: tables,
              chunks,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to analyze file";
            results.push({
              file: { id: file.id, file_name: (file as any).file_name },
              error: message,
            });
          }
        }

        return { success: true, data: { query, results } };
      }

      case "renameFile":
        return await wrapResult(
          renameFile(args.fileId as string, args.fileName as string, { authContext: authContext ?? undefined })
        );

      // ==================================================================
      // COMMENT ACTIONS (for table rows)
      // ==================================================================
      case "createComment":
        // Table row comments
        return await wrapResult(
          createTableComment({
            rowId: args.rowId as string,
            content: args.text as string,
            parentId: undefined,
            authContext: authContext ?? undefined,
          })
        );

      case "updateComment":
        return await wrapResult(
          updateTableComment(args.commentId as string, args.text as string, { authContext: authContext ?? undefined })
        );

      case "deleteComment":
        return await wrapResult(deleteTableComment(args.commentId as string, { authContext: authContext ?? undefined }));

      // ==================================================================
      // UNKNOWN TOOL
      // ==================================================================
      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (error) {
    aiDebug("executeTool:error", { tool: name, error });
    console.error(`[executeTool] Error executing ${name}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  } finally {
    aiDebug("executeTool:done", { tool: name, ms: Math.round(performance.now() - t0) });
    // Clear test context if it was set
    if (shouldUseTestContext && context?.workspaceId && context?.userId) {
      await clearTestContext();
    }
  }
}

interface ResolveAssigneesResult {
  resolved: Array<{ id?: string | null; name?: string | null }>;
  ambiguities: Array<{ input: string; matches: Array<{ id: string; name: string; email: string }> }>;
}

async function resolveTaskAssignees(
  assignees: Array<Record<string, unknown>>,
  searchCtx?: SearchContextSuccess
): Promise<ResolveAssigneesResult> {
  const resolved: Array<{ id?: string | null; name?: string | null }> = [];
  const ambiguities: Array<{ input: string; matches: Array<{ id: string; name: string; email: string }> }> = [];
  const opts = searchCtx ? { ctx: searchCtx } : undefined;

  for (const assignee of assignees) {
    if (!assignee || typeof assignee !== "object") continue;

    const userId =
      (assignee.userId as string | undefined) ||
      (assignee.user_id as string | undefined);

    if (userId) {
      // If we have a userId but no name, try to fetch the name
      const existingName = assignee.name as string | undefined;
      if (existingName) {
        resolved.push({
          id: userId,
          name: existingName,
        });
      } else {
        // Try to fetch the name from workspace members
        const search = await searchWorkspaceMembers(
          { searchText: userId, limit: 5 },
          opts
        );
        resolved.push({
          id: userId,
          name: search.data?.[0]?.name ?? null,
        });
      }
      continue;
    }

    const name = assignee.name as string | undefined;
    if (name) {
      const search = await searchWorkspaceMembers(
        { searchText: name, limit: 5 },
        opts
      );

      if (search.data && search.data.length === 1) {
        // Exact match - use it
        resolved.push({
          id: search.data[0].user_id,
          name: search.data[0].name ?? name,
        });
      } else if (search.data && search.data.length > 1) {
        // CRITICAL FIX: Multiple matches - report ambiguity instead of creating external assignee
        ambiguities.push({
          input: name,
          matches: search.data.map((m) => ({
            id: m.user_id,
            name: m.name ?? "",
            email: m.email,
          })),
        });
      } else {
        // No matches - create external assignee with name only
        resolved.push({ name });
      }
      continue;
    }

    const id = assignee.id as string | undefined;
    if (id) {
      // Try to fetch the name from workspace members
      const search = await searchWorkspaceMembers(
        { searchText: id, limit: 5 },
        opts
      );
      resolved.push({
        id,
        name: search.data?.[0]?.name ?? null,
      });
    }
  }

  return { resolved, ambiguities };
}

/** Cache task block id per tab so repeated create-task in same tab skips searchBlocks (same request/session). */
const taskBlockIdByTabCache = new Map<string, string>();

/** Resolve task block ID from context when not provided. Used for parallelization with assignee resolution. */
async function resolveTaskBlockIdForCreateTask(
  context: ToolExecutionContext | undefined,
  args: Record<string, unknown>,
  searchCtx?: SearchContextSuccess,
  authContext?: AuthContext | null
): Promise<string | null> {
  if (args.taskBlockId) return args.taskBlockId as string;

  const blockOpts = searchCtx ? { ctx: searchCtx } : undefined;

  if (context?.currentTabId) {
    const cached = taskBlockIdByTabCache.get(context.currentTabId);
    if (cached) return cached;

    const existingBlocks = await searchBlocks(
      { type: "task", tabId: context.currentTabId, limit: 1 },
      blockOpts
    );
    if (existingBlocks.data && existingBlocks.data.length > 0) {
      const id = existingBlocks.data[0].id;
      taskBlockIdByTabCache.set(context.currentTabId, id);
      return id;
    }
    const blockResult = await createBlock({
      tabId: context.currentTabId,
      type: "task",
      content: { title: "Tasks", hideIcons: false, viewMode: "list", boardGroupBy: "status" },
      authContext: authContext ?? undefined,
    });
    if (!("error" in blockResult) && blockResult.data) {
      const id = blockResult.data.id;
      taskBlockIdByTabCache.set(context.currentTabId, id);
      return id;
    }
  }

  const anyBlock = await searchBlocks({ type: "task", limit: 1 }, blockOpts);
  if (anyBlock.data && anyBlock.data.length > 0) return anyBlock.data[0].id;

  if (args.taskBlockName && context?.currentTabId) {
    const existingBlocks = await searchBlocks(
      { type: "task", tabId: context.currentTabId, limit: 5 },
      blockOpts
    );
    if (existingBlocks.data) {
      const blockName = (args.taskBlockName as string).toLowerCase();
      const exact = existingBlocks.data.find(
        (b) => (b.content as Record<string, unknown>)?.title?.toString().toLowerCase() === blockName
      );
      if (exact) return exact.id;
      const fuzzy = existingBlocks.data.find((b) =>
        (b.content as Record<string, unknown>)?.title?.toString().toLowerCase().includes(blockName)
      );
      if (fuzzy) return fuzzy.id;
    }
  }
  return null;
}

const DEFAULT_FIELD_NAMES = new Set(["column 2", "column 3"]);
const CONFIG_REQUIRED_TYPES = new Set(["formula", "rollup", "relation"]);
const PRIMARY_FIELD_ALIASES = new Set(["name", "title", "state", "state name", "state_name"]);

function normalizeFieldName(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function isDefaultFieldName(value?: string | null): boolean {
  return DEFAULT_FIELD_NAMES.has(normalizeFieldName(value));
}

function applyDefaultFieldConfig(
  type: string,
  config?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (type === "priority") {
    const levels = (config as any)?.levels;
    if (!Array.isArray(levels) || levels.length === 0) {
      return {
        ...(config || {}),
        levels: [
          { id: crypto.randomUUID(), label: "Critical", color: "#ef4444", order: 4 },
          { id: crypto.randomUUID(), label: "High", color: "#f97316", order: 3 },
          { id: crypto.randomUUID(), label: "Medium", color: "#3b82f6", order: 2 },
          { id: crypto.randomUUID(), label: "Low", color: "#6b7280", order: 1 },
        ],
      };
    }
  }

  if (type === "status") {
    const options = (config as any)?.options;
    if (!Array.isArray(options) || options.length === 0) {
      return {
        ...(config || {}),
        options: [
          { id: crypto.randomUUID(), label: "Not Started", color: "#6b7280" },
          { id: crypto.randomUUID(), label: "In Progress", color: "#3b82f6" },
          { id: crypto.randomUUID(), label: "Complete", color: "#10b981" },
        ],
      };
    }
  }

  return config;
}

async function isNewEmptyTable(tableId: string): Promise<boolean> {
  const rowsResult = await getTableRows(tableId, { limit: 5, offset: 0 });
  if ("error" in rowsResult || !rowsResult.data) return false;

  const { rows, total } = rowsResult.data;
  const totalRows = total ?? rows.length;
  if (totalRows > 3) return false;

  const hasData = rows.some((row) => row.data && Object.keys(row.data).length > 0);
  return !hasData;
}

function looksLikeNumber(value: unknown): boolean {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

function inferFieldType(values: unknown[]): "number" | "text" {
  const nonNull = values.filter((value) => value !== null && value !== undefined);
  if (nonNull.length === 0) return "text";
  const allNumbers = nonNull.every((value) => looksLikeNumber(value));
  return allNumbers ? "number" : "text";
}

function collectFieldValues(
  rows: Array<{ data: Record<string, unknown> }>
): Map<string, { original: string; values: unknown[] }> {
  const fieldValues = new Map<string, { original: string; values: unknown[] }>();
  for (const row of rows) {
    const data = row.data || {};
    for (const [key, value] of Object.entries(data)) {
      const normalized = normalizeFieldName(key);
      const entry = fieldValues.get(normalized);
      if (entry) {
        entry.values.push(value);
      } else {
        fieldValues.set(normalized, { original: key, values: [value] });
      }
    }
  }
  return fieldValues;
}

async function maybeEnsureFieldsForRows(
  tableId: string,
  rows: Array<{ data: Record<string, unknown> }>
): Promise<void> {
  if (!tableId || rows.length === 0) return;

  const tableResult = await getTable(tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return;

  const fields = tableResult.data.fields;
  const nameToField = new Map(
    fields.map((field) => [normalizeFieldName(field.name), field])
  );
  const primaryField = fields.find((field) => field.is_primary) || fields[0];

  const fieldValues = collectFieldValues(rows);
  const missing = new Map<string, { original: string; values: unknown[] }>();

  for (const [normalized, entry] of fieldValues.entries()) {
    if (PRIMARY_FIELD_ALIASES.has(normalized)) continue;
    if (nameToField.has(normalized)) continue;
    if (fields.some((field) => field.id === entry.original)) continue;
    missing.set(normalized, entry);
  }

  if (missing.size === 0) return;

  const isEmpty = await isNewEmptyTable(tableId);
  const defaultFields = fields.filter(
    (field) => !field.is_primary && isDefaultFieldName(field.name)
  );

  const defaultQueue = isEmpty ? [...defaultFields] : [];

  for (const entry of missing.values()) {
    const type = inferFieldType(entry.values);
    const config = applyDefaultFieldConfig(type, undefined);
    const field = defaultQueue.shift();

    if (field) {
      await updateField(field.id, {
        name: entry.original,
        type,
        config,
      });
    } else {
      await createField({
        tableId,
        name: entry.original,
        type: type as any,
        config: config as any,
      });
    }
  }
}

function normalizeComparableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

async function shouldSkipDuplicateInsert(
  tableId: string,
  rows: Array<{ data: Record<string, unknown> }>
): Promise<boolean> {
  if (!tableId || rows.length === 0) return false;

  const tableResult = await getTable(tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return false;

  const primaryField =
    tableResult.data.fields.find((field) => field.is_primary) ||
    tableResult.data.fields[0];
  if (!primaryField) return false;

  const incomingValues = new Set<string>();
  for (const row of rows) {
    const value = row.data?.[primaryField.id];
    const normalized = normalizeComparableValue(value);
    if (normalized) incomingValues.add(normalized);
  }

  if (incomingValues.size === 0) return false;

  const fetchLimit = Math.max(incomingValues.size, 200);
  const rowsResult = await getTableRows(tableId, { limit: fetchLimit, offset: 0 });
  if ("error" in rowsResult || !rowsResult.data) return false;

  const { rows: existingRows, total } = rowsResult.data;
  if (!existingRows.length || (total ?? 0) === 0) return false;
  if (total !== null && total > existingRows.length) return false;

  const existingValues = new Set(
    existingRows
      .map((row) => normalizeComparableValue(row.data?.[primaryField.id]))
      .filter(Boolean)
  );

  if (existingValues.size === 0) return false;

  for (const value of incomingValues) {
    if (!existingValues.has(value)) return false;
  }

  return true;
}

async function maybeRemoveDefaultRows(tableId: string): Promise<void> {
  const rowsResult = await getTableRows(tableId, { limit: 5, offset: 0 });
  if ("error" in rowsResult || !rowsResult.data) return;

  const { rows, total } = rowsResult.data;
  const totalRows = total ?? rows.length;
  if (totalRows === 0 || totalRows > 3) return;

  const hasData = rows.some((row) => row.data && Object.keys(row.data).length > 0);
  if (hasData) return;

  const rowIds = rows.map((row) => row.id).filter(Boolean);
  if (rowIds.length === 0) return;

  await deleteRows(rowIds);
}

async function maybeReuseDefaultField(input: {
  tableId: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
  isPrimary?: boolean;
}): Promise<{ success: boolean; data?: unknown; error?: string } | null> {
  if (!input.tableId || !input.name || !input.type) return null;
  if (input.isPrimary) return null;

  const normalizedType = String(input.type);
  if (CONFIG_REQUIRED_TYPES.has(normalizedType) && !input.config) return null;

  const isEmpty = await isNewEmptyTable(input.tableId);
  if (!isEmpty) return null;

  const tableResult = await getTable(input.tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return null;

  const fields = tableResult.data.fields;
  const candidates = fields.filter((field) => !field.is_primary && isDefaultFieldName(field.name));
  if (candidates.length === 0) return null;

  const byName = new Map(candidates.map((field) => [normalizeFieldName(field.name), field]));
  const preferred = normalizedType === "text" ? ["column 2", "column 3"] : ["column 3", "column 2"];
  const candidate =
    preferred.map((name) => byName.get(name)).find(Boolean) ?? candidates[0];

  if (!candidate) return null;

  const nextConfig = applyDefaultFieldConfig(normalizedType, input.config);
  const updatePayload: Record<string, unknown> = {
    name: input.name,
    type: normalizedType,
  };
  if (nextConfig !== undefined) {
    updatePayload.config = nextConfig;
  }

  return await wrapResult(updateField(candidate.id, updatePayload));
}

async function findFieldByName(
  tableId: string,
  name: string
): Promise<Record<string, unknown> | null> {
  const tableResult = await getTable(tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return null;

  const normalized = normalizeFieldName(name);
  const match = tableResult.data.fields.find(
    (field) => normalizeFieldName(field.name) === normalized
  );

  return match ? (match as unknown as Record<string, unknown>) : null;
}

async function mapRowDataToFieldIds(
  tableId: string,
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>
): Promise<{
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>;
  warnings: string[];
}> {
  if (!tableId || rows.length === 0) return { rows, warnings: [] };

  const tableResult = await getTable(tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return { rows, warnings: [] };

  const fields = tableResult.data.fields;
  const primaryField = fields.find((f) => f.is_primary) || fields[0];
  const nameToId = new Map(
    fields.map((f) => [String(f.name).trim().toLowerCase(), f.id])
  );

  // CRITICAL FIX: Track unmatched fields to prevent silent data loss
  const allUnmatchedFields = new Map<string, number>(); // field name -> count of occurrences

  const mappedRows = rows.map((row, rowIndex) => {
    const data = row.data || {};
    const mapped: Record<string, unknown> = {};
    const unmatchedKeys: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = String(key).trim().toLowerCase();
      const fieldId = nameToId.get(normalizedKey);
      if (fieldId) {
        mapped[fieldId] = value;
      } else if (primaryField && PRIMARY_FIELD_ALIASES.has(normalizedKey)) {
        mapped[primaryField.id] = value;
      } else if (fields.some((f) => f.id === key)) {
        mapped[key] = value;
      } else {
        // Field doesn't match any table field - track it
        unmatchedKeys.push(key);
        allUnmatchedFields.set(key, (allUnmatchedFields.get(key) || 0) + 1);
      }
    }

    // If nothing mapped but there's a single value-like key, fallback to primary.
    if (Object.keys(mapped).length === 0 && primaryField && Object.keys(data).length === 1) {
      const onlyValue = Object.values(data)[0];
      mapped[primaryField.id] = onlyValue;
    }

    return { ...row, data: mapped };
  });

  // Build warnings about unmatched fields (potential data loss)
  const warnings: string[] = [];
  if (allUnmatchedFields.size > 0) {
    const availableFields = fields.map(f => f.name).join(", ");
    const unmatchedSummary = Array.from(allUnmatchedFields.entries())
      .map(([field, count]) => `"${field}" (${count} rows)`)
      .join(", ");

    const warningMessage = `Fields not found in table schema: ${unmatchedSummary}. Data for these fields was dropped. Available fields: ${availableFields}`;
    warnings.push(warningMessage);

    console.warn(
      `[mapRowDataToFieldIds] WARNING: Some field names did not match table schema.`,
      `\nTable ID: ${tableId}`,
      `\nUnmatched fields: ${unmatchedSummary}`,
      `\nAvailable fields: ${availableFields}`,
      `\nThis may indicate typos in field names or missing fields in the table.`,
      `\nData for unmatched fields will be silently dropped.`
    );

    // Also log to aiDebug for visibility in AI execution traces
    aiDebug("mapRowDataToFieldIds:unmatchedFields", {
      tableId,
      unmatchedFields: Array.from(allUnmatchedFields.entries()).map(([field, count]) => ({
        fieldName: field,
        occurrences: count,
      })),
      availableFields: fields.map(f => f.name),
      totalRows: rows.length,
    });
  }

  return { rows: mappedRows, warnings };
}

function normalizeFieldKey(value: string): string {
  return String(value).trim().toLowerCase();
}

function isSelectLike(fieldType?: string | null): boolean {
  return ["select", "multi_select", "status", "priority"].includes(String(fieldType));
}

function getOptionEntries(field: { type: string; config: Record<string, unknown> }): {
  kind: "options" | "levels" | null;
  options: Array<{ id: string; label: string; color?: string; order?: number }>;
} {
  if (field.type === "priority") {
    const levels =
      (field.config?.levels as Array<{ id: string; label: string; color?: string; order?: number }>) ?? [];
    return { kind: "levels", options: Array.isArray(levels) ? levels : [] };
  }
  if (field.type === "status" || field.type === "select" || field.type === "multi_select") {
    const options = (field.config?.options as Array<{ id: string; label: string; color?: string }>) ?? [];
    return { kind: "options", options: Array.isArray(options) ? options : [] };
  }
  return { kind: null, options: [] };
}

function generateOptionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opt_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveSelectValues(
  field: { type: string; config: Record<string, unknown> },
  rawValue: unknown,
  allowCreate: boolean
): { ids: string[]; updatedConfig?: Record<string, unknown>; missing: boolean } {
  if (rawValue === null || rawValue === undefined) {
    return { ids: [], missing: false };
  }
  const { kind, options } = getOptionEntries(field);
  if (!kind) {
    return { ids: [], missing: true };
  }

  const inputValues = Array.isArray(rawValue) ? rawValue : [rawValue];
  const normalizedOptions = new Map(options.map((opt) => [normalizeFieldKey(opt.label), opt]));

  const resolvedIds: string[] = [];
  const newOptions: Array<{ id: string; label: string; color?: string; order?: number }> = [...options];
  let added = false;

  for (const value of inputValues) {
    if (value && typeof value === "object") {
      const asObj = value as Record<string, unknown>;
      const id = typeof asObj.id === "string" ? asObj.id : undefined;
      if (id) {
        resolvedIds.push(id);
        continue;
      }
    }

    const label = normalizeFieldKey(String(value ?? ""));
    const existing = normalizedOptions.get(label);
    if (existing) {
      resolvedIds.push(existing.id);
      continue;
    }

    if (!allowCreate) {
      return { ids: [], missing: true };
    }

    const next = {
      id: generateOptionId(),
      label: String(value ?? "").trim() || "Option",
      color: "gray",
      order: newOptions.length + 1,
    };
    newOptions.push(next);
    normalizedOptions.set(label, next);
    resolvedIds.push(next.id);
    added = true;
  }

  if (added) {
    if (kind === "levels") {
      return { ids: resolvedIds, updatedConfig: { ...field.config, levels: newOptions }, missing: false };
    }
    return { ids: resolvedIds, updatedConfig: { ...field.config, options: newOptions }, missing: false };
  }

  return { ids: resolvedIds, missing: false };
}

function resolveUpdateValue(
  field: { id: string; type: string; config: Record<string, unknown> },
  rawValue: unknown,
  allowCreateOptions: boolean
): { value: unknown; updatedConfig?: Record<string, unknown> } {
  if (isSelectLike(field.type)) {
    if (rawValue === null || rawValue === undefined) {
      return { value: null };
    }
    const resolved = resolveSelectValues(field, rawValue, allowCreateOptions);
    const value = field.type === "multi_select" ? resolved.ids : resolved.ids[0] ?? null;
    return { value, updatedConfig: resolved.updatedConfig };
  }

  if (field.type === "checkbox" && typeof rawValue === "string") {
    const normalized = rawValue.toLowerCase().trim();
    if (normalized === "true") return { value: true };
    if (normalized === "false") return { value: false };
  }

  return { value: rawValue };
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  const normalized = raw.replace(/[, ]+/g, "").replace(/\$/g, "").toLowerCase();
  const suffixMatch = normalized.match(/^(-?\d+(\.\d+)?)([a-z]+)?$/);
  if (!suffixMatch) return null;

  const num = Number(suffixMatch[1]);
  const suffix = suffixMatch[3]; // group 1 is num, group 2 is optional decimal, group 3 is suffix
  if (!Number.isFinite(num)) return null;

  // const suffix = suffixMatch.groups.suffix ?? ""; // Removed duplicate
  const multipliers: Record<string, number> = {
    k: 1e3,
    thousand: 1e3,
    m: 1e6,
    million: 1e6,
    b: 1e9,
    billion: 1e9,
    t: 1e12,
    trillion: 1e12,
  };

  if (!suffix) return num;
  const multiplier = multipliers[suffix];
  if (!multiplier) return null;
  return num * multiplier;
}

function matchesRowFilters(
  rowData: Record<string, unknown>,
  filters: Record<string, unknown>,
  resolveField: (key: string) => { id: string; type: string; config: Record<string, unknown> } | undefined
): boolean {
  for (const [fieldKey, rawFilter] of Object.entries(filters)) {
    const field = resolveField(fieldKey);
    if (!field) return false;

    const normalized =
      rawFilter && typeof rawFilter === "object" && "op" in (rawFilter as Record<string, unknown>)
        ? (rawFilter as { op?: string; value?: unknown })
        : { op: "eq", value: rawFilter };

    const op = normalized.op ?? "eq";
    const filterValue = normalized.value;
    const actualValue = rowData[field.id];

    if (isSelectLike(field.type)) {
      const resolved = resolveSelectValues(field, filterValue, false);
      if (resolved.missing) return false;
      const ids = resolved.ids;

      if (Array.isArray(actualValue)) {
        if (!actualValue.some((v) => ids.includes(String(v)))) return false;
      } else if (typeof actualValue === "string") {
        if (!ids.includes(actualValue)) return false;
      } else {
        return false;
      }
      continue;
    }

    if (actualValue === null || actualValue === undefined) return false;

    const actualString = typeof actualValue === "string" ? actualValue.toLowerCase() : null;
    const filterString = typeof filterValue === "string" ? filterValue.toLowerCase() : null;

    switch (op) {
      case "contains": {
        if (Array.isArray(actualValue)) {
          if (!actualValue.some((v) => String(v).toLowerCase().includes(filterString ?? String(filterValue)))) {
            return false;
          }
        } else if (typeof actualValue === "object") {
          const obj = actualValue as Record<string, unknown>;
          const name = typeof obj.name === "string" ? obj.name.toLowerCase() : "";
          if (!name.includes(filterString ?? "")) return false;
        } else {
          if (!String(actualValue).toLowerCase().includes(filterString ?? String(filterValue))) return false;
        }
        break;
      }
      case "gte": {
        if (typeof actualValue === "number" && typeof filterValue === "number") {
          if (actualValue < filterValue) return false;
        } else {
          const actualNumeric = parseNumericValue(actualValue);
          const filterNumeric = parseNumericValue(filterValue);
          if (actualNumeric !== null && filterNumeric !== null) {
            if (actualNumeric < filterNumeric) return false;
          } else if (typeof actualValue === "string" && typeof filterValue === "string") {
            if (actualValue < filterValue) return false;
          } else {
            return false;
          }
        }
        break;
      }
      case "lte": {
        if (typeof actualValue === "number" && typeof filterValue === "number") {
          if (actualValue > filterValue) return false;
        } else {
          const actualNumeric = parseNumericValue(actualValue);
          const filterNumeric = parseNumericValue(filterValue);
          if (actualNumeric !== null && filterNumeric !== null) {
            if (actualNumeric > filterNumeric) return false;
          } else if (typeof actualValue === "string" && typeof filterValue === "string") {
            if (actualValue > filterValue) return false;
          } else {
            return false;
          }
        }
        break;
      }
      case "eq":
      default: {
        if (Array.isArray(actualValue)) {
          if (!actualValue.some((v) => String(v).toLowerCase() === (filterString ?? String(filterValue).toLowerCase()))) {
            return false;
          }
        } else if (typeof actualValue === "object") {
          const obj = actualValue as Record<string, unknown>;
          const id = obj.id as string | undefined;
          const name = obj.name as string | undefined;
          if (
            (filterValue && id && String(filterValue) === id) ||
            (filterString && name && name.toLowerCase() === filterString)
          ) {
            break;
          }
          return false;
        } else {
          const actualNumeric = parseNumericValue(actualValue);
          const filterNumeric = parseNumericValue(filterValue);
          if (actualNumeric !== null && filterNumeric !== null) {
            if (actualNumeric !== filterNumeric) return false;
            break;
          }
          if (actualString !== null && filterString !== null) {
            if (actualString !== filterString) return false;
          } else if (String(actualValue) !== String(filterValue)) {
            return false;
          }
        }
        break;
      }
    }
  }

  return true;
}

function isUuid(value: string | undefined | null): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Wrap an action result into the standard ToolCallResult format.
 */
async function wrapResult(
  promise: Promise<{ data?: unknown; error?: string | null } | unknown>
): Promise<ToolCallResult> {
  try {
    const result = await promise;

    // Handle ActionResult pattern { data, error }
    if (result && typeof result === "object" && "error" in result) {
      const actionResult = result as { data?: unknown; error?: string | null };
      if (actionResult.error) {
        const wrapped = { success: false, error: actionResult.error };
        aiDebug("executeTool:result", summarizeToolResult(wrapped));
        return wrapped;
      }
      const wrapped = { success: true, data: actionResult.data };
      aiDebug("executeTool:result", summarizeToolResult(wrapped));
      return wrapped;
    }

    // Handle SearchResponse pattern { data, error }
    if (result && typeof result === "object" && "data" in result) {
      const searchResult = result as { data?: unknown; error?: string | null };
      if (searchResult.error) {
        const wrapped = { success: false, error: searchResult.error };
        aiDebug("executeTool:result", summarizeToolResult(wrapped));
        return wrapped;
      }
      const wrapped = { success: true, data: searchResult.data };
      aiDebug("executeTool:result", summarizeToolResult(wrapped));
      return wrapped;
    }

    // Direct result
    const wrapped = { success: true, data: result };
    aiDebug("executeTool:result", summarizeToolResult(wrapped));
    return wrapped;
  } catch (error) {
    const wrapped = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    aiDebug("executeTool:result", summarizeToolResult(wrapped));
    return wrapped;
  }
}

/**
 * Execute multiple tool calls in sequence.
 */
export async function executeToolsSequentially(
  toolCalls: ToolCall[]
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall);
    results.push(result);

    // Stop on first error if needed
    // if (!result.success) break;
  }

  return results;
}

/**
 * Execute multiple independent tool calls in parallel.
 */
export async function executeToolsParallel(
  toolCalls: ToolCall[]
): Promise<ToolCallResult[]> {
  return Promise.all(toolCalls.map((toolCall) => executeTool(toolCall)));
}
