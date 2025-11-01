"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

export type BlockType = "text" | "task" | "link" | "divider";

export interface Block {
  id: string;
  tab_id: string;
  parent_block_id: string | null;
  type: BlockType;
  content: Record<string, any>; // JSONB content, varies by type
  position: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 1. GET TAB BLOCKS
// ============================================================================

export async function getTabBlocks(tabId: string) {
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

    // 2. Get tab and verify it exists
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id")
      .eq("id", tabId)
      .single();

    if (tabError || !tab) {
      return { error: "Tab not found" };
    }

    // 3. Get project to get workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
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
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 5. Get all blocks for this tab (top-level only for now, ordered by position)
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("*")
      .eq("tab_id", tabId)
      .is("parent_block_id", null) // Only top-level blocks for now
      .order("position", { ascending: true });

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
// 2. CREATE BLOCK
// ============================================================================

export async function createBlock(data: {
  tabId: string;
  type: BlockType;
  content?: Record<string, any>;
  position?: number;
}) {
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
      .select("id, workspace_id")
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
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 5. Calculate position if not provided
    let position = data.position;
    if (position === undefined) {
      // Get max position for this tab
      const { data: maxBlock, error: maxError } = await supabase
        .from("blocks")
        .select("position")
        .eq("tab_id", data.tabId)
        .is("parent_block_id", null)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError && maxError.code !== "PGRST116") {
        // PGRST116 is "not found", which is fine for empty tables
        console.error("Get max position error:", maxError);
      }

      position = maxBlock?.position !== undefined ? maxBlock.position + 1 : 0;
    }

    // 6. Create default content based on block type if not provided
    let content = data.content;
    if (!content) {
      switch (data.type) {
        case "text":
          content = { text: "" };
          break;
        case "task":
          content = { title: "New Task List", tasks: [] };
          break;
        case "link":
          content = { title: "", url: "", description: "" };
          break;
        case "divider":
          content = {};
          break;
      }
    }

    // 7. Create the block
    const { data: block, error: createError } = await supabase
      .from("blocks")
      .insert({
        tab_id: data.tabId,
        parent_block_id: null, // Top-level for now
        type: data.type,
        content: content,
        position: position,
      })
      .select()
      .single();

    if (createError) {
      console.error("Create block error:", createError);
      // Return more detailed error message if available
      return { error: createError.message || "Failed to create block" };
    }

    // Revalidate the tab page path
    revalidatePath(`/dashboard/projects/${tab.project_id}/tabs/${data.tabId}`);

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
}) {
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
      .eq("id", data.blockId)
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

    // 3. Get project to get workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
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
    revalidatePath(`/dashboard/projects/${projectId}/tabs/${block.tab_id}`);

    return { data: updatedBlock };
  } catch (error) {
    console.error("Update block exception:", error);
    return { error: "Failed to update block" };
  }
}

// ============================================================================
// 4. DELETE BLOCK
// ============================================================================

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
      .select("id, workspace_id")
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

    return { success: true };
  } catch (error) {
    console.error("Delete block exception:", error);
    return { error: "Failed to delete block" };
  }
}

