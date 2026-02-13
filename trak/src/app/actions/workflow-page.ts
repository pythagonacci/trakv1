"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { getCurrentWorkspaceId, safeRevalidatePath } from "@/app/actions/workspace";
import { saveFileAnalysisAsBlock } from "@/app/actions/file-analysis";
import { enableClientPage } from "@/app/actions/client-page";

export type ActionResult<T> = { data: T } | { error: string };

export interface WorkflowPageTab {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  workflow_metadata: Record<string, unknown>;
}

function nowIso() {
  return new Date().toISOString();
}

async function resolveWorkflowProjectId(params: {
  workspaceId: string;
  projectId?: string | null;
  isWorkspaceLevel?: boolean;
}) {
  const supabase = await createClient();
  if (params.projectId && !params.isWorkspaceLevel) return { data: params.projectId };

  const { data: projectId, error } = await supabase.rpc("get_or_create_workspace_analysis_project", {
    p_workspace_id: params.workspaceId,
  });

  if (error || !projectId) {
    console.error("resolveWorkflowProjectId rpc error:", error);
    return { error: "Failed to resolve workspace analysis project" } as const;
  }

  return { data: String(projectId) } as const;
}

async function createWorkflowTab(params: {
  projectId: string;
  name: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createClient();

  const { data: maxPosRow } = await supabase
    .from("tabs")
    .select("position")
    .eq("project_id", params.projectId)
    .is("parent_tab_id", null)
    .order("position", { ascending: false })
    .limit(1);

  const lastRow = maxPosRow && maxPosRow.length > 0
    ? (maxPosRow[0] as { position?: number | null })
    : null;
  const position = typeof lastRow?.position === "number" ? lastRow.position + 1 : 0;

  const { data: tab, error } = await supabase
    .from("tabs")
    .insert({
      project_id: params.projectId,
      parent_tab_id: null,
      name: params.name,
      position,
      is_workflow_page: true,
      workflow_metadata: params.metadata,
    })
    .select("id, project_id, name, created_at, workflow_metadata")
    .single();

  if (error || !tab) {
    console.error("createWorkflowTab error:", error);
    return { error: "Failed to create workflow page" } as const;
  }

  return { data: tab as WorkflowPageTab } as const;
}

export async function createWorkflowPage(params: {
  title?: string;
  projectId?: string | null;
  isWorkspaceLevel?: boolean;
}): Promise<ActionResult<{ tabId: string; projectId: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { error: "No workspace selected" };

  const projectIdResult = await resolveWorkflowProjectId({
    workspaceId,
    projectId: params.projectId || null,
    isWorkspaceLevel: params.isWorkspaceLevel,
  });
  if ("error" in projectIdResult) return { error: projectIdResult.error || "Failed to resolve project ID" };
  const projectId = projectIdResult.data;

  // Verify the project belongs to this workspace (RLS should also enforce).
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .single();
  if (projectError || !project || project.workspace_id !== workspaceId) {
    return { error: "Project not found" };
  }

  const title = (params.title || "Workflow Page").trim() || "Workflow Page";

  const tabResult = await createWorkflowTab({
    projectId,
    name: title,
    metadata: {
      source: "direct",
      created_by_ai: false,
      is_workspace_level: Boolean(params.isWorkspaceLevel),
      created_at: nowIso(),
      last_ai_interaction: null,
    },
  });

  if ("error" in tabResult) return { error: tabResult.error || "Failed to create workflow tab" };

  await safeRevalidatePath(`/dashboard/projects/${projectId}`);
  await safeRevalidatePath(`/dashboard/workflow/${tabResult.data.id}`);

  return { data: { tabId: tabResult.data.id, projectId } };
}

export async function getWorkspaceWorkflowPages(): Promise<ActionResult<WorkflowPageTab[]>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { error: "No workspace selected" };

  const { data: tabs, error } = await supabase
    .from("tabs")
    .select("id, project_id, name, created_at, workflow_metadata, projects!inner(id, workspace_id, is_workspace_analysis_project)")
    .eq("is_workflow_page", true)
    .eq("projects.workspace_id", workspaceId)
    .eq("projects.is_workspace_analysis_project", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("getWorkspaceWorkflowPages error:", error);
    return { error: "Failed to load workflow pages" };
  }

  const normalized = (tabs || []).map((tab) => {
    const record = tab as Record<string, unknown>;
    const workflow = record.workflow_metadata;
    return {
      id: String(record.id || ""),
      project_id: String(record.project_id || ""),
      name: String(record.name || ""),
      created_at: String(record.created_at || ""),
      workflow_metadata:
        (workflow && typeof workflow === "object"
          ? (workflow as Record<string, unknown>)
          : {}) as Record<string, unknown>,
    } satisfies WorkflowPageTab;
  });

  return { data: normalized };
}

export async function convertFileAnalysisToWorkflowPage(params: {
  fileAnalysisSessionId: string;
  messageId?: string;
  title?: string;
  isWorkspaceLevel?: boolean;
}): Promise<ActionResult<{ tabId: string; projectId: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: session, error: sessionError } = await supabase
    .from("file_analysis_sessions")
    .select("id, workspace_id, project_id, tab_id, user_id, last_message_at")
    .eq("id", params.fileAnalysisSessionId)
    .single();

  if (sessionError || !session) return { error: "File analysis session not found" };

  const projectIdResult = await resolveWorkflowProjectId({
    workspaceId: session.workspace_id,
    projectId: session.project_id,
    isWorkspaceLevel: params.isWorkspaceLevel || (!session.project_id && !session.tab_id),
  });
  if ("error" in projectIdResult) return { error: projectIdResult.error || "Failed to resolve project ID" };
  const projectId = projectIdResult.data;

  const title = (params.title || "Workflow Page").trim() || "Workflow Page";
  const tabResult = await createWorkflowTab({
    projectId,
    name: title,
    metadata: {
      source: "file_analysis",
      created_by_ai: true,
      converted_from_session_id: session.id,
      is_workspace_level: Boolean(params.isWorkspaceLevel),
      last_ai_interaction: nowIso(),
    },
  });

  if ("error" in tabResult) return { error: tabResult.error || "Failed to create workflow tab" };
  const tabId = tabResult.data.id;

  // Seed blocks from file analysis message.
  let messageId = params.messageId;
  if (!messageId) {
    const { data: lastAssistant } = await supabase
      .from("file_analysis_messages")
      .select("id, role, created_at")
      .eq("session_id", session.id)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    messageId = lastAssistant?.id || undefined;
  }

  if (messageId) {
    const saved = await saveFileAnalysisAsBlock({ messageId, tabId });
    if ("error" in saved) {
      console.error("convertFileAnalysisToWorkflowPage seed error:", saved.error);
    }
  }

  await safeRevalidatePath(`/dashboard/projects/${projectId}`);
  await safeRevalidatePath(`/dashboard/workflow/${tabId}`);

  return { data: { tabId, projectId } };
}

export async function enableWorkflowPageSharing(params: {
  tabId: string;
}): Promise<ActionResult<{ publicToken: string; urlPath: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: tab, error } = await supabase
    .from("tabs")
    .select("id, project_id, is_workflow_page")
    .eq("id", params.tabId)
    .single();

  if (error || !tab) return { error: "Workflow page not found" };
  if (!tab.is_workflow_page) return { error: "Tab is not a workflow page" };

  const enabled = await enableClientPage(tab.project_id);
  if ("error" in enabled) return { error: enabled.error || "Failed to enable client page" };

  const publicToken = String(enabled.data.public_token);
  const urlPath = `/client/${publicToken}/workflow/${params.tabId}`;

  return { data: { publicToken, urlPath } };
}

export async function updateWorkflowPageName(params: {
  tabId: string;
  name: string;
}): Promise<ActionResult<{ success: true }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { error: "No workspace selected" };

  const trimmedName = params.name.trim();
  if (!trimmedName) return { error: "Name cannot be empty" };

  // Verify the tab exists, is a workflow page, and belongs to this workspace
  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, project_id, is_workflow_page, projects!inner(workspace_id)")
    .eq("id", params.tabId)
    .eq("is_workflow_page", true)
    .eq("projects.workspace_id", workspaceId)
    .single();

  if (tabError || !tab) {
    console.error("updateWorkflowPageName tab validation error:", tabError);
    return { error: "Workflow page not found" };
  }

  const { error: updateError } = await supabase
    .from("tabs")
    .update({ name: trimmedName })
    .eq("id", params.tabId);

  if (updateError) {
    console.error("updateWorkflowPageName update error:", updateError);
    return { error: "Failed to update workflow page name" };
  }

  await safeRevalidatePath(`/dashboard/workflow/${params.tabId}`);
  await safeRevalidatePath("/dashboard/workflow");

  return { data: { success: true } };
}

export async function deleteWorkflowPage(params: {
  tabId: string;
}): Promise<ActionResult<{ success: true }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { error: "No workspace selected" };

  // Verify the tab exists, is a workflow page, and belongs to this workspace
  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, project_id, is_workflow_page, projects!inner(workspace_id)")
    .eq("id", params.tabId)
    .eq("is_workflow_page", true)
    .eq("projects.workspace_id", workspaceId)
    .single();

  if (tabError || !tab) {
    console.error("deleteWorkflowPage tab validation error:", tabError);
    return { error: "Workflow page not found" };
  }

  // Delete the tab (cascade will handle workflow_sessions, workflow_messages, and blocks)
  const { error: deleteError } = await supabase
    .from("tabs")
    .delete()
    .eq("id", params.tabId);

  if (deleteError) {
    console.error("deleteWorkflowPage delete error:", deleteError);
    return { error: "Failed to delete workflow page" };
  }

  await safeRevalidatePath(`/dashboard/projects/${tab.project_id}`);
  await safeRevalidatePath("/dashboard/workflow");

  return { data: { success: true } };
}
