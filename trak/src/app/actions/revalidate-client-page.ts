"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Revalidates public client pages whenever project content changes.
 *
 * Called by block mutations so public links stay in sync with the dashboard.
 * Revalidation only runs when the project has client pages enabled and a
 * public token. When a tab ID is provided, the helper revalidates the tab
 * route only if that tab is client-visible.
 *
 * @param projectId Project to revalidate
 * @param tabId Optional tab scope
 * @param options Optional cached project info to avoid extra DB lookups
 */
export async function revalidateClientPages(
  projectId: string,
  tabId?: string,
  options?: { publicToken?: string; clientPageEnabled?: boolean }
) {
  const supabase = await createServiceClient();

  let publicToken = options?.publicToken;
  let clientPageEnabled = options?.clientPageEnabled;

  if (publicToken === undefined || clientPageEnabled === undefined) {
    const { data: project } = await supabase
      .from("projects")
      .select("public_token, client_page_enabled")
      .eq("id", projectId)
      .single();

    const projectRecord = project as { public_token: string | null; client_page_enabled: boolean | null } | null;
    publicToken = projectRecord?.public_token ?? undefined;
    clientPageEnabled = projectRecord?.client_page_enabled ?? undefined;
  }

  if (!clientPageEnabled || !publicToken) {
    return;
  }

  const basePath = `/client/${publicToken}`;
  revalidatePath(basePath);

  if (tabId) {
    const { data: tab } = await supabase
      .from("tabs")
      .select("id")
      .eq("id", tabId)
      .eq("is_client_visible", true)
      .single();

    const tabRecord = tab as { id: string } | null;
    if (tabRecord) {
      revalidatePath(`${basePath}/${tabRecord.id}`);
    }
  }
}

