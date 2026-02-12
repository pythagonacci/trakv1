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

const ITEM_ID_KEYS = [
  "id",
  "tableId",
  "rowId",
  "fieldId",
  "blockId",
  "taskId",
  "projectId",
  "tabId",
  "docId",
  "clientId",
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
  "docId",
  "clientId",
  "id",
]);

const tableTitleCache = new Map<string, string>();
const tabNameCache = new Map<string, string>();

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

function getItemName(args: Record<string, unknown>) {
  for (const key of ITEM_NAME_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const key of ITEM_ID_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return `${key} ${value.trim()}`;
    if (typeof value === "number") return `${key} ${value}`;
  }

  return "this item";
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
  let itemName = getItemName(args);
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
      } else {
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
