import { createClient } from "@/lib/supabase/server";

export async function requireWorkspaceAdminRole(workspaceId: string, userId: string) {
  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !membership) {
    throw new Error("You do not have access to this workspace.");
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Only workspace owners and admins can manage billing.");
  }

  return membership;
}
