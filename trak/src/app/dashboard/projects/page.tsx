import { getAllProjects, type ProjectFirstTabPreview } from "@/app/actions/project";
import { getAllClients } from "@/app/actions/client";
import { getAllFolders } from "@/app/actions/folder";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getWorkspacePlanLockState } from "@/lib/billing/locks";
import Link from "next/link";
import ProjectsTable from "./projects-table";
import ProjectsGrid from "./projects-grid";
import FilterBar from "./filter-bar";
import ProjectsViewToggle from "./projects-view-toggle";
import { Button } from "@/components/ui/button";

// Keep dynamic for real-time data, but allow short caching
export const dynamic = "force-dynamic";
export const revalidate = 5; // Cache for 5 seconds - HUGE speed boost for concurrent users

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface ProjectListRow {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  folder_id?: string | null;
  created_at: string;
  first_tab_preview?: ProjectFirstTabPreview | null;
  client?:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  // Get current workspace ID from cookie
  const workspaceId = await getCurrentWorkspaceId();
  
  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-[var(--tertiary-foreground)]">No workspace selected</p>
        </div>
      </div>
    );
  }

  // Await search params and build filters
  const params = await searchParams;
  const view = (params.view as "list" | "grid") || "list";
  const filters = {
    project_type: 'project' as const,
    status: params.status as 'not_started' | 'in_progress' | 'complete' | undefined,
    client_id: params.client_id as string | undefined,
    search: params.search as string | undefined,
    sort_by: (params.sort_by as 'created_at' | 'updated_at' | 'due_date_date' | 'name') || 'created_at',
    sort_order: (params.sort_order as 'asc' | 'desc') || 'desc',
  };

  // 🚀 PARALLEL QUERIES - Fetch projects, clients, and folders simultaneously
  const includePreview = view === "grid";

  const [projectsResult, clientsResult, foldersResult, planLockState] = await Promise.all([
    getAllProjects(workspaceId, filters, { includeFirstTabPreview: includePreview }),
    getAllClients(workspaceId),
    getAllFolders(workspaceId),
    getWorkspacePlanLockState(workspaceId),
  ]);
  
  if ("error" in projectsResult) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{projectsResult.error}</p>
        </div>
      </div>
    );
  }

  const clients = "data" in clientsResult ? clientsResult.data ?? [] : [];
  const folders = "data" in foldersResult ? foldersResult.data ?? [] : [];

  // Map nested client object to the shape expected by the table
  const mappedProjects = ((projectsResult.data ?? []) as ProjectListRow[]).map((project) => {
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
      folder_id: project.folder_id || null,
      created_at: project.created_at,
      first_tab_preview: project.first_tab_preview || null,
      is_plan_locked: planLockState.lockedProjectIds.includes(project.id),
    };
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <FilterBar clients={clients} />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-[2px]">
            <Link href="/dashboard/projects/templates">Templates</Link>
          </Button>
          <ProjectsViewToggle currentView={view} />
        </div>
      </div>
      
      {view === "grid" ? (
        <ProjectsGrid 
          projects={mappedProjects} 
          workspaceId={workspaceId}
          folders={folders}
        />
      ) : (
        <ProjectsTable 
          projects={mappedProjects} 
          workspaceId={workspaceId}
          folders={folders}
          currentSort={{
            sort_by: filters.sort_by,
            sort_order: filters.sort_order,
          }}
        />
      )}
    </div>
  );
}
