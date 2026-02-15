# Source Data Population and Assignee Population Fix

## Issue 1: Source data is inconsistently populated

### What should happen
When the workflow AI creates a table from existing workspace entities (tasks, timeline events, etc.), each table row should include source tracking metadata (`source_entity_type`, `source_entity_id`, `source_sync_mode`). This enables the UI to show a "snapshot" caption and a sync toggle button so users can push changes back to the source entity.

### What actually happens
The AI inconsistently includes source metadata. Sometimes it works, sometimes it doesn't. When it doesn't work, the table renders with the correct data but has no sync capability.

### Root Cause

The source tracking relies on two layers, and both are failing:

**Layer 1 — LLM compliance (unreliable):** The system prompt (`trak/src/lib/ai/system-prompt.ts` lines 546-552) tells the AI to include `source_entity_type`, `source_entity_id`, and `source_sync_mode` on every row object when creating tables from search results. But LLMs are non-deterministic — the AI sometimes follows this instruction and sometimes doesn't.

**Layer 2 — Annotation fallback (too narrow):** When the AI doesn't include source metadata, the `annotateRowsWithSourceMetadata` function in `trak/src/lib/ai/tool-executor.ts` (lines 4908-4966) tries to detect source entity IDs automatically. However, the detection function `extractSourceCandidateIdFromRow` (line 5060) only looks for **specific field key names** in `row.data`:

```typescript
const candidateKeys = [
 { keys: ["task_id", "taskid"], hintedType: "task" },
 { keys: ["timeline_event_id", "timelineeventid", "event_id", "eventid"], hintedType: "timeline_event" },
 { keys: ["source_id", "entity_id", "id"] },
];
```

The AI typically names columns things like "Task Name", "Status", "Priority" — none of which match these key names. So the annotation finds zero candidates, `hasSourceMetadata` stays `false` (line 2801-2803), and the code takes the RPC fast-path (line 2809) which creates the table without any source tracking.

**The branching logic in createTableFull (lines 2809-2847):**
```typescript
if (!hasSourceMetadata) {
 // RPC fast-path — only taken when NO source metadata was detected
 const rpcResult = await createTableFullRpc({ ... });
 // Table created successfully but with NO source tracking
} else {
 // Slow path — createTable → bulkCreateFields → bulkInsertRows
 // This path DOES handle source metadata via bulkInsertRows
}
```

The RPC path is only entered when `hasSourceMetadata` is false. Even though a migration was added to support source metadata in the RPC, the RPC is only called when there's no source metadata to pass — so the migration has no effect.

### Planned Fix: Search Result Context Tracking + Title Matching

Instead of relying on the LLM to include source metadata or trying to find entity IDs by field key names, we will **track search results in the executor context** and use them to automatically annotate rows when `createTableFull` is called.

**Why this approach:**
- It's deterministic — doesn't depend on LLM behavior
- It naturally distinguishes source-derived tables from new/unrelated tables (only matches against entities returned in the current session)
- It's entity-type agnostic — works for tasks, timeline events, and any future entity types
- The executor already partially tracks search results (see `executor.ts` line 1606-1612 where `lastSearchTaskIds` is stored)

---

## Issue 2: Assignee truncation

**1 file changed**

- **executor.ts:163:** Changed `TOOL_RESULT_MAX_DEPTH` from 3 to 4 so assignee/tag objects (`{ id, name }` at depth 3) are no longer truncated to `"[truncated_object]"`

---

## Issue 1 (Source data) — Implementation summary

**4 files changed**

**Deterministic layer (catches what the LLM misses):**

- **tool-executor.ts:228:** Added `searchedEntities` field to `ToolExecutionContext`
- **executor.ts:1239:** Added `searchedEntities` array to track entities from `searchTasks`, `searchTimelineEvents`, and `searchSubtasks` results (both streaming and non-streaming paths)
- **executor.ts:1499:** Passed `searchedEntities` through all `executeTool` call sites (both execution paths)
- **tool-executor.ts:5073-5078:** Enhanced `extractSourceCandidateIdFromRow` with UUID value scanning fallback
- **tool-executor.ts:4908-4996:** Enhanced `annotateRowsWithSourceMetadata` with:
  - Accepts `searchedEntities` parameter
  - Pass 1: Existing key-name + new UUID fallback matching
  - Pass 2: Title matching against searched entities (case-insensitive, exact match)
- **tool-executor.ts:2795-2800:** `createTableFull` handler passes `searchedEntities` to annotation
- **tool-executor.ts:4893-4906:** `annotateRowsWithSourceMetadataForTable` (used by `bulkInsertRows`) also accepts and passes through `searchedEntities`

**LLM layer (helps the AI get it right the first time):**

- **executor.ts:** Injected SOURCE TRACKING REMINDER into search tool result messages for both streaming and non-streaming paths
- **system-prompt.ts:546-582:** Expanded source tracking instructions with step-by-step HOW-TO and a concrete example showing how to match rows to search results by title
- **tool-definitions.ts:1173:** Updated `createTableFull` tool description with explicit instructions to match rows to search results by title

---

## Log summary

**executor.ts (search tracking + LLM layer):**

- `sourceTracking:entitiesTracked` / `sourceTracking:entitiesTracked:stream` — logged when entities are captured from search results. Shows tool name, count of new entities, total tracked, and titles.
- `sourceTracking:llmReminderInjected` / `sourceTracking:llmReminderInjected:stream` — logged when the source tracking reminder is appended to a search tool result for the LLM. Shows tool name, result count, and total tracked entities.

**tool-executor.ts (deterministic layer):**

- `sourceTracking:annotateStart` — logged at the start of annotation. Shows total rows, how many the LLM already provided source metadata on, candidate IDs found, and searched entities available.
- `sourceTracking:dbValidation` — logged after DB validation. Shows valid task IDs, timeline IDs, and title map entries.
- `sourceTracking:deterministicMatch` — logged per-row when the deterministic layer matches. Shows method ("key/uuid" or "title"), the matched entity ID/type, and (for title matches) the matched title string.
- `sourceTracking:annotateResult` — logged at the end. Shows final breakdown: total rows, LLM-provided, deterministic key matches, deterministic title matches, and unmatched rows.
- `sourceTracking:llmAnnotation` log will show:
  - **llmProvided** — how many rows the LLM included source metadata on
  - **llmValid** — how many of those actually exist in the DB (i.e., the LLM got it right)
  - **llmInvalid** — how many the LLM claimed but were bogus (hallucinated IDs or wrong workspace)
