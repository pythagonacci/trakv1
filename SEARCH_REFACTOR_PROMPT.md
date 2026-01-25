# Prompt: Refactor AI Search Layer to Use entity_properties

## GOAL

Refactor `trak/src/app/actions/ai-search.ts` to query the `entity_properties` table as the **canonical source of truth** for all entity properties (assignee, tags, status, priority, due_date, etc) instead of querying direct columns in task_items or join tables that don't contain data.

**Why**: The actual production data is stored in `entity_properties` + `property_definitions` tables. The task_items columns and task_assignees/task_tag_links tables are not being used. The search functions must query where the actual data is.

---

## CRITICAL CONTEXT

### Current Problem
- `searchTasks` and other functions query `task_items` columns and join tables that don't have data
- All actual property data is in `entity_properties` table with JSONB values
- "Everything assigned to John" query would need 5+ separate table queries without entity_properties
- Search results are empty or incomplete because the wrong tables are being queried

### What You Need to Know

**Data Location:**
- All properties (assignee, tags, status, priority, due_date) → stored in `entity_properties` table
- Property types/definitions → `property_definitions` table
- Do NOT query: `task_items.assignee_id`, `task_assignees`, `task_tag_links`, `task_items.status`, `task_items.priority`, `task_items.due_date`

**Key Tables:**

1. **entity_properties**
   ```
   id: uuid
   entity_type: text (values: 'task', 'block', 'timeline_event')
     NOTE: table_row does NOT use entity_properties - it uses table_rows.data JSONB
   entity_id: uuid (the task/block/timeline_event ID)
   property_definition_id: uuid (which property this is)
   value: jsonb (the actual value - varies by property type)
   workspace_id: uuid
   created_at, updated_at
   ```

2. **property_definitions**
   ```
   id: uuid
   workspace_id: uuid
   name: text (e.g., "Assignee", "Tags", "Status", "Priority", "Due Date")
   type: text (person, select, multi_select, text, date, checkbox, number)
   options: jsonb (for select types)
   created_at, updated_at
   ```

3. **task_items** (still relevant for core task data, but NOT for properties)
   ```
   id: uuid
   task_block_id: uuid
   title: text
   description: text
   ... all columns except status, priority, assignee_id, due_date are ignored ...
   ```

---

## HOW PROPERTIES ARE STORED

### Person Property (Assignee)
```
entity_properties row:
{
  property_definition_id: "UUID-of-assignee-property",
  entity_type: "task",
  entity_id: "task-123",
  value: {
    "id": "user-uuid",
    "name": "John Doe"
  }
}
```
**Query pattern**: `(value->>'id')::uuid` to extract user ID

### Multi-Select Property (Tags)
```
entity_properties row:
{
  property_definition_id: "UUID-of-tags-property",
  entity_type: "task",
  entity_id: "task-123",
  value: [
    {"id": "tag-1", "name": "urgent"},
    {"id": "tag-2", "name": "design"}
  ]
}
```
**Query pattern**: `value @> '[{"id":"tag-uuid"}]'::jsonb` for containment search

### Select Property (Status)
```
entity_properties row:
{
  property_definition_id: "UUID-of-status-property",
  entity_type: "task",
  entity_id: "task-123",
  value: {"id": "status-option-id", "name": "todo"}
}
```
**Query pattern**: `(value->>'name')::text` to extract status name

### Date Property (Due Date)
```
entity_properties row:
{
  property_definition_id: "UUID-of-due-date-property",
  entity_type: "task",
  entity_id: "task-123",
  value: "2025-02-15"
}
```
**Query pattern**: `(value->>'')::date` to extract date

---

## REFACTORING APPROACH

### Step 1: Create Helper Functions for Property Lookups

Add these helper functions at the top of ai-search.ts (after getSearchContext):

```typescript
/**
 * Get property definition IDs for common task properties
 * Cache these to avoid repeated queries
 */
async function getPropertyDefinitionIds(supabase: any, workspaceId: string) {
  const { data } = await supabase
    .from("property_definitions")
    .select("id, name, type")
    .eq("workspace_id", workspaceId)
    .in("name", ["Assignee", "Tags", "Status", "Priority", "Due Date"]);

  return new Map((data ?? []).map((p: any) => [p.name, { id: p.id, type: p.type }]));
}

/**
 * Build a Supabase query that filters by a property value
 */
function filterByProperty(query: any, propertyId: string, filterValue: any, entityType: string) {
  // This varies based on property type
  // For person (assignee): value->>'id' = 'uuid'
  // For multi_select (tags): value @> '[{"id":"..."}]'
  // For select (status): value->>'name' = 'value'
  // Etc.
}

/**
 * Extract property value from entity_properties row
 */
function extractPropertyValue(row: any, propertyType: string) {
  const value = row.value;

  switch (propertyType) {
    case "person":
      return { id: value?.id, name: value?.name };
    case "multi_select":
      return Array.isArray(value) ? value : [];
    case "select":
      return { id: value?.id, name: value?.name };
    case "date":
      return value;
    case "text":
      return value;
    default:
      return value;
  }
}
```

### Step 2: Refactor searchTasks

**Old approach** (WRONG):
```typescript
// ❌ WRONG - data not here
let query = supabase.from("task_items")
  .select("..., task_assignees(...), task_tag_links(...)")
  .in("assignee_id", assigneeIds);
```

**New approach** (RIGHT):
```typescript
// ✅ RIGHT - query entity_properties
let entityQuery = supabase
  .from("entity_properties")
  .select("entity_id, property_definition_id, value, property_definitions(name, type)")
  .eq("entity_type", "task")
  .eq("workspace_id", workspaceId);

// Filter by assignee property
if (params.assigneeName) {
  entityQuery = entityQuery
    .eq("property_definitions.name", "Assignee")
    .ilike("value->>'name'", `%${params.assigneeName}%`);
}

// Get entity IDs that match
const { data: propertyMatches } = await entityQuery;
const matchingTaskIds = [...new Set(propertyMatches?.map(p => p.entity_id))];

// Then get full task data
const { data: tasks } = await supabase
  .from("task_items")
  .select("...")
  .in("id", matchingTaskIds);
```

### Step 3: Handle All Search Functions

For each search function that uses entity_properties (searchTasks, searchBlocks, searchTimelineEvents), follow this pattern:

1. **Get property matches** from entity_properties table
2. **Extract entity IDs** that match the filter
3. **Fetch full entity data** from the main table (task_items, blocks, timeline_events)
4. **Enrich results** with resolved property information:
   - Convert property IDs to human-readable names
   - Extract values from JSONB based on property type
   - Return structured data with assignees, tags, status, priority, etc.

**NOTE**: searchTableRows does NOT use entity_properties - it queries table_rows.data JSONB directly. Keep existing searchTableRows logic.

### Step 4: Optimize Queries

After refactoring, add these database indexes:

```sql
-- Composite index for property lookups
CREATE INDEX IF NOT EXISTS idx_entity_props_workspace_propdef_entity
  ON entity_properties(workspace_id, property_definition_id, entity_type, entity_id);

-- Index for property definition lookups by name
CREATE INDEX IF NOT EXISTS idx_property_defs_workspace_name
  ON property_definitions(workspace_id, name);

-- GIN index for JSONB value queries
CREATE INDEX IF NOT EXISTS idx_entity_props_value_gin
  ON entity_properties USING GIN (value);
```

---

## FUNCTIONS TO REFACTOR (Priority Order)

1. **searchTasks** - Most important, used by many flows
   - Filter by: assigneeName (via entity_properties)
   - Filter by: tagName (via entity_properties)
   - Filter by: status (via entity_properties)
   - Filter by: priority (via entity_properties)
   - Filter by: due_date (via entity_properties)

2. **searchBlocks** - Used by block search
   - Filter by any properties blocks might have (via entity_properties)

3. **searchTimelineEvents** - Timeline events
   - Filter by assignee and other properties (via entity_properties)

4. **searchDocs** - Documents
   - Tag filtering if applicable (via entity_properties)

5. **searchAll** - Universal search
   - Should leverage refactored search functions above

**NO REFACTOR NEEDED:**
- **searchTableRows** - Already correctly queries table_rows.data JSONB (NOT entity_properties)

---

## TESTING STRATEGY

Use the test UI at `http://localhost:3000/test-search`:

1. **Test searchTasks with assigneeName filter**
   - Should find tasks assigned to "John" (from entity_properties)

2. **Test searchTasks with tagName filter**
   - Should find tasks tagged "urgent" (from entity_properties)

3. **Test searchAll with "everything assigned to John"**
   - Should find ALL entity types assigned to John using single entity_properties query
   - This is the main benefit of the refactor

4. **Verify search results include**
   - Correct assignee names
   - Correct tags
   - Correct status/priority
   - Correct due dates

---

## SUCCESS CRITERIA

- [ ] searchTasks queries entity_properties for assignee, tags, status, priority, due_date
- [ ] searchBlocks can filter by any block properties via entity_properties
- [ ] searchTimelineEvents queries entity_properties for assignee and other properties
- [ ] searchAll returns results from entity_properties (for tasks, blocks, timeline_events)
- [ ] searchTableRows continues to use table_rows.data JSONB (NOT entity_properties)
- [ ] "Everything assigned to John" query works and is efficient
- [ ] All results include resolved property names (not just IDs)
- [ ] Database indexes are added and queries are optimized
- [ ] Test UI returns correct results for various property filters
- [ ] No console errors, all TypeScript types are correct

---

## Files to Modify

1. **trak/src/app/actions/ai-search.ts** - Main refactor
2. **trak/supabase/schema.sql** - Add indexes (create migration or direct SQL)
3. **trak/src/app/test-search/page.tsx** - May need small updates if return types change

---

## Important Notes

- Property definition IDs are workspace-scoped. The same property name (e.g., "Assignee") has different UUIDs in different workspaces. Always look up property definitions by (workspace_id, name), not by hardcoded ID.
- **Always filter by workspace_id** for security
- JSONB extraction syntax: `value->>'field'` for strings, `(value->>'id')::uuid` for UUIDs, `value @>` for containment
- Property names are the source of truth, not IDs
- A task will have multiple entity_properties rows (one per property it has: Assignee, Status, Tags, Priority, Due Date, etc). A task without an assignee simply has no entity_properties row for the Assignee property definition, but will have rows for other properties.
- **table_rows do NOT use entity_properties** - they store data in table_rows.data JSONB column with field_id mappings

---

## Reference: Old Approach (DO NOT USE)

These are examples of what NOT to do:

```typescript
// ❌ WRONG - task_assignees table is empty
const { data: assignees } = await supabase
  .from("task_assignees")
  .select("*")
  .in("assignee_id", assigneeIds);

// ❌ WRONG - task_items.assignee_id is not the canonical source
query = query.in("assignee_id", assigneeIds);

// ❌ WRONG - task_tag_links table is empty
const { data: tags } = await supabase
  .from("task_tag_links")
  .select("*");

// ✅ RIGHT - use entity_properties
const { data: properties } = await supabase
  .from("entity_properties")
  .select("*, property_definitions(name, type)")
  .eq("entity_type", "task")
  .eq("workspace_id", workspaceId);
```

---

## Questions for Clarification

If you encounter ambiguity, ask:
1. Which entity types need property filtering? (task, block, timeline_event - NOT table_row)
2. Are there any custom properties beyond assignee/tags/status/priority/due_date?
3. For blocks, what properties should be searchable?
4. Do docs use entity_properties or a different storage mechanism?

---

**NOW PROCEED**: Read this prompt, understand the context in SEARCH_REFACTOR_SUMMARY.md, read ai-search.ts, and begin the refactor.
 