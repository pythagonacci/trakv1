# AI Prompts, Reminders & Tools Audit — Trak


**Purpose**: Audit all AI-facing content so it matches what the codebase actually expects and does. Align prompts, reminders, tool definitions, and injected instructions with real behavior. **Remove or update irrelevant and legacy content** so the AI isn’t guided by outdated rules or tools it doesn’t need.

---

## Goals

1. **Match prompts and tools to the codebase**  
   - System prompt, fast prompt, and any injected reminders must describe behavior that the executor and server actions actually support.  
   - Tool names, parameters, and descriptions must match what `tool-executor.ts` expects and what the underlying actions/RPCs accept.  
   - Enums and value examples in prompts (e.g. status, priority) must match types and normalization in the code (e.g. `in_progress` vs `in-progress`).

2. **Align “what the AI may feel it has to do” with reality**  
   - Instructions like “always do X” or “never do Y” should be checked: does the code enforce or support that? If the code allows something the prompt forbids (or vice versa), either fix the prompt or the code.  
   - Tool parameter descriptions that say “use X” or “get Y from tool Z” must be accurate: does tool Z actually return Y? Does the executor pass X correctly?

3. **Find and remove irrelevant/legacy content**  
   - Prompts or sections that reference features that no longer exist, deprecated workflows, or tools that have been removed or renamed.  
   - Tools that are in `tool-definitions.ts` but have no handler in `tool-executor.ts` (or are never exposed to the model).  
   - Tools that are implemented but redundant with a “super-tool” or bulk tool that the prompt already tells the AI to prefer.  
   - Reminders or decision trees that refer to old tool names, old parameter shapes, or obsolete behavior.  
   - Duplicate or contradictory instructions (e.g. two different rules for the same scenario).

---

## Scope: What to Audit

### 1. System prompt (`src/lib/ai/system-prompt.ts`)

- **TRAK_SYSTEM_PROMPT**  
  - Every decision tree, “use X not Y”, “ALWAYS/NEVER”, and step-by-step section: verify the referenced tools exist and behave as described.  
  - Status/priority values: prompt says e.g. “todo”, “in-progress”, “done” — does the executor/actions expect the same (or does the code normalize)? Align wording with `src/types/properties.ts` and any normalization in `tool-executor.ts` or `universal-property.ts`.  
  - “Super-tool” rules (createTableFull, updateTableRowsByFieldNames, bulkCreateTasks, etc.): confirm tool names and that the executor maps parameters as described.  
  - Source-tracking instructions (source_entity_type, source_entity_id, source_sync_mode): do the table/task/timeline creation paths actually accept and persist these? Do any RPCs or actions ignore them?  
  - Field-type rules (priority/status vs select): do createField and table APIs still use these types and configs as described?  
  - References to “task” vs “table row” vs “subtask”: match to actual entity types and which tools operate on which.

- **TRAK_FAST_ACTION_PROMPT**  
  - Same checks: tool names, parameter expectations, and any “use X” rules must match the executor.  
  - If fast mode is used in a different code path, confirm that path still gets the tools and context the prompt assumes.

- **getSystemPrompt() and context injection**  
  - Current context (workspaceId, currentProjectId, currentTabId, activeToolGroups): are these keys and semantics correct for how the executor and UI pass context?  
  - Optional sections (e.g. Shopify): are they still relevant and accurate?  
  - Any “active tool groups” wording: does it match how tools are actually grouped and requested (requestToolGroups, getToolsByGroups)?

- **CLARIFICATION_PROMPTS / RESPONSE_TEMPLATES**  
  - Where are they used? Do the placeholders and messages still match the flows that use them (e.g. write confirmation, missing params)?

### 2. Injected reminders and follow-ups (`src/lib/ai/executor.ts`)

- **After tool results**  
  - Source-tracking reminder (search tools): does it reference the correct tool names and payload shape (e.g. sourceId, sourceType)? Does getEntityById exist and accept those params?  
  - Unstructured-search follow-up reminder: is the “call getEntityById with sourceId/sourceType” instruction still correct?  
  - Table source-tracking reminder (when getEntityById returns a table): does it match how table creation with source metadata actually works?  
  - Subtask rendering reminders: do they match how searchTasks/searchSubtasks return subtasks and what the UI expects?  
  - “Continue updating remaining tasks” style prompts: are they still used and correct?

- **Post-round reminders**  
  - Any “you had search results, remember to propagate source data” style text: verify the create flows (createTableFull, createTaskItem, etc.) still accept and use that metadata.

- **Duplicate or conflicting reminders**  
  - Same rule stated in system prompt and again in an injected reminder: keep one source of truth or clearly split “always” vs “in this turn only”.  
  - Flag reminders that contradict the system prompt (e.g. different tool preference or value format).

### 3. Tool definitions (`src/lib/ai/tool-definitions.ts`)

- **Every tool in `allTools`**  
  - Is there a corresponding `case "toolName":` (or equivalent) in `tool-executor.ts`? If not, the tool is **dead** — either implement it or remove it from definitions.  
  - Do parameter names and types (including enums) match what the executor passes to the action/RPC? Check especially status/priority enums (e.g. tool says "in-progress", action expects "in_progress") and any optional/required split.  
  - Description text: “Returns X”, “Use when Y”, “Required: Z” — verify against executor return shape and actual behavior.  
  - requiredParams: must match what the executor and underlying action require; flag if the action allows optional but the tool marks it required (or vice versa).

- **Categories and grouping**  
  - toolsByCategory has a `payment` category (empty): remove or document.  
  - getToolsByGroups / ToolGroup: every group used in the app should have a matching set of tools; no group that’s requested but never populated.

- **Legacy or redundant tools**  
  - Tools that are superseded by a super-tool or bulk tool the prompt already mandates (e.g. an atomic create that the system prompt says “NEVER use”): consider removing from default set or marking as fallback-only.  
  - Deprecated parameter names or options in descriptions (e.g. old field types or status values).

### 4. Tool executor (`src/lib/ai/tool-executor.ts`)

- **Handlers for each tool**  
  - For each `case "toolName":`, confirm the tool exists in `allTools` and that the executor’s mapping (args → action/RPC payload) matches the tool’s parameter schema.  
  - Normalization: where the executor converts values (e.g. status hyphen to underscore, assignees by name to id), the tool definition and system prompt should describe inputs in a way that matches (or clearly state “values are normalized to X”).

- **Return shape**  
  - What the executor returns to the model (e.g. `{ data }` or `{ error }`) should match what the system prompt or tool descriptions say the tool returns.

### 5. Workflow executor and related prompts (`src/lib/ai/workflow-executor.ts`)

- **buildSearchHistoryContext / search-history reminder**  
  - The injected “SOURCE ID REFERENCE — PRIOR TURNS” text: does it match how the executor and createTableFull/createTaskItem expect source_entity_*?  
  - “Do NOT skip tool calls” and “do NOT treat this as substitute for tool use”: confirm the model still gets the right tools in workflow context.

- **Any other prompt or message built in workflow-executor**  
  - Verify wording and entity IDs/formats against the rest of the AI stack.

### 6. Other AI-facing files

- **deterministic-parser.ts / intent-classifier / simple-commands**  
  - If they expose behavior or options that the main prompt or tools contradict, flag.  
  - Any hardcoded strings (e.g. “in-progress” vs “in_progress”) should match the canonical format used in actions and types.

- **write-confirmation.ts**  
  - Prompts or messages shown to the user: consistent with system prompt and tool behavior (e.g. “about to create N tasks” when the tool is bulkCreateTasks).

- **slack-executor.ts** (if used)  
  - System prompt or tool set used there: same alignment as above; no Slack-only tools that don’t exist in definitions or executor.

### 7. Cross-cutting checks

- **Status and priority everywhere**  
  - Single source of truth: `src/types/properties.ts` (and table/timeline types).  
  - System prompt, tool-definitions enums, executor normalization, and reminders should all use the same canonical set (e.g. in_progress not in-progress in DB/types; prompt can say “in-progress” only if executor normalizes).  
  - List every place that mentions status/priority values and flag inconsistencies.

- **Tool names**  
  - Any prompt or reminder that says “call X” or “use X”: X must be exactly the tool name in tool-definitions and executor.  
  - Check for typos, renames (e.g. old name still in prompt), or “alias” wording that doesn’t exist.

- **Parameter and return contracts**  
  - “Tool A returns B which you pass to Tool C”: verify A’s return shape in executor and C’s parameter schema.  
  - “Get field IDs from getTableSchema”: confirm getTableSchema returns the structure the prompt implies.

---

## What to flag for removal or simplification

- **Legacy / obsolete**  
  - Instructions or decision trees for features that no longer exist.  
  - References to removed or renamed tools.  
  - Reminders about behavior that’s now default or no longer supported.  
  - Empty or unused categories (e.g. payment) or tool groups.

- **Redundant**  
  - Same rule in system prompt and in an injected reminder; same example repeated in multiple sections.  
  - Two tools that do the same thing where one is always preferred (consider removing the other from the default set or documenting “fallback only”).

- **Contradictory**  
  - Prompt says “always X”; code or another part of the prompt allows or does Y.  
  - Tool description says “returns A”; executor returns B.  
  - Status/priority in one place as “in-progress”, in another as “in_progress”, with no normalization documented.

- **Dead code**  
  - Tools in allTools with no executor case.  
  - Exported prompts or templates that nothing imports or uses.

---

## Output format

For each area (system prompt, fast prompt, context injection, executor-injected reminders, tool definitions, tool executor, workflow prompts, other files):

- **OK**: Matches codebase; no contradictions; no legacy/removal candidates.  
- **FIX**: Mismatch — describe what’s wrong and where (file + section or tool name). Suggest concrete change (e.g. “Change prompt to say in_progress” or “Add missing case for tool X in executor”).  
- **REMOVE / SIMPLIFY**: Irrelevant or legacy content — quote the exact text or tool and reason (e.g. “Tool not implemented”, “Duplicate of section Y”, “References removed feature Z”).  
- **ALIGN**: “AI may feel it has to do X” but code does Y — suggest either updating the prompt to match behavior or changing behavior and then the prompt.

Produce a short summary at the end: list of tools to remove or demote, list of prompt sections to remove or rewrite, and list of value/format alignments (e.g. status) to fix in one place.
