/**
 * Single Tool Tests
 *
 * Tests individual tools in isolation with simple, direct commands.
 * These tests verify that each tool can be called successfully and produces expected results.
 */

import type { TestSuite } from "../test-ai-executor";

export const singleToolTests: TestSuite = {
  name: "Single Tool Tests",
  description: "Test individual tools with simple, direct commands",

  tests: [
    // ========================================================================
    // SEARCH TOOLS
    // ========================================================================
    {
      name: "Search all tasks",
      command: "Find all tasks in the workspace",
      expectedTools: ["searchTasks"],
    },
    {
      name: "Search high priority tasks",
      command: "Show me all high priority tasks",
      expectedTools: ["searchTasks"],
    },
    {
      name: "Search projects",
      command: "List all projects",
      expectedTools: ["searchProjects"],
    },
    {
      name: "Search workspace members",
      command: "Who are the members of this workspace?",
      expectedTools: ["searchWorkspaceMembers"],
    },

    // ========================================================================
    // TASK TOOLS
    // ========================================================================
    {
      name: "Create a task",
      command: "Create a task called 'Test Task for AI'",
      expectedTools: ["createTaskItem"],
      expectedOutcome: "Should create a new task with the given title",
    },
    {
      name: "Create a task with priority",
      command: "Create a high priority task to review the quarterly budget",
      expectedTools: ["createTaskItem"],
      expectedOutcome: "Should create task with high priority",
    },
    {
      name: "Create a task with due date",
      command: "Create a task to finish the report, due tomorrow",
      expectedTools: ["createTaskItem"],
      expectedOutcome: "Should create task with due date set to tomorrow",
    },

    // ========================================================================
    // PROJECT TOOLS
    // ========================================================================
    {
      name: "Create a project",
      command: "Create a project called AI Testing Project",
      expectedTools: ["createProject"],
      expectedOutcome: "Should create new project with given name",
    },

    // ========================================================================
    // CLIENT TOOLS
    // ========================================================================
    {
      name: "Create a client",
      command: "Create a client called Acme Corporation",
      expectedTools: ["createClient"],
      expectedOutcome: "Should create new client",
    },

    // ========================================================================
    // TABLE TOOLS
    // ========================================================================
    {
      name: "Create a simple table",
      command: "Create a table called Test Data",
      expectedTools: ["createTable"],
      expectedOutcome: "Should create new table",
    },

    // ========================================================================
    // DOC TOOLS
    // ========================================================================
    {
      name: "Create a document",
      command: "Create a document for meeting notes",
      expectedTools: ["createDoc"],
      expectedOutcome: "Should create new document",
    },

    // ========================================================================
    // PROPERTY TOOLS
    // ========================================================================
    {
      name: "Create a custom property",
      command: "Create a custom property called Department",
      expectedTools: ["createPropertyDefinition"],
      expectedOutcome: "Should create new property definition",
    },
  ],
};
