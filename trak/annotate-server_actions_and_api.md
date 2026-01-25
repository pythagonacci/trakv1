# Server Actions and API Routes (Annotated)

Each action includes a short description (from nearest doc comment when present, otherwise inferred from the action’s code), the source file, and the full exported code block.

## Server Actions

### src/app/actions/ai-context.ts

#### getTaskWithContext

- What it does: Performs the "get task with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getTaskWithContext(params: {
  taskId: string;
}
```

#### getProjectWithContext

- What it does: Performs the "get project with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getProjectWithContext(params: {
  projectId: string;
}
```

#### getBlockWithContext

- What it does: Performs the "get block with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getBlockWithContext(params: {
  blockId: string;
}
```

#### getTableWithRows

- What it does: Performs the "get table with rows" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getTableWithRows(params: {
  tableId: string;
  limit?: number;
}
```

#### getDocWithContext

- What it does: Performs the "get doc with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getDocWithContext(params: {
  docId: string;
}
```

#### getTimelineEventWithContext

- What it does: Performs the "get timeline event with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getTimelineEventWithContext(params: {
  eventId: string;
}
```

#### getClientWithContext

- What it does: Performs the "get client with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getClientWithContext(params: {
  clientId: string;
}
```

#### getTabWithContext

- What it does: Performs the "get tab with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getTabWithContext(params: {
  tabId: string;
}
```

#### getFileWithContext

- What it does: Performs the "get file with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getFileWithContext(params: {
  fileId: string;
}
```

#### getCommentWithContext

- What it does: Performs the "get comment with context" action for entity.
- Found in: `src/app/actions/ai-context.ts`

```ts
export async function getCommentWithContext(params: {
  commentId: string;
  source: "comment" | "task_comment" | "table_comment";
}
```

### src/app/actions/ai-search.ts

#### searchTasks

- What it does: Search for tasks in the current workspace. Returns tasks with their assignees, tags, project name, and tab name. @param params.searchText - Fuzzy search on task title @param params.status - Filter by status (todo, in-progress, done) @param params.priority - Filter by priority (urgent, high, medium, low, none) @param params.assigneeId - Filter by assignee user ID @param params.projectId - Filter by project ID @param params.tabId - Filter by tab ID @param params.tagId - Filter by tag ID @param params.dueDate - Date filter for due_date @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTasks(params: {
  searchText?: string;
  status?: string | string[];
  priority?: string | string[];
  assigneeId?: string | string[];
  projectId?: string | string[];
  tabId?: string | string[];
  tagId?: string | string[];
  dueDate?: DateFilter;
  limit?: number;
}
```

#### searchProjects

- What it does: Search for projects in the current workspace. Returns projects with their client name. @param params.searchText - Fuzzy search on project name @param params.status - Filter by status (not_started, in_progress, complete) @param params.projectType - Filter by type (project, internal) @param params.clientId - Filter by client ID @param params.dueDate - Date filter for due_date_date @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchProjects(params: {
  searchText?: string;
  status?: string | string[];
  projectType?: string | string[];
  clientId?: string | string[];
  dueDate?: DateFilter;
  limit?: number;
}
```

#### searchClients

- What it does: Search for clients in the current workspace. @param params.searchText - Fuzzy search on name, email, company @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchClients(params: {
  searchText?: string;
  limit?: number;
}
```

#### searchWorkspaceMembers

- What it does: Search for workspace members. Returns members with their profile information (name, email). @param params.searchText - Fuzzy search on name or email @param params.role - Filter by role (owner, admin, teammate) @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchWorkspaceMembers(params: {
  searchText?: string;
  role?: string | string[];
  limit?: number;
}
```

#### searchTabs

- What it does: Search for tabs in the current workspace. Returns tabs with their project name. @param params.searchText - Fuzzy search on tab name @param params.projectId - Filter by project ID @param params.isClientVisible - Filter by client visibility @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTabs(params: {
  searchText?: string;
  projectId?: string | string[];
  isClientVisible?: boolean;
  limit?: number;
}
```

#### searchBlocks

- What it does: Search for blocks in the current workspace. Returns blocks with their tab and project information. @param params.searchText - Fuzzy search on block content (JSON text) @param params.type - Filter by block type @param params.projectId - Filter by project ID @param params.tabId - Filter by tab ID @param params.isTemplate - Filter by template status @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchBlocks(params: {
  searchText?: string;
  type?: string | string[];
  projectId?: string | string[];
  tabId?: string | string[];
  isTemplate?: boolean;
  limit?: number;
}
```

#### searchDocs

- What it does: Search for documents in the current workspace. @param params.searchText - Fuzzy search on document title @param params.isArchived - Filter by archived status @param params.createdBy - Filter by creator user ID @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchDocs(params: {
  searchText?: string;
  isArchived?: boolean;
  createdBy?: string;
  limit?: number;
}
```

#### searchTables

- What it does: Search for tables in the current workspace. Returns tables with their project name. @param params.searchText - Fuzzy search on table title or description @param params.projectId - Filter by project ID @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTables(params: {
  searchText?: string;
  projectId?: string | string[];
  limit?: number;
}
```

#### searchTableFields

- What it does: Search for table fields in the current workspace. @param params.searchText - Fuzzy search on field name @param params.tableId - Filter by table ID @param params.type - Filter by field type @param params.limit - Maximum results (default 100)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTableFields(params: {
  searchText?: string;
  tableId?: string | string[];
  type?: string | string[];
  limit?: number;
}
```

#### searchTableRows

- What it does: Search for table rows in the current workspace. Searches across all text values in the JSONB data column. Returns rows with table and project context. @param params.searchText - Fuzzy search across row data values @param params.tableId - Filter by table ID (recommended for efficient search) @param params.projectId - Filter by project ID @param params.fieldFilters - Filter by specific field values { fieldId: value } @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTableRows(params: {
  searchText?: string;
  tableId?: string | string[];
  projectId?: string | string[];
  fieldFilters?: Record<string, string>;
  limit?: number;
}
```

#### searchTimelineEvents

- What it does: Search for timeline events in the current workspace. Returns events with assignee name and project context. @param params.searchText - Fuzzy search on event title @param params.status - Filter by status (planned, in-progress, blocked, done) @param params.assigneeId - Filter by assignee user ID @param params.projectId - Filter by project ID (via timeline block) @param params.startDate - Date filter for start_date @param params.endDate - Date filter for end_date @param params.isMilestone - Filter by milestone status @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTimelineEvents(params: {
  searchText?: string;
  status?: string | string[];
  assigneeId?: string | string[];
  projectId?: string | string[];
  startDate?: DateFilter;
  endDate?: DateFilter;
  isMilestone?: boolean;
  limit?: number;
}
```

#### searchFiles

- What it does: Search for files in the current workspace. Returns files with project name and uploader name. @param params.searchText - Fuzzy search on file name @param params.projectId - Filter by project ID @param params.fileType - Filter by file MIME type @param params.uploadedBy - Filter by uploader user ID @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchFiles(params: {
  searchText?: string;
  projectId?: string | string[];
  fileType?: string | string[];
  uploadedBy?: string;
  limit?: number;
}
```

#### searchComments

- What it does: Search for comments (on blocks, tabs, or projects). @param params.searchText - Fuzzy search on comment text @param params.targetType - Filter by target type (block, tab, project) @param params.targetId - Filter by target ID @param params.userId - Filter by comment author @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchComments(params: {
  searchText?: string;
  targetType?: string | string[];
  targetId?: string;
  userId?: string;
  limit?: number;
}
```

#### searchTaskComments

- What it does: Search for task comments. @param params.searchText - Fuzzy search on comment text @param params.taskId - Filter by task ID @param params.authorId - Filter by author user ID @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTaskComments(params: {
  searchText?: string;
  taskId?: string | string[];
  authorId?: string;
  limit?: number;
}
```

#### searchPayments

- What it does: Search for payments in the current workspace. Returns payments with client and project names. @param params.searchText - Fuzzy search on description, notes, payment_number @param params.status - Filter by status (pending, paid, overdue, draft, failed, canceled) @param params.clientId - Filter by client ID @param params.projectId - Filter by project ID @param params.dueDate - Date filter for due_date @param params.minAmount - Minimum amount filter @param params.maxAmount - Maximum amount filter @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchPayments(params: {
  searchText?: string;
  status?: string | string[];
  clientId?: string | string[];
  projectId?: string | string[];
  dueDate?: DateFilter;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
}
```

#### searchTags

- What it does: Search for task tags in the current workspace. @param params.searchText - Fuzzy search on tag name @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchTags(params: {
  searchText?: string;
  limit?: number;
}
```

#### searchPropertyDefinitions

- What it does: Search for property definitions in the current workspace. @param params.searchText - Fuzzy search on property name @param params.type - Filter by property type @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchPropertyDefinitions(params: {
  searchText?: string;
  type?: string | string[];
  limit?: number;
}
```

#### searchEntityLinks

- What it does: Search for entity links in the current workspace. @param params.sourceEntityType - Filter by source entity type @param params.sourceEntityId - Filter by source entity ID @param params.targetEntityType - Filter by target entity type @param params.targetEntityId - Filter by target entity ID @param params.limit - Maximum results (default 50)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchEntityLinks(params: {
  sourceEntityType?: string;
  sourceEntityId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  limit?: number;
}
```

#### resolveEntityByName

- What it does: Resolves a human-readable name to entity IDs. Uses context-aware matching: if a projectId is provided, searches within that project first. Returns matches ranked by confidence (exact > high > partial). @param params.entityType - The type of entity to resolve @param params.name - The name to search for @param params.projectId - Optional project context for scoped search @param params.limit - Maximum results (default 5)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function resolveEntityByName(params: {
  entityType: EntityType;
  name: string;
  projectId?: string;
  limit?: number;
}
```

#### searchAll

- What it does: Search across all entity types in the workspace. Useful when the entity type is unknown. Returns results from all entity types, sorted by relevance. @param params.searchText - The text to search for @param params.projectId - Optional project context to prioritize @param params.limit - Maximum results per entity type (default 5)
- Found in: `src/app/actions/ai-search.ts`

```ts
export async function searchAll(params: {
  searchText: string;
  projectId?: string;
  limit?: number;
}
```

### src/app/actions/auth.ts

#### logout

- What it does: Performs the "logout" action for entity.
- Found in: `src/app/actions/auth.ts`

```ts
export async function logout() {
  const authResult = await getServerUser();
  
  // If no active session, redirect to login
  if (!authResult) {
    redirect("/login");
  }

  const { supabase } = authResult;
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { error: error.message };
  }
  
  redirect("/login");
}
```

#### getCurrentUser

- What it does: Cache this to prevent redundant auth checks in the same request
- Found in: `src/app/actions/auth.ts`

```ts
export const getCurrentUser = cache(async () => {
  const authResult = await getServerUser();
  
  if (!authResult) {
    return { error: "Not authenticated" };
  }
  const { user } = authResult;
  
  return { 
    data: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User"
    }
  };
}
```

### src/app/actions/block-templates.ts

#### getTemplateBlocks

- What it does: Get all template blocks for the current workspace
- Found in: `src/app/actions/block-templates.ts`

```ts
export async function getTemplateBlocks(workspaceId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .select(`
        *,
        tab:tabs!blocks_tab_id_fkey(
          id,
          name,
          project:projects!tabs_project_id_fkey(
            id,
            name,
            workspace_id
          )
        )
      `)
      .eq("is_template", true)
      .eq("tab.project.workspace_id", workspaceId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching template blocks:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Error in getTemplateBlocks:", error);
    return { data: null, error: error.message };
  }
}
```

#### makeBlockTemplate

- What it does: Mark a block as a template
- Found in: `src/app/actions/block-templates.ts`

```ts
export async function makeBlockTemplate(blockId: string, templateName?: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .update({
        is_template: true,
        template_name: templateName || null,
      })
      .eq("id", blockId)
      .select()
      .single();

    if (error) {
      console.error("Error making block template:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in makeBlockTemplate:", error);
    return { data: null, error: error.message };
  }
}
```

#### removeBlockTemplate

- What it does: Remove template status from a block
- Found in: `src/app/actions/block-templates.ts`

```ts
export async function removeBlockTemplate(blockId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .update({
        is_template: false,
        template_name: null,
      })
      .eq("id", blockId)
      .select()
      .single();

    if (error) {
      console.error("Error removing block template:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in removeBlockTemplate:", error);
    return { data: null, error: error.message };
  }
}
```

#### getSingleBlock

- What it does: Get a single block (for referencing)
- Found in: `src/app/actions/block-templates.ts`

```ts
export async function getSingleBlock(blockId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .select(`
        *,
        tab:tabs!blocks_tab_id_fkey(
          id,
          name,
          project_id,
          project:projects!tabs_project_id_fkey(
            id,
            name,
            project_type
          )
        )
      `)
      .eq("id", blockId)
      .single();

    if (error) {
      console.error("Error fetching block:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Error in getSingleBlock:", error);
    return { data: null, error: error.message };
  }
}
```

### src/app/actions/block.ts

#### getTabBlocks

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function getTabBlocks(tabId: string) {
  try {
    const supabase = await createClient();

    // 🔒 Auth check FIRST (before any data fetch)
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 🔒 Verify tab access + get workspace in one query
    const tab = await getTabMetadata(tabId);
    if (!tab) {
      return { error: "Tab not found" };
    }

    const workspaceId = (tab.projects as any).workspace_id;

    // 🔒 Verify workspace membership BEFORE fetching blocks
    const member = await checkWorkspaceMembership(workspaceId, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // ✅ Auth verified - NOW safe to fetch blocks
    // 🚀 Select specific fields + add limit for safety
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, created_at, updated_at")
      .eq("tab_id", tabId)
      .is("parent_block_id", null)
      .order("column", { ascending: true })
      .order("position", { ascending: true })
      .limit(BLOCKS_PER_TAB_LIMIT);

    if (blocksError) {
      console.error("Get blocks error:", blocksError);
      return { error: "Failed to fetch blocks" };
    }

    return { data: blocks || [] };
  } catch (error) {
    console.error("Get tab blocks exception:", error);
    return { error: "Failed to fetch blocks" };
  }
}
```

#### getChildBlocks

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function getChildBlocks(parentBlockId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // 2. Get parent block with tab and project info to verify workspace access
    const { data: parentBlock, error: parentError } = await supabase
      .from("blocks")
      .select("id, tab_id, tabs!inner(id, project_id, projects!inner(workspace_id))")
      .eq("id", parentBlockId)
      .single();

    if (parentError || !parentBlock) {
      return { error: "Parent block not found" };
    }

    // SECURITY: Extract workspace ID and verify membership
    const workspaceId = (parentBlock.tabs as any)?.projects?.workspace_id;

    if (!workspaceId) {
      return { error: "Invalid block structure" };
    }

    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { error: "You don't have access to this workspace" };
    }

    // 3. Get all child blocks for this parent block
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("*")
      .eq("parent_block_id", parentBlockId)
      .order("position", { ascending: true });

    if (blocksError) {
      console.error("Get child blocks error:", blocksError);
      return { error: "Failed to fetch child blocks" };
    }

    return { data: blocks || [] };
  } catch (error) {
    console.error("Get child blocks exception:", error);
    return { error: "Failed to fetch child blocks" };
  }
}
```

#### createBlock

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function createBlock(data: {
  tabId: string;
  type: BlockType;
  content?: Record<string, any>;
  position?: number;
  column?: number; // Column index: 0, 1, or 2 (defaults to 0)
  parentBlockId?: string | null; // Parent block ID for nested blocks (e.g., sections)
  originalBlockId?: string | null; // If this is a reference to another block
}
```

#### updateBlock

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function updateBlock(data: {
  blockId: string;
  content?: Record<string, any>;
  type?: BlockType;
  position?: number;
  column?: number; // Column index: 0, 1, or 2
}
```

#### deleteBlock

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function deleteBlock(blockId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // 2. Get block and verify it exists
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id")
      .eq("id", blockId)
      .single();

    if (blockError || !block) {
      return { error: "Block not found" };
    }

    // 3. Get tab to get project_id
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", block.tab_id)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    const projectId = tab.project_id;

    // 4. Get project to get workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // 5. Verify user is member of the project's workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 6. Delete the block
    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .eq("id", blockId);

    if (deleteError) {
      console.error("Delete block error:", deleteError);
      return { error: deleteError.message || "Failed to delete block" };
    }

    // 7. Revalidate the tab page path
    revalidatePath(`/dashboard/projects/${projectId}/tabs/${block.tab_id}`);
    await revalidateClientPages(projectId, block.tab_id, {
      publicToken: project.public_token ?? undefined,
      clientPageEnabled: project.client_page_enabled ?? undefined,
    });

    return { success: true };
  } catch (error) {
    console.error("Delete block exception:", error);
    return { error: "Failed to delete block" };
  }
}
```

#### moveBlock

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function moveBlock(data: {
  blockId: string;
  targetTabId: string;
  targetParentBlockId?: string | null;
  newPosition: number;
}
```

#### duplicateBlock

- What it does: ============================================================================
- Found in: `src/app/actions/block.ts`

```ts
export async function duplicateBlock(blockId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // 2. Get block and verify it exists
    const { data: sourceBlock, error: blockError } = await supabase
      .from("blocks")
      .select("*")
      .eq("id", blockId)
      .single();

    if (blockError || !sourceBlock) {
      return { error: "Block not found" };
    }

    // 3. Get tab to get project_id
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", sourceBlock.tab_id)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    // 4. Get project to get workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", tab.project_id)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // 5. Verify user is member of the project's workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 6. Calculate position for duplicate (place right after original)
    const newPosition = sourceBlock.position + 1;

    // 7. Shift all blocks after the original block down by 1
    // Note: Supabase doesn't support .raw() directly in the SDK, so we'll use rpc or handle differently
    // For now, we'll fetch, update, and re-insert
    const { data: blocksToShift, error: fetchError } = await supabase
      .from("blocks")
      .select("id, position")
      .eq("tab_id", sourceBlock.tab_id)
      .is("parent_block_id", sourceBlock.parent_block_id)
      .gte("position", newPosition)
      .order("position", { ascending: true });

    if (fetchError) {
      console.error("Fetch blocks to shift error:", fetchError);
    }

    // Shift positions
    if (blocksToShift && blocksToShift.length > 0) {
      for (const block of blocksToShift) {
        await supabase
          .from("blocks")
          .update({ 
            position: block.position + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", block.id);
      }
    }

    // 8. Create duplicate block with copied content
    const { data: duplicateBlock, error: createError } = await supabase
      .from("blocks")
      .insert({
        tab_id: sourceBlock.tab_id,
        parent_block_id: sourceBlock.parent_block_id,
        type: sourceBlock.type,
        content: sourceBlock.content, // Deep copy of JSONB content
        position: newPosition,
      })
      .select()
      .single();

    if (createError) {
      console.error("Duplicate block error:", createError);
      return { error: createError.message || "Failed to duplicate block" };
    }

    // 9. Revalidate the tab page path
    revalidatePath(`/dashboard/projects/${tab.project_id}/tabs/${sourceBlock.tab_id}`);
    await revalidateClientPages(tab.project_id, sourceBlock.tab_id, {
      publicToken: project.public_token ?? undefined,
      clientPageEnabled: project.client_page_enabled ?? undefined,
    });

    return { data: duplicateBlock };
  } catch (error) {
    console.error("Duplicate block exception:", error);
    return { error: "Failed to duplicate block" };
  }
}
```

#### getTabBlocksPublic

- What it does: Get blocks for a tab on a public client page Uses service role client to bypass RLS Validates public token instead of user auth
- Found in: `src/app/actions/block.ts`

```ts
export async function getTabBlocksPublic(tabId: string, publicToken: string) {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = await createServiceClient();

    // 1. Verify the public token is valid and client page is enabled
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, client_page_enabled")
      .eq("public_token", publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (projectError || !project) {
      console.error("Public token validation failed:", projectError);
      return { error: "Invalid or disabled client page" };
    }

    // 2. Verify the tab belongs to this project AND is client-visible
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id, is_client_visible")
      .eq("id", tabId)
      .eq("project_id", project.id)
      .eq("is_client_visible", true)
      .single();

    if (tabError || !tab) {
      console.error("Tab validation failed:", tabError);
      return { error: "Tab not found or not visible to clients" };
    }

    // 3. Fetch blocks (service role bypasses RLS)
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, created_at, updated_at")
      .eq("tab_id", tabId)
      .is("parent_block_id", null)
      .order("column", { ascending: true })
      .order("position", { ascending: true })
      .limit(BLOCKS_PER_TAB_LIMIT);

    if (blocksError) {
      console.error("Get public blocks error:", blocksError);
      return { error: "Failed to fetch blocks" };
    }

    console.log(`✅ Public access: Fetched ${blocks?.length || 0} blocks for tab ${tabId}`);

    return { data: blocks || [] };
  } catch (error) {
    console.error("Get tab blocks public exception:", error);
    return { error: "Failed to fetch blocks" };
  }
}
```

### src/app/actions/client-page.ts

#### enableClientPage

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function enableClientPage(projectId: string) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Get project and verify access
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // Verify workspace membership
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // Generate public token if not exists
    let publicToken = project.public_token;
    if (!publicToken) {
      const { data: tokenData, error: tokenError } = await supabase
        .rpc("generate_public_token");

      if (tokenError || !tokenData) {
        return { error: "Failed to generate public token" };
      }

      publicToken = tokenData;
    }

    // Enable client page
    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({
        client_page_enabled: true,
        public_token: publicToken,
      })
      .eq("id", projectId)
      .select("id, public_token")
      .single();

    if (updateError) {
      console.error("Enable client page error:", updateError);
      return { error: "Failed to enable client page" };
    }

    revalidatePath(`/dashboard/projects/${projectId}`);

    return { data: updatedProject };
  } catch (error) {
    console.error("Enable client page exception:", error);
    return { error: "Failed to enable client page" };
  }
}
```

#### disableClientPage

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function disableClientPage(projectId: string) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Get project and verify access
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // Verify workspace membership
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // Disable client page (keep token for potential re-enable)
    const { error: updateError } = await supabase
      .from("projects")
      .update({ client_page_enabled: false })
      .eq("id", projectId);

    if (updateError) {
      console.error("Disable client page error:", updateError);
      return { error: "Failed to disable client page" };
    }

    revalidatePath(`/dashboard/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Disable client page exception:", error);
    return { error: "Failed to disable client page" };
  }
}
```

#### updateClientPageSettings

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function updateClientPageSettings(
  projectId: string,
  settings: { clientCommentsEnabled?: boolean }
```

#### getProjectByPublicToken

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function getProjectByPublicToken(publicToken: string) {
  try {
    const supabase = await createClient();
    
    // Debug: Check auth status
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Supabase client auth status:', user ? `Authenticated as ${user.id}` : 'Anonymous');

    // Get project with client info
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        status,
        due_date_date,
        due_date_text,
        client_page_enabled,
        client_comments_enabled,
        public_token,
        updated_at,
        client:clients(id, name, company)
      `)
      .eq("public_token", publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (projectError) {
      console.error("Project query error:", {
        error: projectError,
        code: projectError.code,
        message: projectError.message,
        details: projectError.details,
        hint: projectError.hint,
      });
      return { error: "Project not found" };
    }

    if (!project) {
      console.error("No project found for token:", publicToken);
      return { error: "Project not found" };
    }

    // Handle Supabase foreign key quirk
    const formattedProject: ClientPageProject = {
      ...project,
      client: Array.isArray(project.client) ? project.client[0] : project.client,
    };

    // Get client-visible tabs
    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, name, position, is_client_visible, client_title")
      .eq("project_id", project.id)
      .eq("is_client_visible", true)
      .order("position", { ascending: true });

    if (tabsError) {
      console.error("Get tabs error:", tabsError);
      return { error: "Failed to fetch tabs" };
    }

    return {
      data: {
        project: formattedProject,
        tabs: tabs || [],
      },
    };
  } catch (error) {
    console.error("Get project by token exception:", error);
    return { error: "Failed to fetch project" };
  }
}
```

#### toggleTabVisibility

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function toggleTabVisibility(tabId: string, isVisible: boolean) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Get tab and project
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id, projects(workspace_id)")
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    const workspaceId = (tab.projects as any).workspace_id;

    // Verify workspace membership
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // Update tab visibility
    const { error: updateError } = await supabase
      .from("tabs")
      .update({ is_client_visible: isVisible })
      .eq("id", tabId);

    if (updateError) {
      console.error("Toggle tab visibility error:", updateError);
      return { error: "Failed to update tab visibility" };
    }

    revalidatePath(`/dashboard/projects/${tab.project_id}`);

    return { success: true };
  } catch (error) {
    console.error("Toggle tab visibility exception:", error);
    return { error: "Failed to toggle tab visibility" };
  }
}
```

#### updateTabClientTitle

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function updateTabClientTitle(tabId: string, clientTitle: string | null) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Get tab and project
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id, projects(workspace_id)")
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    const workspaceId = (tab.projects as any).workspace_id;

    // Verify workspace membership
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // Update client title
    const { error: updateError } = await supabase
      .from("tabs")
      .update({ client_title: clientTitle })
      .eq("id", tabId);

    if (updateError) {
      console.error("Update tab client title error:", updateError);
      return { error: "Failed to update client title" };
    }

    revalidatePath(`/dashboard/projects/${tab.project_id}`);

    return { success: true };
  } catch (error) {
    console.error("Update tab client title exception:", error);
    return { error: "Failed to update client title" };
  }
}
```

#### trackClientPageView

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function trackClientPageView(data: {
  publicToken: string;
  tabId?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  referrer?: string | null;
  ipAddress?: string | null;
}
```

#### getClientPageAnalytics

- What it does: ============================================================================
- Found in: `src/app/actions/client-page.ts`

```ts
export async function getClientPageAnalytics(projectId: string) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Get project and verify access
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // Verify workspace membership
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // Get analytics summary from view
    const { data: analytics, error: analyticsError } = await supabase
      .from("client_page_analytics_summary")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (analyticsError && analyticsError.code !== "PGRST116") {
      console.error("Get analytics error:", analyticsError);
      return { error: "Failed to fetch analytics" };
    }

    // Get recent views
    const { data: recentViews, error: viewsError } = await supabase
      .from("client_page_views")
      .select("id, tab_id, viewed_at, user_agent, session_id")
      .eq("project_id", projectId)
      .order("viewed_at", { ascending: false })
      .limit(50);

    if (viewsError) {
      console.error("Get recent views error:", viewsError);
    }

    return {
      data: {
        summary: analytics || {
          total_views: 0,
          unique_visitors: 0,
          tabs_viewed: 0,
          last_viewed_at: null,
          avg_duration_seconds: null,
        },
        recent_views: recentViews || [],
      },
    };
  } catch (error) {
    console.error("Get analytics exception:", error);
    return { error: "Failed to fetch analytics" };
  }
}
```

#### getDocForClientPage

- What it does: Get a doc for public client page viewing This checks if the doc belongs to a project with client pages enabled
- Found in: `src/app/actions/client-page.ts`

```ts
export async function getDocForClientPage(docId: string, publicToken: string) {
  const supabase = await createClient();

  try {
    // First verify the project exists and has client pages enabled
    const { data: project } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("public_token", publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (!project) {
      return { data: null, error: "Project not found or client page not enabled" };
    }

    // Get the doc - ensure it belongs to the same workspace
    const { data: doc, error: docError } = await supabase
      .from("docs")
      .select("id, title, content, updated_at")
      .eq("id", docId)
      .eq("workspace_id", project.workspace_id)
      .single();

    if (docError) {
      console.error("Error fetching doc for client page:", docError);
      return { data: null, error: "Document not found" };
    }

    return { data: doc, error: null };
  } catch (error) {
    console.error("Get doc for client page exception:", error);
    return { data: null, error: "Failed to fetch document" };
  }
}
```

### src/app/actions/client-tab-block.ts

#### getClientTabBlocks

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab-block.ts`

```ts
export async function getClientTabBlocks(tabId: string) {
  try {
    const supabase = await createClient();

    // Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Get tab and verify access
    const { data: tab, error: tabError } = await supabase
      .from("client_tabs")
      .select(`
        id,
        client_id,
        clients (
          workspace_id
        )
      `)
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    const workspaceId = (tab.clients as any).workspace_id;

    // Verify workspace membership
    const member = await checkWorkspaceMembership(workspaceId, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // Get blocks
    const { data: blocks, error: blocksError } = await supabase
      .from("client_tab_blocks")
      .select("id, tab_id, type, content, position, column, created_at, updated_at")
      .eq("tab_id", tabId)
      .order("column", { ascending: true })
      .order("position", { ascending: true })
      .limit(CLIENT_TAB_BLOCKS_PER_TAB_LIMIT);

    if (blocksError) {
      console.error("Get client tab blocks error:", blocksError);
      return { error: "Failed to fetch blocks" };
    }

    return { data: blocks || [] };
  } catch (error) {
    console.error("Get client tab blocks exception:", error);
    return { error: "Failed to fetch blocks" };
  }
}
```

#### createClientTabBlock

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab-block.ts`

```ts
export async function createClientTabBlock(data: {
  tabId: string;
  type: ClientTabBlockType;
  content?: Record<string, any>;
  position?: number;
  column?: number;
}
```

#### updateClientTabBlock

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab-block.ts`

```ts
export async function updateClientTabBlock(data: {
  blockId: string;
  content?: Record<string, any>;
  type?: ClientTabBlockType;
  position?: number;
  column?: number;
}
```

#### deleteClientTabBlock

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab-block.ts`

```ts
export async function deleteClientTabBlock(blockId: string) {
  try {
    const supabase = await createClient();

    // Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Get block and verify it exists
    const { data: block, error: blockError } = await supabase
      .from("client_tab_blocks")
      .select(`
        id,
        tab_id,
        client_tabs (
          client_id,
          clients (
            workspace_id
          )
        )
      `)
      .eq("id", blockId)
      .single();

    if (blockError || !block) {
      return { error: "Block not found" };
    }

    const tab = block.client_tabs as any;
    const workspaceId = tab.clients.workspace_id;

    // Verify workspace membership
    const member = await checkWorkspaceMembership(workspaceId, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // Delete the block
    const { error: deleteError } = await supabase
      .from("client_tab_blocks")
      .delete()
      .eq("id", blockId);

    if (deleteError) {
      console.error("Delete client tab block error:", deleteError);
      return { error: deleteError.message || "Failed to delete block" };
    }

    revalidatePath(`/dashboard/clients/${tab.client_id}/tabs/${block.tab_id}`);
    return { data: { success: true } };
  } catch (error) {
    console.error("Delete client tab block exception:", error);
    return { error: "Failed to delete block" };
  }
}
```

#### getClientTabBlockFileUrls

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab-block.ts`

```ts
export async function getClientTabBlockFileUrls(fileIds: string[], tabId: string) {
  try {
    const supabase = await createClient();

    // Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized", data: {} };
    }

    // Get tab and verify access
    const { data: tab, error: tabError } = await supabase
      .from("client_tabs")
      .select(`
        id,
        clients (
          workspace_id
        )
      `)
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found", data: {} };
    }

    const workspaceId = (tab.clients as any).workspace_id;

    // Verify workspace membership
    const member = await checkWorkspaceMembership(workspaceId, user.id);
    if (!member) {
      return { error: "Not a member of this workspace", data: {} };
    }

    // Use the existing getBatchFileUrls function
    return await getBatchFileUrls(fileIds);
  } catch (error) {
    console.error("Get client tab block file URLs exception:", error);
    return { error: "Failed to fetch file URLs", data: {} };
  }
}
```

### src/app/actions/client-tab.ts

#### createClientTab

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab.ts`

```ts
export async function createClientTab(data: {
  clientId: string;
  name: string;
}
```

#### getClientTabs

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab.ts`

```ts
export async function getClientTabs(clientId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 2. Get client and verify access
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("workspace_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return { error: "Client not found" };
    }

    // 3. Verify workspace membership
    const member = await checkWorkspaceMembership(client.workspace_id, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // 4. Get tabs
    const { data: tabs, error: tabsError } = await supabase
      .from("client_tabs")
      .select("id, client_id, name, position, created_at, updated_at")
      .eq("client_id", clientId)
      .order("position", { ascending: true })
      .limit(CLIENT_TABS_PER_CLIENT_LIMIT);

    if (tabsError) {
      return { error: tabsError.message };
    }

    return { data: tabs || [] };
  } catch (error) {
    console.error("Get client tabs exception:", error);
    return { error: "Failed to fetch tabs" };
  }
}
```

#### updateClientTab

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab.ts`

```ts
export async function updateClientTab(data: {
  tabId: string;
  name?: string;
  position?: number;
}
```

#### deleteClientTab

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab.ts`

```ts
export async function deleteClientTab(tabId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 2. Get tab and its client/workspace
    const { data: tab, error: tabError } = await supabase
      .from("client_tabs")
      .select(`
        id,
        client_id,
        name,
        clients (
          workspace_id
        )
      `)
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    // 3. Verify workspace membership and admin/owner role
    const workspaceId = (tab.clients as any).workspace_id;
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      return { error: "Unauthorized" };
    }

    if (membership.role !== "admin" && membership.role !== "owner") {
      return { error: "Only admins and owners can delete tabs" };
    }

    // 4. Delete the tab
    const { error: deleteError } = await supabase
      .from("client_tabs")
      .delete()
      .eq("id", tabId);

    if (deleteError) {
      return { error: deleteError.message };
    }

    // 5. Reorder remaining tabs
    const { data: remainingTabs } = await supabase
      .from("client_tabs")
      .select("id")
      .eq("client_id", tab.client_id)
      .order("position", { ascending: true });

    if (remainingTabs) {
      // Update positions sequentially
      for (let i = 0; i < remainingTabs.length; i++) {
        await supabase
          .from("client_tabs")
          .update({ position: i })
          .eq("id", remainingTabs[i].id);
      }
    }

    revalidatePath(`/dashboard/clients/${tab.client_id}`);
    return { data: { success: true } };
  } catch (error) {
    console.error("Delete client tab exception:", error);
    return { error: "Failed to delete tab" };
  }
}
```

#### getClientTabContent

- What it does: ============================================================================
- Found in: `src/app/actions/client-tab.ts`

```ts
export async function getClientTabContent(tabId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 2. Get tab and verify access
    const { data: tab, error: tabError } = await supabase
      .from("client_tabs")
      .select(`
        id,
        client_id,
        name,
        clients (
          workspace_id
        )
      `)
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    // 3. Verify workspace membership
    const workspaceId = (tab.clients as any).workspace_id;
    const member = await checkWorkspaceMembership(workspaceId, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // 4. Get tab content (blocks)
    const { data: blocks, error: blocksError } = await supabase
      .from("client_tab_blocks")
      .select("id, tab_id, type, content, position, column, created_at, updated_at")
      .eq("tab_id", tabId)
      .order("column", { ascending: true })
      .order("position", { ascending: true });

    if (blocksError) {
      return { error: blocksError.message };
    }

    return {
      data: {
        tab,
        blocks: blocks || []
      }
    };
  } catch (error) {
    console.error("Get client tab content exception:", error);
    return { error: "Failed to fetch tab content" };
  }
}
```

### src/app/actions/client.ts

#### createClient

- What it does: 1. CREATE CLIENT
- Found in: `src/app/actions/client.ts`

```ts
export async function createClient(workspaceId: string, clientData: ClientData) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to create clients' }
  }

  // Create the client
  const { data: client, error: createError } = await supabase
    .from('clients')
    .insert({
      workspace_id: workspaceId,
      ...clientData
    })
    .select()
    .single()

  if (createError) {
    return { error: createError.message }
  }

  revalidatePath('/dashboard')
  return { data: client }
}
```

#### getAllClients

- What it does: 2. GET ALL CLIENTS (with project count) - OPTIMIZED
- Found in: `src/app/actions/client.ts`

```ts
export async function getAllClients(workspaceId: string) {
  const authResult = await getServerUser()
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // 🚀 Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to view clients' }
  }

  // 🚀 Get only essential client fields for dropdown
  const { data: clients, error: fetchError } = await supabase
    .from('clients')
    .select('id, name, company, created_at')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true }) // Alphabetical for better UX

  if (fetchError) {
    return { error: fetchError.message }
  }

  return { data: clients }
}
```

#### getSingleClient

- What it does: 3. GET SINGLE CLIENT (with all projects and stats)
- Found in: `src/app/actions/client.ts`

```ts
export async function getSingleClient(clientId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get client with workspace info to check membership
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select(`
      *,
      workspace:workspaces (
        id,
        name
      ),
      projects (
        id,
        name,
        status,
        due_date_date,
        due_date_text,
        created_at
      )
    `)
    .eq('id', clientId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Check if user is a member of the client's workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to view this client' }
  }

  // Calculate project statistics
  const projects = client.projects || []
  const stats = {
    total_projects: projects.length,
    active_projects: projects.filter((p: any) => p.status === 'in_progress').length,
    completed_projects: projects.filter((p: any) => p.status === 'complete').length,
    not_started_projects: projects.filter((p: any) => p.status === 'not_started').length
  }

  return { 
    data: {
      ...client,
      stats
    }
  }
}
```

#### updateClient

- What it does: 4. UPDATE CLIENT
- Found in: `src/app/actions/client.ts`

```ts
export async function updateClient(clientId: string, updates: Partial<ClientData>) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get client to find workspace_id
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (fetchError) {
    return { error: 'Client not found' }
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to update clients' }
  }

  // Update the client
  const { data: updatedClient, error: updateError } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', clientId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  return { data: updatedClient }
}
```

#### deleteClient

- What it does: 5. DELETE CLIENT
- Found in: `src/app/actions/client.ts`

```ts
export async function deleteClient(clientId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get client to find workspace_id
  const { data: client, error: fetchError } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (fetchError) {
    return { error: 'Client not found' }
  }

  // Check if user is admin or owner of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  if (membership.role !== 'admin' && membership.role !== 'owner') {
    return { error: 'Only admins and owners can delete clients' }
  }

  // Check if client has any projects
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('client_id', clientId)

  if (projectError) {
    return { error: projectError.message }
  }

  if (projects && projects.length > 0) {
    return { 
      error: `Cannot delete client with ${projects.length} existing project(s). Please delete or reassign projects first.` 
    }
  }

  // Delete the client
  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  revalidatePath('/dashboard')
  return { data: { success: true, message: 'Client deleted successfully' } }
}
```

#### getClientProjects

- What it does: 6. GET CLIENT PROJECTS
- Found in: `src/app/actions/client.ts`

```ts
export async function getClientProjects(clientId: string) {
  const authResult = await getServerUser()

  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // First verify the client exists and user has access
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return { error: 'Client not found' }
  }

  // Verify user has access to this workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', client.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  // Get all projects for this client
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, status, due_date_date, due_date_text, created_at, updated_at')
    .eq('client_id', clientId)
    .eq('workspace_id', client.workspace_id)
    .order('created_at', { ascending: false })

  if (projectsError) {
    return { error: projectsError.message }
  }

  return { data: projects || [] }
}
```

### src/app/actions/debug.ts

#### getMyInfo

- What it does: Uses Supabase to read records in workspace_members.
- Found in: `src/app/actions/debug.ts`

```ts
export async function getMyInfo() {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get user's workspaces with roles
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspace_members')
    .select(`
      role,
      created_at,
      workspace:workspaces (
        id,
        name,
        owner_id,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (workspacesError) {
    return { 
      data: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at
        },
        workspaces: [],
        workspaces_error: workspacesError.message
      }
    }
  }

  return { 
    data: {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      workspaces: (workspaces || []).map((w: any) => {
        // Handle both array and object workspace data (Supabase type quirk)
        const workspace = Array.isArray(w.workspace) ? w.workspace[0] : w.workspace;
        return {
          workspace_id: workspace?.id,
          workspace_name: workspace?.name,
          your_role: w.role,
          is_owner: workspace?.owner_id === user.id,
          joined_at: w.created_at
        };
      }),
      total_workspaces: workspaces?.length || 0
    }
  }
}
```

### src/app/actions/doc.ts

#### getAllDocs

- What it does: Get all docs for a workspace
- Found in: `src/app/actions/doc.ts`

```ts
export async function getAllDocs(workspaceId: string, filters?: DocFilters) {
  const supabase = await createClient();

  try {
    // SECURITY: Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: "Unauthorized" };
    }

    // SECURITY: Verify user is a member of this workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this workspace" };
    }

    let query = supabase
      .from("docs")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Apply filters
    if (filters?.is_archived !== undefined) {
      query = query.eq("is_archived", filters.is_archived);
    } else {
      query = query.eq("is_archived", false);
    }

    if (filters?.search) {
      query = query.ilike("title", `%${filters.search}%`);
    }

    // Apply sorting
    const sortBy = filters?.sort_by || "updated_at";
    const sortOrder = filters?.sort_order || "desc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching docs:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Error in getAllDocs:", error);
    return { data: null, error: error.message };
  }
}
```

#### getSingleDoc

- What it does: Get a single doc by ID
- Found in: `src/app/actions/doc.ts`

```ts
export async function getSingleDoc(docId: string) {
  const supabase = await createClient();

  try {
    // SECURITY: Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: "Unauthorized" };
    }

    // First, get the doc to find its workspace
    const { data: doc, error } = await supabase
      .from("docs")
      .select("*")
      .eq("id", docId)
      .single();

    if (error) {
      console.error("Error fetching doc:", error);
      return { data: null, error: error.message };
    }

    if (!doc) {
      return { data: null, error: "Document not found" };
    }

    // SECURITY: Verify user is a member of the doc's workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this document" };
    }

    return { data: doc, error: null };
  } catch (error: any) {
    console.error("Error in getSingleDoc:", error);
    return { data: null, error: error.message };
  }
}
```

#### createDoc

- What it does: Create a new doc
- Found in: `src/app/actions/doc.ts`

```ts
export async function createDoc(workspaceId: string, title?: string) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // SECURITY: Verify user is a member of this workspace before creating
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { data: null, error: "You don't have access to this workspace" };
    }

    const { data, error } = await supabase
      .from("docs")
      .insert({
        workspace_id: workspaceId,
        title: title || "Untitled Document",
        created_by: user.id,
        last_edited_by: user.id,
        content: {
          type: "doc",
          content: [{ type: "paragraph" }],
        },
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating doc:", error);
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/docs");
    return { data, error: null };
  } catch (error: any) {
    console.error("Error in createDoc:", error);
    return { data: null, error: error.message };
  }
}
```

#### updateDoc

- What it does: Update a doc
- Found in: `src/app/actions/doc.ts`

```ts
export async function updateDoc(
  docId: string,
  updates: {
    title?: string;
    content?: any;
    is_archived?: boolean;
  }
```

#### deleteDoc

- What it does: Delete a doc
- Found in: `src/app/actions/doc.ts`

```ts
export async function deleteDoc(docId: string) {
  const supabase = await createClient();

  try {
    // SECURITY: Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // SECURITY: First get the doc to find its workspace
    const { data: doc } = await supabase
      .from("docs")
      .select("workspace_id")
      .eq("id", docId)
      .single();

    if (!doc) {
      return { error: "Document not found" };
    }

    // SECURITY: Verify user is a member of the doc's workspace
    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return { error: "You don't have access to this document" };
    }

    const { error } = await supabase.from("docs").delete().eq("id", docId);

    if (error) {
      console.error("Error deleting doc:", error);
      return { error: error.message };
    }

    revalidatePath("/dashboard/docs");
    return { error: null };
  } catch (error: any) {
    console.error("Error in deleteDoc:", error);
    return { error: error.message };
  }
}
```

### src/app/actions/entity-properties.ts

#### getEntityProperties

- What it does: Get direct properties for an entity
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function getEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityProperties | null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const definitionIds = Object.values(definitions.byKey).filter(Boolean);
  if (definitionIds.length === 0) return { data: null };

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, property_definition_id, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .in("property_definition_id", definitionIds);

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  if (!data || data.length === 0) return { data: null };

  const props = buildEntityPropertiesFromRows(
    entityType,
    entityId,
    workspaceId,
    data,
    definitions.byId
  );

  return { data: props };
}
```

#### getEntitiesProperties

- What it does: Bulk fetch direct properties for multiple entities of the same type. Returns a map keyed by entity_id.
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function getEntitiesProperties(
  entityType: EntityType,
  entityIds: string[],
  workspaceId: string
): Promise<ActionResult<Record<string, EntityProperties>>> {
  if (entityIds.length === 0) return { data: {} };

  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const definitionIds = Object.values(definitions.byKey).filter(Boolean);
  if (definitionIds.length === 0) return { data: {} };

  const { data, error } = await supabase
    .from("entity_properties")
    .select("id, entity_id, property_definition_id, value, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .in("property_definition_id", definitionIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  const result: Record<string, EntityProperties> = {};
  const grouped = new Map<string, any[]>();
  for (const row of data ?? []) {
    const key = String((row as any).entity_id);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  for (const [id, rows] of grouped.entries()) {
    result[id] = buildEntityPropertiesFromRows(
      entityType,
      id,
      workspaceId,
      rows,
      definitions.byId
    );
  }

  return { data: result };
}
```

#### getEntityPropertiesWithInheritance

- What it does: Get properties with inheritance (direct + inherited from linked entities)
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function getEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertiesWithInheritance>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  // Get direct properties
  const definitionIds = Object.values(definitions.byKey).filter(Boolean);
  const { data: directRows, error: directError } = await supabase
    .from("entity_properties")
    .select("id, property_definition_id, value, created_at, updated_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .in("property_definition_id", definitionIds);
  if (directError) {
    console.error("getEntityPropertiesWithInheritance error:", directError);
    return { error: "Failed to fetch entity properties" };
  }
  const direct =
    directRows && directRows.length > 0
      ? buildEntityPropertiesFromRows(
          entityType,
          entityId,
          workspaceId,
          directRows,
          definitions.byId
        )
      : null;

  // Get entities that link TO this entity (they pass their properties down)
  const { data: incomingLinks } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  const inherited: InheritedEntityProperties[] = [];

  // For each linking entity, get their properties
  for (const link of incomingLinks ?? []) {
    const { data: sourceRows } = await supabase
      .from("entity_properties")
      .select("id, property_definition_id, value, created_at, updated_at")
      .eq("entity_type", link.source_entity_type)
      .eq("entity_id", link.source_entity_id)
      .in("property_definition_id", definitionIds);

    if (!sourceRows || sourceRows.length === 0) continue;

    // Check visibility preference
    const { data: displayPref } = await supabase
      .from("entity_inherited_display")
      .select("is_visible")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("source_entity_type", link.source_entity_type)
      .eq("source_entity_id", link.source_entity_id)
      .maybeSingle();

    const isVisible = displayPref?.is_visible ?? true;

    // Get source entity title
    const sourceTitle = await getEntityTitle(
      link.source_entity_type as EntityType,
      link.source_entity_id
    );

    inherited.push({
      source_entity_type: link.source_entity_type as EntityType,
      source_entity_id: link.source_entity_id,
      source_title: sourceTitle,
      properties: buildEntityPropertiesFromRows(
        link.source_entity_type as EntityType,
        link.source_entity_id,
        workspaceId,
        sourceRows,
        definitions.byId
      ),
      visible: isVisible,
    });
  }

  return {
    data: {
      direct: direct || null,
      inherited,
    },
  };
}
```

#### setEntityProperties

- What it does: Set/update entity properties (upsert)
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function setEntityProperties(
  input: SetEntityPropertiesInput
): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const updates = input.updates;
  const upsertPromises: Promise<any>[] = [];

  if (updates.status !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.status,
        updates.status
      )
    );
  }
  if (updates.priority !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.priority,
        updates.priority
      )
    );
  }
  if (updates.assignee_id !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.assignee_id,
        updates.assignee_id
      )
    );
  }
  if (updates.due_date !== undefined) {
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.due_date,
        updates.due_date
      )
    );
  }
  if (updates.tags !== undefined) {
    const normalizedTags = updates.tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    upsertPromises.push(
      upsertEntityPropertyValue(
        supabase,
        workspaceId,
        input.entity_type,
        input.entity_id,
        definitions.byKey.tags,
        normalizedTags
      )
    );
  }

  const results = await Promise.all(upsertPromises);
  const firstError = results.find((result) => result?.error)?.error;
  if (firstError) {
    console.error("setEntityProperties error:", firstError);
    return { error: "Failed to set entity properties" };
  }

  const refreshed = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in refreshed) return refreshed;
  if (!refreshed.data) return { error: "Failed to set entity properties" };
  const data = refreshed.data;

  // Keep legacy task fields loosely in sync (so existing task UI/queries don't drift).
  // Universal properties are the source of truth.
  if (input.entity_type === "task") {
    const status = (data as any).status as string | null;
    const priority = (data as any).priority as string | null;
    const dueDate = (data as any).due_date as string | null;

    const legacyStatus =
      status === "done"
        ? "done"
        : status === "in_progress"
        ? "in-progress"
        : status === "blocked"
        ? "todo"
        : "todo";

    const legacyPriority =
      priority === "low" || priority === "medium" || priority === "high" || priority === "urgent"
        ? priority
        : "none";

    await supabase
      .from("task_items")
      .update({
        status: legacyStatus,
        priority: legacyPriority,
        due_date: dueDate ?? null,
      })
      .eq("id", input.entity_id);
  }

  return { data };
}
```

#### addTag

- What it does: Add a tag to an entity
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function addTag(input: AddTagInput): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  // Normalize tag (trim and lowercase for matching)
  const normalizedTag = input.tag.trim().toLowerCase();
  if (!normalizedTag) {
    return { error: "Tag cannot be empty" };
  }

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const current = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in current) return current;

  const currentTags = current.data?.tags || [];
  
  // Check for duplicate (case-insensitive)
  if (currentTags.some((t: string) => t.toLowerCase() === normalizedTag)) {
    return { error: "Tag already exists" };
  }

  // Add new tag
  const newTags = [...currentTags, normalizedTag];

  const { error } = await upsertEntityPropertyValue(
    supabase,
    workspaceId,
    input.entity_type,
    input.entity_id,
    definitions.byKey.tags,
    newTags
  );

  if (error) {
    console.error("addTag error:", error);
    return { error: "Failed to add tag" };
  }

  const refreshed = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in refreshed) return refreshed;
  if (!refreshed.data) return { error: "Failed to add tag" };
  return { data: refreshed.data };
}
```

#### removeTag

- What it does: Remove a tag from an entity
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function removeTag(input: RemoveTagInput): Promise<ActionResult<EntityProperties>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error };
  const { supabase, workspaceId } = access;

  const normalizedTag = input.tag.trim().toLowerCase();

  const definitions = await loadFixedPropertyDefinitions(supabase, workspaceId);
  if ("error" in definitions) return { error: definitions.error };

  const existing = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in existing) return existing;

  if (!existing.data) {
    return { error: "Entity properties not found" };
  }

  // Remove tag (case-insensitive match)
  const newTags = (existing.data.tags || []).filter(
    (t: string) => t.toLowerCase() !== normalizedTag
  );

  const { error } = await upsertEntityPropertyValue(
    supabase,
    workspaceId,
    input.entity_type,
    input.entity_id,
    definitions.byKey.tags,
    newTags
  );

  if (error) {
    console.error("removeTag error:", error);
    return { error: "Failed to remove tag" };
  }

  const refreshed = await getEntityProperties(input.entity_type, input.entity_id);
  if ("error" in refreshed) return refreshed;
  if (!refreshed.data) return { error: "Failed to remove tag" };
  return { data: refreshed.data };
}
```

#### clearEntityProperties

- What it does: Clear all properties for an entity
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function clearEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("clearEntityProperties error:", error);
    return { error: "Failed to clear entity properties" };
  }

  // Best-effort sync for tasks: reset legacy fields to defaults
  if (entityType === "task") {
    await supabase
      .from("task_items")
      .update({
        status: "todo",
        priority: "none",
        due_date: null,
      })
      .eq("id", entityId);
  }

  return { data: null };
}
```

#### getWorkspaceMembers

- What it does: Get all members of a workspace
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<ActionResult<WorkspaceMember[]>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("getWorkspaceMembers error:", error);
    return { error: "Failed to fetch workspace members" };
  }

  if (!members || members.length === 0) {
    return { data: [] };
  }

  const userIds = members.map((member: any) => member.user_id).filter(Boolean);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  if (profilesError) {
    console.error("getWorkspaceMembers profiles error:", profilesError);
    const fallback = members.map((member: any) => ({
      id: member.id || member.user_id,
      user_id: member.user_id || member.id,
      workspace_id: member.workspace_id ?? workspaceId,
      name: member.name || member.email || "Unknown",
      email: member.email || "",
      avatar_url: member.avatar_url ?? null,
      role: member.role,
    }));
    return { data: fallback };
  }

  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const transformed = members.map((member: any) => {
    const profile = profileMap.get(member.user_id);
    const name =
      profile?.name ||
      profile?.full_name ||
      profile?.display_name ||
      profile?.username ||
      member.name ||
      profile?.email ||
      member.email ||
      "Unknown";
    return {
      id: member.id || member.user_id,
      user_id: member.user_id || member.id,
      workspace_id: member.workspace_id ?? workspaceId,
      name,
      email: profile?.email || member.email || "",
      avatar_url: profile?.avatar_url ?? member.avatar_url ?? null,
      role: member.role,
    };
  });

  return { data: transformed };
}
```

#### createEntityLink

- What it does: Create a link between two entities (@ mention) Source entity properties will be inherited by target entity
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function createEntityLink(
  input: {
    source_entity_type: EntityType;
    source_entity_id: string;
    target_entity_type: EntityType;
    target_entity_id: string;
    workspace_id: string;
  }
```

#### removeEntityLink

- What it does: Remove a link between two entities
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function removeEntityLink(
  sourceEntityType: EntityType,
  sourceEntityId: string,
  targetEntityType: EntityType,
  targetEntityId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(sourceEntityType, sourceEntityId);
  if ("error" in access) return { error: access.error };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_links")
    .delete()
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", sourceEntityId)
    .eq("target_entity_type", targetEntityType)
    .eq("target_entity_id", targetEntityId);

  if (error) {
    console.error("removeEntityLink error:", error);
    return { error: "Failed to remove entity link" };
  }

  return { data: null };
}
```

#### getEntityLinks

- What it does: Get all links for an entity (both outgoing and incoming)
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function getEntityLinks(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<{ outgoing: any[]; incoming: any[] }
```

#### setInheritedPropertyVisibility

- What it does: Set visibility preference for an inherited property
- Found in: `src/app/actions/entity-properties.ts`

```ts
export async function setInheritedPropertyVisibility(
  input: {
    entity_type: EntityType;
    entity_id: string;
    source_entity_type: EntityType;
    source_entity_id: string;
    is_visible: boolean;
  }
```

### src/app/actions/file.ts

#### uploadFile

- What it does: Upload file to Supabase Storage and create database record Returns file object with storage path and metadata
- Found in: `src/app/actions/file.ts`

```ts
export async function uploadFile(
  formData: FormData,
  workspaceId: string,
  projectId: string,
  blockId?: string // Optional: if we want to attach immediately
) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized to upload to this workspace' };
  }

  // 3. Get file from FormData
  const file = formData.get('file') as File;
  if (!file) {
    return { error: 'No file provided' };
  }

  // 4. SECURITY: Validate file type
  const validationError = validateFileType(file);
  if (validationError) {
    return { error: validationError };
  }

  // 5. Validate file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds 50MB limit' };
  }

  try {
    // 6. Generate unique file ID and construct storage path
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // 7. Create file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up: delete uploaded file if DB insert fails
      await supabase.storage.from('files').remove([storagePath]);
      return { error: `Database error: ${dbError.message}` };
    }

    // 7. If blockId provided, attach file to block immediately
    if (blockId) {
      const attachResult = await attachFileToBlock(fileId, blockId, 'inline');
      if (attachResult.error) {
        // File uploaded but attachment failed - that's okay, return file
        logger.error('File attachment failed:', attachResult.error);
      }
    }

    revalidatePath('/dashboard/projects');
    return { data: fileRecord };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}
```

#### attachFileToBlock

- What it does: Attach an existing file to a block
- Found in: `src/app/actions/file.ts`

```ts
export async function attachFileToBlock(
  fileId: string,
  blockId: string,
  displayMode: 'inline' | 'linked' = 'inline'
) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify file exists and user has access
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, workspace_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 4. Create file attachment
  const { data: attachment, error: attachError } = await supabase
    .from('file_attachments')
    .insert({
      file_id: fileId,
      block_id: blockId,
      display_mode: displayMode,
    })
    .select()
    .single();

  if (attachError) {
    return { error: attachError.message };
  }

  revalidatePath('/dashboard/projects');
  return { data: attachment };
}
```

#### getBlockFiles

- What it does: Get all files attached to a block
- Found in: `src/app/actions/file.ts`

```ts
export async function getBlockFiles(blockId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data: files, error } = await supabase
    .from('file_attachments')
    .select(
      `
      id,
      display_mode,
      file:files (
        id,
        file_name,
        file_size,
        file_type,
        storage_path,
        created_at
      )
    `
    )
    .eq('block_id', blockId);

  if (error) {
    return { error: error.message };
  }

  return { data: files };
}
```

#### deleteFile

- What it does: Delete a file from storage and database
- Found in: `src/app/actions/file.ts`

```ts
export async function deleteFile(fileId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Get file details
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('id, workspace_id, storage_path, uploaded_by')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Check permissions: user is uploader OR admin/owner of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', user.id)
    .single();

  const isUploader = file.uploaded_by === user.id;
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

  if (!isUploader && !isAdmin) {
    return { error: 'Not authorized to delete this file' };
  }

  try {
    // 4. Delete from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([file.storage_path]);

    if (storageError) {
      logger.error('Storage deletion failed:', storageError);
      // Continue anyway - file might already be deleted
    }

    // 5. Delete from database (cascades to file_attachments)
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      return { error: `Database error: ${dbError.message}` };
    }

    revalidatePath('/dashboard/projects');
    return { data: { success: true } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}
```

#### getFileUrl

- What it does: Get download URL for a file
- Found in: `src/app/actions/file.ts`

```ts
export async function getFileUrl(fileId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Get file details
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('storage_path, workspace_id')
    .eq('id', fileId)
    .single();

  if (fileError || !file) {
    return { error: 'File not found' };
  }

  // 3. Verify user has access to workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', file.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 4. SECURITY: Get signed URL (valid for 5 minutes)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('files')
    .createSignedUrl(file.storage_path, 300);

  if (urlError) {
    return { error: urlError.message };
  }

  return { data: { url: urlData.signedUrl } };
}
```

#### getBatchFileUrls

- What it does: Get download URLs for multiple files in a single batched request Reduces database queries from 3N to 2 (where N = number of files)
- Found in: `src/app/actions/file.ts`

```ts
export async function getBatchFileUrls(fileIds: string[]) {
  'use server';

  if (!fileIds || fileIds.length === 0) {
    return { data: {} };
  }

  // Remove duplicates
  const uniqueFileIds = Array.from(new Set(fileIds));

  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', data: {} };
  }

  // 2. Fetch ALL files in ONE query
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('id, storage_path, workspace_id')
    .in('id', uniqueFileIds);

  if (filesError || !files || files.length === 0) {
    return { data: {} };
  }

  // 3. Get workspace ID (assume all files in same workspace for this tab)
  const workspaceId = files[0].workspace_id;

  // 4. ONE membership check for the workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'No workspace access', data: {} };
  }

  // 5. Generate ALL signed URLs in PARALLEL
  const urlPromises = files.map(async (file) => {
    try {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('files')
        .createSignedUrl(file.storage_path, 300); // SECURITY: 5 minute expiry

      if (urlError) {
        logger.error(`Failed to generate signed URL for file ${file.id}:`, urlError);
        return {
          fileId: file.id,
          url: null,
        };
      }

      return {
        fileId: file.id,
        url: urlData?.signedUrl || null,
      };
    } catch (error) {
      logger.error(`Error generating signed URL for file ${file.id}:`, error);
      return {
        fileId: file.id,
        url: null,
      };
    }
  });

  const urlResults = await Promise.all(urlPromises);

  // 6. Return as map: { fileId: signedUrl }
  const urlMap: Record<string, string> = {};
  urlResults.forEach(result => {
    if (result.url) {
      urlMap[result.fileId] = result.url;
    }
  });

  logger.log(`📦 Batch fetched ${Object.keys(urlMap).length} file URLs`);

  return { data: urlMap };
}
```

#### getBatchFileUrlsPublic

- What it does: Batch fetch file URLs for public client pages Uses service role client to bypass RLS
- Found in: `src/app/actions/file.ts`

```ts
export async function getBatchFileUrlsPublic(fileIds: string[], publicToken: string) {
  'use server';
  
  if (!fileIds || fileIds.length === 0) {
    return { data: {} };
  }

  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = await createServiceClient();

  try {
    // 1. Verify public token
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled")
      .eq("public_token", publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (projectError || !project) {
      return { error: 'Invalid public token', data: {} };
    }

    // 2. Remove duplicates
    const uniqueFileIds = Array.from(new Set(fileIds));

    // 3. Fetch all files (verify they belong to the project's workspace)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, storage_path, workspace_id')
      .in('id', uniqueFileIds)
      .eq('workspace_id', project.workspace_id);

    if (filesError || !files || files.length === 0) {
      return { data: {} };
    }

    // 4. Generate signed URLs in parallel
    const urlPromises = files.map(async (file) => {
      try {
        const { data: urlData } = await supabase.storage
          .from('files')
          .createSignedUrl(file.storage_path, 300); // SECURITY: 5 minute expiry

        return {
          fileId: file.id,
          url: urlData?.signedUrl || null
        };
      } catch (error) {
        logger.error(`Failed to generate URL for file ${file.id}:`, error);
        return { fileId: file.id, url: null };
      }
    });

    const urlResults = await Promise.all(urlPromises);

    // 5. Return as map
    const urlMap: Record<string, string> = {};
    urlResults.forEach(result => {
      if (result.url) {
        urlMap[result.fileId] = result.url;
      }
    });

    logger.log(`📦 Public: Batch fetched ${Object.keys(urlMap).length} file URLs`);

    return { data: urlMap };
  } catch (error) {
    logger.error('Get batch file URLs public exception:', error);
    return { error: 'Failed to fetch file URLs', data: {} };
  }
}
```

#### detachFileFromBlock

- What it does: Detach file from block (doesn't delete the file, just the attachment)
- Found in: `src/app/actions/file.ts`

```ts
export async function detachFileFromBlock(attachmentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // Get attachment to verify permissions
  const { data: attachment, error: attachError } = await supabase
    .from('file_attachments')
    .select('file_id, files!inner(workspace_id)')
    .eq('id', attachmentId)
    .single();

  if (attachError || !attachment) {
    return { error: 'Attachment not found' };
  }

  // Verify workspace membership
  const files = attachment.files as { workspace_id: string } | { workspace_id: string }[];
  const workspaceId = Array.isArray(files) ? files[0]?.workspace_id : files.workspace_id;
  
  if (!workspaceId) {
    return { error: 'Workspace not found' };
  }
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // Delete attachment
  const { error: deleteError } = await supabase
    .from('file_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath('/dashboard/projects');
  return { data: { success: true } };
}
```

#### createFileRecord

- What it does: Create file record after storage upload (used by client-side upload) This is called after the file is uploaded to Supabase Storage via client-side
- Found in: `src/app/actions/file.ts`

```ts
export async function createFileRecord(data: {
  fileId: string;
  workspaceId: string;
  projectId: string;
  blockId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
}
```

#### uploadStandaloneFile

- What it does: Upload file without attaching to a block (standalone file)
- Found in: `src/app/actions/file.ts`

```ts
export async function uploadStandaloneFile(
  formData: FormData,
  workspaceId: string,
  projectId: string
) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized to upload to this workspace' };
  }

  // 3. Get file from FormData
  const file = formData.get('file') as File;
  if (!file) {
    return { error: 'No file provided' };
  }

  // 4. SECURITY: Validate file type
  const validationError = validateFileType(file);
  if (validationError) {
    return { error: validationError };
  }

  // 5. Validate file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds 50MB limit' };
  }

  try {
    // 6. Generate unique file ID and construct storage path
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${workspaceId}/${projectId}/${fileId}.${fileExtension}`;

    // 6. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // 7. Create file record in database (without block attachment)
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up: delete uploaded file if DB insert fails
      await supabase.storage.from('files').remove([storagePath]);
      return { error: `Database error: ${dbError.message}` };
    }

    revalidatePath('/dashboard/internal');
    revalidatePath(`/dashboard/internal/${projectId}`);
    return { data: fileRecord };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}
```

#### getProjectFiles

- What it does: Get all standalone files for a project (files not attached to blocks)
- Found in: `src/app/actions/file.ts`

```ts
export async function getProjectFiles(projectId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Get project to verify workspace access
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return { error: 'Project not found' };
  }

  // 3. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 4. Get all files for this project that are NOT attached to any block
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select(`
      id,
      file_name,
      file_size,
      file_type,
      storage_path,
      created_at,
      uploaded_by
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filesError) {
    return { error: filesError.message };
  }

  // 5. Filter out files that are attached to blocks
  const { data: attachments, error: attachmentsError } = await supabase
    .from('file_attachments')
    .select('file_id')
    .in('file_id', files?.map(f => f.id) || []);

  if (attachmentsError) {
    // If we can't check attachments, return all files (safer)
    return { data: files || [] };
  }

  const attachedFileIds = new Set((attachments || []).map(a => a.file_id));
  const standaloneFiles = (files || []).filter(f => !attachedFileIds.has(f.id));

  return { data: standaloneFiles };
}
```

#### getWorkspaceStandaloneFiles

- What it does: Get all standalone files for a workspace (from all internal spaces)
- Found in: `src/app/actions/file.ts`

```ts
export async function getWorkspaceStandaloneFiles(workspaceId: string) {
  const supabase = await createClient();

  // 1. Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // 2. Verify user is member of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return { error: 'Not authorized' };
  }

  // 3. Get all internal spaces for this workspace
  const { data: internalSpaces, error: spacesError } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('project_type', 'internal');

  if (spacesError) {
    return { error: spacesError.message };
  }

  if (!internalSpaces || internalSpaces.length === 0) {
    return { data: [] };
  }

  const spaceIds = internalSpaces.map(s => s.id);

  // 4. Get all files from internal spaces that are NOT attached to any block
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select(`
      id,
      file_name,
      file_size,
      file_type,
      storage_path,
      created_at,
      uploaded_by,
      project_id
    `)
    .in('project_id', spaceIds)
    .order('created_at', { ascending: false });

  if (filesError) {
    return { error: filesError.message };
  }

  if (!files || files.length === 0) {
    return { data: [] };
  }

  // 5. Filter out files that are attached to blocks
  const { data: attachments, error: attachmentsError } = await supabase
    .from('file_attachments')
    .select('file_id')
    .in('file_id', files.map(f => f.id));

  if (attachmentsError) {
    // If we can't check attachments, return all files (safer)
    return { data: files };
  }

  const attachedFileIds = new Set((attachments || []).map(a => a.file_id));
  const standaloneFiles = files.filter(f => !attachedFileIds.has(f.id));

  return { data: standaloneFiles };
}
```

### src/app/actions/payments.ts

#### getAllPayments

- What it does: Performs the "get all payments" action for entity.
- Found in: `src/app/actions/payments.ts`

```ts
export async function getAllPayments(workspaceId: string): Promise<{ data?: Payment[]; error?: string }
```

#### getPaymentById

- What it does: Performs the "get payment by id" action for entity.
- Found in: `src/app/actions/payments.ts`

```ts
export async function getPaymentById(paymentId: string): Promise<{ data?: Payment; error?: string }
```

#### updatePaymentStatus

- What it does: Performs the "update payment status" action for entity.
- Found in: `src/app/actions/payments.ts`

```ts
export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  paidDate?: string
): Promise<{ error?: string }
```

#### formatCurrency

- What it does: Helper function to format currency
- Found in: `src/app/actions/payments.ts`

```ts
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}
```

#### getPaymentStatusColor

- What it does: Helper function to get payment status color
- Found in: `src/app/actions/payments.ts`

```ts
export function getPaymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case "paid":
      return "var(--dome-teal)";
    case "pending":
      return "var(--tram-yellow)";
    case "overdue":
      return "var(--error-red)";
    case "cancelled":
      return "var(--muted-foreground)";
    default:
      return "var(--muted-foreground)";
  }
}
```

### src/app/actions/project.ts

#### createProject

- What it does: 1. CREATE PROJECT
- Found in: `src/app/actions/project.ts`

```ts
export async function createProject(workspaceId: string, projectData: ProjectData) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to create projects' }
  }

  let finalClientId = projectData.client_id;

  // If client_name is provided (new client), create it first
  if (projectData.client_name && !projectData.client_id) {
    const { data: newClient, error: clientCreateError } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: projectData.client_name.trim(),
      })
      .select('id')
      .single();

    if (clientCreateError) {
      return { error: `Failed to create client: ${clientCreateError.message}` };
    }

    finalClientId = newClient.id;
  }
  // If client_id is provided, verify it belongs to the same workspace
  else if (finalClientId) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', finalClientId)
      .single()

    if (clientError) {
      return { error: 'Client not found' }
    }

    if (client.workspace_id !== workspaceId) {
      return { error: 'Client does not belong to this workspace' }
    }
  }

  // Create the project
  const { data: project, error: createError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: projectData.name,
      project_type: projectData.project_type || 'project',
      client_id: finalClientId || null,
      status: projectData.status || 'not_started',
      due_date_date: projectData.due_date_date || null,
      due_date_text: projectData.due_date_text || null
    })
    .select('*, client:clients(name)')
    .single()

  if (createError) {
    return { error: createError.message }
  }

  // Automatically create a default tab named "Untitled"
  const tabResult = await createTab({
    projectId: project.id,
    name: "Untitled",
  });

  if (tabResult.error) {
    // Log error but don't fail project creation if tab creation fails
    console.error("Failed to create default tab:", tabResult.error);
  }

  revalidatePath('/dashboard')
  return { data: project }
}
```

#### getOrCreateFilesSpace

- What it does: Get or create a default "Files" internal space for standalone file uploads
- Found in: `src/app/actions/project.ts`

```ts
export async function getOrCreateFilesSpace(workspaceId: string) {
  const authResult = await getServerUser();

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' };
  }
  const { supabase, user } = authResult;

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !membership) {
    return { error: 'You must be a workspace member' };
  }

  // Try to find existing "Files" space
  const { data: existingSpace, error: findError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('project_type', 'internal')
    .eq('name', 'Files')
    .maybeSingle();

  if (findError) {
    console.error('Error finding Files space:', findError);
    // Continue to create new space
  }

  if (existingSpace) {
    return { data: existingSpace };
  }

  // Create "Files" space if it doesn't exist
  const { data: newSpace, error: createError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: 'Files',
      project_type: 'internal',
      status: 'in_progress',
    })
    .select('id, name')
    .single();

  if (createError) {
    console.error('Error creating Files space:', createError);
    return { error: createError.message };
  }

  // Create a default tab for the Files space
  const { error: tabError } = await supabase
    .from('tabs')
    .insert({
      project_id: newSpace.id,
      name: 'All Files',
      position: 0,
    });

  if (tabError) {
    console.error('Failed to create default tab for Files space:', tabError);
    // Still return the space even if tab creation fails
  }

  revalidatePath('/dashboard/internal');
  return { data: newSpace };
}
```

#### getAllProjects

- What it does: 2. GET ALL PROJECTS (with filters and search) - OPTIMIZED
- Found in: `src/app/actions/project.ts`

```ts
export async function getAllProjects(
  workspaceId: string,
  filters?: ProjectFilters,
  options?: ProjectQueryOptions
) {
  const authResult = await getServerUser()
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to view projects' }
  }

  // 🚀 Build optimized query - select only needed fields
  let query = supabase
    .from('projects')
    .select(`
      id,
      name,
      status,
      due_date_date,
      due_date_text,
      client_id,
      created_at,
      updated_at,
      client:clients (
        id,
        name,
        company
      )
    `)
    .eq('workspace_id', workspaceId)

  // Apply project type filter (defaults to 'project' if not specified)
  if (filters?.project_type !== undefined) {
    query = query.eq('project_type', filters.project_type)
  } else {
    query = query.eq('project_type', 'project')
  }

  // Apply status filter
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  // Apply client filter
  if (filters?.client_id) {
    query = query.eq('client_id', filters.client_id)
  }

  // 🚀 Optimized search - use OR clause in database, not post-fetch filtering
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,client.name.ilike.%${filters.search}%,client.company.ilike.%${filters.search}%`)
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at'
  const sortOrder = filters?.sort_order || 'desc'
  
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  
  // 🚀 Limit results for faster loading (add pagination later if needed)
  query = query.limit(100)

  const { data: projects, error: fetchError } = await query

  if (fetchError) {
    return { error: fetchError.message }
  }

  const normalizedProjects: ProjectRow[] = (projects || []).map((project: any) => {
    const rawClient = Array.isArray(project.client) ? project.client[0] : project.client;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      due_date_date: project.due_date_date,
      due_date_text: project.due_date_text,
      client_id: project.client_id,
      created_at: project.created_at,
      updated_at: project.updated_at,
      client: rawClient
        ? {
            id: rawClient.id,
            name: rawClient.name ?? null,
            company: rawClient.company ?? null,
          }
        : null,
    };
  });

  let enrichedProjects = normalizedProjects

  if (options?.includeFirstTabPreview && enrichedProjects.length > 0) {
    try {
      const projectIds = enrichedProjects.map((project) => project.id)
      const { data: tabs, error: tabsError } = await supabase
        .from('tabs')
        .select('id, project_id, name, position, parent_tab_id')
        .in('project_id', projectIds)
        .is('parent_tab_id', null)
        .order('project_id', { ascending: true })
        .order('position', { ascending: true })

      if (tabsError) {
        console.error('Failed to fetch tabs for previews:', tabsError)
      } else {
        const firstTabByProject = new Map<string, { id: string; name: string }>()
        tabs?.forEach((tab) => {
          if (!firstTabByProject.has(tab.project_id)) {
            firstTabByProject.set(tab.project_id, { id: tab.id, name: tab.name })
          }
        })

        const tabIds = Array.from(firstTabByProject.values()).map((tab) => tab.id)
        const previewBlocksByTab = new Map<string, TabPreviewBlock[]>()

        if (tabIds.length > 0) {
          // Note: Fetches full content JSONB - could be optimized by only selecting specific keys
          // but summarizeBlockPreview() needs the full content object structure
          const { data: blocks, error: blocksError } = await supabase
            .from('blocks')
            .select('id, tab_id, type, content, column, position, parent_block_id')
            .in('tab_id', tabIds)
            .is('parent_block_id', null)
            .lte('position', 3)
            .order('column', { ascending: true })
            .order('position', { ascending: true })

          if (blocksError) {
            console.error('Failed to fetch block previews:', blocksError)
          } else if (blocks && blocks.length > 0) {
            const pdfFileIds = Array.from(
              new Set(
                blocks
                  .filter((block) => block.type === 'pdf')
                  .map((block) => {
                    const content = (block.content ?? {}) as Record<string, any>;
                    const fileId = content?.fileId;
                    return typeof fileId === 'string' ? fileId : null;
                  })
                  .filter((value): value is string => Boolean(value))
              )
            )

            const pdfFileNames = new Map<string, string>()
            if (pdfFileIds.length > 0) {
              const { data: pdfFiles, error: pdfError } = await supabase
                .from('files')
                .select('id, file_name')
                .in('id', pdfFileIds)

              if (pdfError) {
                console.error('Failed to fetch pdf filenames for previews:', pdfError)
              } else {
                pdfFiles?.forEach((file) => {
                  if (file?.id && file?.file_name) {
                    pdfFileNames.set(file.id, file.file_name)
                  }
                })
              }
            }

            const taskBlockIds = blocks
              .filter((block) => block.type === 'task')
              .map((block) => block.id)
            const taskItemsByBlock = new Map<string, Array<{ id: string; title: string; status: string }>>()

            if (taskBlockIds.length > 0) {
              const { data: taskItems, error: taskError } = await supabase
                .from('task_items')
                .select('id, title, status, task_block_id, display_order')
                .in('task_block_id', taskBlockIds)
                .order('display_order', { ascending: true })

              if (taskError) {
                console.error('Failed to fetch task previews:', taskError)
              } else {
                taskItems?.forEach((task) => {
                  const list = taskItemsByBlock.get(task.task_block_id) || []
                  list.push({ id: task.id, title: task.title, status: task.status })
                  taskItemsByBlock.set(task.task_block_id, list)
                })
              }
            }

            blocks.forEach((block) => {
              const preview = summarizeBlockPreview(block as any, { pdfFileNames, taskItemsByBlock })
              const previewEntry: TabPreviewBlock = {
                id: block.id,
                type: block.type as BlockType,
                column: block.column,
                position: block.position,
                summary: preview.summary || block.type,
                detailLines: preview.detailLines,
                meta: preview.meta,
              }

              const existing = previewBlocksByTab.get(block.tab_id) || []
              if (existing.length < 6) {
                existing.push(previewEntry)
                previewBlocksByTab.set(block.tab_id, existing)
              }
            })
          }
        }

        enrichedProjects = enrichedProjects.map((project) => {
          const firstTab = firstTabByProject.get(project.id)
          if (!firstTab) {
            return { ...project, first_tab_preview: null }
          }

          return {
            ...project,
            first_tab_preview: {
              tab_id: firstTab.id,
              tab_name: firstTab.name,
              blocks: previewBlocksByTab.get(firstTab.id) || [],
            },
          }
        })
      }
    } catch (error) {
      console.error('Failed to build project previews:', error)
    }
  }

  return { data: enrichedProjects as ProjectWithPreview[] }
}
```

#### getSingleProject

- What it does: 3. GET SINGLE PROJECT (with full details)
- Found in: `src/app/actions/project.ts`

```ts
export async function getSingleProject(projectId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get project with workspace and client info
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select(`
      *,
      workspace:workspaces (
        id,
        name
      ),
      client:clients (
        id,
        name,
        company,
        email
      )
    `)
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Check if user is a member of the project's workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to view this project' }
  }

  return { data: project }
}
```

#### updateProject

- What it does: 4. UPDATE PROJECT
- Found in: `src/app/actions/project.ts`

```ts
export async function updateProject(projectId: string, updates: Partial<ProjectData>) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get project to find workspace_id
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('workspace_id, client_id')
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: 'Project not found' }
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to update projects' }
  }

  // If updating client_id, verify it belongs to the same workspace
  if (updates.client_id !== undefined && updates.client_id !== null) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', updates.client_id)
      .single()

    if (clientError) {
      return { error: 'Client not found' }
    }

    if (client.workspace_id !== project.workspace_id) {
      return { error: 'Client does not belong to this workspace' }
    }
  }

  // Update the project (including updated_at)
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  return { data: updatedProject }
}
```

#### deleteProject

- What it does: 5. DELETE PROJECT
- Found in: `src/app/actions/project.ts`

```ts
export async function deleteProject(projectId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get project to find workspace_id
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: 'Project not found' }
  }

  // Check if user is admin or owner of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  if (membership.role !== 'admin' && membership.role !== 'owner') {
    return { error: 'Only admins and owners can delete projects' }
  }

  // TODO: In future tasks, check for dependencies (tasks, files, etc.)
  // For now, we'll just delete the project

  // Delete the project
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  revalidatePath('/dashboard')
  return { data: { success: true, message: 'Project deleted successfully' } }
}
```

### src/app/actions/properties/context.ts

#### requireWorkspaceAccessForProperties

- What it does: Ensures a user can act within a workspace (used for create/read flows).
- Found in: `src/app/actions/properties/context.ts`

```ts
export async function requireWorkspaceAccessForProperties(
  workspaceId: string
): Promise<WorkspaceAccessContext | { error: string }
```

#### requirePropertyDefinitionAccess

- What it does: Fetches property definition and ensures the requesting user belongs to its workspace.
- Found in: `src/app/actions/properties/context.ts`

```ts
export async function requirePropertyDefinitionAccess(
  definitionId: string
): Promise<PropertyDefinitionAccessContext | { error: string }
```

#### getWorkspaceIdForEntity

- What it does: Gets workspace_id for any entity type. Used to validate workspace membership before property operations.
- Found in: `src/app/actions/properties/context.ts`

```ts
export async function getWorkspaceIdForEntity(
  entityType: EntityType,
  entityId: string
): Promise<string | null> {
  const supabase = await createClient();

  switch (entityType) {
    case "block": {
      const { data } = await supabase
        .from("blocks")
        .select("tab_id, tabs!inner(project_id, projects!inner(workspace_id))")
        .eq("id", entityId)
        .maybeSingle();
      return (data?.tabs as any)?.projects?.workspace_id ?? null;
    }

    case "task": {
      const { data } = await supabase
        .from("task_items")
        .select("workspace_id")
        .eq("id", entityId)
        .maybeSingle();
      return data?.workspace_id ?? null;
    }

    case "timeline_event": {
      const { data } = await supabase
        .from("timeline_events")
        .select("workspace_id")
        .eq("id", entityId)
        .maybeSingle();
      return data?.workspace_id ?? null;
    }

    case "table_row": {
      const { data } = await supabase
        .from("table_rows")
        .select("table_id, tables!inner(workspace_id)")
        .eq("id", entityId)
        .maybeSingle();
      return (data?.tables as any)?.workspace_id ?? null;
    }

    default:
      return null;
  }
}
```

#### requireEntityAccess

- What it does: Ensures the user has access to perform operations on a specific entity.
- Found in: `src/app/actions/properties/context.ts`

```ts
export async function requireEntityAccess(
  entityType: EntityType,
  entityId: string
): Promise<WorkspaceAccessContext | { error: string }
```

### src/app/actions/properties/definition-actions.ts

#### getPropertyDefinitions

- What it does: Get all property definitions for a workspace.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function getPropertyDefinitions(
  workspaceId: string
): Promise<ActionResult<PropertyDefinition[]>> {
  const access = await requireWorkspaceAccessForProperties(workspaceId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getPropertyDefinitions error:", error);
    return { error: "Failed to fetch property definitions" };
  }

  return { data: data ?? [] };
}
```

#### getPropertyDefinition

- What it does: Get a single property definition by ID.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function getPropertyDefinition(
  definitionId: string
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (error || !data) {
    return { error: "Property definition not found" };
  }

  return { data };
}
```

#### createPropertyDefinition

- What it does: Create a new property definition. Checks for similar existing names to prevent duplicates like "Q1 Budget" vs "q1-budget".
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function createPropertyDefinition(
  input: CreatePropertyDefinitionInput
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requireWorkspaceAccessForProperties(input.workspace_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Check for similar existing property names
  const { data: existingDefs } = await supabase
    .from("property_definitions")
    .select("name")
    .eq("workspace_id", input.workspace_id);

  if (existingDefs) {
    const existingNames = existingDefs.map((d) => d.name);
    const similarName = isSimilarPropertyName(input.name, existingNames);
    if (similarName) {
      return {
        error: `A similar property "${similarName}" already exists. Please use a different name.`,
      };
    }
  }

  const { data, error } = await supabase
    .from("property_definitions")
    .insert({
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      type: input.type,
      options: input.options ?? [],
    })
    .select("*")
    .single();

  if (error) {
    console.error("createPropertyDefinition error:", error);
    if (error.code === "23505") {
      return { error: "A property with this name already exists" };
    }
    return { error: "Failed to create property definition" };
  }

  return { data };
}
```

#### updatePropertyDefinition

- What it does: Update a property definition (name and/or options).
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function updatePropertyDefinition(
  definitionId: string,
  updates: UpdatePropertyDefinitionInput
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, definition } = access;

  // If updating name, check for duplicates
  if (updates.name !== undefined) {
    const { data: existingDefs } = await supabase
      .from("property_definitions")
      .select("name")
      .eq("workspace_id", definition.workspace_id)
      .neq("id", definitionId);

    if (existingDefs) {
      const existingNames = existingDefs.map((d) => d.name);
      const similarName = isSimilarPropertyName(updates.name, existingNames);
      if (similarName) {
        return {
          error: `A similar property "${similarName}" already exists. Please use a different name.`,
        };
      }
    }
  }

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.options !== undefined) payload.options = updates.options;

  if (Object.keys(payload).length === 0) {
    // Nothing to update, return current definition
    const { data } = await supabase
      .from("property_definitions")
      .select("*")
      .eq("id", definitionId)
      .single();
    return { data };
  }

  const { data, error } = await supabase
    .from("property_definitions")
    .update(payload)
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error) {
    console.error("updatePropertyDefinition error:", error);
    if (error.code === "23505") {
      return { error: "A property with this name already exists" };
    }
    return { error: "Failed to update property definition" };
  }

  return { data };
}
```

#### deletePropertyDefinition

- What it does: Delete a property definition. Cascades to delete all entity_properties using this definition.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function deletePropertyDefinition(
  definitionId: string
): Promise<ActionResult<null>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase
    .from("property_definitions")
    .delete()
    .eq("id", definitionId);

  if (error) {
    console.error("deletePropertyDefinition error:", error);
    return { error: "Failed to delete property definition" };
  }

  return { data: null };
}
```

#### mergePropertyOptions

- What it does: Merge duplicate option values within a select/multi_select property. All entities with sourceValue will be updated to targetValue.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function mergePropertyOptions(
  definitionId: string,
  sourceValue: string,
  targetValue: string
): Promise<ActionResult<{ updated_count: number }
```

#### addPropertyOption

- What it does: Add an option to a select/multi_select property definition.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function addPropertyOption(
  definitionId: string,
  option: PropertyOption
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get current definition
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  if (propDef.type !== "select" && propDef.type !== "multi_select") {
    return { error: "Options are only supported for select and multi_select properties" };
  }

  const currentOptions = (propDef.options as PropertyOption[]) ?? [];

  // Check for duplicate option id
  if (currentOptions.some((opt) => opt.id === option.id)) {
    return { error: "An option with this ID already exists" };
  }

  const updatedOptions = [...currentOptions, option];

  const { data, error } = await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("addPropertyOption error:", error);
    return { error: "Failed to add property option" };
  }

  return { data };
}
```

#### updatePropertyOption

- What it does: Update an option within a select/multi_select property definition.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function updatePropertyOption(
  definitionId: string,
  optionId: string,
  updates: Partial<Omit<PropertyOption, "id">>
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get current definition
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  const currentOptions = (propDef.options as PropertyOption[]) ?? [];
  const optionIndex = currentOptions.findIndex((opt) => opt.id === optionId);

  if (optionIndex === -1) {
    return { error: "Option not found" };
  }

  const updatedOptions = [...currentOptions];
  updatedOptions[optionIndex] = {
    ...updatedOptions[optionIndex],
    ...updates,
  };

  const { data, error } = await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("updatePropertyOption error:", error);
    return { error: "Failed to update property option" };
  }

  return { data };
}
```

#### removePropertyOption

- What it does: Remove an option from a select/multi_select property definition. Does NOT remove the value from existing entity_properties.
- Found in: `src/app/actions/properties/definition-actions.ts`

```ts
export async function removePropertyOption(
  definitionId: string,
  optionId: string
): Promise<ActionResult<PropertyDefinition>> {
  const access = await requirePropertyDefinitionAccess(definitionId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get current definition
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", definitionId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  const currentOptions = (propDef.options as PropertyOption[]) ?? [];
  const updatedOptions = currentOptions.filter((opt) => opt.id !== optionId);

  const { data, error } = await supabase
    .from("property_definitions")
    .update({ options: updatedOptions })
    .eq("id", definitionId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("removePropertyOption error:", error);
    return { error: "Failed to remove property option" };
  }

  return { data };
}
```

### src/app/actions/properties/entity-link-actions.ts

#### createEntityLink

- What it does: Create a link between two entities. The source entity "links to" / "mentions" the target entity. Properties from the source entity will be inherited by the target.
- Found in: `src/app/actions/properties/entity-link-actions.ts`

```ts
export async function createEntityLink(
  input: CreateEntityLinkInput
): Promise<ActionResult<EntityLink>> {
  // Verify source entity access
  const sourceAccess = await requireEntityAccess(
    input.source_entity_type,
    input.source_entity_id
  );
  if ("error" in sourceAccess) return { error: sourceAccess.error ?? "Unknown error" };

  // Verify target entity exists and is in the same workspace
  const targetWorkspaceId = await getWorkspaceIdForEntity(
    input.target_entity_type,
    input.target_entity_id
  );

  if (!targetWorkspaceId) {
    return { error: "Target entity not found" };
  }

  if (targetWorkspaceId !== sourceAccess.workspaceId) {
    return { error: "Cannot link entities from different workspaces" };
  }

  // Prevent self-links
  if (
    input.source_entity_type === input.target_entity_type &&
    input.source_entity_id === input.target_entity_id
  ) {
    return { error: "Cannot link an entity to itself" };
  }

  const { supabase } = sourceAccess;

  const { data, error } = await supabase
    .from("entity_links")
    .insert({
      source_entity_type: input.source_entity_type,
      source_entity_id: input.source_entity_id,
      target_entity_type: input.target_entity_type,
      target_entity_id: input.target_entity_id,
      workspace_id: sourceAccess.workspaceId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createEntityLink error:", error);
    if (error.code === "23505") {
      return { error: "This link already exists" };
    }
    return { error: "Failed to create entity link" };
  }

  return { data };
}
```

#### removeEntityLink

- What it does: Remove a link between two entities.
- Found in: `src/app/actions/properties/entity-link-actions.ts`

```ts
export async function removeEntityLink(
  sourceEntityType: EntityType,
  sourceEntityId: string,
  targetEntityType: EntityType,
  targetEntityId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(sourceEntityType, sourceEntityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_links")
    .delete()
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", sourceEntityId)
    .eq("target_entity_type", targetEntityType)
    .eq("target_entity_id", targetEntityId);

  if (error) {
    console.error("removeEntityLink error:", error);
    return { error: "Failed to remove entity link" };
  }

  return { data: null };
}
```

#### getEntityLinks

- What it does: Get all links for an entity (both outgoing and incoming).
- Found in: `src/app/actions/properties/entity-link-actions.ts`

```ts
export async function getEntityLinks(
  entityType: EntityType,
  entityId: string
): Promise<
  ActionResult<{
    outgoing: EntityLink[];
    incoming: EntityLink[];
  }
```

#### getLinkedEntities

- What it does: Get entities that this entity links to (outgoing references).
- Found in: `src/app/actions/properties/entity-link-actions.ts`

```ts
export async function getLinkedEntities(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: links, error } = await supabase
    .from("entity_links")
    .select("target_entity_type, target_entity_id")
    .eq("source_entity_type", entityType)
    .eq("source_entity_id", entityId);

  if (error) {
    console.error("getLinkedEntities error:", error);
    return { error: "Failed to fetch linked entities" };
  }

  const references: EntityReference[] = [];

  for (const link of links ?? []) {
    const ref = await resolveEntityReference(
      link.target_entity_type as EntityType,
      link.target_entity_id,
      supabase
    );
    if (ref) {
      references.push(ref);
    }
  }

  return { data: references };
}
```

#### getLinkingEntities

- What it does: Get entities that link to this entity (incoming references).
- Found in: `src/app/actions/properties/entity-link-actions.ts`

```ts
export async function getLinkingEntities(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: links, error } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  if (error) {
    console.error("getLinkingEntities error:", error);
    return { error: "Failed to fetch linking entities" };
  }

  const references: EntityReference[] = [];

  for (const link of links ?? []) {
    const ref = await resolveEntityReference(
      link.source_entity_type as EntityType,
      link.source_entity_id,
      supabase
    );
    if (ref) {
      references.push(ref);
    }
  }

  return { data: references };
}
```

#### searchLinkableEntities

- What it does: Search for entities that can be linked (for @ mention picker). Returns recent entities matching the search query.
- Found in: `src/app/actions/properties/entity-link-actions.ts`

```ts
export async function searchLinkableEntities(
  workspaceId: string,
  query: string,
  entityTypes?: EntityType[],
  limit: number = 10
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireWorkspaceAccessForProperties(workspaceId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const types = entityTypes ?? ["block", "task", "timeline_event", "table_row"];
  const results: EntityReference[] = [];
  const searchQuery = query.toLowerCase().trim();

  // Search blocks
  if (types.includes("block") && results.length < limit) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select(
        `
        id,
        type,
        content,
        tabs!inner(
          id,
          title,
          project_id,
          projects!inner(workspace_id)
        )
      `
      )
      .eq("tabs.projects.workspace_id", workspaceId)
      .limit(limit - results.length);

    for (const block of blocks ?? []) {
      const title = getBlockTitle(block);
      if (!searchQuery || title.toLowerCase().includes(searchQuery)) {
        results.push({
          type: "block",
          id: block.id,
          title,
          context: (block.tabs as any)?.title ?? "",
        });
      }
    }
  }

  // Search tasks
  if (types.includes("task") && results.length < limit) {
    const { data: tasks } = await supabase
      .from("task_items")
      .select("id, title, tab_id, tabs(title)")
      .eq("workspace_id", workspaceId)
      .ilike("title", `%${searchQuery}%`)
      .limit(limit - results.length);

    for (const task of tasks ?? []) {
      results.push({
        type: "task",
        id: task.id,
        title: task.title,
        context: (task.tabs as any)?.title ?? "",
      });
    }
  }

  // Search timeline events
  if (types.includes("timeline_event") && results.length < limit) {
    const { data: events } = await supabase
      .from("timeline_events")
      .select("id, title, timeline_block_id")
      .eq("workspace_id", workspaceId)
      .ilike("title", `%${searchQuery}%`)
      .limit(limit - results.length);

    for (const event of events ?? []) {
      results.push({
        type: "timeline_event",
        id: event.id,
        title: event.title,
        context: "Timeline",
      });
    }
  }

  // Search table rows
  if (types.includes("table_row") && results.length < limit) {
    const { data: rows } = await supabase
      .from("table_rows")
      .select(
        `
        id,
        data,
        tables!inner(
          id,
          title,
          workspace_id,
          table_fields(id, name, is_primary)
        )
      `
      )
      .eq("tables.workspace_id", workspaceId)
      .limit(limit - results.length);

    for (const row of rows ?? []) {
      const title = getTableRowTitle(row);
      if (!searchQuery || title.toLowerCase().includes(searchQuery)) {
        const table = Array.isArray(row.tables) ? row.tables[0] : row.tables;
        results.push({
          type: "table_row",
          id: row.id,
          title,
          context: table?.title ?? "Table",
        });
      }
    }
  }

  return { data: results.slice(0, limit) };
}
```

### src/app/actions/properties/entity-property-actions.ts

#### getEntityProperties

- What it does: Get direct properties on an entity (without inheritance).
- Found in: `src/app/actions/properties/entity-property-actions.ts`

```ts
export async function getEntityProperties(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertyWithDefinition[]>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("entity_properties")
    .select(`
      *,
      definition:property_definitions(*)
    `)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("getEntityProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  // Transform to proper type
  const properties: EntityPropertyWithDefinition[] = (data ?? []).map((row) => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    property_definition_id: row.property_definition_id,
    value: row.value,
    workspace_id: row.workspace_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    definition: row.definition as PropertyDefinition,
  }));

  return { data: properties };
}
```

#### setEntityProperty

- What it does: Set/upsert a property value on an entity.
- Found in: `src/app/actions/properties/entity-property-actions.ts`

```ts
export async function setEntityProperty(
  input: SetEntityPropertyInput
): Promise<ActionResult<EntityProperty>> {
  const access = await requireEntityAccess(input.entity_type, input.entity_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, workspaceId } = access;

  // Verify the property definition belongs to this workspace
  const { data: definition, error: defError } = await supabase
    .from("property_definitions")
    .select("id, workspace_id")
    .eq("id", input.property_definition_id)
    .maybeSingle();

  if (defError || !definition) {
    return { error: "Property definition not found" };
  }

  if (definition.workspace_id !== workspaceId) {
    return { error: "Property definition does not belong to this workspace" };
  }

  // Upsert the property value
  const { data, error } = await supabase
    .from("entity_properties")
    .upsert(
      {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        property_definition_id: input.property_definition_id,
        value: input.value,
        workspace_id: workspaceId,
      },
      {
        onConflict: "entity_type,entity_id,property_definition_id",
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("setEntityProperty error:", error);
    return { error: "Failed to set entity property" };
  }

  return { data };
}
```

#### removeEntityProperty

- What it does: Remove a property from an entity.
- Found in: `src/app/actions/properties/entity-property-actions.ts`

```ts
export async function removeEntityProperty(
  entityType: EntityType,
  entityId: string,
  propertyDefinitionId: string
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase
    .from("entity_properties")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("property_definition_id", propertyDefinitionId);

  if (error) {
    console.error("removeEntityProperty error:", error);
    return { error: "Failed to remove entity property" };
  }

  return { data: null };
}
```

#### getEntityPropertiesWithInheritance

- What it does: Get properties with inheritance (direct + inherited from linked entities).
- Found in: `src/app/actions/properties/entity-property-actions.ts`

```ts
export async function getEntityPropertiesWithInheritance(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<EntityPropertiesResult>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, workspaceId } = access;

  // Get direct properties
  const { data: directData, error: directError } = await supabase
    .from("entity_properties")
    .select(`
      *,
      definition:property_definitions(*)
    `)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (directError) {
    console.error("getEntityPropertiesWithInheritance direct error:", directError);
    return { error: "Failed to fetch direct properties" };
  }

  const direct: EntityPropertyWithDefinition[] = (directData ?? []).map((row) => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    property_definition_id: row.property_definition_id,
    value: row.value,
    workspace_id: row.workspace_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    definition: row.definition as PropertyDefinition,
  }));

  // Get entities that link TO this entity (they pass their properties down)
  const { data: incomingLinks, error: linksError } = await supabase
    .from("entity_links")
    .select("source_entity_type, source_entity_id")
    .eq("target_entity_type", entityType)
    .eq("target_entity_id", entityId);

  if (linksError) {
    console.error("getEntityPropertiesWithInheritance links error:", linksError);
    return { error: "Failed to fetch entity links" };
  }

  const inherited: InheritedProperty[] = [];

  // For each linking entity, get their properties
  for (const link of incomingLinks ?? []) {
    const { data: sourceProps } = await supabase
      .from("entity_properties")
      .select(`
        *,
        definition:property_definitions(*)
      `)
      .eq("entity_type", link.source_entity_type)
      .eq("entity_id", link.source_entity_id);

    // Get visibility preferences for these inherited properties
    const { data: displayPrefs } = await supabase
      .from("entity_inherited_display")
      .select("property_definition_id, is_visible")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("source_entity_type", link.source_entity_type)
      .eq("source_entity_id", link.source_entity_id);

    const visibilityMap = new Map(
      (displayPrefs ?? []).map((pref) => [pref.property_definition_id, pref.is_visible])
    );

    for (const prop of sourceProps ?? []) {
      // Skip if this property is already directly set on the entity
      if (direct.some((d) => d.property_definition_id === prop.property_definition_id)) {
        continue;
      }

      // Check if this inherited property is visible (default to true)
      const isVisible = visibilityMap.get(prop.property_definition_id) ?? true;

      inherited.push({
        property: {
          id: prop.id,
          entity_type: prop.entity_type,
          entity_id: prop.entity_id,
          property_definition_id: prop.property_definition_id,
          value: prop.value,
          workspace_id: prop.workspace_id,
          created_at: prop.created_at,
          updated_at: prop.updated_at,
          definition: prop.definition as PropertyDefinition,
        },
        source: {
          entity_type: link.source_entity_type as EntityType,
          entity_id: link.source_entity_id,
        },
        is_visible: isVisible,
      });
    }
  }

  return { data: { direct, inherited } };
}
```

#### getEntitiesProperties

- What it does: Bulk get properties for multiple entities of the same type.
- Found in: `src/app/actions/properties/entity-property-actions.ts`

```ts
export async function getEntitiesProperties(
  entityType: EntityType,
  entityIds: string[]
): Promise<ActionResult<Map<string, EntityPropertyWithDefinition[]>>> {
  if (entityIds.length === 0) {
    return { data: new Map() };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entity_properties")
    .select(`
      *,
      definition:property_definitions(*)
    `)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("getEntitiesProperties error:", error);
    return { error: "Failed to fetch entity properties" };
  }

  const result = new Map<string, EntityPropertyWithDefinition[]>();

  // Initialize empty arrays for all requested IDs
  for (const id of entityIds) {
    result.set(id, []);
  }

  // Group properties by entity_id
  for (const row of data ?? []) {
    const props = result.get(row.entity_id) ?? [];
    props.push({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      property_definition_id: row.property_definition_id,
      value: row.value,
      workspace_id: row.workspace_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      definition: row.definition as PropertyDefinition,
    });
    result.set(row.entity_id, props);
  }

  return { data: result };
}
```

#### setInheritedPropertyVisibility

- What it does: Set inherited property visibility preference.
- Found in: `src/app/actions/properties/entity-property-actions.ts`

```ts
export async function setInheritedPropertyVisibility(
  entityType: EntityType,
  entityId: string,
  sourceEntityType: EntityType,
  sourceEntityId: string,
  propertyDefinitionId: string,
  isVisible: boolean
): Promise<ActionResult<null>> {
  const access = await requireEntityAccess(entityType, entityId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("entity_inherited_display").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      property_definition_id: propertyDefinitionId,
      is_visible: isVisible,
    },
    {
      onConflict:
        "entity_type,entity_id,source_entity_type,source_entity_id,property_definition_id",
    }
  );

  if (error) {
    console.error("setInheritedPropertyVisibility error:", error);
    return { error: "Failed to update visibility preference" };
  }

  return { data: null };
}
```

### src/app/actions/properties/query-actions.ts

#### queryEntities

- What it does: Query entities matching property criteria. Joins through the hierarchy to resolve workspace context for each entity type.
- Found in: `src/app/actions/properties/query-actions.ts`

```ts
export async function queryEntities(
  params: QueryEntitiesParams
): Promise<ActionResult<EntityReference[]>> {
  const access = await requireWorkspaceAccessForProperties(params.workspace_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const entityTypes = params.entity_types ?? [
    "block",
    "task",
    "timeline_event",
    "table_row",
  ];
  const results: EntityReference[] = [];

  // Query each entity type
  for (const entityType of entityTypes) {
    const entities = await queryEntitiesByType(
      supabase,
      entityType,
      params
    );
    results.push(...entities);
  }

  return { data: results };
}
```

#### queryEntitiesGroupedBy

- What it does: Query entities and group them by a property value. IMPORTANT: Always includes entities without the property in a "No Status" / "Unassigned" group.
- Found in: `src/app/actions/properties/query-actions.ts`

```ts
export async function queryEntitiesGroupedBy(
  params: QueryEntitiesParams,
  groupByPropertyId: string
): Promise<ActionResult<GroupedEntitiesResult[]>> {
  const access = await requireWorkspaceAccessForProperties(params.workspace_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  // Get the property definition for grouping
  const { data: propDef, error: defError } = await supabase
    .from("property_definitions")
    .select("*")
    .eq("id", groupByPropertyId)
    .single();

  if (defError || !propDef) {
    return { error: "Property definition not found" };
  }

  // Get all entities matching the base query (without property filters for grouping)
  const entitiesResult = await queryEntities({
    ...params,
    properties: params.properties?.filter(
      (p) => p.property_definition_id !== groupByPropertyId
    ),
  });

  if ("error" in entitiesResult) return entitiesResult;
  const allEntities = entitiesResult.data;

  // Get property values for all entities
  const entityIds = allEntities.map((e) => e.id);
  const { data: entityProps } = await supabase
    .from("entity_properties")
    .select("entity_type, entity_id, value")
    .eq("property_definition_id", groupByPropertyId)
    .in("entity_id", entityIds);

  // Create a map of entity -> property value
  const valueMap = new Map<string, unknown>();
  for (const prop of entityProps ?? []) {
    const key = `${prop.entity_type}:${prop.entity_id}`;
    valueMap.set(key, prop.value);
  }

  // Group entities by property value
  const groups = new Map<string, EntityReference[]>();

  // Initialize groups based on property type
  if (propDef.type === "select" || propDef.type === "multi_select") {
    const options = (propDef.options as PropertyOption[]) ?? [];
    // Initialize groups for each option
    for (const option of options) {
      groups.set(option.id, []);
    }
  }
  // Always have a "no value" group
  groups.set("__no_value__", []);

  // Assign entities to groups
  for (const entity of allEntities) {
    const key = `${entity.type}:${entity.id}`;
    const value = valueMap.get(key);

    if (value === null || value === undefined) {
      // Entity doesn't have this property
      const noValue = groups.get("__no_value__") ?? [];
      noValue.push(entity);
      groups.set("__no_value__", noValue);
    } else if (propDef.type === "multi_select" && Array.isArray(value)) {
      // Multi-select: entity can be in multiple groups
      for (const val of value) {
        const group = groups.get(val) ?? [];
        group.push(entity);
        groups.set(val, group);
      }
      // If no values in array, put in no value group
      if (value.length === 0) {
        const noValue = groups.get("__no_value__") ?? [];
        noValue.push(entity);
        groups.set("__no_value__", noValue);
      }
    } else {
      // Single value (select, text, etc.)
      const groupKey = String(value);
      const group = groups.get(groupKey) ?? [];
      group.push(entity);
      groups.set(groupKey, group);
    }
  }

  // Convert to result format with labels
  const results: GroupedEntitiesResult[] = [];

  // Add option groups first (in order)
  if (propDef.type === "select" || propDef.type === "multi_select") {
    const options = (propDef.options as PropertyOption[]) ?? [];
    for (const option of options) {
      const entities = groups.get(option.id) ?? [];
      results.push({
        group_key: option.id,
        group_label: option.label,
        entities,
      });
    }
  } else {
    // For other types, create groups from actual values
    for (const [key, entities] of groups.entries()) {
      if (key !== "__no_value__" && entities.length > 0) {
        results.push({
          group_key: key,
          group_label: key,
          entities,
        });
      }
    }
  }

  // Always add "No Value" group at the end
  const noValueEntities = groups.get("__no_value__") ?? [];
  results.push({
    group_key: "__no_value__",
    group_label: getNoValueLabel(propDef.name),
    entities: noValueEntities,
  });

  return { data: results };
}
```

### src/app/actions/revalidate-client-page.ts

#### revalidateClientPages

- What it does: Revalidates public client pages whenever project content changes. Called by block mutations so public links stay in sync with the dashboard. Revalidation only runs when the project has client pages enabled and a public token. When a tab ID is provided, the helper revalidates the tab route only if that tab is client-visible. @param projectId Project to revalidate @param tabId Optional tab scope @param options Optional cached project info to avoid extra DB lookups
- Found in: `src/app/actions/revalidate-client-page.ts`

```ts
export async function revalidateClientPages(
  projectId: string,
  tabId?: string,
  options?: { publicToken?: string; clientPageEnabled?: boolean }
```

### src/app/actions/tab.ts

#### createTab

- What it does: ============================================================================
- Found in: `src/app/actions/tab.ts`

```ts
export async function createTab(data: {
  projectId: string;
  name: string;
  parentTabId?: string | null;
}
```

#### getProjectTabs

- What it does: ============================================================================
- Found in: `src/app/actions/tab.ts`

```ts
export async function getProjectTabs(projectId: string) {
  try {
    const supabase = await createClient();

    // 🔒 Auth check FIRST
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 🔒 Verify project access
    const project = await getProjectMetadata(projectId);
    if (!project) {
      return { error: "Project not found" };
    }

    // 🔒 Verify membership BEFORE fetching tabs
    const member = await checkWorkspaceMembership(project.workspace_id, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // ✅ Auth verified - NOW safe to fetch tabs
    // 🚀 Add limit for safety (most projects won't have 1000+ tabs)
    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, project_id, parent_tab_id, name, position, is_client_visible, client_title, created_at")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .limit(TABS_PER_PROJECT_LIMIT);

    if (tabsError) {
      console.error("Get tabs error:", tabsError);
      return { error: "Failed to fetch tabs" };
    }

    // Build hierarchy in memory (still fast for reasonable # of tabs)
    const tabsWithChildren = buildTabHierarchy(tabs || []);

    return { data: tabsWithChildren };
  } catch (error) {
    console.error("Get project tabs exception:", error);
    return { error: "Failed to fetch tabs" };
  }
}
```

#### updateTab

- What it does: ============================================================================
- Found in: `src/app/actions/tab.ts`

```ts
export async function updateTab(data: {
  tabId: string;
  name?: string;
  parentTabId?: string | null;
}
```

#### reorderTabs

- What it does: ============================================================================
- Found in: `src/app/actions/tab.ts`

```ts
export async function reorderTabs(data: {
  tabIds: string[];
  projectId: string;
  parentTabId?: string | null;
}
```

#### deleteTab

- What it does: ============================================================================
- Found in: `src/app/actions/tab.ts`

```ts
export async function deleteTab(tabId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // 2. Get tab with its project's workspace_id
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select(
        `
        *,
        project:projects!inner(id, workspace_id)
      `
      )
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    // 3. Verify user is admin or owner (only they can delete)
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", tab.project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    if (member.role !== "admin" && member.role !== "owner") {
      return { error: "Only admins and owners can delete tabs" };
    }

    // 4. Get all descendant tabs (recursive)
    // 4. Get all descendant tabs (recursive)
    const descendantIds = await getAllDescendantTabIds(supabase, tabId);
    const allTabIds = [tabId, ...descendantIds];

    // 5. Delete all blocks in all these tabs
    // (Comments on blocks will be cascade deleted if foreign key is set up with ON DELETE CASCADE)
    const { error: blocksError } = await supabase
      .from("blocks")
      .delete()
      .in("tab_id", allTabIds);

    if (blocksError) {
      console.error("Delete blocks error:", blocksError);
      return { error: "Failed to delete tab content" };
    }

    // 6. Delete all tabs (including descendants)
    const { error: deleteError } = await supabase
      .from("tabs")
      .delete()
      .in("id", allTabIds);

    if (deleteError) {
      console.error("Delete tabs error:", deleteError);
      return { error: "Failed to delete tabs" };
    }

    // 7. Update positions of remaining sibling tabs
    const { data: remainingSiblings } = await supabase
      .from("tabs")
      .select("*")
      .eq("project_id", tab.project_id)
      .eq("parent_tab_id", tab.parent_tab_id || null)
      .order("position", { ascending: true });

    if (remainingSiblings && remainingSiblings.length > 0) {
      const updates = remainingSiblings.map((sibling, index) => {
        return supabase
          .from("tabs")
          .update({ position: index })
          .eq("id", sibling.id);
      });

      await Promise.all(updates);
    }

    // Revalidate paths to ensure UI updates immediately
    revalidatePath(`/dashboard/projects/${tab.project_id}`);
    // Revalidate all tab pages for this project (since we don't know which ones exist)
    // The project page revalidation will ensure the tab bar updates

    return { data: { success: true, deletedCount: allTabIds.length, projectId: tab.project_id } };
  } catch (error) {
    console.error("Delete tab exception:", error);
    return { error: "Failed to delete tab" };
  }
}
```

### src/app/actions/tables/bulk-actions.ts

#### bulkUpdateRows

- What it does: Performs the "bulk update rows" action for table.
- Found in: `src/app/actions/tables/bulk-actions.ts`

```ts
export async function bulkUpdateRows(input: {
  tableId: string;
  rowIds: string[];
  updates: Record<string, unknown>;
}
```

#### bulkDeleteRows

- What it does: Performs the "bulk delete rows" action for table.
- Found in: `src/app/actions/tables/bulk-actions.ts`

```ts
export async function bulkDeleteRows(input: {
  tableId: string;
  rowIds: string[];
}
```

#### bulkDuplicateRows

- What it does: Performs the "bulk duplicate rows" action for table.
- Found in: `src/app/actions/tables/bulk-actions.ts`

```ts
export async function bulkDuplicateRows(input: {
  tableId: string;
  rowIds: string[];
}
```

#### bulkInsertRows

- What it does: Performs the "bulk insert rows" action for table.
- Found in: `src/app/actions/tables/bulk-actions.ts`

```ts
export async function bulkInsertRows(input: {
  tableId: string;
  rows: Array<{ data: Record<string, unknown>; order?: number | string | null }>;
}
```

### src/app/actions/tables/bulk-operations.ts

#### bulkUpdateRows

- What it does: Bulk update multiple rows
- Found in: `src/app/actions/tables/bulk-operations.ts`

```ts
export async function bulkUpdateRows(
  rowIds: string[],
  updates: Record<string, any>
) {
  const supabase = await createClient();

  try {
    // Get current row data
    const { data: rows } = await supabase
      .from('table_rows')
      .select('id, data')
      .in('id', rowIds);

    if (!rows) throw new Error('Rows not found');

    // Update each row
    const promises = rows.map(row =>
      supabase
        .from('table_rows')
        .update({
          data: {
            ...row.data,
            ...updates,
          },
        })
        .eq('id', row.id)
    );

    await Promise.all(promises);

    return { error: null };
  } catch (error) {
    console.error('Error bulk updating rows:', error);
    return { error };
  }
}
```

#### bulkDeleteRows

- What it does: Bulk delete multiple rows
- Found in: `src/app/actions/tables/bulk-operations.ts`

```ts
export async function bulkDeleteRows(rowIds: string[]) {
  const supabase = await createClient();

  try {
    // Delete rows (cascades to relations via foreign keys)
    const { error } = await supabase
      .from('table_rows')
      .delete()
      .in('id', rowIds);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error bulk deleting rows:', error);
    return { error };
  }
}
```

#### bulkDuplicateRows

- What it does: Bulk duplicate multiple rows
- Found in: `src/app/actions/tables/bulk-operations.ts`

```ts
export async function bulkDuplicateRows(rowIds: string[]) {
  const supabase = await createClient();

  try {
    // Get rows to duplicate
    const { data: rows } = await supabase
      .from('table_rows')
      .select('*')
      .in('id', rowIds);

    if (!rows) throw new Error('Rows not found');

    // Create duplicates
    const duplicates = rows.map(row => ({
      table_id: row.table_id,
      data: row.data,
      order: row.order + 0.1, // Insert after original
    }));

    const { error } = await supabase
      .from('table_rows')
      .insert(duplicates);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error bulk duplicating rows:', error);
    return { error };
  }
}
```

### src/app/actions/tables/comment-actions.ts

#### createComment

- What it does: Uses Supabase to create and read records in table_comments.
- Found in: `src/app/actions/tables/comment-actions.ts`

```ts
export async function createComment(input: CreateCommentInput): Promise<ActionResult<TableComment>> {
  const access = await getRowAccess(input.rowId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, tableId } = access;

  const { data, error } = await supabase
    .from("table_comments")
    .insert({
      row_id: input.rowId,
      user_id: userId,
      content: input.content,
      parent_id: input.parentId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create comment" };
  }
  return { data };
}
```

#### updateComment

- What it does: Uses Supabase to update and read records in table_comments.
- Found in: `src/app/actions/tables/comment-actions.ts`

```ts
export async function updateComment(commentId: string, content: string): Promise<ActionResult<TableComment>> {
  const access = await getCommentAccess(commentId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, comment } = access;

  if (comment.user_id !== userId) {
    return { error: "Only the author can edit this comment" };
  }

  const { data, error } = await supabase
    .from("table_comments")
    .update({ content })
    .eq("id", commentId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update comment" };
  }
  return { data };
}
```

#### deleteComment

- What it does: Uses Supabase to delete records in table_comments.
- Found in: `src/app/actions/tables/comment-actions.ts`

```ts
export async function deleteComment(commentId: string): Promise<ActionResult<null>> {
  const access = await getCommentAccess(commentId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, comment } = access;

  if (comment.user_id !== userId) {
    return { error: "Only the author can delete this comment" };
  }

  const { error } = await supabase.from("table_comments").delete().eq("id", commentId);
  if (error) {
    return { error: "Failed to delete comment" };
  }
  return { data: null };
}
```

#### resolveComment

- What it does: Uses Supabase to update and read records in table_comments.
- Found in: `src/app/actions/tables/comment-actions.ts`

```ts
export async function resolveComment(commentId: string, resolved: boolean): Promise<ActionResult<TableComment>> {
  const access = await getCommentAccess(commentId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_comments")
    .update({ resolved })
    .eq("id", commentId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update comment status" };
  }
  return { data };
}
```

#### getRowComments

- What it does: Uses Supabase to read records in table_comments.
- Found in: `src/app/actions/tables/comment-actions.ts`

```ts
export async function getRowComments(rowId: string): Promise<ActionResult<TableComment[]>> {
  const access = await getRowAccess(rowId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_comments")
    .select("*")
    .eq("row_id", rowId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { error: "Failed to load comments" };
  }
  return { data };
}
```

### src/app/actions/tables/context.ts

#### requireTableAccess

- What it does: Fetches table metadata and ensures the requesting user belongs to the table's workspace. Returns an error string if unauthorized or missing.
- Found in: `src/app/actions/tables/context.ts`

```ts
export async function requireTableAccess(tableId: string): Promise<
  | { error: string }
```

#### requireWorkspaceAccessForTables

- What it does: Ensures a user can act within a workspace (used for create flows).
- Found in: `src/app/actions/tables/context.ts`

```ts
export async function requireWorkspaceAccessForTables(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  return { supabase, userId: user.id };
}
```

### src/app/actions/tables/field-actions.ts

#### createField

- What it does: Uses Supabase to create and read records in table_fields. Enforces access checks.
- Found in: `src/app/actions/tables/field-actions.ts`

```ts
export async function createField(input: CreateFieldInput): Promise<ActionResult<TableField>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_fields")
    .insert({
      table_id: input.tableId,
      name: input.name || "Untitled Field",
      type: input.type,
      config: input.config || {},
      order: input.order ?? null,
      is_primary: input.isPrimary ?? false,
      width: input.width ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create field" };
  }

  if (input.type === "formula") {
    await recomputeFormulaField(data.id);
  }
  if (input.type === "rollup") {
    await recomputeRollupField(data.id);
  }

  return { data };
}
```

#### updateField

- What it does: Uses Supabase to update and read records in table_fields.
- Found in: `src/app/actions/tables/field-actions.ts`

```ts
export async function updateField(fieldId: string, updates: Partial<Pick<TableField, "name" | "type" | "config" | "is_primary" | "width">>): Promise<ActionResult<TableField>> {
  const access = await getFieldContext(fieldId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, table, field } = access;

  let nextConfig = updates.config;
  if (nextConfig !== undefined && (updates.type === "formula" || field.type === "formula")) {
    const formula = (nextConfig as any)?.formula ?? (field.config as any)?.formula;
    if (formula) {
      const { data: fields } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", table.id);
      const dependencies = extractDependencies(formula, (fields || []) as TableField[]);
      nextConfig = { ...(nextConfig as Record<string, unknown>), dependencies };
    }
  }

  const updatePayload: Record<string, unknown> = {
    name: updates.name,
    type: updates.type,
    is_primary: updates.is_primary,
    width: updates.width,
  };

  if (updates.config !== undefined) {
    updatePayload.config = nextConfig;
  }

  const { data, error: updateError } = await supabase
    .from("table_fields")
    .update(updatePayload)
    .eq("id", fieldId)
    .eq("table_id", table.id)
    .select("*")
    .single();

  if (updateError || !data) {
    return { error: "Failed to update field" };
  }

  if (updates.type === "formula" || data.type === "formula") {
    await recomputeFormulaField(fieldId);
  }
  if (updates.type === "rollup" || data.type === "rollup") {
    await recomputeRollupField(fieldId);
  }

  return { data };
}
```

#### deleteField

- What it does: Uses Supabase to delete records in table_fields.
- Found in: `src/app/actions/tables/field-actions.ts`

```ts
export async function deleteField(fieldId: string): Promise<ActionResult<null>> {
  const access = await getFieldContext(fieldId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, table } = access;

  const { error: deleteError } = await supabase
    .from("table_fields")
    .delete()
    .eq("id", fieldId)
    .eq("table_id", table.id);

  if (deleteError) {
    return { error: "Failed to delete field" };
  }
  return { data: null };
}
```

#### reorderFields

- What it does: Performs the "reorder fields" action for table.
- Found in: `src/app/actions/tables/field-actions.ts`

```ts
export async function reorderFields(tableId: string, orders: Array<{ fieldId: string; order: number }
```

#### updateFieldConfig

- What it does: Uses Supabase to update and read records in table_fields.
- Found in: `src/app/actions/tables/field-actions.ts`

```ts
export async function updateFieldConfig(fieldId: string, config: Record<string, unknown>): Promise<ActionResult<TableField>> {
  const access = await getFieldContext(fieldId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, table } = access;

  const { data, error: updateError } = await supabase
    .from("table_fields")
    .update({ config })
    .eq("id", fieldId)
    .eq("table_id", table.id)
    .select("*")
    .single();

  if (updateError || !data) {
    return { error: "Failed to update field config" };
  }

  if (data.type === "formula") {
    await recomputeFormulaField(fieldId);
  }
  if (data.type === "rollup") {
    await recomputeRollupField(fieldId);
  }

  return { data };
}
```

### src/app/actions/tables/formula-actions.ts

#### createFormulaField

- What it does: Performs the "create formula field" action for table.
- Found in: `src/app/actions/tables/formula-actions.ts`

```ts
export async function createFormulaField(input: {
  tableId: string;
  name: string;
  formula: string;
  returnType?: "number" | "text" | "boolean" | "date";
}
```

#### recomputeFormulaField

- What it does: Uses Supabase to upsert and read records in table_fields, table_rows. Enforces access checks.
- Found in: `src/app/actions/tables/formula-actions.ts`

```ts
export async function recomputeFormulaField(fieldId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: field } = await supabase
    .from("table_fields")
    .select("id, table_id, type, config")
    .eq("id", fieldId)
    .maybeSingle();

  if (!field || field.type !== "formula") {
    return { error: "Formula field not found" };
  }

  const access = await requireTableAccess(field.table_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { data: fields } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", field.table_id);

  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, data")
    .eq("table_id", field.table_id);

  const formula = (field.config as any)?.formula as string;
  const returnType = (field.config as any)?.return_type as string | undefined;

  const updates = (rows || []).map((row) => {
    const cleanedData = sanitizeRowData(row.data || {}, (fields || []) as TableField[]);
    const result = evaluateFormula(formula, row.data || {}, (fields || []) as TableField[]);
    const value = result.error
      ? formatFormulaErrorValue(result.error)
      : coerceFormulaValue(result.value, returnType);
    return {
      id: row.id,
      table_id: field.table_id,
      data: {
        ...cleanedData,
        [field.id]: value,
      },
      updated_by: user.id,
    };
  });

  if (updates.length > 0) {
    const { error } = await supabase.from("table_rows").upsert(updates, { onConflict: "id" });
    if (error) {
      console.error("recomputeFormulaField: failed to write formula values:", error);
      return { error: error.message || "Failed to save formula values" };
    }
  }

  return { data: null };
}
```

#### recomputeFormulasForRow

- What it does: Uses Supabase to update and read records in table_fields, table_rows. Enforces access checks.
- Found in: `src/app/actions/tables/formula-actions.ts`

```ts
export async function recomputeFormulasForRow(
  tableId: string,
  rowId: string,
  changedFieldId?: string
) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" } as const;

  const { data: formulaFields } = await supabase
    .from("table_fields")
    .select("id, config")
    .eq("table_id", tableId)
    .eq("type", "formula");

  if (!formulaFields || formulaFields.length === 0) return { data: null } as const;

  const relevant = formulaFields.filter((field) => {
    if (!changedFieldId) return true;
    const deps = (field.config as any)?.dependencies as string[] | undefined;
    if (!deps || deps.length === 0) return true;
    return deps.includes(changedFieldId);
  });

  if (relevant.length === 0) return { data: null } as const;

  const { data: fields } = await supabase
    .from("table_fields")
    .select("*")
    .eq("table_id", tableId);

  const { data: row } = await supabase
    .from("table_rows")
    .select("data")
    .eq("id", rowId)
    .single();

  if (!row) return { data: null } as const;

  const updatedData = sanitizeRowData(row.data || {}, (fields || []) as TableField[]);
  relevant.forEach((field) => {
    const formula = (field.config as any)?.formula as string;
    const returnType = (field.config as any)?.return_type as string | undefined;
    const result = evaluateFormula(formula, row.data || {}, (fields || []) as TableField[]);
    const value = result.error
      ? formatFormulaErrorValue(result.error)
      : coerceFormulaValue(result.value, returnType);
    updatedData[field.id] = value;
  });

  const { error } = await supabase
    .from("table_rows")
    .update({
      data: updatedData,
      updated_by: user.id,
    })
    .eq("id", rowId);
  if (error) {
    console.error("recomputeFormulasForRow: failed to update row:", error);
    return { error: error.message || "Failed to save formula values" } as const;
  }

  return { data: null } as const;
}
```

### src/app/actions/tables/formulas.ts

#### createFormulaField

- What it does: Create a formula field
- Found in: `src/app/actions/tables/formulas.ts`

```ts
export async function createFormulaField(
  tableId: string,
  fieldName: string,
  config: {
    formula: string;
    return_type: 'number' | 'text' | 'boolean' | 'date';
  }
```

#### recomputeFormulas

- What it does: Recompute formula values when dependencies change
- Found in: `src/app/actions/tables/formulas.ts`

```ts
export async function recomputeFormulas(
  tableId: string,
  rowId: string,
  changedFieldId: string
) {
  const supabase = await createClient();

  try {
    // 1. Get all fields and row data
    const { data: fields } = await supabase
      .from('table_fields')
      .select('*')
      .eq('table_id', tableId);

    const { data: row } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', rowId)
      .single();

    if (!fields || !row) return { error: null };

    // 2. Find all formula fields that depend on the changed field
    const formulaFields = fields.filter(f =>
      f.type === 'formula' &&
      (f.config as any)?.dependencies?.includes(changedFieldId)
    );

    if (formulaFields.length === 0) return { error: null };

    // 3. Recompute each affected formula
    const updatedData = { ...row.data };
    for (const formulaField of formulaFields) {
      const config = formulaField.config as any;
      const value = evaluateFormula(config.formula, row.data, fields);
      updatedData[formulaField.id] = value;
    }

    // 4. Update row
    await supabase
      .from('table_rows')
      .update({ data: updatedData })
      .eq('id', rowId);

    return { error: null };
  } catch (error) {
    console.error('Error recomputing formulas:', error);
    return { error };
  }
}
```

### src/app/actions/tables/query-actions.ts

#### getTableData

- What it does: Performs the "get table data" action for table.
- Found in: `src/app/actions/tables/query-actions.ts`

```ts
export async function getTableData(input: GetTableDataInput): Promise<ActionResult<{ rows: TableRow[]; view?: TableView | null }
```

#### searchTableRows

- What it does: Uses Supabase to read records in table_rows. Enforces access checks.
- Found in: `src/app/actions/tables/query-actions.ts`

```ts
export async function searchTableRows(tableId: string, query: string): Promise<ActionResult<TableRow[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: rows, error } = await supabase
    .from("table_rows")
    .select("*")
    .eq("table_id", tableId);

  if (error || !rows) {
    return { error: "Failed to search rows" };
  }

  const lowered = query.toLowerCase();
  const results = (rows as TableRow[]).filter((row) =>
    Object.values(row.data || {}).some((v) => String(v ?? "").toLowerCase().includes(lowered))
  );
  return { data: results };
}
```

#### getFilteredRows

- What it does: Uses Supabase to read records in table_rows. Enforces access checks.
- Found in: `src/app/actions/tables/query-actions.ts`

```ts
export async function getFilteredRows(tableId: string, filters: FilterCondition[]): Promise<ActionResult<TableRow[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { query, unsupportedFilters } = applyServerFilters(
    supabase.from("table_rows").select("*").eq("table_id", tableId),
    filters
  );

  // Execute the query
  const { data: rows, error } = await (query as PostgrestFilterBuilder<any, any, any, any>);

  if (error || !rows) {
    return { error: "Failed to fetch rows" };
  }

  const result = unsupportedFilters.length > 0 ? applyFilters(rows as TableRow[], unsupportedFilters) : (rows as TableRow[]);
  return { data: result };
}
```

#### getTableRows

- What it does: Performs the "get table rows" action for table.
- Found in: `src/app/actions/tables/query-actions.ts`

```ts
export async function getTableRows(
  tableId: string,
  options?: { limit?: number; offset?: number }
```

### src/app/actions/tables/relation-actions.ts

#### configureRelationField

- What it does: Performs the "configure relation field" action for table.
- Found in: `src/app/actions/tables/relation-actions.ts`

```ts
export async function configureRelationField(input: {
  fieldId: string;
  name?: string;
  relatedTableId: string;
  allowMultiple: boolean;
  bidirectional: boolean;
  reverseAllowMultiple?: boolean;
  limit?: number;
  displayFieldId?: string | null;
  reverseFieldName?: string;
}
```

#### getRelatedRows

- What it does: Performs the "get related rows" action for table.
- Found in: `src/app/actions/tables/relation-actions.ts`

```ts
export async function getRelatedRows(
  rowId: string,
  fieldId: string
): Promise<ActionResult<{ rows: TableRow[]; displayFieldId?: string | null }
```

#### countRelationLinksForRows

- What it does: Performs the "count relation links for rows" action for table.
- Found in: `src/app/actions/tables/relation-actions.ts`

```ts
export async function countRelationLinksForRows(input: {
  tableId: string;
  rowIds: string[];
}
```

#### syncRelationLinks

- What it does: Performs the "sync relation links" action for table.
- Found in: `src/app/actions/tables/relation-actions.ts`

```ts
export async function syncRelationLinks(input: {
  fromRowId: string;
  fromField: Pick<TableField, "id" | "table_id" | "config">;
  nextRowIds: string[];
  userId?: string;
}
```

### src/app/actions/tables/relations.ts

#### createRelationField

- What it does: Create a relation field (and optionally a bidirectional reverse field)
- Found in: `src/app/actions/tables/relations.ts`

```ts
export async function createRelationField(
  tableId: string,
  fieldName: string,
  config: {
    relation_table_id: string;
    relation_type: 'one_to_many' | 'many_to_many';
    bidirectional: boolean;
    display_field_id?: string;
  }
```

#### linkRows

- What it does: Link rows together (create relation)
- Found in: `src/app/actions/tables/relations.ts`

```ts
export async function linkRows(
  fromTableId: string,
  fromFieldId: string,
  fromRowId: string,
  toRowIds: string[] // Array to support multiple links
) {
  const supabase = await createClient();

  try {
    // 1. Get field config to check if bidirectional
    const { data: field } = await supabase
      .from('table_fields')
      .select('config, table_id')
      .eq('id', fromFieldId)
      .single();

    if (!field) throw new Error('Field not found');
    const config = field.config as any;
    const toTableId = config.relation_table_id;

    // 2. Insert records into table_relations
    const relations = toRowIds.map(toRowId => ({
      workspace_id: field.table_id, // This should be the workspace_id, but we need to get it
      from_table_id: fromTableId,
      from_field_id: fromFieldId,
      from_row_id: fromRowId,
      to_table_id: toTableId,
      to_row_id: toRowId,
    }));

    const { error: relError } = await supabase
      .from('table_relations')
      .insert(relations);

    if (relError) throw relError;

    // 3. Update row data JSONB to include linked row IDs (for faster reads)
    const { data: existingRow } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', fromRowId)
      .single();

    const existingLinks = (existingRow?.data?.[fromFieldId] || []) as string[];
    const updatedLinks = [...new Set([...existingLinks, ...toRowIds])];

    await supabase
      .from('table_rows')
      .update({
        data: {
          ...existingRow?.data,
          [fromFieldId]: updatedLinks,
        },
      })
      .eq('id', fromRowId);

    // 4. If bidirectional, create reverse links
    if (config.bidirectional && config.reverse_field_id) {
      for (const toRowId of toRowIds) {
        // Add reverse relation records
        await supabase.from('table_relations').insert({
          workspace_id: toTableId, // This should be the workspace_id for the target table
          from_table_id: toTableId,
          from_field_id: config.reverse_field_id,
          from_row_id: toRowId,
          to_table_id: fromTableId,
          to_row_id: fromRowId,
        });

        // Update reverse row JSONB
        const { data: toRow } = await supabase
          .from('table_rows')
          .select('data')
          .eq('id', toRowId)
          .single();

        const toLinks = (toRow?.data?.[config.reverse_field_id] || []) as string[];
        await supabase
          .from('table_rows')
          .update({
            data: {
              ...toRow?.data,
              [config.reverse_field_id]: [...new Set([...toLinks, fromRowId])],
            },
          })
          .eq('id', toRowId);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error linking rows:', error);
    return { error };
  }
}
```

#### unlinkRows

- What it does: Unlink rows (remove relation)
- Found in: `src/app/actions/tables/relations.ts`

```ts
export async function unlinkRows(
  fromRowId: string,
  fromFieldId: string,
  toRowIds: string[]
) {
  const supabase = await createClient();

  try {
    // 1. Get field config
    const { data: field } = await supabase
      .from('table_fields')
      .select('config, table_id')
      .eq('id', fromFieldId)
      .single();

    if (!field) throw new Error('Field not found');
    const config = field.config as any;

    // 2. Delete from table_relations
    await supabase
      .from('table_relations')
      .delete()
      .eq('from_row_id', fromRowId)
      .eq('from_field_id', fromFieldId)
      .in('to_row_id', toRowIds);

    // 3. Update row data JSONB
    const { data: row } = await supabase
      .from('table_rows')
      .select('data')
      .eq('id', fromRowId)
      .single();

    const existingLinks = (row?.data?.[fromFieldId] || []) as string[];
    const updatedLinks = existingLinks.filter(id => !toRowIds.includes(id));

    await supabase
      .from('table_rows')
      .update({
        data: {
          ...row?.data,
          [fromFieldId]: updatedLinks,
        },
      })
      .eq('id', fromRowId);

    // 4. If bidirectional, remove reverse links
    if (config.bidirectional && config.reverse_field_id) {
      for (const toRowId of toRowIds) {
        await supabase
          .from('table_relations')
          .delete()
          .eq('from_row_id', toRowId)
          .eq('from_field_id', config.reverse_field_id)
          .eq('to_row_id', fromRowId);

        const { data: toRow } = await supabase
          .from('table_rows')
          .select('data')
          .eq('id', toRowId)
          .single();

        const toLinks = (toRow?.data?.[config.reverse_field_id] || []) as string[];
        await supabase
          .from('table_rows')
          .update({
            data: {
              ...toRow?.data,
              [config.reverse_field_id]: toLinks.filter(id => id !== fromRowId),
            },
          })
          .eq('id', toRowId);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error unlinking rows:', error);
    return { error };
  }
}
```

#### getRelatedRows

- What it does: Get related rows for a given row and field
- Found in: `src/app/actions/tables/relations.ts`

```ts
export async function getRelatedRows(
  rowId: string,
  fieldId: string
): Promise<{ rows: any[]; error: any }
```

### src/app/actions/tables/rollup-actions.ts

#### computeRollupValue

- What it does: Performs the "compute rollup value" action for table.
- Found in: `src/app/actions/tables/rollup-actions.ts`

```ts
export async function computeRollupValue(
  rowId: string,
  fieldId: string
): Promise<ActionResult<{ value: unknown; error?: string }
```

#### recomputeRollupField

- What it does: Uses Supabase to read records in table_fields, table_rows. Enforces access checks.
- Found in: `src/app/actions/tables/rollup-actions.ts`

```ts
export async function recomputeRollupField(fieldId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: field } = await supabase
    .from("table_fields")
    .select("id, table_id, type")
    .eq("id", fieldId)
    .maybeSingle();

  if (!field || field.type !== "rollup") {
    return { error: "Rollup field not found" };
  }

  const access = await requireTableAccess(field.table_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { data: rows } = await supabase
    .from("table_rows")
    .select("id")
    .eq("table_id", field.table_id);

  for (const row of rows || []) {
    await computeRollupValue(row.id, fieldId);
  }

  return { data: null };
}
```

#### recomputeRollupsForRow

- What it does: Uses Supabase to read records in table_fields. Enforces access checks.
- Found in: `src/app/actions/tables/rollup-actions.ts`

```ts
export async function recomputeRollupsForRow(tableId: string, rowId: string, relationFieldId?: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" } as const;

  const { data: rollupFields } = await supabase
    .from("table_fields")
    .select("id, config")
    .eq("table_id", tableId)
    .eq("type", "rollup");

  const relevant = (rollupFields || []).filter((field) => {
    if (!relationFieldId) return true;
    const config = normalizeRollupConfig(field.config as TableField["config"]);
    return config.relationFieldId === relationFieldId;
  });

  for (const field of relevant) {
    await computeRollupValue(rowId, field.id);
  }

  return { data: null } as const;
}
```

#### recomputeRollupsForTargetRowChanged

- What it does: Uses Supabase to read records in table_relations, table_fields. Enforces access checks.
- Found in: `src/app/actions/tables/rollup-actions.ts`

```ts
export async function recomputeRollupsForTargetRowChanged(
  targetRowId: string,
  targetTableId: string,
  changedFieldId?: string
) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const access = await requireTableAccess(targetTableId);
  if ("error" in access) return { error: access.error } as const;

  const { data: relations } = await supabase
    .from("table_relations")
    .select("from_row_id, from_field_id, from_table_id")
    .eq("to_row_id", targetRowId);

  if (!relations || relations.length === 0) return { data: null } as const;

  const grouped = new Map<string, { fromRowId: string; fromFieldId: string }[]>();
  relations.forEach((rel) => {
    const key = rel.from_table_id;
    const arr = grouped.get(key) ?? [];
    arr.push({ fromRowId: rel.from_row_id, fromFieldId: rel.from_field_id });
    grouped.set(key, arr);
  });

  for (const [fromTableId, rels] of grouped.entries()) {
    const { data: rollupFields } = await supabase
      .from("table_fields")
      .select("id, config")
      .eq("table_id", fromTableId)
      .eq("type", "rollup");

    for (const rel of rels) {
      const relevant = (rollupFields || []).filter((field) => {
        const config = normalizeRollupConfig(field.config as TableField["config"]);
        if (config.relationFieldId !== rel.fromFieldId) return false;
        if (!changedFieldId) return true;
        return config.targetFieldId === changedFieldId;
      });

      for (const field of relevant) {
        await computeRollupValue(rel.fromRowId, field.id);
      }
    }
  }

  return { data: null } as const;
}
```

### src/app/actions/tables/rollups.ts

#### createRollupField

- What it does: Create a rollup field
- Found in: `src/app/actions/tables/rollups.ts`

```ts
export async function createRollupField(
  tableId: string,
  fieldName: string,
  config: {
    relation_field_id: string;
    target_field_id: string;
    aggregation: string;
    filter?: { field_id: string; operator: string; value: any };
  }
```

#### computeRollupValue

- What it does: Compute rollup value for a specific row
- Found in: `src/app/actions/tables/rollups.ts`

```ts
export async function computeRollupValue(
  rowId: string,
  fieldId: string
): Promise<{ value: any; error: any }
```

#### invalidateRollups

- What it does: Invalidate rollup cache when related rows change
- Found in: `src/app/actions/tables/rollups.ts`

```ts
export async function invalidateRollups(
  affectedRowIds: string[],
  relationFieldId: string
) {
  const supabase = await createClient();

  try {
    // 1. Find all rollup fields that depend on this relation
    const { data: rollupFields } = await supabase
      .from('table_fields')
      .select('id, table_id')
      .eq('type', 'rollup')
      .contains('config', { relation_field_id: relationFieldId });

    if (!rollupFields || rollupFields.length === 0) return { error: null };

    // 2. For each affected row, recompute rollups
    for (const rowId of affectedRowIds) {
      for (const rollupField of rollupFields) {
        await computeRollupValue(rowId, rollupField.id);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error invalidating rollups:', error);
    return { error };
  }
}
```

### src/app/actions/tables/row-actions.ts

#### createRow

- What it does: Uses Supabase to create and read records in table_rows. Enforces access checks.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function createRow(input: CreateRowInput): Promise<ActionResult<TableRow>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      table_id: input.tableId,
      data: input.data || {},
      order: input.order ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create row" };
  }

  await recomputeFormulasForRow(input.tableId, data.id);
  await recomputeRollupsForRow(input.tableId, data.id);

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", data.id)
    .single();

  return { data: (refreshed as TableRow) || data };
}
```

#### updateRow

- What it does: Performs the "update row" action for table.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function updateRow(rowId: string, updates: { data?: Record<string, unknown> }
```

#### updateCell

- What it does: Uses Supabase to update and read records in table_fields, table_rows.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function updateCell(rowId: string, fieldId: string, value: unknown): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId);
  if ("error" in access) {
    console.error("updateCell: getRowContext error:", access.error);
    return { error: access.error ?? "Unknown error" };
  }
  const { supabase, userId, row } = access;

  // Get all valid field IDs for this table to filter out deleted fields
  const { data: fields, error: fieldsError } = await supabase
    .from("table_fields")
    .select("id, type, config")
    .eq("table_id", row.table_id);

  if (fieldsError) {
    console.error("updateCell: Failed to fetch fields:", fieldsError);
    return { error: "Failed to validate field" };
  }

  // Check if the field being updated exists
  const field = (fields || []).find((f) => f.id === fieldId) as TableField | undefined;
  if (!field) {
    return { error: `Field ${fieldId} does not exist in this table` };
  }

  if (["rollup", "formula", "created_time", "last_edited_time", "created_by", "last_edited_by"].includes(field.type)) {
    return { error: "This field is read-only" };
  }

  // Get set of valid field IDs for filtering
  const validFieldIds = new Set(fields?.map((f) => f.id) || []);

  // Filter existing row data to only include valid fields, then merge with new value
  const existingData = row?.data || {};
  const filteredData: Record<string, unknown> = {};
  
  // Only keep data for fields that still exist
  for (const [key, val] of Object.entries(existingData)) {
    if (validFieldIds.has(key)) {
      filteredData[key] = val;
    }
  }

  // Add/update the field being edited
  const mergedData = { ...filteredData, [fieldId]: value };

  if (field.type === "relation") {
    /**
     * Relation update cascade:
     * 1) Sync relation links in table_relations (delta-based add/remove).
     * 2) Update cached relation ids in table_rows.data[fieldId].
     * 3) Recompute formulas on this row that depend on the relation.
     * 4) Recompute rollups on this row that use the relation.
     * 5) Recompute rollups on related rows (bidirectional reverse field).
     */
    try {
      // Validate relation field config
      const relationConfig = field.config as any;
      if (!relationConfig?.relation_table_id && !relationConfig?.linkedTableId) {
        console.error("updateCell: Relation field missing related table config:", field.config);
        return { error: "Relation field is not properly configured. Please reconfigure the relation field." };
      }

      const nextRowIds = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
        : typeof value === "string" && value.length > 0
          ? [value]
          : [];

      const syncResult = await syncRelationLinks({
        fromRowId: rowId,
        fromField: { id: field.id, table_id: row.table_id, config: field.config },
        nextRowIds,
        userId,
      });

      if ("error" in syncResult) {
        console.error("updateCell: syncRelationLinks error:", syncResult.error);
        return { error: syncResult.error ?? "Unknown error" };
      }

      // Update row data with relation IDs immediately
      const updatedData = { ...mergedData, [fieldId]: nextRowIds };
      await supabase
        .from("table_rows")
        .update({
          data: updatedData,
          updated_by: userId,
        })
        .eq("id", rowId);

      // Recompute formulas and rollups (non-blocking)
      Promise.all([
        recomputeFormulasForRow(row.table_id, rowId, fieldId),
        recomputeRollupsForRow(row.table_id, rowId, fieldId),
      ]).catch((err) => {
        console.error("Error recomputing formulas/rollups:", err);
      });

      if (syncResult.data.reverseFieldId && syncResult.data.relatedTableId) {
        const impacted = [...(syncResult.data.added || []), ...(syncResult.data.removed || [])];
        Promise.all(
          impacted.map((relatedRowId) =>
            recomputeRollupsForRow(
              syncResult.data.relatedTableId,
              relatedRowId,
              syncResult.data.reverseFieldId ?? undefined
            )
          )
        ).catch((err) => {
          console.error("Error recomputing reverse rollups:", err);
        });
      }

      const { data: refreshed } = await supabase
        .from("table_rows")
        .select("*")
        .eq("id", rowId)
        .single();

      return { data: (refreshed as TableRow) || row };
    } catch (error) {
      console.error("updateCell: Relation update error:", error);
      return { error: error instanceof Error ? error.message : "Failed to update relation" };
    }
  }

  const { data, error } = await supabase
    .from("table_rows")
    .update({
      data: mergedData,
      updated_by: userId,
    })
    .eq("id", rowId)
    .select("*")
    .single();

  if (error) {
    console.error("updateCell: Supabase error:", error);
    return { error: `Failed to update cell: ${error.message || error.code || "Unknown error"}` };
  }

  if (!data) {
    console.error("updateCell: No data returned from update");
    return { error: "Failed to update cell: No data returned" };
  }

  await recomputeFormulasForRow(row.table_id, rowId, fieldId);
  await recomputeRollupsForTargetRowChanged(rowId, row.table_id, fieldId);

  const { data: refreshed } = await supabase
    .from("table_rows")
    .select("*")
    .eq("id", rowId)
    .single();

  return { data: (refreshed as TableRow) || data };
}
```

#### deleteRow

- What it does: Uses Supabase to delete records in table_rows.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function deleteRow(rowId: string): Promise<ActionResult<null>> {
  const access = await getRowContext(rowId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("table_rows").delete().eq("id", rowId);
  if (error) {
    return { error: "Failed to delete row" };
  }
  return { data: null };
}
```

#### deleteRows

- What it does: Uses Supabase to delete records in table_rows.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function deleteRows(rowIds: string[]): Promise<ActionResult<null>> {
  if (rowIds.length === 0) return { data: null };
  const access = await getRowContext(rowIds[0]);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("table_rows").delete().in("id", rowIds);
  if (error) {
    return { error: "Failed to delete rows" };
  }
  return { data: null };
}
```

#### reorderRows

- What it does: Performs the "reorder rows" action for table.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function reorderRows(tableId: string, orders: Array<{ rowId: string; order: number | string }
```

#### duplicateRow

- What it does: Uses Supabase to create and read records in table_rows.
- Found in: `src/app/actions/tables/row-actions.ts`

```ts
export async function duplicateRow(rowId: string): Promise<ActionResult<TableRow>> {
  const access = await getRowContext(rowId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, row } = access;

  const { data, error } = await supabase
    .from("table_rows")
    .insert({
      table_id: row.table_id,
      data: row.data,
      order: Number(row.order) + 0.001,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to duplicate row" };
  }
  return { data };
}
```

### src/app/actions/tables/table-actions.ts

#### createTable

- What it does: Performs the "create table" action for table.
- Found in: `src/app/actions/tables/table-actions.ts`

```ts
export async function createTable(input: CreateTableInput): Promise<ActionResult<{ table: Table; primaryField: TableField }
```

#### getTable

- What it does: Performs the "get table" action for table.
- Found in: `src/app/actions/tables/table-actions.ts`

```ts
export async function getTable(tableId: string): Promise<ActionResult<{ table: Table; fields: TableField[] }
```

#### updateTable

- What it does: Uses Supabase to update and read records in tables. Enforces access checks.
- Found in: `src/app/actions/tables/table-actions.ts`

```ts
export async function updateTable(tableId: string, updates: Partial<Pick<Table, "title" | "description" | "icon" | "project_id">>): Promise<ActionResult<Table>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("tables")
    .update({
      title: updates.title,
      description: updates.description,
      icon: updates.icon,
      project_id: updates.project_id,
    })
    .eq("id", tableId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update table" };
  }

  return { data };
}
```

#### deleteTable

- What it does: Uses Supabase to delete records in tables. Enforces access checks.
- Found in: `src/app/actions/tables/table-actions.ts`

```ts
export async function deleteTable(tableId: string): Promise<ActionResult<null>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("tables").delete().eq("id", tableId);
  if (error) {
    return { error: "Failed to delete table" };
  }
  return { data: null };
}
```

#### duplicateTable

- What it does: Performs the "duplicate table" action for table.
- Found in: `src/app/actions/tables/table-actions.ts`

```ts
export async function duplicateTable(tableId: string, options?: { includeRows?: boolean }
```

#### listWorkspaceTables

- What it does: Uses Supabase to read records in tables. Enforces access checks.
- Found in: `src/app/actions/tables/table-actions.ts`

```ts
export async function listWorkspaceTables(workspaceId: string): Promise<ActionResult<Table[]>> {
  const access = await requireWorkspaceAccessForTables(workspaceId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { error: "Failed to load tables" };
  }

  return { data };
}
```

### src/app/actions/tables/validators.ts

#### validateFieldType

- What it does: Performs the "validate field type" action for table.
- Found in: `src/app/actions/tables/validators.ts`

```ts
export function validateFieldType(type: string): type is FieldType {
  return [
    "text",
    "long_text",
    "number",
    "select",
    "multi_select",
    "date",
    "checkbox",
    "url",
    "email",
    "phone",
    "person",
    "files",
    "created_time",
    "last_edited_time",
    "created_by",
    "last_edited_by",
    "formula",
    "relation",
    "rollup",
    "status",
    "priority",
  ].includes(type);
}
```

#### validateRowDataAgainstFields

- What it does: Performs the "validate row data against fields" action for table.
- Found in: `src/app/actions/tables/validators.ts`

```ts
export function validateRowDataAgainstFields(data: Record<string, unknown>, fields: TableField[]): { valid: boolean; message?: string }
```

### src/app/actions/tables/view-actions.ts

#### createView

- What it does: Uses Supabase to create and read records in table_views. Enforces access checks.
- Found in: `src/app/actions/tables/view-actions.ts`

```ts
export async function createView(input: CreateViewInput): Promise<ActionResult<TableView>> {
  const access = await requireTableAccess(input.tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId } = access;

  const { data, error } = await supabase
    .from("table_views")
    .insert({
      table_id: input.tableId,
      name: input.name || "Untitled View",
      type: input.type || "table",
      config: input.config || {},
      is_default: input.isDefault ?? false,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create view" };
  }
  return { data };
}
```

#### listViews

- What it does: Uses Supabase to read records in table_views. Enforces access checks.
- Found in: `src/app/actions/tables/view-actions.ts`

```ts
export async function listViews(tableId: string): Promise<ActionResult<TableView[]>> {
  const access = await requireTableAccess(tableId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_views")
    .select("*")
    .eq("table_id", tableId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { error: "Failed to load views" };
  }
  return { data };
}
```

#### getView

- What it does: Uses Supabase to read records in table_views.
- Found in: `src/app/actions/tables/view-actions.ts`

```ts
export async function getView(viewId: string): Promise<ActionResult<TableView>> {
  const supabase = await import("@/lib/supabase/server").then((m) => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: view, error } = await supabase
    .from("table_views")
    .select("*, tables!inner(id, workspace_id)")
    .eq("id", viewId)
    .maybeSingle();

  if (error || !view) {
    return { error: "View not found" };
  }

  const workspaceId = (view as any).tables.workspace_id as string;
  const access = await import("@/lib/auth-utils").then((m) => m.checkWorkspaceMembership(workspaceId, user.id));
  if (!access) return { error: "Not a member of this workspace" };

  const sanitized: TableView = {
    id: view.id,
    table_id: view.table_id,
    name: view.name,
    type: view.type,
    config: view.config,
    is_default: view.is_default,
    created_at: view.created_at,
    updated_at: view.updated_at,
    created_by: view.created_by,
  };

  return { data: sanitized };
}
```

#### updateView

- What it does: Uses Supabase to update and read records in table_views.
- Found in: `src/app/actions/tables/view-actions.ts`

```ts
export async function updateView(viewId: string, updates: Partial<Pick<TableView, "name" | "type" | "config" | "is_default">>): Promise<ActionResult<TableView>> {
  const access = await getViewContext(viewId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, view } = access;

  const { data, error } = await supabase
    .from("table_views")
    .update({
      name: updates.name,
      type: updates.type,
      config: updates.config,
      is_default: updates.is_default,
    })
    .eq("id", viewId)
    .eq("table_id", view.table_id)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update view" };
  }
  return { data };
}
```

#### deleteView

- What it does: Uses Supabase to delete records in table_views.
- Found in: `src/app/actions/tables/view-actions.ts`

```ts
export async function deleteView(viewId: string): Promise<ActionResult<null>> {
  const access = await getViewContext(viewId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, view } = access;

  const { error } = await supabase
    .from("table_views")
    .delete()
    .eq("id", viewId)
    .eq("table_id", view.table_id);

  if (error) {
    return { error: "Failed to delete view" };
  }
  return { data: null };
}
```

#### setDefaultView

- What it does: Uses Supabase to update and read records in table_views.
- Found in: `src/app/actions/tables/view-actions.ts`

```ts
export async function setDefaultView(viewId: string): Promise<ActionResult<TableView>> {
  const access = await getViewContext(viewId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, view } = access;

  const { data, error } = await supabase
    .from("table_views")
    .update({ is_default: true })
    .eq("id", viewId)
    .eq("table_id", view.table_id)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to set default view" };
  }
  return { data };
}
```

### src/app/actions/tasks/assignee-actions.ts

#### setTaskAssignees

- What it does: Performs the "set task assignees" action for task.
- Found in: `src/app/actions/tasks/assignee-actions.ts`

```ts
export async function setTaskAssignees(
  taskId: string,
  assignees: Array<{ id?: string | null; name?: string | null }
```

#### listTaskAssignees

- What it does: Uses Supabase to read records in task_assignees. Enforces access checks.
- Found in: `src/app/actions/tasks/assignee-actions.ts`

```ts
export async function listTaskAssignees(taskId: string): Promise<ActionResult<TaskAssignee[]>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_assignees")
    .select("*")
    .eq("task_id", taskId);

  if (error || !data) return { error: "Failed to load assignees" };
  return { data: data as TaskAssignee[] };
}
```

### src/app/actions/tasks/comment-actions.ts

#### createTaskComment

- What it does: Performs the "create task comment" action for task.
- Found in: `src/app/actions/tasks/comment-actions.ts`

```ts
export async function createTaskComment(input: {
  taskId: string;
  text: string;
}
```

#### updateTaskComment

- What it does: Performs the "update task comment" action for task.
- Found in: `src/app/actions/tasks/comment-actions.ts`

```ts
export async function updateTaskComment(
  commentId: string,
  updates: Partial<{ text: string }
```

#### deleteTaskComment

- What it does: Uses Supabase to delete and read records in task_comments, task_items. Enforces access checks.
- Found in: `src/app/actions/tasks/comment-actions.ts`

```ts
export async function deleteTaskComment(commentId: string): Promise<ActionResult<null>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: comment, error: commentError } = await supabase
    .from("task_comments")
    .select("id, task_id")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) return { error: "Comment not found" };

  const { data: task } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", comment.task_id)
    .single();

  if (!task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  if (error) return { error: "Failed to delete comment" };
  return { data: null };
}
```

### src/app/actions/tasks/context.ts

#### requireTaskBlockAccess

- What it does: Enforces access checks.
- Found in: `src/app/actions/tasks/context.ts`

```ts
export async function requireTaskBlockAccess(taskBlockId: string): Promise<{ error: string }
```

#### requireWorkspaceAccessForTasks

- What it does: Enforces access checks.
- Found in: `src/app/actions/tasks/context.ts`

```ts
export async function requireWorkspaceAccessForTasks(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId: user.id };
}
```

#### requireTaskItemAccess

- What it does: Uses Supabase to read records in task_items. Enforces access checks.
- Found in: `src/app/actions/tasks/context.ts`

```ts
export async function requireTaskItemAccess(taskId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const { data: task, error: taskError } = await supabase
    .from("task_items")
    .select("id, workspace_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) return { error: "Task not found" } as const;

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return { supabase, userId: user.id, task } as const;
}
```

### src/app/actions/tasks/item-actions.ts

#### createTaskItem

- What it does: Performs the "create task item" action for task.
- Found in: `src/app/actions/tasks/item-actions.ts`

```ts
export async function createTaskItem(input: {
  taskBlockId: string;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  hideIcons?: boolean;
  recurring?: {
    enabled: boolean;
    frequency?: "daily" | "weekly" | "monthly";
    interval?: number;
  };
}
```

#### updateTaskItem

- What it does: Performs the "update task item" action for task.
- Found in: `src/app/actions/tasks/item-actions.ts`

```ts
export async function updateTaskItem(
  taskId: string,
  updates: Partial<{
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    description: string | null;
    dueDate: string | null;
    dueTime: string | null;
    startDate: string | null;
    hideIcons: boolean;
    recurringEnabled: boolean;
    recurringFrequency: "daily" | "weekly" | "monthly" | null;
    recurringInterval: number | null;
  }
```

#### deleteTaskItem

- What it does: Uses Supabase to delete records in task_items. Enforces access checks.
- Found in: `src/app/actions/tasks/item-actions.ts`

```ts
export async function deleteTaskItem(taskId: string): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { error } = await supabase.from("task_items").delete().eq("id", taskId);
  if (error) return { error: "Failed to delete task" };
  return { data: null };
}
```

#### reorderTaskItems

- What it does: Uses Supabase to upsert records in task_items. Enforces access checks.
- Found in: `src/app/actions/tasks/item-actions.ts`

```ts
export async function reorderTaskItems(taskBlockId: string, orderedIds: string[]): Promise<ActionResult<null>> {
  const access = await requireTaskBlockAccess(taskBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const updates = orderedIds.map((id, idx) => ({ id, display_order: idx }));
  const { error } = await supabase.from("task_items").upsert(updates, { onConflict: "id" });
  if (error) return { error: "Failed to reorder tasks" };
  return { data: null };
}
```

### src/app/actions/tasks/query-actions.ts

#### getTaskItemsByBlock

- What it does: Uses Supabase to read records in task_items, task_subtasks, task_comments, task_tag_links, task_assignees, task_tags, profiles. Enforces access checks.
- Found in: `src/app/actions/tasks/query-actions.ts`

```ts
export async function getTaskItemsByBlock(taskBlockId: string): Promise<ActionResult<TaskItemView[]>> {
  const access = await requireTaskBlockAccess(taskBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data: items, error: itemsError } = await supabase
    .from("task_items")
    .select("*")
    .eq("task_block_id", taskBlockId)
    .order("display_order", { ascending: true });

  if (itemsError) return { error: "Failed to load tasks" };
  if (!items || items.length === 0) return { data: [] };

  const taskIds = items.map((item: any) => item.id);

  const [subtasksResult, commentsResult, tagLinksResult, assigneesResult] = await Promise.all([
    supabase
      .from("task_subtasks")
      .select("id, task_id, title, completed")
      .in("task_id", taskIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("task_comments")
      .select("id, task_id, author_id, text, created_at")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_tag_links")
      .select("task_id, tag_id")
      .in("task_id", taskIds),
    supabase
      .from("task_assignees")
      .select("task_id, assignee_id, assignee_name")
      .in("task_id", taskIds),
  ]);

  const subtasks = subtasksResult.data || [];
  const comments = commentsResult.data || [];
  const tagLinks = tagLinksResult.data || [];
  const assignees = assigneesResult.data || [];

  const tagIds = Array.from(new Set(tagLinks.map((link: any) => link.tag_id)));
  const { data: tags } = tagIds.length
    ? await supabase.from("task_tags").select("id, name").in("id", tagIds)
    : { data: [] } as any;

  const tagMap = new Map<string, string>();
  (tags || []).forEach((tag: any) => tagMap.set(tag.id, tag.name));

  const authorIds = Array.from(
    new Set(comments.map((comment: any) => comment.author_id).filter(Boolean))
  ) as string[];
  const { data: authorProfiles } = authorIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", authorIds)
    : { data: [] } as any;

  const authorMap = new Map<string, string>();
  (authorProfiles || []).forEach((profile: any) => {
    const displayName = profile.name || profile.email || "Unknown";
    authorMap.set(profile.id, displayName);
  });

  const assigneeIds = Array.from(
    new Set(assignees.map((assignee: any) => assignee.assignee_id).filter(Boolean))
  ) as string[];
  const { data: assigneeProfiles } = assigneeIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", assigneeIds)
    : { data: [] } as any;

  const assigneeMap = new Map<string, string>();
  (assigneeProfiles || []).forEach((profile: any) => {
    const displayName = profile.name || profile.email || "Unknown";
    assigneeMap.set(profile.id, displayName);
  });

  const subtasksByTask = new Map<string, Array<{ id: string; text: string; completed: boolean }>>();
  for (const subtask of subtasks) {
    const list = subtasksByTask.get(subtask.task_id) || [];
    list.push({ id: subtask.id, text: subtask.title, completed: subtask.completed });
    subtasksByTask.set(subtask.task_id, list);
  }

  const commentsByTask = new Map<string, Array<{ id: string; author: string; text: string; timestamp: string }>>();
  for (const comment of comments) {
    const list = commentsByTask.get(comment.task_id) || [];
    list.push({
      id: comment.id,
      author: authorMap.get(comment.author_id) || "Unknown",
      text: comment.text,
      timestamp: comment.created_at,
    });
    commentsByTask.set(comment.task_id, list);
  }

  const tagsByTask = new Map<string, string[]>();
  for (const link of tagLinks) {
    const list = tagsByTask.get(link.task_id) || [];
    const name = tagMap.get(link.tag_id);
    if (name) list.push(name);
    tagsByTask.set(link.task_id, list);
  }

  const assigneesByTask = new Map<string, string[]>();
  for (const assignee of assignees) {
    const list = assigneesByTask.get(assignee.task_id) || [];
    if (assignee.assignee_id && assigneeMap.has(assignee.assignee_id)) {
      list.push(assigneeMap.get(assignee.assignee_id)!);
    } else if (assignee.assignee_name) {
      list.push(assignee.assignee_name);
    }
    assigneesByTask.set(assignee.task_id, list);
  }

  const result = (items as TaskItem[]).map((item) => ({
    id: item.id,
    text: item.title,
    status: item.status,
    priority: item.priority,
    assignees: assigneesByTask.get(item.id) || [],
    dueDate: item.due_date || undefined,
    dueTime: item.due_time ? item.due_time.slice(0, 5) : undefined,
    startDate: item.start_date || undefined,
    tags: tagsByTask.get(item.id) || [],
    description: item.description || undefined,
    subtasks: subtasksByTask.get(item.id) || [],
    comments: commentsByTask.get(item.id) || [],
    recurring: {
      enabled: item.recurring_enabled,
      frequency: item.recurring_frequency,
      interval: item.recurring_interval,
    },
    hideIcons: item.hide_icons,
  }));

  return { data: result };
}
```

#### getWorkspaceTasksWithDueDates

- What it does: Uses Supabase to read records in task_items. Enforces access checks.
- Found in: `src/app/actions/tasks/query-actions.ts`

```ts
export async function getWorkspaceTasksWithDueDates(workspaceId: string): Promise<ActionResult<TaskItem[]>> {
  const access = await requireWorkspaceAccessForTasks(workspaceId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false });

  if (error || !data) return { error: "Failed to load tasks" };
  return { data: data as TaskItem[] };
}
```

### src/app/actions/tasks/reference-actions.ts

#### createTaskReference

- What it does: Performs the "create task reference" action for task.
- Found in: `src/app/actions/tasks/reference-actions.ts`

```ts
export async function createTaskReference(input: {
  taskId: string;
  referenceType: TaskReferenceType;
  referenceId: string;
  tableId?: string | null;
}
```

#### deleteTaskReference

- What it does: Uses Supabase to delete and read records in task_references. Enforces access checks.
- Found in: `src/app/actions/tasks/reference-actions.ts`

```ts
export async function deleteTaskReference(referenceId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: ref, error: refError } = await supabase
    .from("task_references")
    .select("id, workspace_id")
    .eq("id", referenceId)
    .single();

  if (refError || !ref) return { error: "Reference not found" };

  const membership = await checkWorkspaceMembership(ref.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("task_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete task reference" };
  return { data: null };
}
```

#### listTaskReferences

- What it does: Uses Supabase to read records in task_references. Enforces access checks.
- Found in: `src/app/actions/tasks/reference-actions.ts`

```ts
export async function listTaskReferences(taskId: string): Promise<ActionResult<TaskReference[]>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_references")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: "Failed to load task references" };
  return { data: data as TaskReference[] };
}
```

#### listTaskReferenceSummaries

- What it does: Performs the "list task reference summaries" action for task.
- Found in: `src/app/actions/tasks/reference-actions.ts`

```ts
export async function listTaskReferenceSummaries(
  taskId: string
): Promise<ActionResult<Array<TaskReference & { title: string; type_label?: string }
```

### src/app/actions/tasks/subtask-actions.ts

#### createTaskSubtask

- What it does: Performs the "create task subtask" action for task.
- Found in: `src/app/actions/tasks/subtask-actions.ts`

```ts
export async function createTaskSubtask(input: {
  taskId: string;
  title: string;
  completed?: boolean;
  displayOrder?: number;
}
```

#### updateTaskSubtask

- What it does: Performs the "update task subtask" action for task.
- Found in: `src/app/actions/tasks/subtask-actions.ts`

```ts
export async function updateTaskSubtask(
  subtaskId: string,
  updates: Partial<{ title: string; completed: boolean; displayOrder: number }
```

#### deleteTaskSubtask

- What it does: Uses Supabase to delete and read records in task_subtasks, task_items. Enforces access checks.
- Found in: `src/app/actions/tasks/subtask-actions.ts`

```ts
export async function deleteTaskSubtask(subtaskId: string): Promise<ActionResult<null>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: subtask, error: subtaskError } = await supabase
    .from("task_subtasks")
    .select("id, task_id")
    .eq("id", subtaskId)
    .single();

  if (subtaskError || !subtask) return { error: "Subtask not found" };

  const { data: task } = await supabase
    .from("task_items")
    .select("workspace_id")
    .eq("id", subtask.task_id)
    .single();

  if (!task) return { error: "Task not found" };

  const membership = await checkWorkspaceMembership(task.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("task_subtasks").delete().eq("id", subtaskId);
  if (error) return { error: "Failed to delete subtask" };
  return { data: null };
}
```

### src/app/actions/tasks/tag-actions.ts

#### setTaskTags

- What it does: Uses Supabase to create, delete and read records in task_tag_links, task_tags. Enforces access checks.
- Found in: `src/app/actions/tasks/tag-actions.ts`

```ts
export async function setTaskTags(taskId: string, tagNames: string[]): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, task } = access;

  const normalized = Array.from(new Set(tagNames.map((t) => t.trim()).filter(Boolean)));

  const { data: existingLinks } = await supabase
    .from("task_tag_links")
    .select("tag_id")
    .eq("task_id", taskId);

  const existingTagIds = new Set((existingLinks || []).map((l: any) => l.tag_id));

  const { data: existingTags } = await supabase
    .from("task_tags")
    .select("id, name")
    .eq("workspace_id", task.workspace_id);

  const tagMap = new Map<string, string>();
  (existingTags || []).forEach((tag: any) => tagMap.set(tag.name, tag.id));

  for (const name of normalized) {
    if (!tagMap.has(name)) {
      const { data: newTag, error: tagError } = await supabase
        .from("task_tags")
        .insert({ workspace_id: task.workspace_id, name })
        .select("id, name")
        .single();
      if (tagError || !newTag) {
        return { error: "Failed to create tag" };
      }
      tagMap.set(newTag.name, newTag.id);
    }
  }

  const desiredTagIds = new Set(normalized.map((name) => tagMap.get(name)!).filter(Boolean));

  const toInsert = Array.from(desiredTagIds).filter((id) => !existingTagIds.has(id));
  const toDelete = Array.from(existingTagIds).filter((id) => !desiredTagIds.has(id));

  if (toInsert.length > 0) {
    const payload = toInsert.map((tagId) => ({ task_id: taskId, tag_id: tagId }));
    const { error } = await supabase.from("task_tag_links").insert(payload);
    if (error) return { error: "Failed to attach tags" };
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("task_tag_links")
      .delete()
      .eq("task_id", taskId)
      .in("tag_id", toDelete);
    if (error) return { error: "Failed to detach tags" };
  }

  return { data: null };
}
```

#### listWorkspaceTaskTags

- What it does: Uses Supabase to read records in task_tags. Enforces access checks.
- Found in: `src/app/actions/tasks/tag-actions.ts`

```ts
export async function listWorkspaceTaskTags(workspaceId: string): Promise<ActionResult<TaskTag[]>> {
  const { createClient } = await import("@/lib/supabase/server");
  const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { data, error } = await supabase
    .from("task_tags")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error || !data) return { error: "Failed to load tags" };
  return { data: data as TaskTag[] };
}
```

### src/app/actions/timelines/auto-schedule-actions.ts

#### autoScheduleTimeline

- What it does: Uses Supabase to upsert and read records in timeline_events, timeline_dependencies. Enforces access checks.
- Found in: `src/app/actions/timelines/auto-schedule-actions.ts`

```ts
export async function autoScheduleTimeline(timelineBlockId: string): Promise<ActionResult<TimelineEvent[]>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, userId, block } = access;

  const { data: events } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("timeline_block_id", block.id);

  const { data: dependencies } = await supabase
    .from("timeline_dependencies")
    .select("*")
    .eq("timeline_block_id", block.id);

  if (!events || !dependencies) return { error: "Failed to load timeline data" };

  const eventMap = new Map(events.map((event: any) => [event.id, event]));

  const updates: TimelineEvent[] = [];

  for (const dep of dependencies as TimelineDependency[]) {
    if (dep.to_type !== "event") continue;

    const toEvent = eventMap.get(dep.to_id) as TimelineEvent | undefined;
    if (!toEvent) continue;

    const fromRange = eventMap.get(dep.from_id);
    if (!fromRange) continue;

    const fromStart = new Date((fromRange as any).start_date);
    const fromEnd = new Date((fromRange as any).end_date);

    const toStart = new Date(toEvent.start_date);
    const toEnd = new Date(toEvent.end_date);

    const requiredStart = getRequiredStart(dep.dependency_type, fromStart, fromEnd, toStart, toEnd);

    if (requiredStart > toStart) {
      const duration = toEnd.getTime() - toStart.getTime();
      const nextStart = requiredStart;
      const nextEnd = new Date(requiredStart.getTime() + duration);
      toEvent.start_date = nextStart.toISOString();
      toEvent.end_date = nextEnd.toISOString();
      updates.push(toEvent);
    }
  }

  if (updates.length === 0) return { data: events as TimelineEvent[] };

  const payload = updates.map((event) => ({
    id: event.id,
    start_date: event.start_date,
    end_date: event.end_date,
    updated_by: userId,
  }));

  const { data, error } = await supabase
    .from("timeline_events")
    .upsert(payload, { onConflict: "id" })
    .select("*");

  if (error || !data) return { error: "Failed to auto-schedule timeline" };

  return { data: data as TimelineEvent[] };
}
```

### src/app/actions/timelines/bulk-actions.ts

#### bulkUpdateTimelineEvents

- What it does: Performs the "bulk update timeline events" action for timeline.
- Found in: `src/app/actions/timelines/bulk-actions.ts`

```ts
export async function bulkUpdateTimelineEvents(input: {
  timelineBlockId: string;
  updates: Array<{ id: string; startDate?: string; endDate?: string; displayOrder?: number }>;
}
```

#### bulkDeleteTimelineEvents

- What it does: Performs the "bulk delete timeline events" action for timeline.
- Found in: `src/app/actions/timelines/bulk-actions.ts`

```ts
export async function bulkDeleteTimelineEvents(input: {
  timelineBlockId: string;
  eventIds: string[];
}
```

#### bulkDuplicateTimelineEvents

- What it does: Performs the "bulk duplicate timeline events" action for timeline.
- Found in: `src/app/actions/timelines/bulk-actions.ts`

```ts
export async function bulkDuplicateTimelineEvents(input: {
  timelineBlockId: string;
  eventIds: string[];
}
```

### src/app/actions/timelines/context.ts

#### requireTimelineAccess

- What it does: Enforces access checks.
- Found in: `src/app/actions/timelines/context.ts`

```ts
export async function requireTimelineAccess(timelineBlockId: string): Promise<{ error: string }
```

#### requireWorkspaceAccessForTimeline

- What it does: Enforces access checks.
- Found in: `src/app/actions/timelines/context.ts`

```ts
export async function requireWorkspaceAccessForTimeline(workspaceId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId: user.id };
}
```

### src/app/actions/timelines/dependency-actions.ts

#### createTimelineDependency

- What it does: Performs the "create timeline dependency" action for timeline.
- Found in: `src/app/actions/timelines/dependency-actions.ts`

```ts
export async function createTimelineDependency(input: {
  timelineBlockId: string;
  fromId: string;
  toId: string;
  dependencyType: DependencyType;
}
```

#### deleteTimelineDependency

- What it does: Uses Supabase to delete records in timeline_dependencies.
- Found in: `src/app/actions/timelines/dependency-actions.ts`

```ts
export async function deleteTimelineDependency(dependencyId: string): Promise<ActionResult<null>> {
  const access = await getDependencyContext(dependencyId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase } = access;
  const { error } = await supabase
    .from("timeline_dependencies")
    .delete()
    .eq("id", dependencyId);

  if (error) return { error: "Failed to delete dependency" };

  return { data: null };
}
```

#### getTimelineDependencies

- What it does: Uses Supabase to read records in timeline_dependencies. Enforces access checks.
- Found in: `src/app/actions/timelines/dependency-actions.ts`

```ts
export async function getTimelineDependencies(timelineBlockId: string): Promise<ActionResult<TimelineDependency[]>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, block } = access;

  const { data, error } = await supabase
    .from("timeline_dependencies")
    .select("*")
    .eq("timeline_block_id", block.id)
    .order("created_at", { ascending: true });

  if (error || !data) return { error: "Failed to load dependencies" };

  return { data: data as TimelineDependency[] };
}
```

### src/app/actions/timelines/event-actions.ts

#### createTimelineEvent

- What it does: Performs the "create timeline event" action for timeline.
- Found in: `src/app/actions/timelines/event-actions.ts`

```ts
export async function createTimelineEvent(input: {
  timelineBlockId: string;
  title: string;
  startDate: string;
  endDate: string;
  status?: TimelineEventStatus;
  assigneeId?: string | null;
  progress?: number;
  notes?: string | null;
  color?: string | null;
  isMilestone?: boolean;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  displayOrder?: number;
}
```

#### updateTimelineEvent

- What it does: Performs the "update timeline event" action for timeline.
- Found in: `src/app/actions/timelines/event-actions.ts`

```ts
export async function updateTimelineEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    startDate: string;
    endDate: string;
    status: TimelineEventStatus;
    assigneeId: string | null;
    progress: number;
    notes: string | null;
    color: string | null;
    isMilestone: boolean;
    baselineStart: string | null;
    baselineEnd: string | null;
    displayOrder: number;
  }
```

#### deleteTimelineEvent

- What it does: Uses Supabase to delete records in timeline_events.
- Found in: `src/app/actions/timelines/event-actions.ts`

```ts
export async function deleteTimelineEvent(eventId: string): Promise<ActionResult<null>> {
  const access = await getEventContext(eventId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase } = access;
  const { error } = await supabase.from("timeline_events").delete().eq("id", eventId);

  if (error) return { error: "Failed to delete timeline event" };
  return { data: null };
}
```

#### duplicateTimelineEvent

- What it does: Uses Supabase to create and read records in timeline_events.
- Found in: `src/app/actions/timelines/event-actions.ts`

```ts
export async function duplicateTimelineEvent(eventId: string): Promise<ActionResult<TimelineEvent>> {
  const access = await getEventContext(eventId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, userId, event } = access;

  const { data, error } = await supabase
    .from("timeline_events")
    .insert({
      timeline_block_id: event.timeline_block_id,
      workspace_id: event.workspace_id,
      title: `${event.title} (Copy)`,
      start_date: event.start_date,
      end_date: event.end_date,
      status: event.status,
      assignee_id: event.assignee_id,
      progress: event.progress,
      notes: event.notes,
      color: event.color,
      is_milestone: event.is_milestone,
      baseline_start: event.baseline_start,
      baseline_end: event.baseline_end,
      display_order: event.display_order + 1,
      created_by: userId,
      updated_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to duplicate timeline event" };
  }

  return { data: data as TimelineEvent };
}
```

#### setTimelineEventBaseline

- What it does: Performs the "set timeline event baseline" action for timeline.
- Found in: `src/app/actions/timelines/event-actions.ts`

```ts
export async function setTimelineEventBaseline(eventId: string, baseline: { start: string | null; end: string | null }
```

### src/app/actions/timelines/field-mapping.ts

#### autoDetectDateFields

- What it does: Uses Supabase to read records in table_fields.
- Found in: `src/app/actions/timelines/field-mapping.ts`

```ts
export async function autoDetectDateFields(tableId: string, supabase: any) {
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, type, is_primary, order")
    .eq("table_id", tableId)
    .order("order", { ascending: true });

  const dateFields = (fields || []).filter((field: any) => field.type === "date");
  const start = dateFields[0]?.id || null;
  const end = dateFields[1]?.id || null;

  return { startDateFieldId: start, endDateFieldId: end };
}
```

#### resolveReferenceData

- What it does: Performs the "resolve reference data" action for timeline.
- Found in: `src/app/actions/timelines/field-mapping.ts`

```ts
export async function resolveReferenceData(input: {
  reference: TimelineReference;
  supabase: any;
}
```

### src/app/actions/timelines/linkable-actions.ts

#### getRecentLinkableItems

- What it does: Performs the "get recent linkable items" action for timeline.
- Found in: `src/app/actions/timelines/linkable-actions.ts`

```ts
export async function getRecentLinkableItems(input: {
  projectId: string;
  workspaceId: string;
  limit?: number;
}
```

#### searchLinkableItems

- What it does: Performs the "search linkable items" action for timeline.
- Found in: `src/app/actions/timelines/linkable-actions.ts`

```ts
export async function searchLinkableItems(input: {
  projectId: string;
  workspaceId: string;
  query: string;
  type?: LinkableType | null;
  limit?: number;
}
```

### src/app/actions/timelines/query-actions.ts

#### getTimelineItems

- What it does: Performs the "get timeline items" action for timeline.
- Found in: `src/app/actions/timelines/query-actions.ts`

```ts
export async function getTimelineItems(timelineBlockId: string): Promise<ActionResult<{ events: TimelineEvent[] }
```

#### getResolvedTimelineItems

- What it does: Enforces access checks.
- Found in: `src/app/actions/timelines/query-actions.ts`

```ts
export async function getResolvedTimelineItems(timelineBlockId: string): Promise<ActionResult<TimelineItem[]>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const itemsResult = await getTimelineItems(timelineBlockId);
  if ("error" in itemsResult) return itemsResult;
  const items = itemsResult.data;

  const eventItems: TimelineItem[] = (items.events || []).map((event) => ({
    id: event.id,
    type: "event",
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    status: event.status,
    assignee_id: event.assignee_id,
    progress: event.progress,
    color: event.color,
    is_milestone: event.is_milestone,
    notes: event.notes ?? null,
    baseline_start: event.baseline_start,
    baseline_end: event.baseline_end,
    display_order: event.display_order,
  }));

  const combined = [...eventItems];
  combined.sort((a, b) => a.display_order - b.display_order);

  return { data: combined };
}
```

### src/app/actions/timelines/reference-actions.ts

#### createTimelineReference

- What it does: Performs the "create timeline reference" action for timeline.
- Found in: `src/app/actions/timelines/reference-actions.ts`

```ts
export async function createTimelineReference(input: {
  timelineBlockId: string;
  eventId: string;
  referenceType: ReferenceType;
  referenceId: string;
  tableId?: string | null;
}
```

#### updateTimelineReference

- What it does: Performs the "update timeline reference" action for timeline.
- Found in: `src/app/actions/timelines/reference-actions.ts`

```ts
export async function updateTimelineReference(
  referenceId: string,
  updates: Partial<{ tableId: string | null }
```

#### deleteTimelineReference

- What it does: Uses Supabase to delete records in timeline_references.
- Found in: `src/app/actions/timelines/reference-actions.ts`

```ts
export async function deleteTimelineReference(referenceId: string): Promise<ActionResult<null>> {
  const access = await getReferenceContext(referenceId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase } = access;
  const { error } = await supabase.from("timeline_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete timeline reference" };
  return { data: null };
}
```

#### listTimelineReferences

- What it does: Uses Supabase to read records in timeline_references.
- Found in: `src/app/actions/timelines/reference-actions.ts`

```ts
export async function listTimelineReferences(eventId: string): Promise<ActionResult<TimelineReference[]>> {
  const access = await getReferenceContextByEvent(eventId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, event } = access;
  const { data, error } = await supabase
    .from("timeline_references")
    .select("*")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  if (error || !data) return { error: "Failed to load references" };
  return { data: data as TimelineReference[] };
}
```

#### listTimelineReferenceSummaries

- What it does: Performs the "list timeline reference summaries" action for timeline.
- Found in: `src/app/actions/timelines/reference-actions.ts`

```ts
export async function listTimelineReferenceSummaries(eventId: string): Promise<ActionResult<Array<TimelineReference & { title: string; type_label?: string }
```

#### bulkImportTableRows

- What it does: Performs the "bulk import table rows" action for timeline.
- Found in: `src/app/actions/timelines/reference-actions.ts`

```ts
export async function bulkImportTableRows(input: {
  timelineBlockId: string;
  eventId: string;
  tableId: string;
  rowIds: string[];
}
```

### src/app/actions/timelines/validators.ts

#### validateTimelineDateRange

- What it does: Performs the "validate timeline date range" action for timeline.
- Found in: `src/app/actions/timelines/validators.ts`

```ts
export function validateTimelineDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, message: "Invalid date" };
  }
  if (start > end) {
    return { valid: false, message: "Start date must be before end date" };
  }
  return { valid: true };
}
```

#### validateDependencyType

- What it does: Performs the "validate dependency type" action for timeline.
- Found in: `src/app/actions/timelines/validators.ts`

```ts
export function validateDependencyType(type: string): type is DependencyType {
  return VALID_DEPENDENCY_TYPES.includes(type as DependencyType);
}
```

#### validateReferenceType

- What it does: Performs the "validate reference type" action for timeline.
- Found in: `src/app/actions/timelines/validators.ts`

```ts
export function validateReferenceType(type: string): type is ReferenceType {
  return VALID_REFERENCE_TYPES.includes(type as ReferenceType);
}
```

#### validateEventStatus

- What it does: Performs the "validate event status" action for timeline.
- Found in: `src/app/actions/timelines/validators.ts`

```ts
export function validateEventStatus(status: string): status is TimelineEventStatus {
  return VALID_EVENT_STATUSES.includes(status as TimelineEventStatus);
}
```

#### detectCircularDependencies

- What it does: Performs the "detect circular dependencies" action for timeline.
- Found in: `src/app/actions/timelines/validators.ts`

```ts
export function detectCircularDependencies(
  edges: Array<{ fromId: string; toId: string }
```

### src/app/actions/workspace.ts

#### getCurrentWorkspaceId

- What it does: Get current workspace ID from cookie
- Found in: `src/app/actions/workspace.ts`

```ts
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CURRENT_WORKSPACE_COOKIE)?.value || null;
}
```

#### updateCurrentWorkspace

- What it does: Update current workspace cookie
- Found in: `src/app/actions/workspace.ts`

```ts
export async function updateCurrentWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  
  // Verify user has access to this workspace
  const authResult = await getServerUser();
  if (!authResult) {
    return { error: "Not authenticated" };
  }

  const { supabase, user } = authResult;
  
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  
  if (!membership) {
    return { error: "You don't have access to this workspace" };
  }
  
  // Set cookie (expires in 1 year)
  cookieStore.set(CURRENT_WORKSPACE_COOKIE, workspaceId, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  
  return { success: true };
}
```

#### createWorkspace

- What it does: create workspace action
- Found in: `src/app/actions/workspace.ts`

```ts
export async function createWorkspace(name: string) {
  const authResult = await getServerUser()
  
  // 1. Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult
  
  // 2. Check if user already has a workspace (validation)
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (existingMember) {
    return { error: 'User already has a workspace' }
  }
  
  // 3. Create workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ 
      name, 
      owner_id: user.id 
    })
    .select()
    .single()
  
  if (workspaceError) {
    return { error: workspaceError.message }
  }
  
  // 4. Add creator as owner in workspace_members
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner'
    })
  
  if (memberError) {
    // Rollback workspace creation if member insert fails
    await supabase.from('workspaces').delete().eq('id', workspace.id)
    return { error: 'Failed to create workspace member' }
  }
  
  // 5. Revalidate any cached paths
  revalidatePath('/dashboard')
  
  return { data: workspace }
}
```

#### getUserWorkspaces

- What it does: Cache this to prevent redundant queries in the same request
- Found in: `src/app/actions/workspace.ts`

```ts
export const getUserWorkspaces = cache(async () => {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
    // 2. Query all workspaces user is member of with role information
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id,
          name,
          owner_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
    
    if (error) {
      return { error: error.message }
    }
    
    // 3. Transform data to include role with workspace
    const workspaces = memberships.map(membership => ({
      ...membership.workspaces,
      role: membership.role
    }))
    
    return { data: workspaces }
}
```

#### inviteMember

- What it does: if the inviter alread exists within the Trak system, they will be added when they login. If they do not exist within the Trak system, they will be added when they sign up through a magic link.
- Found in: `src/app/actions/workspace.ts`

```ts
export async function inviteMember(workspaceId: string, email: string, role: 'admin' | 'teammate') {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
    // 2. Validate inviter has admin/owner permissions
    const { data: inviterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    
    if (!inviterMembership || (inviterMembership.role !== 'owner' && inviterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can invite members.' }
    }
    
    // 3. Check if invitee email exists in profiles
    const { data: inviteeProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    
    if (profileError || !inviteeProfile) {
      return { error: 'User with this email does not exist. They must sign up first.' }
    }
    
    // 4. Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', inviteeProfile.id)
      .maybeSingle()
    
    if (existingMember) {
      return { error: 'User is already a member of this workspace.' }
    }
    
    // 5. Create workspace_member record
    const { data: newMember, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: inviteeProfile.id,
        role: role
      })
      .select(`
        id,
        role,
        created_at,
        user_id
      `)
      .single()
    
    if (memberError) {
      return { error: memberError.message }
    }
    
    // 6. TODO: Send invitation email (placeholder)
    // await sendInvitationEmail(email, workspaceName)
    
    revalidatePath('/dashboard')
    
    return { data: newMember }
}
```

#### updateMemberRole

- What it does: Update member role server action. This updates the role of a member in a workspace. The updater must either be the owner or have admin permissions. This code updates the member's role and prevents demoting the last owner.
- Found in: `src/app/actions/workspace.ts`

```ts
export async function updateMemberRole(workspaceId: string, memberId: string, newRole: 'owner' | 'admin' | 'teammate') {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
    // 2. Validate requester is owner/admin
    const { data: requesterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    
    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can update member roles.' }
    }
    
    // 3. Get the member being updated
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!targetMember) {
      return { error: 'Member not found in this workspace.' }
    }
    
    // 4. If demoting from owner, check if they're the last owner
    // SECURITY FIX: Atomic check-and-update to prevent race condition
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      // Get current count of owners
      const { count: ownerCount } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')

      if (ownerCount !== null && ownerCount <= 1) {
        return { error: 'Cannot demote the last owner. Promote another member to owner first.' }
      }
    }

    // 5. Update member's role
    const { data: updatedMember, error: updateError } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .select(`
        id,
        role,
        user_id
      `)
      .single()

    if (updateError) {
      return { error: updateError.message }
    }

    // 6. SECURITY: Verify the update didn't leave workspace without an owner
    // This double-check catches race conditions
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      const { count: remainingOwners } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')

      if (remainingOwners === 0) {
        // Rollback: restore owner role
        await supabase
          .from('workspace_members')
          .update({ role: 'owner' })
          .eq('id', memberId)

        return { error: 'Cannot demote the last owner. Promote another member to owner first.' }
      }
    }
    
    revalidatePath('/dashboard')
    
    return { data: updatedMember }
}
```

#### removeMember

- What it does: remove member server action. the requester must be owner or admin, and the last owner cannot be removed.
- Found in: `src/app/actions/workspace.ts`

```ts
export async function removeMember(workspaceId: string, memberId: string) {
    const authResult = await getServerUser()
    
    // 1. Get authenticated user
    if (!authResult) {
      return { error: 'Unauthorized' }
    }
    const { supabase, user } = authResult
    
    // 2. Validate requester is owner/admin
    const { data: requesterMembership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
    
    if (!requesterMembership || (requesterMembership.role !== 'owner' && requesterMembership.role !== 'admin')) {
      return { error: 'Insufficient permissions. Only owners and admins can remove members.' }
    }
    
    // 3. Get the member being removed
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role, user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!targetMember) {
      return { error: 'Member not found in this workspace.' }
    }
    
    // 4. If removing an owner, check if they're the last owner
    if (targetMember.role === 'owner') {
      const { count } = await supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')
      
      if (count && count <= 1) {
        return { error: 'Cannot remove the last owner. Transfer ownership first.' }
      }
    }
    
    // 5. Delete member record
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
    
    if (deleteError) {
      return { error: deleteError.message }
    }
    
    revalidatePath('/dashboard')
    
    return { data: { success: true, message: 'Member removed successfully' } }
}
```

#### getWorkspaceMembers

- What it does: Get all workspace members (for assignee dropdowns, etc.)
- Found in: `src/app/actions/workspace.ts`

```ts
export async function getWorkspaceMembers(workspaceId: string) {
  const authResult = await getServerUser()
  
  // 1. Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult
  
  // 2. Verify user is member of the workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()
  
  if (!membership) {
    return { error: 'Not a member of this workspace' }
  }
  
  // 3. Get all workspace members
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  
  if (error) {
    return { error: error.message }
  }

  if (!members || members.length === 0) {
    return { data: [] }
  }

  // 4. Get profile info for each user
  const userIds = members.map(m => m.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, name')
    .in('id', userIds)

  if (profilesError) {
    logger.error('Error fetching profiles:', profilesError)
    // Fallback: return members without profile info
    const transformedMembers = members.map(member => ({
      id: member.user_id,
      email: '',
      name: 'Unknown',
      role: member.role,
    }))
    return { data: transformedMembers }
  }

  // 5. Transform data to combine members with profiles
  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
  const transformedMembers = members.map(member => {
    const profile = profileMap.get(member.user_id)
    return {
      id: member.user_id,
      email: profile?.email || '',
      name: profile?.name || profile?.email || 'Unknown',
      role: member.role,
    }
  })
  
  return { data: transformedMembers }
}
```

### src/lib/auth/actions.ts

#### signup

- What it does: Performs the "signup" action for entity.
- Found in: `src/lib/auth/actions.ts`

```ts
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
      },
    },
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    console.error('Signup error:', error.message)
    // You could redirect to an error page or handle this differently
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  // Redirect to login page with success message
  redirect('/login?message=Check your email to confirm your account')
}
```

#### login

- What it does: Performs the "login" action for entity.
- Found in: `src/lib/auth/actions.ts`

```ts
export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error('Login error:', error.message)
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Get the redirect URL from the search params
  const redirectTo = formData.get('redirectTo') as string
  const redirectUrl = redirectTo ? decodeURIComponent(redirectTo) : '/'
  
  redirect(redirectUrl)
}
```

## API Routes

### src/app/api/client-comments/route.ts

#### POST

- What it does: Performs the "post" action for entity.
- Found in: `src/app/api/client-comments/route.ts`

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, text, authorName, visitorId } = body ?? {};

    if (
      typeof publicToken !== "string" ||
      typeof blockId !== "string" ||
      typeof visitorId !== "string"
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalid },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - 10 comments per visitorId per 5 minutes
    const clientIp = getClientIp(request);
    const rateLimitKey = `comment:create:${visitorId}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000, // 5 minutes
      message: "Too many comments. Please wait a few minutes before commenting again.",
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingName },
        { status: 400 }
      );
    }

    const { text: validatedText, error: textError } = validateIncomingComment(
      text
    );
    if (textError || !validatedText) {
      return NextResponse.json({ error: textError }, { status: 400 });
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }

    const { block, project, tab, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_comments_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      );
    }

    const content = block.content || {};
    const existingComments: BlockComment[] = Array.isArray(
      content._blockComments
    )
      ? [...content._blockComments]
      : [];

    const newComment: BlockComment = {
      id: `client-comment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      author_id: buildAuthorId(visitorId),
      author_name: authorName.trim(),
      text: validatedText,
      timestamp: new Date().toISOString(),
      source: "external",
    };

    const updated = await persistComments(
      supabase,
      block.id,
      content,
      [...existingComments, newComment]
    );

    await revalidateSurfaces(project.id, tab.id, project.public_token);

    return NextResponse.json({ comments: updated });
  } catch (error) {
    logger.error("Client comment POST error:", error);
    return NextResponse.json(
      { error: "Failed to add comment." },
      { status: 500 }
    );
  }
}
```

#### PATCH

- What it does: Performs the "patch" action for entity.
- Found in: `src/app/api/client-comments/route.ts`

```ts
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, commentId, text, visitorId } = body ?? {};

    if (
      typeof publicToken !== "string" ||
      typeof blockId !== "string" ||
      typeof visitorId !== "string" ||
      typeof commentId !== "string"
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalid },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - 20 updates per visitorId per 5 minutes
    const clientIp = getClientIp(request);
    const rateLimitKey = `comment:update:${visitorId}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      message: "Too many comment updates. Please wait a few minutes.",
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    const { text: validatedText, error: textError } = validateIncomingComment(
      text
    );
    if (textError || !validatedText) {
      return NextResponse.json({ error: textError }, { status: 400 });
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }

    const { block, project, tab, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_comments_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      );
    }

    const content = block.content || {};
    const existingComments: BlockComment[] = Array.isArray(
      content._blockComments
    )
      ? [...content._blockComments]
      : [];

    const targetIndex = existingComments.findIndex(
      (comment) => comment.id === commentId
    );

    if (targetIndex === -1) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 }
      );
    }

    const target = existingComments[targetIndex];
    if (!isOwnExternalComment(target, visitorId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 403 }
      );
    }

    existingComments[targetIndex] = {
      ...target,
      text: validatedText,
      timestamp: new Date().toISOString(),
    };

    const updated = await persistComments(
      supabase,
      block.id,
      content,
      existingComments
    );

    await revalidateSurfaces(project.id, tab.id, project.public_token);

    return NextResponse.json({ comments: updated });
  } catch (error) {
    logger.error("Client comment PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update comment." },
      { status: 500 }
    );
  }
}
```

#### DELETE

- What it does: Performs the "delete" action for entity.
- Found in: `src/app/api/client-comments/route.ts`

```ts
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, blockId, commentId, visitorId } = body ?? {};

    if (
      typeof publicToken !== "string" ||
      typeof blockId !== "string" ||
      typeof visitorId !== "string" ||
      typeof commentId !== "string"
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalid },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting - 10 deletions per visitorId per 5 minutes
    const clientIp = getClientIp(request);
    const rateLimitKey = `comment:delete:${visitorId}:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
      message: "Too many comment deletions. Please wait a few minutes.",
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    const context = await getBlockContext(blockId);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: 400 });
    }

    const { block, project, tab, supabase } = context;

    if (
      !project.client_page_enabled ||
      !project.client_comments_enabled ||
      project.public_token !== publicToken
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.forbidden },
        { status: 403 }
      );
    }

    const content = block.content || {};
    const existingComments: BlockComment[] = Array.isArray(
      content._blockComments
    )
      ? [...content._blockComments]
      : [];

    const targetIndex = existingComments.findIndex(
      (comment) => comment.id === commentId
    );

    if (targetIndex === -1) {
      return NextResponse.json(
        { error: "Comment not found." },
        { status: 404 }
      );
    }

    const target = existingComments[targetIndex];

    if (!isOwnExternalComment(target, visitorId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 403 }
      );
    }

    existingComments.splice(targetIndex, 1);

    const updated = await persistComments(
      supabase,
      block.id,
      content,
      existingComments
    );

    await revalidateSurfaces(project.id, tab.id, project.public_token);

    return NextResponse.json({ comments: updated });
  } catch (error) {
    logger.error("Client comment DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete comment." },
      { status: 500 }
    );
  }
}
```

### src/app/api/populate-buckeye/route.ts

#### POST

- What it does: Uses Supabase to read records in projects, tabs.
- Found in: `src/app/api/populate-buckeye/route.ts`

```ts
export async function POST() {
  try {
    const supabase = await createClient();

    // Find Buckeye Brownies project
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", "%buckeye%")
      .limit(1);

    if (projectError || !projects || projects.length === 0) {
      return NextResponse.json(
        { error: "Could not find Buckeye Brownies project" },
        { status: 404 }
      );
    }

    const project = projects[0];

    // Get the first tab
    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, name")
      .eq("project_id", project.id)
      .order("position", { ascending: true })
      .limit(1);

    if (tabsError || !tabs || tabs.length === 0) {
      return NextResponse.json(
        { error: "Could not find any tabs" },
        { status: 404 }
      );
    }

    const mainTab = tabs[0];

    // Create subtabs
    const subtabs = [
      "Overview",
      "Production Schedule",
      "Marketing Assets",
      "Packaging",
      "Distribution",
      "Budget & Costs",
    ];

    const createdSubtabs: { id: string; name: string }[] = [];

    for (let i = 0; i < subtabs.length; i++) {
      const result = await createTab({
        projectId: project.id,
        name: subtabs[i],
        parentTabId: mainTab.id,
      });

      if (result.error) {
        console.error(`Error creating subtab ${subtabs[i]}:`, result.error);
      } else if (result.data) {
        createdSubtabs.push({ id: result.data.id, name: result.data.name });
      }
    }

    // Add blocks to Overview
    if (createdSubtabs.length > 0) {
      const overviewTab = createdSubtabs[0];

      await createBlock({
        tabId: overviewTab.id,
        type: "text",
        content: {
          text: `# Buckeye Brownies Launch

## Project Overview

We're launching a new line of premium buckeye brownies for the holiday season. This project encompasses everything from recipe development to final distribution.

### Key Objectives
- Launch 3 SKUs by December 1st
- Achieve 10,000 units sold in first month
- Establish brand presence in 50+ retail locations
- Generate $150K in revenue

### Timeline
- **Phase 1**: Recipe & Testing (Weeks 1-2)
- **Phase 2**: Production Setup (Weeks 3-4)
- **Phase 3**: Marketing & Distribution (Weeks 5-6)
- **Phase 4**: Launch & Monitoring (Week 7+)`,
        },
        position: 0,
      });

      const overviewTasksBlock = await createBlock({
        tabId: overviewTab.id,
        type: "task",
        content: {
          title: "Key Milestones",
          hideIcons: false,
        },
        position: 1,
      });
      if (overviewTasksBlock.data?.id) {
        const tasks = [
          { text: "Finalize recipe with head chef", status: "done" },
          { text: "Secure production facility", status: "done" },
          { text: "Design packaging", status: "todo" },
          { text: "Photography shoot", status: "todo" },
          { text: "Website launch", status: "todo" },
          { text: "First production run", status: "todo" },
        ];
        for (const task of tasks) {
          await createTaskItem({
            taskBlockId: overviewTasksBlock.data.id,
            title: task.text,
            status: task.status as any,
          });
        }
      }

      await createBlock({
        tabId: overviewTab.id,
        type: "table",
        content: {
          title: "Product SKUs",
          columns: [
            { id: "col1", name: "SKU", type: "text" },
            { id: "col2", name: "Quantity", type: "text" },
            { id: "col3", name: "Ship Date", type: "text" },
            { id: "col4", name: "Status", type: "text" },
          ],
          rows: [
            {
              id: "row1",
              cells: {
                col1: "Classic Buckeye",
                col2: "2,400 boxes",
                col3: "Dec 8",
                col4: "Locked",
              },
            },
            {
              id: "row2",
              cells: {
                col1: "Peppermint Buckeye",
                col2: "1,600 boxes",
                col3: "Dec 9",
                col4: "Packaging art in review",
              },
            },
            {
              id: "row3",
              cells: {
                col1: "Salted Caramel Buckeye",
                col2: "2,000 boxes",
                col3: "Dec 10",
                col4: "Recipe testing",
              },
            },
          ],
        },
        position: 2,
      });
    }

    // Add blocks to Production Schedule
    if (createdSubtabs.length > 1) {
      const productionTab = createdSubtabs[1];

      await createBlock({
        tabId: productionTab.id,
        type: "text",
        content: {
          text: `# Production Schedule

## Week-by-Week Breakdown

### Week 1-2: Recipe Development
- Test base brownie recipe
- Develop buckeye filling consistency
- Flavor profile testing
- Shelf life testing

### Week 3-4: Production Setup
- Equipment calibration
- Staff training
- Quality control protocols
- Packaging line setup

### Week 5-6: Pre-Launch Production
- Small batch production runs
- Quality assurance testing
- Inventory management setup
- Distribution coordination`,
        },
        position: 0,
      });

      const productionTasksBlock = await createBlock({
        tabId: productionTab.id,
        type: "task",
        content: {
          title: "Production Tasks",
          hideIcons: false,
        },
        position: 1,
      });
      if (productionTasksBlock.data?.id) {
        const tasks = [
          { text: "Order ingredients in bulk", status: "done" },
          { text: "Schedule production staff", status: "todo" },
          { text: "Set up quality control checkpoints", status: "todo" },
          { text: "Coordinate with packaging team", status: "todo" },
          { text: "Run test batches", status: "todo" },
        ];
        for (const task of tasks) {
          await createTaskItem({
            taskBlockId: productionTasksBlock.data.id,
            title: task.text,
            status: task.status as any,
          });
        }
      }
    }

    // Add blocks to Marketing Assets
    if (createdSubtabs.length > 2) {
      const marketingTab = createdSubtabs[2];

      await createBlock({
        tabId: marketingTab.id,
        type: "text",
        content: {
          text: `# Marketing Assets

## Required Materials

### Photography
- Product shots (hero images)
- Lifestyle photography
- Behind-the-scenes content
- Social media assets

### Copy
- Product descriptions
- Website content
- Social media captions
- Email marketing copy

### Design
- Packaging design
- Website graphics
- Social media templates
- Print materials`,
        },
        position: 0,
      });

      await createBlock({
        tabId: marketingTab.id,
        type: "link",
        content: {
          url: "https://www.instagram.com/buckeyebrownies",
          title: "Buckeye Brownies Instagram",
          description: "Follow us for behind-the-scenes content and updates",
        },
        position: 1,
      });
    }

    // Add blocks to Packaging
    if (createdSubtabs.length > 3) {
      const packagingTab = createdSubtabs[3];

      await createBlock({
        tabId: packagingTab.id,
        type: "text",
        content: {
          text: `# Packaging Requirements

## Design Specifications
- Eco-friendly materials
- Window for product visibility
- Brand logo prominently displayed
- Nutritional information panel
- Barcode placement

## Timeline
- Design approval: Nov 15
- Print production: Nov 20
- Delivery: Nov 25
- Assembly: Nov 28`,
        },
        position: 0,
      });
    }

    // Add blocks to Distribution
    if (createdSubtabs.length > 4) {
      const distributionTab = createdSubtabs[4];

      await createBlock({
        tabId: distributionTab.id,
        type: "table",
        content: {
          title: "Distribution Partners",
          columns: [
            { id: "col1", name: "Retailer", type: "text" },
            { id: "col2", name: "Location", type: "text" },
            { id: "col3", name: "Order Qty", type: "text" },
            { id: "col4", name: "Status", type: "text" },
          ],
          rows: [
            {
              id: "row1",
              cells: {
                col1: "Whole Foods",
                col2: "Regional",
                col3: "500 boxes",
                col4: "Confirmed",
              },
            },
            {
              id: "row2",
              cells: {
                col1: "Local Markets",
                col2: "Various",
                col3: "300 boxes",
                col4: "Pending",
              },
            },
            {
              id: "row3",
              cells: {
                col1: "Online Store",
                col2: "N/A",
                col3: "1,000 boxes",
                col4: "Live",
              },
            },
          ],
        },
        position: 0,
      });
    }

    // Add blocks to Budget & Costs
    if (createdSubtabs.length > 5) {
      const budgetTab = createdSubtabs[5];

      await createBlock({
        tabId: budgetTab.id,
        type: "table",
        content: {
          title: "Budget Breakdown",
          columns: [
            { id: "col1", name: "Category", type: "text" },
            { id: "col2", name: "Budgeted", type: "text" },
            { id: "col3", name: "Spent", type: "text" },
            { id: "col4", name: "Remaining", type: "text" },
          ],
          rows: [
            {
              id: "row1",
              cells: {
                col1: "Ingredients",
                col2: "$25,000",
                col3: "$12,500",
                col4: "$12,500",
              },
            },
            {
              id: "row2",
              cells: {
                col1: "Packaging",
                col2: "$15,000",
                col3: "$8,200",
                col4: "$6,800",
              },
            },
            {
              id: "row3",
              cells: {
                col1: "Marketing",
                col2: "$20,000",
                col3: "$5,000",
                col4: "$15,000",
              },
            },
            {
              id: "row4",
              cells: {
                col1: "Distribution",
                col2: "$10,000",
                col3: "$2,500",
                col4: "$7,500",
              },
            },
          ],
        },
        position: 0,
      });

      await createBlock({
        tabId: budgetTab.id,
        type: "text",
        content: {
          text: `## Budget Summary

**Total Budget**: $70,000
**Total Spent**: $28,200
**Remaining**: $41,800

### Notes
- Ingredients costs are on track
- Packaging slightly over budget due to premium materials
- Marketing spend is conservative, room for expansion
- Distribution costs lower than expected`,
        },
        position: 1,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Buckeye Brownies project populated successfully",
      subtabsCreated: createdSubtabs.length,
    });
  } catch (error) {
    console.error("Error populating project:", error);
    return NextResponse.json(
      { error: "Failed to populate project", details: String(error) },
      { status: 500 }
    );
  }
}
```

### src/app/api/projects/route.ts

#### GET

- What it does: Performs the "get" action for entity.
- Found in: `src/app/api/projects/route.ts`

```ts
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
    }

    const projectsResult = await getAllProjects(workspaceId);
    if (projectsResult.error) {
      return NextResponse.json({ error: projectsResult.error }, { status: 400 });
    }

    // Fetch tabs for each project
    const projectsWithTabs = await Promise.all(
      (projectsResult.data || []).map(async (project: any) => {
        const tabsResult = await getProjectTabs(project.id);
        return {
          ...project,
          tabs: tabsResult.data || [],
        };
      })
    );

    return NextResponse.json({ projects: projectsWithTabs });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}
```

### src/app/api/supabase-ping/route.ts

#### GET

- What it does: Performs the "get" action for entity.
- Found in: `src/app/api/supabase-ping/route.ts`

```ts
export async function GET() {
  const supabase = await createClient(); // ← await the async factory
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return NextResponse.json(
      { ok: false, where: "server-route", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    where: "server-route",
    sessionPresent: !!data.session,
  });
}
```

### src/app/api/test-ai-search/route.ts

#### GET

- What it does: Performs the "get" action for entity.
- Found in: `src/app/api/test-ai-search/route.ts`

```ts
export async function GET(_request: NextRequest) {
  console.log("\n🧪 STARTING AI SEARCH TESTS\n");

  const results = { total: 0, passed: 0, failed: 0 };

  try {
    const r = await searchTasks({ status: "todo", limit: 5 });
    console.log(r.error ? "❌ searchTasks failed" : `✅ searchTasks: ${r.data?.length ?? 0} tasks`);
    r.error ? results.failed++ : results.passed++;
  } catch (error) {
    console.log("❌ searchTasks exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const r = await searchProjects({ limit: 5 });
    console.log(r.error ? "❌ searchProjects failed" : `✅ searchProjects: ${r.data?.length ?? 0} projects`);
    r.error ? results.failed++ : results.passed++;
  } catch (error) {
    console.log("❌ searchProjects exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const r = await searchBlocks({ type: "text", limit: 5 });
    console.log(r.error ? "❌ searchBlocks failed" : `✅ searchBlocks: ${r.data?.length ?? 0} blocks`);
    r.error ? results.failed++ : results.passed++;
  } catch (error) {
    console.log("❌ searchBlocks exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const search = await searchTasks({ limit: 1 });
    if (search.data?.[0]) {
      const r = await getTaskWithContext({ taskId: search.data[0].id });
      if (r.error) {
        console.log("❌ getTaskWithContext failed");
        results.failed++;
      } else {
        console.log(`✅ getTaskWithContext: ${r.data?.task.title}`);
        console.log(`   Assignees: ${r.data?.assignees.length ?? 0}, Tags: ${r.data?.tags.length ?? 0}`);
        results.passed++;
      }
    } else {
      console.log("⚠️  getTaskWithContext skipped (no tasks)");
    }
  } catch (error) {
    console.log("❌ getTaskWithContext exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const search = await searchProjects({ limit: 1 });
    if (search.data?.[0]) {
      const r = await getProjectWithContext({ projectId: search.data[0].id });
      if (r.error) {
        console.log("❌ getProjectWithContext failed");
        results.failed++;
      } else {
        console.log(`✅ getProjectWithContext: ${r.data?.project.name}`);
        console.log(`   Tabs: ${r.data?.tabs.length ?? 0}, Tasks: ${r.data?.taskSummary.total ?? 0}`);
        results.passed++;
      }
    } else {
      console.log("⚠️  getProjectWithContext skipped (no projects)");
    }
  } catch (error) {
    console.log("❌ getProjectWithContext exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const projectSearch = await searchProjects({ searchText: "feature test", limit: 1 });
    const project = projectSearch.data?.[0];
    if (!project) {
      console.log("⚠️  medium priority tasks test skipped (project not found)");
    } else {
      const r = await searchTasks({ projectId: project.id, priority: "medium", limit: 50 });
      console.log(
        r.error
          ? "❌ medium priority tasks test failed"
          : `✅ medium priority tasks in \"${project.name}\": ${r.data?.length ?? 0}`
      );
      r.error ? results.failed++ : results.passed++;
    }
  } catch (error) {
    console.log("❌ medium priority tasks test exception:", error);
    results.failed++;
  }
  results.total++;

  try {
    const search = await searchProjects({ limit: 1 });
    const context = search.data?.[0]
      ? await getProjectWithContext({ projectId: search.data[0].id })
      : null;
    if (context?.data) {
      console.log("✅ Integration: Search → Context works");
      results.passed++;
    } else {
      console.log("❌ Integration failed");
      results.failed++;
    }
  } catch (error) {
    console.log("❌ Integration exception:", error);
    results.failed++;
  }
  results.total++;

  console.log(
    `\n📊 SUMMARY: ${results.passed}/${results.total} passed${
      results.failed > 0 ? ` (${results.failed} failed)` : ""
    }`
  );
  console.log(results.failed === 0 ? "🎉 ALL TESTS PASSED!\n" : "⚠️  SOME TESTS FAILED\n");

  return Response.json({
    success: results.failed === 0,
    message: results.failed === 0 ? "All tests passed!" : "Some tests failed. Check terminal.",
    results,
  });
}
```

