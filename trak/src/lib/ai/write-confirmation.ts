import { createClient } from "@/lib/supabase/server";

export interface WriteConfirmationRequest {
  tool: string;
  arguments: Record<string, unknown>;
  question: string;
  itemName: string;
  changeSummary: string;
}

export interface WriteConfirmationApproval {
  decision: "approve";
  request: {
    tool: string;
    arguments?: Record<string, unknown>;
  };
}

const ITEM_NAME_KEYS = [
  "name",
  "title",
  "label",
  "tableName",
  "fieldName",
  "projectName",
  "tabName",
  "clientName",
  "docName",
];

const CHANGE_EXCLUDE_KEYS = new Set([
  "workspaceId",
  "userId",
  "projectId",
  "tabId",
  "tableId",
  "rowId",
  "fieldId",
  "blockId",
  "taskId",
  "subtaskId",
  "eventId",
  "docId",
  "clientId",
  "fileId",
  "commentId",
  "dependencyId",
  "id",
]);

const tableTitleCache = new Map<string, string>();
const tabNameCache = new Map<string, string>();
const projectNameCache = new Map<string, string>();
const taskTitleCache = new Map<string, string>();
const subtaskTitleCache = new Map<string, string>();
const fieldNameCache = new Map<string, string>();
const rowNameCache = new Map<string, string>();
const blockNameCache = new Map<string, string>();
const timelineEventTitleCache = new Map<string, string>();
const clientNameCache = new Map<string, string>();
const docTitleCache = new Map<string, string>();
const fileNameCache = new Map<string, string>();

function toActionPhrase(toolName: string) {
  const lower = toolName.toLowerCase();
  if (lower.startsWith("create")) return "create";
  if (lower.startsWith("delete")) return "delete";
  if (lower.startsWith("move")) return "move";
  if (lower.startsWith("rename")) return "rename";
  if (lower.startsWith("archive")) return "archive";
  if (lower.startsWith("bulk")) return "apply changes to";
  return "update";
}

function truncateText(value: string, max = 140) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}

function safePreview(value: unknown, max = 80): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return truncateText(value, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === "object") {
    try {
      return truncateText(JSON.stringify(value), max);
    } catch {
      return "complex value";
    }
  }
  return truncateText(String(value), max);
}

function getExplicitItemName(args: Record<string, unknown>) {
  for (const key of ITEM_NAME_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getGenericItemName(tool: string) {
  const lower = tool.toLowerCase();

  if (lower.includes("tasksubtask") || lower.includes("subtask")) return "this subtask";
  if (lower.includes("taskitem") || lower.includes("task")) return "this task";
  if (lower.includes("timelineevent")) return "this timeline event";
  if (lower.includes("timelinedependency")) return "this timeline dependency";
  if (lower.includes("project")) return "this project";
  if (lower.includes("field")) return "this field";
  if (lower.includes("row") || lower.includes("cell")) return "this row";
  if (lower.includes("table")) return "this table";
  if (lower.includes("block")) return "this block";
  if (lower.includes("tab")) return "this tab";
  if (lower.includes("doc")) return "this document";
  if (lower.includes("client")) return "this client";
  if (lower.includes("file")) return "this file";
  if (lower.includes("comment")) return "this comment";

  return "this item";
}

async function resolveSingleValue(
  cache: Map<string, string>,
  table: string,
  id: string,
  select: string,
  getter: (data: Record<string, unknown>) => string | null
): Promise<string | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const cached = cache.get(normalizedId);
  if (cached) return cached;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq("id", normalizedId)
      .maybeSingle();

    if (error || !data || typeof data !== "object") return null;
    const resolved = getter(data as Record<string, unknown>)?.trim();
    if (!resolved) return null;

    cache.set(normalizedId, resolved);
    return resolved;
  } catch {
    return null;
  }
}

function getBlockTitle(block: { type?: unknown; content?: unknown }) {
  const type = typeof block.type === "string" ? block.type : "block";
  const content =
    block.content && typeof block.content === "object" && !Array.isArray(block.content)
      ? (block.content as Record<string, unknown>)
      : {};

  switch (type) {
    case "text": {
      const text = typeof content.text === "string" ? content.text : typeof content.content === "string" ? content.content : "";
      return text.trim().slice(0, 50) || "Text block";
    }
    case "task":
      return typeof content.title === "string" && content.title.trim() ? content.title.trim() : "Task block";
    case "table":
      return typeof content.title === "string" && content.title.trim() ? content.title.trim() : "Table";
    case "image":
      return typeof content.alt === "string" && content.alt.trim()
        ? content.alt.trim()
        : typeof content.filename === "string" && content.filename.trim()
          ? content.filename.trim()
          : "Image";
    case "file":
    case "pdf":
      return typeof content.filename === "string" && content.filename.trim() ? content.filename.trim() : "File";
    case "video":
    case "embed":
    case "link":
    case "section":
    case "doc_reference":
    case "chart":
      return typeof content.title === "string" && content.title.trim() ? content.title.trim() : `${type} block`;
    case "divider":
      return "Divider";
    case "timeline":
      return "Timeline";
    default:
      return `${type} block`;
  }
}

function getTableRowTitle(row: { data?: unknown; tables?: unknown }) {
  const data =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  const table = Array.isArray(row.tables) ? row.tables[0] : row.tables;
  const tableFields =
    table && typeof table === "object" && "table_fields" in table
      ? (table as { table_fields?: Array<{ id?: string; is_primary?: boolean }> }).table_fields ?? []
      : [];

  const primaryField = tableFields.find((field) => field?.is_primary && typeof field.id === "string");
  if (primaryField?.id) {
    const value = data[primaryField.id];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 50);
  }

  const tableTitle =
    table && typeof table === "object" && "title" in table && typeof (table as { title?: unknown }).title === "string"
      ? (table as { title: string }).title.trim()
      : "";

  return tableTitle ? `row in ${tableTitle}` : "row";
}

async function resolveProjectName(projectId: string) {
  return resolveSingleValue(projectNameCache, "projects", projectId, "name", (data) =>
    typeof data.name === "string" && data.name.trim() ? `project "${data.name.trim()}"` : null
  );
}

async function resolveTableTitle(tableId: string): Promise<string | null> {
  const normalizedId = tableId.trim();
  if (!normalizedId) return null;

  const cached = tableTitleCache.get(normalizedId);
  if (cached) return cached;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tables")
      .select("title")
      .eq("id", normalizedId)
      .maybeSingle();
    if (error || !data?.title) return null;
    const title = String(data.title).trim();
    if (!title) return null;
    tableTitleCache.set(normalizedId, title);
    return title;
  } catch {
    return null;
  }
}

async function resolveTabName(tabId: string): Promise<string | null> {
  const normalizedId = tabId.trim();
  if (!normalizedId) return null;

  const cached = tabNameCache.get(normalizedId);
  if (cached) return cached;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tabs")
      .select("name")
      .eq("id", normalizedId)
      .maybeSingle();
    if (error || !data?.name) return null;
    const name = String(data.name).trim();
    if (!name) return null;
    tabNameCache.set(normalizedId, name);
    return name;
  } catch {
    return null;
  }
}

async function resolveTaskTitle(taskId: string) {
  return resolveSingleValue(taskTitleCache, "task_items", taskId, "title", (data) =>
    typeof data.title === "string" && data.title.trim() ? `task "${data.title.trim()}"` : null
  );
}

async function resolveSubtaskTitle(subtaskId: string) {
  return resolveSingleValue(subtaskTitleCache, "task_subtasks", subtaskId, "title", (data) =>
    typeof data.title === "string" && data.title.trim() ? `subtask "${data.title.trim()}"` : null
  );
}

async function resolveFieldName(fieldId: string) {
  return resolveSingleValue(fieldNameCache, "table_fields", fieldId, "name", (data) =>
    typeof data.name === "string" && data.name.trim() ? `field "${data.name.trim()}"` : null
  );
}

async function resolveRowName(rowId: string) {
  return resolveSingleValue(
    rowNameCache,
    "table_rows",
    rowId,
    "id, data, tables(title, table_fields(id, is_primary))",
    (data) => {
      const title = getTableRowTitle(data as { data?: unknown; tables?: unknown });
      const table = Array.isArray(data.tables) ? data.tables[0] : data.tables;
      const tableTitle =
        table && typeof table === "object" && "title" in table && typeof (table as { title?: unknown }).title === "string"
          ? (table as { title: string }).title.trim()
          : "";

      if (title === "row") return tableTitle ? `row in table "${tableTitle}"` : "row";
      if (title === `row in ${tableTitle}` && tableTitle) return `row in table "${tableTitle}"`;
      return tableTitle ? `row "${title}" in table "${tableTitle}"` : `row "${title}"`;
    }
  );
}

async function resolveBlockName(blockId: string) {
  return resolveSingleValue(blockNameCache, "blocks", blockId, "type, content", (data) => {
    const type = typeof data.type === "string" ? data.type : "block";
    const title = getBlockTitle({ type: data.type, content: data.content });
    if (!title || title.toLowerCase() === `${type} block`) return `${type} block`;
    return `${type} block "${title}"`;
  });
}

async function resolveTimelineEventTitle(eventId: string) {
  return resolveSingleValue(timelineEventTitleCache, "timeline_events", eventId, "title", (data) =>
    typeof data.title === "string" && data.title.trim() ? `timeline event "${data.title.trim()}"` : null
  );
}

async function resolveClientName(clientId: string) {
  return resolveSingleValue(clientNameCache, "clients", clientId, "name, company", (data) => {
    if (typeof data.name === "string" && data.name.trim()) return `client "${data.name.trim()}"`;
    if (typeof data.company === "string" && data.company.trim()) return `client "${data.company.trim()}"`;
    return null;
  });
}

async function resolveDocTitle(docId: string) {
  return resolveSingleValue(docTitleCache, "docs", docId, "title", (data) =>
    typeof data.title === "string" && data.title.trim() ? `document "${data.title.trim()}"` : null
  );
}

async function resolveFileName(fileId: string) {
  return resolveSingleValue(fileNameCache, "files", fileId, "file_name", (data) =>
    typeof data.file_name === "string" && data.file_name.trim() ? `file "${data.file_name.trim()}"` : null
  );
}

async function resolveItemNameFromIds(tool: string, args: Record<string, unknown>) {
  const resolvers: Array<[string, (id: string) => Promise<string | null>]> = [
    ["taskId", resolveTaskTitle],
    ["subtaskId", resolveSubtaskTitle],
    ["fieldId", resolveFieldName],
    ["rowId", resolveRowName],
    ["tableId", async (id) => {
      const title = await resolveTableTitle(id);
      return title ? `table "${title}"` : null;
    }],
    ["blockId", resolveBlockName],
    ["projectId", resolveProjectName],
    ["tabId", async (id) => {
      const name = await resolveTabName(id);
      return name ? `tab "${name}"` : null;
    }],
    ["eventId", resolveTimelineEventTitle],
    ["clientId", resolveClientName],
    ["docId", resolveDocTitle],
    ["fileId", resolveFileName],
  ];

  for (const [key, resolver] of resolvers) {
    const value = args[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const resolved = await resolver(value);
    if (resolved) return resolved;
  }

  return getGenericItemName(tool);
}

function summarizeValueForHumans(key: string, value: unknown): string {
  if (value === null || value === undefined) return `${key}: none`;

  if (key === "content" && typeof value === "object" && !Array.isArray(value)) {
    const asRecord = value as Record<string, unknown>;
    if (asRecord.type === "doc") return "explainer text content";
    return "formatted content";
  }

  if ((key === "updates" || key === "data" || key === "filters") && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return `${key}: none`;
    return `${key}: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}`;
  }

  if ((key === "rows" || key === "fields") && Array.isArray(value)) {
    return `${key}: ${value.length} item(s)`;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) return `${key}: ${value.length} item(s)`;
    const count = Object.keys(value as Record<string, unknown>).length;
    return `${key}: ${count} value(s)`;
  }

  return `${key}: ${safePreview(value)}`;
}

function getChangeSummary(tool: string, args: Record<string, unknown>) {
  if (tool === "createBlock" && args.type === "text") {
    return "an explainer text block";
  }

  const entries = Object.entries(args)
    .filter(([key]) => !CHANGE_EXCLUDE_KEYS.has(key))
    .filter(([, value]) => value !== undefined)
    .slice(0, 3)
    .map(([key, value]) => summarizeValueForHumans(key, value));

  if (entries.length > 0) {
    return truncateText(entries.join(", "), 180);
  }

  const allKeys = Object.keys(args);
  if (allKeys.length > 0) {
    return truncateText(`fields: ${allKeys.join(", ")}`, 180);
  }
  return "the requested changes";
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);
    return `{${entries.join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "undefined" : serialized;
}

export async function buildWriteConfirmationRequest(
  tool: string,
  args: Record<string, unknown>
): Promise<WriteConfirmationRequest> {
  const explicitItemName = getExplicitItemName(args);
  let itemName = explicitItemName ?? await resolveItemNameFromIds(tool, args);

  const tableId = typeof args.tableId === "string" ? args.tableId : null;
  const hasExplicitTableName = typeof args.tableName === "string" && args.tableName.trim().length > 0;
  if (tableId && !hasExplicitTableName) {
    const tableTitle = await resolveTableTitle(tableId);
    if (tableTitle) {
      itemName = `table "${tableTitle}"`;
    }
  }

  const tabId = typeof args.tabId === "string" ? args.tabId : null;
  const hasExplicitTabName = typeof args.tabName === "string" && args.tabName.trim().length > 0;
  if (tabId && !hasExplicitTabName) {
    const tabName = await resolveTabName(tabId);
    if (tabName) {
      if (tool === "createBlock" && typeof args.type === "string") {
        itemName = `${args.type} block in tab "${tabName}"`;
      } else if (!explicitItemName && itemName === getGenericItemName(tool)) {
        itemName = `tab "${tabName}"`;
      }
    }
  }

  const changeSummary = getChangeSummary(tool, args);
  const action = toActionPhrase(tool);
  const question = `I'm about to ${action} ${itemName} with ${changeSummary}. Continue?`;

  return {
    tool,
    arguments: args,
    question,
    itemName,
    changeSummary,
  };
}

export function matchesApprovedWriteAction(
  tool: string,
  args: Record<string, unknown>,
  approval?: WriteConfirmationApproval | null
) {
  if (!approval || approval.decision !== "approve") return false;
  if (approval.request.tool !== tool) return false;
  if (!approval.request.arguments) return true;
  return stableSerialize(approval.request.arguments) === stableSerialize(args);
}
