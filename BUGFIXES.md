# Bug Fixes

## Fix 1: Deterministic Layer Incorrectly Handling Data Generation Requests

**Issue:** Commands like "create a table of the fifty states and their capitals" were being handled by the deterministic fast-path layer instead of the LLM, resulting in empty tables with just the phrase as the title instead of populated data.

**Fix:** Enhanced the `isLikelyRankedDataRequest()` function to detect when a table creation command requires actual data generation (descriptive content patterns, population keywords like "with all/the/some", and multi-data patterns with "and their/its") versus simple structural table creation.

**Files Modified:**
- `trak/src/lib/ai/deterministic-parser.ts` (lines 1123-1148)

---

## Fix 2: Infinite Loop from LLM Calling Tools with Empty Arguments

**Issue:** When the LLM correctly received data generation requests, it was calling `createTableFull` repeatedly with zero arguments (argCount: 0), causing an infinite loop of failed tool calls.

**Fix:** Added a circuit breaker that tracks empty-argument tool calls per tool name and stops execution after 2 consecutive calls with empty arguments, plus improved error messages in `createTableFull` to explicitly indicate which required parameters are missing and how to obtain them.

**Files Modified:**
- `trak/src/lib/ai/executor.ts` (lines 905-907, 1099-1113)
- `trak/src/lib/ai/tool-executor.ts` (lines 2452-2475)

---

## Fix 4: Removed Deterministic Chart Detection Layer

**Issue:** The deterministic chart detection layer was incorrectly triggering chart creation for commands containing words like "pie" (as in "Chicken Pot Pie") or "bar" because the `detectChartIntent()` function used overly broad regex patterns that matched chart type keywords anywhere in the text and ran before the LLM could perform semantic analysis.

**Fix:** Removed the entire deterministic chart detection layer (~150 lines) so all chart creation is now handled by the LLM through the `createChartBlock` tool, ensuring proper semantic understanding and preventing false positives.

**Files Modified:**
- `trak/src/lib/ai/executor.ts`

---

## Fix 5: createTableFull Not Being Called in Workflow Context

**Issue:** The AI wasn't calling `createTableFull` in workflow contexts (resulting in no table creation and only text responses), caused by three issues: (1) the RPC function silently failed because it didn't accept NULL for optional parameters (`p_project_id` and `p_description`) but TypeScript was passing null, (2) the `tabId` parameter wasn't being auto-injected from context so tables were created in the database but no UI blocks were created, and (3) `createTableFull` was filtered out by the `narrowToolsForSingleAction` optimization which only allowed older individual tools like `createTable`, `bulkCreateFields`, and `bulkInsertRows`.

**Fix:** (1) Modified the SQL function signature to accept `DEFAULT NULL` for optional parameters and reordered parameters so required ones come first (PostgreSQL constraint), added `DROP FUNCTION IF EXISTS` to prevent overloading conflicts, and updated TypeScript to match the new parameter order; (2) auto-injected `currentTabId` from execution context when `tabId` is not explicitly provided; (3) added `createTableFull` to the `SINGLE_ACTION_TOOLS` allowlist for "create" + "table" actions.

**Files Modified:**
- `trak/supabase/migrations/20260206120000_fix_create_table_full_nullable_params.sql` (new migration)
- `trak/src/app/actions/tables/super-actions.ts` (lines 41-63: reordered RPC parameters and enhanced error logging)
- `trak/src/lib/ai/tool-executor.ts` (line 2479: auto-inject tabId from context)
- `trak/src/lib/ai/executor.ts` (line 556: added createTableFull to SINGLE_ACTION_TOOLS)

---

## Fix 3: AI-Generated Select Field Options Missing Unique IDs and Using Invalid Color Format

**Issue:** When the AI created tables with select-type fields (select, multi_select, status, priority), the generated field options had inconsistent ID formats (semantic IDs like "alcoholic" instead of unique IDs like "opt_1770418359736") and used color names ("red", "blue") instead of hex color codes ("#ef4444", "#3b82f6"). This caused three critical problems: (1) the UI's SelectCell component threw a React key error because `opt.id` was not in the expected format, (2) users could not manually update select field values in the UI because the dropdown options didn't match the stored data format, and (3) row data values couldn't be properly mapped to option IDs, resulting in empty cells or unmappable values.

**Root Causes:**
1. The `inferFieldTypeFromData()` function was generating option IDs using `normalizeOptionId(raw)` which produced semantic slugs like "alcoholic", "non-alcoholic" (lowercase with dashes) instead of unique timestamp-based IDs
2. Color names ("red", "blue") were stored directly instead of being converted to hex codes that match the UI's color palette
3. **CRITICAL:** When the AI directly provided field configs with options in the `createTableFull` call (e.g., `{ options: [{ label: "Alcoholic", color: "red" }] }`), the `hasUsableFieldConfig()` validation only checked if options existed (`options.length > 0`), not whether they had proper IDs and hex colors, so invalid configs bypassed the `inferFieldTypeFromData()` fix entirely

**Initial Approach (Failed):**
First attempted to fix only the data inference path by updating `inferFieldTypeFromData()` to generate proper IDs and hex colors. Added `colorNameToHex()` helper and replaced `normalizeOptionId()` with `generateOptionId()` in all 6 option generation code paths. **This failed because** when the AI directly provided field configs with options (even in invalid format), `hasUsableFieldConfig()` returned true if `options.length > 0`, causing the system to skip `inferFieldTypeFromData()` entirely and accept the invalid config as-is.

**Working Fix:**
1. Added `colorNameToHex()` helper function that maps color names to the exact hex codes used by the UI's color palette (matching the `randomColor()` function in [select-cell.tsx:19-22](trak/src/components/tables/cells/select-cell.tsx#L19-L22))
2. **Enhanced `hasUsableFieldConfig()` validation** to verify that options have proper format: IDs starting with "opt_" and colors starting with "#". If validation fails, the config is marked as invalid and regenerated
3. **Added config normalization logic** in `inferFieldTypeFromData()` that detects when the AI provides options without proper IDs/colors and regenerates them with correct format by extracting labels and creating new options with proper IDs and hex colors
4. Updated all option generation code paths in `inferFieldTypeFromData()` to use the existing `generateOptionId()` function (which generates crypto-random or timestamp-based unique IDs like `opt_xxxxx`) instead of semantic IDs
5. Updated all color assignments to convert color names to hex codes using `colorNameToHex()`
6. Applied fixes to all field type generation paths: explicit select/multi_select, explicit priority, explicit status, priority detection by name, status detection by name, and auto-detected select fields

**Result:** AI-generated select field options now have the same format as manually-created options (unique IDs and hex colors), regardless of whether the AI infers the config from data or provides it directly. The UI correctly renders dropdowns, users can update values, and the system properly maps natural language values from the AI to option IDs for storage.

**Files Modified:**
- `trak/src/lib/ai/tool-executor.ts` (lines 3369-3720: added `colorNameToHex()` helper, enhanced `hasUsableFieldConfig()` validation to check ID and color format, added config normalization in `inferFieldTypeFromData()` to fix AI-provided invalid configs, and updated all option generation code to use `generateOptionId()` and hex colors)

---

## Fix 6: NULL Config Constraint Violation in createTableFull

**Issue:** The `createTableFull` RPC was failing with database error `null value in column "config" of relation "table_fields" violates not-null constraint`. When the AI called `createTableFull` with field definitions that didn't include a `config` property, the SQL function passed NULL to the `config` column, violating the NOT NULL constraint. This caused the RPC to fail and fall back to separate `bulkCreateFields` and `bulkInsertRows` tool calls, negating the performance benefits of the super tool.

**Root Cause:** In the SQL function at line 84, when inserting extra fields from `p_fields` parameter, the code used `v_field->'config'` which returns NULL if the JSONB object doesn't have a `config` key. The `table_fields.config` column has a NOT NULL constraint, so this caused the INSERT to fail.

**Why Previous Fixes Didn't Work:**
- **Circuit Breaker Fix** (Fix #2): Only addressed infinite loops from empty-argument tool calls, not the underlying database constraint violation
- **Parameter Reordering** (Fix #5): Fixed NULL handling for `p_project_id` and `p_description` parameters, but didn't address NULL config values in field definitions
- **Column Disambiguation** (attempted): Added table aliases to WHERE clauses, but the actual issue was the NULL value being inserted, not a column reference ambiguity

**Fix:** Modified the SQL function to use `COALESCE(v_field->'config', '{}'::jsonb)` when inserting field config, defaulting to an empty JSON object when the config property is missing. Also explicitly added `config` column to default fields INSERT with `'{}'::jsonb` value for consistency.

**Files Modified:**
- `trak/supabase/migrations/20260206140000_fix_create_table_full_config_null.sql` (new migration, lines 80 and 48)

---

## Fix 7: Workflow Read-Only Mode Blocking Table Creation

**Issue:** In workflow contexts, the AI was not calling `createTableFull` at all (no tool calls whatsoever, just returning text responses). Debug logs showed intent classification succeeded (`actions: ['create']`, `toolGroups: ['core', 'table']`, `confidence: 0.95`) but the LLM stream completed without any tool execution attempts.

**Root Cause:** The `isExplicitEntityMutationCommand()` function in workflow-executor.ts used a regex pattern `/\b(project|client|tab|document|doc|file|folder|workspace)\b/` that did NOT include "table". When users said "Create a table...", the function returned false, causing:
1. `allowEntityMutations = false`
2. `readOnly = true` (because `!(allowTaskMutations || allowEntityMutations)`)
3. The LLM received a restrictive system prompt emphasizing "Use search/analysis tools and create display blocks only"
4. Even though `createTableFull` was in the `allowedWriteTools` list (and would execute if called), the restrictive prompt caused the LLM to avoid calling ANY write tools

**Why This Was Missed:** The function correctly identified mutations for other entity types (project, client, tab, etc.) but "table" was never added to the entity regex pattern, treating table creation as a read-only operation.

**Fix:** Added "table" to the entity regex pattern: `/\b(table|project|client|tab|document|doc|file|folder|workspace)\b/`. Now "Create a table..." commands are properly recognized as entity mutations, setting `readOnly = false` and allowing the LLM to call table creation tools.

**Files Modified:**
- `trak/src/lib/ai/workflow-executor.ts` (line 98: added "table" to entity regex in `isExplicitEntityMutationCommand`)

---

## Fix 8: Default Columns Created Alongside LLM-Specified Columns

**Issue:** When the LLM called `createTableFull` with custom field definitions, the SQL function created both the 3 default columns ("Name", "Column 2", "Column 3") AND the LLM's custom columns, resulting in tables with blank default columns that were never populated.

**Example:** LLM creates table with fields ["College", "State", "Type"] → UI shows 6 columns: "Name" (empty), "Column 2" (empty), "Column 3" (empty), "College", "State", "Type".

**Root Cause:** The SQL function always created default fields at the beginning, regardless of whether `p_fields` contained custom field definitions. The default fields were only skipped if they had duplicate names (case-insensitive match), but generic names like "Column 2" never matched the LLM's specific field names.

**Fix:** Added a check to only create default columns when no custom fields are provided:
1. Check if `p_fields` has any elements: `v_has_fields := jsonb_typeof(p_fields) = 'array' AND jsonb_array_length(p_fields) > 0`
2. Only create default 3 columns if `NOT v_has_fields`
3. When custom fields are provided, ensure the first field is always marked as primary (using `CASE WHEN v_fields_created = 0` to default to `true` for the first field)

**Result:** Tables now have exactly the number of columns the LLM specifies (2 fields → 2 columns, 5 fields → 5 columns), with the first field always set as primary and no orphaned blank columns.

**Files Modified:**
- `trak/supabase/migrations/20260206150000_fix_create_table_full_skip_defaults_when_fields_provided.sql` (new migration, lines 47-52 and 68-85)

---

## Fix 9: LLM Cannot Delete Tables (Only Rows and Fields)

**Issue:** When users asked to delete an entire table (e.g., "delete the Skincare Brands Only table"), the LLM correctly identified the intent (`actions: ['delete']`, entity `'table'`, confidence 0.89) but only responded with text confirmation without actually deleting the table. The table remained in the database.

**Root Cause:** The `SINGLE_ACTION_TOOLS` configuration for `delete` + `table` actions only included tools for deleting rows and fields:
```typescript
table: ["deleteRow", "deleteRows", "deleteField"]
```

The `deleteTable` tool exists and is properly defined in tool-definitions.ts, but it was missing from the allowed tools list. When the LLM's tool set was narrowed for "delete table" intents, it didn't have access to `deleteTable`, so it could only acknowledge the request in text without executing the deletion.

**Fix:** Added `deleteTable` to the allowed tools lists:
1. Added to `SINGLE_ACTION_TOOLS` delete.table list in executor.ts: `["deleteTable", "deleteRow", "deleteRows", "deleteField"]`
2. Added to workflow `allowedWriteTools` in workflow-executor.ts (both streaming and non-streaming paths) for consistency

**Result:** The LLM can now delete entire tables when requested. Commands like "delete the table" or "remove the old data table" will properly call the `deleteTable` tool and execute the deletion.

**Files Modified:**
- `trak/src/lib/ai/executor.ts` (line 589: added "deleteTable" to SINGLE_ACTION_TOOLS delete.table list)
- `trak/src/lib/ai/workflow-executor.ts` (lines 361 and 652: added "deleteTable" to allowedWriteTools in both execution paths)

---

## Fix 10: Conversational Responses Added as Text Blocks After Tool Execution

**Issue:** When the LLM performed actions like deleting a table, the conversational response (e.g., "I found the 'Skincare Brands Only' table and successfully deleted it...") was being added to the workflow page as a text block in addition to appearing in the chat. The fallback logic in workflow-executor.ts only checked if blocks were created (`createdBlockIds.length === 0`), not whether any tool calls were executed, so action confirmations were incorrectly persisted as page content.

**Root Cause:** The workflow page rendering guarantee at lines 493-507 and 811-823 created a text block for any assistant response when no blocks were created, regardless of whether the LLM had executed successful tool calls (like `deleteTable`, `updateTableFull`, etc.). This was intended as a fallback for pure conversational responses but incorrectly triggered for action confirmations.

**Fix:** Added a check for successful tool calls (`hadSuccessfulToolCall`) before creating the fallback text block. Now conversational responses only become text blocks when the LLM hasn't executed any actions—if any tool was successfully called, the response stays in the chat panel only.

**Files Modified:**
- `trak/src/lib/ai/workflow-executor.ts` (lines 493-499: added `hadSuccessfulToolCall` check in non-streaming execution)
- `trak/src/lib/ai/workflow-executor.ts` (lines 811-815: added `hadSuccessfulToolCall` check in streaming execution)

---

## Fix 11: Unstructured RAG Search Never Called in Read-Only Workflow Queries

**Issue:** For read-only workflow queries like "What is the list of skincare brands we have", the AI never successfully called `unstructuredSearchWorkspace` (the semantic RAG search tool) because the `isSearchLikeToolName()` function didn't include it in the allowed search tool patterns, causing read-only enforcement to block it as a "write tool", and the auto-fallback mechanism counted blocked attempts as "already ran" which suppressed the fallback.

**Fix:** Added `unstructuredSearchWorkspace` to `isSearchLikeToolName()` to allow it in read-only mode, updated the `unstructuredAlready` checks in both execution paths to only count successful executions (not blocked/failed attempts), and enhanced debug logging to show auto-fallback trigger conditions and skip reasons.

**Files Modified:**
- `trak/src/lib/ai/executor.ts` (lines 195-202: added unstructuredSearchWorkspace to isSearchLikeToolName)
- `trak/src/lib/ai/executor.ts` (lines 1186-1189, 1933-1935: fixed unstructuredAlready to only count successful executions)
- `trak/src/lib/ai/executor.ts` (lines 1204-1211, 1256-1270, 1951-1958, 2010-2024: enhanced debug logging for auto-fallback)

---

## Fix 12: Missing Circuit Breakers in Streaming Execution Path (Regression of Fix #2)

**Issue:** The `createTableFull` tool was being called repeatedly with empty arguments (argCount: 0) in workflow contexts, causing an infinite loop. This was a regression of Fix #2 — THREE circuit breakers that prevent infinite loops were only implemented in the non-streaming `executeAICommand` function, but not in the streaming `executeAICommandStream` function. Workflow pages use the streaming endpoint (`POST /api/workflow/stream`), so they bypassed all circuit breakers entirely.

**Root Cause:** The streaming function at line 1664 was missing three critical safety mechanisms:
1. **Empty argument circuit breaker**: Stops after first call with no arguments
2. **Consecutive error circuit breaker**: Stops after 3 consecutive failures of the same tool
3. **Tool repeat detector**: Stops after calling the same tool twice with identical arguments

**Fix:** Added all three circuit breakers from the non-streaming path to the streaming path:

1. **Tool Repeat Detector** (lines 1683-1684, 1902-1925):
   - Tracks tool signature (tool name + arguments) for each call
   - Stops execution if the same tool is called twice with identical arguments
   - Exempts search-like tools from this check (they may legitimately be called multiple times)

2. **Empty Argument Circuit Breaker** (line 1688, lines 1927-1948):
   - Detects when a tool is called with no arguments (`Object.keys(toolArgs).length === 0`)
   - Stops execution immediately on the first empty-argument failure
   - Returns helpful error message indicating missing context

3. **Consecutive Error Circuit Breaker** (line 1685, lines 1950-1967):
   - Tracks consecutive failures per tool name
   - Stops execution after 3 consecutive failures of the same tool
   - Resets counter when tool succeeds

**Result:** Workflow commands now have the same infinite loop protection as regular commands. All three circuit breakers work consistently in both streaming and non-streaming execution paths.

**Files Modified:**
- `trak/src/lib/ai/executor.ts` (lines 1683-1688: added all three circuit breaker tracking variables for streaming path)
- `trak/src/lib/ai/executor.ts` (lines 1902-1967: added all three circuit breaker checks after tool execution in streaming path)

---

## Fix 13: LLM Calling createTableFull with Empty Arguments for Data Generation Requests

**Issue:** When users requested tables with generated data (e.g., "create a table of cuisines and their dishes"), the LLM was calling `createTableFull` with zero arguments (argCount: 0), triggering the circuit breaker. The circuit breaker correctly prevented the infinite loop, but the user received an unhelpful error message instead of getting their table created.

**Root Cause:** The tool definition for `createTableFull` lacked a concrete JSON example showing the exact structure for `fields` and `rows` parameters. The system prompt referenced the outdated `bulkInsertRows` pattern instead of `createTableFull`, causing the LLM to be confused about how to structure data generation requests.

**Fix:** Enhanced tool documentation and system prompt to provide clear guidance on data generation:

1. **Added concrete JSON example to createTableFull definition** showing exact structure:
   - Example request: "Create a table of top 5 programming languages and their creators"
   - Shows fields array with name/type structure: `[{ name: 'Language', type: 'text' }]`
   - Shows rows array with data objects: `[{ data: { 'Language': 'Python', 'Creator': 'Guido van Rossum' } }]`

2. **Updated system prompt** to reference createTableFull for data generation:
   - Changed from "use bulkInsertRows" to "use createTableFull with fields AND rows in one call"
   - Added explicit DO/DON'T examples for common data generation requests
   - Added example matching user's query type: "Create a table of cuisines and their dishes"

3. **Added JSON parse error logging** to help debug future argument issues:
   - Logs raw arguments string when JSON.parse fails
   - Shows parse error message for debugging

**Result:** LLM now understands how to structure createTableFull calls with generated data. When users request tables like "all cuisines and their dishes", the LLM generates the data from its knowledge and properly formats it as fields + rows.

**Files Modified:**
- `trak/src/lib/ai/tool-definitions.ts` (lines 1027-1041: added concrete JSON example with fields and rows structure)
- `trak/src/lib/ai/system-prompt.ts` (lines 37-51: updated to reference createTableFull and added data generation examples)
- `trak/src/lib/ai/executor.ts` (both streaming and non-streaming paths: added JSON parse error logging for debugging)

---

## Fix 14: JSON Truncation When LLM Generates Large Datasets

**Issue:** When users requested tables with many rows (e.g., "create a table of cuisines and their dishes"), the LLM correctly understood the request and generated proper arguments with fields and rows, but the JSON response was truncated mid-string due to token limits, causing a parse error: `Unterminated string in JSON at position 1357`. This triggered the circuit breaker with an unhelpful error message.

**Root Cause:** The `TOOL_CALL_MAX_TOKENS` limit was set to 512 tokens, which is too small for generating tables with multiple rows of data. When the LLM tried to generate 7+ rows with descriptions, the response exceeded the token limit and was cut off mid-JSON, creating invalid JSON that failed to parse.

**Fix:** Implemented a three-part solution to handle large dataset generation:

1. **Increased token limit** from 512 to 2048 tokens (4x increase):
   - Allows ~30-50 rows depending on field complexity
   - Balances between capability and cost/latency

2. **Added smart truncation detection and retry**:
   - Detects "unterminated string" and "unexpected end" errors in JSON parse
   - On first iteration with createTableFull, returns helpful error asking LLM to retry with fewer rows
   - Error message: "Please try again with FEWER rows (5-10 rows maximum)"
   - Allows LLM to self-correct by generating a smaller dataset

3. **Added proactive guidance in tool definition**:
   - Added warning: "⚠️ ROW LIMIT: Generate 10-15 rows maximum in a single call"
   - Guides LLM to create representative samples instead of exhaustive datasets
   - Prevents truncation before it happens

**Result:** LLM can now generate tables with 10-15 rows reliably. If it tries to generate too many rows and hits truncation, it automatically retries with a smaller dataset. Users get working tables instead of error messages.

**Files Modified:**
- `trak/src/lib/ai/executor.ts` (line 126: increased TOOL_CALL_MAX_TOKENS from 512 to 2048)
- `trak/src/lib/ai/executor.ts` (lines 946-961, 1853-1873: added truncation detection and retry logic in both execution paths)
- `trak/src/lib/ai/tool-definitions.ts` (line 1043: added ROW LIMIT guidance to prevent truncation)

---

## Fix 15: LLM Not Inferring Context from Failed Previous Attempts

**Issue:** When users made follow-up requests using words like "instead" (e.g., "create a table organized by Food item instead"), the LLM called `createTableFull` with zero arguments even though conversation history was passed correctly. The LLM failed to infer intent from failed previous attempts and returned unhelpful "I need more information" errors.

**Root Cause:** The system prompt didn't provide guidance on handling follow-up requests that reference failed previous operations. When the LLM saw "instead" but the referenced table didn't exist (because previous attempts failed), it didn't know it could infer the intent from the failed attempts and create what the user wanted.

**Fix:** Added explicit guidance to the system prompt for handling follow-up requests:

1. **Inference from failed attempts**: Told LLM it can and should infer intent from failed operations in conversation history
2. **Concrete example**: "After failing to create 'table of cuisines and dishes', if user says 'organized by food item instead', infer they want food items as rows with cuisine/category/description columns"
3. **Explicit instruction**: "Don't fail with 'I need more information' - use your knowledge to fill in gaps"
4. **Critical rule**: "Even if previous attempts failed, you can infer intent and create what the user wants"

**Additional Enhancement:** Added logging to detect when LLM calls tools with empty arguments, capturing the raw arguments and assistant content for debugging.

**Result:** LLM now makes reasonable inferences from conversational context, even when previous attempts failed. Follow-up requests like "instead" or "modify" are handled intelligently.

**Files Modified:**
- `trak/src/lib/ai/system-prompt.ts` (lines 57-71: added "Handling Follow-Up Requests" section with inference guidance)
- `trak/src/lib/ai/executor.ts` (lines 1873-1882: added logging for empty argument detection)
