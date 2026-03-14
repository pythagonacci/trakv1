# Card Block & Entity Properties Audit Report

**Date:** March 12, 2025  
**Scope:** Ensure the new card block type and its entity/universal properties are fully integrated across the app (AI tools, search, database, UI).

---

## Executive Summary

The card block type is **well integrated** in most areas. The database, core entity-properties layer, search, and UI all support cards. However, **several gaps** were found in AI tool definitions and the properties context layer that would prevent the AI from fully interacting with card properties.

---

## ✅ Areas Fully Integrated

### 1. Database & Schema
- **entity_properties** constraint includes `'card'` in `entity_type` check
- **cards** table has denormalized columns (statuses, priorities, assignees, due_dates, tags) that sync with entity_properties
- **entity_links** supports card as source/target (cleanup trigger on card delete)
- **resolve_entity_subtype** function includes `'card'`

### 2. Core Entity Properties (`entity-properties.ts`)
- `getWorkspaceIdForEntity` – has card case (queries `cards.workspace_id`)
- `getProjectIdForEntity` – has card case (queries `cards.project_id`)
- `getEntityTitle` – has card case (queries `cards.title`)
- `setEntityProperties` – full card support: syncs to `cards` table (statuses, priorities, assignees, due_dates, tags)
- `addTag` / `removeTag` – sync tags back to `cards` table
- `clearEntityProperties` – resets card denormalized columns
- `createEntityLink` / `removeEntityLink` / `getEntityLinks` – work with any EntityType including card

### 3. AI Search (`ai-search.ts`)
- **searchCards** – full property filtering (assignee, tag, status, priority, due date) via `entity_properties`
- **searchEntityProperties** – `entityType` includes `"card"`
- **searchEntitiesByProperties** – `entityTypes` includes `"card"`
- **searchTags** – aggregates from entity_properties including `entity_type = 'card'`
- **searchAll** – includes cards in `allTypes` and calls `searchCards`
- **getEntityById** – full card case with entity_properties enrichment
- **getEntityContextById** – includes card in `propertyEntityTypes`

### 4. Properties Query Actions (`properties/query-actions.ts`)
- **queryEntities** – default `entity_types` includes `"card"`
- **queryEntitiesByType** – full card case with property filtering

### 5. Everything View (`everything-view.ts`)
- **fetchCardEverythingItems** – fetches cards and builds EverythingItem entries
- **hydrateEverythingProperties** – uses `getEntitiesProperties` for all types including card

### 6. Everything Grouping (`everything-grouping.ts`)
- **getEntityTypeLabel** – has `card: "Cards"`

### 7. Search Indexer (`search/indexer.ts`)
- Cards blocks: fetches cards from `cards` table, indexes title, notes, statuses, priorities, tags

### 8. UI – Cards Block (`cards-block.tsx`)
- Uses `useEntitiesProperties("card", cardIds, workspaceId)` for property display
- Uses `PropertyMenu`, `StatusBadge`, `TagBadge` with card entity type
- `useAddTag` / `useRemoveTag` / `useClearEntityProperties` invalidate card queries when entityType is card

### 9. Types
- **EntityType** in `properties.ts` includes `'card'`

---

## ❌ Gaps Found (Require Fixes)

### 1. **CRITICAL: `properties/context.ts` – Missing Card in `getWorkspaceIdForEntity`**

**File:** `trak/src/app/actions/properties/context.ts`

**Issue:** `getWorkspaceIdForEntity` has cases for block, task, subtask, timeline_event, table_row but **no case for "card"**. It falls through to `default: return null`.

**Impact:** When the AI calls `setEntityProperty` or `removeEntityProperty` with `entityType: "card"`, `requireEntityAccess` uses this function. It returns `null` for cards, causing "Entity not found" and blocking property updates on cards via AI.

**Fix:** Add a card case:

```typescript
case "card": {
  const { data } = await supabase
    .from("cards")
    .select("workspace_id")
    .eq("id", entityId)
    .maybeSingle();
  return data?.workspace_id ?? null;
}
```

---

### 2. **AI Tool Definitions – `searchEntitiesByProperties` entityTypes Missing Card**

**File:** `trak/src/lib/ai/tool-definitions.ts` (lines ~394–398)

**Issue:** The `entityTypes` parameter enum is:
```javascript
items: { type: "string", enum: ["task", "subtask", "block", "timeline_event", "table_row"] }
```
**Missing:** `"card"`

**Impact:** The AI model does not know it can include cards in cross-entity property searches (e.g., "everything not done" or "all items with high priority").

**Fix:** Add `"card"` to the enum:
```javascript
items: { type: "string", enum: ["task", "card", "subtask", "block", "timeline_event", "table_row"] }
```
And update the description to mention cards.

---

### 3. **AI Tool Definitions – `setEntityProperty` entityType Missing Card**

**File:** `trak/src/lib/ai/tool-definitions.ts` (lines ~1832–1833)

**Issue:** The `entityType` enum is:
```javascript
enum: ["task", "subtask", "block", "timeline_event", "table_row"]
```
**Missing:** `"card"`

**Impact:** The AI may not attempt to use `setEntityProperty` for cards, or tool validation could reject card as invalid.

**Fix:** Add `"card"` to the enum:
```javascript
enum: ["task", "card", "subtask", "block", "timeline_event", "table_row"]
```
And update the description to include cards.

---

### 4. **AI Tool Definitions – `getEntityById` entityType Missing Card**

**File:** `trak/src/lib/ai/tool-definitions.ts` (lines ~462–465)

**Issue:** The `entityType` enum is:
```javascript
enum: ["task", "subtask", "project", "client", "member", "tab", "block", "doc", "table", "table_row", "timeline_event", "file", "payment", "tag"]
```
**Missing:** `"card"`

**Impact:** The AI may not call `getEntityById` with `entityType: "card"` even though the backend supports it.

**Fix:** Add `"card"` to the enum.

---

### 5. **AI Tool Definitions – `getEntityContext` entityType Missing Card**

**File:** `trak/src/lib/ai/tool-definitions.ts` (lines ~478–480)

**Issue:** The `entityType` enum is:
```javascript
enum: ["block", "task", "subtask", "timeline_event", "table_row"]
```
**Missing:** `"card"`

**Impact:** The AI cannot request full context (properties, links) for a card via `getEntityContext`.

**Fix:** Add `"card"` to the enum.

---

### 6. **Table Source Tracking – `source_entity_type` Documentation**

**File:** `trak/src/lib/ai/tool-definitions.ts` (e.g., bulkInsertRows, createTableFull descriptions)

**Issue:** Source tracking docs say:
```
Valid source_entity_type: "task", "timeline_event", "table_row", "block"
```
**Missing:** `"card"`

**Impact:** When creating tables from search results that include cards, the AI may not add `source_entity_type: "card"` and `source_entity_id` for card-originated rows. The database may or may not enforce this; the cards migration adds a cleanup trigger for `source_entity_type = 'card'`, suggesting cards are intended as a valid source. Tool descriptions should be updated for consistency.

**Fix:** Add `"card"` to the valid `source_entity_type` list in tool descriptions where source tracking is documented.

---

### 7. **System Prompt – setEntityProperty Documentation**

**File:** `trak/src/lib/ai/system-prompt.ts`

**Issue:** The "Property" action tools line mentions `setEntityProperty` and `removeEntityProperty` but does not explicitly say they work for cards. The subtask example says:
> "use `setEntityProperty` with `entityType: "subtask"`"

**Recommendation:** Add a brief note that `setEntityProperty` and `removeEntityProperty` also support `entityType: "card"` for card properties.

---

## Optional / Lower Priority

### Chart Creation
- **chart-actions.ts** – No explicit card handling. Charts are built from `searchTasks`, `searchTimelineEvents`, `searchTableRows`. If charting cards is desired, `searchCards` would need to be wired in as a data source type. This is a feature gap rather than a bug.

### Table Row source_entity_type
- **Database:** `table_rows` and `task_items` source tracking constraints may need to be checked to ensure `source_entity_type = 'card'` is allowed where cards can be used as sources. The cards migration cleanup trigger references `source_entity_type = 'card'`, so it appears supported.

---

## Summary of Required Fixes

| Priority | File | Change |
|----------|------|--------|
| **P0** | `properties/context.ts` | Add `card` case to `getWorkspaceIdForEntity` |
| **P1** | `tool-definitions.ts` | Add `card` to `searchEntitiesByProperties` entityTypes enum |
| **P1** | `tool-definitions.ts` | Add `card` to `setEntityProperty` entityType enum |
| **P1** | `tool-definitions.ts` | Add `card` to `getEntityById` entityType enum |
| **P1** | `tool-definitions.ts` | Add `card` to `getEntityContext` entityType enum |
| **P2** | `tool-definitions.ts` | Add `card` to source_entity_type in table tool descriptions |
| **P2** | `system-prompt.ts` | Document card support for setEntityProperty/removeEntityProperty |

---

## Verification Checklist (Post-Fix)

After applying fixes:

1. **AI:** Ask the AI to "mark card X as done" or "set priority high on card Y" – should use `setEntityProperty` with `entityType: "card"`.
2. **AI:** Ask "show me everything not done" – should include cards when using `searchEntitiesByProperties` with `entityTypes` including `"card"`.
3. **AI:** Ask "get details for card [id]" – should use `getEntityById` or `getEntityContext` with `entityType: "card"`.
4. **UI:** Property menu on a card – status, priority, assignee, tags, due date – should persist and sync to both `entity_properties` and `cards` table.
