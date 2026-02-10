# Timeline Events Property Definitions Refactor - Summary

## Overview
Successfully refactored timeline events to use workspace-level property definitions for priority and status, matching the architecture used by table rows. Timeline events now support canonical IDs and sync to the entity_properties table for universal queries.

## Changes Made

### 1. Database Migrations (3 files)

#### Migration 1: Add Priority Column
**File:** `trak/supabase/migrations/20260210000005_add_priority_to_timeline_events.sql`
- Added `priority` column to `timeline_events` table (type: text, nullable)
- Added column comments documenting canonical ID values
- Priority values: `low`, `medium`, `high`, `urgent`

#### Migration 2: Migrate Status to Canonical IDs
**File:** `trak/supabase/migrations/20260210000006_migrate_timeline_status_to_canonical.sql`
- Mapped old status values to canonical IDs:
  - `planned` → `todo`
  - `in-progress` → `in_progress`
  - `blocked` → `blocked` (unchanged)
  - `done` → `done` (unchanged)
- Used fuzzy matching for variations (e.g., "Not Started" → "todo")
- Updated database constraint to enforce canonical IDs
- Provides migration status breakdown

#### Migration 3: Sync to Entity Properties
**File:** `trak/supabase/migrations/20260210000007_sync_timeline_events_to_entity_properties.sql`
- Syncs all timeline event status and priority values to `entity_properties` table
- Enables universal queries across entity types (timeline events, tasks, table rows, blocks)
- Links to workspace-level Status and Priority property_definitions

### 2. Type Definitions Updated

#### Timeline Types
**File:** `trak/src/types/timeline.ts`
- Changed `TimelineEventStatus` from `"planned" | "in-progress" | "blocked" | "done"` to `"todo" | "in_progress" | "blocked" | "done"`
- Added new type: `TimelineEventPriority = "low" | "medium" | "high" | "urgent"`
- Updated `TimelineEvent` interface to include `priority: TimelineEventPriority | null`
- Updated `TimelineItem` interface to include optional priority field

#### Validators
**File:** `trak/src/app/actions/timelines/validators.ts`
- Updated `VALID_EVENT_STATUSES` to use canonical IDs
- Added `VALID_EVENT_PRIORITIES` constant
- Added `validateEventPriority()` function

### 3. Backend Actions Updated

#### Event Actions
**File:** `trak/src/app/actions/timelines/event-actions.ts`

**Changes to `createTimelineEvent`:**
- Added `priority` parameter (optional, type: `TimelineEventPriority | null`)
- Added priority validation
- Changed default status from `"planned"` to `"todo"`
- Calls `syncTimelineEventToEntityProperties()` after creation
- Improved error messages to show valid values

**Changes to `updateTimelineEvent`:**
- Added `priority` parameter to updates type
- Added priority validation
- Calls `syncTimelineEventToEntityProperties()` after update if status or priority changed

**New Helper Function:**
- `syncTimelineEventToEntityProperties()`: Syncs status and priority to entity_properties table
  - Fetches Status and Priority property_definitions for workspace
  - Upserts status to entity_properties
  - Upserts/deletes priority based on value (null = delete)

### 4. UI Components Updated

#### Timeline View Component
**File:** `trak/src/components/timelines/timeline-view.tsx`

**AddEventDialog:**
- Added `workspaceId` prop
- Fetches property definitions for Status and Priority
- Status dropdown now uses property definition options (fallback to hardcoded if unavailable)
- Added new Priority dropdown (optional field)
- Changed default status from `"planned"` to `"todo"`
- Both fields display labels from property definitions but store canonical IDs

**EditEventDialog:**
- Fetches property definitions for Status and Priority
- Updated status dropdown to use property definition options
- Added priority dropdown
- Changed default status from `"planned"` to `"todo"`

**Other Updates:**
- Updated status filtering to use `["todo", "in_progress", "blocked", "done"]`
- Updated groupBy status logic to default to `"todo"` instead of `"planned"`
- Updated all status select elements throughout the component

### 5. AI Integration Updated

#### Tool Definitions
**File:** `trak/src/lib/ai/tool-definitions.ts`

**createTimelineEvent tool:**
- Changed status enum from `["not_started", "in_progress", "complete", "on_hold", "cancelled"]` to `["todo", "in_progress", "blocked", "done"]`
- Added `priority` parameter with enum `["low", "medium", "high", "urgent"]`

**updateTimelineEvent tool:**
- Changed status enum to match canonical IDs
- Added priority parameter

#### Tool Executor
**File:** `trak/src/lib/ai/tool-executor.ts`
- Added `TimelineEventPriority` import
- Updated `createTimelineEvent` case to pass priority parameter
- Updated `updateTimelineEvent` case to pass priority parameter

## Benefits

### 1. **Consistency**
- Timeline events now follow the same property definition pattern as tasks, blocks, and table rows
- Unified status and priority values across all entity types

### 2. **Universal Queries**
- Can query "all urgent items" and get timeline events, tasks, and table rows
- Can query "all items with status=in_progress" across entity types
- Entity properties table serves as a universal index

### 3. **Workspace-Level Management**
- Status and priority options are defined once at workspace level
- Changes to property definitions automatically affect all entities
- Consistent labels and colors across the application

### 4. **AI Integration**
- AI can set priority on timeline events
- AI queries can filter by priority
- Consistent canonical IDs across all AI tools

### 5. **Future-Proof**
- Easy to add more property definitions (e.g., tags, custom fields)
- Property definitions can be extended without schema changes
- Supports filtering and grouping at the property level

## Testing Checklist

- [x] Database migrations run successfully
- [ ] Timeline events created with status sync to entity_properties
- [ ] Timeline events created with priority sync to entity_properties
- [ ] Updating status syncs to entity_properties
- [ ] Updating priority syncs to entity_properties
- [ ] Clearing priority deletes from entity_properties
- [ ] Timeline modal displays Status dropdown with property definition options
- [ ] Timeline modal displays Priority dropdown with property definition options
- [ ] Existing timeline events migrated to canonical status IDs
- [ ] Status filtering uses canonical IDs
- [ ] AI can create timeline events with priority
- [ ] AI can update timeline event priority
- [ ] Universal queries work (e.g., "all urgent timeline events")

## Verification Queries

```sql
-- Check timeline events with new schema
SELECT id, title, status, priority FROM timeline_events LIMIT 10;

-- Check entity_properties for timeline events
SELECT
  ep.*,
  pd.name as property_name
FROM entity_properties ep
JOIN property_definitions pd ON ep.property_definition_id = pd.id
WHERE ep.entity_type = 'timeline_event'
LIMIT 10;

-- Count timeline events by status
SELECT status, COUNT(*)
FROM timeline_events
GROUP BY status;

-- Count timeline events by priority
SELECT priority, COUNT(*)
FROM timeline_events
GROUP BY priority;

-- Universal urgent items query
SELECT
  ep.entity_type,
  ep.entity_id,
  ep.value as priority
FROM entity_properties ep
JOIN property_definitions pd ON ep.property_definition_id = pd.id
WHERE pd.name = 'Priority'
  AND ep.value = '"urgent"'::jsonb
  AND ep.entity_type = 'timeline_event';
```

## Files Changed

### Database
- `trak/supabase/migrations/20260210000005_add_priority_to_timeline_events.sql` (NEW)
- `trak/supabase/migrations/20260210000006_migrate_timeline_status_to_canonical.sql` (NEW)
- `trak/supabase/migrations/20260210000007_sync_timeline_events_to_entity_properties.sql` (NEW)

### Backend
- `trak/src/types/timeline.ts` (MODIFIED)
- `trak/src/app/actions/timelines/validators.ts` (MODIFIED)
- `trak/src/app/actions/timelines/event-actions.ts` (MODIFIED)

### Frontend
- `trak/src/components/timelines/timeline-view.tsx` (MODIFIED)

### AI Integration
- `trak/src/lib/ai/tool-definitions.ts` (MODIFIED)
- `trak/src/lib/ai/tool-executor.ts` (MODIFIED)

## Migration Path

1. **Run migrations** in order:
   ```bash
   # Migration 1: Add priority column
   psql -f trak/supabase/migrations/20260210000005_add_priority_to_timeline_events.sql

   # Migration 2: Migrate status to canonical IDs
   psql -f trak/supabase/migrations/20260210000006_migrate_timeline_status_to_canonical.sql

   # Migration 3: Sync to entity_properties
   psql -f trak/supabase/migrations/20260210000007_sync_timeline_events_to_entity_properties.sql
   ```

2. **Deploy backend changes** (types, actions, validators)

3. **Deploy frontend changes** (timeline view component)

4. **Deploy AI changes** (tool definitions and executor)

5. **Verify**:
   - Create a new timeline event with priority
   - Update existing timeline event status
   - Check entity_properties table
   - Test AI: "Create a high priority timeline event"
   - Test universal query: "Show all urgent items"

## Breaking Changes

⚠️ **API Changes:**
- `createTimelineEvent()` now accepts optional `priority` parameter
- `updateTimelineEvent()` now accepts optional `priority` parameter
- Status values changed from `"planned"`, `"in-progress"` to `"todo"`, `"in_progress"`

⚠️ **Type Changes:**
- `TimelineEventStatus` type values changed
- `TimelineEvent` interface now includes `priority` field

⚠️ **Database Changes:**
- `timeline_events.status` constraint updated to use canonical IDs
- `timeline_events.priority` column added

## Notes

- Priority is optional (nullable) - timeline events don't require a priority
- Status is required and defaults to `"todo"`
- Property definitions are fetched dynamically in the UI with fallback to hardcoded options
- Old status values are automatically migrated by the migration script
- Entity properties are automatically synced on create/update
