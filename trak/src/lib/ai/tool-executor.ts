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
  searchPayments,
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
} from "@/app/actions/block";

// ============================================================================
// IMPORTS - Table Actions
// ============================================================================
import { createTable, getTable } from "@/app/actions/tables/table-actions";
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

// ============================================================================
// IMPORTS - Property Actions
// ============================================================================
import {
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
} from "@/app/actions/properties/definition-actions";
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

// Note: Payment actions use updatePaymentStatus, not generic CRUD
// Payments are handled differently in this codebase

// ============================================================================
// IMPORTS - Workspace Context
// ============================================================================
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { aiDebug } from "./debug";

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

/**
 * Execute a tool call and return the result.
 * This function maps tool names to their corresponding server actions.
 */
export async function executeTool(
  toolCall: ToolCall
): Promise<ToolCallResult> {
  const { name, arguments: args } = toolCall;

  try {
    aiDebug("executeTool:start", { tool: name, arguments: args });
    // Get workspace ID for actions that need it
    const workspaceId = await getCurrentWorkspaceId();

    switch (name) {
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
        return await wrapResult(searchTables(args as any));

      case "searchTableRows":
        return await wrapResult(searchTableRows(args as any));

      case "searchTimelineEvents":
        return await wrapResult(searchTimelineEvents(args as any));

      case "searchFiles":
        return await wrapResult(searchFiles(args as any));

      case "searchPayments":
        return await wrapResult(searchPayments(args as any));

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
        return await wrapResult(
          createTaskItem({
            taskBlockId: args.taskBlockId as string,
            title: args.title as string,
            status: args.status as any,
            priority: args.priority as any,
            description: args.description as string | undefined,
            dueDate: args.dueDate as string | undefined,
            dueTime: args.dueTime as string | undefined,
            startDate: args.startDate as string | undefined,
          })
        );

      case "updateTaskItem":
        return await wrapResult(
          updateTaskItem(args.taskId as string, {
            title: args.title as string | undefined,
            status: args.status as any,
            priority: args.priority as any,
            description: args.description as string | null | undefined,
            dueDate: args.dueDate as string | null | undefined,
            dueTime: args.dueTime as string | null | undefined,
            startDate: args.startDate as string | null | undefined,
          })
        );

      case "deleteTaskItem":
        return await wrapResult(deleteTaskItem(args.taskId as string));

      case "setTaskAssignees":
        if (!args.taskId || !Array.isArray(args.assignees)) {
          return {
            success: false,
            error: "Missing taskId or assignees array for setTaskAssignees. Required format: setTaskAssignees(taskId, [{id: 'user-uuid', name: 'User Name'}]). Always search for workspace members first using searchWorkspaceMembers to get both id and name.",
          };
        }
        // Validate assignees have proper structure
        const invalidAssignees = (args.assignees as any[]).filter(
          (a) => !a || typeof a !== "object" || (!a.id && !a.name && !a.userId && !a.user_id)
        );
        if (invalidAssignees.length > 0) {
          return {
            success: false,
            error: "Invalid assignee format. Each assignee must have 'id' and 'name' properties. Example: [{id: 'uuid', name: 'John Doe'}]. Use searchWorkspaceMembers to get user details first.",
          };
        }
        return await wrapResult(
          setTaskAssignees(
            args.taskId as string,
            await resolveTaskAssignees(args.assignees as any[])
          )
        );

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
        return await wrapResult(
          createProject(workspaceId, {
            name: args.name as string,
            client_id: args.clientId as string | undefined,
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
      case "createBlock":
        return await wrapResult(
          createBlock({
            tabId: args.tabId as string,
            type: args.type as any,
            content: args.content as any,
            position: args.position as number | undefined,
            column: args.column as number | undefined,
            parentBlockId: args.parentBlockId as string | undefined,
          })
        );

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

        const tabId = args.tabId as string | undefined;
        if (tabId) {
          const blockResult = await createBlock({
            tabId,
            type: "table",
            content: { tableId: tableResult.data.table.id },
          });
          if ("error" in blockResult) {
            return { success: false, error: blockResult.error };
          }
          return { success: true, data: { ...tableResult.data, block: blockResult.data } };
        }

        return { success: true, data: tableResult.data };
      }

      case "createField":
        return await wrapResult(
          createField({
            tableId: args.tableId as string,
            name: args.name as string,
            type: args.type as any,
            config: args.config as any,
            isPrimary: args.isPrimary as boolean | undefined,
          })
        );

      case "updateField":
        return await wrapResult(
          updateField(args.fieldId as string, {
            name: args.name as string | undefined,
            config: args.config as any,
          })
        );

      case "deleteField":
        return await wrapResult(deleteField(args.fieldId as string));

      case "createRow":
        return await wrapResult(
          createRow({
            tableId: args.tableId as string,
            data: args.data as Record<string, unknown>,
          })
        );

      case "updateRow":
        return await wrapResult(
          updateRow(args.rowId as string, {
            data: args.data as Record<string, unknown>,
          })
        );

      case "updateCell":
        return await wrapResult(
          updateCell(
            args.rowId as string,
            args.fieldId as string,
            args.value
          )
        );

      case "deleteRow":
        return await wrapResult(deleteRow(args.rowId as string));

      case "deleteRows":
        return await wrapResult(deleteRows(args.rowIds as string[]));

      case "bulkInsertRows":
        {
          const rowsArg =
            (args.rows as Array<{ data: Record<string, unknown>; order?: number | string | null }>) ??
            undefined;
          const legacyDataArg = args.data as Array<Record<string, unknown>> | undefined;
          const normalizedRows =
            rowsArg && Array.isArray(rowsArg)
              ? rowsArg
              : Array.isArray(legacyDataArg)
                ? legacyDataArg.map((data) => ({ data }))
                : undefined;

          if (!normalizedRows) {
            return {
              success: false,
              error: "Missing rows for bulkInsertRows. Expected { rows: [{ data: {...} }] }.",
            };
          }

          const mappedRows = await mapRowDataToFieldIds(
            args.tableId as string,
            normalizedRows
          );

          return await wrapResult(
            bulkInsertRows({
              tableId: args.tableId as string,
              rows: mappedRows,
            })
          );
        }

      case "bulkUpdateRows":
        return await wrapResult(
          bulkUpdateRows({
            tableId: args.tableId as string,
            rowIds: args.rowIds as string[],
            updates: args.updates as Record<string, unknown>,
          })
        );

      // ==================================================================
      // TIMELINE ACTIONS
      // ==================================================================
      case "createTimelineEvent":
        return await wrapResult(
          createTimelineEvent({
            timelineBlockId: args.timelineBlockId as string,
            title: args.title as string,
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            status: args.status as string | undefined,
            progress: args.progress as number | undefined,
            notes: args.notes as string | undefined,
            color: args.color as string | undefined,
            isMilestone: args.isMilestone as boolean | undefined,
            assigneeId: args.assigneeId as string | undefined,
          })
        );

      case "updateTimelineEvent":
        return await wrapResult(
          updateTimelineEvent(args.eventId as string, {
            title: args.title as string | undefined,
            startDate: args.startDate as string | undefined,
            endDate: args.endDate as string | undefined,
            status: args.status as string | undefined,
            progress: args.progress as number | undefined,
            notes: args.notes as string | undefined,
            color: args.color as string | undefined,
            isMilestone: args.isMilestone as boolean | undefined,
            assigneeId: args.assigneeId as string | undefined,
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
            value: args.value,
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
          updateDoc(args.docId as string, { isArchived: true })
        );

      case "deleteDoc":
        return await wrapResult(deleteDoc(args.docId as string));

      // ==================================================================
      // COMMENT ACTIONS (for table rows)
      // ==================================================================
      case "createComment":
        // Table row comments
        return await wrapResult(
          createTableComment({
            rowId: args.targetId as string,
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
      // PAYMENT ACTIONS
      // Note: Payment CRUD is limited in this codebase. These are placeholder handlers.
      // ==================================================================
      case "createPayment":
        return {
          success: false,
          error: "Payment creation is not available through AI commands. Please use the payment interface.",
        };

      case "updatePayment":
        return {
          success: false,
          error: "Payment updates are not available through AI commands. Please use the payment interface.",
        };

      case "deletePayment":
        return {
          success: false,
          error: "Payment deletion is not available through AI commands. Please use the payment interface.",
        };

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
  }
}

async function resolveTaskAssignees(
  assignees: Array<Record<string, unknown>>
): Promise<Array<{ id?: string | null; name?: string | null }>> {
  const resolved: Array<{ id?: string | null; name?: string | null }> = [];

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
        limit: 2,
      });
      if (search.data && search.data.length === 1) {
        resolved.push({
          id: search.data[0].user_id,
          name: search.data[0].name ?? name,
        });
      } else {
        // Multiple or no matches - create external assignee with name only
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

  return resolved;
}

async function mapRowDataToFieldIds(
  tableId: string,
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>
): Promise<Array<{ data: Record<string, unknown>; order?: number | string | null }>> {
  if (!tableId || rows.length === 0) return rows;

  const tableResult = await getTable(tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return rows;

  const fields = tableResult.data.fields;
  const primaryField = fields.find((f) => f.is_primary) || fields[0];
  const nameToId = new Map(
    fields.map((f) => [String(f.name).trim().toLowerCase(), f.id])
  );

  return rows.map((row) => {
    const data = row.data || {};
    const mapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = String(key).trim().toLowerCase();
      const fieldId = nameToId.get(normalizedKey);
      if (fieldId) {
        mapped[fieldId] = value;
      } else if (primaryField && (normalizedKey === "name" || normalizedKey === "title")) {
        mapped[primaryField.id] = value;
      } else if (fields.some((f) => f.id === key)) {
        mapped[key] = value;
      }
    }

    // If nothing mapped but there's a single value-like key, fallback to primary.
    if (Object.keys(mapped).length === 0 && primaryField && Object.keys(data).length === 1) {
      const onlyValue = Object.values(data)[0];
      mapped[primaryField.id] = onlyValue;
    }

    return { ...row, data: mapped };
  });
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
        aiDebug("executeTool:result", wrapped);
        return wrapped;
      }
      const wrapped = { success: true, data: actionResult.data };
      aiDebug("executeTool:result", wrapped);
      return wrapped;
    }

    // Handle SearchResponse pattern { data, error }
    if (result && typeof result === "object" && "data" in result) {
      const searchResult = result as { data?: unknown; error?: string | null };
      if (searchResult.error) {
        const wrapped = { success: false, error: searchResult.error };
        aiDebug("executeTool:result", wrapped);
        return wrapped;
      }
      const wrapped = { success: true, data: searchResult.data };
      aiDebug("executeTool:result", wrapped);
      return wrapped;
    }

    // Direct result
    const wrapped = { success: true, data: result };
    aiDebug("executeTool:result", wrapped);
    return wrapped;
  } catch (error) {
    const wrapped = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    aiDebug("executeTool:result", wrapped);
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
