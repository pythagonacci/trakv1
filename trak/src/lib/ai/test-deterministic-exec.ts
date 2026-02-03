/**
 * Deterministic execution test (server-side, real actions).
 *
 * Run:
 * node -e "require('jiti')(process.cwd())('./src/lib/ai/test-deterministic-exec.ts')"
 */

import { parseDeterministicCommand } from "./deterministic-parser";
import { executeTool } from "./tool-executor";
import type { ExecutionContext } from "./executor";

const WORKSPACE_ID = "4e52f23e-915d-4673-aac2-b4b485eeb276";
const USER_ID = "af951fd0-523f-41bb-a35e-08e17dccda03";

process.env.ENABLE_TEST_MODE = "true";

const now = new Date("2026-02-03T12:00:00Z");

type ToolResult = { success: boolean; data?: any; error?: string };

function extractId(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.id === "string") return data.id;
  if (data.task?.id) return data.task.id;
  if (data.table?.id) return data.table.id;
  if (data.doc?.id) return data.doc.id;
  if (data.project?.id) return data.project.id;
  return null;
}

async function runDeterministicCommand(
  command: string,
  context: ExecutionContext
): Promise<{ toolNames: string[]; results: ToolResult[] }> {
  const parsed = parseDeterministicCommand(command, context, { now });
  if (!parsed) {
    throw new Error(`Deterministic parse returned null for: ${command}`);
  }

  const results: ToolResult[] = [];
  const toolNames: string[] = [];
  let lastCreatedTableId: string | null = null;

  for (const toolCall of parsed.toolCalls) {
    const args = { ...toolCall.arguments } as Record<string, unknown>;
    if (toolCall.name === "bulkCreateFields" && !("tableId" in args) && lastCreatedTableId) {
      args.tableId = lastCreatedTableId;
    }

    const result = (await executeTool(
      { name: toolCall.name, arguments: args },
      {
        workspaceId: context.workspaceId,
        userId: context.userId,
        currentProjectId: context.currentProjectId,
        currentTabId: context.currentTabId,
        contextTableId: context.contextTableId,
        contextBlockId: context.contextBlockId,
      }
    )) as ToolResult;

    toolNames.push(toolCall.name);
    results.push(result);

    if (!result.success) {
      throw new Error(`Tool failed: ${toolCall.name} -> ${result.error}`);
    }

    if (toolCall.name === "createTable") {
      lastCreatedTableId = extractId(result.data);
    }
  }

  return { toolNames, results };
}

async function main() {
  console.log("===== Deterministic Execution Test =====");

  const created: {
    projectId?: string;
    tabId?: string;
    tableId?: string;
    taskId?: string;
    docId?: string;
    clientId?: string;
  } = {};

  // 1) Create project
  const projectName = `Deterministic Exec Test ${Date.now()}`;
  const projectResult = (await executeTool(
    {
      name: "createProject",
      arguments: { name: projectName, projectType: "internal" },
    },
    { workspaceId: WORKSPACE_ID, userId: USER_ID }
  )) as ToolResult;

  if (!projectResult.success) {
    throw new Error(`createProject failed: ${projectResult.error}`);
  }
  created.projectId = extractId(projectResult.data) ?? undefined;
  if (!created.projectId) throw new Error("createProject did not return projectId");

  // 2) Create tab in that project
  const tabResult = (await executeTool(
    {
      name: "createTab",
      arguments: { name: "Deterministic Exec", projectId: created.projectId },
    },
    { workspaceId: WORKSPACE_ID, userId: USER_ID }
  )) as ToolResult;

  if (!tabResult.success) {
    throw new Error(`createTab failed: ${tabResult.error}`);
  }
  created.tabId = extractId(tabResult.data) ?? undefined;

  const context: ExecutionContext = {
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    currentProjectId: created.projectId,
    currentTabId: created.tabId,
  };

  // 3) Deterministic commands (parse + execute)
  const commands: Array<{
    command: string;
    allowFailure?: boolean;
    note?: string;
  }> = [
    { command: "create a table named QA Leads with columns Name, Email, Status" },
    { command: "create task \"Test login\" assigned to Amna and Bob due tommorow priority high" },
    {
      command: "create doc titled QA Notes",
      allowFailure: true,
      note: "Doc actions call revalidatePath and require Next.js request context.",
    },
    { command: "create client \"QA Client\" email qa@example.com" },
    { command: "list tasks" },
    { command: "list tables" },
  ];

  for (const entry of commands) {
    try {
      const { toolNames, results } = await runDeterministicCommand(entry.command, context);
      console.log(`OK: ${entry.command}`);
      console.log(`  tools: ${toolNames.join(", ")}`);

      // Capture IDs for cleanup
      for (const result of results) {
        if (toolNames.includes("createTable") && !created.tableId) {
          created.tableId = extractId(result.data) ?? created.tableId;
        }
        if (toolNames.includes("createTaskItem") && !created.taskId) {
          created.taskId = extractId(result.data) ?? created.taskId;
        }
        if (toolNames.includes("createDoc") && !created.docId) {
          created.docId = extractId(result.data) ?? created.docId;
        }
        if (toolNames.includes("createClient") && !created.clientId) {
          created.clientId = extractId(result.data) ?? created.clientId;
        }
      }
    } catch (err) {
      if (entry.allowFailure) {
        console.log(`SKIP: ${entry.command}`);
        if (entry.note) console.log(`  note: ${entry.note}`);
        continue;
      }
      throw err;
    }
  }

  // 4) Cleanup
  const cleanupErrors: string[] = [];

  if (created.taskId) {
    const res = await executeTool(
      { name: "deleteTaskItem", arguments: { taskId: created.taskId } },
      { workspaceId: WORKSPACE_ID, userId: USER_ID }
    );
    if (!res.success) cleanupErrors.push(`deleteTaskItem failed: ${res.error}`);
  }

  if (created.tableId) {
    const res = await executeTool(
      { name: "deleteTable", arguments: { tableId: created.tableId } },
      { workspaceId: WORKSPACE_ID, userId: USER_ID }
    );
    if (!res.success) cleanupErrors.push(`deleteTable failed: ${res.error}`);
  }

  if (created.docId) {
    const res = await executeTool(
      { name: "deleteDoc", arguments: { docId: created.docId } },
      { workspaceId: WORKSPACE_ID, userId: USER_ID }
    );
    if (!res.success) cleanupErrors.push(`deleteDoc failed: ${res.error}`);
  }

  if (created.clientId) {
    const res = await executeTool(
      { name: "deleteClient", arguments: { clientId: created.clientId } },
      { workspaceId: WORKSPACE_ID, userId: USER_ID }
    );
    if (!res.success) cleanupErrors.push(`deleteClient failed: ${res.error}`);
  }

  if (created.projectId) {
    const res = await executeTool(
      { name: "deleteProject", arguments: { projectId: created.projectId } },
      { workspaceId: WORKSPACE_ID, userId: USER_ID }
    );
    if (!res.success) cleanupErrors.push(`deleteProject failed: ${res.error}`);
  }

  if (cleanupErrors.length > 0) {
    console.error("Cleanup completed with errors:");
    cleanupErrors.forEach((err) => console.error(`- ${err}`));
  } else {
    console.log("Cleanup completed successfully.");
  }

  console.log("=======================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
