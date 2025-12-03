"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

export interface ClientPageProject {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client_page_enabled: boolean;
  client_comments_enabled: boolean;
  public_token: string | null;
  updated_at: string;
  client: {
    id: string;
    name: string;
    company: string | null;
  } | null;
}

export interface ClientPageTab {
  id: string;
  name: string;
  position: number;
  is_client_visible: boolean;
  client_title: string | null;
}

export interface ClientPageView {
  id: string;
  project_id: string;
  tab_id: string | null;
  viewed_at: string;
  user_agent: string | null;
  session_id: string | null;
}

export interface ClientPageAnalytics {
  total_views: number;
  unique_visitors: number;
  tabs_viewed: number;
  last_viewed_at: string | null;
  avg_duration_seconds: number | null;
}

// ============================================================================
// 1. ENABLE CLIENT PAGE FOR PROJECT
// ============================================================================

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

// ============================================================================
// 2. DISABLE CLIENT PAGE FOR PROJECT
// ============================================================================

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

// ============================================================================
// 2b. UPDATE CLIENT PAGE SETTINGS
// ============================================================================

export async function updateClientPageSettings(
  projectId: string,
  settings: { clientCommentsEnabled?: boolean }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { error: "Project not found" };
    }

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", project.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { error: "Not a member of this workspace" };
    }

    const updatePayload: Record<string, boolean> = {};
    if (typeof settings.clientCommentsEnabled === "boolean") {
      updatePayload.client_comments_enabled = settings.clientCommentsEnabled;
    }

    if (Object.keys(updatePayload).length === 0) {
      return { error: "No settings provided" };
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId);

    if (updateError) {
      console.error("Update client page settings error:", updateError);
      return { error: "Failed to update settings" };
    }

    revalidatePath(`/dashboard/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Update client page settings exception:", error);
    return { error: "Failed to update settings" };
  }
}

// ============================================================================
// 3. GET PROJECT BY PUBLIC TOKEN (NO AUTH REQUIRED)
// ============================================================================

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

// ============================================================================
// 4. TOGGLE TAB VISIBILITY
// ============================================================================

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

// ============================================================================
// 5. UPDATE TAB CLIENT TITLE
// ============================================================================

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

// ============================================================================
// 6. TRACK CLIENT PAGE VIEW (NO AUTH REQUIRED)
// ============================================================================

export async function trackClientPageView(data: {
  publicToken: string;
  tabId?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  referrer?: string | null;
  ipAddress?: string | null;
}) {
  try {
    const supabase = await createClient();

    // Get project ID from token
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("public_token", data.publicToken)
      .eq("client_page_enabled", true)
      .single();

    if (projectError || !project) {
      // Silently fail - don't expose if token is invalid
      return { success: true };
    }

    // Insert view record
    const { error: insertError } = await supabase
      .from("client_page_views")
      .insert({
        project_id: project.id,
        tab_id: data.tabId || null,
        public_token: data.publicToken,
        user_agent: data.userAgent || null,
        session_id: data.sessionId || null,
        referrer: data.referrer || null,
        ip_address: data.ipAddress || null,
      });

    if (insertError) {
      console.error("Track page view error:", insertError);
      // Silently fail - don't block user experience
    }

    return { success: true };
  } catch (error) {
    console.error("Track page view exception:", error);
    // Silently fail
    return { success: true };
  }
}

// ============================================================================
// 7. GET CLIENT PAGE ANALYTICS
// ============================================================================

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

// ============================================================================
// DOC REFERENCE PUBLIC ACCESS
// ============================================================================

/**
 * Get a doc for public client page viewing
 * This checks if the doc belongs to a project with client pages enabled
 */
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

