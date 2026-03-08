import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { resolveProjectIdFromParam } from "@/lib/dashboard-route-resolvers";
import ProjectHeaderWrapper from "./project-header-wrapper";
import TabBar from "./tab-bar";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ projectId: string }>;
}) {
    const supabase = await createClient();
    const { projectId: projectIdParam } = await params;

    // 1. Auth check
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

    // 2. Fetch project details
    const { data: projectRow, error: projectError } = await supabase
        .from("projects")
        .select(
            `id, name, status, due_date_date, due_date_text, priority, tags, client_page_enabled, client_comments_enabled, client_editing_enabled, public_token, workspace_id, client:clients(id, name, company)`
        )
        .eq("id", projectId)
        .eq("workspace_id", workspaceId)
        .single();

    if (projectError || !projectRow) {
        notFound();
    }

    const project = {
        ...projectRow,
        client: Array.isArray(projectRow.client) ? projectRow.client[0] : projectRow.client,
        tags: projectRow.tags ?? [],
    };

    // 3. Fetch tabs hierarchy
    const tabsResult = await getProjectTabs(projectId);
    const hierarchicalTabs = tabsResult.data || [];

    return (
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
                        />
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 w-full relative px-2 md:px-3 lg:px-4 bg-[var(--surface)]">
                {children}
            </div>
        </div>
    );
}
