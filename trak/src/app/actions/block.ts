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

