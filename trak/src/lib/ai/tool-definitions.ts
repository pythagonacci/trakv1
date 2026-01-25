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
  | "payment";

// ============================================================================
// SEARCH TOOLS
// ============================================================================

const searchTools: ToolDefinition[] = [
  {
    name: "searchTasks",
    description: "Search for tasks in the workspace. Can filter by title, status, priority, assignee, tags, due date, project, and more. Use this to find tasks matching specific criteria.",
    category: "search",
    parameters: {
      title: { type: "string", description: "Search tasks by title (partial match)" },
      status: { type: "string", description: "Filter by status", enum: ["todo", "in-progress", "done"] },
      priority: { type: "string", description: "Filter by priority", enum: ["low", "medium", "high", "urgent"] },
      assigneeId: { type: "string", description: "Filter by assignee user ID" },
      assigneeName: { type: "string", description: "Filter by assignee name (partial match)" },
      tagNames: { type: "array", description: "Filter by tag names", items: { type: "string" } },
      projectId: { type: "string", description: "Filter by project ID" },
      projectName: { type: "string", description: "Filter by project name (partial match)" },
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
    description: "Search for projects in the workspace. Can filter by name, status, client, project type, and due date.",
    category: "search",
    parameters: {
      name: { type: "string", description: "Search by project name (partial match)" },
      status: { type: "string", description: "Filter by status", enum: ["active", "completed", "archived", "on-hold"] },
      projectType: { type: "string", description: "Filter by type", enum: ["project", "template"] },
      clientId: { type: "string", description: "Filter by client ID" },
      clientName: { type: "string", description: "Filter by client name (partial match)" },
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
    name: "searchClients",
    description: "Search for clients in the workspace by name, email, or company.",
    category: "search",
    parameters: {
      name: { type: "string", description: "Search by client name" },
      email: { type: "string", description: "Search by email" },
      company: { type: "string", description: "Search by company name" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchWorkspaceMembers",
    description: "Search for workspace members by name, email, or role. Returns member details including user_id, name, and email. Use this whenever you need complete user information for tools like setTaskAssignees.",
    category: "search",
    parameters: {
      searchText: { type: "string", description: "Search by member name or email" },
      name: { type: "string", description: "Search by member name" },
      email: { type: "string", description: "Search by email" },
      role: { type: "string", description: "Filter by role", enum: ["owner", "admin", "teammate"] },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchTables",
    description: "Search for tables in the workspace by title or project.",
    category: "search",
    parameters: {
      title: { type: "string", description: "Search by table title" },
      projectId: { type: "string", description: "Filter by project ID" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchTableRows",
    description: "Search for rows within a specific table. Can search across all fields or filter by specific field values.",
    category: "search",
    parameters: {
      tableId: { type: "string", description: "The table ID to search in" },
      query: { type: "string", description: "Search text to find in any field" },
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
    description: "Search for timeline events in the workspace. Can filter by title, date range, status, and more.",
    category: "search",
    parameters: {
      title: { type: "string", description: "Search by event title" },
      timelineBlockId: { type: "string", description: "Filter by timeline block" },
      projectId: { type: "string", description: "Filter by project" },
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
    description: "Search for blocks in the workspace. Can filter by type, project, tab, and content.",
    category: "search",
    parameters: {
      type: { type: "string", description: "Filter by block type", enum: ["text", "task", "table", "timeline", "image", "file", "video", "embed", "gallery", "section", "link", "pdf", "doc_reference"] },
      projectId: { type: "string", description: "Filter by project ID" },
      tabId: { type: "string", description: "Filter by tab ID" },
      isTemplate: { type: "boolean", description: "Filter for template blocks only" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchDocs",
    description: "Search for documents in the workspace by title.",
    category: "search",
    parameters: {
      title: { type: "string", description: "Search by document title" },
      isArchived: { type: "boolean", description: "Include archived docs" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchDocContent",
    description: "Search within document content for specific text.",
    category: "search",
    parameters: {
      query: { type: "string", description: "Text to search for within documents" },
      docId: { type: "string", description: "Optional: limit to a specific document" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: ["query"],
  },
  {
    name: "searchFiles",
    description: "Search for files uploaded to the workspace.",
    category: "search",
    parameters: {
      fileName: { type: "string", description: "Search by file name" },
      fileType: { type: "string", description: "Filter by file MIME type" },
      projectId: { type: "string", description: "Filter by project ID" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchPayments",
    description: "Search for payments in the workspace.",
    category: "search",
    parameters: {
      status: { type: "string", description: "Filter by status", enum: ["pending", "paid", "overdue", "cancelled"] },
      clientId: { type: "string", description: "Filter by client ID" },
      projectId: { type: "string", description: "Filter by project ID" },
      dueDate: {
        type: "object",
        description: "Filter by due date",
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
    name: "searchTags",
    description: "Search for task tags in the workspace.",
    category: "search",
    parameters: {
      name: { type: "string", description: "Search by tag name" },
      limit: { type: "number", description: "Maximum number of results" },
    },
    requiredParams: [],
  },
  {
    name: "searchAll",
    description: "Search across all entity types in the workspace. Good for broad searches when you don't know which entity type contains what you're looking for.",
    category: "search",
    parameters: {
      query: { type: "string", description: "Search text" },
      entityTypes: {
        type: "array",
        description: "Entity types to search",
        items: { type: "string" },
      },
      limit: { type: "number", description: "Maximum results per entity type" },
    },
    requiredParams: ["query"],
  },
  {
    name: "resolveEntityByName",
    description: "Resolve an entity (task, project, client, member, etc.) by its name to get its ID. Use this when you have a name and need to find the corresponding entity.",
    category: "search",
    parameters: {
      entityType: {
        type: "string",
        description: "Type of entity to resolve",
        enum: ["task", "project", "client", "member", "tab", "block", "doc", "table", "table_row", "timeline_event", "file", "payment", "tag"],
      },
      name: { type: "string", description: "Name to search for" },
      context: {
        type: "object",
        description: "Optional context to narrow down results",
        properties: {
          projectId: { type: "string", description: "Limit to specific project" },
          projectName: { type: "string", description: "Limit to project by name" },
          tableId: { type: "string", description: "For table rows, specify the table" },
        },
      },
    },
    requiredParams: ["entityType", "name"],
  },
  {
    name: "getEntityById",
    description: "Get detailed information about an entity by its ID.",
    category: "search",
    parameters: {
      entityType: {
        type: "string",
        description: "Type of entity",
        enum: ["task", "project", "client", "member", "tab", "block", "doc", "table", "table_row", "timeline_event", "file", "payment", "tag"],
      },
      entityId: { type: "string", description: "The entity ID" },
    },
    requiredParams: ["entityType", "entityId"],
  },
  {
    name: "getEntityContext",
    description: "Get full context for an entity including related data. For tasks: includes assignees, tags, project info. For projects: includes tabs, task summary, timeline events.",
    category: "search",
    parameters: {
      entityType: {
        type: "string",
        description: "Type of entity",
        enum: ["task", "project", "table", "timeline_event"],
      },
      entityId: { type: "string", description: "The entity ID" },
    },
    requiredParams: ["entityType", "entityId"],
  },
  {
    name: "getTableSchema",
    description: "Get the schema (fields) of a table, useful before creating or updating rows.",
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
    description: "Create a new task in a task block. Requires the task block ID where the task should be created.",
    category: "task",
    parameters: {
      taskBlockId: { type: "string", description: "The task block ID to create the task in" },
      title: { type: "string", description: "Task title" },
      status: { type: "string", description: "Task status", enum: ["todo", "in-progress", "done"] },
      priority: { type: "string", description: "Task priority", enum: ["low", "medium", "high", "urgent"] },
      description: { type: "string", description: "Task description" },
      dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      dueTime: { type: "string", description: "Due time (HH:MM)" },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
    },
    requiredParams: ["taskBlockId", "title"],
  },
  {
    name: "updateTaskItem",
    description: "Update an existing task. Can update title, status, priority, description, dates, etc.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID to update" },
      title: { type: "string", description: "New title" },
      status: { type: "string", description: "New status", enum: ["todo", "in-progress", "done"] },
      priority: { type: "string", description: "New priority", enum: ["low", "medium", "high", "urgent"] },
      description: { type: "string", description: "New description (set to null to clear)" },
      dueDate: { type: "string", description: "New due date (YYYY-MM-DD, or null to clear)" },
      dueTime: { type: "string", description: "New due time (HH:MM)" },
      startDate: { type: "string", description: "New start date" },
    },
    requiredParams: ["taskId"],
  },
  {
    name: "deleteTaskItem",
    description: "Delete a task permanently.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID to delete" },
    },
    requiredParams: ["taskId"],
  },
  {
    name: "setTaskAssignees",
    description: "Set assignees for a task. Replaces all current assignees with the provided list.",
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
    name: "setTaskTags",
    description: "Set tags for a task. Replaces all current tags. Creates new tags if they don't exist.",
    category: "task",
    parameters: {
      taskId: { type: "string", description: "The task ID" },
      tagNames: { type: "array", description: "Array of tag names", items: { type: "string" } },
    },
    requiredParams: ["taskId", "tagNames"],
  },
  {
    name: "createTaskSubtask",
    description: "Create a subtask within a task.",
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
    description: "Update a subtask (title, completed status).",
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
    description: "Delete a subtask.",
    category: "task",
    parameters: {
      subtaskId: { type: "string", description: "The subtask ID to delete" },
    },
    requiredParams: ["subtaskId"],
  },
  {
    name: "createTaskComment",
    description: "Add a comment to a task.",
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
    description: "Create a new project in the workspace.",
    category: "project",
    parameters: {
      name: { type: "string", description: "Project name" },
      clientId: { type: "string", description: "Optional client ID to associate" },
      status: { type: "string", description: "Project status", enum: ["active", "completed", "archived", "on-hold"] },
      dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      projectType: { type: "string", description: "Project type", enum: ["project", "template"] },
    },
    requiredParams: ["name"],
  },
  {
    name: "updateProject",
    description: "Update a project's properties.",
    category: "project",
    parameters: {
      projectId: { type: "string", description: "The project ID to update" },
      name: { type: "string", description: "New name" },
      status: { type: "string", description: "New status", enum: ["active", "completed", "archived", "on-hold"] },
      clientId: { type: "string", description: "New client ID (null to remove)" },
      dueDate: { type: "string", description: "New due date (YYYY-MM-DD)" },
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
    name: "createBlock",
    description: "Create a new block in a tab. Block type determines what content to provide.",
    category: "block",
    parameters: {
      tabId: { type: "string", description: "The tab ID to create the block in" },
      type: {
        type: "string",
        description: "Block type",
        enum: ["text", "task", "table", "timeline", "image", "file", "video", "embed", "gallery", "section", "link", "pdf", "doc_reference"],
      },
      content: { type: "object", description: "Block content (varies by type)" },
      position: { type: "number", description: "Row position (0-based)" },
      column: { type: "number", description: "Column (0, 1, or 2)" },
      parentBlockId: { type: "string", description: "Parent section block ID for nested blocks" },
    },
    requiredParams: ["tabId", "type"],
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
    description: "Create a new table with the specified name. The table will have 3 default columns (Name, Column 2, Column 3) and NO rows initially - use createRow or bulkInsertRows to add data.",
    category: "table",
    parameters: {
      workspaceId: { type: "string", description: "The workspace ID. Get from current context." },
      title: { type: "string", description: "Table name/title. This is what the user sees. REQUIRED - always provide the name the user requested." },
      description: { type: "string", description: "Optional table description" },
      projectId: { type: "string", description: "Project to create table in. Get from searchProjects if user specifies a project name." },
    },
    requiredParams: ["workspaceId", "title"],
  },
  {
    name: "createField",
    description: "Create a new field (column) in a table.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      name: { type: "string", description: "Field name" },
      type: {
        type: "string",
        description: "Field type",
        enum: ["text", "number", "select", "multi_select", "date", "checkbox", "url", "email", "phone", "currency", "percent", "rating", "formula", "relation", "rollup", "file", "person", "created_time", "last_edited_time", "created_by", "last_edited_by"],
      },
      config: { type: "object", description: "Field configuration (for select options, formulas, etc.)" },
      isPrimary: { type: "boolean", description: "Whether this is the primary field" },
    },
    requiredParams: ["tableId", "name", "type"],
  },
  {
    name: "updateField",
    description: "Update a table field's properties.",
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
    description: "Delete a table field.",
    category: "table",
    parameters: {
      fieldId: { type: "string", description: "The field ID to delete" },
    },
    requiredParams: ["fieldId"],
  },
  {
    name: "createRow",
    description: "Create a single new row in a table. For creating multiple rows (3+), use bulkInsertRows instead for better efficiency. Can optionally include initial cell values via the data parameter.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      data: { type: "object", description: "Optional: Row data as key-value pairs where key is field ID. Format: {fieldId1: 'value1', fieldId2: 'value2'}. Get field IDs from getTableSchema." },
    },
    requiredParams: ["tableId"],
  },
  {
    name: "updateRow",
    description: "Update a table row's data.",
    category: "table",
    parameters: {
      rowId: { type: "string", description: "The row ID" },
      data: { type: "object", description: "Updated data as key-value pairs" },
    },
    requiredParams: ["rowId"],
  },
  {
    name: "updateCell",
    description: "Update a single cell in a table row. CRITICAL: The row must already exist (created via createRow or bulkInsertRows). Use this for updating individual cells in existing rows, NOT for populating a new table with data - use bulkInsertRows for that.",
    category: "table",
    parameters: {
      rowId: { type: "string", description: "The row ID. Must be an existing row - get from searchTableRows or from the result of createRow/bulkInsertRows." },
      fieldId: { type: "string", description: "The field ID. Get from getTableSchema." },
      value: { type: "string", description: "New value" },
    },
    requiredParams: ["rowId", "fieldId", "value"],
  },
  {
    name: "deleteRow",
    description: "Delete a table row.",
    category: "table",
    parameters: {
      rowId: { type: "string", description: "The row ID to delete" },
    },
    requiredParams: ["rowId"],
  },
  {
    name: "deleteRows",
    description: "Delete multiple table rows at once.",
    category: "table",
    parameters: {
      rowIds: { type: "array", description: "Array of row IDs to delete", items: { type: "string" } },
    },
    requiredParams: ["rowIds"],
  },
  {
    name: "bulkInsertRows",
    description: "Insert multiple rows into a table at once. CRITICAL: Use this when creating 3+ rows, especially when populating a table with initial data. Much more efficient than calling createRow multiple times. Each row can have initial cell values.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID. Get this from createTable or searchTables." },
      rows: {
        type: "array",
        description: "Array of row objects. Each object should have a 'data' property containing field-value pairs. Format: [{data: {fieldId1: 'value1', fieldId2: 'value2'}}, {data: {fieldId1: 'value3'}}]. Get field IDs from getTableSchema. If you want 50 rows with state names in first column, create 50 objects each with data: {firstFieldId: 'StateName'}.",
        items: { type: "object" },
      },
    },
    requiredParams: ["tableId", "rows"],
  },
  {
    name: "bulkUpdateRows",
    description: "Update multiple rows with the same values.",
    category: "table",
    parameters: {
      tableId: { type: "string", description: "The table ID" },
      rowIds: { type: "array", description: "Array of row IDs to update", items: { type: "string" } },
      updates: { type: "object", description: "Updates to apply to all rows" },
    },
    requiredParams: ["tableId", "rowIds", "updates"],
  },
];

// ============================================================================
// TIMELINE ACTION TOOLS
// ============================================================================

const timelineActionTools: ToolDefinition[] = [
  {
    name: "createTimelineEvent",
    description: "Create a new event in a timeline block.",
    category: "timeline",
    parameters: {
      timelineBlockId: { type: "string", description: "The timeline block ID" },
      title: { type: "string", description: "Event title" },
      startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
      endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
      status: { type: "string", description: "Event status" },
      progress: { type: "number", description: "Progress percentage (0-100)" },
      notes: { type: "string", description: "Event notes" },
      color: { type: "string", description: "Event color (hex)" },
      isMilestone: { type: "boolean", description: "Whether this is a milestone" },
      assigneeId: { type: "string", description: "Assignee user ID" },
    },
    requiredParams: ["timelineBlockId", "title", "startDate", "endDate"],
  },
  {
    name: "updateTimelineEvent",
    description: "Update a timeline event.",
    category: "timeline",
    parameters: {
      eventId: { type: "string", description: "The event ID" },
      title: { type: "string", description: "New title" },
      startDate: { type: "string", description: "New start date" },
      endDate: { type: "string", description: "New end date" },
      status: { type: "string", description: "New status" },
      progress: { type: "number", description: "New progress (0-100)" },
      notes: { type: "string", description: "New notes" },
      color: { type: "string", description: "New color" },
      isMilestone: { type: "boolean", description: "Whether this is a milestone" },
      assigneeId: { type: "string", description: "New assignee ID" },
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
    description: "Create a dependency between two timeline events.",
    category: "timeline",
    parameters: {
      timelineBlockId: { type: "string", description: "Timeline block ID that owns the events" },
      fromEventId: { type: "string", description: "Source event ID" },
      toEventId: { type: "string", description: "Target event ID" },
      dependencyType: { type: "string", description: "Type of dependency", enum: ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"] },
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
      content: { type: "object", description: "Initial content (TipTap JSON format)" },
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
// COMMENT ACTION TOOLS
// ============================================================================

const commentActionTools: ToolDefinition[] = [
  {
    name: "createComment",
    description: "Create a comment on any entity.",
    category: "comment",
    parameters: {
      targetType: { type: "string", description: "Target type (block, table_row, etc.)" },
      targetId: { type: "string", description: "The target entity ID" },
      text: { type: "string", description: "Comment text" },
    },
    requiredParams: ["targetType", "targetId", "text"],
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
// PAYMENT ACTION TOOLS
// ============================================================================

const paymentActionTools: ToolDefinition[] = [
  {
    name: "createPayment",
    description: "Create a new payment record.",
    category: "payment",
    parameters: {
      amount: { type: "number", description: "Payment amount" },
      currency: { type: "string", description: "Currency code (e.g., USD)" },
      status: { type: "string", description: "Payment status", enum: ["pending", "paid", "overdue", "cancelled"] },
      description: { type: "string", description: "Payment description" },
      dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
      projectId: { type: "string", description: "Associated project ID" },
      clientId: { type: "string", description: "Associated client ID" },
    },
    requiredParams: ["amount", "currency"],
  },
  {
    name: "updatePayment",
    description: "Update a payment record.",
    category: "payment",
    parameters: {
      paymentId: { type: "string", description: "The payment ID" },
      amount: { type: "number", description: "New amount" },
      status: { type: "string", description: "New status" },
      description: { type: "string", description: "New description" },
      dueDate: { type: "string", description: "New due date" },
      paidAt: { type: "string", description: "Paid timestamp" },
    },
    requiredParams: ["paymentId"],
  },
  {
    name: "deletePayment",
    description: "Delete a payment record.",
    category: "payment",
    parameters: {
      paymentId: { type: "string", description: "The payment ID to delete" },
    },
    requiredParams: ["paymentId"],
  },
];

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const allTools: ToolDefinition[] = [
  ...searchTools,
  ...taskActionTools,
  ...projectActionTools,
  ...tabActionTools,
  ...blockActionTools,
  ...tableActionTools,
  ...timelineActionTools,
  ...propertyActionTools,
  ...clientActionTools,
  ...docActionTools,
  ...commentActionTools,
  ...paymentActionTools,
];

export const toolsByCategory: Record<ToolCategory, ToolDefinition[]> = {
  search: searchTools,
  task: taskActionTools,
  project: projectActionTools,
  tab: tabActionTools,
  block: blockActionTools,
  table: tableActionTools,
  timeline: timelineActionTools,
  property: propertyActionTools,
  client: clientActionTools,
  doc: docActionTools,
  comment: commentActionTools,
  workspace: [], // Workspace actions are typically not exposed to AI
  file: [], // File actions require special handling
  payment: paymentActionTools,
};

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
