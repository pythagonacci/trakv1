import { getAllProjects } from "@/app/actions/project";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import ProjectsTable from "./projects-table";

export default async function ProjectsPage() {
  // Get current workspace ID from cookie
  const workspaceId = await getCurrentWorkspaceId();
  
  if (!workspaceId) {
    return (
      <div className="text-center text-neutral-500">
        <p>No workspace selected</p>
      </div>
    );
  }

  // Fetch all projects for the workspace
  const projectsResult = await getAllProjects({
    workspaceId,
  });

  const projects = projectsResult.data || [];

  return (
    <div className="max-w-7xl mx-auto">
      <ProjectsTable projects={projects} />
    </div>
  );
}