/**
 * Multi-Step Workflow Tests
 *
 * Tests complex operations that require the AI to chain multiple tool calls together.
 * These test the AI's planning and reasoning abilities.
 */

import type { TestSuite } from "../test-ai-executor";

export const multiStepWorkflowTests: TestSuite = {
  name: "Multi-Step Workflow Tests",
  description: "Test complex operations requiring multiple tool calls and reasoning",

  tests: [
    // ========================================================================
    // PROJECT SETUP WORKFLOWS
    // ========================================================================
    {
      name: "Complete project setup",
      command: "Create a new project called Marketing Campaign with an Overview tab and a task to plan the campaign",
      expectedTools: ["createProject", "createTab", "createTaskItem"],
      expectedOutcome: "Should create project, tab, and task in sequence",
    },
    {
      name: "Project with client",
      command: "Create a client called TechStart, then create a project for them called Website Redesign",
      expectedTools: ["createClient", "createProject"],
      expectedOutcome: "Should create client first, then project linked to that client",
    },

    // ========================================================================
    // TABLE WORKFLOWS
    // ========================================================================
    {
      name: "Create table with structure",
      command: "Create a contacts table with columns for first name, last name, email, and phone number",
      expectedTools: ["createTable", "createField"],
      expectedOutcome: "Should create table and add 4 fields",
    },
    {
      name: "Create table and add data",
      command: "Create a customers table with name and email columns, then add a customer John Doe with email john@example.com",
      expectedTools: ["createTable", "createField", "createRow"],
      expectedOutcome: "Should create table, fields, and insert one row",
    },
    {
      name: "Bulk table data entry",
      command: "Create a products table with name, price, and status columns. Add these products: Laptop $999 active, Mouse $25 active, Keyboard $75 discontinued",
      expectedTools: ["createTable", "createField", "bulkInsertRows"],
      expectedOutcome: "Should use bulk insert for 3 products",
    },

    // ========================================================================
    // TASK MANAGEMENT WORKFLOWS
    // ========================================================================
    {
      name: "Create and assign task",
      command: "Create a task to review the budget and assign it to me",
      expectedTools: ["createTaskItem", "setTaskAssignees"],
      expectedOutcome: "Should create task and set assignee",
    },
    {
      name: "Create task with full details",
      command: "Create a high priority task to finish the report, due next Friday, and assign it to me",
      expectedTools: ["createTaskItem", "setTaskAssignees"],
      expectedOutcome: "Should create task with priority, due date, and assignee",
    },
    {
      name: "Update existing task",
      command: "Find the task about reviewing the budget and mark it as in-progress",
      expectedTools: ["searchTasks", "updateTaskItem"],
      expectedOutcome: "Should search for task and update its status",
    },
    {
      name: "Task with tags",
      command: "Create a task for Q1 planning and tag it as urgent and finance",
      expectedTools: ["createTaskItem", "setTaskTags"],
      expectedOutcome: "Should create task and add two tags",
    },

    // ========================================================================
    // SEARCH AND UPDATE WORKFLOWS
    // ========================================================================
    {
      name: "Find and update project",
      command: "Find the Marketing Campaign project and change its status to active",
      expectedTools: ["searchProjects", "updateProject"],
      expectedOutcome: "Should search for project by name and update status",
    },
    {
      name: "Find and delete task",
      command: "Find the test task and delete it",
      expectedTools: ["searchTasks", "deleteTaskItem"],
      expectedOutcome: "Should search for task and delete it",
    },

    // ========================================================================
    // TIMELINE WORKFLOWS
    // ========================================================================
    {
      name: "Create timeline event with date",
      command: "Create a timeline event for product launch on March 15, 2026",
      expectedTools: ["createTimelineEvent"],
      expectedOutcome: "Should create timeline event with specific date",
    },
    {
      name: "Create dependent timeline events",
      command: "Create a timeline event for beta testing on March 1, then create a launch event on March 15 that depends on beta testing",
      expectedTools: ["createTimelineEvent", "createTimelineDependency"],
      expectedOutcome: "Should create two events and link them with dependency",
    },

    // ========================================================================
    // CROSS-ENTITY WORKFLOWS
    // ========================================================================
    {
      name: "Project with multiple entities",
      command: "Create a project called Q1 Planning with a Budget tab, then add a task to finalize the budget and a table for expense tracking",
      expectedTools: ["createProject", "createTab", "createTaskItem", "createTable"],
      expectedOutcome: "Should orchestrate multiple entity creations",
    },

    // ========================================================================
    // AMBIGUOUS COMMAND RESOLUTION
    // ========================================================================
    {
      name: "Resolve entity by partial name",
      command: "Update the Campaign project to mark it as completed",
      expectedTools: ["searchProjects", "updateProject"],
      expectedOutcome: "Should search for project matching 'Campaign' and update it",
    },
  ],
};
