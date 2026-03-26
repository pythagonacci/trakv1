import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { BillingError } from "@/lib/billing/errors";

export async function assertCanCreateProject(workspaceId: string, projectType: "project" | "internal" = "project") {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (projectType === "project" && entitlements.maxProjectsPerWorkspace == null) return entitlements;

  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("project_type", projectType);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to check project limit: ${error.message}`);
  }

  const projectLimit = projectType === "internal" ? 1 : entitlements.maxProjectsPerWorkspace;
  if (projectLimit != null && (count ?? 0) >= projectLimit) {
    throw new BillingError({
      code: "PLAN_LIMIT_REACHED",
      message: projectType === "internal"
        ? "Free workspaces can have 1 internal space. Upgrade to Standard for more internal spaces."
        : "Free workspaces can have up to 3 regular projects plus 1 internal space. Upgrade to Standard for more projects.",
      upgradeTargetPlan: "standard",
    });
  }

  return entitlements;
}

export async function assertCanCreateTopLevelTab(projectId: string) {
  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("Project not found");
  }

  const entitlements = await getWorkspaceEntitlements(project.workspace_id);
  if (entitlements.maxTopLevelTabsPerProject == null) return entitlements;

  const { count, error } = await supabase
    .from("tabs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("parent_tab_id", null);

  if (error) {
    throw new Error(`Failed to check tab limit: ${error.message}`);
  }

  if ((count ?? 0) >= entitlements.maxTopLevelTabsPerProject) {
    throw new BillingError({
      code: "PLAN_LIMIT_REACHED",
      message: "Free projects can have up to 3 top-level tabs. Upgrade to Standard for unlimited tabs.",
      upgradeTargetPlan: "standard",
    });
  }

  return entitlements;
}

export async function assertCanCreateTopLevelBlock(tabId: string) {
  const supabase = await createClient();
  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("project_id, projects!inner(workspace_id)")
    .eq("id", tabId)
    .single();

  if (tabError || !tab) {
    throw new Error("Tab not found");
  }

  const project = Array.isArray((tab as any).projects) ? (tab as any).projects[0] : (tab as any).projects;
  const workspaceId = project?.workspace_id;
  if (!workspaceId) {
    throw new Error("Workspace not found");
  }

  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (entitlements.maxTopLevelBlocksPerTab == null) return entitlements;

  const { count, error } = await supabase
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("tab_id", tabId)
    .is("parent_block_id", null);

  if (error) {
    throw new Error(`Failed to check block limit: ${error.message}`);
  }

  if ((count ?? 0) >= entitlements.maxTopLevelBlocksPerTab) {
    throw new BillingError({
      code: "PLAN_LIMIT_REACHED",
      message: "Free tabs can have up to 15 top-level blocks. Upgrade to Standard for unlimited blocks.",
      upgradeTargetPlan: "standard",
    });
  }

  return entitlements;
}

export async function assertAndConsumeFreeAiCommandQuota(workspaceId: string) {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (entitlements.aiDailyCommandLimit == null) {
    return {
      entitlements,
      commandsUsed: null,
      commandsRemaining: null,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("consume_workspace_ai_daily_quota", {
    p_workspace_id: workspaceId,
    p_usage_date: today,
    p_limit: entitlements.aiDailyCommandLimit,
  });

  if (error) {
    throw new Error(`Failed to consume AI quota: ${error.message}`);
  }

  const quota = Array.isArray(data) ? data[0] : data;
  const commandsUsed = quota?.commands_used ?? entitlements.aiDailyCommandLimit;
  const allowed = Boolean(quota?.allowed);

  if (!allowed) {
    throw new BillingError({
      code: "AI_QUOTA_EXCEEDED",
      message: "You’ve used 5/5 AI commands today on Free. Upgrade for more AI access.",
      upgradeTargetPlan: "standard",
    });
  }

  return {
    entitlements,
    commandsUsed,
    commandsRemaining: Math.max(entitlements.aiDailyCommandLimit - commandsUsed, 0),
  };
}
