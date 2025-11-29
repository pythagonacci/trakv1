import { getAllProjects } from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import ProjectsTable from "./projects-table";
import FilterBar from "./filter-bar";

// Keep dynamic for real-time data, but allow short caching
export const dynamic = "force-dynamic";
export const revalidate = 5; // Cache for 5 seconds - HUGE speed boost for concurrent users

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
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

  // Await search params and build filters
  const params = await searchParams;
  const filters = {
    project_type: 'project' as const,
    status: params.status as 'not_started' | 'in_progress' | 'complete' | undefined,
    client_id: params.client_id as string | undefined,
    search: params.search as string | undefined,
    sort_by: (params.sort_by as 'created_at' | 'updated_at' | 'due_date_date' | 'name') || 'created_at',
    sort_order: (params.sort_order as 'asc' | 'desc') || 'desc',
  };

  // 🚀 PARALLEL QUERIES - Fetch projects and clients simultaneously
  const [projectsResult, clientsResult] = await Promise.all([
    getAllProjects(workspaceId, filters),
    getAllClients(workspaceId),
  ]);
  
  if (projectsResult.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{projectsResult.error}</p>
        </div>
      </div>
    );
  }

  const clients = clientsResult.data || [];

  // Map nested client object to the shape expected by the table
  const mappedProjects = (projectsResult.data || []).map((project: any) => {
    // Handle Supabase foreign key returning array vs object
    const client = Array.isArray(project.client) ? project.client[0] : project.client;
    
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      due_date_date: project.due_date_date,
      due_date_text: project.due_date_text,
      client_id: project.client_id,
      client_name: client?.name || null,
      created_at: project.created_at,
    };
  });

  return (
    <div>
      <FilterBar clients={clients} />
      <ProjectsTable 
        projects={mappedProjects} 
        workspaceId={workspaceId}
        currentSort={{
          sort_by: filters.sort_by,
          sort_order: filters.sort_order,
        }}
      />
    </div>
  );
}