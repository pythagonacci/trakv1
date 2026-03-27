"use server";

import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getWorkspaceEntitlements } from "@/lib/billing/entitlements";
import { planMeetsRequirement, type PlanKey } from "@/lib/billing/config";
import { createServiceClient } from "@/lib/supabase/service";

export interface ProjectTemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  visibility: "global" | "workspace";
  minimumPlan: PlanKey;
  isAvailable: boolean;
  sourceProjectId: string;
}

type ProjectTemplateRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  visibility: "global" | "workspace";
  min_plan: PlanKey | null;
  source_project_id: string;
};

export async function getAvailableProjectTemplates(workspaceId: string) {
  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) {
    return { error: access.error };
  }

  const [supabase, entitlements] = await Promise.all([
    createServiceClient(),
    getWorkspaceEntitlements(workspaceId),
  ]);

  const { data, error } = await supabase
    .from("project_templates")
    .select("id, slug, name, description, category, icon, visibility, min_plan, source_project_id")
    .eq("is_active", true)
    .or(`visibility.eq.global,and(visibility.eq.workspace,workspace_id.eq.${workspaceId})`)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const templates: ProjectTemplateSummary[] = ((data ?? []) as ProjectTemplateRow[]).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    category: row.category ? String(row.category) : null,
    icon: row.icon ? String(row.icon) : null,
    visibility: row.visibility === "workspace" ? "workspace" : "global",
    minimumPlan: (row.min_plan ?? "standard") as PlanKey,
    isAvailable: planMeetsRequirement(entitlements.planKey, (row.min_plan ?? "standard") as PlanKey),
    sourceProjectId: String(row.source_project_id),
  }));

  return { data: templates };
}
