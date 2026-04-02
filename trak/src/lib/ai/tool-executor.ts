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
  searchSubtasks,
  getSubtaskDetails,
  searchProjects,
  searchClients,
  searchWorkspaceMembers,
  searchTabs,
  searchBlocks,
  searchCards,
  searchDocs,
  searchDocContent,
  searchTables,
  searchTableRows,
  searchTimelineEvents,
  searchFiles,
  searchTags,
  searchEntitiesByProperties,
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
import {
  createCard,
  updateCard,
  deleteCard,
} from "@/app/actions/cards/item-actions";
import { createSpecChartBlock } from "@/app/actions/chart-actions";
import { normalizeToChartRows, type ChartDataSourceType } from "@/lib/charts/normalizeToChartRows";

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
  reorderFields,
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
import { normalizeTimelineStatuses } from "@/lib/timeline-status-sync";
import { normalizeTimelinePriorities } from "@/lib/timeline-priority-sync";
import {
  createTimelineDependency,
  deleteTimelineDependency,
} from "@/app/actions/timelines/dependency-actions";
import type { TimelineEventStatus, TimelineEventPriority } from "@/types/timeline";

// ============================================================================
// IMPORTS - Property Actions
// ============================================================================
import type { PropertyValue } from "@/types/properties";
import {
  setEntityProperty,
  removeEntityProperty,
} from "@/app/actions/properties/entity-property-actions";
import { setEntityProperties } from "@/app/actions/entity-properties";

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
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { UndoStep, UndoTracker } from "@/lib/ai/undo";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isUniversalPropertyFieldType,
  normalizeUniversalPropertyValue,
  sanitizeUniversalPropertyFieldDefinition,
} from "@/lib/tables/universal-property";

// ============================================================================
// IMPORTS - Shopify Actions
// ============================================================================
import {
  getSariaProducts,
  getProductDetails,
  refreshProduct,
  type ShopifyProduct,
} from "@/app/actions/shopify-products";
import { getProductUnitsSold } from "@/app/actions/shopify-sales";
import { listShopifyConnections } from "@/app/actions/shopify-connection";

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
  hint?: string;
  /** Set when a write tool was called with source_entity_type/source_entity_id that could not be used (e.g. placeholder or invalid ID). */
  sourceMetadataIncomplete?: boolean;
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
  undoTracker?: UndoTracker;
  authContext?: AuthContext; // Pre-authenticated context (for Slack, API calls, etc.)
  searchedEntities?: Array<{ id: string; title: string; entityType: "task" | "card" | "timeline_event" | "table_row" | "block" | "subtask" }>;
  /** Recent search tool results for chart row hydration (rowIds → full rows). */
  recentSearchResults?: Array<{
    tool: string;
    args: Record<string, unknown>;
    data: Array<Record<string, unknown>>;
  }>;
}

const shouldUseTestContext = () => process.env.NODE_ENV === "test";
const CREATE_TABLE_FULL_MAX_INLINE_ROWS = 2;
const BULK_INSERT_DEFAULT_CHUNK_ROWS = 50;
const BULK_INSERT_MIN_CHUNK_ROWS = 2;
const BULK_INSERT_TARGET_PAYLOAD_CHARS = 14000;
const CHART_ROW_COMPRESSION_MAX_EXPANSION = 5000;

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

function isLikelyPayloadTooLargeError(error: string | undefined): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  return (
    normalized.includes("too large") ||
    normalized.includes("payload") ||
    normalized.includes("request entity too large") ||
    normalized.includes("413") ||
    normalized.includes("body size") ||
    normalized.includes("max size")
  );
}

function estimateBulkInsertRowsChars(
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>
): number {
  try {
    return JSON.stringify({ rows }).length;
  } catch {
    return rows.length * 200;
  }
}

function chooseInitialBulkInsertChunkSize(
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>
): number {
  if (rows.length <= BULK_INSERT_DEFAULT_CHUNK_ROWS) return rows.length;
  const sample = rows.slice(0, Math.min(rows.length, 10));
  const sampleChars = Math.max(1, estimateBulkInsertRowsChars(sample));
  const perRow = Math.max(50, Math.ceil(sampleChars / sample.length));
  const sizeByChars = Math.max(
    BULK_INSERT_MIN_CHUNK_ROWS,
    Math.floor(BULK_INSERT_TARGET_PAYLOAD_CHARS / perRow)
  );
  return Math.max(
    BULK_INSERT_MIN_CHUNK_ROWS,
    Math.min(BULK_INSERT_DEFAULT_CHUNK_ROWS, sizeByChars, rows.length)
  );
}

type ChartRowRecord = Record<string, unknown>;

function flattenChartRowBatches(rawBatches: unknown): ChartRowRecord[] {
  if (!Array.isArray(rawBatches)) return [];
  const out: ChartRowRecord[] = [];
  for (const batch of rawBatches) {
    if (!Array.isArray(batch)) continue;
    for (const row of batch) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        out.push(row as ChartRowRecord);
      }
    }
  }
  return out;
}

function normalizeChartRowsForExecution(rawRows: unknown, rawBatches: unknown): ChartRowRecord[] {
  const baseRows = Array.isArray(rawRows)
    ? rawRows.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as ChartRowRecord[]
    : [];
  const rows = baseRows.length > 0 ? baseRows : flattenChartRowBatches(rawBatches);
  if (rows.length === 0) return [];

  const expanded: ChartRowRecord[] = [];
  for (const original of rows) {
    const row = { ...original } as ChartRowRecord;
    const explicitCount = row.__count ?? row.count;
    const countNumber = Number(explicitCount);
    const repeat = Number.isFinite(countNumber) ? Math.max(1, Math.floor(countNumber)) : 1;
    delete row.__count;
    delete row.count;

    // Drop internal source metadata from chart rows; chart rendering does not consume it.
    delete row._source;

    for (let i = 0; i < repeat; i++) {
      if (expanded.length >= CHART_ROW_COMPRESSION_MAX_EXPANSION) {
        return expanded;
      }
      const idValue = String(row.id ?? `row_${expanded.length + 1}`);
      expanded.push({
        ...row,
        id: repeat > 1 ? `${idValue}__${i + 1}` : idValue,
      });
    }
  }
  return expanded;
}

// ─── Chart row hydration (rowIds → full rows from search results) ────────

type SearchResultEntry = {
  tool: string;
  args: Record<string, unknown>;
  data: Array<Record<string, unknown>>;
};

function searchToolToSourceType(tool: string): ChartDataSourceType | null {
  switch (tool) {
    case "searchTasks": return "tasks";
    case "searchTimelineEvents": return "timeline_events";
    case "searchTableRows": return "table_rows";
    case "searchCards": return "cards";
    default: return null;
  }
}

/**
 * Build a subtask chart row from raw subtask data (mirrors workflow-executor logic).
 */
function subtaskToChartRow(
  subtask: Record<string, unknown>,
  parentTitle?: string,
  parentTask?: Record<string, unknown>
): ChartRowRecord {
  const id = typeof subtask.id === "string" && subtask.id.length > 0 ? subtask.id : "subtask";
  const title = typeof subtask.title === "string" && subtask.title.trim().length > 0
    ? subtask.title
    : typeof subtask.task_title === "string"
      ? subtask.task_title
      : "Subtask";
  const row: ChartRowRecord = { id, "Task Title": title, type: "subtask" };

  const rawStatus = String(subtask.status ?? "").trim().toLowerCase();
  if (rawStatus) row.status = rawStatus;
  else if (typeof subtask.completed === "boolean") row.status = subtask.completed ? "done" : "todo";

  const rawPriority = String(subtask.priority ?? "").trim().toLowerCase();
  if (rawPriority) row.priority = rawPriority;

  if (typeof subtask.task_id === "string") row.parentTaskId = subtask.task_id;
  if (parentTitle) row.parentTaskTitle = parentTitle;
  else if (typeof subtask.task_title === "string") row.parentTaskTitle = subtask.task_title;

  // Navigation metadata: prefer parent task fields, fall back to subtask's own fields
  const tabId = typeof parentTask?.tab_id === "string" ? parentTask.tab_id : typeof subtask.tab_id === "string" ? subtask.tab_id : null;
  const projectId = typeof parentTask?.project_id === "string" ? parentTask.project_id : typeof subtask.project_id === "string" ? subtask.project_id : null;
  const projectName = typeof parentTask?.project_name === "string" ? parentTask.project_name : typeof subtask.project_name === "string" ? subtask.project_name : null;
  const tabName = typeof parentTask?.tab_name === "string" ? parentTask.tab_name : typeof subtask.tab_name === "string" ? subtask.tab_name : null;
  if (tabId) row.tabId = tabId;
  if (projectId) row.projectId = projectId;
  if (projectName) row.projectName = projectName;
  if (tabName) row.tabName = tabName;

  return row;
}

/**
 * Hydrate rowIds into full chart rows using recent search results.
 * Returns null if hydration cannot be performed (no matching search data).
 */
function hydrateChartRowsFromSearch(
  rowIds: string[],
  searchResults: SearchResultEntry[]
): ChartRowRecord[] | null {
  if (rowIds.length === 0 || searchResults.length === 0) return null;

  // Build a lookup of all entity IDs → normalized chart rows from search results.
  // Also index subtasks (nested in tasks or from searchSubtasks).
  const rowById = new Map<string, ChartRowRecord>();
  let hydratedAny = false;

  for (const entry of searchResults) {
    const sourceType = searchToolToSourceType(entry.tool);

    if (entry.tool === "searchSubtasks") {
      for (const subtask of entry.data) {
        const stId = typeof subtask.id === "string" ? subtask.id : null;
        if (stId && !rowById.has(stId)) {
          rowById.set(stId, subtaskToChartRow(subtask));
        }
      }
      continue;
    }

    if (!sourceType) continue;

    const normalized = normalizeToChartRows(sourceType, entry.data);
    for (const row of normalized) {
      if (row.id && !rowById.has(row.id)) {
        rowById.set(row.id, row as ChartRowRecord);
      }
    }

    // Index subtasks nested inside task results
    if (entry.tool === "searchTasks") {
      for (const task of entry.data) {
        const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
        const parentTitle = typeof task.title === "string" ? task.title : undefined;
        for (const subtask of subtasks) {
          if (subtask && typeof subtask === "object" && typeof subtask.id === "string") {
            if (!rowById.has(subtask.id)) {
              rowById.set(subtask.id, subtaskToChartRow(subtask as Record<string, unknown>, parentTitle, task as Record<string, unknown>));
            }
          }
        }
      }
    }
  }

  // Hydrate: look up each requested ID
  const result: ChartRowRecord[] = [];
  for (const id of rowIds) {
    const row = rowById.get(id);
    if (row) {
      result.push(row);
      hydratedAny = true;
    }
  }

  return hydratedAny ? result : null;
}

/**
 * Collect every entity ID visible in recent search results (tasks, subtasks, etc.).
 * Used to compute excludeIds when the LLM passes a filtered subset via rowIds.
 */
function extractAllIdsFromSearchResults(searchResults: SearchResultEntry[]): string[] {
  const ids: string[] = [];
  for (const entry of searchResults) {
    for (const item of entry.data) {
      if (typeof item.id === "string" && item.id.length > 0) ids.push(item.id);
      // Also collect nested subtasks from searchTasks results
      if (entry.tool === "searchTasks" && Array.isArray(item.subtasks)) {
        for (const st of item.subtasks) {
          if (st && typeof st === "object" && typeof (st as Record<string, unknown>).id === "string") {
            ids.push((st as Record<string, unknown>).id as string);
          }
        }
      }
    }
  }
  return ids;
}

/**
 * Auto-hydrate rows from search results when the LLM passes `rows` with IDs
 * that match recent search data. Returns the original rows if no match.
 */
function autoHydrateRowsFromSearch(
  rows: ChartRowRecord[],
  searchResults: SearchResultEntry[]
): ChartRowRecord[] {
  if (rows.length === 0 || searchResults.length === 0) return rows;

  const ids = rows.map((r) => String(r.id ?? "")).filter(Boolean);
  if (ids.length === 0) return rows;

  const hydrated = hydrateChartRowsFromSearch(ids, searchResults);
  if (!hydrated) return rows;

  // Only use hydrated rows if most IDs matched (>80%) — otherwise it's likely
  // inline/generated data that happens to share some IDs with search results.
  const matchRate = hydrated.length / ids.length;
  if (matchRate < 0.8) return rows;

  return hydrated;
}

async function resolveTaskBlockIdFromContext(
  context?: ToolExecutionContext
): Promise<string | undefined> {
  const rawContextBlockId = typeof context?.contextBlockId === "string" ? context.contextBlockId.trim() : "";
  if (!rawContextBlockId) return undefined;

  const blockResult = await getEntityById({
    entityType: "block",
    id: rawContextBlockId,
    authContext: context?.authContext,
  });
  if (blockResult.error || !blockResult.data) return undefined;

  const block = blockResult.data as { id?: string; type?: string };
  if (block.type !== "task" || typeof block.id !== "string" || block.id.length === 0) return undefined;
  return block.id;
}

function isExactContextTaskBlockIdValue(value: unknown, contextTaskBlockId: string): boolean {
  if (typeof value === "string") return value.trim() === contextTaskBlockId;
  if (Array.isArray(value)) {
    const normalized = value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
    return normalized.length > 0 && normalized.every((entry) => entry === contextTaskBlockId);
  }
  return false;
}

async function normalizeTaskSearchArgsForContext(
  toolName: string,
  args: Record<string, unknown>,
  context?: ToolExecutionContext
): Promise<Record<string, unknown>> {
  if (toolName !== "searchTasks" && toolName !== "searchSubtasks") return args;

  const contextTaskBlockId = await resolveTaskBlockIdFromContext(context);
  if (!contextTaskBlockId) return args;

  const nextArgs: Record<string, unknown> = { ...args };
  const hasExplicitTaskBlockScope =
    typeof nextArgs.taskBlockId === "string"
      ? nextArgs.taskBlockId.trim().length > 0
      : Array.isArray(nextArgs.taskBlockId)
        ? nextArgs.taskBlockId.some((value) => typeof value === "string" && value.trim().length > 0)
        : false;

  if (toolName === "searchSubtasks" && isExactContextTaskBlockIdValue(nextArgs.taskId, contextTaskBlockId)) {
    delete nextArgs.taskId;
  }

  if (!hasExplicitTaskBlockScope) {
    nextArgs.taskBlockId = contextTaskBlockId;
  }

  return nextArgs;
}

async function insertRowsAdaptive(
  tableId: string,
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>,
  options?: { authContext?: AuthContext }
): Promise<ToolCallResult> {
  if (rows.length === 0) return { success: true, data: { insertedIds: [] } };

  const insertedIds: string[] = [];
  const warnings: string[] = [];
  let index = 0;
  let chunkSize = chooseInitialBulkInsertChunkSize(rows);

  while (index < rows.length) {
    const chunk = rows.slice(index, index + chunkSize);
    const result = await wrapResult(
      bulkInsertRows({
        tableId,
        rows: chunk,
      })
    );
    if (result.success) {
      const chunkInserted = Array.isArray((result.data as Record<string, unknown> | undefined)?.insertedIds)
        ? ((result.data as Record<string, unknown>).insertedIds as string[])
        : [];
      insertedIds.push(...chunkInserted);
      index += chunk.length;
      continue;
    }

    if (!isLikelyPayloadTooLargeError(result.error) || chunkSize <= BULK_INSERT_MIN_CHUNK_ROWS) {
      return {
        success: false,
        error: result.error ?? "Failed to insert rows.",
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    const reduced = Math.max(
      BULK_INSERT_MIN_CHUNK_ROWS,
      chunkSize - Math.max(1, Math.ceil(chunkSize / 3))
    );
    warnings.push(
      `bulkInsertRows chunk reduced from ${chunkSize} to ${reduced} after payload-size failure.`
    );
    aiDebug("bulkInsertRows:chunkReduced", {
      tableId,
      from: chunkSize,
      to: reduced,
      rowIndex: index,
      reason: result.error,
    });
    chunkSize = reduced;
  }

  if (insertedIds.length > 0) {
    await syncPriorityStatusToEntityProperties(tableId, insertedIds, options?.authContext);
  }

  return {
    success: true,
    data: { insertedIds },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// UNDO HELPERS (Best-effort for AI tool writes)
// ============================================================================

function isWriteToolName(name: string) {
  return !(
    name.startsWith("search") ||
    name.startsWith("get") ||
    name.startsWith("resolve") ||
    name === "requestToolGroups" ||
    name === "unstructuredSearchWorkspace" ||
    name === "fileAnalysisQuery" ||
    name === "reindexWorkspaceContent"
  );
}

const FIXED_PROPERTY_NAME_MAP: Record<string, "status" | "priority" | "assignee_ids" | "due_date" | "tags"> = {
  status: "status",
  priority: "priority",
  assignee: "assignee_ids",
  assignees: "assignee_ids",
  assignee_id: "assignee_ids",
  assignee_ids: "assignee_ids",
  due: "due_date",
  due_date: "due_date",
  dueDate: "due_date",
  tag: "tags",
  tags: "tags",
};

function normalizePropertyName(value: unknown): keyof typeof FIXED_PROPERTY_NAME_MAP | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/\s+/g, "_");
  return (FIXED_PROPERTY_NAME_MAP[normalized] ? normalized : null) as keyof typeof FIXED_PROPERTY_NAME_MAP | null;
}

async function resolveAssigneeIdsFromValue(
  value: unknown,
  authContext: AuthContext | null
): Promise<string[]> {
  const ids = new Set<string>();
  const names: string[] = [];

  const addFromEntry = (entry: any) => {
    if (!entry) return;
    if (typeof entry === "string") {
      if (isUuid(entry)) ids.add(entry);
      else names.push(entry);
      return;
    }
    if (typeof entry === "object") {
      const id = typeof entry.id === "string" ? entry.id : typeof entry.user_id === "string" ? entry.user_id : null;
      const name = typeof entry.name === "string" ? entry.name : typeof entry.email === "string" ? entry.email : null;
      if (id && isUuid(id)) ids.add(id);
      else if (name) names.push(name);
    }
  };

  if (Array.isArray(value)) {
    value.forEach(addFromEntry);
  } else {
    addFromEntry(value);
  }

  if (names.length === 0) return Array.from(ids);

  const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
  if ("error" in ctxResult && ctxResult.error !== null) return Array.from(ids);
  const ctx = "error" in ctxResult ? null : ctxResult;
  if (!ctx) return Array.from(ids);

  for (const name of names) {
    const result = await searchWorkspaceMembers({ searchText: name, limit: 5 }, { ctx });
    const members = result.data ?? [];
    if (members.length === 0) continue;
    const exact = members.find((m) => m.name?.toLowerCase() === name.toLowerCase() || m.email?.toLowerCase() === name.toLowerCase());
    const chosen = exact ?? members[0];
    if (chosen?.user_id) ids.add(chosen.user_id);
  }

  return Array.from(ids);
}

type CanonicalTaskStatus = "todo" | "in_progress" | "blocked" | "done";
type CanonicalTaskPriority = "low" | "medium" | "high" | "urgent";

function normalizeTaskStatusValue(value: unknown): CanonicalTaskStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (normalized === "todo" || normalized === "in_progress" || normalized === "blocked" || normalized === "done") {
    return normalized as CanonicalTaskStatus;
  }
  return null;
}

function normalizeTaskPriorityValue(value: unknown): CanonicalTaskPriority | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "urgent") {
    return normalized as CanonicalTaskPriority;
  }
  return null;
}

function normalizeNamedStatuses(input: unknown): Array<{ field_name: string; value: CanonicalTaskStatus }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const fieldName = typeof (entry as any)?.field_name === "string" ? (entry as any).field_name.trim() : "";
      const value = normalizeTaskStatusValue((entry as any)?.value);
      if (!value) return null;
      return {
        field_name: fieldName || "Status",
        value,
      };
    })
    .filter((entry): entry is { field_name: string; value: CanonicalTaskStatus } => Boolean(entry));
}

function normalizeNamedPriorities(input: unknown): Array<{ field_name: string; value: CanonicalTaskPriority }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const fieldName = typeof (entry as any)?.field_name === "string" ? (entry as any).field_name.trim() : "";
      const value = normalizeTaskPriorityValue((entry as any)?.value);
      if (!value) return null;
      return {
        field_name: fieldName || "Priority",
        value,
      };
    })
    .filter((entry): entry is { field_name: string; value: CanonicalTaskPriority } => Boolean(entry));
}

function buildDueDateRangeFromTaskInput(dueDate: unknown, startDate: unknown): { start: string; end: string } | null {
  const due = typeof dueDate === "string" && dueDate.trim() ? dueDate.trim() : null;
  const start = typeof startDate === "string" && startDate.trim() ? startDate.trim() : null;
  if (start && due) return { start, end: due };
  if (due) return { start: due, end: due };
  if (start) return { start, end: start };
  return null;
}

async function syncTaskEntityPropertiesAfterCreate(params: {
  taskId: string;
  status?: unknown;
  statuses?: unknown;
  priority?: unknown;
  priorities?: unknown;
  dueDate?: unknown;
  startDate?: unknown;
  tags?: unknown;
  assignees?: Array<{ id?: string | null; name?: string | null }>;
  sourceEntityType?: unknown;
  sourceEntityId?: unknown;
}) {
  const namedStatuses = normalizeNamedStatuses(params.statuses);
  const namedPriorities = normalizeNamedPriorities(params.priorities);
  const singleStatus = normalizeTaskStatusValue(params.status);
  const singlePriority = normalizeTaskPriorityValue(params.priority);
  const normalizedSourceType = normalizeSourceEntityType(params.sourceEntityType);
  const normalizedSourceId = normalizeSourceEntityId(params.sourceEntityId);
  const isTableRowSourcedTask = normalizedSourceType === "table_row" && Boolean(normalizedSourceId);
  const dueDateRange = buildDueDateRangeFromTaskInput(params.dueDate, params.startDate);
  const tags = Array.isArray(params.tags)
    ? Array.from(new Set(params.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)))
    : [];
  const assigneeIds = Array.isArray(params.assignees)
    ? Array.from(
      new Set(
        params.assignees
          .map((assignee) => (typeof assignee?.id === "string" ? assignee.id : null))
          .filter((id): id is string => Boolean(id))
      )
    )
    : [];

  const updates: Record<string, unknown> = {};
  if (namedStatuses.length > 0) {
    updates.statuses = namedStatuses;
  } else if (!isTableRowSourcedTask) {
    updates.status = singleStatus ?? "todo";
  }
  if (namedPriorities.length > 0) {
    updates.priorities = namedPriorities;
  } else if (singlePriority && !isTableRowSourcedTask) {
    updates.priority = singlePriority;
  }
  if (dueDateRange) {
    if (!isTableRowSourcedTask) {
      updates.due_date = dueDateRange;
    }
  }
  if (tags.length > 0) {
    updates.tags = tags;
  }
  if (assigneeIds.length > 0) {
    if (!isTableRowSourcedTask) {
      updates.assignee_ids = assigneeIds;
    }
  }

  const result = await setEntityProperties({
    entity_type: "task",
    entity_id: params.taskId,
    updates: updates as any,
  });
  if ("error" in result) {
    aiDebug("createTaskItem:propertySyncFallbackError", {
      taskId: params.taskId,
      error: result.error,
      updates: Object.keys(updates),
    });
  }
}

async function syncTaskEntityPropertiesAfterMutation(params: {
  taskId: string;
  updates?: Record<string, unknown>;
  tags?: unknown;
  tagsSet?: boolean;
  assignees?: Array<{ id?: string | null; name?: string | null }>;
  assigneesSet?: boolean;
}) {
  const updates = params.updates ?? {};
  const propertyUpdates: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(updates, "statuses")) {
    propertyUpdates.statuses = normalizeNamedStatuses((updates as any).statuses);
  } else if (Object.prototype.hasOwnProperty.call(updates, "status")) {
    const status = normalizeTaskStatusValue((updates as any).status);
    if (status) propertyUpdates.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "priorities")) {
    propertyUpdates.priorities = normalizeNamedPriorities((updates as any).priorities);
  } else if (Object.prototype.hasOwnProperty.call(updates, "priority")) {
    const rawPriority = (updates as any).priority;
    const priority = normalizeTaskPriorityValue((updates as any).priority);
    if (priority) {
      propertyUpdates.priority = priority;
    } else if (typeof rawPriority === "string" && rawPriority.trim().toLowerCase() === "none") {
      propertyUpdates.priority = null;
    }
  }

  const touchedDueDate =
    Object.prototype.hasOwnProperty.call(updates, "dueDate") ||
    Object.prototype.hasOwnProperty.call(updates, "startDate");
  if (touchedDueDate) {
    propertyUpdates.due_date = buildDueDateRangeFromTaskInput((updates as any).dueDate, (updates as any).startDate);
  }

  if (params.tagsSet) {
    propertyUpdates.tags = Array.isArray(params.tags)
      ? Array.from(
        new Set(
          params.tags
            .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
            .filter(Boolean)
        )
      )
      : [];
  }

  if (params.assigneesSet) {
    propertyUpdates.assignee_ids = Array.isArray(params.assignees)
      ? Array.from(
        new Set(
          params.assignees
            .map((assignee) => (typeof assignee?.id === "string" ? assignee.id : null))
            .filter((id): id is string => Boolean(id))
        )
      )
      : [];
  }

  if (Object.keys(propertyUpdates).length === 0) {
    return;
  }

  const result = await setEntityProperties({
    entity_type: "task",
    entity_id: params.taskId,
    updates: propertyUpdates as any,
  });
  if ("error" in result) {
    aiDebug("updateTaskItem:propertySyncError", {
      taskId: params.taskId,
      error: result.error,
      updates: Object.keys(propertyUpdates),
    });
  }
}

const LEGACY_TOOL_ALIASES: Record<string, string> = {
  createSubtask: "createTaskSubtask",
  updateSubtask: "updateTaskSubtask",
  deleteSubtask: "deleteTaskSubtask",
  createChart: "createSpecChartBlock",
  createChartBlock: "createSpecChartBlock",
  createChartFromQuery: "createSpecChartBlock",
};

function normalizeToolName(name: string): string {
  return LEGACY_TOOL_ALIASES[name] ?? name;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") return [value];
  return [];
}

async function fetchRowsByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  idColumn = "id"
): Promise<Record<string, unknown>[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data } = await supabase.from(table).select("*").in(idColumn, unique);
  return (data as Record<string, unknown>[] | null) ?? [];
}

async function fetchTableRowsForFieldFilters(params: {
  supabase: SupabaseClient;
  tableId: string;
  filtersList: Array<Record<string, unknown> | undefined>;
  limit: number;
}): Promise<Record<string, unknown>[]> {
  const { supabase, tableId, filtersList, limit } = params;

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, config")
    .eq("table_id", tableId);
  const fieldList = (fields as Array<{ id: string; name: string; type: string; config: Record<string, unknown> }> | null) ?? [];
  if (fieldList.length === 0) return [];

  const fieldMap = new Map(fieldList.map((f) => [normalizeFieldKey(f.name), f]));
  const fieldIdMap = new Map(fieldList.map((f) => [f.id, f]));
  const resolveField = (key: string) => {
    const direct = fieldIdMap.get(key) || fieldMap.get(normalizeFieldKey(key));
    if (direct) return direct;

    const normalized = normalizeFieldKey(key);
    const startsWith = fieldList.find((f) => normalizeFieldKey(f.name).startsWith(normalized));
    if (startsWith) return startsWith;
    const includes = fieldList.find((f) => normalizeFieldKey(f.name).includes(normalized));
    if (includes) return includes;
    return undefined;
  };

  const { data: rows } = await supabase
    .from("table_rows")
    .select("*")
    .eq("table_id", tableId)
    .order("order", { ascending: true })
    .limit(limit);
  const rowList = (rows as Record<string, unknown>[] | null) ?? [];
  if (rowList.length === 0) return [];

  const matchedIds = new Set<string>();
  const applyAll = filtersList.some((filters) => !filters || Object.keys(filters).length === 0);

  if (applyAll) {
    for (const row of rowList) {
      const id = String(row.id ?? "");
      if (id) matchedIds.add(id);
    }
  } else {
    for (const filters of filtersList) {
      if (!filters || Object.keys(filters).length === 0) continue;
      for (const row of rowList) {
        const id = String(row.id ?? "");
        if (!id) continue;
        const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
        if (matchesRowFilters(data, filters, resolveField)) {
          matchedIds.add(id);
        }
      }
    }
  }

  if (matchedIds.size === 0) return [];
  return rowList.filter((row) => matchedIds.has(String(row.id ?? "")));
}

async function captureUndoStepsBefore(params: {
  toolName: string;
  toolArgs: Record<string, unknown>;
  supabase: SupabaseClient;
  workspaceId?: string;
}): Promise<UndoStep[]> {
  const { toolName, toolArgs, supabase, workspaceId } = params;

  const singleRowMap: Record<string, { table: string; idArg: string; idColumn?: string }> = {
    updateProject: { table: "projects", idArg: "projectId" },
    deleteProject: { table: "projects", idArg: "projectId" },
    updateTab: { table: "tabs", idArg: "tabId" },
    deleteTab: { table: "tabs", idArg: "tabId" },
    updateBlock: { table: "blocks", idArg: "blockId" },
    deleteBlock: { table: "blocks", idArg: "blockId" },
    updateTaskItem: { table: "task_items", idArg: "taskId" },
    deleteTaskItem: { table: "task_items", idArg: "taskId" },
    updateTaskSubtask: { table: "task_subtasks", idArg: "subtaskId" },
    deleteTaskSubtask: { table: "task_subtasks", idArg: "subtaskId" },
    updateField: { table: "table_fields", idArg: "fieldId" },
    deleteField: { table: "table_fields", idArg: "fieldId" },
    updateRow: { table: "table_rows", idArg: "rowId" },
    updateCell: { table: "table_rows", idArg: "rowId" },
    deleteRow: { table: "table_rows", idArg: "rowId" },
    updateTable: { table: "tables", idArg: "tableId" },
    deleteTable: { table: "tables", idArg: "tableId" },
    updateTimelineEvent: { table: "timeline_events", idArg: "eventId" },
    deleteTimelineEvent: { table: "timeline_events", idArg: "eventId" },
    deleteTimelineDependency: { table: "timeline_dependencies", idArg: "dependencyId" },
    updateClient: { table: "clients", idArg: "clientId" },
    deleteClient: { table: "clients", idArg: "clientId" },
    updateDoc: { table: "docs", idArg: "docId" },
    archiveDoc: { table: "docs", idArg: "docId" },
    deleteDoc: { table: "docs", idArg: "docId" },
    renameFile: { table: "files", idArg: "fileId" },
    updateComment: { table: "table_comments", idArg: "commentId" },
    deleteComment: { table: "table_comments", idArg: "commentId" },
  };

  if (toolName in singleRowMap) {
    const mapping = singleRowMap[toolName];
    const id = String(toolArgs[mapping.idArg] ?? "");
    const rows = await fetchRowsByIds(supabase, mapping.table, id ? [id] : [], mapping.idColumn ?? "id");
    if (rows.length > 0) {
      return [
        {
          action: "upsert",
          table: mapping.table,
          rows,
          onConflict: mapping.idColumn ?? "id",
        },
      ];
    }
    return [];
  }

  if (toolName === "bulkUpdateTaskItems" || toolName === "bulkMoveTaskItems") {
    let ids = toStringArray(toolArgs.taskIds);
    // Also collect IDs from perTaskUpdates (per-task mode)
    if (Array.isArray(toolArgs.perTaskUpdates)) {
      const perIds = (toolArgs.perTaskUpdates as Array<{ taskId?: string }>)
        .map(e => e.taskId)
        .filter((id): id is string => typeof id === "string");
      ids = [...new Set([...ids, ...perIds])];
    }
    const rows = await fetchRowsByIds(supabase, "task_items", ids);
    return rows.length > 0
      ? [{ action: "upsert", table: "task_items", rows, onConflict: "id" }]
      : [];
  }

  if (toolName === "deleteRows") {
    const ids = toStringArray(toolArgs.rowIds);
    const rows = await fetchRowsByIds(supabase, "table_rows", ids);
    return rows.length > 0
      ? [{ action: "upsert", table: "table_rows", rows, onConflict: "id" }]
      : [];
  }

  if (toolName === "bulkUpdateRows") {
    const ids = toStringArray(toolArgs.rowIds);
    const rows = await fetchRowsByIds(supabase, "table_rows", ids);
    return rows.length > 0
      ? [{ action: "upsert", table: "table_rows", rows, onConflict: "id" }]
      : [];
  }

  if (toolName === "updateTableRowsByFieldNames") {
    const tableId = String(toolArgs.tableId ?? "");
    if (!tableId) return [];
    const limit = typeof toolArgs.limit === "number" ? toolArgs.limit : 500;
    const filters = (toolArgs.filters as Record<string, unknown> | undefined) ?? undefined;
    const rows = await fetchTableRowsForFieldFilters({
      supabase,
      tableId,
      filtersList: [filters],
      limit,
    });
    return rows.length > 0
      ? [{ action: "upsert", table: "table_rows", rows, onConflict: "id" }]
      : [];
  }

  if (toolName === "bulkUpdateRowsByFieldNames") {
    const tableId = String(toolArgs.tableId ?? "");
    if (!tableId) return [];
    const limit = typeof toolArgs.limit === "number" ? toolArgs.limit : 500;
    const rowsArg = Array.isArray(toolArgs.rows) ? (toolArgs.rows as Array<Record<string, unknown>>) : [];
    const filtersList = rowsArg.map((entry) => (entry as Record<string, unknown>).filters as Record<string, unknown> | undefined);
    const rows = await fetchTableRowsForFieldFilters({
      supabase,
      tableId,
      filtersList: filtersList.length > 0 ? filtersList : [undefined],
      limit,
    });
    return rows.length > 0
      ? [{ action: "upsert", table: "table_rows", rows, onConflict: "id" }]
      : [];
  }

  if (toolName === "setTaskAssignees" || toolName === "bulkSetTaskAssignees") {
    const ids = toolName === "bulkSetTaskAssignees"
      ? toStringArray(toolArgs.taskIds)
      : toStringArray(toolArgs.taskId);
    const steps: UndoStep[] = [];
    if (ids.length === 0) return steps;

    // Capture current task_assignees rows.
    const { data: assignees } = await supabase
      .from("task_assignees")
      .select("*")
      .in("task_id", ids);

    // Reset assignees to previous snapshot.
    steps.push({
      action: "delete",
      table: "task_assignees",
      ids,
      idColumn: "task_id",
    });

    if (Array.isArray(assignees) && assignees.length > 0) {
      steps.push({
        action: "upsert",
        table: "task_assignees",
        rows: assignees as Record<string, unknown>[],
        onConflict: "task_id,assignee_id",
      });
    }

    if (workspaceId) {
      const { data: props } = await supabase
        .from("entity_properties")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("entity_type", "task")
        .eq("field_type", "assignee")
        .in("entity_id", ids);

      steps.push({
        action: "delete",
        table: "entity_properties",
        ids,
        idColumn: "entity_id",
        where: {
          workspace_id: workspaceId,
          entity_type: "task",
          field_type: "assignee",
        },
      });

      if (Array.isArray(props) && props.length > 0) {
        steps.push({
          action: "upsert",
          table: "entity_properties",
          rows: props as Record<string, unknown>[],
          onConflict: "entity_type,entity_id,field_name",
        });
      }
    }

    return steps;
  }

  if (toolName === "setTaskTags") {
    const taskId = String(toolArgs.taskId ?? "");
    if (!taskId) return [];
    const steps: UndoStep[] = [];
    const { data: links } = await supabase
      .from("task_tag_links")
      .select("*")
      .eq("task_id", taskId);

    steps.push({
      action: "delete",
      table: "task_tag_links",
      where: { task_id: taskId },
    });

    if (Array.isArray(links) && links.length > 0) {
      steps.push({
        action: "upsert",
        table: "task_tag_links",
        rows: links as Record<string, unknown>[],
        onConflict: "task_id,tag_id",
      });
    }

    return steps;
  }

  if (toolName === "setEntityProperty" || toolName === "removeEntityProperty") {
    const entityType = String(toolArgs.entityType ?? "");
    const entityId = String(toolArgs.entityId ?? "");
    const fieldName = String(toolArgs.fieldName ?? "");
    if (!entityType || !entityId || !fieldName || !workspaceId) return [];
    const { data } = await supabase
      .from("entity_properties")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("field_name", fieldName);
    const rows = (data as Record<string, unknown>[] | null) ?? [];
    if (rows.length > 0) {
      return [
        {
          action: "upsert",
          table: "entity_properties",
          rows,
          onConflict: "entity_type,entity_id,field_name",
        },
      ];
    }
    return [
      {
        action: "delete",
        table: "entity_properties",
        where: {
          workspace_id: workspaceId,
          entity_type: entityType,
          entity_id: entityId,
          field_name: fieldName,
        },
      },
    ];
  }

  return [];
}

function buildUndoStepsAfter(
  toolName: string,
  toolArgs: Record<string, unknown>,
  result: ToolCallResult
): UndoStep[] {
  if (!result.success) return [];
  const data = result.data as Record<string, unknown> | null | undefined;

  const deleteById = (table: string, id?: unknown): UndoStep[] => {
    const idStr = typeof id === "string" ? id : "";
    if (!idStr) return [];
    return [{ action: "delete", table, ids: [idStr], idColumn: "id" }];
  };

  switch (toolName) {
    case "createProject":
      return deleteById("projects", data?.id);
    case "createTab":
      return deleteById("tabs", data?.id);
    case "createBlock":
      return deleteById("blocks", data?.id);
    case "createSpecChartBlock":
      return deleteById("blocks", data?.id);
    case "createTaskItem":
      return deleteById("task_items", data?.id);
    case "bulkCreateTasks": {
      const createdTasks = Array.isArray((data as any)?.createdTasks)
        ? ((data as any).createdTasks as { id?: string }[])
        : [];
      const ids = createdTasks.map(t => t.id).filter(Boolean) as string[];
      return ids.length > 0 ? [{ action: "delete", table: "task_items", ids, idColumn: "id" }] : [];
    }
    case "createTaskSubtask":
      return deleteById("task_subtasks", data?.id);
    case "createClient":
      return deleteById("clients", data?.id);
    case "createDoc":
      return deleteById("docs", data?.id);
    case "createTaskComment":
      return deleteById("task_comments", data?.id);
    case "createComment":
      return deleteById("table_comments", data?.id);
    case "createTimelineEvent":
      return deleteById("timeline_events", data?.id);
    case "createTimelineSubEvent":
      return deleteById("timeline_events", data?.id);
    case "createTimelineDependency":
      return deleteById("timeline_dependencies", data?.id);
    case "createRow":
      return deleteById("table_rows", data?.id);
    case "createField":
      return deleteById("table_fields", data?.id);
    case "bulkCreateFields": {
      const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
      const ids = rows.map((row) => String(row.id || "")).filter(Boolean);
      return ids.length > 0 ? [{ action: "delete", table: "table_fields", ids, idColumn: "id" }] : [];
    }
    case "bulkInsertRows": {
      const insertedIds = Array.isArray((data as any)?.insertedIds)
        ? ((data as any).insertedIds as string[])
        : [];
      return insertedIds.length > 0 ? [{ action: "delete", table: "table_rows", ids: insertedIds, idColumn: "id" }] : [];
    }
    case "duplicateTasksToBlock": {
      const createdIds = Array.isArray((data as any)?.createdTaskIds)
        ? ((data as any).createdTaskIds as string[])
        : [];
      return createdIds.length > 0 ? [{ action: "delete", table: "task_items", ids: createdIds, idColumn: "id" }] : [];
    }
    case "createTaskBoardFromTasks": {
      const steps: UndoStep[] = [];
      const createdIds = Array.isArray((data as any)?.createdTaskIds)
        ? ((data as any).createdTaskIds as string[])
        : [];
      if (createdIds.length > 0) {
        steps.push({ action: "delete", table: "task_items", ids: createdIds, idColumn: "id" });
      }
      const taskBlockId = (data as any)?.taskBlockId;
      if (typeof taskBlockId === "string" && taskBlockId.length > 0) {
        steps.push({ action: "delete", table: "blocks", ids: [taskBlockId], idColumn: "id" });
      }
      return steps;
    }
    case "createTable": {
      const tableId = (data as any)?.table?.id;
      return deleteById("tables", tableId);
    }
    case "createTableFull": {
      const steps: UndoStep[] = [];
      const blockId = (data as any)?.blockId;
      if (typeof blockId === "string" && blockId.length > 0) {
        steps.push({ action: "delete", table: "blocks", ids: [blockId], idColumn: "id" });
      }
      const tableId = (data as any)?.tableId;
      if (typeof tableId === "string" && tableId.length > 0) {
        steps.push({ action: "delete", table: "tables", ids: [tableId], idColumn: "id" });
      }
      return steps;
    }
    default:
      return [];
  }
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
  const requestedToolName = name;
  const toolName = normalizeToolName(name);
  const t0 = performance.now();

  try {
    aiDebug("executeTool:start", {
      tool: requestedToolName,
      resolvedTool: toolName,
      ...summarizeToolArgs(args),
    });

    // In-depth argument logging for debugging: log the full argument payload
    // the AI passed into this tool invocation so we can see exactly what data
    // was sent for every create/update/read tool call. Use JSON.stringify so
    // nested objects/arrays are fully expanded instead of printing as [Object].
    aiDebug(
      "executeTool:args",
      JSON.stringify(
        {
          tool: requestedToolName,
          resolvedTool: toolName,
          args,
        },
        null,
        2
      )
    );
    if (requestedToolName !== toolName) {
      aiDebug("executeTool:alias", { requestedTool: requestedToolName, resolvedTool: toolName });
    }

    // If context is provided (test mode), set it globally for server actions to use
    if (shouldUseTestContext() && context?.workspaceId && context?.userId) {
      await setTestContext(context.workspaceId, context.userId);
    }

    // Get workspace ID from context or from cookies (for backward compatibility)
    const workspaceId = context?.workspaceId || await getCurrentWorkspaceId();

    // Single shared auth per tool run — pass to all actions that accept authContext to avoid duplicate auth
    // Use provided authContext (e.g., from Slack with service client) or get from cookies
    let authContext: AuthContext | null = null;
    if (context?.authContext) {
      authContext = context.authContext;
    } else {
      const authResult = await getAuthContext();
      authContext = authResult && !("error" in authResult) ? authResult : null;
    }

    const undoTracker = context?.undoTracker;
    const shouldCaptureUndo = Boolean(undoTracker) && isWriteToolName(toolName);
    const supabaseForUndo = shouldCaptureUndo
      ? (authContext?.supabase ?? await createSupabaseClient())
      : null;
    const preUndoSteps = shouldCaptureUndo && supabaseForUndo
      ? await captureUndoStepsBefore({
        toolName,
        toolArgs: args,
        supabase: supabaseForUndo,
        workspaceId: workspaceId ?? undefined,
      })
      : [];

    const runTool = async (): Promise<ToolCallResult> => {
      switch (toolName) {
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
          return await wrapResult(
            searchTasks({
              ...(await normalizeTaskSearchArgsForContext("searchTasks", args as Record<string, unknown>, context)) as any,
              authContext,
            })
          );

        case "searchSubtasks":
          return await wrapResult(
            searchSubtasks({
              ...(await normalizeTaskSearchArgsForContext("searchSubtasks", args as Record<string, unknown>, context)) as any,
              authContext,
            })
          );

        case "getSubtaskDetails":
          return await wrapResult(
            getSubtaskDetails({
              subtaskId: args.subtaskId as string | undefined,
              taskId: args.taskId as string | undefined,
              subtaskTitle: args.subtaskTitle as string | undefined,
              includeProperties: args.includeProperties as boolean | undefined,
              authContext: authContext ?? undefined,
            })
          );

        case "searchProjects":
          return await wrapResult(searchProjects({ ...args as any, authContext }));

        case "searchClients":
          return await wrapResult(searchClients({ ...args as any, authContext }));

        case "searchWorkspaceMembers":
          return await wrapResult(searchWorkspaceMembers({ ...args as any, authContext }));

        case "searchTabs":
          return await wrapResult(searchTabs({ ...args as any, authContext }));

        case "searchBlocks":
          return await wrapResult(searchBlocks({ ...args as any, authContext }));

        case "searchCards":
          return await wrapResult(searchCards({ ...args as any, authContext }));

        case "searchDocs":
          return await wrapResult(searchDocs({ ...args as any, authContext }));

        case "searchDocContent":
          return await wrapResult(searchDocContent({ ...args as any, authContext }));

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
          if (!workspaceId) return { success: false, error: "No workspace selected" };

          const searcher = new UnstructuredSearch(authContext.supabase);
          const results = await searcher.searchWorkspace(workspaceId, query);
          const trimmed = (results || []).slice(0, Math.max(1, limitParents)).map((result) => ({
            ...result,
            chunks: Array.isArray(result.chunks) ? result.chunks.slice(0, Math.max(1, limitChunks)) : [],
          }));

          console.log("--- [Debug Search] ---");
          console.log("Returning unstructured search results to Workflow LLM:");
          // Log a sample of invalid JSON to avoid massive logs if possible, or just log length and IDs
          console.log(`Count: ${trimmed.length}`);
          trimmed.forEach((r, i) => {
            console.log(`[${i}] ParentID: ${r.parentId}, SourceID: ${r.sourceId} (${r.sourceType}), Score: ${r.score}`);
            r.chunks.forEach((c, j) => {
              console.log(`    Chunk[${j}]: "${c.content.substring(0, 100)}..." (Score: ${c.score})`);
            });
          });
          console.log("------------------------");

          return { success: true, data: trimmed };
        }

        case "searchTags":
          return await wrapResult(searchTags(args as any));

        case "searchEntitiesByProperties":
          return await wrapResult(searchEntitiesByProperties({ ...(args as any), authContext }));

        case "searchAll":
          return await wrapResult(searchAll({ ...args as any, authContext }));

        case "resolveEntityByName":
          return await wrapResult(resolveEntityByName({ ...args as any, authContext }));

        case "getEntityById":
          console.log(`[getEntityById] entityType=${(args as any)?.entityType}, id=${(args as any)?.id}`);
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
            const parentTaskId = typeof args.parentTaskId === "string" ? args.parentTaskId.trim() : "";
            if (parentTaskId.length > 0) {
              const title = typeof args.title === "string" ? args.title.trim() : "";
              if (!title) {
                return { success: false, error: "Missing title for subtask creation" };
              }
              return await wrapResult(
                createTaskSubtask({
                  taskId: parentTaskId,
                  title,
                  description: args.description as string | null | undefined,
                  completed: args.status === "done" ? true : undefined,
                  status: args.status as any,
                  statuses: args.statuses as any,
                  priority: args.priority as any,
                  priorities: args.priorities as any,
                  assignee_ids: Array.isArray(args.assigneeIds)
                    ? (args.assigneeIds as string[])
                    : Array.isArray(args.assignee_ids)
                      ? (args.assignee_ids as string[])
                      : undefined,
                  due_date: (args.dueDate ?? args.due_date) as any,
                  tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
                  displayOrder: args.displayOrder as number | undefined,
                  authContext: authContext ?? undefined,
                })
              );
            }

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

            const sourceEntityType = normalizeSourceEntityType(args.source_entity_type);
            const sourceEntityId = normalizeSourceEntityId(args.source_entity_id);
            const hasSourceMetadata = Boolean(sourceEntityType && sourceEntityId);
            const taskHadSourceHints = Boolean(
              (args as Record<string, unknown>).source_entity_type !== undefined ||
              (args as Record<string, unknown>).source_entity_id !== undefined ||
              (args as Record<string, unknown>).sourceEntityType !== undefined ||
              (args as Record<string, unknown>).sourceEntityId !== undefined
            );
            const taskSourceMetadataIncomplete = taskHadSourceHints && !hasSourceMetadata;
            const payload = {
              taskBlockId,
              title: args.title as string,
              status: args.status as any,
              statuses: args.statuses as any,
              priority: args.priority as any,
              priorities: args.priorities as any,
              description: args.description as string | undefined,
              dueDate: args.dueDate as string | undefined,
              dueTime: args.dueTime as string | undefined,
              startDate: args.startDate as string | undefined,
              sourceEntityType: hasSourceMetadata ? sourceEntityType! : undefined,
              sourceEntityId: hasSourceMetadata ? sourceEntityId! : undefined,
              sourceSyncMode: hasSourceMetadata ? normalizeSourceSyncMode(args.source_sync_mode) : undefined,
            };
            const rpcSourceEntityType =
              payload.sourceEntityType === "subtask" ? undefined : payload.sourceEntityType;

            // ------------------------------------------------------------------
            // EXECUTION: Create -> Assign -> Tag
            // ------------------------------------------------------------------

            let rpcResult:
              | Awaited<ReturnType<typeof createTaskFullRpc>>
              | null = null;
            const isTableRowSourceCreate = payload.sourceEntityType === "table_row" && Boolean(payload.sourceEntityId);
            try {
              rpcResult = await createTaskFullRpc({
                ...payload,
                sourceEntityType: rpcSourceEntityType,
                assignees: isTableRowSourceCreate ? [] : resolvedAssignees,
                tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
                authContext: authContext ?? undefined,
              });
            } catch (error) {
              aiDebug("createTaskItem:rpcFallback", {
                reason: "rpc_call_threw",
                error: error instanceof Error ? error.message : String(error),
              });
            }

            if (rpcResult && !("error" in rpcResult)) {
              await syncTaskEntityPropertiesAfterCreate({
                taskId: rpcResult.data.id,
                status: payload.status,
                statuses: payload.statuses,
                priority: payload.priority,
                priorities: payload.priorities,
                dueDate: payload.dueDate,
                startDate: payload.startDate,
                tags: args.tags,
                assignees: resolvedAssignees,
                sourceEntityType: payload.sourceEntityType,
                sourceEntityId: payload.sourceEntityId,
              });
              const out: ToolCallResult = { success: true, data: rpcResult.data };
              if (taskSourceMetadataIncomplete) out.sourceMetadataIncomplete = true;
              return out;
            }
            if (rpcResult && "error" in rpcResult) {
              aiDebug("createTaskItem:rpcFallback", {
                reason: "rpc_returned_error",
                error: rpcResult.error,
              });
            }

            const directResult = await createTaskItem(
              {
                ...payload,
                sourceEntityType: rpcSourceEntityType,
              },
              { timing, authContext: authContext ?? undefined }
            );
            if (!("error" in directResult)) {
              const newTaskId = directResult.data.id;

              const postCreate: Promise<unknown>[] = [];
              if (resolvedAssignees.length > 0 && !isTableRowSourceCreate) {
                postCreate.push(setTaskAssignees(newTaskId, resolvedAssignees, { timing, replaceExisting: false, authContext: authContext ?? undefined }));
              }
              if (Array.isArray(args.tags) && args.tags.length > 0) {
                postCreate.push(setTaskTags(newTaskId, args.tags as string[], { authContext: authContext ?? undefined }));
              }
              if (postCreate.length > 0) await Promise.all(postCreate);
              await syncTaskEntityPropertiesAfterCreate({
                taskId: newTaskId,
                status: payload.status,
                statuses: payload.statuses,
                priority: payload.priority,
                priorities: payload.priorities,
                dueDate: payload.dueDate,
                startDate: payload.startDate,
                tags: args.tags,
                assignees: resolvedAssignees,
                sourceEntityType: payload.sourceEntityType,
                sourceEntityId: payload.sourceEntityId,
              });

              aiDebug("createTaskItem:timing", {
                t_auth_ms: timing.t_auth_ms,
                t_ctx_ms: timing.t_ctx_ms,
                t_resolve_assignee_ms: timing.t_resolve_assignee_ms,
                t_insert_task_ms: timing.t_insert_task_ms,
                t_insert_assignees_ms: timing.t_insert_assignees_ms,
                t_fetch_return_ms: timing.t_fetch_return_ms,
              });
              const out: ToolCallResult = { success: true, data: directResult.data };
              if (taskSourceMetadataIncomplete) out.sourceMetadataIncomplete = true;
              return out;
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
                    sourceEntityType: rpcSourceEntityType,
                  });

                  if (!("error" in retryResult)) {
                    const out: ToolCallResult = { success: true, data: retryResult.data };
                    if (taskSourceMetadataIncomplete) out.sourceMetadataIncomplete = true;
                    return out;
                  }

                  return { success: false, error: retryResult.error ?? "Failed to create task" };
                }

                const retryResult = await createTaskItem({
                  ...payload,
                  taskBlockId: existingBlockId,
                  sourceEntityType: rpcSourceEntityType,
                }, { authContext: authContext ?? undefined });

                if (!("error" in retryResult)) {
                  const out: ToolCallResult = { success: true, data: retryResult.data };
                  if (taskSourceMetadataIncomplete) out.sourceMetadataIncomplete = true;
                  return out;
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
                    sourceEntityType: rpcSourceEntityType,
                  }, { authContext: authContext ?? undefined });
                  if (!("error" in retryResult)) {
                    const out: ToolCallResult = { success: true, data: retryResult.data };
                    if (taskSourceMetadataIncomplete) out.sourceMetadataIncomplete = true;
                    return out;
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
            if (args.statuses !== undefined) baseUpdates.statuses = args.statuses as any;
            if (args.priority !== undefined) baseUpdates.priority = args.priority as any;
            if (args.priorities !== undefined) baseUpdates.priorities = args.priorities as any;
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
                await syncTaskEntityPropertiesAfterMutation({
                  taskId,
                  updates: baseUpdates,
                  assignees: resolvedAssignees,
                  assigneesSet: assigneesProvided,
                  tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
                  tagsSet: tagsProvided,
                });
                return { success: true, data: rpcResult.data };
              }
            }

            // Update base task properties
            const updateResult = await wrapResult(
              updateTaskItem(taskId, {
                title: args.title as string | undefined,
                status: args.status as any,
                statuses: args.statuses as any,
                priority: args.priority as any,
                priorities: args.priorities as any,
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

            await syncTaskEntityPropertiesAfterMutation({
              taskId,
              updates: baseUpdates,
              assignees: resolvedAssignees,
              assigneesSet: assigneesProvided,
              tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
              tagsSet: tagsProvided,
            });

            return updateResult;
          }

        case "bulkUpdateTaskItems": {
          // ── Per-task mode: each task gets different updates ──
          const perTaskUpdates = args.perTaskUpdates as Array<{ taskId: string; updates: Record<string, unknown> }> | undefined;
          if (Array.isArray(perTaskUpdates) && perTaskUpdates.length > 0) {
            const perTaskResults: Array<{ taskId: string; success: boolean; error?: string }> = [];
            let updatedCount = 0;

            for (const entry of perTaskUpdates) {
              const taskId = entry.taskId;
              const u = entry.updates ?? {};

              const baseUpdates: Record<string, unknown> = {};
              if (u.title !== undefined) baseUpdates.title = u.title;
              if (u.status !== undefined) baseUpdates.status = u.status;
              if (u.statuses !== undefined) baseUpdates.statuses = u.statuses;
              if (u.priority !== undefined) baseUpdates.priority = u.priority;
              if (u.priorities !== undefined) baseUpdates.priorities = u.priorities;
              if (u.description !== undefined) baseUpdates.description = u.description;
              if (u.dueDate !== undefined) baseUpdates.dueDate = u.dueDate;
              if (u.dueTime !== undefined) baseUpdates.dueTime = u.dueTime;
              if (u.startDate !== undefined) baseUpdates.startDate = u.startDate;

              const assigneesProvided = u.assignees !== undefined;
              const tagsProvided = u.tags !== undefined;
              let resolvedAssignees: Array<{ id?: string | null; name?: string | null }> = [];

              if (assigneesProvided) {
                const assigneeArgs = Array.isArray(u.assignees) && (u.assignees as unknown[]).length > 0
                  ? (u.assignees as unknown[]).map(a =>
                    isUuid(String(a)) ? { id: a as string, name: "Unknown" } : { name: String(a), id: undefined }
                  )
                  : [];
                const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
                if (ctxResult.error === null) {
                  const searchCtx = { workspaceId: ctxResult.workspaceId, supabase: ctxResult.supabase, userId: ctxResult.userId };
                  const assigneeResult = await resolveTaskAssignees(assigneeArgs, searchCtx);
                  if (assigneeResult.ambiguities.length > 0) {
                    perTaskResults.push({ taskId, success: false, error: `Ambiguous assignee names` });
                    continue;
                  }
                  resolvedAssignees = assigneeResult.resolved;
                }
              }

              // Try RPC first
              const hasRpcOps = Object.keys(baseUpdates).length > 0 || assigneesProvided || tagsProvided;
              let taskSuccess = false;

              if (hasRpcOps) {
                const rpcResult = await updateTaskFullRpc({
                  taskId,
                  updates: baseUpdates,
                  assignees: resolvedAssignees,
                  assigneesSet: assigneesProvided,
                  tags: Array.isArray(u.tags) ? (u.tags as string[]) : [],
                  tagsSet: tagsProvided,
                  authContext: authContext ?? undefined,
                });
                if (!("error" in rpcResult)) {
                  await syncTaskEntityPropertiesAfterMutation({
                    taskId,
                    updates: baseUpdates,
                    assignees: resolvedAssignees,
                    assigneesSet: assigneesProvided,
                    tags: Array.isArray(u.tags) ? (u.tags as string[]) : [],
                    tagsSet: tagsProvided,
                  });
                  taskSuccess = true;
                }
              }

              // Fallback to individual actions
              if (!taskSuccess) {
                const updateResult = await wrapResult(
                  updateTaskItem(taskId, {
                    title: baseUpdates.title as string | undefined,
                    status: baseUpdates.status as any,
                    statuses: baseUpdates.statuses as any,
                    priority: baseUpdates.priority as any,
                    priorities: baseUpdates.priorities as any,
                    description: baseUpdates.description as string | null | undefined,
                    dueDate: baseUpdates.dueDate as string | null | undefined,
                    dueTime: baseUpdates.dueTime as string | null | undefined,
                    startDate: baseUpdates.startDate as string | null | undefined,
                  }, { authContext: authContext ?? undefined })
                );

                if (!updateResult.success) {
                  perTaskResults.push({ taskId, success: false, error: String((updateResult as any).error ?? "Update failed") });
                  continue;
                }

                if (assigneesProvided) {
                  if (resolvedAssignees.length > 0 || Array.isArray(u.assignees)) {
                    await setTaskAssignees(taskId, resolvedAssignees.length > 0 ? resolvedAssignees : [], { replaceExisting: true, authContext: authContext ?? undefined });
                  }
                }
                if (tagsProvided && Array.isArray(u.tags)) {
                  await setTaskTags(taskId, u.tags as string[], { authContext: authContext ?? undefined });
                }

                await syncTaskEntityPropertiesAfterMutation({
                  taskId,
                  updates: baseUpdates,
                  assignees: resolvedAssignees,
                  assigneesSet: assigneesProvided,
                  tags: Array.isArray(u.tags) ? (u.tags as string[]) : [],
                  tagsSet: tagsProvided,
                });
                taskSuccess = true;
              }

              perTaskResults.push({ taskId, success: taskSuccess });
              if (taskSuccess) updatedCount++;
            }

            return {
              success: updatedCount > 0,
              data: {
                updatedCount,
                totalRequested: perTaskUpdates.length,
                skipped: perTaskResults.filter(r => !r.success).map(r => r.taskId),
                perTaskResults,
              },
            };
          }

          // ── Uniform mode: same updates to all tasks ──
          if (!Array.isArray(args.taskIds) || args.taskIds.length === 0) {
            return {
              success: false,
              error: "bulkUpdateTaskItems requires either a non-empty taskIds array with updates, or a non-empty perTaskUpdates array.",
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
              const skipped = new Set((rpcResult.data.skipped ?? []).map((id) => String(id)));
              const successfulTaskIds = (args.taskIds as string[]).filter((id) => !skipped.has(id));
              await Promise.all(
                successfulTaskIds.map((taskId) =>
                  syncTaskEntityPropertiesAfterMutation({
                    taskId,
                    updates: updatesArg ?? {},
                  })
                )
              );
              return { success: true, data: rpcResult.data };
            }
          }
          const fallbackResult = await wrapResult(
            bulkUpdateTaskItems({
              taskIds: args.taskIds as string[],
              updates: {
                title: updatesArg?.title as string | undefined,
                status: updatesArg?.status as any,
                statuses: updatesArg?.statuses as any,
                priority: updatesArg?.priority as any,
                priorities: updatesArg?.priorities as any,
                description: updatesArg?.description as string | null | undefined,
                dueDate: updatesArg?.dueDate as string | null | undefined,
                dueTime: updatesArg?.dueTime as string | null | undefined,
                startDate: updatesArg?.startDate as string | null | undefined,
              },
              authContext: authContext ?? undefined,
            })
          );
          if (fallbackResult.success) {
            await Promise.all(
              (args.taskIds as string[]).map((taskId) =>
                syncTaskEntityPropertiesAfterMutation({
                  taskId,
                  updates: updatesArg ?? {},
                })
              )
            );
          }
          return fallbackResult;
        }

        case "deleteTaskItem":
          return await wrapResult(deleteTaskItem(args.taskId as string, { authContext: authContext ?? undefined }));

        case "bulkCreateTasks":
          {
            const tasks = Array.isArray(args.tasks) ? (args.tasks as Record<string, unknown>[]) : [];
            if (tasks.length === 0) {
              return { success: false, error: "Missing 'tasks' array. Provide at least one task with a title." };
            }

            // Validate all tasks have titles
            const invalidTasks = tasks.filter((t, i) => !t.title || typeof t.title !== "string");
            if (invalidTasks.length > 0) {
              return { success: false, error: `${invalidTasks.length} task(s) missing required 'title' field.` };
            }

            // Resolve task block once for all tasks
            let taskBlockId = args.taskBlockId as string;
            if (!taskBlockId) {
              const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
              if (ctxResult.error === null) {
                const searchCtx = { workspaceId: ctxResult.workspaceId, supabase: ctxResult.supabase, userId: ctxResult.userId };
                const resolvedBlockId = await resolveTaskBlockIdForCreateTask(context, args, searchCtx, authContext);
                taskBlockId = resolvedBlockId ?? "";
              }
            }

            if (!taskBlockId) {
              return { success: false, error: "Missing taskBlockId. Provide taskBlockId, taskBlockName, or ensure you're on a page with a task block." };
            }

            // Create all tasks in parallel using the RPC
            const results = await Promise.all(
              tasks.map(async (task) => {
                try {
                  // Resolve assignees if provided
                  const assigneeArgs = Array.isArray(task.assignees)
                    ? (task.assignees as (string | { id?: string; name?: string })[]).map(a =>
                      typeof a === "string"
                        ? (isUuid(a) ? { id: a, name: "Unknown" } : { name: a, id: undefined })
                        : { id: (a as any)?.id, name: (a as any)?.name }
                    )
                    : [];

                  let resolvedAssignees: Array<{ id?: string | null; name?: string | null }> = [];
                  if (assigneeArgs.length > 0) {
                    const ctxResult = await getSearchContext(authContext ? { authContext } : undefined);
                    if (ctxResult.error === null) {
                      const searchCtx = { workspaceId: ctxResult.workspaceId, supabase: ctxResult.supabase, userId: ctxResult.userId };
                      const resolveResult = await resolveTaskAssignees(assigneeArgs, searchCtx);
                      if (resolveResult.ambiguities.length > 0) {
                        return { input: task, error: `Ambiguous assignees: ${resolveResult.ambiguities.map(a => a.input).join(", ")}` };
                      }
                      resolvedAssignees = resolveResult.resolved;
                    }
                  }

                  const taskSourceEntityType = normalizeSourceEntityType((task as Record<string, unknown>)?.source_entity_type);
                  const taskSourceEntityId = normalizeSourceEntityId((task as Record<string, unknown>)?.source_entity_id);
                  const isTableRowSourceCreate = taskSourceEntityType === "table_row" && Boolean(taskSourceEntityId);
                  const rpcResult = await createTaskFullRpc({
                    taskBlockId,
                    title: task.title as string,
                    status: task.status as any,
                    statuses: task.statuses as any,
                    priority: task.priority as any,
                    priorities: task.priorities as any,
                    description: task.description as string | undefined,
                    dueDate: task.dueDate as string | undefined,
                    dueTime: task.dueTime as string | undefined,
                    startDate: task.startDate as string | undefined,
                    sourceEntityType: taskSourceEntityType === "subtask" ? undefined : taskSourceEntityType ?? undefined,
                    sourceEntityId: taskSourceEntityId ?? undefined,
                    sourceSyncMode:
                      taskSourceEntityType &&
                        taskSourceEntityId
                        ? normalizeSourceSyncMode((task as Record<string, unknown>)?.source_sync_mode)
                        : undefined,
                    assignees: isTableRowSourceCreate ? [] : resolvedAssignees,
                    tags: Array.isArray(task.tags) ? (task.tags as string[]) : [],
                    authContext: authContext ?? undefined,
                  });

                  if (!("error" in rpcResult)) {
                    await syncTaskEntityPropertiesAfterCreate({
                      taskId: rpcResult.data.id,
                      status: task.status,
                      statuses: task.statuses,
                      priority: task.priority,
                      priorities: task.priorities,
                      dueDate: task.dueDate,
                      startDate: task.startDate,
                      tags: task.tags,
                      assignees: resolvedAssignees,
                      sourceEntityType: (task as Record<string, unknown>)?.source_entity_type,
                      sourceEntityId: (task as Record<string, unknown>)?.source_entity_id,
                    });
                    return { input: task, data: rpcResult.data };
                  }
                  aiDebug("bulkCreateTasks:rpcFallback", {
                    reason: "rpc_returned_error",
                    error: rpcResult.error,
                    title: task.title,
                  });

                  // Fallback to direct createTaskItem if RPC fails
                  const directResult = await createTaskItem({
                    taskBlockId,
                    title: task.title as string,
                    status: task.status as any,
                    statuses: task.statuses as any,
                    priority: task.priority as any,
                    priorities: task.priorities as any,
                    description: task.description as string | undefined,
                    dueDate: task.dueDate as string | undefined,
                    dueTime: task.dueTime as string | undefined,
                    startDate: task.startDate as string | undefined,
                    sourceEntityType: (
                      normalizeSourceEntityType((task as Record<string, unknown>)?.source_entity_type) === "subtask"
                        ? undefined
                        : normalizeSourceEntityType((task as Record<string, unknown>)?.source_entity_type) ?? undefined
                    ) as "task" | "timeline_event" | "table_row" | "block" | undefined,
                    sourceEntityId:
                      normalizeSourceEntityId((task as Record<string, unknown>)?.source_entity_id) ?? undefined,
                    sourceSyncMode:
                      normalizeSourceEntityType((task as Record<string, unknown>)?.source_entity_type) &&
                        normalizeSourceEntityId((task as Record<string, unknown>)?.source_entity_id)
                        ? normalizeSourceSyncMode((task as Record<string, unknown>)?.source_sync_mode)
                        : undefined,
                  }, { authContext: authContext ?? undefined });

                  if (!("error" in directResult)) {
                    // Set assignees and tags if needed
                    const postCreate: Promise<unknown>[] = [];
                    if (resolvedAssignees.length > 0 && !isTableRowSourceCreate) {
                      postCreate.push(setTaskAssignees(directResult.data.id, resolvedAssignees, { replaceExisting: false, authContext: authContext ?? undefined }));
                    }
                    if (Array.isArray(task.tags) && (task.tags as string[]).length > 0) {
                      postCreate.push(setTaskTags(directResult.data.id, task.tags as string[], { authContext: authContext ?? undefined }));
                    }
                    if (postCreate.length > 0) await Promise.all(postCreate);
                    await syncTaskEntityPropertiesAfterCreate({
                      taskId: directResult.data.id,
                      status: task.status,
                      statuses: task.statuses,
                      priority: task.priority,
                      priorities: task.priorities,
                      dueDate: task.dueDate,
                      startDate: task.startDate,
                      tags: task.tags,
                      assignees: resolvedAssignees,
                      sourceEntityType: (task as Record<string, unknown>)?.source_entity_type,
                      sourceEntityId: (task as Record<string, unknown>)?.source_entity_id,
                    });
                    return { input: task, data: directResult.data };
                  }

                  return { input: task, error: directResult.error ?? "Failed to create task" };
                } catch (e) {
                  return { input: task, error: e instanceof Error ? e.message : String(e) };
                }
              })
            );

            const created = results.filter(r => "data" in r && r.data);
            const errors = results.filter(r => "error" in r && r.error);

            return {
              success: true,
              data: {
                createdCount: created.length,
                createdTasks: created.map(r => ({ id: (r as any).data?.id, title: (r as any).input?.title })),
                errors: errors.map(r => ({ title: (r as any).input?.title, error: (r as any).error })),
              },
            };
          }

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
              const newTaskIds = rpcResult.data.createdTaskIds;
              if (newTaskIds.length > 0) {
                const supabaseForSync = await createSupabaseClient();
                const { data: newTasks } = await supabaseForSync
                  .from("task_items")
                  .select("id, statuses, priorities, due_date, start_date")
                  .in("id", newTaskIds);
                await Promise.all(
                  (newTasks ?? []).map((task: any) =>
                    syncTaskEntityPropertiesAfterCreate({
                      taskId: task.id,
                      statuses: task.statuses,
                      priorities: task.priorities,
                      dueDate: task.due_date,
                      startDate: task.start_date,
                    })
                  )
                );
              }
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

            const blockTitle = (args.title as string | undefined) || "Tasks";
            const viewMode = (args.viewMode as string | undefined) || "list";
            const boardGroupBy = (args.boardGroupBy as string | undefined) || "status";

            const createBlockResult = await createBlock({
              tabId,
              type: "task",
              content: { title: blockTitle, hideIcons: false, viewMode, boardGroupBy },
              authContext: authContext ?? undefined,
            });

            if ("error" in createBlockResult) {
              return { success: false, error: createBlockResult.error ?? "Failed to create task block" };
            }

            const taskBlockId = createBlockResult.data?.id;
            if (!taskBlockId) {
              return { success: false, error: "Failed to create task block." };
            }

            const rpcDupResult = await duplicateTasksToBlockRpc({
              targetBlockId: taskBlockId,
              taskIds,
              authContext: authContext ?? undefined,
              includeAssignees: args.includeAssignees as boolean | undefined,
              includeTags: args.includeTags as boolean | undefined,
            });

            const dupResult = "error" in rpcDupResult
              ? await duplicateTasksToBlock({
                targetBlockId: taskBlockId,
                taskIds,
                authContext: authContext ?? undefined,
                includeAssignees: args.includeAssignees as boolean | undefined,
                includeTags: args.includeTags as boolean | undefined,
              })
              : rpcDupResult;

            if ("error" in dupResult) {
              await deleteBlock(taskBlockId, { authContext: authContext ?? undefined });
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
              description: args.description as string | null | undefined,
              completed: args.completed as boolean | undefined,
              status: args.status as any,
              statuses: args.statuses as any,
              priority: args.priority as any,
              priorities: args.priorities as any,
              assignee_ids: Array.isArray(args.assigneeIds)
                ? (args.assigneeIds as string[])
                : Array.isArray(args.assignee_ids)
                  ? (args.assignee_ids as string[])
                  : undefined,
              assignee_id: (args.assigneeId ?? args.assignee_id) as string | null | undefined,
              assignees: args.assignees as any,
              due_date: (args.dueDate ?? args.due_date) as any,
              due_dates: (args.dueDates ?? args.due_dates) as any,
              tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
              displayOrder: args.displayOrder as number | undefined,
              authContext: authContext ?? undefined,
            })
          );

        case "updateTaskSubtask":
          return await wrapResult(
            updateTaskSubtask(args.subtaskId as string, {
              title: args.title as string | undefined,
              description: args.description as string | null | undefined,
              completed: args.completed as boolean | undefined,
              displayOrder: args.displayOrder as number | undefined,
              status: args.status as any,
              statuses: args.statuses as any,
              priority: args.priority as any,
              priorities: args.priorities as any,
              assignee_ids: Array.isArray(args.assigneeIds)
                ? (args.assigneeIds as string[])
                : Array.isArray(args.assignee_ids)
                  ? (args.assignee_ids as string[])
                  : undefined,
              assignees: args.assignees as any,
              assignee_id: (args.assigneeId ?? args.assignee_id) as string | null | undefined,
              due_date: (args.dueDate ?? args.due_date) as any,
              due_dates: (args.dueDates ?? args.due_dates) as any,
              tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
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
        case "createSpecChartBlock": {
          let tabId = args.tabId as string | undefined;
          if (!tabId && args.tabName) {
            const tabSearch = await searchTabs({ searchText: args.tabName as string, limit: 1 });
            if (tabSearch.data && tabSearch.data.length > 0) tabId = tabSearch.data[0].id;
          }
          if (!tabId && context?.currentTabId) tabId = context.currentTabId;
          if (!tabId) return { success: false, error: "createSpecChartBlock: Missing tabId" };

          // Row resolution: rowIds (hydrated) → rows (auto-hydrated if from search) → rowBatches
          let resolvedRows: ChartRowRecord[];
          let resolvedDataSource = args.dataSource as import("@/types/chart").ChartDataSource | undefined;
          const rawRowIds = Array.isArray(args.rowIds) ? (args.rowIds as string[]).filter((id) => typeof id === "string" && id.length > 0) : [];
          const searchData = context?.recentSearchResults ?? [];

          if (rawRowIds.length > 0 && searchData.length > 0) {
            // Preferred path: LLM passed rowIds, hydrate from search results
            const hydrated = hydrateChartRowsFromSearch(rawRowIds, searchData);
            if (hydrated && hydrated.length > 0) {
              resolvedRows = hydrated;
              aiDebug("executeTool:chartRowHydration", {
                mode: "rowIds",
                requestedIds: rawRowIds.length,
                hydratedRows: hydrated.length,
              });

              // If the LLM scoped the chart to a subset of the search results, record
              // which IDs were excluded so that live refresh replays the same exclusion.
              const rawDataSource = args.dataSource as import("@/types/chart").ChartDataSource | undefined;
              if (rawDataSource && "scope" in rawDataSource && rawDataSource.scope === "query" && "query" in rawDataSource) {
                const allSearchIds = extractAllIdsFromSearchResults(searchData);
                const rowIdSet = new Set(rawRowIds);
                const excludeIds = allSearchIds.filter((id) => !rowIdSet.has(id));
                if (excludeIds.length > 0) {
                  resolvedDataSource = {
                    ...rawDataSource,
                    query: {
                      ...rawDataSource.query,
                      params: {
                        ...(rawDataSource.query.params as Record<string, unknown>),
                        excludeIds,
                      },
                    },
                  };
                  aiDebug("executeTool:chartExcludeIds", { excludedCount: excludeIds.length });
                }
              }
            } else {
              return { success: false, error: "createSpecChartBlock: rowIds provided but could not hydrate rows from search results. Pass rows directly instead." };
            }
          } else if (rawRowIds.length > 0 && searchData.length === 0) {
            return { success: false, error: "createSpecChartBlock: rowIds provided but no search results available for hydration. Run a search first or pass rows directly." };
          } else {
            // Fallback: LLM passed rows/rowBatches directly
            let baseRows = normalizeChartRowsForExecution(args.rows, args.rowBatches);

            // Auto-hydrate: if rows match search results, enrich them
            if (baseRows.length > 0 && searchData.length > 0) {
              const autoHydrated = autoHydrateRowsFromSearch(baseRows, searchData);
              if (autoHydrated !== baseRows) {
                aiDebug("executeTool:chartRowHydration", {
                  mode: "autoHydrate",
                  originalRows: baseRows.length,
                  hydratedRows: autoHydrated.length,
                });
                baseRows = autoHydrated;
              }
            }

            resolvedRows = baseRows;
          }

          if (resolvedRows.length === 0) {
            return { success: false, error: "createSpecChartBlock: No rows resolved. Provide rowIds from search results or rows directly." };
          }

          return await wrapResult(
            createSpecChartBlock({
              tabId,
              spec:              args.spec as Record<string, unknown>,
              rows:              resolvedRows,
              universeTotal:     args.universeTotal as number | undefined,
              title:             args.title as string | undefined,
              prompt:            args.prompt as string | undefined,
              dataSource:        resolvedDataSource,
              isSimulation:      args.isSimulation as boolean | undefined,
              originalChartId:   args.originalChartId as string | undefined,
              simulationDescription: args.simulationDescription as string | undefined,
              authContext:       authContext ?? undefined,
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

        case "createCard":
          return await wrapResult(
            createCard(
              {
                cardsBlockId: args.cardsBlockId as string,
                title: args.title as string | undefined,
                notes: args.notes as string | null | undefined,
                status: args.status as any,
                priority: args.priority as any,
                assigneeIds: args.assigneeIds as string[] | undefined,
                tags: args.tags as string[] | undefined,
                dueDate: args.dueDate as any,
                statuses: args.statuses as any,
                priorities: args.priorities as any,
              },
              { authContext: authContext ?? undefined }
            )
          );

        case "updateCard":
          return await wrapResult(
            updateCard(
              args.cardId as string,
              {
                title: args.title as string | undefined,
                notes: args.notes as string | null | undefined,
                status: args.status as any,
                priority: args.priority as any,
                assigneeIds: args.assigneeIds as string[] | undefined,
                tags: args.tags as string[] | undefined,
                dueDate: args.dueDate as any,
                statuses: args.statuses as any,
                priorities: args.priorities as any,
              },
              { authContext: authContext ?? undefined }
            )
          );

        case "deleteCard":
          return await wrapResult(deleteCard(args.cardId as string, { authContext: authContext ?? undefined }));

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
            const config = isUniversalPropertyFieldType(type)
              ? undefined
              : (args.config as Record<string, unknown> | undefined);
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
            const requestedFields = args.fields as Array<{
              name: string;
              type: string;
              config?: Record<string, unknown>;
              isPrimary?: boolean;
            }>;
            const fields = requestedFields.map((field) =>
              sanitizeFieldDefinitionForUniversalProperties(field as unknown as Record<string, unknown>) as {
                name: string;
                type: string;
                config?: Record<string, unknown>;
                isPrimary?: boolean;
              }
            );

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

            // Build reusable default columns.
            // Keep primary "Name" separate so explicit primary fields can claim it first,
            // or the first requested field can claim it when no explicit primary is provided.
            const defaultCandidates = isEmpty
              ? existingFields.filter((f) => (f.is_primary ? normalizeFieldName(f.name) === "name" : isDefaultFieldName(f.name)))
              : [];
            let primaryDefault = defaultCandidates.find((f) => f.is_primary && normalizeFieldName(f.name) === "name");
            const nonPrimaryDefaults = defaultCandidates
              .filter((f) => !f.is_primary)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const hasExplicitPrimary = fields.some((field) => field.isPrimary === true);

            // Plan each field: resolve to existing | reuse default | create new
            type FieldPlan =
              | { kind: "existing"; data: unknown }
              | { kind: "reuse"; candidateId: string; name: string; type: string; config?: Record<string, unknown> }
              | { kind: "create"; name: string; type: string; config?: Record<string, unknown>; isPrimary?: boolean };

            const plans: FieldPlan[] = [];
            for (const [fieldIndex, field] of fields.entries()) {
              // Check if a field with this name already exists
              const normalized = normalizeFieldName(field.name);
              const existing = existingFields.find(
                (f) => normalizeFieldName(f.name) === normalized
              );
              if (existing) {
                plans.push({ kind: "existing", data: existing });
                continue;
              }

              // Try to claim a default column for reuse while preserving requested order.
              if (isEmpty && !(CONFIG_REQUIRED_TYPES.has(field.type) && !field.config)) {
                let candidate: (typeof existingFields)[number] | undefined;
                if (field.isPrimary && primaryDefault) {
                  candidate = primaryDefault;
                  primaryDefault = undefined;
                } else if (!field.isPrimary) {
                  if (!hasExplicitPrimary && fieldIndex === 0 && primaryDefault) {
                    candidate = primaryDefault;
                    primaryDefault = undefined;
                  }
                  if (!candidate) {
                    candidate = nonPrimaryDefaults.shift();
                  }
                  // If no explicit primary field is requested, allow one non-primary field to claim Name.
                  if (!candidate && !hasExplicitPrimary && primaryDefault) {
                    candidate = primaryDefault;
                    primaryDefault = undefined;
                  }
                }

                if (candidate) {
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

            // Execute writes sequentially to preserve deterministic order for newly created fields.
            const results: Array<{ success: boolean; data?: unknown; error?: string }> = [];
            for (let index = 0; index < plans.length; index += 1) {
              const plan = plans[index];
              try {
                if (plan.kind === "existing") {
                  results.push({ success: true, data: plan.data });
                  continue;
                }
                if (plan.kind === "reuse") {
                  const nextConfig = applyDefaultFieldConfig(plan.type, plan.config);
                  const payload: Record<string, unknown> = { name: plan.name, type: plan.type };
                  if (nextConfig !== undefined) payload.config = nextConfig;
                  const result = await wrapResult(updateField(plan.candidateId, payload));
                  if (!result.success) {
                    aiDebug("bulkCreateFields:reuseFailed", {
                      fieldIndex: index,
                      fieldName: plan.name,
                      candidateId: plan.candidateId,
                      error: result.error,
                    });
                  }
                  results.push(result);
                  continue;
                }
                const result = await wrapResult(
                  createField({
                    tableId,
                    name: plan.name,
                    type: plan.type as any,
                    config: plan.config as any,
                    isPrimary: plan.isPrimary,
                  })
                );
                if (!result.success) {
                  aiDebug("bulkCreateFields:createFailed", {
                    fieldIndex: index,
                    fieldName: plan.name,
                    fieldType: plan.type,
                    error: result.error,
                  });
                }
                results.push(result);
              } catch (error) {
                const fieldName = plan.kind === "create" ? plan.name : plan.kind === "reuse" ? plan.name : "unknown";
                aiDebug("bulkCreateFields:exception", {
                  fieldIndex: index,
                  fieldName,
                  planKind: plan.kind,
                  error: error instanceof Error ? error.message : String(error),
                });
                results.push({
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            const allSuccessful = results.every((r) => r.success);
            const failures = results
              .map((r, i) => ({ index: i, result: r, plan: plans[i] }))
              .filter(({ result }) => !result.success);

            if (!allSuccessful && failures.length > 0) {
              const errorMessages = failures.map(({ plan, result }) => {
                const fieldName = plan.kind === "create" ? plan.name : plan.kind === "reuse" ? plan.name : "unknown";
                return `Field "${fieldName}" (${plan.kind}): ${result.error ?? "Unknown error"}`;
              });
              const errorSummary = `Failed to create ${failures.length} of ${fields.length} fields:\n${errorMessages.join("\n")}`;
              aiDebug("bulkCreateFields:summary", {
                totalFields: fields.length,
                successful: results.filter((r) => r.success).length,
                failed: failures.length,
                failures: failures.map((f) => ({
                  fieldName: f.plan.kind === "create" ? f.plan.name : f.plan.kind === "reuse" ? f.plan.name : "unknown",
                  error: f.result.error,
                })),
              });
              return {
                success: false,
                data: results.map((r) => r.data),
                error: errorSummary,
              };
            }

            // Enforce deterministic field order for fresh tables created via slow path.
            // This makes final column ordering match the requested schema order exactly.
            if (isEmpty) {
              const fieldIdsInRequestedOrder = results
                .map((result) => {
                  const data = result.data as Record<string, unknown> | undefined;
                  return typeof data?.id === "string" ? data.id : null;
                })
                .filter((id): id is string => Boolean(id));
              if (fieldIdsInRequestedOrder.length > 0) {
                const reorderResult = await wrapResult(
                  reorderFields(
                    tableId,
                    fieldIdsInRequestedOrder.map((fieldId, index) => ({
                      fieldId,
                      order: index + 1,
                    })),
                    { authContext: authContext ?? undefined }
                  )
                );
                if (!reorderResult.success) {
                  return {
                    success: false,
                    data: results.map((r) => r.data),
                    error: reorderResult.error ?? "Failed to apply deterministic field ordering.",
                  };
                }
              }
            }

            return {
              success: true,
              data: results.map((r) => r.data),
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

          // Enhance fields and normalize select field values before creating the row
          const normalizedData = await enhanceFieldsAndNormalizeSelectValues(
            tableId,
            [{ data: args.data as Record<string, unknown> }]
          );

          return await wrapResult(
            createRow({
              tableId,
              data: normalizedData[0].data,
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

            // Log the exact source values the LLM passed per row (before deterministic backfill)
            aiDebug("sourceTracking:llmRawInput", {
              tool: "bulkInsertRows",
              rowCount: normalizedRows.length,
              rows: normalizedRows.map((row: any, i: number) => ({
                index: i,
                title: row.data?.Title ?? row.data?.Name ?? row.data?.title ?? Object.values(row.data ?? {})[0],
                source_entity_id: row.source_entity_id ?? null,
                source_entity_type: row.source_entity_type ?? null,
                source_sync_mode: row.source_sync_mode ?? null,
              })),
            });

            const rowsWithSourceMetadata = await annotateRowsWithSourceMetadataForTable({
              tableId: resolvedTableId,
              rows: normalizedRows as Array<Record<string, unknown>>,
              authContext: authContext ?? undefined,
              searchedEntities: context?.searchedEntities,
            });

            await maybeEnsureFieldsForRows(
              resolvedTableId,
              rowsWithSourceMetadata as Array<{ data: Record<string, unknown>; order?: number | string | null }>
            );
            await maybeRemoveDefaultRows(resolvedTableId);

            const mappingResult = await mapRowDataToFieldIds(
              resolvedTableId,
              rowsWithSourceMetadata as Array<{ data: Record<string, unknown>; order?: number | string | null }>
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

            // Enhance fields and normalize select field values (same as createTableFull)
            const rowsWithNormalizedSelects = await enhanceFieldsAndNormalizeSelectValues(
              resolvedTableId,
              mappingResult.rows
            );

            const result = await insertRowsAdaptive(
              resolvedTableId,
              rowsWithNormalizedSelects,
              { authContext: authContext ?? undefined }
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
              if (isUniversalPropertyFieldType(field.type)) {
                const normalized = normalizeUniversalPropertyValue(field.type, rawValue);
                if (rawValue !== null && rawValue !== undefined && rawValue !== "" && !normalized) {
                  return {
                    success: false,
                    error: `bulkUpdateRows: "${field.name}" must be canonical (${field.type === "priority" ? "low|medium|high|urgent" : "todo|in_progress|done|blocked"}).`,
                  };
                }
                (args.updates as Record<string, unknown>)[fieldId] = normalized;
                continue;
              }
              if (!isSelectLike(field.type)) continue;

              const { kind, options } = getOptionEntries(field);
              const values = Array.isArray(rawValue) ? rawValue : [rawValue];
              const { values: normalizedValues, missing } = resolveSelectValues(
                { type: field.type, config: (field.config ?? {}) as Record<string, unknown> },
                values,
                false
              );
              if (missing || normalizedValues.length !== values.length) {
                return {
                  success: false,
                  error: `bulkUpdateRows: "${field.name}" values were not found in field options. Provide valid labels (or IDs that map to labels).`,
                };
              }
              if ((kind === "options" || kind === "levels") && options.length === 0) {
                return {
                  success: false,
                  error: `bulkUpdateRows: "${field.name}" has no options configured. Use updateTableRowsByFieldNames to create options and update rows.`,
                };
              }
              (args.updates as Record<string, unknown>)[fieldId] =
                field.type === "multi_select" ? normalizedValues : normalizedValues[0] ?? null;
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
            if (
              isUniversalPropertyFieldType(field.type) &&
              rawValue !== null &&
              rawValue !== undefined &&
              rawValue !== "" &&
              resolved.value === null
            ) {
              return {
                success: false,
                error: `Invalid ${field.type} value for "${field.name}". ` +
                  (field.type === "priority"
                    ? "Use: low|medium|high|urgent."
                    : "Use: todo|in_progress|done|blocked."),
              };
            }
            updatesByFieldId[field.id] = resolved.value;
            if (resolved.updatedConfig) {
              pendingConfigUpdates.set(field.id, resolved.updatedConfig);
            }
          }
          if (timingEnabled) t_resolve_updates_ms = Date.now() - resolveStart;

          // Persist any new options before updating rows.
          const updateOptionsStart = timingEnabled ? Date.now() : 0;
          for (const [fieldId, config] of pendingConfigUpdates.entries()) {
            const updateResult = await executeTool(
              { name: "updateField", arguments: { fieldId, config } },
              context
            );
            if (!updateResult.success) {
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
            await syncPriorityStatusToEntityProperties(tableId, matchedRowIds, authContext ?? undefined);
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
                const updateResult = await executeTool(
                  { name: "updateField", arguments: { fieldId: field.id, config: resolved.updatedConfig } },
                  context
                );
                if (!updateResult.success) {
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
            // Check if args is empty or missing critical info
            if (!args || Object.keys(args).length === 0) {
              return {
                success: false,
                error: "createTableFull was called with no arguments. You MUST provide workspaceId (from context) and title (table name) at minimum. Check the tool schema and try again with proper arguments."
              };
            }

            const workspaceId = args.workspaceId as string;
            const title = args.title as string;
            const description = args.description as string | undefined;
            const projectId = args.projectId as string | undefined;
            // Auto-inject tabId from context if not provided (workflow context)
            const tabId = (args.tabId as string | undefined) ?? context?.currentTabId;
            let fields = Array.isArray(args.fields) ? (args.fields as Array<Record<string, unknown>>) : [];
            let rows = Array.isArray(args.rows) ? (args.rows as Array<Record<string, unknown>>) : [];
            fields = sanitizeFieldDefinitionsForUniversalProperties(fields);

            if (!workspaceId || !title) {
              const missing = [];
              if (!workspaceId) missing.push("workspaceId (get from system context)");
              if (!title) missing.push("title (the name of the table)");
              return {
                success: false,
                error: `createTableFull missing required parameters: ${missing.join(", ")}. You MUST provide these arguments when calling this tool.`
              };
            }

            // Log the exact source values the LLM passed per row (before deterministic backfill)
            aiDebug("sourceTracking:llmRawInput", {
              tool: "createTableFull",
              rowCount: rows.length,
              rows: rows.map((row, i) => ({
                index: i,
                title: (row.data as Record<string, unknown>)?.Title ?? (row.data as Record<string, unknown>)?.Name ?? (row.data as Record<string, unknown>)?.title ?? Object.values((row.data as Record<string, unknown>) ?? {})[0],
                source_entity_id: row.source_entity_id ?? null,
                source_entity_type: row.source_entity_type ?? null,
                source_sync_mode: row.source_sync_mode ?? null,
              })),
            });

            rows = await annotateRowsWithSourceMetadata({
              rows,
              workspaceId,
              supabase: authContext?.supabase ?? await createSupabaseClient(),
              searchedEntities: context?.searchedEntities,
            });

            const hasSourceMetadata = rows.some((row) =>
              hasValidRowSourceMetadata((row as Record<string, unknown>)?.source_entity_type, (row as Record<string, unknown>)?.source_entity_id)
            );

            // Enhance field types with smart inference from row data
            fields = enhanceFieldsWithInference(fields, rows);
            rows = normalizeRowsForSelectFields(fields, rows);
            const normalizedInlineRows = rows.slice(0, CREATE_TABLE_FULL_MAX_INLINE_ROWS);
            const normalizedOverflowRows = rows.slice(CREATE_TABLE_FULL_MAX_INLINE_ROWS);
            if (hasSourceMetadata) {
              fields = pruneEmptySourceColumns(fields, rows);
            }

            if (!hasSourceMetadata) {
              // RPC fast-path: create table + fields + rows in one DB transaction
              const rpcResult = await createTableFullRpc({
                workspaceId,
                title,
                description,
                projectId,
                tabId: tabId ?? null,
                fields,
                rows: normalizedInlineRows,
                authContext: authContext ?? undefined,
              });

              if (!("error" in rpcResult)) {
                const { tableId, fieldsCreated, rowsInserted } = rpcResult.data;
                let blockId: string | null = null;

                // Create table block (UI visibility) if needed
                if (tabId) {
                  const blockResult = await createBlock({
                    tabId,
                    type: "table",
                    content: { tableId },
                    authContext: authContext ?? undefined,
                  });
                  if ("error" in blockResult) {
                    await deleteTable(tableId, { authContext: authContext ?? undefined });
                    return { success: false, error: blockResult.error ?? "Failed to create table block." };
                  }
                  blockId = blockResult.data.id;
                }

                let totalInserted = rowsInserted;
                const warnings: string[] = [];
                if (normalizedOverflowRows.length > 0) {
                  const overflowResult = await executeTool(
                    { name: "bulkInsertRows", arguments: { tableId, rows: normalizedOverflowRows } },
                    context
                  );
                  if (!overflowResult.success) {
                    if (blockId) {
                      await deleteBlock(blockId, { authContext: authContext ?? undefined });
                    }
                    await deleteTable(tableId, { authContext: authContext ?? undefined });
                    return { success: false, error: overflowResult.error ?? "Failed to insert overflow rows." };
                  }
                  const overflowInserted = Array.isArray((overflowResult.data as Record<string, unknown> | undefined)?.insertedIds)
                    ? ((overflowResult.data as Record<string, unknown>).insertedIds as string[])
                    : [];
                  totalInserted += overflowInserted.length;
                  if (overflowResult.warnings?.length) {
                    warnings.push(...overflowResult.warnings);
                  }
                }

                return {
                  success: true,
                  data: { tableId, fieldsCreated, rowsInserted: totalInserted, blockId },
                  hint: `Created table "${title}" with ${fieldsCreated} fields and ${totalInserted} rows.`,
                  warnings: warnings.length > 0 ? warnings : undefined,
                };
              }
            }

            // Step 1: Create table
            const tableResult = await wrapResult(
              createTable({
                workspaceId,
                title,
                description,
                projectId,
                tabId: tabId ?? null,
                authContext: authContext ?? undefined,
              })
            );

            if (!tableResult.success || !tableResult.data) {
              return { success: false, error: tableResult.error ?? "Failed to create table." };
            }

            const tableData = tableResult.data as { table: { id: string } };
            const tableId = tableData.table.id;
            let blockId: string | null = null;

            // Step 1b: Create table block if tabId provided
            if (tabId) {
              const blockResult = await createBlock({
                tabId,
                type: "table",
                content: { tableId },
                authContext: authContext ?? undefined,
              });
              if ("error" in blockResult) {
                await deleteTable(tableId, { authContext: authContext ?? undefined });
                return { success: false, error: blockResult.error ?? "Failed to create table block." };
              }
              blockId = blockResult.data.id;
            }

            // Step 2: Create fields if provided
            let createdFields: unknown[] = [];
            if (fields.length > 0) {
              const fieldsResult = await executeTool(
                { name: "bulkCreateFields", arguments: { tableId, fields } },
                context
              );
              if (!fieldsResult.success) {
                if (blockId) {
                  await deleteBlock(blockId, { authContext: authContext ?? undefined });
                }
                await deleteTable(tableId, { authContext: authContext ?? undefined });
                return { success: false, error: fieldsResult.error ?? "Failed to create fields." };
              }
              createdFields = Array.isArray(fieldsResult.data) ? fieldsResult.data : [];
            }

            // Step 3: Insert rows if provided
            let insertedRows: unknown[] = [];
            if (normalizedInlineRows.length > 0) {
              const rowsResult = await executeTool(
                { name: "bulkInsertRows", arguments: { tableId, rows: normalizedInlineRows } },
                context
              );
              if (!rowsResult.success) {
                if (blockId) {
                  await deleteBlock(blockId, { authContext: authContext ?? undefined });
                }
                await deleteTable(tableId, { authContext: authContext ?? undefined });
                return { success: false, error: rowsResult.error ?? "Failed to insert rows." };
              }
              insertedRows = Array.isArray((rowsResult.data as Record<string, unknown>)?.insertedIds)
                ? ((rowsResult.data as Record<string, unknown>).insertedIds as unknown[])
                : [];

            }

            if (normalizedOverflowRows.length > 0) {
              const overflowResult = await executeTool(
                { name: "bulkInsertRows", arguments: { tableId, rows: normalizedOverflowRows } },
                context
              );
              if (!overflowResult.success) {
                if (blockId) {
                  await deleteBlock(blockId, { authContext: authContext ?? undefined });
                }
                await deleteTable(tableId, { authContext: authContext ?? undefined });
                return { success: false, error: overflowResult.error ?? "Failed to insert overflow rows." };
              }
              const overflowInserted = Array.isArray((overflowResult.data as Record<string, unknown> | undefined)?.insertedIds)
                ? ((overflowResult.data as Record<string, unknown>).insertedIds as unknown[])
                : [];
              insertedRows = insertedRows.concat(overflowInserted);
            }

            return {
              success: true,
              data: {
                tableId,
                fieldsCreated: createdFields.length,
                rowsInserted: insertedRows.length,
                blockId,
              },
              hint: `Created table "${title}" with ${createdFields.length} fields and ${insertedRows.length} rows (max ${CREATE_TABLE_FULL_MAX_INLINE_ROWS} inline, overflow batched).`,
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
            const hasSourceMetadataInInsertRows =
              Array.isArray(args.insertRows) &&
              (args.insertRows as Array<Record<string, unknown>>).some((row) =>
                hasValidRowSourceMetadata(row?.source_entity_type, row?.source_entity_id)
              );
            const sanitizedAddFields = Array.isArray(args.addFields)
              ? sanitizeFieldDefinitionsForUniversalProperties(args.addFields as Array<Record<string, unknown>>)
              : undefined;
            const sanitizedUpdateFields = Array.isArray(args.updateFields)
              ? (args.updateFields as Array<Record<string, unknown>>).map((field) =>
                sanitizeFieldDefinitionForUniversalProperties(field)
              )
              : undefined;

            if (hasRpcOps && !context?.undoTracker && !hasSourceMetadataInInsertRows) {
              // RPC fast-path: apply all operations in one DB transaction
              const rpcResult = await updateTableFullRpc({
                tableId,
                title: args.title as string | undefined,
                description: (args.description as string | null | undefined) ?? undefined,
                addFields: sanitizedAddFields,
                updateFields: sanitizedUpdateFields,
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

              const tableResult = await executeTool(
                { name: "updateTable", arguments: { tableId, ...updates } },
                context
              );
              if (!tableResult.success) {
                return { success: false, error: tableResult.error ?? "Failed to update table metadata." };
              }
            }

            // Add fields
            if (Array.isArray(args.addFields) && args.addFields.length > 0) {
              const fieldsResult = await executeTool(
                { name: "bulkCreateFields", arguments: { tableId, fields: sanitizedAddFields ?? args.addFields } },
                context
              );
              if (!fieldsResult.success) {
                return { success: false, error: fieldsResult.error ?? "Failed to add fields." };
              }
              operationSummary.fieldsAdded = (args.addFields as unknown[]).length;
            }

            // Update fields
            if (Array.isArray(args.updateFields) && args.updateFields.length > 0) {
              for (const fieldUpdate of (sanitizedUpdateFields ?? (args.updateFields as Array<Record<string, unknown>>))) {
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
                  const result = await executeTool(
                    {
                      name: "updateField",
                      arguments: {
                        fieldId,
                        name: fieldUpdate.name as string | undefined,
                        config: fieldUpdate.config as Record<string, unknown> | undefined,
                      },
                    },
                    context
                  );
                  if (!result.success) {
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
                  const result = await executeTool(
                    { name: "deleteField", arguments: { fieldId } },
                    context
                  );
                  if (!result.success) {
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
              const result = await executeTool(
                { name: "deleteRows", arguments: { rowIds: args.deleteRowIds } },
                context
              );
              if (!result.success) {
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
          const sourceMetadata = extractSourceMetadataFromArgs(args as Record<string, unknown>);
          const hadSourceHints = Boolean(
            (args as Record<string, unknown>).source_entity_type !== undefined ||
            (args as Record<string, unknown>).source_entity_id !== undefined ||
            (args as Record<string, unknown>).sourceEntityType !== undefined ||
            (args as Record<string, unknown>).sourceEntityId !== undefined ||
            ((args as Record<string, unknown>)._source && typeof (args as Record<string, unknown>)._source === "object")
          );
          const sourceMetadataIncomplete = hadSourceHints && (!sourceMetadata.sourceEntityType || !sourceMetadata.sourceEntityId);
          if (sourceMetadataIncomplete) {
            aiDebug("createTimelineEvent:sourceMetadataInvalid", {
              source_entity_type: (args as Record<string, unknown>).source_entity_type,
              source_entity_id: (args as Record<string, unknown>).source_entity_id,
              sourceEntityType: (args as Record<string, unknown>).sourceEntityType,
              sourceEntityId: (args as Record<string, unknown>).sourceEntityId,
              normalizedSourceEntityType: sourceMetadata.sourceEntityType ?? null,
              normalizedSourceEntityId: sourceMetadata.sourceEntityId ?? null,
            });
          }
          const timelinePrioritiesInput =
            (args as Record<string, unknown>).priorities ??
            (args as Record<string, unknown>).priorityFields ??
            (args as Record<string, unknown>).priority_fields;

          const timelineResult = await wrapResult(
            createTimelineEvent({
              timelineBlockId,
              parentEventId: args.parentEventId as string | undefined,
              title: args.title as string,
              startDate: args.startDate as string,
              endDate: args.endDate as string,
              status: args.status as TimelineEventStatus | undefined,
              statuses:
                ((args as Record<string, unknown>).statuses ??
                  (args as Record<string, unknown>).statusFields ??
                  (args as Record<string, unknown>).status_fields) !== undefined
                  ? normalizeTimelineStatuses(
                    (args as Record<string, unknown>).statuses ??
                    (args as Record<string, unknown>).statusFields ??
                    (args as Record<string, unknown>).status_fields
                  )
                  : undefined,
              priority: args.priority as TimelineEventPriority | undefined,  // NEW: Priority parameter
              priorities:
                timelinePrioritiesInput !== undefined
                  ? normalizeTimelinePriorities(timelinePrioritiesInput)
                  : undefined,
              progress: args.progress as number | undefined,
              notes: args.notes as string | undefined,
              color: args.color as string | undefined,
              isMilestone: args.isMilestone as boolean | undefined,
              assignees: (args as Record<string, unknown>).assignees as any,
              assigneeIds:
                Array.isArray((args as Record<string, unknown>).assigneeIds)
                  ? ((args as Record<string, unknown>).assigneeIds as string[])
                  : Array.isArray((args as Record<string, unknown>).assignee_ids)
                    ? ((args as Record<string, unknown>).assignee_ids as string[])
                    : undefined,
              assigneeTeamIds:
                Array.isArray((args as Record<string, unknown>).assigneeTeamIds)
                  ? ((args as Record<string, unknown>).assigneeTeamIds as string[])
                  : Array.isArray((args as Record<string, unknown>).assignee_team_ids)
                    ? ((args as Record<string, unknown>).assignee_team_ids as string[])
                    : undefined,
              assigneeId,
              sourceEntityType: sourceMetadata.sourceEntityType,
              sourceEntityId: sourceMetadata.sourceEntityId,
              sourceSyncMode:
                sourceMetadata.sourceEntityType && sourceMetadata.sourceEntityId
                  ? sourceMetadata.sourceSyncMode
                  : undefined,
              authContext: authContext ?? undefined,
            })
          );
          if (sourceMetadataIncomplete) return { ...timelineResult, sourceMetadataIncomplete: true };
          return timelineResult;
        }
        case "createTimelineSubEvent": {
          const parentEventId = args.parentEventId as string | undefined;
          if (!parentEventId) return { success: false, error: "createTimelineSubEvent requires parentEventId." };

          const supabase = authContext?.supabase ?? await createSupabaseClient();
          const { data: parentEvent } = await supabase
            .from("timeline_events")
            .select("id, timeline_block_id")
            .eq("id", parentEventId)
            .maybeSingle();
          if (!parentEvent) {
            return { success: false, error: "Parent timeline event not found." };
          }

          let assigneeId = args.assigneeId as string | undefined;
          if (!assigneeId && args.assigneeName) {
            const assigneeResult = await resolveTaskAssignees([{ name: args.assigneeName as string }]);
            if (assigneeResult.resolved.length > 0) {
              assigneeId = assigneeResult.resolved[0].id ?? undefined;
            }
          }

          return await wrapResult(
            createTimelineEvent({
              timelineBlockId: parentEvent.timeline_block_id as string,
              parentEventId,
              title: args.title as string,
              startDate: args.startDate as string,
              endDate: args.endDate as string,
              status: args.status as TimelineEventStatus | undefined,
              statuses:
                ((args as Record<string, unknown>).statuses ??
                  (args as Record<string, unknown>).statusFields ??
                  (args as Record<string, unknown>).status_fields) !== undefined
                  ? normalizeTimelineStatuses(
                    (args as Record<string, unknown>).statuses ??
                    (args as Record<string, unknown>).statusFields ??
                    (args as Record<string, unknown>).status_fields
                  )
                  : undefined,
              priority: args.priority as TimelineEventPriority | undefined,
              priorities:
                ((args as Record<string, unknown>).priorities ??
                  (args as Record<string, unknown>).priorityFields ??
                  (args as Record<string, unknown>).priority_fields) !== undefined
                  ? normalizeTimelinePriorities(
                    (args as Record<string, unknown>).priorities ??
                    (args as Record<string, unknown>).priorityFields ??
                    (args as Record<string, unknown>).priority_fields
                  )
                  : undefined,
              assigneeId,
              assignees: (args as Record<string, unknown>).assignees as any,
              assigneeIds:
                Array.isArray((args as Record<string, unknown>).assigneeIds)
                  ? ((args as Record<string, unknown>).assigneeIds as string[])
                  : Array.isArray((args as Record<string, unknown>).assignee_ids)
                    ? ((args as Record<string, unknown>).assignee_ids as string[])
                    : undefined,
              assigneeTeamIds:
                Array.isArray((args as Record<string, unknown>).assigneeTeamIds)
                  ? ((args as Record<string, unknown>).assigneeTeamIds as string[])
                  : Array.isArray((args as Record<string, unknown>).assignee_team_ids)
                    ? ((args as Record<string, unknown>).assignee_team_ids as string[])
                    : undefined,
              notes: args.notes as string | undefined,
              color: args.color as string | undefined,
              progress: args.progress as number | undefined,
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
                statuses:
                  ((args as Record<string, unknown>).statuses ??
                    (args as Record<string, unknown>).statusFields ??
                    (args as Record<string, unknown>).status_fields) !== undefined
                    ? normalizeTimelineStatuses(
                      (args as Record<string, unknown>).statuses ??
                      (args as Record<string, unknown>).statusFields ??
                      (args as Record<string, unknown>).status_fields
                    )
                    : undefined,
                priority: args.priority as TimelineEventPriority | undefined,  // NEW: Priority parameter
                priorities:
                  ((args as Record<string, unknown>).priorities ??
                    (args as Record<string, unknown>).priorityFields ??
                    (args as Record<string, unknown>).priority_fields) !== undefined
                    ? normalizeTimelinePriorities(
                      (args as Record<string, unknown>).priorities ??
                      (args as Record<string, unknown>).priorityFields ??
                      (args as Record<string, unknown>).priority_fields
                    )
                    : undefined,
                progress: args.progress as number | undefined,
                notes: (args.notes as string | null | undefined) ?? undefined,
                color: (args.color as string | null | undefined) ?? undefined,
                isMilestone: args.isMilestone as boolean | undefined,
                assignees: (args as Record<string, unknown>).assignees as any,
                assigneeIds:
                  Array.isArray((args as Record<string, unknown>).assigneeIds)
                    ? ((args as Record<string, unknown>).assigneeIds as string[])
                    : Array.isArray((args as Record<string, unknown>).assignee_ids)
                      ? ((args as Record<string, unknown>).assignee_ids as string[])
                      : undefined,
                assigneeTeamIds:
                  Array.isArray((args as Record<string, unknown>).assigneeTeamIds)
                    ? ((args as Record<string, unknown>).assigneeTeamIds as string[])
                    : Array.isArray((args as Record<string, unknown>).assignee_team_ids)
                      ? ((args as Record<string, unknown>).assignee_team_ids as string[])
                      : undefined,
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
        case "setEntityProperty":
          {
            const entityType = args.entityType as any;
            const entityId = args.entityId as string;
            const fieldType = (args as any).fieldType as string | undefined;
            const fieldName = (args as any).fieldName as string | undefined;
            const value = (args as any).value;

            if (!fieldType || !fieldName) {
              return { success: false, error: "fieldType and fieldName are required" };
            }

            return await wrapResult(
              setEntityProperty({
                entity_type: entityType,
                entity_id: entityId,
                field_type: fieldType as any,
                field_name: fieldName,
                value: value as PropertyValue,
              })
            );
          }

        case "removeEntityProperty":
          return await wrapResult(
            removeEntityProperty(
              args.entityType as any,
              args.entityId as string,
              args.fieldName as string
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
        // SHOPIFY ACTIONS
        // ==================================================================
        case "searchShopifyProducts": {
          if (!workspaceId) {
            return { success: false, error: "No workspace selected" };
          }

          // Auto-resolve connection if not provided
          let connectionId = args.connectionId as string | undefined;
          if (!connectionId) {
            const connectionsResult = await listShopifyConnections(workspaceId);
            aiDebug("shopify:connectionsLookup", {
              workspaceId,
              tool: "searchShopifyProducts",
              hasError: "error" in connectionsResult,
              total: "data" in connectionsResult ? connectionsResult.data?.length ?? 0 : 0,
              active:
                "data" in connectionsResult
                  ? (connectionsResult.data?.filter(c => c.sync_status === "active") ?? []).length
                  : 0,
              shopDomains:
                "data" in connectionsResult
                  ? (connectionsResult.data?.map(c => c.shop_domain).filter(Boolean) ?? [])
                  : [],
            });
            if ("error" in connectionsResult) {
              return { success: false, error: connectionsResult.error };
            }
            const activeConnections = connectionsResult.data?.filter(c => c.sync_status === "active") || [];

            if (activeConnections.length === 0) {
              return { success: false, error: "No active Shopify connection found. Please connect a Shopify store first." };
            } else if (activeConnections.length === 1) {
              connectionId = activeConnections[0].id;
            } else if (args.shopName) {
              // Find by shop name
              const shopName = (args.shopName as string).toLowerCase();
              const match = activeConnections.find(c =>
                c.shop_domain.toLowerCase().includes(shopName) ||
                (c.shop_name && c.shop_name.toLowerCase().includes(shopName))
              );
              if (match) {
                connectionId = match.id;
              } else {
                return { success: false, error: `No Shopify connection found matching "${args.shopName}". Available: ${activeConnections.map(c => c.shop_domain).join(", ")}` };
              }
            } else {
              return { success: false, error: `Multiple Shopify connections found. Please specify which one: ${activeConnections.map(c => c.shop_domain).join(", ")}` };
            }
          }

          // Get products from Saria database
          const productsResult = await getSariaProducts(connectionId, {
            search: args.searchText as string | undefined,
            limit: (args.limit as number) || 50,
            offset: (args.offset as number) || 0,
          });

          if ("error" in productsResult) {
            return { success: false, error: productsResult.error };
          }

          let products = productsResult.data.products;

          // Apply additional filters not supported by getSariaProducts
          if (args.vendor) {
            const vendor = (args.vendor as string).toLowerCase();
            products = products.filter(p => p.vendor?.toLowerCase().includes(vendor));
          }
          if (args.productType) {
            const productType = (args.productType as string).toLowerCase();
            products = products.filter(p => p.product_type?.toLowerCase().includes(productType));
          }
          if (args.tag) {
            const tag = (args.tag as string).toLowerCase();
            products = products.filter(p => p.tags?.some(t => t.toLowerCase() === tag));
          }
          if (args.status) {
            const status = (args.status as string).toLowerCase();
            products = products.filter(p => p.status?.toLowerCase() === status);
          }
          if (args.minVariants !== undefined) {
            products = products.filter(p => (p.variants_count || 0) >= (args.minVariants as number));
          }
          if (args.maxVariants !== undefined) {
            products = products.filter(p => (p.variants_count || 0) <= (args.maxVariants as number));
          }

          return {
            success: true,
            data: {
              products: products.map(p => ({
                id: p.id,
                title: p.title,
                vendor: p.vendor,
                productType: p.product_type,
                status: p.status,
                tags: p.tags,
                variantsCount: p.variants_count,
                featuredImageUrl: p.featured_image_url,
                lastSyncedAt: p.last_synced_at,
              })),
              total: products.length,
              connectionId,
            },
            hint: products.length > 0
              ? `Found ${products.length} product(s).`
              : "No products found matching the criteria.",
          };
        }

        case "getShopifyProductDetails": {
          const productId = args.productId as string;
          if (!productId) {
            return { success: false, error: "Missing productId" };
          }
          return await wrapResult(getProductDetails(productId));
        }

        case "getShopifyProductSales": {
          const productId = args.productId as string;
          const startDate = args.startDate as string;
          const endDate = args.endDate as string;

          if (!productId) return { success: false, error: "Missing productId" };
          if (!startDate) return { success: false, error: "Missing startDate (YYYY-MM-DD)" };
          if (!endDate) return { success: false, error: "Missing endDate (YYYY-MM-DD)" };

          return await wrapResult(getProductUnitsSold(productId, startDate, endDate));
        }

        case "createProductsTable": {
          if (!workspaceId) {
            return { success: false, error: "No workspace selected" };
          }

          // Resolve tab
          let tabId = args.tabId as string | undefined;
          if (!tabId && args.tabName) {
            const tabSearch = await searchTabs({ searchText: args.tabName as string, limit: 1 });
            if (tabSearch.data && tabSearch.data.length > 0) {
              tabId = tabSearch.data[0].id;
            }
          }
          if (!tabId && context?.currentTabId) {
            tabId = context.currentTabId;
          }

          // Resolve connection
          let connectionId = args.connectionId as string | undefined;
          if (!connectionId) {
            const connectionsResult = await listShopifyConnections(workspaceId);
            aiDebug("shopify:connectionsLookup", {
              workspaceId,
              tool: "createProductsTable",
              hasError: "error" in connectionsResult,
              total: "data" in connectionsResult ? connectionsResult.data?.length ?? 0 : 0,
              active:
                "data" in connectionsResult
                  ? (connectionsResult.data?.filter(c => c.sync_status === "active") ?? []).length
                  : 0,
              shopDomains:
                "data" in connectionsResult
                  ? (connectionsResult.data?.map(c => c.shop_domain).filter(Boolean) ?? [])
                  : [],
            });
            if ("error" in connectionsResult) {
              return { success: false, error: connectionsResult.error };
            }
            const activeConnections = connectionsResult.data?.filter(c => c.sync_status === "active") || [];
            if (activeConnections.length === 0) {
              return { success: false, error: "No active Shopify connection found." };
            }
            connectionId = activeConnections[0].id;
          }

          // Get products (either specific IDs or filtered)
          let products: ShopifyProduct[] = [];
          const productIds = args.productIds as string[] | undefined;

          if (productIds && productIds.length > 0) {
            // Fetch specific products by ID
            for (const pid of productIds.slice(0, 100)) {
              const details = await getProductDetails(pid);
              if ("data" in details && details.data) {
                products.push(details.data as ShopifyProduct);
              }
            }
          } else {
            // Fetch products with filters
            const productsResult = await getSariaProducts(connectionId, {
              search: args.searchText as string | undefined,
              limit: (args.limit as number) || 50,
            });
            if ("error" in productsResult) {
              return { success: false, error: productsResult.error };
            }
            products = productsResult.data.products;

            // Apply filters
            if (args.vendor) {
              const vendor = (args.vendor as string).toLowerCase();
              products = products.filter(p => p.vendor?.toLowerCase().includes(vendor));
            }
            if (args.productType) {
              const productType = (args.productType as string).toLowerCase();
              products = products.filter(p => p.product_type?.toLowerCase().includes(productType));
            }
          }

          if (products.length === 0) {
            return { success: false, error: "No products found to add to the table." };
          }

          // Create table with product data
          const tableTitle = (args.title as string) || "Shopify Products";
          const fields = [
            { name: "Title", type: "text" },
            { name: "Vendor", type: "text" },
            { name: "Type", type: "text" },
            {
              name: "Status", type: "select", config: {
                options: [
                  { id: "opt-active", label: "Active", color: "#10b981", order: 0 },
                  { id: "opt-draft", label: "Draft", color: "#f59e0b", order: 1 },
                  { id: "opt-archived", label: "Archived", color: "#6b7280", order: 2 },
                ]
              }
            },
            { name: "Variants", type: "number" },
            { name: "Tags", type: "text" },
          ];

          const rows = products.map(p => ({
            data: {
              "Title": p.title,
              "Vendor": p.vendor || "",
              "Type": p.product_type || "",
              "Status": p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "",
              "Variants": p.variants_count || 0,
              "Tags": p.tags?.join(", ") || "",
            }
          }));

          // Use createTableFull to create the table
          const tableResult = await executeTool(
            {
              name: "createTableFull",
              arguments: {
                workspaceId,
                title: tableTitle,
                projectId: context?.currentProjectId,
                tabId,
                fields,
                rows,
              },
            },
            context
          );

          if (!tableResult.success) {
            return { success: false, error: tableResult.error ?? "Failed to create products table." };
          }

          return {
            success: true,
            data: {
              ...(tableResult.data as Record<string, unknown>),
              productsCount: products.length,
            },
            hint: `Created table "${tableTitle}" with ${products.length} Shopify products.`,
          };
        }

        case "refreshShopifyProduct": {
          const productId = args.productId as string;
          if (!productId) {
            return { success: false, error: "Missing productId" };
          }
          const result = await wrapResult(refreshProduct(productId));
          if (result.success) {
            return {
              ...result,
              hint: "Product data refreshed from Shopify. Sales cache has been invalidated.",
            };
          }
          return result;
        }

        // ==================================================================
        // UNKNOWN TOOL
        // ==================================================================
        default:
          return {
            success: false,
            error: `Unknown tool: ${requestedToolName}`,
          };
      }
    };

    const result = await runTool();
    if (shouldCaptureUndo && undoTracker && result.success) {
      const postUndoSteps = buildUndoStepsAfter(toolName, args, result);
      const combined = [...postUndoSteps, ...preUndoSteps];
      if (combined.length > 0) {
        undoTracker.addBatch(combined);
      } else {
        undoTracker.skipTool(toolName);
      }
    }
    return result;
  } catch (error) {
    aiDebug("executeTool:error", { tool: requestedToolName, resolvedTool: toolName, error });
    console.error(`[executeTool] Error executing ${requestedToolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  } finally {
    aiDebug("executeTool:done", { tool: requestedToolName, resolvedTool: toolName, ms: Math.round(performance.now() - t0) });
    // Clear test context if it was set
    if (shouldUseTestContext() && context?.workspaceId && context?.userId) {
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

  // PRIORITY 1: Current tab (most specific context)
  if (context?.currentTabId) {
    const cached = taskBlockIdByTabCache.get(context.currentTabId);
    if (cached) return cached;

    // Search for existing task blocks in the current tab
    const existingBlocks = await searchBlocks(
      { type: "task", tabId: context.currentTabId, limit: 5 },
      blockOpts
    );

    // If taskBlockName is provided, do fuzzy matching within current tab
    if (args.taskBlockName && existingBlocks.data && existingBlocks.data.length > 0) {
      const blockName = (args.taskBlockName as string).toLowerCase();
      const exact = existingBlocks.data.find(
        (b) => (b.content as Record<string, unknown>)?.title?.toString().toLowerCase() === blockName
      );
      if (exact) {
        taskBlockIdByTabCache.set(context.currentTabId, exact.id);
        return exact.id;
      }
      const fuzzy = existingBlocks.data.find((b) =>
        (b.content as Record<string, unknown>)?.title?.toString().toLowerCase().includes(blockName)
      );
      if (fuzzy) {
        taskBlockIdByTabCache.set(context.currentTabId, fuzzy.id);
        return fuzzy.id;
      }
    }

    // Return first task block in current tab (no name specified)
    if (existingBlocks.data && existingBlocks.data.length > 0) {
      const id = existingBlocks.data[0].id;
      taskBlockIdByTabCache.set(context.currentTabId, id);
      return id;
    }

    // Create a new task block in the current tab if none exists
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

  // PRIORITY 2: Current project (when no specific tab, but project context exists)
  if (context?.currentProjectId) {
    const projectBlocks = await searchBlocks(
      { type: "task", projectId: context.currentProjectId, limit: 10 },
      blockOpts
    );

    // If taskBlockName is provided, do fuzzy matching within current project
    if (args.taskBlockName && projectBlocks.data && projectBlocks.data.length > 0) {
      const blockName = (args.taskBlockName as string).toLowerCase();
      const exact = projectBlocks.data.find(
        (b) => (b.content as Record<string, unknown>)?.title?.toString().toLowerCase() === blockName
      );
      if (exact) return exact.id;
      const fuzzy = projectBlocks.data.find((b) =>
        (b.content as Record<string, unknown>)?.title?.toString().toLowerCase().includes(blockName)
      );
      if (fuzzy) return fuzzy.id;
    }

    // Return first task block in current project
    if (projectBlocks.data && projectBlocks.data.length > 0) {
      return projectBlocks.data[0].id;
    }
  }

  // PRIORITY 3: Workspace-wide fallback (only when no project context)
  // This should rarely be reached in normal usage
  const anyBlock = await searchBlocks({ type: "task", limit: 1 }, blockOpts);
  if (anyBlock.data && anyBlock.data.length > 0) return anyBlock.data[0].id;

  return null;
}

/**
 * Infer proper field types from column data patterns
 * Detects: priority, status, select, date, number, email, url, phone
 */
function normalizeOptionId(value: string): string {
  return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Convert color names to hex codes that match the UI's color palette
 */
function colorNameToHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    gray: "#6b7280",
    blue: "#3b82f6",
    green: "#10b981",
    yellow: "#f59e0b",
    red: "#ef4444",
    purple: "#8b5cf6",
    pink: "#ec4899",
    orange: "#f97316",
  };
  return colorMap[colorName] || colorMap.gray;
}

function inferFieldTypeFromData(
  fieldName: string,
  fieldType: string | undefined,
  values: unknown[],
  existingConfig?: Record<string, unknown>
): { type: string; config?: Record<string, unknown> } {
  const normalizedName = fieldName.toLowerCase().trim();
  const normalizedType = fieldType ? String(fieldType).toLowerCase().trim() : undefined;
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNullValues.length === 0) {
    return { type: normalizedType || "text", config: existingConfig };
  }

  // If already has config that passed validation, preserve it
  // (If config exists but didn't pass hasUsableFieldConfig, it needs fixing)
  if (existingConfig && hasUsableFieldConfig(normalizedType, existingConfig)) {
    return { type: normalizedType || "text", config: existingConfig };
  }

  // If config exists but is invalid (e.g., AI provided options without proper IDs),
  // we need to fix it by extracting labels and regenerating with proper IDs
  if (existingConfig && (normalizedType === "select" || normalizedType === "multi_select")) {
    const existingOptions = (existingConfig as any)?.options;
    if (Array.isArray(existingOptions) && existingOptions.length > 0) {
      const options: Array<{ id: string; label: string; color: string; order: number }> = [];
      const colors = ["gray", "blue", "green", "yellow", "red", "purple", "pink", "orange"];

      existingOptions.forEach((opt: any, index: number) => {
        const label = opt.label || opt.name || String(opt);
        const colorName = colors[index % colors.length];
        options.push({
          id: generateOptionId(),
          label: String(label).trim(),
          color: colorNameToHex(colorName),
          order: index
        });
      });

      return { type: normalizedType, config: { options } };
    }
  }

  if (normalizedType === "priority") {
    return { type: "priority" };
  }
  if (normalizedType === "status") {
    return { type: "status" };
  }

  // Respect explicit non-text, non-select-like types
  if (
    normalizedType &&
    normalizedType !== "text" &&
    !["priority", "status", "select", "multi_select"].includes(normalizedType)
  ) {
    return { type: normalizedType, config: existingConfig };
  }

  // If type is specified but no config, infer config from data
  // This handles cases where AI specifies type but not config

  // Priority/status field configs are server-owned canonical configs.

  // If fieldType is "select" but no config, generate from data
  if (normalizedType === "select" || normalizedType === "multi_select") {
    const uniqueValues = new Map<string, string>();
    nonNullValues.forEach((v) => {
      const raw = String(v).trim();
      if (!raw) return;
      const normalized = normalizeOptionId(raw);
      if (!uniqueValues.has(normalized)) uniqueValues.set(normalized, raw);
    });
    const options: Array<{ id: string; label: string; color: string; order: number }> = [];
    const colors = ["gray", "blue", "green", "yellow", "red", "purple", "pink", "orange"];

    Array.from(uniqueValues.entries()).forEach(([_, raw], index) => {
      const colorName = colors[index % colors.length];
      const hexColor = colorNameToHex(colorName);
      options.push({
        id: generateOptionId(),
        label: raw,
        color: hexColor,
        order: index
      });
    });

    return { type: normalizedType ?? "select", config: { options } };
  }

  // Priority detection (by field name)
  if (normalizedName.includes("priority") || normalizedName === "pri") {
    const uniqueValues = Array.from(new Set(nonNullValues.map((v) => normalizeOptionId(String(v)))));
    const priorityPatterns = ["high", "medium", "low", "urgent", "critical", "unspecified"];
    const isPriority = uniqueValues.every((v) => priorityPatterns.includes(v));

    if (isPriority) {
      return { type: "priority" };
    }
  }

  // Status detection (task/workflow status, not e.g. "State" as in US state)
  // Only match names that contain "status"; do NOT match "state" alone so "State" (e.g. US state) stays text.
  if (normalizedName.includes("status")) {
    const uniqueValues = Array.from(new Set(nonNullValues.map((v) => normalizeOptionId(String(v)))));
    const statusPatterns = ["todo", "to-do", "to do", "in-progress", "in progress", "done", "complete", "completed", "blocked", "cancelled", "unspecified"];
    const isStatus =
      uniqueValues.length >= 2 &&
      uniqueValues.length <= 10 &&
      uniqueValues.every((v) => statusPatterns.includes(v));

    if (isStatus) {
      return { type: "status" };
    }
  }

  // Select detection (categorical data with 2-20 unique values)
  const uniqueValues = Array.from(new Set(nonNullValues.map((v) => String(v).trim())));
  if (uniqueValues.length >= 2 && uniqueValues.length <= 20 && uniqueValues.length < nonNullValues.length * 0.8) {
    const options: Array<{ id: string; label: string; color: string; order: number }> = [];
    const colors = ["gray", "blue", "green", "yellow", "red", "purple", "pink", "orange"];

    uniqueValues.forEach((value, index) => {
      const colorName = colors[index % colors.length];
      options.push({
        id: generateOptionId(),
        label: value,
        color: colorNameToHex(colorName),
        order: index
      });
    });

    return { type: "select", config: { options } };
  }

  // Date detection
  if (normalizedName.includes("date") || normalizedName.includes("due") || normalizedName.includes("deadline")) {
    return { type: "date", config: { includeTime: false, format: "MMM d, yyyy" } };
  }

  // Number detection
  const allNumbers = nonNullValues.every((v) => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  });
  if (allNumbers) {
    return { type: "number", config: { format: "number" } };
  }

  // Email detection
  if (normalizedName.includes("email") || nonNullValues.some((v) => String(v).includes("@"))) {
    const allEmails = nonNullValues.every((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)));
    if (allEmails) {
      return { type: "email" };
    }
  }

  // URL detection
  if (normalizedName.includes("url") || normalizedName.includes("link") || normalizedName.includes("website")) {
    const allUrls = nonNullValues.every((v) => /^https?:\/\/.+/.test(String(v)));
    if (allUrls) {
      return { type: "url" };
    }
  }

  // Phone detection
  if (normalizedName.includes("phone") || normalizedName.includes("tel")) {
    return { type: "phone" };
  }

  // Default to text
  return { type: "text" };
}

/**
 * Enhance field definitions with inferred types based on row data
 */
function enhanceFieldsWithInference(
  fields: Array<Record<string, unknown>>,
  rows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  if (fields.length === 0 || rows.length === 0) {
    return fields;
  }

  // Extract values for each field from rows
  const fieldValues = new Map<string, unknown[]>();

  rows.forEach((row) => {
    const data = (row.data || {}) as Record<string, unknown>;
    Object.entries(data).forEach(([key, value]) => {
      if (!fieldValues.has(key)) {
        fieldValues.set(key, []);
      }
      fieldValues.get(key)?.push(value);
    });
  });

  // Enhance each field
  return fields.map((field) => {
    const fieldName = String(field.name || "");
    const fieldType = field.type as string | undefined;
    const values = fieldValues.get(fieldName) || [];

    // Skip if field already has usable config
    if (hasUsableFieldConfig(fieldType, field.config as Record<string, unknown> | undefined)) {
      return field;
    }

    // Infer type and config
    const inferred = inferFieldTypeFromData(fieldName, fieldType, values);

    return {
      ...field,
      type: inferred.type,
      ...(inferred.config ? { config: inferred.config } : {}),
    };
  });
}

function hasUsableFieldConfig(
  fieldType: string | undefined,
  config?: Record<string, unknown>
): boolean {
  if (!config) return false;
  const normalizedType = fieldType ? String(fieldType).toLowerCase().trim() : undefined;
  if (normalizedType === "priority") {
    const levels = (config as any)?.levels;
    if (!Array.isArray(levels) || levels.length === 0) return false;
    // Priority levels need stable ids + labels and hex colors.
    return levels.every((level: any) =>
      level.id &&
      typeof level.id === "string" &&
      level.label &&
      typeof level.label === "string" &&
      level.color &&
      typeof level.color === "string" &&
      level.color.startsWith("#")
    );
  }
  if (normalizedType === "status" || normalizedType === "select" || normalizedType === "multi_select") {
    const options = (config as any)?.options;
    if (!Array.isArray(options) || options.length === 0) return false;
    // Select-like options need stable ids + labels and hex colors.
    return options.every((opt: any) =>
      opt.id &&
      typeof opt.id === "string" &&
      opt.label &&
      typeof opt.label === "string" &&
      opt.color &&
      typeof opt.color === "string" &&
      opt.color.startsWith("#")
    );
  }
  return Object.keys(config).length > 0;
}

function normalizeRowsForSelectFields(
  fields: Array<Record<string, unknown>>,
  rows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  if (fields.length === 0 || rows.length === 0) return rows;

  const fieldByName = new Map(
    fields.map((field) => [normalizeFieldName(field.name as string), field])
  );

  return rows.map((row) => {
    const data = (row as { data?: Record<string, unknown> }).data;
    if (!data || typeof data !== "object") return row;

    let changed = false;
    const nextData: Record<string, unknown> = { ...data };

    for (const [key, rawValue] of Object.entries(data)) {
      const field = fieldByName.get(normalizeFieldName(key));
      if (!field) continue;
      const fieldType = String(field.type ?? "");

      // Normalize checkbox/subtask to boolean
      if ((fieldType === "checkbox" || fieldType === "subtask") && (typeof rawValue === "string" || typeof rawValue === "number")) {
        const boolVal = typeof rawValue === "number" ? rawValue === 1 : ["true", "yes", "y", "1", "checked", "x"].includes(String(rawValue).toLowerCase().trim());
        if (nextData[key] !== boolVal) {
          nextData[key] = boolVal;
          changed = true;
        }
        continue;
      }

      if (!isSelectLike(fieldType)) continue;

      // Status/Priority are universal properties with fixed canonical values.
      // Normalize incoming labels/synonyms to canonical string values.
      if (fieldType === "status" || fieldType === "priority") {
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          if (nextData[key] !== null) {
            nextData[key] = null;
            changed = true;
          }
          continue;
        }
        const canonical = normalizeUniversalPropertyValue(fieldType, rawValue);
        if (canonical && nextData[key] !== canonical) {
          nextData[key] = canonical;
          changed = true;
        }
        continue;
      }

      const config = field.config as Record<string, unknown> | undefined;
      if (!config) continue;

      const { options } = getOptionEntries({ type: fieldType, config });
      if (!options.length) continue;

      const optionById = new Map(options.map((opt) => [normalizeOptionId(opt.id), opt.label]));
      const optionByLabel = new Map(options.map((opt) => [normalizeOptionId(opt.label), opt.label]));

      const mapValue = (value: unknown): unknown => {
        if (value && typeof value === "object") {
          const asObj = value as Record<string, unknown>;
          const id = typeof asObj.id === "string" ? asObj.id : undefined;
          if (id) return id;
        }
        const raw = String(value ?? "").trim();
        if (!raw) return value;
        const normalized = normalizeOptionId(raw);
        return optionById.get(normalized) ?? optionByLabel.get(normalized) ?? value;
      };

      if (fieldType === "multi_select" && Array.isArray(rawValue)) {
        const mapped = rawValue.map(mapValue);
        const differs = mapped.some((value, index) => value !== rawValue[index]);
        if (differs) {
          nextData[key] = mapped;
          changed = true;
        }
        continue;
      }

      const mapped = mapValue(rawValue);
      if (mapped !== rawValue) {
        nextData[key] = mapped;
        changed = true;
      }
    }

    return changed ? { ...row, data: nextData } : row;
  });
}

function pruneEmptySourceColumns(
  fields: Array<Record<string, unknown>>,
  rows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  if (fields.length === 0 || rows.length === 0) return fields;

  const isEmptyValue = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  const keep: Array<Record<string, unknown>> = [];
  for (const field of fields) {
    const fieldName = String(field.name ?? "").trim();
    if (!fieldName) continue;

    const isPrimary = field.isPrimary === true || field.is_primary === true;
    if (isPrimary) {
      keep.push(field);
      continue;
    }

    let hasAnyValue = false;
    for (const row of rows) {
      const data = (row.data || {}) as Record<string, unknown>;
      if (!isEmptyValue(data[fieldName])) {
        hasAnyValue = true;
        break;
      }
    }

    if (hasAnyValue) {
      keep.push(field);
    }
  }

  if (keep.length === 0 && fields.length > 0) {
    keep.push(fields[0]);
  }

  return keep;
}

const DEFAULT_FIELD_NAMES = new Set(["column 2", "column 3"]);
const CONFIG_REQUIRED_TYPES = new Set(["formula", "rollup", "relation"]);
const PRIMARY_FIELD_ALIASES = new Set(["name", "title", "state", "state name", "state_name"]);

function normalizeFieldName(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeFieldDefinitionForUniversalProperties(
  field: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeUniversalPropertyFieldDefinition(field);
}

function sanitizeFieldDefinitionsForUniversalProperties(
  fields: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return fields.map((field) => sanitizeFieldDefinitionForUniversalProperties(field));
}

function isDefaultFieldName(value?: string | null): boolean {
  return DEFAULT_FIELD_NAMES.has(normalizeFieldName(value));
}

function applyDefaultFieldConfig(
  type: string,
  config?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (isUniversalPropertyFieldType(type)) {
    return undefined;
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

type SourceLinkedInsertRow = {
  data: Record<string, unknown>;
  order?: number | string | null;
  source_entity_type?: unknown;
  source_entity_id?: unknown;
  source_sync_mode?: unknown;
  [key: string]: unknown;
};

async function annotateRowsWithSourceMetadataForTable(params: {
  tableId: string;
  rows: Array<Record<string, unknown>>;
  authContext?: AuthContext;
  searchedEntities?: Array<{ id: string; title: string; entityType: "task" | "timeline_event" | "table_row" | "block" | "subtask" | "card" }>;
}): Promise<Array<Record<string, unknown>>> {
  if (!params.rows.length) return params.rows;
  const tableResult = await getTable(params.tableId, { authContext: params.authContext });
  if ("error" in tableResult) return params.rows;
  return annotateRowsWithSourceMetadata({
    rows: params.rows,
    workspaceId: tableResult.data.table.workspace_id,
    supabase: params.authContext?.supabase ?? await createSupabaseClient(),
    searchedEntities: params.searchedEntities,
  });
}

async function annotateRowsWithSourceMetadata(params: {
  rows: Array<Record<string, unknown>>;
  workspaceId: string;
  supabase: SupabaseClient;
  searchedEntities?: Array<{ id: string; title: string; entityType: "task" | "timeline_event" | "table_row" | "block" | "subtask" | "card" }>;
}): Promise<Array<Record<string, unknown>>> {
  const normalizedRows = params.rows.map((row) => normalizeSourceMetadataOnRow(row as SourceLinkedInsertRow));
  const candidateIds = new Set<string>();

  // Count how many rows the LLM already provided source metadata on
  const llmProvidedCount = normalizedRows.filter((row) =>
    hasValidRowSourceMetadata(row.source_entity_type, row.source_entity_id)
  ).length;

  normalizedRows.forEach((row) => {
    if (typeof row.source_entity_id === "string") {
      candidateIds.add(row.source_entity_id);
      return;
    }
    const candidate = extractSourceCandidateIdFromRow(row);
    if (candidate) candidateIds.add(candidate.id);
  });

  // Also add all searched entity IDs as candidates for validation
  if (params.searchedEntities) {
    for (const entity of params.searchedEntities) {
      candidateIds.add(entity.id);
    }
  }

  aiDebug("sourceTracking:annotateStart", {
    totalRows: normalizedRows.length,
    llmProvidedSourceMetadata: llmProvidedCount,
    candidateIdsFound: candidateIds.size,
    searchedEntitiesAvailable: params.searchedEntities?.length ?? 0,
  });

  if (candidateIds.size === 0) {
    aiDebug("sourceTracking:annotateResult", {
      totalRows: normalizedRows.length,
      llmProvided: llmProvidedCount,
      deterministicKeyMatch: 0,
      deterministicTitleMatch: 0,
      unmatched: normalizedRows.length - llmProvidedCount,
    });
    return normalizedRows;
  }

  const ids = Array.from(candidateIds);
  const [taskResult, timelineResult, tableRowResult, blockResult, subtaskResult, cardResult] = await Promise.all([
    params.supabase
      .from("task_items")
      .select("id")
      .eq("workspace_id", params.workspaceId)
      .in("id", ids),
    params.supabase
      .from("timeline_events")
      .select("id")
      .eq("workspace_id", params.workspaceId)
      .in("id", ids),
    params.supabase
      .from("table_rows")
      .select("id, tables!inner(workspace_id)")
      .eq("tables.workspace_id", params.workspaceId)
      .in("id", ids),
    params.supabase
      .from("blocks")
      .select("id, tabs!inner(projects!inner(workspace_id))")
      .eq("tabs.projects.workspace_id", params.workspaceId)
      .in("id", ids),
    params.supabase
      .from("task_subtasks")
      .select("id, task_items!inner(workspace_id)")
      .eq("task_items.workspace_id", params.workspaceId)
      .in("id", ids),
    params.supabase
      .from("cards")
      .select("id")
      .eq("workspace_id", params.workspaceId)
      .in("id", ids),
  ]);

  const taskIds = new Set(
    ((taskResult.data || []) as Array<{ id: string }>).map((item) => item.id)
  );
  const timelineIds = new Set(
    ((timelineResult.data || []) as Array<{ id: string }>).map((item) => item.id)
  );
  const tableRowIds = new Set(
    ((tableRowResult.data || []) as Array<{ id: string }>).map((item) => item.id)
  );
  const blockIds = new Set(
    ((blockResult.data || []) as Array<{ id: string }>).map((item) => item.id)
  );
  const subtaskIds = new Set(
    ((subtaskResult.data || []) as Array<{ id: string }>).map((item) => item.id)
  );
  const cardIds = new Set(
    ((cardResult.data || []) as Array<{ id: string }>).map((item) => item.id)
  );

  // Build a title-to-entity map for title matching (case-insensitive)
  const titleToEntity = new Map<string, { id: string; entityType: "task" | "timeline_event" | "table_row" | "block" | "subtask" | "card" }>();
  if (params.searchedEntities) {
    for (const entity of params.searchedEntities) {
      // Only include entities that are validated (exist in DB)
      if (taskIds.has(entity.id) || timelineIds.has(entity.id) || tableRowIds.has(entity.id) || blockIds.has(entity.id) || subtaskIds.has(entity.id) || cardIds.has(entity.id)) {
        titleToEntity.set(entity.title.toLowerCase(), { id: entity.id, entityType: entity.entityType });
      }
    }
  }

  // Check how many of the LLM-provided source metadata entries are actually valid
  const llmValidated = normalizedRows.filter((row) => {
    if (!hasValidRowSourceMetadata(row.source_entity_type, row.source_entity_id)) return false;
    const id = row.source_entity_id as string;
    return taskIds.has(id) || timelineIds.has(id) || tableRowIds.has(id) || blockIds.has(id) || subtaskIds.has(id) || cardIds.has(id);
  });
  const llmInvalid = llmProvidedCount - llmValidated.length;

  aiDebug("sourceTracking:dbValidation", {
    validTaskIds: taskIds.size,
    validTimelineIds: timelineIds.size,
    validTableRowIds: tableRowIds.size,
    validBlockIds: blockIds.size,
    validSubtaskIds: subtaskIds.size,
    validCardIds: cardIds.size,
    titleMapEntries: titleToEntity.size,
  });
  aiDebug("sourceTracking:llmAnnotation", {
    llmProvided: llmProvidedCount,
    llmValid: llmValidated.length,
    llmInvalid,
  });

  let keyMatchCount = 0;
  let titleMatchCount = 0;

  const result = normalizedRows.map((row) => {
    if (hasValidRowSourceMetadata(row.source_entity_type, row.source_entity_id)) {
      return row;
    }

    // Pass 1: Key-name and UUID candidate extraction
    const candidate = extractSourceCandidateIdFromRow(row);
    if (candidate) {
      const inferredType = inferSourceEntityTypeForCandidate(candidate, taskIds, timelineIds, tableRowIds, blockIds, subtaskIds, cardIds);
      if (inferredType) {
        keyMatchCount++;
        aiDebug("sourceTracking:deterministicMatch", {
          method: "key/uuid",
          entityId: candidate.id,
          entityType: inferredType,
        });
        return {
          ...row,
          source_entity_type: inferredType,
          source_entity_id: candidate.id,
          source_sync_mode: "live",
        };
      }
    }

    // Pass 2: Title matching against searched entities
    if (titleToEntity.size > 0) {
      const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
      for (const value of Object.values(data)) {
        if (typeof value === "string" && value.length > 0) {
          const matched = titleToEntity.get(value.toLowerCase());
          if (matched) {
            titleMatchCount++;
            aiDebug("sourceTracking:deterministicMatch", {
              method: "title",
              matchedTitle: value,
              entityId: matched.id,
              entityType: matched.entityType,
            });
            return {
              ...row,
              source_entity_type: matched.entityType,
              source_entity_id: matched.id,
              source_sync_mode: "live",
            };
          }
        }
      }
    }

    return row;
  });

  aiDebug("sourceTracking:annotateResult", {
    totalRows: normalizedRows.length,
    llmProvided: llmProvidedCount,
    deterministicKeyMatch: keyMatchCount,
    deterministicTitleMatch: titleMatchCount,
    unmatched: normalizedRows.length - llmProvidedCount - keyMatchCount - titleMatchCount,
  });

  return result;
}

async function syncPriorityStatusToEntityProperties(
  tableId: string,
  rowIds: string[],
  authContext?: AuthContext
): Promise<void> {
  if (!tableId || rowIds.length === 0) return;

  const tableResult = await getTable(tableId, { authContext });
  if ("error" in tableResult || !tableResult.data?.table) return;

  const workspaceId = tableResult.data.table.workspace_id as string | undefined;
  const fields = tableResult.data.fields || [];
  const relevantFields = fields.filter(
    (field) => field.type === "priority" || field.type === "status"
  );

  if (!workspaceId || relevantFields.length === 0) return;

  const supabase = authContext?.supabase ?? await createSupabaseClient();
  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, data")
    .eq("table_id", tableId)
    .in("id", rowIds);

  if (!rows || rows.length === 0) return;

  const rowsById = new Map(rows.map((row) => [row.id, row]));

  for (const rowId of rowIds) {
    const row = rowsById.get(rowId);
    if (!row || !row.data) continue;

    for (const field of relevantFields) {
      const fieldValue = (row.data as Record<string, unknown>)[field.id];
      if (fieldValue === null || fieldValue === undefined || fieldValue === "") continue;

      await supabase
        .from("entity_properties")
        .upsert(
          {
            entity_type: "table_row",
            entity_id: rowId,
            field_type: field.type,
            field_name: field.name,
            value: fieldValue,
            workspace_id: workspaceId,
          },
          { onConflict: "entity_type,entity_id,field_name" }
        );
    }
  }
}

function normalizeSourceMetadataOnRow(row: SourceLinkedInsertRow): SourceLinkedInsertRow {
  const sourceEntityType = normalizeSourceEntityType(row.source_entity_type);
  const sourceEntityId = normalizeSourceEntityId(row.source_entity_id);
  if (!sourceEntityType || !sourceEntityId) {
    return {
      ...row,
      source_entity_type: undefined,
      source_entity_id: undefined,
      source_sync_mode: undefined,
    };
  }
  return {
    ...row,
    source_entity_type: sourceEntityType,
    source_entity_id: sourceEntityId,
    source_sync_mode: normalizeSourceSyncMode(row.source_sync_mode),
  };
}

function hasValidRowSourceMetadata(sourceType: unknown, sourceId: unknown): boolean {
  return Boolean(normalizeSourceEntityType(sourceType) && normalizeSourceEntityId(sourceId));
}

function normalizeSourceEntityType(value: unknown): "task" | "timeline_event" | "table_row" | "block" | "subtask" | null {
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return normalizeSourceEntityType(
      source.source_entity_type ?? source.sourceEntityType ?? source.entity_type ?? source.entityType ?? null
    );
  }
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "task" || normalized === "task_item" || normalized === "taskitem") return "task";
  if (normalized === "timeline_event" || normalized === "timelineevent" || normalized === "event") return "timeline_event";
  if (normalized === "table_row" || normalized === "tablerow" || normalized === "row") return "table_row";
  if (normalized === "block" || normalized === "blocks") return "block";
  if (normalized === "subtask" || normalized === "subtasks") return "subtask";
  return null;
}

function normalizeSourceEntityId(value: unknown): string | null {
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return normalizeSourceEntityId(
      source.source_entity_id ?? source.sourceEntityId ?? source.entity_id ?? source.entityId ?? source.id ?? null
    );
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return isUuid(normalized) ? normalized : null;
}

function normalizeSourceSyncMode(value: unknown): "snapshot" | "live" {
  if (typeof value === "string" && value.trim().toLowerCase() === "snapshot") return "snapshot";
  return "live";
}

function extractSourceMetadataFromArgs(args: Record<string, unknown>): {
  sourceEntityType?: "task" | "timeline_event" | "table_row" | "block" | "subtask";
  sourceEntityId?: string;
  sourceSyncMode: "snapshot" | "live";
} {
  const sourceObject =
    args._source && typeof args._source === "object"
      ? (args._source as Record<string, unknown>)
      : {};

  const sourceTypeRaw =
    args.source_entity_type ??
    args.sourceEntityType ??
    sourceObject.source_entity_type ??
    sourceObject.sourceEntityType ??
    sourceObject.entity_type ??
    sourceObject.entityType;
  const sourceIdRaw =
    args.source_entity_id ??
    args.sourceEntityId ??
    sourceObject.source_entity_id ??
    sourceObject.sourceEntityId ??
    sourceObject.entity_id ??
    sourceObject.entityId ??
    sourceObject.id;
  const sourceModeRaw =
    args.source_sync_mode ??
    args.sourceSyncMode ??
    sourceObject.source_sync_mode ??
    sourceObject.sourceSyncMode ??
    sourceObject.sync_mode ??
    sourceObject.syncMode;

  const sourceEntityType = normalizeSourceEntityType(sourceTypeRaw) ?? undefined;
  const sourceEntityId = normalizeSourceEntityId(sourceIdRaw) ?? undefined;
  const sourceSyncMode = normalizeSourceSyncMode(sourceModeRaw);

  return {
    sourceEntityType,
    sourceEntityId,
    sourceSyncMode,
  };
}

function extractSourceCandidateIdFromRow(
  row: SourceLinkedInsertRow
): { id: string; hintedType?: "task" | "timeline_event" | "table_row" | "block" | "subtask" } | null {
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const normalizedEntries = Object.entries(data).map(([key, value]) => [normalizeSourceKey(key), value] as const);
  const normalizedMap = new Map(normalizedEntries);

  const candidateKeys: Array<{ keys: string[]; hintedType?: "task" | "timeline_event" | "table_row" | "block" | "subtask" }> = [
    { keys: ["task_id", "taskid"], hintedType: "task" },
    { keys: ["timeline_event_id", "timelineeventid", "event_id", "eventid"], hintedType: "timeline_event" },
    { keys: ["table_row_id", "tablerowid", "row_id", "rowid"], hintedType: "table_row" },
    { keys: ["block_id", "blockid"], hintedType: "block" },
    { keys: ["subtask_id", "subtaskid"], hintedType: "subtask" },
    { keys: ["source_id", "entity_id", "id"] },
  ];

  for (const entry of candidateKeys) {
    for (const key of entry.keys) {
      const value = normalizedMap.get(key);
      const id = normalizeSourceEntityId(value);
      if (id) return { id, hintedType: entry.hintedType };
    }
  }

  // Fallback: scan all values for UUIDs (will be validated against task_items/timeline_events in batch query)
  for (const value of Object.values(data)) {
    const id = normalizeSourceEntityId(value);
    if (id) return { id };
  }

  return null;
}

function normalizeSourceKey(value: string): string {
  return normalizeFieldKey(value).replace(/[^a-z0-9]+/g, "_");
}

function inferSourceEntityTypeForCandidate(
  candidate: { id: string; hintedType?: "task" | "timeline_event" | "table_row" | "block" | "subtask" | "card" },
  taskIds: Set<string>,
  timelineIds: Set<string>,
  tableRowIds: Set<string> = new Set(),
  blockIds: Set<string> = new Set(),
  subtaskIds: Set<string> = new Set(),
  cardIds: Set<string> = new Set()
): "task" | "timeline_event" | "table_row" | "block" | "subtask" | "card" | null {
  if (candidate.hintedType === "block" && blockIds.has(candidate.id)) return "block";
  if (candidate.hintedType === "task" && taskIds.has(candidate.id)) return "task";
  if (candidate.hintedType === "timeline_event" && timelineIds.has(candidate.id)) return "timeline_event";
  if (candidate.hintedType === "table_row" && tableRowIds.has(candidate.id)) return "table_row";
  if (candidate.hintedType === "subtask" && subtaskIds.has(candidate.id)) return "subtask";
  if (candidate.hintedType === "card" && cardIds.has(candidate.id)) return "card";

  const inTasks = taskIds.has(candidate.id);
  const inTimeline = timelineIds.has(candidate.id);
  const inTableRows = tableRowIds.has(candidate.id);
  const inBlocks = blockIds.has(candidate.id);
  const inSubtasks = subtaskIds.has(candidate.id);
  const inCards = cardIds.has(candidate.id);
  if (inBlocks && !inTasks && !inTimeline && !inTableRows && !inSubtasks && !inCards) return "block";
  if (inTasks && !inTimeline && !inTableRows && !inBlocks && !inSubtasks && !inCards) return "task";
  if (!inTasks && inTimeline && !inTableRows && !inBlocks && !inSubtasks && !inCards) return "timeline_event";
  if (!inTasks && !inTimeline && inTableRows && !inBlocks && !inSubtasks && !inCards) return "table_row";
  if (!inTasks && !inTimeline && !inTableRows && !inBlocks && inSubtasks && !inCards) return "subtask";
  if (!inTasks && !inTimeline && !inTableRows && !inBlocks && !inSubtasks && inCards) return "card";
  return null;
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
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveSelectValues(
  field: { type: string; config: Record<string, unknown> },
  rawValue: unknown,
  allowCreate: boolean
): { values: string[]; updatedConfig?: Record<string, unknown>; missing: boolean } {
  if (rawValue === null || rawValue === undefined) {
    return { values: [], missing: false };
  }

  if (isUniversalPropertyFieldType(field.type)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    const normalized = values
      .map((value) => normalizeUniversalPropertyValue(field.type, value))
      .filter((value) => Boolean(value)) as string[];
    if (normalized.length === 0) return { values: [], missing: true };
    return { values: normalized, missing: false };
  }

  // All select-like fields: use field config options
  const { kind, options } = getOptionEntries(field);
  if (!kind) {
    return { values: [], missing: true };
  }

  const inputValues = Array.isArray(rawValue) ? rawValue : [rawValue];
  const normalizedByLabel = new Map(options.map((opt) => [normalizeFieldKey(opt.label), opt]));
  const normalizedById = new Map(options.map((opt) => [normalizeFieldKey(opt.id), opt]));

  const resolvedValues: string[] = [];
  const newOptions: Array<{ id: string; label: string; color?: string; order?: number }> = [...options];
  let added = false;

  for (const value of inputValues) {
    let raw = "";
    if (value && typeof value === "object") {
      const asObj = value as Record<string, unknown>;
      if (typeof asObj.label === "string") raw = asObj.label;
      else if (typeof asObj.id === "string") raw = asObj.id;
    } else {
      raw = String(value ?? "");
    }

    const normalized = normalizeFieldKey(raw);
    const existing = normalizedByLabel.get(normalized) ?? normalizedById.get(normalized);
    if (existing) {
      resolvedValues.push(existing.label);
      continue;
    }

    if (!allowCreate) {
      return { values: [], missing: true };
    }

    const next = {
      id: generateOptionId(),
      label: String(raw ?? "").trim() || "Option",
      color: "#6b7280",
      order: newOptions.length + 1,
    };
    newOptions.push(next);
    normalizedByLabel.set(normalizeFieldKey(next.label), next);
    normalizedById.set(normalizeFieldKey(next.id), next);
    resolvedValues.push(next.label);
    added = true;
  }

  if (added) {
    if (kind === "levels") {
      return { values: resolvedValues, updatedConfig: { ...field.config, levels: newOptions }, missing: false };
    }
    return { values: resolvedValues, updatedConfig: { ...field.config, options: newOptions }, missing: false };
  }

  return { values: resolvedValues, missing: false };
}

function resolveUpdateValue(
  field: { id: string; type: string; config: Record<string, unknown> },
  rawValue: unknown,
  allowCreateOptions: boolean
): { value: unknown; updatedConfig?: Record<string, unknown> } {
  if (isUniversalPropertyFieldType(field.type)) {
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return { value: null };
    }
    const canonical = normalizeUniversalPropertyValue(field.type, rawValue);
    return { value: canonical };
  }

  if (isSelectLike(field.type)) {
    if (rawValue === null || rawValue === undefined) {
      return { value: null };
    }
    const resolved = resolveSelectValues(field, rawValue, allowCreateOptions);
    if (resolved.missing) {
      return { value: null };
    }
    const value = field.type === "multi_select" ? resolved.values : resolved.values[0] ?? null;
    return { value, updatedConfig: resolved.updatedConfig };
  }

  if ((field.type === "checkbox" || field.type === "subtask") && (typeof rawValue === "string" || typeof rawValue === "number")) {
    if (typeof rawValue === "number") return { value: rawValue === 1 };
    const normalized = String(rawValue).toLowerCase().trim();
    if (["true", "yes", "y", "1", "checked", "x"].includes(normalized)) return { value: true };
    if (["false", "no", "n", "0", "unchecked"].includes(normalized)) return { value: false };
  }

  return { value: rawValue };
}

async function enhanceFieldsAndNormalizeSelectValues(
  tableId: string,
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>
): Promise<Array<{ data: Record<string, unknown>; order?: number | string | null }>> {
  if (!tableId || rows.length === 0) return rows;

  const tableResult = await getTable(tableId);
  if ("error" in tableResult || !tableResult.data?.fields) return rows;

  const fields = tableResult.data.fields;

  // Extract all values for each field from the rows
  const fieldValues = new Map<string, unknown[]>();
  rows.forEach((row) => {
    const data = row.data || {};
    Object.entries(data).forEach(([fieldId, value]) => {
      if (!fieldValues.has(fieldId)) {
        fieldValues.set(fieldId, []);
      }
      fieldValues.get(fieldId)?.push(value);
    });
  });

  // Enhance select fields that have no options configured
  const fieldsToUpdate: Array<{ fieldId: string; config: Record<string, unknown> }> = [];

  for (const field of fields) {
    if (!isSelectLike(field.type)) continue;
    if (isUniversalPropertyFieldType(field.type)) continue;

    const config = (field.config || {}) as Record<string, unknown>;
    const { options } = getOptionEntries({ type: field.type, config });

    // If field has no options, infer them from the data
    if (options.length === 0) {
      const values = fieldValues.get(field.id) || [];
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== "");

      if (nonNullValues.length > 0) {
        const inferred = inferFieldTypeFromData(field.name, field.type, nonNullValues, config);
        if (inferred.config && Object.keys(inferred.config).length > 0) {
          fieldsToUpdate.push({ fieldId: field.id, config: inferred.config });
        }
      }
    }
  }

  // Update field configs with inferred options
  for (const { fieldId, config } of fieldsToUpdate) {
    await updateField(fieldId, { config });
  }

  // Re-fetch fields to get updated configs
  const updatedTableResult = fieldsToUpdate.length > 0 ? await getTable(tableId) : tableResult;
  if ("error" in updatedTableResult || !updatedTableResult.data?.fields) return rows;

  const updatedFields = updatedTableResult.data.fields;
  const fieldsById = new Map(updatedFields.map((f) => [f.id, f]));

  // Now normalize select-like row values to canonical labels
  return rows.map((row) => {
    const data = row.data || {};
    const normalized: Record<string, unknown> = {};

    for (const [fieldId, rawValue] of Object.entries(data)) {
      const field = fieldsById.get(fieldId);
      if (!field) {
        normalized[fieldId] = rawValue;
        continue;
      }

      if (isUniversalPropertyFieldType(field.type)) {
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          normalized[fieldId] = null;
        } else {
          const canonical = normalizeUniversalPropertyValue(field.type, rawValue);
          normalized[fieldId] = canonical ?? null;
        }
        continue;
      }

      if (!isSelectLike(field.type)) {
        normalized[fieldId] = rawValue;
        continue;
      }

      // Field is a select-like field - normalize the value to canonical label
      const config = (field.config || {}) as Record<string, unknown>;
      const { values, missing } = resolveSelectValues(
        { type: field.type, config },
        rawValue,
        false
      );

      if (values.length > 0) {
        normalized[fieldId] = field.type === "multi_select" ? values : values[0];
      } else {
        // Drop invalid select-like values to avoid persisting unknown labels.
        normalized[fieldId] = missing ? null : rawValue;
      }
    }

    return { ...row, data: normalized };
  });
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
      const values = resolved.values.map((value) => String(value).toLowerCase());

      if (Array.isArray(actualValue)) {
        if (!actualValue.some((v) => values.includes(String(v).toLowerCase()))) return false;
      } else if (typeof actualValue === "string") {
        if (!values.includes(actualValue.toLowerCase())) return false;
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
