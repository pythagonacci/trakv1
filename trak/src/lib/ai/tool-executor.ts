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

// ============================================================================
// IMPORTS - File Actions
// ============================================================================
import { renameFile } from "@/app/actions/file";

// ============================================================================
// IMPORTS - Indexing Actions
// ============================================================================
import { reindexWorkspaceContent } from "@/app/actions/indexing";

// ============================================================================
// IMPORTS - Table Actions
// ============================================================================
import { createTable, getTable, deleteTable } from "@/app/actions/tables/table-actions";
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
// IMPORTS - Workspace Context
// ============================================================================
import { getCurrentWorkspaceId, setTestContext, clearTestContext } from "@/app/actions/workspace";
import { aiDebug } from "./debug";

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
  currentTabId?: string;
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

  try {
    aiDebug("executeTool:start", { tool: name, ...summarizeToolArgs(args) });

    // If context is provided (test mode), set it globally for server actions to use
    if (shouldUseTestContext && context?.workspaceId && context?.userId) {
      await setTestContext(context.workspaceId, context.userId);
    }

    // Get workspace ID from context or from cookies (for backward compatibility)
    const workspaceId = context?.workspaceId || await getCurrentWorkspaceId();

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
          const tabBlocks = await getTabBlocks(context.currentTabId);
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
          let taskBlockId = args.taskBlockId as string;

          // Optimization: If taskBlockId is missing but we have a currentTabId, try to find/create a block
          if (!taskBlockId && context?.currentTabId) {
            const existingBlocks = await searchBlocks({
              type: "task",
              tabId: context.currentTabId,
              limit: 1,
            });

            if (existingBlocks.data && existingBlocks.data.length > 0) {
              taskBlockId = existingBlocks.data[0].id;
            } else {
              // Create a new task block if none exists
              const blockResult = await createBlock({
                tabId: context.currentTabId,
                type: "task",
                content: { title: "Tasks", hideIcons: false, viewMode: "list", boardGroupBy: "status" },
              });

              if (!("error" in blockResult) && blockResult.data) {
                taskBlockId = blockResult.data.id;
              }
            }
          }

          // FALLBACK: If still no taskBlockId (e.g. global context), try to find ANY task block
          if (!taskBlockId) {
            const anyBlock = await searchBlocks({
              type: "task",
              limit: 1,
            });
            if (anyBlock.data && anyBlock.data.length > 0) {
              taskBlockId = anyBlock.data[0].id;
            }
          }

          if (!taskBlockId) {
            return { success: false, error: "Missing taskBlockId and could not auto-resolve from context. Please provide a task block ID." };
          }

          // Optimization: Resolve taskBlockName if provided
          if (!taskBlockId && args.taskBlockName && context?.currentTabId) {
            const blockName = args.taskBlockName as string;
            const existingBlocks = await searchBlocks({
              type: "task",
              tabId: context.currentTabId,
              limit: 5,
            });

            if (existingBlocks.data) {
              // Try exact match first
              const exact = existingBlocks.data.find(b =>
                (b.content as any)?.title?.toLowerCase() === blockName.toLowerCase()
              );
              if (exact) {
                taskBlockId = exact.id;
              } else {
                // Fuzzy match
                const fuzzy = existingBlocks.data.find(b =>
                  (b.content as any)?.title?.toLowerCase().includes(blockName.toLowerCase())
                );
                if (fuzzy) taskBlockId = fuzzy.id;
              }
            }
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
          // SMART TOOL: Pre-resolution of Assignees & Tags
          // ------------------------------------------------------------------
          let resolvedAssignees: any[] = [];
          if (Array.isArray(args.assignees) && args.assignees.length > 0) {
            const assigneeArgs = args.assignees.map(a =>
              // If it looks like an ID, treat as ID. If name, treat as name.
              isUuid(String(a)) ? { id: a, name: "Unknown" } : { name: String(a), id: undefined }
            );

            const resolveResult = await resolveTaskAssignees(assigneeArgs);
            if (resolveResult.ambiguities.length > 0) {
              const details = resolveResult.ambiguities.map(a => `"${a.input}"`).join(", ");
              return { success: false, error: `Ambiguous assignee names: ${details}. Please be more specific.` };
            }
            resolvedAssignees = resolveResult.resolved;
          }

          // ------------------------------------------------------------------
          // EXECUTION: Create -> Assign -> Tag
          // ------------------------------------------------------------------

          const directResult = await createTaskItem(payload);
          if (!("error" in directResult)) {
            const newTaskId = directResult.data.id;

            // Chain 1: Assignees
            if (resolvedAssignees.length > 0) {
              await setTaskAssignees(newTaskId, resolvedAssignees);
            }

            // Chain 2: Tags
            if (Array.isArray(args.tags) && args.tags.length > 0) {
              await setTaskTags(newTaskId, args.tags as string[]);
            }

            // Return the created task (fetching fresh might be better, but returning original is faster)
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
              });

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
                });
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

          return await wrapResult(
            updateTaskItem(taskId, {
              title: args.title as string | undefined,
              status: args.status as any,
              priority: args.priority as any,
              description: args.description as string | null | undefined,
              dueDate: args.dueDate as string | null | undefined,
              dueTime: args.dueTime as string | null | undefined,
              startDate: args.startDate as string | null | undefined,
            })
          );
        }

      case "bulkUpdateTaskItems":
        if (!Array.isArray(args.taskIds) || args.taskIds.length === 0) {
          return {
            success: false,
            error: "bulkUpdateTaskItems requires a non-empty taskIds array.",
          };
        }
        const updatesArg = args.updates as Record<string, unknown> | undefined;
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
          })
        );

      case "deleteTaskItem":
        return await wrapResult(deleteTaskItem(args.taskId as string));

      case "bulkMoveTaskItems":
        return await wrapResult(
          bulkMoveTaskItems({
            taskIds: args.taskIds as string[],
            targetBlockId: args.targetBlockId as string,
          })
        );

      case "duplicateTasksToBlock":
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
            assigneeResult.resolved
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

          const failures: Array<{ taskId: string; error: string }> = [];
          for (const taskId of taskIds) {
            const result = await setTaskAssignees(taskId, assigneeResult.resolved);
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
          setTaskTags(args.taskId as string, args.tagNames as string[])
        );

      case "createTaskSubtask":
        return await wrapResult(
          createTaskSubtask({
            taskId: args.taskId as string,
            title: args.title as string,
            completed: args.completed as boolean | undefined,
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
        return await wrapResult(deleteTaskSubtask(args.subtaskId as string));

      case "createTaskComment":
        return await wrapResult(
          createTaskComment({
            taskId: args.taskId as string,
            text: args.text as string,
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
          })
        );

      case "updateProject":
        return await wrapResult(
          updateProject(args.projectId as string, {
            name: args.name as string | undefined,
            status: args.status as any,
            client_id: args.clientId as string | null | undefined,
            due_date_date: args.dueDate as string | null | undefined,
          })
        );

      case "deleteProject":
        return await wrapResult(deleteProject(args.projectId as string));

      // ==================================================================
      // TAB ACTIONS
      // ==================================================================
      case "createTab":
        return await wrapResult(
          createTab({
            projectId: args.projectId as string,
            name: args.name as string,
            parentTabId: args.parentTabId as string | null | undefined,
          })
        );

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
        return await wrapResult(deleteBlock(args.blockId as string));

      // ==================================================================
      // TABLE ACTIONS
      // ==================================================================
      case "createTable": {
        const targetWorkspaceId = (args.workspaceId as string | undefined) || workspaceId;
        if (!targetWorkspaceId) {
          return { success: false, error: "Missing workspaceId for createTable" };
        }

        const tabId = args.tabId as string | undefined;

        // Create the table
        const tableResult = await createTable({
          workspaceId: targetWorkspaceId,
          projectId: args.projectId as string | undefined,
          title: args.title as string | undefined,
          description: args.description as string | null | undefined,
          icon: args.icon as string | null | undefined,
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
          });

          if ("error" in blockResult) {
            // CRITICAL FIX: Table was created but block creation failed
            // Clean up the orphaned table to maintain data consistency
            await deleteTable(tableResult.data.table.id);

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

      case "updateField":
        return await wrapResult(
          updateField(args.fieldId as string, {
            name: args.name as string | undefined,
            config: args.config as any,
          })
        );

      case "deleteField":
        return await wrapResult(deleteField(args.fieldId as string));

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
          })
        );
      }

      case "updateRow":
        return await wrapResult(
          updateRow(args.rowId as string, {
            data: args.data as Record<string, unknown>,
          })
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
          updateCell(args.rowId as string, args.fieldId as string, args.value)
        );

      case "deleteRow":
        return await wrapResult(deleteRow(args.rowId as string));

      case "deleteRows":
        return await wrapResult(deleteRows(args.rowIds as string[]));

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

        // Prepare update payload (by fieldId) and optionally extend options.
        const updatesByFieldId: Record<string, unknown> = {};
        const pendingConfigUpdates = new Map<string, Record<string, unknown>>();

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

        // Persist any new options before updating rows.
        for (const [fieldId, config] of pendingConfigUpdates.entries()) {
          const updateResult = await updateField(fieldId, { config });
          if ("error" in updateResult) {
            return { success: false, error: updateResult.error ?? "Failed to update field options." };
          }
        }

        const rowsResult = await searchTableRows({ tableId, limit });
        if (rowsResult.error || !rowsResult.data) {
          return { success: false, error: rowsResult.error ?? "Failed to load table rows." };
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

        if (updateResult.success) {
          updateResult.data = { updated: matchedRowIds.length, rowIds: matchedRowIds };
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

        if (!timelineBlockId) return { success: false, error: "Missing timelineBlockId. Provide ID or 'timelineBlockName'." };

        // Smart Tool: Resolve assigneeName
        let assigneeId = args.assigneeId as string | undefined;
        if (!assigneeId && args.assigneeName) {
          const assigneeResult = await resolveTaskAssignees([{ name: args.assigneeName as string }]);
          if (assigneeResult.resolved.length > 0) {
            assigneeId = assigneeResult.resolved[0].id;
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
          })
        );
      }
      case "updateTimelineEvent":
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
          })
        );

      case "deleteTimelineEvent":
        return await wrapResult(deleteTimelineEvent(args.eventId as string));

      case "createTimelineDependency":
        return await wrapResult(
          createTimelineDependency({
            timelineBlockId: args.timelineBlockId as string,
            fromId: args.fromEventId as string,
            toId: args.toEventId as string,
            dependencyType: args.dependencyType as any,
          })
        );

      case "deleteTimelineDependency":
        return await wrapResult(
          deleteTimelineDependency(args.dependencyId as string)
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
          })
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
          })
        );

      case "deleteClient":
        return await wrapResult(deleteClient(args.clientId as string));

      // ==================================================================
      // DOC ACTIONS
      // ==================================================================
      case "createDoc":
        if (!workspaceId) {
          return { success: false, error: "No workspace selected" };
        }
        return await wrapResult(
          createDoc(workspaceId, args.title as string)
        );

      case "updateDoc":
        return await wrapResult(
          updateDoc(args.docId as string, {
            title: args.title as string | undefined,
            content: args.content as any,
          })
        );

      case "archiveDoc":
        return await wrapResult(
          updateDoc(args.docId as string, { is_archived: true })
        );

      case "deleteDoc":
        return await wrapResult(deleteDoc(args.docId as string));

      // ==================================================================
      // FILE ACTIONS
      // ==================================================================
      case "renameFile":
        return await wrapResult(
          renameFile(args.fileId as string, args.fileName as string)
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
          })
        );

      case "updateComment":
        return await wrapResult(
          updateTableComment(args.commentId as string, args.text as string)
        );

      case "deleteComment":
        return await wrapResult(deleteTableComment(args.commentId as string));

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
  assignees: Array<Record<string, unknown>>
): Promise<ResolveAssigneesResult> {
  const resolved: Array<{ id?: string | null; name?: string | null }> = [];
  const ambiguities: Array<{ input: string; matches: Array<{ id: string; name: string; email: string }> }> = [];

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
        const search = await searchWorkspaceMembers({
          searchText: userId,
          limit: 1,
        });
        resolved.push({
          id: userId,
          name: search.data?.[0]?.name ?? null,
        });
      }
      continue;
    }

    const name = assignee.name as string | undefined;
    if (name) {
      const search = await searchWorkspaceMembers({
        searchText: name,
        limit: 5, // Increased from 2 to show more options
      });

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
      const search = await searchWorkspaceMembers({
        searchText: id,
        limit: 1,
      });
      resolved.push({
        id,
        name: search.data?.[0]?.name ?? null,
      });
    }
  }

  return { resolved, ambiguities };
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
