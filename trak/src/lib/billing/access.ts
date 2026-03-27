import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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

function getManualBillingOverrideAdminEmails() {
  return (process.env.BILLING_OVERRIDE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function canManageManualBillingOverrides(user: Pick<User, "email"> | null | undefined) {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return getManualBillingOverrideAdminEmails().includes(email);
}

export function requireManualBillingOverrideAdmin(user: Pick<User, "email"> | null | undefined) {
  if (!canManageManualBillingOverrides(user)) {
    throw new Error("You are not allowed to apply manual billing overrides.");
  }
}
