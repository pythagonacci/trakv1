# Table relations `workspace_id` mismatch (unchanged)

**Status:** Documented only; no code change.

## Mismatch

- **`trak/src/app/actions/tables/relations.ts`** (used by `linkRows`):
  - **Line 110:** `workspace_id: field.table_id` — passes the **table UUID** (from table that owns the relation field).
  - **Line 149:** `workspace_id: toTableId` — passes the **related table UUID**.
  - In-code comments say: "This should be the workspace_id" and "This should be the workspace_id for the target table".

- **`trak/src/app/actions/tables/relation-actions.ts`** (used by the main relation UI flow):
  - Inserts into `table_relations` **do not** set `workspace_id` at all (only `from_table_id`, `from_field_id`, `from_row_id`, `to_table_id`, `to_row_id`).

So:

1. **If `table_relations.workspace_id` is a UUID referencing `workspaces(id)`:**  
   Then `relations.ts` is wrong: it stores **table IDs** in a column that should hold **workspace IDs**. That would break any RLS or queries that assume `workspace_id` is a workspace. `relation-actions.ts` would then be relying on the column being nullable or defaulted.

2. **If `table_relations.workspace_id` is intended to store a table ID (or is unused/legacy):**  
   Then the **comments** in `relations.ts` are wrong (they claim it "should be" the workspace_id).

To resolve the mismatch you need to:

- Confirm the actual **schema** of `table_relations` (column type, FK if any, nullable, default).
- Then either:
  - Fix `relations.ts` to set the real workspace ID (e.g. by resolving it from `tables.workspace_id` for the from/to table), or
  - Align the schema and comments with the current behavior (e.g. rename or repurpose the column, or drop it if unused).

No migration or code fix was applied; this file only records the finding.
