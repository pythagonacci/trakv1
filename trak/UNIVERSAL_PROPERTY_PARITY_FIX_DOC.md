# Universal Property Parity Fix Document

## 1) Goal

Build a single, reliable property system where `entity_properties` is always consistent with:

- `task_items`
- `timeline_events`
- `table_rows`
- `task_subtasks`

and where live-linked entities (`source_sync_mode = "live"`) propagate changes in both directions with:

- correct values
- correct property type
- correct field name
- correct normalization between entity formats

This includes multi-field and multi-value behavior for all supported property families.

## 2) Non-Negotiable Invariants

### 2.1 Source of truth and parity

- A write to any canonical property surface must be reflected in `entity_properties`.
- Denormalized storage (`task_items`, `timeline_events`, `table_rows`) must be kept in sync from canonical property state.
- No silent drift is acceptable between read paths.

### 2.2 Live sync behavior

- If two entities are linked in `live` mode, edits on either side must fan out to the other.
- Sync must be loop-safe (no ping-pong), but not lossy.

### 2.3 Property identity safety

- Property updates must remain type-aware and field-aware.
- If there are multiple fields of the same type (example: two priority fields), updates must target the exact intended field.
- Rename operations must update field identity correctly without modifying sibling fields.

### 2.4 Normalization integrity

- Normalization should convert formats (task vs timeline vs table) without dropping intent.
- Any unavoidable format mismatch must have explicit deterministic mapping.

## 3) Why this matters

### 3.1 Product correctness

Users expect one property model, not multiple conflicting states depending on which screen/tool they used.

### 3.2 Sync predictability

Without strict parity, live sync appears unreliable and users lose trust in linked entities.

### 3.3 AI/tool safety

Internal tools and RPCs depend on normalized payloads. If they write one surface but not the other, downstream workflows become nondeterministic.

### 3.4 Data integrity over time

Small mismatches (field rename drift, single-assignee collapse, partial mirror logic) compound into hard-to-repair data divergence.

## 4) Current Gap Summary

## 4.1 Timeline parity gaps

- Timeline assignee canonicalization exists, but not all write paths keep `timeline_events` and `entity_properties` fully symmetric for all property families.
- Some flows still rely on compatibility scalar fields and can drop richer shape.

## 4.2 Table row mirroring gaps

- Table row writes do not consistently mirror all universal property types into `entity_properties`.
- Some paths mirror only status/priority while assignee/date/tags can drift.

## 4.3 Field rename propagation gaps

- Table field rename sync exists for `status` and `priority`.
- Equivalent rename parity for additional property families is not fully covered.
- Outside table-field rename flows, property-name edits do not always fan out using the same pipeline as value edits.

## 4.4 Property-menu fanout asymmetry

- Direct property edits via `setEntityProperties` can update source entities correctly but do not always trigger complete derived fanout behavior equivalent to main update actions.

## 4.5 Format-loss gaps in cross-entity bridges

- Multi-value assignee semantics can collapse to single values in some conversions (especially toward table person cells and legacy fields) unless explicitly preserved.

## 4.6 RPC and post-sync fragility

- Some RPC paths still rely on app-layer post-sync to finish parity.
- If post-sync fails/interruption occurs, cross-table parity can drift.

## 5) Fix Strategy

## 5.1 Unify property contract and adapters

- Keep canonical named arrays per property family.
- Use explicit adapters for each entity storage surface.
- Ensure adapters are reversible enough for live round-trip use.

### Required adapter behavior

- Preserve `field_name` exactly unless explicit rename event.
- Preserve `field_type` exactly.
- Preserve all values where target format supports them.
- When target format is narrower, write deterministic compatibility projection and retain canonical values.

## 5.2 Make property-name edits trigger full live fanout

- Treat property-name edits as first-class property mutations.
- Route them through the same fanout paths as value changes.
- Fanout payloads should carry full normalized arrays, not partial guessed deltas.

### Identity-safe rename rule

- Rename only the matched property entry by old name + property type.
- Leave sibling entries untouched even if same type.
- If old+new both exist on target, dedupe with deterministic merge rules.

## 5.3 Complete table row mirroring

- For row update flows (`updateCell`, `updateRow`, bulk row sync paths), mirror:
  - status
  - priority
  - assignee
  - due_date
  - tags
into `entity_properties` for `entity_type = "table_row"`.

### Mirroring discipline

- Same transaction boundary where practical.
- If not transactional, enforce best-effort retry and error telemetry.
- Never update row data without attempting property mirror.

## 5.4 Close timeline parity loop

- Ensure timeline server actions and property actions keep:
  - `timeline_events` canonical/compat fields
  - `entity_properties` timeline rows
in lockstep for supported property families.

### Required coverage

- create
- update
- duplicate
- live source writeback
- derived fanout

## 5.5 Eliminate single-value collapse where avoidable

- Preserve multi-assignee arrays through task/timeline/property flows.
- For narrow targets, apply deterministic primary projection while preserving canonical list elsewhere.

## 5.6 Harden RPC parity guarantees

- Ensure every RPC mutation either:
  - writes canonical parity internally, or
  - has guaranteed post-RPC parity sync with failure visibility and recovery path.

## 6) Detailed Work Items

1. **Property-name fanout parity**
   - Add rename-aware delta handling in `setEntityProperties` fanout logic.
   - Trigger same derived updates for name edits as value edits.

2. **Table row universal mirroring**
   - Extend row update paths to mirror all universal property families.
   - Centralize table-row mirror helper to avoid per-path drift.

3. **Timeline property symmetry**
   - Ensure timeline property updates from any path update both canonical event fields and `entity_properties`.
   - Confirm compatibility projection is deterministic.

4. **Cross-entity adapter hardening**
   - Normalize bridge logic task <-> timeline <-> table <-> subtask.
   - Prevent field-name loss and multi-value truncation.

5. **RPC and tool pathway audit closure**
   - Validate payload normalization for internal tools.
   - Ensure RPC wrappers cannot bypass parity.

## 7) Acceptance Criteria

The fix is complete when all criteria pass:

1. Editing a property name updates exact intended field only, and propagates to all live-derived entities.
2. Editing a property value behaves identically regardless of entry point (UI action, tool action, RPC path).
3. `entity_properties` matches denormalized tables for all supported property families.
4. Live source/derived round-trip preserves property type, field name, and normalized value shape.
5. Multiple fields of same type remain independently correct after rename/value edits.
6. No known sync path silently drops supported values.

## 8) Validation Plan

## 8.1 Scenario tests

- Task with two priority fields; rename one; verify only one renamed everywhere.
- Live task <-> timeline rename and value changes; verify bidirectional parity.
- Table row person/date/tags edits; verify row data and `entity_properties` parity.
- Subtask property updates propagated to timeline sub-events with field fidelity.

## 8.2 Consistency checks

- For each modified entity, compare canonical property payload and denormalized columns.
- Verify derived entities hold matching field-name/value pairs after fanout.

## 8.3 Failure-path checks

- Simulate partial failure after core write; validate parity recovery path or explicit error state.

## 9) Rollout and Safety

- Keep backward compatibility fields during migration period.
- Prefer dual-write + dual-read before removing legacy assumptions.
- Add clear logging for parity-sync failures and rename conflicts.
- Do not ship partial fanout behavior for name edits.

## 10) Final Principle

Every mutation must answer these questions deterministically:

1. Which exact property type changed?
2. Which exact field identity changed?
3. Which exact values changed?
4. Where must this be mirrored?
5. How is normalization applied without losing intent?

If any mutation path cannot answer all five, that path is incomplete and must be fixed.
