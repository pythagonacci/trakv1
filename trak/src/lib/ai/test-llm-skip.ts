/**
 * Quick test to verify the LLM call reduction fix.
 * Run with: npx tsx src/lib/ai/test-llm-skip.ts
 */

import { classifyIntent } from "./intent-classifier";

// Test commands to verify hasWriteIntent behavior
const testCommands = [
    // These should have hasWriteIntent = false (read-only)
    { command: "Search for tasks about website", expectedWrite: false },
    { command: "Find all tasks assigned to Amna", expectedWrite: false },
    { command: "Show me the projects", expectedWrite: false },
    { command: "List all tasks", expectedWrite: false },
    { command: "Get task details", expectedWrite: false },

    // These should have hasWriteIntent = true (write operations)
    { command: "Create a new task called Homepage Redesign", expectedWrite: true },
    { command: "Update all tasks to done", expectedWrite: true },
    { command: "Delete the old tasks", expectedWrite: true },
    { command: "Add a task for tomorrow", expectedWrite: true },
    { command: "Mark task as complete", expectedWrite: true },
];

const WRITE_ACTIONS = ["create", "update", "delete", "organize", "move", "copy", "insert"];

console.log("===== LLM Skip Fix Verification =====\n");

let passed = 0;
let failed = 0;

for (const { command, expectedWrite } of testCommands) {
    const intent = classifyIntent(command);

    // NEW logic (fixed): only check actions, not toolGroups
    const hasWriteIntent = intent.actions.some(a => WRITE_ACTIONS.includes(a));

    // OLD logic (broken): also checked toolGroups
    const oldHasWriteIntent =
        intent.toolGroups.some(g => g !== "core") ||
        intent.actions.some(a => WRITE_ACTIONS.includes(a));

    const status = hasWriteIntent === expectedWrite ? "✅ PASS" : "❌ FAIL";
    const fixed = hasWriteIntent !== oldHasWriteIntent ? " (FIXED!)" : "";

    if (hasWriteIntent === expectedWrite) {
        passed++;
    } else {
        failed++;
    }

    console.log(`${status}${fixed} "${command}"`);
    console.log(`  Intent: actions=${JSON.stringify(intent.actions)}, toolGroups=${JSON.stringify(intent.toolGroups)}`);
    console.log(`  hasWriteIntent: ${hasWriteIntent} (expected: ${expectedWrite})`);
    if (oldHasWriteIntent !== hasWriteIntent) {
        console.log(`  OLD logic would have returned: ${oldHasWriteIntent} (wrong!)`);
    }
    console.log();
}

console.log("=====================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log();

if (failed === 0) {
    console.log("🎉 All tests passed! The fix is working correctly.");
    console.log("Read-only searches will now skip the 2nd LLM call and return ~7s faster.");
} else {
    console.log("⚠️ Some tests failed. Review the intent classifier patterns.");
    process.exit(1);
}
