"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId, safeRevalidatePath } from "@/app/actions/workspace";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { revalidateClientPages } from "@/app/actions/revalidate-client-page";
import { IndexingQueue } from "@/lib/search/job-queue";

// ============================================================================
// TYPES
// ============================================================================

export type BlockType = "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "video" | "image" | "gallery" | "embed" | "pdf" | "section" | "chart" | "doc_reference";

export interface Block {
  id: string;
  tab_id: string;
  parent_block_id: string | null;
  type: BlockType;
  content: Record<string, any>; // JSONB content, varies by type
  position: number;
  column: number; // Column index: 0, 1, or 2 (for up to 3 columns)
  is_template: boolean; // Whether this block is reusable across projects
  template_name: string | null; // Optional name for template blocks
  original_block_id: string | null; // If this is a reference, points to the original block
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AUTH UTILITIES - Centralized and cached
// ============================================================================

import { getAuthenticatedUser, getTabMetadata, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { AuthContext } from "@/lib/auth-context";

// Limits to prevent unbounded queries
const BLOCKS_PER_TAB_LIMIT = 500;

// ============================================================================
// 1. GET TAB BLOCKS - OPTIMIZED
// ============================================================================

export async function getTabBlocks(tabId: string, opts?: { authContext?: AuthContext }) {
  try {
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let userId: string;
    if (opts?.authContext) {
      supabase = opts.authContext.supabase;
      userId = opts.authContext.userId;
    } else {
      supabase = await createClient();
      const user = await getAuthenticatedUser();
      if (!user) return { error: "Unauthorized" };
      userId = user.id;
    }

    // 🔒 Verify tab access + get workspace in one query
    const tab = await getTabMetadata(tabId);
    if (!tab) {
      return { error: "Tab not found" };
    }

    const workspaceId = (tab.projects as any).workspace_id;

    // 🔒 Verify workspace membership BEFORE fetching blocks
    const member = await checkWorkspaceMembership(workspaceId, userId);
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

// ============================================================================
// 1b. GET CHILD BLOCKS (for sections)
// ============================================================================

export async function getChildBlocks(parentBlockId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
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

// ============================================================================
// 2. CREATE BLOCK
// ============================================================================

export async function createBlock(data: {
  tabId: string;
  type: BlockType;
  content?: Record<string, any>;
  position?: number;
  column?: number; // Column index: 0, 1, or 2 (defaults to 0)
  parentBlockId?: string | null; // Parent block ID for nested blocks (e.g., sections)
  originalBlockId?: string | null; // If this is a reference to another block
  authContext?: AuthContext;
}) {
  try {
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let userId: string;
    if (data.authContext) {
      supabase = data.authContext.supabase;
      userId = data.authContext.userId;
    } else {
      supabase = await createClient();
      const user = await getAuthenticatedUser();
      if (!user) return { error: "Unauthorized" };
      userId = user.id;
    }

    // 2. Get tab and verify it exists
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id")
      .eq("id", data.tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    // 3. Get project to get workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", tab.project_id)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // 4. Verify user is member of the project's workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", userId)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 5. Handle parent_block_id
    let parentBlockId = data.parentBlockId || null;
    let column: number;

    // If parentBlockId is provided, verify it exists and belongs to the same tab
    if (parentBlockId) {
      const { data: parentBlock, error: parentError } = await supabase
        .from("blocks")
        .select("id, tab_id")
        .eq("id", parentBlockId)
        .single();

      if (parentError || !parentBlock) {
        return { error: "Parent block not found" };
      }

      if (parentBlock.tab_id !== data.tabId) {
        return { error: "Parent block must belong to the same tab" };
      }

      // For nested blocks, column is always 0 (single column layout)
      column = 0;
    } else {
      // Determine column (default to 0 if not provided)
      column = data.column !== undefined ? data.column : 0;
      if (column < 0 || column > 2) {
        return { error: "Column must be between 0 and 2" };
      }
    }

    // 6. Calculate position if not provided - use atomic approach to prevent race conditions
    let position = data.position;
    if (position === undefined) {
      if (parentBlockId) {
        // For nested blocks, use atomic increment to prevent race conditions
        const { data: maxPosition, error: maxError } = await supabase
          .rpc('get_next_block_position', {
            p_tab_id: data.tabId,
            p_parent_block_id: parentBlockId,
            p_column: column
          });

        if (maxError) {
          console.error("Get next position for nested block error:", maxError);
          // Fallback to non-atomic method if RPC fails
          const { data: maxBlock, error: fallbackError } = await supabase
            .from("blocks")
            .select("position")
            .eq("parent_block_id", parentBlockId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackError && fallbackError.code !== "PGRST116") {
            console.error("Fallback get max position error:", fallbackError);
          }

          position = maxBlock?.position !== undefined ? maxBlock.position + 1 : 0;
        } else {
          position = maxPosition || 0;
        }
      } else {
        // For top-level blocks, use atomic position calculation
        const { data: nextPosition, error: positionError } = await supabase
          .rpc('get_next_block_position', {
            p_tab_id: data.tabId,
            p_parent_block_id: null,
            p_column: column
          });

        if (positionError) {
          console.error("Get next position error:", positionError);
          // Fallback to non-atomic method if RPC fails
          const { data: existingBlocks, error: fallbackError } = await supabase
            .from("blocks")
            .select("position")
            .eq("tab_id", data.tabId)
            .eq("column", column)
            .is("parent_block_id", null)
            .order("position", { ascending: true });

          if (fallbackError && fallbackError.code !== "PGRST116") {
            console.error("Fallback get existing positions error:", fallbackError);
          }

          // Find the first available position (starting from 0)
          position = 0;
          if (existingBlocks && existingBlocks.length > 0) {
            const positions = existingBlocks.map(b => b.position).sort((a, b) => a - b);
            // Find the first gap or append to end
            for (let i = 0; i <= positions.length; i++) {
              if (i === positions.length || positions[i] > i) {
                position = i;
                break;
              }
            }
          }
        } else {
          position = nextPosition || 0;
        }
      }
    }

    // 7. Create default content based on block type if not provided
    let content = data.content;
    if (!content) {
      switch (data.type) {
        case "text":
          content = { text: "" };
          break;
        case "task":
          content = { title: "New Task List", hideIcons: false, viewMode: "list", boardGroupBy: "status" };
          break;
        case "link":
          content = { title: "", url: "", description: "" };
          break;
        case "divider":
          content = {};
          break;
        case "table": {
          // New Supabase-backed table: create a real table and store its id in block content.
          const { createTable } = await import("./tables/table-actions");
          const tableResult = await createTable({
            workspaceId: project.workspace_id,
            projectId: tab.project_id,
            title: "Untitled Table",
          });
          if ("error" in tableResult) {
            return { error: tableResult.error };
          }
          content = { tableId: tableResult.data.table.id };
          break;
        }
        case "timeline":
          const now = new Date();
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7); // 7 days ago
          const endDate = new Date(now);
          endDate.setDate(endDate.getDate() + 30); // 30 days ahead
          content = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            events: [],
          };
          break;
        case "file":
          content = { files: [] };
          break;
        case "video":
          content = { files: [] };
          break;
        case "image":
          content = { fileId: null, caption: "", width: 400 };
          break;
        case "gallery":
          content = { layout: null, items: [] };
          break;
        case "embed":
          content = { url: "", displayMode: "inline" };
          break;
        case "pdf":
          content = { fileId: null };
          break;
        case "section":
          content = { height: 400 }; // Default height in pixels
          break;
        case "chart":
          content = { code: "", chartType: "bar", title: "Chart" };
          break;
      }
    }

    // 8. Create the block
    const { data: block, error: createError } = await supabase
      .from("blocks")
      .insert({
        tab_id: data.tabId,
        parent_block_id: parentBlockId,
        type: data.type,
        content: content,
        position: position,
        column: column,
        original_block_id: data.originalBlockId || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Create block error:", createError);
      // Return more detailed error message if available
      return { error: createError.message || "Failed to create block" };
    }

    // Revalidate the tab page path
    await safeRevalidatePath(`/dashboard/projects/${tab.project_id}/tabs/${data.tabId}`);
    await revalidateClientPages(tab.project_id, data.tabId, {
      publicToken: project.public_token ?? undefined,
      clientPageEnabled: project.client_page_enabled ?? undefined,
    });

    // Trigger Async Indexing
    try {
      const queue = new IndexingQueue(supabase);
      await queue.enqueue({
        workspaceId: project.workspace_id,
        resourceType: "block",
        resourceId: block.id,
      });
    } catch (err) {
      console.error("Failed to enqueue indexing job for block create", { blockId: block.id, error: err });
    }

    return { data: block };
  } catch (error) {
    console.error("Create block exception:", error);
    return { error: "Failed to create block" };
  }
}

// ============================================================================
// 3. UPDATE BLOCK
// ============================================================================

export async function updateBlock(data: {
  blockId: string;
  content?: Record<string, any>;
  type?: BlockType;
  position?: number;
  column?: number; // Column index: 0, 1, or 2
}) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 1.5. Check if user is still a workspace member (security: handle mid-session role changes)
    const blockCheck = await supabase
      .from("blocks")
      .select("tab_id")
      .eq("id", data.blockId)
      .single();

    if (blockCheck.error || !blockCheck.data?.tab_id) {
      return { error: "Block not found" };
    }

    // Get workspace_id through tab -> project relationship
    const tabCheck = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", blockCheck.data.tab_id)
      .single();

    if (tabCheck.error || !tabCheck.data?.project_id) {
      return { error: "Tab not found" };
    }

    const projectCheck = await supabase
      .from("projects")
      .select("workspace_id")
      .eq("id", tabCheck.data.project_id)
      .single();

    if (projectCheck.error || !projectCheck.data?.workspace_id) {
      return { error: "Project not found" };
    }

    const workspaceId = projectCheck.data.workspace_id;
    const membershipCheck = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membershipCheck.data) {
      return { error: "You are no longer a member of this workspace" };
    }

    // 2. Get block and verify it exists
    // Validate blockId is a string
    if (typeof data.blockId !== 'string' || !data.blockId.trim()) {
      console.error("Invalid blockId in updateBlock:", data.blockId, typeof data.blockId);
      return { error: "Invalid block ID" };
    }

    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id")
      .eq("id", data.blockId.trim())
      .single();

    if (blockError) {
      console.error("Block lookup error:", {
        error: blockError,
        blockId: data.blockId,
        code: blockError.code,
        message: blockError.message
      });
      return { error: `Block not found: ${blockError.message}` };
    }

    if (!block) {
      console.error("Block not found in database:", {
        blockId: data.blockId,
        blockIdType: typeof data.blockId
      });
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

    // 3. Get project to get workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // 4. Verify user is member of the project's workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 6. Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.content !== undefined) updates.content = data.content;
    if (data.type !== undefined) updates.type = data.type;
    if (data.position !== undefined) updates.position = data.position;
    if (data.column !== undefined) {
      if (data.column < 0 || data.column > 2) {
        return { error: "Column must be between 0 and 2" };
      }
      updates.column = data.column;
    }

    // 7. Update the block
    const { data: updatedBlock, error: updateError } = await supabase
      .from("blocks")
      .update(updates)
      .eq("id", data.blockId)
      .select()
      .single();

    if (updateError) {
      console.error("Update block error:", updateError);
      return { error: updateError.message || "Failed to update block" };
    }

    // 8. Revalidate the tab page path
    await safeRevalidatePath(`/dashboard/projects/${projectId}/tabs/${block.tab_id}`);
    await revalidateClientPages(projectId, block.tab_id, {
      publicToken: project.public_token ?? undefined,
      clientPageEnabled: project.client_page_enabled ?? undefined,
    });

    // Trigger Async Indexing
    try {
      const queue = new IndexingQueue(supabase);
      await queue.enqueue({
        workspaceId: project.workspace_id,
        resourceType: "block",
        resourceId: updatedBlock.id,
      });
    } catch (err) {
      console.error("Failed to enqueue indexing job for block update", { blockId: updatedBlock.id, error: err });
    }

    return { data: updatedBlock };
  } catch (error) {
    console.error("Update block exception:", error);
    return { error: "Failed to update block" };
  }
}

// ============================================================================
// 4. DELETE BLOCK
// ============================================================================

export async function deleteBlock(blockId: string, opts?: { authContext?: AuthContext }) {
  try {
    let supabase: Awaited<ReturnType<typeof createClient>>;
    let userId: string;
    if (opts?.authContext) {
      supabase = opts.authContext.supabase;
      userId = opts.authContext.userId;
    } else {
      supabase = await createClient();
      const user = await getAuthenticatedUser();
      if (!user) return { error: "Unauthorized" };
      userId = user.id;
    }

    // 2. Get block and verify it exists
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id, type, content")
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
      .eq("user_id", userId)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 6. Delete the linked table if this is a table block
    if (block.type === "table") {
      const content = (block.content || {}) as { tableId?: string };
      if (content.tableId) {
        const { deleteTable } = await import("./tables/table-actions");
        const deleteResult = await deleteTable(content.tableId, { authContext: { supabase, userId } });
        if ("error" in deleteResult) {
          return { error: deleteResult.error ?? "Failed to delete table" };
        }
      }
    }

    // 7. Delete the block
    const { error: deleteError } = await supabase
      .from("blocks")
      .delete()
      .eq("id", blockId);

    if (deleteError) {
      console.error("Delete block error:", deleteError);
      return { error: deleteError.message || "Failed to delete block" };
    }

    // 8. Revalidate the tab page path
    await safeRevalidatePath(`/dashboard/projects/${projectId}/tabs/${block.tab_id}`);
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

// ============================================================================
// 5. MOVE BLOCK
// ============================================================================

export async function moveBlock(data: {
  blockId: string;
  targetTabId: string;
  targetParentBlockId?: string | null;
  newPosition: number;
}) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 2. Get source block and verify it exists
    const { data: sourceBlock, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id, parent_block_id, type, position")
      .eq("id", data.blockId)
      .single();

    if (blockError || !sourceBlock) {
      return { error: "Block not found" };
    }

    // 3. Get source tab to get project_id
    const { data: sourceTab, error: sourceTabError } = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", sourceBlock.tab_id)
      .single();

    if (sourceTabError || !sourceTab) {
      return { error: "Source tab not found" };
    }

    // 4. Get target tab to get project_id
    const { data: targetTab, error: targetTabError } = await supabase
      .from("tabs")
      .select("project_id")
      .eq("id", data.targetTabId)
      .single();

    if (targetTabError || !targetTab) {
      return { error: "Target tab not found" };
    }

    // 5. Get source project to verify workspace
    const { data: sourceProject, error: sourceProjectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", sourceTab.project_id)
      .single();

    if (sourceProjectError || !sourceProject) {
      return { error: "Source project not found" };
    }

    // 6. Get target project to verify workspace
    const { data: targetProject, error: targetProjectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled, public_token")
      .eq("id", targetTab.project_id)
      .single();

    if (targetProjectError || !targetProject) {
      return { error: "Target project not found" };
    }

    // 7. Verify both tabs are in same workspace
    if (sourceProject.workspace_id !== targetProject.workspace_id) {
      return { error: "Cannot move blocks between different workspaces" };
    }

    // 8. Verify user is member of the workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", sourceProject.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 9. If moving to a parent block, verify it's not a section being moved into another section
    // (Future validation when section blocks are implemented)
    // For now, parent_block_id is always null, so this is prepared for future use

    // 10. Update the block with new tab, parent, and position
    const { data: movedBlock, error: moveError } = await supabase
      .from("blocks")
      .update({
        tab_id: data.targetTabId,
        parent_block_id: data.targetParentBlockId ?? null,
        position: data.newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.blockId)
      .select()
      .single();

    if (moveError) {
      console.error("Move block error:", moveError);
      return { error: moveError.message || "Failed to move block" };
    }

    // 11. Revalidate both source and target tab paths (if different)
    await safeRevalidatePath(`/dashboard/projects/${sourceTab.project_id}/tabs/${sourceBlock.tab_id}`);
    await revalidateClientPages(sourceTab.project_id, sourceBlock.tab_id, {
      publicToken: sourceProject.public_token ?? undefined,
      clientPageEnabled: sourceProject.client_page_enabled ?? undefined,
    });
    if (data.targetTabId !== sourceBlock.tab_id) {
      await safeRevalidatePath(`/dashboard/projects/${targetTab.project_id}/tabs/${data.targetTabId}`);
      await revalidateClientPages(targetTab.project_id, data.targetTabId, {
        publicToken: targetProject.public_token ?? undefined,
        clientPageEnabled: targetProject.client_page_enabled ?? undefined,
      });
    }

    return { data: movedBlock };
  } catch (error) {
    console.error("Move block exception:", error);
    return { error: "Failed to move block" };
  }
}

// ============================================================================
// 6. DUPLICATE BLOCK
// ============================================================================

export async function duplicateBlock(blockId: string) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
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
    await safeRevalidatePath(`/dashboard/projects/${tab.project_id}/tabs/${sourceBlock.tab_id}`);
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

// ============================================================================
// PUBLIC CLIENT PAGE - GET TAB BLOCKS (NO AUTH REQUIRED)
// ============================================================================

/**
 * Get blocks for a tab on a public client page
 * Uses service role client to bypass RLS
 * Validates public token instead of user auth
 */
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

// Public workflow page blocks - no auth required, but requires a valid public token
export async function getWorkflowTabBlocksPublic(tabId: string, publicToken: string) {
  try {
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = await createServiceClient();

    // 1. Verify token + enabled project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_page_enabled")
      .eq("public_token", publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (projectError || !project) {
      console.error("Public token validation failed (workflow):", projectError);
      return { error: "Invalid or disabled client page" };
    }

    // 2. Verify the tab belongs to this project and is a workflow page
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id, is_workflow_page")
      .eq("id", tabId)
      .eq("project_id", project.id)
      .eq("is_workflow_page", true)
      .single();

    if (tabError || !tab) {
      console.error("Workflow tab validation failed:", tabError);
      return { error: "Workflow page not found" };
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
      console.error("Get public workflow blocks error:", blocksError);
      return { error: "Failed to fetch blocks" };
    }

    console.log(`✅ Public access: Fetched ${blocks?.length || 0} blocks for workflow tab ${tabId}`);
    return { data: blocks || [] };
  } catch (error) {
    console.error("Get workflow tab blocks public exception:", error);
    return { error: "Failed to fetch blocks" };
  }
}
