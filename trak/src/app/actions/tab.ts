"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership, getProjectMetadata } from "@/lib/auth-utils";

// Limits to prevent unbounded queries
const TABS_PER_PROJECT_LIMIT = 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface Tab {
  id: string;
  project_id: string;
  parent_tab_id: string | null;
  name: string;
  position: number;
  created_at: string;
}

export interface TabWithChildren extends Tab {
  children?: TabWithChildren[];
}

// ============================================================================
// 1. CREATE TAB
// ============================================================================

export async function createTab(data: {
  projectId: string;
  name: string;
  parentTabId?: string | null;
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

    // 2. Get project and its workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", data.projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // 3. Verify user is member of the project's workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 4. If parent_tab_id provided, verify it exists and belongs to same project
    if (data.parentTabId) {
      const { data: parentTab, error: parentError } = await supabase
        .from("tabs")
        .select("id, project_id")
        .eq("id", data.parentTabId)
        .eq("project_id", data.projectId)
        .single();

      if (parentError || !parentTab) {
        return { error: "Parent tab not found" };
      }
    }

    // 5. Calculate position (last in the list at this level)
    const { data: existingTabs } = await supabase
      .from("tabs")
      .select("position")
      .eq("project_id", data.projectId)
      .eq(
        "parent_tab_id",
        data.parentTabId === undefined ? null : data.parentTabId
      )
      .order("position", { ascending: false })
      .limit(1);

    const position =
      existingTabs && existingTabs.length > 0
        ? existingTabs[0].position + 1
        : 0;

    // 6. Create tab
    const { data: newTab, error: createError } = await supabase
      .from("tabs")
      .insert({
        project_id: data.projectId,
        parent_tab_id: data.parentTabId === undefined ? null : data.parentTabId,
        name: data.name,
        position,
      })
      .select()
      .single();

    if (createError || !newTab) {
      console.error("Create tab error:", createError);
      return { error: "Failed to create tab" };
    }

    return { data: newTab };
  } catch (error) {
    console.error("Create tab exception:", error);
    return { error: "Failed to create tab" };
  }
}

// ============================================================================
// 2. GET PROJECT TABS - OPTIMIZED
// ============================================================================

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

// Helper function to build tab hierarchy
function buildTabHierarchy(tabs: Tab[]): TabWithChildren[] {
  const tabMap = new Map<string, TabWithChildren>();
  const rootTabs: TabWithChildren[] = [];

  // First pass: create map of all tabs
  tabs.forEach((tab) => {
    tabMap.set(tab.id, { ...tab, children: [] });
  });

  // Second pass: build hierarchy
  tabs.forEach((tab) => {
    const tabWithChildren = tabMap.get(tab.id)!;

    if (tab.parent_tab_id === null) {
      // Root level tab
      rootTabs.push(tabWithChildren);
    } else {
      // Child tab - add to parent's children array
      const parent = tabMap.get(tab.parent_tab_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(tabWithChildren);
      } else {
        // Parent not found, treat as root (shouldn't happen with proper data)
        rootTabs.push(tabWithChildren);
      }
    }
  });

  return rootTabs;
}

// ============================================================================
// 3. UPDATE TAB
// ============================================================================

export async function updateTab(data: {
  tabId: string;
  name?: string;
  parentTabId?: string | null;
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

    // 2. Get existing tab with its project's workspace_id
    const { data: existingTab, error: tabError } = await supabase
      .from("tabs")
      .select(
        `
        *,
        project:projects!inner(id, workspace_id)
      `
      )
      .eq("id", data.tabId)
      .single();

    if (tabError || !existingTab) {
      return { error: "Tab not found" };
    }

    // 3. Verify user is member of the workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", existingTab.project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 4. If moving to different parent, verify new parent exists
    // 4. If moving to different parent, verify new parent exists
    if (
      data.parentTabId !== undefined &&
      data.parentTabId !== existingTab.parent_tab_id
    ) {
      if (data.parentTabId !== null) {
        const { data: newParent, error: parentError } = await supabase
          .from("tabs")
          .select("id, project_id")
          .eq("id", data.parentTabId)
          .eq("project_id", existingTab.project_id)
          .single();

        if (parentError || !newParent) {
          return { error: "New parent tab not found" };
        }

        // Prevent making a tab its own ancestor (circular reference)
        if (data.parentTabId === data.tabId) {
          return { error: "Tab cannot be its own parent" };
        }
      }

      // If parent changed, recalculate position
      const { data: siblingsAtNewLevel } = await supabase
        .from("tabs")
        .select("position")
        .eq("project_id", existingTab.project_id)
        .eq("parent_tab_id", data.parentTabId || null)
        .order("position", { ascending: false })
        .limit(1);

      const newPosition =
        siblingsAtNewLevel && siblingsAtNewLevel.length > 0
          ? siblingsAtNewLevel[0].position + 1
          : 0;

      // Update tab with new parent and position
      const { data: updatedTab, error: updateError } = await supabase
        .from("tabs")
        .update({
          name: data.name,
          parent_tab_id: data.parentTabId,
          position: newPosition,
        })
        .eq("id", data.tabId)
        .select()
        .single();

      if (updateError || !updatedTab) {
        console.error("Update tab error:", updateError);
        return { error: "Failed to update tab" };
      }

      return { data: updatedTab };
    }

    // 5. If only name is changing (no parent change)
    const { data: updatedTab, error: updateError } = await supabase
      .from("tabs")
      .update({ name: data.name })
      .eq("id", data.tabId)
      .select()
      .single();

    if (updateError || !updatedTab) {
      console.error("Update tab error:", updateError);
      return { error: "Failed to update tab" };
    }

    return { data: updatedTab };
  } catch (error) {
    console.error("Update tab exception:", error);
    return { error: "Failed to update tab" };
  }
}

// ============================================================================
// 4. REORDER TABS
// ============================================================================

export async function reorderTabs(data: {
  tabIds: string[];
  projectId: string;
  parentTabId?: string | null;
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

    // 2. Get project and its workspace_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", data.projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    // 3. Verify user is member of the project's workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    // 4. Verify all tabs exist and belong to same parent
    // 4. Verify all tabs exist and belong to same parent
    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("*")
      .eq("project_id", data.projectId)
      .eq(
        "parent_tab_id",
        data.parentTabId === undefined ? null : data.parentTabId
      )
      .in("id", data.tabIds);

    if (tabsError || !tabs || tabs.length !== data.tabIds.length) {
      return { error: "Invalid tab IDs or tabs have different parents" };
    }

    // 5. Update position for each tab
    const updates = data.tabIds.map((tabId, index) => {
      return supabase
        .from("tabs")
        .update({ position: index })
        .eq("id", tabId)
        .select()
        .single();
    });

    const results = await Promise.all(updates);

    // Check if any update failed
    const failed = results.find((r) => r.error);
    if (failed) {
      console.error("Reorder tabs error:", failed.error);
      return { error: "Failed to reorder tabs" };
    }

    const reorderedTabs = results.map((r) => r.data).filter(Boolean);

    return { data: reorderedTabs };
  } catch (error) {
    console.error("Reorder tabs exception:", error);
    return { error: "Failed to reorder tabs" };
  }
}

// ============================================================================
// 5. DELETE TAB
// ============================================================================

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

    return { data: { success: true, deletedCount: allTabIds.length } };
  } catch (error) {
    console.error("Delete tab exception:", error);
    return { error: "Failed to delete tab" };
  }
}

// Helper function to get all descendant tab IDs recursively
async function getAllDescendantTabIds(
  supabase: any,
  tabId: string
): Promise<string[]> {
  const { data: children } = await supabase
    .from("tabs")
    .select("id")
    .eq("parent_tab_id", tabId);

  if (!children || children.length === 0) {
    return [];
  }

  const childIds = children.map((c: any) => c.id);
  const descendantIds: string[] = [...childIds];

  // Recursively get descendants of each child
  for (const childId of childIds) {
    const childDescendants = await getAllDescendantTabIds(supabase, childId);
    descendantIds.push(...childDescendants);
  }

  return descendantIds;
}