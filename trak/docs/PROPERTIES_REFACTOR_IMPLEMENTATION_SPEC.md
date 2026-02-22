# Properties Refactor — Implementation Spec

This document describes **how to change the codebase** to achieve the goals in [PROPERTIES_REFACTOR_GOAL_SPEC.md](./PROPERTIES_REFACTOR_GOAL_SPEC.md). It lists concrete files, functions, and migration steps.

---

## Phase Overview

1. **Phase 1: Database** — Migrations for schema changes
2. **Phase 2: Types & Core Actions** — TypeScript types and server actions
3. **Phase 3: RPCs & Triggers** — Task/timeline RPCs, sync triggers
4. **Phase 4: Search & Query** — ai-search, query-actions
5. **Phase 5: AI Tools & Context** — Tool definitions, executor, system prompt
6. **Phase 6: Tables** — Row/field actions, sync logic
7. **Phase 7: UI** — Property menu, badges, cells

---

## Phase 1: Database Migrations

### 1.1 New Migration: Remove `property_definition_id` from `entity_properties`

**File:** `supabase/migrations/YYYYMMDD_remove_property_definition_id.sql`

- Drop unique constraint on `(entity_type, entity_id, property_definition_id)` if it exists.
- Add/keep unique index on `(entity_type, entity_id, field_name)` (already exists from `20260220000000`).
- Drop `property_definition_id` column from `entity_properties`.
- Update any triggers that reference `property_definition_id`.

**Impacted migrations to rewrite or supersede:**

- `20260220000000_restructure_entity_properties_named_fields.sql` — already has `field_name`, `field_type`; we remove `property_definition_id`.
- `20260217120000_add_block_source_tracking.sql` — syncs to entity_properties using `property_definition_id`; change to use `field_name` + `field_type`.
- `20260203120000_add_rpc_super_and_bulk.sql` — same.
- `20260211130000_add_task_source_sync_mode.sql` — same.
- `20260213200000_fix_sync_trigger_for_universal_source_tracking.sql` — same.
- `20260216062500_fix_duplicate_tasks_rpc_source_metadata.sql` — same.

### 1.2 New Migration: Ensure Task/Timeline JSONB Columns

**task_items:**

- Ensure `priorities` JSONB (already exists).
- Add/ensure `statuses` JSONB `[{ field_name, value }]` if not present (tasks may still use single `status` text; migrate).
- Add/ensure `assignees` JSONB for named assignee fields (may already be via task_assignees; sync to entity_properties by `field_name`).
- Add/ensure `due_dates` JSONB for named due date fields.
- `tags` — keep task_tags + task_tag_links; entity_properties gets tag fields by `field_name: "Tags"`.

**timeline_events:**

- Migrate `status` (text) → `statuses` JSONB `[{ field_name, value }]`.
- Migrate `priority` (text) → `priorities` JSONB (already done in `20260220173000`).
- Add `assignees`, `due_dates`, `tags` JSONB as needed.

### 1.3 New Migration: Drop `property_definitions` Table

**File:** `supabase/migrations/YYYYMMDD_drop_property_definitions.sql`

- **Before dropping:** Drop or replace `create_default_property_definitions` (if it exists) and any trigger that calls it (e.g. on `workspaces` insert). Otherwise workspace creation will fail after the table is dropped.
- Drop FK from `table_fields.property_definition_id` → `property_definitions.id`.
- Drop `property_definition_id` from `table_fields`.
- Drop any constraints that require `property_definition_id`.
- Drop `property_definitions` table.
- Drop `entity_property` table if it exists (legacy custom properties).
- Remove triggers/functions that reference `property_definitions` or `property_definition_id`.

---

## Phase 2: TypeScript Types & Core Actions

### 2.1 `src/types/properties.ts`

- **Remove:** `PropertyDefinition`, `PropertyOption`, `CreatePropertyDefinitionInput`, `UpdatePropertyDefinitionInput`, `EntityProperty` (with `property_definition_id`), `EntityPropertyWithDefinition`, `InheritedProperty`, `EntityPropertiesResult`, `SetEntityPropertyInput`, `PropertyFilter.property_definition_id`, `PropertyType` (text/number/select etc.).
- **Change `PropertyFilter`:**  
  - From: `{ property_definition_id, operator, value }`  
  - To: `{ field_type: FieldType, operator, value }`  
  - Optionally add `field_name` for filtering by specific named property.
- **Keep:** `NamedField`, `EntityProperties`, `FieldType`, `SetEntityPropertiesInput`, `SetNamedFieldInput`, etc.
- **Add:** `PropertyFilterByType` or update `PropertyFilter` to use `field_type` instead of `property_definition_id`.

### 2.2 `src/app/actions/entity-properties.ts`

- Remove any `property_definitions` lookups.
- Remove `property_definition_id` from all entity_properties upserts (e.g. line ~256: `property_definition_id: null`); the column is dropped.
- `loadFixedPropertyDefinitions` — already returns a stub; remove or keep minimal (no DB calls).
- `buildEntityPropertiesFromRows` — already reads `field_type`, `field_name`, `value`; ensure it does not use `property_definition_id`.
- `getEntitiesProperties` — query `entity_properties` by `field_type` + `field_name` only; remove `property_definition_id` filters.

### 2.3 `src/app/actions/properties/entity-property-actions.ts`

- **Remove:** `getEntityProperties`, `setEntityProperty`, `removeEntityProperty` if they rely on `property_definition_id`.
- **Add/Update:** `setNamedField`, `removeNamedField` (or equivalent) that use `field_type` + `field_name` + `value`.
- Ensure `getEntityPropertiesWithInheritance`, `getEntitiesProperties` read from `entity_properties` without `property_definition_id`.

### 2.4 `src/app/actions/properties/definition-actions.ts`

- **Delete file** or stub out exports. All `createPropertyDefinition`, `updatePropertyDefinition`, `deletePropertyDefinition`, `mergePropertyOptions`, etc. become no-ops or removed.

### 2.5 `src/app/actions/properties/index.ts`

- Remove exports for definition-actions.
- Update exports for entity-property-actions to match new API.

---

## Phase 3: RPCs & Triggers

### 3.1 Task RPCs

**Files:** `supabase/migrations/20260220110000_fix_task_rpc_drift_named_properties.sql` and any newer RPC migrations.

- **`create_task_full`:**  
  - Remove all `SELECT id FROM property_definitions WHERE ...`  
  - Insert into `entity_properties` with `field_name`, `field_type`, `value`; no `property_definition_id`.

- **`update_task_full`:**  
  - Same: sync priorities, statuses, assignees, due_dates, tags to `entity_properties` using `field_name` + `field_type` + `value`.

- **`bulk_update_task_items`:** Same pattern.

- **`duplicate_task_full`:** Copy entity_properties by `field_name` + `field_type` + `value`; no `property_definition_id`.

### 3.2 Timeline Event RPCs / Actions

**Files:** `trak/src/app/actions/timelines/event-actions.ts`, `bulk-actions.ts`, and related migrations.

- Ensure create/update/duplicate write to `timeline_events.statuses`, `priorities`, etc. as JSONB arrays `[{ field_name, value }]`.
- Sync to `entity_properties` using `field_name` + `field_type` + `value`; no `property_definition_id`.

### 3.3 Triggers

- **task → entity_properties:**  
  - Triggers that sync from `task_items` to `entity_properties` must use `field_name`, `field_type`, `value` only.

- **timeline_event → entity_properties:**  
  - Same.

- **table_row → entity_properties:**  
  - Row updates sync by `field_name` (column header) + `field_type` (column type) + `value`; no `property_definition_id`.

- Remove any trigger that references `property_definitions` or `property_definition_id`.

### 3.4 Subtask / Block Properties

- If subtasks or blocks have entity_properties, update sync logic to use `field_name` + `field_type`; remove `property_definition_id`.

---

## Phase 4: Search & Query

### 4.1 `src/app/actions/ai-search.ts`

- **`getPropertyDefinitionIds`:** Remove. No more property definition lookup.
- **`getEntitiesWithPropertyFilter`:**  
  - Change signature: filter by `field_type` + `value` (and optionally `field_name`).  
  - Query `entity_properties` with `.eq("field_type", type)` and filter `value` in JS or via JSONB.
- **`getEntitiesWithDatePropertyFilter`:** Same — filter by `field_type = 'due_date'` and `value`; no `property_definition_id`.
- **`searchTags`:**  
  - Do not use `property_definitions`. Query `entity_properties` where `field_type = 'tags'` and aggregate tags from `value`.
- **`searchPropertyDefinitions`:** Remove or replace with a no-op / empty result (no property definitions).
- **`searchEntitiesByProperties`:**  
  - Replace `PropertyFilter.property_definition_id` with `field_type` + `value`.  
  - Build filters from `params.status`, `params.priority`, etc. using `field_type` directly.
- **`searchTasks`:**  
  - Status/priority/assignee/tag filters already go through entity_properties or task columns. Update to use `field_type` + `value`; remove `property_definition_id`.
- **`searchTimelineEvents`:** Same.
- **`getEntityById`:**  
  - When enriching with properties, read from `entity_properties` by `field_type`/`field_name`; remove `property_definitions` join.
- **Search result format:** Ensure each hit includes `field_name`(s) that matched (for "high priority" search, return which named priority matched).

### 4.2 `src/app/actions/properties/query-actions.ts`

- **`queryEntities`:**  
  - `filterByProperties` must filter by `field_type` + `value`; remove `property_definition_id`.

- **`queryEntitiesGroupedBy`:**  
  - Today: `groupByPropertyId` → fetch from `property_definitions`.  
  - New: Accept `groupByFieldType` (and optionally `groupByFieldName`). Query `entity_properties` by `field_type`; no property definition.

- **`filterByProperties` (internal):**  
  - Change `PropertyFilter` to `{ field_type, operator, value }`.  
  - Query `entity_properties` with `.eq("field_type", filter.field_type)` and match `value`.

---

## Phase 5: AI Tools & Context

### 5.1 `src/lib/ai/tool-definitions.ts`

- **Remove:**  
  - `createPropertyDefinition`, `updatePropertyDefinition`, `deletePropertyDefinition`.
- **Update `setEntityProperty` / `setEntityProperties`:**  
  - Params: `entityType`, `entityId`, `fieldType`, `fieldName`, `value` (no `propertyDefinitionId`).
- **Update `removeEntityProperty`:**  
  - Params: `entityType`, `entityId`, `fieldType`, `fieldName` (no `propertyDefinitionId`).
- **Update `searchTasks`, `searchTimelineEvents`:**  
  - Params: `status`, `priority`, `assigneeName`, `tagName`, etc. — no `propertyDefinitionId`. Descriptions should say "Filter by type + value."
- **Update `searchEntitiesByProperties`:**  
  - Params: `status`, `priority`, etc. — filters by type + value.
- **Update table tools:**  
  - Remove any `propertyDefinitionId` from field/row operations. Column header = property name.

### 5.2 `src/lib/ai/tool-executor.ts`

- **Remove handlers for:**  
  - `createPropertyDefinition`, `updatePropertyDefinition`, `deletePropertyDefinition`.
- **Update `setEntityProperty` handler:**  
  - Call new server action with `fieldType`, `fieldName`, `value`.
- **Update `removeEntityProperty` handler:**  
  - Call server action with `fieldType`, `fieldName`.
- Remove all `property_definitions` table reads.
- Update any logic that resolves `propertyDefinitionId` → options; options are fixed per type (status/priority) and no longer come from DB.

### 5.3 `src/lib/ai/system-prompt.ts`

- Add/update section on properties:  
  - Properties are identified by **type** (status, priority, assignee, due_date, tags), **name** (user-defined), and **value**.  
  - Search filters by type and value.  
  - Multiple properties of the same type can exist with different names.
- Remove references to "property definitions" or "propertyDefinitionId".

### 5.4 `src/app/actions/ai-context.ts`

- Remove `property_definitions` from context building if present.
- Ensure entity property context uses `field_type` + `field_name` + `value`.

---

## Phase 6: Tables

### 6.1 `src/app/actions/tables/field-actions.ts`

- Remove `property_definition_id` from field create/update.
- When setting field type to `priority`/`status`/`assignee`/`due_date`/`tags`, do not link to `property_definitions`.
- Column header (`field.name`) = property name when syncing to entity_properties.

### 6.2 `src/app/actions/tables/row-actions.ts`

- **`updateCell`:**  
  - When syncing to `entity_properties`, use `field.name` as `field_name`, `field.type` as `field_type`, `value`; no `property_definition_id`.
- Remove any `property_definitions` lookups.

### 6.3 Table Sync Migrations / Triggers

- `20260210000004_sync_table_rows_to_entity_properties.sql` — update to use `field_name` (from column) + `field_type`; remove `property_definition_id`.
- `20260211150000_fix_table_rpc_status_priority.sql` — same.
- Any trigger that syncs table rows → entity_properties: use `field_name` + `field_type` + `value`.

### 6.4 `src/types/table.ts`

- Remove `property_definition_id` from `TableField` (and related types).

### 6.5 Custom Properties in Tables

- Custom types (text, number, select, etc.) remain **only** in `table_rows.data` (or equivalent).
- No sync to `entity_properties`.
- Remove `property_definition_id` from table_fields; custom field options live in `field.config` or similar.

---

## Phase 7: UI Components

### 7.1 `src/components/properties/property-menu.tsx`

- Already uses `field_name`, `field_type`, `value` (NamedField model).
- Remove any `property_definitions` or `propertyDefinitionId` usage.
- Ensure "Add Priority" etc. send `type` + `name` (default "Priority") + `value`; name is editable and becomes `field_name`.

### 7.2 `src/components/properties/property-badge.tsx`

- Display properties from `EntityProperties` (priorities, statuses, etc.) using `field_name` + `value`; no `property_definition_id`.

### 7.3 `src/components/tables/cells/status-cell.tsx`, `priority-cell.tsx`

- **Remove:** `usePropertyDefinition(field.property_definition_id)`.
- Options for status/priority come from fixed constants (`STATUS_OPTIONS`, `PRIORITY_OPTIONS`) in `types/properties.ts`.
- `canEditOptions` — custom properties in tables can still edit options via config; for status/priority, options are fixed.

### 7.4 `src/components/timelines/timeline-view.tsx`

- Remove `property_definitions` fetches.
- Use fixed options for status/priority when rendering or editing events.

### 7.5 Hooks

- **`use-property-queries.ts`:**  
  - Remove `usePropertyDefinitions`, `usePropertyDefinition` if they fetch from `property_definitions`.
  - Ensure `useEntityPropertiesWithInheritance`, `useSetEntityProperties`, etc. use the new API (field_type, field_name, value).

---

## Phase 8: Additional Touchpoints (Audit)

The following were identified in a full codebase audit and should be updated or removed.

### 8.1 AI Undo (`src/app/actions/ai-undo.ts`)

- Remove `"property_definitions"` from `ALLOWED_UNDO_TABLES` (table is dropped).
- Keep `"entity_properties"` — still needed for undo of property changes.

### 8.2 Properties Context (`src/app/actions/properties/context.ts`)

- **Remove:** `requirePropertyDefinitionAccess` — no longer needed (used only by definition CRUD).
- **Remove:** `PropertyDefinitionAccessContext` interface.
- **Keep:** `requireWorkspaceAccessForProperties`, `requireEntityAccess`, `getWorkspaceIdForEntity`.

### 8.3 Definition Actions — Full List

`src/app/actions/properties/definition-actions.ts` exports these; all are removed:

- `getPropertyDefinitions`
- `getPropertyDefinition`
- `createPropertyDefinition`
- `updatePropertyDefinition`
- `deletePropertyDefinition`
- `mergePropertyOptions`
- `addPropertyOption`
- `updatePropertyOption`
- `removePropertyOption`

`deletePropertyDefinition` also checks for linked `table_fields`; when we drop `property_definition_id` from table_fields, that check goes away.

### 8.4 Tool Executor — Table Row / Field Logic

`src/lib/ai/tool-executor.ts` has logic for table row creation/updates that uses `property_definition_id`:

- **Lines ~5310–5355:** When syncing table row data to entity_properties, uses `field.property_definition_id`. Change to use `field.name` (column header) as `field_name` and `field.type` as `field_type`.
- **Lines ~5550–5610:** `resolveSelectValues` — today uses `propertyDefinitionOptions` for priority/status fields. Change to use fixed `STATUS_OPTIONS` / `PRIORITY_OPTIONS` from types.
- **Lines ~5670–5685:** `resolveRowDataForInsert` — fetches property definitions for priority/status fields. Remove that fetch; use fixed options.
- **Lines ~5710–5810:** `buildFieldConfigFromDefinition` / field config building — fetches from `property_definitions` for priority/status. Change to use fixed options; remove `property_definition_id` from field config.
- **Undo handling (line ~764):** `createPropertyDefinition` undo does `deleteById("property_definitions", ...)`. Remove when tool is removed.

### 8.5 Test Search Page (`src/app/test-search/page.tsx`)

- Uses `searchPropertyDefinitions` as a selectable search function.
- Remove `searchPropertyDefinitions` from the dropdown and switch/case, or replace with a no-op that returns empty.

### 8.6 Query Actions — `filterByProperties`

`src/app/actions/properties/query-actions.ts` has `filterByProperties` (used for blocks, tasks, subtasks, timeline_events, table_rows):

- Maps filters by `property_definition_id`; fetches from `property_definitions` to get field type.
- Queries `entity_properties` with `.in("property_definition_id", filterIds)`.

Update to use `PropertyFilter.field_type` instead of `property_definition_id`; query `entity_properties` by `field_type` + `value`.

### 8.7 `queryEntitiesGroupedBy` Callers

- `queryEntitiesGroupedBy` is exported from `properties/index.ts` but has no direct callers in the grep.
- `everything-grouping.ts` uses `STATUS_OPTIONS` / `PRIORITY_OPTIONS` directly for board grouping — does not call `queryEntitiesGroupedBy`.
- If `queryEntitiesGroupedBy` is unused, consider removing. If used (e.g. by API or external code), change signature to `groupByFieldType` instead of `groupByPropertyId`.

### 8.8 Hooks (`src/lib/hooks/use-property-queries.ts`)

- **Remove:** `usePropertyDefinition` hook.
- **Remove:** Import of `getPropertyDefinition` and `PropertyDefinition` type.
- **Keep:** All entity-property hooks (`useEntityProperties`, `useSetEntityProperties`, etc.) — they use `entity-properties.ts`, not definition-actions.

### 8.9 Control Tool / Request Tool Groups

`tool-definitions.ts` — `requestToolGroups` lists `"property"` as an allowed group. Keep it; property tools (setEntityProperty, removeEntityProperty) remain, just with updated params. Remove create/update/delete property definition from the property tool set.

### 8.10 Documentation Files

- `Entity Search Functions - AI Data Access Layer.txt` — mentions `searchPropertyDefinitions`. Update or remove that entry.
- `docs/AI_SEARCH_COMPLETION_CHECKLIST.md` — has `searchPropertyDefinitions` checkbox. Update to reflect removal.

### 8.11 Item Actions (`src/app/actions/tasks/item-actions.ts`)

- **Line ~625–641:** `duplicateTasksToBlock` (or similar) upserts to `entity_properties` with `property_definition_id: null`.
- Remove `property_definition_id` from the upsert payload; use `onConflict: "entity_type,entity_id,field_name"` only.

### 8.12 Entity Link Actions (`src/app/actions/properties/entity-link-actions.ts`)

- Imports types from `properties`; no direct `property_definitions` usage found.
- Verify it does not reference `property_definition_id`; if so, update.

### 8.13 Deterministic Parser (`src/lib/ai/deterministic-parser.ts`)

- Uses `searchEntitiesByProperties` with `status`, `priority` — no `property_definition_id` in args.
- Once `searchEntitiesByProperties` is updated to use `field_type` + `value`, no changes needed here.

### 8.14 Intent Classifier / Workflow Executor

- Both include `"property"` in tool groups for subtask/property operations. No changes needed; property tools still exist.

---

## Phase 9: Miscellaneous

### 9.1 `src/lib/hooks/use-property-queries.ts`

- Update mutations to pass `field_type`, `field_name`, `value`; no `property_definition_id`.

### 9.2 `src/lib/timeline-priority-sync.ts`

- Sync timeline priorities to entity_properties using `field_name` + `field_type` + `value`; remove `property_definition_id`.

### 9.3 `src/app/actions/tasks/assignee-actions.ts`

- Remove `getAssigneePropertyDefinitionId` (or equivalent). Sync assignees to entity_properties by `field_name` ("Assignee") + `field_type` ("assignee") + value.

### 9.4 `src/app/actions/everything-view.ts`, `src/lib/everything-filtering.ts`, `src/lib/everything-grouping.ts`

- If they filter/group by property definitions, switch to `field_type` + `field_name` + `value`.

---

## File Checklist

| Area | Files to Modify |
|------|-----------------|
| **Migrations** | New migration to drop `property_definition_id`, update triggers, drop `property_definitions` |
| **Types** | `src/types/properties.ts`, `src/types/table.ts` |
| **Actions** | `entity-properties.ts`, `properties/entity-property-actions.ts`, `properties/query-actions.ts` |
| **Actions (delete/stub)** | `properties/definition-actions.ts` |
| **Actions (context)** | `properties/context.ts` — remove `requirePropertyDefinitionAccess` |
| **RPCs** | `20260220110000_*.sql`, `20260219120000_*.sql`, related trigger migrations |
| **Search** | `ai-search.ts` |
| **AI** | `tool-definitions.ts`, `tool-executor.ts`, `system-prompt.ts`, `ai-context.ts` |
| **Tables** | `field-actions.ts`, `row-actions.ts` |
| **UI** | `property-menu.tsx`, `property-badge.tsx`, `status-cell.tsx`, `priority-cell.tsx`, `timeline-view.tsx` |
| **Hooks** | `use-property-queries.ts` — remove `usePropertyDefinition` |
| **Undo** | `ai-undo.ts` — remove `property_definitions` from allowed tables |
| **Test/Docs** | `app/test-search/page.tsx`, `Entity Search Functions - AI Data Access Layer.txt`, `docs/AI_SEARCH_COMPLETION_CHECKLIST.md` |
| **Other** | `timeline-priority-sync.ts`, `assignee-actions.ts`, `everything-*` |
| **Tasks** | `item-actions.ts` — remove `property_definition_id` from entity_properties upsert |

---

## Phase 10: Verification

After all changes are complete, run:

```bash
grep -r "property_definition" trak/src trak/supabase/migrations --include="*.ts" --include="*.tsx" --include="*.sql"
```

- Any remaining matches (excluding docs, comments, and new migration files that drop the table) must be addressed.
- Exclude: `docs/`, `*.md`, `claude.md`, `Entity Search Functions - AI Data Access Layer.txt`, and migration files whose sole purpose is to remove property_definitions.

---

## Suggested Order of Execution

1. Create new migrations (Phase 1) — can be done incrementally with backward compatibility during transition.
2. Update types (Phase 2.1).
3. Update entity-properties and property actions (Phase 2.2–2.5).
4. Update RPCs and triggers (Phase 3).
5. Update search and query (Phase 4).
6. Update AI tools and context (Phase 5).
7. Update table actions (Phase 6).
8. Update UI (Phase 7).

---

## Rollback Considerations

- If rollback is needed, keep a migration that re-adds `property_definition_id` and restores `property_definitions` from backup.
- Consider a feature flag to toggle between old and new property model during testing.
