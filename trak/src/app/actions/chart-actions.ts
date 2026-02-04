"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getTabMetadata } from "@/lib/auth-utils";
import { getAuthContext, type AuthContext } from "@/lib/auth-context";
import { createBlock, updateBlock, deleteBlock } from "@/app/actions/block";
import { getTable } from "@/app/actions/tables/table-actions";
import { getTableRows } from "@/app/actions/tables/query-actions";
import { getTaskItemsByBlock } from "@/app/actions/tasks/query-actions";
import { getTimelineItems } from "@/app/actions/timelines/query-actions";
import { getOrCreateFileAnalysisSession } from "@/app/actions/file-analysis";
import { searchAll, searchBlocks, searchTables } from "@/app/actions/ai-search";
import { generateChartCode } from "@/lib/ai/chart-generator";
import { detectFileKind } from "@/lib/file-analysis/extractor";
import { getSessionFiles, getTabAttachedFiles } from "@/lib/file-analysis/context";
import { ensureFileArtifact, type FileRecord } from "@/lib/file-analysis/service";
import type { ChartBlockContent, ChartType } from "@/types/chart";
import type { TableField } from "@/types/table";

export type ChartActionResult<T> = { data: T } | { error: string };

interface InlineSeries {
  labels: string[];
  values: number[];
}

interface ChartDataContext {
  inlineSeries?: InlineSeries;
  tables?: Array<{
    blockId?: string;
    tableId: string;
    title?: string | null;
    fields: Array<{ id: string; name: string; type: string }>;
    rows: Array<Record<string, unknown>>;
  }>;
  taskBlocks?: Array<{
    blockId: string;
    title?: string | null;
    tasks: Array<Record<string, unknown>>;
  }>;
  timelineBlocks?: Array<{
    blockId: string;
    title?: string | null;
    events: Array<Record<string, unknown>>;
  }>;
  fileTables?: Array<{
    fileId: string;
    fileName: string;
    tables: Array<{
      name: string;
      headers: string[];
      rows: Array<Array<string | number | null>>;
    }>;
  }>;
  ragResults?: Array<{
    type?: string;
    id?: string;
    name?: string;
    summary?: string;
    content?: string;
  }>;
}

const MAX_TABLE_ROWS = 40;
const MAX_FILE_TABLES = 3;
const MAX_FILE_ROWS = 40;
const MAX_SUMMARY_LINES = 12;

const PROMPT_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "please",
  "show",
  "make",
  "create",
  "build",
  "generate",
  "chart",
  "graph",
  "visualize",
  "plot",
  "compare",
  "comparison",
  "vs",
  "versus",
  "over",
  "time",
  "trend",
  "trends",
  "data",
  "report",
  "status",
  "tasks",
  "task",
  "timeline",
  "table",
  "list",
  "summary",
  "rate",
  "percent",
  "percentage",
]);

function sanitizeSearchText(text: string) {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPromptKeywords(prompt: string) {
  const phrases: string[] = [];
  const phraseRegex = /"([^"]+)"|'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = phraseRegex.exec(prompt))) {
    const phrase = (match[1] || match[2] || "").trim();
    if (phrase) phrases.push(phrase.toLowerCase());
  }

  const normalized = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !PROMPT_STOP_WORDS.has(token));

  const tokens = Array.from(new Set(normalized));
  return { tokens, phrases };
}

function scoreTextMatch(text: string, tokens: string[], phrases: string[]) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const phrase of phrases) {
    if (phrase && lower.includes(phrase)) score += 4;
  }
  for (const token of tokens) {
    if (token && lower.includes(token)) score += 1;
  }
  return score;
}

function isTimeLikeLabel(label: string) {
  const lower = label.toLowerCase();
  if (/^q[1-4]$/.test(lower)) return true;
  if (/^\d{4}$/.test(lower)) return true;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(lower)) return true;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(lower)) return true;
  return false;
}

function suggestChartTypeFromLabels(labels: string[], prompt: string): ChartType {
  const timeLikeCount = labels.filter((label) => isTimeLikeLabel(label)).length;
  const wantsShare = /(share|portion|percent|percentage|composition|breakdown|distribution)/i.test(prompt);
  if (labels.length && timeLikeCount >= Math.ceil(labels.length * 0.6)) return "line";
  if (labels.length <= 6 && wantsShare) return "doughnut";
  return "bar";
}

function detectChartTypeFromPrompt(prompt: string): ChartType | undefined {
  const lower = prompt.toLowerCase();
  if (/(doughnut|donut)\s+chart|doughnut|donut/.test(lower)) return "doughnut";
  if (/pie\s+chart|pie/.test(lower)) return "pie";
  if (/line\s+chart|line graph|trend/.test(lower)) return "line";
  if (/bar\s+chart|bar graph|histogram/.test(lower)) return "bar";
  return undefined;
}

function detectChartTypeFromCode(code: string): ChartType | undefined {
  if (/<Line\b/.test(code)) return "line";
  if (/<Pie\b/.test(code)) return "pie";
  if (/<Doughnut\b/.test(code)) return "doughnut";
  if (/<Bar\b/.test(code)) return "bar";
  return undefined;
}

function parseInlineSeries(prompt: string): InlineSeries | undefined {
  const labels: string[] = [];
  const values: number[] = [];

  const pairRegex = /([A-Za-z0-9][\w\s.&/%-]{0,40}?)\s*[:=\\-]\s*(-?\d+(?:\.\d+)?%?)/g;
  const parenRegex = /([A-Za-z0-9][\w\s.&/%-]{0,40}?)\s*\(\s*(-?\d+(?:\.\d+)?%?)\s*\)/g;

  const collectMatch = (match: RegExpMatchArray) => {
    const label = match[1]?.trim();
    const rawValue = match[2]?.trim();
    if (!label || !rawValue) return;
    const numeric = Number(rawValue.replace("%", ""));
    if (Number.isNaN(numeric)) return;
    labels.push(label);
    values.push(numeric);
  };

  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(prompt))) collectMatch(match);
  while ((match = parenRegex.exec(prompt))) collectMatch(match);

  if (labels.length < 2) {
    const segments = prompt
      .split(/\n|,|;/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (const segment of segments) {
      const fallback = segment.match(/^(.*?)[\s:=-]+(-?\d+(?:\.\d+)?%?)\s*$/);
      if (!fallback) continue;
      collectMatch(fallback);
    }
  }

  if (labels.length >= 2) {
    return { labels, values };
  }
  return undefined;
}

function deriveTitle(prompt: string) {
  const cleaned = prompt
    .replace(/\b(create|make|build|show|visualize|graph|chart|plot)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Chart";
  if (cleaned.length <= 70) return cleaned;
  return cleaned.slice(0, 67) + "...";
}

function mapSelectValue(value: unknown, field: TableField) {
  const config = field.config as any;
  if (!config) return value;

  if (field.type === "select" || field.type === "status") {
    const options = Array.isArray(config.options) ? config.options : [];
    const match = options.find((opt: any) => opt.id === value);
    return match?.label ?? value;
  }

  if (field.type === "multi_select") {
    const options = Array.isArray(config.options) ? config.options : [];
    if (!Array.isArray(value)) return value;
    return value.map((entry) => options.find((opt: any) => opt.id === entry)?.label ?? entry);
  }

  if (field.type === "priority") {
    const levels = Array.isArray(config.levels) ? config.levels : [];
    const match = levels.find((lvl: any) => lvl.id === value);
    return match?.label ?? value;
  }

  return value;
}

async function collectFileTables(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  projectId?: string | null;
  tabId?: string | null;
  promptTokens?: string[];
  promptPhrases?: string[];
  allowAllFiles?: boolean;
}): Promise<ChartDataContext["fileTables"]> {
  const { supabase, workspaceId, projectId, tabId, promptTokens = [], promptPhrases = [], allowAllFiles = false } = params;
  const sessionResult = await getOrCreateFileAnalysisSession({
    workspaceId,
    projectId: projectId ?? undefined,
    tabId: tabId ?? undefined,
  });

  const files: FileRecord[] = [];
  if ("data" in sessionResult) {
    const sessionFiles = await getSessionFiles(supabase, sessionResult.data.id);
    files.push(...(sessionFiles as FileRecord[]));
  }

  if (tabId) {
    const attached = await getTabAttachedFiles(supabase, [tabId]);
    files.push(...(attached as FileRecord[]));
  }

  const seen = new Set<string>();
  const uniqueFiles = files.filter((file) => {
    if (seen.has(file.id)) return false;
    seen.add(file.id);
    return true;
  });

  const csvLike = uniqueFiles.filter((file) => {
    const kind = detectFileKind(file.file_name, file.file_type);
    return kind === "csv" || kind === "xlsx";
  });

  const hasPromptHints = promptTokens.length > 0 || promptPhrases.length > 0;
  const scoredFiles = csvLike.map((file) => {
    const score = scoreTextMatch(file.file_name, promptTokens, promptPhrases);
    return { file, score };
  });
  const matchingFiles = scoredFiles.filter((entry) => entry.score > 0).map((entry) => entry.file);
  if (hasPromptHints && matchingFiles.length === 0 && !allowAllFiles) {
    return undefined;
  }
  const filesToScan = hasPromptHints && matchingFiles.length > 0 ? matchingFiles : csvLike;

  const fileTables: ChartDataContext["fileTables"] = [];

  for (const file of filesToScan.slice(0, 5)) {
    try {
      const artifact = await ensureFileArtifact(supabase, file);
      if (!artifact.extracted_tables || artifact.extracted_tables.length === 0) continue;

      const tables = artifact.extracted_tables.slice(0, MAX_FILE_TABLES).map((table) => ({
        name: table.name,
        headers: table.headers,
        rows: table.rows.slice(0, MAX_FILE_ROWS),
      }));

      fileTables.push({
        fileId: file.id,
        fileName: file.file_name,
        tables,
      });
    } catch {
      // Ignore file extraction errors
    }
  }

  return fileTables.length ? fileTables : undefined;
}

function pickLabelValueFields(rows: Array<Record<string, unknown>>) {
  const numericScores = new Map<string, number>();
  const textScores = new Map<string, number>();

  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (key === "id") return;
      if (typeof value === "number" && !Number.isNaN(value)) {
        numericScores.set(key, (numericScores.get(key) || 0) + 1);
      } else if (typeof value === "string" && value.trim()) {
        textScores.set(key, (textScores.get(key) || 0) + 1);
      }
    });
  });

  const labelKey = Array.from(textScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const valueKey = Array.from(numericScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { labelKey, valueKey };
}

function summarizeInlineSeries(series: InlineSeries, prompt: string) {
  const lines = series.labels.map((label, idx) => `- ${label}: ${series.values[idx]}`);
  const suggestedChartType = suggestChartTypeFromLabels(series.labels, prompt);
  return { lines, suggestedChartType };
}

function summarizeTableData(table: NonNullable<ChartDataContext["tables"]>[number], prompt: string) {
  const rows = table.rows || [];
  if (!rows.length) {
    return { lines: [`- ${table.title || "Table"}: no rows found`], suggestedChartType: "bar" as ChartType };
  }
  const { labelKey, valueKey } = pickLabelValueFields(rows);
  if (labelKey && valueKey) {
    const labels = rows.map((row) => String(row[labelKey] ?? "")).filter(Boolean);
    const lines = rows.slice(0, MAX_SUMMARY_LINES).map((row) => `- ${row[labelKey]}: ${row[valueKey]}`);
    return { lines, suggestedChartType: suggestChartTypeFromLabels(labels, prompt) };
  }
  const lines = rows.slice(0, MAX_SUMMARY_LINES).map((row) => `- ${JSON.stringify(row)}`);
  return { lines, suggestedChartType: "bar" as ChartType };
}

function summarizeFileTable(table: { name: string; headers: string[]; rows: Array<Array<string | number | null>> }, prompt: string) {
  const rows = table.rows || [];
  if (!rows.length || !table.headers.length) {
    return { lines: [`- ${table.name}: no rows found`], suggestedChartType: "bar" as ChartType };
  }
  const headerScores = table.headers.map((header, idx) => {
    let numericCount = 0;
    let textCount = 0;
    for (const row of rows) {
      const value = row[idx];
      if (typeof value === "number") numericCount += 1;
      if (typeof value === "string" && value.trim()) textCount += 1;
    }
    return { header, idx, numericCount, textCount };
  });

  const labelHeader = headerScores.sort((a, b) => b.textCount - a.textCount)[0];
  const valueHeader = headerScores.sort((a, b) => b.numericCount - a.numericCount)[0];

  if (labelHeader && valueHeader) {
    const labels = rows.map((row) => String(row[labelHeader.idx] ?? "")).filter(Boolean);
    const lines = rows.slice(0, MAX_SUMMARY_LINES).map((row) => `- ${row[labelHeader.idx]}: ${row[valueHeader.idx]}`);
    return { lines, suggestedChartType: suggestChartTypeFromLabels(labels, prompt) };
  }

  const lines = rows.slice(0, MAX_SUMMARY_LINES).map((row) => `- ${row.join(", ")}`);
  return { lines, suggestedChartType: "bar" as ChartType };
}

function summarizeTaskBlocks(taskBlocks: NonNullable<ChartDataContext["taskBlocks"]>, prompt: string) {
  const statusCounts = { todo: 0, "in-progress": 0, done: 0 };
  taskBlocks.forEach((block) => {
    block.tasks.forEach((task) => {
      const status = (task.status as keyof typeof statusCounts) || "todo";
      if (status in statusCounts) statusCounts[status] += 1;
    });
  });

  const lines = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `- ${status}: ${count}`);
  const normalizedLines = lines.length ? lines : ["- No tasks found"];
  const wantsShare = /(rate|percent|percentage|completion)/i.test(prompt);
  return { lines: normalizedLines, suggestedChartType: wantsShare ? ("doughnut" as ChartType) : ("bar" as ChartType) };
}

function summarizeTimelineBlocks(timelineBlocks: NonNullable<ChartDataContext["timelineBlocks"]>) {
  const bucket = new Map<string, number>();
  timelineBlocks.forEach((block) => {
    block.events.forEach((event) => {
      const date = event.start as string | undefined;
      if (!date) return;
      const key = date.slice(0, 7);
      bucket.set(key, (bucket.get(key) || 0) + 1);
    });
  });
  const lines = Array.from(bucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, MAX_SUMMARY_LINES)
    .map(([month, count]) => `- ${month}: ${count}`);
  const normalizedLines = lines.length ? lines : ["- No timeline events found"];
  return { lines: normalizedLines, suggestedChartType: "line" as ChartType };
}

function summarizeChartContext(context: ChartDataContext, prompt: string) {
  if (context.inlineSeries) {
    return summarizeInlineSeries(context.inlineSeries, prompt);
  }

  if (context.tables && context.tables.length > 0) {
    return summarizeTableData(context.tables[0], prompt);
  }

  if (context.fileTables && context.fileTables.length > 0) {
    const fileTable = context.fileTables[0].tables?.[0];
    if (fileTable) {
      return summarizeFileTable(fileTable, prompt);
    }
  }

  if (context.taskBlocks && context.taskBlocks.length > 0) {
    return summarizeTaskBlocks(context.taskBlocks, prompt);
  }

  if (context.timelineBlocks && context.timelineBlocks.length > 0) {
    return summarizeTimelineBlocks(context.timelineBlocks);
  }

  if (context.ragResults && context.ragResults.length > 0) {
    const lines = context.ragResults.slice(0, MAX_SUMMARY_LINES).map((item) => {
      const label = item.name || item.type || "Result";
      const summary = item.summary || item.content || "";
      return summary ? `- ${label}: ${summary}` : `- ${label}`;
    });
    return { lines, suggestedChartType: "bar" as ChartType };
  }

  return { lines: ["- No structured data found in this tab."], suggestedChartType: "bar" as ChartType };
}

async function buildChartContext(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspaceId: string;
  projectId?: string | null;
  tabId: string;
  prompt: string;
  authContext: AuthContext;
  explicitData?: Record<string, unknown> | null;
}) {
  const { supabase, workspaceId, projectId, tabId, prompt, authContext, explicitData } = params;
  const { tokens, phrases } = extractPromptKeywords(prompt);
  const hasPromptHints = tokens.length > 0 || phrases.length > 0;
  const allowAllFiles = /(csv|xlsx|excel|spreadsheet|upload|uploaded|attachment|file)/i.test(prompt);

  let { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, content")
    .eq("tab_id", tabId)
    .in("type", ["table", "task", "timeline"]);

  const inlineSeries = parseInlineSeries(prompt);

  const tables: Array<NonNullable<ChartDataContext["tables"]>[number] & { matchScore: number }> = [];
  const taskBlocks: Array<NonNullable<ChartDataContext["taskBlocks"]>[number] & { matchScore: number }> = [];
  const timelineBlocks: Array<NonNullable<ChartDataContext["timelineBlocks"]>[number] & { matchScore: number }> = [];

  const pushBlockData = async (block: { id: string; type: string; content: unknown }) => {
    if (block.type === "table") {
      const tableId = (block.content as any)?.tableId;
      if (!tableId) return;
      const tableResult = await getTable(tableId, { authContext });
      if ("error" in tableResult) return;
      const rowsResult = await getTableRows(tableId, { limit: MAX_TABLE_ROWS, authContext });
      if ("error" in rowsResult) return;

      const fields = tableResult.data.fields;
      const fieldMap = new Map(fields.map((field) => [field.id, field]));
      const formattedRows = rowsResult.data.rows.map((row) => {
        const mapped: Record<string, unknown> = { id: row.id };
        Object.entries(row.data || {}).forEach(([fieldId, value]) => {
          const field = fieldMap.get(fieldId);
          const key = field?.name ?? fieldId;
          mapped[key] = field ? mapSelectValue(value, field) : value;
        });
        return mapped;
      });

      const tableTitle = tableResult.data.table.title;
      const rowSample = formattedRows
        .slice(0, 5)
        .map((row) => Object.values(row).join(" "))
        .join(" ");
      const matchScore = scoreTextMatch(
        `${tableTitle || ""} ${fields.map((field) => field.name).join(" ")} ${rowSample}`,
        tokens,
        phrases
      );

      tables.push({
        blockId: block.id,
        tableId,
        title: tableTitle,
        fields: fields.map((field) => ({ id: field.id, name: field.name, type: field.type })),
        rows: formattedRows,
        matchScore,
      });
    }

    if (block.type === "task") {
      const tasksResult = await getTaskItemsByBlock(block.id);
      if ("error" in tasksResult) return;
      const title = (block.content as any)?.title ?? null;
      const taskSample = tasksResult.data.slice(0, 6).map((task) => task.text).join(" ");
      const matchScore = scoreTextMatch(`${title || ""} ${taskSample}`, tokens, phrases);
      taskBlocks.push({
        blockId: block.id,
        title,
        tasks: tasksResult.data.map((task) => ({
          id: task.id,
          text: task.text,
          status: task.status,
          priority: task.priority,
          assignees: task.assignees,
          dueDate: task.dueDate,
          tags: task.tags,
        })),
        matchScore,
      });
    }

    if (block.type === "timeline") {
      const timelineResult = await getTimelineItems(block.id, { authContext });
      if ("error" in timelineResult) return;
      const title = (block.content as any)?.title ?? null;
      const eventSample = timelineResult.data.events.slice(0, 6).map((event) => event.title).join(" ");
      const matchScore = scoreTextMatch(`${title || ""} ${eventSample}`, tokens, phrases);
      timelineBlocks.push({
        blockId: block.id,
        title,
        events: timelineResult.data.events.map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start_date,
          end: event.end_date,
          status: event.status,
          progress: event.progress,
          assigneeId: event.assignee_id,
        })),
        matchScore,
      });
    }
  };

  if (hasPromptHints && /\btable\b/i.test(prompt)) {
    const searchResult = await searchBlocks({
      searchText: sanitizeSearchText(prompt),
      type: "table",
      projectId: projectId ?? undefined,
      limit: 3,
    });

    if (searchResult.data && searchResult.data.length > 0) {
      const supplementalBlocks = searchResult.data.map((entry) => ({
        id: entry.id,
        type: "table" as const,
        content: entry.content,
      }));
      blocks = [...(blocks || []), ...supplementalBlocks];
    }
  }

  for (const block of blocks || []) {
    await pushBlockData(block);
  }

  const hadLocalTableMatches = tables.some((table) => table.matchScore > 0);
  if (hasPromptHints && /\btable\b/i.test(prompt) && !hadLocalTableMatches) {
    const sanitized = sanitizeSearchText(prompt);
    const tablesResult = await searchTables({
      searchText: sanitized || prompt,
      limit: 5,
    });

    if (tablesResult.data && tablesResult.data.length > 0) {
      const scored = tablesResult.data.map((table) => ({
        table,
        score: scoreTextMatch(`${table.title || ""} ${table.description || ""}`, tokens, phrases),
      }));
      const ranked = scored
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      for (const entry of ranked) {
        const tableId = entry.table.id;
        const tableResult = await getTable(tableId, { authContext });
        if ("error" in tableResult) continue;
        const rowsResult = await getTableRows(tableId, { limit: MAX_TABLE_ROWS, authContext });
        if ("error" in rowsResult) continue;

        const fields = tableResult.data.fields;
        const fieldMap = new Map(fields.map((field) => [field.id, field]));
        const formattedRows = rowsResult.data.rows.map((row) => {
          const mapped: Record<string, unknown> = { id: row.id };
          Object.entries(row.data || {}).forEach(([fieldId, value]) => {
            const field = fieldMap.get(fieldId);
            const key = field?.name ?? fieldId;
            mapped[key] = field ? mapSelectValue(value, field) : value;
          });
          return mapped;
        });

        tables.push({
          tableId,
          title: tableResult.data.table.title,
          fields: fields.map((field) => ({ id: field.id, name: field.name, type: field.type })),
          rows: formattedRows,
          matchScore: entry.score,
        });
      }
    }
  }

  const fileTables = await collectFileTables({
    supabase,
    workspaceId,
    projectId,
    tabId,
    promptTokens: tokens,
    promptPhrases: phrases,
    allowAllFiles,
  });

  const maxMatchScore = Math.max(
    0,
    ...tables.map((table) => table.matchScore),
    ...taskBlocks.map((block) => block.matchScore),
    ...timelineBlocks.map((block) => block.matchScore)
  );

  const hasMatches = maxMatchScore > 0;

  const filteredTables = hasPromptHints && hasMatches
    ? tables.filter((table) => table.matchScore > 0)
    : hasPromptHints && !hasMatches
      ? []
      : tables;
  const filteredTasks = hasPromptHints && hasMatches
    ? taskBlocks.filter((block) => block.matchScore > 0)
    : hasPromptHints && !hasMatches
      ? []
      : taskBlocks;
  const filteredTimelines = hasPromptHints && hasMatches
    ? timelineBlocks.filter((block) => block.matchScore > 0)
    : hasPromptHints && !hasMatches
      ? []
      : timelineBlocks;

  const structuredAvailable = Boolean(
    inlineSeries ||
    (filteredTables && filteredTables.length) ||
    (filteredTasks && filteredTasks.length) ||
    (filteredTimelines && filteredTimelines.length) ||
    (fileTables && fileTables.length) ||
    explicitData
  );

  let ragResults: ChartDataContext["ragResults"] = undefined;
  if (!structuredAvailable) {
    const rag = await searchAll({
      searchText: prompt,
      projectId: projectId ?? undefined,
      limit: 3,
      includeContent: true,
    });
    if (rag.data) {
      ragResults = rag.data.map((entry) => ({
        type: entry.type,
        id: entry.id,
        name: entry.name,
        summary: entry.description,
      }));
    }
  }

  const dataContext: ChartDataContext = {
    inlineSeries,
    tables: filteredTables.length ? filteredTables.map(({ matchScore, ...table }) => table) : undefined,
    taskBlocks: filteredTasks.length ? filteredTasks.map(({ matchScore, ...block }) => block) : undefined,
    timelineBlocks: filteredTimelines.length ? filteredTimelines.map(({ matchScore, ...block }) => block) : undefined,
    fileTables,
    ragResults,
  };

  return { dataContext, structuredAvailable };
}

export async function getChartSuggestion(params: {
  tabId: string;
  prompt: string;
  authContext?: AuthContext;
}): Promise<ChartActionResult<{ summary: string; suggestedChartType: ChartType }>> {
  try {
    const authContext = params.authContext ?? (await getAuthContext());
    if ("error" in authContext) return { error: authContext.error };

    const { supabase, userId } = authContext;

    let tabMeta = await getTabMetadata(params.tabId);
    if (!tabMeta) return { error: "Tab not found" };

    let workspaceId = (tabMeta.projects as any).workspace_id as string | undefined;
    if (!workspaceId) return { error: "Workspace not found" };

    let projectId = tabMeta.project_id as string | null;

    const { dataContext } = await buildChartContext({
      supabase,
      workspaceId,
      projectId,
      tabId: params.tabId,
      prompt: params.prompt,
      authContext,
    });

    const summaryResult = summarizeChartContext(dataContext, params.prompt);
    const summaryLines = summaryResult.lines.slice(0, MAX_SUMMARY_LINES);
    const summary = summaryLines.length
      ? ["Here’s the data I found:", ...summaryLines].join("\n")
      : "Here’s the data I found.";

    return { data: { summary, suggestedChartType: summaryResult.suggestedChartType } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to build chart suggestion" };
  }
}

export async function createChartBlock(params: {
  tabId: string;
  prompt: string;
  chartType?: ChartType;
  title?: string | null;
  isSimulation?: boolean;
  originalChartId?: string | null;
  simulationDescription?: string | null;
  explicitData?: Record<string, unknown> | null;
  authContext?: AuthContext;
}): Promise<ChartActionResult<{ blockId: string }>> {
  try {
    const authContext = params.authContext ?? (await getAuthContext());
    if ("error" in authContext) return { error: authContext.error };

    const { supabase, userId } = authContext;

    let tabMeta = await getTabMetadata(params.tabId);
    if (!tabMeta) return { error: "Tab not found" };

    let workspaceId = (tabMeta.projects as any).workspace_id as string | undefined;
    if (!workspaceId) return { error: "Workspace not found" };

    let projectId = tabMeta.project_id as string | null;

    let originalChartCode: string | undefined;
    let originalChartType: ChartType | undefined;
    let originalChartTitle: string | undefined;
    let originalChartPosition: number | undefined;
    let originalChartColumn: number | undefined;
    let originalChartParentId: string | null | undefined;
    let originalChartTabId: string | undefined;
    if (params.originalChartId) {
      const { data: originalBlock } = await supabase
        .from("blocks")
        .select("id, type, content, position, column, parent_block_id, tab_id")
        .eq("id", params.originalChartId)
        .single();

      if (originalBlock && originalBlock.type === "chart") {
        originalChartCode = (originalBlock.content as any)?.code as string | undefined;
        originalChartType = (originalBlock.content as any)?.chartType as ChartType | undefined;
        originalChartTitle = (originalBlock.content as any)?.title as string | undefined;
        originalChartPosition = originalBlock.position ?? undefined;
        originalChartColumn = originalBlock.column ?? undefined;
        originalChartParentId = originalBlock.parent_block_id ?? undefined;
        originalChartTabId = originalBlock.tab_id ?? undefined;
      }
    }
    const targetTabId = originalChartTabId || params.tabId;

    if (targetTabId !== params.tabId) {
      const targetMeta = await getTabMetadata(targetTabId);
      if (!targetMeta) return { error: "Target tab not found" };
      tabMeta = targetMeta;
      workspaceId = (targetMeta.projects as any).workspace_id as string | undefined;
      if (!workspaceId) return { error: "Workspace not found" };
      projectId = targetMeta.project_id as string | null;
    }

    const membership = await checkWorkspaceMembership(workspaceId, userId);
    if (!membership) return { error: "Not a member of this workspace" };

    const { dataContext } = await buildChartContext({
      supabase,
      workspaceId,
      projectId,
      tabId: targetTabId,
      prompt: params.prompt,
      authContext,
      explicitData: params.explicitData,
    });

    const chartTypeHint = params.chartType || detectChartTypeFromPrompt(params.prompt) || originalChartType;

    const dataContextForGeneration = (params.explicitData
      ? { ...dataContext, explicitData: params.explicitData }
      : dataContext) as Record<string, unknown>;

    const generated = await generateChartCode({
      prompt: params.prompt,
      chartType: chartTypeHint,
      title: params.title,
      dataContext: dataContextForGeneration,
      isSimulation: params.isSimulation,
      originalChartCode,
      simulationDescription: params.simulationDescription,
    });

    const inferredType = detectChartTypeFromCode(generated.code) ?? chartTypeHint ?? "bar";
    const title =
      params.title ??
      (params.isSimulation && originalChartTitle
        ? `${originalChartTitle} (Simulation)`
        : deriveTitle(params.prompt));

    const chartContent: ChartBlockContent = {
      code: generated.code,
      chartType: inferredType,
      title,
      metadata: {
        sourcePrompt: params.prompt,
        sourceBlockIds: [
          ...(dataContext.tables || []).map((table) => table.blockId),
          ...(dataContext.taskBlocks || []).map((task) => task.blockId),
          ...(dataContext.timelineBlocks || []).map((timeline) => timeline.blockId),
        ].filter(Boolean) as string[],
        sourceFileIds: dataContext.fileTables?.map((file) => file.fileId),
        isSimulation: params.isSimulation,
        originalChartId: params.originalChartId ?? null,
        description: params.simulationDescription ?? undefined,
      },
    };

    const blockResult = await createBlock({
      tabId: targetTabId,
      type: "chart",
      content: chartContent as any,
      authContext,
      position: params.isSimulation && originalChartPosition !== undefined ? originalChartPosition + 0.01 : undefined,
      column: params.isSimulation && originalChartColumn !== undefined ? originalChartColumn : undefined,
      parentBlockId: params.isSimulation ? originalChartParentId ?? undefined : undefined,
    });

    if ("error" in blockResult) {
      return { error: blockResult.error ?? "Failed to create chart block" };
    }

    return { data: { blockId: blockResult.data.id } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create chart" };
  }
}

export async function updateChartBlock(params: {
  blockId: string;
  content: ChartBlockContent;
  authContext?: AuthContext;
}): Promise<ChartActionResult<{ blockId: string }>> {
  const result = await updateBlock({
    blockId: params.blockId,
    content: params.content as any,
  });

  if ("error" in result) {
    return { error: result.error ?? "Failed to update chart block" };
  }

  return { data: { blockId: params.blockId } };
}

export async function updateChartCustomization(params: {
  blockId: string;
  title?: string | null;
  labels?: string[];
  values?: number[];
  colors?: string[];
  height?: number | null;
  authContext?: AuthContext;
}): Promise<ChartActionResult<{ blockId: string }>> {
  try {
    const authContext = params.authContext ?? (await getAuthContext());
    if ("error" in authContext) return { error: authContext.error };

    const { supabase, userId } = authContext;

    const { data: block } = await supabase
      .from("blocks")
      .select("id, type, content")
      .eq("id", params.blockId)
      .single();

    if (!block || block.type !== "chart") {
      return { error: "Chart block not found" };
    }

    const content = (block.content || {}) as ChartBlockContent;
    const chartType = content.chartType;
    const title = params.title ?? content.title ?? undefined;

    const explicitData: Record<string, unknown> = {};
    if (params.labels && params.labels.length > 0) explicitData.labels = params.labels;
    if (params.values && params.values.length > 0) explicitData.values = params.values;
    if (params.colors && params.colors.length > 0) explicitData.colors = params.colors;
    if (params.height) explicitData.height = params.height;

    const generated = await generateChartCode({
      prompt: "Update the chart with the provided customization data.",
      chartType,
      title,
      dataContext: Object.keys(explicitData).length > 0 ? { explicitData } : null,
    });

    const updatedContent: ChartBlockContent = {
      ...content,
      code: generated.code,
      chartType,
      title,
      metadata: {
        ...(content.metadata || {}),
        customization: {
          title: title ?? null,
          labels: params.labels,
          values: params.values,
          colors: params.colors,
          height: params.height ?? null,
        },
      },
    };

    const result = await updateBlock({
      blockId: params.blockId,
      content: updatedContent as any,
    });

    if ("error" in result) {
      return { error: result.error ?? "Failed to update chart" };
    }

    return { data: { blockId: params.blockId } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update chart" };
  }
}

export async function deleteChartBlock(params: {
  blockId: string;
  authContext?: AuthContext;
}): Promise<ChartActionResult<{ blockId: string }>> {
  const result = await deleteBlock(params.blockId, { authContext: params.authContext });

  if ("error" in result) {
    return { error: result.error ?? "Failed to delete chart block" };
  }

  return { data: { blockId: params.blockId } };
}
