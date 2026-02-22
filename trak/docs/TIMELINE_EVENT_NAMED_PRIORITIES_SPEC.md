# Timeline Events Named Priorities Spec

## 1. Objective

Implement timeline-event priority behavior identical to the task named-priority rollout:

- Multiple priority fields per timeline event.
- Each priority field has its own `field_name` and one priority `value`.
- `timeline_events.priorities` and `entity_properties` stay in sync in both directions.
- All timeline UI surfaces render multiple priority pills as `Value · Field Name`.
- Source-linked/table-row flows preserve named priorities without collapsing to one canonical value.

This spec is additive and should be executed as a full vertical slice (DB + actions + sync + UI + AI/search).

## 2. Current State (Observed)

### 2.1 Already in place

- `timeline_events.priorities` exists and is used in parts of the timeline server actions.
- `event-actions.ts` accepts `priority` and `priorities` and writes `priorities`.
- `event-actions.ts` syncs priority rows into `entity_properties` (`field_type = 'priority'`).
- Global `PropertyMenu`/`PropertyBadges` already support named priorities for any entity type.

### 2.2 Gaps to close

- Timeline UI models still rely on single `priority` in key places (`timeline-view.tsx`).
- `getResolvedTimelineItems` does not pass `priorities` through.
- `entity-properties.ts` sync-back updates `task_items` but does not update `timeline_events` when timeline priority properties change.
- Table-row source sync (`tables/row-actions.ts`) maps timeline priority by generic `priority` only, not by named field.
- Bulk timeline duplicate path does not copy `priorities`.
- No timeline-specific JSONB validation guard equivalent to `is_valid_task_priorities(...)` + check constraint.
- AI/context reads for timeline events miss/underuse `priorities` in some selects.

## 3. Target Data Contract

### 3.1 Timeline priority payload

`timeline_events.priorities` is always:

```json
[
  { "field_name": "Priority", "value": "high" },
  { "field_name": "Execution Priority", "value": "urgent" }
]
```

Rules:

- `field_name`: non-empty string.
- `value`: one of `low | medium | high | urgent`.
- Case-insensitive uniqueness by `field_name`.
- Empty list `[]` means no priority.

### 3.2 Canonical priority

When a single priority is needed (grouping/filter fallback):

1. Use entry with `field_name` case-insensitive equal to `Priority`.
2. Else use first entry.
3. Else `null`.

### 3.3 UI label contract

Every displayed timeline priority pill uses:

- `"<Priority Label> · <Field Name>"`
- Example: `Urgent · Execution Priority`

## 4. Required Implementation Workstreams

## 4.1 DB guardrails and drift checks

Add migration(s):

1. `is_valid_timeline_priorities(jsonb)` validation function.
2. Data sanitization update for existing invalid rows.
3. `timeline_events_priorities_valid_check` constraint.
4. GIN index on `timeline_events.priorities`.
5. Update `set_edited_flag_on_timeline_event_update()` to include `status`, `priorities`, `assignee_id`, `progress`, `color`, `is_milestone`, and date/title/notes deltas.

Notes:

- This codebase already stores `timeline_events.priorities`; do not reintroduce/assume a `timeline_events.priority` column.
- Keep compatibility for existing rows with empty/legacy data by sanitizing before adding the check.

## 4.2 Shared timeline priority helper module

Create:

- `src/app/actions/timelines/priority-sync.ts`

Required helpers:

- `normalizeTimelinePriorityValue(value)`
- `normalizeTimelinePriorities(input)`
- `getCanonicalTimelinePriority(priorities)`
- `mergeTimelinePriorityField(existing, fieldName, value)` (for one-field updates)
- `filterTimelinePrioritiesToAllowedFieldNames(priorities, allowedFieldNames)`
- `syncTimelinePriorityFieldsToEntityProperties(supabase, eventId, workspaceId, priorities)`

This must be the single place for normalization/dedup/order semantics.

## 4.3 Timeline actions and query pipeline

### Files:

- `src/app/actions/timelines/event-actions.ts`
- `src/app/actions/timelines/bulk-actions.ts`
- `src/app/actions/timelines/query-actions.ts`

Required changes:

1. Replace local inline priority normalization in `event-actions.ts` with shared helper imports.
2. Ensure `createTimelineEvent`, `updateTimelineEvent`, `duplicateTimelineEvent` all preserve full named arrays and call shared sync helper.
3. `bulkDuplicateTimelineEvents` must copy `priorities` and sync entity properties for duplicated events.
4. `getTimelineItems` / `getResolvedTimelineItems` must include `priorities` and derived canonical `priority` in returned models.

## 4.4 Entity-properties sync-back for timeline events

### File:

- `src/app/actions/entity-properties.ts`

Required changes:

When `setEntityProperties(...)` is called for `entity_type = 'timeline_event'` and `updates.priority` or `updates.priorities` is present:

1. Build normalized named priorities from entity properties.
2. Write them to `timeline_events.priorities`.
3. Maintain canonical `priority` only as derived runtime value (not DB column).
4. Do not collapse named priorities into one row.

This mirrors task sync-back behavior and prevents property-menu edits from diverging from `timeline_events`.

## 4.5 Table-row source sync and reverse sync

### File:

- `src/app/actions/tables/row-actions.ts`

Required changes:

1. `mapTimelineUpdateFromField(...)`:
   - For priority fields, map to named priority update keyed by table field name, not only canonical `priority`.
2. When pushing edited snapshot rows to source timeline events:
   - Merge each changed priority field into `event.priorities` by `field_name`.
3. `mapTimelineEventFieldToRowValue(...)`:
   - For each priority-type table field, fetch matching timeline priority by field name.
   - Only fallback to canonical when explicitly configured (default: no implicit fallback).
4. Refresh flows should round-trip all named priority fields without overwriting siblings.

## 4.6 Timeline UI updates (display + edit behavior)

### File:

- `src/components/timelines/timeline-view.tsx`

Required changes:

1. Timeline local event model includes `priorities` (array), not only single `priority`.
2. Event list/tooltip/details sections render multiple priority pills from normalized named priorities.
3. Priority badge rendering format: `Value · Field Name`.
4. Editing from details panel must not overwrite all named priorities with a single canonical value unless user explicitly chooses canonical-only update.
5. “Manage properties” opens `PropertyMenu`; after save, timeline view reflects all priority fields immediately.

Recommended behavior for single dropdowns that still exist:

- Treat dropdown as canonical `Priority` editor only.
- Apply via merge helper to canonical field name (`Priority`) without deleting other named fields.

## 4.7 AI/search/context/tooling consistency

### Files:

- `src/app/actions/ai-context.ts`
- `src/app/actions/ai-search.ts`
- `src/lib/ai/tool-executor.ts`
- `src/app/actions/everything-view.ts`

Required changes:

1. Ensure timeline selects include `priorities` where event payload is materialized.
2. Canonical priority extraction for filtering/grouping should derive from `priorities`.
3. Tool executor should accept optional `priorities` for timeline create/update, with backward compatibility for single `priority`.
4. No path should assume `timeline_events.priority` column exists.

## 4.8 Type updates

### File:

- `src/types/timeline.ts`

Required changes:

1. Keep `priorities: TimelineNamedPriority[]` as primary data shape.
2. Add exported helper `getCanonicalTimelinePriority(...)` in types or shared helper module.
3. Keep optional deprecated `priority` as derived convenience at boundaries only.

## 5. RPC and DB-function policy

Timeline event writes are currently app-action based (not RPC-first).

Required:

1. Audit DB for timeline functions referencing old single-priority semantics.
2. If any timeline RPCs/functions exist now or are added later, they must accept/write `p_priorities jsonb` and preserve named entries.

Audit SQL:

```sql
select
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ilike '%timeline_events%'
  and pg_get_functiondef(p.oid) ilike '%priority%';
```

## 6. Acceptance Criteria

All must pass:

1. Creating a timeline event from a table row with 2+ priority fields stores all named priorities in `timeline_events.priorities`.
2. Matching `entity_properties` rows are present for every named timeline priority (`field_type='priority'`, correct `field_name`).
3. Timeline event UI shows all priority pills as `Value · Field Name`.
4. Property menu edits update both stores (`entity_properties` and `timeline_events.priorities`) without losing sibling fields.
5. Editing one named priority from table-row snapshot sync does not overwrite other named priorities.
6. Duplicate timeline event preserves named priorities.
7. Search/context/tool payloads expose correct canonical priority derived from `priorities`.
8. No query/function path references non-existent `timeline_events.priority` DB column.

## 7. Verification SQL Pack

### 7.1 Spot-check timeline priority rows

```sql
select id, title, priorities
from timeline_events
where jsonb_array_length(coalesce(priorities, '[]'::jsonb)) > 1
order by updated_at desc
limit 20;
```

### 7.2 Verify entity_properties mirror

```sql
select
  ep.entity_id,
  ep.field_name,
  ep.value,
  ep.updated_at
from entity_properties ep
where ep.entity_type = 'timeline_event'
  and ep.field_type = 'priority'
order by ep.updated_at desc
limit 100;
```

### 7.3 Detect invalid timeline priorities payloads

```sql
select id, priorities
from timeline_events
where not public.is_valid_timeline_priorities(priorities)
limit 50;
```

### 7.4 Detect stale function references

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ilike '%timeline_events.priority%';
```

## 8. Rollout Order

1. Merge helper module + types.
2. Merge DB validation/trigger migration.
3. Update timeline actions/query pipeline.
4. Add entity-properties sync-back for timeline events.
5. Update table-row sync mappings.
6. Update timeline UI rendering/edit merge semantics.
7. Update AI/context/search/tool boundaries.
8. Run acceptance checklist + SQL pack.

## 9. Non-goals

- Redesigning timeline visual style.
- Changing status semantics.
- Reworking unrelated task/table flows outside timeline-priority paths.
