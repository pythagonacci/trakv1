# Universal Properties System - Implementation Plan

## Executive Summary

This plan outlines the architecture and implementation strategy for Trak's universal properties system, enabling any entity (blocks, docs, timeline events, table rows, projects) to have properties that are queryable, aggregatable, and AI-accessible.

**Core Principle:** Structure should never limit what users can do with their data.

---

## Part 1: Architectural Decisions

### Decision 1: Property Storage Architecture

**RECOMMENDATION: Hybrid Approach (Option C)**

```sql
-- Property definitions (workspace-scoped schemas)
CREATE TABLE property_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- "Status", "Assignee", "Priority"
  key TEXT NOT NULL,  -- "status", "assignee", "priority" (normalized)
  type TEXT NOT NULL, -- Same 28 types as table_fields
  config JSONB NOT NULL DEFAULT '{}', -- Type-specific config (options, etc.)

  scope TEXT NOT NULL DEFAULT 'workspace', -- 'workspace' | 'project' | 'entity_type'
  scope_id UUID, -- project_id if project-scoped, NULL for workspace
  entity_type TEXT, -- If scoped to specific entity type: 'block:embed:figma'

  is_system BOOLEAN DEFAULT false, -- true for created_at, updated_at, etc.
  display_order INTEGER DEFAULT 0,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, key, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

-- Property values (entity-scoped data)
CREATE TABLE property_values (
  entity_type TEXT NOT NULL, -- 'block' | 'doc' | 'timeline_event' | 'project' | 'tab'
  entity_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  value JSONB, -- Actual value stored as JSONB for type flexibility

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (entity_type, entity_id, property_id)
);

-- Indexes for fast querying
CREATE INDEX idx_property_values_workspace ON property_values(workspace_id);
CREATE INDEX idx_property_values_entity ON property_values(entity_type, entity_id);
CREATE INDEX idx_property_values_property ON property_values(property_id);
CREATE INDEX idx_property_values_value ON property_values USING GIN(value); -- JSONB queries
CREATE INDEX idx_property_values_type_value ON property_values(entity_type, workspace_id) INCLUDE (value);

-- For querying specific property values efficiently
CREATE INDEX idx_property_values_lookup ON property_values(workspace_id, property_id, entity_type);
```

**Why Hybrid?**

1. **Flexibility:** Any entity can have any property without schema changes
2. **Performance:** GIN indexes on JSONB enable fast value queries
3. **Structure:** Property definitions provide validation, UI hints, and consistency
4. **Backwards Compatible:** Existing `table_rows.data` and `blocks.content` remain untouched
5. **Query Power:** Can query across entity types: "find all entities where status=blocked"
6. **Type Safety:** Config JSONB uses same patterns as existing `table_fields.config`

**What about table rows?**

- **Keep existing `table_rows.data` JSONB for now**
- **Add optional universal properties later** for cross-table querying
- Table rows can be queried via universal properties interface using adapter layer

---

### Decision 2: Entity Identification System

**RECOMMENDATION: Composite Entity IDs**

```typescript
// Universal entity identifier
type EntityRef = {
  type: EntityType;
  id: string; // UUID
  subtype?: string; // For blocks: 'embed:figma', 'file:pdf', etc.
};

type EntityType =
  | 'block'
  | 'doc'
  | 'timeline_event'
  | 'table_row'
  | 'project'
  | 'tab'
  | 'task'; // Individual task within task block

// Storage in property_values
// entity_type: "block", entity_id: block_id
// entity_type: "block:embed:figma", entity_id: block_id (for type-specific queries)
// entity_type: "task", entity_id: "{block_id}:{task_index}" (for nested entities)
```

**Rationale:**

1. **Polymorphic References:** One field for any entity type
2. **Subtype Granularity:** Can query "all Figma embeds" vs "all blocks"
3. **Nested Entity Support:** Tasks within task blocks, sections within docs
4. **Future-Proof:** Easy to add new entity types (comments, attachments, etc.)

**Entity Resolution Service:**

```typescript
// src/lib/entities/resolver.ts
export async function resolveEntity(ref: EntityRef): Promise<Entity | null> {
  switch (ref.type) {
    case 'block':
      return await supabase.from('blocks').select('*').eq('id', ref.id).single();
    case 'doc':
      return await supabase.from('docs').select('*').eq('id', ref.id).single();
    case 'timeline_event':
      return await supabase.from('timeline_events').select('*').eq('id', ref.id).single();
    case 'table_row':
      return await supabase.from('table_rows').select('*, table:tables(*)').eq('id', ref.id).single();
    case 'task':
      const [blockId, taskIndex] = ref.id.split(':');
      const block = await supabase.from('blocks').select('*').eq('id', blockId).single();
      return block.content.tasks[parseInt(taskIndex)];
  }
}
```

---

### Decision 3: Property Type System

**RECOMMENDATION: Start with Core Subset, Expand to Full Parity**

**MVP Property Types (Phase 1):**

```typescript
type CorePropertyType =
  | 'text'          // Single-line text
  | 'long_text'     // Multi-line text
  | 'number'        // Numeric values
  | 'date'          // Single date/datetime
  | 'checkbox'      // Boolean
  | 'select'        // Single choice from options
  | 'multi_select'  // Multiple choices
  | 'status'        // Status with color (like table status)
  | 'priority'      // Priority levels (like table priority)
  | 'person'        // Assignee (references auth.users)
  | 'url'           // URL with validation
  | 'files';        // File attachments
```

**Phase 2 Property Types (Post-MVP):**

```typescript
type AdvancedPropertyType =
  | 'date_range'       // Start/end dates (for timeline events)
  | 'email'            // Email with validation
  | 'phone'            // Phone number
  | 'relation'         // Link to other entities
  | 'formula'          // Computed from other properties
  | 'rollup'           // Aggregate across relations
  | 'created_time'     // Auto: when entity created
  | 'last_edited_time' // Auto: when entity updated
  | 'created_by'       // Auto: who created
  | 'last_edited_by';  // Auto: who last edited
```

**Reuse Existing Table Field Infrastructure:**

- Same config types from `src/types/table.ts`
- Same validation logic from `src/lib/field-utils.ts`
- Same formula parser from `src/lib/formula-parser.ts`
- **DRY principle:** Properties ARE fields, just applied universally

```typescript
// src/types/property.ts
import type {
  FieldType,
  FieldConfig,
  SelectFieldConfig,
  StatusFieldConfig,
  // ... etc
} from './table';

export type PropertyType = FieldType; // Reuse field types
export type PropertyConfig = FieldConfig; // Reuse field configs

export interface PropertyDefinition {
  id: string;
  workspace_id: string;
  name: string;
  key: string;
  type: PropertyType;
  config: PropertyConfig;
  scope: 'workspace' | 'project' | 'entity_type';
  scope_id?: string;
  entity_type?: string;
  is_system: boolean;
  display_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
```

---

### Decision 4: Schema vs. Schema-less

**RECOMMENDATION: Light Schema (Defined Properties with Ad-Hoc Creation)**

**How it Works:**

1. **User adds property to entity:** "Add Status" → checks if "Status" property definition exists in workspace
2. **If exists:** Use existing definition (consistent options, colors, etc.)
3. **If doesn't exist:** Create new property definition automatically with sensible defaults
4. **Property definitions are editable:** User can later edit options, rename, change config

**Benefits:**

- **Consistency:** Same "Status" property across all entities uses same options/colors
- **Flexibility:** New properties created on-demand without pre-configuration
- **Discoverability:** User can see all available properties when adding
- **Validation:** Property config enforces type-specific rules (select options, date formats, etc.)

**UX Flow:**

```
User clicks entity → "+ Add Property"
  → Shows autocomplete dropdown:
     - Existing properties: "Status", "Priority", "Assignee" (workspace-level)
     - "Create new property..." (bottom of list)

  → User selects "Status":
     - Uses existing Status property definition
     - Shows existing status options (To Do, In Progress, Done)
     - Value saved to property_values table

  → User types "Launch Date" (doesn't exist):
     - Autocomplete shows "Create 'Launch Date'"
     - User clicks → property type picker appears
     - User selects "Date" → new property definition created
     - Value input shown, saved to property_values
```

**System Properties:**

```typescript
// Auto-created for every workspace
const SYSTEM_PROPERTIES = [
  { key: 'created_at', name: 'Created', type: 'created_time', is_system: true },
  { key: 'updated_at', name: 'Updated', type: 'last_edited_time', is_system: true },
  { key: 'created_by', name: 'Created By', type: 'created_by', is_system: true },
  { key: 'updated_by', name: 'Updated By', type: 'last_edited_by', is_system: true },
];
```

---

### Decision 5: Query & Search Layer

**RECOMMENDATION: Phase 1 = SQL + Indexes, Phase 2 = Typesense/Search Engine**

**Phase 1: SQL-Based Querying (MVP)**

```sql
-- Query: Find all entities with Status = "Blocked" in workspace
SELECT
  pv.entity_type,
  pv.entity_id,
  pv.value,
  pd.name as property_name
FROM property_values pv
JOIN property_definitions pd ON pv.property_id = pd.id
WHERE pv.workspace_id = $1
  AND pd.key = 'status'
  AND pv.value->>'value' = 'blocked';

-- Query: Find all Figma embeds assigned to user X
SELECT
  pv.entity_type,
  pv.entity_id,
  pv.value
FROM property_values pv
JOIN property_definitions pd ON pv.property_id = pd.id
WHERE pv.workspace_id = $1
  AND pv.entity_type LIKE 'block%figma%'
  AND pd.key = 'assignee'
  AND pv.value->>'value' = $2;

-- Query: Multi-property filter (Status=Blocked AND Priority=High)
SELECT
  pv1.entity_type,
  pv1.entity_id
FROM property_values pv1
JOIN property_definitions pd1 ON pv1.property_id = pd1.id
JOIN property_values pv2 ON (pv1.entity_type = pv2.entity_type AND pv1.entity_id = pv2.entity_id)
JOIN property_definitions pd2 ON pv2.property_id = pd2.id
WHERE pv1.workspace_id = $1
  AND pd1.key = 'status' AND pv1.value->>'value' = 'blocked'
  AND pd2.key = 'priority' AND pv2.value->>'value' = 'high';
```

**Performance Optimizations:**

1. **Materialized View for Fast Queries:**

```sql
-- Denormalized view for common queries
CREATE MATERIALIZED VIEW entity_property_index AS
SELECT
  pv.workspace_id,
  pv.entity_type,
  pv.entity_id,
  pd.key as property_key,
  pd.name as property_name,
  pd.type as property_type,
  pv.value,
  pv.updated_at
FROM property_values pv
JOIN property_definitions pd ON pv.property_id = pd.id;

CREATE INDEX idx_entity_property_index_lookup
  ON entity_property_index(workspace_id, property_key, entity_type);
CREATE INDEX idx_entity_property_index_value
  ON entity_property_index USING GIN(value);

-- Refresh on property changes (trigger or periodic)
REFRESH MATERIALIZED VIEW CONCURRENTLY entity_property_index;
```

2. **Smart Query Builder:**

```typescript
// src/lib/query-builder.ts
export class UniversalQueryBuilder {
  private workspace_id: string;
  private filters: PropertyFilter[] = [];
  private entityTypes: EntityType[] = [];

  whereProperty(key: string, operator: string, value: any) {
    this.filters.push({ key, operator, value });
    return this;
  }

  whereEntityType(...types: EntityType[]) {
    this.entityTypes = types;
    return this;
  }

  async execute(): Promise<EntityRef[]> {
    // Build SQL query based on filters
    // Use materialized view for common patterns
    // Fall back to property_values for complex queries
  }
}

// Usage
const results = await new UniversalQueryBuilder(workspaceId)
  .whereEntityType('block:embed:figma', 'doc')
  .whereProperty('status', 'eq', 'blocked')
  .whereProperty('assignee', 'eq', userId)
  .execute();
```

**Phase 2: Typesense Integration (Post-MVP)**

```typescript
// Index all entities with their properties in Typesense
interface EntityDocument {
  id: string; // composite: entity_type:entity_id
  workspace_id: string;
  entity_type: string;
  entity_subtype?: string;

  // Entity metadata
  title?: string; // Extracted display name
  content?: string; // Searchable text content
  created_at: number;
  updated_at: number;

  // Properties (dynamic fields)
  properties: {
    [key: string]: any; // status: "blocked", priority: "high", etc.
  };
}

// Natural language query → Typesense search
"Show me all Figma files with status blocked assigned to Sarah"
  → Parse: entity_type=block:embed:figma, status=blocked, assignee=Sarah
  → Typesense query: filter_by="entity_type:block:embed:figma && properties.status:blocked && properties.assignee:Sarah"
  → Return matching entity IDs
```

---

### Decision 6: Property UI/UX

**RECOMMENDATION: Inline Properties + Dedicated Property Panel**

**UI Components to Build:**

1. **Property Badge (Inline Display)**

```tsx
// src/components/properties/property-badge.tsx
<PropertyBadge
  property={propertyDef}
  value={propertyValue}
  compact={true}
  onClick={() => openPropertyEditor()}
/>

// Renders as small badge on entity:
// Status: "Blocked" (red dot + text)
// Assignee: Avatar of user
// Date: "Jan 15, 2026"
```

2. **Property Panel (Sidebar/Modal)**

```tsx
// src/components/properties/property-panel.tsx
<PropertyPanel entityRef={entityRef}>
  {/* List of current properties */}
  <PropertyRow property="Status" value="Blocked" onEdit={...} />
  <PropertyRow property="Assignee" value="Sarah" onEdit={...} />

  {/* Add property button */}
  <AddPropertyButton
    entityRef={entityRef}
    existingProperties={workspaceProperties}
    onCreate={(prop) => createPropertyValue(entityRef, prop)}
  />
</PropertyPanel>
```

3. **Property Value Editor (Type-Specific)**

```tsx
// Reuse existing table cell editors!
// src/components/tables/cells/status-cell.tsx
// src/components/tables/cells/select-cell.tsx
// src/components/tables/cells/date-cell.tsx
// etc.

// Wrap in universal property editor
<PropertyValueEditor
  property={propertyDef}
  value={currentValue}
  onChange={(newValue) => updatePropertyValue(entityRef, property.id, newValue)}
/>
```

4. **Add Property Autocomplete**

```tsx
// src/components/properties/add-property-autocomplete.tsx
<AddPropertyAutocomplete
  workspaceId={workspaceId}
  existingProperties={existingProperties}
  onSelect={(property) => {
    if (property.isNew) {
      // Show property type picker
      setShowTypePicker(true);
    } else {
      // Add existing property
      addPropertyToEntity(property);
    }
  }}
/>
```

**Where Properties Appear:**

| Entity Type       | Inline Display                          | Panel Access                      |
|-------------------|-----------------------------------------|-----------------------------------|
| Block (any)       | Badges in block header/footer           | Click block → "Properties" button |
| Doc               | Properties section at top of doc        | Sidebar panel                     |
| Timeline Event    | Badges on event card                    | Event detail modal                |
| Table Row         | Uses existing table cells               | N/A (already has columns)         |
| Project/Tab       | Settings/metadata section               | Project settings panel            |

**Bulk Property Editing:**

```tsx
// User selects multiple entities (shift-click, cmd-click)
<BulkPropertyEditor
  selectedEntities={selectedEntityRefs}
  onApply={(property, value) => {
    // Update all selected entities with same property value
    bulkUpdatePropertyValues(selectedEntityRefs, property.id, value);
  }}
/>
```

---

### Decision 7: AI Query Interface

**RECOMMENDATION: Natural Language → Structured Query → Results Pipeline**

**Architecture:**

```
User Input (NL)
  ↓
AI Parser (LLM)
  ↓
Structured Query (JSON)
  ↓
Query Executor (SQL/Typesense)
  ↓
Entity Resolver (Fetch full entities)
  ↓
View Renderer (Table/Timeline/Board/List)
```

**Step 1: AI Parser**

```typescript
// src/lib/ai/query-parser.ts
import Anthropic from '@anthropic-ai/sdk';

interface ParsedQuery {
  intent: 'find' | 'aggregate' | 'visualize';
  entityTypes?: EntityType[];
  filters: PropertyFilter[];
  sort?: { property: string; direction: 'asc' | 'desc' };
  view?: 'table' | 'timeline' | 'board' | 'list' | 'calendar';
  groupBy?: string; // Property key to group by
}

export async function parseNaturalLanguageQuery(
  userQuery: string,
  workspaceContext: WorkspaceContext
): Promise<ParsedQuery> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `
You are a query parser for Trak, a workspace app. Parse this user query into a structured format.

Available entity types: ${workspaceContext.entityTypes.join(', ')}
Available properties: ${JSON.stringify(workspaceContext.properties)}

User query: "${userQuery}"

Return JSON matching this schema:
{
  "intent": "find" | "aggregate" | "visualize",
  "entityTypes": ["block:embed:figma", ...],
  "filters": [
    { "property": "status", "operator": "eq", "value": "blocked" },
    { "property": "assignee", "operator": "eq", "value": "user_id" }
  ],
  "sort": { "property": "updated_at", "direction": "desc" },
  "view": "table" | "timeline" | "board" | "list",
  "groupBy": "status"
}
`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(response.content[0].text);
}
```

**Step 2: Query Executor**

```typescript
// src/lib/ai/query-executor.ts
export async function executeQuery(
  parsedQuery: ParsedQuery,
  workspaceId: string
): Promise<EntityRef[]> {
  const queryBuilder = new UniversalQueryBuilder(workspaceId);

  // Apply entity type filters
  if (parsedQuery.entityTypes) {
    queryBuilder.whereEntityType(...parsedQuery.entityTypes);
  }

  // Apply property filters
  for (const filter of parsedQuery.filters) {
    queryBuilder.whereProperty(filter.property, filter.operator, filter.value);
  }

  // Apply sorting
  if (parsedQuery.sort) {
    queryBuilder.orderBy(parsedQuery.sort.property, parsedQuery.sort.direction);
  }

  return await queryBuilder.execute();
}
```

**Step 3: Entity Resolver + View Renderer**

```typescript
// src/lib/ai/view-renderer.ts
export async function renderQueryResults(
  entityRefs: EntityRef[],
  viewType: 'table' | 'timeline' | 'board' | 'list',
  groupBy?: string
): Promise<React.ReactNode> {
  // Resolve all entities
  const entities = await Promise.all(
    entityRefs.map(ref => resolveEntity(ref))
  );

  // Enrich with property values
  const entitiesWithProps = await Promise.all(
    entities.map(async entity => ({
      ...entity,
      properties: await getEntityProperties(entity.type, entity.id)
    }))
  );

  // Render based on view type
  switch (viewType) {
    case 'table':
      return <UniversalTableView entities={entitiesWithProps} />;
    case 'timeline':
      return <UniversalTimelineView entities={entitiesWithProps} />;
    case 'board':
      return <UniversalBoardView entities={entitiesWithProps} groupBy={groupBy} />;
    case 'list':
      return <UniversalListView entities={entitiesWithProps} />;
  }
}
```

**Example Queries:**

| User Input | Parsed Query |
|------------|--------------|
| "Show me all Figma files with status blocked" | `{ intent: "find", entityTypes: ["block:embed:figma"], filters: [{ property: "status", operator: "eq", value: "blocked" }], view: "list" }` |
| "Create a timeline of all marketing deliverables" | `{ intent: "visualize", filters: [{ property: "tags", operator: "contains", value: "marketing" }], view: "timeline" }` |
| "Board view of all tasks assigned to Sarah grouped by status" | `{ intent: "visualize", entityTypes: ["task"], filters: [{ property: "assignee", operator: "eq", value: "sarah_user_id" }], view: "board", groupBy: "status" }` |

---

### Decision 8: Migration & Backwards Compatibility

**RECOMMENDATION: Dual-Track System with Adapters**

**Strategy:**

1. **Keep existing systems intact:**
   - `table_rows.data` stays as-is (JSONB keyed by field_id)
   - `blocks.content` stays as-is (JSONB with type-specific data)
   - `timeline_events` columns stay as-is (dedicated columns)

2. **Add universal properties as overlay:**
   - New `property_definitions` and `property_values` tables
   - Entities can have BOTH old-style storage AND universal properties
   - Over time, migrate to universal properties only

3. **Adapter layer for unified querying:**

```typescript
// src/lib/adapters/entity-property-adapter.ts
export async function getEntityProperties(
  entityRef: EntityRef
): Promise<PropertyValue[]> {
  switch (entityRef.type) {
    case 'table_row':
      // Adapt table_rows.data to universal property format
      const row = await getTableRow(entityRef.id);
      const fields = await getTableFields(row.table_id);
      return fields.map(field => ({
        property_id: field.id,
        property_name: field.name,
        property_type: field.type,
        value: row.data[field.id]
      }));

    case 'timeline_event':
      // Adapt timeline_events columns to universal properties
      const event = await getTimelineEvent(entityRef.id);
      return [
        { property_id: 'status', property_name: 'Status', value: event.status },
        { property_id: 'assignee', property_name: 'Assignee', value: event.assignee_id },
        { property_id: 'progress', property_name: 'Progress', value: event.progress },
        // ... etc
      ];

    default:
      // Fetch from property_values table
      return await supabase
        .from('property_values')
        .select('*, property:property_definitions(*)')
        .eq('entity_type', entityRef.type)
        .eq('entity_id', entityRef.id);
  }
}
```

**Migration Path:**

**Phase 1 (MVP):** Universal properties for blocks, docs, projects, tabs only
- Table rows and timeline events use adapter layer (read-only via universal interface)
- No changes to existing table/timeline code

**Phase 2 (Post-MVP):** Migrate timeline events to universal properties
- Create property definitions for status, assignee, progress, etc.
- Backfill property_values from timeline_events columns
- Update timeline UI to use universal property components
- Deprecate timeline_events columns (but keep for backwards compat)

**Phase 3 (Future):** Optionally migrate table fields to universal properties
- Create property definitions from table_fields
- Backfill property_values from table_rows.data
- Allows cross-table querying ("find all rows across ALL tables where status=blocked")
- **This is optional** - table system can remain separate if performance is better

---

## Part 2: Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Goal:** Core schema, API, and basic CRUD

**Tasks:**

1. **Database Schema**
   - [ ] Create `property_definitions` table with RLS policies
   - [ ] Create `property_values` table with RLS policies
   - [ ] Add indexes for fast querying
   - [ ] Create system properties (created_at, updated_at, etc.)
   - [ ] Write migration SQL file

2. **Type Definitions**
   - [ ] Create `src/types/property.ts` (reuse table field types)
   - [ ] Create `EntityRef` type and entity type enums
   - [ ] Create `PropertyDefinition` and `PropertyValue` interfaces

3. **Server Actions (Basic CRUD)**
   - [ ] `src/app/actions/properties/definition-actions.ts`
     - `getPropertyDefinitions(workspaceId)`
     - `createPropertyDefinition(data)`
     - `updatePropertyDefinition(id, data)`
     - `deletePropertyDefinition(id)`
   - [ ] `src/app/actions/properties/value-actions.ts`
     - `getEntityProperties(entityRef)`
     - `setPropertyValue(entityRef, propertyId, value)`
     - `deletePropertyValue(entityRef, propertyId)`
     - `bulkSetPropertyValues(entityRefs[], propertyId, value)`

4. **Entity Resolver**
   - [ ] `src/lib/entities/resolver.ts`
     - `resolveEntity(entityRef)` - fetch entity data
     - `getEntityDisplayName(entity)` - extract title/name
     - `getEntityUrl(entityRef)` - generate link to entity

**Deliverable:** API layer complete, can create properties and set values via code

---

### Phase 2: UI Components (Days 3-4)

**Goal:** User can add/edit properties in UI

**Tasks:**

1. **Property Value Editors (Reuse Table Cells)**
   - [ ] `src/components/properties/property-value-editor.tsx`
     - Wrapper around table cell editors
     - Type-specific rendering (status, select, date, person, etc.)
   - [ ] Test with all 12 MVP property types

2. **Property Display Components**
   - [ ] `src/components/properties/property-badge.tsx`
     - Compact inline display of property value
     - Click to edit
   - [ ] `src/components/properties/property-row.tsx`
     - Single property row in panel (label + value + edit button)

3. **Add Property UI**
   - [ ] `src/components/properties/add-property-autocomplete.tsx`
     - Search/filter workspace properties
     - "Create new property" option
   - [ ] `src/components/properties/property-type-picker.tsx`
     - Modal/dropdown to select property type for new property
     - Show icons + descriptions for each type

4. **Property Panel**
   - [ ] `src/components/properties/property-panel.tsx`
     - List of entity's properties
     - Add property button
     - Delete property button
   - [ ] Integrate into block hover menu (click → "Properties" → panel opens)

5. **Block UI Integration**
   - [ ] Add property badges to block renderer
   - [ ] Add "Properties" button to block hover toolbar
   - [ ] Test with embed blocks (Figma, Loom, etc.)

**Deliverable:** Users can add properties to blocks and see/edit them in UI

---

### Phase 3: Query Layer (Days 5-6)

**Goal:** Query entities by properties programmatically

**Tasks:**

1. **Query Builder**
   - [ ] `src/lib/queries/universal-query-builder.ts`
     - `whereProperty(key, operator, value)`
     - `whereEntityType(...types)`
     - `orderBy(property, direction)`
     - `limit(n)`, `offset(n)`
     - `execute()` - returns EntityRef[]

2. **Materialized View (Optional Optimization)**
   - [ ] Create `entity_property_index` materialized view
   - [ ] Trigger to refresh on property changes
   - [ ] Update query builder to use view

3. **React Hooks**
   - [ ] `src/lib/hooks/use-property-queries.ts`
     - `usePropertyDefinitions(workspaceId)`
     - `useEntityProperties(entityRef)`
     - `useUpdatePropertyValue()`
   - [ ] `src/lib/hooks/use-universal-query.ts`
     - `useUniversalQuery(filters, entityTypes)`
     - Returns entities matching query

4. **Server Action for Querying**
   - [ ] `src/app/actions/properties/query-actions.ts`
     - `queryEntities(workspaceId, filters, entityTypes)`
     - Returns entity refs + resolved entities + properties

**Deliverable:** Can query "find all blocks where status=blocked" and get results

---

### Phase 4: AI Integration (Days 7-8)

**Goal:** Natural language queries work

**Tasks:**

1. **AI Query Parser**
   - [ ] Set up Anthropic SDK
   - [ ] `src/lib/ai/query-parser.ts`
     - Parse NL → structured query
     - Handle entity types, property filters, view preferences
   - [ ] Test with example queries

2. **Query Executor**
   - [ ] `src/lib/ai/query-executor.ts`
     - Take ParsedQuery → use UniversalQueryBuilder → return results
   - [ ] Handle edge cases (unknown properties, invalid filters)

3. **Universal View Renderers**
   - [ ] `src/components/views/universal-list-view.tsx`
     - List of entities with properties shown
   - [ ] `src/components/views/universal-table-view.tsx`
     - Table with dynamic columns based on properties
   - [ ] `src/components/views/universal-board-view.tsx`
     - Kanban board grouped by property (status, assignee, etc.)

4. **AI Query Interface Component**
   - [ ] `src/components/ai/query-input.tsx`
     - Text input: "Show me all..."
     - Submit → parse → execute → render
   - [ ] Add to workspace/project view (floating button or search bar)

**Deliverable:** Users can ask "show me all Figma files with status blocked" and see results

---

### Phase 5: Polish & Migration (Days 9-10)

**Goal:** Production-ready, integrated with existing features

**Tasks:**

1. **Adapter Layer for Table Rows**
   - [ ] `src/lib/adapters/table-row-adapter.ts`
     - `getTableRowProperties(rowId)` - convert table_rows.data to PropertyValue[]
     - Allows querying table rows via universal query interface

2. **Adapter Layer for Timeline Events**
   - [ ] `src/lib/adapters/timeline-event-adapter.ts`
     - `getTimelineEventProperties(eventId)` - convert columns to PropertyValue[]
     - Enables cross-entity queries including timeline events

3. **Bulk Operations**
   - [ ] Bulk property assignment UI (select multiple entities → set property)
   - [ ] Bulk property deletion

4. **Property Templates**
   - [ ] `src/components/properties/property-templates.tsx`
     - Predefined property sets (e.g., "Task Template" = status + assignee + due date)
     - Apply template to entity → creates all properties at once

5. **Performance Optimization**
   - [ ] Add database indexes based on real query patterns
   - [ ] Implement property value caching (React Query)
   - [ ] Lazy load property values (don't fetch until panel opened)

6. **Documentation**
   - [ ] API documentation for server actions
   - [ ] Component usage examples
   - [ ] Architecture decision records

**Deliverable:** System is performant, polished, and ready for user testing

---

## Part 3: Technical Specifications

### Database Schema (Complete SQL)

```sql
-- ============================================================================
-- PROPERTY DEFINITIONS
-- ============================================================================

CREATE TABLE property_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  key TEXT NOT NULL, -- Normalized: lowercase, no spaces
  type TEXT NOT NULL CHECK (type IN (
    'text', 'long_text', 'number', 'date', 'date_range',
    'checkbox', 'select', 'multi_select', 'status', 'priority',
    'person', 'url', 'email', 'phone', 'files',
    'relation', 'formula', 'rollup',
    'created_time', 'last_edited_time', 'created_by', 'last_edited_by'
  )),
  config JSONB NOT NULL DEFAULT '{}',

  scope TEXT NOT NULL DEFAULT 'workspace' CHECK (scope IN ('workspace', 'project', 'entity_type')),
  scope_id UUID, -- project_id if project-scoped
  entity_type TEXT, -- If scoped to entity type: 'block:embed:figma'

  is_system BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, key, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

CREATE INDEX idx_property_definitions_workspace ON property_definitions(workspace_id);
CREATE INDEX idx_property_definitions_key ON property_definitions(workspace_id, key);
CREATE INDEX idx_property_definitions_scope ON property_definitions(workspace_id, scope, scope_id);

ALTER TABLE property_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property definitions visible to workspace members"
  ON property_definitions FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property definitions insertable by workspace members"
  ON property_definitions FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property definitions updatable by workspace members"
  ON property_definitions FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property definitions deletable by workspace members"
  ON property_definitions FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE TRIGGER property_definitions_set_updated_at
  BEFORE UPDATE ON property_definitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- PROPERTY VALUES
-- ============================================================================

CREATE TABLE property_values (
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES property_definitions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  value JSONB,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (entity_type, entity_id, property_id)
);

CREATE INDEX idx_property_values_workspace ON property_values(workspace_id);
CREATE INDEX idx_property_values_entity ON property_values(entity_type, entity_id);
CREATE INDEX idx_property_values_property ON property_values(property_id);
CREATE INDEX idx_property_values_value ON property_values USING GIN(value);
CREATE INDEX idx_property_values_type_workspace ON property_values(entity_type, workspace_id);
CREATE INDEX idx_property_values_lookup ON property_values(workspace_id, property_id, entity_type);

ALTER TABLE property_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property values visible to workspace members"
  ON property_values FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property values insertable by workspace members"
  ON property_values FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property values updatable by workspace members"
  ON property_values FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Property values deletable by workspace members"
  ON property_values FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE TRIGGER property_values_set_updated_at
  BEFORE UPDATE ON property_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- MATERIALIZED VIEW (OPTIONAL PERFORMANCE OPTIMIZATION)
-- ============================================================================

CREATE MATERIALIZED VIEW entity_property_index AS
SELECT
  pv.workspace_id,
  pv.entity_type,
  pv.entity_id,
  pd.id as property_id,
  pd.key as property_key,
  pd.name as property_name,
  pd.type as property_type,
  pd.config as property_config,
  pv.value,
  pv.updated_at
FROM property_values pv
JOIN property_definitions pd ON pv.property_id = pd.id;

CREATE UNIQUE INDEX idx_entity_property_index_pk
  ON entity_property_index(entity_type, entity_id, property_id);
CREATE INDEX idx_entity_property_index_workspace
  ON entity_property_index(workspace_id);
CREATE INDEX idx_entity_property_index_property
  ON entity_property_index(workspace_id, property_key);
CREATE INDEX idx_entity_property_index_value
  ON entity_property_index USING GIN(value);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_entity_property_index()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY entity_property_index;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh on property changes (debounced via pg_cron or manual)
-- For production, use pg_cron or application-level refresh logic
```

---

### Type Definitions (Complete TypeScript)

```typescript
// src/types/property.ts

import type { FieldType, FieldConfig } from './table';

// ============================================================================
// Entity References
// ============================================================================

export type EntityType =
  | 'block'
  | 'doc'
  | 'timeline_event'
  | 'table_row'
  | 'project'
  | 'tab'
  | 'task';

export type BlockSubtype =
  | 'text'
  | 'task'
  | 'link'
  | 'divider'
  | 'table'
  | 'timeline'
  | 'file'
  | 'video'
  | 'image'
  | 'embed'
  | 'pdf'
  | 'section'
  | 'doc_reference';

export type EmbedSubtype =
  | 'figma'
  | 'loom'
  | 'youtube'
  | 'miro'
  | 'airtable'
  | 'google_drive'
  | 'notion';

export interface EntityRef {
  type: EntityType;
  id: string; // UUID
  subtype?: BlockSubtype | EmbedSubtype; // For blocks
}

export function entityRefToString(ref: EntityRef): string {
  return ref.subtype ? `${ref.type}:${ref.subtype}:${ref.id}` : `${ref.type}:${ref.id}`;
}

export function parseEntityRef(str: string): EntityRef {
  const parts = str.split(':');
  return {
    type: parts[0] as EntityType,
    id: parts[parts.length - 1],
    subtype: parts.length === 3 ? parts[1] : undefined
  };
}

// ============================================================================
// Property Definitions
// ============================================================================

export type PropertyType = FieldType; // Reuse all 28 table field types

export type PropertyScope = 'workspace' | 'project' | 'entity_type';

export interface PropertyDefinition {
  id: string;
  workspace_id: string;

  name: string; // Display name: "Status", "Assignee"
  key: string;  // Normalized key: "status", "assignee"
  type: PropertyType;
  config: FieldConfig; // Reuse table field configs

  scope: PropertyScope;
  scope_id?: string; // project_id if project-scoped
  entity_type?: string; // e.g., "block:embed:figma"

  is_system: boolean;
  display_order: number;

  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Property Values
// ============================================================================

export interface PropertyValue {
  entity_type: string;
  entity_id: string;
  property_id: string;
  workspace_id: string;

  value: any; // JSONB - type depends on property type

  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Joined from property_definitions
  property?: PropertyDefinition;
}

// ============================================================================
// Query Types
// ============================================================================

export type FilterOperator =
  | 'eq'         // Equals
  | 'ne'         // Not equals
  | 'gt'         // Greater than
  | 'gte'        // Greater than or equal
  | 'lt'         // Less than
  | 'lte'        // Less than or equal
  | 'contains'   // String contains
  | 'startsWith' // String starts with
  | 'endsWith'   // String ends with
  | 'in'         // In array
  | 'notIn'      // Not in array
  | 'isNull'     // Is null
  | 'isNotNull'; // Is not null

export interface PropertyFilter {
  property: string; // Property key
  operator: FilterOperator;
  value?: any;
}

export interface UniversalQuery {
  workspace_id: string;
  entity_types?: EntityType[];
  filters: PropertyFilter[];
  sort?: {
    property: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  entities: EntityRef[];
  total: number;
}

// ============================================================================
// AI Query Types
// ============================================================================

export type QueryIntent = 'find' | 'aggregate' | 'visualize';
export type ViewType = 'table' | 'timeline' | 'board' | 'list' | 'calendar';

export interface ParsedQuery {
  intent: QueryIntent;
  entityTypes?: EntityType[];
  filters: PropertyFilter[];
  sort?: {
    property: string;
    direction: 'asc' | 'desc';
  };
  view?: ViewType;
  groupBy?: string; // Property key to group by
}

// ============================================================================
// Entity with Properties (Resolved)
// ============================================================================

export interface EntityWithProperties {
  ref: EntityRef;
  entity: any; // Full entity data (block, doc, etc.)
  properties: PropertyValue[];
  displayName: string;
  url: string;
}
```

---

### Server Actions API (Complete)

```typescript
// src/app/actions/properties/definition-actions.ts

'use server';

import { createClient } from '@/lib/supabase/server';
import type { PropertyDefinition } from '@/types/property';

export async function getPropertyDefinitions(
  workspaceId: string,
  scope?: 'workspace' | 'project' | 'entity_type',
  scopeId?: string
) {
  const supabase = await createClient();

  let query = supabase
    .from('property_definitions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('display_order', { ascending: true });

  if (scope) {
    query = query.eq('scope', scope);
    if (scopeId) {
      query = query.eq('scope_id', scopeId);
    }
  }

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  return { data: data as PropertyDefinition[] };
}

export async function createPropertyDefinition(
  data: Omit<PropertyDefinition, 'id' | 'created_at' | 'updated_at'>
) {
  const supabase = await createClient();

  // Normalize key
  const key = data.name.toLowerCase().replace(/\s+/g, '_');

  const { data: property, error } = await supabase
    .from('property_definitions')
    .insert({
      ...data,
      key,
      config: data.config || {}
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: property as PropertyDefinition };
}

export async function updatePropertyDefinition(
  id: string,
  updates: Partial<PropertyDefinition>
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('property_definitions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as PropertyDefinition };
}

export async function deletePropertyDefinition(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('property_definitions')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

```typescript
// src/app/actions/properties/value-actions.ts

'use server';

import { createClient } from '@/lib/supabase/server';
import type { EntityRef, PropertyValue } from '@/types/property';
import { entityRefToString } from '@/types/property';

export async function getEntityProperties(entityRef: EntityRef) {
  const supabase = await createClient();

  const entityTypeStr = entityRef.subtype
    ? `${entityRef.type}:${entityRef.subtype}`
    : entityRef.type;

  const { data, error } = await supabase
    .from('property_values')
    .select('*, property:property_definitions(*)')
    .eq('entity_type', entityTypeStr)
    .eq('entity_id', entityRef.id);

  if (error) {
    return { error: error.message };
  }

  return { data: data as PropertyValue[] };
}

export async function setPropertyValue(
  entityRef: EntityRef,
  propertyId: string,
  value: any,
  workspaceId: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const entityTypeStr = entityRef.subtype
    ? `${entityRef.type}:${entityRef.subtype}`
    : entityRef.type;

  const { data, error } = await supabase
    .from('property_values')
    .upsert({
      entity_type: entityTypeStr,
      entity_id: entityRef.id,
      property_id: propertyId,
      workspace_id: workspaceId,
      value,
      updated_by: user.id
    }, {
      onConflict: 'entity_type,entity_id,property_id'
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data: data as PropertyValue };
}

export async function deletePropertyValue(
  entityRef: EntityRef,
  propertyId: string
) {
  const supabase = await createClient();

  const entityTypeStr = entityRef.subtype
    ? `${entityRef.type}:${entityRef.subtype}`
    : entityRef.type;

  const { error } = await supabase
    .from('property_values')
    .delete()
    .eq('entity_type', entityTypeStr)
    .eq('entity_id', entityRef.id)
    .eq('property_id', propertyId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function bulkSetPropertyValues(
  entityRefs: EntityRef[],
  propertyId: string,
  value: any,
  workspaceId: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const values = entityRefs.map(ref => {
    const entityTypeStr = ref.subtype
      ? `${ref.type}:${ref.subtype}`
      : ref.type;

    return {
      entity_type: entityTypeStr,
      entity_id: ref.id,
      property_id: propertyId,
      workspace_id: workspaceId,
      value,
      updated_by: user.id
    };
  });

  const { data, error } = await supabase
    .from('property_values')
    .upsert(values, {
      onConflict: 'entity_type,entity_id,property_id'
    })
    .select();

  if (error) {
    return { error: error.message };
  }

  return { data: data as PropertyValue[] };
}
```

```typescript
// src/app/actions/properties/query-actions.ts

'use server';

import { createClient } from '@/lib/supabase/server';
import type { UniversalQuery, QueryResult, EntityRef } from '@/types/property';

export async function queryEntities(query: UniversalQuery): Promise<{ data?: QueryResult; error?: string }> {
  const supabase = await createClient();

  // Start with base query
  let dbQuery = supabase
    .from('entity_property_index') // Use materialized view for performance
    .select('entity_type, entity_id', { count: 'exact' })
    .eq('workspace_id', query.workspace_id);

  // Filter by entity types
  if (query.entity_types && query.entity_types.length > 0) {
    dbQuery = dbQuery.in('entity_type', query.entity_types);
  }

  // Apply property filters
  // Note: Complex multi-property filters require subqueries or joins
  // For MVP, we'll use in-memory filtering after fetching candidates

  const { data: candidates, error: candidatesError, count } = await dbQuery;

  if (candidatesError) {
    return { error: candidatesError.message };
  }

  // Fetch property values for candidates
  const candidateIds = candidates?.map(c => c.entity_id) || [];
  const { data: propertyValues, error: valuesError } = await supabase
    .from('property_values')
    .select('entity_type, entity_id, property_id, value, property:property_definitions(key, type)')
    .in('entity_id', candidateIds);

  if (valuesError) {
    return { error: valuesError.message };
  }

  // Group properties by entity
  const entitiesMap = new Map<string, { ref: EntityRef; props: any }>();

  for (const pv of propertyValues || []) {
    const key = `${pv.entity_type}:${pv.entity_id}`;
    if (!entitiesMap.has(key)) {
      entitiesMap.set(key, {
        ref: { type: pv.entity_type as any, id: pv.entity_id },
        props: {}
      });
    }
    entitiesMap.get(key)!.props[pv.property.key] = pv.value;
  }

  // Apply in-memory filters
  let filtered = Array.from(entitiesMap.values());

  for (const filter of query.filters) {
    filtered = filtered.filter(entity => {
      const propValue = entity.props[filter.property];

      switch (filter.operator) {
        case 'eq':
          return propValue === filter.value;
        case 'ne':
          return propValue !== filter.value;
        case 'contains':
          return String(propValue).includes(String(filter.value));
        case 'isNull':
          return propValue === null || propValue === undefined;
        case 'isNotNull':
          return propValue !== null && propValue !== undefined;
        // Add more operators as needed
        default:
          return true;
      }
    });
  }

  // Apply sorting
  if (query.sort) {
    filtered.sort((a, b) => {
      const aVal = a.props[query.sort!.property];
      const bVal = b.props[query.sort!.property];
      const direction = query.sort!.direction === 'asc' ? 1 : -1;
      return (aVal > bVal ? 1 : -1) * direction;
    });
  }

  // Apply pagination
  const start = query.offset || 0;
  const end = start + (query.limit || 100);
  const paginated = filtered.slice(start, end);

  return {
    data: {
      entities: paginated.map(e => e.ref),
      total: filtered.length
    }
  };
}
```

---

### React Hooks (Complete)

```typescript
// src/lib/hooks/use-property-queries.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EntityRef, PropertyDefinition, PropertyValue } from '@/types/property';
import {
  getPropertyDefinitions,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition
} from '@/app/actions/properties/definition-actions';
import {
  getEntityProperties,
  setPropertyValue,
  deletePropertyValue,
  bulkSetPropertyValues
} from '@/app/actions/properties/value-actions';
    
// ============================================================================
// Property Definitions
// ============================================================================

export function usePropertyDefinitions(workspaceId: string) {
  return useQuery({
    queryKey: ['propertyDefinitions', workspaceId],
    queryFn: async () => {
      const result = await getPropertyDefinitions(workspaceId);
      if ('error' in result) throw new Error(result.error);
      return result.data;
    },
    enabled: !!workspaceId
  });
}

export function useCreatePropertyDefinition(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPropertyDefinition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propertyDefinitions', workspaceId] });
    }
  });
}

export function useUpdatePropertyDefinition(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PropertyDefinition> }) =>
      updatePropertyDefinition(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propertyDefinitions', workspaceId] });
    }
  });
}

export function useDeletePropertyDefinition(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePropertyDefinition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propertyDefinitions', workspaceId] });
    }
  });
}

// ============================================================================
// Property Values
// ============================================================================

export function useEntityProperties(entityRef: EntityRef) {
  return useQuery({
    queryKey: ['entityProperties', entityRef.type, entityRef.id],
    queryFn: async () => {
      const result = await getEntityProperties(entityRef);
      if ('error' in result) throw new Error(result.error);
      return result.data;
    },
    enabled: !!entityRef.id
  });
}

export function useSetPropertyValue(entityRef: EntityRef, workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, value }: { propertyId: string; value: any }) =>
      setPropertyValue(entityRef, propertyId, value, workspaceId),
    onMutate: async ({ propertyId, value }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['entityProperties', entityRef.type, entityRef.id] });

      const previous = queryClient.getQueryData(['entityProperties', entityRef.type, entityRef.id]);

      queryClient.setQueryData(
        ['entityProperties', entityRef.type, entityRef.id],
        (old: PropertyValue[] | undefined) => {
          if (!old) return old;
          const existing = old.find(pv => pv.property_id === propertyId);
          if (existing) {
            return old.map(pv => pv.property_id === propertyId ? { ...pv, value } : pv);
          } else {
            return [...old, { property_id: propertyId, value } as PropertyValue];
          }
        }
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ['entityProperties', entityRef.type, entityRef.id],
        context?.previous
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entityProperties', entityRef.type, entityRef.id] });
    }
  });
}

export function useDeletePropertyValue(entityRef: EntityRef) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyId: string) => deletePropertyValue(entityRef, propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entityProperties', entityRef.type, entityRef.id] });
    }
  });
}

export function useBulkSetPropertyValues(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityRefs, propertyId, value }: {
      entityRefs: EntityRef[];
      propertyId: string;
      value: any
    }) => bulkSetPropertyValues(entityRefs, propertyId, value, workspaceId),
    onSuccess: (data, variables) => {
      // Invalidate all affected entities
      variables.entityRefs.forEach(ref => {
        queryClient.invalidateQueries({ queryKey: ['entityProperties', ref.type, ref.id] });
      });
    }
  });
}
```

---

## Part 4: Success Metrics & Testing

### User Success Criteria

1. **Adding Properties:** User can click any block → add a property → set value in < 10 seconds
2. **Querying:** User can ask "show me all Figma files with status blocked" → see results in < 3 seconds
3. **Bulk Operations:** User can select 10 blocks → set status to "In Progress" in < 5 seconds
4. **Cross-Entity Queries:** User can query across docs + timeline events + blocks with same property filters
5. **Performance:** Queries on workspaces with 1000+ entities return in < 2 seconds

### Technical Acceptance Criteria

- [ ] Property definitions CRUD operations work
- [ ] Property values CRUD operations work
- [ ] RLS policies enforce workspace access
- [ ] Indexes provide fast query performance (< 2s for 1000 entities)
- [ ] UI components render correctly for all 12 MVP property types
- [ ] Optimistic updates work without flicker
- [ ] AI query parser handles 10 example queries correctly
- [ ] Adapters correctly expose table rows and timeline events via universal interface

### Testing Plan

**Unit Tests:**
- Property value serialization/deserialization
- Filter operator logic
- Entity ref parsing/stringification

**Integration Tests:**
- Create property → set value → query → verify results
- Bulk update → verify all entities updated
- Delete property definition → verify cascade to values

**E2E Tests:**
- User flow: Add status to Figma embed → query for it → see in results
- User flow: Ask AI "show blocked items" → see board view grouped by assignee
- User flow: Bulk select blocks → set priority → verify updates

---

## Part 5: Migration & Rollout

### Rollout Phases

**Phase 1 (Internal Testing):**
- Deploy to staging environment
- Test with sample workspace (100 entities)
- Measure query performance
- Fix critical bugs

**Phase 2 (Beta Users):**
- Enable for 5-10 beta workspaces
- Collect feedback on UX
- Monitor performance metrics
- Iterate on UI based on feedback

**Phase 3 (General Availability):**
- Deploy to production
- Announce in changelog
- Create tutorial videos
- Monitor error rates and performance

### Backwards Compatibility

- No breaking changes to existing features
- Table system continues to work as-is
- Timeline events continue to use dedicated columns
- Blocks continue to use `content` JSONB
- Universal properties are additive only

### Data Migration

**No migration required for MVP** - universal properties are opt-in:
- Existing entities have no property values by default
- Users add properties as needed
- Adapters expose existing data (table rows, timeline events) without modification

---

## Part 6: Open Questions & Decisions Needed

### Questions for You

1. **AI Integration Timeline:**
   - Do you want AI querying in MVP (Phase 1) or can it be Phase 2?
   - What's the budget for Anthropic API calls?

2. **Property Scope:**
   - Should properties be workspace-level only, or support project-level and entity-type-level scopes?
   - Example: "Status" property for Figma embeds vs "Status" for all entities

3. **System Properties:**
   - Should we auto-populate created_at, updated_at, created_by for all entities?
   - Or only expose them when user explicitly adds them?

4. **Performance Targets:**
   - What's the max acceptable query time for 10,000 entities?
   - Should we optimize for MVP (1,000 entities) or long-term (100,000+)?

5. **UI Placement:**
   - Where should the AI query input live? Floating button? Search bar? Dedicated tab?
   - Should properties show inline on blocks by default, or only when panel is opened?

6. **Table Integration:**
   - Should table rows eventually migrate to universal properties?
   - Or keep tables as separate system indefinitely?

---

## Part 7: Next Steps

### Immediate Actions (Before Starting Implementation)

1. **Review this plan** - confirm architectural decisions align with vision
2. **Prioritize phases** - decide if AI querying is MVP or post-MVP
3. **Design mockups** - sketch UI for property panel, badges, AI query input
4. **Set performance benchmarks** - define acceptable query times
5. **Approve schema** - review SQL schema for property_definitions and property_values

### Development Kickoff

Once approved:
1. Create feature branch: `feature/universal-properties`
2. Run database migration (schema + system properties)
3. Implement Phase 1 tasks (Foundation)
4. Daily progress check-ins
5. Deploy to staging after each phase

---

## Appendices

### Appendix A: Example Queries

| User Query | Parsed Filters | SQL Preview |
|------------|----------------|-------------|
| "Show me all Figma files with status blocked" | `entityTypes: ['block:embed:figma'], filters: [{ property: 'status', operator: 'eq', value: 'blocked' }]` | `SELECT ... WHERE entity_type='block:embed:figma' AND property_key='status' AND value->>'value'='blocked'` |
| "Timeline of marketing deliverables due this week" | `entityTypes: ['timeline_event', 'doc', 'task'], filters: [{ property: 'tags', operator: 'contains', value: 'marketing' }, { property: 'due_date', operator: 'gte', value: '2026-01-13' }], view: 'timeline'` | `SELECT ... WHERE property_key='tags' AND value ? 'marketing' AND property_key='due_date' AND value >= '2026-01-13'` |
| "All tasks assigned to me" | `entityTypes: ['task'], filters: [{ property: 'assignee', operator: 'eq', value: currentUserId }]` | `SELECT ... WHERE entity_type='task' AND property_key='assignee' AND value->>'value'='{user_id}'` |

### Appendix B: Property Type Configs

```typescript
// Example configs for different property types

const statusConfig: StatusFieldConfig = {
  options: [
    { id: '1', label: 'To Do', color: 'gray' },
    { id: '2', label: 'In Progress', color: 'blue' },
    { id: '3', label: 'Blocked', color: 'red' },
    { id: '4', label: 'Done', color: 'green' }
  ]
};

const selectConfig: SelectFieldConfig = {
  options: [
    { id: '1', label: 'Marketing', color: 'purple' },
    { id: '2', label: 'Engineering', color: 'blue' },
    { id: '3', label: 'Design', color: 'pink' }
  ]
};

const personConfig = {}; // No config needed, references auth.users

const dateConfig = {
  includeTime: false,
  format: 'MM/DD/YYYY'
};
```

### Appendix C: File Structure

```
src/
├── types/
│   └── property.ts (EntityRef, PropertyDefinition, PropertyValue, etc.)
├── app/actions/properties/
│   ├── definition-actions.ts (CRUD for property definitions)
│   ├── value-actions.ts (CRUD for property values)
│   └── query-actions.ts (Universal entity querying)
├── lib/
│   ├── entities/
│   │   └── resolver.ts (Resolve EntityRef to full entity)
│   ├── queries/
│   │   └── universal-query-builder.ts (SQL query builder)
│   ├── ai/
│   │   ├── query-parser.ts (NL → ParsedQuery)
│   │   └── query-executor.ts (ParsedQuery → EntityRef[])
│   └── hooks/
│       ├── use-property-queries.ts (React Query hooks)
│       └── use-universal-query.ts (AI query hook)
├── components/properties/
│   ├── property-badge.tsx (Inline property display)
│   ├── property-row.tsx (Property in panel)
│   ├── property-panel.tsx (Full property panel)
│   ├── property-value-editor.tsx (Type-specific editors)
│   ├── add-property-autocomplete.tsx (Search/create properties)
│   └── property-type-picker.tsx (Select type for new property)
└── components/views/
    ├── universal-list-view.tsx (List view for query results)
    ├── universal-table-view.tsx (Table view for query results)
    ├── universal-board-view.tsx (Board view for query results)
    └── universal-timeline-view.tsx (Timeline view for query results)
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building Trak's universal properties system. The hybrid architecture balances flexibility with performance, reuses existing table field infrastructure, and provides a clear path from MVP to full AI-powered querying.

**Key advantages of this approach:**
- ✅ Any entity can have properties without schema changes
- ✅ Reuses battle-tested table field types and configs
- ✅ Backwards compatible with existing systems
- ✅ Scales to 10,000+ entities with proper indexing
- ✅ Enables cross-entity querying and AI-powered search
- ✅ Phased implementation reduces risk

**Total estimated timeline:** 10 days (8 working days + 2 buffer)

**Ready to proceed?** Review this plan, approve architectural decisions, and we can start with Phase 1 implementation immediately.
