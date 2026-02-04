"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";

export type ActionResult<T> = { data: T } | { error: string };

export interface WorkflowSession {
  id: string;
  workspace_id: string;
  tab_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface WorkflowMessageRecord {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: Record<string, unknown>;
  created_at: string;
  created_block_ids: string[];
}

async function assertWorkflowTab(tabId: string) {
  const supabase = await createClient();
  const { data: tab, error } = await supabase
    .from("tabs")
    .select("id, is_workflow_page, workflow_metadata, project:projects!inner(id, workspace_id)")
    .eq("id", tabId)
    .single();

  if (error || !tab) return { error: "Tab not found" } as const;
  if (!tab.is_workflow_page) return { error: "Tab is not a workflow page" } as const;

  const project = tab.project as { workspace_id: string } | { workspace_id: string }[] | null;
  const workspaceId = Array.isArray(project) ? project[0]?.workspace_id : project?.workspace_id;
  if (!workspaceId) return { error: "Invalid tab workspace" } as const;

  return { data: { workspaceId } } as const;
}

export async function getOrCreateWorkflowSession(params: {
  tabId: string;
}): Promise<ActionResult<WorkflowSession>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const tabCheck = await assertWorkflowTab(params.tabId);
  if ("error" in tabCheck) return { error: tabCheck.error };

  const workspaceId = tabCheck.data.workspaceId;

  const { data: existing, error: existingError } = await supabase
    .from("workflow_sessions")
    .select("*")
    .eq("tab_id", params.tabId)
    .maybeSingle();

  if (existingError) {
    console.error("getOrCreateWorkflowSession query error:", existingError);
    return { error: "Failed to load workflow session" };
  }

  if (existing) {
    return { data: existing as WorkflowSession };
  }

  const { data: created, error: createError } = await supabase
    .from("workflow_sessions")
    .insert({
      workspace_id: workspaceId,
      tab_id: params.tabId,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (createError || !created) {
    console.error("getOrCreateWorkflowSession insert error:", createError);
    return { error: "Failed to create workflow session" };
  }

  return { data: created as WorkflowSession };
}

export async function getWorkflowSessionMessages(params: {
  sessionId: string;
}): Promise<ActionResult<WorkflowMessageRecord[]>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: messages, error } = await supabase
    .from("workflow_messages")
    .select("id, session_id, role, content, created_at, created_block_ids")
    .eq("session_id", params.sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getWorkflowSessionMessages error:", error);
    return { error: "Failed to load workflow messages" };
  }

  return { data: (messages || []) as WorkflowMessageRecord[] };
}

export async function addWorkflowMessage(params: {
  sessionId: string;
  role: WorkflowMessageRecord["role"];
  content: Record<string, unknown>;
  createdBlockIds?: string[];
}): Promise<ActionResult<WorkflowMessageRecord>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: message, error } = await supabase
    .from("workflow_messages")
    .insert({
      session_id: params.sessionId,
      role: params.role,
      content: params.content,
      created_block_ids: params.createdBlockIds || [],
    })
    .select("id, session_id, role, content, created_at, created_block_ids")
    .single();

  if (error || !message) {
    console.error("addWorkflowMessage error:", error);
    return { error: "Failed to add workflow message" };
  }

  await supabase
    .from("workflow_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", params.sessionId);

  return { data: message as WorkflowMessageRecord };
}
