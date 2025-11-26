# Trak Data Architecture & Storage Overview

## Application Overview

Trak is a project management and collaboration platform built with Next.js, React, TypeScript, and Supabase (PostgreSQL). It enables teams to organize projects, manage tasks, create documents, and collaborate within workspaces.

## Data Hierarchy

The data in Trak follows a hierarchical structure:

```
Workspace (Top Level)
  ├── Projects (can be 'project' or 'internal' type)
  │   ├── Tabs (can be nested with parent_tab_id)
  │   │   ├── Blocks (different types stored in single table)
  │   │   │   ├── Task Blocks (contain array of Task objects)
  │   │   │   ├── Text Blocks (markdown content)
  │   │   │   ├── File/Image/Video Blocks
  │   │   │   └── Other block types...
  │   │   └── Child Tabs (hierarchical)
  │   └── Client (optional relationship)
  ├── Documents (standalone, not in projects)
  ├── Clients
  └── Workspace Members (users with roles: owner, admin, teammate)
```

## Database Schema & Tables

### Core Tables

**1. `workspaces`**
- `id` (UUID, primary key)
- `name` (string)
- `owner_id` (UUID, foreign key to auth.users)
- `created_at`, `updated_at` (timestamps)

**2. `workspace_members`**
- `id` (UUID, primary key)
- `workspace_id` (UUID, foreign key to workspaces)
- `user_id` (UUID, foreign key to auth.users)
- `role` (enum: 'owner', 'admin', 'teammate')
- `created_at` (timestamp)

**3. `clients`**
- `id` (UUID, primary key)
- `workspace_id` (UUID, foreign key to workspaces)
- `name` (string)
- `company` (string, optional)
- `notes` (text, optional)
- `created_at`, `updated_at` (timestamps)

**4. `projects`**
- `id` (UUID, primary key)
- `workspace_id` (UUID, foreign key to workspaces)
- `name` (string)
- `project_type` (enum: 'project' | 'internal')
- `client_id` (UUID, nullable, foreign key to clients)
- `status` (enum: 'not_started' | 'in_progress' | 'complete')
- `due_date_date` (date, nullable)
- `due_date_text` (text, nullable)
- `client_page_enabled` (boolean)
- `public_token` (UUID, nullable, for client sharing)
- `created_at`, `updated_at` (timestamps)

**5. `tabs`**
- `id` (UUID, primary key)
- `project_id` (UUID, foreign key to projects)
- `parent_tab_id` (UUID, nullable, self-referential for nested tabs)
- `name` (string)
- `position` (integer, for ordering)
- `client_visible` (boolean, for client page access control)
- `created_at`, `updated_at` (timestamps)

**6. `blocks`**
- `id` (UUID, primary key)
- `tab_id` (UUID, foreign key to tabs)
- `parent_block_id` (UUID, nullable, for nested blocks like sections)
- `type` (enum: "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "video" | "image" | "embed" | "pdf" | "section" | "doc_reference")
- `content` (JSONB) - **Critical: This is where all block-specific data is stored**
- `position` (integer, for ordering within tab)
- `column` (integer: 0, 1, or 2, for multi-column layouts)
- `is_template` (boolean)
- `template_name` (string, nullable)
- `original_block_id` (UUID, nullable, for block references)
- `created_at`, `updated_at` (timestamps)

**7. `docs`**
- `id` (UUID, primary key)
- `workspace_id` (UUID, foreign key to workspaces)
- `title` (string)
- `content` (JSONB) - **Stores ProseMirror JSON document structure**
- `created_by` (UUID, foreign key to auth.users)
- `last_edited_by` (UUID, nullable, foreign key to auth.users)
- `is_archived` (boolean)
- `created_at`, `updated_at` (timestamps)

**8. `comments`** (for block commenting system)
- `id` (UUID, primary key)
- `block_id` (UUID, foreign key to blocks)
- `author_id` (UUID, foreign key to auth.users)
- `author_name` (string)
- `text` (text)
- `created_at`, `updated_at` (timestamps)

## Data Storage Patterns

### 1. Relational Storage (Standard Tables)

Most entities use standard relational tables with foreign keys:
- **Workspaces, Projects, Tabs, Clients**: Standard relational structure
- **Foreign Key Relationships**: Enforced at database level
- **Joins**: Used extensively for querying related data

### 2. JSONB Storage (Flexible Content)

**Blocks Table - `content` JSONB Field:**
The `blocks.content` field stores block-type-specific data as JSONB. This is a flexible schema that varies by block type:

- **Task Blocks** (`type: "task"`):
  ```json
  {
    "title": "Task List Title",
    "tasks": [
      {
        "id": "uuid or number",
        "text": "Task description",
        "status": "todo" | "in-progress" | "done",
        "priority": "urgent" | "high" | "medium" | "low" | "none",
        "assignees": ["user_id_1", "user_id_2"],
        "dueDate": "2024-01-15",
        "dueTime": "14:30",
        "startDate": "2024-01-10",
        "tags": ["tag1", "tag2"],
        "description": "Task description text",
        "subtasks": [
          {"id": "subtask_1", "text": "Subtask", "completed": false}
        ],
        "attachments": [...],
        "comments": [...],
        "recurring": {...},
        "hideIcons": false
      }
    ],
    "hideIcons": false  // Global setting for task list
  }
  ```

- **Text Blocks** (`type: "text"`):
  ```json
  {
    "text": "# Heading\n\nThis is **bold** text and *italic* text."
  }
  ```
  Text is stored as markdown string. During editing, it uses HTML via contenteditable, then converts back to markdown for storage.

- **Other Block Types**: Each has its own JSONB structure in `content`

**Documents Table - `content` JSONB Field:**
- Stores **ProseMirror JSON** document structure
- ProseMirror is a rich text editor framework
- Content structure: `{ type: "doc", content: [...] }` with nested nodes
- Each node has a `type` (paragraph, heading, text, etc.) and may contain `content` array
- Text nodes: `{ type: "text", text: "actual text content" }`
- Paragraph nodes: `{ type: "paragraph", content: [text nodes...] }`
- Can be deeply nested (paragraphs within lists within documents, etc.)

### 3. Query Patterns

**Supabase Query Builder:**
- Uses Supabase JavaScript client (`@supabase/supabase-js`)
- Query pattern: `supabase.from('table').select('...').eq('...').order('...')`
- Supports nested relationships: `.select('*, client:clients(name)')`
- Uses `.ilike()` for case-insensitive text search
- Uses `.or()` for complex conditions

**Common Query Patterns:**
- **Workspace Scoping**: All queries filter by `workspace_id`
- **Authentication**: Check `workspace_members` table for user access
- **Joins**: Used via Supabase relationship syntax
- **Limits**: Applied to prevent unbounded queries (typically 100-1000 items)

## Content Formats & Parsing

### 1. ProseMirror Documents (Docs)

**Structure:**
- Tree-based document structure
- Root node: `{ type: "doc", content: [...] }`
- Nested nodes can contain arrays of child nodes
- Text nodes: `{ type: "text", text: "..." }`
- Formatting nodes: paragraph, heading, list, etc.

**Text Extraction for Search:**
- Requires recursive tree traversal
- Must handle nested `content` arrays
- Must extract `text` fields from text nodes
- No built-in full-text search in JSONB for ProseMirror structure
- Must extract to plain text for searching

### 2. Task Block Content

**Structure:**
- Stored in `blocks.content.tasks[]` array
- Each task is an object with `text`, `status`, `priority`, etc.
- Task `text` field contains the searchable content
- Tasks can have nested `subtasks[]` array
- Tasks can have `description` field (separate from `text`)

**Search Pattern:**
- Iterate through `tasks` array
- Check `task.text` for search matches
- Check `task.description` if needed
- Extract task text for preview

### 3. Text Block Content

**Structure:**
- Stored as plain markdown string in `blocks.content.text`
- Markdown format: `# Heading`, `**bold**`, `*italic*`, etc.
- Can contain HTML tags like `<u>` for underline
- Simple string storage, no nested structure

**Search Pattern:**
- Direct string search on `content.text`
- Strip markdown formatting for preview display
- Can use simple string operations

## Authentication & Authorization

### Workspace-Based Access Control

**Core Principle:**
- All data belongs to a workspace
- Users access data through workspace membership
- Every query must verify workspace membership

**Access Control Pattern:**
1. Get authenticated user from Supabase Auth
2. Verify user is in `workspace_members` table
3. Filter all queries by `workspace_id`
4. Server-side validation prevents cross-workspace access

**Utility Functions:**
- `getAuthenticatedUser()`: Gets current user
- `getCurrentWorkspaceId()`: Gets workspace ID from cookie
- `checkWorkspaceMembership(workspaceId, userId)`: Verifies access
- `getProjectMetadata(projectId)`: Gets project's workspace_id
- `getTabMetadata(tabId)`: Gets tab's project and workspace via join

**Query Security:**
- All queries filter by `workspace_id` or join through workspace relationships
- No direct user-owned data - everything is workspace-scoped
- Server actions validate membership before data operations

## Data Query Patterns

### 1. Direct Queries (Simple Filtering)

**Projects:**
```typescript
supabase
  .from('projects')
  .select('id, name, client:clients(name)')
  .eq('workspace_id', workspaceId)
  .ilike('name', `%${searchTerm}%`)
  .limit(limit)
```

**Docs:**
```typescript
supabase
  .from('docs')
  .select('id, title, content')
  .eq('workspace_id', workspaceId)
  .eq('is_archived', false)
  .ilike('title', `%${searchTerm}%`)
```

### 2. Nested Relationship Queries

**Projects with Clients:**
- Uses Supabase foreign key syntax: `client:clients(name)`
- Automatically joins `clients` table via `client_id` foreign key

**Tabs with Projects:**
- Query tabs, then join to projects to get workspace_id
- Pattern: `tabs → projects → workspace_id`

**Blocks with Tabs:**
- Query blocks filtered by `tab_id`
- Then resolve tab → project → workspace for access control

### 3. JSONB Content Queries

**Limitations:**
- PostgreSQL JSONB has limited full-text search capabilities
- Can't easily search within nested JSONB structures (like ProseMirror)
- Can't search within arrays (like `tasks[]`) directly in SQL
- Must fetch JSONB, then parse in JavaScript

**Search Strategy:**
1. Fetch blocks/docs with JSONB content
2. Parse JSONB in JavaScript
3. Extract text content
4. Search extracted text in memory
5. Return matching results

## Indexing & Search Considerations

### Database Indexing

**Standard Indexes (Likely Exist):**
- Primary keys (id fields)
- Foreign keys (workspace_id, project_id, tab_id, etc.)
- Frequently queried fields (name, title, etc.)

**JSONB Indexing:**
- PostgreSQL supports GIN indexes on JSONB
- But complex nested structures (ProseMirror) are difficult to index effectively
- Array searches within JSONB require specific index types

### Search Limitations

**What Works Well:**
- Simple text fields: `name`, `title` (uses `ilike` for pattern matching)
- Relational queries with filters

**What's Challenging:**
- **ProseMirror JSON**: Deeply nested, requires recursive parsing
- **Task arrays**: Must iterate through `tasks[]` array
- **Text block markdown**: Can search as string, but markdown formatting must be stripped
- **No full-text search**: No PostgreSQL full-text search (tsvector/tsquery) configured
- **No Elasticsearch/Search Engine**: Pure SQL/JavaScript-based search

### Current Search Approach

The search implementation:
1. Uses database `ilike` for simple fields (projects.name, docs.title, tabs.name)
2. Fetches JSONB content and parses in JavaScript
3. Extracts text from complex structures (ProseMirror, task arrays)
4. Performs in-memory text matching
5. Limits results and processes in batches for performance

## Data Flow & Updates

### Update Patterns

**Blocks:**
- Updated via `updateBlock(blockId, updates)` server action
- Updates JSONB `content` field directly
- Optimistic UI updates on client side
- Temporary IDs for unsaved blocks (prefixed with "temp-")

**Tasks:**
- Stored within task block's `content.tasks[]` array
- Entire array replaced on update (immutable pattern)
- Task updates modify the parent block

**Docs:**
- Updated via `updateDoc(docId, { title?, content?, is_archived? })`
- ProseMirror content updated as entire JSON object
- Auto-save functionality in editor

### Transaction Patterns

- No explicit transactions used
- Updates are atomic (single Supabase operation)
- Errors rollback via error handling

## Performance Considerations

### Query Optimization

**Limits Applied:**
- Blocks per tab: 500
- Projects per workspace: varies (typically 200-1000)
- Tabs per project: 1000
- Results per search: 10-20

**Selective Field Selection:**
- Queries select only needed fields
- Avoids `SELECT *` patterns
- Reduces data transfer

**Caching:**
- React `cache()` used for auth utilities
- Prevents redundant auth checks in same request
- No general data caching beyond Next.js revalidation

### JSONB Performance

**Processing:**
- JSONB parsing happens in JavaScript
- Large documents can be slow to process
- Text extraction limited to prevent processing huge docs

**Storage:**
- JSONB allows flexible schemas
- Trade-off: Less queryable than normalized tables
- Benefits: Flexible content structures without schema migrations

## File Storage

**Not Covered in Search Currently:**
- Files stored in Supabase Storage (separate from database)
- File metadata stored in database (file blocks, attachments)
- File content not searchable (only metadata like filename)

## Current Search Implementation Context

The search system (`search.ts`) operates within this architecture:

1. **Must respect workspace boundaries**: All searches filter by workspace_id
2. **Must authenticate users**: Check workspace membership before searching
3. **Must parse JSONB content**: Extract text from ProseMirror, task arrays, etc.
4. **Must handle nested structures**: Recursive parsing for complex content
5. **Must optimize for performance**: Limit queries, early exits, batch processing
6. **Must provide context**: Include project/tab names in results for navigation

The search implementation works around the limitations of JSONB storage by:
- Fetching content first
- Parsing in JavaScript
- Performing text matching in memory
- Limiting scope (reduced from 500 to 100 docs for content search)
- Using database queries where possible (title/name searches)

## Key Technical Details for Search Implementation

1. **No Full-Text Search Engine**: Must use pattern matching (`includes()`, `ilike`)
2. **JSONB Parsing Required**: ProseMirror and task arrays need recursive extraction
3. **Workspace Isolation**: Every query must filter by workspace_id
4. **Access Control**: Verify membership before any data access
5. **Content Type Variety**: Different extraction logic per block type
6. **Performance Limits**: Must limit queries and processing to prevent timeouts

## Searchable Content Types & Data Access Patterns

### 1. Projects
- **Table**: `projects`
- **Searchable Fields**: `name` (via `ilike` pattern matching)
- **Access Pattern**: Direct query filtered by `workspace_id`
- **Relationships**: Can join with `clients` table via `client_id`
- **Query Example**:
  ```typescript
  supabase
    .from('projects')
    .select('id, name, client:clients(name)')
    .eq('workspace_id', workspaceId)
    .ilike('name', `%${searchTerm}%`)
  ```

### 2. Documents
- **Table**: `docs`
- **Searchable Fields**: 
  - `title` (via `ilike` - database-level filtering)
  - `content` (ProseMirror JSONB - requires JavaScript parsing)
- **Access Pattern**: 
  - Title search: Database query with `ilike`
  - Content search: Fetch docs, parse JSONB in JavaScript
- **Content Structure**: ProseMirror JSON with nested nodes
- **Text Extraction**: Recursive traversal of `content` array to find text nodes

### 3. Tasks (within Task Blocks)
- **Storage**: Stored in `blocks` table where `type = "task"`
- **Content Path**: `blocks.content.tasks[]` (array of task objects)
- **Searchable Fields**: 
  - `task.text` (primary searchable field)
  - `task.description` (optional, separate from text)
- **Access Pattern**:
  1. Get all workspace projects → get their tabs → get task blocks
  2. Filter blocks by `type = "task"`
  3. Parse JSONB `content.tasks[]` array
  4. Iterate through tasks, check `task.text` for matches
- **Context**: Need to resolve `tab_id → project_id → project_name` for display

### 4. Text Blocks
- **Storage**: Stored in `blocks` table where `type = "text"`
- **Content Path**: `blocks.content.text` (markdown string)
- **Searchable Fields**: `content.text` (direct string search)
- **Access Pattern**:
  1. Get all workspace projects → get their tabs → get text blocks
  2. Filter blocks by `type = "text"`
  3. Direct string search on `content.text`
- **Format**: Markdown with formatting characters (`**bold**`, `*italic*`, `# heading`)

### 5. Tabs
- **Table**: `tabs`
- **Searchable Fields**: `name` (via `ilike` pattern matching)
- **Access Pattern**: Query tabs within workspace projects
- **Relationships**: `tabs.project_id → projects.id → projects.workspace_id`
- **Hierarchy**: Can have `parent_tab_id` for nested tabs

### 6. Comments (Not Currently Searched)
- **Table**: `comments`
- **Fields**: `text`, `author_id`, `block_id`
- **Relationship**: Comments belong to blocks
- **Note**: Comments are searchable content but not included in current search implementation

## Data Relationship Resolution for Search Results

When searching blocks (tasks, text blocks), the search must resolve relationships to provide context:

**Resolution Chain for Block Results:**
```
block.tab_id → tabs.id
  → tabs.project_id → projects.id
    → projects.name (for display)
    → projects.workspace_id (for access control)
```

**Implementation Pattern:**
1. Fetch all workspace projects first (get project IDs and names)
2. Fetch all tabs for those projects (get tab IDs, names, project_id mapping)
3. Create Maps for fast lookup: `tabMap.get(tabId)` → `{ name, projectId }`
4. Create Maps for project names: `projectMap.get(projectId)` → `projectName`
5. When matching a block, use Maps to get: `Project Name → Tab Name` for subtitle

## Workspace Isolation & Query Scoping

**Critical Constraint**: Every search query must be workspace-scoped to prevent data leakage.

**Scoping Patterns:**

1. **Direct Workspace Scoping** (Projects, Docs):
   ```typescript
   .eq('workspace_id', workspaceId)
   ```

2. **Indirect Scoping via Joins** (Blocks, Tabs):
   ```typescript
   // First get workspace projects
   projects WHERE workspace_id = X
   // Then get their tabs
   tabs WHERE project_id IN (project_ids)
   // Then get blocks
   blocks WHERE tab_id IN (tab_ids)
   ```

3. **Tab Query with Project Join**:
   ```typescript
   supabase
     .from('tabs')
     .select('id, name, project_id, projects!inner(id, name, workspace_id)')
     .eq('projects.workspace_id', workspaceId)
   ```

## Search Performance Constraints

### Why Limits Are Necessary

1. **JSONB Processing Overhead**:
   - Each doc/block requires JSONB parsing in JavaScript
   - ProseMirror documents can be deeply nested (expensive recursion)
   - No database-level indexing for complex JSONB structures

2. **Query Complexity**:
   - Multiple joins required for blocks (blocks → tabs → projects)
   - Can't efficiently query JSONB arrays in SQL
   - Must fetch and process in memory

3. **Network & Memory**:
   - Fetching large JSONB payloads over network
   - Parsing large document structures
   - Multiple sequential queries for relationship resolution

### Current Optimization Strategy

- **Batch Processing**: Process items in batches, stop when limit reached
- **Early Exit**: Stop processing when result limit reached
- **Selective Fetching**: Only fetch needed fields, not entire objects
- **Relationship Caching**: Create Maps for fast lookups instead of repeated queries
- **Limit Reductions**: Reduced from 500 to 100 docs for content search

## Search Result Context Requirements

Search results must include enough context for users to:
1. Understand what the result is (project, task, doc, etc.)
2. Know where it's located (which project/tab)
3. Navigate to it (URL path)
4. See relevant preview (text snippet with highlighting)

**Context Resolution:**
- **Projects**: Include client name if available
- **Tasks**: Include project name and tab name
- **Docs**: Include title and content snippet
- **Text Blocks**: Include project name, tab name, and text preview
- **Tabs**: Include parent project name

