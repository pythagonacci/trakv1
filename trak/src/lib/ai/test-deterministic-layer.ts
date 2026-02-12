/**
 * Deterministic parsing layer accuracy test.
 * Run (server-side): node -e "require('jiti')(process.cwd())('./src/lib/ai/test-deterministic-layer.ts')"
 */

import { parseDeterministicCommand } from "./deterministic-parser";
import type { ExecutionContext } from "./executor";

type Expected = {
  tools: string[];
  args?: Array<Record<string, unknown>>;
};

type TestCase = {
  name: string;
  command: string;
  expected?: Expected;
  shouldExecute?: boolean;
  context?: Partial<ExecutionContext>;
};

const NOW = new Date("2026-02-03T12:00:00Z");

const BASE_CONTEXT: ExecutionContext = {
  workspaceId: "ws_test",
  userId: "user_test",
  currentProjectId: "proj_test",
  currentTabId: "tab_test",
};

const CASES: TestCase[] = [
  {
    name: "list tasks",
    command: "list tasks",
    expected: { tools: ["searchTasks"] },
  },
  {
    name: "show my tasks",
    command: "show my tasks",
    expected: { tools: ["searchTasks"] },
  },
  {
    name: "typo search tasks due tomorrow",
    command: "find taks due tommorow",
    expected: { tools: ["searchTasks"], args: [{ dueDate: { eq: "2026-02-04" } }] },
  },
  {
    name: "tasks due today",
    command: "find tasks due today",
    expected: { tools: ["searchTasks"], args: [{ dueDate: { eq: "2026-02-03" } }] },
  },
  {
    name: "overdue tasks",
    command: "find overdue tasks",
    expected: { tools: ["searchTasks"], args: [{ dueDate: { lte: "2026-02-02" } }] },
  },
  {
    name: "high priority tasks",
    command: "show high priority tasks",
    expected: { tools: ["searchTasks"], args: [{ priority: "high" }] },
  },
  {
    name: "urgent tasks",
    command: "show urgent tasks",
    expected: { tools: ["searchTasks"], args: [{ priority: "urgent" }] },
  },
  {
    name: "assigned tasks",
    command: "tasks assigned to Amna",
    expected: { tools: ["searchTasks"], args: [{ assigneeName: "Amna" }] },
  },
  {
    name: "tagged tasks",
    command: "tasks tagged bug",
    expected: { tools: ["searchTasks"], args: [{ tagName: "bug" }] },
  },
  {
    name: "search tasks about onboarding",
    command: "find tasks about onboarding",
    expected: { tools: ["searchTasks"], args: [{ searchText: "onboarding" }] },
  },
  {
    name: "search subtasks about onboarding",
    command: "find subtasks about onboarding",
    expected: { tools: ["searchSubtasks"], args: [{ searchText: "onboarding" }] },
  },
  {
    name: "completed subtasks",
    command: "show completed subtasks",
    expected: { tools: ["searchSubtasks"], args: [{ completed: true }] },
  },
  {
    name: "incomplete checklist items",
    command: "show incomplete checklist items",
    expected: { tools: ["searchSubtasks"], args: [{ completed: false }] },
  },
  {
    name: "subtasks for task title",
    command: "show subtasks for Website Redesign",
    expected: { tools: ["searchSubtasks"], args: [{ taskTitle: "Website Redesign" }] },
  },
  {
    name: "subtask creation follow-up should not be treated as search",
    command: "The parent task is Dashboard Display. The subtask title should be Auto Refresh AI Integration.",
    shouldExecute: false,
  },
  {
    name: "create task called",
    command: "create task called \"Fix login bug\"",
    expected: { tools: ["createTaskItem"], args: [{ title: "Fix login bug" }] },
  },
  {
    name: "add new task",
    command: "add new task Fix login bug",
    expected: { tools: ["createTaskItem"], args: [{ title: "Fix login bug" }] },
  },
  {
    name: "create task due tomorrow",
    command: "make a todo: Fix login bug due tomorrow",
    expected: { tools: ["createTaskItem"], args: [{ dueDate: "2026-02-04" }] },
  },
  {
    name: "create task with assignees",
    command: "create task \"Design mockups\" assigned to Amna and Bob",
    expected: { tools: ["createTaskItem"], args: [{ assignees: ["Amna", "Bob"] }] },
  },
  {
    name: "create task with priority",
    command: "create task titled \"Setup CI\" with priority high",
    expected: { tools: ["createTaskItem"], args: [{ priority: "high" }] },
  },
  {
    name: "create project",
    command: "create project \"Website Redesign\"",
    expected: { tools: ["createProject"], args: [{ name: "Website Redesign" }] },
  },
  {
    name: "create project with status",
    command: "start new project Internal Tools status in progress",
    expected: { tools: ["createProject"], args: [{ status: "in_progress" }] },
  },
  {
    name: "create project with due date",
    command: "new project \"Client Portal\" due 2026-03-01",
    expected: { tools: ["createProject"], args: [{ dueDate: "2026-03-01" }] },
  },
  {
    name: "create doc",
    command: "create doc titled Meeting Notes",
    expected: { tools: ["createDoc"], args: [{ title: "Meeting Notes" }] },
  },
  {
    name: "new note",
    command: "new note 'Sprint retro'",
    expected: { tools: ["createDoc"], args: [{ title: "Sprint retro" }] },
  },
  {
    name: "add client",
    command: "add client Acme Inc.",
    expected: { tools: ["createClient"], args: [{ name: "Acme Inc" }] },
  },
  {
    name: "create client with email",
    command: "create client \"Beta Labs\" email hello@beta.com",
    expected: { tools: ["createClient"], args: [{ email: "hello@beta.com" }] },
  },
  {
    name: "create table",
    command: "create table called Leads",
    expected: { tools: ["createTable"], args: [{ title: "Leads", workspaceId: "ws_test" }] },
  },
  {
    name: "create table with columns",
    command: "create a table named Leads with columns Name, Email, Status",
    expected: { tools: ["createTable", "bulkCreateFields"], args: [{ title: "Leads" }] },
  },
  {
    name: "list tables",
    command: "list tables",
    expected: { tools: ["searchTables"] },
  },
  {
    name: "find table by name",
    command: "find table \"Leads\"",
    expected: { tools: ["searchTables"], args: [{ searchText: "Leads" }] },
  },
  {
    name: "list docs",
    command: "list docs",
    expected: { tools: ["searchDocs"] },
  },
  {
    name: "search files",
    command: "search files named proposal",
    expected: { tools: ["searchFiles"], args: [{ searchText: "proposal" }] },
  },
  {
    name: "search clients",
    command: "search clients for acme",
    expected: { tools: ["searchClients"], args: [{ searchText: "acme" }] },
  },
  {
    name: "show tags",
    command: "show tags",
    expected: { tools: ["searchTags"] },
  },
  {
    name: "list tabs",
    command: "list tabs",
    expected: { tools: ["searchTabs"] },
  },
  {
    name: "find blocks",
    command: "find blocks about marketing",
    expected: { tools: ["searchBlocks"], args: [{ searchText: "marketing" }] },
  },
  {
    name: "list timeline events",
    command: "list timeline events",
    expected: { tools: ["searchTimelineEvents"] },
  },
  {
    name: "search all",
    command: "search everything for onboarding",
    expected: { tools: ["searchAll"], args: [{ searchText: "onboarding" }] },
  },
  {
    name: "create tab with context",
    command: "create tab Roadmap",
    expected: { tools: ["createTab"], args: [{ projectId: "proj_test" }] },
  },
  {
    name: "update task (should abstain)",
    command: "update task Fix login bug to done",
    shouldExecute: false,
  },
  {
    name: "delete project (should abstain)",
    command: "delete project Acme",
    shouldExecute: false,
  },
  {
    name: "multi-step (should abstain)",
    command: "create task and assign to Amna then tag urgent",
    shouldExecute: false,
  },
  {
    name: "bulk update (should abstain)",
    command: "set all tasks to done",
    shouldExecute: false,
  },
];

function matchesPartial(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (expected === null || typeof expected !== "object") return actual === expected;

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((expectedItem) =>
      actual.some((actualItem) => matchesPartial(actualItem, expectedItem))
    );
  }

  if (!actual || typeof actual !== "object") return false;
  const actualObj = actual as Record<string, unknown>;
  const expectedObj = expected as Record<string, unknown>;

  return Object.entries(expectedObj).every(([key, value]) =>
    matchesPartial(actualObj[key], value)
  );
}

let total = 0;
let executed = 0;
let correct = 0;
let abstained = 0;
let falsePositives = 0;
let falseNegatives = 0;
let confidenceSum = 0;

for (const test of CASES) {
  total += 1;
  const context: ExecutionContext = { ...BASE_CONTEXT, ...(test.context ?? {}) };
  const result = parseDeterministicCommand(test.command, context, { now: NOW, minConfidence: 0.82 });

  const shouldExecute = test.shouldExecute ?? Boolean(test.expected);
  const didExecute = Boolean(result);

  let pass = true;
  let details = "";

  if (shouldExecute && !didExecute) {
    pass = false;
    falseNegatives += 1;
    details = "abstained";
  } else if (!shouldExecute && didExecute) {
    pass = false;
    falsePositives += 1;
    details = `unexpected tool=${result?.toolCalls[0]?.name}`;
  } else if (shouldExecute && didExecute && test.expected) {
    executed += 1;
    confidenceSum += result?.confidence ?? 0;

    const toolNames = result?.toolCalls.map((call) => call.name) ?? [];
    const toolMatch =
      toolNames.length === test.expected.tools.length &&
      toolNames.every((tool, index) => tool === test.expected?.tools[index]);

    const argsMatch =
      !test.expected.args ||
      test.expected.args.every((expectedArgs, index) =>
        matchesPartial(result?.toolCalls[index]?.arguments, expectedArgs)
      );

    pass = toolMatch && argsMatch;
    if (!pass) {
      details = `got tools=${JSON.stringify(toolNames)} args=${JSON.stringify(result?.toolCalls[0]?.arguments)}`;
    } else {
      correct += 1;
    }
  } else if (!shouldExecute && !didExecute) {
    abstained += 1;
  }

  const status = pass ? "PASS" : "FAIL";
  console.log(`${status} - ${test.name}${details ? ` (${details})` : ""}`);
}

if (executed === 0) executed = 0;
const accuracy = total > 0 ? correct / total : 0;
const coverage = total > 0 ? executed / total : 0;
const precision = executed > 0 ? correct / executed : 0;
const avgConfidence = executed > 0 ? confidenceSum / executed : 0;

console.log("\n===== Deterministic Layer Results =====");
console.log(`Total cases: ${total}`);
console.log(`Executed: ${executed}`);
console.log(`Correct: ${correct}`);
console.log(`Abstained: ${abstained}`);
console.log(`False positives: ${falsePositives}`);
console.log(`False negatives: ${falseNegatives}`);
console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}%`);
console.log(`Coverage: ${(coverage * 100).toFixed(1)}%`);
console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`Avg confidence: ${avgConfidence.toFixed(3)}`);
console.log("======================================");
