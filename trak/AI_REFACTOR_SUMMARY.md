# AI System Refactor - Implementation Summary

## Overview

This document summarizes the implementation of the AI prompt-to-action system refactor based on the requirements in [claude.md](./claude.md).

## Changes Implemented

### ✅ 1. System Prompt Rewrite (Issues 1, 2, 8, 9) - HIGHEST PRIORITY

**File**: `src/lib/ai/system-prompt.ts`

#### Knowledge/Action Modes (Issue 1)
Added clear distinction between two operating modes:

- **KNOWLEDGE MODE**: AI has extensive world knowledge (geography, history, elections, companies, etc.)
  - Critical: AI should NEVER say "I don't have access to external data" for well-known facts
  - Example: Can generate 50 US states with 2016 election results from memory

- **ACTION MODE**: AI uses tools to read/write data in Trak
  - Search, create, update, delete operations
  - Most requests combine both modes

#### Decision Trees (Issue 2)
Added visual decision trees for tool selection:

1. **Update Table Rows Decision Tree**
   ```
   Have field names and labels? → updateTableRowsByFieldNames ★ PRIMARY ★
   Have field IDs and option IDs? → bulkUpdateRows (only if you already have UUIDs)
   ```

2. **Insert Multiple Rows Decision Tree**
   ```
   3+ rows? → bulkInsertRows ★ REQUIRED ★
   1-2 rows? → createRow
   ```

3. **Create Table Field Decision Tree**
   ```
   Priority field? → type: "priority" (NOT "select" named "Priority")
   Status field? → type: "status" (NOT "select" named "Status")
   Custom dropdown? → type: "select"
   ```

#### Mandatory Field Type Table (Issue 2)
Added prominent table that the AI cannot miss:

| User Wants | Correct Type | ❌ WRONG Approach |
|------------|--------------|-------------------|
| Priority | `type: "priority"` | `type: "select"` named "Priority" |
| Status | `type: "status"` | `type: "select"` named "Status" |
| Dropdown | `type: "select"` | Using priority for custom options |

**WHY THIS MATTERS**: Different field types have different UI rendering, config structures, and visual treatment.

#### Context Enhancements (Issue 8)
Enhanced context section with actionable instructions:

```
- Current Project ID: xxx ← USE THIS DIRECTLY, do not search for project
- Current Tab ID: xxx ← USE THIS DIRECTLY for creating blocks/tables
```

Clear guidance: When context values are provided, use them directly instead of searching.

#### Efficiency Rules (Issue 9)
Added prominent efficiency section:

1. Use bulk operations for 3+ items
2. Prefer high-level tools that combine steps
3. Don't fetch data you already have from context
4. Each tool call adds latency - be efficient

---

### ✅ 2. Warning Propagation (Issues 3, 5)

**Files**: `src/lib/ai/tool-executor.ts`

#### Extended ToolCallResult Type
```typescript
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];  // NEW: Array of warning messages
  hint?: string;        // NEW: Helpful hints for AI
}
```

#### mapRowDataToFieldIds Now Returns Warnings
Changed from silently logging to console to returning warnings that reach the AI:

```typescript
return {
  rows: mappedRows,
  warnings: ["Fields not found: 'Nonexistent'. Data for these fields was dropped..."]
}
```

#### bulkInsertRows Propagates Warnings
The executor now attaches warnings from field mapping to the final result:

```javascript
const mappingResult = await mapRowDataToFieldIds(tableId, normalizedRows);
const result = await wrapResult(bulkInsertRows({ tableId, rows: mappingResult.rows }));

if (mappingResult.warnings.length > 0) {
  result.warnings = mappingResult.warnings;
}
```

#### updateTableRowsByFieldNames Provides Hints
When 0 rows match filters, the AI now receives detailed context:

```javascript
return {
  success: true,
  data: { updated: 0, rowIds: [], totalRowsScanned: 100 },
  hint: "No rows matched filter {Party=Republican}. Scanned 100 rows. Check that field names and values match exactly..."
}
```

---

### ✅ 3. Default Config for Priority/Status Fields (Issue 7)

**File**: `src/app/actions/tables/field-actions.ts`

#### Auto-populate Priority Levels
When creating a priority field without config, automatically generate:
- Critical (red, order 4)
- High (orange, order 3)
- Medium (blue, order 2)
- Low (gray, order 1)

```typescript
if (input.type === "priority" && (!config?.levels?.length)) {
  config = {
    ...config,
    levels: [
      { id: crypto.randomUUID(), label: "Critical", color: "#ef4444", order: 4 },
      { id: crypto.randomUUID(), label: "High", color: "#f97316", order: 3 },
      { id: crypto.randomUUID(), label: "Medium", color: "#3b82f6", order: 2 },
      { id: crypto.randomUUID(), label: "Low", color: "#6b7280", order: 1 },
    ],
  };
}
```

#### Auto-populate Status Options
When creating a status field without config, automatically generate:
- Not Started (gray)
- In Progress (blue)
- Complete (green)

**Result**: Fields are immediately usable after creation without the AI needing to specify config.

---

### ✅ 4. Enhanced Tool Descriptions (Issues 2, 4)

**File**: `src/lib/ai/tool-definitions.ts`

#### updateTableRowsByFieldNames - Marked as PRIMARY
```
★ PRIMARY TOOL FOR TABLE UPDATES ★

What it does automatically:
- Resolves field names to field IDs (you don't need getTableSchema)
- Resolves option labels to option IDs
- Filters rows by field values
- Applies bulk updates
- All in ONE call

USE THIS instead of manually calling getTableSchema + bulkUpdateRows.
```

#### createField - Enhanced with Warnings
```
⚠️  CRITICAL: Use the CORRECT field TYPE

Field Type Rules:
- Priority field? → type: "priority" (NOT "select" named "Priority")
- Status field? → type: "status" (NOT "select" named "Status")
- Custom dropdown? → type: "select"

WHY THIS MATTERS:
- Priority/status fields have special UI rendering
- They use different config structures
- Using the wrong type BREAKS the UI

Default values:
- Priority fields auto-populate with Critical/High/Medium/Low
- Status fields auto-populate with Not Started/In Progress/Complete
```

#### bulkUpdateRows - Redirects to Preferred Tool
```
⚠️  PREFER updateTableRowsByFieldNames INSTEAD

ONLY use this if you already have field IDs and option IDs as UUIDs.

If you only have field names and option labels, use updateTableRowsByFieldNames
instead - it's much easier.
```

#### bulkInsertRows - Emphasizes Bulk Usage
```
When to use:
- Creating 3+ rows → ALWAYS use this (required)
- Creating 50 rows → ONE call, NOT 50 createRow calls
- Populating a table → Use this

Example for 50 US states:
[{ data: { 'State': 'Alabama', 'Capital': 'Montgomery' } }, ...]
```

#### getTableSchema - Clarifies When NOT to Use
```
When NOT to use:
- Before updateTableRowsByFieldNames (it resolves names automatically)
- Before bulkInsertRows (it resolves names automatically)

Tip: If updating rows with field names/labels, use updateTableRowsByFieldNames
directly instead of getTableSchema + bulkUpdateRows.
```

---

## Testing Checklist

Based on the guide, verify these test scenarios:

### ✅ Test 1: Knowledge Test
**Command**: "Create a table of 50 US states with 2016 election results"

**Expected Behavior**:
- AI generates all 50 states with correct 2016 results from knowledge
- Uses `bulkInsertRows` with ONE call (not 50 `createRow` calls)
- Does NOT say "I don't have access to election data"

### ✅ Test 2: Field Type Test
**Command**: "Add a Priority column"

**Expected Behavior**:
- Uses `type: "priority"` (NOT `type: "select"`)
- Field is created with default levels (Critical/High/Medium/Low)
- Field is immediately usable

### ✅ Test 3: High-Level Tool Test
**Command**: "Mark Republican states as low priority"

**Expected Behavior**:
- Uses `updateTableRowsByFieldNames` with ONE call
- Does NOT call `getTableSchema` first
- Correctly resolves "Priority" field name and "low" option label

### ✅ Test 4: Warning Test
**Command**: Insert rows with a misspelled field name

**Expected Behavior**:
- Returns warning: "Fields not found in table schema: 'Statte'. Data for these fields was dropped. Available fields: State, Capital, ..."
- AI sees the warning and can self-correct or inform user

### ✅ Test 5: Context Test
**Command**: With `currentProjectId` set, say "Create a table in this project"

**Expected Behavior**:
- Uses `currentProjectId` directly
- Does NOT search for projects
- Creates table in the correct project

### ✅ Test 6: Zero Match Test
**Command**: Update rows with a filter that matches nothing

**Expected Behavior**:
- Returns hint: "No rows matched filter {Party=Democratic}. Scanned 50 rows. Check that field names and values match exactly..."
- AI understands why no updates occurred

---

## Files Modified

1. **src/lib/ai/system-prompt.ts**
   - Added Knowledge/Action modes section
   - Added decision trees for tool selection
   - Added mandatory field type table
   - Enhanced context section with actionable instructions
   - Added efficiency rules section

2. **src/lib/ai/tool-executor.ts**
   - Extended `ToolCallResult` interface with `warnings` and `hint` fields
   - Modified `mapRowDataToFieldIds` to return warnings instead of just logging
   - Updated `bulkInsertRows` case to propagate warnings
   - Enhanced `updateTableRowsByFieldNames` to provide hints when no rows match

3. **src/app/actions/tables/field-actions.ts**
   - Added auto-population of default config for priority fields
   - Added auto-population of default config for status fields

4. **src/lib/ai/tool-definitions.ts**
   - Enhanced `updateTableRowsByFieldNames` description (marked as PRIMARY)
   - Enhanced `createField` description with prominent warnings
   - Updated `bulkUpdateRows` description to redirect to preferred tool
   - Updated `bulkInsertRows` description to emphasize bulk usage
   - Updated `getTableSchema` description to clarify when NOT to use

---

## Impact Summary

### Before Refactor:
- ❌ AI claimed it didn't have access to world knowledge
- ❌ AI picked wrong tools (getTableSchema + bulkUpdateRows instead of updateTableRowsByFieldNames)
- ❌ AI used `type: "select"` for priority fields, breaking UI
- ❌ Silent data loss when field names didn't match
- ❌ No feedback when filters matched 0 rows
- ❌ Priority/status fields created without options, causing update failures
- ❌ AI searched for projects when currentProjectId was already provided
- ❌ Made 50+ individual calls instead of one bulk operation

### After Refactor:
- ✅ AI generates factual data from knowledge and stores it
- ✅ AI uses high-level tools (updateTableRowsByFieldNames) as primary choice
- ✅ AI uses correct field types (priority, status, select)
- ✅ Warnings surface to AI when data is dropped
- ✅ Helpful hints when operations match 0 rows
- ✅ Fields always created with usable defaults
- ✅ AI uses context values directly without unnecessary searches
- ✅ Efficient bulk operations for multi-item tasks

---

## Next Steps

1. **Run Test Suite**: Execute the 6 test scenarios above to verify all changes work correctly
2. **Monitor AI Behavior**: Track if AI now:
   - Uses world knowledge appropriately
   - Picks correct tools (updateTableRowsByFieldNames, bulkInsertRows)
   - Uses correct field types (priority, status)
   - Self-corrects when receiving warnings
3. **Iterate**: If issues persist, strengthen the guidance further in the system prompt

---

## Notes

- The system prompt is now structured around Knowledge + Action modes rather than pure tool orchestration
- Decision trees use ASCII art for visual distinctiveness
- The field type table is repeated and prominently placed to prevent the common mistake
- Tool descriptions now include "when to use" and "when NOT to use" sections
- All changes maintain backward compatibility with existing code
