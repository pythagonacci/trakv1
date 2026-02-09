/**
 * Provider-Agnostic Tool Definitions for Prompt to Action AI
 *
 * This file defines all available tools (server actions) that the AI can call.
 * The format is provider-agnostic and can be converted to OpenAI, Anthropic, or Deepseek formats.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, ToolParameter>;
  requiredParams: string[];
}

export type ToolCategory =
  | "search"
  | "control"
  | "task"
  | "project"
  | "table"
  | "timeline"
  | "block"
  | "tab"
  | "doc"
  | "property"
  | "file"
  | "comment"
  | "client"
  | "workspace"
  | "payment"
  | "shopify";

// ============================================================================
// CONTROL TOOLS
// ============================================================================

const controlTools: ToolDefinition[] = [
  {
    name: "requestToolGroups",
    description:
      "Request additional tool groups when you realize you need capabilities not currently available. " +
      "Use this the moment you notice a missing tool (e.g., table updates). " +
      "Returns the requested groups so the executor can expand access and continue.",
    category: "control",
    parameters: {
      toolGroups: {
        type: "array",
        description:
          "List of tool groups needed. Allowed: task, project, table, timeline, block, tab, doc, file, client, property, comment, workspace.",
        items: { type: "string" },
      },
      reason: {
        type: "string",
        description: "Short reason why these tools are needed.",
      },
    },
    requiredParams: ["toolGroups"],
  },
];

// ============================================================================
// SEARCH TOOLS
// ============================================================================

const searchTools: ToolDefinition[] = [
  {
    name: "unstructuredSearchWorkspace",
    description:
      "SEMANTIC workspace search across blocks, docs, and files using embeddings (unstructured/RAG). " +
      "Use when the user asks to find information 'across the workspace/projects/tabs' or when keyword/structured filters aren't enough. " +
      "Returns top matching sources with the most relevant text chunks.",
    category: "search",
    parameters: {
      query: { type: "string", description: "The semantic query to search for" },
      limitParents: { type: "number", description: "Maximum number of source parents to return (default 10)" },
      limitChunks: { type: "number", description: "Maximum chunks per parent (default 5)" },
    },
    requiredParams: ["query"],
  },
  {
    name: "searchTasks",
    description: "SEARCH for task items (read-only). Use this when you need to FIND or VIEW tasks, not modify them. Filters: title, status, priority, assignee, tags, due date, project. Returns: Array of task objects with IDs, titles, and all properties. Use task IDs from results for subsequent update/delete operations.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search tasks by text (matches title)" },
      status: { type: "string", description: "Filter by status. Example: \"todo\" (use quoted strings in JSON)", enum: ["todo", "in-progress", "blocked", "done"] },
      priority: { type: "string", description: "Filter by priority. Example: \"high\" (use quoted strings in JSON)", enum: ["low", "medium", "high", "urgent"] },
      assigneeId: { type: "string", description: "Filter by assignee user ID" },
      assigneeName: { type: "string", description: "Filter by assignee name (partial match)" },
      tagId: { type: "string", description: "Filter by tag ID" },
      tagName: { type: "string", description: "Filter by tag name (partial match)" },
      projectId: { type: "string", description: "Filter by project ID" },
      tabId: { type: "string", description: "Filter by tab ID" },
      dueDate: {
        type: "object",
        description: "Filter by due date. Use eq for exact, gte for on or after, lte for on or before, isNull for no due date",
        properties: {
          eq: { type: "string", description: "Exact date (YYYY-MM-DD)" },
          gte: { type: "string", description: "On or after date (YYYY-MM-DD)" },
          lte: { type: "string", description: "On or before date (YYYY-MM-DD)" },
          isNull: { type: "boolean", description: "True to find tasks without due dates" },
        },
      },
      limit: { type: "number", description: "Maximum number of results (default 50)" },
    },
    requiredParams: [],
  },
  {
    name: "searchProjects",
    description: "SEARCH for projects (read-only). Use to FIND or VIEW projects. Filters: name, status (not_started/in_progress/complete), client, project type. Returns: Array of project objects with IDs and metadata. Extract project IDs for use in other operations.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by text (matches project name)" },
      status: { type: "string", description: "Filter by status", enum: ["not_started", "in_progress", "complete"] },
      projectType: { type: "string", description: "Filter by type", enum: ["project", "internal"] },
      clientId: { type: "string", description: "Filter by client ID" },
      dueDate: {
        type: "object",
        description: "Filter by due date",
        properties: {
          eq: { type: "string", description: "Exact date (YYYY-MM-DD)" },
          gte: { type: "string", description: "On or after date" },
          lte: { type: "string", description: "On or before date" },
          isNull: { type: "boolean", description: "True for projects without due dates" },
        },
      },
      limit: { type: "number", description: "Maximum number of results (default 50)" },
    },
    requiredParams: [],
  },
  {
    name: "searchTabs",
    description: "SEARCH for tabs within projects (read-only). Use to FIND tabs by name or project. Returns: Array of tab objects with IDs. Use tab IDs when creating blocks or other tab content.",
    category: "search",
    parameters: {
      searchText: {
        type: "string",
        description: "Search by tab name (partial match)"
      },
      projectId: {
        type: "string",
        description: "Filter by project ID"
      },
      isClientVisible: {
        type: "boolean",
        description: "Filter by client visibility"
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default 50)"
      }
    },
    requiredParams: []
  },
  {
    name: "searchClients",
    description: "SEARCH for clients (read-only). Use to FIND clients by name, email, or company. Returns: Array of client objects with IDs and contact information. Extract client IDs for project association.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by text (matches name, email, or company)" },
      email: { type: "string", description: "Search by email" },
      company: { type: "string", description: "Search by company name" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchWorkspaceMembers",
    description: "SEARCH for workspace members (read-only). ⚠️ DO NOT USE FOR TASK ASSIGNMENT. For assigning tasks, use createTaskItem(assignees=['Name']) directly - the server resolves names automatically and faster. Use this tool ONLY when you need to list members for the user to see.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by member name or email" },
      role: { type: "string", description: "Filter by role", enum: ["owner", "admin", "teammate"] },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchTables",
    description: "SEARCH for tables (read-only). Use to FIND tables by title or project. Returns: Array of table objects with IDs. Use table IDs for row operations or schema inspection.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by text (matches table title)" },
      projectId: { type: "string", description: "Filter by project ID" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchTableRows",
    description: "SEARCH for rows within a table (read-only). Use to FIND existing rows before updating. Returns: Array of row objects with row IDs and field data. Extract row IDs for update/delete operations.",
    category: "search",
    parameters: {
      tableId: { type: "string", description: "The table ID to search in" },
      searchText: { type: "string", description: "Search text to find in any field" },
      fieldFilters: {
        type: "object",
        description: "Field-specific filters as key-value pairs where key is field ID and value is the filter value",
      },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: ["tableId"],
  },
  {
    name: "searchTimelineEvents",
    description: "SEARCH for timeline/Gantt events (read-only). Use to FIND events by title, date range, status, or milestone. Returns: Array of event objects with IDs, dates, and properties.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by text (matches event title)" },
      projectId: { type: "string", description: "Filter by project ID" },
      projectName: { type: "string", description: "Filter by project name (partial match)" },
      assigneeId: { type: "string", description: "Filter by assignee ID" },
      assigneeName: { type: "string", description: "Filter by assignee name" },
      status: { type: "string", description: "Filter by status" },
      isMilestone: { type: "boolean", description: "Filter for milestones only" },
      startDate: {
        type: "object",
        description: "Filter by start date",
        properties: {
          gte: { type: "string", description: "On or after date" },
          lte: { type: "string", description: "On or before date" },
        },
      },
      endDate: {
        type: "object",
        description: "Filter by end date",
        properties: {
          gte: { type: "string", description: "On or after date" },
          lte: { type: "string", description: "On or before date" },
        },
      },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchBlocks",
    description: "SEARCH for content blocks (read-only). Use to FIND blocks by type (text/task/table/timeline/etc), project, or tab. Returns: Array of block objects with IDs and content. Use block IDs for updates.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by block content" },
      type: { type: "string", description: "Filter by block type", enum: ["text", "task", "table", "timeline", "image", "file", "video", "embed", "gallery", "section", "link", "pdf", "chart", "doc_reference"] },
      projectId: { type: "string", description: "Filter by project ID" },
      projectName: { type: "string", description: "Filter by project name (partial match)" },
      tabId: { type: "string", description: "Filter by tab ID" },
      isTemplate: { type: "boolean", description: "Filter for template blocks only" },
      assigneeId: { type: "string", description: "Filter by assignee ID (for task blocks)" },
      assigneeName: { type: "string", description: "Filter by assignee name (partial match)" },
      tagId: { type: "string", description: "Filter by tag ID" },
      tagName: { type: "string", description: "Filter by tag name (partial match)" },
      status: { type: "string", description: "Filter by status (via entity_properties)", enum: ["todo", "in_progress", "done", "blocked"] },
      priority: { type: "string", description: "Filter by priority (via entity_properties)", enum: ["low", "medium", "high", "urgent"] },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchDocs",
    description: "SEARCH for documents (read-only). Use to FIND docs by title or content. Returns: Array of document objects with IDs and metadata. Use doc IDs for content operations.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by document title" },
      contentSearch: { type: "string", description: "Search within document content" },
      searchBoth: { type: "boolean", description: "Search both title and content using searchText" },
      isArchived: { type: "boolean", description: "Include archived docs" },
      createdBy: { type: "string", description: "Filter by creator user ID" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchDocContent",
    description: "SEARCH within a specific document's content (read-only). Use to FIND text within one known document. Returns: Text snippets matching the search query.",
    category: "search",
    parameters: {
      docId: { type: "string", description: "The document ID to search within" },
      searchText: { type: "string", description: "Text to search for within the document" },
      snippetLength: { type: "number", description: "Length of text snippets to return (default 100)" },
    },
    requiredParams: ["docId", "searchText"],
  },
  {
    name: "searchFiles",
    description: "SEARCH for uploaded files (read-only). Use to FIND files by name, type, or project. Returns: Array of file objects with IDs, names, and URLs.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by text (matches file name)" },
      fileType: { type: "string", description: "Filter by file MIME type" },
      projectId: { type: "string", description: "Filter by project ID" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchTags",
    description: "SEARCH for task tags (read-only). Use to FIND existing tags by name. Returns: Array of tag objects with IDs and names. Use tag names for setTaskTags.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by tag name" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchAll",
    description: "SEARCH across ALL entity types at once (read-only). Use when you don't know which entity type to search or need to search multiple types. Returns: Object with results grouped by entity type. Good for exploratory searches.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search text" },
      projectId: { type: "string", description: "Optional: Filter results to specific project" },
      entityTypes: {
        type: "array",
        description: "Entity types to search",
        items: { type: "string" },
      },
      includeContent: { type: "boolean", description: "Include content in search (default false)" },
      limit: { type: "number", description: "Maximum results per entity type (default 10)" },
      offset: { type: "number", description: "Offset for pagination (default 0)" },
    },
    requiredParams: ["searchText"],
  },
  {
    name: "resolveEntityByName",
    description: "RESOLVE name → ID (read-only). Use when you have an entity name but need its ID. Example: User says 'Website project' - use this to get project ID. Returns: Array of matching entities with IDs. Useful for name-based lookups.",
    category: "search",
    parameters: {
      entityType: {
        type: "string",
        description: "Type of entity to resolve",
        enum: ["task", "project", "client", "member", "tab", "block", "doc", "table", "table_row", "timeline_event", "file", "payment", "tag"],
      },
      name: { type: "string", description: "Name to search for" },
      projectId: { type: "string", description: "Optional: Limit search to specific project" },
      limit: { type: "number", description: "Maximum number of results (default 5)" },
    },
    requiredParams: ["entityType", "name"],
  },
  {
    name: "getEntityById",
    description: "GET entity details by ID (read-only). Use when you have an ID and need full entity information. Returns: Complete entity object with all properties and metadata.",
    category: "search",
    parameters: {
      entityType: {
        type: "string",
        description: "Type of entity",
        enum: ["task", "project", "client", "member", "tab", "block", "doc", "table", "table_row", "timeline_event", "file", "payment", "tag"],
      },
      id: { type: "string", description: "The entity ID" },
    },
    requiredParams: ["entityType", "id"],
  },
  {
    name: "getEntityContext",
    description: "GET entity with full related data (read-only). Use when you need not just the entity, but its relationships. For tasks: returns assignees, tags, project. For blocks/events/rows: returns parent context. More comprehensive than getEntityById.",
    category: "search",
    parameters: {
      entityType: {
        type: "string",
        description: "Type of entity",
        enum: ["block", "task", "timeline_event", "table_row"],
      },
      id: { type: "string", description: "The entity ID" },
    },
    requiredParams: ["entityType", "id"],
  },
  {
    name: "getTableSchema",
    description:
      "Get the schema (fields) of a table.\n\n" +
      "When to use:\n" +
      "- Understanding table structure\n" +
      "- Getting field types and configurations\n" +
      "- Reading metadata\n\n" +
      "When NOT to use:\n" +
      "- Before updateTableRowsByFieldNames (it resolves names automatically)\n" +
      "- Before bulkInsertRows with field names (it resolves names automatically)\n\n" +
      "Tip: If you're updating rows and have field names/labels, use updateTableRowsByFieldNames directly instead of getTableSchema + bulkUpdateRows.",
    category: "search",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
    },
    requiredParams: ["tableId"],
  },
];

// ============================================================================
// TASK ACTION TOOLS
// ============================================================================

const taskActionTools: ToolDefinition[] = [
  {
    name: "createTaskItem",
    description:
      "CREATE a new task item. ⚠️ SMART TOOL: Do NOT search for assignee IDs or task block IDs. Just pass names directly.\n\n" +
      "Auto-Context: Tasks are ALWAYS created in the current project/tab context. When currentProjectId or currentTabId is set, the task will be created there automatically. NEVER specify taskBlockId or taskBlockName unless the user explicitly wants to target a different location.\n" +
      "Assignees: Pass NAMES (e.g. 'Amna') directly. The server resolves them instantly. Do NOT call searchWorkspaceMembers first.",
    category: "task",
    parameters: {
      taskBlockId: { type: "string", description: "Optional: task block ID. ONLY use if you need to override the current context and create in a different location." },
      taskBlockName: { type: "string", description: "Optional: Target Block Name (e.g. 'Sprint Board'). ONLY use if the user explicitly specifies a different task block. By default, tasks are created in the current tab/project." },
      title: { type: "string", description: "Task title" },
      assignees: { type: "array", description: "List of assignee NAMES (e.g. ['Amna', 'John']). Do NOT look up IDs. System resolves names automatically.", items: { type: "string" } },
      tags: { type: "array", description: "List of tag names.", items: { type: "string" } },
      status: { type: "string", description: "Task status", enum: ["todo", "in-progress", "blocked", "done"] },
      priority: { type: "string", description: "Task priority", enum: ["low", "medium", "high", "urgent"] },
      description: { type: "string", description: "Task description" },
      dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      dueTime: { type: "string", description: "Due time (HH:MM)" },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
    },
    requiredParams: ["title"],
  },
  {
    name: "updateTaskItem",
    description: "UPDATE an existing task's properties including assignees and tags. ⚠️ SUPER TOOL: Use this when updating multiple properties on the same task (e.g., 'change title, assignees, and tags'). For single-property edits, atomic tools may be faster.\n\n" +
      "Auto-Context: You can provide 'lookupName' instead of 'taskId' to find and update a task by its title in one step.\n" +
      "Assignees: Pass NAMES (e.g. ['Amna']) directly. The server resolves them instantly. Do NOT call searchWorkspaceMembers first.\n" +
      "Returns: Updated task object.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID to update (optional if lookupName provided)" },
      lookupName: { type: "string", description: "Find task by title to update (use this if you don't have the ID yet)" },
      title: { type: "string", description: "New title" },
      status: { type: "string", description: "New status", enum: ["todo", "in-progress", "blocked", "done"] },
      priority: { type: "string", description: "New priority", enum: ["low", "medium", "high", "urgent"] },
      description: { type: "string", description: "New description (set to null to clear)" },
      dueDate: { type: "string", description: "New due date (YYYY-MM-DD, or null to clear)" },
      dueTime: { type: "string", description: "New due time (HH:MM)" },
      startDate: { type: "string", description: "New start date" },
      assignees: { type: "array", description: "List of assignee NAMES (e.g. ['Amna', 'John']). REPLACES all current assignees. Empty array clears all. Undefined/omit to keep unchanged.", items: { type: "string" } },
      tags: { type: "array", description: "List of tag names. REPLACES all current tags. Empty array clears all. Undefined/omit to keep unchanged.", items: { type: "string" } },
    },
    requiredParams: [],
  },
  {
    name: "bulkUpdateTaskItems",
    description: "UPDATE multiple tasks with the same changes in ONE call. ⚠️ REQUIRED for 3+ tasks. Use when updating many tasks with the same status, priority, or other properties. Much more efficient than calling updateTaskItem multiple times. Required: taskIds array and updates object. Returns: updatedCount and skipped array.",
    category: "task",
    parameters: {
      taskIds: { type: "array", description: "Array of task IDs to update", items: { type: "string" } },
      updates: {
        type: "object",
        description: "Updates to apply to all tasks. Same format as updateTaskItem.",
        properties: {
          title: { type: "string", description: "New title" },
          status: { type: "string", description: "New status", enum: ["todo", "in-progress", "blocked", "done"] },
          priority: { type: "string", description: "New priority", enum: ["low", "medium", "high", "urgent"] },
          description: { type: "string", description: "New description (set to null to clear)" },
          dueDate: { type: "string", description: "New due date (YYYY-MM-DD, or null to clear)" },
          dueTime: { type: "string", description: "New due time (HH:MM)" },
          startDate: { type: "string", description: "New start date" },
        },
      },
    },
    requiredParams: ["taskIds", "updates"],
  },
  {
    name: "bulkMoveTaskItems",
    description:
      "MOVE multiple tasks to a single task block. Use to consolidate tasks into one block (e.g., all tasks in a tab into a single list). Requires taskIds array and targetBlockId (task block id). Updates task_block_id, tab_id, project_id, and order in the destination block.",
    category: "task",
    parameters: {
      taskIds: { type: "array", description: "Array of task IDs to move", items: { type: "string" } },
      targetBlockId: { type: "string", description: "The destination task block ID (block type 'task')" },
    },
    requiredParams: ["taskIds", "targetBlockId"],
  },
  {
    name: "duplicateTasksToBlock",
    description:
      "DUPLICATE tasks into another task block WITHOUT moving originals. Use to create a new task list/board while keeping the originals in place. Copies title, status, priority, description, dates, and optionally assignees/tags.\n\n" +
      "Inputs:\n" +
      "- taskIds: array of task IDs to duplicate (from searchTasks)\n" +
      "- targetBlockId: destination task block id\n" +
      "- includeAssignees/includeTags: optional booleans (default true)\n\n" +
      "Returns: createdCount, createdTaskIds, skipped.",
    category: "task",
    parameters: {
      taskIds: { type: "array", description: "Array of task IDs to duplicate", items: { type: "string" } },
      targetBlockId: { type: "string", description: "Destination task block ID (block type 'task')" },
      includeAssignees: { type: "boolean", description: "Copy assignees to duplicated tasks (default true)" },
      includeTags: { type: "boolean", description: "Copy tags to duplicated tasks (default true)" },
    },
    requiredParams: ["taskIds", "targetBlockId"],
  },
  {
    name: "createTaskBoardFromTasks",
    description:
      "CREATE a new TASK BOARD from existing tasks. This creates a NEW task block in a tab, duplicates the provided tasks into it (leaving originals untouched), and sets the block to board view.\n\n" +
      "Workflow: searchTasks → createTaskBoardFromTasks, OR pass assigneeId/assigneeName to auto-include ALL matching tasks.\n\n" +
      "Defaults: viewMode=board, boardGroupBy=status.",
    category: "task",
    parameters: {
      tabId: { type: "string", description: "Tab to create the task board in (defaults to current tab if omitted)" },
      title: { type: "string", description: "New task board title" },
      taskIds: { type: "array", description: "Task IDs to duplicate into the new board", items: { type: "string" } },
      assigneeId: { type: "string", description: "If provided, auto-include ALL tasks assigned to this user ID" },
      assigneeName: { type: "string", description: "If provided, auto-include ALL tasks assigned to this name" },
      sourceProjectId: { type: "string", description: "Optional project scope for source tasks" },
      sourceTabId: { type: "string", description: "Optional tab scope for source tasks" },
      limit: { type: "number", description: "Max tasks to include when using assignee filters (default 500)" },
      viewMode: { type: "string", enum: ["board", "list"], description: "Task block view mode (default board)" },
      boardGroupBy: {
        type: "string",
        enum: ["status", "priority", "assignee", "dueDate", "tags"],
        description: "Board grouping (default status)",
      },
      includeAssignees: { type: "boolean", description: "Copy assignees to duplicated tasks (default true)" },
      includeTags: { type: "boolean", description: "Copy tags to duplicated tasks (default true)" },
    },
    requiredParams: ["taskIds"],
  },
  {
    name: "deleteTaskItem",
    description: "DELETE a task permanently. Use to remove a task. Required: taskId. ⚠️ Cannot be undone. Returns: Success confirmation.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID to delete" },
    },
    requiredParams: ["taskId"],
  },
  {
    name: "bulkCreateTasks",
    description:
      "CREATE multiple tasks in ONE call. ⚠️ REQUIRED for 3+ tasks. Do NOT call createTaskItem multiple times.\n\n" +
      "Use for: Creating multiple tasks efficiently (6 tasks → ONE call, not 6)\n" +
      "Format: { tasks: [{ title, assignees?, status?, priority?, ... }] }\n\n" +
      "Auto-Context: All tasks are created in the current project/tab context. When currentProjectId or currentTabId is set, tasks will be created there automatically. NEVER specify taskBlockId or taskBlockName unless the user explicitly wants to target a different location.\n" +
      "Assignees: Pass NAMES directly (e.g. ['Amna']), server resolves automatically.\n\n" +
      "Returns: { createdCount, createdTasks: [{ id, title }], errors: [] }",
    category: "task",
    parameters: {
      taskBlockId: { type: "string", description: "Optional: target task block ID. ONLY use if you need to override the current context and create in a different location." },
      taskBlockName: { type: "string", description: "Optional: Target block name (e.g. 'Sprint Board'). ONLY use if the user explicitly specifies a different task block. By default, tasks are created in the current tab/project." },
      tasks: {
        type: "array",
        description: "Array of task objects to create. Each must have 'title' (required). Optional: assignees (array of names), tags, status, priority, description, dueDate, dueTime, startDate.",
        items: { type: "object" },
      },
    },
    requiredParams: ["tasks"],
  },
  {
    name: "setTaskAssignees",
    description:
      "SET/REPLACE task assignees. ⚠️ CRITICAL WORKFLOW: 1) Call searchWorkspaceMembers to get {user_id, name, email}. 2) Use user_id as 'id' and name as 'name'. 3) Call this with [{id: user_id, name: name}]. BOTH fields required for workspace members! For external assignees: [{name: 'External'}] only. Replaces ALL current assignees.\n\n" +
      "For many tasks, prefer bulkSetTaskAssignees to avoid one call per task.",
    category: "task",
    parameters: {
      taskId: {
        type: "string",
        description: "The task ID. Get this from searchTasks if you only have the task name."
      },
      assignees: {
        type: "array",
        description: "Array of assignee objects. For workspace members, each object requires BOTH 'id' (string, user UUID) AND 'name' (string, display name). Get both fields from searchWorkspaceMembers - it returns {user_id, name, email}. Extract user_id as 'id' and name as 'name'. For external assignees not in workspace, provide {name: 'External Name'} only. Example: [{id: 'uuid-from-search', name: 'John Doe'}]",
        items: { type: "object" },
      },
    },
    requiredParams: ["taskId", "assignees"],
  },
  {
    name: "bulkSetTaskAssignees",
    description:
      "SET/REPLACE assignees for MANY tasks in one call. Use when assigning the same assignee(s) to multiple tasks. Requires taskIds array and assignees array (same format as setTaskAssignees). Replaces ALL current assignees for each task.\n\n" +
      "Workflow: 1) searchTasks to get taskIds, 2) searchWorkspaceMembers to get {user_id, name}, 3) bulkSetTaskAssignees({ taskIds, assignees: [{id: user_id, name}] }).",
    category: "task",
    parameters: {
      taskIds: {
        type: "array",
        description: "Array of task IDs to update",
        items: { type: "string" },
      },
      assignees: {
        type: "array",
        description:
          "Array of assignee objects. For workspace members, each object requires BOTH 'id' (string, user UUID) AND 'name' (string, display name). Get both fields from searchWorkspaceMembers. Example: [{id: 'uuid-from-search', name: 'John Doe'}]",
        items: { type: "object" },
      },
    },
    requiredParams: ["taskIds", "assignees"],
  },
  {
    name: "setTaskTags",
    description: "Set tags for a TASK ONLY (NOT for table rows!). Tags are a task-specific feature. For table rows, use updateCell or bulkUpdateRows to update field values instead. Replaces all current tags. Creates new tags if they don't exist.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID (NOT a table row ID! Tasks and table rows are different entities)" },
      tagNames: { type: "array", description: "Array of tag names", items: { type: "string" } },
    },
    requiredParams: ["taskId", "tagNames"],
  },
  {
    name: "createTaskSubtask",
    description: "CREATE a subtask/checklist item within a task. Use to add checklist items to tasks. Required: taskId and title. Returns: New subtask object with ID.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The parent task ID" },
      title: { type: "string", description: "Subtask title" },
      completed: { type: "boolean", description: "Whether the subtask is completed" },
    },
    requiredParams: ["taskId", "title"],
  },
  {
    name: "updateTaskSubtask",
    description: "UPDATE a subtask's title or completion status. Use to modify existing subtasks. Required: subtaskId. Returns: Updated subtask object.",
    category: "task",
    parameters: {
      subtaskId: { type: "string", description: "The subtask ID" },
      title: { type: "string", description: "New title" },
      completed: { type: "boolean", description: "Whether the subtask is completed" },
    },
    requiredParams: ["subtaskId"],
  },
  {
    name: "deleteTaskSubtask",
    description: "DELETE a subtask. Use to remove a checklist item. Required: subtaskId. Returns: Success confirmation.",
    category: "task",
    parameters: {
      subtaskId: { type: "string", description: "The subtask ID to delete" },
    },
    requiredParams: ["subtaskId"],
  },
  {
    name: "createTaskComment",
    description: "ADD a comment to a task. Use to add discussion/notes to tasks. Required: taskId and text. Returns: New comment object.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID" },
      text: { type: "string", description: "Comment text" },
    },
    requiredParams: ["taskId", "text"],
  },
];

// ============================================================================
// PROJECT ACTION TOOLS
// ============================================================================

const projectActionTools: ToolDefinition[] = [
  {
    name: "createProject",
    description: "CREATE a new project. Use to add projects. Required: name. Optional: clientId (from searchClients), status (not_started/in_progress/complete), dueDate. Returns: Project object with projectId.",
    category: "project",
    parameters: {
      name: { type: "string", description: "Project name" },
      clientId: { type: "string", description: "Optional client ID. PREFER 'clientName' for natural language." },
      clientName: { type: "string", description: "Client Name (e.g. 'Acme Corp'). System resolves to ID automatically." },
      status: { type: "string", description: "Project status. MUST be exactly one of: 'not_started', 'in_progress', or 'complete' (NOT 'completed'!)", enum: ["not_started", "in_progress", "complete"] },
      dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      projectType: { type: "string", description: "Project type", enum: ["project", "internal"] },
    },
    requiredParams: ["name"],
  },
  {
    name: "updateProject",
    description: "UPDATE project properties (name, status, client, due date, type). ⚠️ SUPER TOOL: Use this when updating multiple properties on the same project. For single-property edits, atomic tools may be faster.\n\n" +
      "Client Resolution: Pass NAMES (e.g. 'Acme Corp') directly. The server resolves them instantly. Do NOT call searchClients first.",
    category: "project",
    parameters: {
      projectId: { type: "string", description: "The project ID to update" },
      name: { type: "string", description: "New name" },
      status: { type: "string", description: "New status. MUST be exactly one of: 'not_started', 'in_progress', or 'complete' (NOT 'completed' or 'active'!)", enum: ["not_started", "in_progress", "complete"] },
      clientId: { type: "string", description: "New client ID (null to remove). PREFER 'clientName' for natural language." },
      clientName: { type: "string", description: "Client Name (e.g. 'Acme Corp'). System resolves to ID automatically. Set to null to remove client." },
      dueDate: { type: "string", description: "New due date (YYYY-MM-DD, or null to clear)" },
      projectType: { type: "string", description: "New project type", enum: ["project", "internal"] },
    },
    requiredParams: ["projectId"],
  },
  {
    name: "deleteProject",
    description: "Delete a project permanently. Only admins and owners can do this.",
    category: "project",
    parameters: {
      projectId: { type: "string", description: "The project ID to delete" },
    },
    requiredParams: ["projectId"],
  },
];

// ============================================================================
// TAB ACTION TOOLS
// ============================================================================

const tabActionTools: ToolDefinition[] = [
  {
    name: "createTab",
    description: "Create a new tab in a project.",
    category: "tab",
    parameters: {
      projectId: { type: "string", description: "The project ID" },
      name: { type: "string", description: "Tab name" },
      parentTabId: { type: "string", description: "Optional parent tab ID for nested tabs" },
    },
    requiredParams: ["projectId", "name"],
  },
  {
    name: "updateTab",
    description: "Update a tab's name or parent.",
    category: "tab",
    parameters: {
      tabId: { type: "string", description: "The tab ID to update" },
      name: { type: "string", description: "New name" },
      parentTabId: { type: "string", description: "New parent tab ID (null to make top-level)" },
    },
    requiredParams: ["tabId"],
  },
  {
    name: "deleteTab",
    description: "Delete a tab and all its contents. Only admins and owners can do this.",
    category: "tab",
    parameters: {
      tabId: { type: "string", description: "The tab ID to delete" },
    },
    requiredParams: ["tabId"],
  },
];

// ============================================================================
// BLOCK ACTION TOOLS
// ============================================================================

const blockActionTools: ToolDefinition[] = [
  {
    name: "createChartBlock",
    description:
      "Create a chart block by generating React/Chart.js JSX and saving it to the blocks table. " +
      "Use ONLY when the user explicitly asks for a chart/graph/visualization, or after they confirm an implicit suggestion. " +
      "If the user asks a what-if scenario, set isSimulation=true and provide originalChartId plus a short simulationDescription.",
    category: "block",
    parameters: {
      tabId: { type: "string", description: "The tab ID to create the chart in. PREFER 'tabName' if target differs from current context." },
      tabName: { type: "string", description: "Target Tab Name (e.g. 'Overview'). System finds fuzzy match." },
      prompt: { type: "string", description: "The user's chart request (include any inline data or context needed)." },
      chartType: { type: "string", description: "Optional chart type hint.", enum: ["bar", "line", "pie", "doughnut"] },
      title: { type: "string", description: "Optional chart title override." },
      explicitData: { type: "object", description: "Optional structured data to chart (labels/datasets or any JSON context)." },
      isSimulation: { type: "boolean", description: "True if this is a what-if simulation (creates a new chart)." },
      originalChartId: { type: "string", description: "Original chart block ID for simulations." },
      simulationDescription: { type: "string", description: "Short description of the what-if change applied." },
    },
    requiredParams: ["prompt"],
  },
  {
    name: "createBlock",
    description:
      "Create a new block in a tab. Block type determines what content to provide.\n\n" +
      "Important:\n" +
      "- Tasks live inside a TASK BLOCK, not directly in a tab.\n" +
      "- If you need to create tasks in a tab and no task block exists, create one with type: \"task\" first, then use its id as taskBlockId for createTaskItem.",
    category: "block",
    parameters: {
      tabId: { type: "string", description: "The tab ID to create the block in. PREFER 'tabName' if target is different from current context." },
      tabName: { type: "string", description: "Target Tab Name (e.g. 'Overview'). System finds fuzzy match." },
      type: {
        type: "string",
        description: "Block type",
        enum: ["text", "task", "table", "timeline", "image", "file", "video", "embed", "gallery", "section", "link", "pdf", "chart", "doc_reference"],
      },
      content: { type: "object", description: "Block content (varies by type)" },
      position: { type: "number", description: "Row position (0-based)" },
      column: { type: "number", description: "Column (0, 1, or 2)" },
      parentBlockId: { type: "string", description: "Parent section block ID for nested blocks" },
    },
    requiredParams: ["type"],
  },
  {
    name: "updateBlock",
    description: "Update a block's content or position.",
    category: "block",
    parameters: {
      blockId: { type: "string", description: "The block ID to update" },
      content: { type: "object", description: "New content" },
      position: { type: "number", description: "New row position" },
      column: { type: "number", description: "New column" },
    },
    requiredParams: ["blockId"],
  },
  {
    name: "deleteBlock",
    description: "Delete a block permanently.",
    category: "block",
    parameters: {
      blockId: { type: "string", description: "The block ID to delete" },
    },
    requiredParams: ["blockId"],
  },
];

// ============================================================================
// TABLE ACTION TOOLS
// ============================================================================

const tableActionTools: ToolDefinition[] = [
  {
    name: "createTable",
    description: "⚠️ DEPRECATED - DO NOT USE THIS TOOL ⚠️\n\nUse createTableFull instead for ALL table creation.\n\nThis atomic tool exists only for backwards compatibility. Using this tool instead of createTableFull is INEFFICIENT and creates unnecessary latency (3+ API calls instead of 1).\n\n🚨 ALWAYS USE createTableFull FOR TABLE CREATION 🚨",
    category: "table",
    parameters: {
      workspaceId: { type: "string", description: "The workspace ID. Get from current context." },
      title: { type: "string", description: "Table name/title that appears in the UI. ALWAYS set this to the name the user requested, don't leave it as 'Untitled'." },
      description: { type: "string", description: "Optional table description" },
      projectId: { type: "string", description: "Project to create table in. Get from searchProjects if user specifies a project name." },
      tabId: { type: "string", description: "Optional tab ID. If provided, a table block will be created in this tab so the table is visible in the UI." },
    },
    requiredParams: ["workspaceId", "title"],
  },
  {
    name: "createField",
    description:
      "Create a new field (column) in a table.\n\n" +
      "⚠️  CRITICAL: Use the CORRECT field TYPE\n\n" +
      "Field Type Rules:\n" +
      "- Priority field (Critical/High/Medium/Low)? → type: \"priority\" (NOT \"select\" named \"Priority\")\n" +
      "- Status field (Not Started/In Progress/Complete)? → type: \"status\" (NOT \"select\" named \"Status\")\n" +
      "- Custom dropdown? → type: \"select\" (only for truly custom options)\n\n" +
      "WHY THIS MATTERS:\n" +
      "- Priority/status fields have special UI rendering (badges, colors, proper ordering)\n" +
      "- They use config.levels (priority) or config.options (status) with specific structure\n" +
      "- Select fields don't have the same visual treatment\n" +
      "- Using the wrong type BREAKS the UI\n\n" +
      "Canonical Values (IMPORTANT):\n" +
      "- Priority fields use: 'low', 'medium', 'high', 'urgent' (workspace-wide standard)\n" +
      "- Status fields use: 'todo', 'in_progress', 'done', 'blocked' (workspace-wide standard)\n" +
      "- These canonical values are consistent across ALL tables in the workspace\n" +
      "- When updating rows, ALWAYS use these exact values (e.g., 'high' not 'High', 'in_progress' not 'In Progress')",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      name: { type: "string", description: "Field name" },
      type: {
        type: "string",
        description: "Field type. Use 'priority' for priority fields, 'status' for status fields. Do NOT use 'select' and name it 'Priority' - use the actual 'priority' type.",
        enum: ["text", "long_text", "number", "select", "multi_select", "status", "priority", "date", "checkbox", "url", "email", "phone", "currency", "percent", "rating", "formula", "relation", "rollup", "files", "person", "created_time", "last_edited_time", "created_by", "last_edited_by"],
      },
      config: { type: "object", description: "Optional field configuration. For priority fields, config.levels should contain priority level definitions with id, label, color, and order. For status fields, config.options should contain status option definitions. If not provided, default values will be auto-generated." },
      isPrimary: { type: "boolean", description: "Whether this is the primary field" },
    },
    requiredParams: ["tableId", "name", "type"],
  },
  {
    name: "bulkCreateFields",
    description:
      "CREATE multiple fields (columns) in a table in ONE call. ⚠️ PREFERRED over calling createField multiple times.\n\n" +
      "Use when adding 2+ fields to the same table. All fields are created in parallel.\n\n" +
      "⚠️  CRITICAL: Use the CORRECT field TYPE for each field:\n" +
      "- Priority field → type: \"priority\" (NOT \"select\" named \"Priority\")\n" +
      "- Status field → type: \"status\" (NOT \"select\" named \"Status\")\n" +
      "- Custom dropdown → type: \"select\"\n\n" +
      "Example: fields: [{name: \"Name\", type: \"text\"}, {name: \"Region\", type: \"text\"}, {name: \"Population\", type: \"number\"}]",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      fields: {
        type: "array",
        description: "Array of field definitions. Each must have 'name' (string) and 'type' (string). Optional: 'config' (object) and 'isPrimary' (boolean).",
        items: { type: "object" },
      },
    },
    requiredParams: ["tableId", "fields"],
  },
  {
    name: "updateField",
    description: "UPDATE a table field/column's name or configuration. Use to rename columns or modify field config (like adding dropdown options). Required: fieldId. Returns: Updated field object.",
    category: "table",
    parameters: {
      fieldId: { type: "string", description: "The field ID" },
      name: { type: "string", description: "New name" },
      config: { type: "object", description: "New configuration" },
    },
    requiredParams: ["fieldId"],
  },
  {
    name: "deleteField",
    description: "DELETE a table field/column. ⚠️ Deletes ALL data in that column. Required: fieldId. Returns: Success confirmation.",
    category: "table",
    parameters: {
      fieldId: { type: "string", description: "The field ID to delete" },
    },
    requiredParams: ["fieldId"],
  },
  {
    name: "createRow",
    description: "CREATE ONE table row. Use for creating 1-2 rows ONLY. ⚠️ For 3+ rows, you MUST use bulkInsertRows (required, more efficient). Required: tableId. Optional: data (initial cell values). Returns: Row object with rowId.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID. PREFER 'tableName' for natural language." },
      tableName: { type: "string", description: "Target Table Name (e.g. 'Employees'). System finds fuzzy match." },
      data: { type: "object", description: "Optional: Row data as key-value pairs where key is field ID. Format: {fieldId1: 'value1', fieldId2: 'value2'}. Get field IDs from getTableSchema." },
    },
    requiredParams: [],
  },
  {
    name: "updateRow",
    description: "UPDATE multiple cells in one existing row. Use when you have rowId and need to update several fields. ⚠️ Use updateTableRowsByFieldNames if you don't have rowId. Required: rowId, data. Returns: Updated row object.",
    category: "table",
    parameters: {
      rowId: { type: "string", description: "The row ID" },
      data: { type: "object", description: "Updated data as key-value pairs" },
    },
    requiredParams: ["rowId"],
  },
  {
    name: "updateCell",
    description: "UPDATE ONE cell in ONE existing row. ⚠️ Row must exist. For select/status/priority fields, value must be option ID (not label) - get from getTableSchema. ⚠️ If populating table, use bulkInsertRows, NOT this. Use for: Editing individual cells in existing rows. Required: rowId, fieldId (both UUIDs), value.",
    category: "table",
    parameters: {
      rowId: { type: "string", description: "The row ID. Must be an existing row - get from searchTableRows or from the result of createRow/bulkInsertRows. If you don't have a rowId yet, the row doesn't exist - create it first." },
      fieldId: { type: "string", description: "The field ID (NOT field name). Get from getTableSchema." },
      value: { type: "string", description: "New value. For text/number/date fields: the actual value. For select/priority/status fields: the option ID from field config (not the label!)." },
    },
    requiredParams: ["rowId", "fieldId", "value"],
  },
  {
    name: "deleteRow",
    description: "DELETE one table row. ⚠️ Cannot be undone. Required: rowId. Returns: Success confirmation.",
    category: "table",
    parameters: {
      rowId: { type: "string", description: "The row ID to delete" },
    },
    requiredParams: ["rowId"],
  },
  {
    name: "deleteRows",
    description: "DELETE multiple table rows at once. ⚠️ Cannot be undone. Use for bulk deletions. Required: rowIds array. Returns: Deletion count.",
    category: "table",
    parameters: {
      rowIds: { type: "array", description: "Array of row IDs to delete", items: { type: "string" } },
    },
    requiredParams: ["rowIds"],
  },
  {
    name: "bulkInsertRows",
    description:
      "INSERT 3+ rows efficiently in ONE call. ⚠️ REQUIRED for 3+ rows. DO NOT call createRow multiple times.\n\n" +
      "Use for: Populating tables with data (50 states → ONE call, not 50)\n" +
      "Format: [{ data: { 'FieldName': 'value' } }, ...]\n" +
      "⚠️ Use field NAMES (not IDs) - system resolves automatically\n\n" +
      "⚠️ CANONICAL VALUES for Priority/Status fields:\n" +
      "- Priority: 'low', 'medium', 'high', 'urgent'\n" +
      "- Status: 'todo', 'in_progress', 'done', 'blocked'\n" +
      "- Use these canonical IDs or display labels ('Low', 'Medium', 'High', 'Urgent', etc.)\n\n" +
      "Example: [{ data: { 'Task': 'Fix bug', 'Priority': 'high', 'Status': 'todo' } }, { data: { 'Task': 'Write docs', 'Priority': 'medium', 'Status': 'in_progress' } }]\n\n" +
      "Returns: Array of created row objects with rowIds.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID. Get this from createTable or searchTables. PREFER 'tableName'." },
      tableName: { type: "string", description: "Target Table Name (e.g. 'Q1 Goals'). System finds fuzzy match." },
      rows: {
        type: "array",
        description: "REQUIRED. Array of row objects where each object has a 'data' property containing field names and values. MUST provide at least 3 rows. Use field names (e.g., 'State', 'Capital') not field IDs. Format: [{ data: { 'FieldName': 'value' } }, ...]",
        items: { type: "object" },
      },
    },
    requiredParams: ["rows"],
  },
  {
    name: "bulkUpdateRows",
    description:
      "⚠️  PREFER updateTableRowsByFieldNames INSTEAD\n\n" +
      "Update multiple table rows with the same field values. ONLY use this if you already have field IDs and option IDs as UUIDs.\n\n" +
      "IMPORTANT: The updates parameter must be an object with field IDs as keys (NOT field names). For select/multi_select/status/priority field types, values must be option IDs (NOT labels).\n\n" +
      "If you only have field names and option labels (e.g., 'Priority' = 'High'), use updateTableRowsByFieldNames instead - it's much easier and handles the resolution automatically.\n\n" +
      "This tool requires:\n" +
      "- Field IDs (UUIDs) as keys\n" +
      "- Option IDs (UUIDs) as values for select-like fields\n" +
      "- Row IDs (UUIDs) to update",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      rowIds: { type: "array", description: "Array of row IDs (UUIDs) to update", items: { type: "string" } },
      updates: { type: "object", description: "Field updates as { [fieldId]: value }. Keys must be field IDs (UUIDs), not field names. For select/priority/status fields, values must be option IDs from field config, not labels." },
    },
    requiredParams: ["tableId", "rowIds", "updates"],
  },
  {
    name: "updateTableRowsByFieldNames",
    description:
      "★ PRIMARY TOOL FOR TABLE UPDATES ★ UPDATE rows using field names and values (NOT IDs).\n\n" +
      "Auto-resolves:\n" +
      "✓ Field names → field IDs\n" +
      "✓ Option labels/values → canonical option IDs\n" +
      "✓ Filters rows + updates them in ONE call\n\n" +
      "⚠️ CANONICAL VALUES for Priority/Status:\n" +
      "- Priority: 'low', 'medium', 'high', 'urgent' (or labels: 'Low', 'Medium', 'High', 'Urgent')\n" +
      "- Status: 'todo', 'in_progress', 'done', 'blocked' (or labels: 'To Do', 'In Progress', 'Done', 'Blocked')\n" +
      "- Both canonical IDs and display labels are accepted and automatically resolved\n\n" +
      "Example: Mark all Republican states as High priority:\n" +
      "{ tableId: 'xxx', filters: { 'Party': 'Republican' }, updates: { 'Priority': 'high' } }\n" +
      "{ tableId: 'xxx', filters: { 'Party': 'Republican' }, updates: { 'Priority': 'High' } } // Both work!\n\n" +
      "To update ALL rows, omit filters or pass an empty object: { tableId, updates }.\n\n" +
      "⚠️ USE THIS instead of getTableSchema + bulkUpdateRows.\n" +
      "Returns: Updated row count and IDs.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      filters: {
        type: "object",
        description:
          "Row filters as { FieldName: value }. Values can be a single value, an array of values, or { op, value }.",
      },
      updates: {
        type: "object",
        description:
          "Field updates as { FieldName: value }. For select/status/priority, you can use labels (e.g., 'High', 'Complete') and they will be resolved to option IDs automatically.",
      },
      limit: { type: "number", description: "Max rows to scan when matching filters (default 500)" },
    },
    requiredParams: ["tableId", "updates"],
  },
  {
    name: "bulkUpdateRowsByFieldNames",
    description:
      "BATCH UPDATE rows using field names and labels (NOT IDs) when different rows need different values.\n\n" +
      "Provide an array of row updates with their own filters and updates.\n" +
      "This is ideal when you need to set different values per row (e.g., Country of Origin for each company).\n\n" +
      "Example:\n" +
      "{ tableId: 'xxx', rows: [\n" +
      "  { filters: { 'Company': 'Apple' }, updates: { 'Country of Origin': 'United States' } },\n" +
      "  { filters: { 'Company': 'TSMC' }, updates: { 'Country of Origin': 'Taiwan' } }\n" +
      "] }\n\n" +
      "Returns: total updated count and row IDs.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      rows: {
        type: "array",
        description:
          "Array of row update entries. Each entry: { filters?: { FieldName: value }, updates: { FieldName: value } }",
        items: { type: "object" },
      },
      limit: { type: "number", description: "Max rows to scan when matching filters (default 500)" },
    },
    requiredParams: ["tableId", "rows"],
  },
  {
    name: "createTableFull",
    description:
      "🚨 PRIMARY TABLE CREATION TOOL - ALWAYS USE THIS FOR ANY TABLE CREATION 🚨\n\n" +
      "★ CREATE TABLE with schema + data in ONE call ★\n\n" +
      "THIS IS THE ONLY TOOL YOU SHOULD USE FOR TABLE CREATION. Do NOT use createTable.\n\n" +
      "Use this for:\n" +
      "- Creating a table with columns AND initial rows\n" +
      "- Creating a table with just columns (no rows)\n" +
      "- Creating a table with just a title (no columns or rows)\n" +
      "- ANY table creation scenario\n\n" +
      "Example: 'Create a table with columns Name, Email, Status and add 3 rows'\n" +
      "Example: 'Create a table called Q1 Targets'\n\n" +
      "⚠️ SUPER TOOL: This is 3-5x faster than createTable + bulkCreateFields + bulkInsertRows sequence.\n\n" +
      "Auto-creates table → creates fields → inserts rows in one atomic operation.",
    category: "table",
    parameters: {
      workspaceId: { type: "string", description: "The workspace ID. Get from current context." },
      title: { type: "string", description: "Table name/title" },
      description: { type: "string", description: "Optional table description" },
      projectId: { type: "string", description: "Project to create table in" },
      tabId: { type: "string", description: "Optional tab ID. If provided, a table block will be created in this tab." },
      fields: {
        type: "array",
        description: "Array of field definitions. Each must have 'name' (string) and 'type' (string). Optional: 'config' (object).",
        items: { type: "object" },
      },
      rows: {
        type: "array",
        description: "Array of row objects where each object has a 'data' property containing field names and values. Format: [{ data: { 'FieldName': 'value' } }, ...]",
        items: { type: "object" },
      },
    },
    requiredParams: ["workspaceId", "title"],
  },
  {
    name: "updateTableFull",
    description:
      "★ UPDATE TABLE (schema + rows) in ONE call ★ Use when modifying both table structure AND data.\n\n" +
      "Example: 'Add 2 columns, rename 1 column, and update 5 rows'\n\n" +
      "⚠️ SUPER TOOL: Prefer this over multiple updateField + updateTableRowsByFieldNames calls.\n\n" +
      "Schema Operations:\n" +
      "- addFields: Create new columns\n" +
      "- updateFields: Rename/reconfigure columns\n" +
      "- deleteFields: Remove columns\n\n" +
      "Row Operations:\n" +
      "- insertRows: Add new rows\n" +
      "- updateRows: Modify existing rows (uses filters + updates pattern)\n" +
      "- deleteRowIds: Remove rows by ID",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      tableName: { type: "string", description: "Target Table Name (e.g. 'Employees'). System finds fuzzy match if tableId not provided." },
      title: { type: "string", description: "New table title" },
      description: { type: "string", description: "New table description" },
      addFields: {
        type: "array",
        description: "Fields to create. Each: { name, type, config?, isPrimary? }",
        items: { type: "object" },
      },
      updateFields: {
        type: "array",
        description: "Fields to update. Each: { fieldId OR fieldName, name?, config? }",
        items: { type: "object" },
      },
      deleteFields: {
        type: "array",
        description: "Field IDs or names to delete",
        items: { type: "string" },
      },
      insertRows: {
        type: "array",
        description: "Rows to insert. Format: [{ data: { 'FieldName': 'value' } }, ...]",
        items: { type: "object" },
      },
      updateRows: {
        type: "object",
        description: "Row updates. Format: { filters: { 'FieldName': value }, updates: { 'FieldName': value } }",
      },
      deleteRowIds: {
        type: "array",
        description: "Row IDs to delete",
        items: { type: "string" },
      },
    },
    requiredParams: [],
  },
  {
    name: "deleteTable",
    description: "DELETE a table permanently. ⚠️ Cannot be undone. Use to remove entire tables. Required: tableId. Returns: Success confirmation.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID to delete" },
      tableName: { type: "string", description: "Target Table Name (e.g. 'Old Table'). System finds fuzzy match if tableId not provided." },
    },
    requiredParams: [],
  },
];

// ============================================================================
// TIMELINE ACTION TOOLS
// ============================================================================

const timelineActionTools: ToolDefinition[] = [
  {
    name: "createTimelineEvent",
    description: "CREATE a new event in a timeline block. ⚠️ SMART TOOL: Do NOT search for timeline block IDs. Just pass names directly.\n\n" +
      "Auto-Context: Defaults to current view. Provide 'timelineBlockName' (e.g. 'Project Timeline') to target specific blocks.\n" +
      "Assignees: Pass NAMES (e.g. 'Amna') directly. The server resolves them instantly. Do NOT call searchWorkspaceMembers first.",
    category: "timeline",
    parameters: {
      timelineBlockId: { type: "string", description: "Optional: timeline block ID. PREFER 'timelineBlockName' for natural language." },
      timelineBlockName: { type: "string", description: "Target Timeline Block Name (e.g. 'Project Timeline'). System finds fuzzy match." },
      title: { type: "string", description: "Event title" },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
      endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
      status: { type: "string", description: "Event status", enum: ["not_started", "in_progress", "complete", "on_hold", "cancelled"] },
      progress: { type: "number", description: "Progress percentage (0-100)" },
      notes: { type: "string", description: "Event notes" },
      color: { type: "string", description: "Event color (hex)" },
      isMilestone: { type: "boolean", description: "Whether this is a milestone" },
      assigneeId: { type: "string", description: "Assignee user ID. PREFER 'assigneeName'." },
      assigneeName: { type: "string", description: "Assignee Name (e.g. 'Amna'). System resolves to ID." },
    },
    requiredParams: ["title", "startDate", "endDate"],
  },
  {
    name: "updateTimelineEvent",
    description: "UPDATE a timeline event. ⚠️ SUPER TOOL: Use this when updating multiple properties on the same event (e.g., 'change dates, status, and assignee'). For single-property edits, atomic tools may be faster.\n\n" +
      "Assignees: Pass NAMES (e.g. 'Amna') directly. The server resolves them instantly. Do NOT call searchWorkspaceMembers first.",
    category: "timeline",
    parameters: {
      eventId: { type: "string", description: "The event ID" },
      title: { type: "string", description: "New title" },
      startDate: { type: "string", description: "New start date (YYYY-MM-DD)" },
      endDate: { type: "string", description: "New end date (YYYY-MM-DD)" },
      status: { type: "string", description: "New status", enum: ["not_started", "in_progress", "complete", "on_hold", "cancelled"] },
      progress: { type: "number", description: "New progress (0-100)" },
      notes: { type: "string", description: "New notes" },
      color: { type: "string", description: "New color (hex)" },
      isMilestone: { type: "boolean", description: "Whether this is a milestone" },
      assigneeId: { type: "string", description: "New assignee ID. PREFER 'assigneeName'." },
      assigneeName: { type: "string", description: "New assignee name (e.g. 'Amna'). System resolves to ID." },
    },
    requiredParams: ["eventId"],
  },
  {
    name: "deleteTimelineEvent",
    description: "Delete a timeline event.",
    category: "timeline",
    parameters: {
      eventId: { type: "string", description: "The event ID to delete" },
    },
    requiredParams: ["eventId"],
  },
  {
    name: "createTimelineDependency",
    description: "Create a dependency between two timeline events. Most common type is 'finish-to-start' which means the target event can only start after the source event finishes.",
    category: "timeline",
    parameters: {
      timelineBlockId: { type: "string", description: "Timeline block ID that owns the events" },
      fromEventId: { type: "string", description: "Source event ID (the event that must happen first)" },
      toEventId: { type: "string", description: "Target event ID (the event that depends on the source)" },
      dependencyType: { type: "string", description: "Type of dependency. Use 'finish-to-start' for standard dependencies.", enum: ["finish-to-start", "start-to-start", "finish-to-finish", "start-to-finish"] },
    },
    requiredParams: ["timelineBlockId", "fromEventId", "toEventId"],
  },
  {
    name: "deleteTimelineDependency",
    description: "Delete a timeline dependency.",
    category: "timeline",
    parameters: {
      dependencyId: { type: "string", description: "The dependency ID to delete" },
    },
    requiredParams: ["dependencyId"],
  },
];

// ============================================================================
// PROPERTY ACTION TOOLS
// ============================================================================

const propertyActionTools: ToolDefinition[] = [
  {
    name: "createPropertyDefinition",
    description: "Create a new property definition for the workspace. Properties can be used on tasks, blocks, timeline events, and table rows.",
    category: "property",
    parameters: {
      name: { type: "string", description: "Property name" },
      type: {
        type: "string",
        description: "Property type",
        enum: ["text", "number", "date", "select", "multi_select", "person", "checkbox", "url", "email"],
      },
      options: {
        type: "array",
        description: "For select/multi_select: array of option objects with id, label, and optional color",
        items: { type: "object" },
      },
    },
    requiredParams: ["name", "type"],
  },
  {
    name: "updatePropertyDefinition",
    description: "Update a property definition's name or options.",
    category: "property",
    parameters: {
      definitionId: { type: "string", description: "The property definition ID" },
      name: { type: "string", description: "New name" },
      options: { type: "array", description: "New options (for select types)", items: { type: "object" } },
    },
    requiredParams: ["definitionId"],
  },
  {
    name: "deletePropertyDefinition",
    description: "Delete a property definition. This removes the property from all entities.",
    category: "property",
    parameters: {
      definitionId: { type: "string", description: "The property definition ID to delete" },
    },
    requiredParams: ["definitionId"],
  },
  {
    name: "setEntityProperty",
    description: "Set a property value on an entity (task, block, timeline_event, table_row).",
    category: "property",
    parameters: {
      entityType: { type: "string", description: "Entity type", enum: ["task", "block", "timeline_event", "table_row"] },
      entityId: { type: "string", description: "The entity ID" },
      propertyDefinitionId: { type: "string", description: "The property definition ID" },
      value: { type: "object", description: "The value to set (format depends on property type)" },
    },
    requiredParams: ["entityType", "entityId", "propertyDefinitionId", "value"],
  },
  {
    name: "removeEntityProperty",
    description: "Remove a property from an entity.",
    category: "property",
    parameters: {
      entityType: { type: "string", description: "Entity type" },
      entityId: { type: "string", description: "The entity ID" },
      propertyDefinitionId: { type: "string", description: "The property definition ID to remove" },
    },
    requiredParams: ["entityType", "entityId", "propertyDefinitionId"],
  },
];

// ============================================================================
// CLIENT ACTION TOOLS
// ============================================================================

const clientActionTools: ToolDefinition[] = [
  {
    name: "createClient",
    description: "Create a new client in the workspace.",
    category: "client",
    parameters: {
      name: { type: "string", description: "Client name" },
      email: { type: "string", description: "Client email" },
      company: { type: "string", description: "Company name" },
      phone: { type: "string", description: "Phone number" },
      address: { type: "string", description: "Address" },
      website: { type: "string", description: "Website URL" },
      notes: { type: "string", description: "Notes about the client" },
    },
    requiredParams: ["name"],
  },
  {
    name: "updateClient",
    description: "Update a client's information.",
    category: "client",
    parameters: {
      clientId: { type: "string", description: "The client ID" },
      name: { type: "string", description: "New name" },
      email: { type: "string", description: "New email" },
      company: { type: "string", description: "New company" },
      phone: { type: "string", description: "New phone" },
      address: { type: "string", description: "New address" },
      website: { type: "string", description: "New website" },
      notes: { type: "string", description: "New notes" },
    },
    requiredParams: ["clientId"],
  },
  {
    name: "deleteClient",
    description: "Delete a client.",
    category: "client",
    parameters: {
      clientId: { type: "string", description: "The client ID to delete" },
    },
    requiredParams: ["clientId"],
  },
];

// ============================================================================
// DOC ACTION TOOLS
// ============================================================================

const docActionTools: ToolDefinition[] = [
  {
    name: "createDoc",
    description: "Create a new document in the workspace.",
    category: "doc",
    parameters: {
      title: { type: "string", description: "Document title" },
    },
    requiredParams: ["title"],
  },
  {
    name: "updateDoc",
    description: "Update a document's title or content.",
    category: "doc",
    parameters: {
      docId: { type: "string", description: "The document ID" },
      title: { type: "string", description: "New title" },
      content: { type: "object", description: "New content" },
    },
    requiredParams: ["docId"],
  },
  {
    name: "archiveDoc",
    description: "Archive a document.",
    category: "doc",
    parameters: {
      docId: { type: "string", description: "The document ID to archive" },
    },
    requiredParams: ["docId"],
  },
  {
    name: "deleteDoc",
    description: "Permanently delete a document.",
    category: "doc",
    parameters: {
      docId: { type: "string", description: "The document ID to delete" },
    },
    requiredParams: ["docId"],
  },
];

// ============================================================================
// FILE ACTION TOOLS
// ============================================================================

const fileActionTools: ToolDefinition[] = [
  {
    name: "fileAnalysisQuery",
    description:
      "Analyze one or more files (PDF/CSV/etc.) for a specific question. " +
      "This uses the existing file analysis artifacts (extracted text/tables) and RAG chunks when needed. " +
      "Returns relevant excerpts and table previews you can use to answer or to create blocks/tables.",
    category: "file",
    parameters: {
      fileIds: { type: "array", description: "Array of file IDs to analyze", items: { type: "string" } },
      query: { type: "string", description: "The question to answer using the file contents" },
      includeTables: { type: "boolean", description: "Whether to include extracted table previews (default true)" },
      maxTextChars: { type: "number", description: "Max characters of extracted text to return per file (default 8000)" },
      maxTableRows: { type: "number", description: "Max rows to return per extracted table (default 50)" },
    },
    requiredParams: ["fileIds", "query"],
  },
  {
    name: "renameFile",
    description:
      "Rename a file (display name only). Does not change storage path or contents. Required: fileId, fileName.",
    category: "file",
    parameters: {
      fileId: { type: "string", description: "The file ID to rename" },
      fileName: { type: "string", description: "New file name" },
    },
    requiredParams: ["fileId", "fileName"],
  },
];

// ============================================================================
// COMMENT ACTION TOOLS
// ============================================================================

const commentActionTools: ToolDefinition[] = [
  {
    name: "createComment",
    description: "Create a comment on a table row.",
    category: "comment",
    parameters: {
      rowId: { type: "string", description: "The table row ID" },
      text: { type: "string", description: "Comment text" },
    },
    requiredParams: ["rowId", "text"],
  },
  {
    name: "updateComment",
    description: "Update a comment's text.",
    category: "comment",
    parameters: {
      commentId: { type: "string", description: "The comment ID" },
      text: { type: "string", description: "New text" },
    },
    requiredParams: ["commentId", "text"],
  },
  {
    name: "deleteComment",
    description: "Delete a comment.",
    category: "comment",
    parameters: {
      commentId: { type: "string", description: "The comment ID to delete" },
    },
    requiredParams: ["commentId"],
  },
];

// ============================================================================
// WORKSPACE ACTION TOOLS
// ============================================================================

const workspaceActionTools: ToolDefinition[] = [
  {
    name: "reindexWorkspaceContent",
    description:
      "Re-index all searchable workspace content for embedding search (blocks, files, docs). " +
      "Use this if embeddings are missing or stale. Returns counts of enqueued items.",
    category: "workspace",
    parameters: {
      workspaceId: { type: "string", description: "Workspace ID to re-index (defaults to current workspace)." },
      includeBlocks: { type: "boolean", description: "Include blocks in re-indexing (default true)." },
      includeFiles: { type: "boolean", description: "Include files in re-indexing (default true)." },
      includeDocs: { type: "boolean", description: "Include docs in re-indexing (default true)." },
      maxItems: { type: "number", description: "Optional cap on total items enqueued (for safety)." },
    },
    requiredParams: [],
  },
];


// ============================================================================
// SHOPIFY TOOLS
// ============================================================================

const shopifyTools: ToolDefinition[] = [
  {
    name: "searchShopifyProducts",
    description:
      "SEARCH imported Shopify products (read-only). Use to FIND products by title, vendor, type, tags, or variant count.\\n\\n" +
      "Connection Resolution: Auto-selects the active connection if workspace has only one. If multiple, specify shopName or connectionId.\\n\\n" +
      "Example queries:\\n" +
      "- 'What products have 8 SKUs?' → use minVariants: 8, maxVariants: 8\\n" +
      "- 'Show products from vendor X' → use vendor filter\\n" +
      "- 'Find hoodies' → use searchText\\n\\n" +
      "Returns: Array of product objects with title, vendor, type, status, variants count, etc.",
    category: "shopify",
    parameters: {
      connectionId: { type: "string", description: "Optional Shopify connection ID. Auto-resolved if workspace has one active connection." },
      shopName: { type: "string", description: "Optional shop name to find connection (e.g., 'my-store.myshopify.com')" },
      searchText: { type: "string", description: "Search by product title (partial match)" },
      vendor: { type: "string", description: "Filter by vendor name" },
      productType: { type: "string", description: "Filter by product type" },
      tag: { type: "string", description: "Filter by tag (exact match)" },
      status: { type: "string", description: "Filter by product status", enum: ["active", "draft", "archived"] },
      minVariants: { type: "number", description: "Minimum number of variants/SKUs" },
      maxVariants: { type: "number", description: "Maximum number of variants/SKUs" },
      limit: { type: "number", description: "Maximum results (default 50)" },
      offset: { type: "number", description: "Offset for pagination (default 0)" },
    },
    requiredParams: [],
  },
  {
    name: "getShopifyProductDetails",
    description:
      "GET full Shopify product details with variants and inventory (read-only).\\n\\n" +
      "Returns: Complete product object including:\\n" +
      "- Product info (title, description, vendor, type, tags, status)\\n" +
      "- All variants (SKU, price, compare price, options, inventory)\\n" +
      "- Inventory levels by location\\n\\n" +
      "Use productId from searchShopifyProducts results.",
    category: "shopify",
    parameters: {
      productId: { type: "string", description: "Trak product ID (from searchShopifyProducts)" },
    },
    requiredParams: ["productId"],
  },
  {
    name: "getShopifyProductSales",
    description:
      "GET units sold for a Shopify product in a date range (read-only).\\n\\n" +
      "Returns: { unitsSold, computedAt, cached, warning? }\\n\\n" +
      "Notes:\\n" +
      "- Uses cache when available (refreshed hourly)\\n" +
      "- Queries Shopify orders API for fresh data\\n" +
      "- For ranges >90 days, computation is done in background\\n\\n" +
      "Example: 'How many units of [product] sold last month?'",
    category: "shopify",
    parameters: {
      productId: { type: "string", description: "Trak product ID (from searchShopifyProducts)" },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
      endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
    },
    requiredParams: ["productId", "startDate", "endDate"],
  },
  {
    name: "createProductsTable",
    description:
      "CREATE a table populated with Shopify product data.\\n\\n" +
      "Use when user asks to 'create a table with products' or 'show products in a table'.\\n\\n" +
      "Auto-generates columns: Title, Vendor, Type, Status, Price Range, Total Inventory, Variants Count.\\n" +
      "Optional: Specify productIds to include specific products, or use filters to auto-select.\\n\\n" +
      "Connection Resolution: Auto-selects if workspace has one active connection.",
    category: "shopify",
    parameters: {
      tabId: { type: "string", description: "Tab to create the table in. PREFER 'tabName'." },
      tabName: { type: "string", description: "Target Tab Name. System finds fuzzy match." },
      title: { type: "string", description: "Table title (default: 'Shopify Products')" },
      productIds: { type: "array", description: "Specific product IDs to include", items: { type: "string" } },
      connectionId: { type: "string", description: "Shopify connection ID (auto-resolved if one active)" },
      searchText: { type: "string", description: "Filter products by title" },
      vendor: { type: "string", description: "Filter products by vendor" },
      productType: { type: "string", description: "Filter products by type" },
      limit: { type: "number", description: "Max products (default 50)" },
    },
    requiredParams: [],
  },
  {
    name: "refreshShopifyProduct",
    description:
      "REFRESH a product's data from Shopify API.\\n\\n" +
      "Syncs latest: title, description, vendor, tags, status, variants, pricing, and inventory.\\n" +
      "Also invalidates sales cache for fresh recalculation.\\n\\n" +
      "Use when user asks to 'refresh', 'sync', or 'update' product data.",
    category: "shopify",
    parameters: {
      productId: { type: "string", description: "Trak product ID to refresh" },
    },
    requiredParams: ["productId"],
  },
];

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const allTools: ToolDefinition[] = [
  ...searchTools,
  ...controlTools,
  ...workspaceActionTools,
  ...taskActionTools,
  ...projectActionTools,
  ...tabActionTools,
  ...blockActionTools,
  ...tableActionTools,
  ...timelineActionTools,
  ...propertyActionTools,
  ...clientActionTools,
  ...docActionTools,
  ...fileActionTools,
  ...commentActionTools,
  ...shopifyTools,
];


export const toolsByCategory: Record<ToolCategory, ToolDefinition[]> = {
  search: searchTools,
  control: controlTools,
  task: taskActionTools,
  project: projectActionTools,
  tab: tabActionTools,
  block: blockActionTools,
  table: tableActionTools,
  timeline: timelineActionTools,
  property: propertyActionTools,
  client: clientActionTools,
  doc: docActionTools,
  file: fileActionTools,
  comment: commentActionTools,
  workspace: workspaceActionTools,
  payment: [],
  shopify: shopifyTools,
};

// Group tools by the primary entity they operate on.
export type EntityToolGroup =
  | "task"
  | "project"
  | "tab"
  | "block"
  | "table"
  | "timeline"
  | "doc"
  | "client"
  | "property"
  | "file"
  | "member"
  | "tag"
  | "cross_entity"
  | "workspace";

const toolLookup = new Map(allTools.map((tool) => [tool.name, tool]));

const pickTools = (names: string[]): ToolDefinition[] =>
  names.map((name) => toolLookup.get(name)).filter(Boolean) as ToolDefinition[];

export const toolsByEntityType: Record<EntityToolGroup, ToolDefinition[]> = {
  task: pickTools([
    "searchTasks",
    "createTaskItem",
    "bulkCreateTasks",
    "updateTaskItem",
    "bulkUpdateTaskItems",
    "deleteTaskItem",
    "bulkMoveTaskItems",
    "duplicateTasksToBlock",
    "createTaskBoardFromTasks",
    "setTaskAssignees",
    "bulkSetTaskAssignees",
    "setTaskTags",
    "createTaskSubtask",
    "updateTaskSubtask",
    "deleteTaskSubtask",
    "createTaskComment",
  ]),
  project: pickTools(["searchProjects", "createProject", "updateProject", "deleteProject"]),
  tab: pickTools(["searchTabs", "createTab", "updateTab", "deleteTab"]),
  block: pickTools(["searchBlocks", "createBlock", "updateBlock", "deleteBlock"]),
  table: pickTools([
    "searchTables",
    "searchTableRows",
    "getTableSchema",
    "createTable",
    "createField",
    "updateField",
    "deleteField",
    "createRow",
    "updateRow",
    "updateCell",
    "deleteRow",
    "deleteRows",
    "bulkInsertRows",
    "bulkUpdateRows",
    "updateTableRowsByFieldNames",
    "createComment",
    "updateComment",
    "deleteComment",
  ]),
  timeline: pickTools([
    "searchTimelineEvents",
    "createTimelineEvent",
    "updateTimelineEvent",
    "deleteTimelineEvent",
    "createTimelineDependency",
    "deleteTimelineDependency",
  ]),
  doc: pickTools(["searchDocs", "searchDocContent", "createDoc", "updateDoc", "archiveDoc", "deleteDoc"]),
  client: pickTools(["searchClients", "createClient", "updateClient", "deleteClient"]),
  property: pickTools([
    "createPropertyDefinition",
    "updatePropertyDefinition",
    "deletePropertyDefinition",
    "setEntityProperty",
    "removeEntityProperty",
  ]),
  file: pickTools(["searchFiles", "fileAnalysisQuery", "renameFile"]),
  member: pickTools(["searchWorkspaceMembers"]),
  tag: pickTools(["searchTags"]),
  cross_entity: pickTools(["searchAll", "resolveEntityByName", "getEntityById", "getEntityContext"]),
  workspace: pickTools(["reindexWorkspaceContent"]),
};

// ============================================================================
// CORE TOOLS - Always Included
// ============================================================================

/**
 * Core tools that are always included regardless of intent.
 * These are essential search and resolution tools needed for basic operations.
 */
export const coreTools: ToolDefinition[] = pickTools([
  // Cross-entity search and resolution
  "searchAll",
  "unstructuredSearchWorkspace",
  "resolveEntityByName",
  "getEntityById",
  "getEntityContext",
  "requestToolGroups",

  // Entity-specific searches (read-only, always useful)
  "searchTasks",
  "searchProjects",
  "searchTabs",
  "searchWorkspaceMembers",
  "searchClients",
  "searchTables",
  "searchBlocks",
  "searchDocs",
  "searchFiles",
  "searchTimelineEvents",
  "searchTableRows",
  "searchTags",

  // Table schema (read-only, needed for understanding table structure)
  "getTableSchema",

  // Workspace maintenance
  "reindexWorkspaceContent",
]);

// ============================================================================
// FORMAT CONVERTERS
// ============================================================================

/**
 * Convert tool definitions to OpenAI/Deepseek function format
 */
export function toOpenAIFormat(tools: ToolDefinition[]): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}> {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum && { enum: param.enum }),
              ...(param.items && { items: param.items }),
              ...(param.properties && { properties: param.properties }),
            },
          ])
        ),
        required: tool.requiredParams,
      },
    },
  }));
}

/**
 * Convert tool definitions to Anthropic tool format
 */
export function toAnthropicFormat(tools: ToolDefinition[]): Array<{
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, param]) => [
          key,
          {
            type: param.type,
            description: param.description,
            ...(param.enum && { enum: param.enum }),
            ...(param.items && { items: param.items }),
            ...(param.properties && { properties: param.properties }),
          },
        ])
      ),
      required: tool.requiredParams,
    },
  }));
}

/**
 * Get a tool definition by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((tool) => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return allTools.map((tool) => tool.name);
}

// ============================================================================
// SMART TOOL LOADING - Get tools by group
// ============================================================================

export type ToolGroup =
  | "core"
  | "task"
  | "project"
  | "table"
  | "timeline"
  | "block"
  | "tab"
  | "doc"
  | "file"
  | "client"
  | "property"
  | "comment"
  | "workspace"
  | "shopify";

/**
 * Get tools for specific groups.
 * Always includes core tools, plus any additional groups specified.
 */
export function getToolsByGroups(groups: ToolGroup[]): ToolDefinition[] {
  const toolSet = new Set<ToolDefinition>();

  // Always include core tools
  coreTools.forEach((tool) => toolSet.add(tool));

  // Add tools for each requested group
  for (const group of groups) {
    if (group === "core") {
      continue; // Already added
    }

    const groupTools = getToolsForGroup(group);
    groupTools.forEach((tool) => toolSet.add(tool));
  }

  return Array.from(toolSet);
}

/**
 * Get tools for a specific group (excluding core tools)
 */
function getToolsForGroup(group: ToolGroup): ToolDefinition[] {
  switch (group) {
    case "core":
      return coreTools;

    case "task":
      return taskActionTools;

    case "project":
      return projectActionTools;

    case "table":
      return tableActionTools;

    case "timeline":
      return timelineActionTools;

    case "block":
      return blockActionTools;

    case "tab":
      return tabActionTools;

    case "doc":
      return docActionTools;

    case "file":
      return fileActionTools;

    case "client":
      return clientActionTools;

    case "property":
      return propertyActionTools;

    case "comment":
      return commentActionTools;

    case "workspace":
      return workspaceActionTools;

    case "shopify":
      return shopifyTools;

    default:
      return [];
  }
}

/**
 * Get a summary of tool counts by group (for debugging)
 */
export function getToolCountsByGroup(): Record<ToolGroup | "total", number> {
  return {
    core: coreTools.length,
    task: taskActionTools.length,
    project: projectActionTools.length,
    table: tableActionTools.length,
    timeline: timelineActionTools.length,
    block: blockActionTools.length,
    tab: tabActionTools.length,
    doc: docActionTools.length,
    file: fileActionTools.length,
    client: clientActionTools.length,
    property: propertyActionTools.length,
    comment: commentActionTools.length,
    workspace: workspaceActionTools.length,
    shopify: shopifyTools.length,
    total: allTools.length,
  };
}
