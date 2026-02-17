# Source Tracking for Entity Properties on Blocks - Implementation Plan

## Overview

Currently, blocks accept universal properties stored in the `entity_properties` table, but blocks cannot be used as sources when creating table rows, timeline events, or task items. This plan outlines how to enable blocks to serve as source entities, allowing the LLM to create variations/views of Tables, Timelines, and Tasks that reference blocks as their source.

## Current State Analysis

### What Works Today

1. **Blocks have properties**: Blocks store properties in `entity_properties` table where:
   - `entity_type` = 'block'
   - `entity_id` = block ID
   - Properties include: status, priority, assignee_ids, due_date, tags

2. **Table rows, timeline events, and task items accept source data**:
   - All three entity types have `source_entity_type`, `source_entity_id`, and `source_sync_mode` columns
   - Currently accept: `"task"`, `"timeline_event"`, `"table_row"` as source types
   - Source tracking enables sync functionality (snapshot/live modes)

3. **Blocks can be searched**: `searchBlocks()` function exists and returns blocks with their properties

### What's Missing

1. **Blocks are not accepted as source entities**:
   - `TableRowSourceEntityType` = `"task" | "timeline_event" | "table_row"` (missing "block")
   - `TaskSourceEntityType` = `"task" | "timeline_event" | "table_row"` (missing "block")
   - `TimelineSourceEntityType` = `"task" | "timeline_event" | "table_row"` (missing "block")

2. **Database constraints don't allow blocks**:
   - Check constraints on `table_rows`, `task_items`, `timeline_events` tables restrict `source_entity_type` to current values

3. **Source tracking validation doesn't handle blocks**:
   - `annotateRowsWithSourceMetadata()` only validates against `task_items`, `timeline_events`, `table_rows` tables
   - Sync functions (`syncTableRowEditToSource()`, etc.) don't handle syncing back to blocks

4. **LLM system prompt doesn't mention blocks**:
   - Instructions only mention tasks, timeline events, and table rows as valid sources

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Update Table Constraints

**File**: Create new migration: `supabase/migrations/[timestamp]_add_block_source_tracking.sql`

**Changes**:
- Update `table_rows` table constraint to allow `source_entity_type = 'block'`
- Update `task_items` table constraint to allow `source_entity_type = 'block'`
- Update `timeline_events` table constraint to allow `source_entity_type = 'block'`

**SQL Example** (following the pattern from `20260216120000_allow_table_row_source_entity_type.sql`):
```sql
-- 1. Drop old constraints if they exist
DO $$
BEGIN
  -- Drop table_rows_source_entity_check
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_entity_check'
  ) THEN
    ALTER TABLE public.table_rows
      DROP CONSTRAINT table_rows_source_entity_check;
  END IF;
  
  -- Drop table_rows_source_metadata_consistency
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'table_rows'
      AND constraint_name = 'table_rows_source_metadata_consistency'
  ) THEN
    ALTER TABLE public.table_rows
      DROP CONSTRAINT table_rows_source_metadata_consistency;
  END IF;
END $$;

-- 2. Re-add constraint allowing task, timeline_event, table_row, and block
ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_entity_check
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL)
    OR (
      source_entity_type IN ('task', 'timeline_event', 'table_row', 'block')
      AND source_entity_id IS NOT NULL
    )
  );

-- 3. Re-add consistency constraint (all three source columns together or all null)
ALTER TABLE public.table_rows
  ADD CONSTRAINT table_rows_source_metadata_consistency
  CHECK (
    (source_entity_type IS NULL AND source_entity_id IS NULL AND source_sync_mode IS NULL)
    OR
    (
      source_entity_type IN ('task', 'timeline_event', 'table_row', 'block')
      AND source_entity_id IS NOT NULL
      AND source_sync_mode IN ('snapshot', 'live')
    )
  );

-- Similar pattern for task_items and timeline_events
-- (following the pattern from 20260216130000_allow_table_row_source_for_tasks_and_timelines.sql)
```

### Phase 2: TypeScript Type Updates

#### 2.1 Update Type Definitions

**Files to update**:
- `src/types/table.ts`
- `src/types/task.ts`
- `src/types/timeline.ts`

**Changes**:
```typescript
// table.ts
export type TableRowSourceEntityType = "task" | "timeline_event" | "table_row" | "block";

// task.ts
export type TaskSourceEntityType = "task" | "timeline_event" | "table_row" | "block";

// timeline.ts
export type TimelineSourceEntityType = "task" | "timeline_event" | "table_row" | "block";
```

#### 2.2 Update Function Signatures

**Files to update**:
- `src/app/actions/tables/row-actions.ts` - `syncTableRowEditToSource()`
- `src/app/actions/tasks/item-actions.ts` - `createTaskItem()` parameter types
- `src/app/actions/timelines/event-actions.ts` - `createTimelineEvent()` parameter types
- `src/app/actions/tables/bulk-actions.ts` - `bulkInsertRows()` parameter types

**Changes**:
- Update `sourceEntityType` parameter types to include `"block"`
- Update validation logic to accept `"block"` as valid

### Phase 3: Source Tracking Validation Updates

#### 3.1 Update `normalizeSourceEntityType()` Function

**File**: `src/lib/ai/tool-executor.ts` (line 5248) and `src/app/actions/tables/bulk-actions.ts` (line 481)

**Changes**:
```typescript
function normalizeSourceEntityType(value: unknown): "task" | "timeline_event" | "table_row" | "block" | null {
  if (value === "task" || value === "timeline_event" || value === "table_row" || value === "block") return value;
  return null;
}
```

#### 3.2 Update `extractSourceCandidateIdFromRow()` Function

**File**: `src/lib/ai/tool-executor.ts` (around line 5262)

**Changes**:
Add block ID detection keys:
```typescript
const candidateKeys: Array<{ keys: string[]; hintedType?: "task" | "timeline_event" | "table_row" | "block" }> = [
  { keys: ["task_id", "taskid"], hintedType: "task" },
  { keys: ["timeline_event_id", "timelineeventid", "event_id", "eventid"], hintedType: "timeline_event" },
  { keys: ["table_row_id", "tablerowid", "row_id", "rowid"], hintedType: "table_row" },
  { keys: ["block_id", "blockid"], hintedType: "block" },  // NEW
  { keys: ["source_id", "entity_id", "id"] },
];
```

#### 3.3 Update `annotateRowsWithSourceMetadata()`

**File**: `src/lib/ai/tool-executor.ts` (around line 4995)

**Changes**:
1. Add block validation to the database query section:
```typescript
const [taskResult, timelineResult, tableRowResult, blockResult] = await Promise.all([
  // ... existing queries ...
  params.supabase
    .from("blocks")
    .select("id, tabs!inner(projects!inner(workspace_id))")
    .eq("tabs.projects.workspace_id", params.workspaceId)
    .in("id", ids),
]);
```

2. Add block IDs to validation sets:
```typescript
const blockIds = new Set(
  ((blockResult.data || []) as Array<{ id: string }>).map((item) => item.id)
);
```

3. Update validation checks to include blocks:
```typescript
// In llmValidated filter
return taskIds.has(id) || timelineIds.has(id) || tableRowIds.has(id) || blockIds.has(id);

// In titleToEntity map building
if (taskIds.has(entity.id) || timelineIds.has(entity.id) || tableRowIds.has(entity.id) || blockIds.has(entity.id)) {
  // ...
}
```

4. Update `inferSourceEntityTypeForCandidate()` to handle blocks:
```typescript
function inferSourceEntityTypeForCandidate(
  candidate: { id: string; hintedType?: string },
  taskIds: Set<string>,
  timelineIds: Set<string>,
  tableRowIds: Set<string>,
  blockIds: Set<string>  // NEW
): "task" | "timeline_event" | "table_row" | "block" | null {
  // Check blockIds first if hintedType is "block"
  if (candidate.hintedType === "block" && blockIds.has(candidate.id)) {
    return "block";
  }
  // ... existing logic ...
  // Add fallback check for blocks
  if (blockIds.has(candidate.id)) {
    return "block";
  }
  return null;
}
```

5. Update `extractSourceCandidateIdFromRow()` to detect block IDs:
```typescript
const candidateKeys = [
  { keys: ["task_id", "taskid"], hintedType: "task" },
  { keys: ["timeline_event_id", "timelineeventid", "event_id", "eventid"], hintedType: "timeline_event" },
  { keys: ["block_id", "blockid"], hintedType: "block" },  // NEW
  { keys: ["source_id", "entity_id", "id"] },
];
```

#### 3.2 Update `searchedEntities` Type

**File**: `src/lib/ai/tool-executor.ts`

**Changes**:
Update the `searchedEntities` parameter type to include blocks:
```typescript
searchedEntities?: Array<{ 
  id: string; 
  title: string; 
  entityType: "task" | "timeline_event" | "table_row" | "block" 
}>;
```

### Phase 4: Database RPC Functions & Triggers

#### 4.1 Update `create_task_full` RPC Function

**File**: `supabase/migrations/[timestamp]_add_block_source_tracking.sql`

**Changes**: The RPC function `create_task_full` has logic that sets snapshot-only for `table_row` sources. Need to decide if blocks should also be snapshot-only:

```sql
-- In create_task_full function, around line 745
v_effective_source_sync_mode := CASE
  WHEN p_source_entity_type = 'table_row' THEN 'snapshot'
  WHEN p_source_entity_type = 'block' THEN 'snapshot'  -- NEW: blocks are snapshot-only
  ELSE COALESCE(p_source_sync_mode, 'snapshot')
END;
```

**Decision needed**: Should blocks support "live" sync mode, or always be "snapshot" like table_row?

#### 4.2 Update Sync Triggers (if needed)

**File**: `supabase/migrations/[timestamp]_add_block_source_tracking.sql`

**Changes**: The sync triggers (`sync_live_task_property_to_source`, `sync_live_task_item_to_source`) have snapshot-only policy for `table_row`. If blocks are snapshot-only, add similar check:

```sql
-- Snapshot-only policy for block-sourced tasks.
IF v_source_entity_type = 'block' THEN
  RETURN COALESCE(NEW, OLD);
END IF;
```

### Phase 5: Sync Functionality Updates

#### 5.1 Update `syncTableRowEditToSource()`

**File**: `src/app/actions/tables/row-actions.ts` (around line 513)

**Changes**:
Add block sync handling:
```typescript
async function syncTableRowEditToSource(params: {
  // ... existing params
}): Promise<void> {
  // ... existing code ...
  
  if (row.source_entity_type === "block") {
    // Sync property changes back to block's entity_properties
    await syncTableRowEditToBlock(row.source_entity_id, field, value, authContext);
    return;
  }
  
  // ... existing code ...
}
```

**New function to create**:
```typescript
async function syncTableRowEditToBlock(
  blockId: string,
  field: TableField,
  value: unknown,
  authContext: AuthContext
): Promise<void> {
  // Map field changes to entity_properties updates
  // Handle status, priority, assignee, due_date, tags fields
  // Use setEntityProperties() or similar function
}
```

#### 5.2 Update Task/Timeline Sync Functions

Similar updates needed for:
- Task sync functions (if they exist)
- Timeline event sync functions (if they exist)

**Note**: Need to check if tasks/timelines have similar sync-to-source functionality that needs updating.

### Phase 6: LLM System Prompt Updates

#### 6.1 Update Source Tracking Instructions

**File**: `src/lib/ai/system-prompt.ts` (around line 542)

**Changes**:
Update the source tracking section to include blocks:
```typescript
#### Source Tracking (NON-NEGOTIABLE):
When creating table rows from existing workspace entities (tasks, timeline events, table rows, **blocks**, subtasks):
- You MUST include \`source_entity_type\`, \`source_entity_id\`, and \`source_sync_mode\` on EVERY row that comes from an existing entity.
- Valid source types: "task", "timeline_event", "table_row", **"block"**
- When creating from blocks, use \`source_entity_type: "block"\` and the block's ID as \`source_entity_id\`
```

#### 6.2 Update Workflow Executor Prompts

**File**: `src/lib/ai/workflow-executor.ts` (around lines 712 and 1147)

**Changes**:
Update both `executeWorkflowAICommand` and `executeWorkflowAICommandStream` system prompts to mention blocks as valid sources.

### Phase 6: Block Property Mapping

#### 7.1 Create Block Property Extraction Function

**New file or add to existing**: `src/app/actions/block.ts` or `src/app/actions/entity-properties.ts`

**Purpose**: Extract properties from a block's `entity_properties` for use when creating table rows/timeline events/tasks from blocks.

**Function signature**:
```typescript
async function getBlockProperties(
  blockId: string,
  authContext?: AuthContext
): Promise<ActionResult<EntityProperties | null>>
```

This function should:
1. Query `entity_properties` for the block
2. Return the properties in the same format as other entities
3. Handle cases where block has no properties

#### 7.2 Update Block Search Results

**Note**: `searchBlocks()` already enriches results with properties via `enrichEntitiesWithProperties()`, so this should already work. Verify that blocks returned from search include all necessary property information.

### Phase 8: Additional Updates

#### 8.1 Update `createTaskFullRpc` Function Signature

**File**: `src/app/actions/tasks/super-actions.ts` (line 35)

**Changes**:
```typescript
sourceEntityType?: "task" | "timeline_event" | "table_row" | "block";
```

#### 8.2 Update Duplicate Tasks RPC (if applicable)

**File**: `supabase/migrations/[timestamp]_add_block_source_tracking.sql`

**Check**: The migration `20260216062500_fix_duplicate_tasks_rpc_source_metadata.sql` has logic for handling `table_row` sources when duplicating tasks. The function `duplicate_tasks_to_block` preserves source metadata. May need similar logic for blocks:

```sql
-- In duplicate_tasks_to_block function, around line 52-63
CASE
  WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN NULL
  WHEN v_task.source_entity_type = 'block' AND v_task.source_entity_id IS NOT NULL THEN NULL  -- NEW
  ELSE v_task.id
END,
CASE
  WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN 'table_row'
  WHEN v_task.source_entity_type = 'block' AND v_task.source_entity_id IS NOT NULL THEN 'block'  -- NEW
  ELSE 'task'
END,
CASE
  WHEN v_task.source_entity_type = 'table_row' AND v_task.source_entity_id IS NOT NULL THEN v_task.source_entity_id
  WHEN v_task.source_entity_type = 'block' AND v_task.source_entity_id IS NOT NULL THEN v_task.source_entity_id  -- NEW
  ELSE v_task.id
END,
```

**Decision needed**: When duplicating a task that has a block as its source, should the duplicate also reference the block, or should it reference the original task?

#### 8.3 Update Executor Source Tracking Messages

**File**: `src/lib/ai/executor.ts` (around lines 1865, 3009)

**Changes**: Update source tracking warning messages to mention "block" as a valid source type.

**File**: `src/app/actions/ai-search.ts` (around line 261)

**Check**: Ensure `BlockResult` interface includes properties (it already does based on the code we saw).

**Verify**: That `searchBlocks()` properly enriches results with properties from `entity_properties`.

### Phase 9: Testing & Validation

#### 7.1 Test Cases

1. **Create table from blocks**:
   - Search blocks with properties
   - Create table with rows that reference blocks as source
   - Verify source metadata is correctly set
   - Verify sync functionality works

2. **Create timeline events from blocks**:
   - Similar to above but for timeline events

3. **Create tasks from blocks**:
   - Similar to above but for tasks

4. **Sync changes back to blocks**:
   - Edit a table row that has a block as source
   - Verify changes sync to block's entity_properties
   - Test with both snapshot and live sync modes

5. **LLM annotation fallback**:
   - Test that `annotateRowsWithSourceMetadata()` correctly identifies blocks
   - Test title matching works for blocks
   - Test key-based matching works for blocks

## Implementation Order

1. **Phase 1** (Database): Foundation - must be done first
2. **Phase 2** (Types): Type safety - needed for all other phases
3. **Phase 3** (Validation): Core functionality - needed before LLM can use it
4. **Phase 4** (RPC/Triggers): Database functions - needed for RPC fast-path
5. **Phase 5** (Sync): Completeness - enables full feature
6. **Phase 6** (Prompts): LLM awareness - enables LLM to use the feature
7. **Phase 7** (Mapping): Data extraction - supports all use cases
8. **Phase 8** (Additional): Other function signatures and messages
9. **Phase 9** (Testing): Validation - throughout and at end

## Files to Modify

### Database Migrations
- `supabase/migrations/[timestamp]_add_block_source_tracking.sql` (NEW)
  - Update constraints on `table_rows`, `task_items`, `timeline_events`
  - Update RPC function `create_task_full` to handle blocks (snapshot-only policy?)
  - Update sync triggers to handle blocks (if needed)

### Type Definitions
- `src/types/table.ts` - Add "block" to `TableRowSourceEntityType`
- `src/types/task.ts` - Add "block" to `TaskSourceEntityType`
- `src/types/timeline.ts` - Add "block" to `TimelineSourceEntityType`

### Action Functions
- `src/app/actions/tables/row-actions.ts`
  - Update `syncTableRowEditToSource()` to handle blocks
  - Update `setTableRowsSourceSyncMode()` parameter types
- `src/app/actions/tables/bulk-actions.ts`
  - Update `bulkInsertRows()` parameter types
  - Update `normalizeSourceEntityType()` function
- `src/app/actions/tasks/item-actions.ts`
  - Update `createTaskItem()` parameter types
- `src/app/actions/tasks/super-actions.ts`
  - Update `createTaskFullRpc()` parameter types
- `src/app/actions/timelines/event-actions.ts`
  - Update `createTimelineEvent()` parameter types
- `src/app/actions/block.ts` (possibly - for property extraction)

### AI/LLM Integration
- `src/lib/ai/tool-executor.ts`
  - Update `normalizeSourceEntityType()` to include "block"
  - Update `extractSourceCandidateIdFromRow()` to detect block IDs
  - Update `annotateRowsWithSourceMetadata()` to validate blocks
  - Update `inferSourceEntityTypeForCandidate()` to handle blocks
- `src/lib/ai/system-prompt.ts` - Update source tracking instructions
- `src/lib/ai/workflow-executor.ts` - Update prompts in both functions
- `src/lib/ai/tool-definitions.ts` - Update tool descriptions to mention "block"
- `src/lib/ai/executor.ts` - Update source tracking messages (if any)

### Search Functions
- `src/app/actions/ai-search.ts` - Verify block search includes properties (already does)

## Edge Cases & Considerations

1. **Block deletion**: What happens to entities that reference deleted blocks?
   - Current cascade delete logic in `20260213210000_cascade_delete_entity_properties.sql` handles this for entity_properties
   - Need to verify similar handling for source references

2. **Block type variations**: Different block types (text, table, task, etc.) may have different property structures
   - Most properties are universal (status, priority, assignee, due_date, tags)
   - Should work consistently across block types

3. **Property inheritance**: Blocks can inherit properties from linked entities
   - Need to determine if inherited properties should be considered when creating from blocks
   - Likely should use direct properties only for source tracking

4. **Sync mode for blocks**: Should blocks support "live" sync mode?
   - Currently table_row sources are snapshot-only (enforced in RPC and triggers)
   - **RECOMMENDATION**: Blocks should also be snapshot-only initially, for consistency
   - Can add "live" support later if needed
   - This simplifies implementation and matches table_row behavior

5. **Block content vs properties**: Blocks have both `content` (JSONB) and `entity_properties`
   - Source tracking should primarily reference properties
   - Content might be used for display/title extraction

## Success Criteria

1. ✅ Database constraints allow "block" as `source_entity_type`
2. ✅ TypeScript types include "block" in source entity type unions
3. ✅ LLM can create table rows/timeline events/tasks with `source_entity_type: "block"`
4. ✅ Source tracking validation correctly identifies blocks
5. ✅ Changes sync back to block properties when appropriate
6. ✅ System prompts instruct LLM to use blocks as sources
7. ✅ All existing functionality continues to work

## Next Steps

1. Review and approve this plan
2. Create database migration
3. Update TypeScript types
4. Implement validation updates
5. Add sync functionality
6. Update LLM prompts
7. Test end-to-end
8. Deploy incrementally
