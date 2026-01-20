"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { getBatchFileUrls } from "@/app/actions/file";

// ============================================================================
// TYPES
// ============================================================================

export type ClientTabBlockType = "text" | "task" | "link" | "divider" | "table" | "timeline" | "file" | "video" | "image" | "gallery" | "embed" | "pdf" | "section" | "doc_reference";

export interface ClientTabBlock {
  id: string;
  tab_id: string;
  type: ClientTabBlockType;
  content: Record<string, any>;
  position: number;
  column: number;
  created_at: string;
  updated_at: string;
}

// Limits to prevent unbounded queries
const CLIENT_TAB_BLOCKS_PER_TAB_LIMIT = 500;

// ============================================================================
// 1. GET CLIENT TAB BLOCKS
// ============================================================================

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

// ============================================================================
// 2. CREATE CLIENT TAB BLOCK
// ============================================================================

export async function createClientTabBlock(data: {
  tabId: string;
  type: ClientTabBlockType;
  content?: Record<string, any>;
  position?: number;
  column?: number;
}) {
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
      .eq("id", data.tabId)
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

    // Calculate position if not provided
    const column = data.column !== undefined ? data.column : 0;
    let position = data.position;

    if (position === undefined) {
      const { data: existingBlocks } = await supabase
        .from("client_tab_blocks")
        .select("position")
        .eq("tab_id", data.tabId)
        .eq("column", column)
        .order("position", { ascending: false })
        .limit(1);

      position =
        existingBlocks && existingBlocks.length > 0
          ? existingBlocks[0].position + 1
          : 0;
    }

    // Create the block
    const { data: block, error: createError } = await supabase
      .from("client_tab_blocks")
      .insert({
        tab_id: data.tabId,
        type: data.type,
        content: data.content || {},
        position: position,
        column: column,
      })
      .select()
      .single();

    if (createError) {
      console.error("Create client tab block error:", createError);
      return { error: createError.message || "Failed to create block" };
    }

    revalidatePath(`/dashboard/clients/${tab.client_id}/tabs/${data.tabId}`);
    return { data: block };
  } catch (error) {
    console.error("Create client tab block exception:", error);
    return { error: "Failed to create block" };
  }
}

// ============================================================================
// 3. UPDATE CLIENT TAB BLOCK
// ============================================================================

export async function updateClientTabBlock(data: {
  blockId: string;
  content?: Record<string, any>;
  type?: ClientTabBlockType;
  position?: number;
  column?: number;
}) {
  try {
    const supabase = await createClient();

    // Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // Get block and verify it exists
    if (typeof data.blockId !== 'string' || !data.blockId.trim()) {
      return { error: "Invalid block ID" };
    }

    const { data: block, error: blockError } = await supabase
      .from("client_tab_blocks")
      .select("id, tab_id")
      .eq("id", data.blockId.trim())
      .single();

    if (blockError || !block) {
      return { error: "Block not found" };
    }

    // Get tab to verify access
    const { data: tab, error: tabError } = await supabase
      .from("client_tabs")
      .select(`
        id,
        client_id,
        clients (
          workspace_id
        )
      `)
      .eq("id", block.tab_id)
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

    // Build update object
    const updateData: any = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.column !== undefined) {
      if (data.column < 0 || data.column > 2) {
        return { error: "Column must be between 0 and 2" };
      }
      updateData.column = data.column;
    }

    // Update the block
    const { data: updatedBlock, error: updateError } = await supabase
      .from("client_tab_blocks")
      .update(updateData)
      .eq("id", data.blockId)
      .select()
      .single();

    if (updateError) {
      console.error("Update client tab block error:", updateError);
      return { error: updateError.message || "Failed to update block" };
    }

    revalidatePath(`/dashboard/clients/${tab.client_id}/tabs/${block.tab_id}`);
    return { data: updatedBlock };
  } catch (error) {
    console.error("Update client tab block exception:", error);
    return { error: "Failed to update block" };
  }
}

// ============================================================================
// 4. DELETE CLIENT TAB BLOCK
// ============================================================================

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

// ============================================================================
// 5. GET BATCH FILE URLS FOR CLIENT TAB BLOCKS
// ============================================================================

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
