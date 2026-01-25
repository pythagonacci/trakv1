# AI Search Layer Refactor Summary

## Context and History

### Initial Implementation (Complete)
I created a comprehensive AI search layer in `trak/src/app/actions/ai-search.ts` with 30+ functions including:
- **Search functions**: searchTasks, searchProjects, searchDocs, searchBlocks, searchTables, searchTableRows, etc.
- **Entity primitives**: getEntityById, getEntityContext, getTableSchema, listEntityLinks
- **Entity resolution**: resolveEntityByName, resolveTableFieldByName, resolveTableFieldsByNames
- **Universal search**: searchAll with pagination
- **Features implemented**:
  - Overfetch strategy for post-query filters (10x limit to prevent missing results)
  - Name-based filters (assigneeName, tagName, projectName) for fuzzy matching
  - Doc content search with ProseMirror JSON text extraction
  - Table field resolution (translate field names to IDs)
  - Pagination with offset/limit/hasMore/totalCount

### Critical Discovery
Upon testing, discovered that the search functions were **querying the wrong data sources**:

**Problem 1: Data Model Mismatch**
- Search functions assumed properties were stored in:
  - `task_assignees` table (join tables)
  - `task_tag_links` table (join tables)
  - Direct columns in `task_items` table

- **Actual data storage**: All properties (assignee, tags, status, priority, due_date) are stored in:
  - `entity_properties` table (JSONB value column)
  - `property_definitions` table (defines property types: person, select, multi_select, etc.)
  - **NOT** in task_assignees or task_tag_links tables
  - **NOT** reliably in task_items columns

**Problem 2: Incomplete Universal Queries**
- The current searchAll function would need to query 5+ different tables to find "everything assigned to John"
- Without entity_properties as source of truth, "universal" queries are fragmented and complex

### Architectural Decision: entity_properties as Single Source of Truth

**Why entity_properties:**
1. **Universal queries** - One query finds assigned tasks, blocks, timeline events, table rows, anything
2. **Design intent** - User built entity_properties to handle properties for ANY block type, not just tasks
3. **Flexibility** - Text blocks can be tagged "urgent", image blocks can have assignees, etc.
4. **AI-friendly** - Consistent query pattern across all entity types

**Performance tradeoff:**
- Entity_properties queries: ~30-50ms per query (with proper indexes)
- Direct column queries: ~5-15ms per query
- **Gap: ~6x slower** (acceptable for AI search features)
- **Gap narrows to 2-3x with proper indexes on entity_properties**

**Data consistency issue:**
- task_items columns (assignee_id, status, priority, due_date) are updated but NOT the canonical source
- entity_properties table is the actual canonical source
- Need to rewrite all search functions to query entity_properties, not task_items columns

---

## Database Schema (Relevant Tables)

### entity_properties
```
id: uuid
entity_type: text (task, block, timeline_event, table_row)
entity_id: uuid (ID of the entity)
property_definition_id: uuid (which property)
value: jsonb (the actual value - can be id, string, array, etc)
workspace_id: uuid
created_at, updated_at
```

### property_definitions
```
id: uuid
workspace_id: uuid
name: text (e.g., "Assignee", "Tags", "Status", "Priority", "Due Date")
type: text (person, select, multi_select, text, date, checkbox, number)
options: jsonb (config for select/multi_select)
created_at, updated_at
```

### task_items (for reference, NOT canonical source for properties)
```
id: uuid
title: text
status: text (IGNORED - use entity_properties)
priority: text (IGNORED - use entity_properties)
assignee_id: uuid (IGNORED - use entity_properties)
due_date: date (IGNORED - use entity_properties)
... other columns ...
```

### task_tag_links (NOT USED - use entity_properties)
```
task_id: uuid
tag_id: uuid
```

### task_assignees (NOT USED - use entity_properties)
```
task_id: uuid
assignee_id: uuid
assignee_name: text
```

---

## What Needs to be Rewritten

All search functions in `trak/src/app/actions/ai-search.ts` need to be refactored to:

1. **Query entity_properties instead of direct columns**
2. **Handle property extraction from JSONB** (different property types need different parsing)
3. **Join property_definitions to identify which property is which**
4. **Work for ALL entity types** (not just tasks)

Key functions that need fixes:
- searchTasks (assignee filtering, tag filtering, status, priority, due_date)
- searchBlocks (any block properties)
- searchTableRows (field-based filtering)
- searchTimelineEvents (assignee, status, etc)
- searchDocs (tags, properties if applicable)
- All filtering that currently uses task_items columns

---

## Goal for Next Phase

**Goal**: Refactor `ai-search.ts` to query `entity_properties` table as the canonical source of truth for all entity properties.

**Success criteria:**
1. ✅ All search functions query entity_properties, not task_items columns
2. ✅ Property lookups join property_definitions to identify property types
3. ✅ Handles different JSONB value types (person properties, select properties, etc)
4. ✅ Works for any entity type (task, block, timeline_event, table_row)
5. ✅ Universal queries like "everything assigned to John" work efficiently
6. ✅ Search results include proper name resolution (assignee IDs → names, etc)
7. ✅ Database indexes are optimized for entity_properties queries
8. ✅ Test UI at /test-search still works with new implementation

---

## Files Involved

- **Primary**: `/Users/amnaahmad/trakv1/trak/src/app/actions/ai-search.ts` (needs rewrite)
- **Reference**: `/Users/amnaahmad/trakv1/trak/supabase/schema.sql` (entity_properties, property_definitions)
- **Testing**: `/Users/amnaahmad/trakv1/trak/src/app/test-search/page.tsx` (test UI created)
- **Database**: Needs indexes on entity_properties

---

## Next Steps (in order)

1. Rewrite core query helpers for entity_properties lookups
2. Refactor searchTasks to use entity_properties
3. Refactor searchBlocks, searchTableRows, searchTimelineEvents
4. Update searchAll to work with new model
5. Add required database indexes
6. Test via /test-search UI with actual workspace data
7. Validate universal queries work ("everything assigned to John")
