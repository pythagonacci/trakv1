/**
 * Simple Command Fast Path
 * 
 * Pattern-matching system to execute simple commands WITHOUT calling the LLM.
 * This dramatically reduces latency for straightforward create/search operations.
 */

import { executeTool, type ToolCallResult } from "./tool-executor";
import type { ExecutionContext, ExecutionResult } from "./executor";
import { aiDebug } from "./debug";

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

interface SimpleCommandPattern {
    /** Regex pattern to match the command */
    pattern: RegExp;
    /** Tool to execute */
    tool: string;
    /** Function to extract arguments from the match */
    extractArgs: (match: RegExpMatchArray, context: ExecutionContext) => Record<string, unknown>;
    /** Response template */
    responseTemplate: (result: ToolCallResult, args: Record<string, unknown>) => string;
}

const SIMPLE_PATTERNS: SimpleCommandPattern[] = [
    // "create a table called X" / "create a new table called X" / "create table named X"
    {
        pattern: /^create\s+(?:a\s+)?(?:new\s+)?table\s+(?:called|named|titled)\s+["\']?(.+?)["\']?\s*$/i,
        tool: "createTable",
        extractArgs: (match, context) => ({
            title: match[1].trim(),
            workspaceId: context.workspaceId,
            projectId: context.currentProjectId,
            tabId: context.currentTabId,
        }),
        responseTemplate: (result, args) =>
            result.success
                ? `Created table "${args.title}".`
                : `Failed to create table: ${result.error}`,
    },

    // "create a task called X" / "create task named X"
    {
        pattern: /^create\s+(?:a\s+)?(?:new\s+)?task\s+(?:called|named|titled)\s+["\']?(.+?)["\']?\s*$/i,
        tool: "createTaskItem",
        extractArgs: (match, context) => ({
            title: match[1].trim(),
            workspaceId: context.workspaceId,
            projectId: context.currentProjectId,
        }),
        responseTemplate: (result, args) =>
            result.success
                ? `Created task "${args.title}".`
                : `Failed to create task: ${result.error}`,
    },

    // "create a project called X"
    {
        pattern: /^create\s+(?:a\s+)?(?:new\s+)?project\s+(?:called|named|titled)\s+["\']?(.+?)["\']?\s*$/i,
        tool: "createProject",
        extractArgs: (match, context) => ({
            name: match[1].trim(),
            workspaceId: context.workspaceId,
        }),
        responseTemplate: (result, args) =>
            result.success
                ? `Created project "${args.name}".`
                : `Failed to create project: ${result.error}`,
    },

    // "show my tasks" / "list my tasks" / "list tasks"
    {
        pattern: /^(?:show|list|get)\s+(?:my\s+)?tasks?\s*$/i,
        tool: "searchTasks",
        extractArgs: (_match, context) => ({
            workspaceId: context.workspaceId,
            limit: 20,
        }),
        responseTemplate: (result) => {
            if (!result.success) return `Failed to search tasks: ${result.error}`;
            const tasks = result.data as Array<{ title: string; status?: string }>;
            if (!tasks?.length) return "No tasks found.";
            return `Found ${tasks.length} task(s):\n${tasks.slice(0, 10).map(t => `• ${t.title} (${t.status || 'todo'})`).join('\n')}`;
        },
    },

    // "show projects" / "list projects"
    {
        pattern: /^(?:show|list|get)\s+(?:my\s+)?projects?\s*$/i,
        tool: "searchProjects",
        extractArgs: (_match, context) => ({
            workspaceId: context.workspaceId,
            limit: 20,
        }),
        responseTemplate: (result) => {
            if (!result.success) return `Failed to search projects: ${result.error}`;
            const projects = result.data as Array<{ name: string; status?: string }>;
            if (!projects?.length) return "No projects found.";
            return `Found ${projects.length} project(s):\n${projects.slice(0, 10).map(p => `• ${p.name}`).join('\n')}`;
        },
    },
];

// ============================================================================
// FAST PATH EXECUTOR
// ============================================================================

/**
 * Try to execute a simple command without calling the LLM.
 * Returns null if the command doesn't match any simple pattern.
 */
export async function trySimpleCommand(
    userCommand: string,
    context: ExecutionContext
): Promise<ExecutionResult | null> {
    const t0 = performance.now();
    const trimmed = userCommand.trim();
    // Normalize: remove trailing polite words and punctuation
    const normalized = trimmed.replace(/\s+(?:pls|please|thanks|thank you|thanks!|thanks\.|thanks)$/i, "").replace(/[.]$/, "");

    // Multi-step commands must go through the LLM — bail out immediately
    const ACTION_VERBS_AND = /\b(?:and)\s+(?:assign|add|set|tag|move|delete|remove|update|rename|change|populate|fill|insert|attach|link|copy|duplicate|archive|complete|close|open|share|export|import)\b/i;
    if (/\b(?:then|also|after that|next)\b/i.test(normalized) || ACTION_VERBS_AND.test(normalized)) {
        aiDebug("trySimpleCommand:skip-multi-step", { command: normalized, ms: Math.round(performance.now() - t0) });
        return null;
    }

    // ========================================================================
    // 1. IMPROVED TABLE PARSER (Fast Path)
    // ========================================================================
    const tableIndicator = /\btable\b/i;
    const columnsIndicator = /\b(?:columns?|fields?|cols?)\b/i;
    
    if (tableIndicator.test(normalized) || columnsIndicator.test(normalized)) {
        let tableTitle: string | null = null;
        let columnNames: string[] | null = null;

        // Try several regex patterns for maximum flexibility
        
        // Pattern A: table [connector] [Title] [Delimiter] [Columns]
        const matchA = normalized.match(/table\s+(?:called|named|titled|for|to\s+track)\s+["']?(.+?)["']?\s*(?:\s+(?:with|w\/|columns?|fields?|cols?|including)|[:\-→>])\s+(.+)$/i);
        
        // Pattern B: [Title] table [Delimiter] [Columns]
        const matchB = normalized.match(/^(?:.*?\b)?["']?(.+?)["']?\s+table\s*(?:\.?\s+(?:with|w\/|columns?|fields?|cols?|including|are|is)|[:\-→>])\s+(.+)$/i);

        // Pattern C: table [Title] [Delimiter] [Columns] (no connector)
        const matchC = normalized.match(/table\s+["']?(.+?)["']?\s*(?:\s+(?:with|w\/|columns?|fields?|cols?|including|are|is)|[:\-→>])\s+(.+)$/i);

        // Pattern D: [Title]: columns [Columns]
        const matchD = normalized.match(/^["']?(.+?)["']?\s*[:]\s+(?:columns?|fields?|cols?)\s+(.+)$/i);

        const match = matchA || matchB || matchC || matchD;

        if (match) {
            tableTitle = match[1].trim();
            const columnsPart = match[2].trim();
            
            // Comprehensive title cleanup
            tableTitle = tableTitle
                .replace(/^(?:create|make|make me|build|new|need|i need|set up|can u|can you|i want|pls|please|set up a new|a|an|the|my|me|me a|called|named|for|titled|to track|spreadsheet-like)\s+/i, "")
                .replace(/\s+(?:w|w\/|with|columns?|fields?|cols?|including|table)$/i, "")
                .replace(/[-\s]+$/g, "")
                .replace(/^["']|["']$/g, "")
                .trim();

            if (tableTitle.length > 1 && !/^(?:a|an|the|my|me)$/i.test(tableTitle)) {
                columnNames = parseColumnList(columnsPart);
            }
        }

        if (tableTitle && columnNames && columnNames.length > 0) {
            aiDebug("trySimpleCommand:table-with-columns", {
                command: normalized,
                tableTitle,
                columnNames,
            });

            // Step 1: create the table
            const tableArgs = {
                title: tableTitle,
                workspaceId: context.workspaceId,
                projectId: context.currentProjectId,
                tabId: context.currentTabId,
            };
            const tableResult = await executeTool(
                { name: "createTable", arguments: tableArgs },
                { workspaceId: context.workspaceId, userId: context.userId }
            );

            if (!tableResult.success) {
                return {
                    success: false,
                    response: `Failed to create table: ${tableResult.error}`,
                    toolCallsMade: [{ tool: "createTable", arguments: tableArgs, result: tableResult }],
                    error: tableResult.error,
                };
            }

            const tableData = tableResult.data as { table?: { id?: string }; id?: string } | undefined;
            const tableId = tableData?.table?.id ?? tableData?.id;
            if (!tableId) {
                return {
                    success: false,
                    response: "Failed to create table: no tableId returned.",
                    toolCallsMade: [{ tool: "createTable", arguments: tableArgs, result: tableResult }],
                    error: "no tableId returned",
                };
            }

            // Step 2: create all fields in one bulk call
            const fieldsArgs = {
                tableId,
                fields: columnNames.map((name) => ({ name, type: "text" })),
            };
            const fieldsResult = await executeTool(
                { name: "bulkCreateFields", arguments: fieldsArgs },
                { workspaceId: context.workspaceId, userId: context.userId }
            );

            const allToolCalls = [
                { tool: "createTable", arguments: tableArgs, result: tableResult },
                { tool: "bulkCreateFields", arguments: fieldsArgs, result: fieldsResult },
            ];

            return {
                success: fieldsResult.success,
                response: fieldsResult.success
                    ? `Created table "${tableTitle}" with columns: ${columnNames.join(", ")}.`
                    : `Created table "${tableTitle}" but failed to add columns: ${fieldsResult.error}`,
                toolCallsMade: allToolCalls,
                error: fieldsResult.success ? undefined : fieldsResult.error,
            };
        }
    }

    // ========================================================================
    // 2. OTHER SIMPLE PATTERNS
    // ========================================================================
    aiDebug("trySimpleCommand:start", {
        command: normalized,
        patternCount: SIMPLE_PATTERNS.length,
    });

    for (const pattern of SIMPLE_PATTERNS) {
        const match = normalized.match(pattern.pattern);
        if (!match) continue;

        aiDebug("trySimpleCommand:match", {
            command: normalized,
            pattern: pattern.pattern.source,
            tool: pattern.tool,
        });

        const args = pattern.extractArgs(match, context);

        aiDebug("trySimpleCommand:execute", {
            tool: pattern.tool,
            args: Object.keys(args),
        });

        const result = await executeTool(
            { name: pattern.tool, arguments: args },
            { workspaceId: context.workspaceId, userId: context.userId }
        );

        const response = pattern.responseTemplate(result, args);

        aiDebug("trySimpleCommand:complete", {
            tool: pattern.tool,
            success: result.success,
            ms: Math.round(performance.now() - t0),
        });

        return {
            success: result.success,
            response,
            toolCallsMade: [{
                tool: pattern.tool,
                arguments: args,
                result,
            }],
            error: result.error,
        };
    }

    // No pattern matched
    return null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse a column list from natural language.
 * Handles: "A, B, and C" | "A, B, C" | "A and B" | "A" | "A / B / C" | "A; B; C"
 * Strips quotes and whitespace from each name.
 */
function parseColumnList(raw: string): string[] {
    // Split on common delimiters: comma, semicolon, slash
    let parts = raw.trim().split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
    
    // If we only got one part, it might be space-separated "name region population"
    if (parts.length === 1 && parts[0].includes(" ") && !parts[0].match(/\band\b/i)) {
        // Only split on space if it looks like a simple list of words (no quotes or complex chars)
        if (/^[a-z0-9_ ]+$/i.test(parts[0])) {
            parts = parts[0].split(/\s+/);
        }
    }

    const result: string[] = [];
    for (const part of parts) {
        // Strip a leading "and " (Oxford comma puts it at the start of the last segment)
        // then split on any remaining " and " to handle "A and B" with no commas.
        const stripped = part.replace(/^and\s+/i, "");
        const andParts = stripped.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
        for (const name of andParts) {
            // Basic quote stripping
            result.push(name.replace(/^["']|["']$/g, ""));
        }
    }
    return result;
}
