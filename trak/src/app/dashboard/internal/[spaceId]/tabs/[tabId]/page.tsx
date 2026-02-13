import { getProjectTabs } from "@/app/actions/tab";
import { getTabBlocks } from "@/app/actions/block";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import SpaceHeader from "../../space-header";
import TabBar from "../../../../projects/[projectId]/tab-bar";
import TabCanvas from "../../../../projects/[projectId]/tabs/[tabId]/tab-canvas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ spaceId: string; tabId: string }>;
}

export default async function InternalTabPage({ params }: PageProps) {
  const { spaceId, tabId } = await params;
  const supabase = await createClient();

  // Get current workspace
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/dashboard");
  }

  const authResult = await requireWorkspaceAccess(workspaceId);
  if ("error" in authResult) {
    redirect("/login");
  }

  // Get the space
  const { data: space, error: spaceError } = await supabase
    .from("projects")
    .select("id, name, status, project_type")
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId)
    .single();

  if (spaceError || !space) {
    notFound();
  }

  // Verify this is an internal space
  if (space.project_type !== "internal") {
    redirect("/dashboard/projects/" + spaceId);
  }

  // Verify the tab exists and belongs to this space
  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("*")
    .eq("id", tabId)
    .eq("project_id", spaceId)
    .single();

  if (tabError || !tab) {
    notFound();
  }

  // Get all tabs for the tab bar
  const tabsResult = await getProjectTabs(spaceId);
  const tabs = tabsResult.data || [];

  // Organize tabs into hierarchy
  const rootTabs = tabs.filter((t) => !t.parent_tab_id);
  const organizedTabs = rootTabs.map((rootTab) => ({
    ...rootTab,
    children: tabs.filter((t) => t.parent_tab_id === rootTab.id),
  }));

  // Get all blocks for this tab
  const blocksResult = await getTabBlocks(tabId);
  const blocks = blocksResult.data || [];

  return (
    <div className="space-y-6">
      <SpaceHeader space={space} />
      <TabBar tabs={organizedTabs} projectId={spaceId} />
      <TabCanvas tabId={tabId} projectId={spaceId} workspaceId={workspaceId} blocks={blocks} />
    </div>
  );
}
