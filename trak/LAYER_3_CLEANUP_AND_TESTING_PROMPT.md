# Layer 3: Cleanup & Testing - AI Search System Final Steps

## ⚠️ CRITICAL NOTE: File Paths Are Examples

**All file paths in this prompt are EXAMPLES based on typical Next.js structure.** Your actual codebase may have different paths. Always:
- Use the ACTUAL file paths from your codebase
- Verify file locations before running commands
- Adjust paths as needed for your specific project structure

For example:
- If prompt says `app/actions/ai-search.ts`, but your file is at `src/actions/ai-search.ts`, use YOUR path
- If prompt says `docs/`, but you use `documentation/`, use YOUR structure
- Search commands and imports should use YOUR actual paths

**When in doubt, search your codebase to find the actual location of files.**

---

## Context & Purpose

You are completing **Layer 3** of Trak's AI search system. Layers 1 and 2 are now complete:
- ✅ **Layer 1**: Entity search functions (17 search functions)
- ✅ **Layer 2**: Context getter functions (10 context getters)

**Layer 3** is the final cleanup phase to ensure everything is production-ready:
1. Remove deprecated files
2. ~~Fix critical issues in Layer 2~~ (ALREADY COMPLETED)
3. Run comprehensive type checks
4. Create testing documentation
5. Verify everything is ready for AI integration

---

## Task 1: Remove Deprecated search.ts File

**Note:** The exact location of this file may vary in your codebase. Common locations:
- `app/actions/search.ts`
- `src/app/actions/search.ts`
- `actions/search.ts`

**Search for it first:**
```bash
find . -name "search.ts" -type f | grep -v "ai-search"
```

### Why it's being removed:
- This was the **old** workspace-wide search implementation
- Built for user-facing search UI with HTML highlighting and preview snippets
- Optimized for display, not for AI consumption
- Function: `searchWorkspaceContent` - comprehensive search across projects, docs, tasks, blocks
- **Replaced by**: The new AI search file (your Layer 1 implementation) which returns clean data for AI

### Before Deleting - Verification Steps:

**Step 1: Check for imports**
```bash
# Search codebase for any files importing from search.ts
# Adjust the pattern to match your actual file structure
grep -r "from.*actions/search" --include="*.ts" --include="*.tsx" .
grep -r "import.*search" --include="*.ts" --include="*.tsx" . | grep -v "ai-search"
```

**Step 2: Check for direct function calls**
```bash
# Search for calls to searchWorkspaceContent (or whatever the function was named)
grep -r "searchWorkspaceContent" --include="*.ts" --include="*.tsx" .
```

**Step 3: Check for type imports**
```bash
# Search for imports of types from the old search file
grep -r "from.*actions/search.*type" --include="*.ts" --include="*.tsx" .
```

### If Imports Are Found:

**Scenario A: User-facing search components still use it**
- DO NOT delete the old search file yet
- Create a new issue: "Migrate user-facing search to use new search system"
- Mark the file as deprecated with a comment at the top:
  ```typescript
  /**
   * @deprecated This file is deprecated and will be removed.
   * For AI search functionality, use:
   * - [path-to-your-ai-search.ts] for entity search
   * - [path-to-your-ai-context.ts] for context getters
   * 
   * For user-facing search, this needs to be migrated to the new system.
   */
  ```
- Document which components need migration
- Skip deletion and move to next task

**Scenario B: No imports found**
- Safe to delete the old search file
- Commit with message: "Remove deprecated search file - replaced by AI search system"

---

## Task 2: Comprehensive Type Checking

### Run TypeScript Compiler

**Command:**
```bash
pnpm tsc --noEmit
# Or if you use a different package manager:
# npm run tsc --noEmit
# yarn tsc --noEmit
```

**This checks:**
- All TypeScript syntax is valid
- All imports resolve correctly
- All types are properly defined
- No type mismatches exist

### Common Issues to Fix:

#### Issue 1: Missing Type Imports
```
Error: Cannot find name 'TaskItem'
```
**Fix:** Add missing import at top of file (use your actual type paths)
```typescript
import type { TaskItem } from "@/types/task";
// Or wherever your types are actually located
```

#### Issue 2: Type Mismatches
```
Error: Type 'string | null' is not assignable to type 'string'
```
**Fix:** Update interface to allow null
```typescript
interface X {
  name: string | null;  // Add | null
}
```

#### Issue 3: Unused Variables
```
Warning: 'variable' is declared but never used
```
**Fix:** Remove unused variable or prefix with underscore
```typescript
const _unused = value;  // Prefix to indicate intentionally unused
```

#### Issue 4: Import Errors
```
Error: Cannot find module '@/app/actions/workspace'
```
**Fix:** Verify file path is correct and file exists. Adjust import to match your actual file location.

### Expected Result:
```bash
$ pnpm tsc --noEmit
# No output = success! All types are valid
```

If errors are found:
1. Fix each error one by one
2. Re-run `pnpm tsc --noEmit` after each fix
3. Continue until no errors remain

---

## Task 3: Verify Import Consistency

**Important:** All file paths below are EXAMPLES. Use your actual file locations.

### Check Your AI Search File Imports

**File:** Your Layer 1 implementation file (e.g., `ai-search.ts`)

**Verify these imports exist (adjust paths to match your structure):**
```typescript
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "[your-workspace-actions-path]";
import { getAuthenticatedUser } from "[your-auth-utils-path]";
// Plus any type imports you're using
```

### Check Your AI Context File Imports

**File:** Your Layer 2 implementation file (e.g., `ai-context.ts`)

**Verify these imports exist (adjust paths to match your structure):**
```typescript
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "[your-workspace-actions-path]";
import { getAuthenticatedUser } from "[your-auth-utils-path]";
// Plus all the type imports for your entities
```

### Verify Helper Function Locations

Ensure these helper functions exist somewhere in your codebase:
- ✅ `getCurrentWorkspaceId()` - Find where this is defined
- ✅ `getAuthenticatedUser()` - Find where this is defined
- ✅ `createClient()` - Find where this is defined

If any are missing or in different locations, update the import paths in your search and context files.

---

## Task 4: Create Testing Documentation

**Note:** Adjust the documentation path to match your project structure. Common locations:
- `docs/AI_SEARCH_TESTING.md`
- `documentation/AI_SEARCH_TESTING.md`
- `docs/testing/ai-search.md`
- Or wherever you keep your documentation

Create a testing guide file at your chosen location.

### Contents:

```markdown
# AI Search & Context Layer Testing Guide

## Overview

This document provides testing guidelines for the AI search system consisting of:
- **Layer 1**: Entity search functions (your search implementation file)
- **Layer 2**: Context getter functions (your context implementation file)

**Note:** All import paths in examples are placeholders. Use your actual file paths.

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
// Adjust import path to match your actual file location
import { searchTasks } from "[your-search-file-path]";

const result = await searchTasks({ status: "todo" });

// Expected:
// - result.data should be array of tasks
// - All tasks should have status === "todo"
// - result.error should be null

console.log("Found tasks:", result.data?.length);
console.log("All todo?", result.data?.every(t => t.status === "todo"));
```

#### Test: searchTasks - Compound filters
```typescript
const result = await searchTasks({ 
  status: "done", 
  priority: "high",
  projectId: "your-project-id"
});

// Expected:
// - Only tasks matching ALL criteria
// - High priority AND done status AND in specified project
```

#### Test: searchProjects - Text search
```typescript
const result = await searchProjects({ searchText: "Marketing" });

// Expected:
// - Projects with "Marketing" in name
// - Case-insensitive search
```

#### Test: searchBlocks - Type filter
```typescript
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
  assigneeId: "nonexistent-user"
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
const result = await searchTableRows({ 
  tableId: "your-table-id",
  searchText: "Italy"
});

// Expected:
// - Rows containing "Italy" in any field
// - Searches across JSONB data fields
```

#### Test: searchComments - Cross-table search
```typescript
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

**Note:** Adjust all import paths to match your actual file locations.

#### Test: getTaskWithContext
```typescript
// Adjust import paths to your actual locations
import { getTaskWithContext } from "[your-context-file-path]";
import { searchTasks } from "[your-search-file-path]";

// First, find a task
const searchResult = await searchTasks({ status: "todo", limit: 1 });
const taskId = searchResult.data?.[0]?.id;

if (taskId) {
  const result = await getTaskWithContext({ taskId });
  
  // Expected:
  // - result.data should contain:
  //   - task (full TaskItem)
  //   - assignees array
  //   - tags array
  //   - references array
  //   - comments array
  //   - block, tab, project, client info
  
  console.log("Task:", result.data?.task.title);
  console.log("Assignees:", result.data?.assignees.length);
  console.log("Project:", result.data?.project.name);
  console.log("Client:", result.data?.client?.name);
}
```

#### Test: getProjectWithContext
```typescript
const searchResult = await searchProjects({ limit: 1 });
const projectId = searchResult.data?.[0]?.id;

if (projectId) {
  const result = await getProjectWithContext({ projectId });
  
  // Expected:
  // - result.data should contain:
  //   - project (full details)
  //   - client (if exists)
  //   - tabs array
  //   - taskSummary (with counts by status)
  //   - files array
  //   - timelineEvents array
  
  console.log("Project:", result.data?.project.name);
  console.log("Tasks:", result.data?.taskSummary.total);
  console.log("By status:", result.data?.taskSummary.byStatus);
  console.log("Overdue:", result.data?.taskSummary.overdue);
}
```

#### Test: getTableWithRows
```typescript
const searchResult = await searchTables({ limit: 1 });
const tableId = searchResult.data?.[0]?.id;

if (tableId) {
  const result = await getTableWithRows({ tableId, limit: 10 });
  
  // Expected:
  // - result.data should contain:
  //   - table (full details)
  //   - fields array (ordered by order)
  //   - rows array (JSONB data)
  //   - rowCount (total count)
  
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
// Try to access entity from another workspace
const result = await getTaskWithContext({ taskId: "other-workspace-task-id" });

// Expected:
// - result.data should be null
// - result.error should indicate not found
// - Should NOT leak data from other workspaces
```

#### Test: Task without relationships
```typescript
// Create a task with no assignees, tags, comments
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
// Find or create a task with assignees, tags, comments, references
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
  limit: 100 
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

// Manually verify counts:
const taskResult = await searchTasks({ projectId: "test-project-id" });
const manualCount = {
  todo: taskResult.data?.filter(t => t.status === "todo").length,
  "in-progress": taskResult.data?.filter(t => t.status === "in-progress").length,
  done: taskResult.data?.filter(t => t.status === "done").length,
};

// Compare:
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

### Test: Complete AI workflow simulation

#### Scenario 1: "Mark all high priority tasks as done"
```typescript
// Step 1: AI searches for tasks
const searchResult = await searchTasks({ 
  priority: "high",
  status: ["todo", "in-progress"]  // Not already done
});

console.log(`Found ${searchResult.data?.length} high priority tasks`);

// Step 2: For each task, AI could get context to verify
if (searchResult.data?.[0]) {
  const context = await getTaskWithContext({ 
    taskId: searchResult.data[0].id 
  });
  console.log(`Task "${context.data?.task.title}" in project "${context.data?.project.name}"`);
}

// Step 3: AI would call updateTaskStatus for each
// (Not testing action functions here, just search/context)
```

#### Scenario 2: "Summarize the Q4 Marketing project"
```typescript
// Step 1: AI searches for project
const searchResult = await searchProjects({ searchText: "Q4 Marketing" });

if (searchResult.data?.[0]) {
  // Step 2: AI gets complete context
  const context = await getProjectWithContext({ 
    projectId: searchResult.data[0].id 
  });
  
  // Step 3: AI has all data to generate summary
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

#### Scenario 3: "Show me everything related to the Launch task"
```typescript
// Step 1: AI searches for task
const searchResult = await searchTasks({ searchText: "Launch" });

if (searchResult.data?.[0]) {
  // Step 2: AI gets complete context
  const context = await getTaskWithContext({ 
    taskId: searchResult.data[0].id 
  });
  
  // Step 3: AI has all relationships
  console.log("Task:", context.data?.task.title);
  console.log("Status:", context.data?.task.status);
  console.log("Priority:", context.data?.task.priority);
  console.log("Assignees:", context.data?.assignees.map(a => a.name).join(", "));
  console.log("Tags:", context.data?.tags.map(t => t.name).join(", "));
  console.log("Project:", context.data?.project.name);
  console.log("Client:", context.data?.client?.name);
  console.log("Comments:", context.data?.comments.length);
  console.log("References:", context.data?.references.length);
}
```

---

## Manual Testing Checklist

Use this checklist to verify the system is ready:

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
**Solution:** Ensure you're authenticated and have a workspace selected in cookies/storage

### Issue: Empty results when data exists
**Solution:** Check workspace_id filtering - ensure test data is in the correct workspace

### Issue: Type errors in console
**Solution:** Run `pnpm tsc --noEmit` and fix any TypeScript errors

### Issue: Slow queries (>1s)
**Solution:** 
- Check database indexes
- Verify you're not fetching too much data
- Consider adding pagination

### Issue: Context getter returns null unexpectedly
**Solution:**
- Verify the entity ID exists
- Check entity belongs to current workspace
- Review error message for details

---

## Next Steps

After testing is complete and all checks pass:
1. ✅ Document any issues found
2. ✅ Fix any bugs discovered
3. ✅ Re-run test checklist
4. ✅ Move to Phase 2: AI Command Parsing Layer
```

---

## Task 5: Create Final Verification Checklist

**Note:** Create this checklist at an appropriate location in your documentation structure.

Common locations:
- `docs/AI_SEARCH_COMPLETION_CHECKLIST.md`
- `documentation/completion/ai-search.md`
- Or wherever you keep project checklists

Create a checklist document at your chosen location.

### Contents:

```markdown
# AI Search System - Completion Checklist

## Layer 1: Entity Search Functions (ai-search.ts)

### Implementation:
- [ ] File created at `app/actions/ai-search.ts`
- [ ] All 17 search functions implemented:
  - [ ] searchTasks
  - [ ] searchBlocks
  - [ ] searchTableRows
  - [ ] searchDocs
  - [ ] searchProjects
  - [ ] searchClients
  - [ ] searchTabs
  - [ ] searchTables
  - [ ] searchTableFields
  - [ ] searchTimelineEvents
  - [ ] searchFiles
  - [ ] searchComments
  - [ ] searchWorkspaceMembers
  - [ ] searchEntityLinks
  - [ ] searchEntityProperties
  - [ ] searchBlockTemplates
  - [ ] searchProjectTemplates
  - [ ] searchPropertyDefinitions

### Code Quality:
- [ ] All functions use `getSearchContext()` helper
- [ ] All functions return `SearchResponse<T[]>` format
- [ ] Workspace filtering is explicit in every query
- [ ] Error handling is consistent (try-catch with console.error)
- [ ] Type definitions are complete and accurate
- [ ] Default limits are set (100)

### Testing:
- [ ] Basic search queries work (status, priority, etc.)
- [ ] Compound filters work (multiple criteria at once)
- [ ] Text search works (searchText parameter)
- [ ] Empty results return empty arrays (not null)
- [ ] Workspace boundaries are respected
- [ ] includeArchived parameter works

---

## Layer 2: Context Getter Functions (ai-context.ts)

### Implementation:
- [ ] File created at `app/actions/ai-context.ts`
- [ ] All 10 context getters implemented:
  - [ ] getTaskWithContext
  - [ ] getProjectWithContext
  - [ ] getBlockWithContext
  - [ ] getTableWithRows
  - [ ] getDocWithContext
  - [ ] getTimelineEventWithContext
  - [ ] getClientWithContext
  - [ ] getTabWithContext
  - [ ] getFileWithContext
  - [ ] getCommentWithContext

### Code Quality:
- [ ] All functions use `getContextHelper()` helper
- [ ] All functions return `ContextResponse<T>` format
- [ ] Workspace filtering is explicit in every query
- [ ] Error handling is consistent
- [ ] Type definitions are complete
- [ ] Helper functions implemented (buildTaskSummary, getProfileForUser, etc.)

### Critical Fixes Applied:
- [ ] getFileWithContext uses `.maybeSingle()` for uploader (doesn't fail on missing)
- [ ] getCommentWithContext has clear security comment about workspace verification

### Testing:
- [ ] All context getters return complete data
- [ ] Missing entities return null with error message
- [ ] Missing relationships return empty arrays (don't cause errors)
- [ ] Workspace boundaries are respected
- [ ] Performance is acceptable (<500ms)
- [ ] Computed summaries are accurate

---

## Layer 3: Cleanup & Testing

### Cleanup:
- [ ] Critical fixes applied to ai-context.ts
- [ ] Old search.ts file removed (or marked deprecated if still needed)
- [ ] No broken imports after removal

### Type Checking:
- [ ] `pnpm tsc --noEmit` runs with no errors
- [ ] All imports are correct and resolve
- [ ] All type definitions are accurate
- [ ] No unused variables or imports

### Documentation:
- [ ] Testing guide created at `docs/AI_SEARCH_TESTING.md`
- [ ] Completion checklist created at `docs/AI_SEARCH_COMPLETION_CHECKLIST.md`
- [ ] All functions are documented with clear comments

### Final Verification:
- [ ] Search functions work in development environment
- [ ] Context getters work in development environment
- [ ] Integration tests pass (search → context workflow)
- [ ] No console errors during usage
- [ ] Performance is acceptable for production

---

## Ready for Next Phase

Once all items above are checked:
- [ ] Layer 1 ✅ Complete
- [ ] Layer 2 ✅ Complete
- [ ] Layer 3 ✅ Complete
- [ ] Ready to build Phase 0: Context Collection Schema
- [ ] Ready to build Phase 1: Function Schema Design
- [ ] Ready to build Phase 2: AI System Prompt
- [ ] Ready to build Phase 3: Execution Layer
- [ ] Ready to build Phase 4: UI Integration

**Current Status:** AI Search & Context Layer COMPLETE 🎉
**Next Step:** Begin building the AI command parsing and execution system
```

---

## Task 6: Final Checklist Execution

Execute the following steps in order:

### Step 1: Remove Deprecated Files
- [ ] Search for imports of old search file
- [ ] Either delete old search file or mark as deprecated
- [ ] Verify no broken imports after removal
- [ ] Commit changes

### Step 2: Type Check
- [ ] Run `pnpm tsc --noEmit` (or your equivalent command)
- [ ] Fix any type errors found
- [ ] Re-run until no errors

### Step 3: Create Documentation
- [ ] Create testing guide at your chosen documentation location
- [ ] Create completion checklist at your chosen documentation location
- [ ] Commit documentation

### Step 4: Manual Testing
- [ ] Test at least 3 search functions
- [ ] Test at least 3 context getters
- [ ] Verify integration workflow
- [ ] Document any issues found

### Step 5: Final Verification
- [ ] Review all checklists
- [ ] Confirm all tasks complete
- [ ] Mark Layer 3 as COMPLETE

---

## Success Criteria

Layer 3 is complete when:

1. ✅ Old search file removed or properly deprecated
2. ✅ `pnpm tsc --noEmit` (or equivalent) passes with no errors
3. ✅ Testing documentation created
4. ✅ Completion checklist created
5. ✅ Manual testing completed
6. ✅ All Layer 1 and Layer 2 functions verified working
7. ✅ System is production-ready for AI integration

---

## Next Phase: AI Integration

After Layer 3 completion, you'll build:

**Phase 0: Context Collection Schema**
- Define what context the AI needs to execute commands
- Design the schema for collecting user intent + workspace state

**Phase 1: Function Schema Design**
- Map natural language intents to function calls
- Define tool/function schemas for Claude API
- Design the "function calling" layer

**Phase 2: System Prompt**
- Write the AI system prompt
- Define behavior, constraints, and capabilities
- Create example commands and responses

**Phase 3: Execution Layer**
- Build the API endpoint that receives AI commands
- Implement the orchestration logic (search → context → action)
- Handle streaming responses

**Phase 4: UI Integration**
- Wire up CMD+K interface
- Handle loading states
- Display AI responses

But that's for later. **Right now, focus on completing Layer 3 tasks.**

---

## Deliverables Summary

After completing Layer 3, you should have:

1. ✅ Clean codebase (old search file removed or deprecated)
2. ✅ No TypeScript errors (type checker passes)
3. ✅ Testing documentation created (comprehensive testing guide)
4. ✅ Completion checklist created (verification checklist)
5. ✅ All search and context functions tested and working
6. ✅ System ready for AI command parsing integration

**Status:** All foundational infrastructure for AI-powered search is complete! 🚀
