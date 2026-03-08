import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import {
  buildProjectOverviewPath,
  buildProjectPath,
  isCanonicalReadableParam,
} from "@/lib/dashboard-routes";
import { resolveProjectIdFromParam } from "@/lib/dashboard-route-resolvers";
import ProjectHeader from "./project-header";
import EmptyTabsState from "./empty-tabs-state";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>; // ← Changed to Promise
}) {
  const supabase = await createClient();

  // Await params in Next.js 15
  const { projectId: projectIdParam } = await params;

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

  const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectIdParam);
  if (!projectId) {
    notFound();
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

  // 4. Fetch tabs for this project (project already has tags from select *)
  const tabsResult = await getProjectTabs(projectId);
  const hierarchicalTabs = tabsResult.data || [];
  const projectWithTags = { ...project, tags: project.tags ?? [] };

  if (!isCanonicalReadableParam(projectIdParam, project.name)) {
    redirect(buildProjectPath(projectId, project.name));
  }

  // 5. Redirect to project overview by default (or empty state if no tabs)
  if (hierarchicalTabs.length > 0) {
    redirect(buildProjectOverviewPath(projectId, project.name));
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <ProjectHeader project={projectWithTags} workspaceId={workspaceId} />

        {/* Empty Tabs State */}
          <EmptyTabsState projectId={projectId} projectName={project.name} />
      </div>
    </div>
  );
}
