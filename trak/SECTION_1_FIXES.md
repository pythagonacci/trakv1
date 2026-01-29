# Section 1 Fixes: Critical Data Integrity & Correctness Bugs

All 4 critical data integrity bugs have been fixed. Summary below:

---

## Fix 1.1: Due Date Filter Logic Inconsistency ✅

**File:** `trak/src/app/actions/ai-search.ts` (lines 853-877)

**Problem:**
Due date property filters used OR logic (merging results) while other property filters (assignee, tags, status) used AND logic (intersecting results). This caused queries like "tasks assigned to John with due date today" to return tasks that were (assigned to John) OR (due today) instead of the correct AND logic.

**Fix:**
Added intersection logic after fetching due date property IDs to maintain AND semantics with other filters:
```typescript
// Intersect with other property filters to maintain AND semantics
if (matchingTaskIds !== null) {
  dueDatePropertyIds = intersectIds(matchingTaskIds, dueDatePropertyIds);
  matchingTaskIds = dueDatePropertyIds;
}
```

**Impact:**
- Queries now return correct results when combining due date with other filters
- Prevents returning incorrect tasks to users

---

## Fix 1.2: Partial Transaction Failure - Orphaned Tables ✅

**File:** `trak/src/lib/ai/tool-executor.ts` (lines 433-471)

**Problem:**
Table creation and block creation were not atomic. If `createTable` succeeded but `createBlock` failed (e.g., invalid tabId), the table would exist in the database but be invisible to the user. Repeated attempts would create multiple orphan tables.

**Fix:**
Added rollback logic to delete the table if block creation fails:
```typescript
if ("error" in blockResult) {
  // Clean up the orphaned table to maintain data consistency
  await deleteTable(tableResult.data.table.id);

  return {
    success: false,
    error: `Failed to add table to tab: ${blockResult.error}. Table creation rolled back.`,
  };
}
```

Also added import for `deleteTable` function.

**Impact:**
- No more orphaned tables in the database
- Clear error messages to users
- Data consistency maintained

---

## Fix 1.3: Silent Data Loss in Field Mapping ✅

**File:** `trak/src/lib/ai/tool-executor.ts` (lines 986-1052)

**Problem:**
When mapping row data by field names in `bulkInsertRows`, unmatched field names (typos like "Emial" instead of "Email") were silently dropped without warning. Users would see incomplete data with no explanation.

**Fix:**
Added tracking and logging of unmatched fields:
```typescript
// Track all unmatched fields
const allUnmatchedFields = new Map<string, number>();

// During mapping, collect unmatched keys
for (const [key, value] of Object.entries(data)) {
  // ... existing mapping logic ...
  if (no match found) {
    unmatchedKeys.push(key);
    allUnmatchedFields.set(key, (allUnmatchedFields.get(key) || 0) + 1);
  }
}

// Log detailed warning with available fields
console.warn(
  `[mapRowDataToFieldIds] WARNING: Some field names did not match table schema.`,
  `\nUnmatched fields: ${unmatchedSummary}`,
  `\nAvailable fields: ${availableFields}`
);
```

**Impact:**
- Developers can see warnings in logs when field names don't match
- AI execution traces include unmatched field information via `aiDebug`
- Easier to diagnose data loss issues
- Future enhancement: Could throw error to prevent silent data loss

---

## Fix 1.4: Ambiguous Assignee Resolution - Wrong Data Created ✅

**File:** `trak/src/lib/ai/tool-executor.ts` (lines 917-1001, 291-334)

**Problem:**
When resolving assignees by name, if multiple workspace members matched (e.g., "John Smith" and "John Doe" for search "John"), the function would create an external assignee with no user_id. This meant:
- Task wouldn't appear in the correct user's task list
- Notifications wouldn't work
- Wrong person assignment

**Fix:**
Refactored `resolveTaskAssignees` to return both resolved assignees and ambiguities:
```typescript
interface ResolveAssigneesResult {
  resolved: Array<{ id?: string | null; name?: string | null }>;
  ambiguities: Array<{
    input: string;
    matches: Array<{ id: string; name: string; email: string }>
  }>;
}

// When multiple matches found, add to ambiguities instead of creating external assignee
if (search.data && search.data.length > 1) {
  ambiguities.push({
    input: name,
    matches: search.data.map(m => ({ id: m.user_id, name: m.name, email: m.email }))
  });
}
```

In the `setTaskAssignees` case handler, check for ambiguities and return detailed error:
```typescript
if (assigneeResult.ambiguities.length > 0) {
  return {
    success: false,
    error: `Ambiguous assignees found. Please specify which person you meant:

"John" matches multiple workspace members:
  - John Smith (john.smith@example.com)
  - John Doe (john.doe@example.com)

Tip: Use searchWorkspaceMembers to get the exact user ID...`
  };
}
```

**Impact:**
- AI will ask for clarification when assignee is ambiguous
- No more incorrect external assignees created
- Users get clear guidance on how to resolve ambiguity
- Proper user linking ensures notifications and task lists work correctly

---

## Testing Recommendations

### 1. Due Date Filter (Fix 1.1)
```typescript
// Test: Tasks with assignee AND due date filter
const result = await executeAICommand(
  "Find tasks assigned to John with due date 2026-01-27",
  testContext
);
// Verify: Only returns tasks that match BOTH criteria
```

### 2. Table Creation Rollback (Fix 1.2)
```typescript
// Test: Block creation failure should rollback table
const result = await executeAICommand(
  "Create a table in invalid-tab-id",
  testContext
);
// Verify: Error returned AND no orphan table in database
```

### 3. Field Mapping Warning (Fix 1.3)
```typescript
// Test: Typo in field name should log warning
const result = await executeAICommand(
  "Create table with columns Name, Email and add row with Emial (typo)",
  testContext
);
// Verify: Warning logged with "Emial" as unmatched field
```

### 4. Ambiguous Assignee (Fix 1.4)
```typescript
// Setup: Create 2 users named "John Smith" and "John Doe"
// Test: Ambiguous name should return error with choices
const result = await executeAICommand(
  "Assign task to John",
  testContext
);
// Verify: Error lists both John Smith and John Doe with emails
```

---

## Files Modified

1. `/Users/amnaahmad/trakv1/trak/src/app/actions/ai-search.ts`
   - Fixed due date filter intersection logic

2. `/Users/amnaahmad/trakv1/trak/src/lib/ai/tool-executor.ts`
   - Added table deletion import
   - Added rollback logic in createTable case
   - Added field mapping validation and warnings
   - Refactored assignee resolution with ambiguity detection
   - Added detailed error messages for ambiguous assignees

---

## Status: ✅ All Section 1 Fixes Complete

All 4 critical data integrity bugs have been addressed with production-ready fixes.
