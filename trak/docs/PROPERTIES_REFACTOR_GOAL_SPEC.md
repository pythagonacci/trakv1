# Properties Refactor — Goal Spec

## Overview

This document defines the **target state** of the Trak property system. It describes exactly what we want the system to do, how data is structured, and how components interact. No implementation details—only requirements and behavior.

---

## 1. Property Model

### 1.1 Property Identity

- **No `property_definition_id`**. Properties are not identified by a workspace-level definition.
- A property is identified by **Type + Name + Value**.
- Multiple properties of the same type can exist on one entity as long as they have **different names**.

### 1.2 Property Types (Fixed)

| Type        | Allowed Values                                             | Editable? |
|-------------|-------------------------------------------------------------|-----------|
| `status`    | `todo`, `in_progress`, `done`, `blocked`                    | No        |
| `priority`  | `low`, `medium`, `high`, `urgent`                           | No        |
| `assignee`  | User IDs (single or array) — same format as today           | No        |
| `due_date`  | `{ start, end }` ISO date strings — same as today           | No        |
| `tags`      | User-defined strings                                        | Yes       |

- These five types are **fixed**. No new types.
- Values (except tags) are **predefined** and cannot be changed.
- **Tags** keep their current behavior: type and name are always `tags`, value is whatever the user types.

### 1.3 Property Names

- **User-defined** and editable.
- When adding via UI:
  - Default name from the button: `"Priority"`, `"Status"`, `"Assignee"`, etc.
  - User can edit the name; the edited name becomes the property name in the DB.
- Example: task can have `"Priority"` = high and `"Execution Priority"` = medium (two properties, same type, different names).

### 1.4 Value Requirement

- Every time a property type is selected, a **value must be added**.
- No null/empty values at creation.

---

## 2. Storage Model

### 2.1 Tasks and Timeline Events

- **One JSONB column per property type**: `status`, `priority`, `assignee`, `due_date`, `tags`.
- Each column stores an **array** of `{ field_name, value }` objects.
- Example `priorities` column:

  ```json
  [
    { "field_name": "Priority", "value": "high" },
    { "field_name": "Execution Priority", "value": "medium" }
  ]
  ```

- Same structure for `status`, `assignee`, `due_date`, `tags` (values follow existing formats).

### 2.2 Entity Properties Table

- **`entity_properties`** continues to be the unified layer for search/query.
- **Remove** `property_definition_id` column (or stop using it).
- Rows are identified by `(entity_type, entity_id, field_name)`.
- Each row has: `field_type` (status/priority/assignee/due_date/tags), `field_name`, `value`.
- Multiple rows per entity per type are allowed (different `field_name`).

### 2.3 Tables (Source of Truth)

- **Table row is source of truth** that syncs into `entity_properties`.
- Behavior stays as today: when a column has a universal property type (status, priority, assignee, due_date, tags), edits sync to `entity_properties`.
- **Column header name** = property name when the column holds a property type.

### 2.4 Custom Properties in Tables

- Custom properties (text, number, select, etc.) **only exist in table rows**.
- Not stored in `entity_properties` or anywhere else.
- **`property_definitions` table is removed**; custom properties are table-only.

---

## 3. UI Behavior

### 3.1 Adding Properties (Tasks, Timeline Events)

- User clicks a button to add a property (e.g., “Add Priority”).
- The DB receives:
  - **Type** (e.g., `priority`)
  - **Name** (default from button, e.g., `"Priority"`, editable by user)
  - **Value** (required, selected from predefined options)
- The edited name is what is stored as `field_name` in the DB.

### 3.2 Editing Property Names

- User can edit a property’s display name.
- The edited name becomes the `field_name` in the DB for that property.

### 3.3 Table Columns

- When adding a property type to a table column, the **column header** is the property name.
- Example: column header `"Sprint Priority"` with type `priority` → property name = `"Sprint Priority"`.

---

## 4. Search and Query

### 4.1 Search by Property Type and Value

- Search filters by **property type** and **value** (no property definition ID).
- Example: “everything high priority” → filter by `field_type = 'priority'` and `value = 'high'`.
- Returns all entities that have any property of that type with that value.

### 4.2 Search Result Format

- Each hit includes the **field name(s)** that matched.
- Example: search for high priority → result for Task A might include:
  - `field_name: "Priority"` (or `"Execution Priority"`, etc.)
  - so the user knows which named property matched.

---

## 5. AI Tools and Context

### 5.1 Search Tools

- `searchTasks`, `searchTimelineEvents`, `searchEntitiesByProperties`, etc. filter by **type + value**.
- No `propertyDefinitionId` or similar parameters.
- Tool params: e.g., `priority: "high"`, `status: "todo"` — interpreted as type + value.

### 5.2 Update Tools

- Update tools accept **type + name + value** (or type + value when name is implicit).
- Example: “set Execution Priority to high” → `type: "priority"`, `field_name: "Execution Priority"`, `value: "high"`.

### 5.3 AI Understanding

- AI is instructed that:
  - Properties are identified by type, name, and value.
  - Search uses type and value.
  - Multiple properties of the same type can exist with different names.

---

## 6. Out of Scope (for this refactor)

- **Inheritance / entity links** — not changed
- **Custom properties outside tables** — not applicable (they live only in table rows)
- **New property types** — not in scope

---

## 7. Summary

| Aspect              | Target State                                                                 |
|---------------------|------------------------------------------------------------------------------|
| Identity            | Type + Name + Value (no `property_definition_id`)                            |
| Types               | status, priority, assignee, due_date, tags (fixed)                           |
| Names               | User-defined, editable, default from UI                                      |
| Storage (task/event)| JSONB column per type: `[{ field_name, value }, ...]`                        |
| Storage (entity_properties) | `field_type` + `field_name` + `value` per row                       |
| Tables              | Row = source of truth; column header = property name                         |
| Search              | Filter by type + value; return field names with results                      |
| property_definitions | Removed                                                                     |
