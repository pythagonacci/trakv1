import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getWorkspacePlanLockState } from "@/lib/billing/locks";
import { resolveProjectIdFromParam } from "@/lib/dashboard-route-resolvers";
import PlanLockedState from "@/components/billing/plan-locked-state";
import ProjectHeaderWrapper from "./project-header-wrapper";
import TabBar from "./tab-bar";
import { ProjectUndoProvider } from "./project-undo-context";
import { TabNavigationProvider } from "./tab-navigation-context";
import ClientTabShell from "./client-tab-shell";
import TabPrefetcher from "./tab-prefetcher";
import ProjectOpenTracker from "./project-open-tracker";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ projectId: string; tabId?: string }>;
}) {
    const supabase = await createClient();
    const { projectId: projectIdParam } = await params;

    // 1. Auth + workspace (parallel where possible)
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
        redirect("/dashboard");
    }

    const authResult = await requireWorkspaceAccess(workspaceId);
    if ('error' in authResult) {
        redirect("/login");
    }

    const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectIdParam);
    if (!projectId) {
        notFound();
    }

    // 2. Fetch project + tabs + plan lock in parallel
    const [projectQueryResult, tabsResult, planLockState] = await Promise.all([
        supabase
            .from("projects")
            .select(
                `id, name, status, due_date_date, due_date_text, priority, tags, client_page_enabled, client_comments_enabled, client_editing_enabled, public_token, workspace_id, client:clients(id, name, company)`
            )
            .eq("id", projectId)
            .eq("workspace_id", workspaceId)
            .single(),
        getProjectTabs(projectId),
        getWorkspacePlanLockState(workspaceId),
    ]);

    const { data: projectRow, error: projectError } = projectQueryResult;

    if (projectError || !projectRow) {
        notFound();
    }

    const project = {
        ...projectRow,
        client: Array.isArray(projectRow.client) ? projectRow.client[0] : projectRow.client,
        tags: projectRow.tags ?? [],
    };

    if (planLockState.lockedProjectIds.includes(projectId)) {
        return (
            <PlanLockedState
                title={`${project.name} is locked on Free`}
                description="This project is above the Free plan limits for this workspace. Add a payment method and keep Standard to unlock it again."
            />
        );
    }

    const hierarchicalTabs = tabsResult.data || [];

    return (
        <TabNavigationProvider
            projectId={projectId}
            projectName={project.name}
            tabs={hierarchicalTabs}
            serverTabId={null}
        >
            <ProjectUndoProvider>
                <ProjectOpenTracker projectId={projectId} />
                <div className="flex-1 min-h-0 bg-transparent flex flex-col">
                    <div className="w-full px-2 md:px-3 lg:px-4 shrink-0">
                        <div className="pt-2 pb-1">
                            <ProjectHeaderWrapper project={project} tabs={hierarchicalTabs} workspaceId={workspaceId} />
                        </div>

                        {hierarchicalTabs.length > 0 && (
                            <div className="sticky top-0 z-40 bg-transparent backdrop-blur-sm border-b border-[var(--border)]">
                                <TabBar
                                    tabs={hierarchicalTabs}
                                    projectId={projectId}
                                    projectName={project.name}
                                    isClientProject={!!project.client}
                                    clientPageEnabled={project.client_page_enabled || false}
                                    lockedTabIds={planLockState.lockedTabIds}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 w-full relative pl-2 pr-1 md:pl-2 md:pr-1 lg:pl-2 lg:pr-1 bg-[var(--surface)]">
                        <ClientTabShell
                            projectId={projectId}
                            projectName={project.name}
                            workspaceId={workspaceId}
                            tabs={hierarchicalTabs}
                            lockedBlockIds={planLockState.lockedBlockIds}
                        >
                            {children}
                        </ClientTabShell>
                    </div>
                </div>
            </ProjectUndoProvider>
            <TabPrefetcher tabs={hierarchicalTabs} currentTabId={null} />
        </TabNavigationProvider>
    );
}
