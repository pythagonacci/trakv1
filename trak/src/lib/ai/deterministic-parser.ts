/**
 * Deterministic parsing for Prompt-to-Action (no LLM)
 *
 * Focused on safe, high-confidence command execution with fuzzy matching,
 * confidence gating, and conservative fallback when uncertain.
 */

import { aiDebug } from "./debug";
import type { ExecutionContext } from "./executor";

export interface DeterministicToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface DeterministicToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DeterministicParseResult {
  toolCalls: DeterministicToolCall[];
  confidence: number;
  reason: string;
  responseTemplate?: (
    results: DeterministicToolCallResult[],
    toolCalls: DeterministicToolCall[]
  ) => string;
  debug?: Record<string, unknown>;
}

type ParseOptions = {
  now?: Date;
  minConfidence?: number;
};

const MIN_CONFIDENCE = Number(process.env.AI_DETERMINISTIC_MIN_CONFIDENCE ?? 0.82);
const CONFIDENCE_MARGIN = Number(process.env.AI_DETERMINISTIC_CONFIDENCE_MARGIN ?? 0.06);
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_TITLE_CHARS = 140;

const ACTION_SYNONYMS: Record<string, Array<{ term: string; weight: number }>> = {
  search: [
    { term: "search", weight: 1 },
    { term: "find", weight: 0.95 },
    { term: "show", weight: 0.92 },
    { term: "list", weight: 0.9 },
    { term: "get", weight: 0.88 },
    { term: "lookup", weight: 0.86 },
    { term: "look up", weight: 0.86 },
    { term: "display", weight: 0.84 },
    { term: "view", weight: 0.82 },
    { term: "see", weight: 0.8 },
  ],
  create: [
    { term: "create", weight: 1 },
    { term: "add", weight: 0.92 },
    { term: "make", weight: 0.9 },
    { term: "build", weight: 0.88 },
    { term: "new", weight: 0.75 },
    { term: "start", weight: 0.72 },
    { term: "draft", weight: 0.7 },
  ],
  update: [
    { term: "update", weight: 1 },
    { term: "edit", weight: 0.92 },
    { term: "change", weight: 0.9 },
    { term: "set", weight: 0.86 },
    { term: "mark", weight: 0.84 },
    { term: "rename", weight: 0.82 },
  ],
};

const ENTITY_SYNONYMS: Record<string, string[]> = {
  task: ["task", "tasks", "todo", "to-do", "to do", "item", "items"],
  project: ["project", "projects", "initiative", "initiatives"],
  table: ["table", "tables", "spreadsheet", "grid", "sheet"],
  doc: ["doc", "docs", "document", "documents", "note", "notes"],
  file: ["file", "files", "attachment", "attachments", "upload", "uploads"],
  client: ["client", "clients", "customer", "customers", "company", "companies"],
  tab: ["tab", "tabs", "page", "pages"],
  block: ["block", "blocks", "section", "sections"],
  tag: ["tag", "tags", "label", "labels"],
  timeline: ["timeline", "timelines", "gantt", "event", "events", "milestone", "milestones"],
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "me",
  "please",
  "pls",
  "thanks",
  "thank",
  "you",
  "all",
  "any",
  "some",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "with",
  "and",
  "show",
  "list",
  "get",
  "find",
  "search",
  "create",
  "add",
  "make",
  "new",
  "build",
  "start",
  "draft",
]);

const TASK_STATUS_SYNONYMS: Record<string, string[]> = {
  todo: ["todo", "to do", "backlog", "not started", "open"],
  "in-progress": ["in progress", "in-progress", "doing", "active"],
  done: ["done", "complete", "completed", "closed", "finished"],
};

const PROJECT_STATUS_SYNONYMS: Record<string, string[]> = {
  not_started: ["not started", "not-started", "todo", "backlog", "open"],
  in_progress: ["in progress", "in-progress", "active", "doing"],
  complete: ["complete", "completed", "done", "finished", "closed"],
};

const PRIORITY_SYNONYMS: Record<string, string[]> = {
  urgent: ["urgent", "asap", "critical", "blocker"],
  high: ["high", "important"],
  medium: ["medium", "normal"],
  low: ["low", "minor"],
};

const ENTITY_FUZZY_PENALTY: Record<keyof typeof ENTITY_SYNONYMS, number> = {
  task: 0.85,
  project: 0.85,
  table: 0.85,
  doc: 0.8,
  file: 0.8,
  client: 0.8,
  tab: 0.6,
  block: 0.8,
  tag: 0.6,
  timeline: 0.8,
};

const IGNORED_SEARCH_TOKENS = new Set<string>([
  ...STOP_WORDS,
  ...Object.values(ACTION_SYNONYMS)
    .flatMap((entries) => entries.map((entry) => entry.term))
    .filter((term) => !term.includes(" ")),
  ...Object.values(ENTITY_SYNONYMS)
    .flatMap((entries) => entries)
    .filter((term) => !term.includes(" ")),
]);

// ============================================================================
// PUBLIC API
// ============================================================================

export function parseDeterministicCommand(
  userCommand: string,
  context: ExecutionContext,
  options: ParseOptions = {}
): DeterministicParseResult | null {
  const t0 = performance.now();
  const raw = userCommand.trim();
  const cleaned = normalizePolite(raw);
  const normalized = normalizeForMatch(stripQuotedText(cleaned));
  const tokens = tokenize(normalized);
  const now = options.now ?? new Date();
  const minConfidence = Number.isFinite(options.minConfidence)
    ? (options.minConfidence as number)
    : MIN_CONFIDENCE;

  if (!cleaned || normalized.length === 0) return null;

  if (isMultiStepCommand(cleaned)) {
    aiDebug("deterministic:skip-multi-step", { command: cleaned, ms: Math.round(performance.now() - t0) });
    return null;
  }

  const candidates: DeterministicParseResult[] = [];

  const tableWithColumns = matchCreateTableWithColumns(cleaned, normalized, tokens, context);
  if (tableWithColumns) candidates.push(tableWithColumns);

  const createTable = matchCreateTable(cleaned, normalized, tokens, context);
  if (createTable) candidates.push(createTable);

  const createTask = matchCreateTask(cleaned, normalized, tokens, now);
  if (createTask) candidates.push(createTask);

  const createProject = matchCreateProject(cleaned, normalized, tokens, now);
  if (createProject) candidates.push(createProject);

  const createDoc = matchCreateDoc(cleaned, normalized, tokens);
  if (createDoc) candidates.push(createDoc);

  const createClient = matchCreateClient(cleaned, normalized, tokens);
  if (createClient) candidates.push(createClient);

  const createTab = matchCreateTab(cleaned, normalized, tokens, context);
  if (createTab) candidates.push(createTab);

  const searchAll = matchSearchAll(cleaned, normalized, tokens);
  if (searchAll) candidates.push(searchAll);

  const searchTasks = matchSearchTasks(cleaned, normalized, tokens, now);
  if (searchTasks) candidates.push(searchTasks);

  const searchProjects = matchSearchProjects(cleaned, normalized, tokens, now);
  if (searchProjects) candidates.push(searchProjects);

  const searchTables = matchSearchEntity(cleaned, normalized, tokens, "table", "searchTables");
  if (searchTables) candidates.push(searchTables);

  const searchDocs = matchSearchEntity(cleaned, normalized, tokens, "doc", "searchDocs");
  if (searchDocs) candidates.push(searchDocs);

  const searchFiles = matchSearchEntity(cleaned, normalized, tokens, "file", "searchFiles");
  if (searchFiles) candidates.push(searchFiles);

  const searchClients = matchSearchEntity(cleaned, normalized, tokens, "client", "searchClients");
  if (searchClients) candidates.push(searchClients);

  const searchTags = matchSearchEntity(cleaned, normalized, tokens, "tag", "searchTags");
  if (searchTags) candidates.push(searchTags);

  const searchTabs = matchSearchEntity(cleaned, normalized, tokens, "tab", "searchTabs");
  if (searchTabs) candidates.push(searchTabs);

  const searchBlocks = matchSearchEntity(cleaned, normalized, tokens, "block", "searchBlocks");
  if (searchBlocks) candidates.push(searchBlocks);

  const searchTimeline = matchSearchEntity(
    cleaned,
    normalized,
    tokens,
    "timeline",
    "searchTimelineEvents",
    "timeline events"
  );
  if (searchTimeline) candidates.push(searchTimeline);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.toolCalls.length !== a.toolCalls.length) return b.toolCalls.length - a.toolCalls.length;
    return a.reason.localeCompare(b.reason);
  });
  const top = candidates[0];
  const runnerUp = candidates[1];

  aiDebug("deterministic:candidates", {
    command: cleaned,
    top: { reason: top.reason, confidence: top.confidence },
    runnerUp: runnerUp ? { reason: runnerUp.reason, confidence: runnerUp.confidence } : null,
    ms: Math.round(performance.now() - t0),
  });

  if (top.confidence < minConfidence) return null;
  if (runnerUp && top.confidence - runnerUp.confidence < CONFIDENCE_MARGIN) {
    if (top.toolCalls.length > runnerUp.toolCalls.length) return top;
    return null;
  }

  return top;
}

// ============================================================================
// MATCHERS
// ============================================================================

function matchCreateTableWithColumns(
  cleaned: string,
  normalized: string,
  tokens: string[],
  context: ExecutionContext
): DeterministicParseResult | null {
  if (!context.workspaceId) return null;

  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("table", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const tableIndicator = /\btable\b/i;
  const columnsIndicator = /\b(?:columns?|fields?|cols?)\b/i;
  if (!tableIndicator.test(cleaned) && !columnsIndicator.test(cleaned)) return null;

  const matchA = cleaned.match(
    /table\s+(?:called|named|titled|for|to\s+track)\s+["']?(.+?)["']?\s*(?:\s+(?:with|w\/|columns?|fields?|cols?|including)|[:\->])\s+(.+)$/i
  );
  const matchB = cleaned.match(
    /^(?:.*?\b)?["']?(.+?)["']?\s+table\s*(?:\.?\s+(?:with|w\/|columns?|fields?|cols?|including|are|is)|[:\->])\s+(.+)$/i
  );
  const matchC = cleaned.match(
    /table\s+["']?(.+?)["']?\s*(?:\s+(?:with|w\/|columns?|fields?|cols?|including|are|is)|[:\->])\s+(.+)$/i
  );
  const matchD = cleaned.match(/^['"]?(.+?)['"]?\s*[:]\s+(?:columns?|fields?|cols?)\s+(.+)$/i);

  const match = matchA || matchB || matchC || matchD;
  if (!match) return null;

  let tableTitle = match[1].trim();
  const columnsPart = match[2].trim();

  tableTitle = cleanTitle(tableTitle);
  if (!tableTitle || tableTitle.length < 2) return null;

  const columnNames = parseColumnList(columnsPart);
  if (!columnNames || columnNames.length === 0) return null;

  const tableArgs = {
    title: tableTitle,
    workspaceId: context.workspaceId,
    projectId: context.currentProjectId,
    tabId: context.currentTabId,
  };

  const fieldsArgs = {
    fields: columnNames.map((name) => ({ name, type: inferFieldType(name) })),
  };

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.08);

  return {
    toolCalls: [
      { name: "createTable", arguments: tableArgs },
      { name: "bulkCreateFields", arguments: fieldsArgs },
    ],
    confidence,
    reason: "create table with columns",
    responseTemplate: (results) => {
      const createResult = results[0];
      if (!createResult.success) return buildErrorResponse("createTable", createResult);
      return `Created table "${tableTitle}" with columns: ${columnNames.join(", ")}.`;
    },
  };
}

function matchCreateTable(
  cleaned: string,
  normalized: string,
  tokens: string[],
  context: ExecutionContext
): DeterministicParseResult | null {
  if (!context.workspaceId) return null;
  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("table", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const title = extractTitle(cleaned, ENTITY_SYNONYMS.table);
  if (!title) return null;

  const args = {
    title,
    workspaceId: context.workspaceId,
    projectId: context.currentProjectId,
    tabId: context.currentTabId,
  };

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.02);

  return {
    toolCalls: [{ name: "createTable", arguments: args }],
    confidence,
    reason: "create table",
    responseTemplate: (results) =>
      results[0]?.success
        ? `Created table "${title}".`
        : buildErrorResponse("createTable", results[0]),
  };
}

function matchCreateTask(
  cleaned: string,
  normalized: string,
  tokens: string[],
  now: Date
): DeterministicParseResult | null {
  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("task", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const title = extractTitle(cleaned, ENTITY_SYNONYMS.task);
  if (!title) return null;

  const due = extractDueDate(cleaned, now);
  const assignees = extractAssignees(cleaned);
  const tags = extractTags(cleaned);
  const status = detectTaskStatus(normalized);
  const priority = detectPriority(normalized);

  const args: Record<string, unknown> = {
    title,
  };

  if (due?.exact) args.dueDate = due.exact;
  if (assignees.length > 0) args.assignees = assignees;
  if (tags.length > 0) args.tags = tags;
  if (status) args.status = status;
  if (priority) args.priority = priority;

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.04);

  return {
    toolCalls: [{ name: "createTaskItem", arguments: args }],
    confidence,
    reason: "create task",
    responseTemplate: (results) =>
      results[0]?.success
        ? `Created task "${title}".`
        : buildErrorResponse("createTaskItem", results[0]),
  };
}

function matchCreateProject(
  cleaned: string,
  normalized: string,
  tokens: string[],
  now: Date
): DeterministicParseResult | null {
  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("project", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const name = extractTitle(cleaned, ENTITY_SYNONYMS.project);
  if (!name) return null;

  const status = detectProjectStatus(normalized);
  const due = extractDueDate(cleaned, now);
  const projectType = detectProjectType(normalized);

  const args: Record<string, unknown> = { name };
  if (status) args.status = status;
  if (due?.exact) args.dueDate = due.exact;
  if (projectType) args.projectType = projectType;

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.03);

  return {
    toolCalls: [{ name: "createProject", arguments: args }],
    confidence,
    reason: "create project",
    responseTemplate: (results) =>
      results[0]?.success
        ? `Created project "${name}".`
        : buildErrorResponse("createProject", results[0]),
  };
}

function matchCreateDoc(
  cleaned: string,
  normalized: string,
  tokens: string[]
): DeterministicParseResult | null {
  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("doc", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const title = extractTitle(cleaned, ENTITY_SYNONYMS.doc);
  if (!title) return null;

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.02);

  return {
    toolCalls: [{ name: "createDoc", arguments: { title } }],
    confidence,
    reason: "create doc",
    responseTemplate: (results) =>
      results[0]?.success
        ? `Created doc "${title}".`
        : buildErrorResponse("createDoc", results[0]),
  };
}

function matchCreateClient(
  cleaned: string,
  normalized: string,
  tokens: string[]
): DeterministicParseResult | null {
  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("client", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const name = extractTitle(cleaned, ENTITY_SYNONYMS.client);
  if (!name) return null;

  const email = extractEmail(cleaned);
  const phone = extractPhone(cleaned);
  const website = extractWebsite(cleaned);

  const args: Record<string, unknown> = { name };
  if (email) args.email = email;
  if (phone) args.phone = phone;
  if (website) args.website = website;

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.02);

  return {
    toolCalls: [{ name: "createClient", arguments: args }],
    confidence,
    reason: "create client",
    responseTemplate: (results) =>
      results[0]?.success
        ? `Created client "${name}".`
        : buildErrorResponse("createClient", results[0]),
  };
}

function matchCreateTab(
  cleaned: string,
  normalized: string,
  tokens: string[],
  context: ExecutionContext
): DeterministicParseResult | null {
  if (!context.currentProjectId) return null;
  const actionScore = scoreAction("create", normalized, tokens);
  const entityScore = scoreEntity("tab", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const name = extractTitle(cleaned, ENTITY_SYNONYMS.tab);
  if (!name) return null;

  const confidence = computeConfidence(actionScore, entityScore, 1, 0.02);

  return {
    toolCalls: [{ name: "createTab", arguments: { name, projectId: context.currentProjectId } }],
    confidence,
    reason: "create tab",
    responseTemplate: (results) =>
      results[0]?.success
        ? `Created tab "${name}".`
        : buildErrorResponse("createTab", results[0]),
  };
}

function matchSearchAll(
  cleaned: string,
  normalized: string,
  tokens: string[]
): DeterministicParseResult | null {
  const actionScore = scoreAction("search", normalized, tokens);
  if (actionScore < 0.55) return null;

  if (!/\b(all|everything|anywhere|across)\b/i.test(cleaned)) return null;

  const searchText = extractSearchText(cleaned, normalized, tokens);
  if (!searchText) return null;

  const args = { searchText, limit: DEFAULT_SEARCH_LIMIT };
  const confidence = computeConfidence(actionScore, 0.8, 0.9, 0.03);

  return {
    toolCalls: [{ name: "searchAll", arguments: args }],
    confidence,
    reason: "search all",
    responseTemplate: (results) => buildGenericSearchResponse(results[0], "items"),
  };
}

function matchSearchTasks(
  cleaned: string,
  normalized: string,
  tokens: string[],
  now: Date
): DeterministicParseResult | null {
  const actionScore = inferImplicitSearch(
    scoreAction("search", normalized, tokens),
    cleaned,
    ENTITY_SYNONYMS.task
  );
  const entityScore = scoreEntity("task", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const status = detectTaskStatus(normalized);
  const priority = detectPriority(normalized);
  const assignees = extractAssignees(cleaned);
  const tags = extractTags(cleaned);
  const due = extractDueDate(cleaned, now);

  const args: Record<string, unknown> = { limit: DEFAULT_SEARCH_LIMIT };
  if (status) args.status = status;
  if (priority) args.priority = priority;
  if (assignees.length > 0) args.assigneeName = assignees[0];
  if (tags.length > 0) args.tagName = tags[0];
  if (due?.range) args.dueDate = due.range;
  if (due?.exact && !due.range) args.dueDate = { eq: due.exact };
  if (due?.isNull) args.dueDate = { isNull: true };

  const explicitSearchText = extractExplicitSearchText(cleaned);
  const hasFilters = Boolean(status || priority || assignees.length > 0 || tags.length > 0 || due);
  const searchText = explicitSearchText ?? (!hasFilters ? extractSearchText(cleaned, normalized, tokens) : null);
  if (searchText) args.searchText = searchText;

  let argsScore = 0.6;
  if (searchText) argsScore += 0.2;
  if (hasFilters) argsScore += 0.2;

  const specificityBonus = hasFilters ? 0.04 : 0.02;
  const confidence = computeConfidence(actionScore, entityScore, clamp(argsScore, 0, 1), specificityBonus);

  return {
    toolCalls: [{ name: "searchTasks", arguments: args }],
    confidence,
    reason: "search tasks",
    responseTemplate: (results) => buildTaskSearchResponse(results[0]),
  };
}

function matchSearchProjects(
  cleaned: string,
  normalized: string,
  tokens: string[],
  now: Date
): DeterministicParseResult | null {
  const actionScore = inferImplicitSearch(
    scoreAction("search", normalized, tokens),
    cleaned,
    ENTITY_SYNONYMS.project
  );
  const entityScore = scoreEntity("project", normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const status = detectProjectStatus(normalized);
  const due = extractDueDate(cleaned, now);
  const projectType = detectProjectType(normalized);

  const args: Record<string, unknown> = { limit: DEFAULT_SEARCH_LIMIT };
  if (status) args.status = status;
  if (projectType) args.projectType = projectType;
  if (due?.range) args.dueDate = due.range;
  if (due?.exact && !due.range) args.dueDate = { eq: due.exact };
  if (due?.isNull) args.dueDate = { isNull: true };

  const explicitSearchText = extractExplicitSearchText(cleaned);
  const hasFilters = Boolean(status || projectType || due);
  const searchText = explicitSearchText ?? (!hasFilters ? extractSearchText(cleaned, normalized, tokens) : null);
  if (searchText) args.searchText = searchText;

  let argsScore = 0.6;
  if (searchText) argsScore += 0.2;
  if (hasFilters) argsScore += 0.2;

  const specificityBonus = hasFilters ? 0.04 : 0.02;
  const confidence = computeConfidence(actionScore, entityScore, clamp(argsScore, 0, 1), specificityBonus);

  return {
    toolCalls: [{ name: "searchProjects", arguments: args }],
    confidence,
    reason: "search projects",
    responseTemplate: (results) => buildProjectSearchResponse(results[0]),
  };
}

function matchSearchEntity(
  cleaned: string,
  normalized: string,
  tokens: string[],
  entity: keyof typeof ENTITY_SYNONYMS,
  toolName: string,
  label?: string
): DeterministicParseResult | null {
  const actionScore = inferImplicitSearch(
    scoreAction("search", normalized, tokens),
    cleaned,
    ENTITY_SYNONYMS[entity]
  );
  const entityScore = scoreEntity(entity, normalized, tokens);
  if (actionScore < 0.55 || entityScore < 0.55) return null;

  const searchText = extractSearchText(cleaned, normalized, tokens);
  const args: Record<string, unknown> = { limit: DEFAULT_SEARCH_LIMIT };
  if (searchText) args.searchText = searchText;

  const argsScore = searchText ? 0.85 : 0.65;
  const confidence = computeConfidence(actionScore, entityScore, argsScore, 0.01);

  return {
    toolCalls: [{ name: toolName, arguments: args }],
    confidence,
    reason: `search ${entity}`,
    responseTemplate: (results) => buildGenericSearchResponse(results[0], label ?? entity),
  };
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

function buildErrorResponse(toolName: string, result?: DeterministicToolCallResult) {
  const error = result?.error ?? "Unknown error";
  return `Failed to ${toolName}: ${error}`;
}

function buildGenericSearchResponse(result: DeterministicToolCallResult | undefined, label: string) {
  if (!result?.success) return buildErrorResponse(`search ${label}`, result);
  const data = Array.isArray(result.data) ? result.data : [];
  if (data.length === 0) return `No ${label} found.`;
  return `Found ${data.length} ${label}.`;
}

function buildTaskSearchResponse(result: DeterministicToolCallResult | undefined) {
  if (!result?.success) return buildErrorResponse("searchTasks", result);
  const tasks = Array.isArray(result.data) ? (result.data as Array<{ title?: string; status?: string }>) : [];
  if (!tasks.length) return "No tasks found.";
  const list = tasks.slice(0, 10).map((task) => `• ${task.title ?? "Untitled"} (${task.status ?? "todo"})`);
  return `Found ${tasks.length} task(s):\n${list.join("\n")}`;
}

function buildProjectSearchResponse(result: DeterministicToolCallResult | undefined) {
  if (!result?.success) return buildErrorResponse("searchProjects", result);
  const projects = Array.isArray(result.data) ? (result.data as Array<{ name?: string }>) : [];
  if (!projects.length) return "No projects found.";
  const list = projects.slice(0, 10).map((project) => `• ${project.name ?? "Untitled"}`);
  return `Found ${projects.length} project(s):\n${list.join("\n")}`;
}

// ============================================================================
// EXTRACTION + MATCHING HELPERS
// ============================================================================

function normalizePolite(value: string) {
  return value
    .replace(/\s+(?:pls|please|thanks|thank you|thanks!|thanks\.|thank you!|thank you\.)$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function stripQuotedText(value: string) {
  return value.replace(/['"][^'"]*['"]/g, "");
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return value.split(" ").map((token) => token.trim()).filter(Boolean);
}

function singularize(value: string) {
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function levenshtein(a: string, b: string, maxDistance = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let minRow = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      minRow = Math.min(minRow, curr[j]);
    }
    if (minRow > maxDistance) return maxDistance + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function approxTokenScore(token: string, keyword: string) {
  if (!token || !keyword) return 0;
  if (token === keyword) return 1;
  const tokenSingular = singularize(token);
  const keywordSingular = singularize(keyword);
  if (tokenSingular === keywordSingular) return 0.95;

  const maxDist = keyword.length <= 4 ? 1 : keyword.length <= 7 ? 2 : 3;
  const dist = levenshtein(token, keyword, maxDist);
  if (dist > maxDist) return 0;

  const base = 0.9 - dist * 0.05;
  return clamp(base, 0.6, 0.9);
}

function keywordScore(
  normalized: string,
  tokens: string[],
  entries: Array<{ term: string; weight: number }>
) {
  let best = 0;
  for (const entry of entries) {
    const term = entry.term.toLowerCase();
    if (term.includes(" ")) {
      if (normalized.includes(term)) {
        best = Math.max(best, 1 * entry.weight);
      }
      continue;
    }
    for (const token of tokens) {
      const score = approxTokenScore(token, term);
      if (score > 0) {
        best = Math.max(best, score * entry.weight);
      }
    }
  }
  return best;
}

function hasExactTerm(normalized: string, term: string) {
  if (term.includes(" ")) {
    const pattern = new RegExp(`\\b${term.replace(/\s+/g, "\\\\s+")}\\b`, "i");
    return pattern.test(normalized);
  }
  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
  return pattern.test(normalized);
}

function inferImplicitSearch(actionScore: number, cleaned: string, entityWords: string[]) {
  if (actionScore >= 0.55) return actionScore;
  const pattern = new RegExp(
    `^\\s*(?:my\\s+)?(?:${entityWords.map(escapeRegExp).join("|")})\\b`,
    "i"
  );
  if (pattern.test(cleaned)) return 0.8;
  return actionScore;
}

function scoreAction(action: keyof typeof ACTION_SYNONYMS, normalized: string, tokens: string[]) {
  return keywordScore(normalized, tokens, ACTION_SYNONYMS[action]);
}

function scoreEntity(entity: keyof typeof ENTITY_SYNONYMS, normalized: string, tokens: string[]) {
  const synonyms = ENTITY_SYNONYMS[entity];
  const hasExact = synonyms.some((term) => hasExactTerm(normalized, term));
  if (hasExact) return 1;

  const fuzzyScore = keywordScore(
    normalized,
    tokens,
    synonyms.map((term) => ({ term, weight: 1 }))
  );
  if (fuzzyScore === 0) return 0;

  const penalty = ENTITY_FUZZY_PENALTY[entity] ?? 0.8;
  return clamp(fuzzyScore * penalty, 0, 1);
}

function computeConfidence(actionScore: number, entityScore: number, argsScore: number, bonus = 0) {
  const base = actionScore * 0.45 + entityScore * 0.35 + argsScore * 0.2 + bonus;
  return clamp(base, 0, 1);
}

function extractQuoted(value: string) {
  const match = value.match(/['"]([^'"]{2,})['"]/);
  return match ? match[1].trim() : null;
}

function extractAfterKeywords(value: string, keywords: string[]) {
  const pattern = new RegExp(
    `(?:${keywords.join("|")})\\s+['\"]?(.+?)['\"]?(?=$|\\s+(?:with|in|on|for|due|assigned|tagged|priority|status)\\b)`,
    "i"
  );
  const match = value.match(pattern);
  return match ? match[1].trim() : null;
}

function extractAfterEntity(value: string, entityWords: string[]) {
  const pattern = new RegExp(
    `\\b(?:${entityWords.map(escapeRegExp).join("|")})\\b[:\\-]?\\s+(.+)$`,
    "i"
  );
  const match = value.match(pattern);
  if (!match) return null;
  return match[1].trim();
}

function cleanTitle(value: string) {
  return value
    .replace(/^(?:create|make|build|new|need|set up|setup|pls|please)\s+/i, "")
    .replace(/\s+(?:table|task|project|doc|document|note|client|tab)$/i, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/[\s-]+$/g, "")
    .trim()
    .slice(0, MAX_TITLE_CHARS);
}

function extractTitle(value: string, entityWords: string[]) {
  const quoted = extractQuoted(value);
  if (quoted) return cleanTitle(quoted);

  const named = extractAfterKeywords(value, ["called", "named", "titled"]);
  if (named) return cleanTitle(named);

  const afterEntity = extractAfterEntity(value, entityWords);
  if (afterEntity) {
    return cleanTitle(trimTrailingClause(afterEntity));
  }

  return null;
}

function trimTrailingClause(value: string) {
  const trimmed = value.split(/\s+(?:with|due|assigned|tagged|priority|status|in|on|for|at)\b/i)[0];
  return trimmed.trim();
}

function extractSearchText(cleaned: string, normalized: string, tokens: string[]) {
  const explicit = extractExplicitSearchText(cleaned);
  if (explicit) return explicit;

  const filtered = tokens.filter((token) => !IGNORED_SEARCH_TOKENS.has(token));
  if (filtered.length === 0) return null;

  return filtered.join(" ").slice(0, MAX_TITLE_CHARS);
}

function extractExplicitSearchText(cleaned: string) {
  const quoted = extractQuoted(cleaned);
  if (quoted) return cleanTitle(quoted);

  const match = cleaned.match(
    /\b(?:for|about|matching|containing|with|named|called)\s+['"]?(.+?)['"]?(?:$|\s+\b(?:in|on|due|assigned|tagged|priority|status)\b)/i
  );
  if (match) return cleanTitle(match[1]);

  return null;
}

function extractAssignees(value: string) {
  const match = value.match(/\bassigned\s+to\s+(.+?)(?=$|,|;|\bwith\b|\btag\b|\bdue\b|\bpriority\b|\bstatus\b)/i);
  if (!match) return [];
  return splitNameList(match[1]);
}

function extractTags(value: string) {
  const match = value.match(/\btag(?:ged|s)?\s+(.+?)(?=$|,|;|\bdue\b|\bassigned\b|\bpriority\b|\bstatus\b)/i);
  if (!match) return [];
  return splitNameList(match[1]);
}

function splitNameList(value: string) {
  return value
    .split(/,|\band\b/i)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function detectTaskStatus(normalized: string) {
  for (const [status, synonyms] of Object.entries(TASK_STATUS_SYNONYMS)) {
    if (synonyms.some((term) => normalized.includes(term))) return status;
  }
  return undefined;
}

function detectProjectStatus(normalized: string) {
  for (const [status, synonyms] of Object.entries(PROJECT_STATUS_SYNONYMS)) {
    if (synonyms.some((term) => normalized.includes(term))) return status;
  }
  return undefined;
}

function detectProjectType(normalized: string) {
  if (/(?:internal|ops)/i.test(normalized)) return "internal";
  if (/(?:client|external)/i.test(normalized)) return "project";
  return undefined;
}

function detectPriority(normalized: string) {
  for (const [priority, synonyms] of Object.entries(PRIORITY_SYNONYMS)) {
    if (synonyms.some((term) => normalized.includes(term))) return priority;
  }
  return undefined;
}

function extractEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : undefined;
}

function extractPhone(value: string) {
  const match = value.match(/\+?\d[\d\s().-]{7,}\d/);
  return match ? match[0].trim() : undefined;
}

function extractWebsite(value: string) {
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : undefined;
}

function extractDueDate(value: string, now: Date) {
  const lower = value.toLowerCase();
  if (/\b(no due date|without due date|no deadline)\b/i.test(lower)) {
    return { isNull: true } as const;
  }

  if (/\boverdue\b|past due/i.test(lower)) {
    const yesterday = addDays(now, -1);
    return { range: { lte: formatDate(yesterday) } } as const;
  }

  const match = value.match(/\bdue(?:\s+on|\s+by)?\s+([^.,;]+)/i);
  const phrase = match ? match[1].trim() : null;

  const parsed = parseDatePhrase(phrase ?? value, now);
  if (!parsed) return null;

  if (parsed.kind === "exact") return { exact: parsed.date } as const;
  if (parsed.kind === "range") return { range: parsed.range } as const;

  return null;
}

function parseDatePhrase(phrase: string, now: Date) {
  const text = phrase.toLowerCase();
  const normalized = text
    .replace(/\btdy\b/g, "today")
    .replace(/\btmrw\b|\btmr\b/g, "tomorrow")
    .replace(/\btomm?or+ow\b|\btomm?orrow\b/g, "tomorrow")
    .replace(/\byday\b|\bystrdy\b/g, "yesterday");

  const isoMatch = normalized.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return { kind: "exact" as const, date: isoMatch[1] };
  }

  if (/\btoday\b/.test(normalized)) {
    return { kind: "exact" as const, date: formatDate(now) };
  }
  if (/\btomorrow\b/.test(normalized)) {
    return { kind: "exact" as const, date: formatDate(addDays(now, 1)) };
  }
  if (/\byesterday\b/.test(normalized)) {
    return { kind: "exact" as const, date: formatDate(addDays(now, -1)) };
  }
  if (/\bnext week\b/.test(normalized)) {
    return { kind: "exact" as const, date: formatDate(addDays(now, 7)) };
  }
  if (/\bthis week\b/.test(normalized)) {
    return {
      kind: "range" as const,
      range: { gte: formatDate(now), lte: formatDate(addDays(now, 7)) },
    };
  }
  if (/\bnext month\b/.test(normalized)) {
    return { kind: "exact" as const, date: formatDate(addDays(now, 30)) };
  }

  return null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function parseColumnList(raw: string): string[] {
  let parts = raw.trim().split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);

  if (parts.length === 1 && parts[0].includes(" ") && !parts[0].match(/\band\b/i)) {
    if (/^[a-z0-9_ ]+$/i.test(parts[0])) {
      parts = parts[0].split(/\s+/);
    }
  }

  const result: string[] = [];
  for (const part of parts) {
    const stripped = part.replace(/^and\s+/i, "");
    const andParts = stripped.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
    for (const name of andParts) {
      const cleaned = name.replace(/^['"]|['"]$/g, "").trim();
      if (cleaned) result.push(cleaned);
    }
  }
  return result;
}

function inferFieldType(name: string) {
  const lower = name.toLowerCase();
  if (/(status|state|stage)/.test(lower)) return "status";
  if (/(priority|importance)/.test(lower)) return "priority";
  if (/(date|due|deadline)/.test(lower)) return "date";
  if (/(email)/.test(lower)) return "email";
  if (/(phone|tel)/.test(lower)) return "phone";
  if (/(url|link|website)/.test(lower)) return "url";
  if (/(amount|price|cost|budget)/.test(lower)) return "currency";
  if (/(percent|%)/.test(lower)) return "percent";
  if (/(rating|score)/.test(lower)) return "rating";
  if (/(number|count|qty|quantity)/.test(lower)) return "number";
  return "text";
}

function isMultiStepCommand(value: string) {
  const multiStep = /\b(?:then|also|after that|next)\b/i;
  const actionAfterAnd =
    /\b(?:and)\s+(?:assign|add|set|tag|move|delete|remove|update|rename|change|populate|fill|insert|attach|link|copy|duplicate|archive|complete|close|open|share|export|import)\b/i;
  return multiStep.test(value) || actionAfterAnd.test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
