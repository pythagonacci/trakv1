import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import ProjectHeader from "./project-header";
import TabBar from "./tab-bar";
import EmptyTabsState from "./empty-tabs-state";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>; // ← Changed to Promise
}) {
  const supabase = await createClient();

  // Await params in Next.js 15
  const { projectId } = await params;

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Get workspace from cookie
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    redirect("/dashboard");
  }

  // 3. Fetch project with client details
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      `
      *,
      client:clients(*)
    `
    )
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // 4. Fetch tabs for this project (hierarchical structure)
  const tabsResult = await getProjectTabs(projectId);
  const hierarchicalTabs = tabsResult.data || [];

  // 5. If tabs exist, redirect to the first tab
  if (hierarchicalTabs.length > 0) {
    const firstTab = hierarchicalTabs[0];
    redirect(`/dashboard/projects/${projectId}/tabs/${firstTab.id}`);
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <ProjectHeader project={project} />

        {/* Empty Tabs State */}
        <EmptyTabsState projectId={projectId} />
      </div>
    </div>
  );
}