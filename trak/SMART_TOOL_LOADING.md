# Smart Tool Loading - Implementation Summary

## Overview

We've implemented an **intent-based smart tool loading system** that dramatically reduces token usage and improves P2A AI performance by only presenting tools relevant to each user command.

## The Problem

**Before:** All 68 tools were loaded into every AI request
- ~8,160 tokens for tool definitions alone
- Slower response times (more tokens to process)
- Higher costs per request
- AI confusion with too many options

**After:** Only 17-34 tools loaded based on command intent
- ~2,040-4,080 tokens for tool definitions
- **57-75% token reduction**
- Faster responses
- Clearer tool selection for AI

## How It Works

### 1. Intent Classification (`intent-classifier.ts`)

Analyzes user commands to determine which tool groups are needed:

```typescript
// Example: "search all tasks assigned to Amna"
const intent = classifyIntent(command);
// → { toolGroups: ["core"], confidence: 0.95 }
// Only loads 17 core search tools

// Example: "create a table of 50 US states"
const intent = classifyIntent(command);
// → { toolGroups: ["core", "table"], confidence: 0.95 }
// Loads 17 core + 12 table tools = 29 tools
```

### 2. Tool Organization (`tool-definitions.ts`)

Tools are organized into groups:

- **Core (17 tools)** - Always included
  - Cross-entity search (searchAll, resolveEntityByName, getEntityById)
  - Entity-specific searches (searchTasks, searchProjects, searchTables, etc.)
  - Read-only operations

- **Action Groups** - Included based on intent
  - **Task (9 tools)** - createTaskItem, updateTaskItem, setTaskAssignees, etc.
  - **Table (12 tools)** - createTable, bulkInsertRows, updateTableRowsByFieldNames, etc.
  - **Project (3 tools)** - createProject, updateProject, deleteProject
  - **Timeline (5 tools)** - createTimelineEvent, updateTimelineEvent, etc.
  - **Block (3 tools)** - createBlock, updateBlock, deleteBlock
  - **Tab (3 tools)** - createTab, updateTab, deleteTab
  - **Doc (4 tools)** - createDoc, updateDoc, archiveDoc, deleteDoc
  - **Client (3 tools)** - createClient, updateClient, deleteClient
  - **Property (5 tools)** - createPropertyDefinition, setEntityProperty, etc.
  - **Comment (3 tools)** - createComment, updateComment, deleteComment

### 3. Smart Detection Patterns

#### Special Patterns (High Priority)

```typescript
// Multi-action commands
"search tasks and create a table" → [core, table]
"organize states by priority" → [core, table]

// Entity creation with data
"create a table of 50 US states" → [core, table]
```

#### Entity Detection

Identifies mentioned entities:
```typescript
"task" → task group
"table" → table group
"project" (as main entity) → project group
"timeline" → timeline group
```

#### Action Detection

Identifies operation type:
```typescript
// Read-only → core only
"search", "find", "show", "list" → [core]

// Write operations → core + entity groups
"create", "add", "update", "delete" → [core, <entities>]
```

#### Context Filtering

Avoids false positives:
```typescript
"create tasks in the project timeline"
// Detects: task, timeline
// Filters out: "project" (just context, not actual project CRUD)
// Result: [core, task, timeline]
```

## Token Savings Analysis

### Real Examples

| Command | Groups | Tools Loaded | Token Reduction |
|---------|--------|--------------|-----------------|
| "search all tasks assigned to Amna" | core | 17/68 (25%) | 75% reduction |
| "create a table of 50 US states" | core, table | 29/68 (43%) | 57% reduction |
| "update all high priority tasks to done" | core, task | 26/68 (38%) | 62% reduction |

### Average Savings

- **Per request:** ~5,000 tokens saved on tool definitions
- **Multi-turn conversation:** Savings multiply across turns
- **Monthly at scale:** Significant cost reduction

## Testing

Run the test suite:

```bash
cd trak
npx tsx src/lib/ai/test-intent-classifier.ts
```

**Current Results:** ✨ 12/12 tests passing (100%)

## Implementation Files

1. **`intent-classifier.ts`** - Analyzes commands and determines tool groups
2. **`tool-definitions.ts`** - Organizes tools by group and provides `getToolsByGroups()`
3. **`executor.ts`** - Integrates smart loading into AI execution flow
4. **`test-intent-classifier.ts`** - Comprehensive test suite

## Integration with Executor

```typescript
// In executeAICommand() - executor.ts

// Before
const tools = toOpenAIFormat(allTools); // 68 tools, ~8,160 tokens

// After
const intent = classifyIntent(userCommand);
const relevantTools = getToolsByGroups(intent.toolGroups);
const tools = toOpenAIFormat(relevantTools); // 17-34 tools, ~2,040-4,080 tokens
```

## Benefits

### 1. Performance
- **Faster responses** - Less tokens to process
- **Lower latency** - Smaller payloads to AI providers
- **Better reliability** - Less likely to hit token limits

### 2. Cost
- **57-75% reduction** in tool definition tokens
- Savings scale with request volume
- ROI compounds in multi-turn conversations

### 3. Quality
- **Less confusion** - AI sees fewer irrelevant tools
- **Better selection** - Clearer context for tool choice
- **Fewer errors** - Less chance of using wrong tool

### 4. Maintainability
- **Easy to extend** - Add new groups as needed
- **Clear organization** - Tools grouped logically
- **Well-tested** - Comprehensive test coverage

## Future Enhancements

### Potential Improvements

1. **Dynamic Core Tools**
   - Adjust core set based on conversation context
   - Load fewer search tools if entities are already known

2. **Learning from Usage**
   - Track which tools are actually used
   - Optimize groups based on real patterns

3. **Progressive Loading**
   - Start with core only
   - Load additional groups if AI requests them

4. **Context Awareness**
   - Remember tools loaded in conversation
   - Avoid reloading same tools across turns

## Comparison to MCP Code Execution

This implementation gives us the **token efficiency benefits** of code execution without the complexity:

| Approach | Token Reduction | Implementation Complexity | Security Risk |
|----------|----------------|---------------------------|---------------|
| **Smart Tool Loading** (our approach) | 57-75% | Low | None |
| Code Execution (MCP article) | 85-95% | High (sandbox needed) | Medium-High |
| Traditional (all tools) | 0% | None | None |

**Our approach is the sweet spot:** Significant savings without operational overhead.

## Next Steps

1. ✅ Implement intent classifier
2. ✅ Organize tools by group
3. ✅ Integrate with executor
4. ✅ Add comprehensive tests
5. 🔄 Monitor performance in production
6. 🔄 Refine patterns based on usage
7. 🔄 Consider progressive loading for further optimization

## Resources

- [MCP + Code Execution Article](https://www.anthropic.com/research/building-effective-agents) - Inspiration for token optimization
- [`claude.md`](claude.md) - Original article text
- Test Suite: `src/lib/ai/test-intent-classifier.ts`
