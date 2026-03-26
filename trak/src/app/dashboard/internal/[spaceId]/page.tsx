import { getSingleProject } from "@/app/actions/project";
import { getProjectTabs } from "@/app/actions/tab";
import { notFound, redirect } from "next/navigation";
import { buildProjectPath } from "@/lib/dashboard-routes";
import { getWorkspacePlanLockState } from "@/lib/billing/locks";
import PlanLockedState from "@/components/billing/plan-locked-state";
import SpaceHeader from "./space-header";
import TabBar from "../../projects/[projectId]/tab-bar";
import EmptyTabsState from "../../projects/[projectId]/empty-tabs-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ spaceId: string }>;
}

export default async function InternalSpacePage({ params }: PageProps) {
  const { spaceId } = await params;

  // Get the space (using project API since it's the same table)
  const spaceResult = await getSingleProject(spaceId);

  if (spaceResult.error || !spaceResult.data) {
    notFound();
  }

  const space = spaceResult.data;

  // Verify this is an internal space
  if ((space as any).project_type !== 'internal') {
    redirect(buildProjectPath(spaceId, (space as any).name));
  }

  const workspaceId = (space as any).workspace_id ?? null;
  if (workspaceId) {
    const planLockState = await getWorkspacePlanLockState(workspaceId);
    if (planLockState.lockedProjectIds.includes(spaceId)) {
      return (
        <PlanLockedState
          title={`${(space as any).name ?? "Internal space"} is locked on Free`}
          description="This internal space is above the Free plan limits for this workspace. Add a payment method and keep Standard to unlock it again."
        />
      );
    }
  }

  // Get all tabs for this space
  const tabsResult = await getProjectTabs(spaceId);
  const tabs = tabsResult.data || [];

  // If there are tabs, redirect to the first one
  if (tabs.length > 0) {
    const firstTab = tabs.sort((a, b) => a.position - b.position)[0];
    redirect(`/dashboard/internal/${spaceId}/tabs/${firstTab.id}`);
  }

  // No tabs yet, show empty state
  return (
    <div className="space-y-6">
      <SpaceHeader space={space} />
      <EmptyTabsState projectId={spaceId} projectName={(space as any).name ?? "Internal Space"} />
    </div>
  );
}
