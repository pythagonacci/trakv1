# Deterministic Prompt-to-Action Layer

## Overview
This change adds a deterministic parsing layer that can execute a subset of Prompt-to-Action commands without any LLM calls. The goal is to safely handle straightforward commands with high confidence, reduce latency, and fall back to the LLM when ambiguity or complexity is detected.

Key design principles:
- Deterministic execution is conservative: only run on high-confidence parses.
- Ambiguity or multi-step intent triggers an LLM fallback.
- Parsing prioritizes correctness over coverage.

## What was added/changed

### New parser module
- File: `src/lib/ai/deterministic-parser.ts`
- This is a pure parser (no server actions). It analyzes text, assigns confidence, and returns a plan of tool calls.

Core features:
- Normalization and tokenization with polite-word stripping.
- Fuzzy matching (Levenshtein) for typos.
- Synonym and alias dictionaries for action/entity detection.
- Confidence scoring with penalties for fuzzy entity matches.
- Tie-breaking and confidence margin gating for ambiguous parses.
- Explicit extraction of parameters (dates, tags, assignees, etc.).
- Conservative fallback when uncertain.

### Fast-path execution wrapper
- File: `src/lib/ai/simple-commands.ts`
- Now acts as a thin executor for `parseDeterministicCommand`.
- Executes tool calls via `executeTool` and returns a response without LLM.
- Injects `tableId` into `bulkCreateFields` after `createTable` using the create result.
- Exports `parseDeterministicCommand` for testing and reuse.

### Executor integration
- File: `src/lib/ai/executor.ts`
- Uses `tryDeterministicCommand` (same slot as the previous simple fast path) before any LLM call.

### Tests
- File: `src/lib/ai/test-deterministic-layer.ts`
- Server-side test harness that calls `parseDeterministicCommand` directly to validate parse correctness.
- Uses a fixed date (`2026-02-03`) to validate date parsing.
- Validates tool name and a subset of expected arguments per test case.

## Supported operations (deterministic)

### Search (read-only)
- `searchTasks`
- `searchProjects`
- `searchTables`
- `searchDocs`
- `searchFiles`
- `searchClients`
- `searchTags`
- `searchTabs`
- `searchBlocks`
- `searchTimelineEvents`
- `searchAll`

### Create
- `createTaskItem`
- `createProject`
- `createTable`
- `bulkCreateFields` (only as part of “create table with columns”)
- `createDoc`
- `createClient`
- `createTab`

## Not supported deterministically
- Updates, deletes, bulk updates, or any destructive actions.
- Multi-step commands (e.g., “create X and assign Y then tag Z”).
- Ambiguous commands where multiple tool intents score too closely.

## How parsing works

### 1) Normalization
- Removes trailing polite words.
- Strips terminal punctuation.
- Lowercases and removes non-alphanumeric symbols (except apostrophes).
- Removes quoted text from the signal scan so titles do not bias intent detection.

### 2) Action and entity detection
- Uses synonym tables for actions (search/create/update) and entities (task/project/table/etc.).
- Exact term matches score highest.
- Fuzzy matches use Levenshtein distance for typo tolerance.
- Fuzzy entity matches are penalized to avoid false positives for short/ambiguous entities (e.g., “tab” vs “tag”).

### 3) Parameter extraction
- Titles: prefers quoted text, then “named/called/titled”, then trailing text after entity.
- Assignees: “assigned to ...”
- Tags: “tagged ...”
- Priority and status from synonym dictionaries.
- Dates: ISO YYYY-MM-DD and relative phrases (today/tomorrow/yesterday/next week/this week/next month), including common typos (e.g., “tommorow”).

### 4) Confidence scoring
- Weighted mix of action score, entity score, and argument strength.
- Bonus for specificity (filters on searches, “table with columns” patterns, etc.).
- Minimum threshold: `AI_DETERMINISTIC_MIN_CONFIDENCE` (default 0.82).
- Ambiguity margin: `AI_DETERMINISTIC_CONFIDENCE_MARGIN` (default 0.06).
  - If the top two candidates are too close, we abstain.
  - If the top candidate is more specific (more tool calls), we accept it despite the margin.

## Deterministic parameter coverage (current)

### createTaskItem
- Required: `title`
- Parsed parameters:
  - `dueDate` (absolute or relative)
  - `assignees` (from “assigned to ...”)
  - `tags` (from “tagged ...”)
  - `status`
  - `priority`

### createProject
- Required: `name`
- Parsed parameters:
  - `status`
  - `dueDate`
  - `projectType`

### createTable + bulkCreateFields
- Required: `title` (table name)
- Parsed parameters:
  - `fields` derived from column list
  - Field type inference from column names (status/priority/date/email/url/number/etc.)

### createDoc
- Required: `title`

### createClient
- Required: `name`
- Parsed parameters:
  - `email`
  - `phone`
  - `website`

### createTab
- Required: `name`
- `projectId` from context (`currentProjectId`)

## Test methodology

### Scope
- Tests validate parsing output (tool selection + partial args) without invoking server actions.
- This keeps tests fast and deterministic while verifying the parsing layer.

### Test command diversity
- Includes varied phrasing, typos, and parameter placement.
- Includes explicit abstain cases (updates, deletes, multi-step commands).

### Test execution
Command:
```
node -e "require('jiti')(process.cwd())('./src/lib/ai/test-deterministic-layer.ts')"
```

### Results (latest run)
- Total cases: 39
- Executed: 35
- Correct: 35
- Abstained: 4
- False positives: 0
- False negatives: 0
- Accuracy: 89.7%
- Coverage: 89.7%
- Precision: 100.0%
- Avg confidence: 0.953

## Behavior notes
- If confidence is too low or two intents are too close, the command is handed off to the LLM.
- The deterministic layer intentionally avoids destructive operations to prevent unintended changes.
- Titles in quotes are not used for intent detection to reduce false entity hits.
- “Search” can be inferred even without explicit search verbs when the command starts with an entity (e.g., “tasks assigned to Amna”).

## Environment configuration
- `AI_DETERMINISTIC_MIN_CONFIDENCE` (default 0.82)
- `AI_DETERMINISTIC_CONFIDENCE_MARGIN` (default 0.06)

## Files touched
- `src/lib/ai/deterministic-parser.ts` (new)
- `src/lib/ai/simple-commands.ts` (rewritten to use parser + execute tools)
- `src/lib/ai/executor.ts` (fast-path uses deterministic layer)
- `src/lib/ai/test-deterministic-layer.ts` (tests for parsing accuracy)

## Limitations and next steps
- No deterministic updates or deletes yet.
- Parsing does not resolve entity IDs (intentionally left to server actions or LLM flow).
- Execution tests against live server actions are not included; adding those would require fixtures/test DB.

Potential follow-ups:
- Add deterministic support for single-field updates (e.g., “mark task done”) with strict confidence gates.
- Add telemetry for hit/abstain/fallback to tune thresholds from real usage.
- Expand the parser to more create flows (e.g., create table rows by name).
