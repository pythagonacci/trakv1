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
    const trimmed = userCommand.trim();

    aiDebug("trySimpleCommand:start", {
        command: trimmed,
        patternCount: SIMPLE_PATTERNS.length,
    });

    for (const pattern of SIMPLE_PATTERNS) {
        const match = trimmed.match(pattern.pattern);
        if (!match) continue;

        aiDebug("trySimpleCommand:match", {
            command: trimmed,
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
