"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

// Limits to prevent unbounded queries
const CLIENT_TABS_PER_CLIENT_LIMIT = 50;

// ============================================================================
// TYPES
// ============================================================================

export interface ClientTab {
  id: string;
  client_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 1. CREATE CLIENT TAB
// ============================================================================

export async function createClientTab(data: {
  clientId: string;
  name: string;
}) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const user = await getAuthenticatedUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    // 2. Get client and its workspace_id
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, workspace_id")
      .eq("id", data.clientId)
      .single();

    if (clientError || !client) {
      return { error: "Client not found" };
    }

    // 3. Verify user is member of the client's workspace
    const member = await checkWorkspaceMembership(client.workspace_id, user.id);
    if (!member) {
      return { error: "Not a member of this workspace" };
    }

    // 4. Calculate position (last in the list)
    const { data: existingTabs } = await supabase
      .from("client_tabs")
      .select("position")
      .eq("client_id", data.clientId)
      .order("position", { ascending: false })
      .limit(1);

    const position =
      existingTabs && existingTabs.length > 0
        ? existingTabs[0].position + 1
        : 0;

    // 5. Create the tab
    const { data: tab, error: createError } = await supabase
      .from("client_tabs")
      .insert({
        client_id: data.clientId,
        name: data.name.trim(),
        position,
      })
      .select()
      .single();

    if (createError) {
      return { error: createError.message };
    }

    revalidatePath(`/dashboard/clients/${data.clientId}`);
    return { data: tab };
  } catch (error) {
    console.error("Create client tab exception:", error);
    return { error: "Failed to create tab" };
  }
}

// ============================================================================
// 2. GET CLIENT TABS
// ============================================================================

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

// ============================================================================
// 3. UPDATE CLIENT TAB
// ============================================================================

export async function updateClientTab(data: {
  tabId: string;
  name?: string;
  position?: number;
}) {
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
        clients (
          workspace_id
        )
      `)
      .eq("id", data.tabId)
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

    // 4. Update the tab
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.position !== undefined) updateData.position = data.position;

    const { data: updatedTab, error: updateError } = await supabase
      .from("client_tabs")
      .update(updateData)
      .eq("id", data.tabId)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath(`/dashboard/clients/${tab.client_id}`);
    return { data: updatedTab };
  } catch (error) {
    console.error("Update client tab exception:", error);
    return { error: "Failed to update tab" };
  }
}

// ============================================================================
// 4. DELETE CLIENT TAB
// ============================================================================

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

// ============================================================================
// 5. GET CLIENT TAB CONTENT
// ============================================================================

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