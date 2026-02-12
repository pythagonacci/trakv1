/**
 * Test Script for Intent Classifier
 *
 * Run this to verify the intent classifier is working correctly.
 * Usage: tsx trak/src/lib/ai/test-intent-classifier.ts
 */

import { classifyIntent } from "./intent-classifier";
import { getToolsByGroups, getToolCountsByGroup } from "./tool-definitions";

// ============================================================================
// TEST CASES
// ============================================================================

const testCases = [
  // Read-only queries - should only get core tools
  {
    command: "search all tasks assigned to Amna",
    expectedGroups: ["core"],
    description: "Read-only task search",
  },
  {
    command: "show me all projects",
    expectedGroups: ["core"],
    description: "Read-only project list",
  },
  {
    command: "find tasks due this week",
    expectedGroups: ["core"],
    description: "Search with date filter",
  },

  // Create operations - need entity-specific tools
  {
    command: "create a table of 50 US states with 2016 election results",
    expectedGroups: ["core", "table"],
    description: "Table creation with data",
  },
  {
    command: "add a new task for bug fixing",
    expectedGroups: ["core", "task"],
    description: "Task creation",
  },
  {
    command: "add a checklist item to the onboarding task",
    expectedGroups: ["core", "task"],
    description: "Checklist item creation",
  },
  {
    command: "The parent task is Dashboard Display. The subtask title should be Auto Refresh AI Integration.",
    expectedGroups: ["core", "task"],
    description: "Subtask follow-up details should stay write-capable",
  },
  {
    command: "create a project for Q1 planning",
    expectedGroups: ["core", "project"],
    description: "Project creation",
  },

  // Update operations
  {
    command: "mark all high priority tasks as done",
    expectedGroups: ["core", "task"],
    description: "Bulk task update",
  },
  {
    command: "update the status field in the states table",
    expectedGroups: ["core", "table"],
    description: "Table field update",
  },
  {
    command: "set checklist status to blocked",
    expectedGroups: ["core", "task", "property"],
    description: "Subtask status update requires property tools",
  },

  // Complex multi-entity operations
  {
    command: "search all tasks assigned to Amna and create a table organizing them by priority",
    expectedGroups: ["core", "table"],
    description: "Search + organize into table",
  },
  {
    command: "create 50 tasks for each state in the project timeline",
    expectedGroups: ["core", "task", "timeline"],
    description: "Multi-entity creation",
  },

  // Edge cases
  {
    command: "show me the task list",
    expectedGroups: ["core"],
    description: "Simple view request",
  },
  {
    command: "organize all Republican states by priority",
    expectedGroups: ["core", "table"],
    description: "Organize implies table",
  },
];

// ============================================================================
// RUN TESTS
// ============================================================================

console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
console.log("║               INTENT CLASSIFIER & SMART TOOL LOADING TEST                 ║");
console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

// Show tool counts first
const toolCounts = getToolCountsByGroup();
console.log("📊 Tool Counts by Group:");
console.log("─────────────────────────");
Object.entries(toolCounts).forEach(([group, count]) => {
  if (group === "total") {
    console.log(`\n   ${group.toUpperCase()}: ${count} tools\n`);
  } else {
    console.log(`   ${group.padEnd(12)}: ${count.toString().padStart(2)} tools`);
  }
});

console.log("\n" + "═".repeat(80) + "\n");

// Run test cases
let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
  const result = classifyIntent(testCase.command);
  const tools = getToolsByGroups(result.toolGroups);

  // Check if groups match expected
  const groupsMatch =
    result.toolGroups.length === testCase.expectedGroups.length &&
    result.toolGroups.every((g) => testCase.expectedGroups.includes(g));

  const status = groupsMatch ? "✅ PASS" : "❌ FAIL";
  if (groupsMatch) passCount++;
  else failCount++;

  console.log(`${status} Test ${(index + 1).toString().padStart(2)}: ${testCase.description}`);
  console.log(`   Command: "${testCase.command}"`);
  console.log(`   Expected groups: [${testCase.expectedGroups.join(", ")}]`);
  console.log(`   Detected groups: [${result.toolGroups.join(", ")}]`);
  console.log(`   Tools loaded: ${tools.length}/${toolCounts.total} (${Math.round((1 - tools.length / toolCounts.total) * 100)}% reduction)`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasoning: ${result.reasoning}`);

  if (!groupsMatch) {
    console.log(`   ⚠️  Mismatch - Review pattern matching`);
  }

  console.log("");
});

// Summary
console.log("═".repeat(80));
console.log(`\n📈 Test Results: ${passCount} passed, ${failCount} failed out of ${testCases.length} total\n`);

if (failCount === 0) {
  console.log("✨ All tests passed! Intent classifier is working correctly.\n");
} else {
  console.log("⚠️  Some tests failed. Review the patterns in intent-classifier.ts\n");
}

// ============================================================================
// TOKEN SAVINGS ANALYSIS
// ============================================================================

console.log("═".repeat(80) + "\n");
console.log("💰 Token Savings Analysis\n");
console.log("─────────────────────────\n");

const exampleCommands = [
  "search all tasks assigned to Amna",
  "create a table of 50 US states",
  "update all high priority tasks to done",
];

exampleCommands.forEach((command) => {
  const result = classifyIntent(command);
  const tools = getToolsByGroups(result.toolGroups);

  const beforeTokens = estimateToolDefTokens(toolCounts.total);
  const afterTokens = estimateToolDefTokens(tools.length);
  const savings = beforeTokens - afterTokens;
  const savingsPercent = Math.round((savings / beforeTokens) * 100);

  console.log(`Command: "${command}"`);
  console.log(`   Groups: [${result.toolGroups.join(", ")}]`);
  console.log(`   Tools: ${tools.length}/${toolCounts.total}`);
  console.log(`   Token estimate: ${beforeTokens} → ${afterTokens} (${savingsPercent}% reduction)`);
  console.log(`   Savings: ~${savings} tokens per request\n`);
});

console.log("═".repeat(80) + "\n");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Rough estimate of tokens for tool definitions.
 * Each tool definition averages ~100-150 tokens.
 */
function estimateToolDefTokens(toolCount: number): number {
  return toolCount * 120; // Average tokens per tool definition
}
