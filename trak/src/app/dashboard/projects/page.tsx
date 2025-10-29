import { getAllProjects } from "@/app/actions/project";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import ProjectsTable from "./projects-table";

export default async function ProjectsPage() {
  type Project = {
    id: string;
    name: string;
    status: "not_started" | "in_progress" | "complete";
    due_date_date: string | null;
    due_date_text: string | null;
    client_id: string | null;
    created_at: string;
    client?: { id: string; name: string | null; company?: string | null } | null;
  };
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
  const projectsResult = await getAllProjects(workspaceId);

  // Map nested client object to the shape expected by the table (client_name)
  const projects = ((projectsResult.data || []) as Project[]).map((p: Project) => ({
    ...p,
    client_name: p?.client?.name ?? null,
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <ProjectsTable projects={projects} />
    </div>
  );
}