import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
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

  // 4. Fetch tabs for this project
  const { data: tabs } = await supabase
    .from("tabs")
    .select("*")
    .eq("project_id", projectId)
    .is("parent_tab_id", null) // Only top-level tabs
    .order("position", { ascending: true });

  const topLevelTabs = tabs || [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto">
        {/* Project Header */}
        <ProjectHeader project={project} />

        {/* Tab Navigation & Content */}
        {topLevelTabs.length > 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 mt-6">
            <TabBar tabs={topLevelTabs} projectId={projectId} />
            
            {/* Tab content will be rendered in child routes */}
            <div className="p-6">
              <div className="text-center text-neutral-500 py-12">
                Select a tab above to view its content
              </div>
            </div>
          </div>
        ) : (
          <EmptyTabsState projectId={projectId} />
        )}
      </div>
    </div>
  );
}