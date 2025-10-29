import { getAllProjects } from "@/app/actions/project";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import ProjectsTable from "./projects-table";

export default async function ProjectsPage() {
  // Get current workspace ID from cookie
  const workspaceId = await getCurrentWorkspaceId();
  
  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  // Fetch all projects for the workspace
  const projectsResult = await getAllProjects(workspaceId);
  
  if (projectsResult.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{projectsResult.error}</p>
        </div>
      </div>
    );
  }

  // Map nested client object to the shape expected by the table
  const mappedProjects = (projectsResult.data || []).map((project: any) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    due_date_date: project.due_date_date,
    due_date_text: project.due_date_text,
    client_id: project.client_id,
    client_name: project.client?.name || null,
    created_at: project.created_at,
  }));

  return (
    <div className="p-8">
      <ProjectsTable projects={mappedProjects} workspaceId={workspaceId} />
    </div>
  );
}