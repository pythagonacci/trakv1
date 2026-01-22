# AI Search & Context Layer Testing Guide

## Overview

This document provides testing guidelines for the AI search system consisting of:
- Layer 1: Entity search functions (`src/app/actions/ai-search.ts`)
- Layer 2: Context getter functions (`src/app/actions/ai-context.ts`)

Note: All import paths in examples are placeholders. Use your actual file paths.

## Prerequisites

Before testing, ensure:
1. You have access to a test workspace with sample data
2. You're authenticated and workspace is selected
3. Database has test entities (tasks, projects, clients, etc.)

---

## Layer 1: Search Functions Testing

### 1. Basic Search Tests

#### Test: searchTasks - Simple status filter
```typescript
import { searchTasks } from "src/app/actions/ai-search";

const result = await searchTasks({ status: "todo" });

// Expected:
// - result.data should be array of tasks
// - All tasks should have status === "todo"
// - result.error should be null

console.log("Found tasks:", result.data?.length);
console.log("All todo?", result.data?.every((t) => t.status === "todo"));
```

#### Test: searchTasks - Compound filters
```typescript
const result = await searchTasks({
  status: "done",
  priority: "high",
  projectId: "your-project-id",
});

// Expected:
// - Only tasks matching ALL criteria
// - High priority AND done status AND in specified project
```

#### Test: searchProjects - Text search
```typescript
import { searchProjects } from "src/app/actions/ai-search";

const result = await searchProjects({ searchText: "Marketing" });

// Expected:
// - Projects with "Marketing" in name
// - Case-insensitive search
```

#### Test: searchBlocks - Type filter
```typescript
import { searchBlocks } from "src/app/actions/ai-search";

const result = await searchBlocks({ type: "task" });

// Expected:
// - Only task blocks returned
// - All in current workspace
```

### 2. Edge Case Tests

#### Test: Empty results
```typescript
const result = await searchTasks({
  status: "done",
  priority: "urgent",
  assigneeId: "nonexistent-user",
});

// Expected:
// - result.data should be empty array []
// - result.error should be null
```

#### Test: Large result sets
```typescript
const result = await searchTasks({ limit: 10 });

// Expected:
// - Maximum 10 results returned
// - Should be fast (<500ms)
```

#### Test: Tasks without assignees
```typescript
const result = await searchTasks({ status: "todo" });

// Expected:
// - Includes tasks with empty assignees array
// - No errors for tasks without assignees
```

#### Test: Archived content
```typescript
const result = await searchProjects({ includeArchived: false });

// Expected:
// - No archived projects in results
// - Only active projects

const resultWithArchived = await searchProjects({ includeArchived: true });
// Expected:
// - Includes archived projects
// - More results than previous query
```

### 3. Advanced Search Tests

#### Test: searchTableRows - JSONB search
```typescript
import { searchTableRows } from "src/app/actions/ai-search";

const result = await searchTableRows({
  tableId: "your-table-id",
  searchText: "Italy",
});

// Expected:
// - Rows containing "Italy" in any field
// - Searches across JSONB data fields
```

#### Test: searchComments - Cross-table search
```typescript
import { searchComments } from "src/app/actions/ai-search";

const result = await searchComments({ searchText: "urgent" });

// Expected:
// - Comments from all 3 comment tables
// - Merged results with source indicator
```

### 4. Performance Tests

#### Test: Response time
```typescript
const start = Date.now();
const result = await searchTasks({ status: "todo" });
const duration = Date.now() - start;

console.log(`Search completed in ${duration}ms`);

// Expected:
// - Duration < 500ms for typical queries
// - Duration < 1000ms for complex queries
```

#### Test: Multiple rapid searches
```typescript
const promises = [
  searchTasks({ status: "todo" }),
  searchProjects({ searchText: "Q4" }),
  searchBlocks({ type: "text" }),
];

const results = await Promise.all(promises);

// Expected:
// - All queries complete successfully
// - No rate limiting issues
// - No connection pool exhaustion
```

---

## Layer 2: Context Getter Testing

### 1. Basic Context Tests

#### Test: getTaskWithContext
```typescript
import { getTaskWithContext } from "src/app/actions/ai-context";
import { searchTasks } from "src/app/actions/ai-search";

const searchResult = await searchTasks({ status: "todo", limit: 1 });
const taskId = searchResult.data?.[0]?.id;

if (taskId) {
  const result = await getTaskWithContext({ taskId });

  console.log("Task:", result.data?.task.title);
  console.log("Assignees:", result.data?.assignees.length);
  console.log("Project:", result.data?.project.name);
  console.log("Client:", result.data?.client?.name);
}
```

#### Test: getProjectWithContext
```typescript
import { getProjectWithContext } from "src/app/actions/ai-context";
import { searchProjects } from "src/app/actions/ai-search";

const searchResult = await searchProjects({ limit: 1 });
const projectId = searchResult.data?.[0]?.id;

if (projectId) {
  const result = await getProjectWithContext({ projectId });

  console.log("Project:", result.data?.project.name);
  console.log("Tasks:", result.data?.taskSummary.total);
  console.log("By status:", result.data?.taskSummary.byStatus);
  console.log("Overdue:", result.data?.taskSummary.overdue);
}
```

#### Test: getTableWithRows
```typescript
import { getTableWithRows } from "src/app/actions/ai-context";
import { searchTables } from "src/app/actions/ai-search";

const searchResult = await searchTables({ limit: 1 });
const tableId = searchResult.data?.[0]?.id;

if (tableId) {
  const result = await getTableWithRows({ tableId, limit: 10 });

  console.log("Table:", result.data?.table.title);
  console.log("Fields:", result.data?.fields.length);
  console.log("Rows returned:", result.data?.rows.length);
  console.log("Total rows:", result.data?.rowCount);
}
```

### 2. Edge Case Tests

#### Test: Non-existent entity
```typescript
const result = await getTaskWithContext({ taskId: "fake-uuid-12345" });

// Expected:
// - result.data should be null
// - result.error should be "Task not found" or similar
```

#### Test: Entity in different workspace
```typescript
const result = await getTaskWithContext({ taskId: "other-workspace-task-id" });

// Expected:
// - result.data should be null
// - result.error should indicate not found
// - Should NOT leak data from other workspaces
```

#### Test: Task without relationships
```typescript
const result = await getTaskWithContext({ taskId: "minimal-task-id" });

// Expected:
// - result.data should exist
// - assignees should be empty array []
// - tags should be empty array []
// - comments should be empty array []
// - No errors for missing relationships
```

#### Test: Project with no client
```typescript
const result = await getProjectWithContext({ projectId: "no-client-project" });

// Expected:
// - result.data should exist
// - client should be undefined
// - No errors for missing client
```

### 3. Relationship Tests

#### Test: Task with all relationships
```typescript
const result = await getTaskWithContext({ taskId: "complex-task-id" });

// Verify:
// - assignees.length > 0
// - tags.length > 0
// - comments.length > 0
// - references.length > 0
// - block exists
// - tab exists
// - project exists
// - client exists (if project has client)
```

#### Test: Block with parent and children
```typescript
const result = await getBlockWithContext({ blockId: "nested-block-id" });

// Verify:
// - parent exists (if has parent_block_id)
// - children.length >= 0
// - tab exists
// - project exists
```

#### Test: Client with multiple projects
```typescript
const result = await getClientWithContext({ clientId: "client-with-projects" });

// Verify:
// - projects.length > 0
// - taskSummary includes tasks from all projects
// - taskSummary.total equals sum of byStatus values
```

### 4. Performance Tests

#### Test: Context getter response time
```typescript
const start = Date.now();
const result = await getProjectWithContext({ projectId: "test-project-id" });
const duration = Date.now() - start;

console.log(`Context fetch completed in ${duration}ms`);

// Expected:
// - Duration < 500ms for typical projects
// - Duration < 1000ms for large projects with many tasks
```

#### Test: Large table with many rows
```typescript
const result = await getTableWithRows({
  tableId: "large-table-id",
  limit: 100,
});

// Verify:
// - Respects limit (max 100 rows)
// - Completes in reasonable time
// - rowCount shows total (may be > 100)
```

### 5. Data Integrity Tests

#### Test: Task summary accuracy
```typescript
const result = await getProjectWithContext({ projectId: "test-project-id" });

const taskResult = await searchTasks({ projectId: "test-project-id" });
const manualCount = {
  todo: taskResult.data?.filter((t) => t.status === "todo").length,
  "in-progress": taskResult.data?.filter((t) => t.status === "in-progress").length,
  done: taskResult.data?.filter((t) => t.status === "done").length,
};

console.log("Summary:", result.data?.taskSummary.byStatus);
console.log("Manual count:", manualCount);

// Expected:
// - Counts should match
```

#### Test: Overdue tasks calculation
```typescript
const result = await getProjectWithContext({ projectId: "test-project-id" });

// Verify overdue logic:
// - Only counts tasks with due_date in past
// - Only counts non-done tasks
// - Uses current date for comparison
```

---

## Integration Testing

### Scenario 1: "Mark all high priority tasks as done"
```typescript
const searchResult = await searchTasks({
  priority: "high",
  status: ["todo", "in-progress"],
});

console.log(`Found ${searchResult.data?.length} high priority tasks`);

if (searchResult.data?.[0]) {
  const context = await getTaskWithContext({
    taskId: searchResult.data[0].id,
  });
  console.log(`Task "${context.data?.task.title}" in project "${context.data?.project.name}"`);
}
```

### Scenario 2: "Summarize the Q4 Marketing project"
```typescript
const searchResult = await searchProjects({ searchText: "Q4 Marketing" });

if (searchResult.data?.[0]) {
  const context = await getProjectWithContext({
    projectId: searchResult.data[0].id,
  });

  console.log("Project:", context.data?.project.name);
  console.log("Client:", context.data?.client?.name);
  console.log("Tabs:", context.data?.tabs.length);
  console.log("Tasks:", context.data?.taskSummary.total);
  console.log("  - Todo:", context.data?.taskSummary.byStatus.todo);
  console.log("  - In Progress:", context.data?.taskSummary.byStatus["in-progress"]);
  console.log("  - Done:", context.data?.taskSummary.byStatus.done);
  console.log("  - Overdue:", context.data?.taskSummary.overdue);
  console.log("Files:", context.data?.files.length);
}
```

### Scenario 3: "Show me everything related to the Launch task"
```typescript
const searchResult = await searchTasks({ searchText: "Launch" });

if (searchResult.data?.[0]) {
  const context = await getTaskWithContext({
    taskId: searchResult.data[0].id,
  });

  console.log("Task:", context.data?.task.title);
  console.log("Status:", context.data?.task.status);
  console.log("Priority:", context.data?.task.priority);
  console.log("Assignees:", context.data?.assignees.map((a) => a.name).join(", "));
  console.log("Tags:", context.data?.tags.map((t) => t.name).join(", "));
  console.log("Project:", context.data?.project.name);
  console.log("Client:", context.data?.client?.name);
  console.log("Comments:", context.data?.comments.length);
  console.log("References:", context.data?.references.length);
}
```

---

## Manual Testing Checklist

### Layer 1 (Search Functions):
- [ ] searchTasks returns correct results for status filter
- [ ] searchTasks returns correct results for compound filters
- [ ] searchProjects finds projects by name
- [ ] searchBlocks filters by block type correctly
- [ ] searchTableRows searches JSONB data
- [ ] searchComments searches across all comment types
- [ ] Empty searches return empty arrays (not null)
- [ ] All searches respect workspace boundaries
- [ ] includeArchived parameter works correctly
- [ ] Limit parameter is respected

### Layer 2 (Context Getters):
- [ ] getTaskWithContext returns complete task data
- [ ] getProjectWithContext returns project with summary
- [ ] getBlockWithContext returns block relationships
- [ ] getTableWithRows returns table data correctly
- [ ] getDocWithContext returns doc references
- [ ] getTimelineEventWithContext returns event data
- [ ] getClientWithContext returns client projects
- [ ] getTabWithContext returns tab structure
- [ ] getFileWithContext returns file info
- [ ] getCommentWithContext returns comment target
- [ ] Non-existent entities return null with error message
- [ ] Missing relationships don't cause errors (return empty arrays)
- [ ] All context getters respect workspace boundaries
- [ ] Performance is acceptable (<500ms typical)

### Integration:
- [ ] Search → Context → Action workflow works
- [ ] Complex queries with multiple filters work
- [ ] System handles large datasets efficiently
- [ ] No TypeScript errors in codebase
- [ ] No console errors during testing

---

## Troubleshooting

### Issue: "No workspace selected" error
Solution: Ensure you're authenticated and have a workspace selected in cookies/storage

### Issue: Empty results when data exists
Solution: Check workspace_id filtering - ensure test data is in the correct workspace

### Issue: Type errors in console
Solution: Run `pnpm tsc --noEmit` and fix any TypeScript errors

### Issue: Slow queries (>1s)
Solution:
- Check database indexes
- Verify you're not fetching too much data
- Consider adding pagination

### Issue: Context getter returns null unexpectedly
Solution:
- Verify the entity ID exists
- Check entity belongs to current workspace
- Review error message for details

---

## Next Steps

After testing is complete and all checks pass:
1. Document any issues found
2. Fix any bugs discovered
3. Re-run test checklist
4. Move to Phase 2: AI Command Parsing Layer
