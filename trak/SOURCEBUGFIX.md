# SOURCEBUGFIX

## Bug 1: LLM inconsistently populates source metadata on created entities

The AI frequently failed to include `source_entity_id`, `source_entity_type`, and `source_sync_mode` when creating table rows, tasks, or timeline events from search results. This was caused by the LLM having to manually match search result IDs to rows by title — a multi-step reasoning task that LLMs are unreliable at. We fixed this by injecting a `_source` object directly onto each search result item before sending it to the LLM (so it just has to copy rather than reason), and by replacing the soft reminder with a strict, non-negotiable 4-rule reminder — all in `executor.ts`.

## Bug 2: `searchEntitiesByProperties` results not covered by source tracking

When the AI found entities via `searchEntitiesByProperties` (e.g., filtering by tag or status), those results had no `_source` injection and were not tracked for the deterministic backfill safety net. This was caused by the source tracking system only covering `searchTasks`, `searchTimelineEvents`, and `searchSubtasks`. We fixed this by adding `searchEntitiesByProperties` to all source tracking paths — `_source` injection, entity tracking, and the strict reminder — with per-item entity type filtering that only applies to types that support source data columns (`task`, `timeline_event`, `table_row`) — in `executor.ts`.

## Bug 3: No visibility into whether the LLM actually passed source metadata

There was no way to see the exact source values the LLM included on each row before the deterministic backfill ran, making it impossible to tell if the LLM was compliant or if the backfill was doing all the work. This was caused by existing logs only showing aggregate counts, not per-row detail. We fixed this by adding a `sourceTracking:llmRawInput` debug log that fires before `annotateRowsWithSourceMetadata` in both `createTableFull` and `bulkInsertRows`, showing each row's title and source fields — in `tool-executor.ts`.

## Bug 4: `createTaskBoardFromTasks` creates an empty task block with no tasks

The `createTaskBoardFromTasks` tool created an empty task block — all tasks were "skipped" during duplication despite existing in the database. This was caused by the internal `createBlock` call missing `authContext`, resulting in the block being created under cookie-based auth while `duplicateTasksToBlock` used the correct `authContext`, leading to a workspace context mismatch. We fixed this by passing `authContext` to the `createBlock` call and adding the RPC-first path for duplication — in `tool-executor.ts`.

## Bug 5: `duplicateTasksToBlock` fails with `task_items_source_metadata_consistency` constraint violation

Both the RPC and fallback `duplicateTasksToBlock` paths failed to insert duplicated tasks, with the error `new row violates check constraint "task_items_source_metadata_consistency"`. This was caused by the code only setting the old `source_task_id` + `source_sync_mode` columns without the newer `source_entity_type` and `source_entity_id` columns that a later migration's CHECK constraint requires to all be set together or all be NULL. We fixed this by adding `source_entity_type: 'task'` and `source_entity_id: task.id` to the insert in both the fallback (`item-actions.ts`) and the RPC SQL function (new migration `20260216062500_fix_duplicate_tasks_rpc_source_metadata.sql`).

## Bug 6: `createTaskBoardFromTasks` defaults to board view instead of list view

The AI always rendered the new task block as a board/grouped view even when the user asked for a "task block" (list). This was caused by the tool name `createTaskBoardFromTasks` and its description both biasing the LLM to explicitly pass `viewMode: "board"`, and the executor defaulting to `"board"` when no viewMode was provided. We fixed this by changing the executor default to `"list"`, updating the tool description to emphasize list as default, and adding a warning to only pass `viewMode` when the user explicitly asks for a board/grouped view — in `tool-executor.ts` and `tool-definitions.ts`.
